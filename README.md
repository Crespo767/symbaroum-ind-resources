# Symbaroum Ind Resources

Modulo de recursos, sobrevivencia, combate e qualidade de vida para o sistema
**Symbaroum** no **Foundry VTT**.

O modulo aparece nas configuracoes como **Tenebre Resources**, mas o ID tecnico
do pacote continua sendo `symbaroum-ind-resources`.

---

## Visao Geral

O **Symbaroum Ind Resources** adiciona automacoes opcionais para mesas que querem
controlar melhor alimentacao, fome, munição, aljavas, sobrecarga, recipientes,
movimento, manobras, inventario, dinheiro, condicoes e mensagens de chat.

O objetivo do modulo e manter o fluxo de jogo rapido, legivel e fiel as regras
de Symbaroum, sem obrigar o Mestre a usar todas as funcoes ao mesmo tempo. Quase
tudo pode ser ativado ou desativado nas configuracoes.

<a id="indice-de-funcionalidades"></a>
## Funcionalidades

Esta lista resume os recursos do modulo. Clique em uma funcionalidade para abrir
sua explicacao detalhada:

- [Configuracoes separadas por categoria](#configuracoes)
- [Pao de Viagem e outros alimentos](#pao-de-viagem)
- [Fome e inanicao](#fome)
- [Descanso e recuperacao](#descanso)
- [Cura Herbal e Medico](#cura-herbal-e-medico)
- [Aljavas, recarga e descarga](#aljavas-e-municao)
- [Consumo automatico de municao](#consumo-automatico)
- [Recuperacao de flechas e virotes](#recuperacao-de-municao)
- [Municoes especiais e links no chat](#municoes-especiais)
- [Sobrecarga e pesos por pacote](#sobrecarga)
- [Recipientes e itens guardados](#recipientes)
- [Documentacao tecnica de recipientes](docs/recipientes.md)
- [Estado padrao dos itens no inventario](#estado-padrao-do-inventario)
- [Gerenciador de dinheiro](#gerenciador-de-dinheiro)
- [Condicoes e efeitos do token](#condicoes-e-efeitos-do-token)
- [Limpeza automatica de itens esgotados](#limpeza-automatica-do-inventario)
- [Regua e limites de movimento](#movimento)
- [Sacar, guardar e trocar armas](#sacar-e-guardar-armas)
- [Manobras de combate](#manobras)
- [Chat nativo do Symbaroum](#chat-nativo-do-symbaroum)
- [Rolagens privadas](#rolagem-privada)
- [Pedidos de resistencia](#pedidos-de-resistencia)
- [Catalogo e agrupamento de Ritualista](#catalogo-de-ritualista)
- [Envio de itens, habilidades e rituais ao chat](#envio-de-itens-habilidades-e-rituais-ao-chat)
- [Registro do Mestre](#registro-do-mestre)
- [Macros, tabelas e Gerar Sombra](#macros-e-utilidades)
- [Importador experimental de Journals](#importador-experimental-de-journals)
- [Dice So Nice, Automated Animations e Token Action HUD](#integracoes)
- [Compatibilidade e blindagem contra conflitos](#compatibilidade-e-blindagem)
- [Arquivos de dados editaveis](#arquivos-de-dados-editaveis)

Todos os sistemas de regras sao opcionais. O Mestre pode combinar apenas os
recursos adequados para sua mesa.

---

## Compatibilidade

| Componente | Versao |
| --- | --- |
| Foundry VTT | v13.350 no manifesto; carregamento testado no build 351; adaptacoes tecnicas para v14 |
| Sistema Symbaroum | 6.1.6 |
| Modulo | 0.17.24 |
| Manifest | `https://raw.githubusercontent.com/Crespo767/symbaroum-ind-resources/main/module.json` |
| Download | `https://github.com/Crespo767/symbaroum-ind-resources/releases/latest/download/symbaroum-ind-resources.zip` |

### Dependencia obrigatoria

- `socketlib`

### Dependencia recomendada

- `libWrapper`

`libWrapper` nao e obrigatorio, mas melhora a convivencia quando outros modulos
tambem alteram dialogs, fichas, rolagens, menus ou tokens.

### Modulos opcionais integrados

- `dice-so-nice`: rolagens do modulo aguardam o dado 3D quando disponivel.
- `autoanimations`: itens, habilidades, poderes e rituais enviados ao chat ficam
  detectaveis por Automated Animations.
- `JB2A`: recomendado para animacoes visuais com Automated Animations.
- `token-action-hud-core` e `token-action-hud-symbaroum`: adiciona acoes do
  modulo ao HUD.
- `drag-ruler`: quando ativo, o Tenebre cede a regua propria para evitar conflito.

---

## Instalacao

### Pelo Foundry

1. Abra o Foundry VTT.
2. Va em **Add-on Modules**.
3. Clique em **Install Module**.
4. Cole o manifest:

```text
https://raw.githubusercontent.com/Crespo767/symbaroum-ind-resources/main/module.json
```

5. Ative o modulo dentro do mundo.
6. Ative tambem `socketlib`.

### Manualmente

1. Baixe `symbaroum-ind-resources.zip` na aba de Releases.
2. Extraia para:

```text
FoundryVTT/Data/modules/symbaroum-ind-resources
```

3. O arquivo `module.json` precisa ficar diretamente dentro da pasta
   `symbaroum-ind-resources`, nao dentro de uma subpasta extra.
4. Reinicie o Foundry ou pressione `F5` no mundo.

---

## Configuracoes

As configuracoes ficam em:

```text
Configuracoes de Jogo -> Configure Settings -> Symbaroum Ind Resources / Tenebre Resources
```

Cada categoria abre um formulario independente. As alteracoes passam a valer ao
salvar; fichas, chat, HUD e controles afetados sao atualizados sem exigir F5
sempre que a API do Foundry permite.

### Alimentacao

| Opcao | Efeito |
| --- | --- |
| Ativar Pao de Viagem | Ativa o controle especial de Pao de Viagem / Waybread. |
| Usos por pao | Define quantos dias cada unidade alimenta. Padrao: 7. |
| Usar outros alimentos | Permite transformar itens de comida em suprimentos com usos configuraveis. |
| Alimentos configuraveis | Adiciona, remove, cria e define usos por unidade; itens criados ficam na pasta `Alimentos`. |

### Descanso e Fome

| Opcao | Efeito |
| --- | --- |
| Ativar Fome | Adiciona o efeito Fome e aplica a regra opcional de inanicao. |
| Exibir botao Descanso nas fichas | Adiciona o botao Descanso no cabecalho da ficha. |
| Ativar recuperacao automatica | Recupera Vitalidade pelo descanso. |
| HP/Vitalidade por dia de descanso | Define o valor recuperado por dia. Padrao: 1. |

### Municao

| Opcao | Efeito |
| --- | --- |
| Ativar consumo automatico | Consome munição quando uma arma marcada dispara. |
| Usar aljava carregada | Alterna entre o fluxo de aljavas e o consumo direto de munição avulsa. |
| Capacidade da aljava | Define quantas flechas/virotes cada aljava comporta. |
| Ativar rastreamento de acertos | Registra projeteis que acertaram para recuperacao posterior. |
| Ativar recuperacao | Habilita os testes de recuperacao de projeteis registrados. |
| Recuperacao por tipo/qualidade | Usa alvos diferentes para munição comum, de qualidade e mistica. |
| Recuperacao unica | Define o alvo comum quando a separacao por qualidade estiver desligada. |
| Recuperacao comum | Define o alvo para munição comum. |
| Recuperacao de qualidade | Define o alvo para munição de qualidade. |
| Recuperacao mistica | Define o alvo para munição mistica/alquimica. |
| Exibir botao de recuperacao na HUD | Mostra o contador/botao perto da hotbar. |
| Exibir aljavas na HUD | Mostra aljavas equipadas/ativas e sua carga atual. |
| Exibir municoes especiais no chat | Identifica a munição usada e transforma seu nome em um link clicavel para a ficha do item. |

### Sobrecarga e recipientes

| Opcao | Efeito |
| --- | --- |
| Ativar Sobrecarga | Ativa peso, limites, penalidade de Defesa e imobilizacao. |
| Ativar gerenciamento de recipientes | Ativa guardar, retirar, arrastar, expandir e proteger recipientes com conteudo. |

### Movimento

| Opcao | Efeito |
| --- | --- |
| Ativar regua de movimento | Ativa medicao e validacao de movimento do modulo. |
| Colorir regua por distancia | Colore uma acao, duas acoes e distancia bloqueada. |
| Exibir limites na etiqueta | Mostra distancia medida e limite atual. |
| Bloquear movimento acima do limite | Cancela movimentos acima do permitido durante combate. |
| Aplicar Fome ao movimento | Reduz o movimento de personagens famintos. |
| Aplicar Sobrecarga ao movimento | Aplica imobilizacao por excesso de carga. |
| Aplicar efeitos ao movimento | Respeita efeitos de manobras e flags de movimento. |
| Unidades de movimento | Alterna entre metros e pes. |
| Distancia de um movimento | Define 10 m ou 30 ft por padrao, conforme a unidade escolhida. |

### Combate

| Opcao | Efeito |
| --- | --- |
| Ativar manobras | Mostra e automatiza manobras na ficha. |
| Exibir opcao de rolagem privada | Permite enviar resultado e dados 3D somente aos Mestres em cada rolagem. |
| Ativar Sacar/Guardar Armas | Controla o estado sacado das armas de personagens jogadores e impede ataques com armas guardadas. |
| Exibir botao Sacar/Guardar Armas | Mostra o controle rapido e arrastavel na interface. |
| Exibir indicador no token | Mostra no token quando o personagem possui arma sacada. |
| Ativar animacao ao sacar/guardar | Reproduz o feedback visual opcional durante a troca de armas. |
| Ativar integracao com Automated Animations | Inclui os metadados consumidos pela integracao. |
| Exibir botao Limpar efeitos | Mostra o comando nas fichas com efeitos ativos. |
| Ativar integracao com Token Action HUD | Adiciona as manobras ao HUD quando disponivel. |

### Mensagens no Chat

| Opcao | Efeito |
| --- | --- |
| Mensagens no Chat | Alterna entre os cards originais do sistema e a apresentacao compacta do Ind Resources. |
| Ocultar detalhes de NPC | Na apresentacao compacta, deixa Protecao e dano efetivo de NPC visiveis somente para o Mestre. |
| Exibir mensagens de Sacar/Guardar | Publica no chat as alteracoes de prontidao das armas. |
| Exibir mensagens de condicoes | Publica um card descritivo ao aplicar uma condicao pela janela de efeitos. |

### Utilidades

| Opcao | Efeito |
| --- | --- |
| Ativar catalogo de rituais | Adiciona `Ver Rituais` ao menu da habilidade Ritualista. |
| Agrupar rituais em Ritualista | Transforma Ritualista em uma lista expansivel dos rituais conhecidos. |
| Ativar Registro do Mestre | Adiciona ao chat uma segunda pagina com eventos resumidos somente para usuarios GM. |
| Remover automaticamente itens esgotados | Exclui equipamentos de Actor cuja quantidade alcance zero ou menos. |
| Ativar macros e tabelas de utilidade | Ativa versos, inspiracao, geradores e eventos de floresta. |
| Instalar macro Efeitos do Token | Cria ou reutiliza a macro que abre o seletor pesquisavel de condicoes para o token selecionado. |
| Ativar Gerar Sombra | Exibe o controle Gerar Sombra nas fichas. |
| Ocultar geracao de Sombra | Esconde o comando sem desativar as outras utilidades. |
| Ocultar texto de Sombra | Mantem o comando, mas oculta seu texto visivel. |

---

## Pao de Viagem

O modulo reconhece **Pao de Viagem**, **Waybread** e nomes equivalentes.

Funciona assim:

1. O item pode existir em pilha.
2. Cada unidade possui uma quantidade de usos configuravel.
3. O display aparece como:

```text
4 (28/28)
```

Isso significa 4 unidades e 28 usos totais restantes.

Ao consumir:

- 1 uso e removido.
- Quando uma unidade inteira e consumida, a quantidade baixa automaticamente.
- O chat recebe um card informando quantos usos ainda restam.

### Outros alimentos

O Mestre pode habilitar alimentos adicionais e definir quantos usos cada unidade
fornece. A configuracao oferece uma lista baseada nos itens disponiveis no
Foundry, comandos para adicionar ou remover todos e criacao de alimentos
personalizados.

Ao criar um alimento pelo formulario:

- o modulo cria a pasta de Items **Alimentos**, caso ela ainda nao exista;
- o novo Item e colocado nessa pasta;
- o alimento passa a aparecer na configuracao enquanto o Item existir;
- excluir o Item do mundo remove a opcao correspondente da lista;
- remover um alimento da configuracao interrompe seu tratamento especial, mas
  nao exclui copias que ja estejam nas fichas.

---

## Aljavas e Municao

O fluxo de municao foi desenhado para separar:

- Flechas/virotes avulsos no inventario.
- Flechas/virotes carregados em aljava.
- Municao usada em ataques.
- Municao recuperavel depois de acertos.

### Aljava

- A aljava comporta ate **12 projeteis**.
- Flechas e virotes normalmente sao comprados em pilhas de 10.
- O jogador precisa recarregar a aljava antes de usar a municao em combate.
- Aljavas em estado **Equipado** ou **Ativo** aparecem no ataque e na HUD.
- Aljavas em **Outro** nao aparecem como disponiveis.

### Recarregar Aljava

Botao direito na aljava:

```text
Recarregar Aljava
```

O dialog permite escolher:

- Qual municao avulsa carregar.
- Quantidade a carregar.

O limite respeita:

- Capacidade restante da aljava.
- Quantidade disponivel no inventario.

### Descarregar Aljava

Botao direito na aljava:

```text
Descarregar Aljava
```

O dialog permite escolher a municao carregada e a quantidade a retirar. A municao
volta para o inventario como item avulso.

### Consumo automatico

Ao atacar com uma arma que usa flechas/virotes:

1. O dialog de ataque mostra a municao carregada nas aljavas disponiveis.
2. Ao rolar, o modulo consome 1 unidade da aljava.
3. Se o ataque acertar, a municao entra na fila de recuperacao.
4. A mensagem de ataque pode incluir a municao usada, por exemplo:

```text
Teste atacou Etterherd com Arco Longo usando Flecha Certeira e acertou.
```

---

## Recuperacao de Municao

A recuperacao usa um teste por projetil, mantendo o suspense de cada flecha ou
virote, mas um unico clique processa toda a sessao pendente.

Quando ha projeteis recuperaveis:

- O botao aparece na HUD apenas se houver pelo menos 1 projetil pendente.
- Tambem existe opcao no menu de contexto da arma.
- Cada clique inicia uma sessao que rola todos os testes individuais pendentes.
- O modulo aguarda Dice So Nice quando o dado 3D esta ativo.

### Dificuldade do teste

| Tipo de projetil | Recupera com |
| --- | --- |
| Comum | `1d20 <= 10` |
| Com qualidade | `1d20 <= 15` |
| Mistico / alquimico | `1d20 <= 17` |

O chat informa:

```text
1d20 contra 17 ou menos
Teste tentou recuperar Flecha Certeira e obteve sucesso.
```

---

## Municoes especiais

O modulo reconhece municoes oficiais e nomes em PT-BR/EN sempre que possivel.

Exemplos:

- Flechas/Virotes - Regulares
- Flecha Certeira
- Flecha - Precisao
- Flecha - Cortador de Corda
- Flecha - Ponta Perfurante de Armadura
- Flecha - Flamejante
- Flecha - Laco
- Flecha - Sibilante
- Arpeu
- Cabeca de Martelo
- Cauda de Andorinha Sangrenta
- Virote Atordoante / Stunning Bolt

Municoes especiais podem alterar modificadores, enviar descricao ao chat ou
registrar efeitos conforme a regra cadastrada.

Quando uma munição possui UUID conhecido, seu nome aparece como link dentro da
frase original do ataque, da recarga ou da recuperacao. Isso vale tanto para
projeteis especiais quanto para flechas e virotes regulares; clicar no nome abre
a ficha do Item e sua descricao completa.

---

## Fome

A regra opcional de Fome adiciona um efeito de status proprio.

Enquanto o personagem esta com Fome:

- Nao se beneficia de cura natural.
- Testes sofrem segunda chance de falha quando a regra exige.
- Movimento fica reduzido pela metade.
- Durante descanso, o personagem faz teste de inanição.

### Teste de inanição

O teste e:

```text
1D20 Contra X em Vigoroso
```

Se falhar:

- O personagem perde 1 ponto temporario de Vigoroso.
- Se Vigoroso chegar a 0, o personagem morre por inanição.

### Recuperacao depois da Fome

Quando a Fome acaba:

- A penalidade de Vigoroso nao some automaticamente.
- O personagem recupera naturalmente 1 ponto por dia de descanso.
- Curas e poderes podem recuperar esses pontos como se fossem Vitalidade.

---

## Descanso

O botao **Descanso** aparece no cabecalho da ficha de personagem jogador quando
ativado.

O dialog permite definir:

- Dias de descanso.
- Cura por dia.

Durante o descanso:

- Vitalidade pode ser recuperada.
- Corrupcao temporaria pode ser zerada.
- Testes de inanição sao resolvidos se o personagem estiver com Fome.
- Mensagens no chat nativo informam sucesso, falha ou morte por inanição.

O atalho configuravel **Ctrl+Shift+R** abre o descanso para os tokens de
personagem selecionados pelo Mestre ou para o personagem atribuido ao jogador.

---

## Cura Herbal e Medico

Na ficha do personagem, clicar somente na imagem do equipamento **Cura Herbal**
usa uma dose. Sem alvo selecionado, a cura e aplicada ao proprio personagem;
com exatamente um token marcado como alvo, ela e aplicada ao alvo.

- Sem a habilidade Medico, recupera 1 de Vitalidade.
- Medico Novato testa Astuto e, em caso de sucesso, recupera 1d6.
- Medico Adepto testa Astuto e, em caso de sucesso, recupera 1d8.
- Medico Mestre testa Astuto: recupera 1d10 no sucesso ou 1d6 na falha.
- Uma tentativa consome uma dose, inclusive quando o teste falha.
- Alvo com Vitalidade cheia ou morto nao consome a dose.
- A cura respeita a Vitalidade maxima e pode retirar automaticamente o estado
  Morrendo ao elevar a Vitalidade acima de zero.

As rolagens aguardam o Dice So Nice, quando ativo, antes da mensagem ilustrada
ser publicada no chat. A alteracao de Vitalidade de outro personagem e validada
pelo Mestre por socket.

---

## Sobrecarga

O modulo implementa a regra opcional de carga baseada em **Vigoroso**.

### Regra geral

- Capacidade normal: valor de Vigoroso.
- Com o dom Transportador: capacidade multiplicada por 1,5.
- Cada item acima da capacidade aplica penalidade em Defesa.
- Acima do dobro do Vigoroso, o personagem fica imobilizado.
- Enquanto houver sobrecarga, um efeito visual de alerta aparece no token. Ele
  e removido automaticamente quando a carga volta ao limite ou a regra e
  desativada.

### Estados dos itens

| Estado | Conta peso? |
| --- | --- |
| Equipado | Sim |
| Ativo (equipamentos e artefatos) | Sim |
| Ativo (arma nas maos) | Nao |
| Ativo (armadura vestida) | Nao; a desvantagem ja e representada por Obstrutiva |
| Outro | Nao |

Excecao importante: itens dentro de um recipiente contam conforme o estado do
recipiente. Se a mochila/baú estiver **Equipado** ou **Ativo**, os itens dentro
dela contam peso mesmo que estejam ocultos da lista principal.

### Pesos por item

O arquivo principal e:

```text
data/encumbrance-weights.json
```

Ele possui duas secoes:

```json
{
  "version": 2,
  "items": {
    "Pao de Viagem": 1,
    "Arco Longo": 1
  },
  "bundles": {
    "Flechas/Virotes - Regulares": {
      "bundleSize": 10,
      "slots": 1
    }
  }
}
```

`items` define peso item por item.  
`bundles` define grupos que pesam por pacote, como flechas, moedas e joias.

O sistema normaliza acentos e maiusculas/minusculas na comparacao, mas o nome
legivel no JSON deve ser mantido o mais proximo possivel dos livros e dos itens
do compendio.

---

## Recipientes

Recipientes permitem guardar itens em uma sublista expansiva dentro da propria
ficha.

### Como usar

Botao direito em um item:

```text
Guardar
```

Clique esquerdo em um recipiente:

```text
Abrir ou recolher
```

Dentro da sublista:

- **Retirar** devolve toda a pilha ao inventario principal.
- **Botao direito > Dividir** permite escolher quantas unidades retirar.
- **Ver** abre a ficha do item.

### Recipientes no canvas e transferencias

Um recipiente acessivel pode ser arrastado da ficha para o canvas. O modulo
cria um token que representa o recipiente no chao e conserva o vinculo com o
item e todo o seu conteudo. No HUD desse token:

- **Recolher** devolve o recipiente para a ficha e restaura seu estado anterior.
- O controle arrastavel permite transferir o recipiente completo para outra
  ficha compativel.

O usuario precisa ser Mestre ou proprietario da ficha e tambem ter permissao
para criar ou remover Tokens na cena. Se **Item Piles Symbaroum** estiver ativo,
o recipiente pode ser entregue a uma pilha mantendo sua hierarquia; sem ele, o
fluxo nativo continua disponivel entre fichas autorizadas. Transferencias sao
integrais: um recipiente com conteudo nao e dividido no meio da operacao.

### Regras de estado

Guardar e retirar so funciona se o item/recipiente estiver:

- Equipado
- Ativo

Se estiver em **Outro**, o modulo bloqueia a acao e mostra aviso.

Ao guardar um item, o modulo preserva seu estado anterior e o move internamente
para **Outro**. Ao retirar, o estado original (**Equipado** ou **Ativo**) e
restaurado. Isso evita que um item oculto continue sendo tratado pelo sistema
como equipado fora do fluxo do recipiente.

Ao importar a Adventure do modulo, armas, armaduras, equipamentos e artefatos
das fichas que estejam em **Outro** passam a **Equipado** antes de serem salvos.
Itens realmente guardados em recipientes preservam seu estado interno.

Desativar o gerenciamento de recipientes suspende a interface especial e a
regra de peso dos itens guardados, sem apagar os vinculos existentes. Os itens
voltam temporariamente ao seu estado visivel anterior. Ao reativar a opcao, os
vinculos e estados internos sao restaurados automaticamente.

### Integridade e seguranca

- Um recipiente com conteudo nao pode ser excluido nem ter sua quantidade
  reduzida a zero. Retire todos os itens antes dessas operacoes.
- Vinculos orfaos ou invalidos sao recuperados automaticamente por um unico GM
  ativo, restaurando os itens ao inventario principal.
- Pilhas so sao combinadas quando tipo, nome, estado restaurado e demais dados
  relevantes sao equivalentes. Itens apenas parecidos permanecem separados.
- Divisoes e combinacoes de pilhas possuem reversao em caso de falha parcial,
  reduzindo o risco de perda ou duplicacao.
- Mutacoes exigem que o usuario seja GM ou proprietario do Actor e que item e
  recipiente pertençam ao mesmo Actor.

### Expansao da sublista

O estado aberto/recolhido de cada recipiente e salvo por cliente. Assim, cada
usuario pode organizar sua propria ficha sem alterar a visualizacao dos demais,
e a escolha permanece depois de fechar e reabrir a ficha.

### Recipientes reconhecidos

Exemplos reconhecidos:

- Mochila / Backpack
- Saco / Sack
- Sacola
- Alforje
- Bolsa / Belt pouch / Coin purse
- Cesta / Basket
- Jarro de barro / Clay pitcher
- Caixa decorada / Decorated box
- Baú pequeno / Small Chest
- Baú grande / Large Chest
- Barril / Barrel
- Snuff Box
- Equipamento de Acampar / Field equipment / Camping equipment

### Equipamento de Acampar

O item **Equipamento de Acampar** e tratado como recipiente especial. Quando ele
traz uma lista em sua descricao no formato **Contem:**, o modulo pode inicializar
os itens internos automaticamente.

Exemplo de conteudo esperado:

- Saco de Dormir
- Frigideira
- Lenha
- Pederneira e Isqueiro
- Corda
- Cantil

Depois de inicializado, esses itens aparecem dentro da sublista do recipiente.

Para a referencia de manutencao, invariantes, flags, estados, peso, seed de
Equipamento de Acampar e diagnostico, consulte a
[documentacao tecnica interna de recipientes](docs/recipientes.md).

---

<a id="estado-padrao-do-inventario"></a>
## Estado padrao do inventario

Itens novos ou importados para uma ficha de personagem passam a **Equipado**
quando o sistema os cria em **Outro** sem uma razao de armazenamento. Assim, o
item entra no inventario carregado pelo personagem e participa normalmente das
regras de peso.

- Itens guardados em recipientes continuam em **Outro** internamente.
- Estados **Ativo** e estados ja definidos nao sao substituidos.
- A Adventure do modulo normaliza os equipamentos das fichas importadas.
- O ajuste usa atualizacoes dos Documents e nao altera diretamente compendios.

Ao retirar um item de uma mochila, a pilha inteira volta ao inventario. Para
retirar apenas parte da quantidade, use o menu de contexto **Dividir** e informe
quanto deve ser separado.

---

<a id="gerenciador-de-dinheiro"></a>
## Gerenciador de dinheiro

O botao de moedas ao lado do titulo **Dinheiro** na ficha abre uma janela para
adicionar ou gastar moedas. O saldo e convertido automaticamente entre os tres
valores de Symbaroum:

```text
1 Taler = 10 Xelins = 100 Ortegas
```

O jogador informa a quantidade de cada moeda e escolhe **Adicionar** ou
**Gastar**. O resultado e normalizado de volta para Taler, Xelim e Ortega, com
troco automatico entre as moedas. O modulo bloqueia gastos acima do saldo,
valores negativos, numeros invalidos e totais acima do limite seguro. Somente o
Mestre ou um proprietario da ficha pode alterar o dinheiro.

---

<a id="condicoes-e-efeitos-do-token"></a>
## Condicoes e efeitos do token

Em **Configurar Utilidades**, o Mestre pode instalar a macro **Efeitos do
Token** na hotbar. Selecione exatamente um token que voce possa controlar e
execute a macro para abrir uma janela com todas as condicoes registradas pelo
sistema e pelos modulos ativos.

A janela:

- permite pesquisar por nome ou descricao;
- possui rolagem vertical e pode ser redimensionada;
- informa o token selecionado e quais condicoes ja estao ativas;
- aplica ou remove a condicao com um clique;
- usa a lista atual de `CONFIG.statusEffects`, sem manter uma copia fixa;
- respeita a propriedade do Actor;
- pode publicar no chat uma descricao do efeito aplicado, conforme a
  configuracao **Exibir mensagens de condicoes**.

---

<a id="limpeza-automatica-do-inventario"></a>
## Limpeza automatica do inventario

Quando ativada, a limpeza automatica remove da ficha equipamentos cuja quantidade
chegue a zero ou a um valor negativo. Isso evita pilhas vazias de alimentos,
flechas, virotes e outros consumiveis.

- A regra atua somente em itens do tipo equipamento pertencentes a um Actor.
- Armas, rituais, habilidades e outros tipos de Item nao sao removidos.
- A exclusao usa a API de Documents do Foundry e e protegida contra chamadas
  duplicadas.
- Ao reativar a opcao, um GM ativo limpa os itens esgotados que ja existiam no
  mundo.
- Desative a opcao antes de manter propositalmente equipamentos com quantidade
  zero.

---

## Movimento

A regua propria do modulo colore o movimento do token:

| Cor | Significado |
| --- | --- |
| Verde | Dentro de uma acao de movimento. |
| Amarelo | Movimento dobrado, usando movimento + acao de combate. |
| Vermelho | Acima do limite permitido. |

Por padrao:

- 1 movimento = 10 metros.
- Movimento dobrado = 20 metros.

Fome, sobrecarga e efeitos de manobra podem reduzir ou bloquear movimento.

Se **Drag Ruler** estiver ativo, o Tenebre desativa sua propria regua colorida
para nao disputar a mesma area do Foundry.

---

<a id="sacar-e-guardar-armas"></a>
## Sacar e Guardar Armas

O sistema de prontidao de armas e exclusivo para personagens jogadores. Ele
separa o estado nativo **Ativo/Equipado** da declaracao de que uma arma esta
fisicamente sacada.

### Fluxos disponiveis

- **Clique esquerdo no controle:** abre a lista de armas; clicar em uma delas
  saca ou guarda imediatamente, sem botao de confirmacao.
- **Clique direito no controle:** abre a troca rapida; escolher uma arma guarda
  a atual e saca a nova atomicamente.
- **Menu de contexto da arma:** permite sacar ou guardar diretamente pela ficha.
- **Botao arrastavel:** o jogador pode posicionar o controle onde preferir; a
  posicao e salva apenas para aquele cliente.

### Regras aplicadas

- Uma arma elegivel guardada nao pode ser usada para atacar.
- Armas naturais continuam disponiveis e nao participam desse controle.
- O limite de armas simultaneamente sacadas respeita o custo de maos representado
  pelo sistema Symbaroum.
- A troca atualiza as armas envolvidas em uma unica operacao de Embedded
  Documents, reduzindo estados intermediarios.
- PNJs e monstros nao recebem o botao nem o bloqueio de prontidao.

### Feedback visual

O modulo pode mostrar:

- um pequeno indicador ao lado da arma na ficha;
- um contador no botao rapido;
- um indicador no token;
- uma animacao opcional ao sacar, guardar ou trocar;
- uma mensagem compacta no chat nativo do Symbaroum.

Cada uma dessas superficies possui opcao propria nas configuracoes de Combate.

---

## Manobras

O modulo adiciona uma area de **Manobras** na ficha e pode integrar essas acoes
ao Token Action HUD.

Manobras atualmente automatizadas:

- Adiar a Iniciativa
- Agarrar
- Desarmar
- Encontrão
- Investida
- Mira Cuidadosa
- Nocaute
- Defesa Total
- Ofensiva Total
- Empurrão
- Veneno em Armas
- Tomar a Iniciativa

Quando possivel, o modulo:

- Rola o teste necessario.
- Aplica efeitos ativos.
- Remove efeitos expirados.
- Publica o resultado no chat nativo do Symbaroum.

---

## Chat nativo do Symbaroum

Em **Configurar Mensagens no Chat**, o Mestre escolhe entre:

- **Original**: conserva integralmente os cards do sistema Symbaroum.
- **Ind Resources**: reorganiza visualmente mensagens reconhecidas, mantendo a
  `ChatMessage`, a rolagem e a audiencia originais.

Os cards compactos reconhecem:

- ataques de personagem contra NPC e de NPC contra personagem;
- retratos de atacante, arma e alvo;
- atributo, modificador com sinal, objetivo e resultado;
- sucesso, falha e falha critica;
- todos os termos de dano informados pelo sistema, inclusive bonus como Amoque
  e Robusto;
- Protecao do NPC e dano efetivamente recebido;
- testes de Atributo contra Atributo;
- uso de Amoque, Imposicao de Maos, Aura Sagrada e Cascata de Enxofre;
- nomes longos e trechos entre parenteses sem quebrar o layout.

Quando **Ocultar detalhes de NPC** esta ativa, Protecao e dano efetivo ficam
visiveis somente para o Mestre. Se o card original contiver informacao que a
apresentacao compacta nao conseguiu representar, um indicador vermelho de
informacao permite ao Mestre abrir o original, com as partes omitidas
destacadas. Desativar a apresentacao compacta restaura os cards originais sem
apagar mensagens.

A documentacao tecnica do ciclo nativo esta em
[Chat nativo do Symbaroum](docs/chat-symbaroum-nativo.md).

### Pedidos de resistencia

Quando o sistema pede resistencia ao jogador, o card e mantido simples para nao
poluir o chat:

```text
Loba Faminta ataca usando Mordida
Crespo pode resistir ao ataque
[Rolar resistencia]
```

Depois que o jogador rola a resistencia, o pedido e removido e o card de ataque
normal aparece com o resultado.

### Dados 3D

Rolagens do modulo usam o helper de dados interno:

- Rola o dado.
- Aguarda Dice So Nice quando disponivel.
- So depois publica o resultado.

Isso evita que o chat mostre o resultado antes do dado terminar de rolar.

### Rolagem privada

Quando **Exibir opcao de rolagem privada** esta ativa, os dialogos de rolagem
mostram **Rolagem privada**. Ao marca-la, somente usuarios GM recebem o
resultado daquela rolagem.

- A escolha vale apenas para a rolagem atual.
- Dados 3D privados tambem sao enviados somente aos GMs.
- A proxima rolagem volta ao modo de chat configurado no Foundry.

---

<a id="registro-do-mestre"></a>
## Registro do Mestre

O **Registro do Mestre** e uma segunda pagina integrada ao chat e exclusiva para
usuarios GM. Ele resume eventos importantes sem repetir os cards grandes do chat.

O painel:

- alterna entre **Chat Geral** e **Registro do Mestre** no topo da aba de chat;
- ocupa o mesmo espaco do chat, sem abrir uma janela flutuante;
- filtra eventos por categoria;
- diferencia visualmente sucesso, falha e informacao;
- resume ataques, rolagens, manobras, municao, descanso, itens e prontidao de
  armas quando esses eventos possuem dados estruturados;
- deduplica variantes publicas e privadas do mesmo combate;
- nao cria novas ChatMessages e nao envia seu historico aos jogadores.

Ao desligar a opcao, as paginas extras desaparecem imediatamente. Ao religar,
o registro e reconstruido a partir das mensagens atuais do mundo, sem exigir F5.

---

## Envio de itens, habilidades e rituais ao chat

### Catalogo de Ritualista

Quando **Ativar catalogo de rituais** esta ligado, clicar com o botão direito na
habilidade **Ritualista** mostra **Ver Rituais**. A opção abre um catálogo com os
66 rituais encontrados no Livro Básico e no Guia Avançado do Jogador.

O catálogo:

- agrupa rituais por tradição;
- mostra nomes em PT-BR ou inglês conforme o idioma do Foundry;
- usa as imagens do conteúdo oficial instalado quando disponíveis;
- marca rituais já presentes na ficha;
- identifica como **Restrito** o conteúdo exclusivo de profissões ou
  especializações;
- abre a ficha oficial do ritual ao clicar em sua linha, permitindo consultar
  a descrição completa no visual original do sistema.

Quando **Agrupar rituais em Ritualista** está ativo, os rituais conhecidos deixam
de ocupar linhas soltas. Um clique esquerdo em **Ritualista** expande ou recolhe
a sublista; cada ritual continua permitindo usar, ver/editar e excluir pelo
fluxo normal da ficha.

Ritualista permite aprender rituais de qualquer tradição, mas o personagem
precisa ter acesso ao ensinamento. A progressão é 1 ritual no nível Novato, mais
2 no Adepto e mais 3 no Mestre, totalizando 6. Rituais marcados como restritos
não são escolhas livres da habilidade comum.

O envio adicional de todos os itens e habilidades ao chat esta
**temporariamente pausado**. O controle correspondente nao aparece nas
configuracoes enquanto a pausa estiver ativa. As acoes que o proprio sistema
Symbaroum ja envia ao chat continuam funcionando normalmente, inclusive os
cards compactos reconhecidos e as integracoes que recebem seus dados.

---

## Macros e utilidades

O modulo inclui utilidades inspiradas no pacote Bithir:

- Gerador de nomes.
- Geradores de personagens/criaturas.
- Eventos de floresta.
- Versos de Aroaleta.
- Rolagem de inspiracao.
- Gerar Sombra.
- Macros de experiencia, rerrolagem e corrupcao temporaria.

Quando o modulo oficial **Bithir's Symbaroum Mods** esta ativo, o Tenebre desliga
as utilidades internas equivalentes para evitar disputa de namespace.

---

<a id="importador-experimental-de-journals"></a>
## Importador experimental de Journals

O checkout de desenvolvimento possui um importador de Journals acessivel apenas
pela API. Ele valida um manifesto, apresenta um plano sem gravacao e, mediante
comando explicito de um GM, cria ou atualiza `JournalEntry` e
`JournalEntryPage` no mundo. O importador:

- usa flags com origem e hash para evitar duplicatas;
- preserva entradas existentes quando a atualizacao nao e autorizada;
- separa ownership publico e privado;
- aplica a sheet larga do Symbaroum;
- sanitiza HTML antes de persistir;
- consegue remover apenas arvores legadas vazias que ele reconhece.

Exemplo de diagnostico sem gravacao:

```js
const api = game.modules.get("symbaroum-ind-resources").api.journalIntegration;
const plan = await api.dryRun();
console.table(plan.entries);
```

Importacao deliberada pelo GM:

```js
await api.importManifest({ updateExisting: false });
```

Esse recurso nao possui interface de usuario e ainda nao esta liberado para uma
distribuicao publica: o manifesto editorial e os assets associados devem ser
retirados ou ter autoria e direitos de redistribuicao confirmados. Faca backup
do mundo antes de qualquer importacao em massa.

---

<a id="integracoes"></a>
## Integracoes

As integracoes sao opcionais e falham de forma segura quando o modulo externo
nao esta instalado ou esta desativado.

| Integracao | Comportamento |
| --- | --- |
| Dice So Nice | Exibe dados 3D e aguarda a animacao antes de publicar o resultado. Rolagens privadas continuam visiveis apenas para GMs. |
| Automated Animations | Recebe metadados estruturados de itens, habilidades, poderes e rituais usados. |
| JB2A | Pode fornecer os recursos visuais consumidos pelo Automated Animations. |
| Token Action HUD | Recebe as manobras do modulo quando o HUD e sua integracao de Symbaroum estao ativos. |
| Drag Ruler | Assume a medicao de movimento; a regua propria do Tenebre e cedida para evitar conflito. |
| socketlib | Executa operacoes autorizadas que precisam de um GM responsavel. E dependencia obrigatoria. |
| libWrapper | Melhora a convivencia com outros pacotes que modificam as mesmas superficies. E recomendado, mas opcional. |

---

## Compatibilidade e blindagem

O modulo possui uma camada central de compatibilidade em:

```text
scripts/compatibility.mjs
```

Ela detecta modulos que mexem nas mesmas areas e decide quando o Tenebre deve
ceder para evitar travamentos.

Exemplos:

- Com **Drag Ruler** ativo, a regua propria do Tenebre e desativada.
- Com **Bithir's Symbaroum Mods** ativo, utilidades Bithir internas sao cedidas.
- Com dois tokenizadores ativos, o Tenebre apenas avisa e nao interfere.
- Modulos com faixa de compatibilidade externa antiga sao reportados, mas nao
  alterados.

### Aviso de compatibilidade

O aviso aparece somente para usuarios GM.

O Mestre pode marcar:

```text
Nao mostrar novamente estes avisos ja listados
```

Se novos conflitos aparecerem depois, o aviso volta a abrir apenas com os novos
itens ainda nao reconhecidos.

### Diagnostico

Para integracoes, use a API do pacote:

```js
game.modules.get("symbaroum-ind-resources").api
```

O alias historico `game.tenebreResources` aponta para o mesmo objeto. A API e
exposta durante o hook `setup`, antes da inicializacao dependente do mundo.

Servicos principais expostos nos dois caminhos:

- `game.tenebreResources.ammo`
- `game.tenebreResources.chatItemUse`
- `game.tenebreResources.compatibility`
- `game.tenebreResources.containerTransfer`
- `game.tenebreResources.containers`
- `game.tenebreResources.encumbrance`
- `game.tenebreResources.encumbranceVisuals`
- `game.tenebreResources.gmLog`
- `game.tenebreResources.groundContainers`
- `game.tenebreResources.hunger`
- `game.tenebreResources.hotbar`
- `game.tenebreResources.inventoryCleanup`
- `game.tenebreResources.journalIntegration`
- `game.tenebreResources.maneuvers`
- `game.tenebreResources.money`
- `game.tenebreResources.movement`
- `game.tenebreResources.rations`
- `game.tenebreResources.rest`
- `game.tenebreResources.rollPrivacy`
- `game.tenebreResources.ritualBrowser`
- `game.tenebreResources.statusEffects`
- `game.tenebreResources.tokenActionHud`
- `game.tenebreResources.verses`
- `game.tenebreResources.weaponReadiness`
- `game.tenebreResources.weaponReadinessHud`
- `game.tenebreResources.weaponReadinessVisuals`
- `game.tenebreResources.bithir`
- `game.tenebreResources.inspectActorResources(actorOrId)`
- `game.tenebreResources.diagnostics`

Essa API e voltada a integracoes. Consumidores devem usar os metodos publicos
dos servicos e nao alterar seu estado interno.

---

## Arquivos de dados editaveis

### Pesos e pacotes

```text
data/encumbrance-weights.json
```

Controla:

- Peso individual por item.
- Pesos por pacote, como flechas a cada 10 ou moedas a cada 50.

### Geradores

```text
data/ambrian-generator.json
data/barbarian-generator.json
data/abomination-generator.json
data/forest-events-pt-BR.json
data/aroaleta-verses.json
```

Usados pelas macros e utilidades.

---

## Estrutura do projeto

```text
symbaroum-ind-resources/
├─ assets/
├─ data/
├─ languages/
├─ packs/
├─ scripts/
├─ styles/
├─ templates/
├─ module.json
└─ README.md
```

Arquivos principais:

| Arquivo | Funcao |
| --- | --- |
| `scripts/init.mjs` | Entrada principal do modulo. |
| `scripts/settings.mjs` | Registro e dialog de configuracoes. |
| `scripts/ammo.mjs` | Aljavas, consumo, descarga, recarga e recuperacao. |
| `scripts/rations.mjs` | Pao de Viagem. |
| `scripts/hunger.mjs` | Efeito Fome e recuperacao de Vigoroso. |
| `scripts/rest.mjs` | Descanso e testes de inanição. |
| `scripts/encumbrance.mjs` | Calculo de sobrecarga e defesa. |
| `scripts/encumbrance-db.mjs` | Banco de pesos e bundles. |
| `scripts/containers.mjs` | Recipientes e itens guardados. |
| `scripts/container-transfer.mjs` | Transferencia segura de recipientes e conteudo. |
| `scripts/ground-containers.mjs` | Recipientes e inventarios abertos no canvas. |
| `scripts/inventory-cleanup.mjs` | Remocao opcional de equipamentos esgotados. |
| `scripts/inventory-default-state.mjs` | Estado inicial dos itens criados ou importados. |
| `scripts/money.mjs` | Conversao, adicao e gasto de moedas na ficha. |
| `scripts/maneuvers.mjs` | Manobras de combate. |
| `scripts/movement-ruler.mjs` | Regua de movimento. |
| `scripts/weapon-readiness.mjs` | Sacar, guardar, trocar e validar o uso de armas. |
| `scripts/roll-privacy.mjs` | Privacidade das rolagens da ficha. |
| `scripts/ritual-browser.mjs` | Catalogo oficial e agrupamento de rituais. |
| `scripts/gm-log-service.mjs` | Coleta e deduplicacao dos eventos do Registro do Mestre. |
| `scripts/gm-log-ui.mjs` | Segunda pagina do chat e controles do Registro do Mestre. |
| `scripts/compatibility.mjs` | Blindagem contra conflitos com outros modulos. |
| `scripts/chat-item-use.mjs` | Envio de itens/habilidades ao chat. |
| `scripts/status-effect-picker.mjs` | Seletor pesquisavel de condicoes do token. |
| `scripts/socket-policy.mjs` | Validacao das operacoes privilegiadas recebidas por socket. |
| `scripts/sockets.mjs` | Registro dos handlers executados por um GM autorizado. |
| `scripts/bithir-macros.mjs` | Utilidades e macros integradas. |

---

## Empacotamento para Release

O zip de release deve conter apenas o necessario para o Foundry carregar o
modulo.

Inclua:

- `module.json`
- `README.md`
- `SECURITY.md`
- `THIRD_PARTY_NOTICES.md`
- a licenca principal escolhida para o modulo;
- `licenses/`
- `assets/`
- `data/`
- `languages/`
- `packs/`
- `scripts/`
- `styles/`
- `templates/`

Nao inclua arquivos de desenvolvimento, controle de versao, zips antigos, logs,
locks de compendio do Foundry, caches, pastas temporarias ou documentacao local
de trabalho. O release deve conter somente o que o Foundry precisa para carregar
o modulo.

O zip publicado no GitHub Releases deve se chamar:

```text
symbaroum-ind-resources.zip
```

E precisa ter `module.json` na raiz do zip.

---

## Checklist de teste rapido

Depois de instalar ou atualizar:

1. Reinicie o Foundry ou pressione `F5`.
2. Confirme que `socketlib` esta ativo.
3. Abra as configuracoes do Tenebre Resources.
4. Teste Pao de Viagem:
   - Empilhamento.
   - Consumo.
   - Card de chat.
5. Teste aljava:
   - Recarregar.
   - Descarregar.
   - Atacar com arco.
   - Confirmar consumo.
   - Recuperar projetil.
6. Teste Sobrecarga:
   - Item em Equipado/Ativo conta peso.
   - Item em Outro nao conta.
   - Item dentro de mochila conta se a mochila estiver Equipado/Ativo.
7. Teste Recipiente:
   - Guardar quantidade parcial.
   - Abrir sublista.
   - Retirar quantidade parcial.
8. Teste Fome:
   - Aplicar efeito.
   - Descansar.
   - Confirmar teste de inanição.
   - Remover Fome.
9. Teste chat como GM e jogador:
   - modo Original e modo Ind Resources;
   - ataque de personagem contra NPC e de NPC contra personagem;
   - dano adicional, Protecao e detalhes ocultos de NPC;
   - resistencia, habilidade, ritual, manobra e rolagem de morte;
   - mensagem publica, privada, cega e direcionada.
10. Abra o console e confirme que nao ha erros novos do Tenebre.
11. Teste Sacar/Guardar Armas:
    - Clique esquerdo, troca rapida e guardar todas.
    - Bloqueio de ataque com arma guardada.
    - Indicadores da ficha, HUD e token.
12. Teste Ritualista:
    - Abrir o catalogo.
    - Expandir a lista de rituais conhecidos.
    - Adicionar e excluir um ritual sem recolher a lista.
13. Teste o Registro do Mestre:
    - Abrir, mover, redimensionar, filtrar e limpar.
    - Confirmar que jogadores nao recebem o botao nem o painel.
14. Desative e reative a limpeza automatica do inventario e confirme que apenas
    equipamentos com quantidade zero ou menor sao removidos.
15. Teste o gerenciador de dinheiro:
    - adicionar e gastar cada moeda;
    - conversao e troco;
    - tentativa de gastar acima do saldo;
    - jogador sem propriedade da ficha.
16. Instale a macro Efeitos do Token e teste:
    - busca, rolagem, redimensionamento e um token selecionado;
    - aplicar e remover uma condicao;
    - mensagem de chat ligada e desligada.
17. Repita os fluxos principais no Foundry v13 e v14 antes de declarar uma nova
    versao como verificada.

---

## Desenvolvimento

Clone o repositorio e execute a suite automatizada com Node.js:

```powershell
git clone https://github.com/Crespo767/symbaroum-ind-resources.git
Set-Location symbaroum-ind-resources
npm run validate
```

O comando valida a sintaxe de todos os ES modules e executa a suite completa.
O mesmo fluxo roda automaticamente no GitHub Actions em pushes para `main` e em
pull requests. O projeto nao possui dependencias npm de runtime.

Para o teste manual, instale a copia de desenvolvimento em
`FoundryVTT/Data/modules/symbaroum-ind-resources`. Feche o Foundry antes de
substituir arquivos do modulo ou do compendio. Instrucoes de seguranca e relato
de vulnerabilidades estao em [SECURITY.md](SECURITY.md); orientacoes para
contribuidores estao em [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Licenca e creditos

Este modulo foi criado para uso com o sistema **Symbaroum** no **Foundry VTT**.

Uma licenca principal ainda precisa ser escolhida e adicionada antes da
publicacao. Os componentes adaptados e suas licencas estao registrados em
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). A verificacao editorial,
juridica e de empacotamento esta em
[docs/PUBLICATION-READINESS.md](docs/PUBLICATION-READINESS.md).

Autores declarados no `module.json`:

- kaciquehn
- Crespo7777

Symbaroum e suas artes oficiais pertencem aos seus respectivos detentores. Este
modulo apenas adiciona automacoes e recursos de interface para uso em mesas no
Foundry VTT.
