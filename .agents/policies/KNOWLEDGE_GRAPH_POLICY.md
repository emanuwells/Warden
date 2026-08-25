# Política do grafo de conhecimento

## Objetivo

Compilar conhecimento durável do projeto para evitar releituras extensas e permitir
navegação por relações entre fontes, decisões, componentes, incidentes e evidência.

## Promoção

Criar ou atualizar uma página apenas para conhecimento reutilizável:

- decisão arquitetural ou regra de negócio;
- contrato de API ou integração externa;
- componente crítico e respetivas dependências;
- incidente, causa-raiz e teste de regressão;
- procedimento operacional, limitação ou aprendizagem durável.

Não promover formatação, alterações triviais, logs temporários ou raciocínio transitório.

## Proveniência

Cada página deve conter frontmatter com `id`, `title`, `type`, `status`, `updated`,
`related` e `sources`. Afirmações importantes devem apontar para código, testes,
documentação, issue ou outra fonte registada em `SOURCES.yml`.

## Manutenção

- `INDEX.md` e `GRAPH.json` são gerados; não editar manualmente.
- `LOG.md` é append-only.
- Executar `knowledge build` após alterações estruturais e `knowledge lint` antes de release.
- Marcar decisões substituídas como `superseded` e relacioná-las com a sucessora.
- O grafo complementa o código; nunca prevalece sobre comportamento executado e testes atuais.
