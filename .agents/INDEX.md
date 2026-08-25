# WELLS — routing seletivo

> Ficheiro canónico gerido pelo WELLS Toolkit. Em projetos consumidores, não editar; personalizações pertencem a `PROJECT_CONTEXT.md`, `COMMANDS.md`, estado ou extensões.

Consulta apenas a linha aplicável. Por defeito: um workflow e até duas skills por fase.

| Situação | Workflow | Skills principais |
|---|---|---|
| Pedido ambíguo | `.agents/workflows/00-intake.md` | `repo-onboarding` |
| Feature | `.agents/workflows/10-feature-delivery.md` | `feature-delivery` + domínio |
| Bug | `.agents/workflows/30-bugfix.md` | `bugfix-diagnostics` |
| Refactor/migração | `.agents/workflows/20-safe-refactor.md` | `safe-refactor` + domínio |
| Revisão | `.agents/workflows/40-quality-review.md` | `code-review` ou `quality-review` |
| Release/handoff | `.agents/workflows/50-release-handoff.md` | `docs-maintainer`, `quality-gate-runner` |
| Conhecimento durável | `.agents/workflows/05-knowledge-ingest.md` | `knowledge-graph-maintainer` |
| Lint do conhecimento | `.agents/workflows/45-knowledge-lint.md` | `knowledge-graph-maintainer` |
| Frontend React/Vite | `.agents/workflows/35-frontend-design.md` ou workflow da tarefa | `frontend-skill-orchestrator` + domínio |
| Dashboard/aplicação | `.agents/workflows/35-frontend-design.md` | `frontend-design-direction`, `impeccable-ui` |
| Landing/portfolio | `.agents/workflows/35-frontend-design.md` | `taste-frontend`, `frontend-design-direction` |
| Screenshot/mockup → código | `.agents/workflows/35-frontend-design.md` | `image-to-code` + direção adequada |
| Referência de design/brand | `.agents/workflows/35-frontend-design.md` | `awesome-design-md`, `frontend-design-direction` |
| React performance/padrões | workflow da tarefa | `react-vite-typescript`, `vercel-react-best-practices` |
| Motion UI | `.agents/workflows/35-frontend-design.md` | `emil-design-engineering` + stack |
| Browser/smoke/visual | `.agents/workflows/35-frontend-design.md` ou revisão | `playwright-cli` + domínio |
| Auditoria UI | `.agents/workflows/40-quality-review.md` | `web-design-guidelines`, `frontend-accessibility-wcag` |
| Backend/API PHP | workflow da tarefa | `backend-architecture`, `php-rest-api` |
| SQL/dados | workflow da tarefa | `sql-server-production-safety`, `database-migration-safety` |
| ETL/ELT/dataset derivado | workflow da tarefa | `data-pipeline-reliability` + domínio |
| PHC/Visual FoxPro | workflow da tarefa | `visual-foxpro-phc` |
| Docker/servidor/CI | workflow da tarefa | `docker-deploy`, `ssh-server-ops` ou `cicd-pipeline-guardian` |
| GitHub Actions/Dependabot/rulesets | `.agents/workflows/60-github-automation.md` | `GITHUB_AUTOMATION_POLICY.md` + comandos reais da stack |
| Incidente/degradação produção | `.agents/workflows/30-bugfix.md` | `production-incident-diagnostics` + domínio |
| Power BI/Power Query | workflow da tarefa | `powerquery-powerbi` |
| API/dados públicos | workflow da tarefa | `api-contract-guardian`, `public-data-metadata` |
| Documentação/prosa | workflow da tarefa | `humanizer`, `stop-the-slop`; `ponytail` apenas para redundância |
| Higiene invisível de ficheiros alterados | fecho universal | `.agents/policies/OUTPUT_HYGIENE_POLICY.md` + `wells-finalize.mjs` automaticamente |
| Limpeza adicional de AI marks autorizada | workflow da tarefa | `remove-ai-marks` explicitamente |
| Pesquisa estrutural ampla | workflow da tarefa | `graphify`, se instalado |
| Obsidian | workflow da tarefa | `obsidian-knowledge` |
| Quota/fallback/modelo | `.agents/workflows/55-agent-fallback.md` | `agent-fallback-router` + `MODEL_ROUTING.md` |
| Memória Claude | workflow da tarefa | `claude-memory-strategy` |
| Auditoria de tokens | `.agents/workflows/40-quality-review.md` | `codeburn-observability` |
| Documentação atual de biblioteca/API | workflow da tarefa | `context7-current-docs` |
| Gate de segurança | revisão/release | `security-quality-gate` |
| Integrações externas | `.agents/workflows/00-intake.md` | `external-integrations` |

Lê `.agents/core/ORCHESTRATOR.md` apenas para tarefas multiárea, risco médio/alto,
produção, segurança, migrações de dados ou decisões arquiteturais.
