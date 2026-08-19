# Sync Mobile Design System Notes

Este arquivo existe para facilitar futuras mudanças visuais no app: cores, logos, imagens, modo claro/escuro e telas que ainda podem precisar de revisão.

## Fontes Principais

- `src/theme/colors.ts`
  - Fonte principal das cores do app.
  - Altere `darkTheme` e `lightTheme` para mudar fundo, cards, textos, bordas, acentos e gradientes.
  - Preferir sempre `theme.primary`, `theme.background`, `theme.surface`, `theme.border`, `theme.textPrimary`, `theme.textSecondary`, `theme.gradientPrimary`.

- `src/store/themeStore.ts`
  - Controla o modo atual (`dark` ou `light`) e salva a preferência do usuário.
  - Use `useThemeStore((s) => s.theme)` em telas/componentes que precisam seguir o tema.

- `src/theme/images.ts`
  - Centraliza imagens remotas usadas em telas de auth ou headers antigos.
  - Evite colocar imagem diretamente na tela. Se precisar trocar uma imagem global, prefira alterar aqui.

- `src/assets/images/`
  - `sync-logo-dark.png`: logo azul/ciano usada no modo escuro.
  - `sync-logo-light.png`: logo coral/roxo/laranja usada no modo claro e favicon web.
  - `icon.png`: icone antigo ainda pode ser usado para app icon/adaptive icon.

- `src/components/Logo.tsx`
  - Componente único para renderizar a logo dentro do app.
  - Trocar este componente afeta praticamente todas as logos internas.

- `app.json`
  - Configura nome do app, splash, favicon web, tema web e ícones nativos.
  - `expo.web.favicon` atualmente aponta para `sync-logo-light.png`.

## Mudanças Recentes De Layout

- Feed
  - Arquivo: `src/screens/Feed/FeedScreen.tsx`
  - O header deixou de usar foto de pessoas correndo.
  - Agora usa um card compacto com botao de menu, logo, titulo, busca, notificacoes e linha de acento azul/ciano.
  - Os posts usam chip pequeno de distancia (`distanceChip`) em vez do bloco grande antigo, e o esporte exibido vem de `SPORT_LABELS`.
  - Para alterar o topo do Feed, procure por `header`, `headerLeft`, `headerBrand`, `headerAccent` e `headerWatermark`.

- Perfil / Dias consecutivos
  - Arquivo principal: `src/screens/Profile/MyProfileScreen.tsx`
  - O header do perfil usa foto de capa, logo central em aro azul, botao de voltar, botao de editar e camera para trocar capa.
  - O card de sequencia/meta do perfil fica em `profileGoalCard` e usa `theme.surface`, `theme.border`, `theme.primary`, `theme.primarySoft`.
  - `src/components/StreakBadge.tsx` ainda existe para outros pontos que precisem do badge reutilizavel.

- Treino ativo e resumo
  - Arquivos:
    - `src/screens/Tracking/ActiveTrackingScreen.tsx`
    - `src/screens/Tracking/ActivitySummaryScreen.tsx`
  - Foram trocadas cores antigas fixas por tokens do tema.
  - Ainda pode existir alguma cor hardcoded em estilos de mapa, marcadores e estados especiais.

- Avaliação pós-treino
  - Arquivo: `src/components/PostWorkoutRatingModal.tsx`
  - Modal "Como foi seu treino?" agora usa tokens de tema em cards, botoes, input e acao principal.

- Grupos
  - Arquivo: `src/screens/Groups/GroupsScreen.tsx`
  - Tabs receberam espaçamento superior e divisor do header usa `theme.divider`.

- Favicon / guia da web
  - Arquivo: `app.json`
  - `web.favicon` aponta para `./src/assets/images/sync-logo-light.png`.
  - Navegadores cacheiam favicon agressivamente; testar com Ctrl+F5 ou aba anonima.

- Landing web inicial
  - Arquivo: `src/screens/Auth/StravaLandingWeb.tsx`
  - Tela inicial desktop/web antes do login.
  - Usa visual proprio em modo escuro, com logo grande, mock cards, recursos, passos, planos e comunidade.
  - Para mudar textos ou blocos da landing, procure por `INSIGHTS`, `FEATURES`, `STEPS`, `PLANS` e `TESTIMONIALS`.
  - Para mudar a paleta da landing, ajuste as constantes `BG`, `SURFACE`, `BORDER`, `BLUE`, `CYAN` e `GREEN` no topo do arquivo.

## Regras Para Futuras Mudanças

- Evite usar cores fixas como `#FF6B35`, `#0A0A0F`, `#fff` em telas comuns.
- Use cores fixas apenas quando forem semânticas ou externas, por exemplo:
  - estrela/recorde: amarelo (`theme.warning` preferencialmente)
  - erro: `theme.danger`
  - sucesso: `theme.success`
  - mapa: estilos próprios podem manter cores específicas.

- Para botões principais:
  - Use `theme.gradientPrimary` quando for ação principal.
  - Use `theme.primary` para estado ativo.
  - Use `theme.primaryText` para texto em cima de `theme.primary`.

- Para cards:
  - Fundo: `theme.surface`
  - Fundo interno/leve: `theme.surfaceSecondary`
  - Borda: `theme.border`
  - Texto forte: `theme.textPrimary`
  - Texto auxiliar: `theme.textSecondary`

- Para inputs:
  - Fundo: `theme.input`
  - Borda: `theme.border`
  - Texto: `theme.textPrimary`
  - Placeholder: `theme.placeholder`

## Pontos Que Podem Ser Revisados Depois

- `src/screens/Challenges/ChallengesScreen.tsx`
  - Ainda parece conter muitos `#FF6B35` e fundos fixos.

- `src/screens/Training/TrainingPlanScreen.tsx`
  - Tem bastante cor escura fixa e pode precisar de ajuste para modo claro.

- `src/components/PostWorkoutRatingModal.tsx`
  - Já foi revisado, mas as cores especificas de tipos de treino e escala de dor continuam semânticas.

- `src/components/StoriesBar.tsx`
  - Ainda usa gradientes antigos em alguns pontos.

- `src/components/BestTimeWidget.tsx`, `TodayBriefWidget.tsx`, `XPBar.tsx`
  - Podem conter acentos laranja antigos.

- `src/screens/Auth/LoginScreen.tsx` e `src/screens/Auth/RegisterScreen.tsx`
  - Ainda usam imagens hero de corrida. Se quiser uma identidade mais abstrata/brand, revisar estas telas.

## Como Fazer Uma Revisao Rapida

Use buscas assim:

```bash
rg "#FF6B35|#FF4500|#0A0A0F|rgba\\(255,107,53|colors.dark" mobile/src
```

Depois substitua por tokens de tema quando fizer sentido:

```tsx
const theme = useThemeStore((s) => s.theme);

backgroundColor: theme.surface
borderColor: theme.border
color: theme.textPrimary
colors={theme.gradientPrimary}
```

## Checklist Antes De Commitar Layout

- Rodar `cmd /c npm run typecheck` dentro de `mobile`.
- Conferir modo claro e escuro.
- Conferir textos pequenos em cards, tabs e botoes.
- Evitar card dentro de card quando for apenas secao de pagina.
- Fazer commits pequenos por tela ou area visual.
