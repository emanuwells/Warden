# Inventário de skills

As 59 skills vivem exclusivamente em `.agents/skills/` e nunca devem ser todas
carregadas por defeito.

| Skill | Finalidade principal |
|---|---|
| `agent-fallback-router` | Escolhe continuidade segura entre perfis free/economical/premium, modelos, providers e agentes quando existe quota, falha, custo ou capacidade insuficiente. |
| `api-contract-guardian` | Protege contratos HTTP/API: rotas, payloads, autenticação, códigos de estado e compatibilidade. Usar ao criar ou alterar endpoints; não usar para mudanças internas sem impacto externo. |
| `awesome-design-md` | Usa DESIGN.md de referência para estabelecer uma linguagem visual concreta sem carregar catálogos inteiros; usar quando o utilizador pede inspiração num produto/brand ou um contrato visual persistente. |
| `backend-architecture` | Define e revê arquitetura backend, serviços, validação, erros, logs e separação de responsabilidades. Usar em mudanças estruturais de backend; não usar para correções locais triviais. |
| `bugfix-diagnostics` | Diagnostica bugs e regressões com evidência, causa raiz, correção mínima e teste de regressão. Usar quando existe comportamento incorreto; não usar para features novas. |
| `cicd-pipeline-guardian` | Cria ou altera pipelines CI/CD, critérios, artefactos, segredos e deploy. Usar para workflows de integração/entrega; não ativar em código comum. |
| `claude-memory-strategy` | Gere memória no Claude sem duplicação: usa o grafo WELLS por defeito e ativa claude-mem apenas em perfil experimental isolado. |
| `code-review` | Revê alterações com foco em bugs reais, regressões, segurança, testes e conformidade, reportando apenas problemas acionáveis e sustentados por evidência. |
| `codeburn-observability` | Mede consumo e padrões de sessões de agentes com CodeBurn sem alterar o routing; usar para auditorias periódicas de tokens e custo. |
| `context7-current-docs` | Consulta documentação atual e específica da versão de bibliotecas/APIs com Context7 antes de implementar quando a correção depende de APIs externas suscetíveis de mudança; não usar para código interno estável. |
| `data-pipeline-reliability` | Desenha e revê pipelines de ingestão, transformação e datasets derivados com idempotência, checkpoints, lineage, qualidade, retries, backfills e sincronização de metadados; usar em ETL/ELT e persistência contínua. |
| `database-migration-safety` | Planeia e valida alterações de schema ou migrações de dados com compatibilidade, backup e rollback. Usar em DDL, backfills e mudanças persistentes; não usar para SELECT isolado. |
| `dependency-manager` | Avalia, adiciona, atualiza ou remove dependências com foco em necessidade, segurança, compatibilidade e lockfiles. Usar quando o grafo de dependências muda. |
| `docker-deploy` | Trabalha com Docker, Compose, imagens, runtime e deploy containerizado. Usar ao criar ou alterar containers; não usar apenas porque o projeto contém Dockerfile. |
| `docs-maintainer` | Atualiza documentação técnica e de utilização após mudanças reais. Usar quando comandos, comportamento, configuração, arquitetura ou API mudam; não alterar docs por rotina. |
| `emil-design-engineering` | Melhora motion, microinterações, transições e feedback de interfaces com critérios de design engineering; usar apenas quando a interação beneficia de movimento. |
| `external-integrations` | Planeia, instala e audita integrações externas WELLS de forma proporcional ao risco, sem ativar automaticamente routing, memória ou serviços persistentes. |
| `feature-delivery` | Entrega uma funcionalidade end-to-end com escopo, implementação mínima, testes e documentação proporcional. Usar em comportamento novo; não usar para bugfix ou refactor puro. |
| `frontend-accessibility-wcag` | Revê e implementa acessibilidade em interfaces web: semântica, teclado, foco, contraste, formulários e ARIA. Usar em UI/UX; não usar em backend. |
| `frontend-api-integration` | Integra frontend com APIs, incluindo tipagem, estados de loading/erro, cache, autenticação e cancelamento. Usar quando UI consome serviços externos. |
| `frontend-component-architecture` | Estrutura componentes frontend, estado, composição e fronteiras de responsabilidade. Usar em componentes novos ou refactors de UI significativos. |
| `frontend-design-direction` | Define direção visual distinta e adequada ao produto antes da implementação; usar em páginas, componentes, aplicações e dashboards que precisam de desenho deliberado. |
| `frontend-performance-web-vitals` | Diagnostica performance web e Core Web Vitals, bundles, rendering, imagens e rede. Usar perante lentidão medida ou requisito explícito de performance. |
| `frontend-skill-orchestrator` | Seleciona por fase até duas skills técnicas, visuais ou de verificação para tarefas web sem carregar toda a biblioteca frontend. |
| `frontend-testing-user-behaviour` | Escreve testes frontend orientados ao comportamento do utilizador e regressões reais. Usar para componentes, hooks e fluxos UI. |
| `fullstack-delivery` | Coordena alterações que atravessam frontend, backend, API e dados. Usar apenas quando a funcionalidade cruza várias camadas. |
| `graphify` | Usa um grafo estrutural do código para responder a perguntas de arquitetura e dependências antes de pesquisar extensivamente ficheiros brutos. |
| `headroom` | Reduz contexto e output quando logs, JSON, pesquisas, código ou histórico são extensos, preservando erros e informação recuperável. |
| `human-naming-veteran` | Melhora nomes de variáveis, funções, classes, campos e conceitos para refletirem domínio e intenção. Usar em naming ambíguo; não renomear por preferência estética. |
| `humanizer` | Melhora automaticamente documentação e prosa, removendo padrões artificiais sem alterar factos, terminologia ou voz adequada ao contexto. |
| `image-to-code` | Converte screenshot, mockup ou referência visual em frontend fiel por pipeline imagem → análise → implementação → comparação; usar quando existe uma referência visual concreta. |
| `impeccable-ui` | Aplica uma linguagem de design e auditoria visual estruturada a aplicações, dashboards e páginas; usar para criar, criticar ou polir UI por passes limitados. |
| `knowledge-graph-maintainer` | Cria, atualiza, relaciona e valida conhecimento durável em `.agents/knowledge/`, com proveniência e sem duplicar o código. |
| `mcp-server-operator` | Seleciona, configura e audita servidores MCP com permissões mínimas. Usar quando a tarefa exige ferramentas/contexto externo; não instalar MCP por conveniência. |
| `obsidian-knowledge` | Trabalha com vaults Obsidian, wikilinks, propriedades, Bases e JSON Canvas apenas quando o projeto contém `.obsidian/` ou o utilizador pede integração Obsidian. |
| `php-rest-api` | Desenvolve APIs REST em PHP com validação, autenticação, acesso a dados e respostas consistentes. Usar em backend PHP ou endpoints HTTP PHP. |
| `playwright-cli` | Usa o Playwright CLI oficial para coding agents em smoke tests, inspeção visual, screenshots, consola e validação de fluxos web com baixo custo de contexto. |
| `ponytail` | Aplica automaticamente a solução mais simples que satisfaz os requisitos, minimiza diffs, dependências, ficheiros e explicações desnecessárias. |
| `powerquery-powerbi` | Trabalha com Power Query M, DAX, modelação Power BI e qualidade de dados. Usar em queries, medidas, relações ou preparação de dados para BI. |
| `production-incident-diagnostics` | Coordena diagnóstico de incidentes e degradações em produção por evidência, do sintoma à aplicação, rede, proxy, containers, sistema e base de dados, preservando segurança, rollback e timeline. |
| `professional-documentation` | Cria documentação profissional completa e factual: README, relatórios, arquitetura, manuais e propostas. Usar quando o output principal é documentação. |
| `public-data-metadata` | Modela metadados e APIs de dados públicos: proveniência, licenças, contactos, datas, GeoJSON e interoperabilidade. Usar em datasets municipais ou portais open data. |
| `quality-gate-runner` | Executa os critérios mínimos de qualidade adequados ao risco: lint, typecheck, testes, build, diff e segurança. Usar no fecho de tarefas não triviais. |
| `quality-review` | Revê diffs ou implementação com foco em bugs, regressões, segurança, contratos, testes e documentação. Usar para revisão independente; não alterar código sem pedido. |
| `react-vite-typescript` | Implementa e revê aplicações React com Vite e TypeScript, incluindo componentes, hooks, routing, estado e build. Usar quando esta stack estiver presente. |
| `remove-ai-marks` | Trata operações adicionais e explícitas de limpeza de marcas/metadata em conteúdo próprio ou autorizado; a higiene invisível segura já é automática via OUTPUT_HYGIENE_POLICY e não requer esta skill. |
| `repo-hygiene` | Audita estrutura e remove ficheiros temporários, duplicados ou obsoletos com prova de não utilização. Usar em limpeza explícita; não misturar com feature/bugfix. |
| `repo-onboarding` | Mapeia rapidamente um repositório desconhecido: stack, entrypoints, comandos, arquitetura e riscos. Usar antes de alterações não triviais sem contexto suficiente. |
| `safe-refactor` | Executa refactors e reorganizações preservando comportamento, com fases, testes e rollback. Usar para mudanças estruturais; não usar em correção local simples. |
| `secrets-layout-guardian` | Protege segredos, ficheiros `.env`, chaves, SSH e credenciais. Usar quando a tarefa toca autenticação, configuração sensível ou estrutura local. |
| `security-quality-gate` | Executa verificações determinísticas de segurança proporcionais ao risco com Gitleaks, Trivy e opcionalmente Semgrep; usar em releases, auth, dependências, infra, secrets ou mudanças de risco, sem substituir revisão humana. |
| `shadcn-ui` | Gere componentes e composição shadcn/ui quando existe components.json ou pedido explícito; usar comandos read-only primeiro e tratar monorepos explicitamente. |
| `sql-server-production-safety` | Escreve e revê T-SQL para SQL Server com segurança, performance e impacto em produção. Usar em SELECTs complexos, DML, índices e troubleshooting SQL. |
| `ssh-server-ops` | Executa operações SSH, Git e administração remota com segurança, confirmação e rollback. Usar em servidores reais; não ativar para desenvolvimento local. |
| `stop-the-slop` | Remove automaticamente padrões previsíveis de escrita de IA em documentação e prosa, preservando rigor, factos e tom adequado. |
| `taste-frontend` | Cria direção visual anti-template para landing pages, portfolios e redesigns de marketing; não usar em dashboards, data tables ou fluxos de produto multi-step. |
| `vercel-react-best-practices` | Aplica guidelines de performance React/Next.js da Vercel, priorizando waterfalls, bundle, data fetching, re-renders e rendering; usar apenas quando a stack React/Next estiver presente. |
| `visual-foxpro-phc` | Trabalha com Visual FoxPro e customizações PHC: cursores, aliases, buffering, objetos SBO, SQL pass-through e eventos. Usar em código VFP/PHC. |
| `web-design-guidelines` | Audita UI, UX e acessibilidade por ficheiro e linha usando as Web Interface Guidelines da Vercel; usar numa fase de revisão separada depois da implementação. |

O routing canónico está em `.agents/INDEX.md`. Skills novas só devem ser
adicionadas ao INDEX quando precisarem de uma rota explícita; caso contrário, o
agente pode localizá-las por nome e descrição quando a tarefa o justificar.
