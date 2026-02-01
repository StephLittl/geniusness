#!/usr/bin/env python3
"""
Parse geniusness league CSV(s), compute raw scores (reversing crossword handicaps),
extract Wordle starting words, and output data for DB backfill.

Usage:
  python backfill_league.py file1.csv [file2.csv ...]
  python backfill_league.py --sql file1.csv  # emit INSERT statements (requires id mapping)

Output: JSON by default; use --sql and a mapping file for INSERT statements.
"""

import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

# Game name in CSV -> slug for DB (from your games table)
# Games can have limited runs per league (see league_game.start_date / end_date).
GAME_SLUGS = {
    "crossword": "crossword",
    "connections": "connections",
    "pyramid": "pyramid",
    "bee": "spelling-bee",
    "wordle": "wordle",
    "waffle": "waffle",
    "keyword": "keyword",
    "flashback": "flashback",
    "quintumble": "quintumble",
    "bracketcity": "bracket-city",
}

# Crossword: sary and stolowd always get handicap reversal; sal did until 2024-11-24 (exclusive).
CROSSWORD_HANDICAP_ALWAYS = {"sary", "stolowd"}
SAL_HANDICAP_CUTOFF_DATE = "2024-11-24"  # on or after this date, sal no longer gets handicap reversal
PLAYERS = {"sary", "sal", "bob", "stolowd"}


def _crossword_gets_handicap_reversal(player: str, date: str) -> bool:
    """True if this player's crossword score was handicapped on this date (so we reverse it)."""
    if player in CROSSWORD_HANDICAP_ALWAYS:
        return True
    if player == "sal":
        return date < SAL_HANDICAP_CUTOFF_DATE
    return False


def parse_handicap(s: str) -> float | None:
    """Parse '75%' -> 0.75, '50%' -> 0.5. Returns None if not a handicap."""
    if not s or not isinstance(s, str):
        return None
    s = s.strip()
    m = re.match(r"^(\d+(?:\.\d+)?)\s*%$", s)
    if not m:
        return None
    pct = float(m.group(1))
    if pct <= 0 or pct > 100:
        return None
    return pct / 100.0


def parse_date(s: str) -> str | None:
    """Return date as YYYY-MM-DD or None."""
    if not s or not isinstance(s, str):
        return None
    s = s.strip()
    for fmt in ("%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(s, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def load_csv_rows(path: Path) -> list[list[str]]:
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.reader(f))


def find_header_and_handicap(rows: list[list[str]]) -> tuple[int, int, int] | None:
    """Return (header_row_idx, handicap_row_idx, first_date_col) or None."""
    header_row = None
    handicap_row = None
    for i, row in enumerate(rows):
        if not row:
            continue
        # Header row: has "puz", "player", "cat." and a date
        if "puz" in row and "player" in row and "cat." in row:
            header_row = i
            break
    if header_row is None:
        return None

    # First date column: column that has "12/1/2025" style
    header = rows[header_row]
    first_date_col = None
    for j, cell in enumerate(header):
        if parse_date(cell):
            first_date_col = j
            break
    if first_date_col is None:
        return None

    # Handicap row: row above header that contains "xword handicap"
    for i in range(header_row - 1, -1, -1):
        row = rows[i]
        if any("xword handicap" in (cell or "") for cell in row):
            handicap_row = i
            break
        if any("handicap" in (cell or "").lower() for cell in row):
            handicap_row = i
            break
    if handicap_row is None:
        handicap_row = header_row - 2  # fallback: row 15 in your file

    return (header_row, handicap_row, first_date_col)


def find_starting_words_row(rows: list[list[str]], after_row: int) -> int | None:
    for i in range(after_row, len(rows)):
        row = rows[i]
        if any ("start w" in (cell or "").lower() for cell in row):
            return i
    return None


def extract_handicaps_per_date(
    rows: list[list[str]], handicap_row: int, first_date_col: int, num_dates: int
) -> list[float | None]:
    """Handicap for each date: 0.75, 0.5, or None. Index 0 = first date."""
    out = []
    row = rows[handicap_row]
    # Handicap values align with date columns (75% under 12/1, etc.)
    handicap_start = first_date_col
    for i in range(num_dates):
        col = handicap_start + i
        if col < len(row):
            h = parse_handicap(row[col])
            out.append(h)
        else:
            out.append(None)
    return out


def extract_dates(header_row: list[str], first_date_col: int) -> list[str]:
    dates = []
    for j in range(first_date_col, len(header_row)):
        d = parse_date(header_row[j])
        if d:
            dates.append(d)
        else:
            break
    return dates


def extract_starting_words(
    rows: list[list[str]], words_row_idx: int, first_date_col: int, dates: list[str]
) -> list[tuple[str, str]]:
    """List of (date, word). Word column is first_date_col - 1 + i for date i."""
    row = rows[words_row_idx]
    # "start w/:" is one column before first date; words align with dates
    word_start = first_date_col - 1
    out = []
    for i, date in enumerate(dates):
        col = word_start + i
        if col < len(row):
            w = (row[col] or "").strip()
            if w and w.lower() != "start w/:":
                out.append((date, w))
    return out


def parse_score_cell(cell: str):
    """Return float or int from cell, or None if empty/invalid."""
    if not cell or not isinstance(cell, str):
        return None
    s = cell.strip()
    if not s:
        return None
    try:
        if "." in s:
            return float(s)
        return int(s)
    except ValueError:
        return None


def process_file(path: Path) -> tuple[list[dict], list[tuple[str, str]]]:
    """
    Returns (scores_list, starting_words_list).
    Each score: { "date": "YYYY-MM-DD", "game_slug": str, "player": str, "raw_score": float }
    Each starting word: (date, word)
    """
    rows = load_csv_rows(path)
    meta = find_header_and_handicap(rows)
    if not meta:
        raise SystemExit(f"{path}: could not find header row with dates")

    header_row_idx, handicap_row_idx, first_date_col = meta
    header_row = rows[header_row_idx]
    dates = extract_dates(header_row, first_date_col)
    if not dates:
        raise SystemExit(f"{path}: no dates found")

    handicaps = extract_handicaps_per_date(
        rows, handicap_row_idx, first_date_col, len(dates)
    )

    # Starting words
    words_row = find_starting_words_row(rows, header_row_idx + 1)
    starting_words: list[tuple[str, str]] = []
    if words_row is not None:
        starting_words = extract_starting_words(
            rows, words_row, first_date_col, dates
        )

    # Data row layout varies by file: some have "raw" at first_date_col-1 (scores at first_date_col),
    # others have "raw" at first_date_col (scores at first_date_col+1). Detect from first "raw" row.
    game_col = player_col = cat_col = score_offset = None
    for i in range(header_row_idx + 1, min(header_row_idx + 6, len(rows))):
        row = rows[i]
        if len(row) <= first_date_col:
            continue
        raw_at_date = (row[first_date_col] or "").strip().lower() == "raw"
        raw_before = first_date_col > 0 and (row[first_date_col - 1] or "").strip().lower() == "raw"
        if raw_at_date:
            game_col = first_date_col - 2
            player_col = first_date_col - 1
            cat_col = first_date_col
            score_offset = 1
            break
        if raw_before:
            game_col = first_date_col - 3
            player_col = first_date_col - 2
            cat_col = first_date_col - 1
            score_offset = 0
            break
    if game_col is None:
        raise SystemExit(f"{path}: could not find data row layout (no 'raw' row after header)")
    scores: list[dict] = []

    for i in range(header_row_idx + 1, len(rows)):
        row = rows[i]
        if len(row) <= max(game_col, player_col, cat_col):
            continue
        cat = (row[cat_col] or "").strip().lower()
        if cat != "raw":
            continue
        game_name = (row[game_col] or "").strip().lower()
        player = (row[player_col] or "").strip().lower()
        if not game_name or player not in PLAYERS:
            continue
        slug = GAME_SLUGS.get(game_name) or game_name.replace(" ", "_")
        is_crossword = game_name == "crossword"
        for date_idx, date in enumerate(dates):
            score_col = first_date_col + score_offset + date_idx
            if score_col >= len(row):
                break
            val = parse_score_cell(row[score_col])
            if val is None:
                continue
            # Reverse handicap for crossword + sary/stolowd
            if is_crossword and _crossword_gets_handicap_reversal(player, date):
                h = handicaps[date_idx] if date_idx < len(handicaps) else None
                if h and h > 0:
                    val = val / h
            # Wordle: spreadsheet has "remaining slots" (0–5) or -1 for fail; store guesses (1–6) or 7 for fail
            if slug == "wordle":
                if val == -1:
                    val = 7  # failed
                elif 0 <= val <= 5:
                    val = 6 - int(val)  # remaining 0 → 6 guesses, remaining 5 → 1 guess
            # Connections: spreadsheet 5=0 mistakes, 4=1, 3=2, 2=3, 1=4, 0=fail; DB stores mistakes (0–4), fail=4
            if slug == "connections":
                if val == 0:
                    val = 4  # fail = 4 mistakes
                elif 1 <= val <= 5:
                    val = 5 - int(val)  # 5→0, 4→1, 3→2, 2→3, 1→4 mistakes
            scores.append({
                "date": date,
                "game_slug": slug,
                "player": player,
                "raw_score": round(val, 4) if isinstance(val, float) else val,
            })

    return scores, starting_words


def main():
    ap = argparse.ArgumentParser(description="Parse league CSV and output backfill data")
    ap.add_argument("files", nargs="+", type=Path, help="CSV file(s)")
    ap.add_argument("--sql", action="store_true", help="Emit SQL INSERTs (requires --ids)")
    ap.add_argument(
        "--ids",
        type=Path,
        help="JSON file: user_ids, game_ids (by slug), league_id, optional league_games (slug -> start_date/end_date)",
    )
    ap.add_argument("-o", "--output", type=Path, help="Write output to file (default: stdout)")
    ap.add_argument(
        "--allow-placeholders",
        action="store_true",
        help="Emit SQL even when ids look like placeholders (YOUR_*, REPLACE_*). Use for find-replace workflow.",
    )
    ap.add_argument(
        "--deduplicate",
        action="store_true",
        help="Keep first occurrence when same (player, game, date) appears in multiple CSVs; warn instead of error.",
    )
    args = ap.parse_args()

    all_scores = []
    all_starting_words: list[tuple[str, str]] = []
    seen_dates_words: set[tuple[str, str]] = set()

    for path in args.files:
        if not path.exists():
            print(f"Skip (not found): {path}", file=sys.stderr)
            continue
        scores, words = process_file(path)
        for s in scores:
            s["_source"] = str(path)
        all_scores.extend(scores)
        for d, w in words:
            key = (d, w)
            if key not in seen_dates_words:
                seen_dates_words.add(key)
                all_starting_words.append((d, w))

    # Detect duplicate (player, game, date) across files — same key in multiple CSVs
    by_key: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
    for s in all_scores:
        key = (s["player"], s["game_slug"], s["date"])
        by_key[key].append(s)
    duplicates = {k: v for k, v in by_key.items() if len(v) > 1}
    if duplicates:
        sources = []
        for (player, game_slug, date), group in sorted(duplicates.items()):
            files = sorted(set(s["_source"] for s in group))
            sources.append(f"  ({player}, {game_slug}, {date}) from: {', '.join(files)}")
        msg = (
            "Duplicate scores (same player, game, date) found across CSV files.\n"
            "This would violate scores_user_game_date_unique. Sources:\n"
            + "\n".join(sources[:20])
            + ("\n  ... and more" if len(sources) > 20 else "")
        )
        if args.deduplicate:
            # Keep first occurrence per key, drop the rest
            seen_key: set[tuple[str, str, str]] = set()
            deduped = []
            for s in all_scores:
                key = (s["player"], s["game_slug"], s["date"])
                if key in seen_key:
                    continue
                seen_key.add(key)
                deduped.append(s)
            all_scores = deduped
            print(
                f"Warning: {sum(len(g) - 1 for g in duplicates.values())} duplicate score(s) removed (same player/game/date in multiple CSVs). First occurrence kept.",
                file=sys.stderr,
            )
        else:
            print(msg, file=sys.stderr)
            raise SystemExit(1)

    if args.sql:
        ids = {}
        if args.ids and args.ids.exists():
            with open(args.ids, encoding="utf-8") as f:
                ids = json.load(f)
        user_ids = ids.get("user_ids") or {}
        game_ids = ids.get("game_ids") or {}
        league_id = ids.get("league_id") or "REPLACE_LEAGUE_ID"
        league_games = ids.get("league_games") or {}
        lines = []
        # league_game: which games ran for which date range in this league (optional)
        for slug, range_spec in sorted(league_games.items()):
            start_date = range_spec.get("start_date")
            end_date = range_spec.get("end_date")
            if not start_date:
                continue
            gid = game_ids.get(slug)
            if not gid or gid == "REPLACE_GAME_ID":
                continue
            end_sql = f"'{end_date}'" if end_date else "NULL"
            lines.append(
                f"INSERT INTO public.league_game (leagueid, gameid, start_date, end_date) VALUES ('{league_id}', '{gid}', '{start_date}', {end_sql});"
            )
        def _is_placeholder(val: str) -> bool:
            if args.allow_placeholders:
                return False
            if not val:
                return True
            return "REPLACE_" in val or val.startswith("YOUR_")

        seen_ug = set()
        skipped_scores = 0
        seen_score_key: set[tuple[str, str, str]] = set()
        duplicate_in_sql: list[tuple[str, str, str]] = []
        for s in all_scores:
            uid = user_ids.get(s["player"], "REPLACE_USER_ID")
            gid = game_ids.get(s["game_slug"], "REPLACE_GAME_ID")
            if _is_placeholder(uid) or _is_placeholder(gid):
                skipped_scores += 1
                continue
            key = (uid, gid, s["date"])
            if key in seen_score_key:
                duplicate_in_sql.append(key)
            seen_score_key.add(key)
            lines.append(
                f"INSERT INTO public.scores (user_id, game_id, date, score) VALUES ('{uid}', '{gid}', '{s['date']}', {s['raw_score']});"
            )
            seen_ug.add((uid, gid))
        if duplicate_in_sql:
            print(
                "Duplicate (user_id, game_id, date) in generated SQL — would violate scores_user_game_date_unique:\n"
                + "\n".join(f"  {k[0][:8]}... {k[1][:8]}... {k[2]}" for k in duplicate_in_sql[:30])
                + ("\n  ... and more" if len(duplicate_in_sql) > 30 else ""),
                file=sys.stderr,
            )
            raise SystemExit(1)
        if skipped_scores:
            print(
                f"Warning: skipped {skipped_scores} score row(s) — no valid user_id/game_id mapping. Use --ids with a JSON file that has your real UUIDs.",
                file=sys.stderr,
            )
        for (uid, gid) in sorted(seen_ug):
            lines.append(
                f"INSERT INTO public.user_games (user_id, game_id) VALUES ('{uid}', '{gid}') ON CONFLICT (game_id, user_id) DO NOTHING;"
            )
        if _is_placeholder(league_id):
            if all_starting_words:
                print(
                    "Warning: skipped league_starting_words — no valid league_id. Set league_id in your ids file.",
                    file=sys.stderr,
                )
        else:
            for date, word in all_starting_words:
                word_esc = (word or "").replace("'", "''")
                lines.append(
                    f"INSERT INTO public.league_starting_words (league_id, date, word) VALUES ('{league_id}', '{date}', '{word_esc}');"
                )
        if not lines:
            print(
                "No INSERTs generated — backfill.sql will be empty.\n"
                "The script skips rows when user_id/game_id/league_id look like placeholders (YOUR_* or REPLACE_*).\n"
                "Put your real UUIDs in the JSON file passed to --ids (e.g. ids.json) and run again.",
                file=sys.stderr,
            )
        else:
            score_count = sum(1 for ln in lines if ln.strip().startswith("INSERT INTO public.scores "))
            dest = args.output or "stdout"
            print(f"Wrote {len(lines)} statement(s) ({score_count} score INSERTs) to {dest}.", file=sys.stderr)
            if args.output:
                print(
                    "If the SQL fails with 'duplicate key ... scores_user_game_date_unique', the DB already has those rows (e.g. from a previous run).",
                    file=sys.stderr,
                )
        out = "\n".join(lines)
    else:
        out = json.dumps({
            "scores": all_scores,
            "starting_words": [{"date": d, "word": w} for d, w in all_starting_words],
        }, indent=2)

    if args.output:
        args.output.write_text(out, encoding="utf-8")
    else:
        print(out)


if __name__ == "__main__":
    main()
