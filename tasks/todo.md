# Tasks / Todo

Registo operacional por iteração. Atualizar em tarefas não triviais.

## Formato

```md
## YYYY-MM-DDTHH:mm:ss+01:00 — Título

**Estado:** pendente / em progresso / concluído / bloqueado  
**Risco:** baixo / médio / alto / crítico  
**Objetivo:** texto  
**Alterações:**
- `ficheiro`: descrição
**Validação:** comandos ou N/A
**Pendente:** texto ou N/A
```

---

## 2026-07-14T15:05:00+01:00 — Repo público + WELLS_API warden

**Estado:** concluído (local) / prod pendente  
**Risco:** médio  
**Objetivo:** Limpeza conservadora, sanitização GitHub, `src/requirements.txt`, proxy `GET /api/warden.php`.  
**Alterações:**
- `src/requirements.txt`: movido da raiz; Docker e docs actualizados.
- Removidos duplicados: `docs/ai/SKILLS.md`, `docs/AI_TEAM_WORKFLOW.md`, `tasks/template.md`.
- Slack: `SLACK_WEBHOOK_URL`, exemplo sem URL; `setup-secrets-from-wells-api.ps1` sem hosts hardcoded.
- Docs agnósticos: README, PROJECT_CONTEXT, HANDOFF, architecture.
- WELLS_API: `api/warden.php`, config examples, explorer, publish scripts.
**Validação:** `py_compile` OK; `php -l` OK; smoke `warden.php?help=1` local OK.  
**Pendente:** commit + push; `git pull` prod Warden; publish WELLS_API com `apis.warden.api_url`; smoke remoto.

---

## 2026-06-18T14:50:00+01:00 — Integração do template de governança IA sénior (Fase 1)

**Estado:** concluído  
**Risco:** médio  
**Objetivo:** Adaptar o template de governança IA sénior ao repo Warden, preservando a estrutura `docs/ai/` existente e adicionando `docs/ai/`, `docs/architecture/` e `tasks/`.  
**Alterações:**
- `docs/ai/DAILY_AGENT_WORKFLOW.md`: criado — workflow diário universal.
- `docs/ai/README.md`: criado — camada IA neutra.
- `docs/ai/policies/CONTEXT_BUDGET_POLICY.md`: criado — orçamento de contexto.
- `docs/ai/policies/SAFE_REFACTOR_POLICY.md`: criado — política de refactor seguro.
- `docs/ai/policies/ROOT_CLEAN_POLICY.md`: criado — política de raiz limpa.
- `docs/ai/policies/LANGUAGE_POLICY.md`: criado — idioma e acentuação.
- `docs/ai/policies/VERSION_LICENSE_POLICY.md`: criado — VERSION e LICENSE.
- `docs/ai/policies/AI_TEAM_OPERATING_MODEL.md`: criado — modelo operacional.
- `docs/ai/policies/CLEANUP_AUDIT_POLICY.md`: criado — auditoria minuciosa.
- `docs/ai/workflows/00-intake.md`: criado — workflow de intake.
- `docs/ai/workflows/10-feature-delivery.md`: criado — entrega de feature.
- `docs/ai/workflows/20-safe-refactor.md`: criado — refactor seguro.
- `docs/ai/workflows/30-bugfix.md`: criado — bugfix.
- `docs/ai/workflows/40-quality-review.md`: criado — revisão de qualidade.
- `docs/ai/workflows/50-release-handoff.md`: criado — release e handoff.
- `docs/ai/ops/EVIDENCE.md`: criado — evidência mínima.
- `docs/ai/ops/DECISIONS.md`: criado — decisões técnicas.
- `docs/ai/ops/DEFINITION_OF_DONE.md`: criado — critérios de done.
- `docs/ai/ops/AGENT_COMPLIANCE.md`: criado — conformidade do agente.
- `docs/ai/ops/TESTING_POLICY.md`: criado — política de testes.
- `docs/architecture/README.md`: criado — índice de arquitetura.
- `docs/architecture/overview.md`: criado — visão geral Warden.
- `docs/architecture/backend.md`: criado — arquitetura backend.
- `docs/architecture/frontend.md`: criado — arquitetura frontend.
- `docs/architecture/database.md`: criado — arquitetura de base de dados.
- `docs/architecture/deployment.md`: criado — deploy e operação.
- `docs/architecture/decisions.md`: criado — decisões técnicas.
- `tasks/todo.md`: criado — registo operacional.
- `tasks/lessons.md`: criado — aprendizagens reutilizáveis.
**Validação:** `git status --short`; listagem de `docs/ai/` e `docs/architecture/`.  
**Pendente:** N/A — todas as fases concluídas.
