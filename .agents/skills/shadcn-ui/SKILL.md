---
name: shadcn-ui
description: Gere componentes e composição shadcn/ui quando existe components.json ou pedido explícito; usar comandos read-only primeiro e tratar monorepos explicitamente.
---

# shadcn/ui — wrapper WELLS

## Deteção

Ativar apenas quando existe `components.json`, referência a shadcn ou pedido explícito.

## Processo

1. Detetar package manager e workspace correto.
2. Obter contexto com uma versão CLI fixada e comando read-only aprovado.
3. Usar `--view`, `--dry-run` e `--diff` antes de adicionar ou substituir componentes.
4. Preferir tokens semânticos, variantes e CSS variables.
5. Preservar customizações locais; em monorepos indicar o workspace.

## Segurança

- Não executar `@latest` automaticamente.
- Separar aprovação read-only de operações mutáveis.
