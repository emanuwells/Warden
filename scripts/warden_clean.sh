#!/usr/bin/env bash
set -euo pipefail

# PRESERVE (never deleted by this script):
#   - .git/, .venv/, secrets/, .env
#   - runtime/export/*.json (active snapshots)
#   - runtime/archive/weekly/*.json.gz (weekly archives; retention via weekly_archive.py)
#   - runtime/cache/.gitkeep
#   - MySQL data, binlogs, relay logs, Docker volumes
#   - backups, dumps, application directories outside Warden runtime

WARDEN_ROOT="${WARDEN_ROOT:-${WARDEN_RUNTIME_ROOT:-}}"
PYTHON_BIN="${WARDEN_PYTHON_BIN:-${WARDEN_ROOT:+$WARDEN_ROOT/.venv/bin/python}}"
CRONTAB_LOG_DIR="${WARDEN_CRONTAB_LOG_DIR:-}"
DOCKER_BUILD_CACHE_UNTIL="${WARDEN_DOCKER_BUILD_CACHE_UNTIL:-168h}"
TEMP_FILE_MTIME_DAYS="${WARDEN_TEMP_FILE_MTIME_DAYS:-1}"
CACHE_MTIME_DAYS="${WARDEN_CACHE_MTIME_DAYS:-1}"
SERVER_TEMP_MTIME_DAYS="${WARDEN_SERVER_TEMP_MTIME_DAYS:-2}"
NGINX_TEMP_DIR="${WARDEN_NGINX_TEMP_DIR:-/tmp/nginx_backup_temp}"
NGINX_TEMP_MTIME_DAYS="${WARDEN_NGINX_TEMP_MTIME_DAYS:-1}"
SYSTEM_INFO_TXT_RETENTION_DAYS="${WARDEN_SYSTEM_INFO_TXT_RETENTION_DAYS:-60}"
LOG_ROTATE_RETENTION_DAYS="${WARDEN_LOG_ROTATE_RETENTION_DAYS:-14}"
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: warden_clean.sh [--dry-run]

Runs conservative Warden housekeeping for the Overseer-managed warden_clean job.
Requires WARDEN_ROOT or WARDEN_RUNTIME_ROOT to point at the Warden install directory.

It does not remove backups, dumps, application directories, Docker volumes,
MySQL data, MySQL binlogs, relay logs, secrets, virtualenvs, or active export snapshots.
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

# Roda (gzip) um ficheiro grande em vez de o truncar cegamente, preservando histórico
# recente para debugging. As rotações .gz são podadas depois via LOG_ROTATE_RETENTION_DAYS.
rotate_large_file() {
  local description="$1"
  local file="$2"
  local size_threshold_mb="$3"

  [[ -f "$file" ]] || return 0
  local size_bytes
  size_bytes="$(stat -c '%s' "$file" 2>/dev/null || echo 0)"
  local threshold_bytes=$(( size_threshold_mb * 1024 * 1024 ))
  (( size_bytes > threshold_bytes )) || return 0

  local rotated="${file}.$(date -u +%Y%m%dT%H%M%SZ).gz"
  log INFO "$description"
  printf '       gzip -c %q > %q && truncate -s 0 %q\n' "$file" "$rotated" "$file"
  if (( DRY_RUN )); then
    return 0
  fi
  if gzip -c "$file" > "$rotated"; then
    truncate -s 0 "$file"
  else
    log WARN "Falhou a rodar: $file"
    rm -f "$rotated"
  fi
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

if [[ -z "$WARDEN_ROOT" && -f "$(pwd)/scripts/warden_clean.py" ]]; then
  WARDEN_ROOT="$(pwd)"
fi

if [[ -z "$WARDEN_ROOT" ]]; then
  log ERROR "WARDEN_ROOT ou WARDEN_RUNTIME_ROOT deve estar definido."
  usage
  exit 1
fi

if [[ ! -d "$WARDEN_ROOT" ]]; then
  log ERROR "WARDEN_ROOT nao existe: $WARDEN_ROOT"
  exit 1
fi

if [[ -z "$PYTHON_BIN" ]]; then
  PYTHON_BIN="$WARDEN_ROOT/.venv/bin/python"
fi

cd "$WARDEN_ROOT"

WARDEN_ENV_FILE="${WARDEN_ROOT}/.env"
if [[ -f "$WARDEN_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$WARDEN_ENV_FILE"
  set +a
fi

CLEAN_ARGS=()
if [[ -n "${WARDEN_CLEAN_BINLOG_RETENTION_DAYS:-}" ]] \
  && [[ "${WARDEN_CLEAN_BINLOG_RETENTION_DAYS}" =~ ^[0-9]+$ ]] \
  && (( WARDEN_CLEAN_BINLOG_RETENTION_DAYS > 0 )); then
  CLEAN_ARGS+=(--purge-binlogs-days "${WARDEN_CLEAN_BINLOG_RETENTION_DAYS}")
fi
if [[ "${WARDEN_CLEAN_OPTIMIZE_ENABLED:-0}" == "1" ]]; then
  CLEAN_ARGS+=(--optimize)
fi

if [[ -x "$PYTHON_BIN" ]]; then
  run "Executar retencao de dados Warden Clean" "$PYTHON_BIN" scripts/warden_clean.py "${CLEAN_ARGS[@]}"
  run "Aplicar retencao de arquivos semanais Warden" "$PYTHON_BIN" scripts/weekly_archive.py --prune-only
else
  log WARN "Python Warden nao encontrado ou sem execucao: $PYTHON_BIN"
fi

if [[ -d "$WARDEN_ROOT/runtime/logs" ]]; then
  while IFS= read -r -d '' log_file; do
    rotate_large_file "Rodar log Warden maior que 20M: $(basename "$log_file")" "$log_file" 20
  done < <(find "$WARDEN_ROOT/runtime/logs" -maxdepth 1 -type f \( -name '*.log' -o -name '*.err.log' \) -print0)

  run "Remover rotacoes de log antigas (>${LOG_ROTATE_RETENTION_DAYS}d)" \
    find "$WARDEN_ROOT/runtime/logs" -maxdepth 1 -type f -name '*.log.*.gz' -mtime +"$LOG_ROTATE_RETENTION_DAYS" -delete
fi

rotate_large_file "Rodar historico db_monitor se exceder 20M" "$WARDEN_ROOT/runtime/db_monitor_history.jsonl" 20
rotate_large_file "Rodar slack_alert_events.jsonl se exceder 20M" "$WARDEN_ROOT/runtime/slack_alert_events.jsonl" 20

if [[ -d "$WARDEN_ROOT/runtime" ]]; then
  run "Remover rotacoes antigas de historico (>${LOG_ROTATE_RETENTION_DAYS}d)" \
    find "$WARDEN_ROOT/runtime" -maxdepth 1 -type f \
      \( -name 'db_monitor_history.jsonl.*.gz' -o -name 'slack_alert_events.jsonl.*.gz' \) \
      -mtime +"$LOG_ROTATE_RETENTION_DAYS" -delete
fi

OP_JOBS_MTIME_DAYS="${WARDEN_OPERATIONAL_JOBS_RETENTION_DAYS:-30}"
if [[ -d "$WARDEN_ROOT/runtime/operational_jobs" ]]; then
  run "Remover state antigo de operational_jobs" \
    find "$WARDEN_ROOT/runtime/operational_jobs" -maxdepth 1 -type f -name '*.json' -mtime +"$OP_JOBS_MTIME_DAYS" -delete
fi

if [[ -d "$WARDEN_ROOT/runtime/operational" ]]; then
  run "Remover exports .txt antigos do Warden System Info (>${SYSTEM_INFO_TXT_RETENTION_DAYS}d)" \
    find "$WARDEN_ROOT/runtime/operational" -maxdepth 1 -type f -name 'warden_system_info_*.txt' \
      -mtime +"$SYSTEM_INFO_TXT_RETENTION_DAYS" -delete
fi

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
    find "$WARDEN_ROOT/runtime/cache" -mindepth 1 ! -name '.gitkeep' -mtime +"$CACHE_MTIME_DAYS" -delete
fi

run "Remover caches Python antigos dentro do Warden" \
  find "$WARDEN_ROOT" \
    \( -path "$WARDEN_ROOT/.git" -o -path "$WARDEN_ROOT/.venv" -o -path "$WARDEN_ROOT/secrets" \) -prune -o \
    \( -type d \( -name '__pycache__' -o -name '.pytest_cache' \) -mtime +"$CACHE_MTIME_DAYS" -exec rm -rf {} + \)

run "Remover bytecode Python antigo dentro do Warden" \
  find "$WARDEN_ROOT" \
    \( -path "$WARDEN_ROOT/.git" -o -path "$WARDEN_ROOT/.venv" -o -path "$WARDEN_ROOT/secrets" \) -prune -o \
    \( -type f \( -name '*.pyc' -o -name '*.pyo' \) -mtime +"$CACHE_MTIME_DAYS" -exec rm -f {} + \)

run "Remover ficheiros temporarios de editor e sistema dentro do Warden" \
  find "$WARDEN_ROOT" \
    \( -path "$WARDEN_ROOT/.git" -o -path "$WARDEN_ROOT/.venv" -o -path "$WARDEN_ROOT/secrets" \) -prune -o \
    \( -type f \( -name '*~' -o -name '.DS_Store' -o -name 'Thumbs.db' -o -name '*.swp' -o -name '*.swo' \) -mtime +"$TEMP_FILE_MTIME_DAYS" -exec rm -f {} + \)

if [[ -n "$CRONTAB_LOG_DIR" && -d "$CRONTAB_LOG_DIR" ]]; then
  run "Truncar logs grandes de crontab do host" \
    find "$CRONTAB_LOG_DIR" -maxdepth 1 -type f -name '*.txt' -size +5M -exec truncate -s 0 {} +
fi

for temp_dir in /tmp /var/tmp; do
  if [[ -d "$temp_dir" ]]; then
    run "Remover temporarios antigos seguros em $temp_dir" \
      find "$temp_dir" -xdev -mindepth 1 -maxdepth 1 \
        \( -type f -o -type d \) \
        \( -name 'tmp.*' -o -name '*.tmp' -o -name 'tmp-*' -o -name 'pip-*' \) \
        -mtime +"$SERVER_TEMP_MTIME_DAYS" -exec rm -rf {} +
  fi
done

if [[ -e "$NGINX_TEMP_DIR" ]]; then
  run "Remover staging antigo de backup nginx" \
    find "$NGINX_TEMP_DIR" -mindepth 0 -maxdepth 0 -mtime +"$NGINX_TEMP_MTIME_DAYS" -exec rm -rf {} +
fi

# Logs SO, apt cache, snaps desactivados e artefactos .bak: scripts/host-hygiene.sh (cron # overseer:host_hygiene)

if command -v docker >/dev/null 2>&1; then
  run "Limpar cache Docker build antiga" docker builder prune -af --filter "until=$DOCKER_BUILD_CACHE_UNTIL"
  run "Limpar imagens Docker dangling antigas" docker image prune -f --filter "until=$DOCKER_BUILD_CACHE_UNTIL"
else
  log SKIP "Docker nao disponivel."
fi

log INFO "warden_clean concluido."
