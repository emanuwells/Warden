# Sentry MCP — incidentes apenas quando Sentry já existe

Ativar apenas em projetos que já usam Sentry e quando a tarefa precisa de issues, traces, erros ou performance reais.

## WELLS

- começar read-only;
- limitar projeto/organização e tools;
- não adicionar Sentry ao projeto apenas para satisfazer o Toolkit;
- combinar resultados com `production-incident-diagnostics` e confirmar causas no código/logs;
- não enviar PII/secrets para prompts ou relatórios.
