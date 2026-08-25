# Docker MCP Toolkit — gateway opcional

Usar quando existem vários MCPs e clientes/agentes e é útil centralizar isolamento, lifecycle, credenciais e perfis.

## WELLS

- configuração de utilizador/máquina, nunca requisito do repo;
- preferir servidores containerizados verificados e permissões mínimas;
- não expor sockets, bases de dados ou filesystem inteiro sem necessidade;
- manter MCPs desligados quando não são necessários.

O Docker MCP Toolkit/Gateway é uma opção de gestão, não substitui as policies WELLS nem torna MCP obrigatório.
