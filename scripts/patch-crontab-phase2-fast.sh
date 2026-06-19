#!/usr/bin/env bash
# Replace the 30×/min fast export cron block with a single smart fallback (Phase 2).
# Usage:
#   WARDEN_RUNTIME_ROOT=/path LOCK=/tmp/warden_export_fast.lock bash scripts/patch-crontab-phase2-fast.sh --dry-run
#   WARDEN_RUNTIME_ROOT=/path LOCK=/tmp/warden_export_fast.lock bash scripts/patch-crontab-phase2-fast.sh
set -euo pipefail

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

ROOT="${WARDEN_RUNTIME_ROOT:-${WARDEN_ROOT:-}}"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: defina WARDEN_RUNTIME_ROOT ou WARDEN_ROOT" >&2
  exit 1
fi

LOCK="${WARDEN_EXPORT_FAST_LOCK:-/tmp/warden_export_fast.lock}"
MARKER="# warden:export_fast_fallback"
FALLBACK_LINE="* * * * * flock -n ${LOCK} -c 'cd ${ROOT} && bash scripts/export_fast_fallback.sh > /dev/null 2>> runtime/logs/export_fast.err.log' ${MARKER}"

current="$(crontab -l 2>/dev/null || true)"
if [[ -z "$current" ]]; then
  echo "ERROR: crontab vazio ou inacessível" >&2
  exit 1
fi

if echo "$current" | grep -qF "$MARKER"; then
  echo "OK: fallback fast já presente (${MARKER})"
  exit 0
fi

new_crontab="$(echo "$current" | grep -v 'export_payload.py --mode fast' | grep -vF "$MARKER")"
new_crontab="${new_crontab}"$'\n'"${FALLBACK_LINE}"

echo "== Crontab diff (fast export) =="
echo "$current" | grep -E 'export_payload.py --mode fast|warden:export_fast_fallback' || echo "(nenhuma linha fast anterior)"
echo "---"
echo "$FALLBACK_LINE"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo ""
  echo "DRY-RUN: crontab não alterado"
  exit 0
fi

printf '%s\n' "$new_crontab" | crontab -
echo ""
echo "OK: crontab actualizado com fallback fast (Phase 2)"
