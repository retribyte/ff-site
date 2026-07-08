import argparse
import glob
import os
import re
import sys


block_header_pattern = re.compile(r"\*\*(.*?)\*\* _\((.*?)\)")


def parse_blocks(filename):
    blocks = []
    current_block = []

    with open(filename, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if block_header_pattern.match(line):
                if current_block:
                    blocks.append(current_block)
                    current_block = []
                current_block.append(line)
            else:
                if not line:
                    continue
                current_block.append(line)

    if current_block:
        blocks.append(current_block)

    return blocks


def natural_sort_key(s):
    return [
        int(text) if text.isdigit() else text.lower() for text in re.split(r"(\d+)", s)
    ]


def get_block_username(block):
    match = block_header_pattern.match(block[0])
    return match.group(1) if match else None


def split_file(md_file, output_root, dry_run_limit=None, skip_users=None):
    base = os.path.splitext(os.path.basename(md_file))[0]
    out_dir = os.path.join(output_root, base)

    blocks = parse_blocks(md_file)
    if skip_users:
        skip_lower = {u.lower() for u in skip_users}
        blocks = [b for b in blocks if (get_block_username(b) or "").lower() not in skip_lower]
    if dry_run_limit is not None:
        blocks = blocks[:dry_run_limit]

    print(f"{md_file} → {out_dir}/ ({len(blocks)} blocks)")

    if dry_run_limit is not None:
        for i, block in enumerate(blocks, start=1):
            print(f"  [{i:03d}] {block[0][:80]}")
        return

    os.makedirs(out_dir, exist_ok=True)

    for i, block in enumerate(blocks, start=1):
        out_path = os.path.join(out_dir, f"{i:03d}.md")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write("\n".join(block) + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="Split markdown chat archives into per-message-block files."
    )
    parser.add_argument(
        "inputs",
        nargs="+",
        help="Season name (e.g. ff2) or one or more .md file paths.",
    )
    parser.add_argument(
        "--output",
        default="./split",
        help="Root output directory (default: ./split).",
    )
    parser.add_argument(
        "--skip-user",
        action="append",
        dest="skip_users",
        metavar="USERNAME",
        help="Skip blocks from this username (case-insensitive). Repeatable.",
    )
    parser.add_argument(
        "--dry-run",
        type=int,
        nargs="?",
        const=5,
        metavar="N",
        help="Print the first N blocks per file without writing (default N=5).",
    )
    args = parser.parse_args()

    md_files = []
    for inp in args.inputs:
        if inp.endswith(".md") or os.sep in inp:
            md_files.append(inp)
        else:
            found = sorted(glob.glob(f"./md/{inp}/*.md"), key=natural_sort_key)
            if not found:
                print(f"No markdown files found in ./md/{inp}/", file=sys.stderr)
                sys.exit(1)
            md_files.extend(found)

    for md_file in md_files:
        if not os.path.exists(md_file):
            print(f"File not found: {md_file}", file=sys.stderr)
            continue
        parts = md_file.replace("\\", "/").split("/")
        output_root = os.path.join(args.output, parts[-2]) if len(parts) >= 2 else args.output
        split_file(md_file, output_root, dry_run_limit=args.dry_run, skip_users=args.skip_users)


if __name__ == "__main__":
    main()
