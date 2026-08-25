---
name: cicd-pipeline-guardian
description: Cria ou altera pipelines CI/CD, critérios, artefactos, segredos e deploy. Usar para workflows de integração/entrega; não ativar em código comum.
---

# Guardião de CI/CD

1. Identificar triggers, ambientes, permissões e artefactos.
2. Fixar versões de actions/imagens quando apropriado.
3. Aplicar permissões mínimas e segredos por ambiente.
4. Separar build, testes, publicação e deploy.
5. Garantir cache seguro, concorrência controlada e rollback.
6. Validar sintaxe e executar dry-run/lint quando disponível.

Nunca imprimir segredos, usar credenciais de produção em PRs não confiáveis ou permitir deploy sem gates definidos.
