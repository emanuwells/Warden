# Warden — publicação `public/` (MAIATRON-HUB)

## Contrato em produção (BAZE2)

| Componente | Path no servidor |
|---|---|
| Raiz HUB | `/usr/share/nginx/html/MAIATRON-HUB` |
| Frontend Warden | `frontend/apps/warden/` (`index.html`, `warden.js`, `warden.css`) |
| API canónica | `backend/apps/warden/api.php` |
| Wrapper PHP público | `backend/public/apps/warden/api.php` → delega para a canónica |
| Auth partilhada | `backend/core/shared/maiatron-auth-session.php`, `maiatron-authz.php` |
| Pipeline / snapshots | `/home/eferreira/MAIATRON/Warden/runtime/export/` |

## URLs públicas (nginx)

- UI: `/MAIATRON/apps/warden/` (estáticos em `frontend/`, alias nginx)
- API: `/MAIATRON/apps/warden/api.php?action=ops_fast|ops_heavy|full`

Template nginx: `MAIATRON-HUB/backend/scripts/deploy/nginx-site.conf.template` (location `^/MAIATRON/apps/([^/]+)/api\.php$`).

## Snapshots (API PHP)

A `api.php` resolve paths por ordem:

1. `WARDEN_SOURCE_PATH` / `WARDEN_FAST_SOURCE_PATH` / `WARDEN_HEAVY_SOURCE_PATH`
2. Legacy `MAIATRON_WARDEN_*_SNAPSHOT_PATH`
3. Fallback legado `/opt/maiatron/Warden/runtime/export/*.json`
4. Ficheiros ao lado de `warden_source_path()` no mesmo diretório

Em produção o pipeline em `/home/eferreira/MAIATRON/Warden` alimenta os JSON; o PHP-FPM deve conseguir ler esse path (ou variáveis de ambiente no pool).

## Repo Warden — pasta `public/`

Espelha **apenas a fatia Warden** do HUB (não o repositório HUB completo):

```text
public/
├── frontend/apps/warden/
├── backend/apps/warden/
├── backend/public/apps/warden/
└── backend/core/shared/          # só para Docker local; não publicar com publish-public
```

Importar: `.\scripts\import-public-from-prod.ps1`

Publicar (opt-in): `.\scripts\publish-public.ps1` — backup remoto, validação PHP, sem deploy automático.

## Docker local

- Pipeline: `docker compose -f docker-compose.pipeline.yml up -d --build`
- UI/API: `docker compose -f docker-compose.dev.yml up --build` → `http://127.0.0.1:8080/MAIATRON/apps/warden/`
- Snapshots: montar `./runtime/export` em `/warden-exports` (env no PHP)

Autenticação MAIATRON continua obrigatória na API; smoke local pode devolver HTTP 401 sem sessão — esperado.
