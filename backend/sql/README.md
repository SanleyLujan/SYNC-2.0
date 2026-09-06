# Preparação do Supabase

Estes arquivos fazem parte da configuração oficial de uma instalação nova do Sync.

## Banco totalmente novo

1. Crie o projeto no Supabase e copie a connection string do **Session Pooler**.
2. No SQL Editor, execute `01-configurar-admin-e-verificacao.sql`. Ele cria o bucket privado mesmo que a tabela `users` ainda não exista.
3. No primeiro deploy do backend contra um banco vazio, use `DB_SYNCHRONIZE=true` uma única vez para criar o schema-base.
4. Assim que o primeiro deploy terminar, altere para `DB_SYNCHRONIZE=false` e faça novo deploy. A partir daí, somente migrations versionadas devem evoluir o schema.
5. Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_KYC_BUCKET=identity-verification` e `CPF_HASH_SALT` somente no backend/Render.
6. Cadastre normalmente a futura conta administrativa.
7. Troque o placeholder de email em `02-promover-usuario-admin.sql` e execute o arquivo. A consulta final precisa mostrar a conta com `isAdmin=true`.

Nenhum administrador é criado automaticamente. Isso evita promover uma conta errada durante a instalação.

## Banco que já possui a tabela `users`

Execute o arquivo `01-configurar-admin-e-verificacao.sql` normalmente. O comando é idempotente: preserva a tabela existente, adiciona `isAdmin` se necessário e força o bucket a permanecer privado. Depois que a conta do administrador existir, execute a parte 2.

## Segredos

Arquivos `.env` reais não devem ser versionados. A service role do Supabase nunca deve aparecer no app mobile, na Vercel, em SQL salvo ou no repositório. Se uma chave real for commitada por engano, removê-la do arquivo não basta: revogue/rotacione a chave imediatamente.
