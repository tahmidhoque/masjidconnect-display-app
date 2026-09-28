#!/usr/bin/env python3
"""Clean common AI slop patterns from text files."""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path

# (pattern, replacement, aggressive_only)
REPLACEMENTS: list[tuple[re.Pattern[str], str, bool]] = [
    # High-risk — delete or minimal replace
    (re.compile(r"\bIn today'?s fast[- ]paced world,?\s*", re.I), "", False),
    (re.compile(r"\bIt'?s important to note that\s*", re.I), "", False),
    (re.compile(r"\bIt'?s worth mentioning that\s*", re.I), "", False),
    (re.compile(r"\bNeedless to say,?\s*", re.I), "", False),
    (re.compile(r"\bIt'?s crucial to understand that\s*", re.I), "", False),
    (re.compile(r"\bLet'?s delve into\s*", re.I), "", False),
    (re.compile(r"\bdelve into\b", re.I), "examine", False),
    (re.compile(r"\bnavigate the complexities of\b", re.I), "handle", False),
    (re.compile(r"\bnavigate the complexity of\b", re.I), "handle", False),
    (re.compile(r"\bIn the ever-evolving landscape of\s*", re.I), "In ", False),
    (re.compile(r"\bembark on a journey to\b", re.I), "to", True),
    # Wordy
    (re.compile(r"\bin order to\b", re.I), "to", False),
    (re.compile(r"\bdue to the fact that\b", re.I), "because", False),
    (re.compile(r"\bhas the ability to\b", re.I), "can", False),
    (re.compile(r"\bat this point in time\b", re.I), "now", False),
    (re.compile(r"\bin the event that\b", re.I), "if", False),
    (re.compile(r"\bfor the purpose of\b", re.I), "to", False),
    (re.compile(r"\bwith regard to\b", re.I), "about", False),
    (re.compile(r"\ba large number of\b", re.I), "many", False),
    (re.compile(r"\bthe vast majority of\b", re.I), "most", False),
    # Buzzwords
    (re.compile(r"\bleverage\b", re.I), "use", False),
    (re.compile(r"\butilise\b", re.I), "use", False),
    (re.compile(r"\butilize\b", re.I), "use", False),
    (re.compile(r"\bsynergistic\b", re.I), "cooperative", False),
    (re.compile(r"\bparadigm shift\b", re.I), "major change", False),
    (re.compile(r"\bholistic\b", re.I), "complete", True),
    (re.compile(r"\bseamlessly\b", re.I), "smoothly", True),
    (re.compile(r"\bseamless\b", re.I), "smooth", True),
    (re.compile(r"\bcutting-edge\b", re.I), "modern", True),
    (re.compile(r"\bgame-changer\b", re.I), "significant change", True),
    (re.compile(r"\bempower(s|ing|ed|ment)?\b", re.I), r"enable\1", True),
    (re.compile(r"\bunlock(s|ing|ed)?\b", re.I), r"open\1", True),
    (re.compile(r"\belevate(s|d|ing)?\b", re.I), r"improve\1", True),
    (re.compile(r"\bfoster(s|ing|ed)?\b", re.I), r"encourage\1", True),
    (re.compile(r"\bmultifaceted\b", re.I), "complex", True),
    (re.compile(r"\bpivotal\b", re.I), "key", True),
    # Meta-commentary (aggressive)
    (
        re.compile(
            r"\bThis (article|document|section|post) (will|shall) (explore|discuss|cover)[^.]*\.\s*",
            re.I,
        ),
        "",
        True,
    ),
    # Hedging / intensifiers (aggressive)
    (re.compile(r"\b(very|really|extremely|incredibly|absolutely)\s+", re.I), "", True),
    (re.compile(r"\bImportantly,\s*", re.I), "", True),
    # Structural
    (re.compile(r"^Moreover,\s*", re.M | re.I), "", True),
    (re.compile(r"^Furthermore,\s*", re.M | re.I), "", True),
    (re.compile(r"^Additionally,\s*", re.M | re.I), "", True),
]

# Collapse multiple spaces left after deletions
MULTI_SPACE = re.compile(r"  +")
MULTI_NEWLINE = re.compile(r"\n{3,}")


def clean_text(text: str, aggressive: bool = False) -> str:
    result = text
    for pattern, replacement, aggressive_only in REPLACEMENTS:
        if aggressive_only and not aggressive:
            continue
        result = pattern.sub(replacement, result)

    result = MULTI_SPACE.sub(" ", result)
    result = MULTI_NEWLINE.sub("\n\n", result)
    # Fix space before punctuation from deletions
    result = re.sub(r" +([.,;:!?])", r"\1", result)
    return result.strip() + ("\n" if text.endswith("\n") else "")


def show_diff(original: str, cleaned: str) -> None:
    orig_lines = original.splitlines()
    clean_lines = cleaned.splitlines()
    max_lines = max(len(orig_lines), len(clean_lines))
    changes = 0

    for i in range(max_lines):
        o = orig_lines[i] if i < len(orig_lines) else ""
        c = clean_lines[i] if i < len(clean_lines) else ""
        if o != c:
            changes += 1
            print(f"--- L{i + 1}")
            if o:
                print(f"- {o}")
            if c:
                print(f"+ {c}")

    if changes == 0:
        print("No changes would be made.")
    else:
        print(f"\n{changes} line(s) would change.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Clean AI slop patterns from text files")
    parser.add_argument("file", type=Path, help="Text file to clean")
    parser.add_argument("--save", action="store_true", help="Write changes to file (creates .backup)")
    parser.add_argument("--output", "-o", type=Path, help="Write to different output file")
    parser.add_argument(
        "--aggressive",
        action="store_true",
        help="Apply aggressive replacements (may slightly change meaning)",
    )
    args = parser.parse_args()

    if not args.file.is_file():
        print(f"Error: file not found: {args.file}", file=sys.stderr)
        return 1

    original = args.file.read_text(encoding="utf-8")
    cleaned = clean_text(original, aggressive=args.aggressive)

    if original == cleaned:
        print("No slop patterns found to clean.")
        return 0

    if args.save or args.output:
        out_path = args.output or args.file
        if args.save and not args.output:
            backup = args.file.with_suffix(args.file.suffix + ".backup")
            shutil.copy2(args.file, backup)
            print(f"Backup created: {backup}")
        out_path.write_text(cleaned, encoding="utf-8")
        print(f"Cleaned file written to: {out_path}")
        if args.aggressive:
            print("Warning: aggressive mode — review changes for meaning drift.")
    else:
        print("Preview mode (use --save to apply):\n")
        show_diff(original, cleaned)

    return 0


if __name__ == "__main__":
    sys.exit(main())
