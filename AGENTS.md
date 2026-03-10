# AGENTS.md — Warden

## Projeto
**Warden** — monitor operacional de recursos do host (CPU, RAM, disco, rede, DB MariaDB).

## Arquitetura Atual
```
Collector + DB monitor -> MariaDB (schema Warden) -> Export fast/heavy/full -> API MAIATRON -> Frontend Warden
```

### Paths oficiais
- Runtime/pipeline/scripts/docs: `/home/eferreira/MAIATRON/Warden`
- Frontend/API live: `/usr/share/nginx/html/MAIATRON/apps/warden`
- Snapshots exportados pelo runtime:
  - `runtime/export/warden_fast_snapshot.json`
  - `runtime/export/warden_heavy_snapshot.json`
  - `runtime/export/warden_payload.json`

### Componentes principais
| Componente | Ficheiro | Função |
|---|---|---|
| Collector | `src/collector.py` | Captura métricas do host via psutil |
| DB Monitor | `src/db_monitor.py` | QPS/TPS/threads + consumo DB em disco |
| DB Writer | `src/db_writer.py` | Inserção/leitura MariaDB |
| Janitor | `src/janitor.py` | Retenção operacional (7 dias) |
| Export | `scripts/export_payload.py` | Gera snapshots `fast/heavy/full` |
| Weekly Archive | `scripts/weekly_archive.py` | Snapshot semanal agregado horário (30d agregado) |
| Slack Alerts | `scripts/slack_alerts.py` | Warning/critical + recovery com cadência por severidade |
| Slack Digest | `scripts/slack_daily_digest.py` | Resumo diário |
| Entrypoint | `warden.py` | `--setup`, `--once`, `--export`, `--cleanup` |

## Defaults operacionais
- `RETENTION_DAYS=7`
- `WEEKLY_ARCHIVE_RETENTION_WEEKS=6`
- Alertas disco: `WARN=95%`, `CRITICAL=98%`
- Slack warning cadence: sustain 10m / cooldown 60m
- Slack critical cadence: sustain 2m / cooldown 15m

## Métricas de janela obrigatórias (v2.x)
- Sistema (`history_*`): `disk_total_gb_avg`, `disk_used_gb_avg`, `disk_free_gb_avg`, `disk_growth_gb_h_avg`
- DB (`db.history.*`): `storage_total_gb_avg`, `storage_growth_gb_h_avg`

## Regras de código
- Python 3.10+
- Type hints obrigatórios
- Logging via `logging` (evitar `print` fora de CLIs)
- Segredos via `.env` ou `secrets/*.json` (nunca hardcoded)

## Comandos úteis
```bash
python warden.py --setup
python warden.py
python warden.py --once
python scripts/export_payload.py --mode fast
python scripts/export_payload.py --mode heavy
python scripts/export_payload.py --mode full
python scripts/janitor.py
python scripts/weekly_archive.py
```
