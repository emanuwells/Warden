---
name: visual-foxpro-phc
description: Trabalha com Visual FoxPro e customizações PHC: cursores, aliases, buffering, objetos SBO, SQL pass-through e eventos. Usar em código VFP/PHC.
---

# Visual FoxPro e PHC

- Confirmar contexto do evento, alias selecionado e existência de objetos (`SBO`, `BO`, cursores).
- Preservar `SELECT()` atual quando a rotina navega entre aliases.
- Tratar `VARTYPE()`, `EMPTY()`, datas `D/T` e conversões explicitamente.
- Validar buffering antes de `TABLEUPDATE()`/`TABLEREVERT()` e resolver alterações pendentes.
- Evitar macros `&` e SQL concatenado quando existe alternativa segura.
- Em `TEXT TO ... ENDTEXT`, confirmar escaping, tipos e parâmetros.
- Registar erros com número, mensagem, procedimento e linha sem ocultar a causa.
- Testar num dossier/registo controlado antes de aplicar em produção.
