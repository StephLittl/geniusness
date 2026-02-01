-- League standings with handicaps: day-by-day ranks (1–4) then month totals
-- Replace league id and date range as needed. Day-of-week: 0=Sun, 1=Mon, ... 6=Sat.

WITH league_members AS (
  SELECT userid FROM league_player WHERE leagueid = 'af85fcf2-5b3a-4ca9-88a4-4352c1891a89'
),
-- Apply handicap: adjusted_score = score * multiplier for (user, game, date); no handicap = 1.0
scores_with_handicap AS (
  SELECT
    s.user_id,
    s.game_id,
    s.date,
    s.score,
    g.score_type,
    (s.score * COALESCE(
      (
        SELECT (h.day_multipliers->>((extract(dow FROM s.date)::int)::text))::numeric
        FROM league_handicap h
        WHERE h.league_id = 'af85fcf2-5b3a-4ca9-88a4-4352c1891a89'
          AND h.user_id = s.user_id
          AND h.game_id = s.game_id
          AND s.date >= h.start_date
          AND (h.end_date IS NULL OR s.date <= h.end_date)
        LIMIT 1
      ),
      1
    )) AS adjusted_score
  FROM scores s
  JOIN league_members lm ON lm.userid = s.user_id
  JOIN games g ON g.gameid = s.game_id
  JOIN league_game lg ON lg.leagueid = 'af85fcf2-5b3a-4ca9-88a4-4352c1891a89'
    AND lg.gameid = s.game_id
    AND lg.start_date <= s.date
    AND (lg.end_date IS NULL OR lg.end_date >= s.date)
  WHERE s.date >= '2026-01-01' AND s.date <= '2026-01-31'
),
-- 1) Per game per day: rank by adjusted score; ties get same pts, next gets next integer (1,1,3,4)
points_per_game_day AS (
  SELECT
    user_id,
    game_id,
    date,
    score_type,
    CASE
      WHEN score_type = 'lower_better' THEN rank() OVER (PARTITION BY game_id, date ORDER BY adjusted_score ASC)
      ELSE rank() OVER (PARTITION BY game_id, date ORDER BY adjusted_score DESC)
    END AS game_rank
  FROM scores_with_handicap
),
-- 2) Per user per day: sum of game ranks (raw daily total)
daily_raw_totals AS (
  SELECT user_id, date, SUM(game_rank) AS daily_raw_points
  FROM points_per_game_day
  GROUP BY user_id, date
),
-- 3) Per day: rank by daily_raw_points (lower better); ties same pts, next gets next integer (1,1,3,4)
daily_rank_points AS (
  SELECT
    user_id,
    date,
    daily_raw_points,
    rank() OVER (PARTITION BY date ORDER BY daily_raw_points ASC) AS day_rank
  FROM daily_raw_totals
)
-- 4) Output: day-by-day (date, user, raw total, day rank) then month totals
SELECT d.date, u.username, d.daily_raw_points, d.day_rank AS points
FROM daily_rank_points d
JOIN users u ON u.user_id = d.user_id
UNION ALL
SELECT NULL AS date, u.username, NULL AS daily_raw_points, SUM(d.day_rank) AS points
FROM daily_rank_points d
JOIN users u ON u.user_id = d.user_id
GROUP BY u.user_id, u.username
ORDER BY date NULLS LAST, points ASC, username;
