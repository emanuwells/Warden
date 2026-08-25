# WELLS — runtime universal dos agentes

Contrato canónico, invocado por `Lê .agents/AGENTS.md e <tarefa>.` ou adaptador
pessoal. Toda a fonte versionada de IA vive em `.agents/`.

## Regra inicial

1. Identifica ficheiros, símbolos, dados e outputs diretamente envolvidos.
2. Começa pelos caminhos mencionados; não explores o repositório inteiro.
3. Expande apenas um nível de dependências de cada vez.
4. Carrega recursos WELLS apenas quando forem materialmente úteis.

## Autoridade

1. Segurança, plataforma e lei.
2. Pedido explícito atual.
3. Este contrato e políticas selecionadas.
4. Contexto e documentação aplicáveis.
5. Código, testes, configuração e comportamento real.

Código e resultados executados prevalecem sobre documentação desatualizada. Não
inventes comandos, APIs, arquitetura, compatibilidade, testes ou resultados.

## Runtime canónico

Em projetos que consomem WELLS, `.agents/AGENTS.md`, `.agents/INDEX.md` e
`.agents/manifest.json` são geridos exclusivamente pelo Toolkit: não os edites para
personalização do projeto. Usa `PROJECT_CONTEXT.md`, `COMMANDS.md`, estado ou
extensões. Em conflito Git nestes três ficheiros, preserva a versão WELLS atual e
transporta apenas informação de projeto útil para o local apropriado.

## Contexto em duas camadas

- **CORE:** este ficheiro + pedido + ficheiros diretamente envolvidos.
- **ON-DEMAND:** INDEX, workflow, skills, roles, policies, estado e integrações apenas quando alteram a decisão.
- `.agents/evals/` nunca é carregado durante execução normal; serve apenas para comparar agentes/modelos.

## Routing seletivo

- **Alteração trivial:** ficheiros indicados, imports diretos e teste relacionado; sem INDEX ou skill.
- **Contexto:** ler só a secção necessária de `PROJECT_CONTEXT.md`.
- **Comandos:** consultar só a entrada relevante de `COMMANDS.md` antes de executar.
- **Continuação:** TODO e HANDOFF; LESSONS apenas para evitar erro conhecido.
- **Tarefa não trivial:** INDEX, um workflow e por defeito até duas skills por fase.
- **Multiárea/produção/segurança/migração/arquitetura:** ORCHESTRATOR e recursos selecionados.
- **Escolha/fallback de modelo:** `MODEL_ROUTING.md`; começar pelo nível mais económico que mantenha qualidade verificável.
- **Conhecimento durável:** política do grafo e workflow de ingestão; consultar o grafo antes de pesquisar extensivamente.
- **API/library externa variável:** confirmar versão local e usar `context7-current-docs` apenas para documentação pública necessária.
- **Release/segurança/auth/infra/dependências:** selecionar `security-quality-gate`; scanners ausentes significam cobertura incompleta, nunca sucesso implícito.
- **GitHub Actions/CI/Dependabot/rulesets:** usar `60-github-automation.md` e `GITHUB_AUTOMATION_POLICY.md`; gerar por deteção, nunca sobrescrever workflow externo.

Skills usam progressive disclosure: decidir por nome/descrição e abrir o corpo apenas
quando ativadas. Integrações externas não entram no contexto salvo seleção explícita.

## Contexto e output

- Aplicar sempre `OUTPUT_EFFICIENCY.md`: solução mínima correta, Headroom para outputs extensos e Ponytail para evitar complexidade e prosa desnecessárias.
- Em documentação e prosa, aplicar automaticamente `WRITING_QUALITY.md`, Humanizer e Stop-the-Slop numa única passagem.
- Preservar erros, evidência, segurança, comandos, contratos e secções obrigatórias.
- Quando existir `graphify-out/graph.json`, consultar uma subquery do grafo antes de grep/leitura ampla; confirmar inferências críticas no código.
- Em frontend, seguir `FRONTEND_DESIGN_POLICY.md`; separar direção, implementação e auditoria para não acumular skills.

## Integração

- Qualquer agente: `Lê .agents/AGENTS.md e <tarefa>.`
- Claude Code: adaptador pessoal fornece `/wells*`, output profiles, guards e hooks sem criar `.claude/` no projeto.
- Quota/provider: seguir perfis `free → economical → premium`; OmniRoute pode mudar modelo/provider, enquanto mudança entre agentes exige HANDOFF WELLS.
- Funcionalidades de fornecedor são opcionais; a lógica universal não depende delas.

## Execução segura

Preserva alterações, verifica Git, faz alterações mínimas e reversíveis e não mistura
feature, limpeza e refactor sem necessidade. Não introduzas dependências, apagues dados,
exponhas segredos, faças push ou alteres produção sem autorização proporcional. Para
operações destrutivas, apresenta impacto e rollback. Nunca declares validações não executadas.

## Fecho

Em trabalho não trivial, atualiza apenas estado útil. Promove para o grafo apenas
conhecimento durável e com proveniência. Numa alteração trivial concluída, não atualizes
estado nem documentação. Antes de terminar, se alteraste ficheiros, corre `node .agents/tools/wells-finalize.mjs --project . --changed --apply`; é determinístico, não chama LLMs e só aplica higiene textual segura. Depois revê o diff e executa a validação mínima sobre o estado final. Comunica resultado, ficheiros, validações, limitações e próximo passo apenas se existir.
