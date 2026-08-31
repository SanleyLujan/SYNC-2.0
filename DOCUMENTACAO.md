# 📱 SYNC — Documentação Técnica e Operacional

> **Fonte canônica do projeto.** Arquitetura, API, execução local, deploy, recuperação,
> autenticação, identidade visual e situação dos requisitos são mantidos neste arquivo.
> O `README.md` é apenas uma apresentação rápida; os antigos tutoriais permanecem como
> atalhos de compatibilidade e não devem receber instruções duplicadas.

**App social esportivo geolocalizado** — Encontre parceiros de treino, organize eventos, acompanhe seu progresso em tempo real.

- **Frontend:** https://sync-2-0-blush.vercel.app
- **Backend:** https://sync-backend-o2zc.onrender.com
- **Healthcheck:** https://sync-backend-o2zc.onrender.com/health
- **Swagger opcional:** https://sync-backend-o2zc.onrender.com/api/docs — desativado no ambiente atual (`404` em 2026-08-30)
- **Repositório:** https://github.com/SanleyLujan/SYNC-2.0
- **CI/CD:** https://github.com/SanleyLujan/SYNC-2.0/actions
- **Autor:** Sanley Lujan
- **Versão:** 1.0.0
- **Última atualização:** 2026-08-30

---

# Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Stack de Tecnologias](#3-stack-de-tecnologias)
4. [Estrutura de Pastas](#4-estrutura-de-pastas)
5. [Banco de Dados](#5-banco-de-dados)
6. [API REST — Endpoints](#6-api-rest--endpoints)
7. [WebSockets](#7-websockets)
8. [Telas Mobile/Web](#8-telas-mobileweb)
9. [Componentes Reutilizáveis](#9-componentes-reutilizáveis)
10. [Serviços e Utilitários](#10-serviços-e-utilitários)
11. [Requisitos Funcionais (RF)](#11-requisitos-funcionais-rf)
12. [Requisitos Não-Funcionais (RNF)](#12-requisitos-não-funcionais-rnf)
13. [Segurança](#13-segurança)
14. [Performance](#14-performance)
15. [Deploy & Infra](#15-deploy--infra)
16. [Variáveis de Ambiente](#16-variáveis-de-ambiente)
17. [Como rodar localmente](#17-como-rodar-localmente)
18. [APIs Externas](#18-apis-externas)
19. [PWA](#19-pwa)
20. [Roadmap / Pendências](#20-roadmap--pendências)
21. [Operação e Recuperação](#operacao-e-recuperacao)
22. [Autenticação e Identidade](#autenticacao-e-identidade)
23. [Design System](#design-system)
24. [Status dos Requisitos Complementares](#requisitos-complementares)

---

# 1. Visão Geral

**Sync** é uma plataforma social esportiva com geolocalização que combina:
- **Match estilo Tinder** entre atletas próximos
- **Tracking GPS Strava-like** em tempo real
- **Stories de treino** (24h)
- **Eventos esportivos** organizados pela comunidade
- **Chat 1:1** entre matches
- **Grupos/clubes** com ranking colaborativo
- **Feed de atividades** entre matches mútuos
- **Gamificação** (XP, levels, conquistas, daily quests)
- **Planos de treino** prontos (5K/10K/21K)
- **Audio coach** com TTS durante treinos

Plataforma única para iOS, Android e Web (PWA instalável).

### Diferenciais
- APIs externas sem cobrança obrigatória no fluxo atual; pagamentos reais continuam pendentes
- Mapa web com Leaflet + tiles OpenStreetMap/CartoDB
- **Live tracking compartilhável** via link público
- **Auto-pause inteligente** durante treino
- **3 níveis de fallback de GPS** (alta precisão → IP → manual)

---

# 2. Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                        USUÁRIOS                             │
│       iOS App   │   Android App   │   PWA Web Browser       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vercel CDN)                    │
│  React Native + Expo 52  ─  React Native Web                │
│  https://sync-2-0-blush.vercel.app                          │
└─────────────────────────────────────────────────────────────┘
                          │ HTTPS / WSS
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  BACKEND (Render)                           │
│  NestJS 10 + TypeORM + Socket.io                            │
│  https://sync-backend-o2zc.onrender.com                     │
│  ┌─────────────┬──────────────┬───────────────┐             │
│  │  REST API   │  WebSocket   │  Static files │             │
│  └─────────────┴──────────────┴───────────────┘             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  POSTGRES (Supabase)                        │
│  Schema versionado por migrations (`migrationsRun`)          │
└─────────────────────────────────────────────────────────────┘

SERVIÇOS EXTERNOS (cliente e backend):
• OSRM (roteamento)
• OpenStreetMap (tiles do mapa)
• CartoDB (tiles alternativos)
• Nominatim (geocoding reverso)
• Open-Meteo (clima + AQI)
• Sunrise-Sunset.org
• Expo Push API (notificações)
• ipapi.co (geolocalização por IP, fallback)
• Unsplash (imagens hero)
• Resend (email transacional via backend)
```

### Padrões arquiteturais
- **Modular** — cada feature = módulo NestJS isolado
- **DTO + Validation Pipe** — todo input validado por class-validator
- **Repository pattern** via TypeORM
- **Guards** para autenticação JWT
- **Decorators** customizados (`@CurrentUser()`)
- **Stateless backend** (escalável horizontalmente)
- **JWT em SecureStore** no cliente (Keychain/EncryptedSharedPreferences)

---

# 3. Stack de Tecnologias

## 3.1 Backend

### Runtime e framework
| Tech | Versão | Uso |
|------|--------|-----|
| **Node.js** | 20+ | Runtime |
| **TypeScript** | 5.3 | Linguagem |
| **NestJS** | 10.3 | Framework |
| **Express** | (via Nest) | HTTP server |
| **Socket.io** | 4.7 | WebSockets |

### Banco e ORM
| Tech | Versão | Uso |
|------|--------|-----|
| **PostgreSQL** | Gerenciado | Produção (Supabase) |
| **better-sqlite3** | 12 | Dev local (opcional) |
| **TypeORM** | 0.3 | ORM |
| **pg** | 8.11 | Driver Postgres |

### Auth e segurança
| Tech | Uso |
|------|-----|
| **@nestjs/jwt** | Geração e validação de JWT |
| **passport-jwt** | Strategy JWT |
| **bcrypt** | Hash de senhas (12 rounds) |
| **helmet** | Headers de segurança (CSP, HSTS, etc) |
| **@nestjs/throttler** | Rate limiting |
| **express-basic-auth** | Proteção do Swagger em prod |
| **class-validator** | Validação DTOs |
| **class-transformer** | Transformação DTOs |
| **@sentry/node** | Erros e performance quando `SENTRY_DSN` está configurado |

### Features
| Tech | Uso |
|------|-----|
| **@nestjs/swagger** | Documentação API |
| **@nestjs/schedule** | Cron jobs (lembretes) |
| **@nestjs/websockets** | Gateway WebSocket |
| **@nestjs/platform-socket.io** | Adapter Socket.io |
| **@nestjs/serve-static** | Servir uploads |
| **multer** | Upload de arquivos |
| **axios** | HTTP client (chamadas externas server-side) |
| **@nestjs/axios** | Wrapper HTTP |
| **reflect-metadata** | Decorators metadata |
| **rxjs** | Observables (interno do Nest) |

## 3.2 Frontend (Mobile + Web)

### Core
| Tech | Versão | Uso |
|------|--------|-----|
| **React Native** | 0.76 | Framework UI |
| **React** | 18.3 | View library |
| **Expo SDK** | 52 | Toolkit RN |
| **TypeScript** | 5.3 | Linguagem |
| **React Native Web** | 0.19 | Web target |

### Navegação e estado
| Tech | Uso |
|------|-----|
| **@react-navigation/native** | Navegação |
| **@react-navigation/native-stack** | Stack navigator |
| **@react-navigation/bottom-tabs** | Tab bar inferior |
| **zustand** | Estado global (authStore, onboardingStore) |
| **@react-native-async-storage/async-storage** | Storage não-sensível |

### Rede e auth
| Tech | Uso |
|------|-----|
| **axios** | HTTP client com interceptors |
| **socket.io-client** | WebSocket cliente |
| **expo-secure-store** | Token JWT em Keychain/EncryptedSharedPreferences |

### Mapas e GPS
| Tech | Uso |
|------|-----|
| **react-native-maps** | Mapa nativo (iOS/Android) |
| **leaflet** | Renderização do mapa web; CSS e ícones carregados por CDN |
| **expo-location** | GPS nativo |
| **navigator.geolocation** | GPS web |

### Mídia e UI
| Tech | Uso |
|------|-----|
| **expo-image-picker** | Câmera/galeria (avatar, stories) |
| **expo-font** | Fontes customizadas |
| **expo-splash-screen** | Splash launch |
| **expo-linear-gradient** | Gradientes UI |
| **@expo/vector-icons** | Ícones (Ionicons) |
| **expo-status-bar** | Status bar |
| **expo-device** | Detecção de device |
| **expo-notifications** | Push notifications cliente |
| **react-native-svg** | Suporte SVG |
| **react-native-reanimated** | Animações nativas |
| **react-native-gesture-handler** | Gestos |
| **react-native-safe-area-context** | Safe areas |
| **react-native-screens** | Otimização navegação |

## 3.3 APIs externas

| API | Uso | Operação / limite |
|-----|-----|-------------|
| **OSRM** | Roteamento | Instância pública; respeitar política de uso |
| **OpenStreetMap / CartoDB Tiles** | Mapa base | Respeitar atribuição e política do provedor |
| **Nominatim** | Geocoding reverso | Instância pública; limitar chamadas e usar cache |
| **Open-Meteo** | Clima + qualidade do ar | Consultar limites atuais do provedor |
| **Sunrise-Sunset.org** | Nascer/pôr do sol | Consultar política atual do provedor |
| **Expo Push API** | Push notifications | Consultar limites atuais do Expo |
| **ipapi.co** | Geolocalização por IP (fallback) | Consultar plano atual do provedor |
| **Unsplash** | Imagens hero (URL direta) | Respeitar termos e atribuição |
| **Resend** | Email transacional | API HTTPS autenticada no backend |
| **Google OAuth tokeninfo** | Validar `id_token` do login Google opcional | Requer Client ID por plataforma |
| **Quotable** | Frase motivacional | Fallback local quando indisponível |
| **VLibras** | Acessibilidade em Libras na web | Widget público do governo brasileiro |

## 3.4 Infraestrutura

| Serviço | Uso |
|---------|-----|
| **[Vercel](https://vercel.com/dashboard)** | Frontend hosting + CDN global + HTTPS |
| **[Render](https://dashboard.render.com/)** | Backend NestJS em Web Service Node.js |
| **[Supabase](https://supabase.com/dashboard/projects)** | Banco PostgreSQL gerenciado (sem Supabase Auth) |
| **[Resend](https://resend.com/domains)** | Envio transacional do código de confirmação por HTTPS |
| **[Hostinger](https://hpanel.hostinger.com/)** | DNS do domínio remetente `syncapp.site` |
| **[GitHub](https://github.com/SanleyLujan/SYNC-2.0)** | Versionamento + Actions + webhooks de deploy |
| **[jsDelivr](https://www.jsdelivr.com/)** / **[unpkg](https://unpkg.com/)** | CDN para Leaflet CSS, script e ícones |
| **[VLibras](https://www.gov.br/governodigital/pt-br/acessibilidade-e-usuario/vlibras)** | Widget de acessibilidade na web |

---

# 4. Estrutura de Pastas

```
SYNC/
├── backend/                      # NestJS API
│   ├── src/
│   │   ├── auth/                 # Autenticação JWT + Refresh tokens
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── refresh-token.service.ts
│   │   │   ├── auth.module.ts
│   │   │   ├── dto/
│   │   │   ├── entities/
│   │   │   │   └── refresh-token.entity.ts
│   │   │   └── guards/
│   │   ├── users/                # Usuários + perfil + LGPD
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── entities/
│   │   │       ├── user.entity.ts
│   │   │       ├── user-block.entity.ts
│   │   │       └── user-report.entity.ts
│   │   ├── activities/           # Tracking GPS, atividades, kudos, comentários
│   │   │   ├── activities.controller.ts
│   │   │   ├── activities.service.ts
│   │   │   ├── activities.gateway.ts  (WebSocket)
│   │   │   └── entities/
│   │   ├── matching/             # Discovery + likes + matches
│   │   ├── chat/                 # Chat 1:1 entre matches
│   │   ├── events/               # Eventos esportivos
│   │   ├── ranking/              # Ranking semanal/mensal/amigos
│   │   ├── notifications/        # Push + in-app + cron reminders
│   │   │   ├── push.service.ts
│   │   │   ├── reminders.service.ts  (cron)
│   │   │   └── entities/
│   │   ├── weather/              # Open-Meteo wrapper
│   │   ├── achievements/         # 50+ conquistas
│   │   ├── stats/                # Estatísticas agregadas
│   │   ├── stories/              # Stories 24h
│   │   ├── groups/               # Grupos/clubes
│   │   │   ├── groups.controller.ts
│   │   │   ├── groups.service.ts
│   │   │   └── entities/
│   │   │       ├── group.entity.ts
│   │   │       └── group-member.entity.ts
│   │   ├── activity-feed/        # Feed de atividades entre matches
│   │   ├── common/
│   │   │   ├── security/         # Audit log + sanitização
│   │   │   │   ├── audit-log.entity.ts
│   │   │   │   ├── audit.service.ts
│   │   │   │   ├── sanitize.util.ts
│   │   │   │   └── security.module.ts
│   │   │   ├── decorators/       # @CurrentUser
│   │   │   └── utils/
│   │   │       └── haversine.ts
│   │   ├── config/
│   │   │   └── database.config.ts
│   │   ├── health.controller.ts  # /health endpoint
│   │   ├── app.module.ts
│   │   └── main.ts               # Bootstrap (Helmet, CORS, Swagger, etc)
│   ├── uploads/                  # Arquivos enviados (avatars, stories)
│   ├── package.json
│   ├── railway.json                  # Legado; produção atual usa Render
│   ├── Procfile
│   ├── .npmrc                    # legacy-peer-deps=true
│   └── tsconfig.json
│
├── mobile/                       # React Native + Expo
│   ├── src/
│   │   ├── screens/
│   │   │   ├── Auth/
│   │   │   │   ├── WelcomeScreen.tsx       # Landing page
│   │   │   │   ├── LoginScreen.tsx
│   │   │   │   ├── RegisterScreen.tsx
│   │   │   │   └── SplashScreen.tsx
│   │   │   ├── Onboarding/
│   │   │   │   ├── SportsScreen.tsx
│   │   │   │   ├── LevelScreen.tsx
│   │   │   │   ├── ObjectivesScreen.tsx
│   │   │   │   ├── AvailabilityScreen.tsx
│   │   │   │   └── LocationScreen.tsx
│   │   │   ├── Home/
│   │   │   │   └── DiscoveryScreen.tsx     # Swipe Tinder-like
│   │   │   ├── Map/
│   │   │   │   └── MapMainScreen.tsx       # Mapa com eventos + heatmap
│   │   │   ├── Tracking/
│   │   │   │   ├── TrackingMainScreen.tsx  # Botão iniciar
│   │   │   │   ├── ActiveTrackingScreen.tsx  # Em treino
│   │   │   │   ├── ActivitySummaryScreen.tsx  # Resumo + postar feed
│   │   │   │   └── ActivityHistoryScreen.tsx
│   │   │   ├── Chat/
│   │   │   ├── Events/
│   │   │   ├── Profile/
│   │   │   │   ├── MyProfileScreen.tsx
│   │   │   │   └── EditProfileScreen.tsx
│   │   │   ├── Ranking/
│   │   │   │   └── RankingScreen.tsx       # Monthly/Weekly/Friends
│   │   │   ├── Stories/
│   │   │   │   ├── StoryViewerScreen.tsx
│   │   │   │   └── CreateStoryScreen.tsx
│   │   │   ├── Groups/
│   │   │   │   └── GroupsScreen.tsx        # Mine/Discover/Ranking
│   │   │   ├── Training/
│   │   │   │   └── TrainingPlanScreen.tsx  # 5K/10K/21K
│   │   │   └── LiveViewScreen.tsx          # Tracking público
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Toast.tsx
│   │   │   │   ├── Skeleton.tsx
│   │   │   │   ├── SkeletonList.tsx
│   │   │   │   └── ProgressBar.tsx
│   │   │   ├── layout/
│   │   │   │   └── ScreenContainer.tsx
│   │   │   ├── map/
│   │   │   │   ├── SyncMap.tsx              # Native
│   │   │   │   └── SyncMap.web.tsx          # Leaflet vanilla
│   │   │   ├── XPBar.tsx
│   │   │   ├── DailyQuestsCard.tsx
│   │   │   ├── StreakBadge.tsx
│   │   │   ├── StoriesBar.tsx
│   │   │   ├── ActivityComments.tsx
│   │   │   ├── TodayBriefWidget.tsx
│   │   │   └── BestTimeWidget.tsx
│   │   ├── services/
│   │   │   ├── api.ts                       # Axios + interceptors
│   │   │   ├── secure-storage.ts            # Wrapper SecureStore
│   │   │   ├── location.service.ts          # GPS + Nominatim
│   │   │   ├── external-apis.ts             # Clima, sun, AQI, etc
│   │   │   ├── tracking-socket.service.ts   # WS /tracking
│   │   │   ├── push-notifications.service.ts
│   │   │   ├── stories.service.ts
│   │   │   ├── groups.service.ts
│   │   │   ├── feed.service.ts
│   │   │   └── audio-coach.service.ts       # TTS
│   │   ├── utils/
│   │   │   ├── pace-zones.ts                # Z1-Z5
│   │   │   ├── xp-system.ts                 # XP + Levels
│   │   │   ├── daily-quests.ts              # 12 quests pool
│   │   │   ├── workout-summary.ts           # Natural language
│   │   │   ├── auto-pause.ts                # Detect 5s stopped
│   │   │   └── training-plans.ts            # 5K/10K/21K
│   │   ├── navigation/
│   │   │   ├── RootNavigator.tsx
│   │   │   ├── AuthNavigator.tsx
│   │   │   ├── OnboardingNavigator.tsx
│   │   │   ├── MainTabNavigator.tsx         # Custom tab bar
│   │   │   ├── stacks/
│   │   │   └── types.ts
│   │   ├── store/
│   │   │   ├── authStore.ts                 # Zustand
│   │   │   └── onboardingStore.ts
│   │   ├── theme/
│   │   │   ├── colors.ts                    # Temas azul/ciano e coral/laranja
│   │   │   ├── spacing.ts
│   │   │   ├── fontSize.ts
│   │   │   ├── borderRadius.ts
│   │   │   └── index.ts
│   │   ├── types/                           # TypeScript types
│   │   └── assets/
│   │       └── images/
│   ├── public/                              # PWA assets
│   │   ├── manifest.json
│   │   └── service-worker.js
│   ├── scripts/
│   │   └── postbuild.js                     # Copia public/ pra dist/
│   ├── App.tsx
│   ├── app.json                             # Expo config
│   ├── package.json
│   └── vercel.json
│
├── render.yaml                       # Blueprint do backend no Render
├── vercel.json                       # Build web/PWA na Vercel
├── DOCUMENTACAO.md                   # Fonte canônica técnica e operacional
├── DEPLOY.md                         # Atalho para esta documentação
├── DEPLOY_RENDER.md                  # Atalho para esta documentação
└── README.md
```

---

# 5. Banco de Dados

## 5.1 Tabelas

### `users`
Cadastro principal de atletas.

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| id | uuid PK | gerado |
| name | varchar(100) | obrigatório |
| email | varchar(255) | UNIQUE |
| password | varchar | select:false, bcrypt 12 |
| bio | text | nullable |
| avatarUrl | varchar | nullable |
| birthDate | varchar | nullable |
| sports | simple-array | nullable |
| level | varchar | beginner/intermediate/advanced |
| objectives | simple-array | nullable |
| availability | simple-array | nullable |
| latitude / longitude | real | nullable |
| city | varchar | nullable |
| isActive | boolean | default true |
| onboardingCompleted | boolean | default false |
| resetPasswordToken | varchar | select:false |
| resetPasswordExpires | timestamp | select:false |
| failedLoginAttempts | int | default 0, select:false |
| lockedUntil | timestamp | select:false |
| lastLoginAt | timestamp | select:false |
| lastLoginIp | varchar | select:false (mascarado) |
| twoFactorSecret | varchar | select:false |
| twoFactorEnabled | boolean | default false |
| createdAt / updatedAt | timestamps | auto |

### `activities`
Atividades esportivas registradas.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| user_id | uuid FK | dono |
| sport | varchar(50) | running, cycling, etc |
| startTime / endTime | timestamp | |
| distance | real | metros |
| duration | int | segundos |
| avgPace | real | min/km |
| avgSpeed | real | km/h |
| isCompleted | boolean | default false |
| liveToken | varchar | nullable (compartilhamento) |
| liveTokenExpiresAt | timestamp | nullable (24h) |
| createdAt | timestamp | |

### `activity_points`
Pontos GPS individuais (até dezenas de milhares por atividade).

| Coluna | Tipo |
|--------|------|
| id | uuid PK |
| activity_id | uuid FK |
| latitude | real |
| longitude | real |
| altitude | real (nullable) |
| timestamp | timestamp |

### `activity_comments`
Comentários em atividades.

| Coluna | Tipo |
|--------|------|
| id | uuid PK |
| activity_id | uuid FK |
| user_id | uuid FK |
| content | text (sanitizado, ≤500) |
| createdAt | timestamp |

### `activity_kudos`
Kudos (curtidas) em atividades. `UNIQUE(activity_id, user_id)`.

### `likes` / `matches`
Sistema Tinder-like.

### `messages`
Chat 1:1 entre matches.

### `events`
Eventos esportivos organizados pela comunidade.

### `event_participants`
Inscrições em eventos.

### `notifications`
Notificações in-app.

### `push_tokens`
Tokens Expo Push por dispositivo. `UNIQUE(user_id, token)`.

### `stories` / `story_views`
Stories 24h + visualizações únicas.

### `groups`
Grupos/clubes esportivos.

| Coluna | Tipo |
|--------|------|
| id | uuid PK |
| name | varchar(80) |
| description | text (nullable) |
| sport | varchar(40) |
| city | varchar(80) |
| isPrivate | boolean |
| inviteCode | varchar(16) (nullable, gerado por crypto.randomBytes) |
| admin_id | uuid FK → users |
| memberCount | int |
| totalDistanceKm | float |
| totalActivities | int |
| createdAt | timestamp |

### `group_members`
Membros + contribuição individual. `UNIQUE(group_id, user_id)`.

### `activity_feed_posts`
Feed de atividades públicas.

| Coluna | Tipo |
|--------|------|
| id | uuid PK |
| user_id | uuid FK |
| activity_id | uuid (nullable) |
| caption | text (≤500, sanitizado) |
| photoUrl | varchar (sanitizado) |
| distanceKm, durationSeconds, avgPace, calories | numbers |
| sport | varchar(40) |
| likesCount, commentsCount | int |
| createdAt | timestamp |

### `refresh_tokens`
Refresh tokens com família.

| Coluna | Tipo |
|--------|------|
| id | uuid PK |
| user_id | uuid FK |
| familyId | varchar(36) — agrupa rotações |
| tokenHash | varchar(64) — SHA-256 do token em claro |
| expiresAt | timestamp (7 dias) |
| used | boolean (rotacionado?) |
| revoked | boolean |
| userAgent | varchar(200) |
| ipMasked | varchar(45) |
| createdAt | timestamp |

### `audit_logs`
Eventos de segurança.

| Coluna | Tipo |
|--------|------|
| id | uuid PK |
| userId | varchar(64) (nullable) |
| event | enum (login_success, login_failure, account_locked, etc) |
| ipMasked | varchar(45) |
| userAgent | text |
| detail | text |
| createdAt | timestamp |

### `achievements` / `user_achievements`
50+ conquistas + relação com usuários.

### `user_blocks` / `user_reports`
Moderação.

## 5.2 Configuração

- **Produção:** PostgreSQL via `DATABASE_URL` (Supabase)
- **Dev:** SQLite via `better-sqlite3`
- **SSL:** auto (production)
- **Schema:** `DB_SYNCHRONIZE=false` em produção existente; `migrationsRun` aplica migrations automaticamente
- **Primeiro provisionamento:** `DB_SYNCHRONIZE=true` somente para criar um banco vazio e depois retornar a `false`

---

# 6. API REST — Endpoints

Base URL: `https://sync-backend-o2zc.onrender.com/api`

O inventário abaixo destaca as rotas de uso mais frequente. A referência permanente são os 25 controllers em `backend/src`; quando habilitado, o Swagger em https://sync-backend-o2zc.onrender.com/api/docs reflete esses controllers. A revisão atual contabiliza 166 decorators `@Get`, `@Post`, `@Put`, `@Patch` e `@Delete`.

## 6.1 Auth (`/auth`)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/register` | — | Cria conta pendente e envia código (rate 3/min) |
| POST | `/verify-email-code` | — | Confirma o código e só então retorna JWT |
| POST | `/request-verification` | — | Reenvia um código novo (rate 3/5min) |
| POST | `/login` | — | Login; bloqueia email ainda não confirmado (rate 5/5min) |
| POST | `/forgot-password` | — | Solicita token de reset |
| POST | `/reset-password` | — | Redefine senha com token |
| POST | `/verify-email` | — | Confirma token legado de email |
| POST | `/resend-verification` | JWT | Reenvio legado de confirmação |
| POST | `/change-password` | JWT | Altera a senha autenticada |
| POST | `/google` | — | Login Google, quando Client ID está configurado |
| POST | `/refresh` | — | Rotaciona refresh + emite novo access |
| POST | `/logout` | — | Revoga família de refresh |
| GET | `/sessions` | JWT | Lista devices logados |
| DELETE | `/sessions/:familyId` | JWT | Revoga sessão específica |

## 6.2 Users (`/users`)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/me` | JWT | Meu perfil |
| PUT | `/me` | JWT | Atualizar perfil |
| POST | `/me/avatar` | JWT | Upload de avatar (multipart, ≤5MB) |
| POST | `/me/banner` | JWT | Upload da capa do perfil |
| POST | `/me/photos` | JWT | Upload de foto adicional |
| POST | `/me/verify` | JWT | Solicitar/verificar selo conforme regra do backend |
| POST | `/onboarding` | JWT | Completar onboarding |
| PUT | `/location` | JWT | Atualizar GPS |
| GET | `/nearby` | JWT | Usuários próximos |
| GET | `/me/export` | JWT | Exportar dados (LGPD/GDPR) |
| DELETE | `/me` | JWT | Anonimizar conta (LGPD/GDPR) |
| GET | `/search?q=` | JWT | Buscar usuários |
| GET | `/blocked` | JWT | Listar bloqueados |
| GET | `/:id` | JWT | Perfil de outro usuário |
| POST | `/:id/block` | JWT | Bloquear |
| DELETE | `/:id/block` | JWT | Desbloquear |
| POST | `/:id/report` | JWT | Denunciar |

## 6.3 Matching (`/matching`)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/discover` | JWT | Lista de atletas próximos (filtros: pace, raio, esporte) |
| POST | `/swipe` | JWT | Like ou pass; cria match quando recíproco |
| GET | `/matches` | JWT | Meus matches |
| GET | `/new-count` | JWT | Contagem de matches novos |
| GET | `/likes-received` | JWT | Likes recebidos |
| GET | `/likes-received/count` | JWT | Contagem de likes pendentes |

## 6.4 Chat (`/chat`)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/conversations` | JWT | Lista de conversas |
| GET | `/:matchId/messages` | JWT | Mensagens de um match |
| POST | `/messages` | JWT | Enviar mensagem |
| PUT | `/:matchId/read` | JWT | Marcar conversa como lida |

## 6.5 Activities (`/activities`)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/start` | JWT | Iniciar atividade |
| POST | `/:id/points` | JWT | Adicionar ponto GPS |
| PUT | `/:id/finish` | JWT | Finalizar |
| GET | `/history?page=` | JWT | Histórico |
| GET | `/:id` | JWT | Detalhes (com pontos) |
| POST | `/:id/share` | JWT | Gerar token público (24h) |
| DELETE | `/:id/share` | JWT | Revogar compartilhamento |
| GET | `/live/:token` | — | Ver atividade ao vivo (público) |
| POST | `/:id/comments` | JWT | Comentar (sanitizado) |
| GET | `/:id/comments` | JWT | Listar comentários |
| DELETE | `/comments/:commentId` | JWT | Deletar próprio |
| POST | `/comments/:commentId/reactions` | JWT | Reagir a comentário |
| POST | `/:id/kudos` | JWT | Toggle kudos |
| GET | `/:id/kudos` | — | Total de kudos |
| POST | `/:id/rating` | JWT | Avaliação pós-treino |
| GET | `/compare/:a1/:a2` | JWT | Comparar duas atividades |
| POST | `/:id/photo` | JWT | Associar foto à atividade |
| POST | `/live/:token/cheer` | — | Enviar torcida no live tracking |
| GET | `/:id/export.gpx` | — | Exportar GPX (Strava/Garmin) |
| GET | `/heatmap/nearby?lat&lng&radiusKm` | — | Pontos GPS agregados |

## 6.6 Events (`/events`)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/nearby?latitude=&longitude=&radiusKm=` | JWT | Eventos próximos |
| GET | `/my` | JWT | Eventos do usuário |
| POST | `/` | JWT | Criar evento |
| POST | `/flash` | JWT | Evento relâmpago (notifica usuários próximos) |
| GET | `/:id` | JWT | Detalhes |
| POST | `/:id/join` | JWT | Inscrever-se |
| DELETE | `/:id/leave` | JWT | Cancelar inscrição |
| POST | `/:id/comments` | JWT | Comentar no evento |
| GET | `/:id/comments` | JWT | Listar comentários |
| DELETE | `/comments/:commentId` | JWT | Deletar comentário autorizado |

## 6.7 Ranking (`/ranking`)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/monthly?sport=` | JWT | Ranking mensal |
| GET | `/weekly?sport=` | JWT | Ranking semanal |
| GET | `/friends?sport=` | JWT | Entre amigos |

## 6.8 Notifications (`/notifications`)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/` | JWT | Listar notificações in-app |
| GET | `/unread-count` | JWT | Contagem de não lidas |
| PUT | `/read-all` | JWT | Marcar todas como lidas |
| PUT | `/:id/read` | JWT | Marcar como lida |
| POST | `/push-token` | JWT | Registrar token Expo |
| DELETE | `/push-token` | JWT | Remover token |
| POST | `/test-push` | JWT | Push de teste |

## 6.9 Stories (`/stories`)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/` | JWT | Criar story (multipart, ≤25MB) |
| GET | `/` | JWT | Feed de stories ativas |
| GET | `/user/:userId` | JWT | Stories de um usuário |
| POST | `/:id/view` | JWT | Marcar como visualizada |
| POST | `/:id/like` | JWT | Like |
| DELETE | `/:id` | JWT | Deletar (só dono) |

## 6.10 Groups (`/groups`)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/public?city=&sport=&page=` | — | Grupos públicos |
| GET | `/ranking?city=&sport=` | — | Ranking por km |
| POST | `/` | JWT | Criar (admin) |
| GET | `/me` | JWT | Meus grupos |
| GET | `/:id` | JWT | Detalhe |
| GET | `/:id/members` | JWT | Ranking interno de membros |
| POST | `/:id/join` | JWT | Entrar (com inviteCode se privado) |
| POST | `/:id/requests` | JWT | Solicitar entrada em grupo privado |
| GET | `/:id/requests` | JWT | Listar solicitações para o admin |
| POST | `/:id/requests/:requestId/approve` | JWT | Aprovar solicitação |
| POST | `/:id/requests/:requestId/reject` | JWT | Recusar solicitação |
| DELETE | `/:id/members/:memberId` | JWT | Remover membro como admin |
| POST | `/:id/leave` | JWT | Sair |
| DELETE | `/:id` | JWT | Deletar (só admin) |

## 6.11 Feed (`/feed`)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/?page=` | JWT | Feed do usuário e de matches mútuos |
| GET | `/user/:userId?page=` | JWT | Feed de um usuário com match mútuo |
| POST | `/` | JWT | Postar atividade (sanitizado) |
| POST | `/:id/like` | JWT | Like |
| DELETE | `/:id/like` | JWT | Remover like |
| POST | `/liked-ids` | JWT | Consultar posts já curtidos |
| GET | `/:id/comments` | JWT | Listar comentários |
| POST | `/:id/comments` | JWT | Criar comentário |
| DELETE | `/:id/comments/:commentId` | JWT | Excluir comentário autorizado |
| DELETE | `/:id` | JWT | Deletar (só dono) |

## 6.12 Weather (`/weather`)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/current?lat&lng` | JWT | Clima atual |
| GET | `/forecast?lat&lng&days=` | JWT | Previsão por período |
| GET | `/recommendation?lat&lng` | JWT | Melhor horário com score por hora |

## 6.13 Outros módulos REST

| Prefixo | Recursos principais |
|---|---|
| `/challenges` | Criar, listar, responder e concluir desafios |
| `/segments` | Próximos, trending, KOMs, esforços e leaderboards global/amigos |
| `/follows` | Seguir, deixar de seguir, status, seguidores e contagens |
| `/stats` | Estatísticas gerais e semanais |
| `/achievements` | Catálogo, verificação e XP |
| `/coach` | Insights do coach |
| `/subscriptions` | Planos, histórico e fluxo demo; Stripe real ainda é stub |
| `/feedback` | Feedback do usuário e tickets de suporte |
| `/admin` | Dashboard, denúncias e seed protegido por `SEED_TOKEN` |
| `/territory` | Claim, células, leaderboard e resumo do usuário |
| `/media` | Upload genérico autenticado |

## 6.14 Endpoints de infraestrutura

- **`/health`** — Healthcheck (200 OK)
- **`/`** — Status básico
- **`/api/docs`** — Swagger; em produção só existe quando `SWAGGER_USER` e `SWAGGER_PASS` estão configurados
- **`/uploads/*`** — Arquivos estáticos (avatars, stories)

---

# 7. WebSockets

## 7.1 Namespace `/tracking`

URL: `wss://sync-backend-o2zc.onrender.com/tracking`

**Autenticação:** JWT no handshake (`auth.token` ou `?token=`).

### Eventos cliente → servidor

| Evento | Payload | Descrição |
|--------|---------|-----------|
| `joinActivity` | `{ activityId }` | Entra na sala (read-only se sem auth, write se for o dono) |
| `point` | `{ activityId, latitude, longitude, altitude?, timestamp? }` | Atleta streama ponto GPS (validação de ownership) |
| `finishActivity` | `{ activityId }` | Finaliza e flusha buffer |

### Eventos servidor → cliente

| Evento | Payload | Descrição |
|--------|---------|-----------|
| `livePoint` | `{ activityId, latitude, longitude, distance, timestamp, snapshot? }` | Broadcast para seguidores |
| `activityFinished` | `{ activityId }` | Atividade encerrada |

### Características
- Buffer de pontos persistido em batch a cada 3s (reduz I/O)
- Cache do último ponto por atividade (snapshot pra novo seguidor)
- Distância acumulada via Haversine
- Validação de coordenadas (-90..90, -180..180)
- Reconnect infinito no cliente (backoff até 8s)

## 7.2 Namespace `/chat`

URL: `wss://sync-backend-o2zc.onrender.com/chat`

Gateway autenticado por JWT no `handshake.auth.token`, com salas por match e limite de 30 mensagens por minuto por conexão.

| Cliente → servidor | Servidor → cliente |
|---|---|
| `joinChat` | entrada na sala autorizada |
| `sendMessage` | `newMessage` |
| `markRead` | `messagesRead` |
| `typing` | `userTyping` |
| `reactMessage` | `messageReaction` |

---

# 8. Telas Mobile/Web

## 8.1 Auth
- **WelcomeScreen** — Entrada mobile e landing desktop com hero, recursos, planos, comunidade, CTA e footer
- **LoginScreen** — Hero image + glass card + CTA gradient
- **RegisterScreen** — Senha forte com medidor visual; cadastro não cria sessão antes da confirmação
- **VerifyEmailCodeScreen** — Entrada do código de 6 dígitos e reenvio com contagem regressiva
- **SplashScreen** — Logo responsiva ao tema sobre gradiente azul profundo

## 8.2 Onboarding (6 telas)
- **SportsScreen** — Multi-select de 12 esportes
- **LevelScreen** — Iniciante/Intermediário/Avançado
- **ObjectivesScreen** — Objetivos (perder peso, performance, social, etc)
- **HobbiesScreen** — Interesses complementares com seleção por chips
- **AvailabilityScreen** — Disponibilidade semanal
- **LocationScreen** — GPS de alta precisão → IP → 12 cidades manuais

## 8.3 Main Tabs
- **HomeTab (Feed)** — Discovery + Stories bar + posts
- **MapTab** — Mapa interativo com eventos + heatmap toggle
- **TrackingTab (Treinar)** — Botão central elevado com gradient
- **ChatTab (Grupos)** — Lista de grupos + chats
- **ProfileTab** — Hero + XP bar + stats + conquistas

## 8.4 Tracking
- **TrackingMainScreen** — Pre-treino com clima + sugestão + botão Start
- **ActiveTrackingScreen** — Em treino com:
  - Mapa fullscreen
  - Timer grande
  - Métricas (km, pace, velocidade, calorias)
  - Linha 2 (altitude, ganho elevação, pontos GPS)
  - Voltas
  - Audio coach toggle 🔊
  - Auto-pause toggle ⏸
  - Live tracking toggle 📡
  - Controles (lap/pause/finish)
- **ActivitySummaryScreen** — Resumo natural + métricas + mapa da rota + post no feed + export GPX
- **ActivityHistoryScreen** — Histórico paginado

## 8.5 Social
- **DiscoveryScreen** — Swipe Tinder-like com card grande + Stories bar topo
- **MyProfileScreen** — Hero + avatar + stats grid 2x3
- **EditProfileScreen** — Avatar, bio, esportes, etc

## 8.6 Stories
- **StoryViewerScreen** — Fullscreen com progress bars + tap zones + like
- **CreateStoryScreen** — Camera/galeria + caption + sport tag

## 8.7 Outros
- **RankingScreen** — Tabs Mensal/Semanal/Amigos + pódio top 3 + lista
- **GroupsScreen** — Tabs Meus/Descobrir/Ranking + modal de criação
- **TrainingPlanScreen** — Escolha 5K/10K/21K + visualizar semana atual + timeline
- **LiveViewScreen** — Tracking público via `/live/:token`

---

# 9. Componentes Reutilizáveis

## UI
- **Button** — Pressable com gradient, animação de press, 3 sizes (sm/md/lg), variants (primary/outline/ghost), icon left/right
- **Toast** — `showToast(msg, kind)` global com 3 kinds (success/error/info), animação slide+fade
- **Skeleton** — Shimmer loader
- **SkeletonList** — Presets (ChatList, EventCard, StatsCard, Profile)
- **ProgressBar** — Barra de progresso (onboarding, etc)

## Layout
- **ScreenContainer** — maxWidth 520px web + safe area

## Mapa
- **SyncMap** (native re-export) + **SyncMap.web** (Leaflet vanilla)
  - `MapView`, `Marker`, `Circle`, `Polyline`, `HeatLayer`

## Features
- **XPBar** — Nível + título + barra de XP
- **DailyQuestsCard** — 3 missões + countdown reset
- **StreakBadge** — 4 tiers (Começando/Aceso/Em Chamas/Lendário) com animação de fogo
- **StoriesBar** — Lista horizontal estilo Instagram
- **ActivityComments** — Lista + input + animação heart
- **TodayBriefWidget** — Sunrise/sunset + AQI + workout idea + hidratação + frase
- **BestTimeWidget** — Chart de 12h com peak

---

# 10. Serviços e Utilitários

## Serviços (`mobile/src/services/`)
- **api.ts** — Axios + interceptors (JWT do SecureStore)
- **secure-storage.ts** — Wrapper unificado SecureStore + fallback web
- **location.service.ts** — GPS alta precisão + Nominatim + cache
- **external-apis.ts** — integrações externas e cálculos auxiliares (clima, sol, AQI, treino, calorias, pace, VO2max e hidratação)
- **tracking-socket.service.ts** — Socket.io com JWT no handshake
- **push-notifications.service.ts** — Expo Push (native) + Notification API (web)
- **audio-coach.service.ts** — TTS (Web Speech API + expo-speech)
- **stories.service.ts** — API stories
- **groups.service.ts** — API groups
- **feed.service.ts** — API feed

## Utilitários (`mobile/src/utils/`)
- **pace-zones.ts** — Z1-Z5 do pace de limiar
- **xp-system.ts** — Curva polinomial level 1-100 + 9 títulos
- **daily-quests.ts** — 12 quests pool com shuffle determinístico
- **workout-summary.ts** — Resumo natural em pt-BR
- **auto-pause.ts** — Detector com janela rolante 5s
- **training-plans.ts** — 3 planos completos com semanas/sessões

## Backend utils (`backend/src/common/`)
- **haversine.ts** — Distância entre coordenadas
- **sanitize.util.ts** — `sanitizeText`, `sanitizeUrl`, `isSafeImageBuffer` (magic bytes)
- **audit.service.ts** — Audit log + mascaramento IP

---

# 11. Requisitos Funcionais (RF)

## RF1 — Autenticação
- **RF1.1** Cadastro com email + senha forte
- **RF1.2** Confirmação obrigatória do email por código de 6 dígitos antes do primeiro JWT
- **RF1.3** Reenvio do código com invalidação do código anterior
- **RF1.4** Login email/senha com bloqueio de conta não confirmada
- **RF1.5** Recuperação por token (`/forgot-password`)
- **RF1.6** Refresh token rotation (access 15min + refresh 7d)
- **RF1.7** Logout (revoga família)
- **RF1.8** Listar sessões ativas
- **RF1.9** Revogar sessão específica
- **RF1.10** Exportar dados (LGPD)
- **RF1.11** Anonimizar conta (LGPD)
- **RF1.12** 2FA TOTP (estrutura pronta)

## RF2 — Perfil & Onboarding
- **RF2.1** Escolha de esportes (12 opções)
- **RF2.2** Nível esportivo
- **RF2.3** Objetivos
- **RF2.4** Disponibilidade semanal
- **RF2.5** Localização (3 níveis de fallback)
- **RF2.6** Upload de avatar
- **RF2.7** Bio, data de nascimento, cidade
- **RF2.8** Editar perfil
- **RF2.9** Bloquear/desbloquear/denunciar

## RF3 — Geolocalização
- **RF3.1** GPS de alta precisão
- **RF3.2** Geocoding reverso (cidade/bairro)
- **RF3.3** Mapa interativo (Leaflet web / RN-Maps native)
- **RF3.4** Heatmap de rotas populares
- **RF3.5** Markers de eventos no mapa
- **RF3.6** Sincronização de localização no backend

## RF4 — Atividade Esportiva
- **RF4.1** Iniciar/pausar/finalizar
- **RF4.2** Tracking via WebSocket
- **RF4.3** Cálculo de distância (Haversine + filtro ruído)
- **RF4.4** Pace em min:seg/km
- **RF4.5** Velocidade
- **RF4.6** Calorias via MET
- **RF4.7** Altitude + ganho de elevação
- **RF4.8** Voltas manuais
- **RF4.9** **Auto-pause inteligente** (5s)
- **RF4.10** **Audio Coach** (TTS): início/km/pausa/finish/motivação
- **RF4.11** **Pace Zones Z1-Z5**
- **RF4.12** **Live tracking compartilhável** (link 24h)
- **RF4.13** Histórico paginado
- **RF4.14** Detalhes (rota desenhada)
- **RF4.15** **Export GPX/CSV** (Strava/Garmin)
- **RF4.16** **Resumo natural** automático

## RF5 — Social
- **RF5.1** Discovery (swipe)
- **RF5.2** Match por pace compatível
- **RF5.3** Like + match mútuo
- **RF5.4** Chat 1:1
- **RF5.5** **Stories 24h** (foto/vídeo)
- **RF5.6** Visualizar story fullscreen
- **RF5.7** Like em story
- **RF5.8** Comentários em atividades
- **RF5.9** Kudos (curtir)
- **RF5.10** Bloquear/denunciar
- **RF5.11** **Feed público de atividades**
- **RF5.12** Like no feed

## RF6 — Grupos/Clubes
- **RF6.1** Criar grupo (admin)
- **RF6.2** Público (descoberta livre) ou Privado (com inviteCode)
- **RF6.3** Entrar/sair
- **RF6.4** Deletar (só admin)
- **RF6.5** Soma de km dos membros
- **RF6.6** Ranking de grupos (por cidade/esporte)
- **RF6.7** Ranking interno de membros

## RF7 — Eventos
- **RF7.1** Criar evento
- **RF7.2** Listar próximos (raio)
- **RF7.3** Inscrever-se
- **RF7.4** Cancelar inscrição
- **RF7.5** **Eventos relâmpago** (push pra usuários no raio)

## RF8 — Gamificação
- **RF8.1** **Sistema XP + Levels** (1-100, 9 títulos)
- **RF8.2** XP por: 10/km, 50/atividade, 100/conquista, 25/streak
- **RF8.3** **Daily Quests** (3 missões rotativas)
- **RF8.4** **Streaks** (dias consecutivos)
- **RF8.5** **50+ Conquistas**
- **RF8.6** Ranking mensal/semanal/amigos
- **RF8.7** Pódio top 3 (medalha)

## RF9 — Planos de Treino
- **RF9.1** **5K em 8 semanas** (iniciante)
- **RF9.2** **10K em 10 semanas** (intermediário)
- **RF9.3** **21K em 12 semanas** (meia maratona)
- **RF9.4** Visualizar semana atual
- **RF9.5** Persistência local

## RF10 — Notificações
- **RF10.1** Push (Expo)
- **RF10.2** In-app: kudos/comentário/match/mensagem/story/event
- **RF10.3** **Cron hidratação** 10/14/17h
- **RF10.4** **Cron lembrete treino** 7h
- **RF10.5** Evento relâmpago dispara push em raio

## RF11 — Clima & Ambiente
- **RF11.1** Clima atual (temp, ícone, recomendação)
- **RF11.2** **AQI** (qualidade do ar)
- **RF11.3** Sunrise/sunset
- **RF11.4** **Melhor horário** (score por hora)
- **RF11.5** Recomendação de hidratação

## RF12 — Outros
- **RF12.1** Idioma pt-BR
- **RF12.2** Citações motivacionais
- **RF12.3** Estimativa **VO2 max** (Daniels)
- **RF12.4** Sugestão de treino do dia
- **RF12.5** **PWA instalável**
- **RF12.6** Funcionamento offline parcial

---

# 12. Requisitos Não-Funcionais (RNF)

## RNF1 — Segurança
- bcrypt 12 rounds
- JWT_SECRET obrigatório em prod
- Access 15min + Refresh 7d (rotação com família)
- Detecção de reuse → revoga família
- Account lockout 5 tentativas / 30min
- Anti-enumeração (timing constante + msg genérica)
- CSP estrito em prod
- HSTS preload 6 meses
- Permissions-Policy
- CORS exact-match
- Rate limit por rota (login 5/5min)
- Sanitização XSS em UGC
- URLs sanitizadas
- Token JWT em SecureStore (não AsyncStorage)
- WebSocket com auth JWT
- Live tracking token expira 24h
- crypto.randomBytes (não Math.random)
- Audit log com IP mascarado
- Swagger desativado por padrão em produção; quando habilitado, exige Basic Auth
- LGPD/GDPR endpoints

## RNF2 — Performance
- WebSocket batch persist 3s
- Cache local de geocoding
- Cache local de heatmap
- Subsampling de pontos GPS (1/5)
- Service Worker (5 estratégias)
- Brotli compression (Vercel)
- maxWidth 520px no web
- Imagens Unsplash com qualidade reduzida
- Healthcheck dedicado sem auth

## RNF3 — Disponibilidade
- Auto-restart e healthcheck no Render
- Healthcheck 120s
- CDN global (Vercel)
- GPS resiliente (3 fallbacks)
- WS reconnect infinito
- PWA offline parcial

## RNF4 — Usabilidade
- Temas claro e escuro persistidos, com tokens centralizados
- Mobile-first (412px)
- Touch targets ≥44px
- 60fps animations
- Pull-to-refresh
- Skeleton loaders
- Empty states ilustrados
- Toast notifications
- pt-BR
- Glass morphism
- Splash customizada
- Tab bar com botão central elevado

## RNF5 — Manutenibilidade
- TypeScript strict
- DTO validation
- ESLint
- Modular NestJS
- SW versionado
- CI/CD automático
- Lazy require pra pkgs opcionais

## RNF6 — Privacidade
- Localização só com matches
- Email único
- EXIF strip (TODO)
- Senhas nunca em logs
- Tokens fora de URLs
- Sem trackers third-party

## RNF7 — Escalabilidade
- Postgres réplicas-ready
- WS isolado em namespace
- Stateless backend
- Push batch de 100
- Trust proxy

## RNF8 — Custo
- Render, Vercel, Supabase e Resend estão nos planos configurados para o projeto
- O fluxo atual não exige Google Maps nem provedor de pagamento ativo
- APIs públicas e faixas gratuitas têm limites e políticas próprias; revisar antes de escalar
- Custos e cotas devem ser consultados nos painéis oficiais, pois podem mudar

## RNF9 — Compatibilidade
- iOS 13+ via Expo/PWA
- Android 6+ via Expo/PWA
- Chrome/Firefox/Safari/Edge modernos
- SW degrada graciosamente

## RNF10 — Internacionalização
- pt-BR
- toLocaleDateString
- TTS pt-BR

---

# 13. Segurança

## 13.1 Camadas de defesa

```
┌─────────────────────────────────────────────────────┐
│  1. CDN (Vercel) — DDoS protection, TLS 1.3, HSTS   │
├─────────────────────────────────────────────────────┤
│  2. CORS exact-match — Render só aceita FRONTEND    │
├─────────────────────────────────────────────────────┤
│  3. Helmet — CSP, HSTS, Permissions-Policy, X-* hdrs│
├─────────────────────────────────────────────────────┤
│  4. Rate limiting — Throttler por IP/rota           │
├─────────────────────────────────────────────────────┤
│  5. Validation Pipe — DTOs strict + sanitização     │
├─────────────────────────────────────────────────────┤
│  6. Auth JWT — Bearer obrigatório em rotas guard    │
├─────────────────────────────────────────────────────┤
│  7. Ownership checks — só dono modifica recurso     │
├─────────────────────────────────────────────────────┤
│  8. Audit log — eventos sensíveis (IP mascarado)    │
└─────────────────────────────────────────────────────┘
```

## 13.2 Senhas
- bcrypt 12 rounds (~250ms/hash)
- Mínimo 8 chars
- Obriga letras + números
- Blacklist top 10 senhas comuns
- Anti-timing: senha errada gasta mesmo tempo de bcrypt

## 13.3 Tokens
- **Access JWT**: 15min, contém `{ sub, email }`
- **Refresh**: 7d, opaque random (48 bytes base64url), SHA-256 hashed no banco
- **Família**: agrupa rotações; reuse detection revoga toda família
- **Live tracking**: 24h, crypto.randomBytes(24)

## 13.4 Confirmação de email
- Cadastro por email não retorna JWT antes da confirmação
- Código de 6 dígitos gerado com `crypto.randomInt`
- Somente o hash SHA-256 do código é persistido
- Expiração em 10 minutos e máximo de 5 tentativas
- Reenvio invalida o código anterior e possui rate limit
- API HTTPS do Resend evita a restrição de SMTP do Render Free
- Fluxo completo e validação operacional na [seção 22](#autenticacao-e-identidade)

## 13.5 Account lockout
- 5 tentativas erradas em janela
- 30min bloqueado
- Audit log registra `account_locked`

## 13.6 Sanitização UGC
Aplicada em: feed caption/photo, comentários, grupo name/desc/sport/city, story caption.

Remove: `<script>`, `<style>`, event handlers, `javascript:` URLs, `data:` não-imagem.

## 13.7 LGPD/GDPR
- `GET /users/me/export` — JSON com todos os dados
- `DELETE /users/me` — anonimização (não delete, pra integridade referencial)
- IP mascarado nos logs (último octeto IPv4 zerado, IPv6 /64)

## 13.7 Headers de produção
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; ...
Strict-Transport-Security: max-age=15552000; includeSubDomains; preload
Permissions-Policy: camera=(), microphone=(), payment=(), usb=()
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

---

# 14. Performance

## 14.1 Frontend
- Bundle ~2.5MB (Expo web export)
- Brotli compression no CDN
- Imagens Unsplash com `auto=format&q=80`
- Lazy load (TODO: code splitting)
- Memoização em listas (TODO: propagar React.memo)

## 14.2 Backend
- Batch persist GPS (3s)
- Subsampling heatmap (1/5)
- Index em audit_logs(userId, createdAt) e (event, createdAt)
- Cache de membership em socket (evita query por ponto)

## 14.3 PWA / Service Worker
5 estratégias de cache:
1. **Network-first** — navegação e HTML, evitando tela branca após deploy
2. **Cache-first** — assets versionados (JS/CSS/fontes)
3. **Stale-while-revalidate** — imagens
4. **Network-first** — APIs (5min TTL)
5. **Cache-first long** — OSM tiles

Versão `sync-v4` com invalidação automática dos caches anteriores.

---

# 15. Deploy & Infra

## 15.1 Frontend (Vercel)
- Produção: https://sync-2-0-blush.vercel.app
- Painel: https://vercel.com/dashboard
- Build: `npx expo export --platform web --output-dir dist && node scripts/postbuild.js`
- Output: `dist/`
- Install: `npm install --legacy-peer-deps`
- Rewrites:
  - `/live/:token` → `/index.html`
  - SPA fallback (exclui SW e manifest)
- Headers:
  - SW: `Cache-Control: no-cache` + `Service-Worker-Allowed: /`
  - Manifest: `Content-Type: application/manifest+json`
  - Global: `X-Content-Type-Options`, `X-Frame-Options: DENY`

## 15.2 Backend (Render)
- Produção: https://sync-backend-o2zc.onrender.com
- Healthcheck: https://sync-backend-o2zc.onrender.com/health
- Swagger opcional: https://sync-backend-o2zc.onrender.com/api/docs (`404` enquanto não habilitado)
- Painel: https://dashboard.render.com/
- Configuração declarada em `render.yaml`
- Build: `npm install && npm run build`
- Start: `node dist/main.js`
- Healthcheck: `/health`
- Envio de email pela API HTTPS do Resend
- O plano Free pode apresentar cold start; a primeira chamada pode exibir `Service waking up`

## 15.3 Postgres (Supabase)
- Conexão pelo `DATABASE_URL`
- SSL habilitado em produção
- Supabase usado somente como PostgreSQL; autenticação permanece no NestJS
- O template `render.yaml` usa `DB_SYNCHRONIZE=true` para provisionar um banco vazio; no serviço de produção existente, mantenha `false` para executar migrations automaticamente

## 15.4 CI/CD
- Push em `main` no GitHub
- GitHub Actions executa typecheck e testes de backend e mobile
- Vercel webhook → build frontend
- Render webhook → build backend
- Execuções: https://github.com/SanleyLujan/SYNC-2.0/actions

---

# 16. Variáveis de Ambiente

## 16.1 Backend (Render)

| Var | Obrigatória | Descrição |
|-----|-------------|-----------|
| `DATABASE_URL` | sim | Connection string do PostgreSQL no Supabase |
| `JWT_SECRET` | **sim em prod** | Segredo JWT (64 chars random) |
| `JWT_EXPIRATION` | não | Default `7d` |
| `NODE_ENV` | sim | `production` |
| `PORT` | não | Default `3000` |
| `FRONTEND_URL` | sim | CSV de URLs permitidas no CORS |
| `BACKEND_URL` | sim | URL pública usada para links de uploads |
| `DB_SYNCHRONIZE` | não | `true` no primeiro deploy do schema; depois, usar `false` para migrations |
| `DB_SSL` | não | Default `true` em prod |
| `RESEND_API_KEY` | sim | Chave privada da API HTTPS do Resend |
| `EMAIL_FROM` | sim | Remetente verificado, ex.: `Sync <noreply@syncapp.site>` |
| `SWAGGER_USER` | não | Username pra basic-auth do `/api/docs` |
| `SWAGGER_PASS` | não | Senha pra basic-auth |
| `ADMIN_EMAILS` | não | CSV de emails autorizados no painel administrativo |
| `REMINDERS_DISABLED` | não | `true` desabilita cron de lembretes |
| `PURGE_DISABLED` | não | `true` desabilita a purga LGPD agendada |
| `SENTRY_DSN` | não | Ativa monitoramento quando houver projeto Sentry configurado |
| `SUBSCRIPTION_DEMO` | não | Deve permanecer `false` em produção |

## 16.2 Frontend (Vercel)

| Var | Descrição |
|-----|-----------|
| `EXPO_PUBLIC_API_URL` | URL base do backend: `https://sync-backend-o2zc.onrender.com` |

---

# 17. Como rodar localmente

## 17.1 Pré-requisitos
- Node.js 20+
- npm 10+
- (Opcional) PostgreSQL local compatível; o fluxo padrão de desenvolvimento usa SQLite

## 17.2 Backend

```bash
cd backend
npm install --legacy-peer-deps
# Opcional: instalar SQLite pra rodar sem Postgres
npm install better-sqlite3
# Configurar .env
cat > .env << EOF
NODE_ENV=development
JWT_SECRET=local-dev-secret-change-me
PORT=3000
FRONTEND_URL=http://localhost:8081
EOF
npm run start:dev
```

API em `http://localhost:3000`, Swagger em `http://localhost:3000/api/docs`.

## 17.3 Frontend

```bash
cd mobile
npm install --legacy-peer-deps
# Para web
npx expo start --web
# Para iOS (precisa de Mac)
npx expo start --ios
# Para Android
npx expo start --android
```

Acesse `http://localhost:8081` (web).

## 17.4 Variáveis no mobile

```bash
# mobile/.env.local
EXPO_PUBLIC_API_URL=http://localhost:3000
```

---

# 18. APIs Externas

## 18.1 OSRM
- URL: `https://router.project-osrm.org/route/v1`
- Documentação: https://project-osrm.org/docs/
- Uso: cálculo de rotas públicas no planejador
- Instância pública: aplicar cache, evitar alto volume e consultar a política do projeto antes de escalar

## 18.2 OpenStreetMap / CartoDB Tiles
- URL OSM correta: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
- URL web atual: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
- Política de tiles OSM: https://operations.osmfoundation.org/policies/tiles/
- Atribuição: `© OpenStreetMap`
- Sem chave

## 18.3 Nominatim
- URL: `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=&lon=`
- Política de uso: https://operations.osmfoundation.org/policies/nominatim/
- Rate limit: 1 req/sec (uso individual respeitoso)
- Header `Referer` recomendado

## 18.4 Open-Meteo
- Clima: `https://api.open-meteo.com/v1/forecast?latitude=&longitude=&current_weather=true&hourly=...`
- AQI: `https://air-quality-api.open-meteo.com/v1/air-quality?...`
- Documentação: https://open-meteo.com/en/docs
- Sem chave no fluxo atual; consultar a documentação do provedor para limites vigentes

## 18.5 Sunrise-Sunset.org
- URL: `https://api.sunrise-sunset.org/json?lat=&lng=`
- Sem chave

## 18.6 ipapi.co
- URL: `https://ipapi.co/json/`
- Uso esporádico como fallback; consultar a cota vigente do plano

## 18.7 Expo Push API
- URL: `https://exp.host/--/api/v2/push/send`
- Documentação: https://docs.expo.dev/push-notifications/sending-notifications/
- Batch de até 100 mensagens no código atual; consultar limites vigentes do Expo

## 18.8 Unsplash
- URL direta: `https://images.unsplash.com/photo-XXX?auto=format&fit=crop&w=1400&q=80`
- Sem chave (uso de URLs específicas em hero images)

## 18.9 Resend
- URL: `https://api.resend.com/emails`
- Documentação: https://resend.com/docs
- Uso: envio transacional de códigos de confirmação pelo backend
- Autenticação: `RESEND_API_KEY` somente no Render; remetente no domínio verificado `syncapp.site`

---

# 19. PWA

## 19.1 Manifest (`mobile/public/manifest.json`)
```json
{
  "name": "Sync",
  "short_name": "Sync",
  "theme_color": "#4A0E2C",
  "background_color": "#0A0A0F",
  "display": "standalone",
  "orientation": "portrait",
  "lang": "pt-BR",
  "shortcuts": [
    { "name": "Começar treino", "url": "/?tab=tracking" },
    { "name": "Descobrir", "url": "/?tab=discover" }
  ]
}
```

Os valores de cor do manifest ainda são legados e diferem dos tokens de runtime
(`mobile/src/theme/colors.ts`) e do `themeColor` azul de `mobile/app.json`. Essa
uniformização permanece na lista de revisão visual da seção 23.

## 19.2 Service Worker (`mobile/public/service-worker.js`)
- Versão: `sync-v4`
- Navegação em `network-first` para nunca prender o navegador em um HTML de deploy antigo
- 5 estratégias de cache (ver §14.3)
- Push notifications handler
- Notificationclick → abre app

## 19.3 Título da aba no navegador
- O `NavigationContainer` usa um formatador fixo para manter o título `Sync`.
- A configuração impede que nomes internos de rotas, como `FeedMain`, ou o valor `undefined` apareçam na aba durante transições de navegação.
- O `<title>Sync</title>` gerado no build continua sendo o título inicial antes do React carregar.

## 19.4 Instalação
- Chrome/Edge: ícone "+" na barra de endereço
- iOS Safari: Compartilhar → "Adicionar à tela inicial"
- Android Chrome: prompt automático após uso

---

# 20. Roadmap / Pendências

## Pendentes (curto prazo)
- [ ] Code splitting (lazy load Stories/Map/Stats)
- [ ] EXIF strip em uploads
- [ ] 2FA TOTP ativação (estrutura já criada)
- [ ] Migrar uploads para storage persistente (Supabase Storage/S3/R2)
- [ ] Ativar e validar Sentry com DSN de produção
- [ ] Configurar Google OAuth e habilitar o botão no app
- [ ] Integrar checkout real com webhook assinado

## Médio prazo
- [ ] Audio coach durante navegação ("vire à direita em 200m")
- [ ] Importar GPX/TCX/FIT
- [ ] Integração Google Fit + Apple Health
- [ ] Heart rate via câmera (PPG)
- [ ] Chat em grupo dentro de Groups
- [ ] Direct calls voz/vídeo (WebRTC peer-to-peer)

## Longo prazo
- [ ] Marketplace de eventos pagos
- [ ] Coach humano marketplace
- [ ] Mascote evolutivo (avatar pet)
- [ ] Treino ao vivo em grupo (todos veem todos correndo)

---

<a id="operacao-e-recuperacao"></a>

# 21. Operação e Recuperação

Esta seção é o procedimento operacional único para a produção existente, para a criação
de um ambiente novo e para a restauração do projeto em outro computador.

## 21.1 Ambientes e painéis atuais

| Recurso | Endereço atual | Finalidade |
|---------|----------------|------------|
| App web/PWA | https://sync-2-0-blush.vercel.app | Frontend público na Vercel |
| API | https://sync-backend-o2zc.onrender.com | Backend NestJS no Render |
| Healthcheck | https://sync-backend-o2zc.onrender.com/health | Monitoramento do backend |
| Swagger opcional | https://sync-backend-o2zc.onrender.com/api/docs | Disponível somente com credenciais configuradas |
| Repositório | https://github.com/SanleyLujan/SYNC-2.0 | Código e histórico oficial |
| CI | https://github.com/SanleyLujan/SYNC-2.0/actions | Typecheck e testes |
| Vercel | https://vercel.com/dashboard | Deploy e variáveis do frontend |
| Render | https://dashboard.render.com/ | Deploy, logs e variáveis do backend |
| Supabase | https://supabase.com/dashboard/projects | PostgreSQL e connection string |
| Resend | https://resend.com/domains | Domínio e entrega de email |
| Hostinger | https://hpanel.hostinger.com/ | DNS de `syncapp.site` |

Em 2026-08-30, frontend, raiz da API e healthcheck responderam `200`. O Swagger
respondeu `404`, comportamento esperado enquanto `SWAGGER_USER` e `SWAGGER_PASS`
não estiverem definidos. O plano gratuito do Render pode causar cold start na primeira
requisição.

## 21.2 Restaurar em um computador novo

Pré-requisitos: Git, Node.js 20+, npm 10+ e acesso às contas GitHub, Vercel, Render,
Supabase e Resend. Segredos de produção não ficam no repositório e precisam ser
recuperados nos painéis responsáveis.

```bash
git clone https://github.com/SanleyLujan/SYNC-2.0.git
cd SYNC-2.0/backend
npm install --legacy-peer-deps
cd ../mobile
npm install --legacy-peer-deps
```

Para desenvolvimento local, siga a [seção 17](#17-como-rodar-localmente). Antes de
alterar produção, confirme que o clone aponta para o repositório correto:

```bash
git remote -v
git status
```

## 21.3 Fluxo normal de publicação

1. Trabalhe em uma branch e valide backend e mobile localmente.
2. Envie a alteração ao GitHub e faça merge em `main`.
3. O GitHub Actions executa as verificações do repositório.
4. A Vercel publica o frontend a partir da raiz, conforme `vercel.json`.
5. O Render publica o backend conforme `render.yaml`.
6. Valide o healthcheck, o app e os logs dos dois serviços.

Comandos de verificação úteis:

```bash
cd backend
npm run build
npm test

cd ../mobile
npm run typecheck
npx expo export --platform web --output-dir dist
```

Use os scripts realmente disponíveis em cada `package.json` quando o projeto evoluir;
os pipelines do GitHub são a referência final das verificações obrigatórias.

## 21.4 Criar a infraestrutura do zero

1. **Supabase:** crie um projeto PostgreSQL, copie a connection string do Session
   Pooler e mantenha SSL ativo. O Sync usa o Supabase como banco, não Supabase Auth.
2. **Render:** conecte o repositório e aplique o Blueprint de `render.yaml`. Defina as
   variáveis da [seção 16](#16-variáveis-de-ambiente), especialmente `DATABASE_URL`,
   `JWT_SECRET`, `FRONTEND_URL`, `BACKEND_URL`, `RESEND_API_KEY` e `EMAIL_FROM`.
3. **Schema:** em banco realmente vazio, `DB_SYNCHRONIZE=true` pode ser usado apenas
   no primeiro provisionamento previsto pelo Blueprint. Depois, altere para `false` e
   use migrations como única fonte de evolução do schema.
4. **Resend:** adicione `syncapp.site`, publique no DNS da Hostinger exatamente os
   registros fornecidos pelo Resend e aguarde o status `Verified`.
5. **Vercel:** importe o mesmo repositório, mantenha a raiz do projeto e configure
   `EXPO_PUBLIC_API_URL` com a URL pública do novo backend.
6. **CORS:** atualize `FRONTEND_URL` no Render com todas as origens autorizadas,
   separadas por vírgula, e faça novo deploy.

Configuração mínima de produção do backend:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
DB_SSL=true
DB_SYNCHRONIZE=false
JWT_SECRET=uma-chave-longa-forte-e-privada
FRONTEND_URL=https://sync-2-0-blush.vercel.app
BACKEND_URL=https://sync-backend-o2zc.onrender.com
RESEND_API_KEY=re_...
EMAIL_FROM=Sync <noreply@syncapp.site>
SUBSCRIPTION_DEMO=false
```

Configuração mínima do frontend:

```env
EXPO_PUBLIC_API_URL=https://sync-backend-o2zc.onrender.com
```

Nunca versione chaves reais, `.env` de produção ou connection strings. Os arquivos
`backend/.env.example` e `mobile/.env.production.example` documentam apenas nomes e
valores seguros de exemplo.

## 21.5 Checklist pós-deploy

1. Abra `/health` e confirme `status: ok`.
2. Abra o PWA em janela anônima para evitar cache antigo do service worker.
3. Cadastre uma conta real e conclua a confirmação de email.
4. Faça login, onboarding, busca, match e envio de mensagem.
5. Confirme nos logs do Render que migrations terminaram sem erro.
6. Confirme na Vercel que `EXPO_PUBLIC_API_URL` pertence ao ambiente de produção.
7. Valide upload e recarregue a URL gerada; o disco local do Render é efêmero.
8. Confira erros de CORS, Resend e banco antes de considerar a publicação concluída.

## 21.6 Diagnóstico rápido

| Sintoma | Verificação |
|---------|-------------|
| Backend demora ou retorna indisponível | Aguarde o cold start e consulte os logs do Render |
| Erro de CORS | Compare a origem exata com `FRONTEND_URL` |
| Frontend chama API antiga | Revise `EXPO_PUBLIC_API_URL` e gere novo deploy na Vercel |
| Erro de banco/SSL | Revise `DATABASE_URL`, Session Pooler e `DB_SSL=true` |
| Coluna ou tabela ausente | Verifique migrations e mantenha `DB_SYNCHRONIZE=false` em produção |
| Email não chega | Confira domínio `Verified`, `RESEND_API_KEY`, `EMAIL_FROM` e logs do Render |
| PWA exibe versão antiga | Faça hard refresh ou teste em janela anônima após o deploy |
| Upload desaparece | Migre para Supabase Storage, S3 ou R2; o filesystem do Render não é persistente |

O domínio `syncapp.site` pode ser conectado ao frontend separadamente. A verificação
DNS usada pelo Resend autentica o remetente, mas não publica o site automaticamente.

---

<a id="autenticacao-e-identidade"></a>

# 22. Autenticação e Identidade

## 22.1 Arquitetura de autenticação

O backend NestJS é responsável por usuários, senha bcrypt, confirmação de email e JWT.
O Supabase é somente o PostgreSQL. Essa separação permite trocar o provedor de banco
sem substituir endpoints, tokens ou as regras de sessão do Sync.

## 22.2 Confirmação obrigatória por código

1. `POST /api/auth/register` valida os dados e cria a conta com
   `emailVerified=false`, sem devolver JWT.
2. O backend gera seis dígitos com `crypto.randomInt`, persiste somente o hash SHA-256
   e envia o código pela API HTTPS do Resend.
3. O código expira em 10 minutos e aceita no máximo cinco tentativas.
4. O app mantém a pessoa em `VerifyEmailCodeScreen` e envia o código a
   `POST /api/auth/verify-email-code`.
5. Depois da validação correta, código e expiração são apagados, a conta é marcada
   como confirmada e o JWT é emitido.
6. `POST /api/auth/login` devolve `EMAIL_NOT_VERIFIED` para uma conta pendente; a
   estratégia JWT também impede que um token antigo contorne a confirmação.

O reenvio usa `POST /api/auth/request-verification`: há espera de 60 segundos na UI,
limite de três solicitações em cinco minutos por IP, invalidação imediata do código
anterior, reinício do contador de tentativas e resposta genérica contra enumeração de
contas. A comparação usa `timingSafeEqual` e falhas entram no audit log como
`email_verification_failure`.

| Método | Rota | Resultado |
|--------|------|-----------|
| `POST` | `/api/auth/register` | Cria conta pendente e envia o código |
| `POST` | `/api/auth/verify-email-code` | Confirma o código e retorna usuário + JWT |
| `POST` | `/api/auth/request-verification` | Invalida o anterior e envia outro código |
| `POST` | `/api/auth/login` | Bloqueia conta pendente com `EMAIL_NOT_VERIFIED` |

A migration `backend/src/migrations/1781700000000-AddEmailVerificationAttempts.ts`
adiciona `emailVerificationAttempts`. Os campos `emailVerified`,
`emailVerificationToken` e `emailVerificationExpires` já compõem o estado do fluxo.

Arquivos principais:

- `backend/src/auth/auth.service.ts`
- `backend/src/auth/email.service.ts`
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/guards/jwt.strategy.ts`
- `backend/src/users/entities/user.entity.ts`
- `mobile/src/screens/Auth/VerifyEmailCodeScreen.tsx`
- `mobile/src/services/auth.service.ts`

## 22.3 Resend e domínio de envio

O backend usa a API HTTPS do Resend para evitar dependência das portas SMTP bloqueadas
em alguns ambientes. O remetente atual é `Sync <noreply@syncapp.site>`; os registros de
autenticação do domínio são administrados na Hostinger.

- Domínios Resend: https://resend.com/domains
- Documentação Resend: https://resend.com/docs
- DNS Hostinger: https://hpanel.hostinger.com/

Não é necessário comprar uma caixa postal para o endereço `noreply`. A entrega real
continua dependente de chave válida, domínio verificado, propagação DNS e reputação de
envio. Se o provedor falhar, a conta permanece pendente e pode solicitar novo código.

Validação após deploy:

1. Confirme `syncapp.site` como `Verified` no Resend.
2. Revise `RESEND_API_KEY` e `EMAIL_FROM` no Render e publique novamente.
3. Cadastre um email real e confirme que `register` não retorna `accessToken`.
4. Teste código incorreto, código correto, reenvio e login de conta pendente.
5. Consulte os logs do Render para o resultado devolvido pelo Resend.

## 22.4 Ativar login com Google

O backend possui `POST /api/auth/google` e o store mobile possui
`loginWithGoogle`, mas o botão deve continuar oculto até a configuração completa.
Emails entregues pelo Google são tratados como verificados pelo provedor.

1. Abra https://console.cloud.google.com/apis/credentials e crie um cliente OAuth do
   tipo **Web application**. Para builds nativos, crie também clientes Android e iOS.
2. No cliente Web, autorize `https://sync-2-0-blush.vercel.app`,
   `http://localhost:8081` e cada domínio personalizado realmente usado.
3. No Render, defina `GOOGLE_CLIENT_ID` para um cliente ou
   `GOOGLE_CLIENT_IDS=id-web,id-android,id-ios` para vários públicos aceitos.
4. Instale as dependências no mobile:

```bash
cd mobile
npx expo install expo-auth-session expo-web-browser expo-crypto
```

5. Em `mobile/src/screens/Auth/LoginScreen.tsx`, inicialize
   `WebBrowser.maybeCompleteAuthSession()`, use
   `Google.useIdTokenAuthRequest` com os IDs de cada plataforma e envie
   `response.params.id_token` para `useAuthStore((s) => s.loginWithGoogle)`.
6. Só então exiba o botão e valide web, Android e iOS separadamente.

Referências oficiais:

- Políticas OAuth: https://developers.google.com/identity/protocols/oauth2/policies
- Expo AuthSession: https://docs.expo.dev/versions/latest/sdk/auth-session/

---

<a id="design-system"></a>

# 23. Design System

## 23.1 Fontes canônicas visuais

| Arquivo | Responsabilidade |
|---------|------------------|
| `mobile/src/theme/colors.ts` | Tokens `darkTheme` e `lightTheme`, gradientes e cores semânticas |
| `mobile/src/store/themeStore.ts` | Modo atual e persistência da preferência |
| `mobile/src/theme/images.ts` | Imagens remotas compartilhadas |
| `mobile/src/assets/images/` | Logos, ícones e imagens locais |
| `mobile/src/components/Logo.tsx` | Renderização única da marca no app |
| `mobile/app.json` | Ícones nativos, splash, favicon e tema web |

Use `useThemeStore((s) => s.theme)` nas telas. Cores fixas são aceitáveis somente
quando carregam significado externo ou semântico, como mapa, erro, sucesso e medalhas.

## 23.2 Regras de uso

| Elemento | Tokens preferidos |
|----------|-------------------|
| Ação principal | `theme.gradientPrimary`, `theme.primary`, `theme.primaryText` |
| Card | `theme.surface`, `theme.surfaceSecondary`, `theme.border` |
| Texto | `theme.textPrimary`, `theme.textSecondary` |
| Input | `theme.input`, `theme.border`, `theme.placeholder` |
| Estado | `theme.success`, `theme.warning`, `theme.danger` |

- Evite `#FF6B35`, `#FF4500`, `#0A0A0F` e `#fff` em telas comuns.
- Centralize imagens globais em `theme/images.ts`; não espalhe URLs pelas telas.
- Preserve contraste e legibilidade em claro e escuro.
- Evite cards aninhados quando o conteúdo é apenas uma seção da página.
- Mantenha texto dentro de tabs, botões e cards em telas pequenas.

## 23.3 Áreas já alinhadas ao tema

Feed, perfil próprio e público, edição de perfil, conquistas, estatísticas, planos de
treino, segmentos, ranking, notificações, tracking, resumo de atividade, avaliação
pós-treino e grupos já usam os tokens atuais nas áreas principais. Os pontos de entrada
mais relevantes são:

- `mobile/src/screens/Feed/FeedScreen.tsx`
- `mobile/src/screens/Profile/MyProfileScreen.tsx`
- `mobile/src/screens/Profile/UserProfileScreen.tsx`
- `mobile/src/screens/Profile/EditProfileScreen.tsx`
- `mobile/src/screens/Profile/AchievementsScreen.tsx`
- `mobile/src/screens/Stats/StatsDashboardScreen.tsx`
- `mobile/src/screens/Training/TrainingPlanScreen.tsx`
- `mobile/src/screens/Segments/SegmentsListScreen.tsx`
- `mobile/src/screens/Segments/SegmentDetailScreen.tsx`
- `mobile/src/screens/Ranking/RankingScreen.tsx`
- `mobile/src/screens/Notifications/NotificationsScreen.tsx`
- `mobile/src/screens/Tracking/ActiveTrackingScreen.tsx`
- `mobile/src/screens/Tracking/ActivitySummaryScreen.tsx`
- `mobile/src/components/PostWorkoutRatingModal.tsx`

O favicon web aponta para `mobile/src/assets/images/sync-logo-light.png`. A landing
web anterior ao login fica em `mobile/src/screens/Auth/StravaLandingWeb.tsx`; sua
paleta própria é definida pelas constantes no topo do arquivo.

## 23.4 Revisões visuais pendentes

- `mobile/public/manifest.json` e `mobile/app.json`: uniformizar as cores de instalação
  com os tokens atuais de `mobile/src/theme/colors.ts`.
- `mobile/src/screens/Challenges/ChallengesScreen.tsx`: revisar fundos e laranjas fixos.
- `mobile/src/components/StoriesBar.tsx`: revisar gradientes antigos.
- `mobile/src/components/BestTimeWidget.tsx`, `TodayBriefWidget.tsx` e `XPBar.tsx`:
  revisar acentos antigos.
- `mobile/src/screens/Auth/LoginScreen.tsx` e `RegisterScreen.tsx`: decidir se as
  imagens hero continuam representando a identidade atual.
- Mapas, pins, escalas de dor, modalidades e medalhas podem conservar cores semânticas.

Busca rápida para auditoria:

```bash
rg "#FF6B35|#FF4500|#0A0A0F|rgba\\(255,107,53|colors.dark" mobile/src
```

Checklist antes de publicar mudanças visuais:

1. Execute `npm run typecheck` dentro de `mobile`.
2. Confira claro e escuro, desktop e viewport móvel.
3. Teste textos longos em cards, tabs e botões.
4. Verifique carregamento, vazio, erro, retry e estados desabilitados.
5. Teste favicon e service worker em hard refresh ou janela anônima.

---

<a id="requisitos-complementares"></a>

# 24. Status dos Requisitos Complementares

Esta matriz registra o escopo implementado e evita que uma funcionalidade parcial seja
tratada como concluída.

| Requisito | Status | Escopo atual / pendência |
|-----------|--------|--------------------------|
| RF05 Perfil com hobbies | Implementado | Onboarding, edição, persistência e perfil público |
| RF07 Visibilidade | Implementado | Perfil, localização opt-in, bloqueios e mapa privado |
| RF16 Mídia no chat | Implementado | Texto, áudio, imagem e localização |
| RF23 Entrada em grupos | Implementado | Solicitação pendente para grupos privados |
| RF24 Administração de grupos | Implementado | Aprovar, recusar e remover membro comum |
| RF25 Mapa interativo | Parcial | Privacidade e interação prontas; falta catálogo real de locais esportivos |
| RF36 Assinatura premium | Parcial | Demonstração local pronta; falta checkout real e webhook assinado |
| RF38 Painel administrativo | Implementado | Dashboard protegido e somente leitura |
| RF39 Relatórios administrativos | Implementado | Agregados de uso, engajamento e segurança |
| RF40 Suporte | Implementado | Protocolo e acompanhamento; falta fila, SLA e respostas internas |

## 24.1 Perfil, conexões e privacidade

- `hobbies` é sanitizado no backend e editável no onboarding e no perfil.
- `isProfileVisible` e `showLocation` controlam discovery, busca, perfil e mapa.
- Atletas no mapa são opt-in, limitados a matches mútuos e recebem coordenadas
  aproximadas; bloqueios e perfis invisíveis são excluídos.
- Feed, likes, comentários e acesso ao feed alheio respeitam o modelo de conexão.
- A busca aceita nome ou ID. O modelo não possui um `username` separado.
- O onboarding permite câmera e galeria sem solicitar microfone.

Arquivos centrais: `backend/src/users/`, `backend/src/matching/`,
`mobile/src/screens/Onboarding/`, `mobile/src/screens/Profile/`,
`mobile/src/screens/Settings/SettingsScreen.tsx` e
`mobile/src/screens/Map/MapMainScreen.tsx`.

## 24.2 Chat e grupos

`SendMessageDto` aceita `text`, `audio`, `image` e `location`. Imagens e áudios passam
por upload multipart; localização é validada como JSON e possui renderização própria.

Grupos privados usam `GroupJoinRequest`. O administrador lista pedidos, aprova ou
recusa e pode remover membros comuns. O código de convite não é exposto para usuários
sem permissão.

Arquivos centrais: `backend/src/chat/`, `mobile/src/screens/Chat/ChatRoomScreen.tsx`,
`backend/src/groups/` e `mobile/src/screens/Groups/GroupDetailScreen.tsx`.

## 24.3 Mapa interativo (RF25)

`GET /api/users/nearby` lista apenas matches mútuos elegíveis. Marcadores de atletas
ficam ocultos por padrão, marcadores esportivos abrem detalhes e podem iniciar o
planejamento de rota; eventos, heatmap e territórios continuam disponíveis.

**Pendência:** os pontos esportivos sugeridos não são um catálogo real de academias,
quadras ou parques. A conclusão exige uma fonte externa adequada ou uma entidade
própria com dados administráveis e verificáveis.

## 24.4 Assinatura premium (RF36)

`SubscriptionTransaction` registra o fluxo local, confirmação e histórico. Ele só
pode alterar o plano com `SUBSCRIPTION_DEMO=true` fora de produção. Em produção essa
variável deve permanecer `false`.

**Pendência:** integrar um provedor de pagamento e confirmar toda assinatura no
backend por webhook assinado. O cliente nunca deve conseguir promover a própria conta.

## 24.5 Administração e suporte (RF38-RF40)

- `GET /api/admin/dashboard` e `GET /api/admin/reports` exigem JWT e email presente em
  `ADMIN_EMAILS`; o painel atual é somente leitura.
- Chamados de suporte recebem `protocol` e `status`; o usuário acompanha a lista em
  `GET /api/feedback/support/tickets` e `SupportTicketsScreen`.
- Ações de moderação, fila de atendimento, respostas internas e SLA permanecem fora
  do escopo atual.

A migration `backend/src/migrations/1781900000000-AddRequirementSupportTables.ts`
contém as tabelas e colunas desta entrega. Em produção, mantenha
`DB_SYNCHRONIZE=false` e deixe `migrationsRun` controlar o schema.

---

# 📊 Estatísticas do Projeto

| Métrica | Valor |
|---------|-------|
| Arquivos TypeScript | 310 |
| Módulos NestJS | 26 |
| Controllers NestJS | 25 |
| Telas mobile | 57 |
| Entities de banco | 36 |
| Decorators de rotas REST | 166 |
| WebSocket gateways | 2 |
| Migrations TypeORM | 9 |
| Arquivos de teste | 4 |
| Serviços externos integrados | 12+ |
| Conquistas (achievements) | 50+ |
| Daily quests no pool | 12 |
| Planos de treino completos | 3 |
| Cidades pré-cadastradas (fallback) | 12 |
| Tipos de evento de auditoria | 9 |

---

# 📝 Contato e Suporte

- **GitHub:** https://github.com/SanleyLujan/SYNC-2.0
- **Issues:** https://github.com/SanleyLujan/SYNC-2.0/issues
- **Live:** https://sync-2-0-blush.vercel.app

---

**Documentação revisada em 2026-08-30 — versão 1.0 — Sync v1.0.0**
