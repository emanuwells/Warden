# public/

Estrutura local (desenvolvimento Docker em `http://127.0.0.1:8080/`):

| Pasta | Função |
|---|---|
| [`www/`](www/) | Web root: `index.html`, `warden.js`, `api.php` (entrada HTTP) |
| [`backend/`](backend/) | API canónica (`apps/warden/api.php`) e auth MAIATRON (`core/shared/`) |

Produção (MAIATRON-HUB): ver [`deploy/hub/`](../deploy/hub/) e [`docs/Warden_Public_Deploy.md`](../docs/Warden_Public_Deploy.md).
