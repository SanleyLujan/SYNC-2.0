# Ativar login Google na web

Implementação: botão oficial Google Identity Services na tela de login web; validação de assinatura, emissor, público e validade pela biblioteca google-auth-library. Android/iOS não estão habilitados por este cliente web.

## 1. Publicar o código

As alterações locais precisam chegar ao repositório/branch usado por Render e Vercel. Alterar somente variáveis não publica o código. Não há Client Secret neste fluxo.

## 2. Render

No serviço sync-backend, abra Environment e adicione:

```env
GOOGLE_CLIENT_ID=529178437359-vna4bk83lvk9mne5revmh6cfadmi9131.apps.googleusercontent.com
```

Mantenha NODE_ENV=production e DB_SYNCHRONIZE=false. Salve e publique o código atualizado. O bootstrap já executa migrations automaticamente nessa configuração. Confirme nos logs a migration AddGoogleSubject1789800000000 antes de publicar o frontend. Ela adiciona a coluna googleSubject e índice único; preserva os dados existentes.

## 3. Vercel

No projeto web, Settings → Environment Variables, adicione em Production:

```env
EXPO_PUBLIC_GOOGLE_CLIENT_ID=529178437359-vna4bk83lvk9mne5revmh6cfadmi9131.apps.googleusercontent.com
```

Mantenha EXPO_PUBLIC_API_URL apontando para o Render. Faça novo deploy com o código atualizado: Expo incorpora EXPO_PUBLIC_* durante o build. O botão fica oculto se a variável estiver ausente. Previews só funcionam se sua origem exata também estiver autorizada no Google.

## 4. Google Cloud e teste real

No cliente OAuth SYNC Web, confirme as origens JavaScript https://sync-2-0-blush.vercel.app e http://localhost:8081. Se usar domínio próprio, adicione sua origem exata. URIs de redirecionamento não são usados neste fluxo popup/callback. Confira público Externo e o status de publicação na Google Auth Platform antes de liberar o acesso geral.

Abra o site, vá a Entrar, clique Continuar com Google e escolha sua conta. Verifique entrada, recarregamento da página, saída e nova entrada. Teste também uma conta nova para verificar o onboarding. A validação ponta a ponta depende desse login real após os deploys.

## Associação de contas

Contas Google são identificadas por sub, que é estável mesmo se o email mudar. Gmail/Workspace verificados podem ser associados a um email existente. Contas bloqueadas/excluídas não são reativadas. Emails de terceiros (como Outlook usado para criar uma conta Google) não são vinculados automaticamente: use email/senha; o fluxo de confirmação adicional para essa associação ainda não está implementado. Novos cadastros Google também exigem Gmail/Workspace para não assumir que Google controla um email de terceiros.

Documentação: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
