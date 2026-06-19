# HANDOFF

## Metadados

| Campo | Valor |
|---|---|
| Última atualização | 2026-06-19 |
| Objetivo actual | Pipeline Fase 2 — export fast no collector |
| Estado | Alinhado — local, origin e produção em `e894e03` |
| Última versão registada | 2.1.0 (`VERSION`) |

## Pipeline Fase 2 (2026-06-19)

| Item | Estado |
|---|---|
| Hook collector `export_fast_snapshot_after_collect` | Em produção |
| `EXPORT_FAST_ON_COLLECT=1` (default) | Activo |
| Cron fast 30×/min → fallback 1×/min | Migrado em prod |
| `scripts/export_fast_fallback.sh` | Instalado |
| `scripts/patch-crontab-phase2-fast.sh` | Executado em prod |

### Validação produção pós-Fase 2

```text
validate-pipeline.sh: PASS
  fast idade=8s (limite 12s = COLLECT_INTERVAL 2 + 10)
  heavy=191s, full=190s
  warden: active
crontab: 1 linha # warden:export_fast_fallback
```

### Rollback rápido

1. `EXPORT_FAST_ON_COLLECT=0` em `.env` + `systemctl restart warden`
2. Repor cron fast 30×/min (git history `crontab.example` pré-`e894e03`)

## Pipeline Fase 1

Ver `docs/Warden_Pipeline.md`. Intervalos: heavy `*/5`, full `*/15`, stale fast 12s.

## Host hygiene (2026-06-19)

| Item | Valor |
|---|---|
| Script | `scripts/host-hygiene.sh` → `/usr/local/sbin/warden-host-hygiene` |
| Cron | `30 1 * * *` — `# overseer:host_hygiene` |
| Disco | 82G/98G (88%) após limpezas |

## Produção (Warden)

- Pipeline: `/home/eferreira/MAIATRON/Warden`
- HUB: `/usr/share/nginx/html/MAIATRON-HUB`
- `COLLECT_INTERVAL=2` (prod)
- Serviço `warden`: active

## Próximo passo

1. Monitorizar idade do fast snapshot nas próximas 24h.
2. Disco: ganhos reais em backups NGINX/DB e MySQL grandes.

## Skills / MCP (esta entrega)

- Skills: `quality-gate-runner`, `backend-architecture`, `ssh-server-ops`
- MCP: N/A
