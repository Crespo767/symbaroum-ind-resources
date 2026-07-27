# Sistema de Sacar e Guardar Armas e Escudos

## 1. Finalidade deste documento

Este documento e a fonte interna de engenharia do sistema de prontidao de armas do
Symbaroum Ind Resources. Ele descreve o comportamento efetivamente implementado,
suas dependencias, dados persistidos, invariantes e pontos de regressao.

O termo **armamento** abrange armas e escudos. No sistema Symbaroum, um escudo e
representado por um `Item` do tipo `weapon` cuja referencia e `shield`; portanto,
ele participa do mesmo fluxo de sacar, guardar, limite de maos, ficha e peso.

Esta documentacao deve ser consultada antes de qualquer alteracao em:

- estados de equipamento;
- ataques de personagens jogadores;
- armas Longas, Pesadas, de Alcance ou escudos;
- calculo de maos;
- sobrecarga e peso de armas;
- HUD, ficha, indicador no Token ou cards de chat de armamentos;
- transferencia de armas para recipientes;
- configuracoes de combate relacionadas a armamentos.

## 2. Escopo e limites

### Incluido

- personagens jogadores (`Actor` do tipo `player`);
- armas e escudos elegiveis pertencentes ao Actor;
- dialogo de acoes imediatas para sacar e guardar;
- troca rapida pelo HUD;
- controles na ficha e no menu de contexto;
- bloqueio de ataques com arma guardada;
- limite de duas maos;
- modo temporario de arma Longa com escudo;
- peso diferente para armamento sacado, guardado e fora do inventario;
- indicador visual no Token;
- animacao opcional;
- mensagens de chat e Registro do Mestre.

### Nao incluido

- PNJs e monstros;
- criacao ou alteracao permanente de qualidades de armas;
- simulacao completa de todas as habilidades que modificam empunhadura;
- escolha de postura, mao dominante ou mao secundaria;
- bloqueio de rolagens que contornem `Actor.rollWeapon`;
- alteracao do schema nativo de `Actor` ou `Item` do Symbaroum.

O suporte exclusivo a personagens jogadores e intencional. PNJs e monstros usam o
fluxo nativo do sistema e nao recebem os controles deste modulo.

## 3. Fontes tecnicas

### Modulo

| Responsabilidade | Arquivo |
| --- | --- |
| Regra, estados, maos e persistencia | `scripts/weapon-readiness.mjs` |
| Botao flutuante e troca rapida | `scripts/weapon-readiness-hud.mjs` |
| Indicador no Token e animacao | `scripts/weapon-readiness-visuals.mjs` |
| Bloqueio e integracao com rolagem | `scripts/weapon-wrapper.mjs` |
| Controles e marcadores na ficha | `scripts/sheet-ui.mjs` |
| Peso e sobrecarga | `scripts/encumbrance.mjs` |
| Registro e reacao de configuracoes | `scripts/settings.mjs` |
| Bootstrap e API publica | `scripts/init.mjs` |
| Estilos | `styles/symbaroum-ind-resources.css` |
| Textos | `languages/pt-BR.json`, `languages/en.json` |
| Regressao da regra | `tests/weapon-readiness.test.mjs` |
| Regressao de peso por estado | `tests/encumbrance-weapon-state.test.mjs` |

### Sistema Symbaroum original

- `script/sheet/actor.js`: ciclo nativo de estado dos equipamentos;
- `template/sheet/tab/player-main.hbs`: exibe na aba Principal apenas armas
  `active` e oferece o botao nativo `.roll-weapon`;
- `template/sheet/tab/player-gear.hbs`: lista todas as armas e exibe os estados
  Ativo, Equipado e Outro.

O ciclo nativo do Symbaroum e:

```text
active -> equipped -> other -> active
```

O modulo nao substitui o schema. Ele usa `system.state` do proprio Item e realiza
transicoes atomicas adequadas ao caso de uso de sacar/guardar.

## 4. Modelo de dominio

### 4.1 Fonte de verdade

`Item.system.state` e a fonte mecanica de verdade.

- `active`: armamento sacado, pronto e exibido na aba Principal;
- `equipped`: armamento guardado, mas carregado pelo personagem;
- `other`: armamento fora da carga transportada;
- `flags.symbaroum-ind-resources.storedIn`: armamento dentro de recipiente.

A flag `weaponReadiness` e metadado auxiliar. Ela nunca deve substituir a leitura
de `system.state` para decidir se uma arma esta sacada.

### 4.2 Tabela de estados

| Situacao | Estado/flag | Aparece em Principal | Pode atacar | Conta peso de arma | Elegivel no seletor atual |
| --- | --- | ---: | ---: | ---: | ---: |
| Sacada/nas maos | `state=active` | Sim | Sim | Nao | Sim |
| Guardada e carregada | `state=equipped` | Nao | Nao | Sim | Sim |
| Fora da carga | `state=other` | Nao | Nao | Nao | Sim, se nao estiver em recipiente |
| Em recipiente | `storedIn=<uuid/id>` | Nao | Nao | Depende do recipiente | Nao |
| Ataque desarmado | `reference=unarmed` | Fluxo nativo | Sim | Nao | Nao |

**Ponto de atencao:** o seletor atual nao exclui `state=other`. Ao selecionar esse
Item, ele e movido diretamente para `active`. Isso e comportamento atual, nao uma
garantia de regra desejavel para futuras versoes.

### 4.3 Flags persistidas

Todas usam o escopo `symbaroum-ind-resources`.

| Flag | Valor | Finalidade |
| --- | --- | --- |
| `weaponReadiness` | `drawn` ou `sheathed` | Metadado auxiliar e compatibilidade do fluxo |
| `weaponReadinessLongOneHanded` | `true` | Marca arma Longa em modo temporario de uma mao |
| `weaponReadinessOriginalLongQuality` | booleano | Guarda o valor original de `system.qualities.long` |
| `weaponReadinessIndicator` | `true` | Identifica o ActiveEffect visual criado pelo modulo |
| `weaponReadinessIndicatorWeaponId` | ID do Item | Relaciona cada indicador visual ao armamento sacado correspondente |

As duas flags do modo Longo devem ser removidas assim que a arma sair desse modo.
O valor original da qualidade Longa deve ser restaurado antes da remocao.

## 5. Elegibilidade de armamentos

`isEligibleWeapon(item)` exige:

1. `item.type === "weapon"`;
2. ausencia de `storedIn`;
3. `system.reference !== "unarmed"`.

Consequencias:

- escudos sao elegiveis;
- armas naturais/desarmadas nao aparecem;
- armamentos dentro de recipientes nao podem ser sacados;
- o estado `other` nao e atualmente um filtro;
- qualidades, tradicao, habilidade e nome nao definem elegibilidade.

Nunca use nome localizado para reconhecer escudo ou classe de arma. O contrato
vigente usa `system.reference` e `system.qualities`.

## 6. Calculo de maos

O limite global e `2` maos (`WEAPON_HAND_LIMIT`).

| Armamento | Custo normal |
| --- | ---: |
| Desarmado | 0 |
| Escudo Flexivel | 0 |
| Escudo comum | 1 |
| Arma comum | 1 |
| Arma Pesada (`heavy`) | 2 |
| Arma Longa (`long`) | 2 |
| Arma de Alcance (`ranged`) | 2 |

Quando a selecao contem pelo menos um escudo, toda arma Longa selecionada passa a
custar temporariamente `1` mao. A selecao e rejeitada antes da persistencia quando
a soma excede duas maos.

### 6.1 Arma Longa com escudo

O fluxo atual permite arma Longa com escudo sem consultar habilidades do Actor:

1. identifica uma arma `reference=long` e um `reference=shield` na selecao;
2. reduz o custo da arma Longa de 2 para 1 mao;
3. armazena o valor original de `system.qualities.long`;
4. define temporariamente `system.qualities.long=false`;
5. restaura a qualidade ao guardar a arma, remover o escudo, mover o Item para um
   recipiente ou alterar o estado externamente.

Isso representa a regra operacional aprovada: o Pique pode ser usado com escudo,
mas perde a qualidade Longa enquanto for empunhado com uma mao.

### 6.2 Limitacoes conhecidas do calculo

- qualquer escudo ativa o modo de uma mao para arma Longa;
- nenhuma habilidade do Actor e exigida ou consultada;
- nao existe override individual de custo de maos;
- mais de uma arma Longa pode entrar no conjunto antes de a soma de maos rejeitar
  a operacao;
- escudo Flexivel custa zero por regra implementada.

Qualquer expansao baseada em habilidades deve ser adicionada como regra de dominio
testavel, nunca como condicao de texto ou CSS.

## 7. Operacoes e persistencia

### 7.1 Dialogo de prontidao

`WeaponReadinessService.open(actor)`:

1. valida configuracao, tipo do Actor e permissao;
2. coleta todos os armamentos elegiveis;
3. exibe cada armamento como um botao e marca os atualmente `active`;
4. ao clicar em uma arma, alterna imediatamente entre sacar e guardar;
5. permite montar combinacoes de arma e escudo sem uma etapa de confirmacao;
6. permite guardar todos imediatamente;
7. calcula o uso de maos e rejeita a nova combinacao acima do limite;
8. delega cada alteracao a `setDrawnWeapons`.

### 7.2 Troca atomica

`setDrawnWeapons(actor, desiredIds)` e a operacao central. Ela:

1. normaliza IDs contra a colecao elegivel atual;
2. calcula maos antes de escrever;
3. serializa operacoes por Actor em uma fila interna;
4. cria patches minimos para todos os Items afetados;
5. executa uma unica chamada
   `actor.updateEmbeddedDocuments("Item", patches)`;
6. calcula diferencas entre estado anterior e posterior;
7. cria uma mensagem de chat somente quando houve mudanca;
8. dispara o hook namespaced de mudanca.

A operacao deve permanecer atomica. Nao se deve guardar uma arma em uma chamada e
sacar outra em seguida, pois uma falha intermediaria deixaria o Actor em estado
parcial e produziria mensagens/efeitos duplicados.

### 7.3 Troca rapida

O clique direito no botao flutuante abre o menu de troca rapida. Escolher uma arma
chama `setDrawnWeapons(actor, [weapon.id])`, guardando todos os demais armamentos e
sacando somente o escolhido.

Consequencia: a troca rapida de um unico item nao monta combinacoes de arma e
escudo. Para uma combinacao, deve ser usado o dialogo de prontidao.

### 7.4 Alteracoes externas

O hook sincrono `preUpdateItem` protege o dominio quando o estado muda por outro
fluxo, como o botao nativo da ficha ou armazenamento em recipiente:

- limpa a prontidao ao sair de `active`;
- restaura a qualidade Longa quando necessario;
- remove as flags temporarias;
- evita deixar uma arma guardada marcada como sacada.

O hook nao persiste separadamente: ele completa o patch da atualizacao corrente,
evitando recursao e uma segunda renderizacao.

## 8. Permissoes e autoridade

O servico aceita operacoes apenas quando:

- o Actor e do tipo `player`; e
- o usuario e GM ou possui permissao de proprietario sobre o Actor.

Esconder o botao nao e a protecao principal. A verificacao ocorre novamente no
servico antes da atualizacao dos Items.

O indicador de Token usa executor deterministico para evitar duplicidade:

1. primeiro GM ativo, ordenado por ID;
2. na ausencia de GM ativo, primeiro proprietario ativo, ordenado por ID.

Mensagens de sacar/guardar sao publicas. Elas nao contem rolagens ou informacao
secreta de alvo.

## 9. Bloqueio de ataques

`weapon-wrapper.mjs` envolve o metodo configurado
`CONFIG.Actor.documentClass.prototype.rollWeapon`.

Para personagens jogadores, quando o recurso esta ligado:

1. resolve o objeto preparado do sistema para o Item embutido pelo ID;
2. permite ataques desarmados/naturais;
3. exige que armas elegiveis estejam em `state=active`;
4. exibe aviso localizado e interrompe a rolagem se a arma estiver guardada;
5. somente depois segue para municao, manobras e a rolagem nativa.

PNJs e monstros delegam diretamente ao sistema original.

**Fronteira de seguranca:** chamadas que contornem `Actor.rollWeapon` e invoquem
APIs de nivel inferior nao sao bloqueadas por este recurso. Macros e integracoes
devem usar o metodo configurado do Actor.

## 10. Integracao com peso e sobrecarga

O projeto adota o seguinte contrato para Items do tipo `weapon`:

| Estado | Interpretacao | Peso |
| --- | --- | ---: |
| `active` | nas maos | 0 |
| `equipped` | guardada no corpo/mochila | peso normal |
| `other` | armazenada fora do personagem | 0 |
| em recipiente carregado | dentro da carga | peso normal |
| em recipiente fora da carga | fora do personagem | 0 |

Assim, sacar uma arma remove o peso dela da carga e guarda-la volta a contabilizar
o peso. Essa e uma regra do modulo, nao um comportamento do Symbaroum original.

Para slots de arma, `heavy` ocupa 2 e as demais armas ocupam 1. O peso de projeteis
e calculado pela regra de lotes propria do sistema de sobrecarga.

O calculo deve continuar tratando `active` antes da verificacao generica de estado
equipado. Reordenar essas condicoes faz a arma sacada voltar a pesar.

## 11. Superficies de interface

### 11.1 Ficha

- botao `Sacar/Guardar Arma` no cabecalho da secao Armas;
- marcador visual no nome/icone de cada armamento sacado;
- acoes `Sacar arma` e `Guardar arma` no menu de contexto;
- somente fichas de personagens jogadores;
- injecao idempotente: controles antigos sao removidos antes da reconstrucao.

A aba Principal e controlada pelo template nativo: somente armas `active` aparecem.
A aba Equipamento mostra o estado nativo e permite o ciclo original.

### 11.2 Botao flutuante

- aparece apenas com recurso e botao habilitados;
- exige Actor jogador elegivel e controlavel;
- prioriza Token controlado e usa `game.user.character` como fallback;
- mostra quantidade sacada/total;
- clique esquerdo abre o dialogo de prontidao com acoes imediatas;
- clique direito abre troca rapida;
- pode ser arrastado apos limiar de 2 px;
- posicao e salva por cliente em `weaponReadinessButtonPosition`;
- posicao inicial fica abaixo da barra lateral e e limitada ao viewport;
- Enter/Espaco acionam o fluxo principal.

O refresh do HUD e consolidado com debounce de 50 ms. Hooks nao devem chamar uma
segunda instancia ou registrar listeners novamente.

### 11.3 Indicador no Token

O indicador e um `ActiveEffect` sem alteracoes mecanicas:

- `changes=[]`;
- `transfer=false`;
- um efeito e um status namespaced e unico por armamento sacado;
- cada efeito usa a imagem do proprio armamento, incluindo escudos;
- o ID do armamento correspondente fica persistido em flag;
- duplicatas, indicadores obsoletos e o antigo efeito agregado sao removidos;
- todos os efeitos somem quando nenhuma arma esta sacada ou a opcao e desativada.

Na compatibilidade v14, o adapter solicita exibicao do icone no Token. O efeito nao
pode receber modificadores de atributos ou ser tratado por `Limpar efeitos` como
uma condicao prejudicial.

### 11.4 Animacao opcional

Requer:

- configuracao de animacao habilitada;
- canvas pronto;
- modulo Sequencer ativo;
- `globalThis.Sequence` disponivel;
- Token ativo do Actor na cena.

Falhas de asset ou dependencia sao silenciosas para o fluxo: a persistencia da arma
nao pode falhar porque a animacao falhou.

### 11.5 Chat e Registro do Mestre

Uma alteracao bem-sucedida cria mensagem publica com flags:

```text
type: weaponReadiness
actorUuid: UUID do Actor
drawnWeaponIds: IDs sacados
sheathedWeaponIds: IDs guardados
```

O chat nativo do Foundry/Symbaroum recebe uma mensagem compacta que expressa a
alteracao mecanica.

O adaptador do Registro do Mestre converte a mensagem em evento
`inventory.weaponReadiness`, classificando a acao como sacar, guardar ou trocar e
resolvendo os nomes pelos IDs persistidos.

## 12. Configuracoes

| Chave | Escopo | Padrao | Efeito |
| --- | --- | ---: | --- |
| `enableWeaponReadiness` | world | `true` | Liga regra, UI, bloqueio e indicador |
| `showWeaponReadinessButton` | world | `true` | Exibe botao flutuante |
| `showWeaponReadinessTokenIndicator` | world | `true` | Exibe efeito visual no Token |
| `enableWeaponReadinessAnimation` | world | `true` | Tenta animar sacar/guardar |
| `weaponReadinessButtonPosition` | client | `{}` | Posicao individual do botao |

Alteracoes disparam o hook `${MODULE_ID}.settingsChanged`.

- HUD reage e se recompõe sem F5;
- indicador e reconciliado ao ligar/desligar recurso ou indicador;
- animacao consulta a configuracao no momento da operacao;
- fichas abertas sao rerenderizadas quando o recurso principal muda;
- controles dependentes ficam ocultos na tela de configuracao quando o recurso
  principal esta desligado.

Desligar o recurso nao apaga `system.state` nem muda armas existentes. Apenas deixa
de aplicar a camada adicional do modulo.

## 13. Hooks e API do modulo

### Hooks consumidos

- `preUpdateItem`;
- `createItem`, `updateItem`, `deleteItem`;
- `updateActor`;
- `renderHotbar`;
- `controlToken`;
- `canvasReady`;
- hooks de render da ficha usados por `sheet-ui`;
- `${MODULE_ID}.settingsChanged`.

### Hook emitido

```js
Hooks.callAll(`${MODULE_ID}.weaponReadinessChanged`, {
  actor,
  drawn,
  sheathed,
  previous,
  current
});
```

`drawn` e `sheathed` representam diferencas da operacao. `previous` e `current`
representam os conjuntos completos antes e depois.

### API exposta

Disponivel em `game.tenebreResources`:

- `weaponReadiness`;
- `weaponReadinessHud`;
- `weaponReadinessVisuals`.

A integracao externa deve preferir os metodos do servico e nunca escrever flags ou
`system.state` diretamente. A API nao promete estabilidade para helpers internos.

## 14. Concorrencia, idempotencia e ciclo de vida

- atualizacoes sao serializadas por Actor para impedir trocas concorrentes;
- patches incluem apenas campos alterados;
- uma operacao sem diferenca nao cria mensagem nem hook de mudanca;
- o HUD possui guarda de registro unico e refresh consolidado;
- o indicador possui fila por Actor e executor deterministico;
- a injecao na ficha remove elementos anteriores antes de adicionar novos;
- alteracoes externas sao normalizadas no `preUpdateItem`, sem atualizacao recursiva;
- efeitos duplicados do indicador sao eliminados na reconciliacao.

Nao introduzir polling, escrita em hook de render ou atualizacoes Item por Item.

## 15. Compatibilidade Foundry v13/v14

- persistencia usa `Actor.updateEmbeddedDocuments`, API publica comum;
- hooks e Documents sao usados sem mutacao de `_source`;
- diferencas do ActiveEffect visual sao isoladas no adapter de compatibilidade;
- UI usa o padrao legado do projeto onde a ficha Symbaroum ainda e legada;
- o manifesto atual declara Foundry 13 como minimo e verificado em 13.350;
- o fallback tecnico para v14 existe, mas compatibilidade runtime v14 nao deve ser
  declarada como validada sem teste real no build alvo.

## 16. Invariantes que nao podem ser quebradas

1. `system.state` continua sendo a fonte de verdade.
2. Ataque de jogador com arma nao `active` e bloqueado antes de consumir municao.
3. Ataque desarmado continua permitido.
4. PNJs e monstros continuam no fluxo nativo.
5. A soma de maos e validada antes de qualquer escrita.
6. Troca de armamento e uma unica atualizacao atomica.
7. Arma Longa recupera exatamente a qualidade original ao sair do modo temporario.
8. Armamento em recipiente nunca aparece como elegivel.
9. Arma `active` nao pesa; `equipped` pesa; `other` nao pesa.
10. Indicador e animacao nunca alteram atributos ou impedem a operacao principal.
11. Apenas proprietario ou GM pode alterar o armamento do Actor.
12. Desativar configuracoes deve refletir sem F5 e sem apagar dados do personagem.
13. Hooks e listeners sao registrados apenas uma vez.
14. O chat nativo registra a mudanca mecanica uma unica vez.

## 17. Cenarios de falha e recuperacao

| Falha | Comportamento esperado |
| --- | --- |
| Selecao usa mais de duas maos | Aviso; nenhuma escrita |
| Actor sem permissao | Aviso; nenhuma escrita |
| Armamento removido durante dialogo | ID ignorado na normalizacao atual |
| Item movido para recipiente | Prontidao limpa; Longa restaurada |
| Sequencer/JB2A ausente | Estado persiste; sem animacao |
| Canvas indisponivel | Estado persiste; sem animacao |
| Efeito visual duplicado | Reconciliacao mantem somente um |
| Nenhum GM ativo | Primeiro proprietario ativo pode reconciliar indicador |
| Posicao do HUD fora da tela | Posicao limitada ao viewport |
| Recurso desligado | UI/bloqueio/efeito inativos; estados nativos preservados |

## 18. Limitacoes e dividas tecnicas conhecidas

1. `state=other` permanece elegivel no seletor se o Item nao estiver em recipiente.
2. O modo Longa + escudo nao verifica habilidades do Actor.
3. O menu rapido seleciona um unico Item e nao monta conjuntos com escudo.
4. Nao existe configuracao de custo de maos por Item ou qualidade personalizada.
5. A API de bloqueio depende de `Actor.rollWeapon`.
6. O efeito visual depende de um executor cliente ativo.
7. Nao ha teste runtime v14 registrado no manifesto atual.
8. O estado auxiliar `weaponReadiness` e redundante e deve permanecer sincronizado
   enquanto houver consumidores historicos, mas nao deve virar fonte de verdade.

Esses pontos devem ser tratados como decisoes explicitas em futuras melhorias, nao
como oportunidades para alteracao incidental.

## 19. Matriz minima de regressao

### Estados e ataques

- sacar arma `equipped` -> `active`, aparece em Principal e pode atacar;
- guardar arma `active` -> `equipped`, some de Principal e ataque e bloqueado;
- arma `other` nao pesa e nao pode atacar;
- arma em recipiente nao aparece no seletor e nao pode atacar;
- ataque desarmado funciona com recurso ligado;
- PNJ/monstro ataca sem controles adicionais;
- desativar o recurso restaura o fluxo nativo sem F5.

### Maos e qualidades

- duas armas de uma mao sao aceitas;
- arma de duas maos sozinha e aceita;
- arma de duas maos + arma comum e rejeitada;
- escudo + arma comum e aceito;
- escudo + arma Longa e aceito e remove Longa temporariamente;
- guardar escudo ou Longa restaura a qualidade original;
- mover Longa para recipiente restaura a qualidade;
- escudo Flexivel usa o custo implementado.

### Peso

- arma `active` pesa zero;
- a mesma arma em `equipped` pesa seu valor;
- a mesma arma em `other` pesa zero;
- arma em recipiente carregado pesa;
- arma em recipiente fora da carga nao pesa;
- troca atomica recalcula a ficha sem F5.

### Interface

- botao da ficha, menu de contexto e HUD chegam ao mesmo estado;
- clique esquerdo no HUD abre dialogo;
- clique direito realiza troca rapida;
- HUD segue Token controlado e fallback do personagem;
- arraste salva posicao por cliente e permanece dentro do viewport;
- indicador aparece, atualiza imagem/nomes e desaparece;
- opcoes ligadas/desligadas reagem em tempo real;
- GM, jogador proprietario e jogador sem permissao recebem comportamentos corretos.

### Chat e integracoes

- sacar, guardar e trocar geram uma unica mensagem;
- a mensagem nativa carrega as flags necessarias para as integracoes;
- Registro do Mestre classifica corretamente a operacao;
- animacao ausente ou com erro nao duplica nem cancela a mudanca;
- municao nao e consumida quando o ataque e bloqueado.

### Compatibilidade

- executar a matriz em Foundry v13 no build declarado;
- executar a mesma matriz em Foundry v14 no build alvo antes de marcar `verified`;
- testar Sequencer ativo, desativado e ausente;
- testar reload/reconexao com armas ja em `active`.

## 20. Procedimento para futuras alteracoes

1. Identificar se a mudanca afeta estado, maos, peso, ataque, UI ou efeito visual.
2. Atualizar primeiro as funcoes puras e seus testes.
3. Preservar `system.state` como fonte de verdade.
4. Construir uma unica operacao atomica de Items.
5. Verificar restauracao de flags e qualidade Longa em todos os caminhos de saida.
6. Confirmar que armas em recipientes e ataques bloqueados nao consomem recursos.
7. Testar GM, proprietario e usuario sem permissao.
8. Testar configuracao ligada e desligada sem F5.
9. Rodar testes focados e suite completa.
10. Sincronizar com a instalacao ativa apenas depois da validacao estatica.
11. Executar teste runtime v13 e, quando disponivel, v14.
12. Atualizar este documento se o contrato ou uma limitacao mudar.

## 21. Comandos de validacao atuais

Testes focados:

```powershell
node --test tests/weapon-readiness.test.mjs tests/encumbrance-weapon-state.test.mjs
```

Suite completa:

```powershell
$tests = Get-ChildItem tests -Filter '*.test.mjs' | Select-Object -ExpandProperty FullName
node --test $tests
```

Uma analise estatica ou teste Node nao substitui a matriz runtime no Foundry.
