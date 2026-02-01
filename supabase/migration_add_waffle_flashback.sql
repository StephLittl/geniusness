-- Migration: Add Waffle and Flashback games with share parsers
-- Run this in the Supabase SQL Editor

-- Add games
INSERT INTO games (name, slug, score_type, color, scoring_info) VALUES
  ('Waffle', 'waffle', 'higher_better', '#f7b731', 'Swaps remaining (out of 5). Higher is better.'),
  ('Flashback', 'flashback', 'higher_better', '#4a90d9', 'Points. Higher is better.')
ON CONFLICT (slug) DO UPDATE SET
  color = EXCLUDED.color,
  scoring_info = EXCLUDED.scoring_info;

-- Waffle: Extract swaps remaining from "#waffle1472 4/5"
INSERT INTO game_share_parsers (game_id, pattern_type, pattern, score_path)
SELECT gameid, 'regex', '#waffle\d+\s+(\d+)/5', '1'
FROM games WHERE slug = 'waffle'
ON CONFLICT (game_id) DO UPDATE SET
  pattern_type = EXCLUDED.pattern_type,
  pattern = EXCLUDED.pattern,
  score_path = EXCLUDED.score_path;

-- Flashback: Extract points from "22 points"
INSERT INTO game_share_parsers (game_id, pattern_type, pattern, score_path)
SELECT gameid, 'regex', '(\d+)\s*points', '1'
FROM games WHERE slug = 'flashback'
ON CONFLICT (game_id) DO UPDATE SET
  pattern_type = EXCLUDED.pattern_type,
  pattern = EXCLUDED.pattern,
  score_path = EXCLUDED.score_path;
