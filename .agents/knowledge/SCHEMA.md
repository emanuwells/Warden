# Schema das páginas de conhecimento

Cada página em `pages/` usa:

```yaml
---
id: identificador-estavel
title: Título legível
type: architecture|component|integration|decision|incident|lesson|operation
status: active|draft|deprecated|superseded|resolved
updated: YYYY-MM-DD
related:
  - outro-id
sources:
  - source-id
---
```

O corpo deve sintetizar responsabilidade, estado atual, relações, decisões, riscos e
evidência relevante. IDs não mudam com renomeações editoriais.
