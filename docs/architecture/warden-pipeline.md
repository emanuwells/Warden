# Pipeline Warden — Fase 1 e Fase 2

Documento operacional e arquitetural do fluxo **DB → snapshots JSON → API PHP → UI**.

## Modelo actual (Fase 1)

```text
systemd warden.service (collector, COLLECT_INTERVAL)
        │
        ▼
MariaDB warden_metrics  ◄── fonte de verdade
        │
        ├── cron fast  (30×/min, ~2s) ──► warden_fast_snapshot.json
        ├── cron heavy (*/5)          ──► warden_heavy_snapshot.json
        └── cron full  (*/15)         ──► warden_payload.json + refresh fast/heavy
        │
        ▼
api.php (ops_fast / ops_heavy) ──► Ops Center / UI (polling)
```

### Princípios

| Princípio | Implementação |
|---|---|
| Fonte de verdade | MariaDB (`warden_metrics`) |
| Projeção read-only | Snapshots em `runtime/export/` |
| API agnóstica | `api.php` lê JSON + DB; sem acoplamento a plataforma host |
| Near-real-time | Lane **fast** (2s) separada da lane **heavy** (5 min) |
| Fallback | `warden_payload.json` (full) para consumidores legacy e merge |

## Fase 1 — Melhoramento imediato (baixo custo)

Objectivo: estabilizar o pipeline dual sem alterar a arquitectura. **Sem WebSocket, sem API-only DB, sem reescrita do collector.**

### Checklist operacional

| Item | Valor recomendado | Onde |
|---|---|---|
| `COLLECT_INTERVAL` | `15` (s) | `.env` / systemd |
| Export fast cron | 30 jobs/min (`sleep 0,2,4…58`) | `crontab` |
| Export heavy cron | `*/5` | `crontab` |
| Export full cron | `*/15` | `crontab` |
| `WARDEN_FAST_STALE_MS` | `12000` (~6× intervalo fast) | `api.php` |
| `WARDEN_HEAVY_STALE_MS` | `600000` (10 min) | `api.php` |
| Permissões HUB pós-deploy | `755` dirs / `644` ficheiros | `publish-public.ps1` |
| Logs export INFO | stdout (cron `> /dev/null`) | `export_payload.py` |
| Erros export | stderr → `runtime/logs/export_*.err.log` | cron |

### Alinhamento de intervalos

- O **collector** grava na DB a cada `COLLECT_INTERVAL` segundos.
- O **export fast** relê a DB a cada ~2s e actualiza `generated_at` do snapshot; o painel vê dados frescos mesmo com collect a 15s.
- `PROCESS_TOP_SCAN_INTERVAL_SECONDS` e `PROCESS_TOP_NETWORK_SCAN_INTERVAL_SECONDS` devem coincidir com `COLLECT_INTERVAL` para coerência no painel ops.
- `WARDEN_FAST_STALE_MS` deve ser **≥ 3×** o intervalo do export fast (ex.: 12s para export a 2s).

### Validação

```bash
# No host de produção (Linux)
export WARDEN_RUNTIME_ROOT=/path/to/Warden
bash scripts/validate-pipeline.sh

# Smoke API (com sessão ou token conforme host)
curl -sS -o /dev/null -w "%{http_code}" "https://host/.../api.php?action=ops_fast"
```

Critérios de sucesso:

- `warden_fast_snapshot.json` com idade &lt; 20s
- `warden_heavy_snapshot.json` com idade &lt; 6 min
- `warden_payload.json` com idade &lt; 16 min
- Serviço `warden` active
- `ops_fast` HTTP 200 (com auth válida)

### Crons de housekeeping (independentes do pipeline)

| Cron | Hora | Tag |
|---|---|---|
| Warden Clean | 01:00 | `# overseer:warden_clean` |
| Host hygiene | 01:30 | `# overseer:host_hygiene` |

## Modelo Task Manager (produção)

Como o Task Manager do Windows: **amostragem** e **refresh da UI** em lanes separadas.

```text
Collector (2s)     → MariaDB apenas
Cron fast (2s)   → warden_fast_snapshot.json (cache-only, <1s)
Ops Center (1.2s)→ poll ops_fast
Heavy (5 min)      → processos, histórico, disk top
```

| Lane | Intervalo | Notas |
|---|---|---|
| Collector | `COLLECT_INTERVAL=2` | Não exporta JSON (evita bloqueio de 12s) |
| Export fast | 30×/min cron | `cache_only` — CPU/RAM/disco frescos |
| Ops Center | `WARDEN_FAST_REFRESH_MS=1200` | HUB `frontend/ops-center.js` |
| Heavy | */5 | Preenche caches de processos/disk top |

### Porque não export inline no collector

O export fast com `force=True` em process tops demora **~12s** (cache fria) e bloqueava o loop — snapshot com 30–50s de atraso. Solução: lane cron dedicada + export fast só lê cache para extras pesados.

### Restaurar cron 2s em produção

```bash
WARDEN_RUNTIME_ROOT=/path WARDEN_EXPORT_FAST_LOCK=/tmp/maiatron_warden_export_fast.lock \
  bash scripts/restore-crontab-fast-2s.sh
```

Ver ADR: [docs/adr/0001-warden-dual-snapshot-pipeline.md](adr/0001-warden-dual-snapshot-pipeline.md).

## Referências

- `scripts/crontab.example` — schedule canónico
- `scripts/validate-pipeline.sh` — smoke do pipeline
- `docs/architecture/production-access-cleanup.md` — runbook de limpeza
- `docs/ai/ops/HANDOFF.md` — estado operacional
