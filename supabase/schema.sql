-- Geniusness: Daily Puzzle League – Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor) to create tables.

-- Users (profiles; auth handled by Supabase Auth)
create table if not exists users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  username text unique not null,
  email text not null,
  created_at timestamptz default now()
);

-- Daily puzzle games (Wordle, Connections, etc.)
create table if not exists games (
  gameid uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  score_type text not null check (score_type in ('lower_better', 'higher_better')),
  color text,
  scoring_info text,
  created_at timestamptz default now()
);

-- Share link parsing rules for games
create table if not exists game_share_parsers (
  game_id uuid primary key references games(gameid) on delete cascade,
  pattern_type text not null, -- 'regex', 'json', 'url_param', etc.
  pattern text not null, -- regex pattern, JSON path, etc.
  score_path text, -- where to extract score from (for JSON, regex groups, etc.)
  created_at timestamptz default now()
);

-- Leagues
-- league_type: 'tracking' (infinite, no winners), 'periodic' (infinite with resets), 'dated' (specific dates)
-- reset_period: For periodic leagues - 'weekly', 'monthly', 'yearly', or 'custom'
-- custom_period_days: For periodic leagues with custom period (in days)
-- requires_starting_word: If true, this league requires all players to use the same starting Wordle word each day
--   (Only one league can have this set to true at a time)
create table if not exists league (
  leagueid uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique,
  league_type text not null default 'tracking' check (league_type in ('tracking', 'periodic', 'dated')),
  start_date date default current_date,
  end_date date,
  reset_period text check (reset_period in ('weekly', 'monthly', 'yearly', 'custom') or reset_period is null),
  custom_period_days integer check (custom_period_days is null or custom_period_days > 0),
  requires_starting_word boolean default false,
  -- Legacy columns (kept for migration compatibility)
  duration_type text check (duration_type in ('weekly', 'monthly', 'yearly', 'indefinite', 'specific')),
  is_repeating boolean default false,
  created_by uuid references users(user_id) on delete set null,
  created_at timestamptz default now(),
  constraint valid_dates check (end_date is null or end_date >= start_date),
  constraint valid_periodic check (
    (league_type = 'periodic' and reset_period is not null) or 
    (league_type != 'periodic')
  ),
  constraint valid_custom_period check (
    (reset_period = 'custom' and custom_period_days is not null) or 
    (reset_period != 'custom')
  ),
  constraint valid_dated check (
    (league_type = 'dated' and start_date is not null and end_date is not null) or 
    (league_type != 'dated')
  )
);

-- Daily starting words for leagues that require them
create table if not exists league_starting_words (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references league(leagueid) on delete cascade,
  date date not null,
  word text not null,
  created_at timestamptz default now(),
  unique (league_id, date)
);

-- Indexes
create index if not exists idx_league_starting_words_league_date on league_starting_words(league_id, date);
-- Ensure only one league can have requires_starting_word = true
create unique index if not exists idx_only_one_starting_word_league on league(leagueid) where requires_starting_word = true;

-- Games included in each league (temporal: add/drop over time)
-- start_date: when the game was added to the league
-- end_date: when the game was dropped (NULL = still active)
create table if not exists league_game (
  id uuid primary key default gen_random_uuid(),
  leagueid uuid not null references league(leagueid) on delete cascade,
  gameid uuid not null references games(gameid) on delete cascade,
  start_date date not null default current_date,
  end_date date,
  constraint league_game_dates_valid check (end_date is null or end_date >= start_date)
);

-- Only one active (end_date IS NULL) row per league+game at a time
create unique index if not exists idx_league_game_active_unique
  on league_game (leagueid, gameid)
  where end_date is null;

create index if not exists idx_league_game_dates on league_game(leagueid, start_date, end_date);

-- Players in each league
create table if not exists league_player (
  leagueid uuid references league(leagueid) on delete cascade,
  userid uuid references users(user_id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (leagueid, userid)
);

-- User's selected daily games (which games they play)
create table if not exists user_games (
  user_id uuid references users(user_id) on delete cascade,
  game_id uuid references games(gameid) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, game_id)
);

-- Daily scores: one row per user per game per date (league-agnostic)
create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(user_id) on delete cascade,
  game_id uuid not null references games(gameid) on delete cascade,
  date date not null,
  score numeric not null,
  created_at timestamptz default now(),
  unique (user_id, game_id, date)
);

-- Indexes for common queries
create index if not exists idx_scores_user_game_date on scores(user_id, game_id, date);
create index if not exists idx_scores_user_game on scores(user_id, game_id);
create index if not exists idx_scores_date on scores(date);
create index if not exists idx_league_invite on league(invite_code);
create index if not exists idx_league_player_user on league_player(userid);

-- Seed default games (run separately if you prefer)
insert into games (name, slug, score_type, color, scoring_info) values
  ('Wordle', 'wordle', 'lower_better', '#6aaa64', 'Number of guesses (1-6). Lower is better.'),
  ('Connections', 'connections', 'lower_better', '#9334e6', 'Number of errors. Lower is better.'),
  ('Strands', 'strands', 'lower_better', '#f7da21', 'Number of words found. Lower is better.'),
  ('Mini Crossword', 'mini-crossword', 'lower_better', '#000000', 'Time in seconds. Lower is better.'),
  ('Spelling Bee', 'spelling-bee', 'higher_better', '#ffc700', 'Total points. Higher is better.')
on conflict (slug) do nothing;

-- Add share link parsers (examples - adjust patterns as needed)
insert into game_share_parsers (game_id, pattern_type, pattern, score_path)
select gameid, 'regex', 'Wordle \d+ (\d)/6', '1'
from games where slug = 'wordle'
on conflict do nothing;

insert into game_share_parsers (game_id, pattern_type, pattern, score_path)
select gameid, 'regex', 'Connections\nPuzzle #\d+\n(\d)/4', '1'
from games where slug = 'connections'
on conflict do nothing;
