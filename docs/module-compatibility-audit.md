# Auditoria de Compatibilidade de Modulos

Data da auditoria: 2026-07-02

Escopo auditado:

- Pasta local de modulos do Foundry VTT v13.
- Checkout de desenvolvimento do `symbaroum-ind-resources`.
- Mundo testado: `AAA`
- Foundry observado no console: `Version 13 Build 350`
- Total de modulos encontrados por `module.json`: 36

## Resultado Executivo

O carregamento ao vivo do mundo foi testado com os modulos ativos e nao apresentou erros de console depois das correcoes aplicadas no `symbaroum-ind-resources`.

Prova principal do reload ao vivo apos a guarda de compatibilidade:

- Total de logs capturados na ultima leitura: 500
- Total de erros capturados: 0
- Sinal da guarda de compatibilidade: `symbaroum-ind-resources | Compatibility guard active.`
- Sinal de carregamento do nosso modulo: `symbaroum-ind-resources | v0.2.26 ready.`
- Sinais de carregamento de modulos de integracao:
  - `Metamorph | Initializing`
  - `indy-fx | ready hook fired`
  - `Automated Animations Database has been compiled and registered`
  - Templates do `token-action-hud-core` carregados
  - Localizacoes de `symbaroum-bithir-mod`, `tokenizer-2`, `vtta-tokenizer`, `token-action-hud-symbaroum`, `indy-fx`, `monks-scene-navigation` e outros carregadas

## Correcoes Aplicadas no Nosso Modulo

### 1. Compatibilidade com `lib-wrapper`

O modulo passou a recomendar `lib-wrapper` em `module.json`.

Motivo: varios modulos instalados alteram funcoes do Foundry, fichas, tokens, HUDs ou rolagens. Quando todos fazem isso por sobrescrita direta, um modulo pode apagar o wrapper do outro. O `lib-wrapper` encadeia essas alteracoes com prioridade e evita perda de comportamento.

Areas do nosso modulo migradas ou protegidas:

- `game.symbaroum.api.rollAttribute`
- `Dialog.prototype.render`
- `CONFIG.Actor.documentClass.prototype.usePower`
- `CONFIG.Actor.documentClass.prototype.prepareDerivedData`
- `CONFIG.Actor.documentClass.prototype.rollWeapon`
- `CONFIG.Token.documentClass.prototype._preUpdateMovement`
- `foundry.applications.ux.ContextMenu.prototype.render`

### 1.1. Guarda Central de Compatibilidade

Foi adicionada a camada `scripts/compatibility.mjs`.

Ela concentra as decisoes de compatibilidade e expõe diagnostico em:

```js
game.tenebreResources.compatibility.getReport()
game.tenebreResources.diagnostics.compatibility
```

O objetivo e evitar decisoes espalhadas pelo codigo. Se um modulo externo dono de uma area estiver ativo, o `symbaroum-ind-resources` cede aquela area e registra a decisao por `console.info`, sem lançar erro e sem bloquear o carregamento do mundo.

Quando houver decisao relevante para o usuario (`Cedido`, `Risco externo` ou `Aviso externo`), o modulo tambem exibe um aviso visual no `ready` do Foundry. Esse aviso lista:

- modulo(s) envolvidos;
- funcionalidade afetada;
- o que foi desativado, cedido ou pode falhar por risco externo.

O aviso aparece em cada abertura/F5 ate o usuario marcar `Nao mostrar mais esta mensagem`. Essa preferencia e salva em setting `client` (`hideCompatibilityNotice`), portanto vale para aquele usuario/navegador.

### 2. Correcao de Registro Duplicado de Movimento

O wrapper de validacao de movimento nao e mais registrado duas vezes.

Antes, o registro podia acontecer no `init` e no `ready`, causando erro do `lib-wrapper` para `_preUpdateMovement`. Isso poderia interromper o carregamento do nosso modulo e parecer travamento geral.

### 3. Compatibilidade com `drag-ruler`

Se `drag-ruler` estiver ativo, o `symbaroum-ind-resources` nao substitui mais `CONFIG.Token.rulerClass` e nao registra o wrapper de validacao em `CONFIG.Token.documentClass.prototype._preUpdateMovement`.

Motivo: `drag-ruler` tambem controla regua/movimento. Substituir a classe da regua ou interceptar a validacao de movimento ao mesmo tempo e conflito estrutural. A decisao atual e ceder a area de regua/movimento ao `drag-ruler` quando ele estiver ativo. As outras partes do modulo continuam funcionando normalmente.

Prova: o reload ao vivo nao apresentou erro do nosso modulo com `drag-ruler` ativo.

### 4. Compatibilidade com `symbaroum-bithir-mod`

Se `symbaroum-bithir-mod` estiver ativo, o nosso modulo nao carrega a copia interna das utilidades Bithir e nao sobrescreve `game.bithirmod`.

Motivo: o erro anexado vinha de conflito de namespace:

```text
"symbaroum-ind-resources.devMessageVersionNumber" is not a registered game setting
Detected package: symbaroum-bithir-mod
```

Causa: os dois modulos tentavam usar `game.bithirmod`. A copia interna do nosso modulo apontava o namespace para `symbaroum-ind-resources`, e o modulo oficial do Bithir tentava ler uma setting que ele registrou em `symbaroum-bithir-mod`.

Solucao: quando o modulo oficial esta ativo, nosso modulo pula a copia interna.

Prova: depois da correcao, o reload ao vivo registrou 0 erros.

## Riscos Externos Encontrados

Estes pontos nao sao causados pelo `symbaroum-ind-resources`, mas podem gerar avisos, erros ou comportamento estranho no mundo:

| Modulo | Risco | Solucao recomendada |
|---|---|---|
| `drag-ruler` | Verificado para Foundry 11, gera avisos de API depreciada no Foundry 13 (`Token`, `MeasuredTemplate`, `TokenLayer`). | Usar versao compativel com Foundry 13, desativar se causar conflito, ou manter com a protecao aplicada no nosso modulo. |
| `token-sounds` | `minimum: 14`, mas o Foundry observado e v13. | Desativar no Foundry 13 ou atualizar o Foundry para versao suportada pelo modulo. |
| `tabletop-rpg-music` | Verificado ate Foundry 12. | Testar manualmente audio/playlist; se gerar erro, trocar por versao compativel. |
| `calendaria-sdm` | Requer dependencia `calendaria`, nao encontrada na pasta de modulos. | Instalar `calendaria` ou desativar `calendaria-sdm`. |
| `vtta-tokenizer` + `tokenizer-2` | Dois tokenizers ativos ao mesmo tempo. | Manter ambos apenas se o fluxo exigir; se houver conflito visual/menus duplicados, escolher um. |
| `token-variants` | Console indicou caminho ausente: `data:modules/caeora-maps-tokens-assets/assets/tokens`. | Ajustar caminho/configuracao do Token Variant Art ou instalar o pacote de assets esperado. |

## Auditoria por Modulo

Legenda:

- `OK`: carregou no ambiente auditado sem erro atribuido ao nosso modulo.
- `Cedido`: nosso modulo desativou parte propria para nao disputar area do outro modulo.
- `Risco externo`: risco vem da versao/configuracao/dependencia do outro modulo.
- `Prova`: evidencia usada na auditoria estatica ou no console ao vivo.

| Modulo | Versao | Area sensivel | Status com nosso modulo | Prova / solucao |
|---|---:|---|---|---|
| `ATL` - Active Token Effects | v1.1.1 | Canvas/token hooks e configuracoes. | OK | Sem erro no console ao vivo. Nosso modulo nao altera hooks de luz/token usados pelo ATL. |
| `JB2A_DnD5e` - JB2A Free Content | 0.9.0 | API de assets para Sequencer/Automated Animations. | OK | Automated Animations compilou a base; nosso chat de itens usa flags/contexto e nao altera API JB2A. |
| `autoanimations` - Automated Animations | 6.8.5 | Chat messages, Sequencer, socketlib. | OK | Console: `Automated Animations Database has been compiled and registered`. Nosso modulo envia mensagens com contexto sem bloquear criacao de chat. |
| `babele` - Babele | 2.9.1 | Traducao de compendios, `lib-wrapper`. | OK | Localizacoes/compendium translations carregaram; nosso modulo nao intercepta Babele. |
| `bossbar` - Bossbar | 4.0.0 | Controles de cena e HUD proprio. | OK | Console anexado mostrou `Boss Bar | getSceneControlButtons`; nosso modulo nao altera scene controls. |
| `calendaria-sdm` - Calendaria: SDM | 0.3.0 | Depende de `calendaria`. | Risco externo | `module.json` exige `calendaria`, que nao foi encontrado. Instalar a dependencia ou desativar. |
| `combat-tracker-dock` - Carousel Combat Tracker | 4.1.8 | Combat tracker, `lib-wrapper` em `Combatant.prototype.visible`. | OK | Nosso modulo usa hooks de combate e Token Action HUD, mas nao sobrescreve Combat Tracker. Sem erro ao carregar. |
| `dice-calculator` - Dice Tray | 3.5.5 | Chat log/dice tray. | OK | Template `modules/dice-calculator/templates/tray.html` compilou; nossas rolagens usam Dice/ChatMessage sem bloquear o tray. |
| `dice-so-nice` - Dice So Nice! | 5.3.4 | Animacao 3D de dados. | OK | Nosso fluxo de dados usa caminho compativel com Dice So Nice; sem erro no reload. |
| `drag-ruler` - Drag Ruler | 1.13.7 | Regua, token movement, libWrapper. | Cedido / risco externo | Nosso modulo nao troca `CONFIG.Token.rulerClass` e nao envolve `_preUpdateMovement` quando ele esta ativo. O risco restante e externo: modulo verificado para Foundry 11. |
| `hide-player-ui` - Hide Player UI | 1.9.1 | UI de jogador. | OK | Nosso modulo injeta controles em fichas/HUD proprio, nao no mesmo painel de ocultacao de UI. Sem erro no reload. |
| `image-hover` - Image Hover | 3.1 | HUD/canvas hover. | OK | Nosso modulo nao altera `canvas.hud.imageHover` nem hover de token. Sem erro no reload. |
| `indy-fx` - Indy FX | 1.2.6 | Token HUD, Tile HUD, canvas/shaders. | OK | Console: `indy-fx | ready hook fired`. Nosso modulo nao intercepta Token HUD; nao bloqueia Indy FX. |
| `journal-font-scaler` - Journal Scaler | 1.1.0 | Wheel/mouse em journal via `lib-wrapper`. | OK | Nosso modulo nao altera journals nem mouse wheel. |
| `lib-wrapper` - libWrapper | 1.13.5.1 | Encadeamento de patches. | OK / recomendado | Agora recomendado e usado pelo nosso modulo para patches criticos. |
| `lordudice` - Lordu's Custom Dice | 0.43 | Dice So Nice presets/fontes. | OK | Nosso modulo nao registra os mesmos presets/fontes. Sem erro no reload. |
| `metamorph` - Metamorph | 1.0.1 | Token HUD e troca de token/ator. | OK | Console: `Metamorph | Initializing`. Nosso modulo nao injeta Token HUD, entao nao bloqueia botoes do Metamorph. |
| `monks-scene-navigation` - Monk's Scene Navigation | 13.03 | Navegacao de cena, `CONFIG.ui.nav`, wrappers. | OK | Console: `Initializing Monks Scene Navigation`; templates de navegacao carregaram. Nosso modulo nao altera scene navigation. |
| `nice-more-dice` - Nice more Dice | 1.4.1 | Hook `diceSoNiceReady`. | OK | Nosso modulo nao interfere em presets de Dice So Nice. |
| `sequencer` - Sequencer | 4.2.2 | Motor de animacoes. | OK | Automated Animations carregou, o que depende do Sequencer. Nosso modulo nao altera API do Sequencer. |
| `simplefog` - Simple Fog | 1.4.4 | Canvas, walls, fog layer. | OK | Nosso modulo nao altera walls/fog/simplefog. Sem erro no reload. |
| `smarttarget` - Smart Target | 3.0.1 | Token click/target via `lib-wrapper`. | OK | Nosso modulo nao envolve click de token. Uso de `lib-wrapper` evita sobrescrita de wrappers. |
| `socketlib` - socketlib | v1.1.4 | Comunicacao socket. | OK | Dependencia do nosso modulo e de outros; carregamento sem erro. |
| `symbaroum-bithir-mod` - Bithir's Symbaroum Mods | 4.1 | `game.bithirmod`, settings e dados customizados. | Corrigido | Nosso modulo agora pula a copia interna Bithir quando o oficial esta ativo. Reload ao vivo: 0 erros. |
| `symbaroum-corerules` - Symbaroum Core Rulebook | 2.2.0 | Adventure import/compendium. | OK | Modulo carregado; nosso modulo nao altera import do core rules. |
| `symbaroum-ind-resources` | 0.2.26 | Fichas, rolagens, peso, fome, movimento, chat. | OK | Console ao vivo: `symbaroum-ind-resources | v0.2.26 ready.` Nenhum erro capturado. |
| `symbaroum-ptBR` | 1.0.0 | Babele/traducao de compendios. | OK | Traducoes carregaram; nosso modulo trabalha com i18n propria e nao bloqueia Babele. |
| `tabletop-rpg-music` | 3.4.0 | Audio/playlist. | Risco externo | Verificado ate Foundry 12. Nosso modulo nao altera playlists/audio. Testar manualmente se continuar ativo no v13. |
| `token-action-hud-core` | 2.0.16 | HUD de acoes. | OK | Templates do HUD carregaram; nosso modulo integra por hooks oficiais `tokenActionHudCore*`. |
| `token-action-hud-symbaroum` | 1.3.0 | Acoes de Symbaroum no Token Action HUD. | OK | Localizacao carregada; nossa integracao chama hooks de refresh e nao sobrescreve handlers do modulo. |
| `token-frames` | 1.7.0 | Frames para tokenizer. | OK | Tokenizer 2 registrou frame loader `token-frames`; sem erro. |
| `token-sounds` - Token Audio FX | 0.0.5 | Token hooks/audio. | Risco externo | `module.json` exige Foundry 14. Nosso modulo nao altera token audio. Desativar no Foundry 13 se gerar erro. |
| `token-variants` - Token Variant Art | 6.1.3 | Token images, search paths, HUD. | OK com aviso externo | Console indicou caminho de asset ausente; nao e causado pelo nosso modulo. Nosso modulo nao altera Token Variant Art. |
| `tokenizer-2` - Tokenizer 2 | 1.2.2 | Tokenizacao e frame registry. | OK | Console: migrou flags, registrou `token-frames`, concluiu scans sem erro. |
| `tokenmagic` - Token Magic FX | 0.7.6.3 | Pixi filters, libWrapper, templates. | OK | Console: `TokenMagic | Hook -> ready`. Avisos de Pixi/deprecacao pertencem ao proprio stack grafico. |
| `vtta-tokenizer` - Tokenizer | 5.0.3 | Tokenizer antigo. | OK com risco operacional | Console: `Tokenizer | Ready Hook Called`. Pode haver duplicidade operacional com `tokenizer-2`, mas nosso modulo nao interfere. |

## Provas Tecnicas Guardadas Durante a Auditoria

Artefatos temporarios gerados para a auditoria local:

- `.codex-module-audit.json`: inventario estatico dos 36 modulos e pontos sensiveis.
- `.codex-live-console-audit.json`: console filtrado do reload ao vivo.

Esses arquivos sao temporarios de trabalho e nao precisam ser publicados. A conclusao relevante esta consolidada nesta documentacao.

## Politica de Compatibilidade Para o Nosso Modulo

Para evitar que o `symbaroum-ind-resources` bloqueie outros modulos, as seguintes regras devem ser mantidas no codigo:

1. Preferir hooks oficiais do Foundry em vez de sobrescrever prototipos.
2. Quando for inevitavel envolver uma funcao do sistema/Foundry, usar `lib-wrapper`.
3. Nunca sobrescrever namespaces globais de outros modulos, como `game.bithirmod`, quando o modulo dono estiver ativo.
4. Nao substituir classes globais de regua/token/canvas quando outro modulo especializado estiver ativo.
5. Qualquer injecao em ficha deve chamar e retornar o metodo original.
6. Context menus e chat messages devem adicionar comportamento, nao impedir callbacks originais.
7. Toda nova compatibilidade deve ser verificada com reload do mundo e console sem erros.
8. Novas excecoes de compatibilidade devem entrar em `scripts/compatibility.mjs`, nao espalhadas por cada feature.

## Conclusao

No estado auditado, o `symbaroum-ind-resources` nao bloqueia nem trava o carregamento dos modulos instalados. O erro real encontrado no console era a disputa com `symbaroum-bithir-mod`, e foi corrigido no nosso modulo.

Os riscos restantes sao externos ao nosso codigo e dependem de versao/configuracao dos outros modulos: `drag-ruler` antigo para Foundry 13, `token-sounds` feito para Foundry 14, `calendaria-sdm` sem a dependencia `calendaria`, e possivel duplicidade operacional entre `vtta-tokenizer` e `tokenizer-2`.
