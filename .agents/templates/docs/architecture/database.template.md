# Arquitetura de Base de Dados

## Tecnologia

- Motor:
- ORM/migrações:
- Ambiente local:
- Backup/restore:

## Modelo de Dados

| Entidade/Tabela | Responsabilidade | Dados sensíveis | Observações |
|---|---|---|---|
| A definir | A definir | A definir |  |

## Regras

- Usar migrações versionadas quando o projeto suportar.
- Evitar alterações destrutivas sem plano de rollback.
- Criar índices com base em queries reais.
- Preservar integridade referencial.
- Não guardar segredos em texto claro.
- Não executar scripts destrutivos contra produção sem confirmação explícita.

## Migrações

Cada migração relevante deve documentar:

- motivo;
- impacto;
- compatibilidade;
- rollback;
- validação.

## Performance

- Queries críticas:
- Índices conhecidos:
- Gargalos:

## Backup e Rollback

- Estratégia local:
- Estratégia produção:
- Comando de restore testado:
