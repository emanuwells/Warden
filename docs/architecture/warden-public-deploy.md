# Warden — publicação e ambiente local

## Dois contextos

| Contexto | Onde no repo | URL / destino |
|---|---|---|
| **Local genérico** | `public/www/` + `public/backend/` | `http://127.0.0.1:8080/` — `docker compose up` |
| **Produção (HUB do host)** | `deploy/hub/` | `$WARDEN_HUB_ROOT` — URL definida no reverse proxy |

O repo não obriga um prefixo URL específico em desenvolvimento.

## Local (sem login)

### Snapshots para a UI

| Origem | Comando |
|---|---|
| **Produção (recomendado)** | `.\scripts\sync-prod-snapshots.ps1` — SCP read-only dos JSON em `${WARDEN_RUNTIME_ROOT}/runtime/export/` |
| **Local** | `python -m src.warden --once` + `export_payload.py` (fast/heavy/full) |

```powershell
.\scripts\sync-prod-snapshots.ps1
.\scripts\start-warden-dev.ps1
```

Variáveis no Docker PHP:

- `WARDEN_DEV_SKIP_AUTH=1` — API sem sessão do host
- `WARDEN_*_SOURCE_PATH` — ficheiros em `/warden-exports` (volume `runtime/export`)

Frontend: `data-warden-dev="1"` + `dev-auth-stub.js`.

## Produção (HUB do host)

```powershell
.\scripts\import-public-from-prod.ps1
.\scripts\publish-public.ps1 -DryRun
```

**Não** altera o pipeline em `$WARDEN_RUNTIME_ROOT` até pedido explícito.

## Snapshots na API

Ordem de resolução em `api.php`: `warden-paths.local.php` (deploy) → env `WARDEN_*_SOURCE_PATH` → `$WARDEN_RUNTIME_ROOT/runtime/export/` → ficheiros ao lado do payload.

No HUB de produção, copiar `warden-paths.local.php.example` para `warden-paths.local.php` com os paths reais do runtime (não versionar o `.local.php`).
