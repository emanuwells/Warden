# Workflow diário da equipa IA

## 1. Entrada

- Ler `.agents/AGENTS.md`.
- Classificar a tarefa e identificar os primeiros ficheiros.
- Não analisar o repositório inteiro.

## 2. Contexto seletivo

- `PROJECT_CONTEXT.md` apenas quando faltar contexto técnico.
- `COMMANDS.md` apenas antes de executar uma ação.
- TODO/HANDOFF apenas numa continuação.
- `.agents/INDEX.md` apenas quando for necessário escolher workflow ou skill.
- Orchestrator apenas para risco médio ou superior ou trabalho multiárea.

## 3. Execução

- Plano curto quando o risco o justificar.
- Alterações pequenas e focadas.
- Preservar comportamento existente salvo pedido contrário.
- Não introduzir limpeza ou dependências sem relação com o objetivo.

## 4. Validação

Executar apenas os gates relevantes: lint, typecheck, testes, build, smoke test,
validação manual ou revisão do diff. Registar o que foi realmente executado.

## 5. Continuidade

Em trabalho não trivial ou inacabado, atualizar TODO, HANDOFF e EVIDENCE.
Atualizar LESSONS, DECISIONS, README, arquitetura e CHANGELOG apenas quando o
conteúdo real da alteração o justificar.
