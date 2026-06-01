# Guia de Produção — Warden (estado atual)

## 1) Contexto e paths oficiais

- Runtime/pipeline oficial: `/home/eferreira/MAIATRON/Warden` (canónico; `/opt/warden` é legado de templates)
- Limpeza de disco / SSH: [`Producao_Acesso_e_Limpeza.md`](Producao_Acesso_e_Limpeza.md)
- Frontend/API oficial: `/usr/share/nginx/html/MAIATRON/apps/warden`
- Fonte de snapshots consumidos pela API:
  - `/home/eferreira/MAIATRON/Warden/runtime/export/warden_fast_snapshot.json`
  - `/home/eferreira/MAIATRON/Warden/runtime/export/warden_heavy_snapshot.json`
  - `/home/eferreira/MAIATRON/Warden/runtime/export/warden_payload.json`

## 2) Bootstrap host (sem Docker)

```bash
cd /home/eferreira/MAIATRON/Warden
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
cp secrets/database.json.example secrets/database.json
```

Config mínima no `.env`:

- `DB_*`
- `RETENTION_DAYS=7`
- `EXPORT_PATH=runtime/export/warden_payload.json`
- `EXPORT_FAST_PATH=runtime/export/warden_fast_snapshot.json`
- `EXPORT_HEAVY_PATH=runtime/export/warden_heavy_snapshot.json`

Criar tabela e validar:

```bash
.venv/bin/python warden.py --setup
.venv/bin/python warden.py --once
.venv/bin/python scripts/export_payload.py --mode fast
.venv/bin/python scripts/export_payload.py --mode heavy
```

## 3) Serviço + cron

### Serviço

```bash
sudo cp systemd/warden.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now warden
sudo systemctl status warden --no-pager

# Garantir 1 único collector (evitar user service paralelo)
systemctl --user stop warden.service || true
systemctl --user disable warden.service || true
```

### Cron

```bash
crontab -e
# inserir conteúdo de scripts/crontab.example
```

Jobs críticos:

- fast export (cadência alta)
- heavy export (5 em 5 min)
- janitor diário
- slack alerts (2 min)
- digest diário
- weekly archive

## 4) Integração com MAIATRON (API)

Garantir no nginx/php os env vars para `apps/warden/api.php`:

- `WARDEN_SOURCE_PATH`
- `WARDEN_FAST_SOURCE_PATH`
- `WARDEN_HEAVY_SOURCE_PATH`

Smoke:

```bash
curl -s http://127.0.0.1/MAIATRON/apps/warden/api.php?action=ops_fast | head
curl -s http://127.0.0.1/MAIATRON/apps/warden/api.php?action=ops_heavy | head
```

## 5) Docker (pipeline-only, DB externa)

### 5.1 Configurar

```bash
cp .env.docker.example .env.docker
```

### 5.2 Arrancar

```bash
docker compose up -d --build
docker compose ps
```

### 5.3 Serviços no compose

- `warden-collector`: processo contínuo (`python warden.py`)
- `warden-scheduler`: cron (`scripts/docker.crontab`)

### 5.4 Host metrics em Docker

Config obrigatória para refletir máquina anfitriã:

- `MONITOR_ROOT_PATH=/hostfs`
- mount `/:/hostfs:ro`
- `pid: host`
- `network_mode: host`

## 6) Verificações operacionais

### Retenção 7 dias

```sql
SELECT COUNT(*) FROM Warden.warden_metrics
WHERE captured_at < NOW() - INTERVAL 7 DAY;
```

Esperado: `0` após ciclo do janitor.

### Campos de crescimento por janela (Disco + DB)

Validar no snapshot full:

```bash
jq '.history_24h[0] | {disk_total_gb_avg,disk_used_gb_avg,disk_free_gb_avg,disk_growth_gb_h_avg}' runtime/export/warden_payload.json
jq '.db.history["24h"][0] | {storage_total_gb_avg,storage_growth_gb_h_avg}' runtime/export/warden_payload.json
```

Validar no frontend:
- tab `Disk` mostra gráfico dedicado de crescimento com hint `Atual + Média janela`.
- tab `DB` mostra gráfico dedicado de consumo/crescimento separado de `QPS/TPS`.

### Sintaxe Python

```bash
python3 -m py_compile warden.py src/settings.py src/collector.py src/db_monitor.py scripts/export_payload.py scripts/slack_alerts.py scripts/slack_daily_digest.py scripts/janitor.py scripts/weekly_archive.py
```

## 7) Troubleshooting rápido

- **API sem dados**: validar paths `WARDEN_*_SOURCE_PATH` e permissões de leitura.
- **Snapshots não atualizam**: validar cron/scheduler e logs em `runtime/logs`.
- **Retenção não aplica**: confirmar `RETENTION_DAYS` no processo `warden.service` ativo.
- **Docker sem métricas de host**: confirmar `MONITOR_ROOT_PATH=/hostfs`, `pid: host` e mount root host.
