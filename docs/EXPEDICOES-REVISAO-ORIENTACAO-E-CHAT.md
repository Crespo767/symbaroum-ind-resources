# Revisão do teste de orientação e do chat

Revisão de 16/10/2026. As correções preservam identidade, compatibilidade e compêndios distribuídos. Preserva os ajustes locais de jornada coletiva e o calendário em desenvolvimento. A revisão integra a versão 0.18.46, preparada a pedido do usuário para teste na nuvem.

## Resultado da conferência

A mecânica principal implementada corresponde ao procedimento de orientação do Guia do Mestre PT-BR, com as ressalvas de integração descritas abaixo. O exemplo enviado pelo usuário está numericamente correto: Vigilante 15, Mateiro II, Davokar Selvagem, alvo 15, resultado 17 = falha. O +2 da região pertence às tabelas de eventos; o +5 pertence à consulta de Infortúnios. Nenhum dos dois é acrescentado ao alvo de orientação desse guia.

Fontes reconferidas: GM pp.92–94, 97–99 e GAJ p.52, além da API pública do sistema Symbaroum 6.1.6 instalado. Foram usadas a extração e as páginas renderizadas preservadas do estudo dos PDFs da mesa; nesta execução a pasta do Drive não estava acessível. Os números de página são impressos. O mapeamento dos PDFs está em [Regras e fontes](EXPEDICOES-REGRAS-E-FONTES.md).

| Mateiro | Iluminada | Selvagem | Escura |
|---|---|---|---|
| Sem Mateiro | Não pode tentar | Não pode tentar | Não pode tentar |
| I | Normal, com benefícios | −3; sucesso apenas evita Infortúnio | −5; sucesso apenas evita Infortúnio |
| II | Normal, com benefícios | Normal, com benefícios | −3; sucesso apenas evita Infortúnio |
| III | Normal, com benefícios | Normal, com benefícios | Normal, com benefícios |

Com nível suficiente, sucesso concede −1 em Inimigos e Terreno; margem de pelo menos cinco melhora para −2. O natural 1 não substitui o critério da margem. Ruínas recebe +2 apenas com busca efetiva; o sucesso habilita um teste posterior do Vigilante elegível para detectar encontros, sem garantir detecção. Falha remove esses benefícios e provoca consulta de Infortúnios: 1d20, 1d20 + 5 ou 1d20 + 10, conforme a região.

Cartógrafo e Dedo Verde são compostos sem repetir os bônus identificáveis já preparados em Vigilante. Desbravador fornece a segunda chance. Informação/mapas e outros fatores específicos podem ser informados pelo GM no modificador circunstancial, sem somá-los duas vezes.

## Correções técnicas

O estado do guia e do pedido era capturado depois da espera pela criação do armazenamento privado. Se o vínculo mudasse durante essa espera, um teste do guia anterior podia ser aceito sob a configuração nova. O estado passa a ser capturado antes da espera e revalidado antes de rolar, publicar e gravar.

A validação também considera o contexto coletivo atual. Mudanças de integrantes ou de outros valores relevantes durante a resolução impedem publicar/gravar um resultado preparado sob outro contexto. Os testes reproduzem essas duas alterações por APIs/documentos simulados.

Continuam preservados o executor GM único, a autenticação do solicitante, a autorização do dono apenas do guia, a fila do Grupo, os modos público/privado/cego/autor e o armazenamento restrito. Não foram registrados novos hooks nem adicionadas gravações durante renderização.

## Cartão e resumo na ficha

- Um cabeçalho com o guia, região real e nível de Mateiro substitui os dois retratos e a seta sem significado mecânico.
- O cálculo lista Vigilante e somente os ajustes pertinentes. Bônus já preparados são identificados como incluídos; limites nativos do alvo aparecem como ajuste do sistema quando alteram a soma.
- Alvo final e resultado ficam separados e destacados. A pedido do usuário, a frase explicativa sobre o alvo e a margem de sucesso foram retiradas do cartão. A margem continua sendo usada internamente para calcular os benefícios.
- As chances aparecem como “usa o menor/maior resultado”, com a origem pertinente, em vez de depender de `kl`/`kh`.
- Consequências ficam em uma lista própria. A busca inativa não promete +2 em Ruínas. Detecção é descrita como outro teste.
- “Desorientado” foi substituído por “Falha”. A falha não significa automaticamente o efeito específico Perdido; a consequência depende do Infortúnio sorteado.
- O cartão informa a fórmula de Infortúnios e remete ao resultado da tabela, sem afirmar antecipadamente que sua publicação já deu certo.
- O resumo da ficha respeita busca inativa e não descreve um resultado desatualizado como se fosse uma falha nova.

As mensagens antigas já gravadas conservam seu HTML. O novo formato é usado em novas rolagens.

## Validação

158 testes focados e 586 testes na suíte completa aprovados, sem falhas ou testes ignorados. Sintaxe validada em 142 módulos JavaScript; idiomas JSON conferidos com 1174 chaves coincidentes; `git diff --check` sem erros. A suíte completa inclui o calendário desenvolvido em paralelo.

O cartão foi renderizado em navegador headless com o CSS do módulo e do sistema instalado. Conferidas larguras de 220, 260, 320 e 400 px, sem transbordamento horizontal nos exemplos de falha e sucesso com busca inativa. Essa prévia é uma página de ensaio, não uma sessão real do Foundry.

## Limites e testes pendentes

- Fome mantém a política existente: impõe o pior de dois dados mesmo com Desbravador. A combinação não ficou explicitada nas fontes consultadas; não é apresentada como conclusão oficial confirmada nem foi alterada globalmente neste lote.
- Efeitos personalizados que não tenham origem identificável ou que modifiquem atributos de forma não aditiva exigem conferência pelo GM; o ajuste circunstancial continua disponível.
- Ausência de guia elegível não gera um teste fictício. A resolução de um dia inteiro sem guia permanece sob condução do GM.
- Chat, Actor e compêndio não formam uma transação única. Um cartão já enviado pode continuar no histórico se uma mudança posterior impedir a gravação; não há reversão automática entre documentos.
- Pendentes sessões reais v13/v14 com GM, jogador, jogador confiável, dois GMs, Dice So Nice ativo/ausente, chat Ilustrado/Legacy, outros temas, tabelas personalizadas e recarga do mundo. Não se declara funcionamento perfeito em runtime com base nos testes locais.

## Distribuição 0.18.46

A árvore de release, com o calendário publicado e sem seu desenvolvimento local posterior, foi validada com 575 testes aprovados. O total local de 586 acima inclui 11 testes de calendário não distribuídos. Os limites de regras e runtime permanecem os registrados nesta revisão.

## Ajuste local posterior — painel e modificador em campo

Mateiro foi movido para a linha de identificação do guia, ao lado de Guia da expedição. O painel da direita passa a seguir a ordem Modificador, Rolar teste e Resultado, mantendo a ação de limpar junto ao resultado.

O campo de texto aceita inteiros com sinal, como `+1` e `-2`, conservando o limite de −20 a +20 já imposto pelo executor. Vazio equivale a zero. O botão normal usa o valor; o diálogo de modificador foi removido. Somente o GM recebe esse campo e somente pedidos de GM podem aplicar modificador diferente de zero.

O valor é um rascunho local da ficha, sem nome de campo no formulário do Actor e sem gravação de flags durante edição/renderização. Sobrevive às renderizações da ficha aberta e reinicia em zero ao mudar dia, guia ou região. Não é restaurado em outra instância da ficha ou após recarregar o mundo. Não altera a regra de orientação nem o tratamento do aviso de contexto alterado.

Validação: 162 testes focados e 590 testes na suíte completa aprovados, sintaxe de 142 módulos e paridade de 1177 chaves de idioma. A prévia usa o template real e foi conferida em 650 e 760 px, com Mateiro na identidade do guia e a ordem vertical correta. Conferidos também o campo ausente para jogador, resultado privado sem pontuação e resultado pendente. Esses ensaios de navegador/documentos simulados não substituem os testes em sessão real do Foundry v13/v14. Ajustes ainda locais, sem novo release.
