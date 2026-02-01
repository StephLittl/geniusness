-- Migration: Add start_date and end_date to league_game for temporal add/drop support
-- Run this in the Supabase SQL Editor

-- Add new columns
ALTER TABLE league_game ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE league_game ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE league_game ADD COLUMN IF NOT EXISTS end_date date;

-- Backfill start_date from league (or current_date if league has no start_date)
UPDATE league_game lg
SET start_date = COALESCE(l.start_date, current_date)
FROM league l
WHERE l.leagueid = lg.leagueid
  AND lg.start_date IS NULL;

-- For any rows still null (orphaned), use current_date
UPDATE league_game SET start_date = current_date WHERE start_date IS NULL;

-- Make start_date NOT NULL
ALTER TABLE league_game ALTER COLUMN start_date SET NOT NULL;

-- Drop old primary key
ALTER TABLE league_game DROP CONSTRAINT IF EXISTS league_game_pkey;

-- Ensure all rows have id
UPDATE league_game SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE league_game ALTER COLUMN id SET NOT NULL;

-- Add new primary key
ALTER TABLE league_game ADD PRIMARY KEY (id);

-- Ensure only one "active" (end_date IS NULL) row per league+game
CREATE UNIQUE INDEX IF NOT EXISTS idx_league_game_active_unique
ON league_game (leagueid, gameid)
WHERE end_date IS NULL;

-- Index for date-range queries (games active on a given date)
CREATE INDEX IF NOT EXISTS idx_league_game_dates ON league_game(leagueid, start_date, end_date);
