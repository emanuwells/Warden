---
name: sql-server-production-safety
description: Escreve e revê T-SQL para SQL Server com segurança, performance e impacto em produção. Usar em SELECTs complexos, DML, índices e troubleshooting SQL.
---

# SQL Server em produção

1. Confirmar tabelas, chaves, cardinalidade e volume.
2. Inspecionar plano de execução quando performance for requisito.
3. Evitar `SELECT *`, conversões implícitas e funções sobre colunas filtradas.
4. Usar parâmetros e transações adequadas; testar DML com `SELECT` equivalente.
5. Tratar `NULL`, precisão decimal, datas e timezone explicitamente.
6. Usar `NOLOCK` apenas com aceitação consciente de dirty/non-repeatable/phantom reads.
7. Para `UPDATE`/`DELETE`, exigir filtro verificável, contagem esperada e rollback.
