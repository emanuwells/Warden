---
name: context7-current-docs
description: Consulta documentação atual e específica da versão de bibliotecas/APIs com Context7 antes de implementar quando a correção depende de APIs externas suscetíveis de mudança; não usar para código interno estável.
---

# Context7 Current Docs — wrapper WELLS

## Quando ativar

- APIs, SDKs, frameworks ou bibliotecas que mudam com frequência;
- assinatura/configuração de uma versão concreta;
- erro possivelmente causado por documentação ou memória do modelo desatualizada;
- implementação nova dependente de comportamento externo não confirmado no repositório.

Não usar para substituir a leitura do código local, lockfile, tipos ou testes quando estes já respondem à questão.

## Ordem de autoridade

1. versão realmente instalada no lockfile/manifest;
2. tipos/código/testes da dependência local quando disponíveis;
3. documentação oficial atual obtida via Context7;
4. memória do modelo.

## Processo

1. Identificar biblioteca e versão usada pelo projeto.
2. Se `ctx7` estiver instalado, preferir `ctx7 library <nome> <consulta>` e depois `ctx7 docs <libraryId> <consulta>`.
3. Se não estiver instalado, usar a integração pinada definida em `.agents/integrations/registry.json` ou registar a limitação; não instalar silenciosamente.
4. Pedir apenas a documentação necessária para a decisão atual; não despejar documentação extensa no contexto.
5. Confirmar no código local qualquer detalhe crítico que possa divergir da documentação.
6. Registar a fonte/versão apenas quando a decisão for durável ou material.

## Segurança e privacidade

Não enviar código privado, segredos, dados pessoais ou payloads internos para serviços externos. Formular consultas com nomes públicos de bibliotecas e dúvidas técnicas mínimas.
