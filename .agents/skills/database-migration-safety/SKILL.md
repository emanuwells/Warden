---
name: database-migration-safety
description: Planeia e valida alterações de schema ou migrações de dados com compatibilidade, backup e rollback. Usar em DDL, backfills e mudanças persistentes; não usar para SELECT isolado.
---

# Segurança de migrações

1. Classificar operação: aditiva, destrutiva, backfill ou alteração de tipo.
2. Medir volume, locks, duração e compatibilidade com versões anteriores.
3. Preferir expand-and-contract para mudanças sem downtime.
4. Definir backup, rollback e verificação pós-migração.
5. Tornar scripts idempotentes quando possível.
6. Testar numa cópia representativa antes de produção.

Não executar `DROP`, `TRUNCATE`, alteração irreversível ou atualização massiva sem confirmação explícita e plano de recuperação.
