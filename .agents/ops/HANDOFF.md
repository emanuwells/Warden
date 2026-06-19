# HANDOFF

## Metadados

| Campo | Valor |
|---|---|
| Última atualização | 2026-06-19 |
| Objetivo actual | Snapshot fast ~2s (modelo Task Manager) |
| Estado | Alinhado — local, origin e produção em `9d5276a` |
| Última versão registada | 2.1.0 (`VERSION`) |

## Task Manager cadence (2026-06-19)

| Lane | Intervalo | Estado prod |
|---|---|---|
| Collector | 2s | active (restart pendente sudo para código novo) |
| Cron fast 2s | 30×/min | restaurado (`# warden:export_fast_2s`) |
| Ops Center poll | 1.2s | HUB `ops-center.js` (já configurado) |
| Export fast | <0.2s | `cache_only` — sem force em process tops |

### Causa do "há 52s"

Fase 2 bloqueava o collector com export fast (~12s cache fria) e cron reduzido a 1×/min. Corrigido: lanes separadas como Task Manager.

### Validação prod pós-fix

```text
validate-pipeline.sh: PASS — fast idade=1s (limite 7s)
export --mode fast: 0.188s (cache_only)
```

### Pendente

- `sudo systemctl restart warden` em prod (código sem export inline bloqueante).

## Produção

- Pipeline: `/home/eferreira/MAIATRON/Warden`
- HUB: `/usr/share/nginx/html/MAIATRON-HUB`
- `COLLECT_INTERVAL=2`
