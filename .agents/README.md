# `.agents/`

Sistema WELLS independente de IDE e fornecedor.

- `AGENTS.md`: único ponto de entrada universal.
- `INDEX.md`: routing seletivo.
- `.agents/core/`: orquestração para tarefas complexas.
- `.agents/state/`: continuidade entre sessões e agentes.
- `.agents/skills/`, `.agents/workflows/`, `.agents/roles/`, `.agents/policies/`: biblioteca carregada por necessidade.
- `.agents/ops/`: quality gates, testes, evidência e handoff.
- `.agents/mcp/`: política e exemplos MCP.
- `.agents/adapters/`: instruções específicas mínimas por ferramenta.
- `.agents/templates/`: modelos reutilizáveis.

Prompt universal: `Lê .agents/AGENTS.md e <tarefa>`.
