# Workflow 50 — Release e Handoff

## Objetivo

Preparar entrega verificável e continuável noutra sessão ou ferramenta.

## Passos

1. Confirmar versão em `VERSION`.
2. Confirmar `CHANGELOG.md` append-only.
3. Confirmar README e comandos.
4. Executar `node .agents/tools/wells-finalize.mjs --project . --changed --apply`.
5. Confirmar testes/build/lint sobre o estado final ou limitações.
6. Executar `security-quality-gate` quando o risco/stack o justificar; tools ausentes ficam como cobertura incompleta.
7. Confirmar riscos e rollback.
8. Atualizar `.agents/state/HANDOFF.md` se a tarefa tiver continuidade.

## Saída

- versão;
- resumo;
- validações;
- riscos;
- rollback;
- próximos passos.
