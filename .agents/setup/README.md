# Configuração pessoal opcional

O runtime universal não exige configuração: em qualquer agente usa
`Lê .agents/AGENTS.md e <tarefa>.`.

Para ativar integração nativa no Claude Code sem criar ficheiros no projeto:

```bash
node .agents/tools/wells-toolkit.mjs configure --agent claude --apply
```

Para configurar também ponteiros globais do Codex e Gemini CLI:

```bash
node .agents/tools/wells-toolkit.mjs configure --agent all --apply
```

As alterações são feitas apenas no perfil do utilizador. O repositório continua
com uma única pasta de IA: `.agents/`.
