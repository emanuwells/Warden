# Workflow da Equipa IA Sénior

Este documento descreve como usar a IA como uma equipa sénior full stack sem depender de um IDE específico.

## Núcleo obrigatório

- `AGENTS.md`
- `PROJECT_CONTEXT.md`
- `COMMANDS.md`
- `docs/ai/ORCHESTRATION.md`
- `docs/ai/workflows/GOAL_SEEKING_LOOP.md`, quando houver objetivo verificável
- `docs/ai/`
- `docs/architecture/`

## Fluxo recomendado

1. **Intake** — compreender pedido, risco, escopo e comandos.
2. **Orquestração** — escolher papéis, workflow, skills, sequência e handoff.
3. **Goal-seeking** — definir critérios, validação, limite de iterações e regras de paragem quando o objetivo for verificável.
4. **Plano** — dividir em fases pequenas e reversíveis.
5. **Execução** — alterar uma área de cada vez.
6. **Validação** — correr testes/build/lint ou documentar limitação.
7. **Review** — rever diff, segurança, docs e regressões.
8. **Registo** — atualizar tasks, lessons, changelog e handoff.

## Prompts base

### Análise inicial

```text
Lê AGENTS.md, PROJECT_CONTEXT.md, COMMANDS.md, docs/ai/ORCHESTRATION.md, docs/ai/workflows/GOAL_SEEKING_LOOP.md e docs/architecture/ quando relevante.
Age como equipa sénior full stack.
Não alteres código ainda.
Entrega diagnóstico, riscos, plano por fases e validações.
```

### Execução faseada

```text
Executa apenas a Fase 1.
Preserva comportamento existente.
No fim mostra ficheiros alterados, validações, riscos e próximo passo.
```

### Revisão

```text
Revê o diff atual como QA, Security Reviewer e Code Reviewer.
Classifica problemas por severidade e não declares testes que não executaste.
```
