---
name: ssh-server-ops
description: Executa operações SSH, Git e administração remota com segurança, confirmação e rollback. Usar em servidores reais; não ativar para desenvolvimento local.
---

# Operações SSH e servidor

1. Confirmar host, ambiente e objetivo antes de executar.
2. Recolher estado read-only primeiro: serviços, disco, memória, logs e Git.
3. Criar backup ou ponto de rollback antes de alterações.
4. Executar um comando por vez e validar resultado.
5. Evitar alterações manuais não documentadas em produção.
6. Registar comandos relevantes sem segredos.

Reboots, deletes, firewall, permissões, deploy e base de dados exigem confirmação explícita.
