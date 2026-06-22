#!/usr/bin/env bash
set -euo pipefail

# Host hygiene: logs do SO e artefactos .bak de deploy (fora do scope Warden Clean).
# PRESERVE (never deleted):
#   - /BackupNGINX, /BackupDB (retenção própria)
#   - MySQL data, binlogs, relay logs, Docker volumes
#   - runtime/export/*.json, secrets, .venv
#   - pastas de backup nomeadas manualmente (ex.: *_source_backup sem padrão .bak)

WARDEN_HUB_ROOT="${WARDEN_HUB_ROOT:-}"
HOST_HYGIENE_NGINX_HTML="${HOST_HYGIENE_NGINX_HTML:-/usr/share/nginx/html}"
HOST_HYGIENE_BAK_KEEP="${HOST_HYGIENE_BAK_KEEP:-1}"
HOST_HYGIENE_JOURNAL_DAYS="${HOST_HYGIENE_JOURNAL_DAYS:-7}"
HOST_HYGIENE_LOG_TRUNCATE_SIZE="${HOST_HYGIENE_LOG_TRUNCATE_SIZE:-50M}"
HOST_HYGIENE_CRONTAB_LOG_MAX="${HOST_HYGIENE_CRONTAB_LOG_MAX:-5M}"
HOST_HYGIENE_SNAP_PRUNE_ENABLED="${HOST_HYGIENE_SNAP_PRUNE_ENABLED:-1}"
HOST_HYGIENE_SNAP_RETAIN="${HOST_HYGIENE_SNAP_RETAIN:-2}"
WARDEN_CRONTAB_LOG_DIR="${WARDEN_CRONTAB_LOG_DIR:-}"
HOST_HYGIENE_PRIVILEGED="${HOST_HYGIENE_PRIVILEGED:-0}"
DRY_RUN=0

# Path canónico para sudo NOPASSWD (scripts/host-hygiene.sudoers).
HOST_HYGIENE_SUDO_ENTRY="${HOST_HYGIENE_SUDO_ENTRY:-/usr/local/sbin/warden-host-hygiene}"

usage() {
  cat <<'EOF'
Usage: host-hygiene.sh [--dry-run] [--privileged]

Higiene diária do host: artefactos .bak de deploy e logs do SO (com sudo NOPASSWD).

  --privileged   Secção de logs SO (invocada via sudo; não usar manualmente).

Variáveis:
  WARDEN_HUB_ROOT              Raiz do HUB (ex.: /usr/share/nginx/html/MAIATRON-HUB)
  HOST_HYGIENE_NGINX_HTML      Raiz nginx html para .bak fora do HUB
  HOST_HYGIENE_BAK_KEEP        Cópias .bak a manter por diretório (default: 1)
  HOST_HYGIENE_JOURNAL_DAYS    Dias de journald a reter (default: 7)
  HOST_HYGIENE_LOG_TRUNCATE_SIZE Tamanho mínimo para truncar logs SO (default: 50M)
  HOST_HYGIENE_SNAP_PRUNE_ENABLED  Remover revisões snap desactivadas (default: 1)
  HOST_HYGIENE_SNAP_RETAIN         Revisões snap a reter por pacote (default: 2)
  WARDEN_CRONTAB_LOG_DIR       Diretório de logs crontab Overseer (opcional)

Instalação sudoers: ver scripts/host-hygiene.sudoers
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

is_bak_artifact() {
  local base
  base="$(basename "$1")"
  [[ "$base" == *.bak_* ]] && return 0
  [[ "$base" == *.backup-* ]] && return 0
  [[ "$base" == *-HUB.backup-* ]] && return 0
  return 1
}

prune_bak_in_directory() {
  local parent="$1"
  local -a entries=()
  local line path mtime keep_count

  while IFS= read -r -d '' path; do
    is_bak_artifact "$path" || continue
    [[ -e "$path" ]] || continue
    mtime="$(stat -c '%Y' "$path" 2>/dev/null || echo 0)"
    entries+=("${mtime}	${path}")
  done < <(find "$parent" -mindepth 1 -maxdepth 1 \( -name '*.bak_*' -o -name '*.backup-*' -o -name '*-HUB.backup-*' \) -print0 2>/dev/null)

  ((${#entries[@]} <= HOST_HYGIENE_BAK_KEEP)) && return 0

  mapfile -t entries < <(printf '%s\n' "${entries[@]}" | sort -t $'\t' -k1,1nr)
  keep_count=0
  for line in "${entries[@]}"; do
    path="${line#*$'\t'}"
    keep_count=$((keep_count + 1))
    if (( keep_count <= HOST_HYGIENE_BAK_KEEP )); then
      log KEEP "Manter artefacto .bak: $path"
      continue
    fi
    if (( DRY_RUN )); then
      log DRYRUN "Removeria artefacto .bak: $path"
    else
      log INFO "Remover artefacto .bak: $path"
      rm -rf "$path"
    fi
  done
}

prune_bak_roots() {
  local root="$1"
  local -a parents=()

  [[ -d "$root" ]] || return 0
  log INFO "Auditar artefactos .bak em $root"

  while IFS= read -r -d '' parent; do
    parents+=("$parent")
  done < <(find "$root" \( -name '*.bak_*' -o -name '*.backup-*' -o -name '*-HUB.backup-*' \) -printf '%h\0' 2>/dev/null | sort -zu)

  if ((${#parents[@]} == 0)); then
    log SKIP "Sem artefactos .bak em $root"
    return 0
  fi

  for parent in "${parents[@]}"; do
    prune_bak_in_directory "$parent"
  done
}

prune_crontab_logs() {
  [[ -n "$WARDEN_CRONTAB_LOG_DIR" && -d "$WARDEN_CRONTAB_LOG_DIR" ]] || return 0
  run "Truncar logs crontab Overseer maiores que ${HOST_HYGIENE_CRONTAB_LOG_MAX}" \
    find "$WARDEN_CRONTAB_LOG_DIR" -maxdepth 1 -type f -name '*.txt' -size +"$HOST_HYGIENE_CRONTAB_LOG_MAX" -exec truncate -s 0 {} +
}

prune_snap_revisions() {
  if [[ "$HOST_HYGIENE_SNAP_PRUNE_ENABLED" != "1" ]]; then
    log SKIP "HOST_HYGIENE_SNAP_PRUNE_ENABLED desactivado."
    return 0
  fi

  if ! command -v snap >/dev/null 2>&1; then
    log SKIP "snap nao disponivel."
    return 0
  fi

  if [[ "$HOST_HYGIENE_SNAP_RETAIN" =~ ^[0-9]+$ ]] && (( HOST_HYGIENE_SNAP_RETAIN >= 2 )); then
    run "Limitar revisões snap retidas (refresh.retain=${HOST_HYGIENE_SNAP_RETAIN})" \
      snap set system refresh.retain="$HOST_HYGIENE_SNAP_RETAIN"
  fi

  local snapname revision
  while read -r snapname revision; do
    [[ -n "$snapname" && -n "$revision" ]] || continue
    if (( DRY_RUN )); then
      log DRYRUN "Removeria revisao snap desactivada: ${snapname} rev ${revision}"
      continue
    fi
    run "Remover revisao snap desactivada ${snapname} rev ${revision}" \
      snap remove "$snapname" --revision="$revision"
  done < <(LANG=C snap list --all 2>/dev/null | awk '/disabled/{print $1, $3}')
}

host_log_hygiene_privileged() {
  if command -v journalctl >/dev/null 2>&1; then
    run "Vacuum journald (${HOST_HYGIENE_JOURNAL_DAYS} dias)" \
      journalctl --vacuum-time="${HOST_HYGIENE_JOURNAL_DAYS}d"
  else
    log SKIP "journalctl nao disponivel."
  fi

  run "Truncar logs SO grandes (kern/auth/syslog/nginx/php)" \
    find /var/log -maxdepth 2 -type f \
      \( \
        -name 'kern.log' -o -name 'kern.log.*' -o \
        -name 'auth.log' -o -name 'auth.log.*' -o \
        -name 'syslog' -o -name 'syslog.*' -o \
        -name 'php7.4-maiatron-error.log' -o \
        -path '/var/log/nginx/*' \
      \) \
      -size +"$HOST_HYGIENE_LOG_TRUNCATE_SIZE" \
      -exec truncate -s 0 {} +

  for sql_log_dir in /var/log/mysql /var/log/mariadb; do
    [[ -d "$sql_log_dir" ]] || continue
    run "Truncar logs textuais SQL grandes em $sql_log_dir" \
      find "$sql_log_dir" -maxdepth 1 -type f \
        \( -name '*.log' -o -name '*.err' -o -name '*.slow' \) \
        -size +"$HOST_HYGIENE_LOG_TRUNCATE_SIZE" \
        -exec truncate -s 0 {} +
  done

  if command -v apt-get >/dev/null 2>&1; then
    run "Limpar cache apt segura" apt-get clean
  else
    log SKIP "apt-get nao disponivel."
  fi

  prune_snap_revisions
}

run_privileged_section() {
  local sudo_entry="$HOST_HYGIENE_SUDO_ENTRY"
  local dry_flag=()

  if (( DRY_RUN )); then
    dry_flag=(--dry-run)
  fi

  if [[ $EUID -eq 0 ]]; then
    host_log_hygiene_privileged
    return 0
  fi

  if [[ -x "$sudo_entry" ]]; then
    log INFO "Executar higiene de logs SO via sudo"
    if sudo -n "$sudo_entry" --privileged "${dry_flag[@]}"; then
      return 0
    fi
    log WARN "sudo NOPASSWD indisponivel para $sudo_entry"
    return 1
  fi

  log WARN "Entrada sudo nao encontrada: $sudo_entry (ignorar higiene de logs SO)"
  return 1
}

while (( $# > 0 )); do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      ;;
    --privileged)
      HOST_HYGIENE_PRIVILEGED=1
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

if [[ "$HOST_HYGIENE_PRIVILEGED" == 1 ]]; then
  host_log_hygiene_privileged
  log INFO "host-hygiene (privileged) concluido."
  exit 0
fi

if [[ -n "$WARDEN_HUB_ROOT" ]]; then
  prune_bak_roots "$WARDEN_HUB_ROOT"
else
  log SKIP "WARDEN_HUB_ROOT nao definido; ignorar .bak do HUB."
fi

if [[ -n "$HOST_HYGIENE_NGINX_HTML" && "$HOST_HYGIENE_NGINX_HTML" != "$WARDEN_HUB_ROOT" ]]; then
  prune_bak_roots "$HOST_HYGIENE_NGINX_HTML"
fi

prune_crontab_logs
run_privileged_section || true

log INFO "host-hygiene concluido."
