#!/usr/bin/env bash
set -euo pipefail

WARDEN_ROOT="${WARDEN_ROOT:-/home/eferreira/MAIATRON/Warden}"
PYTHON_BIN="${WARDEN_PYTHON_BIN:-$WARDEN_ROOT/.venv/bin/python}"
CRONTAB_LOG_DIR="${WARDEN_CRONTAB_LOG_DIR:-/home/eferreira/D4MAIA/_crontab_logs}"
DOCKER_BUILD_CACHE_UNTIL="${WARDEN_DOCKER_BUILD_CACHE_UNTIL:-168h}"
TEMP_FILE_MTIME_DAYS="${WARDEN_TEMP_FILE_MTIME_DAYS:-1}"
CACHE_MTIME_DAYS="${WARDEN_CACHE_MTIME_DAYS:-1}"
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: warden_clean.sh [--dry-run]

Runs conservative Warden housekeeping for the Overseer-managed warden_clean job.
It does not remove backups, dumps, application directories, Docker volumes,
MySQL data, MySQL binlogs, secrets, virtualenvs, or active export snapshots.
EOF
}

log() {
  printf '[%s] %s\n' "$1" "$2"
}

run() {
  local description="$1"
  shift
  log INFO "$description"
  printf '       '
  printf '%q ' "$@"
  printf '\n'
  if (( DRY_RUN )); then
    return 0
  fi
  "$@" || log WARN "Falhou: $description"
}

while (( $# > 0 )); do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      log ERROR "Argumento desconhecido: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

if [[ ! -d "$WARDEN_ROOT" ]]; then
  log ERROR "WARDEN_ROOT nao existe: $WARDEN_ROOT"
  exit 1
fi

cd "$WARDEN_ROOT"

if [[ -x "$PYTHON_BIN" ]]; then
  run "Executar janitor Warden" "$PYTHON_BIN" scripts/janitor.py
else
  log WARN "Python Warden nao encontrado ou sem execucao: $PYTHON_BIN"
fi

if [[ -d "$WARDEN_ROOT/runtime/logs" ]]; then
  run "Truncar logs Warden maiores que 20M" \
    find "$WARDEN_ROOT/runtime/logs" -maxdepth 1 -type f \
      \( -name '*.log' -o -name '*.err.log' \) -size +20M -exec truncate -s 0 {} +
fi

run "Truncar historico db_monitor se exceder 20M" \
  find "$WARDEN_ROOT/runtime" -maxdepth 1 -type f -name 'db_monitor_history.jsonl' -size +20M -exec truncate -s 0 {} +

if [[ -d "$WARDEN_ROOT/runtime/export" ]]; then
  run "Remover temporarios antigos de export Warden" \
    find "$WARDEN_ROOT/runtime/export" -maxdepth 1 -type f -name '*.tmp-*' -mtime +"$TEMP_FILE_MTIME_DAYS" -delete
fi

if [[ -d "$WARDEN_ROOT/runtime/archive/weekly" ]]; then
  run "Remover temporarios antigos de arquivo semanal Warden" \
    find "$WARDEN_ROOT/runtime/archive/weekly" -maxdepth 1 -type f -name '*.tmp-*' -mtime +"$TEMP_FILE_MTIME_DAYS" -delete
fi

if [[ -d "$WARDEN_ROOT/runtime/cache" ]]; then
  run "Remover cache runtime antiga Warden" \
    find "$WARDEN_ROOT/runtime/cache" -mindepth 1 -mtime +"$CACHE_MTIME_DAYS" -delete
fi

run "Remover caches Python antigos dentro do Warden" \
  find "$WARDEN_ROOT" \
    \( -path "$WARDEN_ROOT/.git" -o -path "$WARDEN_ROOT/.venv" -o -path "$WARDEN_ROOT/secrets" \) -prune -o \
    \( -type d \( -name '__pycache__' -o -name '.pytest_cache' \) -mtime +"$CACHE_MTIME_DAYS" -exec rm -rf {} + \)

run "Remover bytecode Python antigo dentro do Warden" \
  find "$WARDEN_ROOT" \
    \( -path "$WARDEN_ROOT/.git" -o -path "$WARDEN_ROOT/.venv" -o -path "$WARDEN_ROOT/secrets" \) -prune -o \
    \( -type f \( -name '*.pyc' -o -name '*.pyo' \) -mtime +"$CACHE_MTIME_DAYS" -delete \)

run "Remover ficheiros temporarios de editor e sistema dentro do Warden" \
  find "$WARDEN_ROOT" \
    \( -path "$WARDEN_ROOT/.git" -o -path "$WARDEN_ROOT/.venv" -o -path "$WARDEN_ROOT/secrets" \) -prune -o \
    \( -type f \( -name '*~' -o -name '.DS_Store' -o -name 'Thumbs.db' -o -name '*.swp' -o -name '*.swo' \) -mtime +"$TEMP_FILE_MTIME_DAYS" -delete \)

if [[ -d "$CRONTAB_LOG_DIR" ]]; then
  run "Truncar logs grandes de crontab MAIATRON" \
    find "$CRONTAB_LOG_DIR" -maxdepth 1 -type f -name '*.txt' -size +5M -mtime +1 -exec truncate -s 0 {} +
fi

if command -v docker >/dev/null 2>&1; then
  run "Limpar cache Docker build antiga" docker builder prune -af --filter "until=$DOCKER_BUILD_CACHE_UNTIL"
  run "Limpar imagens Docker dangling antigas" docker image prune -f --filter "until=$DOCKER_BUILD_CACHE_UNTIL"
else
  log SKIP "Docker nao disponivel."
fi

log INFO "warden_clean concluido."
