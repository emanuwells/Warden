# Compatibilidade entre IDEs e agentes

O formato canónico é Markdown dentro de `.agents/`. Nenhuma IDE é obrigatória.

## Utilização universal

Em qualquer agente capaz de ler o repositório:

```text
Lê .agents/AGENTS.md e segue o carregamento seletivo. Tarefa: <pedido>.
```

## Deteção automática opcional

O `WELLS_AI_Toolkit` pode instalar uma instrução global curta para Claude Code,
Codex e Gemini CLI. Para Cursor e ferramentas semelhantes, existe uma regra de
utilizador pronta a copiar. Esta configuração é opcional; o prompt universal
continua a funcionar sem ela.

Adaptadores específicos vivem em `.agents/adapters/` e só devem ser lidos quando
uma limitação da ferramenta o justificar.
