# Política de Raiz Limpa

## Objetivo

Manter a raiz do repositório o mais limpa possível, preservando apenas ficheiros e pastas que um programador sénior esperaria encontrar num projeto profissional.

## Permitido na raiz

- `README.md`
- `AGENTS.md`
- `PROJECT_CONTEXT.md`, apenas quando preenchido no projeto real
- `COMMANDS.md`
- `CHANGELOG.md`
- `VERSION`
- `LICENSE`
- `.gitignore`
- `.gitignore.template`
- `.editorconfig`
- `.env.example`
- `.gitattributes`
- `.github/` para templates, workflows e metadados GitHub
- `docs/`
- `tasks/`
- `scripts/`
- `tools/`
- pastas reais do produto, como `src/`, `app/`, `api/`, `frontend/`, `backend/`, `infra/`, `tests/`, quando existirem

## Localizações fora da raiz

- `docs/templates/PROJECT_CONTEXT.template.md` para o template de contexto.
- `docs/governance/CONTRIBUTING.md` para contribuição e processo.
- `.github/SECURITY.md` para política de segurança reconhecida pelo GitHub.

## Evitar na raiz

- ficheiros específicos de ferramentas IA que não estejam ativos;
- múltiplos contratos concorrentes de agentes;
- dumps, exports, logs, caches e ficheiros temporários;
- documentação longa que pertence a `docs/`;
- exemplos de segredos ou credenciais fictícias fora de `docs/examples/`;
- adaptadores de IDE não utilizados.

## Adaptadores

Adaptadores específicos devem ficar em:

```text
tools/ai-adapters/
```

Só devem ser copiados para a raiz quando a ferramenta for realmente usada no projeto.

## Critério sénior

Um novo programador deve conseguir abrir a raiz do repo e perceber rapidamente:

1. o que é o projeto;
2. como arrancar;
3. como testar;
4. como a IA deve operar;
5. onde está a documentação detalhada;
6. onde encontrar contribuição e segurança quando necessário.