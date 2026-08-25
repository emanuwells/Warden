---
name: mcp-server-operator
description: Seleciona, configura e audita servidores MCP com permissões mínimas. Usar quando a tarefa exige ferramentas/contexto externo; não instalar MCP por conveniência.
---

# Operação de MCP

1. Confirmar a capacidade necessária e se uma CLI/API existente é suficiente.
2. Verificar origem, manutenção, permissões e dados acessíveis.
3. Preferir read-only e escopo mínimo.
4. Manter segredos fora do repositório e usar variáveis de ambiente.
5. Testar conexão e tools expostas antes de ativar escrita.
6. Documentar instalação, desativação e riscos.

Bases de dados, GitHub com escrita, browser automation, Docker, SSH e produção exigem confirmação explícita.
