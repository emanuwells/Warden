# Arquitetura Backend — Warden

## Stack

| Campo | Valor |
|---|---|
| Runtime | Python 3.10+ |
| Scripts principais | `src.warden` (CLI), `scripts/export_payload.py`, `scripts/warden_clean.py` |
| Bibliotecas | `psutil`, `PyMySQL`, `python-dotenv`, `requests` |
| Persistência | MariaDB/MySQL — schema `Warden`, tabela `warden_metrics` |
| Autenticação | N/A (collector interno); API MAIATRON usa auth MAIATRON |
| Testes | `python -m py_compile` (smoke manual) |

## Estrutura

```text
src/warden.py             # CLI principal (collector)
src/
  collector.py            # Recolha de métricas de sistema
  db_writer.py           # Escrita em MariaDB
  db_monitor.py          # Monitorização de schemas MariaDB
  settings.py            # Configuração por ambiente
  alerts.py               # Lógica de alertas
  slack_notifier.py       # Notificações Slack
scripts/
  export_payload.py       # Geração de snapshots JSON
  warden_clean.py         # Limpeza de métricas antigas
  slack_alerts.py         # Alertas imediatos
  slack_daily_digest.py   # Digest diário
  weekly_archive.py      # Arquivo semanal
```

## Regras

- Separar recolha (`collector.py`) de persistência (`db_writer.py`) e exportação (`export_payload.py`).
- Validar inputs na fronteira (`.env` via `python-dotenv`).
- Não expor credenciais em logs ou respostas.
- Manter `settings.py` como única fonte de configuração por ambiente.

## APIs / Interfaces

| Interface | Responsabilidade | Formato |
|---|---|---|
| `python -m src.warden --setup` | Criar schema e tabela | SQL DDL |
| `python -m src.warden --once` | Recolha única | Inserção MariaDB |
| `export_payload.py --mode {fast,heavy,full}` | Snapshots JSON | JSON |
| `api.php?action=ops_fast` | Snapshot leve | JSON |
| `api.php?action=ops_heavy` | Snapshot pesado | JSON |
| `api.php?action=full` | Payload completo | JSON |

## Testes Esperados

- Smoke: `python -m py_compile` em todos os módulos Python.
- Validação Docker: `docker compose -f docker/compose.pipeline.yml config`.
- Validação Bash: `bash -n scripts/warden_clean.sh`.
