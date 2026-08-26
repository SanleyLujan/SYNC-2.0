# Implementações dos requisitos pendentes

Este arquivo registra, requisito a requisito, o que foi incorporado ao app e as limitações que ainda existem.

## RF05 - Perfil esportivo com hobbies

Status: implementado.

- Backend: adicionado o campo `hobbies` na entidade `User` e no `UpdateProfileDto`.
- Backend: `UsersService.updateProfile` e `completeOnboarding` sanitizam e limitam hobbies antes de salvar.
- Mobile: onboarding ganhou uma etapa própria de hobbies antes de disponibilidade e localização.
- Mobile: `EditProfileScreen` ganhou seleção de hobbies por chips.
- Mobile: `UserProfileScreen` exibe hobbies no perfil público.

Arquivos principais:
- `backend/src/users/entities/user.entity.ts`
- `backend/src/users/dto/update-profile.dto.ts`
- `backend/src/users/users.service.ts`
- `mobile/src/types/index.ts`
- `mobile/src/store/onboardingStore.ts`
- `mobile/src/screens/Onboarding/HobbiesScreen.tsx`
- `mobile/src/screens/Profile/EditProfileScreen.tsx`
- `mobile/src/screens/Profile/UserProfileScreen.tsx`

## RF07 - Configuração de visibilidade

Status: implementado.

- Backend: adicionados `isProfileVisible` e `showLocation` na entidade `User`.
- Backend: perfil público bloqueia acesso quando o perfil está invisível ou inativo.
- Backend: busca, discovery e mapa filtram perfis invisíveis e respeitam a preferência de localização.
- Backend: usuários bloqueados também são excluídos do mapa de proximidade.
- Backend: a exibição no mapa passou a ser privada por padrão, limitada a matches mútuos e com coordenada aproximada.
- Mobile: `SettingsScreen` ganhou switches para controlar visibilidade do perfil e exibição de localização.

Arquivos principais:
- `backend/src/users/entities/user.entity.ts`
- `backend/src/users/dto/update-profile.dto.ts`
- `backend/src/users/users.service.ts`
- `backend/src/matching/matching.service.ts`
- `mobile/src/screens/Settings/SettingsScreen.tsx`

## RF16 - Envio de mídia no chat

Status: implementado para imagem e localização.

- Backend: `SendMessageDto` aceita mensagens `text`, `audio`, `image` e `location`.
- Backend: `ChatService` valida URL para áudio/imagem e JSON de localização antes de persistir.
- Backend: notificações de chat usam prévias específicas para áudio, imagem e localização.
- Mobile: imagens e áudios passam pelo upload multipart antes de serem enviados ao chat.
- Mobile: `ChatRoomScreen` ganhou ações para enviar imagem da galeria e localização atual.
- Mobile: mensagens de imagem e localização têm renderização própria no chat.

Arquivos principais:
- `backend/src/chat/dto/send-message.dto.ts`
- `backend/src/chat/entities/message.entity.ts`
- `backend/src/chat/chat.service.ts`
- `backend/src/chat/chat.gateway.ts`
- `mobile/src/services/socket.service.ts`
- `mobile/src/screens/Chat/ChatRoomScreen.tsx`

## RF23 - Solicitação de entrada em grupos

Status: implementado.

- Backend: criada entidade `GroupJoinRequest` para solicitações pendentes, aprovadas e recusadas.
- Backend: grupo privado sem código válido gera solicitação pendente.
- Backend: endpoint dedicado `POST /api/groups/:id/requests` cria solicitação.
- Backend: detalhe de grupo privado só expõe o código de convite ao próprio admin e permite mostrar metadados para solicitar entrada.
- Mobile: `GroupDetailScreen` mostra “Solicitar entrada” e “Solicitação pendente” para grupo privado.

Arquivos principais:
- `backend/src/groups/entities/group-join-request.entity.ts`
- `backend/src/groups/groups.module.ts`
- `backend/src/groups/groups.service.ts`
- `backend/src/groups/groups.controller.ts`
- `mobile/src/services/groups.service.ts`
- `mobile/src/screens/Groups/GroupDetailScreen.tsx`

## RF24 - Administração de grupos

Status: implementado.

- Backend: admin do grupo lista solicitações pendentes.
- Backend: admin aprova ou recusa solicitações.
- Backend: admin remove participantes comuns do grupo.
- Mobile: `GroupDetailScreen` exibe solicitações pendentes para o admin, com ações aprovar/recusar.
- Mobile: admin vê ação de remover membros comuns na lista de participantes.

Arquivos principais:
- `backend/src/groups/groups.service.ts`
- `backend/src/groups/groups.controller.ts`
- `mobile/src/services/groups.service.ts`
- `mobile/src/screens/Groups/GroupDetailScreen.tsx`

## RF25 - Mapa interativo

Status: parcial, com privacidade e interação implementadas.

- Backend: criado `GET /api/users/nearby` para listar somente matches mútuos que optaram por aparecer.
- Backend: o endpoint respeita perfil invisível, localização oculta, bloqueios e arredonda as coordenadas antes de entregá-las ao cliente.
- Mobile: marcadores de atletas ficam ocultos por padrão e são ativados pelo chip `Atletas`.
- Mobile: marcadores esportivos agora são clicáveis, exibem detalhe e permitem iniciar o planejamento de rota.
- Mobile: o chip `Territórios` abre a tela de conquista corretamente.
- O mapa segue cobrindo eventos, heatmap e planejamento de rotas.

Limitação atual: ainda não existe catálogo real de academias, quadras ou parques. Para considerar o RF25 totalmente concluído, falta integrar uma fonte de locais esportivos ou cadastrar uma entidade própria com dados reais.

Arquivos principais:
- `backend/src/users/users.controller.ts`
- `backend/src/users/users.service.ts`
- `mobile/src/screens/Map/MapMainScreen.tsx`

## Consolidação das últimas observações — fotos, conexões e privacidade

Status: implementado em uma única entrega.

- **Fotos de perfil:** o onboarding oferece `Tirar foto` para abrir a câmera e `Escolher da galeria` para selecionar uma ou mais imagens. As permissões nativas foram configuradas sem solicitar microfone.
- **Conexões:** o Feed e os atletas do mapa ficam restritos ao próprio usuário e a matches mútuos. Likes, comentários e acesso ao feed de outro usuário também são protegidos por essa regra.
- **Busca e adição:** a busca aceita nome ou ID. Cada resultado possui `Adicionar`, que envia um like; antes da reciprocidade aparece como `Enviado` e, depois, como `Match`.
- **Privacidade de localização:** a exibição no mapa é opt-in, desativada por padrão para contas existentes via migration e nunca entrega a coordenada real de outra pessoa.

Observação: o modelo atual não possui um campo separado de `username`; a busca utiliza o nome e o ID do usuário. Os marcadores amarelos continuam sendo pontos esportivos sugeridos pelo app, não um catálogo real de academias, quadras ou parques.

## RF36 - Assinatura premium

Status: parcial, em modo demonstração.

- Backend: criada entidade `SubscriptionTransaction` para registrar checkouts locais de demonstração.
- Backend: adicionados endpoints de checkout local, confirmação e histórico.
- Backend: upgrade/cancelamento atualizam o plano do usuário e validade somente com `SUBSCRIPTION_DEMO=true` fora de produção.
- Mobile: `PremiumScreen` usa o fluxo de demonstração e exibe histórico recente da assinatura.

Limitação atual: Stripe ainda não está integrado. O webhook e o checkout real permanecem bloqueados para evitar que o cliente confirme uma assinatura sem pagamento. Para produção, é necessário integrar o provedor e confirmar o pagamento por webhook assinado.

Arquivos principais:
- `backend/src/subscriptions/subscription-transaction.entity.ts`
- `backend/src/subscriptions/subscriptions.module.ts`
- `backend/src/subscriptions/subscriptions.controller.ts`
- `mobile/src/screens/Premium/PremiumScreen.tsx`

## RF38 - Painel administrativo

Status: implementado como monitoramento protegido.

- Backend: criado `AdminModule` com `GET /api/admin/dashboard`.
- Backend: painel protegido por JWT e `ADMIN_EMAILS`.
- Backend: dashboard retorna métricas gerais, denúncias recentes e feedbacks recentes.
- Mobile: criada tela `AdminPanelScreen`.
- Mobile: configurações têm atalho para o painel administrativo.

Escopo atual: painel somente leitura; ações de moderação e alteração de status ainda não fazem parte desta implementação.

Arquivos principais:
- `backend/src/admin/admin.module.ts`
- `backend/src/admin/admin.controller.ts`
- `backend/src/app.module.ts`
- `mobile/src/screens/Settings/AdminPanelScreen.tsx`

## RF39 - Relatórios administrativos

Status: implementado como relatório agregado.

- Backend: criado `GET /api/admin/reports`.
- Backend: relatório agrega uso, engajamento e segurança em período configurável.
- Mobile: `AdminPanelScreen` mostra o relatório dos últimos 30 dias.

Arquivos principais:
- `backend/src/admin/admin.controller.ts`
- `mobile/src/screens/Settings/AdminPanelScreen.tsx`

## RF40 - Sistema de suporte

Status: implementado para abertura e acompanhamento básico.

- Backend: chamados de suporte recebem protocolo (`protocol`) e status.
- Backend: criado `GET /api/feedback/support/tickets` para o usuário acompanhar chamados.
- Mobile: envio de suporte mostra o protocolo gerado.
- Mobile: criada tela `SupportTicketsScreen` para listar chamados e status.
- Mobile: configurações têm atalho “Meus chamados”.

Escopo atual: ainda não há respostas internas, SLA ou fila de atendimento integrada.

Arquivos principais:
- `backend/src/feedback/feedback.entity.ts`
- `backend/src/feedback/feedback.controller.ts`
- `mobile/src/components/FeedbackModal.tsx`
- `mobile/src/screens/Settings/SupportTicketsScreen.tsx`
- `mobile/src/navigation/stacks/ProfileStack.tsx`
- `mobile/src/screens/Settings/SettingsScreen.tsx`

## Revisão de implantação

- Migration adicionada em `backend/src/migrations/1781900000000-AddRequirementSupportTables.ts` para as colunas e tabelas novas.
- Em produção, mantenha `DB_SYNCHRONIZE=false` e deixe `migrationsRun` executar a migration.
- O painel administrativo exige `ADMIN_EMAILS` com os e-mails autorizados.
- O checkout de demonstração exige `SUBSCRIPTION_DEMO=true` apenas em desenvolvimento local.
- RF25 e RF36 continuam parciais até existirem dados reais de locais esportivos e um provedor de pagamentos com webhook verificado.
