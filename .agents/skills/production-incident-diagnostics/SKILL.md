---
name: production-incident-diagnostics
description: Coordena diagnóstico de incidentes e degradações em produção por evidência, do sintoma à aplicação, rede, proxy, containers, sistema e base de dados, preservando segurança, rollback e timeline.
---

# Production Incident Diagnostics

## Princípio

Mitigar risco primeiro quando necessário, diagnosticar por evidência e alterar uma variável de cada vez. Não usar produção como ambiente de experimentação.

## Processo

1. **Impacto:** quem/quanto está afetado, início provável, componente e severidade.
2. **Mudanças recentes:** deploys, config, certificados, DNS, dependências, jobs, schema, infraestrutura.
3. **Reprodução/sinais:** erro, latência, taxa de falhas, logs e métricas; separar sintoma de causa.
4. **Camadas, pela evidência:**
   - cliente/DNS/TLS;
   - rede/firewall/load balancer/reverse proxy;
   - processo/container/serviço;
   - CPU/RAM/disk/file descriptors;
   - aplicação e dependências;
   - DB: conexões, locks, queries, storage;
   - jobs/queues/pipelines externos.
5. **Hipóteses:** cada hipótese deve indicar teste, resultado esperado e ação reversível.
6. **Mitigação:** rollback/failover/rate limit/restart apenas com impacto entendido e autorização proporcional.
7. **Correção:** resolver causa raiz; não esconder o sintoma.
8. **Validação:** métricas e comportamento regressam ao baseline; observar período suficiente.
9. **Pós-incidente:** timeline, causa, fatores contribuintes, deteção, prevenção e follow-ups acionáveis.

## Integrações

- usar logs/shell existentes por defeito;
- `ssh-server-ops`, `docker-deploy`, `sql-server-production-safety` apenas na camada relevante;
- Sentry MCP apenas se o projeto já usa Sentry e as permissões estiverem configuradas;
- nunca enviar segredos ou dados pessoais para ferramentas externas por conveniência.
