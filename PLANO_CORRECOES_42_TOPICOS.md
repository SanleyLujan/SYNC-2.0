# Plano de correções — 42 tópicos prioritários

## Contagem de participantes dos eventos — 26/10/2026

- A API não enviava `participantCount`, embora mapa/detalhes exibissem esse campo; o detalhe também perdia a informação de participação ao reabrir. A contagem agora deriva das inscrições ativas, com `isJoined` por conta, em eventos próximos, detalhes e listas pessoais, incluindo eventos relâmpago.
- Entrada/saída devolvem o evento atualizado. O cliente usa o resultado confirmado, bloqueia tentativa duplicada e atualiza a contagem de outras contas a cada 15 segundos nas telas ativas/visíveis. Retorno à tela recarrega os dados; o marcador do mapa passa a abrir os dados atuais.
- Estilos, cores e disposição das telas preservados. O botão existente mostra “Participando” para uma inscrição já confirmada. Sem mudança de schema, nova tabela ou serviço pago.
- Validação local: **7 testes backend com banco isolado**, incluindo entrada/saída/reentrada, inscrição repetida, lotação, eventos relâmpago e participações desativadas; **92 testes mobile em 26 suítes**. Roteiro visual: `mobile/scripts/qa-event-attendance.cjs`, com duas contas, GPS e API fictícios.
- TypeScript backend/mobile, exportação Expo Web e teste de duas contas no Edge aprovados: confirmação no mapa, recuperação após recarga, saída/reentrada e atualização automática do organizador no mapa/detalhe. Sem validação do deploy. No layout existente, o rodapé do detalhe fica parcialmente sob a barra inferior em telas pequenas; os handlers desse rodapé foram acionados por evento DOM no teste, sem alterar o layout fora do escopo da contagem.

## Pausa automática no PWA — 26/10/2026

- Relato confirmado pelo responsável: treino pausava ao ficar parado, mesmo com a tela aberta. A regra de imobilidade vinha ligada por padrão e pausava após aproximadamente cinco segundos de velocidade baixa; visibilidade da tela não desativa essa regra.
- O PWA passa a iniciar com pausa automática desligada. O usuário pode ativá-la no mesmo botão e essa escolha explícita é preservada na recuperação. Preferências antigas sem registro de ativação explícita não religam a função; uma pausa automática legada é retomada, preservando pausas manuais.
- Alteração de comportamento, sem mudança no JSX, estilos, cores ou disposição dos controles. Comportamento nativo preservado.
- Validação: **90 testes mobile em 25 suítes**, TypeScript e exportação Expo Web aprovados. No Edge, passaram os três cenários locais de percurso, academia e recuperação/ativação explícita da pausa automática, incluindo imobilidade com tela aberta. GPS e APIs simulados; disposição dos controles preservada.

## Registro e recuperação do percurso PWA — 26/10/2026

- Por solicitação do responsável, o item 13 passa de adiado a **parcial**, mantendo somente web/PWA e aceitando trechos sem registro quando o navegador suspende o GPS.
- O treino aproveita fixes entregues com a página oculta, renova a assinatura de GPS ao voltar e preserva localmente percurso, início e pausas, inclusive em modalidades sem GPS. A recuperação é isolada por conta, sobrevive à recarga e mantém envios pendentes em falha de rede. Logout/finalização invalidam escritas tardias.
- Pausas manuais persistem; pausa automática é encerrada ao ocultar a página. Ausência de GPS não é interpretada como prova de que a pessoa parou. Intervalos entre pontos acima de 15 segundos geram outro trecho; mapa/resumo/splits/GPX respeitam as lacunas, sem inventar distância.
- Testes locais: suíte mobile completa com **86 testes em 25 suítes**, incluindo persistência, isolamento de conta, armazenamento indisponível, retorno ao app e rotas com lacunas. Script de regressão: `mobile/scripts/qa-tracking-recovery.cjs`, com API e GPS fictícios; capturas em `C:/SYNC/tracking-pwa-qa-20261026`.
- Validação concluída: TypeScript mobile/backend, exportação Expo Web e **3 testes backend em 2 suítes** aprovados. No Edge, os cenários de percurso (fix oculto, lacuna, rede indisponível, pausa, recarga, sincronização, finalização e resumo) e academia (tempo em segundo plano, recarga e finalização) passaram. Capturas de percurso em 390×844 e 320×568; confirmar cobertura real em celulares continua pendente. `PLAYWRIGHT_MODULE` e `BROWSER_CHANNEL` configuram a biblioteca/canal do script.
- Limites: gravação contínua com a tela bloqueada não é garantida, dados locais dependem do armazenamento do navegador e ainda faltam ensaios em celulares reais. Nenhum serviço pago, migração de banco ou versão nativa foi acrescentado. Alterações locais; publicação não executada nesta etapa.

## Atualização — 28/09/2026

Foto principal alinhada à galeria; super like removido; decisão de curtir/passar persistida em `likes.islike`; exclusão substituída por desativação com retenção transacional do conteúdo; dimensões do navegador ajustadas. SQL/migration e comportamento do legado descritos em [curtidas e contas inativas](backend/sql/README.md). O responsável confirmou a execução manual do SQL em 28/09/2026 e autorizou o envio do código ao Git; o deploy ainda não foi verificado. A exclusão de documentos ao excluir a conta, mencionada em revisões anteriores, foi retirada; os documentos permanecem privados. Os estados globais dos 42 tópicos não são alterados por esta entrega.

**Data de criação do acompanhamento:** 02/09/2026

**Última atualização:** 26/10/2026

**Escopo:** auditoria funcional, correções solicitadas, transparência das funções mostradas ao usuário e segurança do aplicativo Sync.

## Revisão visual e navegação social — 14/09/2026

- **Grupos e chat:** detalhe do grupo, estatísticas, membros, cabeçalho da conversa, mensagens, entrada e reações passam a acompanhar o tema claro/escuro. Corrigida a ordem de estilos dos textos e horários na lista de conversas. Estilos das telas migradas são recalculados quando o tema muda.
- **Barra do celular:** a revisão encontrou a cor vinho `#4A0E2C` no manifesto e no pós-build web, além do ajuste nativo. O PWA agora atualiza `theme-color` com o tema escolhido, sem recarregar; o HTML publicado contém uma única tag e o manifesto usa a nova cor inicial. O componente StatusBar continua cobrindo o app nativo.
- **Envio de mídia:** retirados os controles e o código de captura/upload de imagem e áudio do chat por solicitação do usuário. Texto e localização continuam disponíveis; imagens e áudios do histórico continuam com seus renderizadores. Isso não corrige as pendências de presença/ack do item 24 nem bloqueia mídias enviadas por clientes antigos no backend.
- **Comentários do feed:** o clique abriu a tela no ensaio local; a falha confirmada era o campo de comentário encoberto pela barra inferior. Reservado o espaço real da barra, aplicado o tema à tela e ampliada a área de toque. A comparação do cartão agora considera o post e os callbacks, atualizando a contagem após voltar. Envio e restauração do rascunho em falha foram exercitados.
- **Match e perfil público:** a celebração usa a paleta do tema e botões com texto contrastante. A foto do perfil foi preservada sem o degradê que a esmaecia; nome e cidade aparecem abaixo dela. Abrir o chat pelo match mantém a lista de conversas como tela anterior.
- **Desafios e abas:** lista e formulário de desafios usam o tema. A entrada por “Desafiar” mantém MyProfile antes de Challenges, inclusive com a aba Perfil já aberta. O botão Voltar abre o perfil principal. Tocar numa opção da barra inferior reinicia apenas a pilha daquela aba em sua tela principal, inclusive na aba já selecionada.
- **Validação local:** TypeScript sem erros; exportação Expo Web e pós-build aprovados; script `mobile/scripts/verify-social-ui.cjs` aprovado nos modos claro e escuro em navegador Chromium móvel (390 × 844), com APIs substituídas por fixtures. Exercitados comentários/envio/falha/contagem, grupos, perfil/foto, desafios/formulário/volta, match/chat e troca de tema em execução; capturas inspecionadas e nenhum erro JavaScript nesses fluxos. Não equivale a teste em aparelho Android/iOS, teclado nativo ou backend de produção.
- **Entrega:** publicação Git autorizada pelo usuário; `docs/` permanece fora deste envio. Os estados dos 42 tópicos são preservados: esta revisão resolve o escopo visual/navegação descrito, sem declarar concluídas as demais pendências dos itens amarelos.

Para repetir a verificação de interface: iniciar Expo Web na porta 8092 e executar `node mobile/scripts/verify-social-ui.cjs` a partir da raiz, com Playwright disponível. `PLAYWRIGHT_MODULE`, `BROWSER_CHANNEL`, `SOCIAL_UI_URL` e `SOCIAL_UI_OUTPUT` permitem configurar o ambiente e o destino das capturas. O teste usa dados fictícios e intercepta as chamadas de API.

## Revisão documental completa — 11/09/2026

- Documentação principal e README revisados contra o código-base `ba0ea43`, preservando as cores dos 42 itens. A revisão não implementa funções, não modifica o layout e não confirma deploy.
- Acrescentados [inventário de telas/rotas/migrations](docs/INVENTARIO_TECNICO.md), [dicionário completo das classes de dados](docs/MODELO_DADOS.md) e [guia de apoio ao TCC](docs/GUIA_TCC.md).
- TypeScript/TSX: 377 de 389 arquivos de código (96,9%; 98,2% por bytes), incluindo testes/scripts e excluindo dependências/builds/documentação/JSON. Expo 52 continua ativo, inclusive na exportação web.
- **Correção de estado de entrega:** o lote dos sete vermelhos já consta no commit `70e1519`; `ba0ea43` contém ajuste posterior de créditos. A anotação antiga “sem commit/push” foi substituída abaixo. O Git remoto foi confirmado na consulta anterior; isso não comprova frontend/backend/migrations publicados.
- **Quase prontos não significa todos os amarelos:** 9, 25, 26, 27, 28, 29, 30, 31, 32, 35 e 38 têm implementação no escopo atual para validar; 1/23 exigem configuração privada e teste operacional; 7/12/21/24/33/34/36/37/39/40/41/42 ainda têm implementação ou decisão pendente.
- **Achados documentados, sem correção de código nesta revisão:** no item 37, CreateStoryScreen e StoryViewerScreen não têm importação/entrada identificada no fluxo; nos itens 32/42, CSP da configuração Vercel da raiz pode bloquear o roteador FOSSGIS se for aplicada. Confirmar qual configuração Vercel está efetiva.
- A documentação de segurança agora explicita localStorage no web, TLS PostgreSQL com `rejectUnauthorized: false`, configuração parcial perigosa do Swagger e ausência de garantia absoluta. Isso complementa o item 42, sem afirmar pentest ou auditoria remota.
- A contagem de zero itens vermelhos é a classificação vigente, não uma declaração de ausência de bugs, lacunas ou recursos enganosos ainda mencionados em amarelos.
- **Validação desta revisão:** 15 documentos revisados/criados; 292 links internos conferidos; 42 itens e cores preservados; `git diff --check` aprovado. Reexecutados e aprovados 77 testes backend (18 suítes) e 52 frontend (15 suítes). Nenhum deploy, migration ou teste com dados reais foi realizado.

## Identificação do projeto — 09/09/2026

- Por solicitação do responsável, a identificação antiga no README foi substituída por **Sanley Lujan**, em concordância com a documentação principal.
- Duas referências à hospedagem antiga no serviço de localização foram atualizadas para o endereço público do projeto já registrado na documentação: `https://sync-2-0-blush.vercel.app`.
- Créditos de serviços/bibliotecas, autores de frases, usuários fictícios de testes e histórico de commits foram preservados. Nenhuma conta ou dado de usuário foi alterado.
- Esta atualização não altera os estados dos 42 tópicos; continuam valendo as pendências de configuração, publicação e validação descritas abaixo.

## Legenda de estado

- 🟢 **Resolvido no código:** implementação concluída e aprovada nas validações locais indicadas neste documento.
- 🟡 **Parcial/condicionado:** parte útil existe, mas falta configuração externa, migration, deploy, aparelho físico ou parte relevante da função.
- 🔴 **Não funciona como prometido:** recurso visível, incorreto, simulado ou enganoso que ainda precisa ser corrigido/ocultado.
- ⚪ **Não iniciado:** problema mapeado, mas ainda não implementado e sem promessa ativa confirmada ao usuário.
- ⚫ **Removido/oculto:** retirado da interface e do fluxo ativo por decisão do produto.
- 🔵 **Adiado conscientemente:** risco conhecido e aceito por enquanto.

## Acompanhamento dos 42 tópicos

| # | Estado | Tópico | O que foi feito / diagnóstico real | Próxima ação |
|---:|:---:|---|---|---|
| 1 | 🟡 | Verificação de identidade falsa | Fluxo manual real do item 23. Lote 1 (08/09): corrigida importação de `sharp` que impedia processar imagens; teste com imagem fictícia real confirma remoção de EXIF. Seleção/envio só liberados após confirmação de bucket privado; falha mostra indisponibilidade. Análise usa lock para impedir decisões concorrentes; timeout nas operações e URL limitada a 5 min. Não é prova legal nem prova de vida. | Validar bucket/policies/variáveis e fluxo completo no deploy com documentos fictícios. Teste local não comprova configuração remota. |
| 2 | 🟢 | Exposição da localização das atividades | Detalhes e exportação da rota exigem o proprietário; comparação exige que as duas atividades pertençam ao usuário; heatmap exige login e devolve apenas células agregadas com pelo menos três atividades; a live pública exige token também no WebSocket. | Acrescentar pentest/E2E de acesso cruzado no ambiente publicado. |
| 3 | 🟢 | Entrada não autorizada em salas de chat | `joinChat` e `typing` consultam o match e recusam um terceiro usuário antes de entrar ou emitir eventos na sala. Há teste automatizado do bloqueio. | Repetir o cenário E2E contra o deploy. |
| 4 | ⚫ | Stripe apresentado sem pagamento real | Tela, navegação, publicidade e módulo ativo de assinatura foram removidos. | Só restaurar depois de checkout, webhook assinado, idempotência e confirmação server-side reais. |
| 5 | ⚫ | Premium sem controle de acesso | Planos, badges e chamadas de upgrade foram retirados; o app não promete Premium enquanto não existe entitlement real. | Criar autorização de entitlement no backend antes de reativar qualquer plano. |
| 6 | 🟢 | Recuperação de senha sem entrega do token | Fluxo funcional confirmado pelo usuário em 08/09/2026: recuperação/redefinição de senha e retorno à conta. Validação relatada pelo usuário, não teste remoto realizado pelo agente. | Manter testes de regressão; expiração, reutilização do link e revogação em outros dispositivos ainda exigem testes específicos. |
| 7 | 🟡 | Sessões, refresh token, logout e onboarding | Lote 1: rotação/revogação transacionais com lock por usuário; novos access tokens vinculados à sessão (`sid`) e revogáveis nas rotas HTTP protegidas. Cliente preserva login em timeout/5xx, coordena refresh concorrente e impede resposta atrasada de restaurar sessão encerrada. Web Locks coordena abas compatíveis; perfil/onboarding são reconsultados ao reabrir. Cache da API removido do service worker. | Testar dois aparelhos/abas, expiração e onboarding após deploy. Tokens legados sem `sid` duram até expirar; revogação de sockets já abertos ainda precisa ser unificada. LocalStorage/XSS segue como risco conhecido. |
| 8 | 🔵 | Mídias em disco efêmero | Mantido por decisão de continuar nas hospedagens gratuitas atuais. Stories e mídias ainda podem desaparecer após restart/redeploy. | Migrar para storage externo com faixa gratuita quando possível. |
| 9 | 🟡 | Live tracking quebrado | Lote 1: socket público separado sem JWT, reinscrição após reconexão, reconciliação REST periódica sem duplicar pontos e estados de reconexão/GPS atrasado. Sala por token impede que link antigo receba nova transmissão. Adicionado controle para parar compartilhamento; evento de fim só após conclusão persistida. API live sem cache. | Testar atleta/observador em duas redes, revogação, expiração, restart do backend e última posição no deploy. Não garante transmissão com PWA suspenso. |
| 10 | 🟢 | Perda dos últimos pontos GPS | A finalização aguarda o flush, envia a cópia local, reconcilia por timestamp sem duplicar e restaura o buffer se a persistência falhar. Coberto por teste. | Fazer teste de campo com sinal instável. |
| 11 | 🟢 | Duração inclui contagem regressiva, pausas e “duas atividades” novas | A atividade nasce após o countdown, o tempo ativo desconta pausas, os eventos preservam seus horários e o histórico paginado não é mais interpretado como duas atividades em uma conta nova. | Validar uma sessão longa com várias pausas no deploy. |
| 12 | 🟡 | Auto-pausa não pausa realmente | Lote 1: retomada calibrada por modalidade, inclusive caminhada leve; perda de sinal e pontos fora de ordem não são interpretados como parada. Desligar auto-pausa retoma apenas pausa automática, nunca a manual. Controle oculto em esportes incompatíveis; captura nativa solicita fixes estacionários. Lacuna longa inicia novo trecho sem inventar distância. | Calibrar em rua/celular e testar pausas com rede instável. Sincronização durável dos eventos de pausa offline ainda merece reforço; testes locais não comprovam limiares físicos. |
| 13 | 🟡 | Registro e retomada do percurso no web/PWA | Retomado em 26/10 por solicitação do responsável, aceitando lacunas. Aproveita fixes recebidos com página oculta, salva percurso/horários/pausas por conta, recupera após recarga e renova GPS ao voltar. Reenvio REST de pontos/pausas pendentes; trechos separados no mapa, resumo, splits e GPX. Base nativa preservada, sem lançamento. | Validar em Android/iOS reais. Tela aberta melhora cobertura; navegador suspenso pode interromper o GPS. Sem promessa de percurso completo ou recuperação após limpeza/falha do armazenamento local. |
| 14 | 🟢 | Metas rápidas simuladas | Sem criar nova tabela: a meta usa colunas na atividade existente. Corrida/ciclismo recebem meta em distância; academia recebe meta em duração; o progresso é restaurado, alertado e persistido. | Aplicar a migration `1782300000000` e validar uma meta de cada tipo no aparelho. |
| 15 | ⚫ | Sensor Bluetooth placeholder | Todo o acesso/convite visível para sensor BLE foi ocultado por enquanto. | Só reativar com integração BLE real, lista de compatibilidade e testes. |
| 16 | ⚫ | Coach de áudio silencioso | Coach de áudio, o serviço silencioso e a falsa ação de leitura foram removidos; feedback tátil útil foi mantido. | Só restaurar com pacote, preferências, idioma, volume e fallback acessível realmente testados. |
| 17 | 🟢 | Calorias, voltas, elevação e unidade incorretas | Calorias usam esporte, duração e peso real do perfil; altura só serve como estimativa conservadora quando o peso falta. Elevação e voltas são filtradas e persistidas. Academia prioriza tempo; corrida/ciclismo priorizam quilômetros. | Aplicar migration e comparar com sessões controladas em aparelho físico. |
| 18 | 🟢 | Recordes pessoais não funcionam | Foi criado `/activities/records`; resumo e histórico identificam primeiro recorde/novo recorde usando distância/ritmo para esportes de rota e duração para academia. | Adicionar mais modalidades quando suas regras esportivas forem definidas. |
| 19 | 🟢 | Notificações vazias, repetitivas ou sem navegação | Contrato `body` foi padronizado, tipos abrem a tela correspondente e conclusões variam de forma coerente por atividade, duração, resultado e meta. | Avaliar a variedade com uso real e ajustar textos sem mudar a lógica. |
| 20 | 🟢 | Preferências de notificação e tema não persistem | Preferências são salvas no backend e bloqueiam push/in-app quando desativadas. Claro/escuro é persistido localmente e na conta, inclusive após novo login. | Aplicar a migration `1782400000000`; testar sincronização entre dois dispositivos. |
| 21 | 🟡 | Push de produção na versão web | Corrigida a promessa visível: no web/PWA o switch de push foi substituído por aviso explícito de indisponibilidade fora do app; removidos o pedido de permissão inútil e o falso token `web-local`. Notificações internas e base Expo nativa preservadas. | Validar o aviso e o sino no deploy. Web Push com VAPID/subscriptions NÃO foi implementado; não confundir instalar o PWA com instalar um app nativo. |
| 22 | 🟢 | Safety Center chama ponto estático de “ao vivo” | Escolhida a alternativa segura e honesta: textos e acessibilidade agora dizem “localização atual”. Não se promete atualização contínua inexistente. | Se houver live de segurança no futuro, criar sessão temporária, consentimento, expiração e revogação. |
| 23 | 🟡 | Denúncias, administração, verificação e comentários do Feed | Denúncia de post deixou de simular sucesso; denúncias de conta não causam banimento automático; painel exclusivo de `isAdmin` lista contas/posts/pedidos e permite descartar, desativar/remover e aprovar/recusar. Documentos são reencodados sem EXIF/GPS, ficam em bucket privado, usam URL assinada de 5 minutos sem cache e são apagados após decisão. Ações admin são auditadas. O feed mostra selo real; comentários estão montados e agora aceitam menções registradas e reações persistentes. | Executar o SQL de configuração, preencher as variáveis somente no backend, aplicar `1782500000000`, testar o fluxo completo e realizar revisão operacional/LGPD antes da liberação. |
| 24 | 🟡 | Chat com presença falsa e entrega não confiável | Mensagens e autorização de salas funcionam, mas “online agora”, acknowledgements e outbox/retry completo para mídia ainda não representam garantia real de entrega. | Implementar presença com TTL, ack idempotente e fila durável. |
| 25 | 🟡 | Conquistas praticamente inoperantes | Regras ampliadas para atividades, distâncias, sequências, modalidades, horários e ações sociais persistidas. Removido SQL SQLite incompatível com produção. Eventos de escrita e conclusão de treino reconciliam medalhas; leitura recupera falhas. Lock + chave única impedem novas duplicações; catálogo mostra regras reais e preserva medalhas antigas. | Aplicar migration e validar novas conquistas no celular. Oito regras sem evidência confiável ficam fora do catálogo novo (detalhadas abaixo). Medalhas não concedem XP extra. |
| 26 | 🟡 | Missões diárias desconectadas | Implementadas em 08/09/2026: catálogo de 45 objetivos curtos; seleção determinística por conta/dia, até três missões compatíveis com esportes, sempre uma universal. Plano persistido, progresso por atividades concluídas e recompensa única. Cartão no perfil e na tela de desafios. | Aplicar migration no deploy e testar no celular, incluindo renovação diária e modalidades. Não há simulação nem botão para declarar conclusão. |
| 27 | 🟡 | XP e níveis inconsistentes | Backend unificado: 2 XP/minuto elegível, até 40 por atividade; missões 20 e desafios 20, todos sob teto único de 100 XP/dia. Nível a cada 500 XP. Ledger único por origem e lock por usuário em transação PostgreSQL. XP legado preservado uma vez; estimativa por estatísticas removida. | Validar após migration no deploy e em duas sessões simultâneas. Teto é incentivo de produto, não limite médico nem garantia de atividade física real. |
| 28 | 🟡 | Territórios e prêmios manipuláveis | Captura manual bloqueada. Servidor usa atividade concluída do dono, opt-in explícito, percurso plausível e processamento idempotente. Temporada mensal por horário de Brasília; visita antiga não sobrepõe recente. Ranking exclui contas inativas; prêmios fictícios retirados. | Aplicar migration; testar participação voluntária em duas contas, reenvio e virada de mês. Ranking recreativo sem prêmios/XP. GPS falsificado no aparelho continua sendo risco. |
| 29 | 🟡 | Segmentos e KOM manipuláveis | Tempos manuais recusados; segmentos criados a partir de atividade própria com aviso de publicação. Ranking usa esporte compatível, percurso completo, continuidade e plausibilidade; lock e índice único evitam repetição. Participação no treino exige opt-in. Registros legados preservados fora do ranking validado. | Aplicar migration e testar na rua. Criar trecho contínuo de 100 m a 5 km; não há premiação ou XP extra. Não garante prova física nem elimina toda fraude GPS. |
| 30 | 🟡 | Desafios sem validação esportiva | Objetivos permitidos de 5/10/15 min ou distâncias curtas por modalidade; prazo 1/3/7 dias; só entre matches sem bloqueio, até três ativos por pessoa. Aceite obrigatório; progresso automático após aceite e antes do prazo; ambos podem concluir e ganhar até 20 XP cada. Conclusão manual bloqueada, expiração reconciliada por job e leitura. | Deploy e teste de envio/aceite/treino nas duas contas. Migration expira desafios antigos abertos; não há corrida por vencedor. GPS do cliente ainda pode ser falsificado. |
| 31 | 🟡 | Locais esportivos fictícios no mapa | Em 06/09/2026, substituídos por consulta autenticada de academias cadastradas no OpenStreetMap via Overpass. Até 100 resultados em 5 km, nome/endereço disponível, fonte e rota; estados de carregamento, vazio e falha sem locais inventados. | Publicar backend e frontend e conferir no celular. Cobertura depende dos cadastros OSM; demais tipos de locais continuam ocultos. |
| 32 | 🟡 | Planejador descarta a rota ao iniciar | Esporte e geometria chegam ao tracking e são persistidos na atividade; destino planejado não aparece em leituras genéricas/públicas. Rota tracejada, distância restante aproximada e aviso de desvio usam GPS atual. Troca de esporte recalcula no perfil foot/bike correto. | Backend com migration antes do frontend; testar iniciar/reabrir, perda de GPS e saída da rota. Conferir CSP aplicada: o vercel.json da raiz não inclui o host FOSSGIS em connect-src. Sugestão visual, não navegação curva a curva; serviço público FOSSGIS sujeito a disponibilidade/limites. |
| 33 | 🟡 | Planos de treino são calendário estático | O calendário aparece, mas ainda não registra conclusão, vínculo com atividade ou adaptação. | Criar sessões de treino e progresso sincronizado. |
| 34 | 🟡 | “IA Coach” é regra fixa | Algumas sugestões funcionam, porém o nome “IA” promete mais do que a implementação determinística entrega. | Renomear para “Insights” ou implementar IA real com limites e ações verificáveis. |
| 35 | 🟡 | Seguir, adicionar usuário e ranking de amigos desconectados | “Curtir” agora descreve interesse para match; estado pendente vem do servidor. “Seguir perfil” tem ação própria e reversível. Ranking principal diz Matches; segmentos dizem Seguindo. Follow/listas respeitam bloqueios, conta ativa e visibilidade. Busca por nome corrigida para UUID no PostgreSQL. | Validar seguir/deixar de seguir, interesse pendente, match e bloqueio em duas contas. Follow não concede acesso a conteúdo privado nem cria match. |
| 36 | 🟡 | Descoberta e Super Like incompletos | Swipe/match básico existe, mas descartes não reciclam e Super Like não possui consequência especial confiável. | Definir expiração de swipe e comportamento server-side do Super Like. |
| 37 | 🟡 | Stories com upload e interação frágeis | Parte do código existe; revisão estática em 11/09 não encontrou importações/entrada para CreateStoryScreen e StoryViewerScreen no fluxo atual. Pasta, preview, MIME, likes e limpeza ainda exigem correção, somados ao storage efêmero do item 8. | Conectar e validar o fluxo visível, corrigir upload/player, likes idempotentes e limpeza agendada. |
| 38 | 🟡 | Estatísticas exibem números/unidades incorretos | Contrato v2 em metros/segundos/kcal; ritmo ponderado de corrida separado de velocidade de ciclismo. Dashboard agrega histórico completo no servidor, não só página 1. Calorias persistidas, maior atividade como objeto, dias 29–31 e fuso corrigidos. Removido fallback enganoso de totais paginados no perfil. | Publicar backend antes do frontend e comparar telas em conta vazia e com vários treinos/modalidades. Não reconstrói calorias históricas que nunca foram armazenadas. |
| 39 | 🟡 | Grupos privados e administração incompletos | Grupos básicos existem, mas código de convite não pode ser informado adequadamente e não há transferência segura de admin. | Criar entrada por código/deep link e transferência confirmada. |
| 40 | 🟡 | Eventos com risco de lotação incorreta | Fluxo principal existe; capacidade não é atômica e lembretes/deep links são incompletos. | Usar transação/lock ou update condicional e implementar lembretes. |
| 41 | 🟡 | Tema, acessibilidade e recuperação de erro parciais | A persistência claro/escuro foi corrigida e coach falso foi ocultado, mas tokens visuais, acessibilidade e recuperação de erro ainda não são globais. | Auditar todas as telas, contraste, leitor de tela e recuperação nativa. |
| 42 | 🟡 | Infraestrutura, banco, dependências e testes frágeis | Build/testes aumentaram, `express` virou dependência direta, migrations foram adicionadas e `DB_SYNCHRONIZE=false` foi definido no Render. Ainda faltam E2E, auditoria de dependências com rede, staging, backup/restore e monitoramento operacional. | Criar staging, ensaiar migrations, `npm audit`, E2E e restore. Revisar também Swagger com configuração parcial, CSP efetiva e verificação de certificado TLS PostgreSQL; achados documentados em 11/09, não corrigidos nesta revisão. |

## Resumo por cor

- 🟢 **11 resolvidos no código/fluxo funcional validado:** 2, 3, 6, 10, 11, 14, 17, 18, 19, 20 e 22.
- 🟡 **25 parciais/condicionados:** 1, 7, 9, 12, 21, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41 e 42.
- 🔴 **0 itens classificados como vermelhos na matriz vigente.** Os sete itens tratados passaram a amarelo: isso NÃO significa ausência de bugs/promessas a revisar nem que todas as funcionalidades futuras foram implementadas ou validadas em produção. As lacunas dos amarelos continuam descritas individualmente.
- ⚪ **0 não iniciados nesta classificação.**
- ⚫ **4 removidos/ocultos:** 4, 5, 15 e 16.
- 🔵 **2 adiados conscientemente:** 8 e 13.

Os itens 14–23 solicitados nesta etapa foram tratados. Os itens 14, 17, 18, 19, 20 e 22 estão concluídos no código; 15 e 16 foram ocultados; 21 permanece incompleto na web por decisão pendente; 23 está implementado, mas fica amarelo até receber infraestrutura privada, migration, deploy e teste operacional. O item 1 foi substituído — não reativado como simulação — pelo fluxo seguro do item 23.

## Segurança — avaliação honesta

### Lote dos sete vermelhos — 08/09/2026 — 21, 25, 28, 29, 32, 35 e 38

**Estado da entrega (atualizado em 11/09/2026):** lote versionado no commit `70e1519`; ajuste posterior de créditos em `ba0ea43`. Deploy e migrations de produção não foram confirmados nesta revisão. Visual principal e paleta preservados; textos, controles inexistentes e consentimentos foram ajustados. A atualização do frontend/backend e os ensaios em celular continuam necessários. Não houve uso de documentos reais, mudança remota no Supabase, serviço pago, dependência npm nova ou divulgação de chaves.

- **21 — transparência, não implementação de Web Push:** retirado o switch enganoso no navegador e o falso retorno de registro. O app orienta consultar notificações internas. VAPID, subscription, service worker de push e receipts seguem fora desta entrega.
- **25 — catálogo verificável:** regras sem base suficiente não são oferecidas a novos desbloqueios: nascer do sol, chuva, calor, frio, cidades diferentes, presença em dez eventos, trinta stories históricos e primeiro compartilhamento live. Medalhas antigas continuam disponíveis, sem apagar histórico. As demais regras utilizam dados persistidos; horário de Brasília e mínimo de 60 segundos para conquistas de treino. Sequência de consistência significa três dias em cada uma de 12 semanas consecutivas. Medalhas não contornam o teto de XP do item 27.
- **28 — privacidade e temporada:** somente treinos iniciados pelo fluxo de Territórios, após confirmação, participam. O botão inicia caminhada; não reivindica a posição atual isolada. Células do mês corrente mostram nome/cor e localização aproximada; capturas antigas sem temporada não são contadas, mas não foram apagadas. Reenvios não recapturam células. Sem troféu físico, dinheiro, selo prometido ou XP adicional.
- **29 — percurso real:** criação pelo resumo da própria atividade publica a geometria com consentimento e permite apurar os segmentos compatíveis desse treino. A tela do segmento oferece participação voluntária para novos treinos. Tempos são calculados no servidor; entrada manual antiga dá erro explícito. Resultados legados sem validação permanecem no banco e não competem. Tolerâncias GPS são controles de plausibilidade, não certificação antifraude. Segmentos legados sem geometria precisam ser recriados pelo fluxo real.
- **32 — rota no treino:** geometria privada é salva/restaurada; tracejado distingue plano da rota realmente percorrida. Aviso de desvio acima de aproximadamente 60 m; GPS com mais de 30 s não é mostrado como orientação atual. Não há voz, recalculagem automática nem instrução curva a curva. Para caminhada/corrida e ciclismo foram escolhidos os perfis específicos do [FOSSGIS/OSRM](https://routing.openstreetmap.de/about.html), com crédito OSM, link para corrigir mapa, cache em memória e intervalo mínimo entre requisições. Origem/destino são enviados a esse provedor ao solicitar cálculo; isso está informado na tela. Não é um serviço com SLA, nem prova de segurança de uma via.
- **35 — semântica e acesso:** seguir é unilateral; curtir demonstra interesse; match requer reciprocidade. Listas de follows não retornam email/coordenadas precisas e ocultam cidade se a pessoa desativou sua exibição. Bloqueios são conferidos na consulta; seguir não permite contornar conteúdo privado. O recorte Seguindo não transforma seu primeiro colocado automaticamente em KOM global.
- **38 — contrato:** clientes novos pedem `version=2`; chamadas sem versão preservam km/horas do contrato antigo para não quebrar PWAs ainda em cache durante o rollout. No v2, todas as distâncias do DTO v2 são metros, durações segundos, energia kcal, ritmo min/km para corrida e velocidade km/h para ciclismo. Totais/gráficos vêm de agregação de atividades concluídas, sem limite da página de histórico. Calorias são estimativas persistidas; registros legados sem calorias continuam sem valores reconstruídos.

**Administração e identidade**

1. Na tabela pública `users` do app, o administrador precisa ter `isAdmin = true`. Alterar somente metadados de `auth.users` não substitui essa coluna.
2. Caminho no app: **Perfil → Configurações → Painel administrativo → Verificação de perfis · pendentes**. A entrada agora menciona também verificação de identidade.
3. Ao reabrir Configurações o cadastro é consultado novamente. Se o botão continuar ausente após a promoção, sair/entrar e verificar se a API está conectada à mesma base.
4. No painel, o ADM vê selfie/documento frente e verso por links privados temporários e escolhe **Aprovar selo** ou **Recusar**. Denúncias de contas/posts ficam na mesma área.
5. A configuração anterior continua obrigatória: `backend/sql/01-configurar-admin-e-verificacao.sql` para a base e `02-promover-usuario-admin.sql` para promover contas existentes quando necessário. Bucket de identidade deve ser privado, variáveis de storage somente no backend. Não testar com documentos reais antes de revisar configuração, acesso e retenção.

**Banco e publicação**

- Migration nova: `1789000000000-CompleteRedTopics.ts`. Acrescenta colunas às tabelas existentes e índices; **não cria novas tabelas, não apaga usuários/treinos nem remove resultados históricos**.
- Acrescenta rota planejada privada e consentimentos/controle de território/segmentos em `activities`; instante de captura em `territory_cells`; geometria em `segments`; indicador de resultado validado em `segment_efforts`; chave idempotente em `user_achievements`.
- Fazer backup antes da atualização. Publicar **backend primeiro**, com `DB_SYNCHRONIZE=false`: a configuração atual executa migrations ao iniciar. Conferir log de conclusão antes de atualizar frontend. Não ativar synchronize em uma base de produção existente.
- A inicialização do zero carrega as entidades novas; ao usar o fluxo de configuração por migrations, incluir esta migration junto às anteriores. Não há chave nova nem SQL separado para elevar permissões de alguém neste lote.

**Validação local e limites**

- 77 testes backend/18 suítes e 52 testes mobile/15 suítes aprovados; TypeScript, build NestJS e exportação Expo Web verificados. Novos testes cobrem unidades, fuso, fim de mês, catálogo, modalidade, pausa/desvio, escolha de roteador e rejeição de respostas inválidas.
- `backend/scripts/check-red-topics.cjs` executa os serviços e as entidades reais em PostgreSQL/WASM isolado, sem ler .env/conectar à produção. Cobre migration repetível, busca por nome/interesse pendente, bloqueios, projeções privadas, posse da atividade, reenvio de território, rejeição de tempo manual, reconhecimento GPS, calorias/unidades e medalhas concorrentes.
- A integração usa uma conexão serializada; não equivale a teste multi-processo/carga, pentest completo, auditoria de dependências remotas, inspeção das policies publicadas ou teste físico de GPS.
- **Roteiro de validação do usuário:** (1) notificações web e painel ADM; (2) conquistas em conta vazia e após treino; (3) caminhada voluntária de território em duas contas; (4) criar segmento contínuo curto e repetir pelo botão da tela; (5) planejar caminhada/bicicleta, iniciar, reabrir e sair da rota; (6) seguir/curtir/match/bloquear; (7) comparar estatísticas entre perfil e dashboard, incluindo academia.
- Não é possível garantir segurança absoluta nem que um navegador/GPS forneça evidência física infalsificável.

### Lote 1 dos parciais — 08/09/2026 — itens 1, 7, 9, 12 e 13

- **Escopo:** cinco primeiros amarelos na ordem do plano. Identidade, sessão, live e pausa receberam correções locais; item 13 passou a adiado por orientação do usuário durante a execução. Nenhum dos outros quatro foi promovido a verde sem teste operacional. Próximo lote: **23, 24, 26, 27 e 30**.
- **Privacidade:** service worker `sync-v7-privacy-20260908` deixa de cachear API, pedidos autenticados e storage privado; nova versão elimina caches antigos durante ativação. URLs de documentos não devem continuar recuperáveis pelo cache do PWA. Isso não apaga downloads/capturas que uma pessoa já tenha feito.
- **Sessão:** teste PostgreSQL/WASM cobre rotação, reutilização com revogação efetivamente commitada, corrida refresh/logout, autorização da sessão por proprietário e recusa do access vinculado à família revogada. Transação e geração de tokens não deixam descendente ativo após revogação ensaiada. Fallback para browsers sem Web Locks ainda requer teste de múltiplas abas.
- **Identidade:** imagem gerada exclusivamente para teste passou por decodificação/reencodificação sem EXIF; payload falso/oversized recusado. Lock de revisão ensaiado no banco isolado com duas decisões concorrentes. Nenhum documento real foi lido/enviado e nenhuma configuração do Supabase foi alterada.
- **Live:** novo observador usa apenas token do link; reconecta e reinscreve listeners/sala; REST a cada 15 s recupera pontos persistidos e estado final. Link pode ser revogado na tela do atleta; uma nova transmissão não reautoriza a sala do token anterior. Usuário vê “reconectando”/“aguardando GPS”, não uma falsa confirmação de atualização contínua.
- **Segundo plano:** implementação nativa anterior permanece como base, mas não foi publicada nem testada em aparelho. Não existe task web equivalente: [documentação oficial do Expo TaskManager](https://docs.expo.dev/versions/latest/sdk/task-manager/). A melhoria na fila é proteção adicional, não promessa de GPS com PWA suspenso.
- **Validação local:** 65 testes backend e 47 testes mobile aprovados; build NestJS, TypeScript mobile e exportação Expo Web aprovados. Integração PostgreSQL/WASM isolada aprovada (inclui regressão da gamificação). Esta integração usa conexão única serializada e não equivale a concorrência multi-processo em staging. Testes do cliente incluem serviços com dependências simuladas e execução das regras do service worker; não são testes visuais das telas.
- **Deploy:** nenhuma nova tabela, migration ou chave foi acrescentada neste lote; as migrations anteriores continuam obrigatórias. Publicar backend antes do frontend para disponibilizar `canSubmit` e as alterações da live. Envio ao Git autorizado pelo usuário em 08/09/2026; a conclusão dos deploys do backend/frontend deve ser verificada nos provedores e não é comprovada pelo push.
- **Roteiro após publicação:** (1) testar KYC com imagens fictícias e bucket privado; (2) revogar uma sessão de outro navegador e conferir recusa HTTP/novo login; (3) observar live em outro dispositivo, alternar redes e parar compartilhamento; (4) caminhar, parar, retomar devagar e desligar auto-pausa; (5) conferir aviso de tela aberta no PWA. Não usar documentos reais nesta validação.
- **Limites preservados:** não houve pentest geral, auditoria remota de Supabase, teste visual/rua em celular ou promessa de segurança absoluta. Cookies HttpOnly, revogação unificada de sockets e pausa offline durável continuam pendentes.

### Entrega dos itens 26/27/30 — 08/09/2026

- Implementação e instruções de implantação/teste em `backend/GAMIFICACAO.md`. Migration `1788900000000` cria ledger com RLS, campo de início da progressão e versão/aceite dos desafios. Sem chave nova ou serviço pago.
- 54 testes backend e 28 mobile passaram. Compilação NestJS, TypeScript mobile e exportação Expo Web aprovadas. Integração PostgreSQL/WASM isolada aprovou a migration aplicada duas vezes, transações, teto, reenvio sem duplicação, missões, aceite, conclusão dos dois participantes, expiração, bloqueios, perfis mínimos, saldo legado preservado e RLS; metadados reais das entidades também carregados.
- Revisão adicional: finalidade de atividade agora usa update condicional para não executar crédito/notificações duas vezes em finais concorrentes; schemas recusam campos públicos de XP/nível de recompensa e conclusão manual. Cálculo não permite que tempo ativo informado ultrapasse o tempo observado descontadas as pausas.
- Os testes PostgreSQL/WASM usam conexão única, não equivalem a teste multi-processo de carga em staging. Não foi feito pentest de todo o site, inspeção da configuração remota do Supabase nem validação visual em aparelho físico. Esses limites continuam explícitos: segurança absoluta e prova de exercício real não são garantidas.
- Próximo passo após deploy: roteiro manual do documento de gamificação em duas contas. Os itens permanecem amarelos até essa validação. Desafios antigos abertos serão expirados pela migration; histórico concluído e saldo legado real são preservados.

### Direção de gamificação — 08/09/2026 (histórico do planejamento; implementação abaixo)

- Missões diárias (26) são objetivos pessoais curtos; XP/níveis (27) são o sistema de progressão; desafios (30) no código atual são disputas entre duas pessoas com aceite, prazo e vencedor. Podem compartilhar a apuração de atividades, mas não são o mesmo recurso.
- Uma atividade elegível pode avançar uma missão e um desafio compatíveis, sem crédito duplicado por reenvio. Encerramento de desafios e determinação de vencedor devem ser feitos pelo servidor, nunca por autodeclaração do cliente.
- Direção proposta: atingir o teto de XP não bloqueia atividades nem apaga progresso; apenas interrompe créditos de experiência naquele dia. Sem perda de XP por descansar ou incentivo a compensar dias. O teto é uma regra de incentivo, não garantia de segurança física ou recomendação individual de exercício.
- Duração deve usar tempo ativo (sem pausas), distância somente modalidades compatíveis e pontos elegíveis. Prever fuso/dia, travessia da meia-noite e trocas de fuso para impedir reinicializações indevidas do teto. Quantidades de XP e curva de níveis ainda não aprovadas/implementadas.

### Atualização de mapas — 06/09/2026

- Correção de sobreposições (item 41): barras superiores em fluxo com altura medida e espaço vertical para chips/sombras; filtros continuam roláveis horizontalmente com indicador. Botão de rota e painel de clima passam a respeitar a altura das barras. Resumo de resultados e “Meus eventos” ficam em uma coluna inferior com espaçamento, sem coordenadas absolutas concorrentes entre eles.
- Posição no mapa web: `showsUserLocation` era aceito, mas ignorado pelo adaptador Leaflet. Implementado marcador azul com círculo da precisão informada pelo navegador, atualização via watchPosition, aviso em falhas/permissão negada e limpeza ao desmontar. Não usa o centro do mapa como posição fictícia nem recentraliza a cada atualização. Isso não comprova se o GPS de um aparelho está ativado; localização pode vir de outros sinais do sistema.
- Validação desta correção: TypeScript e 24 testes existentes mobile passaram. Esses testes não substituem validação visual nem ensaio de permissões/GPS em celular; ambos seguem pendentes após publicação.

- Legibilidade (item 41, web/PWA): mapa compartilhado passa a acompanhar o tema persistido do app. Voyager no claro; Dark Matter com brilho 1,75 e contraste 1,08 apenas na camada de tiles no escuro. Créditos com cores adaptadas e fonte de 11 px. Troca de tema atualiza apenas tiles, preservando instância, centro, zoom, marcadores e rotas. Layout externo inalterado; ajuste visual final no celular e publicação pendentes. Mapas nativos não foram alterados nesta etapa.

- Item 31: academias reais integradas via `GET /api/places/gyms/nearby`, sem tabela, migration, chave nova ou dependência adicional. Mantidos cores e componentes existentes, com ícone de academia e mensagens de estado/fonte.
- Consulta `leisure=fitness_centre`, incluindo pontos e centros de áreas; exclui cadastros privados/desativados e coordenadas inválidas, deduplica IDs OSM. Não certifica funcionamento comercial nem entrada exata do estabelecimento.
- Cache em memória de seis horas por grade (~1 km), máximo 200 entradas; no máximo uma consulta externa simultânea e intervalo global de 15 segundos por processo. Login, rate limit, parâmetros numéricos limitados, endpoint HTTPS fixo sem redirects, timeout e resposta limitada a 2 MB. Falhas não se transformam em resultados vazios de sucesso.
- Overpass recebe apenas centro arredondado e raio, não identidade, token ou GPS exato. O frontend envia coordenadas ao próprio backend para filtragem dos 5 km. A hospedagem comunitária é gratuita mas limitada, sem garantia de disponibilidade; cache/limite local precisam ser compartilhados se houver múltiplas instâncias.
- Fontes: https://wiki.openstreetmap.org/wiki/Tag:leisure=fitness_centre e https://wiki.openstreetmap.org/wiki/Overpass_API . Dados OSM sob ODbL, com fonte identificada e link no cartão.
- Validação local: TypeScript backend/mobile e 46 testes backend aprovados, incluindo cinco testes da nova busca (normalização, cache, parâmetros, falhas e limite). Publicação e teste visual em celular pendentes.
- Consulta externa real validada em 06/09/2026: centro arredondado de Resende (-22.47, -44.45) retornou três academias cadastradas em até 5 km. Isso não representa cobertura completa ou verificação presencial.
- Os dois componentes web agora leem `EXPO_PUBLIC_CARTO_API_KEY` no build. Configurar na Vercel como Config antes do deploy; não versionar o valor real. Chave pública de basemaps, não segredo administrativo.
- Mantidos os estilos existentes e a atribuição CARTO/OpenStreetMap; cache do service worker versionado para renovar os mapas. Sem chave, o provedor ainda pode exibir o aviso.
- A configuração CARTO não altera GPS nem adiciona estabelecimentos; a nova busca OSM é independente dela. Confirmação da chave em produção depende do deploy e da aceitação pela CARTO.

**Não é possível garantir que um app conectado à internet seja “100% seguro”.** O que pode ser afirmado é que foram aplicadas defesas concretas e que as validações locais passaram. Uma garantia absoluta seria tecnicamente enganosa, especialmente antes do deploy, pentest independente e operação contínua.

Proteções presentes ou reforçadas nesta etapa:

- autorização baseada no usuário carregado novamente do banco a cada requisição protegida; `isAdmin` não é aceito em DTO público;
- rate limiting global e limites menores em login, recuperação, cadastro, upload e KYC;
- access token curto, refresh rotativo/revogável e detecção de reutilização;
- validação de propriedade em rotas, atividades, chat, feed e live;
- CORS exato em produção, Helmet, CSP, HSTS, anti-frame e política de permissões;
- erros inesperados genéricos para o cliente; o contexto enviado pelo filtro ao Sentry usa o padrão da rota e omite IP completo. A filtragem de corpos/telemetria ainda precisa de revisão abrangente;
- RLS/revogação de acesso direto às tabelas do schema público do Supabase;
- documentos KYC em bucket obrigatoriamente privado, service role só no backend, arquivo com tamanho/tipo/pixels limitados, decodificação real e reencodificação que remove metadados;
- URL KYC assinada por no máximo cinco minutos e imagens administrativas sem cache persistente;
- exclusão de documentos após decisão/conta; uma falha de exclusão agora é explícita e preserva as chaves para permitir nova tentativa;
- apenas um pedido KYC pendente por usuário e log de ações administrativas;
- nenhuma chave real foi encontrada hardcoded na varredura do repositório; exemplos continuam sendo placeholders.

Riscos que continuam impedindo qualquer promessa de segurança total:

- migrations, CORS, CSP, bucket e segredos ainda precisam ser confirmados no ambiente publicado;
- a versão web guarda sessão no armazenamento local do navegador; um XSS bem-sucedido poderia acessar tokens. Migrar refresh token para cookie `HttpOnly` com proteção CSRF é uma melhoria futura importante;
- o Expo Web ainda exige `'unsafe-inline'` na política atual, reduzindo a força da CSP;
- não foi possível executar auditoria online atualizada de dependências neste ambiente sem rede;
- não houve pentest independente, teste de carga/abuso, staging, restauração de backup ou exercício de resposta a incidente;
- a análise de identidade é manual e não inclui prova de vida/antifraude especializada;
- mídias comuns continuam no disco efêmero aceito no item 8;
- Web Push continua incompleto no item 21.

## Configuração obrigatória antes de publicar os itens novos

1. Fazer backup do banco e aplicar as migrations `1782300000000`, `1782400000000` e `1782500000000` em staging antes de produção.
2. Em uma instalação nova, seguir `backend/sql/README.md`: executar `01-configurar-admin-e-verificacao.sql` durante a preparação do Supabase e, somente quando a conta administrativa existir, executar `02-promover-usuario-admin.sql` com o email correto.
3. Definir no **backend/Render**, nunca no mobile, Vercel ou Git: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_KYC_BUCKET` e `CPF_HASH_SALT`.
   Em banco existente, preserve o `CPF_HASH_SALT` já utilizado: trocar o sal altera os hashes e exige uma estratégia de migração para manter a verificação de CPFs existentes.
4. Confirmar que `identity-verification` aparece como **privado** no Supabase e que nenhuma policy pública permite leitura.
5. Manter `DB_SYNCHRONIZE=false`; migrations passam a ser a fonte controlada do schema.
6. Rotacionar imediatamente qualquer service role/JWT/senha que já tenha sido exposta fora do gerenciador de segredos.
7. Testar com contas separadas de usuário, denunciado e administrador; usar documentos inteiramente fictícios nessa validação.

## Validação local desta atualização

Atualização adicional em 06/09/2026: a logo enviada pelo usuário foi incorporada aos
ícones de instalação PWA/iOS/Android e favicon. Ícones quadrados preservam as cores
e proporções da arte, com versão nova nas URLs e no cache do service worker.
Essa alteração de identidade visual não muda o estado funcional dos 42 tópicos.

- Backend: build/typecheck concluído; **41 testes aprovados em 10 suítes**.
- Mobile: typecheck concluído; **21 testes aprovados em 6 suítes**.
- Web: export de produção concluído; **1.295 módulos empacotados**.
- Verificações cobrem, entre outros pontos, autorização de admin/chat/live, rotação e reutilização de refresh token, reconciliação GPS, pausa/duração, métricas por peso/esporte, histórico paginado e respeito às preferências de notificação.
- O deploy externo e as migrations no Supabase **não foram executados** nesta etapa.
- O layout visual foi preservado: cores, gradientes, cards e identidade atuais foram mantidos. As únicas alterações visuais relevantes foram ocultar funções solicitadas, adaptar unidades/conteúdo ao esporte e acrescentar controles necessários de administração, verificação e reações.
