# Política de raiz limpa

A raiz contém apenas documentação profissional, configuração real e pastas do
produto. A fonte WELLS versionada vive integralmente em `.agents/`.

## Permitido

- `README.md`, `PROJECT_CONTEXT.md`, `COMMANDS.md`, `CHANGELOG.md`
- `CONTRIBUTING.md`, `SECURITY.md`, `VERSION`, `LICENSE`
- `.gitignore`, `.gitattributes`, `.github/`, `docs/`
- pastas reais como `src/`, `api/`, `frontend/`, `backend/`, `tests/`, `scripts/`
- `.agents/` como única pasta obrigatória do sistema WELLS

## Não criado pelo Toolkit

- `AGENTS.md`, `CLAUDE.md` ou `GEMINI.md` na raiz
- `.claude/`, `.codex/`, `.cursor/` ou `.gemini/` no projeto

Configurações nativas preexistentes de uma ferramenta não são apagadas
automaticamente: são preservadas e comunicadas durante a migração.

## Evitar

- `.ai/`, `docs/ai/` e adapters duplicados fora de `.agents/`
- caches, dumps, logs e pastas preventivas sem utilização
- documentação repetida entre raiz, `docs/` e `.agents/`
