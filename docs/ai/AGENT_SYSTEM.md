# `docs/ai/`

Camada operacional neutra para qualquer IA que trabalhe neste repositório.

Esta pasta é independente do IDE. Deve funcionar com Cursor, Claude Code, Codex, Gemini CLI, GitHub Copilot, VS Code, Windsurf/Devin Desktop ou outras ferramentas.

## Função

`docs/ai/` contém:

- políticas permanentes;
- critérios de qualidade;
- regras de segurança;
- fluxos de operação;
- orquestração de papéis, workflows e skills;
- skills reutilizáveis;
- documentação MCP segura;
- evidência e handoff.

## Estrutura

```text
docs/ai/
├── DAILY_AGENT_WORKFLOW.md
├── ORCHESTRATION.md
├── workflows/       # intake, feature, bugfix, review, release e goal-seeking
├── policies/        # regras permanentes
├── ops/             # operação, DoD, evidência, testing, handoff
├── skills/          # capacidades reutilizáveis neutras
└── mcp/             # política e exemplos seguros de MCP
```

## Relação com adaptadores

- `docs/ai/` define papéis e workflows neutros.
- `.cursor/`, `.claude/`, `.codex/`, `.devin/`, `.vscode/`, `GEMINI.md`, `CLAUDE.md`, `.windsurfrules` e `.github/copilot-instructions.md` são adaptadores.
- Em caso de conflito, aplicar a `Hierarquia de Autoridade` definida em `AGENTS.md`.
- Para confirmar o estado técnico real, usar as `Fontes de Verdade do Projeto` definidas em `AGENTS.md`.
