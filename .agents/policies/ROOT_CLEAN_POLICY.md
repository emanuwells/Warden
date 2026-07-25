
# Política de raiz limpa

A raiz contém apenas documentação profissional, configuração real e pastas
do produto. Todo o conteúdo específico de IA vive em `.agents/`.

## Permitido

- `README.md`, `PROJECT_CONTEXT.md`, `COMMANDS.md`, `CHANGELOG.md`
- `CONTRIBUTING.md`, `SECURITY.md`, `VERSION`, `LICENSE`
- `.gitignore`, `.gitattributes`, `.github/`, `docs/`
- pastas reais como `src/`, `api/`, `frontend/`, `backend/`, `tests/`, `scripts/`
- `.agents/` como única pasta do sistema IA

## Evitar

- `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` ou regras IA na raiz
- `.ai/`, `.claude/`, `.codex/`, `.cursor/` e `docs/ai/`
- templates, caches, dumps, logs e pastas preventivas sem utilização
- documentação duplicada entre raiz, `docs/` e `.agents/`
