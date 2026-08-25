# Ferramentas Windows

- `WELLS_Configurar_Agentes.cmd`: instala opcionalmente o plugin pessoal Claude Code e regras globais adicionais.
- `WELLS_Adotar_Projeto.cmd`: seleciona e migra um projeto existente.
- `WELLS_Aplicar_A_Projeto.cmd`: migração segura através de caminho colado.
- `WELLS_Atualizar_Projeto.cmd`: sincroniza a biblioteca sem substituir estado local.
- `WELLS_Auditar_Projeto.cmd`: valida estrutura, versões, skills e orçamento de contexto.

Os assistentes mostram primeiro uma simulação e pedem confirmação antes de escrever.
Nenhum deles é obrigatório: todos chamam o mesmo CLI Node.js documentado em `COMMANDS.md`.

## WELLS_Configurar_Integracoes.cmd

Gera planos de instalação por perfil sem executar instaladores externos.

## WELLS_Conhecimento.cmd

Regenera e valida o knowledge graph do projeto.
