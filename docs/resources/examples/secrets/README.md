# Segredos — exemplos

Esta pasta contém apenas documentação e exemplos seguros. Segredos reais ficam em `secrets/` (gitignored).

Copiar para `secrets/` antes de usar:

| Exemplo | Destino runtime |
|---|---|
| `database.json.example` | `secrets/database.json` |
| `slack.json.example` | `secrets/slack.json` — definir `webhook_url` localmente ou usar env `SLACK_WEBHOOK_URL` |
| `production.deploy.local.env.example` | `secrets/production.deploy.local.env` |
| `environments.local.json.example` | `secrets/environments.local.json` |
| `mariadb-dump.cnf.example` | `secrets/mariadb-dump.cnf` |
