# Deploy gratis - Vercel + Render + Supabase

Este projeto tem tres partes:

- `mobile/`: frontend web/PWA, hospeda no Vercel.
- `backend/`: API NestJS, hospeda no Render.
- Supabase: banco PostgreSQL usado pelo backend.

## 1. Supabase

1. Acesse https://supabase.com/dashboard.
2. Crie um projeto novo.
3. Guarde a senha do banco.
4. Clique em `Connect`.
5. Escolha `Session pooler`.
6. Em `Type`, escolha `URI`.
7. Copie a connection string.

Ela deve parecer com:

```env
postgresql://postgres.PROJECT_REF:SUA_SENHA@aws-0-ca-central-1.pooler.supabase.com:5432/postgres
```

No Render ela sera usada como `DATABASE_URL`.

## 2. Render - backend

1. Acesse https://render.com.
2. Clique em `New +`.
3. Escolha `Web Service`.
4. Conecte o GitHub.
5. Escolha o repositorio `SYNC-2.0`.
6. Configure:

```text
Name: sync-backend
Root Directory: backend
Runtime: Node
Build Command: npm install && npm run build
Start Command: node dist/main.js
Instance Type: Free
```

7. Em `Environment Variables`, adicione:

```env
NODE_ENV=production
DATABASE_URL=postgresql://postgres.PROJECT_REF:SUA_SENHA@aws-0-ca-central-1.pooler.supabase.com:5432/postgres
DB_SSL=true
DB_SYNCHRONIZE=true
JWT_SECRET=uma_chave_grande_aleatoria
JWT_EXPIRATION=7d
FRONTEND_URL=https://temporario.vercel.app
BACKEND_URL=https://sync-backend.onrender.com
```

Troque `SUA_SENHA`, `PROJECT_REF` e as URLs pelos valores reais.

8. Clique em `Create Web Service`.
9. Quando terminar, teste:

```text
https://sync-backend.onrender.com/health
```

Depois que o primeiro deploy criar as tabelas no Supabase, troque:

```env
DB_SYNCHRONIZE=false
```

## 3. Vercel - frontend

1. Acesse https://vercel.com.
2. Clique em `Add New Project`.
3. Importe o repositorio `SYNC-2.0`.
4. Configure:

```text
Root Directory: ./
Framework Preset: Other
```

O arquivo `vercel.json` da raiz ja manda o Vercel instalar e buildar a pasta `mobile`.

5. Em `Environment Variables`, adicione:

```env
EXPO_PUBLIC_API_URL=https://sync-backend.onrender.com/api
```

Use a URL real do backend Render.

6. Clique em `Deploy`.

## 4. Ajuste final

Depois que o Vercel gerar a URL final, volte no Render e ajuste:

```env
FRONTEND_URL=https://seu-app.vercel.app
BACKEND_URL=https://sync-backend.onrender.com
DB_SYNCHRONIZE=false
```

Faca redeploy do backend.

Fluxo final:

```text
Usuario -> Vercel mobile -> Render backend -> Supabase Postgres
```

## Observacoes do plano gratis

- Render Free dorme apos alguns minutos sem uso. A primeira chamada pode demorar.
- Supabase Free tem limite de banco e pode pausar por inatividade.
- Uploads locais do backend podem sumir em redeploy/restart. Para producao, use Supabase Storage, S3 ou outro storage persistente.
