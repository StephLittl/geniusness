-- Migration: Add color and scoring_info to games table
-- Run this in Supabase SQL Editor if you already have the games table

ALTER TABLE games 
ADD COLUMN IF NOT EXISTS color text,
ADD COLUMN IF NOT EXISTS scoring_info text;

-- Create game_share_parsers table
CREATE TABLE IF NOT EXISTS game_share_parsers (
  game_id uuid PRIMARY KEY REFERENCES games(gameid) ON DELETE CASCADE,
  pattern_type text NOT NULL,
  pattern text NOT NULL,
  score_path text,
  created_at timestamptz DEFAULT now()
);

-- Update existing games with colors and scoring info
UPDATE games SET 
  color = '#6aaa64',
  scoring_info = 'Number of guesses (1-6). Lower is better.'
WHERE slug = 'wordle';

UPDATE games SET 
  color = '#9334e6',
  scoring_info = 'Number of errors. Lower is better.'
WHERE slug = 'connections';

UPDATE games SET 
  color = '#f7da21',
  scoring_info = 'Number of words found. Lower is better.'
WHERE slug = 'strands';

UPDATE games SET 
  color = '#000000',
  scoring_info = 'Time in seconds. Lower is better.'
WHERE slug = 'mini-crossword';

UPDATE games SET 
  color = '#ffc700',
  scoring_info = 'Total points. Higher is better.'
WHERE slug = 'spelling-bee';

-- Add example share parsers (adjust patterns as needed based on actual share formats)
INSERT INTO game_share_parsers (game_id, pattern_type, pattern, score_path)
SELECT gameid, 'regex', 'Wordle \d+ (\d)/6', '1'
FROM games WHERE slug = 'wordle'
ON CONFLICT (game_id) DO NOTHING;

INSERT INTO game_share_parsers (game_id, pattern_type, pattern, score_path)
SELECT gameid, 'regex', 'Connections\nPuzzle #\d+\n(\d)/4', '1'
FROM games WHERE slug = 'connections'
ON CONFLICT (game_id) DO NOTHING;
