---
name: frontend-component-architecture
description: Estrutura componentes frontend, estado, composição e fronteiras de responsabilidade. Usar em componentes novos ou refactors de UI significativos.
---

# Arquitetura de componentes

- Componentes devem ter uma responsabilidade observável.
- Estado deve viver no nível mais próximo que o partilha.
- Separar dados, comportamento e apresentação apenas quando melhora clareza/testabilidade.
- Preferir composição a flags e componentes gigantes.
- Evitar efeitos para derivar estado calculável.
- Preservar acessibilidade, loading, erro e estados vazios.

Extrair abstrações após padrões repetidos, não por antecipação.
