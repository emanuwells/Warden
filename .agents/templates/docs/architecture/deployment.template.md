# Arquitetura de Deploy e Operação

## Ambientes

| Ambiente | URL/Host | Origem de configuração | Observações |
|---|---|---|---|
| Local | A definir | `.env` local |  |
| Staging | A definir | A definir |  |
| Produção | A definir | A definir |  |

## Build

- Comando:
- Artefactos gerados:
- Variáveis necessárias:

## Deploy

- Plataforma:
- Estratégia:
- CI/CD:
- Rollback:

## Docker

- Usa Docker? Sim/Não.
- `Dockerfile`:
- `docker-compose`:
- Volumes:
- Redes:

## Observabilidade

- Logs:
- Métricas:
- Alertas:
- Health checks:

## Regras

- Nunca commitar `.env` real.
- Validar build antes de deploy.
- Documentar rollback antes de mexer em produção.
- Separar segredos de configuração versionada.
