---
name: secrets-layout-guardian
description: Protege segredos, ficheiros `.env`, chaves, SSH e credenciais. Usar quando a tarefa toca autenticação, configuração sensível ou estrutura local.
---

# Proteção de segredos

- Nunca ler, copiar, imprimir ou versionar valores reais sem necessidade e autorização.
- Usar `.env.example` com nomes e placeholders, não valores.
- Manter chaves privadas, tokens e credenciais fora do Git.
- Aplicar permissões mínimas e rotação quando houver exposição.
- Rever histórico Git se um segredo tiver sido commitado.
- Logs, screenshots e fixtures também podem conter dados sensíveis.

Bloquear escrita em ficheiros de credenciais quando a tarefa não o exigir.
