# Evals WELLS para modelos e agentes

Objetivo: comparar agentes/modelos no trabalho real do utilizador sem benchmarks artificiais.
Os cenários são provider-agnostic e devem ser executados no mesmo repositório/commit, com o
mesmo pedido, ferramentas e limites de tempo/turnos sempre que possível.

## Processo

1. Escolher 3 a 5 tarefas representativas em `tasks/`.
2. Executar cada tarefa numa branch/worktree isolada por agente/modelo.
3. Registar resultado, custo, retries e validações em tabela própria fora do runtime.
4. Aplicar `SCORING.md` com evidência; não pontuar testes que não foram executados.
5. Promover um modelo para `free`, `economical` ou `premium` apenas depois de resultados repetíveis.

Evals não são carregados durante trabalho normal. Servem para decisões periódicas de routing.
