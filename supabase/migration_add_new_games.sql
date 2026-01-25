-- Migration: Add new games with colors, scoring info, and parsing rules
-- Run this in the Supabase SQL Editor

-- Add new games
INSERT INTO games (name, slug, score_type, color, scoring_info) VALUES
  ('Crossword', 'crossword', 'lower_better', '#000000', 'Time in minutes and seconds. Lower is better.'),
  ('Connections', 'connections', 'lower_better', '#9334e6', 'Number of errors. Lower is better.'),
  ('Wordle', 'wordle', 'lower_better', '#6aaa64', 'Number of guesses (1-6). Lower is better.'),
  ('Keyword', 'keyword', 'lower_better', '#ff6b6b', 'Time in seconds (base time + 10s per error). Lower is better.'),
  ('Quintumble', 'quintumble', 'higher_better', '#4ecdc4', 'Score. Higher is better.'),
  ('Spelling Bee', 'spelling-bee', 'higher_better', '#ffc700', '0 = no genius, 1 = genius, 2 = queen bee. Higher is better.'),
  ('Pyramid Scheme', 'pyramid-scheme', 'lower_better', '#ff9f43', 'Time in minutes and seconds. Lower is better.'),
  ('Bracket City', 'bracket-city', 'higher_better', '#5f27cd', 'Score. Higher is better.')
ON CONFLICT (slug) DO UPDATE SET
  color = EXCLUDED.color,
  scoring_info = EXCLUDED.scoring_info;

-- Add parsing rules for games that support share link parsing

-- Connections: Count lines that aren't all one color (errors)
-- Pattern: Look for lines with mixed colors (not all 🟪, 🟦, 🟩, or 🟨)
INSERT INTO game_share_parsers (game_id, pattern_type, pattern, score_path)
SELECT gameid, 'regex', 'connections', 'count_errors'
FROM games WHERE slug = 'connections'
ON CONFLICT (game_id) DO UPDATE SET
  pattern_type = EXCLUDED.pattern_type,
  pattern = EXCLUDED.pattern,
  score_path = EXCLUDED.score_path;

-- Wordle: Count number of lines (guesses)
INSERT INTO game_share_parsers (game_id, pattern_type, pattern, score_path)
SELECT gameid, 'regex', 'wordle', 'count_lines'
FROM games WHERE slug = 'wordle'
ON CONFLICT (game_id) DO UPDATE SET
  pattern_type = EXCLUDED.pattern_type,
  pattern = EXCLUDED.pattern,
  score_path = EXCLUDED.score_path;

-- Quintumble: Extract score from "🎯 98"
INSERT INTO game_share_parsers (game_id, pattern_type, pattern, score_path)
SELECT gameid, 'regex', '🎯\\s*(\\d+)', '1'
FROM games WHERE slug = 'quintumble'
ON CONFLICT (game_id) DO UPDATE SET
  pattern_type = EXCLUDED.pattern_type,
  pattern = EXCLUDED.pattern,
  score_path = EXCLUDED.score_path;

-- Spelling Bee: Parse URL for r=Genius or r=Queen Bee
INSERT INTO game_share_parsers (game_id, pattern_type, pattern, score_path)
SELECT gameid, 'url_param', 'r', 'spelling_bee_rank'
FROM games WHERE slug = 'spelling-bee'
ON CONFLICT (game_id) DO UPDATE SET
  pattern_type = EXCLUDED.pattern_type,
  pattern = EXCLUDED.pattern,
  score_path = EXCLUDED.score_path;

-- Pyramid Scheme: Extract time from "Solved on Expert Mode in 0:08"
INSERT INTO game_share_parsers (game_id, pattern_type, pattern, score_path)
SELECT gameid, 'regex', 'Solved on Expert Mode in (\\d+):(\\d+)', 'time_mm_ss'
FROM games WHERE slug = 'pyramid-scheme'
ON CONFLICT (game_id) DO UPDATE SET
  pattern_type = EXCLUDED.pattern_type,
  pattern = EXCLUDED.pattern,
  score_path = EXCLUDED.score_path;

-- Bracket City: Extract score from "Total Score: 98.0"
INSERT INTO game_share_parsers (game_id, pattern_type, pattern, score_path)
SELECT gameid, 'regex', 'Total Score:\\s*(\\d+(?:\\.\\d+)?)', '1'
FROM games WHERE slug = 'bracket-city'
ON CONFLICT (game_id) DO UPDATE SET
  pattern_type = EXCLUDED.pattern_type,
  pattern = EXCLUDED.pattern,
  score_path = EXCLUDED.score_path;
