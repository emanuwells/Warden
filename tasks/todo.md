# Tarefas — Arquivo d4maia + limpeza produção

## Estado

**Concluído** — arquivo pré-2024 e DROP (2026-06-01).

## Checklist d4maia

- [x] Inventário 16 tabelas (ano ≤2023)
- [x] Dumps para `C:\Users\cmm1490\Downloads\d4maia\tables`
- [x] Verificação gzip + manifest `dump_ok`
- [x] DROP em produção (após correção deteção de tabelas)
- [x] HANDOFF + CHANGELOG 2.0.4

## Checklist documentação (AGENTS.md)

- [x] README com badges, Mermaid, estrutura, secções obrigatórias (2.0.6)
- [x] PROJECT_CONTEXT + HANDOFF + lessons atualizados
- [ ] Licença (`LICENSE`) — A confirmar
- [ ] CI/CD — A confirmar

## Checklist limpeza (anterior)

- [x] Secrets SSH de WELLS_API
- [x] CleanTron + Warden janitor

## Resultado disco

`/`: ~98% → **~89%** (~11 GB livres) após DROP das tabelas históricas.
