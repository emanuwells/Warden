# COMMANDS.md

Comandos rápidos do projeto.

Este ficheiro é referência operacional. Não substitui o README.

## Ambiente

| Ação | Comando |
|---|---|
| Instalar dependências | `A confirmar` |
| Configurar ambiente | `cp .env.example .env` |
| Desenvolvimento | `A confirmar` |

## Testes, Lint E Build

| Ação | Comando |
|---|---|
| Testes | `A confirmar` |
| Lint | `A confirmar` |
| Typecheck | `A confirmar` |
| Build | `A confirmar` |

## Dependências

| Ecossistema | Comando |
|---|---|
| Python | `pip install -r requirements.txt` |
| Node.js | `npm install` |
| PHP | `composer install` |
| Docker | `docker compose build` |

## Docker

| Ação | Comando |
|---|---|
| Subir | `docker compose up -d` |
| Logs | `docker compose logs -f` |
| Parar | `docker compose down` |
| Entrar | `docker compose exec <servico> sh` |

## Git

| Ação | Comando |
|---|---|
| Estado | `git status --short` |
| Branch | `git branch --show-current` |
| Remotes | `git remote -v` |
| Fetch | `git fetch origin` |
| Pull | `git pull origin <branch>` |

## GitHub Via SSH

| Ação | Comando |
|---|---|
| Testar ligação | `ssh -T git@github.com` |
| Ver remotes | `git remote -v` |

## Higiene

| Ação | Comando |
|---|---|
| Ver não rastreados | `git status --short` |
| Procurar temporários | `find . -name "*.tmp" -o -name "*.bak" -o -name "*.old"` |

## Comandos Proibidos Sem Confirmação

```bash
git reset --hard
git clean -fd
git push --force
docker compose down -v
rm -rf
DROP DATABASE
TRUNCATE TABLE
systemctl restart
reboot
```


## MCP

| Ação | Comando |
|---|---|
| Ver exemplos MCP | `ls .agents/mcp` |
| Ver política MCP | `cat .agents/mcp/MCP_POLICY.md` |
| Ver config genérica | `cat .agents/mcp/mcp.example.json` |
| Ver config Cursor | `cat .agents/mcp/cursor.mcp.example.json` |
| Ver config VS Code | `cat .agents/mcp/vscode.mcp.example.json` |
| Ver config Claude | `cat .agents/mcp/claude.mcp.example.json` |

Não imprimir configs reais se tiverem tokens, paths sensíveis ou credenciais.

## Gestão MCP

| Ação | Comando |
|---|---|
| Rever política MCP evolutiva | `cat .agents/mcp/MCP_POLICY.md` |
| Ver exemplos MCP | `find .agents/mcp -maxdepth 2 -type f` |
| Procurar configs MCP reais | `find . -name "*mcp*.json" -o -name ".mcp.json"` |

Não imprimir configs reais se tiverem tokens, paths sensíveis ou credenciais.
