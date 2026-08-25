# Workflow 60 — GitHub Automation

Usar para CI, Dependabot, GitHub Actions, rulesets e releases.

## Processo

1. Ler apenas `GITHUB_AUTOMATION_POLICY.md` e os manifestos/comandos relevantes da stack.
2. Executar `node .agents/tools/wells-toolkit.mjs github --project .` para detetar stacks e obter plano sem escrita.
3. Rever warnings: lockfiles ausentes, stacks sem comandos verificáveis, workflows externos e funcionalidades GitHub dependentes do plano.
4. Aplicar com `--apply` apenas se os ficheiros gerados forem adequados.
5. Para Dependency Review ou release gate, usar a opção explícita correspondente.
6. Executar os testes locais do projeto e `node .agents/tools/wells-toolkit.mjs audit --project .`.
7. Rever o diff; usar `recommendedRulesetChecks` como base do ruleset e configurar CodeQL Default setup/secret scanning quando aplicável.
8. Se o repositório tiver uma cópia numa Organization, sincronizar pelo fork nativo do GitHub (`Sync fork`) fora do workflow WELLS.

## Resultado esperado

- CI mínima e reprodutível sem comandos inventados.
- Dependabot alinhado com os ecossistemas presentes.
- Workflows com menor privilégio, timeout e SHA pins.
- Conflitos preservados como candidatos em vez de sobrescritos.
