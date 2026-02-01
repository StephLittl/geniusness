-- Migration: Add league handicaps (per league, player, game, with date range and day-of-week multipliers)
-- Run this in the Supabase SQL Editor
-- day_multipliers: JSONB with keys "0"-"6" (0=Sun, 1=Mon, ... 6=Sat). Value = multiplier applied to raw score (e.g. 0.75). Missing key = 1.0.

create table if not exists league_handicap (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references league(leagueid) on delete cascade,
  user_id uuid not null references users(user_id) on delete cascade,
  game_id uuid not null references games(gameid) on delete cascade,
  start_date date not null,
  end_date date,
  day_multipliers jsonb not null default '{}',
  created_at timestamptz default now(),
  constraint league_handicap_dates check (end_date is null or end_date >= start_date)
);

create index if not exists idx_league_handicap_lookup
  on league_handicap(league_id, game_id, user_id, start_date, end_date);

-- Example: Crossword handicaps (Mon/Tue/Wed 0.75, Thu/Fri/Sat 0.5). Replace UUIDs.
-- Sary and stolowd: from league start, no end_date. Sal: 2023-10-01 to 2024-11-24.
/*
INSERT INTO league_handicap (league_id, user_id, game_id, start_date, end_date, day_multipliers)
SELECT
  'YOUR_LEAGUE_UUID',
  u.user_id,
  g.gameid,
  '2023-10-01',
  NULL,
  '{"1": 0.75, "2": 0.75, "3": 0.75, "4": 0.5, "5": 0.5, "6": 0.5}'::jsonb
FROM users u CROSS JOIN games g
WHERE u.username IN ('sary', 'stolowd') AND g.slug = 'crossword';

INSERT INTO league_handicap (league_id, user_id, game_id, start_date, end_date, day_multipliers)
SELECT
  'YOUR_LEAGUE_UUID',
  u.user_id,
  g.gameid,
  '2023-10-01',
  '2024-11-24',
  '{"1": 0.75, "2": 0.75, "3": 0.75, "4": 0.5, "5": 0.5, "6": 0.5}'::jsonb
FROM users u CROSS JOIN games g
WHERE u.username = 'sal' AND g.slug = 'crossword';
*/
