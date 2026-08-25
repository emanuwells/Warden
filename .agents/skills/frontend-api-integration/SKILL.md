---
name: frontend-api-integration
description: Integra frontend com APIs, incluindo tipagem, estados de loading/erro, cache, autenticação e cancelamento. Usar quando UI consome serviços externos.
---

# Integração frontend/API

1. Confirmar contrato real e tipos de request/response.
2. Centralizar cliente, base URL, headers e tratamento de erros.
3. Distinguir loading inicial, refresh, vazio, erro recuperável e autorização.
4. Cancelar pedidos obsoletos e evitar race conditions.
5. Não guardar tokens sensíveis em locais inadequados.
6. Testar respostas lentas, falhas, dados vazios e sessão expirada.
