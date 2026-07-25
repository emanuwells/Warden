# AGENTS.md

Contrato operacional obrigatório para qualquer IA, agente, IDE assistido por IA ou ferramenta autónoma que trabalhe neste repositório.

## Hierarquia de Autoridade

1. Regras superiores de segurança, sistema, plataforma e lei aplicável.
2. Este `AGENTS.md`.
3. Documentos normativos em `docs/ai/`, `docs/architecture/` e `docs/ai/ops/`.
4. `PROJECT_CONTEXT.md`.
5. `COMMANDS.md`.
6. Pedido atual do utilizador.

## Leitura Mínima Obrigatória

1. `AGENTS.md`, `PROJECT_CONTEXT.md`, `COMMANDS.md`.
2. `docs/ai/DAILY_AGENT_WORKFLOW.md`, `docs/ai/policies/CONTEXT_BUDGET_POLICY.md`.
3. `tasks/todo.md`, `tasks/lessons.md`.
4. Em risco médio+: `docs/ai/ops/HANDOFF.md`, `docs/ai/ops/RUNBOOK.md`, `docs/architecture/deployment.md`.

## Raiz Limpa

Ver `docs/ROOT_STRUCTURE.md`.

Permitido na raiz:

- `README.md`, `AGENTS.md`, `COMMANDS.md`, `CHANGELOG.md`, `PROJECT_CONTEXT.md`;
- `VERSION`, `LICENSE`;
- `.gitattributes`, `.gitignore` — **obrigatórios na raiz** (Git não suporta outro path)
- `.github/`, `docs/`, `tasks/`, `scripts/`, `tools/`;
- pastas do produto: `src/`, `public/`, `docker/`, `deploy/`, `runtime/`, `secrets/`.

Fora da raiz:

- `.env.example` → `docs/resources/templates/.env.example`;
- Docker → `docker/compose.*.yml`, `docker/.dockerignore`;
- CLI → `python -m src.warden` (único entrypoint Python).

## Regras Absolutas

- Preservar alterações existentes do utilizador.
- Não versionar segredos reais (`secrets/` é runtime local).
- Não alterar comportamento funcional sem explicar impacto.
- Produção, SSH e deletes destrutivos exigem confirmação explícita.
- Atualizar `CHANGELOG.md` em alterações versionáveis.

## Classificação de Risco

| Risco | Exemplos | Obrigatório |
|---|---|---|
| Baixo | texto, README, ajuste local | validação leve |
| Médio | script, endpoint, config | plano curto, validação |
| Alto | backend, DB, Docker, refactor | plano faseado, rollback |
| Crítico | produção, SSH, segredos | confirmação explícita |

## Fluxo

Descobrir → planear (se médio+) → executar → validar (`COMMANDS.md`) → auditar → registar.

Refactors: `docs/ai/policies/SAFE_REFACTOR_POLICY.md`.

## Resposta Final

Resumo, ficheiros alterados, validações, limitações, próximos passos se necessários.
