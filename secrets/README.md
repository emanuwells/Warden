# Secrets

Esta pasta contém **apenas segredos reais** em runtime local ou produção. Fica fora do Git (exceto este README).

## Exemplos seguros

Copiar modelos de `docs/resources/examples/secrets/`:

```bash
cp docs/resources/examples/secrets/database.json.example secrets/database.json
cp docs/resources/examples/secrets/production.deploy.local.env.example secrets/production.deploy.local.env
mkdir -p secrets/.ssh
cp /path/to/id_ed25519 secrets/.ssh/id_ed25519
chmod 600 secrets/.ssh/id_ed25519
```

Ver também `docs/resources/examples/config/` para ficheiros `.env.docker` e variantes.
