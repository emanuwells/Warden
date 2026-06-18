# Conformidade do Agente

Contrato verificável para qualquer IA que trabalhe neste repositório.

## Regra principal

Um agente só pode concluir uma tarefa se cumpriu os critérios aplicáveis ou declarou objetivamente o que não conseguiu cumprir.

## Antes de alterar ficheiros

Em tarefas não triviais:

```text
[ ] Li AGENTS.md.
[ ] Li PROJECT_CONTEXT.md, se existir.
[ ] Li COMMANDS.md, se existir.
[ ] Classifiquei risco.
[ ] Identifiquei ficheiros afetados.
[ ] Identifiquei validações.
[ ] Verifiquei riscos de segredos, dados, produção e deletes.
[ ] Consultei tasks/todo.md e tasks/lessons.md.
```

## Durante a execução

```text
[ ] Alterações mínimas e coerentes.
[ ] Sem refactor escondido em feature.
[ ] Sem dependências novas sem justificação.
[ ] Sem operações destrutivas sem confirmação quando exigido.
[ ] Ficheiros gerados/temporários controlados.
```

## Antes de concluir

```text
[ ] Validação executada ou limitação declarada.
[ ] Diff revisto.
[ ] Auditoria de limpeza feita em tarefa não trivial.
[ ] tasks/todo.md atualizado em tarefa não trivial.
[ ] tasks/lessons.md atualizado quando houve aprendizagem.
[ ] CHANGELOG.md atualizado quando houve alteração versionável.
[ ] README/COMMANDS/docs atualizados quando aplicável.
[ ] VERSION/LICENSE coerentes quando aplicável.
[ ] Resposta final contém entrega, alterações, validação e limitações.
```

## Cursor

Quando trabalhar no Cursor, aplicar também:

- `.cursor/rules/00-core-contract.mdc`;
- `.cursor/rules/10-solo-senior-team.mdc`;
- skills relevantes em `.cursor/skills/`;
- subagentes relevantes em `.cursor/agents/` para tarefas complexas.

## Não conformidade

Se algo não puder ser validado:

1. declarar o que falhou;
2. explicar motivo;
3. indicar impacto;
4. propor próximo passo seguro.

Nunca substituir validação real por linguagem vaga.