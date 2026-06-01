# HANDOFF

## Metadados

| Campo | Valor |
|---|---|
| Última atualização | 2026-06-01 |
| Objetivo atual | Repo alinhado com WELLS_API (`public/` + Docker dev) |
| Estado | `public/` importado; scripts publish/import; d4maia removido do repo |
| Última versão registada | 2.0.7 |
| Bloqueios | Nenhum |

## Objetivo / estado

| Área | Concluído | Por fazer |
|---|---|---|
| `public/` + Docker dev | Import, compose, start-warden-dev, publish-public (dry-run) | Testar `docker compose` no host do utilizador |
| Pipeline produção | Inalterado em `/home/eferreira/MAIATRON/Warden` | Publish `public/` só com OK explícito |
| Disco BAZE2 | ~89% após limpeza + arquivo d4maia (op. passada) | Monitorizar `df` |

## Decisões técnicas

- UI/API versionadas em `public/` (MAIATRON-HUB), não em `/MAIATRON/apps/warden` no filesystem.
- `backend/core/shared/` no repo só para Docker local; não incluir em `publish-public.ps1`.

## Skills usadas

`repo-onboarding`, `documentation-keeper`, `handoff-maintainer`, `changelog-semver`, `docker-coolify-deploy`.

## MCP

N/A — sem MCP versionado no repo.

## Estado Git

Branch: A confirmar. Incluir `public/` após revisão (sem segredos).

## Próximo passo

1. `.\scripts\start-warden-dev.ps1` com snapshots em `runtime/export/`.
2. Quando validado localmente: `.\scripts\publish-public.ps1` (sem `-DryRun`) com aprovação explícita.
3. Definir `LICENSE` se necessário.

## Scripts

```powershell
.\scripts\import-public-from-prod.ps1
.\scripts\start-warden-dev.ps1
.\scripts\publish-public.ps1 -DryRun
.\scripts\run-production-cleanup.ps1
```
