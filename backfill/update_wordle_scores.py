#!/usr/bin/env python3
"""
Generate SQL to fix existing Wordle scores in the database.

The spreadsheet stores "remaining slots" (0–5) or -1 for fail. The DB should store
number of guesses (1–6) or 7 for fail. This script outputs an UPDATE that converts
existing rows: remaining 0 → 6, remaining 5 → 1, -1 → 7.

Usage:
  python3 update_wordle_scores.py --ids ids.json [-o update_wordle.sql]
"""

import argparse
import json
from pathlib import Path


def main():
    ap = argparse.ArgumentParser(description="Generate SQL to convert Wordle scores from remaining-slots to guesses")
    ap.add_argument("--ids", type=Path, required=True, help="JSON file with game_ids (must have 'wordle' key)")
    ap.add_argument("-o", "--output", type=Path, help="Write SQL to file (default: stdout)")
    args = ap.parse_args()

    if not args.ids.exists():
        raise SystemExit(f"Ids file not found: {args.ids}")

    with open(args.ids, encoding="utf-8") as f:
        ids = json.load(f)
    game_ids = ids.get("game_ids") or {}
    wordle_id = game_ids.get("wordle")
    if not wordle_id or wordle_id.startswith("YOUR_") or "REPLACE" in wordle_id:
        raise SystemExit("ids file must contain a real game_ids.wordle UUID (not a placeholder)")

    sql = f"""-- Convert Wordle scores from "remaining slots" (0-5, -1 fail) to "guesses" (1-6, 7 fail)
UPDATE public.scores
SET score = CASE
  WHEN score = -1 THEN 7
  WHEN score >= 0 AND score <= 5 THEN 6 - score
  ELSE score
END
WHERE game_id = '{wordle_id}';
"""

    if args.output:
        args.output.write_text(sql, encoding="utf-8")
        print(f"Wrote SQL to {args.output}. Run it against your DB to update existing Wordle scores.", file=__import__("sys").stderr)
    else:
        print(sql)


if __name__ == "__main__":
    main()
