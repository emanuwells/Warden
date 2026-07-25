# Sistema WELLS para agentes

`.agents/` é a única camada específica de IA do repositório e é independente de
IDE, modelo ou fornecedor.

```text
.agents/
├── AGENTS.md        # entrada universal e orçamento de contexto
├── INDEX.md         # routing por tipo de tarefa
├── core/            # orchestrator e modelo operacional
├── state/           # TODO, HANDOFF, LESSONS, DECISIONS e EVIDENCE
├── skills/          # capacidades especializadas, lidas seletivamente
├── workflows/       # processos por tipo de tarefa
├── roles/           # responsabilidades sénior
├── policies/        # regras normativas
├── ops/             # quality gates, testes, handoff e runbook
├── mcp/             # política, servidores e exemplos MCP
├── adapters/        # apontadores curtos por ferramenta
├── handoffs/        # orientação para continuidade
├── templates/       # modelos reutilizáveis
└── tools/           # validação local do sistema
```

Os adaptadores não duplicam instruções. Qualquer agente capaz de ler ficheiros
pode trabalhar no projeto após receber: `Lê .agents/AGENTS.md e <tarefa>`.
