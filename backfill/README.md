# League CSV backfill

Parse geniusness league CSV(s), compute **raw** scores (reversing crossword handicaps for sary/stolowd), extract Wordle starting words, and output data for DB backfill.

## Quick start (CSVs in `data/`)

1. **Create your ids file**  
   Copy `ids.example.json` to `ids.json` in this directory and fill in your real UUIDs (from your DB) for `user_ids`, `game_ids`, and `league_id`. Leave `league_games` as-is unless your league dates differ.

2. **Generate SQL** (from the project root):
   ```bash
   python3 backfill_league.py --sql --ids ids.json data/*.csv -o backfill.sql
   ```
   If you get an empty `backfill.sql`, the script is skipping rows because the ids file still has placeholders (`YOUR_*` or `REPLACE_*`). Either put your real UUIDs in `ids.json`, or run with `--allow-placeholders` to generate SQL with placeholders and find-replace them later.

3. **Run the SQL** against your database, e.g.:
   ```bash
   psql "your_connection_string" -f backfill.sql
   ```
   Or open `backfill.sql` in your DB client and execute it.

## Usage

**JSON output (default)** — use this to inspect data or feed another tool:

```bash
python3 backfill_league.py "geniusness 1225.xlsx - current.csv"
python3 backfill_league.py file1.csv file2.csv -o out.json
```

**SQL output** — provide a mapping file so the script can emit `INSERT` statements:

1. Copy `ids.example.json` to e.g. `ids.json` and fill in your UUIDs for:
   - `user_ids`: player name → `user_id` (sal, bob, sary, stolowd)
   - `game_ids`: **game slug** → `game_id` (crossword, connections, pyramid, spelling-bee, wordle, waffle, keyword, flashback, quintumble, bracket-city)
   - `league_id`: your league UUID (for `league_starting_words` and `league_game`)
   - `league_games` (optional): per-game date ranges for this league. Games can run for limited periods (e.g. waffle 2023-10-01 → 2024-09-30, flashback 2023-11-01 → 2024-06-30). Each entry is `"slug": { "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" or null }`. When present, the script emits `league_game` INSERTs first.

2. Run:

```bash
python3 backfill_league.py --sql --ids ids.json "geniusness 1225.xlsx - current.csv" -o backfill.sql
```

Then run `backfill.sql` against your DB (e.g. `psql ... -f backfill.sql`).

## Behaviour

- **Scores**: Only rows with category `raw` are used. For **crossword**, sary and stolowd have handicaps (75% or 50% per day); the script **reverses** these so you get raw times: `raw_time = displayed_score / handicap`.
- **Starting words**: Taken from the row that contains “start w/:” (one word per date).
- **SQL**: When `league_games` is in the ids file, emits `league_game` INSERTs first (leagueid, gameid, start_date, end_date), then `scores`, deduplicated `user_games`, and `league_starting_words`. If you don’t have a unique constraint on `(user_id, game_id, date)` for `scores`, add one or run the script once to avoid duplicates.
