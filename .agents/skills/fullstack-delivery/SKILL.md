---
name: fullstack-delivery
description: Coordena alterações que atravessam frontend, backend, API e dados. Usar apenas quando a funcionalidade cruza várias camadas.
---

# Entrega full stack

1. Definir contrato e fluxo de dados ponta a ponta.
2. Ordenar trabalho: schema/contrato, backend, frontend, testes e documentação.
3. Preservar compatibilidade entre versões durante rollout.
4. Validar autorização e regras de negócio em servidor.
5. Testar integração real entre camadas e estados de erro.
6. Dividir em fases se o diff ficar difícil de rever ou reverter.

Não duplicar validação crítica apenas no cliente.
