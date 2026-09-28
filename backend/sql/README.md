# Preparação do Supabase

**Revisão documental:** 11/09/2026.

Estes arquivos fazem parte da configuração oficial do Sync. Ver [operação e instalação](../../DOCUMENTACAO.md#operacao-e-recuperacao). Não contêm credenciais reais.

## Atualização de 28/09/2026 — curtidas e contas inativas

Para instalações existentes, usar [`2026-09-28-likes-e-contas-inativas.sql`](2026-09-28-likes-e-contas-inativas.sql) antes do backend novo, ou a migration equivalente `1790553600000`. Inclui `likes.islike` e `inactiveAt` em 29 tabelas relacionadas. Curtidas antigas sem decisão comprovável ficam com `islike = NULL`; novas decisões gravam `true` ou `false`. Os registros de contas desativadas são preservados e ocultados das consultas do app. O responsável confirmou a execução manual do SQL em 28/09/2026; essa confirmação não equivale a uma verificação remota do banco ou do deploy.

## Banco totalmente novo

1. Crie o projeto no Supabase e copie a connection string do **Session Pooler**.
2. No SQL Editor, execute `01-configurar-admin-e-verificacao.sql`. Ele cria o bucket privado mesmo que a tabela `users` ainda não exista.
3. Em base dedicada totalmente vazia, com o aplicativo ainda indisponível ao público, no primeiro deploy use `DB_SYNCHRONIZE=true` uma única vez para criar o schema-base.
4. Assim que o primeiro deploy terminar, altere para `DB_SYNCHRONIZE=false` e faça novo deploy. A partir daí, somente migrations versionadas devem evoluir o schema. Conferir a aplicação de RLS e permissões antes de liberar usuários. As migrations existentes são incrementais e não constituem uma migration inicial completa.
5. Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_KYC_BUCKET=identity-verification` e `CPF_HASH_SALT` somente no backend/Render.
6. Cadastre normalmente a futura conta administrativa.
7. Troque o placeholder de email em `02-promover-usuario-admin.sql` e execute o arquivo. A consulta final precisa mostrar a conta com `isAdmin=true`.

Nenhum administrador é criado automaticamente. Isso evita promover uma conta errada durante a instalação.

## Banco que já possui a tabela `users`

Execute o arquivo `01-configurar-admin-e-verificacao.sql` normalmente. O comando é idempotente: preserva a tabela existente, adiciona `isAdmin` se necessário e força o bucket a permanecer privado. Depois que a conta do administrador existir, execute a parte 2.

## Segredos

Arquivos `.env` reais não devem ser versionados. A service role do Supabase nunca deve aparecer no app mobile, na Vercel, em SQL salvo ou no repositório. Se uma chave real for commitada por engano, removê-la do arquivo não basta: revogue/rotacione a chave imediatamente.
