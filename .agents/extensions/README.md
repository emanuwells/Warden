# Extensões WELLS

Skills universais vivem em `.agents/skills/` e são carregadas pelo router apenas
quando necessárias. O CLI regenera automaticamente `.agents/core/SKILLS.md` ao
criar uma skill. O `INDEX.md` só precisa de nova linha quando a capacidade merece
uma rota explícita.

Hooks e plugins executáveis personalizados começam desativados e exigem revisão explícita antes de ativação. A única exceção built-in é `safe-output-hygiene`: corre no fecho, é determinístico, não chama LLM e não remove metadata/proveniência.

## Criar uma skill

```bash
node .agents/tools/wells-toolkit.mjs add --project . --type skill --name nome --description "Quando e para que usar" --apply
```

## Criar e ativar um hook

```bash
node .agents/tools/wells-toolkit.mjs add --project . --type hook --name nome --description "Objetivo do hook" --event PostToolUse --apply
node .agents/tools/wells-toolkit.mjs enable --project . --type hook --name nome --apply
```

O dispatcher Claude pessoal executa apenas hooks com `enabled: true`, restringe o
handler à pasta da extensão, usa Node diretamente sem shell e não faz chamadas ao
modelo. Para desativar:

```bash
node .agents/tools/wells-toolkit.mjs disable --project . --type hook --name nome --apply
```

## Criar scaffolding de plugin

```bash
node .agents/tools/wells-toolkit.mjs add --project . --type plugin --name nome --description "Objetivo do plugin" --apply
```

Revê sempre scripts, permissões, ferramentas e segredos antes de ativar qualquer
extensão executável.
