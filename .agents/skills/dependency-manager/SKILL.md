---
name: dependency-manager
description: Avalia, adiciona, atualiza ou remove dependências com foco em necessidade, segurança, compatibilidade e lockfiles. Usar quando o grafo de dependências muda.
---

# Gestão de dependências

1. Confirmar que a funcionalidade não existe já na stack.
2. Verificar manutenção, licença, vulnerabilidades, tamanho e compatibilidade.
3. Aplicar a menor atualização compatível e preservar lockfile.
4. Rever breaking changes e migrações oficiais.
5. Executar testes, build e análise de segurança disponíveis.
6. Documentar dependência apenas quando afeta instalação ou arquitetura.

Não atualizar dependências não relacionadas numa correção localizada.
