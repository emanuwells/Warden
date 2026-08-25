# claude-mem — ativação segura

claude-mem é opcional e experimental porque captura tool usage, inicia um worker local
e injeta memória em sessões futuras.

## Antes de instalar

1. Fazer backup de `~/.claude/`.
2. Registar o estado da memória nativa e das definições atuais.
3. Definir exclusões para segredos, dados pessoais e repositórios sensíveis.
4. Decidir a autoridade: claude-mem guarda histórico; `.agents/knowledge/` continua a
   guardar conhecimento curado e versionado.

## Instalação

```bash
npx claude-mem install
```

Depois de reiniciar:

- confirmar worker e hooks;
- confirmar que a memória nativa não foi alterada sem intenção;
- validar volume de contexto injetado;
- testar pesquisa em três camadas antes de pedir observações completas;
- remover se criar duplicação, ruído ou risco de privacidade.
