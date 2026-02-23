#!/usr/bin/env python3
"""
Warden — Janitor CLI
Manual cleanup of old metrics data.

Usage:
    python scripts/janitor.py
    python scripts/janitor.py --days 15
"""

import argparse
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.settings import settings
from src.janitor import cleanup

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)-7s]  %(message)s",
)


def main():
    parser = argparse.ArgumentParser(description="Warden janitor — data retention cleanup")
    parser.add_argument("--days", type=int, default=None, help="Override retention days")
    args = parser.parse_args()

    if args.days is not None:
        settings.retention_days = args.days

    deleted = cleanup()
    print(f"Done. Deleted {deleted} rows older than {settings.retention_days} days.")


if __name__ == "__main__":
    main()
