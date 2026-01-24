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
  created_at timestamptz default now()
);

-- Leagues
create table if not exists league (
  leagueid uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique,
  start_date date default current_date,
  end_date date,
  created_by uuid references users(user_id) on delete set null,
  created_at timestamptz default now(),
  constraint valid_dates check (end_date is null or end_date >= start_date)
);

-- Games included in each league
create table if not exists league_game (
  leagueid uuid references league(leagueid) on delete cascade,
  gameid uuid references games(gameid) on delete cascade,
  primary key (leagueid, gameid)
);

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

-- Daily scores: one row per user per league per game per date
create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(user_id) on delete cascade,
  league_id uuid not null references league(leagueid) on delete cascade,
  game_id uuid not null references games(gameid) on delete cascade,
  date date not null,
  score numeric not null,
  created_at timestamptz default now(),
  unique (user_id, league_id, game_id, date)
);

-- Indexes for common queries
create index if not exists idx_scores_league_date on scores(league_id, date);
create index if not exists idx_scores_user_league on scores(user_id, league_id);
create index if not exists idx_scores_user_game on scores(user_id, game_id);
create index if not exists idx_league_invite on league(invite_code);
create index if not exists idx_league_player_user on league_player(userid);

-- Seed default games (run separately if you prefer)
insert into games (name, slug, score_type) values
  ('Wordle', 'wordle', 'lower_better'),
  ('Connections', 'connections', 'lower_better'),
  ('Strands', 'strands', 'lower_better'),
  ('Mini Crossword', 'mini-crossword', 'lower_better'),
  ('Spelling Bee', 'spelling-bee', 'higher_better')
on conflict (slug) do nothing;
