#!/usr/bin/env python3
"""
Warden Clean CLI.
Manual retention cleanup of old operational data.

Usage:
    python scripts/warden_clean.py
    python scripts/warden_clean.py --days 15
"""

import argparse
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.settings import settings
from src.warden_clean import cleanup

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)-7s]  %(message)s",
)


def main():
    parser = argparse.ArgumentParser(description="Warden Clean data retention")
    parser.add_argument("--days", type=int, default=None, help="Override retention days")
    args = parser.parse_args()

    if args.days is not None:
        settings.retention_days = args.days

    deleted = cleanup()
    print(f"Done. Deleted {deleted} rows older than {settings.retention_days} days.")


if __name__ == "__main__":
    main()
