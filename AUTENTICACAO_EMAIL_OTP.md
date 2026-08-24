# Autenticação própria com confirmação de email por código

## Objetivo

O Sync mantém a autenticação no backend NestJS e usa o Supabase somente como banco PostgreSQL. Uma conta criada com email e senha só recebe uma sessão JWT depois que o usuário informa corretamente o código de seis dígitos enviado ao email.

Essa arquitetura não depende do Supabase Auth. Se o banco for migrado futuramente para outro PostgreSQL, os dados podem ser migrados e a `DATABASE_URL` pode ser trocada sem substituir as regras de autenticação, senhas, endpoints ou tokens do Sync.

## Fluxo obrigatório

1. O app envia os dados para `POST /api/auth/register`.
2. O backend valida email, senha, CPF e duplicidade.
3. A senha é armazenada como hash bcrypt.
4. A conta é criada com `emailVerified = false`.
5. O backend gera um código aleatório de seis dígitos usando `crypto.randomInt`.
6. Somente o hash SHA-256 do código é salvo no banco. O código puro existe apenas durante o envio.
7. O código é enviado pela API HTTPS do Resend e expira em 10 minutos.
8. O cadastro retorna apenas o email e o estado do envio. Ele **não retorna JWT**.
9. O app abre a tela `VerifyEmailCode` e impede o acesso ao onboarding e ao restante do aplicativo.
10. O app envia email e código para `POST /api/auth/verify-email-code`.
11. Depois da confirmação correta, o backend marca `emailVerified = true`, apaga código e expiração e finalmente devolve o JWT.

O login por senha também bloqueia contas não confirmadas com o código de erro `EMAIL_NOT_VERIFIED`. Se a pessoa tentar entrar antes da confirmação, o app volta para a tela de código. A estratégia JWT do backend também recusa uma conta não confirmada, impedindo que um token antigo contorne essa regra.

O login pelo Google continua liberado porque o provedor já fornece um email verificado.

## Reenvio do código

A tela permite solicitar outro código por `POST /api/auth/request-verification`.

- Depois de um envio confirmado, o botão aguarda 60 segundos antes de permitir novo pedido.
- Se o primeiro envio falhar ou a pessoa chegar à tela pelo login, ela pode pedir um código imediatamente.
- O backend limita o endpoint a três solicitações a cada cinco minutos por IP.
- Cada reenvio gera um código novo e invalida imediatamente o anterior.
- O reenvio zera o contador de tentativas do código.
- A resposta é genérica para não revelar se determinado email possui conta.

## Proteções aplicadas

- Código de seis dígitos gerado por fonte criptograficamente segura.
- Hash SHA-256 no banco; o código puro não é persistido.
- Expiração em 10 minutos.
- Máximo de cinco tentativas por código.
- Rate limit no cadastro, confirmação e reenvio.
- Comparação segura do código com `timingSafeEqual`.
- Nenhum JWT antes da confirmação.
- Rotas protegidas rejeitam usuários com `emailVerified = false`.
- Falhas de confirmação entram no audit log como `email_verification_failure`.

## Alteração no banco

A migration `1781700000000-AddEmailVerificationAttempts.ts` adiciona:

```text
emailVerificationAttempts integer NOT NULL DEFAULT 0
```

Os campos já existentes são reutilizados:

```text
emailVerified
emailVerificationToken     # hash SHA-256 do código
emailVerificationExpires
```

Em produção, com `DB_SYNCHRONIZE=false`, o TypeORM executa as migrations por meio de `migrationsRun`. Se `DB_SYNCHRONIZE=true` estiver sendo usado durante a primeira atualização, o TypeORM também cria a coluna; depois é recomendado manter `DB_SYNCHRONIZE=false` e controlar o schema somente por migrations.

## Envio de email: Resend e Render

O backend usa a API HTTPS do Resend. Isso evita o bloqueio de SMTP das portas 25, 465 e 587 no plano gratuito do Render.

O domínio `syncapp.site` foi configurado no Resend por registros DNS mantidos na Hostinger. A Hostinger é apenas o registrador e o provedor de DNS; o frontend continua na Vercel e o backend continua no Render.

Variáveis obrigatórias no serviço do backend no Render:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=uma-chave-forte-e-privada
FRONTEND_URL=https://seu-projeto.vercel.app
RESEND_API_KEY=re_...
EMAIL_FROM=Sync <noreply@syncapp.site>
```

Regras importantes:

- `RESEND_API_KEY` e outras chaves reais ficam somente nas variáveis protegidas do Render.
- Nenhuma chave deve ser salva no GitHub ou em arquivos `.env` versionados.
- O remetente de `EMAIL_FROM` precisa usar `syncapp.site`, que é o domínio verificado no Resend.
- Não é necessário comprar uma caixa de entrada para `noreply@syncapp.site`; esse endereço funciona como remetente autenticado pelo Resend.
- O domínio do site e o domínio do remetente podem ser configurados separadamente. Conectar `syncapp.site` à Vercel é uma etapa independente.

O suporte SMTP permanece como fallback apenas para desenvolvimento ou para uma hospedagem que permita conexão nessas portas.

## Endpoints envolvidos

| Método | Rota | Resultado |
|---|---|---|
| `POST` | `/api/auth/register` | Cria conta pendente, envia código e não retorna JWT |
| `POST` | `/api/auth/verify-email-code` | Confirma código e retorna usuário + JWT |
| `POST` | `/api/auth/request-verification` | Gera e envia um código novo |
| `POST` | `/api/auth/login` | Retorna `EMAIL_NOT_VERIFIED` enquanto a conta estiver pendente |

## Como validar depois do deploy

1. Confirme que `syncapp.site` aparece como `Verified` no Resend.
2. Confira `RESEND_API_KEY` e `EMAIL_FROM` no Render e faça um novo deploy do backend.
3. Aguarde também o deploy da Vercel, pois a nova tela faz parte do frontend.
4. Crie uma conta com um email real ainda não cadastrado.
5. Verifique que o app permanece na tela do código e que a resposta do cadastro não contém `accessToken`.
6. Tente um código incorreto e confirme que o acesso continua bloqueado.
7. Informe o código correto e confirme que o onboarding só abre depois disso.
8. Em outra conta, toque em `Reenviar código` e confirme que o código anterior deixa de funcionar.
9. Tente fazer login em uma conta pendente e confirme que o app volta para a confirmação.
10. Consulte os logs do Render: no sucesso aparece `Email de verificacao enviado via Resend`; em falha aparece o status devolvido pelo Resend.

## Arquivos principais

- `backend/src/auth/auth.service.ts`: cadastro, login, geração, confirmação e reenvio.
- `backend/src/auth/email.service.ts`: entrega via Resend/SMTP e template do código.
- `backend/src/auth/auth.controller.ts`: endpoints, validação e rate limits.
- `backend/src/auth/guards/jwt.strategy.ts`: bloqueio de contas não confirmadas.
- `backend/src/users/entities/user.entity.ts`: estado da confirmação e tentativas.
- `backend/src/migrations/1781700000000-AddEmailVerificationAttempts.ts`: migration do contador.
- `mobile/src/screens/Auth/VerifyEmailCodeScreen.tsx`: entrada e reenvio do código.
- `mobile/src/services/auth.service.ts`: chamadas da API.

## Limitação operacional

O código detecta e apresenta falhas devolvidas pelo provedor, mas a entrega real depende de uma chave válida, domínio verificado, DNS propagado e reputação de envio do Resend. Em caso de falha, a conta permanece pendente e não recebe acesso; a pessoa pode tentar o reenvio novamente.
