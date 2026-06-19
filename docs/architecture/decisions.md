# Decisões Técnicas — Warden

Resumo vivo das decisões arquiteturais principais. Para decisões relevantes, criar ADR em `docs/adr/` e referenciar aqui.

| Data | Decisão | Motivo | ADR |
|---|---|---|---|
| 2026-03-10 | `public/` como fatia Warden do MAIATRON-HUB | Alinhamento com WELLS_API; deploy isolado da UI/API | N/A |
| 2026-03-10 | Pipeline permanece em `/home/eferreira/MAIATRON/Warden` | Não alterar produção até publish explícito do `public/` | N/A |
| 2026-03-10 | `docker/compose.pipeline.yml` separado do web | Evitar confundir collector com stack PHP | N/A |
| 2026-06-01 | Snapshots JSON em `runtime/export/` | Interface com API PHP no MAIATRON-HUB | N/A |
| 2026-06-01 | `warden_clean` como único contrato de limpeza | Centralizar housekeeping no Overseer | N/A |

## Regras

- Decisões reversíveis podem ficar neste ficheiro.
- Decisões estruturais, caras ou difíceis de reverter devem ter ADR.
- Não apagar decisões antigas; marcar como substituídas quando aplicável.
