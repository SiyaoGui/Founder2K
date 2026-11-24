"""Restore and verify one encrypted handoff category in an empty directory."""
import argparse
import csv
import hashlib
import shutil
import subprocess
from pathlib import Path


def sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main():
    root = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("category", choices=sorted(p.name for p in (root / "archives").iterdir() if p.is_dir()))
    parser.add_argument("destination", type=Path)
    parser.add_argument("--seven-zip", default=shutil.which("7z") or shutil.which("7zz") or "7z")
    args = parser.parse_args()
    out = args.destination.resolve()
    if out.exists() and (not out.is_dir() or any(out.iterdir())):
        parser.error("Choose a new or empty destination directory.")
    prefix = f"archives/{args.category}/"
    sums = (root / "SHA256SUMS.txt").read_text(encoding="utf-8").splitlines()
    volumes = []
    for line in sums:
        expected, name = line.split("  ", 1)
        if name.startswith(prefix):
            part = root / name
            if sha256(part) != expected:
                raise ValueError(f"Volume checksum mismatch: {part.name}")
            volumes.append(part)
    if not volumes:
        raise ValueError("Missing volume list.")
    out.mkdir(parents=True, exist_ok=True)
    # Let 7-Zip prompt on the terminal so the password stays out of command history.
    subprocess.run([args.seven_zip, "x", str(min(volumes)), f"-o{out}"], check=True)
    restored = 0
    with (out / "MANIFEST.csv").open(encoding="utf-8-sig", newline="") as manifest:
        for row in csv.DictReader(manifest):
            file = out / "files" / row["path"]
            if file.stat().st_size != int(row["bytes"]) or sha256(file) != row["sha256"]:
                raise ValueError(f"Restored file checksum mismatch: {row['path']}")
            restored += 1
    print(f"Verified {restored} restored files in {out}")


if __name__ == "__main__":
    main()
