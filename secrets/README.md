# Secrets Directory

Pasta local para credenciais e acesso SSH a produção (BAZE2). **Nunca commitar ficheiros reais.**

## Configuração rápida (copiar de WELLS_API)

Se já tens o repo [WELLS_API](https://github.com/emanuwells/WELLS_API) configurado:

```powershell
$src = "..\WELLS_API\secrets"
Copy-Item "$src\production.deploy.local.env" "secrets\production.deploy.local.env" -Force
Copy-Item "$src\environments.local.json" "secrets\environments.local.json" -Force
New-Item -ItemType Directory -Force -Path "secrets\.ssh" | Out-Null
Copy-Item "$src\.ssh\id_ed25519" "secrets\.ssh\id_ed25519" -Force
```

Alternativa: copiar `secrets/production.deploy.local.env.example` → `secrets/production.deploy.local.env` e preencher host/utilizador.

## Ficheiros

| Ficheiro | Função |
|---|---|
| `production.deploy.local.env` | Host, user, porta SSH e path do Warden em produção |
| `environments.local.json` | Perfis SSH/DB (opcional; partilhado com WELLS_API) |
| `.ssh/id_ed25519` | Chave privada para deploy (mesma do WELLS_API) |
| `database.json` | Credenciais MariaDB do collector (copiar de `database.json.example`) |
| `slack.json` | Webhooks Slack (copiar de `slack.json.example`) |

## Scripts

```powershell
# Comando remoto arbitrário
.\scripts\Invoke-WardenSsh.ps1 -RemoteCommand "df -h /"

# Limpeza segura (Warden + CleanTron dry-run + execução)
.\scripts\run-production-cleanup.ps1

# Só simular CleanTron
.\scripts\run-production-cleanup.ps1 -DryRunOnly
```

Para CleanTron em SSH não interativo sem TTY, podes definir (localmente, nunca no Git):

```env
WARDEN_SUDO_PASSWORD=...
```

no `production.deploy.local.env`.

## Regras

- Usar apenas ficheiros `*.example` como modelos versionados.
- Não publicar `secrets/` no servidor de produção.
- Rotacionar chaves se forem expostas acidentalmente.
