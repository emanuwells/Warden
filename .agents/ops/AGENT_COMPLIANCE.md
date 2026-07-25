# Conformidade do agente

Um agente só conclui uma tarefa quando cumpriu os critérios aplicáveis ou declarou
objetivamente o que não conseguiu validar.

## Antes de alterar

Para trabalho não trivial:

- ler `.agents/AGENTS.md`;
- identificar objetivo, escopo, ficheiros prováveis e risco;
- consultar contexto, comandos, estado, workflow e skills apenas quando o routing o exigir;
- verificar riscos de segredos, dados, dependências, produção e operações destrutivas.

## Durante a execução

- alterações mínimas e coerentes;
- sem refactor ou limpeza escondidos;
- sem dependências novas sem justificação;
- sem segredos ou ações irreversíveis não autorizadas;
- descoberta progressiva, sem carregar todo o repositório.

## Antes de concluir

- rever o diff;
- executar a validação mínima relevante ou declarar a limitação;
- atualizar TODO, HANDOFF e EVIDENCE em trabalho não trivial ou inacabado;
- atualizar LESSONS, DECISIONS, README, documentação e CHANGELOG apenas quando aplicável;
- comunicar entrega, validações, limitações e próximo passo.

Estas regras aplicam-se em qualquer IDE ou agente. Não existem regras canónicas em
`.cursor/`, `.claude/`, `.codex/` ou outras pastas específicas de ferramentas.
