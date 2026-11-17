# Correções da avaliação de segurança web — 09/11/2026

Este é o registro histórico dos testes realizados em 09/11/2026. Naquela etapa,
as alterações permaneceram locais, sem commit ou push. Em 16/11/2026 foi preparada
a entrega ao Git, acompanhada de `TCC_ATUALIZACAO_SEGURANCA_WEB.md`.
O envio ao Git e a eventual publicação automática não substituem a validação
autenticada em produção descrita abaixo.

Na cópia exata selecionada para o commit de segurança, validada em 16/11/2026,
passaram 139 testes do backend (27 suítes), 98 testes do cliente (26 suítes),
as duas checagens de tipos e a verificação de consistência dos cabeçalhos.
Os totais históricos de 09/11 abaixo incluem a árvore local então disponível,
que também continha alterações de outras tarefas não selecionadas para esse envio.

Em complemento documental de 16/11/2026, o material do TCC passou a incorporar
o PDF `SYNC_Relatorio_Detalhado_Testes_e_Achados.pdf` e uma captura do dashboard
do HostedScan. A síntese, as páginas de origem e a figura estão em
`TCC_ATUALIZACAO_SEGURANCA_WEB.md`; os arquivos auxiliares estão em
`documentacao-tcc/`. Esse complemento não constitui nova varredura externa nem
verificação dos resultados após deploy.
Os resultados de produção anteriores ao deploy ficam em
`C:/SYNC/entregas/correcoes-seguranca-20261109/production-before-deploy.json`.
O teste autenticado no Render e o consentimento real do Google ficaram pendentes,
conforme combinado. Dados, tokens e credenciais reais não foram usados.

| Ordem | Tratamento | Situação |
|---|---|---|
| 1 | Removido `unsafe-inline` de JavaScript na Vercel e no Helmet da API; atributos de evento bloqueados. O pós-build externaliza scripts e recusa HTML incompatível. | Implementado; depende do deploy e do login Google real para validação final. |
| 2 | Adicionados teste de login e navegação autenticada com fixtures, teste de injeções no navegador, teste HTTP de cabeçalhos e checagem pública do Render/Vercel. A regressão de perfis também aplica CSP. CI passa a executar a cobertura web. | Local e HTTP público cobertos; conta real no Render pendente. |
| 3 | Expo reset externalizado; folhas dinâmicas do RN Web autorizadas por hash de conteúdo vazio e preenchidas via CSSOM. Expo Image recebe hash exato; fontes usam FontFace; campos, filtros e marcadores foram adaptados. | Documento principal sem `unsafe-inline` de CSS. Exceção explícita somente para a página do botão Google, descrita abaixo. |
| 4 | Removido `https:` amplo de imagens; permitidos uploads do Render, Unsplash, hosts de avatar Google usados pelo app, CARTO, OSM e imagens versionadas do Leaflet. | Implementado; imagens de domínios não listados serão bloqueadas por desenho. |
| 5 | Frontend passa a responder CORS com sua origem de produção explícita. API mantém a lista exata de `FRONTEND_URL`, sem wildcard em produção. | Implementado; validar a sobreposição do cabeçalho padrão da Vercel após deploy. |
| 6 | Políticas dos dois `vercel.json` sincronizadas; cabeçalhos da API instalados antes do parser de corpo, incluindo erros de JSON. HSTS da API alinhado a um ano, sem declarar preload. | Teste local de 200/304/400/404 e inspeção pública de 200/HIT/304/404. Repetir depois do deploy. |
| 7 | TCP timestamps registrados como responsabilidade da infraestrutura que atende o domínio na Vercel. | Sem mudança de código; não foi feita nova análise de pacotes TCP. |

## Exceção limitada ao Google

A biblioteca atual do Google injeta uma folha de estilos e atributos `style`.
O teste real detectou que retirar toda a permissão de CSS inline da página de login
impediria seu funcionamento. O botão agora ocupa um iframe de mesma origem,
`/google-signin.html`, com política própria: CSS inline permitido somente nesse
documento. Essa exceção **não elimina totalmente CSS inline da aplicação hospedada**.
JavaScript inline continua proibido inclusive nele.

O iframe não recebe a sessão Sync. Ele envia a credencial Google ao pai com
`postMessage` para a origem exata. O componente verifica tanto `origin` quanto
`source`, e o backend continua responsável por validar assinatura, audiência e
expiração do ID token. Uma mensagem de outra janela é ignorada. O iframe e seu
protocolo não são armazenados no cache do service worker.

Os cabeçalhos principais excluem explicitamente esse caminho, evitando duas CSPs
conflitantes. Validar o caminho no preview da Vercel é parte da aceitação de deploy.
Se a exigência for zero `unsafe-inline` em **todos** os documentos, esta exceção
continua aberta: será necessária uma integração de estilos com nonce por resposta
e tratamento específico dos atributos gerados pelo fornecedor.

## Verificação executável

Verificações locais concluídas:

- Backend: 151 testes existentes aprovados e um teste HTTP novo aprovado.
- Cliente: 98 testes aprovados em 26 suítes no estado final.
- Web: 11 cenários de regressão de perfis e oito cenários de login/mapa/CSP
  (quatro locais e quatro carregando a biblioteca real do Google), aprovados.
  Scripts inline, handlers inline, CSS inline arbitrário, atributos de estilo
  injetados e imagens de origem não permitida foram bloqueados.
- Nos cenários web, login e API usam dados fictícios; no cenário Google real,
  apenas o botão/biblioteca são reais. Nenhuma conta foi autenticada no Google.
- Typecheck de cliente/backend, exportação web e build Nest aprovados.
- Regra de exclusão de `/google-signin.html` validada também com o
  `path-to-regexp` 6.1.0, usado pelo conversor de rotas da Vercel.

Evidências locais adicionais:
`C:/SYNC/entregas/correcoes-seguranca-20261109/mobile-tests.json`,
`backend-tests.json`, `security-web-final/results.json`,
`security-web-google/results.json` e capturas em `perfis-final/`.

Na pasta `mobile`, com dependências instaladas:

```powershell
npm run build:web
npm run typecheck
npm test -- --runInBand

# Ferramenta só de testes; não altera as dependências de produção.
npm install --no-save --package-lock=false --legacy-peer-deps playwright@1.62.1
npx playwright install chromium
npm run test:security:web

$env:SECURITY_CSP='1'
$env:SOCIAL_UI_URL='http://localhost:8096'
node scripts/qa-profile-discovery.cjs
```

No Windows, `PLAYWRIGHT_CHANNEL=msedge` permite usar o Edge instalado.
`PLAYWRIGHT_MODULE` permite apontar para uma instalação existente do Playwright.
`SECURITY_GOOGLE_NETWORK=1` habilita o carregamento real da biblioteca e do botão
Google; não realiza consentimento ou login de uma pessoa.

Em `backend`, executar `npm run typecheck`, `npm run build` e `npm test -- --runInBand`.
O teste `http-security.spec.ts` sobe um Nest isolado sem banco e verifica respostas
HTTP reais com a mesma função de configuração utilizada pelo servidor principal.

## Produção e limites da cobertura

`npm run test:security:live`, em `mobile`, consulta os endpoints públicos, CORS,
negação de sessões ausentes/inválidas e cabeçalhos de HTML/asset/cache/erro.
Para também exercitar endpoints autenticados, configurar `SECURITY_TEST_TOKEN`
localmente com uma sessão de **conta de teste**. Não colar tokens em relatórios
ou no repositório. O script só registra status e formato esperado, sem salvar
conteúdo de respostas autenticadas. Um resultado incompleto retorna código 1.

Essa checagem não substitui auditoria autenticada com duas contas, verificação de
autorização por objeto, testes de escrita, uploads, WebSocket ou scanner completo.
As APIs sintéticas usadas no navegador não verificam a configuração do Render.
O job novo foi configurado no CI, mas sua execução no GitHub depende de push/PR.

A inspeção da versão publicada encontrou a CSP antiga e `Access-Control-Allow-Origin: *`
nos recursos públicos. A API respondeu corretamente aos testes de CORS e às
requisições sem sessão válida em perfil, feed, histórico, grupos e conversas.
Não foi demonstrado vazamento de dados privados por CORS.

O CDN retornou `HIT` e 304. A resposta 304 omitiu cabeçalhos que existiam no 200;
o verificador considera a representação armazenada, pois o 304 atualiza seu cache.
Essa omissão isolada não prova ausência da política efetiva nem exige alteração de
kernel/código. A página 404 observada também continha os cabeçalhos configurados.

Se após deploy uma resposta normal ou de erro da plataforma perder as proteções,
reunir URL, horário, status, `x-vercel-id`, `x-vercel-cache`, cabeçalhos completos e
comparação com o 200 para abrir chamado na Vercel. Nenhum chamado foi enviado aqui.
O alerta de TCP timestamps pode ser incluído nesse contato com a evidência original;
o aplicativo não controla o kernel/edge TCP do provedor.

## Aceitação após publicação

1. Abrir o preview da Vercel e confirmar CSP principal e exceção de `/google-signin.html`.
2. Entrar com email/senha e com Google real; sair e entrar novamente.
3. Conferir avatar, publicação com foto, mapa e marcadores, chat e perfil, em celular
   e desktop, nos temas claro e escuro. Testar PWA instalado com recarga online.
4. Verificar se o console acusa bloqueios de CSP em ações legítimas. Incluir recursos
   de acessibilidade usados no projeto; o widget externo VLibras já não estava
   autorizado na política anterior e não teve sua integração corrigida neste escopo.
5. Executar a checagem live com a conta de teste. Publicar frontend e adaptação de
   CSS juntos; se falhar um fluxo essencial, restaurar o deploy anterior na Vercel
   e registrar qual recurso/domínio foi bloqueado antes de ajustar a política.

Referências técnicas:
[Google Identity Services e CSP](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid),
[CSP Level 3](https://www.w3.org/TR/CSP3/),
[semântica de 304](https://www.rfc-editor.org/rfc/rfc9110.html#name-304-not-modified),
[Playwright em CI](https://playwright.dev/docs/ci).
