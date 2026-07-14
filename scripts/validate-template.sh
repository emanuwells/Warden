#!/usr/bin/env bash
# Valida a estrutura essencial do repositório Warden (alinhada com Repo template).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

fail() {
  echo "ERRO: $1" >&2
  exit 1
}

require_file() {
  [[ -f "$1" ]] || fail "Ficheiro obrigatório ausente: $1"
}

require_dir() {
  [[ -d "$1" ]] || fail "Pasta obrigatória ausente: $1"
}

for f in \
  AGENTS.md README.md COMMANDS.md CHANGELOG.md VERSION LICENSE \
  .gitattributes .gitignore PROJECT_CONTEXT.md src/requirements.txt \
  .github/SECURITY.md docs/governance/CONTRIBUTING.md \
  docs/ROOT_STRUCTURE.md \
  docs/resources/README.md \
  docs/resources/templates/PROJECT_CONTEXT.template.md \
  docs/resources/templates/.gitignore.template \
  docs/resources/templates/.env.example \
  docs/resources/examples/secrets/README.md \
  docker/compose.dev.yml docker/.dockerignore \
  docs/ai/DAILY_AGENT_WORKFLOW.md \
  docs/ai/policies/CONTEXT_BUDGET_POLICY.md \
  docs/ai/policies/SECRETS_POLICY.md \
  docs/ai/ops/HANDOFF.md \
  docs/ai/ops/RUNBOOK.md \
  docs/architecture/overview.md \
  docs/architecture/deployment.md \
  deploy/systemd/warden.service; do
  require_file "$f"
done

for d in \
  .github docs docs/ai docs/architecture docs/adr docs/governance \
  docs/resources docs/resources/templates docs/resources/examples \
  docs/resources/examples/secrets docs/resources/examples/config \
  tasks scripts tools tools/ai-adapters \
  src public docker deploy deploy/systemd runtime secrets; do
  require_dir "$d"
done

for p in \
  CONTRIBUTING.md SECURITY.md PROJECT_CONTEXT.template.md \
  .gitignore.template .env.example docker-compose.yml warden.py .dockerignore .agents; do
  [[ ! -e "$p" ]] || fail "Item não deve estar na raiz: $p"
done

for p in docs/templates config systemd; do
  [[ ! -e "$p" ]] || fail "Pasta obsoleta não deve existir: $p"
done

for p in .cursor .claude .codex .devin .vscode .cursorrules .windsurfrules CLAUDE.md GEMINI.md; do
  [[ ! -e "$p" ]] || fail "Adaptador ativo na raiz por defeito: $p"
done

[[ ! -f ".github/copilot-instructions.md" ]] || fail "Adaptador Copilot ativo na raiz por defeito."

AGENTS_LINES="$(wc -l < AGENTS.md | tr -d ' ')"
if [[ "$AGENTS_LINES" -gt 220 ]]; then
  fail "AGENTS.md demasiado longo: ${AGENTS_LINES} linhas. Objetivo: <= 220."
fi

VERSION_VALUE="$(tr -d '\n\r ' < VERSION)"
[[ "$VERSION_VALUE" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "VERSION não usa SemVer: $VERSION_VALUE"

echo "Estrutura válida. Versão: $VERSION_VALUE. AGENTS.md: ${AGENTS_LINES} linhas."
