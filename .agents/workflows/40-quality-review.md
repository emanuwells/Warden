# Workflow 40 — Revisão de Qualidade

## Objetivo

Rever código ou diff como equipa sénior antes de aceitar alterações.

## Checklist

- comportamento preservado;
- nomes claros;
- dependências justificadas;
- erros tratados;
- testes úteis;
- docs atualizadas;
- segredos protegidos;
- comandos validados;
- ficheiros inúteis removidos;
- changelog atualizado.

## Segurança proporcional

Para auth, dependências, infra, secrets ou release, executar `security-quality-gate` numa fase separada; não declarar scan limpo se a toolchain estiver ausente.

## Saída

Classificar problemas por severidade: crítico, alto, médio, baixo.
