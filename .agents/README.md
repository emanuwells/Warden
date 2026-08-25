# `.agents/`

Fonte única WELLS, independente de IDE e fornecedor.

- `AGENTS.md`: contrato universal e ponto de entrada.
- `INDEX.md`: routing seletivo.
- `knowledge/`: conhecimento curado, proveniência, índice, log e grafo.
- `integrations/`: catálogo, perfis de risco e receitas externas.
- `core/`: orquestração de tarefas complexas.
- `state/`: continuidade temporária entre sessões.
- `skills/`, `workflows/`, `roles/`, `policies/`: biblioteca sob necessidade.
- `ops/`: quality gates, testes, evidência e handoff.
- `mcp/`: política e exemplos MCP.
- `extensions/`: hooks/plugins próprios, desativados por defeito.
- `adapters/`: integrações opcionais, incluindo plugin pessoal Claude Code.
- `tools/`: CLI, validador, Headroom e módulos do grafo.

Prompt universal: `Lê .agents/AGENTS.md e <tarefa>.`.
