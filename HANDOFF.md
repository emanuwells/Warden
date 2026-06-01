# HANDOFF

## Metadados

| Campo | Valor |
|---|---|
| Última atualização | 2026-06-01 |
| Objetivo atual | Warden genérico em `public/www/`; produção via `deploy/hub/` |
| Estado | Dev local sem login; UI em `http://127.0.0.1:8080/` |
| Última versão registada | 2.1.0 (`VERSION`) |

## Local genérico (Docker)

| Item | Valor |
|---|---|
| URL UI | `http://127.0.0.1:8080/` |
| URL API | `http://127.0.0.1:8080/api.php` |
| Login | Desligado (`WARDEN_DEV_SKIP_AUTH`, `dev-auth-stub.js`, `data-warden-dev`) |
| Snapshots | `runtime/export/` — sync SCP de prod ou pipeline local |

```powershell
.\scripts\sync-prod-snapshots.ps1   # JSON reais de BAZE2 (read-only)
.\scripts\start-warden-dev.ps1
```

## Produção BAZE

- Pipeline: `/home/eferreira/MAIATRON/Warden` (inalterado)
- HUB: `/usr/share/nginx/html/MAIATRON-HUB` — publicar só `deploy/hub/` com `publish-public.ps1`

## Próximo passo

1. `sync-prod-snapshots.ps1` + validar UI em `http://127.0.0.1:8080/`.
2. `publish-public.ps1` só após validação e OK explícito.

## Skills / MCP (esta entrega)

- Skills: `docker-coolify-deploy`, `documentation-keeper`, `changelog-semver`, `security-secrets-audit`
- MCP: N/A
