# Política de integrações externas

## Perfis

- `core`: capacidades WELLS internas, automáticas e sem serviços externos.
- `recommended`: ferramentas locais ou oficiais, instaladas apenas quando úteis.
- `conditional`: ativadas por sinais do projeto, como uma vault Obsidian.
- `experimental`: alteram routing, memória, endpoints ou executam serviços persistentes.

## Regras

1. Consultar `.agents/integrations/registry.json` e a documentação oficial antes de instalar.
2. Não instalar globalmente uma integração que possa injetar contexto em projetos não relacionados.
3. Não executar comandos de instalação experimental sem confirmação e `--accept-risk`.
4. Não armazenar API keys, tokens ou credenciais no repositório.
5. Evitar sobreposição: um único sistema de memória automática e um único router de modelos ativo por sessão.
6. Verificar licença, origem, manutenção, permissões, hooks, processos e caminhos alterados.
7. Guardar configuração específica da máquina fora do Git; `.agents/` contém apenas fonte, políticas e receitas.
