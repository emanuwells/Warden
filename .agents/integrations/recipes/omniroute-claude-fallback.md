# OmniRoute — fallback controlado para Claude Code

## Objetivo

Continuar uma sessão do Claude Code através de outros modelos/providers quando o
provider primário atinge quota ou fica indisponível. OmniRoute faz routing de modelos;
não transfere automaticamente uma conversa para outra aplicação de agente.

## Instalação

```bash
npm install -g omniroute
omniroute
```

1. Ligar apenas providers autorizados no dashboard local.
2. Criar um combo com ordem explícita, por exemplo:
   - Claude principal;
   - modelo forte alternativo;
   - modelo económico de último recurso.
3. Definir limites de custo, cooldown e número máximo de tentativas.
4. Testar cada modelo isoladamente antes de ativar fallback.
5. Gerar perfis sem alterar a configuração principal:

```bash
omniroute setup-claude --dry-run
omniroute setup-claude
omniroute launch --profile NOME
```

## Guardas WELLS

- Não usar credenciais de subscrição como se fossem API keys.
- Não guardar tokens em ficheiros versionados.
- Não ativar compressão OmniRoute e outra compressão agressiva ao mesmo tempo sem avaliação.
- Não usar fila infinita quando todos os providers respondem 429.
- Manter um perfil Claude direto para rollback.
- Confirmar contexto real de modelos não reconhecidos antes de ajustar auto-compact.
