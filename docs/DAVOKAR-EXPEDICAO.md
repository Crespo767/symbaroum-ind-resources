# Nova expedição em Davokar

## Plano técnico

1. Conferir o capítulo 12 do Guia do Mestre PT-BR e as referências cruzadas. Testar cálculo de alvo, requisitos, margem, modificadores, detecção e encaminhamentos isoladamente.
2. Integrar as RollTables instaladas, testando fórmulas, limites, tabelas ausentes e entradas personalizadas. Usar os documentos oficiais do usuário, sem distribuir novas cópias dos textos.
3. Guardar o estado em um diário de mundo acessível somente ao Mestre. Serializar operações no GM ativo, validar autoria e revisão, gravar o resultado antes de publicar no chat e manter histórico por dia.
4. Integrar a aba à ficha de Grupo. Permitir configuração pelo Mestre, teste autorizado pelo dono do guia, orientação, Infortúnios, eventos, encaminhamentos e consulta ao histórico.
5. Testar as regras, o contrato com Foundry, as permissões e a integração. Conferir idiomas, compilação do template, sintaxe e a suíte completa. Registrar separadamente o que foi testado num mundo Foundry real.

A nova implementação usa a branch feature/davokar-expeditions. O calendário e os dados legados de expedição ficam independentes da aba nova.

## Referências da regra

Páginas impressas. No Guia do Mestre PT-BR v1.0 e no Códice de Monstros PT-BR v1.0, a página do PDF é a impressa + 1. No Livro Básico consultado é a impressa − 1, e no Guia Avançado do Jogador é a impressa + 1.

| Regra | Referência | Representação |
| --- | --- | --- |
| Orientação e Mateiro | Guia do Mestre pp. 91–92, Livro Básico p. 108 | Vigilante de um guia com Mateiro. Iluminada I, Selvagem II e Escura III. Um nível abaixo aplica −3, e I em Escura aplica −5. Sucesso com Mateiro insuficiente apenas evita Infortúnio. Sem Mateiro, a ação de orientação fica indisponível e o GM pode resolver o Infortúnio separadamente. |
| Cartógrafo e Desbravador | Guia do Mestre p. 92 e Guia Avançado do Jogador pp. 52–55 | O GM escolhe até +3 por Cartógrafo quando o guia possui a dádiva. Desbravador concede segunda chance no teste de caminho. Os rótulos localizados do sistema incluem Explorador. |
| Informação, pesquisa e circunstâncias | Guia do Mestre pp. 95–96, Livro Básico p. 154 | Uma fonte de preparação por dia é uma escolha de interface. Informação confiável ou enganosa modifica Orientação em +1 ou −1 e Inimigos e Terreno no sentido oposto. Para pesquisa, o GM seleciona o benefício já verificado naquela região. A redução de −2 não se aplica na Escura. Ajustes circunstanciais são identificados como decisão do GM. |
| Infortúnios | Guia do Mestre pp. 92–94 | 1d20 com +0, +5 ou +10. O resultado 18 abre dois sorteios extras, inclusive se voltar a sair 18. O 25 abre uma rolagem extra de Inimigos. Consequências de fichas, inventário, distância e ficção são resolvidas pelo GM. |
| Eventos e rios | Guia do Mestre pp. 97–99, tabelas 26–29 | Quatro testes separados de 1d20, com modificador regional de 0, +2 ou +5. Rio concede +2 apenas em Terreno. Sucesso elegível dá +2 em Ruínas e −1 em Inimigos e Terreno. Margem de cinco melhora apenas a redução para −2. |
| Procura ativa | Guia do Mestre p. 98, quadro lateral | Opção por dia. Quando adotada, sem procura ou acima da velocidade normal, Ruínas perde +2 de Orientação e recebe −5. As demais tabelas mantêm seus modificadores. |
| Ruínas e detecção | Guia do Mestre pp. 98–99 | A cota máxima da ruína é uma rolagem separada. Num encontro detectável, o PJ ou guia com maior Vigilante testa com o modificador da linha. O GM decide a estratégia do outro grupo quando a detecção falha ou não está disponível. |
| Permanência | Guia do Mestre pp. 98–99 | O GM indica que é o segundo dia ou posterior no mesmo local. Teste do maior Discreto. Falha libera Inimigos por permanência sem desconto de Orientação. A decisão de executar também Inimigos do dia fica explícita. |
| Natureza corrompida | Guia do Mestre p. 99 e Códice de Monstros pp. 74–77 | Os resultados 21–23+ de Terreno liberam 1, 3 ou 5 sorteios na Tabela 2 configurada pelo Mestre. Repetidos são descartados. A identificação da Corrupção Virulenta e a ordem das ondas seguem a entrada da tabela e a decisão do GM. |

### Divergências verificadas

- A Adventure inglesa do GMG traz 1d23 em Ruínas e Terreno e 1d25 em Inimigos. A coluna do Guia do Mestre PT-BR define 1d20 mais modificadores. Para os IDs oficiais, a aba aplica 1d20 e limita o total ao intervalo documentado. Tabelas configuradas pelo GM usam sua própria fórmula.
- A linha 6 da Tabela 27 é +3 para detecção no livro impresso. A Adventure do GMG 2.2.0 instalada informa −1. A automação segue +3 do livro para o documento oficial, e o painel registra o modificador usado. Para uma tabela de encontros personalizada, o GM informa o modificador real.
- O procedimento de permanência libera uma rolagem de Inimigos própria. A interface identifica essa origem para o Mestre decidir como combiná-la com o evento diário.
- A opção nativa do Symbaroum de sucesso no 1 ou críticos controla o alvo e o desfecho do dado. A margem especial da expedição é calculada separadamente.

## Como usar na ficha

1. Abra **Grupo → Expedição → Iniciar expedição**. Escolha o guia e a região, marque as circunstâncias do dia e salve a preparação.
2. Confira o alvo de Orientação e role. A opção de pular registra o dia sem bônus de Orientação. O Mestre pode rolar Infortúnio separadamente nesse caso. Uma falha no teste exige resolver o Infortúnio antes dos eventos do dia.
3. Role as quatro tabelas separadamente. As tabelas oficiais de eventos são buscadas na Adventure instalada ou nas RollTables disponíveis. Para indicar outra tabela, selecione um documento do mundo ou cole o UUID de uma RollTable do compêndio. Tabelas sem reposição ficam disponíveis para uso manual no Foundry.
4. Use os botões liberados para Detecção, Achados, Permanência e rolagens adicionais. Abra a referência da entrada ou registre a resolução na ficha. O Mestre decide como aplicar efeitos em personagens, recursos e cenas.
5. Selecione **Avançar um dia** para arquivar os resultados e iniciar a próxima preparação. **Nova tentativa** preserva a tentativa anterior no histórico.

### Permissões e histórico

O Mestre pode delegar apenas a rolagem de Orientação ao jogador que possui o guia e consegue observar o Grupo. A autorização vale para a preparação atual, exige um Mestre ativo e é revogada se aquele dia mudar ou o teste já tiver sido feito. O modo Somente o Mestre que rolou reserva o teste ao Mestre. O resultado fica privado por padrão. Publicação pública expõe apenas a versão da mensagem preparada para os jogadores.

O Foundry v13 carrega flags de diários e dados de chat nos clientes conectados, inclusive quando a interface oculta o documento. O módulo cifra o histórico e o conteúdo das mensagens privadas com AES-GCM antes de enviar ao servidor. As mensagens públicas usam a rolagem nativa, inclusive a integração com Dice So Nice quando disponível. As privadas exibem o resultado decifrado no chat do Mestre, sem enviar o dado legível ou sua animação pela rede.

O primeiro Mestre a iniciar uma expedição gera uma chave no navegador. Use **Chave do histórico** para guardar uma cópia antes de trocar de navegador, limpar seus dados locais ou passar a condução para outro Mestre. A mesma chave abre todos os Grupos desse mundo. A conexão precisa ser HTTPS ou localhost para acessar a criptografia do navegador.

## Verificação

- A suíte em Node usa dados sintéticos para testar as regras, a persistência, o bloqueio de duplicatas, a autorização e os modos de publicação.
- Para repetir as checagens locais, rode `node tools/validate-syntax.mjs` e `node tools/run-tests.mjs`.
- Para conferir no Foundry, use um mundo de teste separado. Execute um dia como Mestre, recarregue a página e confira o histórico. Entre com um jogador que possua o guia e habilite a delegação. Verifique o botão de Orientação e a ausência de resultados privados na ficha e no chat do jogador.
