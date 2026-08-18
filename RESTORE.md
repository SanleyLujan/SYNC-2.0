# 🔄 Como voltar ao projeto (depois de formatar o PC)

Tudo do app **Sync** está neste repositório do GitHub. Se você formatou o
computador, **nada foi perdido** — é só clonar de novo e seguir os passos abaixo.

> **Repositório:** https://github.com/ArthurSilvaNarciso/sync
> **App no ar (frontend):** https://tutu-sync.vercel.app
> **Backend no ar (API):** https://sync-production-4830.up.railway.app

O app **continua funcionando no ar mesmo com o PC formatado** — Vercel e Railway
hospedam frontend e backend, e fazem *deploy automático* a cada push na `main`.
Você só precisa do código local para **continuar programando**.

---

## 1. Pré-requisitos (instalar no PC novo)

- **Node.js 20+** — https://nodejs.org
- **Git** — https://git-scm.com
- **(Opcional) PostgreSQL 16** — só se quiser rodar o backend localmente.
  Para desenvolvimento, o backend usa **better-sqlite3** automático (sem instalar nada).

---

## 2. Clonar o repositório

```bash
git clone https://github.com/ArthurSilvaNarciso/sync.git
cd sync
```

---

## 3. Rodar o app (mobile / web) localmente

```bash
cd mobile
npm install
npx expo start        # abre o Expo; tecle "w" para abrir no navegador
```

Por padrão o app **já aponta para o backend de produção (Railway)** — então
funciona sem subir backend local. Para apontar para um backend local, crie
`mobile/.env` com:

```
EXPO_PUBLIC_API_URL=http://localhost:3000
```

(Veja o modelo em `mobile/.env.production.example`.)

---

## 4. (Opcional) Rodar o backend localmente

```bash
cd backend
npm install
cp .env.example .env      # ajuste os valores se usar Postgres
npm run start:dev         # sobe em http://localhost:3000
```

Variáveis do backend (`backend/.env.example`): `DB_*`, `JWT_SECRET`,
`JWT_EXPIRATION`, `PORT`, `NODE_ENV`. Em produção o Railway já tem tudo
configurado (Postgres + segredos).

---

## 5. Deploy (já é automático)

- **Frontend (Vercel):** faz deploy sozinho a cada push na `main`.
- **Backend (Railway):** faz deploy sozinho a cada push na `main`, roda as
  **migrations idempotentes** automaticamente (`migrationsRun`).

Ou seja: **basta `git push origin main`** que tudo sobe pro ar. Não precisa
rodar deploy na mão.

```bash
git add -A
git commit -m "minha mudança"
git push origin main
```

---

## 6. Detalhes e histórico

- **`README.md`** — visão geral, lista completa de features, stack e endpoints.
- **`DEPLOY.md`** — detalhes de deploy (Vercel/Railway/env).
- **`DOCUMENTACAO.md`** — documentação mais funda do projeto.

### Últimas grandes entregas (todas testadas e no ar)

- **Segmentos estilo Strava (completo):** criar segmento (API e da tela de treino),
  **auto-match** (cronometra sozinho ao finalizar treino), leaderboard **global e
  de amigos**, KOM/QOM, detecção de PR, **notificação "seu KOM foi roubado"**,
  badge de KOMs no perfil, compartilhar no feed, **mapa do trecho**, **histórico
  dos seus tempos** (sparkline) e **"Em alta"** (trending, funciona sem GPS).
- **Chat:** reações em mensagens (long-press → emoji, tempo real), reconexão
  robusta de socket, **fila offline** de mensagens, anti-duplicação.
- **Robustez:** sessão expirada volta pro login sozinha, retry em swipe/like/GET
  (cold-start), estados de erro consistentes (`ErrorState`), sem dados falsos.
- **Fluidez:** componente `Avatar` com cache de imagem (fim do flicker nas listas).

---

## 7. Continuando com o Claude Code

Quando voltar, é só clonar e pedir para o assistente **"puxar do GitHub"** — todo
o código está aqui na `main`. O fluxo de trabalho recomendado (edite → `npx tsc
--noEmit` no mobile / `npm run build` no backend → commit → `git push origin
main`) faz o deploy automático acontecer.
