# WELLS — orchestrator

## Finalidade

Coordenar tarefas que envolvem várias áreas, risco relevante ou decisões que
beneficiam de fases, revisão e handoff. Não é necessário para alterações pequenas.

## Entrada mínima

Começa com:

- pedido atual;
- `.agents/AGENTS.md`;
- ficheiros diretamente envolvidos;
- `PROJECT_CONTEXT.md` apenas se faltar contexto técnico;
- `.agents/state/TODO.md` e `.agents/state/HANDOFF.md` apenas quando a tarefa é uma continuação.

Não carregues automaticamente `COMMANDS.md`, todas as policies, roles, skills ou
workflows. Seleciona-os depois de classificar a tarefa.

## Decisão de routing

1. Classifica: feature, bug, refactor, docs, dados, operações, segurança ou revisão.
2. Classifica risco: baixo, médio, alto ou crítico.
3. Escolhe um workflow primário em `.agents/INDEX.md`.
4. Escolhe até duas skills; adiciona outra apenas com motivo explícito.
5. Escolhe os papéis que devem validar, sem simular conversas ou duplicar trabalho.
6. Define validação e rollback proporcionais ao risco.
7. Usa `.agents/workflows/GOAL_SEEKING_LOOP.md` apenas quando existem critérios
   objetivos e é útil iterar.

## Escala de execução

| Risco | Processo mínimo |
|---|---|
| Baixo | alteração focada, validação local e revisão do diff |
| Médio | plano curto, implementação faseada, testes e handoff |
| Alto | plano, rollback, revisão de segurança/dados, confirmação antes de ação irreversível |
| Crítico | não executar ação irreversível sem confirmação explícita e evidência suficiente |

## Plano para risco médio ou superior

Regista apenas:

- objetivo e fora de escopo;
- ficheiros ou módulos prováveis;
- fases pequenas;
- validações por fase;
- riscos, rollback e pontos de confirmação;
- critérios de conclusão.

## Coordenação de papéis

Carrega um ficheiro de `.agents/roles/` apenas quando as responsabilidades desse
papel alterarem a abordagem. Os papéis mais comuns são:

- Architect: fronteiras, dependências e decisões estruturais;
- Engineer do domínio: implementação;
- QA: critérios e regressões;
- Security Reviewer: auth, segredos, input, produção e dependências;
- Code Reviewer: correção, legibilidade e compatibilidade;
- Technical Writer: documentação alterada pelo comportamento real.

## Fecho

Antes de concluir:

1. revê o diff e o escopo;
2. executa validações reais;
3. atualiza TODO e HANDOFF se a tarefa for não trivial ou continuar;
4. regista evidência, decisões, lessons e changelog apenas quando aplicável;
5. comunica o que foi feito, o que foi validado, limitações e próximo passo.
