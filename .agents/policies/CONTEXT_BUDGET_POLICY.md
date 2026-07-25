# Política de orçamento de contexto

## Princípio

A disponibilidade de muitos ficheiros não autoriza o seu carregamento. O agente
deve obter informação suficiente com o menor contexto que permita decidir com
segurança.

## Núcleo

Apenas `.agents/AGENTS.md` é o ponto de entrada universal.

| Necessidade | Leitura mínima |
|---|---|
| Alteração localizada | ficheiros afetados, dependências diretas e teste relacionado |
| Contexto de produto/arquitetura | secção relevante de `PROJECT_CONTEXT.md` |
| Executar ou validar | secção relevante de `COMMANDS.md` |
| Continuar trabalho | `.agents/state/TODO.md` e `.agents/state/HANDOFF.md` |
| Evitar erro recorrente | secção relevante de `.agents/state/LESSONS.md` |
| Escolher workflow/skill | `.agents/INDEX.md` |
| Coordenar risco/multiárea | `.agents/core/ORCHESTRATOR.md` |

## Limites operacionais

- Um workflow primário por tarefa.
- Até duas skills por defeito.
- Um nível de dependências de cada vez.
- Papéis e políticas apenas quando alteram a decisão ou a validação.
- Não ler histórico, documentação, comandos ou estado sem relação com o pedido.
- Resumir contexto útil antes de abrir uma nova área extensa.

## Sinais de desperdício

Parar e reduzir escopo quando o agente:

- abre ficheiros sem hipótese ou objetivo;
- lê todas as skills/policies para uma alteração local;
- repete contexto já confirmado;
- mistura tarefas não pedidas;
- mantém ficheiros grandes no contexto depois de extrair a informação necessária.
