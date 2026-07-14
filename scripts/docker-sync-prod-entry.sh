#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/app"
VENV_DIR="${APP_ROOT}/.venv"
REQ_FILE="${APP_ROOT}/src/requirements.txt"
REQ_MARKER="${VENV_DIR}/.requirements-installed"
EXPORT_DIR="${APP_ROOT}/runtime/export"
SSH_KEY="/app/secrets/.ssh/id_ed25519"

SNAPSHOT_FILES=(
  "warden_fast_snapshot.json"
  "warden_heavy_snapshot.json"
  "warden_payload.json"
)

log() {
  printf '[warden-sync] %s\n' "$*"
}

die() {
  printf '[warden-sync] ERRO: %s\n' "$*" >&2
  exit 1
}

get_env() {
  local key="$1"
  local default="${2:-}"
  local val="${!key:-}"
  if [ -n "$val" ]; then
    printf '%s' "$val"
  else
    printf '%s' "$default"
  fi
}

ensure_venv_and_requirements() {
  if [ ! -d "$VENV_DIR" ]; then
    log "A criar venv em ${VENV_DIR}..."
    python -m venv "$VENV_DIR"
  fi
  # shellcheck source=/dev/null
  . "${VENV_DIR}/bin/activate"

  if [ ! -f "$REQ_FILE" ]; then
    log "Sem src/requirements.txt; a ignorar pip."
    return 0
  fi

  if [ ! -f "$REQ_MARKER" ] || [ "$REQ_FILE" -nt "$REQ_MARKER" ]; then
    log "A instalar dependências de src/requirements.txt..."
    pip install --disable-pip-version-check -q -r "$REQ_FILE"
    touch "$REQ_MARKER"
  else
    log "Dependências já instaladas (marker atual)."
  fi
}

validate_ssh_prereqs() {
  local host user port runtime_root

  host="$(get_env WARDEN_DEPLOY_SSH_HOST)"
  user="$(get_env WARDEN_DEPLOY_SSH_USER)"
  port="$(get_env WARDEN_DEPLOY_SSH_PORT "22")"
  runtime_root="$(get_env WARDEN_RUNTIME_ROOT "")"
  if [ -z "$runtime_root" ]; then
    die "Definir WARDEN_RUNTIME_ROOT em secrets/production.deploy.local.env"
  fi

  if [ -z "$host" ] || [ -z "$user" ]; then
    die "Definir WARDEN_DEPLOY_SSH_HOST e WARDEN_DEPLOY_SSH_USER em secrets/production.deploy.local.env (ver docs/resources/examples/secrets/production.deploy.local.env.example)."
  fi

  if [ ! -f "$SSH_KEY" ]; then
    die "Chave SSH em falta: ${SSH_KEY}. Copiar id_ed25519 para secrets/.ssh/ (gitignored)."
  fi

  if [ ! -r "$SSH_KEY" ]; then
    die "Chave SSH não legível no container. No Windows: icacls secrets\\.ssh\\id_ed25519 /inheritance:r /grant:r \"%USERNAME%:R\""
  fi

  chmod 600 "$SSH_KEY" 2>/dev/null || true

  export WARDEN_SSH_TARGET="${user}@${host}"
  export WARDEN_SSH_PORT="$port"
  export WARDEN_RUNTIME_ROOT="$runtime_root"
}

sync_scp_snapshots() {
  local remote_export remote_spec

  remote_export="${WARDEN_RUNTIME_ROOT}/runtime/export"
  mkdir -p "$EXPORT_DIR"

  log "Modo SCP (read-only) de ${WARDEN_SSH_TARGET}:${remote_export}/"

  for name in "${SNAPSHOT_FILES[@]}"; do
    remote_spec="${WARDEN_SSH_TARGET}:${remote_export}/${name}"
    log "A copiar ${name}..."
    scp -P "${WARDEN_SSH_PORT}" \
      -i "$SSH_KEY" \
      -o BatchMode=yes \
      -o StrictHostKeyChecking=accept-new \
      "$remote_spec" \
      "${EXPORT_DIR}/"
  done
}

validate_local_snapshots() {
  local name path size

  for name in "${SNAPSHOT_FILES[@]}"; do
    path="${EXPORT_DIR}/${name}"
    if [ ! -s "$path" ]; then
      die "Ficheiro em falta ou vazio após sync: ${path}"
    fi
    size="$(wc -c < "$path" | tr -d ' ')"
    log "OK ${name} (${size} bytes, mtime $(date -r "$path" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || stat -c '%y' "$path" 2>/dev/null || echo '?'))"
  done

  log "Sync concluído. Montar runtime/export no stack dev: docker compose -f docker/compose.dev.yml up -d"
}

main() {
  local mode

  mode="$(get_env WARDEN_SYNC_MODE "scp")"
  log "WARDEN_SYNC_MODE=${mode}"

  ensure_venv_and_requirements

  case "$mode" in
    scp)
      validate_ssh_prereqs
      sync_scp_snapshots
      validate_local_snapshots
      ;;
    *)
      die "Modo não suportado: ${mode}. Usar WARDEN_SYNC_MODE=scp."
      ;;
  esac
}

main "$@"
