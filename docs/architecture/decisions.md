# Decisões Técnicas — Warden

Resumo vivo das decisões arquiteturais principais. Para decisões relevantes, criar ADR em `docs/adr/` e referenciar aqui.

| Data | Decisão | Motivo | ADR |
|---|---|---|---|
| 2026-03-10 | `public/` como fatia publicável no HUB do host | Deploy isolado da UI/API | N/A |
| 2026-03-10 | Pipeline configurável via `WARDEN_RUNTIME_ROOT` | Separar runtime do path físico do deploy | N/A |
| 2026-03-10 | `docker/compose.pipeline.yml` separado do web | Evitar confundir collector com stack PHP | N/A |
| 2026-06-01 | Snapshots JSON em `runtime/export/` | Interface agnóstica com API PHP consumidora | N/A |
| 2026-06-01 | `warden_clean` como único contrato de limpeza | Centralizar housekeeping no Overseer | N/A |
| 2026-06-19 | Documentação e envs agnósticos de plataforma | Warden consumível por qualquer frontend | N/A |
| 2026-06-19 | Pipeline dual snapshot fast/heavy/full (Fase 1) | Near-real-time sem WebSocket; Fase 2 planeada | [0001](../adr/0001-warden-dual-snapshot-pipeline.md) |

## Regras

- Decisões reversíveis podem ficar neste ficheiro.
- Decisões estruturais, caras ou difíceis de reverter devem ter ADR.
- Não apagar decisões antigas; marcar como substituídas quando aplicável.
