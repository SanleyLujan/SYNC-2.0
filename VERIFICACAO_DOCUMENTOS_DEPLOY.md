# Ativar verificação de identidade por documentos

## Configuração de produção (manual)

1. No projeto correto do **Supabase**, abra **Storage → New bucket**. Nome: `identity-verification`. **Public bucket deve ficar desligado**. Se já existe, confira que é privado. Não use bucket público para documentos.
2. Se configurar limites no bucket, permita `image/jpeg` (o backend reencoda todas as imagens) e pelo menos 6 MB por arquivo. O app recebe JPEG, PNG ou WebP de até 6 MB cada. Não crie políticas de leitura pública ou acesso anon.
   - A indicação **0 policies** não é, sozinha, um erro neste fluxo: o app envia os documentos ao backend autenticado, que usa a chave `service_role`. Não adicione políticas públicas para tentar resolver a indisponibilidade.
3. No **Render → sync-backend → Environment**, configure:
   - `SUPABASE_URL`: URL base do projeto Supabase, por exemplo `https://SEU-PROJETO.supabase.co`, sem `/rest/v1` ou `/storage/v1`.
   - `SUPABASE_SERVICE_ROLE_KEY`: chave **service_role** do mesmo projeto, encontrada nas configurações de API/Legacy API keys. Não use a chave anon. Cole diretamente no Render: não envie no chat, não coloque no Git nem na Vercel.
   - `SUPABASE_KYC_BUCKET`: `identity-verification`.
4. Publique o código atualizado no backend. Mantenha `NODE_ENV=production` e `DB_SYNCHRONIZE=false`. Confira nos logs as migrations, incluindo a criação de `verification_requests`. O sistema já executa as migrations durante a inicialização.
5. Publique o frontend atualizado na **Vercel**. Nenhuma chave de documentos deve ser adicionada à Vercel.
6. Entre com uma conta administrativa já autorizada. Abra **Perfil → Configurações → Painel administrativo**. Na seção de verificação, o diagnóstico deve indicar **Armazenamento privado disponível**. Se o menu não aparece, a conta precisa ser habilitada pelo responsável pelo banco em `users.isAdmin`; não altere contas desconhecidas nem use essa permissão para usuários comuns.

## Validação funcional

- Usuário: **Perfil → Configurações → Verificar perfil**; envie selfie, frente e verso. O estado muda para **Em análise**. Não envie documentos reais em ambientes de teste; use apenas imagens sintéticas nesses ambientes.
- Administrador diferente do solicitante: abra o painel, confira as três imagens (há visualização ampliada), e aprove ou recuse. Recusa exige motivo. Imagens expiradas precisam ser atualizadas antes da decisão.
- Aprovação: `users.isVerified` passa a verdadeiro; o perfil próprio e o perfil público exibem **Verificado**. A tela de verificação atualiza o status a cada 30 segundos enquanto está aberta; o perfil também atualiza ao voltar à tela ou puxar para atualizar.
- Recusa: o motivo aparece para a pessoa e ela pode enviar um novo pedido. O selo não é concedido.
- Os arquivos são apagados durante a decisão. Se a exclusão no Storage falhar, a análise não é concluída e mantém as chaves para nova tentativa.

## Diagnósticos

- **missing_config**: variável ausente no Render.
- **invalid_url**: SUPABASE_URL não é a URL base.
- **bucket_missing**: bucket inexistente ou nome diferente.
- **access_denied**: chave inválida/sem acesso ou pertencente a outro projeto.
- **bucket_public**: bloqueio intencional para não receber documentos em armazenamento público.
- **unreachable / storage_error**: projeto pausado, rede, timeout ou falha do Supabase.

Os diagnósticos detalhados são restritos ao admin e nunca retornam chaves. Usuários comuns recebem apenas a informação de indisponibilidade. Uma falha da fila não é apresentada como "nenhum pedido".

A configuração real de produção e o teste completo em Render/Supabase dependem dos passos acima. A inspeção local não confirma qual desses problemas existe atualmente no servidor.
