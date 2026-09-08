# Gamificação v1 — 08/09/2026

Implementa itens 26, 27 e 30 do plano na raiz. Não altera o nível esportivo declarado (`beginner`/`intermediate`/`advanced`): nível de XP é separado.

## Regras

- Até 100 XP por dia, incluindo atividades (2 XP por minuto inteiro, máximo 40 por atividade), missões (até 20 cada) e desafios (até 20 por participante). Se faltam 5 XP para o teto, uma recompensa de 20 credita somente 5; o restante não acumula para amanhã.
- Um nível a cada 500 XP. Sem perda por descanso, multiplicador por sequência ou competição por velocidade. Continuar treinando após atingir o teto não perde atividades.
- Dia fixo em `America/Sao_Paulo`, definido pelo servidor. Atividade que atravessa meia-noite conta no dia em que termina; trocar fuso do celular não muda o teto.
- Catálogo de 45 objetivos, seleção estável por UUID/dia e esportes; de uma a três missões, com objetivo universal. A mesma atividade pode avançar mais de uma missão. A seleção do dia fica congelada no ledger: alterar o perfil não sorteia de novo.
- Somente atividades concluídas iniciadas após a ativação da regra contam. Tempo limitado pelo intervalo real e pausas. Atividades sobrepostas não recebem crédito duplo. Caminhada/corrida/trilha/ciclismo precisam de distância plausível; velocidades médias impossíveis são rejeitadas para recompensa. GPS falso e cronômetro ligado sem exercício não podem ser eliminados totalmente em web apps.
- Desafios: matches sem bloqueio, aceite explícito, até 3 convites/desafios ativos por pessoa, duração 5/10/15 min ou caminhada/corrida/trilha 0,5/1/1,5/2 km ou ciclismo 1/2/3 km. Prazo 1/3/7 dias a partir do convite. Cada pessoa cumpre o seu objetivo; sem vencedor por rapidez. Só contam atividades iniciadas após o aceite e terminadas antes do prazo. Expiração não retira o XP já ganho por quem cumpriu.
- Conquistas continuam sendo medalhas (item 25 ainda pendente), sem prometer novo XP à parte do teto. O saldo legado previamente mostrado pela API de conquistas é preservado uma vez, pelo maior entre esse saldo e `users.totalXP`. Estimativas locais antigas por estatísticas não eram saldo persistido e não são convertidas.

## Implantação / instalação do zero

Migration `1788900000000-Gamification.ts`: cria `gamification_rewards`, adiciona `users.gamificationStartedAt` e `challenges.acceptedAt/ruleVersion`. Em produção, o backend com `DB_SYNCHRONIZE=false` aplica migrations no início, conforme configuração existente. A migration depende das tabelas-base e migrations anteriores. Em instalação nova, seguir primeiro o procedimento da base no README.

**Atenção:** desafios legados pendentes/aceitos são expirados pela migration porque permitiam metas livres e autodeclaração. Histórico concluído é preservado. Não reeditar a migration já aplicada para reabrir desafios antigos.

Sem nova chave ou serviço pago. A tabela nova tem RLS habilitado sem políticas para clientes diretos: somente o papel de banco do backend, proprietário/BYPASSRLS, deve operar o ledger. Não expor a credencial do backend no frontend. Não habilitar escrita pública em `users.totalXP` ou `gamificationStartedAt`.

## Segurança e testes

- API autenticada, DTOs com whitelist e rejeição de campos extras, UUIDs e metas validados, rate limit, proibição de conclusão manual e seleção mínima dos dados do outro participante (id/nome/avatar).
- Transação com lock PostgreSQL por usuário, chave única `(user_id,source)`, crédito zero registrado mesmo no teto, uma fonte única para recuperar reenvios sem duplicação. Ledger só contém totais e horários, não rotas/CPF/documentos. Exclusão definitiva do usuário remove ledger por FK CASCADE.
- Limite diário é regra de incentivo, não prescrição de exercício. Não há garantia de 100% de segurança, nem prova de atividade física humana. Auditoria/pentest do site inteiro e teste de campo continuam pendentes (item 42).
- Testes Jest: `node node_modules/jest/bin/jest.js --runInBand` no backend e mobile. TypeScript e builds também devem passar.
- Integração isolada PostgreSQL/WASM: instalar `@electric-sql/pglite` numa pasta temporária e rodar `node -r ts-node/register scripts/check-gamification.cjs <caminho-absoluto-do-pacote-pglite>`. O script não lê `.env` e não acessa bancos remotos; usa tabelas representativas, testa a migration real duas vezes, apuração/transações, cap/retry, aceite/conclusão/expiração, terceiros/bloqueios, preservação de XP e RLS. Também carrega os metadados reais das entidades. Como PGlite só tem uma conexão, isso não substitui carga concorrente multi-processo em PostgreSQL de staging.

## Verificação manual pós-deploy

1. Abrir Perfil: conferir XP/nível e missões; sair/entrar e alterar tema não devem mudar o sorteio.
2. Registrar atividade curta compatível, finalizar e reabrir o perfil. Verificar tempo sem pausas, progresso e XP. Recarregar não pode creditar de novo.
3. Com duas contas conectadas por match, enviar desafio curto; aceitar na outra conta. Treino anterior ao aceite não conta. Concluir com ambas e verificar histórico sem vencedor.
4. Atingir o teto: XP diário não passa de 100, mas as atividades continuam no histórico. Conferir também falha de conexão e reenvio da finalização.
5. Testar recusa, expiração, bloqueio de usuário e troca do dia de Brasília. Comparar nível entre Perfil, Conquistas e Estatísticas.

## Limitações operacionais

Reconciliação acontece na finalização, nas leituras autenticadas de progresso/desafios e no job de expiração a cada minuto. Hospedagem gratuita suspensa pode atrasar o job; ao voltar, ele retoma. Máximo de 500 atividades pendentes por reconciliação e 100 desafios por listagem. O ledger é carregado por conta; monitorar crescimento e otimizar com agregados/arquivo antes de grande escala. Falhas na apuração não removem a atividade já salva; repetir a finalização ou abrir o progresso reconcilia.
