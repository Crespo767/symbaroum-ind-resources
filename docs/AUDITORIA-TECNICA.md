# Auditoria técnica — Symbaroum Ind Resources v0.17.63

Data: 2026-10-09 · Escopo: todo o código em `scripts/` (≈25 mil linhas, 57 arquivos), `templates/`, `styles/`, `data/`, `assets/`, `module.json`, testes e CI.
Base de verificação: leitura integral do código + conferência direta contra o código-fonte do Foundry **v13.350** instalado em `D:\FoundryVTT`. O sistema Symbaroum **não** está instalado localmente, então pontos que dependem do código do sistema estão marcados como "confirmar".

Legenda de confiança:

- **Confirmado** — o defeito decorre diretamente do código (e, quando citado, do core v13.350).
- **Provável** — o fluxo leva ao defeito pela leitura do código, mas precisa ser reproduzido no Foundry.
- **Regra** — depende de interpretação das regras de Symbaroum; decisão sua.

Nenhum item abaixo foi testado em um mundo real do Foundry. A suíte local (315 testes) passa, mas ela cobre funções puras com mocks, não os fluxos de hooks entre GM e jogadores, onde estão quase todos os problemas.

---

## 1. Resumo executivo

O módulo funciona, tem boas ideias e alguns pontos bem feitos (política de sockets por allowlist, testes, CI, traduções 100% pareadas). Os problemas são de **estrutura**, típicos de código gerado incrementalmente por IA:

1. **Escritas no banco em excesso e em lugares errados.** Hooks que rodam em *todos* os clientes gravam dados ao mesmo tempo; renderização de ficha grava flags; o `ready` do GM faz centenas de gravações sequenciais e **apaga itens** do mundo inteiro a cada carregamento.
2. **Dados gravados que nunca são lidos.** O sistema de "auto-atribuição de carga" grava 2 flags por item em todo o mundo, e esses valores não são usados para nada.
3. **Funções que nunca rodam.** O hook `renderTemplate` não existe no core; por isso os modificadores de munição especial **nunca** são aplicados à rolagem.
4. **Leitura do chat por texto.** Quatro serviços reconstroem mensagens do sistema lendo o HTML e frases em português/inglês ("ataca com", "attacks with"). Qualquer atualização do sistema ou outro idioma quebra isso em silêncio.
5. **Gambiarras em internals do Foundry.** A ficha de Grupo redefine `game.documentTypes`, `game.model` e `Actor.TYPES`; várias classes do sistema são alteradas por monkey-patch sem libWrapper.
6. **Duplicação.** ~10 cópias de `escapeHtml`, ~13 de `localize`, 5 de "re-renderizar fichas", 6 formas diferentes de eleger "o GM principal", 3 implementações de "marcar como morto".

Correções de maior retorno, em ordem: remover a auto-atribuição de carga (seção 3.1), corrigir os hooks multi-cliente (3.2), parar a limpeza destrutiva no `ready` (3.3), corrigir os 6 bugs confirmados da seção 2 e substituir a ficha de Grupo pelo mecanismo nativo de sub-tipos (4.1).

---

## 2. Bugs funcionais

### 2.1 Munição especial nunca aplica modificadores — **Confirmado** (contra o core)
- `sheet-ui.mjs:61` registra `Hooks.on("renderTemplate", onRenderTemplate)`.
- O core v13 **não dispara** esse hook (`client/applications/handlebars.mjs` não chama `Hooks` em `renderTemplate`).
- Consequência: `game.tenebreResources.activeWeaponModifiers` nunca é preenchido, e `applyAmmoModifiers` (`sheet-ui.mjs:2272-2275`) sai sempre no primeiro `return`. Flechas especiais consomem e são recuperadas, mas **não alteram a rolagem**.
- A não ser que o próprio sistema Symbaroum dispare `renderTemplate` (confirmar), essa feature está morta.
- Correção: obter os modificadores da arma pela API do sistema ou pelo `data` do diálogo no `renderDialog`, que já é interceptado.

### 2.2 Rolagem "privada" de Eventos na Floresta sai pública — **Confirmado** (contra o core)
- `bithir-macros.mjs:911-922` passa `rollMode: CONST.DICE_ROLL_MODES.PRIVATE` **dentro dos dados** da mensagem.
- O core só respeita `rollMode` passado em `options` (`client/documents/chat-message.mjs:509`). O campo nos dados é ignorado.
- O mesmo acontece em `rollRollInspiration` (`bithir-macros.mjs:844-851`), que também usa o campo depreciado `roll: JSON.stringify(...)`.
- Correção: `ChatMessage.create(data, { rollMode })` ou `ChatMessage.applyRollMode(data, mode)`.

### 2.3 Dose de veneno nunca é consumida — **Confirmado**
- `maneuvers.mjs:670-698` lê e grava `system.quantity`. O resto do módulo (e o sistema) usa `system.number` para quantidade.
- `choosePoisonDose` sempre vê quantidade 1 e `consumePoisonDose` grava um campo que não existe no schema. A dose infinita nunca acaba.
- Correção: trocar para `system.number` e reutilizar `changeItemQuantity` de `item-flags.mjs`.

### 2.4 Mensagem "Fome removida" duplicada por cliente — **Confirmado**
- `hunger.mjs:80-86`: o handler de `deleteActiveEffect` chama `postRemovedMessage` **sem** checar quem é o autor. Esse hook roda em todos os clientes conectados.
- Com 4 jogadores + GM online, saem até 5 mensagens iguais. O handler de criação (`hunger.mjs:70-77`) tem a checagem `#isChatAuthor`; o de remoção esqueceu.

### 2.5 Matar um personagem pode "ressuscitá-lo" — **Provável**
- `killActor` (`death-automation.mjs:258-275`) primeiro grava `status: "dead"` e depois remove o efeito "Morrendo" (`removeStatus`, linha 272).
- Essa remoção dispara o hook `deleteActiveEffect` da própria automação (`death-automation.mjs:100-109`), que vê `status === "dead"`, considera que alguém removeu o efeito manualmente e chama `recoverActor`. Este apaga o estado de morte e zera as falhas, em paralelo com o resto de `killActor`.
- Resultado esperado: o marcador de "morto" fica no token, mas o estado interno some. Na próxima mudança de Vitalidade o personagem volta para "Morrendo".
- Correção: marcar remoções internas com uma opção (`{ [MODULE_ID]: { internal: true } }`) e ignorá-las no hook.

### 2.6 Re-renderização de janelas ApplicationV2 nunca acontece — **Confirmado** (contra o core)
- `foundry.applications.instances` é um `Map` (`client/applications/_module.mjs:27`). Iterar um `Map` com `for...of` devolve pares `[id, app]`, não a janela.
- Afetados: `settings.mjs:887-890`, `sheet-ui.mjs:1132-1135` e `1146-1151`, `encumbrance.mjs:669-677`, `bithir-macros.mjs:1166-1171`. Em todos, `app.document` é `undefined` e nada é re-renderizado.
- Hoje o impacto é limitado porque as fichas do Symbaroum 6.1.6 são V1 (`ui.windows`), mas qualquer ficha V2 (itens do core, módulos, migração futura do sistema) fica desatualizada.
- Correção: `instances.values()`.

### 2.7 Nomes "parecidos" viram munição, arco ou ração — **Confirmado**
- `item-flags.mjs:434-437` usa `includes` (substring) em vez de comparação de palavra.
- Exemplos reais: qualquer equipamento com "Coração" no nome contém "racao" → vira **ração** e entra na consolidação, que **apaga duplicatas**. "Elbow"/"Rainbow" contêm "bow" → a arma passa a exigir munição. "Marco", "Barco" contêm "arco".
- `containers.mjs:1177-1187` já faz certo (compara o nome inteiro). Correção: usar a mesma lógica e preferir sempre o flag explícito.

### 2.8 Defesa Total expira antes de proteger — **Regra**
- Efeitos "turnEnd" expiram em `combat.turn !== startTurn` (`maneuvers.mjs:1323-1325`), ou seja, na **primeira** troca de turno após declarar.
- Para Defesa Total, Mira Cuidadosa e Ataque Total isso significa que o bônus some antes dos inimigos agirem. Pelas regras de Symbaroum, a Defesa Total vale até o próximo turno do personagem.
- Correção sugerida: expirar quando o turno volta ao combatente que criou o efeito.

### 2.9 Fome anula sempre os bônus de manobra — **Regra**
- `init.mjs:692-693`: depois de calcular o favor com manobras e fome, `getHungerFavourValue` **sobrescreve** o resultado com `-1`.
- Personagem faminto em Defesa Total rola com desvantagem, não com rolagem normal (favor e desfavor se cancelando). Além disso, o mesmo cálculo é aplicado de novo no wrapper de `rollAttribute` (`init.mjs:218-238`).
- Decida a regra e mantenha **um** lugar que calcula o favor.

### 2.10 Menores — **Confirmado**
- `stand-up.mjs` (`queueRefreshActorButtons`) testa o tipo `"npc"`, que não existe no Symbaroum (`player`/`monster`).
- `sockets.mjs:422-429` (`markActiveTokensDead`) acha o combatente por `actor.id`. Em tokens não vinculados (monstros), todos compartilham o id e pode marcar o goblin errado como derrotado.
- `sockets.mjs:414-416` usa `Token#toggleEffect`, depreciado no v13 (o core loga aviso de compatibilidade).
- `ammo.mjs:33-50`: `getQuiverLoadedAmmo` devolve o array **do próprio documento** e `consumeAmmo` o altera antes de `setFlag`. Mutar dados do documento fora de `update` é frágil; clone antes.
- `maneuvers.mjs:110-120` mostra os atributos em português fixo ("Preciso", "Vigoroso") também para quem joga em inglês.

---

## 3. Persistência, concorrência e risco de dados

### 3.1 Auto-atribuição de carga: grava muito e não serve para nada — **Confirmado**
- `EncumbranceService.autoAssignSlots` grava `encumbranceSlots` + `encumbranceAutoAssigned` (2 escritas por item, `encumbrance.mjs:507-525`).
- Mas `getItemSlots` (`encumbrance.mjs:279-283`) **só** lê `encumbranceSlots` quando `encumbranceManual === true`. O valor auto-atribuído nunca é lido.
- Isso roda: no `ready` para todos os atores (`init.mjs:247-255`), em todo `createItem` em todos os clientes (`init.mjs:107-111`), ao abrir a ficha de item (`sheet-ui.mjs:1623`) e ao ligar a opção (`settings.mjs:478`).
- **Remoção recomendada.** Ganho direto: centenas de escritas a menos no carregamento e menos re-renders. Os flags antigos podem ficar (são inofensivos) ou ser limpos uma vez.

### 3.2 Hooks de documento que gravam em todos os clientes — **Confirmado**
Hooks como `createItem`, `updateItem`, `deleteActiveEffect` e `updateActor` disparam em **todos** os clientes. Quem grava precisa filtrar por `userId === game.user.id` ou por um único executor.
- `init.mjs:107-121` (`createItem`): sem filtro. GM e dono do personagem executam `autoAssignSlots` e `RationService.consolidate` ao mesmo tempo. A consolidação **apaga** itens; dois clientes apagando o mesmo item geram erro e estado inconsistente.
- `hunger.mjs:80-86`: ver 2.4.
- `settings.mjs:403-472` (`onChange` de configurações de mundo, que roda em todos os clientes): `refreshEncumbranceActors` dispara gravações em todo cliente dono de algum ator.

### 3.3 O `ready` do GM altera e apaga dados do mundo a cada carregamento — **Confirmado**
Em `init.mjs:123-300`, o GM principal executa em sequência, sempre que o mundo abre:
1. `InventoryCleanupService.cleanupExisting` (`inventory-cleanup.mjs:76-93`): **apaga todo equipamento com quantidade 0 em todos os atores do mundo**, inclusive monstros e PNJs, um por um. Está ligado por padrão (`settings.mjs:352`).
2. `autoAssignAll` + `applyDefensePenalty` para cada personagem (inútil, ver 3.1).
3. `recoverOrphanedStoredItems` + `synchronizeActorStates`, que podem **criar itens** (conteúdo do equipamento de acampamento).
4. Reconciliação de contêineres no chão (apaga tokens).
5. `RationService.consolidate` para cada personagem (apaga itens duplicados).
6. Reconciliação da automação de morte.

Problemas: (a) o carregamento fica lento porque tudo é `await` sequencial; (b) um item com quantidade 0 usado de propósito (ex.: "conhecido mas não possuído") desaparece sem aviso. Isso contradiz a regra nº 1 do seu próprio `AGENTS.md` ("preservar dados").
Recomendação: a limpeza deve ser uma **ação manual** com confirmação e lista do que será apagado, ou ficar desligada por padrão e restrita a personagens.

### 3.4 Gravação durante renderização — **Confirmado**
Seu `AGENTS.md` proíbe ("Não persista dados em hooks de renderização"), mas:
- `sheet-ui.mjs:1487-1493`: abrir a ficha pode disparar `RationService.consolidate` (apaga itens).
- `sheet-ui.mjs:1599-1627`: abrir a ficha de item dispara `autoAssignSlots`.

### 3.5 Monitor de arquivo de pesos — **Confirmado**
- `encumbrance.mjs:177-208`: o GM busca dois JSON a cada **10 segundos**, para sempre, enquanto o mundo estiver aberto.
- `encumbrance.mjs:754-772`: grava `worlds/<mundo>/tenebre-encumbrance-weights.json` via upload. Isso cria **duas fontes de verdade** (configuração do mundo + arquivo).
- É uma ferramenta de desenvolvimento que ficou em produção. Recomendação: manter só a configuração do mundo e oferecer um botão "recarregar pesos".

### 3.6 Estado global de rolagem — **Confirmado** (risco de concorrência)
O fluxo de ataque depende de variáveis globais e temporizadores:
- `game.tenebreResources.activeWeaponRoll`, `activeWeaponModifiers`, `activeManeuverWeaponRoll` (`weapon-wrapper.mjs`, `sheet-ui.mjs`), com limpeza por `setTimeout` de 60 s e 100 ms.
- `pendingDialogActorId`, `pendingPowerUseContext`, `activePowerChatContext` com expiração de 15 s (`init.mjs:417-661`).
- Rolagem privada: qualquer mensagem de rolagem do usuário nos 5 s seguintes vira privada (`roll-privacy.mjs:283`).
Dois diálogos abertos ao mesmo tempo, ou um macro rodando em paralelo, recebem o contexto errado. Correção: anexar o contexto ao objeto do diálogo (já existe `dialog._tenebreWeaponRoll`) e eliminar as variáveis globais.

### 3.7 Eleição de "GM principal" implementada 6 vezes, de formas diferentes
`init.mjs:257-258` (primeiro da coleção), `settings.mjs:495-499` (idem), `sockets.mjs:74-79` (`game.users.activeGM`), `encumbrance-visuals.mjs:146-156` (ordena por id), `death-automation.mjs:72-80` (outra ordenação), `hunger.mjs` (`#isChatAuthor`).
Com um Assistente de GM e um GM online, partes diferentes do módulo podem escolher executores diferentes. Use só `game.users.activeGM` (o core já resolve isso com `getDesignatedUser`).

### 3.8 Migração automática de conteúdo do usuário
`bithir-macros.mjs:943-1003` renomeia pastas, tabelas, resultados de tabela e macros do mundo **por coincidência de nome**, no `ready`. Se o usuário tiver uma tabela própria com o mesmo nome, ela é alterada. Deveria ser uma ação explícita, ou ao menos agir só sobre documentos marcados com um flag do módulo.

---

## 4. Arquitetura

### 4.1 Ficha de Grupo: recriar com o mecanismo nativo
`module.json` já declara `documentTypes.Actor.party`. No v13 isso **sozinho** cria o tipo `symbaroum-ind-resources.party`. Só faltam duas linhas: `CONFIG.Actor.dataModels[...] = PartyDataModel` e `registerSheet`.
Todo o resto de `party-actor.mjs` é desnecessário e arriscado:
- `298-340`: redefine o getter estático `Actor.TYPES`.
- `369-408`: redefine `game.documentTypes`, `game.system.documentTypes` e `game.model` como getters congelados. Isso substitui propriedades centrais do core, e qualquer módulo que as leia recebe a versão falsificada.
- `357-358`: `CONFIG.Actor.documentClasses` **não é uma API do Foundry**; a classe `PartyActor` nunca é usada.
- Adiciona também um tipo solto `"party"` que o servidor não reconhece; criar um ator com ele falha.
- `427-456`: monkey-patch em `prepareBaseData`/`prepareDerivedData` do ator do sistema, sem libWrapper, para **todos** os atores.
- `462-488`: injeta `<option>` no diálogo de criação, que o tipo nativo já lista.

### 4.2 Leitura do chat por texto (scraping)
`npc-attack-chat.mjs`, `opposed-test-chat.mjs`, `berserker-chat.mjs`, `pain-threshold-choice.mjs` e `init.mjs:156-215` reconstroem as mensagens do sistema lendo o HTML (`.introTxt`, `.finalTxt`, `.tooltip > p`) e frases localizadas (`/ataca com|attacks? with/`, `"está atordoado pela dor."`).
- Qualquer mudança de template do sistema, de tradução ou outro idioma (ex.: espanhol) quebra sem erro.
- Atores são localizados por **nome exibido** em todos os tokens e atores do mundo (`actorByDisplayedName`), para cada mensagem renderizada. Em mundos com histórico grande isso pesa ao abrir o chat.
- "Esconder detalhes de PNJ no chat" (`hideNpcDetailsInChat`) é **só visual**: o conteúdo original continua na mensagem e no DOM (`npc-attack-chat.mjs:176` apenas põe `hidden`). Qualquer jogador vê inspecionando. Não use como segredo.
Recomendação: usar os dados estruturados que o sistema já grava (`message.flags.symbaroum`, `rollData`) ou gerar o próprio card a partir do resultado do wrapper de rolagem, em vez de reler o HTML.

### 4.3 Monkey-patches sem libWrapper
O módulo usa libWrapper quando disponível em `init.mjs` e `weapon-wrapper.mjs` (bom), mas não em:
- `sheet-ui.mjs:229-243` (`activateListeners`), `74-98` (`_onDropItem`), `100-123` (`_itemDelete`), `184-201` (`sendToChat`).
- `party-actor.mjs:427-456`.
- `sheet-ui.mjs:268`: o patch do menu de contexto identifica o menu do sistema por `this.constructor.name === "CMPowerMenu"`, que quebra se a classe for renomeada ou o código minificado.

### 4.4 Indicadores visuais gravados como ActiveEffects
`encumbrance-visuals.mjs` e `weapon-readiness-visuals.mjs` criam e apagam **documentos** ActiveEffect só para mostrar um ícone no token. Cada mudança de carga ou de arma vira escrita no banco; os efeitos aparecem em listas de efeitos, no Token Action HUD e em outros módulos, e o botão "Limpar efeitos" precisa excluí-los manualmente.
Alternativa: desenhar o ícone no cliente (hook `refreshToken` + um sprite PIXI), sem gravar nada.

### 4.5 Contêiner no chão é uma cópia do personagem
`ground-containers.mjs:72-97` cria um token com `actorId` do **próprio personagem** e `actorLink: false`. O "baú no chão" é um ator sintético do PJ, com atributos, Vitalidade e itens. Ele entra em `allPlayerActors()` da automação de morte (`death-automation.mjs:629-639`) e nos indicadores de carga, e pode ser alvo de ataque.
Além disso, existe um caminho paralelo via Item Piles (`container-transfer.mjs`). Recomendação: escolher **um**. O Item Piles (já recomendado no `module.json`) resolve isso de forma padrão.

### 4.6 Ganchos espalhados
São ~115 registros de hook, vários no mesmo evento (`createItem` ×7, `updateItem` ×6, `deleteActiveEffect` ×6, `preCreateChatMessage` ×5). Cada handler repete as mesmas checagens (tipo do ator, configuração, autor). Um pequeno despachante por evento, com o filtro "sou o executor?" centralizado, eliminaria a classe de bugs da seção 3.2.

### 4.7 `setTimeout` como remendo
Vários pontos chamam a mesma função em 0, 100 e 500 ms "para garantir" (`sheet-ui.mjs:666-667`, `1112-1113`, `1122-1124`, `1179-1180`, `1248-1249`; `stand-up.mjs`). Isso indica corrida com o render da ficha. O lugar certo é o próprio hook de render (já interceptado em `activateListeners`); os timers geram trabalho triplicado e piscadas.

---

## 5. Desempenho

| Ponto | Onde | Custo | Correção |
|---|---|---|---|
| Carga recalculada em todo `prepareDerivedData` | `init.mjs:503-523` → `calculateLoad` | Roda em todo preparo de todo personagem em todo cliente; percorre todos os itens e listas grandes de nomes | Cache por ator invalidado em `updateItem`/`createItem`/`deleteItem` |
| Normalização de aliases a cada chamada | `containers.mjs:1177-1187`, `item-flags.mjs:434-437`, `encumbrance.mjs:614-643` | `normalize()` + regex em cada alias, para cada item, a cada render | Pré-computar `Set`s normalizados uma vez |
| Limpeza de manobras em todo `updateCombat` | `maneuvers.mjs:249-257`, `1169-1186` | Varre **todos** os atores do mundo + tokens + combatentes a cada alteração de combate (inclusive iniciativa) | Usar `combatTurnChange`/`combatRound` e só os combatentes |
| Botão "levantar" em `refreshToken` | `stand-up.mjs` (`Hooks.on("refreshToken")`) | `refreshToken` dispara muitas vezes por segundo durante movimento | Reagir só a mudanças de efeito/estado |
| `ready` sequencial | seção 3.3 | Centenas de `await` em série | Remover o que é inútil, agrupar o resto em `updateEmbeddedDocuments` |
| Recuperação de munição | `ammo.mjs:414-449` | Para N flechas: N rolagens 3D, N `setFlag` e N edições de mensagem | Rolar `Nd20` uma vez e gravar no fim |
| `clearDeathPrompts` | `death-automation.mjs:577-588` | Percorre todas as mensagens do mundo em cada transição | Guardar o id do prompt no flag do ator |
| Polling de 10 s | seção 3.5 | Rede contínua no cliente do GM | Remover |

---

## 6. Código para remover

**Código morto (sem uso no código nem nos testes):**
- `scripts/gm-panel.mjs` e `templates/gm-panel.hbs` (arquivos com um comentário "Deleted").
- `bithir-macros.mjs`: `isExternalBithirModuleActive`.
- `container-transfer.mjs`: `containerTransferConstants`.
- `encumbrance-db.mjs`: `isArmorByName`, `isClothing`, `isLightContainer`, `isSmallItem`, `getStackBundleSize`, `getStackBundleSlots`.
- `item-flags.mjs`: `sumAmmoShots`, `sumLoadedQuiverShots`; `localizeAmmoType` ignora o próprio parâmetro.
- `ammo.mjs`: `postAmmoCard`; `selectAmmo`/`promptAmmo` (só chamam um ao outro).
- `gm-log-service.mjs`: `recordItemQuantityChange`.
- `money.mjs`: `parseMoneyFormData` (só usado em teste).
- `settings.mjs`: a configuração `hideCompatibilityNotice` é registrada e nunca lida; `hideShadowGeneration`/`hideShadowLabel` são declaradas em dois lugares (aqui e em `bithir-macros.mjs:1011-1027`).
- `constants.mjs`: `AMMO_TYPES` tem `ARROW` e `BOLT` com o mesmo valor `"ammo"`.
- Toda a auto-atribuição de carga (3.1) e o monitor de arquivo (3.5).
- `verses.mjs` (`VerseService`) duplica `BithirMacros.thusSpoke`.
- ~98 chaves de tradução cuja última parte não aparece em nenhum script ou template (ex.: `TENEBRE.Settings.TabGeneral*`, `TENEBRE.Ammo.BadgeArrows`, `TENEBRE.Hud.Quivers`). A lista é heurística; revise antes de apagar.

**Duplicação a consolidar em `utils.mjs`:**
- `escapeHtml`: ~10 cópias (o core já tem `foundry.utils.escapeHTML`).
- `localize`/`format` com fallback: ~13 e ~5 cópias.
- `normalize`/`normalizeText`: várias variantes quase iguais.
- "Re-renderizar fichas do ator": 5 implementações.
- `getRoot`/`htmlElement`: 4.
- Eleição de GM principal: 6 (seção 3.7).
- "Marcar como morto": `sockets.mjs:370-431`, `hunger.mjs:237+`, `death-automation.mjs:561-575`.
- `containers.mjs:18-24` redefine `actorItems`/`itemQuantity`, que já existem em `item-flags.mjs`.

**Dados no lugar errado:**
- `constants.mjs:36-385`: 50 comidas codificadas no JS. Deveriam estar em `data/` como JSON, igual a `encumbrance-weights.json`.

---

## 7. Compatibilidade (v13 → v14)

- `ActiveEffect.icon` tem shim até a v14 (`common/documents/active-effect.mjs:111`). `maneuvers.mjs:1007-1021` e `death-automation.mjs:82-92` ainda enviam `icon`, e `socket-policy.mjs:77` **exige** `icon === img`. Remova `icon`/`label` dos dados e da política antes da v14.
- `Dialog` V1 ainda usado em `compatibility.mjs:594` e `death-automation.mjs:445-477` (há `DialogV2` no resto do módulo). O patch em `Dialog.prototype.render` (`init.mjs:424-461`) é necessário enquanto o sistema usar diálogos V1; monitore quando o sistema migrar.
- `bithir-macros.mjs:1057-1114` depende de jQuery (`html.closest(...).find(...)`) em `renderActorSheet`.
- `Token#toggleEffect` depreciado (2.10).
- `compatibility.mjs:448-486` reescreve em tempo de execução as regras CSS do módulo crlngn-ui. É frágil e pode quebrar o outro módulo; prefira seletores mais específicos no seu CSS.
- `compatibility.mjs:610-627` baixa de novo o arquivo de idioma que o Foundry já carregou.
- Arquivos com BOM no início (ex.: `compatibility.mjs`, `opposed-test-chat.mjs`, `resistance-chat.mjs`, `hotbar.mjs`).

---

## 8. Segurança e permissões

Pontos positivos: `socket-policy.mjs` usa allowlist de chaves, limita tamanho de payload, valida ícones e só deixa o jogador mexer em efeitos de manobra do próprio módulo. Bom trabalho.

Ajustes:
- `sockets.mjs:275-287` + `socket-policy.mjs:96-104`: qualquer jogador pode **reduzir a Vitalidade de qualquer ator que esteja mirando para qualquer valor menor**, inclusive 0, sem limite. É usado pelo dano do Empurrão, mas é uma porta aberta. Limite pelo dano calculado no próprio GM, ou exija confirmação do GM.
- `sockets.mjs:214`: a checagem de colisão do Empurrão usa `targetToken.object`, que é `null` se o GM estiver vendo outra cena. Nesse caso o token atravessa paredes. A distância `5` está fixa, sem considerar a unidade da cena.
- `resistance-chat.mjs:45-52`: o jogador que clica tenta apagar a mensagem; se ele não for o autor, a exclusão falha.
- `death-automation.mjs:432-436`: sem GM online, o próprio jogador resolve o Teste de Morte localmente. Aceitável, mas documente.
- Ver também 4.2: o "ocultar detalhes de PNJ" não protege informação.

---

## 9. Interface, i18n e conteúdo

- Textos fixos em português: "Sobrecarga" na Defesa (`encumbrance.mjs:687-688`), atributos das manobras (`maneuvers.mjs:110-120`), pasta "Alimentos" (`settings.mjs:800`), "Assim Falou Aroaleta" (`verses.mjs`), abreviações na ficha de Grupo (`party-actor.mjs:148-157`), conteúdo padrão do equipamento de acampamento (`containers.mjs:117-124`).
- Configurações: 8 menus compartilham um único template de 351 linhas com flags `show*`. Funciona, mas cada aba deveria ter seu template.
- CSS: 3.933 linhas, 76 `!important`, ~128 regras que estilizam classes do sistema (`.symbaroum ...`). A maioria está bem prefixada com `tenebre-`.

### Conteúdo e licenças (atenção antes de publicar)
- `assets/imported/symbaroumlore/images/Mapa.png` (**11,4 MB**, metade do tamanho do pacote) e `data/journal-import-manifest.json` (196 KB de texto extraído do site Symbaroumlore). Isso é conteúdo de terceiros sobre uma propriedade da Free League; verifique permissão de redistribuição.
- `assets/midjourney/non-paid/...` e `assets/npcgeneration/...`: os nomes dos arquivos trazem nomes de usuários do Midjourney que **não são você** ("Les_Dudas", "Kuffer", "SugarSniper", "Screw", "Sean"). Imagens do plano gratuito do Midjourney seguem CC BY-NC 4.0 (atribuição obrigatória, uso não comercial), e essas foram geradas por outras pessoas. Confirme a origem e registre em `THIRD_PARTY_NOTICES.md`.
- 4 imagens duplicadas byte a byte em pastas diferentes de `assets/npcgeneration/` (mulher bizantina, cultista, elfo, goblin). Use o mesmo caminho nos JSON dos geradores.
- O próprio `THIRD_PARTY_NOTICES.md` diz que a atribuição dos ícones do Game-icons.net ainda está pendente.

---

## 10. Testes e processo

- 315 testes passando, rodando em ~1 s, com CI no GitHub. Bom ponto de partida.
- Eles cobrem funções puras com mocks. **Nenhum** cobre o que falha de verdade aqui: hooks rodando em vários clientes, a sequência de morte, o `ready`, os diálogos do sistema.
- Alguns testes verificam o **texto do código-fonte** (testes "estáticos"), o que trava refatorações sem testar comportamento.
- Sugestão: um pequeno "simulador de clientes" nos testes (dois `game.user` e um `Hooks` que dispara em ambos) pegaria 2.4, 2.5 e 3.2 automaticamente.
- Com `AGENTS.md` pedindo validação "GM, jogador e jogador confiável", vale ter um roteiro manual curto, de 10 minutos, num mundo de teste, executado a cada release.

---

## 11. Plano de melhoria recomendado

**Andamento (branch `auditoria/fase-0`):** Fases 0 e 1 commitadas (`2e6c170`); Fase 2 aplicada (−832 linhas líquidas). Todas aguardam teste manual no Foundry.
Fase 2 manteve os métodos da API pública (`AmmoService.selectAmmo/promptAmmo`, `GmLogService.recordItemQuantityChange`, `VerseService`), porque macros externas podem usá-los.
Regras decididas: Defesa Total (e Ataque Total, pelo mesmo motivo) dura até o próximo turno do personagem; a Fome sempre vence o favor de manobras.
Munição especial: os modificadores entram como pacotes opcionais nativos do sistema (`scripts/ammo-roll.mjs`), marcados pelo seletor de munição.

**Fase 0 — proteger dados (pequena, alto impacto)**
1. Desligar por padrão a limpeza de itens com quantidade 0 e tirá-la do `ready` (3.3).
2. Adicionar filtro de autor no `createItem` de `init.mjs` e no `deleteActiveEffect` de `hunger.mjs` (3.2, 2.4).
3. Parar de gravar na renderização (3.4).
4. Corrigir o hook interno da automação de morte (2.5).

**Fase 1 — bugs confirmados**
5. Munição especial (2.1), rolagem privada (2.2), veneno (2.3), `instances.values()` (2.6), aliases por palavra (2.7).
6. Decidir as regras de 2.8 e 2.9.

**Fase 2 — remoções (reduz código e escritas)**
7. Remover auto-atribuição de carga, monitor de arquivo e todo o código morto da seção 6.
8. Consolidar helpers duplicados em `utils.mjs` e eleger o GM só por `game.users.activeGM`.

**Fase 3 — estrutura**
9. Ficha de Grupo pelo mecanismo nativo de sub-tipos (4.1).
10. Contexto de rolagem preso ao diálogo, sem globais (3.6).
11. Indicadores de token desenhados no cliente (4.4).
12. Escolher Item Piles ou contêiner próprio (4.5).
13. Despachante central de hooks (4.6).

**Fase 4 — longo prazo**
14. Substituir o scraping do chat por dados estruturados (4.2).
15. Preparar a v14 (seção 7).
16. Resolver licenças dos assets antes de publicar (seção 9).

Estimativa grosseira: as fases 0–2 removem na casa de mil linhas e eliminam a maior parte das escritas automáticas no banco, sem mudar o que o jogador vê.
