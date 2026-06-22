#!/usr/bin/env python3
"""
Warden Clean CLI.
Manual retention cleanup of old operational data.

Usage:
    python scripts/warden_clean.py
    python scripts/warden_clean.py --days 15
    python scripts/warden_clean.py --optimize
    python scripts/warden_clean.py --purge-binlogs-days 2
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
    parser.add_argument(
        "--optimize",
        action="store_true",
        help="Optimize configured Warden tables when free space exceeds the configured threshold.",
    )
    parser.add_argument(
        "--purge-binlogs-days",
        type=int,
        default=None,
        help="Purge binary logs older than N days for this run. Disabled by default.",
    )
    args = parser.parse_args()

    if args.days is not None:
        settings.retention_days = args.days
    if args.optimize:
        settings.warden_clean_optimize_enabled = True
    if args.purge_binlogs_days is not None:
        settings.warden_clean_binlog_retention_days = args.purge_binlogs_days

    deleted = cleanup()
    print(f"Done. Deleted {deleted} rows older than {settings.retention_days} days.")


if __name__ == "__main__":
    main()
