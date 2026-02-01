#!/usr/bin/env python3
"""
Generate SQL to fix existing Connections scores in the database.

Spreadsheet: 5=0 mistakes, 4=1, 3=2, 2=3, 1=4, 0=fail. DB stores mistakes (0–4), fail=4.
This script outputs an UPDATE that converts existing rows accordingly.

Usage:
  python3 update_connections_scores.py --ids ids.json [-o update_connections.sql]
"""

import argparse
import json
from pathlib import Path


def main():
    ap = argparse.ArgumentParser(description="Generate SQL to convert Connections scores from (5-mistakes) to mistakes")
    ap.add_argument("--ids", type=Path, required=True, help="JSON file with game_ids (must have 'connections' key)")
    ap.add_argument("-o", "--output", type=Path, help="Write SQL to file (default: stdout)")
    args = ap.parse_args()

    if not args.ids.exists():
        raise SystemExit(f"Ids file not found: {args.ids}")

    with open(args.ids, encoding="utf-8") as f:
        ids = json.load(f)
    game_ids = ids.get("game_ids") or {}
    connections_id = game_ids.get("connections")
    if not connections_id or connections_id.startswith("YOUR_") or "REPLACE" in connections_id:
        raise SystemExit("ids file must contain a real game_ids.connections UUID (not a placeholder)")

    sql = f"""-- Convert Connections: spreadsheet 5=0 mistakes, 4=1, 3=2, 2=3, 1=4, 0=fail → DB stores mistakes (0-4), fail=4
UPDATE public.scores
SET score = CASE
  WHEN score = 0 THEN 4
  WHEN score >= 1 AND score <= 5 THEN 5 - score
  ELSE score
END
WHERE game_id = '{connections_id}';
"""

    if args.output:
        args.output.write_text(sql, encoding="utf-8")
        print(f"Wrote SQL to {args.output}. Run it against your DB to update existing Connections scores.", file=__import__("sys").stderr)
    else:
        print(sql)


if __name__ == "__main__":
    main()
