# Warden — Runtime Oficial do Pipeline

Warden é o runtime de monitorização (collector + export + alertas) do ecossistema MAIATRON.

## Contrato operacional atual

- Frontend oficial: `/usr/share/nginx/html/MAIATRON/apps/warden` (UI + `api.php`)
- Runtime oficial deste repo: `/home/eferreira/MAIATRON/Warden`
- Snapshots exportados para consumo da API:
  - `runtime/export/warden_fast_snapshot.json`
  - `runtime/export/warden_heavy_snapshot.json`
  - `runtime/export/warden_payload.json`
- Retenção operacional: `RETENTION_DAYS=7`
- Histórico estendido: snapshot semanal agregado (`runtime/archive/weekly`)
- Janelas operacionais suportadas no frontend: `1h`, `24h`, `7d`, `30d` (30d agregado)

## Arquitetura

1. `warden.py` recolhe métricas (CPU/RAM/Disco/Rede + processos/top disco).
2. Dados entram na DB `Warden` (`warden_metrics`).
3. `scripts/export_payload.py` gera snapshots `fast/heavy/full`.
4. `apps/warden/api.php` (no MAIATRON) lê snapshots e serve `ops_fast/ops_heavy/full`.
5. Jobs auxiliares:
   - `scripts/janitor.py`
   - `scripts/slack_alerts.py`
   - `scripts/slack_daily_digest.py`
   - `scripts/weekly_archive.py`

## Métricas de crescimento (v2.x)

Além de CPU/RAM/Rede, o payload expõe crescimento por janela para Disco e DB:

- Histórico sistema (`history_*`):
  - `disk_total_gb_avg`
  - `disk_used_gb_avg`
  - `disk_free_gb_avg`
  - `disk_growth_gb_h_avg`
- Histórico DB (`db.history.*`):
  - `storage_total_gb_avg`
  - `storage_growth_gb_h_avg`

No frontend:
- Tab `Disk`: gráfico dedicado `Disco usado (GB)` + `Crescimento/h (GB/h)`.
- Tab `DB`: gráfico dedicado `Consumo DB (GB)` + `Crescimento/h (GB/h)` separado de throughput.

Fallback compatível com histórico antigo:
- quando faltarem colunas GB antigas, o export deriva `disk_used_gb_avg` a partir de `disk_avg` e `disk_total_gb` atual.

## Setup rápido (host)

```bash
cd /home/eferreira/MAIATRON/Warden
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
cp secrets/database.json.example secrets/database.json
```

Criar schema base:

```bash
.venv/bin/python warden.py --setup
```

Teste de recolha:

```bash
.venv/bin/python warden.py --once
.venv/bin/python scripts/export_payload.py --mode fast
.venv/bin/python scripts/export_payload.py --mode heavy
.venv/bin/python scripts/export_payload.py --mode full
```

## Serviço + cron (host)

- Serviço systemd: `systemd/warden.service`
- Cron recomendado: `scripts/crontab.example`

Passos típicos:

```bash
sudo cp systemd/warden.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now warden
# Evitar collector duplicado via user service:
systemctl --user stop warden.service || true
systemctl --user disable warden.service || true
crontab -e
# colar conteúdo de scripts/crontab.example
```

## Docker (pipeline-only, DB externa)

Este repo inclui dockerização do pipeline (não frontend).

Ficheiros:
- `Dockerfile`
- `docker-compose.yml`
- `.env.docker.example`
- `scripts/docker.crontab`
- `scripts/docker-scheduler.sh`

Arranque:

```bash
cp .env.docker.example .env.docker
docker compose up -d --build
```

Serviços:
- `warden-collector`: corre `python warden.py`
- `warden-scheduler`: corre cron para export/janitor/slack/archive

### Host metrics em Docker

Para recolher métricas da máquina anfitriã:

- `MONITOR_ROOT_PATH=/hostfs` (env)
- mount host root read-only: `/:/hostfs:ro`
- `pid: host`
- `network_mode: host`

Isto mantém o comportamento de monitorização de disco/processos coerente com host.

## Variáveis-chave

- `RETENTION_DAYS=7`
- `WEEKLY_ARCHIVE_RETENTION_WEEKS=6`
- `EXPORT_PATH`, `EXPORT_FAST_PATH`, `EXPORT_HEAVY_PATH`
- `MONITOR_ROOT_PATH` (novo)
- `ALERT_DISK_WARN=95`, `ALERT_DISK_CRITICAL=98`
- `SLACK_WARNING_*` e `SLACK_CRITICAL_*`

## QA rápido

```bash
python3 -m py_compile warden.py src/settings.py src/collector.py src/db_monitor.py scripts/export_payload.py scripts/slack_alerts.py scripts/slack_daily_digest.py scripts/janitor.py scripts/weekly_archive.py
```

Smoke API (no host MAIATRON):

```bash
curl -I http://127.0.0.1/MAIATRON/apps/warden/index.html
curl -s http://127.0.0.1/MAIATRON/apps/warden/api.php?action=ops_fast | head
curl -s http://127.0.0.1/MAIATRON/apps/warden/api.php?action=ops_heavy | head
```

## Git readiness checklist

- Não commitar `.env` nem segredos em `secrets/*.json` reais.
- Não commitar artefactos gerados em `runtime/export`, `runtime/cache`, `runtime/archive`, `runtime/logs`.
- Commits devem conter apenas código, docs, scripts e templates (`*.example`).
