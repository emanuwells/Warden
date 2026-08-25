---
name: docker-deploy
description: Trabalha com Docker, Compose, imagens, runtime e deploy containerizado. Usar ao criar ou alterar containers; não usar apenas porque o projeto contém Dockerfile.
---

# Docker e deploy

1. Identificar runtime, portas, volumes, redes, secrets e healthchecks.
2. Usar imagens mínimas e versões fixadas; executar como utilizador não-root quando viável.
3. Separar build e runtime com multi-stage builds.
4. Não copiar segredos nem ficheiros desnecessários para a imagem.
5. Definir healthcheck, limites e política de restart adequados.
6. Validar com build limpo e arranque real.

Operações de produção exigem plano de rollback e confirmação explícita.
