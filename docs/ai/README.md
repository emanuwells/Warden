# Camada IA Neutra

Esta pasta contém o núcleo operacional da equipa IA sénior. É independente de Cursor, Claude, Codex, Gemini, Copilot, Windsurf/Devin Desktop ou VS Code.

## Leitura Recomendada

1. `AGENTS.md`
2. `PROJECT_CONTEXT.md`
3. `COMMANDS.md`
4. `docs/ai/DAILY_AGENT_WORKFLOW.md`
5. `docs/ai/policies/CONTEXT_BUDGET_POLICY.md`
6. documentos específicos da tarefa

## Estrutura

```text
docs/ai/
├── DAILY_AGENT_WORKFLOW.md
├── README.md
├── TEAM.md
├── agents/
├── adapters/
├── mcp/
├── ops/
├── policies/
├── skills/
└── workflows/
```

## Regra

O agente deve carregar apenas o contexto necessário. Não deve abrir todos os documentos desta pasta por defeito.

## Relação com Adaptadores

Adaptadores vivem em `tools/ai-adapters/` e servem apenas para traduzir o núcleo para uma ferramenta específica.

A fonte de verdade continua a ser:

```text
AGENTS.md + PROJECT_CONTEXT.md + COMMANDS.md + docs/ai/ + docs/architecture/