#!/usr/bin/env bash
# Instala ou actualiza a unit systemd do collector Warden.
# Uso: WARDEN_RUNTIME_ROOT=/path/to/Warden sudo bash scripts/install-warden-systemd.sh
set -euo pipefail

ROOT="${WARDEN_RUNTIME_ROOT:-${WARDEN_ROOT:-}}"
if [[ -z "$ROOT" ]]; then
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: executar com sudo" >&2
  exit 1
fi

RUN_USER="${WARDEN_SERVICE_USER:-${SUDO_USER:-$(stat -c '%U' "$ROOT" 2>/dev/null || echo root)}}"
RUN_GROUP="${WARDEN_SERVICE_GROUP:-$(id -gn "$RUN_USER" 2>/dev/null || echo "$RUN_USER")}"
PYTHON="${ROOT}/.venv/bin/python"
if [[ ! -x "$PYTHON" ]]; then
  PYTHON="$(command -v python3)"
fi

UNIT_PATH="/etc/systemd/system/warden.service"
TMP_UNIT="$(mktemp)"

cat >"$TMP_UNIT" <<EOF
[Unit]
Description=Warden System Resource Monitor
Documentation=https://github.com/emanuwells/Warden
After=network-online.target mariadb.service
Wants=network-online.target

[Service]
Type=simple
User=${RUN_USER}
Group=${RUN_GROUP}
WorkingDirectory=${ROOT}
EnvironmentFile=${ROOT}/.env
ExecStart=${PYTHON} -m src.warden
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=warden

[Install]
WantedBy=multi-user.target
EOF

install -m 644 "$TMP_UNIT" "$UNIT_PATH"
rm -f "$TMP_UNIT"
systemctl daemon-reload
systemctl enable warden.service
systemctl restart warden.service
sleep 2
systemctl is-active warden.service
echo "OK: warden.service instalado (${UNIT_PATH})"
