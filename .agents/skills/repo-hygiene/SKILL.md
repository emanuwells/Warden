---
name: repo-hygiene
description: Audita estrutura e remove ficheiros temporários, duplicados ou obsoletos com prova de não utilização. Usar em limpeza explícita; não misturar com feature/bugfix.
---

# Higiene do repositório

1. Listar candidatos e respetivas referências.
2. Confirmar uso em imports, scripts, CI, documentação e build.
3. Distinguir gerado, cache, artefacto, fonte e configuração.
4. Remover em lotes pequenos e reversíveis.
5. Atualizar `.gitignore` apenas para padrões realmente gerados.
6. Executar testes/build após remoção.

Nunca apagar ficheiros apenas por nome ou data sem verificar dependências.
