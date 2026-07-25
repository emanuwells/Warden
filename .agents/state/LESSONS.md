# Lessons Learned

Aprendizagens reutilizáveis para agentes e para o programador.

---

## 2026-06-18T14:50:00+01:00 — Integração faseada de template de governança

**Contexto:** O repo Warden já tinha uma estrutura `docs/ai/` madura com policies, ops, mcp e skills. O template de governança IA sénior tinha componentes complementares em `docs/ai/` e `docs/architecture/` que não existiam no repo.  
**Aprendizagem:** A integração deve ser faseada e proporcional. Não substituir estrutura existente funcional. Adicionar apenas componentes novos que complementam sem duplicar. Preservar sempre AGENTS.md, PROJECT_CONTEXT.md, COMMANDS.md, CHANGELOG.md, README.md, VERSION, LICENSE, .gitignore e .github.  
**Aplicação futura:** Ao adaptar templates a repositórios existentes, auditar primeiro a estrutura atual, identificar conflitos, e aplicar apenas a fase 1 (núcleo) sem avançar para scripts/adaptadores sem nova ordem.