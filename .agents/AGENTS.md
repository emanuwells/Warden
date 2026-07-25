# WELLS — entrada universal dos agentes

Este é o único ponto de entrada obrigatório para qualquer IA neste repositório.
O objetivo é executar a tarefa com o menor contexto possível, sem perder
segurança, continuidade, qualidade ou documentação.

## Regra inicial

1. Lê apenas este ficheiro.
2. Interpreta o pedido atual e identifica os ficheiros diretamente envolvidos.
3. Não explores todo o repositório nem toda a pasta `.agents/` por defeito.
4. Expande a leitura apenas quando uma dependência, teste ou risco concreto o justificar.

## Autoridade

1. Segurança, instruções da plataforma e lei aplicável.
2. Pedido explícito atual do utilizador.
3. Este contrato e as políticas WELLS aplicáveis.
4. `PROJECT_CONTEXT.md`, `COMMANDS.md` e documentação técnica.
5. Código, testes, configuração e convenções reais do projeto.

Código e resultados reais prevalecem sobre documentação desatualizada. Não
inventes comandos, funcionalidades, testes, arquitetura ou resultados.

## Routing seletivo

- **Alteração pequena e localizada:** lê apenas os ficheiros indicados, imports
  diretos e teste relacionado. Não carregues orchestrator, workflow ou skills.
- **Código ou arquitetura sem contexto suficiente:** lê `PROJECT_CONTEXT.md`.
- **Executar, testar, compilar ou publicar:** lê apenas a secção necessária de
  `COMMANDS.md` imediatamente antes da execução.
- **Continuar trabalho anterior:** lê `.agents/state/TODO.md` e
  `.agents/state/HANDOFF.md`; consulta `.agents/state/LESSONS.md` apenas se houver
  risco de repetir um problema.
- **Tarefa normal de feature, bug, refactor, revisão, dados ou operações:** lê
  `.agents/INDEX.md`, seleciona um workflow primário e, por defeito, no máximo
  duas skills diretamente úteis.
- **Tarefa multiárea, risco médio/alto, migração, segurança, produção ou decisão
  arquitetural:** lê `.agents/core/ORCHESTRATOR.md` e apenas as políticas, papéis
  e skills que este selecionar.

## Orçamento de contexto

- Começa pelos caminhos mencionados no pedido e pesquisa por símbolos concretos.
- Abre ficheiros completos apenas quando necessário; prefere secções relevantes.
- Expande um nível de dependências de cada vez.
- Não carregues todas as skills, workflows, papéis, políticas, histórico Git ou
  documentação por conveniência.
- Não dupliques instruções nem cries conteúdo de IA fora de `.agents/`.
- Se o contexto crescer sem melhorar a decisão, resume o estado útil e reduz o escopo.

## Execução segura

- Preserva alterações existentes e verifica o estado Git quando possível.
- Faz alterações mínimas, focadas, reversíveis e compatíveis com o pedido.
- Não mistures limpeza, refactor e novas funcionalidades sem necessidade declarada.
- Não introduzas dependências, apagues dados, exponhas segredos ou alteres produção
  sem justificação e confirmação proporcionais ao risco.
- Nunca declares lint, testes, build ou deploy que não executaste.

## Continuidade e fecho

Para tarefas não triviais ou inacabadas, atualiza:

- `.agents/state/TODO.md` — estado e próximos passos;
- `.agents/state/HANDOFF.md` — ponto exato para outro agente continuar;
- `.agents/state/EVIDENCE.md` — validações realmente executadas;
- `.agents/state/LESSONS.md` e `.agents/state/DECISIONS.md` — apenas quando surgir
  aprendizagem reutilizável ou decisão permanente;
- `CHANGELOG.md` — apenas para alterações versionáveis.

Numa alteração trivial concluída, não atualizes ficheiros de estado sem utilidade.
Antes de terminar, revê o diff, executa a validação mínima relevante e comunica
resumo, ficheiros alterados, validações, limitações e próximo passo, se existir.
