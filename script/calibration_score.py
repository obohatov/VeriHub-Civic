#!/usr/bin/env python3
"""
Calibration scorer for the VeriHub judge.

Reads a human-labeled CSV (produced by the export step, then filled in by hand)
and reports how often the human agreed with the judge's flags — i.e. the judge's
PRECISION — overall and broken down by finding type (incorrect / ungrounded / drift).

Expected CSV columns (header row required):
    finding_id, type, factKey, topic, expected_value, answer_snippet,
    human_verdict, notes

The only column you fill in is `human_verdict`, using exactly one of:
    agree      -> the judge was right; this is a real problem
    disagree   -> the judge was wrong; the answer is actually fine
    unsure     -> can't tell / needs source lookup (excluded from precision)

Usage:
    python3 calibration_score.py labeled_findings.csv
"""

import csv
import sys
from collections import defaultdict

VALID = {"agree", "disagree", "unsure"}


def main(path: str) -> None:
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            v = (r.get("human_verdict") or "").strip().lower()
            if v == "":
                continue  # not labeled yet — skip silently
            if v not in VALID:
                print(f"  ! row {r.get('finding_id','?')[:8]}: bad verdict '{v}' (skipped)")
                continue
            r["human_verdict"] = v
            rows.append(r)

    if not rows:
        print("No labeled rows found. Fill in the human_verdict column and re-run.")
        return

    # Tally overall and per-type
    overall = defaultdict(int)
    by_type = defaultdict(lambda: defaultdict(int))
    disagreements = []

    for r in rows:
        v = r["human_verdict"]
        t = (r.get("type") or "unknown").strip()
        overall[v] += 1
        by_type[t][v] += 1
        if v == "disagree":
            disagreements.append(r)

    def precision(counts: dict) -> str:
        decided = counts["agree"] + counts["disagree"]
        if decided == 0:
            return "n/a (no decided labels)"
        p = counts["agree"] / decided
        return f"{p:5.1%}  ({counts['agree']}/{decided} confirmed, {counts.get('unsure',0)} unsure)"

    print("=" * 60)
    print("JUDGE CALIBRATION — precision on flagged findings")
    print("=" * 60)
    print(f"Labeled findings: {len(rows)}")
    print()
    print(f"OVERALL precision: {precision(overall)}")
    print()
    print("By finding type:")
    for t in sorted(by_type):
        print(f"  {t:12s} {precision(by_type[t])}")
    print()

    if disagreements:
        print("-" * 60)
        print(f"DISAGREEMENTS ({len(disagreements)}) — judge flagged, human says answer is fine:")
        print("-" * 60)
        for r in disagreements:
            fid = (r.get("finding_id") or "?")[:8]
            note = (r.get("notes") or "").strip()
            print(f"  [{fid}] {r.get('type','?')}/{r.get('factKey','?')}"
                  + (f" — {note}" if note else ""))
    print()
    print("Note: this measures PRECISION (of the judge's flags), not recall.")
    print("Catching false negatives (answers judged CORRECT but actually wrong)")
    print("needs sampling unflagged answers — a separate step (verdict persistence).")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 calibration_score.py labeled_findings.csv")
        sys.exit(1)
    main(sys.argv[1])
