# Plano de correções — 42 tópicos prioritários

**Data de criação do acompanhamento:** 02/09/2026

**Última atualização:** 06/09/2026

**Escopo:** auditoria funcional, correções solicitadas, transparência das funções mostradas ao usuário e segurança do aplicativo Sync.

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
| 1 | 🟡 | Verificação de identidade falsa | A antiga promessa sem análise real foi removida. O selo voltou somente no novo fluxo do item 23: selfie, documento frente/verso, análise por administrador e selo concedido exclusivamente após aprovação. Isso ainda não equivale a prova legal de identidade nem possui prova de vida automatizada. | Configurar o bucket privado e as variáveis no backend, aplicar a migration e validar o processo com documentos fictícios de teste antes de liberar. |
| 2 | 🟢 | Exposição da localização das atividades | Detalhes e exportação da rota exigem o proprietário; comparação exige que as duas atividades pertençam ao usuário; heatmap exige login e devolve apenas células agregadas com pelo menos três atividades; a live pública exige token também no WebSocket. | Acrescentar pentest/E2E de acesso cruzado no ambiente publicado. |
| 3 | 🟢 | Entrada não autorizada em salas de chat | `joinChat` e `typing` consultam o match e recusam um terceiro usuário antes de entrar ou emitir eventos na sala. Há teste automatizado do bloqueio. | Repetir o cenário E2E contra o deploy. |
| 4 | ⚫ | Stripe apresentado sem pagamento real | Tela, navegação, publicidade e módulo ativo de assinatura foram removidos. | Só restaurar depois de checkout, webhook assinado, idempotência e confirmação server-side reais. |
| 5 | ⚫ | Premium sem controle de acesso | Planos, badges e chamadas de upgrade foram retirados; o app não promete Premium enquanto não existe entitlement real. | Criar autorização de entitlement no backend antes de reativar qualquer plano. |
| 6 | 🟡 | Recuperação de senha sem entrega do token | Existe link de uso único, expiração de uma hora, tela web de nova senha e revogação de todas as sessões após redefinição. A entrega depende do Resend configurado no ambiente publicado. | Configurar `RESEND_API_KEY`, `EMAIL_FROM` e domínio remetente; executar teste real de entrega e expiração. |
| 7 | 🟡 | Sessões, refresh token, logout e onboarding | Access token curto, refresh rotativo por família, detecção de reutilização, renovação automática no cliente, revogação no logout e correção do falso sucesso do onboarding foram implementados. | Aplicar migrations e validar expiração, reutilização e logout em dois aparelhos/navegadores. |
| 8 | 🔵 | Mídias em disco efêmero | Mantido por decisão de continuar nas hospedagens gratuitas atuais. Stories e mídias ainda podem desaparecer após restart/redeploy. | Migrar para storage externo com faixa gratuita quando possível. |
| 9 | 🟡 | Live tracking quebrado | API e endereço público configuráveis, token enviado pelo observador no WebSocket e preferência de compartilhamento repassada ao tracking. | Definir `PUBLIC_WEB_URL`/`FRONTEND_URL` e testar em duas redes após deploy. |
| 10 | 🟢 | Perda dos últimos pontos GPS | A finalização aguarda o flush, envia a cópia local, reconcilia por timestamp sem duplicar e restaura o buffer se a persistência falhar. Coberto por teste. | Fazer teste de campo com sinal instável. |
| 11 | 🟢 | Duração inclui contagem regressiva, pausas e “duas atividades” novas | A atividade nasce após o countdown, o tempo ativo desconta pausas, os eventos preservam seus horários e o histórico paginado não é mais interpretado como duas atividades em uma conta nova. | Validar uma sessão longa com várias pausas no deploy. |
| 12 | 🟡 | Auto-pausa não pausa realmente | Pausas manual e automática agora congelam tempo e pontos, são persistidas e criam um novo trecho ao retomar. O comportamento lógico está validado; limiares dependem do aparelho e do esporte. | Calibrar velocidade e tempo em testes reais de rua. |
| 13 | 🟡 | Tracking em segundo plano inexistente | Task nativa, fila local durável, restauração, foreground service Android e modo background iOS foram implementados com fallback para foreground. Expo Go não cobre o funcionamento integral. | Gerar development/store build e testar Android/iOS físicos com tela bloqueada. |
| 14 | 🟢 | Metas rápidas simuladas | Sem criar nova tabela: a meta usa colunas na atividade existente. Corrida/ciclismo recebem meta em distância; academia recebe meta em duração; o progresso é restaurado, alertado e persistido. | Aplicar a migration `1782300000000` e validar uma meta de cada tipo no aparelho. |
| 15 | ⚫ | Sensor Bluetooth placeholder | Todo o acesso/convite visível para sensor BLE foi ocultado por enquanto. | Só reativar com integração BLE real, lista de compatibilidade e testes. |
| 16 | ⚫ | Coach de áudio silencioso | Coach de áudio, o serviço silencioso e a falsa ação de leitura foram removidos; feedback tátil útil foi mantido. | Só restaurar com pacote, preferências, idioma, volume e fallback acessível realmente testados. |
| 17 | 🟢 | Calorias, voltas, elevação e unidade incorretas | Calorias usam esporte, duração e peso real do perfil; altura só serve como estimativa conservadora quando o peso falta. Elevação e voltas são filtradas e persistidas. Academia prioriza tempo; corrida/ciclismo priorizam quilômetros. | Aplicar migration e comparar com sessões controladas em aparelho físico. |
| 18 | 🟢 | Recordes pessoais não funcionam | Foi criado `/activities/records`; resumo e histórico identificam primeiro recorde/novo recorde usando distância/ritmo para esportes de rota e duração para academia. | Adicionar mais modalidades quando suas regras esportivas forem definidas. |
| 19 | 🟢 | Notificações vazias, repetitivas ou sem navegação | Contrato `body` foi padronizado, tipos abrem a tela correspondente e conclusões variam de forma coerente por atividade, duração, resultado e meta. | Avaliar a variedade com uso real e ajustar textos sem mudar a lógica. |
| 20 | 🟢 | Preferências de notificação e tema não persistem | Preferências são salvas no backend e bloqueiam push/in-app quando desativadas. Claro/escuro é persistido localmente e na conta, inclusive após novo login. | Aplicar a migration `1782400000000`; testar sincronização entre dois dispositivos. |
| 21 | 🔴 | Push de produção na versão web | Notificação interna e push nativo Expo têm base funcional, mas o web app ainda não possui Web Push completo (service worker de push, VAPID, subscription e receipts). Portanto, não há garantia de aviso com o navegador fechado. | Implementar Web Push real ou ocultar/descrever o switch como “push no aplicativo instalado” na web. |
| 22 | 🟢 | Safety Center chama ponto estático de “ao vivo” | Escolhida a alternativa segura e honesta: textos e acessibilidade agora dizem “localização atual”. Não se promete atualização contínua inexistente. | Se houver live de segurança no futuro, criar sessão temporária, consentimento, expiração e revogação. |
| 23 | 🟡 | Denúncias, administração, verificação e comentários do Feed | Denúncia de post deixou de simular sucesso; denúncias de conta não causam banimento automático; painel exclusivo de `isAdmin` lista contas/posts/pedidos e permite descartar, desativar/remover e aprovar/recusar. Documentos são reencodados sem EXIF/GPS, ficam em bucket privado, usam URL assinada de 5 minutos sem cache e são apagados após decisão. Ações admin são auditadas. O feed mostra selo real; comentários estão montados e agora aceitam menções registradas e reações persistentes. | Executar o SQL de configuração, preencher as variáveis somente no backend, aplicar `1782500000000`, testar o fluxo completo e realizar revisão operacional/LGPD antes da liberação. |
| 24 | 🟡 | Chat com presença falsa e entrega não confiável | Mensagens e autorização de salas funcionam, mas “online agora”, acknowledgements e outbox/retry completo para mídia ainda não representam garantia real de entrega. | Implementar presença com TTL, ack idempotente e fila durável. |
| 25 | 🔴 | Conquistas praticamente inoperantes | Parte das regras não existe e a verificação não é acionada de forma confiável, apesar de a função aparecer ao usuário. | Processar conquistas por eventos do backend e testar cada regra. |
| 26 | ⚪ | Missões diárias desconectadas | Existe código de componente, mas não há integração completa de montagem, persistência ou recompensa confirmada. | Definir modelo de missão/progresso e só então expor na navegação. |
| 27 | 🟡 | XP e níveis inconsistentes | Há cálculos funcionais, mas backend e mobile ainda podem divergir e produzir níveis distintos. | Tornar o backend a única fonte de verdade e versionar a regra. |
| 28 | 🔴 | Territórios e prêmios manipuláveis | Coordenadas ainda podem ser confiadas ao cliente e prêmios são decorativos, embora o módulo sugira competição real. | Aceitar apenas atividades GPS validadas e implementar temporada/premiação server-side. |
| 29 | 🔴 | Segmentos e KOM manipuláveis | Tempos manuais/geometria insuficiente permitem ranking não confiável. | Gerar esforços apenas de rotas GPS elegíveis, com detecção de anomalia. |
| 30 | 🔴 | Desafios sem validação esportiva | Resultado pode ser autodeclarado e expiração não é concluída de forma confiável. | Apurar atividades elegíveis no servidor e criar job idempotente de encerramento. |
| 31 | 🟡 | Locais esportivos fictícios no mapa | Em 06/09/2026, substituídos por consulta autenticada de academias cadastradas no OpenStreetMap via Overpass. Até 100 resultados em 5 km, nome/endereço disponível, fonte e rota; estados de carregamento, vazio e falha sem locais inventados. | Publicar backend e frontend e conferir no celular. Cobertura depende dos cadastros OSM; demais tipos de locais continuam ocultos. |
| 32 | 🔴 | Planejador descarta a rota ao iniciar | A rota planejada não acompanha o tracking, apesar de a interface sugerir que será seguida. | Persistir e repassar geometria, orientação e estado de desvio. |
| 33 | 🟡 | Planos de treino são calendário estático | O calendário aparece, mas ainda não registra conclusão, vínculo com atividade ou adaptação. | Criar sessões de treino e progresso sincronizado. |
| 34 | 🟡 | “IA Coach” é regra fixa | Algumas sugestões funcionam, porém o nome “IA” promete mais do que a implementação determinística entrega. | Renomear para “Insights” ou implementar IA real com limites e ações verificáveis. |
| 35 | 🔴 | Seguir, adicionar usuário e ranking de amigos desconectados | “Adicionar” pode produzir like/match, enquanto follow e ranking não refletem a mesma relação. | Separar os conceitos e tornar cada botão semanticamente correto. |
| 36 | 🟡 | Descoberta e Super Like incompletos | Swipe/match básico existe, mas descartes não reciclam e Super Like não possui consequência especial confiável. | Definir expiração de swipe e comportamento server-side do Super Like. |
| 37 | 🟡 | Stories com upload e interação frágeis | Parte do fluxo existe; pasta, preview, MIME, likes e limpeza ainda podem falhar, somados ao storage efêmero do item 8. | Corrigir upload/player, likes idempotentes e limpeza agendada. |
| 38 | 🔴 | Estatísticas exibem números/unidades incorretos | Ainda existem propriedades e unidades incompatíveis em módulos estatísticos fora das métricas corrigidas nos itens 17/18. | Criar um DTO único com unidade explícita e teste de contrato por tela. |
| 39 | 🟡 | Grupos privados e administração incompletos | Grupos básicos existem, mas código de convite não pode ser informado adequadamente e não há transferência segura de admin. | Criar entrada por código/deep link e transferência confirmada. |
| 40 | 🟡 | Eventos com risco de lotação incorreta | Fluxo principal existe; capacidade não é atômica e lembretes/deep links são incompletos. | Usar transação/lock ou update condicional e implementar lembretes. |
| 41 | 🟡 | Tema, acessibilidade e recuperação de erro parciais | A persistência claro/escuro foi corrigida e coach falso foi ocultado, mas tokens visuais, acessibilidade e recuperação de erro ainda não são globais. | Auditar todas as telas, contraste, leitor de tela e recuperação nativa. |
| 42 | 🟡 | Infraestrutura, banco, dependências e testes frágeis | Build/testes aumentaram, `express` virou dependência direta, migrations foram adicionadas e `DB_SYNCHRONIZE=false` foi definido no Render. Ainda faltam E2E, auditoria de dependências com rede, staging, backup/restore e monitoramento operacional. | Criar ambiente de staging, rodar migrations ensaiadas, `npm audit`, E2E de segurança e teste de restauração. |

## Resumo por cor

- 🟢 **10 resolvidos no código:** 2, 3, 10, 11, 14, 17, 18, 19, 20 e 22.
- 🟡 **18 parciais/condicionados:** 1, 6, 7, 9, 12, 13, 23, 24, 27, 31, 33, 34, 36, 37, 39, 40, 41 e 42.
- 🔴 **8 ainda não funcionam como prometido:** 21, 25, 28, 29, 30, 32, 35 e 38.
- ⚪ **1 não iniciado e não deve ser anunciado:** 26.
- ⚫ **4 removidos/ocultos:** 4, 5, 15 e 16.
- 🔵 **1 adiado conscientemente:** 8.

Os itens 14–23 solicitados nesta etapa foram tratados. Os itens 14, 17, 18, 19, 20 e 22 estão concluídos no código; 15 e 16 foram ocultados; 21 permanece incompleto na web por decisão pendente; 23 está implementado, mas fica amarelo até receber infraestrutura privada, migration, deploy e teste operacional. O item 1 foi substituído — não reativado como simulação — pelo fluxo seguro do item 23.

## Segurança — avaliação honesta

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
