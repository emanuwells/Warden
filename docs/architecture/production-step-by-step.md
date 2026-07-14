# Guia de Produção — Warden (estado atual)

## 1) Contexto e paths

- Runtime/pipeline: `$WARDEN_RUNTIME_ROOT` (definido em `secrets/production.deploy.local.env`)
- Limpeza de disco / SSH: [`production-access-cleanup.md`](production-access-cleanup.md)
- Frontend/API (HUB do host): `$WARDEN_HUB_ROOT` (`frontend/apps/warden`, `backend/apps/warden`)
- Snapshots consumidos pela API:
  - `$WARDEN_RUNTIME_ROOT/runtime/export/warden_fast_snapshot.json`
  - `$WARDEN_RUNTIME_ROOT/runtime/export/warden_heavy_snapshot.json`
  - `$WARDEN_RUNTIME_ROOT/runtime/export/warden_payload.json`

## 2) Bootstrap host (sem Docker)

```bash
cd "$WARDEN_RUNTIME_ROOT"
python3 -m venv .venv
. .venv/bin/activate
pip install -r src/requirements.txt
cp docs/resources/templates/.env.example .env
cp docs/resources/examples/secrets/database.json.example secrets/database.json
```

Config mínima no `.env`:

- `DB_*`
- `RETENTION_DAYS=7`
- `EXPORT_PATH=runtime/export/warden_payload.json`
- `EXPORT_FAST_PATH=runtime/export/warden_fast_snapshot.json`
- `EXPORT_HEAVY_PATH=runtime/export/warden_heavy_snapshot.json`
- `WEEKLY_ARCHIVE_RETENTION_WEEKS=6`

Criar tabela e validar:

```bash
.venv/bin/python -m src.warden --setup
.venv/bin/python -m src.warden --once
.venv/bin/python scripts/export_payload.py --mode fast
.venv/bin/python scripts/export_payload.py --mode heavy
```

## 3) Serviço + cron

### Serviço

Ajustar paths em `deploy/systemd/warden.service` antes de instalar:

```bash
sudo cp deploy/systemd/warden.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now warden
sudo systemctl status warden --no-pager

systemctl --user stop warden.service || true
systemctl --user disable warden.service || true
```

### Cron

```bash
crontab -e
# inserir conteúdo de scripts/crontab.example (ajustar WARDEN_ROOT)
```

Jobs críticos: fast export, heavy export, Warden Clean, slack alerts, digest diário, weekly archive.

## 4) Integração com API no host

Garantir env vars para `apps/warden/api.php`:

- `WARDEN_RUNTIME_ROOT`
- `WARDEN_SOURCE_PATH`, `WARDEN_FAST_SOURCE_PATH`, `WARDEN_HEAVY_SOURCE_PATH` (opcional)
- `WARDEN_AUTH_DB_NAME` (schema de auth do host, se aplicável)

Smoke (ajustar URL ao vhost):

```bash
curl -s http://127.0.0.1/apps/warden/api.php?action=ops_fast | head
curl -s http://127.0.0.1/apps/warden/api.php?action=ops_heavy | head
```

## 5) Docker (pipeline-only, DB externa)

```bash
cp docs/resources/examples/config/env.docker.example .env.docker
docker compose -f docker/compose.pipeline.yml up -d --build
docker compose -f docker/compose.pipeline.yml ps
```

Host metrics: `MONITOR_ROOT_PATH=/hostfs`, mount `/:/hostfs:ro`, `pid: host`, `network_mode: host`.

## 6) Verificações operacionais

Retenção 7 dias:

```sql
SELECT COUNT(*) FROM Warden.warden_metrics
WHERE captured_at < NOW() - INTERVAL 7 DAY;
```

Esperado: `0` após ciclo do Warden Clean.

## 7) Troubleshooting rápido

- **API sem dados**: validar `WARDEN_*_SOURCE_PATH` e permissões de leitura.
- **Snapshots não atualizam**: validar cron/scheduler e logs em `runtime/logs`.
- **Retenção não aplica**: confirmar `RETENTION_DAYS` no processo `warden.service` ativo.
- **Docker sem métricas de host**: confirmar `MONITOR_ROOT_PATH=/hostfs`, `pid: host` e mount root host.
