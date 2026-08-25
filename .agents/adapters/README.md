# Adaptadores

`.agents/AGENTS.md` é a única fonte canónica do projeto. Os adaptadores vivem
nesta pasta e são opcionais: nunca exigem `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`
ou pastas específicas de fornecedor na raiz.

O adaptador Claude instala um plugin pessoal para hooks/subagentes e skills pessoais manuais com comandos curtos. Os restantes agentes continuam a funcionar através
do prompt universal com o caminho explícito.
