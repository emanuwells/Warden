# GitHub MCP — on-demand e read-only por defeito

Usar o servidor MCP oficial do GitHub quando a tarefa exige contexto de GitHub que não existe localmente: PRs, issues, checks, workflows ou conteúdo remoto.

## Default WELLS

- read-only;
- toolsets mínimos;
- escrita apenas por pedido explícito e depois de rever impacto;
- nunca guardar tokens no repositório.

O servidor oficial suporta read-only e seleção de toolsets. A configuração concreta depende do cliente; manter credenciais fora do projeto e seguir `.agents/mcp/MCP_POLICY.md`.
