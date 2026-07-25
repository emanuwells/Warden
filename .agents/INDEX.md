# WELLS — índice de routing seletivo

Consulta apenas a linha aplicável. Por defeito: um workflow e até duas skills.
Os papéis são responsabilidades de revisão; não precisam de ser todos carregados.

| Situação | Workflow primário | Skills principais | Papéis quando necessários |
|---|---|---|---|
| Pedido ambíguo | `.agents/workflows/00-intake.md` | `.agents/skills/repo-onboarding/SKILL.md` | Product Owner técnico |
| Nova funcionalidade | `.agents/workflows/10-feature-delivery.md` | `.agents/skills/feature-delivery/SKILL.md` + domínio | Engineer, QA, Reviewer |
| Bug ou regressão | `.agents/workflows/30-bugfix.md` | `.agents/skills/bugfix-diagnostics/SKILL.md` | Engineer, QA, Reviewer |
| Refactor | `.agents/workflows/20-safe-refactor.md` | `.agents/skills/safe-refactor/SKILL.md` | Architect, Maintainer, QA |
| Revisão de qualidade | `.agents/workflows/40-quality-review.md` | `.agents/skills/quality-review/SKILL.md` | QA, Security, Reviewer |
| Release ou continuidade | `.agents/workflows/50-release-handoff.md` | `.agents/skills/docs-maintainer/SKILL.md` | DevOps, Writer, Reviewer |
| Frontend | workflow da tarefa | `.agents/skills/frontend-skill-orchestrator/SKILL.md` | Frontend, QA |
| Backend/API | workflow da tarefa | `.agents/skills/backend-architecture/SKILL.md`, `.agents/skills/api-contract-guardian/SKILL.md` | Backend, Security, QA |
| Base de dados | workflow da tarefa | `.agents/skills/database-migration-safety/SKILL.md` | Database, Backend, DevOps |
| Docker/servidor/CI | workflow da tarefa | `.agents/skills/docker-deploy/SKILL.md` ou `.agents/skills/ssh-server-ops/SKILL.md` | DevOps, Security |
| Power BI/Power Query | workflow da tarefa | `.agents/skills/powerquery-powerbi/SKILL.md` | Data, QA |
| Documentação profissional | workflow da tarefa | `.agents/skills/professional-documentation/SKILL.md` | Writer, Reviewer |
| Objetivo iterativo | workflow primário + `.agents/workflows/GOAL_SEEKING_LOOP.md` | apenas as necessárias | Orchestrator |

Lê `.agents/core/ORCHESTRATOR.md` apenas para tarefas multiárea, risco médio ou
superior, produção, segurança, migrações ou decisões arquiteturais.
