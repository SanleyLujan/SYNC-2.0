# Materiais para atualizar o TCC do SYNC

O texto principal está em [`TCC_ATUALIZACAO_SEGURANCA_WEB.md`](../TCC_ATUALIZACAO_SEGURANCA_WEB.md). Ele reúne o diagnóstico externo, a implementação, os resultados dos testes do projeto, as limitações e um texto-base para redação acadêmica.

A [versão PDF com a figura incorporada](TCC_ATUALIZACAO_SEGURANCA_WEB.pdf) permite encaminhar um único arquivo à pessoa responsável ou à IA. Ela reproduz o texto principal para leitura; o Markdown permanece como fonte editável.

## Figura incluída

- Arquivo: [`figuras/hostedscan-dashboard-20261116.png`](figuras/hostedscan-dashboard-20261116.png).
- Origem: captura fornecida pelo responsável pelo projeto para inclusão na documentação.
- Data exibida no sistema da captura: 16/11/2026; scans recentes marcados como realizados há sete dias.
- Reprodução: original preservado, sem recorte, tratamento ou alteração dos valores.
- Tamanho: 393.003 bytes; dimensões: 1917 × 1198 pixels.
- SHA-256: `9f66a37ebdd85382814f212788933761afdf0cd403111a8842a919bd30261f15`.
- Legenda sugerida: **Painel do HostedScan utilizado na avaliação externa do SYNC.**
- Fonte sugerida: **Captura de tela fornecida pelo responsável pelo projeto (2026).**

O painel mostra 0 críticos, 0 altos, 4 médios, 4 baixos, 0 aceitos e 0 fechados. A figura não comprova uma varredura posterior às correções nem a abrangência das áreas autenticadas. Os 51 domínios descobertos não equivalem a 51 vulnerabilidades ou a 51 domínios pertencentes ao projeto.

Ao usar apenas o Markdown como entrada de uma IA, enviar também a imagem para que ela possa ser analisada e incorporada. Ao clonar o Git, manter os caminhos relativos para a exibição da figura.

## PDF utilizado como base adicional

- Nome: `SYNC_Relatorio_Detalhado_Testes_e_Achados.pdf`.
- Título da capa: **Testes realizados e achados de segurança**.
- Emissão: 16/11/2026; scans: 09/11/2026; 7 páginas.
- Tamanho: 116.585 bytes.
- SHA-256: `1f7151e888e01364ebe7dfd78fd2e1316c8e3f04e5ecff754a8079993faae0db`.

O PDF foi lido integralmente e seus resultados foram sintetizados no texto principal com indicação de páginas. O arquivo original não foi adicionado a este diretório. As fontes S1–S7 citadas nele são documentos e capturas utilizados pelo próprio relatório; não representam sete novas fontes auditadas nesta atualização.

## HostedScan e documentação oficial

O uso do HostedScan no projeto é evidenciado pela captura e confirmado pelo responsável. O serviço reuniu as execuções e os resultados de scanners identificados separadamente no texto. Os recursos gerais descritos no site oficial não comprovam que cada opção tenha sido usada na conta do projeto.

- [Visão da plataforma](https://hostedscan.com/platform).
- [Scanners integrados](https://hostedscan.com/compare).
- [Varreduras autenticadas](https://hostedscan.com/authenticated-web-app-vulnerability-scan).

As páginas oficiais foram consultadas em 16/11/2026. Esta atualização é documental e não executa novos scans ou confirma os deploys da aplicação.
