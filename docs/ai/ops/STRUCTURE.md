# STRUCTURE.md

Estrutura do repositório Warden, alinhada com o template em `docs/ROOT_STRUCTURE.md`.

## Raiz

```text
.
├── AGENTS.md, README.md, PROJECT_CONTEXT.md, COMMANDS.md, CHANGELOG.md
├── VERSION, LICENSE, src/requirements.txt
├── .gitattributes, .gitignore
├── .github/, docs/, tasks/, scripts/, tools/
├── src/                    # Runtime Python (collector, alerts, settings)
├── public/                 # UI/API publicável
├── docker/                 # Dockerfiles, Compose, .dockerignore, nginx
├── deploy/                 # Artefactos de deploy (hub, systemd)
├── runtime/                # Artefactos gerados (gitignored)
└── secrets/                # Segredos reais locais (gitignored)
```

## Documentação e templates

```text
docs/
├── ROOT_STRUCTURE.md
├── architecture/
├── adr/
├── governance/
├── resources/
│   ├── templates/          # .env.example, PROJECT_CONTEXT.template.md, …
│   └── examples/
│       ├── secrets/
│       └── config/
└── ai/
```

## Deploy e Docker

| Path | Função |
|---|---|
| `docker/compose.dev.yml` | UI/API local (:8080) |
| `docker/compose.pipeline.yml` | Collector + scheduler |
| `docker/compose.sync.yml` | Sync snapshots prod → local |
| `docker/.dockerignore` | Exclusões de build |
| `deploy/hub/` | Fatia HUB do host |
| `deploy/systemd/warden.service` | Template systemd |

## Regras

- Raiz sem `.env.example`, `docker-compose.yml`, `warden.py` nem `.dockerignore`.
- Templates em `docs/resources/templates/`; copiar para `.env` na raiz ao configurar.
- CLI canónico: `python -m src.warden` (sem shim na raiz).
