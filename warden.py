#!/usr/bin/env python3
"""
Legacy systemd entrypoint.

Some hosts still use:
  python /path/to/Warden/warden.py

Canonical CLI:
  python -m src.warden
"""

from src.warden import main

if __name__ == "__main__":
    main()
