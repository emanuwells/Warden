#!/usr/bin/env bash
# Valida frescura dos snapshots Warden e estado do serviço collector.
# Uso: WARDEN_RUNTIME_ROOT=/path/to/Warden bash scripts/validate-pipeline.sh
set -euo pipefail

ROOT="${WARDEN_RUNTIME_ROOT:-${WARDEN_ROOT:-}}"
if [[ -z "$ROOT" ]]; then
  if [[ -f "$(dirname "${BASH_SOURCE[0]}")/export_payload.py" ]]; then
    ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  else
    echo "ERROR: defina WARDEN_RUNTIME_ROOT ou WARDEN_ROOT" >&2
    exit 1
  fi
fi

cd "$ROOT"

# Limites alinhados com docs/Warden_Pipeline.md (Fase 2)
FAST_MAX_AGE="${WARDEN_VALIDATE_FAST_MAX_AGE:-}"
HEAVY_MAX_AGE="${WARDEN_VALIDATE_HEAVY_MAX_AGE:-360}"
FULL_MAX_AGE="${WARDEN_VALIDATE_FULL_MAX_AGE:-960}"

if [[ -z "$FAST_MAX_AGE" && -f ".env" ]]; then
  collect_interval="$(grep -E '^COLLECT_INTERVAL=' .env 2>/dev/null | cut -d= -f2 | tr -d ' \r' || true)"
  if [[ -n "${collect_interval:-}" && "$collect_interval" =~ ^[0-9]+$ ]]; then
    FAST_MAX_AGE=$((collect_interval + 10))
  fi
fi
FAST_MAX_AGE="${FAST_MAX_AGE:-30}"

FAST_REL="${EXPORT_FAST_PATH:-runtime/export/warden_fast_snapshot.json}"
HEAVY_REL="${EXPORT_HEAVY_PATH:-runtime/export/warden_heavy_snapshot.json}"
FULL_REL="${EXPORT_PATH:-runtime/export/warden_payload.json}"

fail=0

file_mtime() {
  local path="$1"
  if stat -c %Y "$path" &>/dev/null; then
    stat -c %Y "$path"
  else
    stat -f %m "$path"
  fi
}

check_file_age() {
  local file="$1" max_sec="$2" label="$3"
  if [[ ! -f "$file" ]]; then
    echo "FAIL: ${label} em falta: ${file}"
    fail=1
    return
  fi
  local now mtime age
  now="$(date +%s)"
  mtime="$(file_mtime "$file")"
  age=$((now - mtime))
  if [[ "$age" -gt "$max_sec" ]]; then
    echo "FAIL: ${label} obsoleto (${age}s > ${max_sec}s): ${file}"
    fail=1
  else
    echo "OK: ${label} idade=${age}s (limite ${max_sec}s)"
  fi
}

echo "== Warden pipeline validation =="
echo "ROOT=${ROOT}"
echo ""

check_file_age "$FAST_REL" "$FAST_MAX_AGE" "fast snapshot"
check_file_age "$HEAVY_REL" "$HEAVY_MAX_AGE" "heavy snapshot"
check_file_age "$FULL_REL" "$FULL_MAX_AGE" "full snapshot"

if command -v systemctl &>/dev/null; then
  if systemctl is-active --quiet warden 2>/dev/null; then
    echo "OK: serviço warden active"
  else
    echo "WARN: serviço warden não está active"
    fail=1
  fi
fi

if [[ -f ".env" ]]; then
  collect_interval="$(grep -E '^COLLECT_INTERVAL=' .env 2>/dev/null | cut -d= -f2 | tr -d ' \r' || true)"
  if [[ -n "${collect_interval:-}" ]]; then
    echo "INFO: COLLECT_INTERVAL=${collect_interval}s"
  fi
fi

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo "RESULT: PASS"
  exit 0
fi

echo "RESULT: FAIL"
exit 1
