#!/usr/bin/env bash
# Fallback cron lane for fast snapshot (Pipeline Phase 2).
# Exports only when the fast snapshot is older than EXPORT_FAST_FALLBACK_MAX_AGE seconds.
# Primary path: collector hook (EXPORT_FAST_ON_COLLECT=1 in .env).
set -euo pipefail

ROOT="${WARDEN_RUNTIME_ROOT:-${WARDEN_ROOT:-}}"
if [[ -z "$ROOT" ]]; then
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi
cd "$ROOT"

MAX_AGE="${EXPORT_FAST_FALLBACK_MAX_AGE:-30}"
FAST_REL="${EXPORT_FAST_PATH:-runtime/export/warden_fast_snapshot.json}"

if [[ -f "$FAST_REL" ]]; then
  if stat -c %Y "$FAST_REL" &>/dev/null; then
    mtime="$(stat -c %Y "$FAST_REL")"
  else
    mtime="$(stat -f %m "$FAST_REL")"
  fi
  now="$(date +%s)"
  age=$((now - mtime))
  if [[ "$age" -lt "$MAX_AGE" ]]; then
    exit 0
  fi
fi

PYTHON="${WARDEN_PYTHON:-}"
if [[ -z "$PYTHON" && -x "${ROOT}/.venv/bin/python" ]]; then
  PYTHON="${ROOT}/.venv/bin/python"
fi
if [[ -z "$PYTHON" ]]; then
  PYTHON="python3"
fi

exec "$PYTHON" scripts/export_payload.py --mode fast
