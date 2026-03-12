#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=0
ENABLE_MYSQL_CLEANUP="${ENABLE_MYSQL_CLEANUP:-0}"

usage() {
  cat <<'EOF'
Usage: maiatron_weekly_housekeeping.sh [--dry-run]

Options:
  --dry-run  Show what would be cleaned without changing the system.
  -h, --help Show this help text.

Environment:
  ENABLE_MYSQL_CLEANUP=1  Enable the optional MySQL cleanup step.
EOF
}

log() {
  local level="$1"
  shift
  printf '[%s] %s\n' "$level" "$*"
}

info() {
  log "INFO" "$@"
}

warn() {
  log "WARN" "$@"
}

skip() {
  log "SKIP" "$@"
}

fatal() {
  log "ERROR" "$@"
  exit 1
}

print_command() {
  printf '       '
  printf '%q ' "$@"
  printf '\n'
}

run_command() {
  local description="$1"
  shift

  info "$description"
  print_command "$@"

  if (( DRY_RUN )); then
    return 0
  fi

  if ! "$@"; then
    warn "Falhou: $description"
  fi
}

run_find_cleanup() {
  local description="$1"
  shift

  info "$description"
  if (( DRY_RUN )); then
    print_command find "$@" -print
    find "$@" -print 2>/dev/null || warn "Nao foi possivel listar todos os alvos para: $description"
    return 0
  fi

  print_command find "$@" -delete
  if ! find "$@" -delete 2>/dev/null; then
    warn "Falhou: $description"
  fi
}

run_mysql_cleanup() {
  local db_exists=""
  local table_exists=""
  local cleanup_sql="DELETE FROM BAZE.logs WHERE LogDate < DATE_SUB(NOW(), INTERVAL 30 DAY);"

  if [[ "$ENABLE_MYSQL_CLEANUP" != "1" ]]; then
    skip "MySQL cleanup desativado; usa ENABLE_MYSQL_CLEANUP=1 para ativar."
    return 0
  fi

  if ! command -v mysql >/dev/null 2>&1; then
    warn "mysql nao esta disponivel; a limpeza DB foi ignorada."
    return 0
  fi

  info "Validar conectividade MySQL e existencia de BAZE.logs"
  if (( DRY_RUN )); then
    print_command mysql --batch --skip-column-names -e "SHOW DATABASES LIKE 'BAZE';"
    print_command mysql --batch --skip-column-names -e "SHOW TABLES IN BAZE LIKE 'logs';"
    print_command mysql -e "$cleanup_sql"
    return 0
  fi

  if ! db_exists="$(mysql --batch --skip-column-names -e "SHOW DATABASES LIKE 'BAZE';" 2>/dev/null)"; then
    warn "Sem acesso ao MySQL; limpeza DB ignorada."
    return 0
  fi

  if [[ "$db_exists" != "BAZE" ]]; then
    warn "Base de dados BAZE nao encontrada; limpeza DB ignorada."
    return 0
  fi

  if ! table_exists="$(mysql --batch --skip-column-names -e "SHOW TABLES IN BAZE LIKE 'logs';" 2>/dev/null)"; then
    warn "Nao foi possivel validar a tabela BAZE.logs; limpeza DB ignorada."
    return 0
  fi

  if [[ "$table_exists" != "logs" ]]; then
    warn "Tabela BAZE.logs nao encontrada; limpeza DB ignorada."
    return 0
  fi

  run_command "Apagar registos MySQL com mais de 30 dias" mysql -e "$cleanup_sql"
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
      fatal "Argumento desconhecido: $1"
      ;;
  esac
  shift
done

if (( DRY_RUN )); then
  info "Modo dry-run ativo; nao serao feitas alteracoes."
fi

if (( EUID != 0 )); then
  if (( DRY_RUN )); then
    warn "Dry-run sem root: a listagem pode omitir caminhos protegidos."
  else
    fatal "Este script exige root fora do modo --dry-run."
  fi
fi

if command -v journalctl >/dev/null 2>&1; then
  run_command "Limitar journald a 300M" journalctl -q --vacuum-size=300M
else
  warn "journalctl nao esta disponivel; passo journald ignorado."
fi

run_find_cleanup \
  "Remover logs rotativos antigos em /var/log" \
  /var/log \
  -ignore_readdir_race \
  -xdev \
  -type f \
  \( -name '*.gz' -o -name '*.old' -o -name '*.[1-9]' \) \
  -mtime +7

run_find_cleanup \
  "Remover ficheiros temporarios antigos em /tmp e /var/tmp" \
  /tmp \
  /var/tmp \
  -ignore_readdir_race \
  -xdev \
  -type f \
  -mtime +7 \
  ! -name '*.lock' \
  ! -name '*.pid' \
  ! -name '*.sock'

run_find_cleanup \
  "Remover crash reports antigos em /var/crash" \
  /var/crash \
  -ignore_readdir_race \
  -xdev \
  -type f \
  \( -name '*.crash' -o -name '*.upload' -o -name '*.uploaded' \) \
  -mtime +30

if command -v apt-get >/dev/null 2>&1; then
  run_command "Limpar cache do APT" apt-get clean
else
  warn "apt-get nao esta disponivel; passo APT ignorado."
fi

run_find_cleanup \
  "Limpar ficheiros da cache de downloads do snap" \
  /var/lib/snapd/cache \
  -ignore_readdir_race \
  -xdev \
  -type f

if command -v snap >/dev/null 2>&1; then
  run_command "Definir snap refresh.retain=2" snap set system refresh.retain=2
else
  warn "snap nao esta disponivel; passo snap ignorado."
fi

skip "Retencao de binlogs gerida em /etc/mysql/conf.d/99-maiatron-binlog-retention.cnf."
skip "Retencao de /var/lib/systemd/coredump gerida pelo sistema via tmpfiles.d."
run_mysql_cleanup

info "Housekeeping semanal concluido."
