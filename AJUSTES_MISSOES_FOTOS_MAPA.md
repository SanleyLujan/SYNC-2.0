# Missões diárias, fotos do perfil e entrada do mapa

## O que muda

- Missões: catálogo pré-cadastrado com rotação por conta e dia, sem repetir o mesmo objetivo em dias consecutivos quando as modalidades permanecem iguais. A renovação ocorre à meia-noite de Brasília, sem apagar o XP acumulado.
- Conclusão: calculada a partir das atividades válidas da própria conta, concluídas naquele dia. Um marcador antigo de recompensa sozinho não marca a missão como feita. A tela descarta os dados ao trocar de conta ou vencer o prazo informado pelo servidor, inclusive ao voltar do segundo plano.
- Fotos: a galeria cadastrada aparece nos cartões do Descobrir e no perfil público. Toque nas laterais do cartão para navegar; use **Ver perfil** para abrir o perfil. No perfil público, toque nas miniaturas para ampliar.
- Edição: **Perfil → ícone da câmera → Editar fotos do perfil** permite adicionar, trocar, remover e escolher a primeira foto. Mantém a regra existente de 3 a 5 fotos. Capa e avatar têm controles separados.
- Mapa: aproximação suave de cerca de um nível de zoom em 1,1 segundo, uma vez por entrada na tela. Web e Android aguardam o carregamento do mapa; Apple Maps usa uma breve espera após o início da renderização, pois o adaptador não oferece o mesmo evento. A animação respeita redução de movimento e não interrompe a interação nem o planejamento de rota.

## Publicação

1. Publique o backend atualizado no Render e depois o frontend na Vercel.
2. Estes três ajustes não exigem novas variáveis de ambiente, buckets ou migrations. A verificação documental tem configuração separada em `VERIFICACAO_DOCUMENTOS_DEPLOY.md`.
3. Faça os testes abaixo em ambiente de teste, usando duas contas e imagens não sensíveis.

## Roteiro de conferência

1. Entre com uma conta sem atividades no dia: nenhuma missão deve estar concluída. Troque para outra conta e confira que não há progresso herdado.
2. Termine uma atividade válida compatível com uma missão. Confira o progresso e abra novamente a tela: o XP não deve ser concedido duas vezes.
3. Confira a virada à meia-noite de Brasília com a tela aberta e depois de voltar do segundo plano. O conjunto muda e o progresso do novo dia começa sem as atividades anteriores; o XP total permanece.
4. Troque e reordene fotos, salve e reabra o editor. Em outra conta, atualize o Descobrir e abra o perfil para conferir a ordem e a ampliação. Confirme que capa e avatar existentes não foram alterados.
5. Abra o mapa com localização permitida. Aguarde os blocos do mapa carregarem e observe a aproximação. Repita tocando no mapa antes do carregamento e com redução de movimento ativada: não deve haver aproximação automática.

Os testes automatizados cobrem regras, isolamento, expiração e virada de dia, além da seleção e ordem das fotos. A inspeção local não acessou a conta do professor Santiago nem confirmou o histórico específico relatado em produção. O teste visual final em dispositivos e o teste entre contas após publicação ainda são necessários.
