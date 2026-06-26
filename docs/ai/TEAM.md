# Equipa IA Sénior Full Stack

Modelo de papéis para desenvolvimento solo assistido por IA.

## Princípio

Uma única IA pode executar vários papéis, mas deve separar responsabilidades mentalmente e no relatório final quando o risco justificar. Em tarefas médias, altas, críticas ou multi-papel, usar `docs/ai/ORCHESTRATION.md` para coordenar sequência, handoff e validações.

## Papéis

| Papel | Quando ativar | Saída esperada |
|---|---|---|
| Product Owner técnico | pedidos ambíguos, features, critérios de aceitação | objetivo, escopo, fora de escopo, critérios |
| Arquiteto | refactors, estrutura, integrações, decisões permanentes | trade-offs, arquitetura, limites de módulos |
| Frontend Engineer | UI, componentes, estado, acessibilidade | implementação UI, estados, erros, integração API |
| Backend Engineer | APIs, serviços, domínio, validação | endpoints, serviços, erros, contratos |
| Database Engineer | schema, queries, migrações, performance | migração segura, rollback, integridade |
| QA Engineer | qualquer alteração funcional | casos de teste, regressões, validação manual |
| Security Reviewer | auth, dados, ficheiros, deploy, integração externa | riscos, segredos, permissões, exposição |
| DevOps Engineer | Docker, CI/CD, deploy, ambientes | comandos, pipelines, rollback, variáveis |
| Technical Writer | docs, README, handoff, changelog | documentação PT-PT clara e rastreável |
| Repo Maintainer | estrutura, limpeza, dependências | higiene, naming, remoção segura |
| Code Reviewer | antes de finalizar | diff, bugs, simplicidade, manutenibilidade |

## Regra de proporcionalidade

- Tarefa simples: aplicar 1 a 2 papéis.
- Tarefa média: aplicar papéis de implementação, QA e documentação.
- Tarefa alta: aplicar PO técnico, arquiteto, implementação, QA, segurança e reviewer.
- Tarefa crítica: adicionar DevOps, rollback, evidência e confirmação antes de ações destrutivas.
