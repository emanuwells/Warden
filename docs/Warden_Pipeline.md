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

## Fase 2 — Implementada (2026-06-19)

Objectivo: reduzir carga de cron fast mantendo latência alinhada ao `COLLECT_INTERVAL`.

### Arquitectura actual

```text
systemd warden.service
        │
        ├── collect + insert DB
        └── pós-insert: export_payload.export(mode="fast")   (EXPORT_FAST_ON_COLLECT=1)
        │
cron fast fallback 1×/min  ──► export_fast_fallback.sh (só se snapshot >30s)
cron heavy */5           ──► inalterado
cron full */15           ──► inalterado
```

### Componentes

| Componente | Ficheiro |
|---|---|
| Hook collector | `src/fast_snapshot.py`, `src/warden.py` |
| Flag env | `EXPORT_FAST_ON_COLLECT=1` (default) |
| Cron fallback | `scripts/export_fast_fallback.sh` |
| Patch crontab prod | `scripts/patch-crontab-phase2-fast.sh` |

### Rollback

1. `EXPORT_FAST_ON_COLLECT=0` em `.env` + `systemctl restart warden`
2. Repor bloco cron fast de 30 linhas (ver git history de `crontab.example`)
3. Ou `git revert` do commit Phase 2

### Critérios de aceitação

1. Idade do fast snapshot ≤ `COLLECT_INTERVAL + 10s` (`validate-pipeline.sh`)
2. Redução ≥ 90% de execuções cron fast (30/min → ≤1/min efectiva)
3. `ops_fast` sem regressão

Ver ADR: [docs/adr/0001-warden-dual-snapshot-pipeline.md](adr/0001-warden-dual-snapshot-pipeline.md).

## Referências

- `scripts/crontab.example` — schedule canónico
- `scripts/validate-pipeline.sh` — smoke do pipeline
- `docs/Producao_Acesso_e_Limpeza.md` — runbook de limpeza
- `.agents/ops/HANDOFF.md` — estado operacional
