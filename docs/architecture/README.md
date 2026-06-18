# Arquitetura

Esta pasta descreve a arquitetura real do projeto. Deve ser atualizada quando houver alterações estruturais, decisões permanentes ou novos componentes relevantes.

## Ficheiros

- `overview.md`: visão geral e limites do sistema.
- `frontend.md`: arquitetura frontend, estado, rotas, componentes e integração API.
- `backend.md`: arquitetura backend, domínio, APIs, validação, autenticação e erros.
- `database.md`: modelo de dados, migrações, índices, integridade e rollback.
- `deployment.md`: ambientes, build, deploy, CI/CD, Docker e rollback operacional.
- `decisions.md`: resumo vivo das decisões técnicas principais; ADRs detalhados vivem em `docs/adr/`.

## Regra

A documentação deve refletir o código real. Quando houver divergência, o agente deve verificar o código antes de alterar documentação ou arquitetura.