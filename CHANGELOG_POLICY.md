# CHANGELOG_POLICY.md

Este ficheiro define a política obrigatória para manter `CHANGELOG.md` atualizado de forma automática, versionada e rastreável.

## Regra Principal

Qualquer IA que altere código, documentação, configuração, estrutura, scripts, dependências, dados de exemplo, MCP, Skills, ADRs ou decisões técnicas deve atualizar `CHANGELOG.md` na mesma tarefa, antes de entregar o trabalho.

## Objetivo

Garantir que o histórico permite responder:

1. O que mudou?
2. Porque mudou?
3. Que impacto teve?
4. Que MCP/Skills foram usados?
5. Como foi verificado?

## Obrigatoriedade

`CHANGELOG.md` é obrigatório quando houver:

- código novo;
- correção de bug;
- refactor;
- alteração de arquitetura;
- alteração de base de dados;
- migration nova;
- alteração de endpoint, contrato de API ou payload;
- alteração de Docker, CI/CD, variáveis de ambiente ou configuração;
- alteração de dependências;
- alteração de documentação;
- alteração de regras em `AGENTS.md`;
- alteração de `PROJECT_CONTEXT.md`;
- alteração de `HANDOFF.md` quando representar mudança operacional relevante;
- alteração de `SKILLS.md` ou Skills instaladas;
- alteração de MCP servers ou configuração MCP;
- criação/atualização de ADRs;
- alteração de scripts, jobs, agentes ou automações;
- remoção, renomeação ou movimentação de ficheiros;
- decisão técnica que afete trabalho futuro.

Se a tarefa for apenas análise, diagnóstico ou explicação sem alteração de ficheiros, `CHANGELOG.md` não precisa de nova entrada.

## SemVer

Usar SemVer: `MAJOR.MINOR.PATCH`.

- `PATCH`: correções, ajustes pequenos, documentação sem nova capacidade.
- `MINOR`: nova capacidade compatível, novo ficheiro operacional, nova Skill, novo MCP opcional, nova política compatível.
- `MAJOR`: quebra de compatibilidade, mudança estrutural que exige migração manual ou alteração incompatível de contrato público.

Usar o menor incremento que represente corretamente o impacto.

## Data E Hora

Cada entrada deve usar ISO 8601 com timezone Europe/Lisbon.

Exemplo:

```text
2026-05-31T13:45:00+01:00
```

## Formato Obrigatório

```markdown
## [VERSAO] - YYYY-MM-DDTHH:mm:ss+TZ

### Título Curto Da Alteração

**Motivo:**
Explicar porque a alteração foi feita.

**Impacto:**
Explicar o que muda no projeto, utilizador, arquitetura ou operação.

**Alterações:**
- `ficheiro/ou/pasta`: descrição objetiva da alteração.

**Ferramentas, MCP E Skills:**
- MCP servers usados ou `N/A — motivo`.
- Skills usadas ou `N/A — motivo`.
- Fallbacks aplicados, se existirem.

**Testes:**
- Comando executado e resultado.
- Se não aplicável: `N/A — motivo`.

**Validação:**
- Como foi confirmado que a alteração está correta.

**Refs:**
- Links, issues, commits, pedidos do utilizador ou `N/A`.

**Diff:**
Resumo curto do diff lógico.

---
```

## Checklist Final Obrigatória

```text
[ ] Verifiquei se a tarefa altera ficheiros, comportamento, configuração, documentação ou decisão técnica.
[ ] Atualizei CHANGELOG.md quando aplicável.
[ ] Atualizei HANDOFF.md quando houve tarefa não trivial ou alteração operacional.
[ ] Registei MCP servers e Skills usados ou justifiquei N/A.
[ ] Criei/atualizei ADRs quando houve decisão técnica relevante.
[ ] Usei SemVer corretamente.
[ ] Usei data/hora ISO 8601 Europe/Lisbon.
[ ] Listei ficheiros alterados.
[ ] Registei testes ou justifiquei N/A.
[ ] Registei validação.
```

## Proibição De Entrega Sem Changelog

Se houve alteração versionável, a IA não deve entregar como concluído enquanto não atualizar `CHANGELOG.md`.
