# Compatibilidade entre IDEs e agentes

O formato canónico é Markdown dentro de `.agents/`. Nenhuma IDE é obrigatória.

## Utilização universal

Em qualquer agente capaz de ler o repositório:

```text
Lê .agents/AGENTS.md e segue o carregamento seletivo. Tarefa: <pedido>.
```

## Claude Code

O plugin pessoal em `.agents/adapters/claude/plugin/` pode ser instalado uma vez
com o CLI do Toolkit. O plugin funciona no Claude Code CLI e na extensão oficial,
sem criar ficheiros Claude dentro dos projetos.

## Outros agentes

Codex e Gemini podem receber uma regra pessoal curta através de `configure`.
Cursor pode usar a User Rule fornecida em `.agents/setup/`. Estas integrações são
opcionais; o caminho explícito continua a ser o modo universal e determinístico.

Todos os agentes usam o mesmo `MODEL_ROUTING.md`; nomes concretos de modelos ficam fora do contrato canónico para evitar obsolescência.

Adaptadores específicos só devem ser lidos quando uma limitação da ferramenta o justificar.
