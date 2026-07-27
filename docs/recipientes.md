# Documentacao tecnica: recipientes

Este documento descreve o sistema de recipientes implementado pelo modulo
`symbaroum-ind-resources`. Ele e uma referencia interna para manutencao,
depuracao e revisao de compatibilidade. A implementacao continua sendo a
fonte de verdade; quando este documento divergir do codigo, o codigo deve ser
investigado e a documentacao atualizada.

## Escopo

O sistema permite que um Actor de jogador guarde itens em outros Items do
mesmo Actor, exibindo o conteudo como uma sublista expansivel na ficha. Ele
tambem integra:

- reconhecimento de recipientes por alias;
- guardar, retirar, dividir e combinar pilhas;
- arrastar itens para dentro e para fora;
- abertura por clique esquerdo em recipientes;
- bloqueio de exclusao e de esvaziamento indevido;
- capacidade por espacos, com limites padrao e configuracao por recipiente;
- recuperacao de vinculos orfaos;
- peso de itens guardados e recipientes carregados;
- inicializacao do conteudo de `Equipamento de Acampar`;
- sincronizacao quando o recurso e ligado ou desligado.

O sistema nao cria uma nova categoria de Item nem altera o schema do sistema
Symbaroum. Ele usa Items existentes e flags namespaced do modulo.

## Arquivos e responsabilidades

| Arquivo | Responsabilidade |
| --- | --- |
| `scripts/containers.mjs` | Servico de dominio, flags, reconhecimento, mutacoes, seeds e recuperacao. |
| `scripts/sheet-ui.mjs` | Integracao com ficha, clique esquerdo, menu contextual, render da sublista e drag/drop. |
| `scripts/encumbrance.mjs` | Calculo da carga efetiva, incluindo itens guardados e pacotes. |
| `scripts/encumbrance-db.mjs` | Regras de peso por nome e regras de empilhamento. |
| `scripts/settings.mjs` | Setting de ativacao, setting de expansao por cliente e sincronizacao de estados. |
| `scripts/init.mjs` | Registro de hooks, API do modulo e reparo inicial por GM. |
| `scripts/ground-containers.mjs` | Representacao persistente de recipientes no canvas, retirada explicita e reconciliacao. |
| `styles/symbaroum-ind-resources.css` | Layout, estados visuais e dialogos do fluxo. |
| `tests/containers.test.mjs` | Testes unitarios das invariantes do servico. |
| `tests/ground-containers.test.mjs` | Testes da referencia persistente e do payload de canvas. |
| `README.md` | Documentacao resumida voltada ao usuario. |

## Superficie do servico

`ContainerService` e a API de dominio usada pela ficha e pelo bootstrap. Os
metodos abaixo sao os pontos de entrada relevantes; helpers internos nao
devem ser chamados diretamente pela UI:

| Metodo | Uso |
| --- | --- |
| `registerHooks()` | Registra, uma unica vez, os bloqueios de exclusao/zeragem e a recuperacao pos-exclusao. |
| `isContainer(item)` / `isEnabled()` | Consulta reconhecimento do recipiente e estado da configuracao. |
| `isStored(item)` / `getStoredIn(item)` | Consulta o vinculo de armazenamento. |
| `canStoreItem(item)` / `canAttemptStoreItem(item)` | Valida se o item pode entrar no fluxo de guardar. |
| `getContainers(actor, item)` / `getAvailableContainers(actor, item)` | Lista recipientes do mesmo Actor, distinguindo destino acessivel. |
| `getStoredItems(actor, container)` | Lista os Items embedded guardados no recipiente. |
| `getContainerCapacity(container)` / `getContainerCapacityLabel(actor, container)` | Consulta a capacidade efetiva e o texto de espacos usados/capacidade. |
| `canStoreInContainer(actor, item, container)` | Valida estado, pertencimento, acesso e espaco disponivel. |
| `setContainerCapacity(actor, container, config)` | Persiste capacidade limitada ou ilimitada no recipiente. Uso administrativo. |
| `configureContainerPrompt(actor, container)` | Abre a configuracao de capacidade para o GM pelo menu contextual. |
| `canDeleteItem(item)` | Bloqueia exclusao de recipiente nao vazio. |
| `canPreserveContentsOnDelete(item, options)` | Valida a excecao explicita de exclusao que preserva o conteudo. |
| `deleteContainerPreservingContents(actor, container)` | Exclui um recipiente por operacao explicita e restaura seus itens. |
| `storeItemPrompt(...)` / `storeItemInContainerPrompt(...)` | Abre os fluxos generico e direcionado de guardar. |
| `storeItem(...)` / `withdrawItem(...)` | Executa guardar/retirar depois das validacoes. |
| `openContainer(...)` / `toggleContainer(...)` / `collapseContainer(...)` | Controla a expansao visual e o seed do Equipamento de Acampar. |
| `isContainerExpanded(...)` | Consulta o estado de expansao do cliente atual. |
| `recoverOrphanedStoredItems(...)` / `synchronizeActorStates(...)` | Repara vinculos e normaliza estados no bootstrap/configuracao. |

As funcoes de guardar, retirar e reparar exigem um Actor mutavel. A UI deve
delegar a validacao ao servico em vez de inferir permissao apenas pela
presenca ou ausencia de um botao.

## Modelo de dados

### Item e Actor

Um recipiente e um Item pertencente ao inventario do mesmo Actor que possui os
itens guardados. Os tipos aceitos para armazenamento sao:

```text
equipment, weapon, armor, artifact
```

Itens de armadura semantico `noArmorID` do sistema nao entram no fluxo de
armazenamento. Equipamentos com quantidade menor ou igual a zero tambem nao
podem ser guardados.

### Flags do modulo

As referencias sao gravadas em `flags.symbaroum-ind-resources`:

| Flag | Significado |
| --- | --- |
| `isContainer` | Permite marcar explicitamente um Item como recipiente. |
| `storedIn` | ID do Item recipiente que contem este Item. Ausencia significa que o Item nao esta guardado. |
| `storedInName` | Nome legivel do recipiente no momento do armazenamento; e informativo. |
| `preStoredState` | Estado nativo anterior do Item, normalmente `equipped` ou `active`, para restauracao. |
| `campingContentsSeeded` | Impede que o conteudo inicial do Equipamento de Acampar seja criado novamente. |
| `containerCapacity` | Configuracao persistente: `{mode:"slots",value:N}` ou `{mode:"unlimited"}`. |
| `groundContainer` no Item | Referencia persistente do Token no canvas: versao, Scene, Actor, recipiente e estado anterior. |

No Token do canvas, a flag `symbaroum-ind-resources.groundContainer` guarda a
mesma referencia sem copiar os Items. A flag do Item e a do Token formam um
vinculo bidirecional para permitir restauracao e limpeza.

`storedIn` usa o ID do Item dentro do Actor, e nao um UUID externo. Por isso a
validacao sempre precisa confirmar que o destino ainda pertence ao mesmo
Actor e continua sendo um recipiente valido.

### Estado de expansao

`containerExpansionState` e um setting de escopo `client`. A chave tem o
formato:

```text
Actor.<uuid-ou-id>:<item-id>
```

O estado aberto/recolhido e portanto individual por cliente. Ele nao altera o
mundo nem a visibilidade de outros jogadores. Existe tambem um mapa de sessao
como fallback quando o setting de cliente nao esta disponivel.

## Reconhecimento de recipientes

O reconhecimento normaliza acentos, caixa e separadores e compara aliases
exatos. A implementacao nao usa busca por trecho, evitando que um item como
`Caixa de Ferramentas` seja confundido com uma `Caixa`.

### Recipientes leves

Os aliases atuais incluem:

- mochila, backpack, rucksack;
- saco, sacos, sack;
- sacola, satchel;
- cesto, cesta, basket;
- bolsa, bag, pouch, purse, bolsa de moedas, coin purse, belt pouch;
- jarro, jarra, pitcher, clay pitcher, jarra de barro;
- alforje, alforjes, saddlebag;
- algibeira;
- equipamento de acampar, equipamento de acampamento, equipamento de campo,
  field equipment, camping equipment.

### Recipientes volumosos

Os aliases atuais incluem:

- barril, barrel;
- bau, baú, bau pequeno, baú pequeno, bau grande, baú grande;
- chest, small chest, large chest;
- caixa, caixa decorada, box, decorated box, crate;
- snuff box, arca, coffer.

### Exclusoes

Alguns nomes sao explicitamente excluidos mesmo que se parecam com um alias:

- saco de dormir, sleeping bag, bedroll;
- colchonete;
- one box, one sack, one barrel.

Para um novo recipiente, prefira `isContainer` como flag explicita quando a
regra por nome nao for adequada. Nao adicione alias generico sem um teste de
exclusao correspondente.

### Capacidade

A capacidade e independente do peso e da quantidade do proprio Item recipiente.
Cada Item embedded guardado ocupa um espaco; a quantidade dentro de uma pilha
nao ocupa espacos adicionais. Quando uma pilha compativel pode ser combinada,
a combinacao e permitida mesmo que o recipiente esteja cheio, pois ela nao
cria um novo espaco.

Defaults:

| Recipiente reconhecido | Capacidade padrao |
| --- | ---: |
| Mochila, backpack, rucksack | 10 espacos |
| Equipamento de Acampar e aliases equivalentes | 10 espacos |
| Bolsa, bolsa de moedas, pouch, purse, algibeira e belt pouch | 2 espacos |
| Outros recipientes reconhecidos | Ilimitado |

O GM pode substituir o default por recipiente em `Configurar recipiente`,
escolhendo `Espacos limitados` e um valor entre 1 e 999, ou `Ilimitado`. A
configuracao e gravada na flag `containerCapacity` do Item.

Na ficha, a capacidade aparece junto da quantidade do recipiente como
`(usados/capacidade)`, por exemplo `(0/10)`. Em dialogs de armazenamento, os
destinos tambem exibem essa contagem. Recipientes cheios nao aparecem como
destino disponivel; se todos os destinos acessiveis estiverem cheios, o
usuario recebe a capacidade que bloqueou a operacao.

## Maquina de estados

O sistema de recipientes nao inventa estados paralelos. Ele preserva e
restaura o estado nativo do Item.

### Guardar

Pre-condicoes:

1. O gerenciamento de recipientes esta ativado.
2. O usuario e GM ou proprietario do Actor.
3. Item e recipiente pertencem ao mesmo Actor.
4. O Item e armazenavel, nao e um recipiente e possui quantidade positiva.
5. O Item esta em estado acessivel: `equipped` ou `active`.
6. O recipiente existe, possui quantidade positiva, nao esta guardado e esta
   em estado acessivel.
7. O recipiente possui um espaco livre, salvo quando a operacao combina uma
   pilha de equipamento compativel ja existente.

Ao guardar:

- o estado nativo anterior e salvo em `preStoredState`;
- o estado do Item passa para `other`;
- `storedIn` e `storedInName` sao gravados;
- para uma pilha parcial, o modulo separa a quantidade solicitada;
- se ja existir uma pilha equivalente no destino, as pilhas sao combinadas.

Um Item em `other` que nao tenha `storedIn` nao e automaticamente tratado como
armazenavel. Isso evita que itens em outro lugar sejam colocados em um
recipiente por engano.

### Retirar

Pre-condicoes:

- o Item possui `storedIn`;
- o destino ainda existe e e um recipiente valido do mesmo Actor;
- o recipiente nao esta guardado dentro de outro recipiente;
- o recipiente esta em estado `equipped` ou `active`;
- o usuario possui permissao para alterar o Actor.

Ao retirar, toda a pilha recebe o `preStoredState` salvo e as flags de
armazenamento sao removidas. Para retirar somente uma parte, o usuario usa
`Botao direito > Dividir` e escolhe uma quantidade menor que o total. Pilhas
equivalentes fora do recipiente sao combinadas quando possivel.

### Recipientes dentro de recipientes

O sistema identifica o recipiente como entidade armazenavel, mas o fluxo de
guardar bloqueia o armazenamento de outro recipiente por padrao. Um recipiente
guardado nao pode ser aberto nem usado como destino. Essa restricao evita
ambiguidade de peso, acesso e recuperacao de vinculos.

## Interfaces e fluxos de usuario

### Clique esquerdo

Quando o gerenciamento esta ativo, o clique esquerdo no controle principal de
um recipiente abre ou recolhe sua sublista. Para itens comuns, o fluxo de uso
de item e tratado pela UI do modulo, sem alterar recipientes que estejam
guardados.

### Menu contextual

O menu contextual oferece, conforme o estado do Item:

- adicionar quantidade;
- remover quantidade;
- ver/editar;
- excluir;
- guardar;
- abrir ou recolher recipiente;
- configurar capacidade do recipiente, apenas para o GM;
- retirar item guardado;
- dividir uma pilha guardada, quando houver mais de uma unidade;
- usar item.

As entradas de recipiente sao condicionais: um item em `other`, um recipiente
guardado ou um Actor sem permissao nao deve receber uma acao mutavel.

### Guardar a partir do item

Se o usuario inicia `Guardar` no item e existem varios recipientes disponiveis,
o dialogo deve exigir uma escolha explicita. O servico nao escolhe
silenciosamente o primeiro recipiente.

### Guardar a partir do recipiente

Se o usuario inicia a acao no recipiente, o destino ja esta definido e o
dialogo pede apenas confirmacao e quantidade quando a pilha e maior que um.

### Arrastar e soltar

O modulo usa um payload proprio de drag/drop contendo `actorId`, `itemId` e
`source`:

- `source: inventory`: arrastar para um recipiente inicia guardar;
- `source: stored`: arrastar para fora da sublista retira toda a pilha.

O drop e aceito apenas quando o Actor do payload corresponde ao Actor da ficha.
O clique no icone e no nome deve continuar produzindo o mesmo fluxo; o drag nao
deve depender somente do texto do item.

O sistema suporta arrastar entre a ficha e as sublistas de recipientes: entrar
guarda e sair retira. A criacao de uma representacao do recipiente no canvas
tambem esta disponivel para recipientes de nivel superior. O recipiente original
continua sendo o Item embedded do Actor; o canvas recebe apenas um Token nativo
com uma referencia namespaced para o Actor, o Item recipiente e a Scene.

No drop para o canvas:

1. o payload `symbaroum-ind-resources.ground-container` e validado por Actor, recipiente,
   permissao, quantidade, coordenadas e duplicidade;
2. a Scene cria o Token antes de alterar o Item de origem;
3. depois da criacao confirmada, o recipiente passa para `other` e grava o
   estado anterior e o `tokenId` em uma flag do modulo;
4. se a atualizacao do Item falhar, o Token criado e removido;
5. mover o Token usa o fluxo nativo do Foundry e nao move nem duplica os Items
   guardados;
6. excluir o Token restaura o estado anterior do recipiente;
7. se o Item de origem for excluido por uma operacao permitida, o Token de chao
   correspondente tambem e removido para nao deixar uma representacao orfa.
8. o HUD do Token oferece `Pegar recipiente` para o GM ou proprietario do Actor;
9. a retirada explicita restaura o Item, remove a flag e exclui o Token, com
   rollback para `other` e a referencia persistida se a exclusao falhar.

A retirada pelo HUD reutiliza a mesma referencia e as mesmas validacoes da
exclusao. O Token nao e uma copia do recipiente: ele e apenas a representacao
visual persistente no canvas, enquanto o Item e seus conteudos continuam no
Actor.

### Integracao com Item Piles

Quando o modulo Item Piles esta ativo, `scripts/container-transfer.mjs` usa
somente a API publica `game.itempiles.API` e o hook publico
`preTransferItems`. A transferencia de um recipiente para outro Actor ou para
um Item Pile move a arvore completa: o recipiente, os filhos diretos e todos
os descendentes, remapeando cada referencia `storedIn` para o novo Item pai.

O hook rejeita transferencias parciais de recipiente e tentativas de mover um
filho armazenado isoladamente. Isso evita duplicacao de conteudo e itens
orfaos. A origem so e liberada depois que a operacao do Item Piles foi
preparada e validada; se o destino nao puder receber a arvore, a transferencia
inteira e cancelada.

Ao criar um Item Pile no chao, o modulo cria primeiro o Pile vazio e depois
transfere a arvore pelo mesmo fluxo publico. O recipiente no Actor recebe uma
referencia persistente do Token, muda para `other` e pode ser retirado pelo HUD.
Ao pegar o Pile ou reencontrar o recipiente, o mesmo Actor e a mesma arvore sao
restaurados. Se Item Piles estiver ausente ou inativo, o fluxo nativo do modulo
continua sendo usado como fallback.

O modulo nao copia o bundle do Item Piles nem depende de classes ou funcoes
privadas. A dependencia opcional e isolada no servico de transferencia; a
representacao nativa do canvas e a reconciliacao de referencias continuam
funcionando sem ela.

### Reconciliacao no carregamento

No `ready`, somente o GM ativo primario executa a reconciliacao. A escolha e
deterministica pelo menor ID entre os GMs ativos, evitando que dois clientes
corrijam os mesmos documentos ao mesmo tempo. A rotina e idempotente e:

- remove Tokens cujo Actor ou recipiente de origem nao existe mais;
- remove Tokens que perderam a referencia correspondente no Item;
- repara a flag e o estado `other` do Item quando o Token existe e o Item foi
  parcialmente alterado;
- restaura o estado anterior e remove a flag de Items cujo Token nao existe;
- continua as demais verificacoes quando uma operacao individual falha e
  registra a quantidade de erros para diagnostico.

Assim, excluir um Token, usar `Pegar recipiente` ou reiniciar o mundo produz o
mesmo estado final: um recipiente no inventario ou uma representacao valida no
canvas, nunca duas fontes de verdade.

## Pilhas, transacoes e rollback

Pilha e dividida somente para `equipment`. Ao combinar, o modulo compara uma
representacao estavel do Item, removendo IDs, ordenacao, ownership, metadados e
flags internas de recipiente. O estado restaurado e dados relevantes do sistema
continuam fazendo parte da comparacao.

Consequencias:

- mesmo tipo, nome e dados equivalentes podem combinar;
- descricoes, estados restaurados ou dados relevantes diferentes permanecem
  separados;
- uma divisao cria o destino e depois atualiza a origem;
- se a atualizacao da origem falhar, o destino criado e removido;
- uma combinacao atualiza a pilha destino e depois exclui a origem;
- se a exclusao falhar, a quantidade do destino e restaurada.

Esses rollbacks reduzem o risco de duplicacao ou perda, mas erros de permissao
ou falhas do servidor ainda devem ser observados no console.

## Exclusao e integridade

Um recipiente com itens guardados nao pode:

- ser excluido;
- ter a quantidade reduzida a zero ou abaixo de zero.

Existe uma excecao somente para uma operacao explicita de dominio:
`deleteContainerPreservingContents(actor, container)`. Ela deve ser usada por
um fluxo que tenha decidido conscientemente remover o recipiente mantendo os
itens no inventario. A operacao passa a informacao namespaced
`preserveContents: true`; a exclusao comum continua bloqueada. O hook de
exclusao recupera os itens, restaura `preStoredState` e remove os vinculos
`storedIn`, evitando itens orfaos.

Os bloqueios ocorrem em hooks `preDeleteItem` e `preUpdateItem` e retornam
sincronamente, pois hooks cancelaveis nao devem ser `async`.

Quando um recipiente e excluido depois de estar vazio, o hook de exclusao
procura itens que ainda apontem para o ID removido e restaura seus estados.

Na inicializacao e ao alterar `enableContainers`, o GM ativo principal executa:

1. recuperacao de itens com vinculo orfao, invalido ou apontando para recipiente
   guardado;
2. sincronizacao do estado dos itens conforme o recurso esteja ligado ou
   desligado;
3. reparo de recipiente nao vazio com quantidade zero, elevando a quantidade
   para um para nao esconder conteudo.

As operacoes sao idempotentes: executar novamente nao deve duplicar itens nem
reaplicar recuperacoes ja concluidas.

## Equipamento de Acampar

`Equipamento de Acampar` e um recipiente leve especial. A primeira expansao
procura referencias na descricao do Item, aceitando:

- links `@UUID[...]{Nome}`;
- anchors com `data-uuid`;
- uma lista padrao quando nenhuma referencia e encontrada.

A lista padrao e:

```text
Saco de dormir
Frigideira
Lenha
Pederneira e Isqueiro
Corda
Cantil
```

Somente nomes da lista padrao sao aceitos pelo filtro de seed. Cada referencia
e resolvida por UUID quando possivel; caso contrario, o modulo procura um Item
global com nome normalizado. O conteudo e criado como Item embedded do Actor,
com `state: other`, `storedIn` apontando para o equipamento e
`preStoredState` preservando o estado original.

Se o recipiente ja possui qualquer conteudo, ele apenas recebe a flag
`campingContentsSeeded`; o modulo nao cria duplicatas. Essa inicializacao e
uma operacao de mundo e deve ser executada com permissao adequada.

## Calculo de peso

O calculo esta em `EncumbranceService.getItemLoad` e e separado da exibicao da
sublista.

Regras efetivas:

1. Item nao rastreado nao pesa.
2. Item guardado em recipiente nao carregado nao pesa.
3. Item guardado em recipiente carregado contribui com seu peso.
4. Um recipiente carregado e avaliado pelo seu estado nativo e pelo peso dos
   itens internos.
5. Arma `active` esta na mao e nao ocupa carga.
6. Item `equipped` conta como carga do personagem.
7. Item `other` fora de um vinculo valido nao conta.
8. Aljavas e projeteis usam regras de pacote; a regra padrao de projeteis e um
   slot por cada dez unidades completas, conforme a configuracao de pesos.

O helper `isStoredInCarriedContainer` considera o recipiente carregado quando
ele esta `equipped` ou `active`. A quantidade de equipamentos e multiplicada
pela regra de peso, salvo quando existe regra de pacote especifica.

A carga atual, capacidade, sobrecarga, penalidade de Defesa e estado
imobilizado sao derivados em memoria. O modulo nao deve salvar a penalidade no
Actor durante `prepareDerivedData`.

## Permissoes e escopo

As mutacoes exigem GM ou ownership do Actor. O servico verifica a permissao no
ponto da operacao, nao apenas ao esconder um botao.

O sistema de recipientes e aplicado aos Actors de jogador nas rotinas de
sincronizacao inicial e configuracao. PNJs e monstros nao recebem o fluxo de
recipientes por essas rotinas. Itens e recipientes precisam ser embedded no
mesmo Actor; dados de outro Actor ou payload de drag/drop nao sao aceitos.

## Lifecycle

### `init`

`ContainerService.registerHooks()` registra uma vez os hooks de pre-exclusao,
pre-atualizacao e exclusao. A flag interna evita listeners duplicados.

### `ready`

O modulo expoe o servico na API namespaced e, para o GM ativo principal,
repara vinculos orfaos e sincroniza estados dos Actors de jogador.

### Mudanca de configuracao

Ao alterar `enableContainers`, o modulo executa a mesma recuperacao e
sincronizacao sem exigir reinicio. A configuracao de expansao e apenas de
cliente e nao dispara uma mutacao de mundo.

## Invariantes para manutencao

Qualquer alteracao futura precisa preservar:

- nenhum Item com `storedIn` apontando para destino inexistente apos o reparo;
- nenhum recipiente nao vazio pode ser excluido ou zerado;
- guardar e retirar restauram exatamente o estado nativo anterior;
- uma operacao nao pode misturar Items de Actors diferentes;
- uma pilha parcial nao pode duplicar nem perder quantidade;
- um seed de Equipamento de Acampar nao pode duplicar conteudo;
- abrir e recolher nao pode alterar dados do mundo alem do seed explicito;
- o render da ficha nao pode ser necessario para validar permissao;
- hooks cancelaveis continuam sincronos;
- GM e jogador veem somente as acoes permitidas para seu contexto;
- o recurso desligado nao apaga flags nem descarta vinculos existentes.

## Testes existentes

`tests/containers.test.mjs` cobre atualmente:

- aliases exatos e exclusoes;
- ownership e quantidade positiva;
- preservacao de estado `active`/`equipped`;
- combinacao somente de pilhas equivalentes;
- rollback de divisao e combinacao;
- recuperacao idempotente de vinculos orfaos e invalidos;
- sincronizacao ao ligar/desligar;
- expansao por cliente e bloqueios de quantidade/exclusao;
- seed de Equipamento de Acampar sem duplicacao.

`tests/ground-containers.test.mjs` cobre atualmente:

- persistencia da referencia do recipiente no Token e no Item;
- pickup explicito pelo HUD, com restauracao do estado e exclusao do Token;
- restauracao de Item quando o Token do canvas desaparece;
- remocao de Token quando o Item de origem nao existe mais;
- reparo de flags e estado quando a referencia do Item fica inconsistente.

Ao alterar o servico, rode primeiro o teste focado de recipientes e depois a
suite completa. O fluxo manual minimo deve cobrir GM, jogador proprietario,
item `equipped`, item `active`, item `other`, pilha parcial, recipiente vazio,
recipiente com conteudo, recipiente limitado cheio, recipiente ilimitado,
configuracao de capacidade pelo GM, arrastar para dentro, arrastar para fora,
pickup pelo HUD, excluir um Token pelo fluxo nativo, reiniciar com Token/Item
orfao e reabrir a ficha, alem de alternar a configuracao. Tambem valide que um jogador nao
ve nem executa a configuracao administrativa do recipiente.

## Diagnostico rapido

1. Confirme `enableContainers`.
2. Verifique `item.parent.id` e `container.parent.id`.
3. Inspecione `flags.symbaroum-ind-resources.storedIn`.
4. Confirme `system.state` e `preStoredState`.
5. Verifique se o recipiente tem quantidade positiva.
6. Para peso, confira o estado do recipiente e a regra em
   `data/encumbrance-weights.json`.
7. Para Equipamento de Acampar, confira a descricao, UUIDs e
   `campingContentsSeeded`.
8. Se o problema ocorrer apenas depois de reabrir, examine o setting client
   `containerExpansionState` e a ordem dos hooks de render.

## Compatibilidade

O modulo declara Foundry v13 como baseline e deve manter fallback para v14.
O servico usa APIs publicas de Documents, settings, hooks e embedded
Documents; nao depende de uma classe privada para persistir os Items. Qualquer
mudanca de assinatura entre v13 e v14 deve ser isolada em adapter, sem
espalhar condicionais pelo servico ou pela ficha.
