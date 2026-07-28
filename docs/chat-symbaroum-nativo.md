# Chat nativo do Symbaroum

Este documento descreve o contrato de regras e comunicacao do chat original do
sistema Symbaroum 6.1.6 instalado localmente para Foundry VTT v13.

O objetivo e separar o que pertence ao sistema de jogo do que e apenas uma
decisao visual do modulo `symbaroum-ind-resources`.

## Fontes principais

- `script/common/roll.js`: calculo de testes, opostos, criticos e resultados.
- `script/common/hooks.js`: settings nativos, hooks de chat, iniciativa e
  integracao com Dice So Nice.
- `script/item.js`: uso de itens, ataques, armas, armaduras, habilidades,
  poderes e rituais.
- `script/actor.js`: dados derivados, dano, protecao, efeitos e valores de
  atributos.
- `script/dialog.js`: dialogos de rolagem e modificadores.
- `template/chat/combat.hbs`: mensagem de ataque e dano.
- `template/chat/ability.hbs`: testes de habilidade, poder e ritual.
- `template/chat/item.hbs`: uso generico de documentos Item.
- `template/chat/roll.hbs`: teste generico de atributo.
- `template/chat/resistButton.hbs`: pedido de resistencia interativo.
- `template/chat/chatInfoMessage.hbs`: aviso simples do sistema.
- `template/chat/death.hbs`: rolagem de morte.

## Ciclo de uma rolagem

1. A ficha ou o Item monta os argumentos do teste.
2. `baseRoll`/`doBaseRoll` calcula a formula, o atributo atuante, o alvo e o
   modificador.
3. O sistema gera um `ChatMessage` contendo o resultado e os metadados do
   fluxo.
4. O Foundry entrega a mensagem aos destinatarios definidos por `whisper`,
   `blind` e pelo modo de rolagem.
5. `renderChatMessageHTML` monta o HTML nativo e conecta botoes de resistencia
   ou aplicacao de efeitos quando a mensagem exige uma segunda etapa.
6. O Dice So Nice pode animar o dado, mas nao e a fonte da regra. O resultado
   valido continua sendo o Roll/ChatMessage do sistema.

O renderer nao deve recalcular o teste. Ele deve apenas apresentar os dados que
ja foram produzidos pelo sistema.

## Contrato do teste

O teste usa `1d20` em condicao normal. Favor e desfavor usam dois d20 e
selecionam o maior ou o menor conforme a regra nativa. O alvo inicial e o valor
do atributo atuante mais o modificador.

Em um teste oposto, o sistema soma ao alvo do atacante o ajuste derivado do
atributo do defensor. A apresentacao equivalente e:

```text
atributo atacante <- atributo defensor
```

O valor numerico e calculado pelo sistema; o texto acima e apenas a forma de
explicar a oposicao.

### Criticos

As regras dependem dos settings nativos:

- `alwaysSucceedOnOne`: trata 1 como sucesso quando ativo.
- `optionalCrit`: habilita criticos opcionais em testes aplicaveis.
- `optionalRareCrit`: habilita a regra de critico raro.
- `critsApplyToAllTests`: permite aplicar a regra de critico fora do combate.

Quando a regra de critico raro esta ativa, um resultado 1 ou 20 pode disparar
uma segunda rolagem. O sistema preserva o primeiro resultado, adiciona o
segundo resultado ao conjunto de rolagens e usa a classificacao resultante para
definir o critico. Portanto, uma interface correta deve mostrar a informacao
completa quando autorizada e nunca substituir silenciosamente o primeiro
resultado por um valor inventado pelo renderer.

### Resultado e dano

Em ataques, o sistema separa:

- teste de ataque contra defesa;
- formula e resultado do dano;
- protecao do alvo;
- dano final aplicado;
- efeitos adicionais, como corrupcao, veneno, sangramento ou fogo.

A protecao e um dado do alvo. Ela pode ser exibida ao GM, mas nao deve ser
exposta ao jogador quando isso revelar informacao da ficha do oponente.

## Fluxos de chat nativos

| Fluxo | Template/Origem | Comportamento exigido |
| --- | --- | --- |
| Ataque | `combat.hbs` | Mostra atacante, alvo, arma, teste, dano e efeitos conforme permissao. |
| Habilidade/poder/ritual | `ability.hbs` | Mostra teste, alvo, resultado, dano/corrupcao e referencias aplicaveis. |
| Item/arma/armadura | `item.hbs` | Publica uso do documento e preserva o vinculo do Item. |
| Atributo | `roll.hbs` | Mostra formula, alvo, modificadores e resultado. |
| Resistencia | `resistButton.hbs` | Cria pedido acionavel para o jogador correto. |
| Aplicar resultados | flag `applyEffects` | Acao interativa normalmente executada pelo GM. |
| Morte | `death.hbs` | Mostra o resultado e a progressao do estado de morte. |
| Informacao do sistema | `chatInfoMessage.hbs` | Texto simples, sem card de regra. |
| Iniciativa | hook `preCreateChatMessage` | Pode ser ocultada pelo setting nativo. |

### Resistencia e aplicacao de efeitos

Quando um ataque ou poder exige resistencia e o botao nativo esta habilitado,
o fluxo e dividido:

1. o sistema publica um pedido direcionado ao jogador que deve resistir;
2. o jogador clica para rolar a resistencia;
3. o sistema cria a rolagem correspondente;
4. o GM pode receber uma acao `applyEffects` para concluir os efeitos;
5. a mensagem de acao e removida ou atualizada conforme o fluxo nativo.

O pedido nao deve ser convertido em uma rolagem automatica para o jogador. O
destinatario precisa ter a oportunidade de clicar.

## Privacidade nativa

A audiencia de uma mensagem e parte da regra do chat, nao da aparencia. Uma
camada visual deve preservar:

- `whisper` para destinatarios especificos;
- `blind` para mensagens cegas ao GM;
- `speaker`, autor, flags, tipo, roll e timestamp;
- pedidos de resistencia somente para o jogador correto;
- resultados privados somente para GM e autor quando essa for a politica;
- mensagens publicas sem incluir valores que o GM marcou como ocultos.

Esconder um elemento com CSS nao e controle de permissao. A mensagem precisa
ser criada com a audiencia correta antes de chegar aos clientes.

## Settings nativos relevantes

Os settings abaixo pertencem ao sistema Symbaroum. O modulo deve le-los e
respeita-los, nao criar copias visuais deles.

| Chave | Escopo | Papel |
| --- | --- | --- |
| `combatAutomation` | mundo | Ativa o fluxo nativo de combate. |
| `playerResistButton` | mundo | Cria botao para o jogador rolar resistencia. |
| `alwaysSucceedOnOne` | mundo | Regra especial para resultado 1. |
| `optionalCrit` | mundo | Criticos opcionais. |
| `optionalRareCrit` | mundo | Criticos raros com segunda rolagem. |
| `critsApplyToAllTests` | mundo | Criticos tambem fora do combate. |
| `optionalMoreRituals` | mundo | Permite a regra adicional de rituais. |
| `saveCombatRoll` | usuario | Guarda configuracoes de rolagem de combate. |
| `saveAttributeRoll` | usuario | Guarda configuracoes de rolagem de atributo. |
| `showModifiersInDialogue` | mundo | Mostra modificadores no dialogo. |
| `showNpcModifiers` | mundo | Mostra modificadores de PNJ. |
| `showNpcAttacks` | mundo | Permite ataques adicionais de PNJ. Requer recarga. |
| `allowShowReference` | mundo | Permite alterar referencias de habilidades e poderes. |
| `hideIniativeRolls` | mundo | Oculta mensagens de iniciativa. |
| `autoRollInitiative` | mundo | Rola iniciativa automaticamente no inicio do combate. |
| `enhancedDeathSaveBonus` | mundo | Aplica bonus de teste de morte a criticos. |
| `manualInitValue` | mundo | Permite escolher manualmente o atributo de iniciativa. |

## Dice So Nice e terceiros

O sistema configura a animacao do Dice So Nice quando a integracao esta
disponivel. Isso nao deve mudar a audiencia nem o resultado da mensagem.

O contrato seguro e:

- gerar o Roll pelo sistema;
- publicar a mensagem com a audiencia correta;
- deixar o Dice So Nice animar o Roll quando presente;
- nao publicar um resultado textual antecipado que contradiga a animacao;
- funcionar sem Dice So Nice, usando o chat nativo.

Modulos como socketlib, libWrapper, Automated Animations e Token Action HUD
sao integracoes opcionais. A ausencia deles nao pode impedir a rolagem nativa.

## Invariantes que qualquer chat visual deve preservar

1. A mesma regra deve produzir o mesmo resultado.
2. O renderer nao pode criar uma segunda rolagem.
3. O renderer nao pode mudar a audiencia da mensagem.
4. O pedido de resistencia deve continuar acionavel.
5. Acoes de GM, como aplicar resultados, devem continuar autorizadas.
6. Links de Item e UUID devem continuar abrindo o documento correto.
7. Conteudo desconhecido deve permanecer no fallback nativo.
8. Mensagens nativas que nao pertencem ao modulo nao devem desaparecer.
9. A ausencia de Dice So Nice nao pode quebrar o chat.
10. O comportamento deve ser avaliado para GM, jogador e jogador confiavel.

