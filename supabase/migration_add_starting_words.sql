-- Migration: Add starting Wordle word feature for leagues
-- Only one league can require a starting word at a time

-- Step 1: Add column to league table
ALTER TABLE league 
ADD COLUMN IF NOT EXISTS requires_starting_word boolean DEFAULT false;

-- Step 2: Create table for daily starting words
CREATE TABLE IF NOT EXISTS league_starting_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES league(leagueid) ON DELETE CASCADE,
  date date NOT NULL,
  word text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (league_id, date)
);

-- Step 3: Create index for lookups
CREATE INDEX IF NOT EXISTS idx_league_starting_words_league_date 
ON league_starting_words(league_id, date);

-- Step 4: Add constraint to ensure only one league has requires_starting_word = true
-- Note: This is a partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_only_one_starting_word_league 
ON league(leagueid) 
WHERE requires_starting_word = true;
