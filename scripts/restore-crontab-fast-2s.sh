#!/usr/bin/env bash
# Restore the 2s fast export cron lane (Task Manager cadence).
# Usage:
#   WARDEN_RUNTIME_ROOT=/path WARDEN_EXPORT_FAST_LOCK=/tmp/lock bash scripts/restore-crontab-fast-2s.sh --dry-run
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
MARKER_FALLBACK="# warden:export_fast_fallback"
MARKER_2S="# warden:export_fast_2s"

PYTHON="${WARDEN_PYTHON:-}"
if [[ -z "$PYTHON" && -x "${ROOT}/.venv/bin/python" ]]; then
  PYTHON="${ROOT}/.venv/bin/python"
fi
if [[ -z "$PYTHON" ]]; then
  PYTHON="/usr/bin/python3"
fi

CRON_CMD="cd ${ROOT} && ${PYTHON} scripts/export_payload.py --mode fast > /dev/null 2>> runtime/logs/export_fast.err.log"

current="$(crontab -l 2>/dev/null || true)"
if [[ -z "$current" ]]; then
  echo "ERROR: crontab vazio ou inacessível" >&2
  exit 1
fi

if echo "$current" | grep -qF "$MARKER_2S"; then
  echo "OK: lane fast 2s já presente (${MARKER_2S})"
  exit 0
fi

new_crontab="$(echo "$current" | grep -v 'export_payload.py --mode fast' | grep -vF "$MARKER_FALLBACK" | grep -vF "$MARKER_2S")"

block="# FAST snapshot (2s cadence — Task Manager lane) ${MARKER_2S}"
for offset in $(seq 0 2 58); do
  if [[ "$offset" -eq 0 ]]; then
    block+=$'\n'"* * * * * flock -n ${LOCK} -c '${CRON_CMD}' ${MARKER_2S}"
  else
    block+=$'\n'"* * * * * sleep ${offset}; flock -n ${LOCK} -c '${CRON_CMD}' ${MARKER_2S}"
  fi
done

new_crontab="${new_crontab}"$'\n'"${block}"

echo "== Restaurar cron fast 2s =="
echo "$block" | head -3
echo "..."
echo "$block" | tail -1
echo "Total: 30 linhas (sleep 0..58)"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo ""
  echo "DRY-RUN: crontab não alterado"
  exit 0
fi

printf '%s\n' "$new_crontab" | crontab -
echo ""
echo "OK: cron fast 2s restaurado"
