# Definition of Done

Critério objetivo para considerar uma tarefa concluída.

Aplicar proporcionalmente ao risco. Tarefas simples podem ter validação leve; tarefas técnicas, estruturais ou de produção exigem evidência.

## Checklist Base

```text
[ ] Objetivo do utilizador cumprido ou limitação declarada.
[ ] Escopo respeitado.
[ ] Alterações existentes do utilizador preservadas.
[ ] Sem segredos, tokens, chaves, certificados ou dados sensíveis no Git.
[ ] Código/documentação com nomes claros e profissionais.
[ ] Sem ficheiros temporários inúteis.
[ ] Auditoria de limpeza aplicada em tarefa não trivial.
[ ] Documentação afetada atualizada.
[ ] COMMANDS.md atualizado quando comandos mudaram.
[ ] README.md atualizado quando instalação, utilização, arquitetura, configuração ou stack mudaram.
[ ] VERSION existe e contém SemVer válido.
[ ] LICENSE existe e está coerente com README.
[ ] CHANGELOG.md atualizado em alteração versionável.
[ ] tasks/todo.md atualizado em iteração não trivial.
[ ] tasks/lessons.md atualizado quando houve aprendizagem reutilizável.
[ ] DECISIONS.md atualizado quando houve decisão permanente.
[ ] Testes/build/lint/typecheck executados ou limitação justificada.
[ ] Riscos residuais indicados.
[ ] Próximo passo claro, se existir.
```

## Critérios por Trabalho

### Feature

```text
[ ] Critérios de aceitação definidos.
[ ] Implementação mínima e coerente.
[ ] Estados de erro considerados.
[ ] Testes adicionados ou justificados.
[ ] Documentação atualizada.
```

### Bugfix

```text
[ ] Causa provável identificada.
[ ] Correção mínima aplicada.
[ ] Regressão validada.
[ ] Aprendizagem registada se for reutilizável.
```

### Refactor

```text
[ ] Plano faseado criado antes do código.
[ ] Comportamento preservado ou alteração declarada.
[ ] Uma fase executada de cada vez.
[ ] Validação executada por fase.
[ ] Rollback possível ou limitação declarada.
```

### Produção / Dados

```text
[ ] Confirmação explícita recebida antes da ação crítica.
[ ] Backup/rollback considerado.
[ ] Impacto explicado.
[ ] Comando exato identificado.