# SYNC — Documentação técnica, funcional e operacional

**Autor:** Sanley Lujan

**Revisão documental:** 11/09/2026

**Código-base inspecionado:** `ba0ea43`, antes desta atualização documental.

**Plataforma entregue neste escopo:** web/PWA. Existem código e configurações Android/iOS; não há comprovação nesta revisão de publicação/homologação de aplicativos nativos.

## Como usar

Esta referência foi revisada contra código e configurações versionados. Não é certificado de funcionamento em produção, segurança, disponibilidade ou conformidade legal.

- [Plano dos 42 tópicos](PLANO_CORRECOES_42_TOPICOS.md): referência de pendências, decisões e critérios de aceitação.
- [Inventário técnico](docs/INVENTARIO_TECNICO.md): rotas, telas, registros de navegação, migrations e contagens.
- [Modelo de dados](docs/MODELO_DADOS.md): todas as classes TypeORM, campos, tipos e associações.
- [Guia do TCC](docs/GUIA_TCC.md): materiais e rastreabilidade para telas, casos de uso, diagramas e burndown.
- [Gamificação](backend/GAMIFICACAO.md): regras de missões, XP, níveis e desafios.

**Código implementado, teste aprovado, deploy concluído e validação no aparelho são evidências diferentes.** Não tratar existência de arquivo, campo de banco ou endpoint como prova de uma funcionalidade completa.

## Índice

1. [Visão geral](#visao-geral)
2. [Arquitetura e stack](#arquitetura)
3. [Estado funcional e os 42 tópicos](#requisitos-complementares)
4. [Telas e fluxos](#telas)
5. [Dados e contratos](#dados)
6. [API e tempo real](#api)
7. [Autenticação, administração e identidade](#autenticacao-e-identidade)
8. [Mapas, GPS e treino](#mapas)
9. [Gamificação e relações sociais](#gamificacao)
10. [Interface, tema e PWA](#design-system)
11. [Segurança e limitações](#seguranca)
12. [Execução local](#execucao-local)
13. [Variáveis de ambiente](#variaveis)
14. [Provisionamento, publicação e recuperação](#operacao-e-recuperacao)
15. [Testes e critérios de aceite](#testes)
16. [Manutenção](#manutencao)

<a id="visao-geral"></a>

## 1. Visão geral

O SYNC é um aplicativo social esportivo para registrar atividades, encontrar pessoas com interesses esportivos, organizar eventos e acompanhar progresso. A interface tem sete abas: **Feed, Descobrir, Mapa, Treinar, Grupos, Chat e Perfil**.

Reúne cadastro/confirmação de email, perfil, descoberta/match, feed, atividades, localização, eventos, grupos, notificações internas e gamificação. Há painel administrativo para denúncias e análise manual de identidade. Várias funções ainda dependem de testes físicos, infraestrutura ou complementação.

Não apresentar como entregues: pagamento real/Premium, sensor Bluetooth, coach de áudio, tracking contínuo com PWA suspenso, Web Push com app fechado, IA generativa, navegação curva a curva ou armazenamento permanente de todas as mídias.

<a id="arquitetura"></a>

## 2. Arquitetura e stack

### 2.1 Organização

```text
Frontend React Native + Expo + React Native Web (PWA / Vercel)
  ├─ HTTPS → API NestJS + Express (Render)
  │           ├─ TypeORM → PostgreSQL (Supabase)
  │           ├─ Storage privado de identidade (Supabase Storage)
  │           ├─ uploads/ locais para parte das mídias comuns
  │           └─ email, clima e consulta de academias
  ├─ Socket.IO → namespaces /chat e /tracking
  └─ chamadas web a mapas, roteamento e geocodificação
```

Autenticação é da API NestJS: **não é Supabase Auth**. Supabase fornece banco e armazenamento privado de identidade.

O backend tem buffers, caches e salas em memória, além de arquivos locais. **Não é totalmente stateless** nem está pronto para escalar horizontalmente sem coordenação adicional de sockets, caches, jobs e armazenamento.

### 2.2 Tecnologias verificadas

Versões são declarações dos manifestos, não afirmações de última versão disponível ou de versão efetivamente implantada. Lockfiles determinam a resolução da instalação.

| Camada | Tecnologia declarada | Função |
|---|---|---|
| Linguagem | TypeScript ^5.3.0 no frontend / ^5.3.3 no backend; TSX nas interfaces | Frontend e backend |
| Interface | React 18.3.1; React Native 0.76.9 | Componentes, telas e estilos |
| Ferramentas | Expo ^52.0.0 | Entrada, desenvolvimento, módulos e exportação web |
| Navegador | React Native Web ~0.19.6 | Renderização web |
| Navegação/estado | React Navigation 6; Zustand 4 | Stacks/abas, sessão e preferências |
| API | NestJS 10; Express ^4.22.1 | HTTP, módulos e controllers |
| Persistência | TypeORM ^0.3.19; pg ^8.11.3 | PostgreSQL |
| Desenvolvimento local | better-sqlite3 ^12.8.0, opcional | SQLite; não reproduz toda a semântica PostgreSQL |
| Tempo real | Socket.IO 4.x | Chat e atividade |
| Mapas | Leaflet ^1.9.4; react-native-maps 1.18.0 | Web / caminho nativo |
| Localização | navigator.geolocation / expo-location ~18 | Navegador / nativo |
| Segurança/mídia | bcrypt, Helmet, class-validator, Multer, sharp | Senhas, headers, validação, uploads e reencodificação de identidade |
| Testes | Jest 29; ts-jest; TypeScript | Testes unitários e verificação estática |
| CI | GitHub Actions, Node.js 20 | Typecheck e testes dos dois projetos |

Fontes: [frontend](mobile/package.json), [backend](backend/package.json), [CI](.github/workflows/ci.yml).

**Expo continua ativo:** entrada `expo/AppEntry.js`, TypeScript estendendo `expo/tsconfig.base`, Metro usando configuração Expo e Vercel executando `expo export --platform web`. TypeScript é a linguagem, não substituto do Expo.

### 2.3 Composição do código

Na base inspecionada: **377 arquivos TS/TSX entre 389 arquivos de código**, 96,9% por quantidade e 98,2% por bytes. Inclui testes/scripts; exclui documentos, imagens, JSON, lockfiles, dependências e builds. GitHub pode usar outro critério.

Há **59 arquivos de telas, 40 classes TypeORM, 16 migrations e 33 arquivos de testes**. Existem 26 controllers no código; 25 são alcançados pela configuração de módulos, contendo 171 decorators HTTP. Arquivo, rota registrada e funcionalidade validada são contagens diferentes: ver [inventário](docs/INVENTARIO_TECNICO.md).

### 2.4 Estrutura

| Caminho | Responsabilidade |
|---|---|
| backend/src | Domínios, entidades, DTOs, guards, serviços, migrations e testes |
| backend/sql | Preparação de storage/admin e promoção posterior de contas |
| backend/scripts | Verificações em PostgreSQL isolado via PGlite |
| mobile/App.tsx | Inicialização e entradas por links web |
| mobile/src/screens · navigation | Telas e registros de navegação |
| mobile/src/components · services · utils | Interface, comunicação e cálculos |
| mobile/src/store · theme | Estado e identidade visual |
| mobile/public | Manifesto, ícones e service worker |
| mobile/scripts/postbuild.js | Assets estáticos e metadados PWA do HTML exportado |
| docs | Inventários e apoio ao TCC |

<a id="requisitos-complementares"></a>

## 3. Estado funcional e os 42 tópicos

O [plano](PLANO_CORRECOES_42_TOPICOS.md) mantém a numeração oficial. Esta revisão documental **não promove itens de cor nem implementa pendências**.

| Cor | Quantidade | Significado |
|---|---:|---|
| 🟢 | 11 | Resolvido no código/validação registrada; ainda sujeito a regressão operacional |
| 🟡 | 25 | Parcial ou condicionado a configuração, migration, deploy e/ou teste |
| 🔴 | 0 | Nenhum item vermelho na matriz vigente; não significa ausência de bugs ou promessas a revisar |
| ⚪ | 0 | Nenhum nessa classificação |
| ⚫ | 4 | Removido/oculto por decisão |
| 🔵 | 2 | Adiado conscientemente |

### 3.1 Amarelos implementados no escopo atual, mais próximos da validação

| Itens | Implementação existente | Falta confirmar |
|---|---|---|
| 9 | Live com token, reconexão, revogação e reconciliação REST | Duas redes/aparelhos, perda de sinal, restart e fim |
| 25 | Regras de conquistas e desbloqueio idempotente | Regras no celular após migration; oito regras não confiáveis fora do catálogo novo |
| 26 | Missões por conta/dia | Renovação, modalidades, progresso e recompensa única |
| 27 | XP unificado e teto diário | Concorrência e consistência entre telas/sessões |
| 28 | Territórios por percurso concluído e opt-in | Campo, reenvios e virada mensal |
| 29 | Segmentos por percurso e tempos calculados | Percurso contínuo real, limites e rankings |
| 30 | Desafios com aceite e limites | Convite, aceite, prazo e recompensa nas duas contas |
| 31 | Academias cadastradas no OSM | Cobertura, carregamento, falha e uso no celular |
| 32 | Rota planejada persistida no treino | Reabrir, esporte, GPS ausente/desvio e CSP; não é navegação curva a curva |
| 35 | Seguir separado de curtir/match | Desfazer, bloqueios, interesse pendente e ranking |
| 38 | Estatísticas agregadas/contrato versionado | Conta vazia, histórico longo, unidades e modalidades |

Não declarar “100% prontos” sem confirmar backend/frontend/migrations e exercitar os cenários.

### 3.2 Configuração sensível e teste operacional

**1 e 23 — identidade/administração:** confirmar migrations, bucket privado, variáveis apenas no backend, permissão ADM e análise com imagens fictícias. Não coletar documentos reais para testar instalação não revisada.

### 3.3 Amarelos com implementação/decisão ainda necessária

| Item | Pendência |
|---:|---|
| 7 | Revogação de sockets já abertos; validar sessão entre abas/aparelhos |
| 12 | Sincronização durável de pausas offline e calibração em campo |
| 21 | Web Push completo não implementado; aviso de indisponibilidade fora do app |
| 24 | Presença, confirmação de entrega e fila durável de chat/mídia |
| 33 | Calendário de treino sem conclusão vinculada/adaptação |
| 34 | “IA Coach” usa heurísticas; renomear ou integrar IA real |
| 36 | Reciclagem de descartes e consequência própria do Super Like |
| 37 | Integração de entrada das telas de stories, upload/player, likes e limpeza |
| 39 | Convites e transferência segura de administração do grupo |
| 40 | Lotação atômica e completar lembretes/deep links |
| 41 | Tema, contraste, leitor de tela e recuperação de erros em todas as telas |
| 42 | E2E, revisão de segurança/dependências, staging, backup/restore e monitoramento |

### 3.4 Demais estados

- 🟢 **2, 3, 6, 10, 11, 14, 17, 18, 19, 20 e 22:** proteção de rotas/atividades e salas, recuperação de senha, GPS/cronômetro, metas/métricas/recordes, mensagens, preferências e descrição do Safety Center. Critérios e evidências no plano.
- ⚫ **4, 5, 15 e 16:** Stripe/Premium, sensor Bluetooth e coach de áudio não devem ser descritos como entregues.
- 🔵 **8:** parte das mídias permanece em disco efêmero no arranjo atual de hospedagem.
- 🔵 **13:** tracking com PWA suspenso adiado. Manter tela aberta e dispositivo desbloqueado.

<a id="telas"></a>

## 4. Telas e fluxos

A raiz consulta sessão/onboarding. Sem sessão: autenticação; com sessão e onboarding incompleto: preferências esportivas; depois: sete abas.

| Área | Fluxos | Condições |
|---|---|---|
| Autenticação | Apresentação, cadastro, login, código e recuperação | CPF válido e email configurado no cadastro real |
| Onboarding | Esportes, nível, objetivos, interesses, disponibilidade, localização e fotos | Nível esportivo declarado diferente de nível por XP |
| Feed/Descobrir | Publicações, comentários, busca, perfis, interesse e matches | Privacidade, bloqueios e visibilidade |
| Mapa | Eventos, academias, filtros, localização, rota e territórios | Permissão GPS e serviços externos |
| Treinar | Preparação, treino, pausas, resumo e histórico | Web em primeiro plano; unidades por modalidade |
| Perfil | Edição, recordes, conquistas, estatísticas, ranking e desafios | Recursos amarelos condicionados |
| Grupos/Eventos | Criação, participação, membros e detalhes | Convites/admin e lotação parciais |
| Chat | Lista e conversa entre matches | Não prometer entrega offline/presença perfeita |
| Configurações | Tema, notificações, segurança, acessibilidade, identidade e suporte | ADM autorizado também no backend |

O [inventário](docs/INVENTARIO_TECNICO.md#telas-e-pontos-de-entrada) relaciona cada arquivo e entrada. Live, confirmação legada e redefinição de senha são ramos diretos no App.tsx por links/tokens.

A revisão estática encontrou **CreateStoryScreen.tsx e StoryViewerScreen.tsx sem importação/registro de entrada no fluxo atual**. É pendência de integração do item 37, não uma entrega completa apenas pela existência de telas/API.

<a id="dados"></a>

## 5. Dados e contratos

### 5.1 Persistência

O bootstrap usa PostgreSQL quando **NODE_ENV=production**; em desenvolvimento usa SQLite. A CLI de migrations também considera DATABASE_URL para escolher PostgreSQL. Os caminhos diferem: definir apenas DATABASE_URL não altera o bootstrap de desenvolvimento.

Entidades são descobertas por padrão de arquivo. A tabela subscription_transactions pode existir embora a API de assinaturas esteja desmontada. Não apagar legado só porque a interface não o usa.

O [modelo de dados](docs/MODELO_DADOS.md) contém 40 classes e propriedades. Constraints e índices das migrations precisam ser conferidos no DER físico. Coordenadas são numéricas e há cálculos de distância: não afirmar que todas as consultas dependem de PostGIS apenas por uma descrição antiga do pacote.

Domínios: contas/sessões/privacidade; atividades/pontos/comentários/avaliações; likes/matches/follows/chat; feed; grupos/eventos; gamificação; notificações/stories/feedback; identidade; legado de assinaturas.

O catálogo de conquistas é código e seus desbloqueios ficam em **user_achievements**. Missões usam **gamification_rewards**. Metas rápidas são campos de **activities**, não nova tabela. Não inventar entidades adicionais no DER por arrays/JSON serializados.

### 5.2 Unidades e compatibilidade

- Atividades: metros, segundos e kcal estimadas.
- Metas: tipo distance/duration, valor em metros/segundos.
- Corrida: ritmo min/km; ciclismo: velocidade km/h; academia: tempo como medida principal.
- Estatísticas novas: **GET /api/stats?version=2**, schemaVersion 2 e unidades explícitas. Sem versão, mantém contrato legado em km/horas para clientes antigos.
- Totais vêm de atividades concluídas agregadas no servidor, não apenas primeira página de histórico. Calorias históricas ausentes não são reconstruídas.
- XP/missões/territórios usam regras de dia/mês de Brasília onde indicado. Não atribuir esse fuso automaticamente a todos os cron jobs.

<a id="api"></a>

## 6. API e tempo real

O [inventário da API](docs/INVENTARIO_TECNICO.md#api-rest) traz todos os caminhos/handlers. Controllers declaram api/...; não há prefixo global adicional.

| Ação | Endpoint |
|---|---|
| Cadastro/login | POST /api/auth/register · POST /api/auth/login |
| Confirmar email | POST /api/auth/verify-email-code |
| Recuperar/redefinir | POST /api/auth/forgot-password · POST /api/auth/reset-password |
| Sessão | POST /api/auth/refresh · POST /api/auth/logout · GET /api/auth/sessions |
| Perfil | GET/PUT /api/users/me |
| Iniciar/finalizar treino | POST /api/activities/start · PUT /api/activities/:id/finish |
| GPS | POST /api/activities/:id/points · POST /api/activities/:id/points/batch |
| Histórico/recordes | GET /api/activities/history · GET /api/activities/records |
| Live | POST/DELETE /api/activities/:id/share · GET /api/activities/live/:token |
| Administração | GET /api/admin/moderation · PUT /api/admin/verifications/:id |
| Identidade | GET /api/verification/status · POST /api/verification/requests |
| Estatísticas | GET /api/stats?version=2 |
| Conquistas | GET /api/achievements |
| Infraestrutura | GET / · GET /health · GET /api/health |

JWT não substitui verificação de dono, participante, bloqueio ou ADM. Live pública usa token próprio. Health confirma processo respondendo, não verifica individualmente banco, email, storage e provedores.

**Socket.IO**, sem prefixo /api:

- **/chat:** recebe joinChat, sendMessage, markRead, typing e reactMessage; emite mensagens, leitura, digitação e reações. Presença/ack/outbox completos continuam parciais.
- **/tracking:** recebe joinActivity, point e finishActivity. Atleta escreve com autenticação; observador precisa do token de live válido. Persistência de buffers e reconciliação REST ajudam em desconexões.
- Revogação HTTP não equivale à revogação imediata de todos os sockets já abertos.

<a id="autenticacao-e-identidade"></a>

## 7. Autenticação, administração e identidade

### 7.1 Cadastro, email e senha

Cadastro valida dados, confirmação/força da senha e CPF. Senha: bcrypt com 12 rounds. CPF: hash SHA-256 com CPF_HASH_SALT do backend. Hash de CPF não é dado anônimo nem prova de identidade.

**CPF_HASH_SALT ausente em produção interrompe o cadastro.** Configurar valor aleatório forte, exclusivo e estável, diferente do JWT_SECRET. Trocar o salt altera a correspondência com hashes históricos e exige plano de compatibilidade/migração.

Confirmação: código de seis dígitos, validade de dez minutos, limite de tentativas/reenvio. Fluxo por token legado também existe. Email via Resend/HTTPS quando configurado, com alternativa SMTP; testar entrega/remetente no ambiente.

Recuperação: link válido por uma hora. O usuário confirmou recuperação e retorno à conta em 08/09/2026; reuso, expiração e outros aparelhos ainda precisam de cenários próprios.

Pares novos: **access de 15 minutos e refresh de sete dias**, durações explícitas do serviço, não substituídas pelo JWT_EXPIRATION legado. Tokens novos têm sid; rotação/reuso/revogação são transacionais. Web Locks, quando disponível, coordena abas; resposta atrasada não deve restaurar logout.

No nativo, tokens passam por Expo SecureStore. **No web, o adaptador usa localStorage**, sujeito a XSS. Não documentar Keychain como proteção universal do PWA.

Existe endpoint de troca de token Google dependente de GOOGLE_CLIENT_ID/GOOGLE_CLIENT_IDS. A revisão não confirmou fluxo Google ativo na interface; existência da rota não basta.

### 7.2 Administração

Caminho: **Perfil → Configurações → Painel administrativo**. Exige **public.users."isAdmin" = true** na base usada pela API. Metadados do Supabase Auth não substituem esse campo.

1. [SQL 01](backend/sql/01-configurar-admin-e-verificacao.sql): prepara coluna quando users existe e bucket privado; não promove ninguém.
2. Pessoa administradora cria sua conta pelo fluxo normal.
3. [SQL 02](backend/sql/02-promover-usuario-admin.sql): responsável informa email exato e confere resultado. Não salvar dados reais no repositório.

Configurações recarrega o perfil. Se a entrada faltar, reabrir/sair e entrar e conferir API/base. O painel lista denúncias de contas/posts e pedidos de identidade, com decisões de moderação e aprovação/recusa auditadas. Denúncia não causa banimento automático.

### 7.3 Identidade manual

- Cliente consulta disponibilidade; backend precisa confirmar bucket privado antes de liberar envio.
- Selfie + frente/verso de documento. JPEG/PNG/WebP, limites de tamanho/decodificação.
- sharp reencoda, remove EXIF/GPS e limita dimensões. Não presumir que todas as mídias do app recebam esse tratamento.
- Objetos privados, URLs assinadas de até cinco minutos e exclusão de API/storage privado do cache genérico.
- Análise usa transação/lock; tenta remover arquivos antes de concluir a decisão. Falhas de remoção/upload abortado podem exigir revisão operacional e limpeza.
- Aprovação altera isVerified e o selo. Não é prova de vida, biometria automática ou validação documental certificada.

Revisar finalidade, retenção de pedidos pendentes, consentimento, acesso e atendimento ao titular antes de usar documentos reais. Código não certifica conformidade legal.

<a id="mapas"></a>

## 8. Mapas, GPS e treino

**Mapa base** desenha ruas; **GPS** dá posição; **locais** vêm de cadastro externo; **roteamento** propõe caminho. Corrigir CARTO não ativa GPS.

| Componente | Implementação | Limite |
|---|---|---|
| Mapa web | Leaflet + tiles raster CARTO | Chave pública de basemap, rede e configuração |
| Tema | Voyager no claro; dark_all no escuro e ajustes visuais | Validar contraste no aparelho |
| Posição web | navigator.geolocation | HTTPS, permissão do site e localização do aparelho |
| Posição nativa | expo-location | Build/permissões e teste físico |
| Cidade/endereço | Nominatim; alternativas de cidade no cliente | Cidade/IP não são fix GPS preciso |
| Academias | API autenticada → Overpass/OSM | Até 100 resultados em 5 km; cobertura cadastral |
| Rotas | FOSSGIS/OSRM por roteadores foot/bike/car | Disponibilidade externa; não certifica segurança da via |

Academias: centro arredondado enviado ao provedor, cache por região e filtro final pelo ponto solicitado. Não usa Google Places nem substitui ausência por locais fictícios.

Roteamento envia origem/destino ao provedor com aviso na tela, timeout, cache e espaçamento. Chave CARTO não fornece esses dados. Políticas/cotas dos provedores precisam ser verificadas no momento de uso; não há promessa de gratuidade ilimitada.

Treino:

- Começa após countdown; cronômetro considera pausas. Lacunas/pontos inválidos não devem inventar deslocamento contínuo.
- Finalização sincroniza e concilia por timestamp. Filas limitadas não eliminam todos os casos de perda de processo/rede.
- Auto-pausa depende da modalidade e calibração; desligá-la não desfaz pausa manual.
- Meta e rota planejada persistem; tracejado separa plano do percurso realizado. Restante/desvio são aproximações, sem voz ou navegação curva a curva.
- Calorias usam esporte, tempo e peso, com altura como fallback conservador; não são medição clínica.
- Detalhe completo, comparação e GPX protegem proprietário. Heatmap é agregado/autenticado; live tem adesão e token temporário.
- Aparição de pessoas depende de permissões/visibilidade. Centro do mapa não prova posição atual.
- **PWA: manter tela aberta/desbloqueada.** Cache/restauração de contexto não garantem tracking com navegador suspenso.

<a id="gamificacao"></a>

## 9. Gamificação e relações sociais

Detalhes em [GAMIFICACAO.md](backend/GAMIFICACAO.md).

- Atividade elegível: **2 XP/minuto inteiro**, até **40 por atividade**.
- Missão/desafio: até **20 XP** por conclusão/participante, uma vez por origem.
- **100 XP/dia compartilhados** entre fontes; excedente não acumula para amanhã.
- Nível a cada **500 XP**, sem perda por descanso; distinto do nível esportivo declarado.
- **45 objetivos**, de uma a três missões compatíveis por conta/dia, seleção estável e uma universal. Combinações podem coincidir entre contas.
- Desafios entre matches sem bloqueio, aceite, até três ativos por pessoa, objetivos curtos e prazo 1/3/7 dias. Ambos podem concluir; não é disputa por excesso de exercício.
- Ledger, chave única e lock evitam repetição. Saldo legado preservado uma vez conforme migração.
- Conquistas são medalhas, sem XP adicional; oito regras sem evidência não são oferecidas a novos desbloqueios.
- Territórios: percurso concluído, opt-in e temporada mensal, sem prêmio/XP prometido.
- Segmentos: atividade própria, consentimento para geometria pública, treino com opt-in e tempo calculado; criação de trecho contínuo de 100 m a 5 km. Tempos manuais são recusados.

Plausibilidade não prova exercício humano nem elimina fraude GPS. Teto de XP é regra de produto, não limite médico.

**Seguir** é unilateral; **curtir** demonstra interesse; **match** exige reciprocidade. Follow não concede rota privada nem cria match. Ranking principal usa Matches; segmentos têm recorte Seguindo.

<a id="design-system"></a>

## 10. Interface, tema e PWA

Fonte visual: [colors.ts](mobile/src/theme/colors.ts). Escuro: primária azul, fundo/superfícies escuros; claro: primária coral e superfícies claras. Esta revisão não altera cores/layout.

Preferência é mantida localmente e no perfil pelos fluxos existentes. Nem todas as telas foram auditadas para contraste, tokens, leitor de tela e falhas: item 41 amarelo.

Expo exporta a web; postbuild copia public e injeta metadados. Conferir ícones PWA/nativos, manifesto e HTML em conjunto. Launcher pode manter ícone antigo até atualização/reinstalação. Cor da barra/manifesto não é o tema dinâmico de todas as telas.

Service worker: **sync-v7-privacy-20260908**.

- Navegação: rede primeiro e fallback de shell.
- Assets e parte das imagens/tiles: cache.
- API, storage privado, requisições autenticadas e no-store: fora do cache genérico.
- Shell offline não torna as funções autenticadas totalmente offline.
- Handlers push/click existem, **mas subscription/VAPID/envio Web Push não foram implementados**. No web, consultar o sino no app.

Há configuração Vercel na raiz e em mobile, não idênticas. Conferir Root Directory para saber qual vale: headers/deep links de um arquivo não garantem que ele seja o aplicado.

<a id="seguranca"></a>

## 11. Segurança e limitações

### Controles presentes

Hash de senha; rotação de refresh/revogação HTTP; guards e checagens de dono/match/bloqueio/ADM; DTOs com whitelist; rate limits; Helmet e CORS explícito; privacidade de rotas; opt-in competitivo; identidade privada reencodada; auditoria; migrations RLS/revogação de privilégios; desativação com retenção de registros inativos (sem purga automática; ver [ajustes de 28/09/2026](backend/sql/README.md)).

### Limitações que não podem ser omitidas

1. Não há garantia absoluta de segurança nem pentest completo registrado nesta revisão.
2. Tokens web em localStorage ficam expostos em caso de XSS. CSP ainda admite inline; não afirmar que scripts inline são proibidos.
3. TLS PostgreSQL usa **rejectUnauthorized: false** no caminho atual; não afirmar verificação rigorosa de certificado.
4. Swagger é criado em desenvolvimento ou se SWAGGER_USER existir. Basic Auth exige também senha e middleware disponível: não usar configuração parcial em produção.
5. Validação global beneficia classes DTO; não torna automaticamente todo corpo inline validado.
6. Sockets abertos, presença/entrega do chat, lotação de eventos e mídias ainda têm pendências.
7. Upload comum pode sumir em restart/redeploy. Identidade privada é armazenamento separado.
8. Logs, RLS/storage, papéis do banco, dependências, backups e restore não foram auditados remotamente nesta revisão.
9. API usa conexão privilegiada: RLS não substitui autorização no backend. Migration de endurecimento afeta o schema public; avaliar impacto em banco compartilhado e preferir base dedicada.
10. CORS não substitui autenticação contra clientes externos. Heurísticas/calorias/GPS não são certificações clínicas ou antifraude.

**Observação de configuração:** o CSP do vercel.json da raiz não lista o host FOSSGIS de roteamento em connect-src. **Se essa configuração estiver aplicada**, a chamada poderá ser bloqueada. Conferir item 32/42; esta revisão não alterou o header nem verificou o deploy ativo.

Esta é avaliação técnica, não parecer jurídico/conformidade. Compartilhar no TCC somente dados fictícios e estrutura, sem informações pessoais.

<a id="execucao-local"></a>

## 12. Ambientes e execução local

### Endereços registrados

| Recurso | Endereço |
|---|---|
| Web/PWA | https://sync-2-0-blush.vercel.app |
| API | https://sync-backend-o2zc.onrender.com |
| Health | https://sync-backend-o2zc.onrender.com/health |
| Repositório | https://github.com/SanleyLujan/SYNC-2.0 |
| CI | https://github.com/SanleyLujan/SYNC-2.0/actions |

Endereços configurados, sem medição de disponibilidade/versão remota nesta revisão.

### Desenvolvimento

Pré-requisitos: Git, Node.js 20 compatível com CI e npm. sharp/SQLite podem exigir binários compatíveis.

```bash
git clone https://github.com/SanleyLujan/SYNC-2.0.git
cd SYNC-2.0/backend
npm ci --legacy-peer-deps
npm run start:dev
```

**Antes de iniciar**, criar backend/.env a partir do exemplo, sem reutilizar placeholders como segredos reais. NODE_ENV=development, JWT_SECRET próprio e email de teste. SQLite local é criado/evoluído pelo bootstrap; não presumir paridade com locks/SQL/migrations PostgreSQL.

Em outro terminal:

```bash
cd SYNC-2.0/mobile
npm ci --legacy-peer-deps
npm run web
```

Criar mobile/.env com **EXPO_PUBLIC_API_URL=http://127.0.0.1:3000** para navegador e backend no mesmo computador. **Definir a URL explicitamente antes de iniciar:** o fallback pode apontar para produção, inclusive em localhost. Em celular, loopback é o aparelho; usar endereço acessível de teste e atender HTTPS/permissões para GPS web.

Comandos Expo Android/iOS existem, mas executá-los não comprova publicação em loja, tracking bloqueado ou push. Não usar dados reais de produção em desenvolvimento.

<a id="variaveis"></a>

## 13. Variáveis de ambiente

Fontes: [backend/.env.example](backend/.env.example), [mobile/.env.production.example](mobile/.env.production.example), [render.yaml](render.yaml). Nenhum valor secreto abaixo. Nomes legados Stripe/demo no exemplo não ativam módulo desmontado.

| Escopo | Variáveis | Uso/atenção |
|---|---|---|
| Backend | NODE_ENV, PORT | Runtime; NODE_ENV muda escolha do banco |
| Backend | DATABASE_URL ou DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME | Conexão; URL tem prioridade em produção |
| Backend | DB_SSL, DB_SYNCHRONIZE | TLS/schema; synchronize=false em base existente |
| Backend | JWT_SECRET, JWT_EXPIRATION | Chave e configuração legada; pares novos têm durações explícitas |
| Backend | CPF_HASH_SALT | Obrigatória no cadastro de produção; secreta e estável |
| Backend | FRONTEND_URL | Origens CORS exatas, separadas por vírgula |
| Backend | PUBLIC_WEB_URL, BACKEND_URL | Links públicos/email/arquivos |
| Backend | RESEND_API_KEY, EMAIL_FROM, RESEND_TIMEOUT_MS | Email HTTPS; timeout padrão 8 s |
| Backend | SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_TIMEOUT_MS | Alternativa dependente de conectividade |
| Backend | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_KYC_BUCKET | Storage de identidade; role jamais no frontend |
| Backend | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_IDS | Validação opcional Google, sem garantia de botão integrado |
| Backend | SWAGGER_USER, SWAGGER_PASS | Configurar juntos ou manter documentação desativada em produção |
| Backend | SENTRY_DSN, SENTRY_RELEASE, RENDER_GIT_COMMIT | Telemetria/release; não prova monitoramento ativo |
| Backend | REMINDERS_DISABLED | Desativa lembretes; a purga automática de contas foi retirada |
| Backend | SEED_TOKEN | Carga fictícia; desnecessária para uso normal/TCC |
| Legado | SUBSCRIPTION_DEMO | Não oferece cobrança com módulo desmontado |
| Público | EXPO_PUBLIC_API_URL | Base da API com/sem /api; injetada no build |
| Público | EXPO_PUBLIC_WEB_URL | Base pública dos links |
| Público | EXPO_PUBLIC_CARTO_API_KEY | Chave de basemap visível; restrições conforme provedor |

**EXPO_PUBLIC_ é público no bundle.** Nunca usar para JWT_SECRET, senha, CPF_HASH_SALT, service role ou segredo de email. Variáveis de build exigem rebuild.

Não enviar .env, dumps reais, tokens, URLs assinadas, documentos ou conta ADM a quem só documenta o TCC. Segredo exposto exige rotação/revisão; apagar arquivo não revoga credencial.

<a id="operacao-e-recuperacao"></a>

## 14. Provisionamento, publicação e recuperação

### 14.1 Base existente

1. Conferir ambiente/backup recuperável; ensaiar migrations em cópia isolada.
2. Manter NODE_ENV=production e DB_SYNCHRONIZE=false.
3. Publicar backend: bootstrap executa migrations pendentes com migrationsRun.
4. Conferir logs/tabela de migrations/endpoints. Última migration funcional: **1789000000000-CompleteRedTopics.ts**.
5. Verificar/configurar storage e ADM pelos SQLs oficiais se necessário.
6. Publicar frontend depois do backend/migrations e validar.

Não ativar synchronize para “consertar” base existente nem promover usuários sem confirmar o alvo.

### 14.2 Instalação totalmente nova

Não existe migration inicial completa para construir todas as tabelas somente pelas migrations incrementais. Procedimento existente de bootstrap controlado:

1. Criar PostgreSQL/Supabase dedicado; jamais apontar esse processo para a base existente.
2. Preparar bucket privado pelo SQL 01, mesmo antes de users existir.
3. Em ambiente novo **sem acesso público ao aplicativo**, iniciar backend com NODE_ENV=production e DB_SYNCHRONIZE=true uma única vez para schema-base.
4. Parar/reconfigurar para false e fazer novo deploy: aplicar migrations, índices, RLS e ajustes.
5. Conferir todas as migrations, schema/storage e conectividade. Não liberar usuários antes do endurecimento.
6. Configurar email, origens, JWT, CPF salt e storage.
7. Criar contas de teste; cadastrar/promover ADM separadamente.
8. Publicar frontend e executar aceite.

Migration inicial reproduzível e ensaio completo de instalação nova continuam no item 42. Criação de schema não é restauração de backup.

### 14.3 Publicação

Backend: render.yaml registra rootDir backend, npm/build, início node dist/main.js e healthcheck /health. O plano configurado é free; cotas/condições atuais do provedor não foram verificadas.

Frontend:

```bash
cd mobile
npx expo export --platform web --output-dir dist
node scripts/postbuild.js
```

Confirmar qual vercel.json é aplicado, CSP, deep links e assets. Postbuild pode apenas avisar em falha: conferir artefatos, não só saída de sucesso.

**Commit/push não comprovam deploy.** Conferir versões, migrations, cache e logs. O lote funcional anteriormente documentado como “sem commit/push” entrou no commit 70e1519; houve ajuste de créditos em ba0ea43. A confirmação remota de deploy continua separada.

### 14.4 Recuperação

Clone/dependências/variáveis recompõem código/configuração, não dados. Backup precisa contemplar PostgreSQL e mídias necessárias separadamente, com acesso restrito. Disco efêmero pode perder uploads sem cópia. Testar restore isolado e integridade antes do corte.

Não executar migration:revert ou synchronize indiscriminadamente: algumas migrations mantêm segurança e não têm reversão destrutiva. CLI usa [data-source.ts](backend/src/config/data-source.ts); não presumir que carregue .env como ConfigModule. Fornecer variáveis ao processo por método seguro antes de **npm run migration:show** / **npm run migration:run**.

### 14.5 Diagnóstico

| Sintoma | Conferir |
|---|---|
| Cadastro 500 / CPF_HASH_SALT | Variável no backend correto; não remover proteção |
| Email ausente | Provedor/remetente, timeout, spam e logs sem expor token |
| API KEY REQUIRED | Chave CARTO no build; não é erro de GPS |
| Sem posição no mapa | HTTPS, permissão, localização do aparelho, fix e preferências |
| Rota falha | Provedor, perfil, timeout e CSP efetiva |
| ADM ausente | users.isAdmin, base/API correta, recarregar perfil |
| Identidade indisponível | Bucket privado, credenciais backend e endpoint status |
| Ícone/web antigos | Deploy, manifesto/postbuild, cache e instalação PWA |
| Stats/missões falham | Backend/migrations antes do frontend; contrato v2 |
| Chat/live perde conexão | Reconexão, sessão/token e buffers; memória não é durável |

<a id="testes"></a>

## 15. Testes e aceite

Em backend e mobile:

```bash
npm run typecheck
npm test -- --runInBand
```

Backend: **npm run build**. Web: Expo export + postbuild. CI executa typecheck/testes dos dois projetos, não build nativo, E2E, pentest, restore ou GPS físico.

**Reexecução em 11/09/2026, durante esta revisão:** 77 testes backend em 18 suítes e 52 testes frontend em 15 suítes aprovados (**129 testes**). O frontend emitiu aviso de depreciação de configuração do ts-jest, sem falha de testes. Builds/typechecks citados no plano pertencem à rodada funcional anterior e não foram repetidos nesta alteração exclusivamente documental. Quantidade de testes não é porcentagem de cobertura nem motivo para promover todos os amarelos.

Verificação documental: 15 arquivos revisados/criados, 292 links internos conferidos sem destinos/âncoras ausentes, blocos de código balanceados, 42 linhas de acompanhamento com as contagens por cor preservadas e `git diff --check` aprovado. Não foram verificados links externos, deploy, banco remoto ou layout em aparelho nesta rodada.

Scripts **check-gamification.cjs** e **check-red-topics.cjs** em backend/scripts usam PGlite fornecido externamente, fora das dependências do app, com banco descartável isolado. Verificam regras/migrations em escopo controlado, não concorrência multiprocesso ou Supabase real. Não direcionar scripts descartáveis a dados reais.

### Primeiro lote manual

Prioridade: **26, 27, 30, 35 e 38**. Depois **1/23** em ambiente privado e **9/12/28/29/31/32** em campo.

Registrar commit, versões, migrations, data, aparelho/navegador, contas fictícias, passos, esperado, observado, evidência e resultado.

- Missões: contas distintas, renovação, esporte e progresso após atividade.
- XP: reenvio sem duplicação, teto, nível e duas sessões.
- Desafios: convite/aceite, atividade elegível, duas conclusões e expiração.
- Relações: seguir/desfazer, interesse, match e bloqueio.
- Stats: conta vazia, academia/corrida/ciclismo, histórico longo e fim de mês.
- Identidade: indisponibilidade sem storage, ADM/não ADM, remoção e selo.
- GPS/live: permissão negada, atraso, rede instável, pausa, fim, token revogado e observador.

<a id="manutencao"></a>

## 16. Manutenção documental

Ao mudar função, revisar plano dos 42, seção funcional, inventários e testes. Manter README curto. Guias antigos de deploy/autenticação/design encaminham para cá.

Esta revisão substitui promessas antigas por estado real, atualiza stack/Expo/métricas, diferencia legado/navegação/schema, consolida regras/limites e acrescenta apoio ao TCC. Não alterou funcionalidades ou produção.

Para o TCC, não afirmar versões nativas publicadas, IA generativa, segurança total, gratuidade ilimitada ou conclusão de amarelos sem evidência. Datas do burndown não podem ser inventadas a partir das cores do plano.
