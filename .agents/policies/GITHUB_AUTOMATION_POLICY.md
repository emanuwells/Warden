# GITHUB_AUTOMATION_POLICY.md

Política para GitHub Actions, Dependabot, rulesets e automação segura de repositórios.

## Objetivo

Adicionar automação proporcional ao projeto sem inventar comandos, alargar permissões ou substituir workflows existentes do utilizador.

## Baseline

Para projetos alojados no GitHub, considerar por defeito:

1. `WELLS Runtime`: validação determinística do runtime `.agents/`.
2. CI da stack apenas quando a stack/comandos são detetáveis no repositório.
3. Dependabot para `github-actions` e ecossistemas realmente presentes; agrupar apenas updates minor/patch e deixar majors isolados para revisão.
4. `permissions` mínimas e explícitas em todos os workflows.
5. `persist-credentials: false` no checkout quando não é necessário fazer push.
6. Actions externas fixadas a commit SHA completo; comentários indicam a versão humana e Dependabot mantém os pins atualizados.
7. `concurrency` com cancelamento de execuções obsoletas em CI/PR.
8. `timeout-minutes` finito em jobs.
9. Node.js sem versão declarada no projeto usa a LTS atual verificada pelo Toolkit; versões declaradas pelo projeto têm precedência.
10. `uv` e Poetry executam checks dentro do respetivo ambiente (`uv run` / `poetry run`).

## Nunca por defeito

- `pull_request_target` para executar código não confiável.
- `permissions: write-all`.
- auto-merge irrestrito.
- deploy para produção.
- escrita na `main`.
- publicação de releases/artefactos sem contrato de build conhecido.
- segredos embebidos no YAML.

## Segurança GitHub nativa

Quando disponível e aplicável:

- preferir CodeQL **Default setup** em linguagens suportadas; usar workflow avançado apenas quando há necessidade concreta;
- ativar secret scanning e push protection nas definições do repositório/organização;
- usar Dependency Review em repos públicos ou privados com a licença GitHub necessária;
- configurar rulesets/branch protection para exigir os checks reais antes de merge; o comando `github --json` devolve `recommendedRulesetChecks`.

Estas funcionalidades são configuração de GitHub e não devem ser simuladas por YAML quando o produto as fornece nativamente. Para CodeQL, começar por **Default setup** e só usar Advanced setup quando exista uma necessidade concreta.

## Geração WELLS

Usar primeiro simulação:

```bash
node .agents/tools/wells-toolkit.mjs github --project .
```

Aplicar apenas depois de rever o plano:

```bash
node .agents/tools/wells-toolkit.mjs github --project . --apply
```

Opções sensíveis são explícitas:

```bash
node .agents/tools/wells-toolkit.mjs github --project . --dependency-review --apply
node .agents/tools/wells-toolkit.mjs github --project . --release --apply
```

Para cópias numa Organization, preferir fork nativo do GitHub e `Sync fork` manual. O WELLS não gera mirror, não pede PAT e não tenta manter dois repositórios automaticamente sincronizados.

## Preservação

- Ficheiros WELLS gerados têm marcador próprio e podem ser regenerados.
- Um ficheiro `.github` existente sem marcador WELLS nunca é substituído automaticamente.
- Em conflito, criar candidato em `.agents/migration/candidates/` e exigir revisão humana.
- Não alterar workflows de deploy ou release preexistentes sem pedido explícito.

## Critério de fecho

```text
[ ] CI executa apenas comandos existentes/deriváveis.
[ ] Actions externas estão SHA-pinned ou a exceção está documentada.
[ ] permissions são mínimas.
[ ] Não existe pull_request_target inseguro.
[ ] Dependabot cobre GitHub Actions e dependências presentes.
[ ] Checks recomendados para ruleset estão documentados.
[ ] Funcionalidades indisponíveis no plano GitHub são reportadas, não tratadas como sucesso.
```
