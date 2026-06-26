# Política de Raiz Limpa

## Objetivo

Manter a raiz do repositório o mais limpa possível, preservando apenas ficheiros e pastas que um programador sénior esperaria encontrar num projeto profissional.

## Permitido na raiz

- `README.md`, `AGENTS.md`, `PROJECT_CONTEXT.md`, `COMMANDS.md`, `CHANGELOG.md`
- `VERSION`, `LICENSE`, `requirements.txt`
- `.gitattributes`, `.gitignore`
- `.github/`, `docs/`, `tasks/`, `scripts/`, `tools/`
- pastas do produto: `src/`, `public/`, `docker/`, `deploy/`, `runtime/`, `secrets/`

## Fora da raiz

- `docs/resources/templates/.env.example` — template de variáveis de ambiente
- `docs/resources/templates/.gitignore.template` — template de `.gitignore`
- `docker/compose.dev.yml`, `docker/.dockerignore` — stack Docker
- `docs/governance/CONTRIBUTING.md`, `.github/SECURITY.md`

## Evitar na raiz

- `.env.example`, `docker-compose.yml`, `warden.py`, `.dockerignore`, `warden-legacy-entry.py`
- adaptadores IA activos (`.cursor/`, `CLAUDE.md`, …)
- documentação longa, dumps, logs, caches

## Adaptadores

Ficam em `tools/ai-adapters/`; activar só quando necessário.
