-- Migration: Remove league_id from scores table
-- This makes scores user-centric rather than league-centric
-- Run this in Supabase SQL Editor

-- Step 1: Deduplicate existing scores (keep one score per user/game/date)
-- This handles the case where the same score exists for multiple leagues
-- We keep the earliest created score for each user/game/date combination
DELETE FROM scores
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, game_id, date 
             ORDER BY created_at ASC
           ) as rn
    FROM scores
  ) t
  WHERE t.rn > 1
);

-- Verify deduplication (should show 0 duplicates)
SELECT user_id, game_id, date, COUNT(*) as count
FROM scores
GROUP BY user_id, game_id, date
HAVING COUNT(*) > 1;

-- Step 2: Drop the old unique constraint that includes league_id
ALTER TABLE scores 
DROP CONSTRAINT IF EXISTS scores_user_id_league_id_game_id_date_key;

-- Step 3: Drop the league_id column
ALTER TABLE scores 
DROP COLUMN IF EXISTS league_id;

-- Step 4: Add new unique constraint (user_id, game_id, date)
ALTER TABLE scores 
ADD CONSTRAINT scores_user_game_date_unique UNIQUE (user_id, game_id, date);

-- Step 5: Update indexes (remove league_id from index, add new one if needed)
DROP INDEX IF EXISTS idx_scores_league_date;
CREATE INDEX IF NOT EXISTS idx_scores_user_game_date ON scores(user_id, game_id, date);

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'scores'
ORDER BY ordinal_position;
