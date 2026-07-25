# MCP

Documentação e exemplos seguros para Model Context Protocol. O projeto continua
independente de MCP, IDE e fornecedor.

```text
.agents/mcp/
├── README.md
├── MCP_POLICY.md
├── mcp.example.json
├── servers/
│   ├── core.md
│   ├── development.md
│   ├── databases.md
│   └── browser-automation.md
└── templates/
    ├── stdio-server.template.json
    └── env.template.json
```

## Utilização

1. Ler `.agents/AGENTS.md`.
2. Consultar `.agents/mcp/MCP_POLICY.md` apenas quando um MCP trouxer valor real.
3. Confirmar na própria ferramenta se existe configuração disponível.
4. Usar permissões e escopo mínimos.
5. Não copiar configurações privadas para o repositório.

Os exemplos são neutros e devem ser adaptados fora do Git. Segredos reais nunca
podem ser colocados em `.agents/mcp/`.
