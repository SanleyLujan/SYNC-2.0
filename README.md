# SYNC

**App social esportivo · Autor: Sanley Lujan**

**Documentação revisada em 11/09/2026**, com base no código `ba0ea43` e no plano dos 42 tópicos.

O SYNC combina registro de atividades, descoberta de parceiros, feed, eventos, grupos, chat e gamificação. A versão deste escopo é **web/PWA**, desenvolvida com **TypeScript, React Native, Expo 52 e React Native Web**. O backend usa **NestJS, Express, TypeORM e PostgreSQL**.

- [App web](https://sync-2-0-blush.vercel.app)
- [Repositório](https://github.com/SanleyLujan/SYNC-2.0)
- [CI](https://github.com/SanleyLujan/SYNC-2.0/actions)

Endereços registrados no projeto; esta revisão não confirma disponibilidade ou deploy atual.

## Documentação

| Material | Finalidade |
|---|---|
| [Documentação principal](DOCUMENTACAO.md) | Arquitetura, funcionalidades, segurança, execução e operação |
| [Plano dos 42 tópicos](PLANO_CORRECOES_42_TOPICOS.md) | Status, decisões, pendências e critérios de validação |
| [Inventário técnico](docs/INVENTARIO_TECNICO.md) | Rotas, telas, navegação, migrations e contagens |
| [Modelo de dados](docs/MODELO_DADOS.md) | Classes, campos e relações para diagramas |
| [Guia do TCC](docs/GUIA_TCC.md) | Materiais, telas × casos de uso e burndown |
| [Gamificação](backend/GAMIFICACAO.md) | Missões, XP, níveis e desafios |

A documentação principal substitui descrições antigas do README. Para saber o que funciona e o que está incompleto, usar o plano: arquivo/tela existente não comprova entrega.

## Estado atual

- 🟢 **11** itens resolvidos no código/validação registrada.
- 🟡 **25** itens parciais ou condicionados a testes, configuração, migrations e/ou implementação.
- 🔴 **0** itens classificados como vermelhos na matriz vigente — não significa ausência de bugs.
- ⚫ **4** ocultos/removidos: Stripe, Premium, sensor Bluetooth e coach de áudio.
- 🔵 **2** adiados: persistência de parte das mídias e tracking contínuo com PWA suspenso.

Missões, XP, desafios, conquistas, segmentos, territórios, estatísticas, academias OSM e planejamento de rotas têm implementação no escopo atual, mas permanecem condicionados conforme o plano. Identidade/admin exigem configuração privada e teste operacional.

**Não prometer:** pagamento real, Web Push com navegador fechado, navegação curva a curva, IA generativa, garantia antifraude GPS ou segurança absoluta. Código/configuração nativa não comprovam publicação Android/iOS.

## Tecnologias e tamanho

TypeScript/TSX representam **377 de 389 arquivos de código (96,9%)** e **98,2% dos bytes de código** na base medida. Inclui testes/scripts, exclui dependências/builds/imagens/documentos/JSON. Expo permanece responsável pela entrada e exportação web.

- Interface: React 18.3.1, React Native 0.76.9, Expo ^52.0.0, React Native Web ~0.19.6.
- API: NestJS 10, Express ^4.22.1, TypeORM ^0.3.19, Socket.IO 4.
- Produção configurada: Vercel, Render e PostgreSQL/Supabase.
- Desenvolvimento: SQLite opcional; diferenças de SQL/concorrência exigem testes PostgreSQL.
- Testes: Jest/ts-jest e TypeScript; ver evidências e limites na documentação.

## Executar

Siga [execução local](DOCUMENTACAO.md#execucao-local) para dependências e variáveis. Defina **EXPO_PUBLIC_API_URL de teste explicitamente**, pois o fallback do cliente pode usar produção.

Backend:

```bash
cd backend
npm ci --legacy-peer-deps
npm run start:dev
```

Frontend, em outro terminal:

```bash
cd mobile
npm ci --legacy-peer-deps
npm run web
```

Criar .env locais antes de iniciar, com segredos próprios e sem versioná-los. Para instalar do zero, seguir [provisionamento](DOCUMENTACAO.md#operacao-e-recuperacao), incluindo migrations e [preparação do storage/admin](backend/sql/README.md).

## Segurança e contribuição

Não commitar .env, senhas, chaves privadas, documentos ou dados pessoais. Usar contas fictícias nos testes e no TCC. Acesso à documentação não requer conta administrativa de produção.

Mudanças funcionais devem atualizar testes, documentação e o plano dos 42. Preservar a interface/paleta existente. O projeto ainda precisa de validação física, revisão de segurança e testes operacionais; não há certificação de funcionamento integral.

## Identificação

**Sanley Lujan**. O README anterior declarava licença MIT; não foi encontrado arquivo LICENSE dedicado na base inspecionada. Formalizar o texto da licença antes de afirmar que a autorização de redistribuição está integralmente documentada.
