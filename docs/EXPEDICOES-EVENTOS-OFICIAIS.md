# Eventos diários: tabelas oficiais

O passo 3 usa por padrão as RollTables do módulo `symbaroum-gmg`, importadas pela Adventure do Master's Guide. O código reconhece os IDs originais, independentemente da tradução dos nomes:

| Evento | ID oficial |
| --- | --- |
| Ruínas (26) | `WHGv7lMW9JjOic9b` |
| Encontros (27) | `3JXvQNXAGx48h0dA` |
| Inimigos (28) | `dBCs4ljcMtcc8PCq` |
| Terreno (29) | `2QLKnXBZdvEcRNI1` |

A instalação local conferida foi o GMG 2.2.0. Edições com compêndio separado de RollTables também podem fornecer esses documentos. Sem as tabelas importadas, a mensagem orienta o mestre a importar a Adventure ou selecionar uma tabela existente. O IND não fabrica tabelas substitutas.

Seleções antigas que apontam às cópias geradas pelo IND passam a usar o padrão oficial nas próximas rolagens. Documentos existentes no mundo e resultados anteriores são preservados; tabelas personalizadas escolhidas explicitamente continuam disponíveis. Os geradores do IND deixaram de incluir as quatro tabelas diárias; a tabela de Infortúnios permanece fora desta alteração.

O painel omite o número sorteado e o botão de escolher resultado. As fórmulas continuam visíveis para conferência dos modificadores.

O chat usa exclusivamente as mensagens nativas das RollTables selecionadas: `table.roll()` produz o resultado, `table.draw()` formaliza o sorteio e `table.toMessage()` usa o template do Foundry. O botão geral gera uma mensagem por tabela; o botão individual gera somente o resultado daquela tabela. O IND não monta mais um card consolidado nem aplica CSS próprio a essas mensagens. Imagens, links, resultados recursivos, substituição e exibição do dado respeitam a configuração da tabela.

A fórmula base vem da tabela selecionada e recebe os modificadores de região, orientação e busca ativa. Totais modificados fora dos intervalos continuam usando o extremo da tabela, por meio de `min/max` na fórmula nativa; isso evita que um novo sorteio do core altere a distribuição dos eventos. Os resultados usados no chat também são os registrados na ficha.

As seleções são verificadas antes das rolagens. Uma tabela ausente ou sem resultados disponíveis interrompe a operação sem criar tabelas substitutas ou mensagens personalizadas. Mensagens preservam o autor e os destinatários, inclusive quando o executor é outro GM; eventos derivados de orientação privada mantêm seu sigilo. Cada resultado publicado é registrado separadamente para que uma falha posterior não apague os anteriores. Um pedido repetido com revisões antigas é rejeitado.

A integração da detecção foi conferida com os nove intervalos da tabela oficial: o resultado 6 usa −1, corrigindo o +3 que constava no mapeamento anterior do IND.

Validação automatizada: resolução por IDs oficiais, seleções personalizadas, fórmula da tabela selecionada, delegação às APIs nativas, ausência de mensagem agregada, destinatários nos quatro modos, concorrência, estado obsoleto, falhas de armazenamento e preservação de resultados já publicados. Os testes de contrato usam documentos simulados; a API foi conferida no código local do Foundry v13.351.

Validação manual pendente: rolar as quatro tabelas como GM, conferir o que cada jogador recebe nos modos público, privado, cego e direcionado; conferir tradução/Babele, tabelas aninhadas, links, dados inline, Dice So Nice, chat Ilustrado/Legacy e renderização nas versões 13 e 14. Os testes simulados não substituem essa conferência.
