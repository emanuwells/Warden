# Templates GitHub WELLS

Estes templates são usados pelo comando `node .agents/tools/wells-toolkit.mjs github` e não devem ser copiados cegamente.

- `dependency-review.yml`: opt-in; disponível em repos públicos e em privados com GitHub Code Security/Advanced Security aplicável.
- `release-check.yml`: opt-in; valida a tag contra `VERSION`, mas não publica artefactos.

O baseline `wells-runtime.yml`, o CI da stack e `dependabot.yml` são gerados dinamicamente porque dependem do conteúdo real do projeto.

O gerador devolve também `recommendedRulesetChecks` para facilitar a configuração de rulesets sem assumir que a API/organização está disponível no ambiente local.

Para cópia numa Organization: usar fork nativo + `Sync fork` manual. O Toolkit não cria mirror nem requer tokens para sincronização entre repositórios.
