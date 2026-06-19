# HANDOFF

## Metadados

| Campo | Valor |
|---|---|
| Última atualização | 2026-06-19 |
| Objetivo actual | Fase 1 pipeline dual snapshot + desenho Fase 2 |
| Estado | Alinhado após validação prod |
| Última versão registada | 2.1.0 (`VERSION`) |

## Pipeline Warden — Fase 1 (2026-06-19)

| Item | Estado |
|---|---|
| Dual snapshot fast/heavy/full | Em produção |
| Cron full `*/15` | Em produção |
| `export_payload.py` logs → stdout | Em produção |
| `publish-public.ps1` chmod pós-scp | Em produção |
| `scripts/validate-pipeline.sh` | Novo — correr após deploy |
| Documentação | `docs/Warden_Pipeline.md`, ADR `0001` |

### Intervalos canónicos

| Componente | Valor |
|---|---|
| `COLLECT_INTERVAL` | 15s |
| Export fast | ~2s (30×/min cron) |
| Export heavy | */5 |
| Export full | */15 |
| `WARDEN_FAST_STALE_MS` | 12000 |

### Fase 2 (planeada, não implementada)

- Collector invoca export fast após cada insert.
- Cron fast reduzido a fallback 1×/min.
- Ver `docs/Warden_Pipeline.md` e ADR `0001`.

## Host hygiene (2026-06-19)

| Item | Valor |
|---|---|
| Script | `scripts/host-hygiene.sh` → `/usr/local/sbin/warden-host-hygiene` |
| Sudoers | `/etc/sudoers.d/warden-host-hygiene` (NOPASSWD) |
| Cron | `30 1 * * *` — `# overseer:host_hygiene` |
| Retenção `.bak` | 1 cópia mais recente por diretório |
| Backups NGINX/DB | **Intocados** (retenção 3 dias existente) |

### Execução manual 2026-06-19

| Métrica | Antes | Depois |
|---|---|---|
| `df -h /` uso | 83G / 98G (89%) | 82G / 98G (88%) |
| Espaço livre | 11G | 12G |

- Warden Clean: **8508 linhas** apagadas (>7 dias); Docker ~97 MB.
- API `ops_fast`: HTTP 200 pós-limpeza.

## Produção (Warden)

- Pipeline: `/home/eferreira/MAIATRON/Warden`
- HUB: `/usr/share/nginx/html/MAIATRON-HUB`
- Cron `warden_clean`: `# overseer:warden_clean` (01:00)
- Cron `host_hygiene`: `# overseer:host_hygiene` (01:30)
- Serviço `warden`: active

## Próximo passo

1. Implementar Fase 2 (hook export fast no collector) quando aprovado.
2. Monitorizar disco (backups NGINX/DB e MySQL grandes são o ganho real).
3. Rotacionar password sudo se ainda não foi feito.

## Skills / MCP (esta entrega)

- Skills: `quality-gate-runner`, `professional-documentation`, `ssh-server-ops`
- MCP: N/A
