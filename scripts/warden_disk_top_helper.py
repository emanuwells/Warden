#!/usr/bin/env python3
"""
Root helper for Warden top disk consumers.
Designed to be installed as a root-owned helper outside /home and invoked via sudo.
Outputs a JSON object to stdout.
"""

from __future__ import annotations

import heapq
import json
import os
import sys
import time
from datetime import datetime, timezone

ROOT_PATH = "/"
MAX_ITEMS = 10
TIMEOUT_SECONDS = 10
EXCLUDES = ("/proc", "/sys", "/dev", "/run", "/snap", "/tmp", "/var/tmp")


def _is_excluded(path: str) -> bool:
    norm = os.path.normpath(path)
    if norm == "/":
        return False
    for prefix in EXCLUDES:
        if norm == prefix or norm.startswith(prefix + "/"):
            return True
    return False


def main() -> int:
    started = time.monotonic()
    deadline = started + TIMEOUT_SECONDS
    top_heap: list[tuple[int, str]] = []
    dir_totals: dict[str, int] = {}
    scanned_files = 0
    skipped_errors = 0
    truncated = False

    try:
        for dirpath, dirnames, filenames in os.walk(ROOT_PATH, topdown=True, onerror=lambda _: None, followlinks=False):
            norm_dir = os.path.normpath(dirpath)
            if _is_excluded(norm_dir):
                dirnames[:] = []
                continue

            dirnames[:] = [d for d in dirnames if not _is_excluded(os.path.join(norm_dir, d))]

            if time.monotonic() >= deadline:
                truncated = True
                break

            for name in filenames:
                if time.monotonic() >= deadline:
                    truncated = True
                    break
                path = os.path.join(norm_dir, name)
                try:
                    st = os.stat(path, follow_symlinks=False)
                except (FileNotFoundError, PermissionError, OSError):
                    skipped_errors += 1
                    continue
                if not os.path.isfile(path):
                    continue
                size = int(getattr(st, "st_size", 0) or 0)
                scanned_files += 1
                cur_dir = norm_dir
                while True:
                    dir_totals[cur_dir] = dir_totals.get(cur_dir, 0) + size
                    if cur_dir == "/":
                        break
                    parent = os.path.dirname(cur_dir) or "/"
                    if parent == cur_dir:
                        break
                    cur_dir = parent
                if len(top_heap) < MAX_ITEMS:
                    heapq.heappush(top_heap, (size, path))
                elif size > top_heap[0][0]:
                    heapq.heapreplace(top_heap, (size, path))
            if truncated:
                break

        items = [
            {
                "path": path,
                "dir": os.path.dirname(path) or "/",
                "size_bytes": int(size),
            }
            for size, path in sorted(top_heap, key=lambda x: x[0], reverse=True)
        ]
        folders = [
            {
                "path": folder,
                "dir": os.path.dirname(folder) or "/",
                "size_bytes": int(size),
            }
            for folder, size in heapq.nlargest(MAX_ITEMS, dir_totals.items(), key=lambda kv: kv[1])
        ]
        payload = {
            "root_path": ROOT_PATH,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "duration_ms": int((time.monotonic() - started) * 1000),
            "truncated": truncated,
            "max_items": MAX_ITEMS,
            "source": "sudo_helper",
            "visibility_scope": "system",
            "warning": None,
            "items": items,
            "files": items,
            "folders": folders,
            "scanned_files": scanned_files,
            "skipped_errors": skipped_errors,
        }
        print(json.dumps(payload, ensure_ascii=False))
        return 0
    except Exception as exc:
        payload = {
            "root_path": ROOT_PATH,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "duration_ms": int((time.monotonic() - started) * 1000),
            "truncated": True,
            "max_items": MAX_ITEMS,
            "source": "sudo_helper",
            "visibility_scope": "system",
            "warning": "helper_error",
            "items": [],
            "error": str(exc),
        }
        print(json.dumps(payload, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
