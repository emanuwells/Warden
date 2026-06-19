# Warden — publicação e ambiente local

## Dois contextos

| Contexto | Onde no repo | URL / destino |
|---|---|---|
| **Local genérico** | `public/www/` + `public/backend/` | `http://127.0.0.1:8080/` — `docker compose up` |
| **Produção BAZE (HUB)** | `deploy/hub/` | `/usr/share/nginx/html/MAIATRON-HUB/...` — URL nginx `/MAIATRON/apps/warden/` |

O repo **não** obriga o path `/MAIATRON/` em desenvolvimento. Esse prefixo existe no HUB em produção.

## Local (sem login)

### Snapshots para a UI

| Origem | Comando |
|---|---|
| **Produção (recomendado)** | `.\scripts\sync-prod-snapshots.ps1` — SCP read-only dos JSON já em `${WARDEN_RUNTIME_ROOT}/runtime/export/` |
| **Local** | `python -m src.warden --once` + `export_payload.py` (fast/heavy/full) |

Pré-requisitos para sync de produção (uma vez):

- `secrets/production.deploy.local.env` (copiar de `secrets/production.deploy.local.env.example`)
- `secrets/.ssh/id_ed25519` (gitignored)

```powershell
.\scripts\sync-prod-snapshots.ps1
# opcional: -StartDev para subir o stack dev após o sync
.\scripts\start-warden-dev.ps1
```

Se `scp` falhar com permissões da chave no container, no Windows:

```powershell
icacls secrets\.ssh\id_ed25519 /inheritance:r /grant:r "$($env:USERNAME):(R)"
```

Compose manual:

```powershell
docker compose -f docker/compose.sync.yml build
docker compose -f docker/compose.sync.yml run --rm warden-sync-prod
```

Variáveis no Docker PHP:

- `WARDEN_DEV_SKIP_AUTH=1` — API sem sessão MAIATRON
- `WARDEN_*_SOURCE_PATH` — ficheiros em `/warden-exports` (volume `runtime/export`)

Frontend: `data-warden-dev="1"` + `dev-auth-stub.js` (sem dependências do HUB).

## Produção (MAIATRON-HUB)

Importar do servidor para `deploy/hub/`:

```powershell
.\scripts\import-public-from-prod.ps1
```

Publicar (backup + opt-in):

```powershell
.\scripts\publish-public.ps1 -DryRun
# .\scripts\publish-public.ps1   # só após validação explícita
```

**Não** publica `public/www/` nem altera o pipeline em `/home/eferreira/MAIATRON/Warden`.

## Snapshots na API

Ordem de resolução em `api.php`: env `WARDEN_*_SOURCE_PATH` → paths legados → ficheiros ao lado do payload.

Pipeline: `/home/eferreira/MAIATRON/Warden/runtime/export/`.
