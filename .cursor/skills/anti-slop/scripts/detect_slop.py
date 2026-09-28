#!/usr/bin/env python3
"""Detect AI slop patterns in text files."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

# Pattern categories: (regex, weight, category, suggestion)
HIGH_RISK_PATTERNS: list[tuple[re.Pattern[str], int, str, str]] = [
    (re.compile(r"\bdelve\s+into\b", re.I), 8, "high-risk", 'Replace with "examine" or delete'),
    (re.compile(r"\bnavigate\s+the\s+complexit", re.I), 8, "high-risk", 'Use "handle" or delete'),
    (re.compile(r"\bin today'?s fast[- ]paced world\b", re.I), 8, "high-risk", "Delete"),
    (re.compile(r"\bit'?s important to note that\b", re.I), 8, "high-risk", "Delete"),
    (re.compile(r"\bit'?s worth mentioning that\b", re.I), 8, "high-risk", "Delete"),
    (re.compile(r"\bneedless to say\b", re.I), 8, "high-risk", "Delete"),
    (re.compile(r"\bever[- ]evolving landscape\b", re.I), 8, "high-risk", "Delete or be specific"),
    (re.compile(r"\bembark on a journey\b", re.I), 8, "high-risk", "State the goal directly"),
    (re.compile(r"\bthis (article|document|section|post) (will|shall) (explore|discuss|cover)\b", re.I), 8, "meta", "Delete meta-commentary"),
    (re.compile(r"\blet'?s (explore|dive into|delve)\b", re.I), 8, "meta", "Start with the point"),
]

BUZZWORD_PATTERNS: list[tuple[re.Pattern[str], int, str, str]] = [
    (re.compile(r"\bleverage\b", re.I), 4, "buzzword", 'Use "use"'),
    (re.compile(r"\butili[sz]e\b", re.I), 4, "buzzword", 'Use "use"'),
    (re.compile(r"\bsynergistic\b", re.I), 4, "buzzword", 'Use "cooperative"'),
    (re.compile(r"\bparadigm shift\b", re.I), 4, "buzzword", 'Use "major change"'),
    (re.compile(r"\bholistic\b", re.I), 4, "buzzword", 'Use "complete" or be specific'),
    (re.compile(r"\bseamless(ly)?\b", re.I), 4, "buzzword", "Describe how"),
    (re.compile(r"\bcutting[- ]edge\b", re.I), 4, "buzzword", "Name the technology"),
    (re.compile(r"\bgame[- ]changer\b", re.I), 4, "buzzword", "Explain the impact"),
    (re.compile(r"\bempower(s|ing|ed|ment)?\b", re.I), 4, "buzzword", 'Use "enable" or "help"'),
    (re.compile(r"\bunlock(s|ing|ed)?\b", re.I), 4, "buzzword", 'Use "enable"'),
    (re.compile(r"\belevate(s|d|ing)?\b", re.I), 4, "buzzword", 'Use "improve"'),
    (re.compile(r"\bfoster(s|ing|ed)?\b", re.I), 4, "buzzword", 'Use "encourage" or "build"'),
    (re.compile(r"\brobust\b", re.I), 4, "buzzword", "Be specific about reliability"),
    (re.compile(r"\btapestry of\b", re.I), 4, "buzzword", "Delete or use mix/range"),
    (re.compile(r"\bmultifaceted\b", re.I), 4, "buzzword", 'Use "complex" or "varied"'),
    (re.compile(r"\bpivotal\b", re.I), 4, "buzzword", 'Use "key" or "central"'),
    (re.compile(r"\brealm of\b", re.I), 4, "buzzword", 'Use "area of"'),
]

WORDY_PATTERNS: list[tuple[re.Pattern[str], int, str, str]] = [
    (re.compile(r"\bin order to\b", re.I), 3, "wordy", 'Use "to"'),
    (re.compile(r"\bdue to the fact that\b", re.I), 3, "wordy", 'Use "because"'),
    (re.compile(r"\bhas the ability to\b", re.I), 3, "wordy", 'Use "can"'),
    (re.compile(r"\bat this point in time\b", re.I), 3, "wordy", 'Use "now"'),
    (re.compile(r"\bin the event that\b", re.I), 3, "wordy", 'Use "if"'),
    (re.compile(r"\bfor the purpose of\b", re.I), 3, "wordy", 'Use "to" or "for"'),
    (re.compile(r"\bwith regard to\b", re.I), 3, "wordy", 'Use "about"'),
    (re.compile(r"\ba large number of\b", re.I), 3, "wordy", 'Use "many"'),
    (re.compile(r"\bthe vast majority of\b", re.I), 3, "wordy", 'Use "most"'),
]

HEDGE_PATTERNS: list[tuple[re.Pattern[str], int, str, str]] = [
    (re.compile(r"\bit'?s crucial to understand\b", re.I), 5, "hedge", "Delete or state directly"),
    (re.compile(r"\bcrucial to note\b", re.I), 5, "hedge", "Delete"),
    (re.compile(r"\bimportantly,\b", re.I), 5, "hedge", "Often deletable"),
]

INTENSIFIER_PATTERNS: list[tuple[re.Pattern[str], int, str, str]] = [
    (re.compile(r"\b(very|really|extremely|incredibly|absolutely)\s+\w+", re.I), 2, "intensifier", "Cut or be specific"),
    (re.compile(r"\b(truly|deeply|profoundly)\s+\w+", re.I), 2, "intensifier", "Cut unless meaningful"),
]

STRUCTURAL_PATTERNS: list[tuple[re.Pattern[str], int, str, str]] = [
    (re.compile(r"^(Moreover|Furthermore|Additionally),", re.M | re.I), 6, "structural", "Vary transitions"),
]

ALL_PATTERNS = (
    HIGH_RISK_PATTERNS
    + BUZZWORD_PATTERNS
    + WORDY_PATTERNS
    + HEDGE_PATTERNS
    + INTENSIFIER_PATTERNS
    + STRUCTURAL_PATTERNS
)


@dataclass
class Finding:
    line: int
    category: str
    match: str
    suggestion: str
    weight: int


@dataclass
class AnalysisResult:
    score: float
    findings: list[Finding] = field(default_factory=list)
    by_category: dict[str, int] = field(default_factory=dict)


def analyse_text(text: str) -> AnalysisResult:
    lines = text.splitlines()
    findings: list[Finding] = []
    raw_score = 0
    by_category: dict[str, int] = {}

    for pattern, weight, category, suggestion in ALL_PATTERNS:
        for match in pattern.finditer(text):
            line_num = text[: match.start()].count("\n") + 1
            findings.append(
                Finding(
                    line=line_num,
                    category=category,
                    match=match.group(0),
                    suggestion=suggestion,
                    weight=weight,
                )
            )
            raw_score += weight
            by_category[category] = by_category.get(category, 0) + 1

    word_count = max(len(text.split()), 1)
    # Normalise: ~500 words with moderate slop ≈ 40 score
    normalised = min(100.0, (raw_score / word_count) * 250)

    return AnalysisResult(score=round(normalised, 1), findings=findings, by_category=by_category)


def score_label(score: float) -> str:
    if score < 20:
        return "Low slop (authentic writing)"
    if score < 40:
        return "Moderate slop (some patterns)"
    if score < 60:
        return "High slop (many patterns)"
    return "Severe slop (heavily generic)"


def print_report(result: AnalysisResult, verbose: bool) -> None:
    print(f"\nSlop score: {result.score}/100 — {score_label(result.score)}\n")

    if result.by_category:
        print("By category:")
        for cat, count in sorted(result.by_category.items(), key=lambda x: -x[1]):
            print(f"  {cat}: {count}")
        print()

    if not result.findings:
        print("No slop patterns detected.")
        return

    if verbose:
        print("Findings:")
        for f in sorted(result.findings, key=lambda x: (x.line, x.category)):
            print(f"  L{f.line} [{f.category}] \"{f.match}\" → {f.suggestion}")
        print()

    print("Recommendations:")
    seen: set[str] = set()
    for f in result.findings:
        if f.suggestion not in seen:
            print(f"  - {f.suggestion}")
            seen.add(f.suggestion)


def main() -> int:
    parser = argparse.ArgumentParser(description="Detect AI slop patterns in text files")
    parser.add_argument("file", type=Path, help="Text file to analyse")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show line-by-line findings")
    args = parser.parse_args()

    if not args.file.is_file():
        print(f"Error: file not found: {args.file}", file=sys.stderr)
        return 1

    text = args.file.read_text(encoding="utf-8")
    result = analyse_text(text)
    print(f"File: {args.file}")
    print_report(result, args.verbose)
    return 0


if __name__ == "__main__":
    sys.exit(main())
