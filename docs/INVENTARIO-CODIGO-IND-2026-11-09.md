# Inventário técnico e achados — IND Resources

Referência: v0.19.3, commit 9ef05078ce3d5acfd602314d83756ef1cbd2cd7b, 09/11/2026. [Checklist completo](AUDITORIA-FUNCIONAL-2026-11-09.md).

## Método e limites

Foram enumerados todos os arquivos de scripts, percorrido o grafo de imports desde init.mjs e analisados os nós de função com parser ECMAScript. O inventário inclui métodos públicos/privados, getters, funções locais, funções de seta e callbacks. A leitura dos fluxos e das configurações gerou o roteiro manual. Enumeração sintática não prova correção de cada linha nem execução de cada callback. Os números abaixo não são cobertura de testes.

A enumeração foi repetida sobre uma cópia limpa da publicação. Os bancos LevelDB dos packs foram inspecionados em cópias, sem alterações nos originais. Testes, ferramentas de build, templates, CSS, idiomas, JSON e CI integram a relação de arquivos e hashes, mas não são apresentados como botões de usuário.

## Contagens

| Item | Publicação | Checkout local |
| --- | ---: | ---: |
| Scripts de runtime | 78 | 79 |
| Linhas físicas em scripts | 29399 | 29496 |
| Nós de função/método/callback | 2802 | 2815 |
| Nós com nome inferível | 1786 | 1796 |
| Configurações registradas principais | 60 | 60 |
| Configurações adicionais de calendário | 8 | 8 |
| Configuração interna de migração Bithir | 1 | 1 |
| Menus principais de configuração | 8 | 8 |
| Verificações manuais deste roteiro | — | 786 |

Os 69 registros de settings incluem estados internos ocultos; não são 69 switches visíveis. As opções compostas do calendário têm os campos documentados abaixo.

## Achados atuais

### A01 — Envio adicional de itens ao chat está pausado

**Classificação:** Confirmado no código; decisão de escopo.

**Evidência:** scripts/chat-item-use.mjs:8 e isEnabled(): CHAT_ITEM_USE_PAUSED=true impede a rota mesmo com enableChatItemUse=true.

**Consequência e decisão pendente:** Não tratar esse recurso como disponível no formulário atual. Cards e envio nativos do sistema continuam sendo outra rota.

**Teste manual:** 546.

### A02 — README cita macros que não estão na Adventure atual

**Classificação:** Confirmado por leitura dos compêndios.

**Evidência:** packs/symbaroum-ind-resources contém cinco macros. Não há macros separadas de experiência, rerrolagem ou corrupção temporária; Gerar Miniaturas está presente.

**Consequência e decisão pendente:** A lista foi baseada nos documentos reais do pacote; o README precisa de revisão numa futura atualização.

**Teste manual:** 378.

### A03 — Não existe uma opção dedicada de mensagem de munição especial

**Classificação:** Confirmado no registro de settings.

**Evidência:** README menciona Exibir munições especiais no chat, mas as 60 chamadas register de settings.mjs não registram um toggle dedicado para essa função.

**Consequência e decisão pendente:** Links de munição são testados pelo comportamento integrado; não procurar uma configuração inexistente.

**Teste manual:** 108.

### A04 — Limpar efeitos apaga mais que manobras

**Classificação:** Confirmado no código; confirmar intenção na mesa.

**Evidência:** scripts/sheet-ui.mjs:clearActorEffects seleciona todos os efeitos do Actor com id, exceto indicadores de prontidão, e os exclui.

**Consequência e decisão pendente:** Pode retirar efeitos nativos e de outros módulos. Testar em cópia e decidir se o comando deve ser limitado no futuro.

**Teste manual:** 243.

### A05 — Limpeza de existentes e limpeza por evento têm escopos diferentes

**Classificação:** Confirmado no código; diferença de alcance.

**Evidência:** scripts/inventory-cleanup.mjs:cleanupExisting filtra actor.type=player; isDepletableInventoryItem aceita equipment pertencente a qualquer Actor nos hooks de criação/atualização.

**Consequência e decisão pendente:** Com opção ativa, um equipamento de PNJ atualizado para zero também pode ser excluído. Não confundir isso com a varredura restrita aos jogadores.

**Teste manual:** 026.

### A06 — Dinheiro não possui fila própria para alterações concorrentes

**Classificação:** Risco estático; não reproduzido no Foundry.

**Evidência:** scripts/money.mjs:MoneyService.open lê actor.system.money, calcula novo saldo e faz actor.update diretamente.

**Consequência e decisão pendente:** Duas sessões que calculem sobre o mesmo saldo podem perder uma atualização. O roteiro contém tentativa simultânea para confirmar ou descartar o problema.

**Teste manual:** 188.

### A07 — Falhas de Médico Novato/Adepto ainda curam 1

**Classificação:** Confirmado no código; divergência de descrição.

**Evidência:** scripts/herbal-cure-rules.mjs:herbalCureFormula retorna 1 na falha de níveis 1 e 2; o README só explicita cura na falha do Mestre.

**Consequência e decisão pendente:** O esperado do roteiro reproduz o código atual. A adequação da regra e eventual mudança ficam para decisão posterior.

**Teste manual:** 074.

### A08 — Duas tabelas de Sombra contêm faixas inalcançáveis pela fórmula própria

**Classificação:** Confirmado nos dados do pacote.

**Evidência:** civilised-quick-strong usa 1d10, mas contém resultados com faixas 11, 12 e 13; natural-accurate-vigilant usa 1d22, mas contém faixa 23.

**Consequência e decisão pendente:** BithirApi.parseSimpleElement usa table.roll() sem acrescentar modificador a essas tabelas; as faixas excedentes não são sorteadas por essa rota.

**Teste manual:** 372.

### A09 — Finalizar dia ligado ao calendário não está na release 0.19.3

**Classificação:** Confirmado no código; interface local ainda não publicada.

**Evidência:** scripts/expedition-calendar.mjs não existe no commit de referência; party-actor.mjs e expedition-state.mjs possuem alterações locais.

**Consequência e decisão pendente:** A release usa os controles de próximo/anterior dia de Grupo. Os casos locais estão sinalizados e não são requisitos da instalação online atual.

**Teste manual:** 505.

### A10 — Várias munições especiais fornecem descrição, sem automação completa

**Classificação:** Limite funcional confirmado.

**Evidência:** scripts/special-ammo.mjs reconhece onze tipos; getAmmoModifiers cria pacotes específicos para precisão, perfuração e flamejante.

**Consequência e decisão pendente:** Não interpretar texto descritivo como teste, dano, queda ou condição automaticamente executados em todos os onze tipos.

**Teste manual:** 115.

### A11 — Ocultar detalhes de PNJ não equivale a uma permissão de documento

**Classificação:** Limite de apresentação.

**Evidência:** scripts/npc-attack-chat.mjs:canViewNpcDamageDetails controla a apresentação do resumo; o card compacto preserva a ChatMessage e conteúdo original.

**Consequência e decisão pendente:** A audiência continua sendo a da mensagem nativa. Verificar dados recebidos pelo jogador; usar modos nativos privados/cegos para segredos reais.

**Teste manual:** 305.

### A12 — Descanso e consumo não executam todas as consequências narrativas

**Classificação:** Confirmado no código; interação não automatizada.

**Evidência:** RestService não chama o calendário; RationService não remove automaticamente o status Fome ao consumir.

**Consequência e decisão pendente:** Essas ações estão em itens próprios do checklist para decidir se a futura atualização deve integrá-las.

**Teste manual:** 067.

## Todas as configurações principais

Padrão é o valor inicial de um mundo sem valor salvo. Não descreve a configuração atualmente escolhida no servidor. O campo do formulário pode ter apresentação diferente do tipo persistido, como Original/Ind Resources armazenado em Boolean.

| Chave | Nome PT-BR | Tipo | Padrão | Escopo | Acesso |
| --- | --- | --- | --- | --- | --- |
| `enableRations` | Ativar Pão de Viagem | Boolean | ligado | world | formulário de categoria |
| `rationUses` | Usos por pão | Number | 7 | world | formulário de categoria |
| `enableOtherRations` | Usar outros alimentos | Boolean | desligado | world | formulário de categoria |
| `extraRationFoods` | Alimentos configuráveis | Object | objeto com 49 alimentos, inicialmente desabilitados | world | formulário de categoria |
| `enableAmmoConsumption` | Ativar consumo automático | Boolean | ligado | world | formulário de categoria |
| `enableQuiverAmmoContainers` | Usar aljava carregada | Boolean | ligado | world | formulário de categoria |
| `quiverCapacity` | Capacidade da aljava | Number | 12 | world | formulário de categoria |
| `enableHitTracking` | Ativar rastreamento de acertos | Boolean | ligado | world | formulário de categoria |
| `enableAmmoRecovery` | Ativar recuperação | Boolean | ligado | world | formulário de categoria |
| `enableAmmoRecoveryByQuality` | Recuperação por tipo/qualidade | Boolean | ligado | world | formulário de categoria |
| `ammoRecoveryFlatTarget` | Recuperação única | Number | 10 | world | formulário de categoria |
| `ammoRecoveryCommonTarget` | Recuperação comum | Number | 10 | world | formulário de categoria |
| `ammoRecoveryQualityTarget` | Recuperação de qualidade | Number | 15 | world | formulário de categoria |
| `ammoRecoveryMysticalTarget` | Recuperação mística | Number | 17 | world | formulário de categoria |
| `showAmmoRecoveryHud` | Exibir botão de recuperação na HUD | Boolean | ligado | world | formulário de categoria |
| `showQuiverHud` | Exibir aljavas na HUD | Boolean | ligado | world | formulário de categoria |
| `enableHunger` | Ativar Fome | Boolean | ligado | world | formulário de categoria |
| `enableRestHealing` | Ativar recuperação automática | Boolean | ligado | world | formulário de categoria |
| `restHealing` | HP/Vitalidade por dia de descanso | Number | 1 | world | formulário de categoria |
| `enableRestButton` | Exibir botão Descanso nas fichas | Boolean | ligado | world | formulário de categoria |
| `enableEncumbrance` | Ativar Sobrecarga | Boolean | ligado | world | formulário de categoria |
| `enableContainers` | Ativar gerenciamento de recipientes | Boolean | ligado | world | formulário de categoria |
| `containerExpansionState` | Estado de expansão dos recipientes | Object | {} | client | interno/pausado |
| `enableMovementRuler` | Ativar régua de movimento | Boolean | ligado | world | formulário de categoria |
| `enableMovementColors` | Colorir régua por distância | Boolean | ligado | world | formulário de categoria |
| `enableMovementLimitLabels` | Exibir limites na etiqueta | Boolean | ligado | world | formulário de categoria |
| `enableMovementBlocking` | Bloquear movimento acima do limite | Boolean | ligado | world | formulário de categoria |
| `enableMovementHungerModifier` | Aplicar Fome ao movimento | Boolean | ligado | world | formulário de categoria |
| `enableMovementEncumbranceModifier` | Aplicar Sobrecarga ao movimento | Boolean | ligado | world | formulário de categoria |
| `enableMovementEffectModifiers` | Aplicar efeitos e manobras ao movimento | Boolean | ligado | world | formulário de categoria |
| `movementUnitSystem` | Unidades de movimento | String | meters | world | formulário de categoria |
| `movementBaseMeters` | Distância de um movimento (metros) | Number | 10 | world | formulário de categoria |
| `movementBaseFeet` | Distância de um movimento (pés) | Number | 30 | world | formulário de categoria |
| `enableManeuvers` | Ativar manobras | Boolean | ligado | world | formulário de categoria |
| `enableDeathAutomation` | Automatizar morte de personagens | Boolean | ligado | world | formulário de categoria |
| `enableRollPrivacy` | Exibir opção de rolagem privada | Boolean | ligado | world | formulário de categoria |
| `enableCompactNpcAttackChat` | Apresentação das mensagens | Boolean | ligado | world | formulário de categoria |
| `hideNpcDetailsInChat` | Ocultar detalhes de NPC | Boolean | desligado | world | formulário de categoria |
| `enableWeaponReadiness` | Ativar Sacar/Guardar Arma | Boolean | ligado | world | formulário de categoria |
| `enableWeaponReadinessCombatSync` | Colocar em combate ao sacar arma | Boolean | desligado | world | formulário de categoria |
| `showWeaponReadinessButton` | Exibir botão flutuante Sacar/Guardar Arma | Boolean | ligado | world | formulário de categoria |
| `showWeaponReadinessTokenIndicator` | Exibir arma sacada no token | Boolean | ligado | world | formulário de categoria |
| `enableWeaponReadinessAnimation` | Animar Sacar/Guardar Arma | Boolean | ligado | world | formulário de categoria |
| `showWeaponReadinessChatMessages` | Exibir mensagens de Sacar/Guardar Arma no chat | Boolean | desligado | world | formulário de categoria |
| `weaponReadinessButtonPosition` | Posição do botão Sacar/Guardar Arma | Object | {} | client | interno/pausado |
| `enableChatItemUse` | Ativar uso e envio de itens/habilidades no chat | Boolean | ligado | world | interno/pausado |
| `enableAutomatedAnimationsIntegration` | Ativar integração com Automated Animations | Boolean | ligado | world | formulário de categoria |
| `enableClearEffectsButton` | Exibir botão Limpar efeitos | Boolean | ligado | world | formulário de categoria |
| `showAppliedStatusEffectChatMessages` | Enviar condição aplicada para o chat | Boolean | ligado | world | formulário de categoria |
| `enableTokenActionHudIntegration` | Ativar integração com Token Action HUD | Boolean | ligado | world | formulário de categoria |
| `enableBithirUtilities` | Ativar macros e tabelas de utilidade | Boolean | ligado | world | formulário de categoria |
| `enableRitualCatalog` | Ativar catálogo de rituais | Boolean | ligado | world | formulário de categoria |
| `enableRitualistGrouping` | Agrupar rituais em Ritualista | Boolean | ligado | world | formulário de categoria |
| `enableGmLog` | Ativar Registro do Mestre | Boolean | ligado | world | formulário de categoria |
| `enableInventoryCleanup` | Excluir equipamentos esgotados automaticamente | Boolean | desligado | world | formulário de categoria |
| `enableGenerateShadow` | Ativar Gerar Sombra | Boolean | ligado | world | formulário de categoria |
| `hideShadowGeneration` | Ocultar geração de Sombra | Boolean | desligado | world | formulário de categoria |
| `hideShadowLabel` | Ocultar texto de Sombra | Boolean | desligado | world | formulário de categoria |
| `compatibilityNoticeAcknowledged` | Avisos de compatibilidade reconhecidos | Object | {"version":1,"signatures":[]} | client | interno/pausado |
| `encumbranceDiscoveredWeights` | Pesos descobertos automaticamente | Object | {"version":2,"items":{},"bundles":{}} | world | interno/pausado |

## Configurações adicionais e preferências do calendário

| Chave | Tipo | Padrão bruto | Escopo | Onde é usada |
| --- | --- | --- | --- | --- |
| `enableCalendar` | Boolean | ligado | world | Configuração geral: ativar calendário |
| `calendarDate` | Object | {} | world | Âncora da data; estado interno |
| `calendarClockRunning` | Boolean | desligado | world | Estado do botão iniciar/parar |
| `calendarClockSpeed` | Number | 1 | world | Velocidade 0,01 a 86400 |
| `calendarWorldOptions` | Object | {} | world | Integração, permissão, luz solar; valores normalizados abaixo |
| `calendarIndependentTime` | Object | {} | world | Relógio independente; estado interno |
| `calendarClientOptions` | Object | {} | client | Preferências locais; valores normalizados abaixo |
| `calendarClockManualPause` | Boolean | desligado | world | Estado da pausa manual |

`utilityTranslationMigrationVersion`: Number, world, padrão 0, config:false; controla migração dos documentos de utilidade quando o Bithir interno é registrado. Não é campo de menu.

Os objetos do calendário têm padrão bruto vazio no registro e recebem estes valores normalizados ao serem lidos:

| Objeto | Campo | Padrão normalizado |
| --- | --- | --- |
| calendarWorldOptions | integration | mixed |
| calendarWorldOptions | combatPause | never |
| calendarWorldOptions | playerView | ligado |
| calendarWorldOptions | controlRoles | [] |
| calendarWorldOptions | controlUsers | [] |
| calendarWorldOptions | daylight | {"Autumn":[21600,64800],"Winter":[21600,64800],"Spring":[21600,64800],"Summer":[21600,64800]} |
| calendarClientOptions | mode | full |
| calendarClientOptions | theme | dark |
| calendarClientOptions | layout | full |
| calendarClientOptions | scale | 100 |
| calendarClientOptions | openOnLoad | desligado |
| calendarClientOptions | rememberPosition | ligado |
| calendarClientOptions | showClock | ligado |
| calendarClientOptions | hour12 | desligado |
| calendarClientOptions | seconds | ligado |
| calendarClientOptions | firstWeekday | 0 |
| calendarClientOptions | showWeekdays | ligado |
| calendarClientOptions | chatTimestamp | desligado |
| calendarClientOptions | position | {} |
| calendarClientOptions | compactPosition | {} |

## Matrizes numéricas para comparação

### Velocidade de viagem em km por dia

| Terreno | Marcha | Forçada | Mortal | Cavalgada | Cavalgada forçada | Cavalgada mortal |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| plains | 20 | 40 | 60 | 40 | 60 | 70 |
| brightDavokar | 20 | 30 | 40 | 30 | 45 | 50 |
| darkDavokar | 10 | 15 | 20 | 10 | 15 | 20 |

Rio usa terreno um passo mais fácil no perfil de viagem. Não transferir automaticamente esse cálculo para tabelas de eventos: o modificador de rio no Terreno da expedição é uma rota distinta.

### Orientação

Região exige nível-base de Mateiro 0/1/2/3 para Ambria/Iluminada/Selvagem/Escura. A elegibilidade fora de Ambria exige pelo menos Mateiro I. A falta de um nível aplica -3; falta de dois ou mais aplica -5. O benefício de eventos exige alcançar o nível regional.

| Resultado com benefícios | Ruínas | Inimigos | Terreno | Detecção | Infortúnio |
| --- | ---: | ---: | ---: | --- | --- |
| Sucesso | +2 | -1 | -1 | favorecida/neutra na rota de encontros | evita |
| Grande sucesso, margem pelo menos 5 | +2 | -2 | -2 | favorecida/neutra na rota de encontros | evita |
| Sucesso sem benefício regional | 0 | 0 | 0 | sem benefício | evita |
| Falha | 0 | 0 | 0 | sem benefício | resolve |

Nos eventos, modificador regional é 0 em Ambria/Iluminada, +2 Selvagem e +5 Escura. Ruínas sem busca ativa sofre -5; sucesso de orientação só concede +2 de Ruínas com busca ativa. A fórmula regional de Infortúnios é distinta: +0/+5/+10. Conferir origem do modificador ao comparar as telas.

### Limites principais

- Mãos: máximo 2; arma pesada/longa/à distância usa 2, arma longa com escudo pode usar modo de uma mão, escudo Flexível usa custo especial zero.
- Carga: Vigoroso; Transportador usa piso de 1,5 × Vigoroso. Imobiliza acima de 2 × capacidade.
- Recuperação de projéteis: 10/15/17 para comum/qualidade/místico no padrão; a configuração pode alterar os alvos.
- Médico: simples 1; Novato 1d6/1; Adepto 1d8/1; Mestre 1d10/1d6 (sucesso/falha).
- Levantar: teste 1d20 contra Rápido; sucesso deixa no máximo uma ação de movimento, falha deixa zero; ambos removem Caído quando a ação completa.
- Calendário: 12 × 30 dias, semana de 7, lua de 28 dias, ano 0–9999; velocidade de 0,01 a 86400.

## Rastreabilidade por script

Faixas indicam casos que exercitam o subsistema, não cobertura medida de cada função. Todos os 79 scripts locais precisam constar nesta matriz.

| Arquivo | Linhas locais | Estado | Faixas do checklist |
| --- | ---: | --- | --- |
| [actor-creation.mjs](../scripts/actor-creation.mjs) | 28 | released | 017–029 |
| [actor-preparation.mjs](../scripts/actor-preparation.mjs) | 70 | released | 017–029, 121–138, 437–452 |
| [actor-references.mjs](../scripts/actor-references.mjs) | 30 | released | 437–452, 526–545 |
| [ammo-roll.mjs](../scripts/ammo-roll.mjs) | 100 | released | 082–109, 110–120 |
| [ammo.mjs](../scripts/ammo.mjs) | 761 | released | 082–109 |
| [berserker-chat.mjs](../scripts/berserker-chat.mjs) | 598 | released | 297–320 |
| [bithir-macros.mjs](../scripts/bithir-macros.mjs) | 1141 | released | 361–378, 611–619, 760–786 |
| [calendar-chat.mjs](../scripts/calendar-chat.mjs) | 35 | released | 379–410 |
| [calendar-configuration.mjs](../scripts/calendar-configuration.mjs) | 107 | released | 379–410, 411–436 |
| [calendar-date.mjs](../scripts/calendar-date.mjs) | 120 | released | 379–410 |
| [calendar-experience-view.mjs](../scripts/calendar-experience-view.mjs) | 66 | released | 379–410 |
| [calendar-options.mjs](../scripts/calendar-options.mjs) | 105 | released | 379–410, 411–436, 611–619 |
| [calendar-runner.mjs](../scripts/calendar-runner.mjs) | 59 | released | 411–436 |
| [calendar-view.mjs](../scripts/calendar-view.mjs) | 149 | released | 379–410 |
| [calendar.mjs](../scripts/calendar.mjs) | 564 | released | 379–410, 411–436, 611–619 |
| [chat-controller.mjs](../scripts/chat-controller.mjs) | 23 | released | 297–320 |
| [chat-item-use.mjs](../scripts/chat-item-use.mjs) | 226 | released | 546–550 |
| [chat-original-preview.mjs](../scripts/chat-original-preview.mjs) | 85 | released | 297–320 |
| [compatibility.mjs](../scripts/compatibility.mjs) | 532 | released | 001–016, 280–296, 340–349, 361–378, 526–545 |
| [constants.mjs](../scripts/constants.mjs) | 414 | released | 001–016, 551–610, 620–668 |
| [container-transfer.mjs](../scripts/container-transfer.mjs) | 609 | released | 166–180 |
| [containers.mjs](../scripts/containers.mjs) | 1229 | released | 139–165, 166–180, 453–463, 735–742 |
| [death-automation.mjs](../scripts/death-automation.mjs) | 701 | released | 261–279 |
| [dice.mjs](../scripts/dice.mjs) | 126 | released | 048–067, 321–329, 361–378 |
| [encumbrance-db.mjs](../scripts/encumbrance-db.mjs) | 236 | released | 121–138 |
| [encumbrance-visuals.mjs](../scripts/encumbrance-visuals.mjs) | 146 | released | 121–138 |
| [encumbrance.mjs](../scripts/encumbrance.mjs) | 643 | released | 121–138, 453–463 |
| [expedition-calendar.mjs](../scripts/expedition-calendar.mjs) | 90 | local-only | 505–510 |
| [expedition-data.mjs](../scripts/expedition-data.mjs) | 218 | released | 486–504, 760–786 |
| [expedition-orientation.mjs](../scripts/expedition-orientation.mjs) | 73 | released | 464–485 |
| [expedition-private.mjs](../scripts/expedition-private.mjs) | 90 | released | 321–329, 464–485, 486–504 |
| [expedition-state.mjs](../scripts/expedition-state.mjs) | 89 | local-modified | 464–485, 486–504, 505–510 |
| [gm-log-events.mjs](../scripts/gm-log-events.mjs) | 294 | released | 330–339 |
| [gm-log-message-adapter.mjs](../scripts/gm-log-message-adapter.mjs) | 448 | released | 330–339 |
| [gm-log-service.mjs](../scripts/gm-log-service.mjs) | 280 | released | 330–339 |
| [gm-log-ui.mjs](../scripts/gm-log-ui.mjs) | 281 | released | 330–339 |
| [ground-containers.mjs](../scripts/ground-containers.mjs) | 564 | released | 166–180 |
| [herbal-cure-rules.mjs](../scripts/herbal-cure-rules.mjs) | 55 | released | 068–081 |
| [herbal-cure.mjs](../scripts/herbal-cure.mjs) | 238 | released | 068–081 |
| [hotbar.mjs](../scripts/hotbar.mjs) | 267 | released | 082–109 |
| [hunger.mjs](../scripts/hunger.mjs) | 265 | released | 048–067 |
| [init.mjs](../scripts/init.mjs) | 769 | released | 001–016, 048–067, 261–279, 297–320, 526–545, 546–550 |
| [inventory-cleanup.mjs](../scripts/inventory-cleanup.mjs) | 97 | released | 017–029 |
| [inventory-default-state.mjs](../scripts/inventory-default-state.mjs) | 71 | released | 017–029 |
| [item-flags.mjs](../scripts/item-flags.mjs) | 280 | released | 017–029, 030–047, 082–109, 139–165, 620–668 |
| [journal-categories.mjs](../scripts/journal-categories.mjs) | 112 | released | 511–525 |
| [journal-integration.mjs](../scripts/journal-integration.mjs) | 465 | released | 511–525 |
| [maneuvers.mjs](../scripts/maneuvers.mjs) | 1484 | released | 219–243 |
| [money.mjs](../scripts/money.mjs) | 244 | released | 181–188 |
| [movement-ruler.mjs](../scripts/movement-ruler.mjs) | 566 | released | 244–260, 261–279, 280–296 |
| [npc-attack-chat.mjs](../scripts/npc-attack-chat.mjs) | 676 | released | 297–320 |
| [opposed-test-chat.mjs](../scripts/opposed-test-chat.mjs) | 395 | released | 297–320 |
| [pain-threshold-choice.mjs](../scripts/pain-threshold-choice.mjs) | 467 | released | 244–260 |
| [party-actor.mjs](../scripts/party-actor.mjs) | 3843 | local-modified | 437–452, 453–463, 464–485, 486–504, 505–510, 735–742, 743–746, 747–759 |
| [party-search.mjs](../scripts/party-search.mjs) | 46 | released | 437–452 |
| [prone-advantage.mjs](../scripts/prone-advantage.mjs) | 103 | released | 244–260 |
| [rations.mjs](../scripts/rations.mjs) | 462 | released | 030–047, 453–463, 486–504, 620–668 |
| [resistance-chat.mjs](../scripts/resistance-chat.mjs) | 53 | released | 297–320 |
| [rest.mjs](../scripts/rest.mjs) | 249 | released | 048–067 |
| [ritual-browser.mjs](../scripts/ritual-browser.mjs) | 291 | released | 350–360, 669–734 |
| [roll-context.mjs](../scripts/roll-context.mjs) | 37 | released | 082–109 |
| [roll-privacy.mjs](../scripts/roll-privacy.mjs) | 170 | released | 321–329 |
| [settings.mjs](../scripts/settings.mjs) | 880 | released | 001–016, 030–047, 048–067, 139–165, 546–550, 551–610, 620–668 |
| [sheet-ui.mjs](../scripts/sheet-ui.mjs) | 2204 | released | 017–029, 030–047, 068–081, 082–109, 110–120, 121–138, 139–165, 181–188, 189–218, 219–243, 340–349, 350–360 |
| [socket-policy.mjs](../scripts/socket-policy.mjs) | 207 | released | 219–243, 321–329, 526–545 |
| [sockets.mjs](../scripts/sockets.mjs) | 457 | released | 068–081, 166–180, 219–243, 321–329, 411–436, 526–545 |
| [special-ammo.mjs](../scripts/special-ammo.mjs) | 219 | released | 110–120 |
| [stand-up.mjs](../scripts/stand-up.mjs) | 375 | released | 244–260, 280–296 |
| [status-effect-picker.mjs](../scripts/status-effect-picker.mjs) | 374 | released | 340–349 |
| [symbaroum-i18n.mjs](../scripts/symbaroum-i18n.mjs) | 46 | released | 001–016 |
| [token-action-hud.mjs](../scripts/token-action-hud.mjs) | 161 | released | 219–243, 526–545 |
| [travel-context.mjs](../scripts/travel-context.mjs) | 64 | released | 280–296, 453–463, 464–485, 743–746 |
| [utils.mjs](../scripts/utils.mjs) | 171 | released | 526–545 |
| [verses.mjs](../scripts/verses.mjs) | 35 | released | 361–378, 546–550 |
| [weapon-quality-tooltips.mjs](../scripts/weapon-quality-tooltips.mjs) | 64 | released | 017–029 |
| [weapon-readiness-hud.mjs](../scripts/weapon-readiness-hud.mjs) | 333 | released | 189–218 |
| [weapon-readiness-visuals.mjs](../scripts/weapon-readiness-visuals.mjs) | 305 | released | 189–218 |
| [weapon-readiness.mjs](../scripts/weapon-readiness.mjs) | 436 | released | 189–218 |
| [weapon-wrapper.mjs](../scripts/weapon-wrapper.mjs) | 130 | released | 082–109, 189–218, 261–279 |

## Todas as funções da publicação

Identificadores F seguem a posição sintática nesta fotografia do código. Callbacks anônimos são localizados por linha, classe de contexto e tipo. Eles não são recursos de interface adicionais. A versão local e as diferenças estão no JSON anexo. Linhas abaixo pertencem à referência publicada, que pode diferir do checkout nos arquivos de expedição.

### [scripts/actor-creation.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/actor-creation.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0001 | `hasExplicitToughness` | 3 | 13 | FunctionDeclaration |
| F0002 | `initialPlayerToughnessUpdate` | 15 | 18 | FunctionDeclaration |
| F0003 | `ActorCreationService.register` | 21 | 26 | static method |
| F0004 | `ActorCreationService.(callback)` | 22 | 25 | ArrowFunctionExpression |
### [scripts/actor-preparation.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/actor-preparation.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0005 | `skipSystemPreparation` | 15 | 18 | init |
| F0006 | `afterDerivedData` | 21 | 24 | init |
| F0007 | `install` | 26 | 47 | init |
| F0008 | `(callback)` | 31 | 34 | FunctionExpression |
| F0009 | `(callback)` | 35 | 46 | FunctionExpression |
| F0010 | `shouldSkip` | 50 | 52 | FunctionDeclaration |
| F0011 | `(callback)` | 51 | 51 | ArrowFunctionExpression |
| F0012 | `wrap` | 55 | 69 | FunctionDeclaration |
| F0013 | `tenebreActorPreparation` | 66 | 68 | FunctionExpression |
### [scripts/actor-references.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/actor-references.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0014 | `actorReference` | 2 | 4 | FunctionDeclaration |
| F0015 | `actorStateKey` | 6 | 8 | FunctionDeclaration |
| F0016 | `actorMatchesReference` | 10 | 12 | FunctionDeclaration |
| F0017 | `asActor` | 14 | 17 | FunctionDeclaration |
| F0018 | `resolveActorReferenceSync` | 19 | 23 | FunctionDeclaration |
| F0019 | `resolveActorReference` | 25 | 29 | async FunctionDeclaration |
### [scripts/ammo-roll.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/ammo-roll.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0020 | `getAmmoRollOptions` | 20 | 47 | FunctionDeclaration |
| F0021 | `(callback)` | 38 | 41 | ArrowFunctionExpression |
| F0022 | `(callback)` | 42 | 46 | ArrowFunctionExpression |
| F0023 | `buildAmmoModifierPackages` | 53 | 67 | FunctionDeclaration |
| F0024 | `(callback)` | 55 | 65 | ArrowFunctionExpression |
| F0025 | `attachAmmoModifierPackages` | 73 | 84 | FunctionDeclaration |
| F0026 | `(callback)` | 75 | 75 | ArrowFunctionExpression |
| F0027 | `(callback)` | 78 | 78 | ArrowFunctionExpression |
| F0028 | `(callback)` | 81 | 83 | ArrowFunctionExpression |
| F0029 | `(callback)` | 82 | 82 | ArrowFunctionExpression |
| F0030 | `syncAmmoPackageSelection` | 87 | 99 | FunctionDeclaration |
### [scripts/ammo.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/ammo.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0031 | `AmmoService.selectAmmo` | 11 | 22 | static async method |
| F0032 | `AmmoService.consumeAmmo` | 24 | 108 | static async method |
| F0033 | `AmmoService.(callback)` | 34 | 34 | ArrowFunctionExpression |
| F0034 | `AmmoService.(callback)` | 55 | 59 | ArrowFunctionExpression |
| F0035 | `AmmoService.reloadQuiverPrompt` | 110 | 240 | static async method |
| F0036 | `AmmoService.(callback)` | 122 | 122 | ArrowFunctionExpression |
| F0037 | `AmmoService.(callback)` | 130 | 132 | ArrowFunctionExpression |
| F0038 | `AmmoService.callback` | 153 | 159 | init |
| F0039 | `AmmoService.(callback)` | 155 | 155 | ArrowFunctionExpression |
| F0040 | `AmmoService.(callback)` | 178 | 178 | ArrowFunctionExpression |
| F0041 | `AmmoService.unloadQuiver` | 242 | 324 | static async method |
| F0042 | `AmmoService.(callback)` | 246 | 249 | ArrowFunctionExpression |
| F0043 | `AmmoService.(callback)` | 250 | 250 | ArrowFunctionExpression |
| F0044 | `AmmoService.(callback)` | 257 | 259 | ArrowFunctionExpression |
| F0045 | `AmmoService.callback` | 278 | 284 | init |
| F0046 | `AmmoService.(callback)` | 293 | 296 | ArrowFunctionExpression |
| F0047 | `AmmoService.(callback)` | 309 | 311 | ArrowFunctionExpression |
| F0048 | `AmmoService.(callback)` | 313 | 313 | ArrowFunctionExpression |
| F0049 | `AmmoService.promptAmmo` | 326 | 355 | static async method |
| F0050 | `AmmoService.(callback)` | 327 | 333 | ArrowFunctionExpression |
| F0051 | `AmmoService.callback` | 346 | 349 | init |
| F0052 | `AmmoService.(callback)` | 348 | 348 | ArrowFunctionExpression |
| F0053 | `AmmoService.recordHit` | 357 | 394 | static async method |
| F0054 | `AmmoService.getTrackedHits` | 396 | 412 | static method |
| F0055 | `AmmoService.recover` | 414 | 488 | static async method |
| F0056 | `AmmoService.(callback)` | 425 | 425 | ArrowFunctionExpression |
| F0057 | `AmmoService.(callback)` | 426 | 426 | ArrowFunctionExpression |
| F0058 | `AmmoService.(callback)` | 427 | 427 | ArrowFunctionExpression |
| F0059 | `AmmoService.(callback)` | 427 | 427 | ArrowFunctionExpression |
| F0060 | `AmmoService.(callback)` | 435 | 435 | ArrowFunctionExpression |
| F0061 | `AmmoService.(callback)` | 438 | 438 | ArrowFunctionExpression |
| F0062 | `AmmoService.(callback)` | 443 | 471 | ArrowFunctionExpression |
| F0063 | `AmmoService.(callback)` | 474 | 475 | ArrowFunctionExpression |
| F0064 | `createRecoverySession` | 491 | 503 | FunctionDeclaration |
| F0065 | `createRecoverySessionMessage` | 505 | 516 | async FunctionDeclaration |
| F0066 | `recoverySessionFlags` | 518 | 561 | FunctionDeclaration |
| F0067 | `recoverySessionContent` | 563 | 580 | FunctionDeclaration |
| F0068 | `isPlayerActor` | 582 | 584 | FunctionDeclaration |
| F0069 | `getRecoveryTarget` | 586 | 613 | FunctionDeclaration |
| F0070 | `clampRecoveryTarget` | 615 | 617 | FunctionDeclaration |
| F0071 | `buildQuiverTransferDialogContent` | 619 | 642 | FunctionDeclaration |
| F0072 | `getRecoverableShotData` | 644 | 693 | FunctionDeclaration |
| F0073 | `getRecoverableEntryData` | 695 | 717 | FunctionDeclaration |
| F0074 | `(callback)` | 698 | 698 | ArrowFunctionExpression |
| F0075 | `snapshotAmmoMetadata` | 719 | 731 | FunctionDeclaration |
| F0076 | `(callback)` | 724 | 724 | ArrowFunctionExpression |
| F0077 | `isQuiverName` | 733 | 736 | FunctionDeclaration |
| F0078 | `createRecoveredAmmo` | 738 | 760 | async FunctionDeclaration |
### [scripts/berserker-chat.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/berserker-chat.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0079 | `BerserkerChatService.register` | 15 | 32 | static method |
| F0080 | `BerserkerChatService.(callback)` | 19 | 23 | ArrowFunctionExpression |
| F0081 | `BerserkerChatService.(callback)` | 25 | 31 | ArrowFunctionExpression |
| F0082 | `isBerserkerItem` | 35 | 39 | FunctionDeclaration |
| F0083 | `isLayOnHandsItem` | 41 | 45 | FunctionDeclaration |
| F0084 | `isHolyAuraItem` | 47 | 51 | FunctionDeclaration |
| F0085 | `isBrimstoneCascadeItem` | 53 | 57 | FunctionDeclaration |
| F0086 | `isAlchemyItem` | 59 | 63 | FunctionDeclaration |
| F0087 | `enhanceBerserkerCards` | 65 | 69 | FunctionDeclaration |
| F0088 | `restoreBerserkerCards` | 71 | 80 | FunctionDeclaration |
| F0089 | `enhanceBerserkerCard` | 82 | 139 | FunctionDeclaration |
| F0090 | `findUnadaptedAbilityElements` | 141 | 175 | FunctionDeclaration |
| F0091 | `equivalentChatText` | 177 | 180 | FunctionDeclaration |
| F0092 | `hasMeaningfulContent` | 182 | 184 | FunctionDeclaration |
| F0093 | `createAbilityFlow` | 186 | 202 | FunctionDeclaration |
| F0094 | `createFlowArrow` | 204 | 210 | FunctionDeclaration |
| F0095 | `createPortrait` | 212 | 223 | FunctionDeclaration |
| F0096 | `createAbilityFigure` | 225 | 248 | FunctionDeclaration |
| F0097 | `(callback)` | 238 | 242 | ArrowFunctionExpression |
| F0098 | `createAbilityDetails` | 250 | 307 | FunctionDeclaration |
| F0099 | `(callback)` | 254 | 254 | ArrowFunctionExpression |
| F0100 | `(callback)` | 257 | 257 | ArrowFunctionExpression |
| F0101 | `(callback)` | 259 | 259 | ArrowFunctionExpression |
| F0102 | `applyAbilityRollOutcome` | 309 | 315 | FunctionDeclaration |
| F0103 | `parseAbilityTest` | 317 | 332 | FunctionDeclaration |
| F0104 | `(callback)` | 320 | 320 | ArrowFunctionExpression |
| F0105 | `parseSingleAbilityTest` | 334 | 346 | FunctionDeclaration |
| F0106 | `parseAbilityRoll` | 348 | 352 | FunctionDeclaration |
| F0107 | `cleanAbilityCaption` | 354 | 359 | FunctionDeclaration |
| F0108 | `extractActorNameFromIntro` | 361 | 369 | FunctionDeclaration |
| F0109 | `extractAbilityNameFromIntro` | 371 | 375 | FunctionDeclaration |
| F0110 | `actorByDisplayedName` | 377 | 388 | FunctionDeclaration |
| F0111 | `(callback)` | 381 | 385 | ArrowFunctionExpression |
| F0112 | `(callback)` | 387 | 387 | ArrowFunctionExpression |
| F0113 | `isNativeAbilityCard` | 390 | 398 | FunctionDeclaration |
| F0114 | `createFallbackActor` | 400 | 406 | FunctionDeclaration |
| F0115 | `createFallbackAbility` | 408 | 417 | FunctionDeclaration |
| F0116 | `findDisplayedAbility` | 419 | 438 | FunctionDeclaration |
| F0117 | `(callback)` | 432 | 432 | ArrowFunctionExpression |
| F0118 | `(callback)` | 433 | 433 | ArrowFunctionExpression |
| F0119 | `(callback)` | 434 | 434 | ArrowFunctionExpression |
| F0120 | `(callback)` | 435 | 435 | ArrowFunctionExpression |
| F0121 | `findAbilityByReference` | 440 | 448 | FunctionDeclaration |
| F0122 | `(callback)` | 442 | 447 | ArrowFunctionExpression |
| F0123 | `findAbilityByIntro` | 450 | 458 | FunctionDeclaration |
| F0124 | `(callback)` | 454 | 457 | ArrowFunctionExpression |
| F0125 | `referenceLabel` | 460 | 467 | FunctionDeclaration |
| F0126 | `splitAbilityCaption` | 469 | 478 | FunctionDeclaration |
| F0127 | `cleanAbilityModifiers` | 480 | 489 | FunctionDeclaration |
| F0128 | `(callback)` | 484 | 487 | ArrowFunctionExpression |
| F0129 | `stripTargetLabel` | 491 | 493 | FunctionDeclaration |
| F0130 | `resolveChatMessage` | 495 | 499 | FunctionDeclaration |
| F0131 | `resolveSpeakerActor` | 501 | 548 | FunctionDeclaration |
| F0132 | `(callback)` | 517 | 517 | ArrowFunctionExpression |
| F0133 | `(callback)` | 537 | 537 | ArrowFunctionExpression |
| F0134 | `(callback)` | 540 | 543 | ArrowFunctionExpression |
| F0135 | `matchingElements` | 550 | 555 | FunctionDeclaration |
| F0136 | `htmlElement` | 557 | 559 | FunctionDeclaration |
| F0137 | `backgroundImageUrl` | 561 | 564 | FunctionDeclaration |
| F0138 | `createTextElement` | 566 | 571 | FunctionDeclaration |
| F0139 | `stripParenthetical` | 573 | 575 | FunctionDeclaration |
| F0140 | `normalize` | 577 | 579 | FunctionDeclaration |
| F0141 | `cleanText` | 581 | 583 | FunctionDeclaration |
| F0142 | `signed` | 585 | 587 | FunctionDeclaration |
| F0143 | `isEnabled` | 590 | 597 | FunctionDeclaration |
### [scripts/bithir-macros.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/bithir-macros.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0144 | `tableResultContent` | 56 | 58 | FunctionDeclaration |
| F0145 | `promptUtilityDialog` | 60 | 62 | async FunctionDeclaration |
| F0146 | `loadForestEventTranslations` | 64 | 73 | async FunctionDeclaration |
| F0147 | `forestEventTableKeyForName` | 75 | 91 | FunctionDeclaration |
| F0148 | `(callback)` | 87 | 87 | ArrowFunctionExpression |
| F0149 | `sortedTableResults` | 93 | 99 | FunctionDeclaration |
| F0150 | `(callback)` | 94 | 98 | ArrowFunctionExpression |
| F0151 | `translatedForestResult` | 101 | 105 | FunctionDeclaration |
| F0152 | `(callback)` | 103 | 103 | ArrowFunctionExpression |
| F0153 | `findForestEventTable` | 107 | 125 | FunctionDeclaration |
| F0154 | `(callback)` | 123 | 123 | ArrowFunctionExpression |
| F0155 | `(callback)` | 124 | 124 | ArrowFunctionExpression |
| F0156 | `splitForestEventText` | 127 | 138 | FunctionDeclaration |
| F0157 | `renderForestEventCard` | 140 | 155 | FunctionDeclaration |
| F0158 | `isModuleUtilityDocument` | 158 | 162 | FunctionDeclaration |
| F0159 | `isForestEventsMacro` | 164 | 167 | FunctionDeclaration |
| F0160 | `expCost` | 178 | 178 | init |
| F0161 | `randomElement` | 179 | 179 | init |
| F0162 | `BithirApi.localize` | 195 | 197 | method |
| F0163 | `BithirApi.localizeFallback` | 199 | 202 | method |
| F0164 | `BithirApi.localizeVerseTitle` | 204 | 210 | method |
| F0165 | `BithirApi.replaceAsync` | 212 | 220 | async method |
| F0166 | `BithirApi.(callback)` | 214 | 217 | ArrowFunctionExpression |
| F0167 | `BithirApi.(callback)` | 219 | 219 | ArrowFunctionExpression |
| F0168 | `BithirApi.generateShadow` | 222 | 247 | async method |
| F0169 | `BithirApi.(callback)` | 235 | 238 | ArrowFunctionExpression |
| F0170 | `BithirApi.parseSimpleElement` | 249 | 268 | async method |
| F0171 | `BithirApi.(callback)` | 250 | 265 | async ArrowFunctionExpression |
| F0172 | `BithirApi.(callback)` | 254 | 254 | ArrowFunctionExpression |
| F0173 | `InspirationDie.constructor` | 277 | 280 | constructor |
| F0174 | `InspirationDie.roll` | 282 | 288 | method |
| F0175 | `InspirationDie.getResultCSS` | 290 | 295 | method |
| F0176 | `InspirationDie.denomination` | 297 | 297 | get |
| F0177 | `InspirationDie.total` | 301 | 303 | get |
| F0178 | `InspirationDie.getResultLabel` | 305 | 307 | method |
| F0179 | `LocationDie.denomination` | 312 | 312 | get |
| F0180 | `LocationDie.diceSoNiceColorset` | 314 | 325 | static get |
| F0181 | `LocationDie.diceSoNiceDicePreset` | 327 | 349 | static get |
| F0182 | `EventDie.denomination` | 354 | 354 | get |
| F0183 | `EventDie.diceSoNiceColorset` | 356 | 367 | static get |
| F0184 | `EventDie.diceSoNiceDicePreset` | 369 | 391 | static get |
| F0185 | `CreatureDie.denomination` | 396 | 396 | get |
| F0186 | `CreatureDie.diceSoNiceColorset` | 398 | 409 | static get |
| F0187 | `CreatureDie.diceSoNiceDicePreset` | 411 | 433 | static get |
| F0188 | `RewardDie.denomination` | 438 | 438 | get |
| F0189 | `RewardDie.diceSoNiceColorset` | 440 | 451 | static get |
| F0190 | `RewardDie.diceSoNiceDicePreset` | 453 | 475 | static get |
| F0191 | `BithirMacros.thusSpoke` | 482 | 503 | async method |
| F0192 | `BithirMacros.generateNPCMacro` | 505 | 554 | async method |
| F0193 | `BithirMacros.callback` | 542 | 546 | async init |
| F0194 | `BithirMacros.(callback)` | 550 | 550 | ArrowFunctionExpression |
| F0195 | `BithirMacros.generateNPC` | 556 | 741 | async method |
| F0196 | `BithirMacros.(callback)` | 612 | 612 | ArrowFunctionExpression |
| F0197 | `BithirMacros.(callback)` | 623 | 623 | ArrowFunctionExpression |
| F0198 | `BithirMacros.(callback)` | 626 | 628 | ArrowFunctionExpression |
| F0199 | `BithirMacros.(callback)` | 658 | 658 | ArrowFunctionExpression |
| F0200 | `BithirMacros.(callback)` | 662 | 664 | ArrowFunctionExpression |
| F0201 | `BithirMacros.(callback)` | 710 | 717 | ArrowFunctionExpression |
| F0202 | `BithirMacros.addAbility` | 743 | 774 | method |
| F0203 | `BithirMacros.(callback)` | 745 | 745 | ArrowFunctionExpression |
| F0204 | `BithirMacros.(callback)` | 747 | 747 | ArrowFunctionExpression |
| F0205 | `BithirMacros.getLevel` | 776 | 780 | method |
| F0206 | `BithirMacros.setAttributes` | 782 | 786 | method |
| F0207 | `BithirMacros.getFolderID` | 788 | 796 | async method |
| F0208 | `BithirMacros.(callback)` | 789 | 789 | ArrowFunctionExpression |
| F0209 | `BithirMacros.rollRollInspiration` | 798 | 870 | async method |
| F0210 | `BithirMacros.callback` | 824 | 829 | async init |
| F0211 | `BithirMacros.(callback)` | 863 | 865 | ArrowFunctionExpression |
| F0212 | `BithirMacros.rollForestEvents` | 872 | 925 | async method |
| F0213 | `BithirMacros.assembleInspirationResults` | 927 | 937 | method |
| F0214 | `migrateImportedUtilityTranslations` | 943 | 1004 | async FunctionDeclaration |
| F0215 | `(callback)` | 952 | 952 | ArrowFunctionExpression |
| F0216 | `(callback)` | 953 | 953 | ArrowFunctionExpression |
| F0217 | `(callback)` | 974 | 974 | ArrowFunctionExpression |
| F0218 | `(callback)` | 990 | 994 | ArrowFunctionExpression |
| F0219 | `setupBithirMod` | 1006 | 1112 | FunctionDeclaration |
| F0220 | `(callback)` | 1028 | 1037 | ArrowFunctionExpression |
| F0221 | `(callback)` | 1040 | 1098 | ArrowFunctionExpression |
| F0222 | `(callback)` | 1058 | 1094 | async ArrowFunctionExpression |
| F0223 | `(callback)` | 1063 | 1065 | ArrowFunctionExpression |
| F0224 | `callback` | 1080 | 1080 | async init |
| F0225 | `refreshOpenActorSheets` | 1105 | 1105 | init |
| F0226 | `registerBithirSetting` | 1114 | 1117 | FunctionDeclaration |
| F0227 | `isBithirUtilitiesEnabled` | 1119 | 1121 | FunctionDeclaration |
| F0228 | `isGenerateShadowEnabled` | 1123 | 1125 | FunctionDeclaration |
| F0229 | `getTenebreSetting` | 1127 | 1134 | FunctionDeclaration |
| F0230 | `warnBithirDisabled` | 1136 | 1139 | FunctionDeclaration |
### [scripts/calendar-chat.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/calendar-chat.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0231 | `stampCalendarMessage` | 8 | 13 | FunctionDeclaration |
| F0232 | `renderCalendarTimestamp` | 14 | 30 | FunctionDeclaration |
| F0233 | `registerCalendarChat` | 31 | 34 | FunctionDeclaration |
| F0234 | `(callback)` | 32 | 32 | ArrowFunctionExpression |
### [scripts/calendar-configuration.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/calendar-configuration.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0235 | `label` | 7 | 7 | ArrowFunctionExpression |
| F0236 | `check` | 8 | 8 | ArrowFunctionExpression |
| F0237 | `select` | 9 | 9 | ArrowFunctionExpression |
| F0238 | `(callback)` | 9 | 9 | ArrowFunctionExpression |
| F0239 | `buildCalendarConfiguration` | 11 | 35 | FunctionDeclaration |
| F0240 | `(callback)` | 12 | 12 | ArrowFunctionExpression |
| F0241 | `(callback)` | 13 | 13 | ArrowFunctionExpression |
| F0242 | `(callback)` | 14 | 14 | ArrowFunctionExpression |
| F0243 | `(callback)` | 16 | 16 | ArrowFunctionExpression |
| F0244 | `(callback)` | 17 | 17 | ArrowFunctionExpression |
| F0245 | `(callback)` | 19 | 19 | ArrowFunctionExpression |
| F0246 | `(callback)` | 21 | 21 | ArrowFunctionExpression |
| F0247 | `(callback)` | 25 | 25 | ArrowFunctionExpression |
| F0248 | `(callback)` | 26 | 26 | ArrowFunctionExpression |
| F0249 | `(callback)` | 26 | 26 | ArrowFunctionExpression |
| F0250 | `(callback)` | 28 | 28 | ArrowFunctionExpression |
| F0251 | `(callback)` | 28 | 28 | ArrowFunctionExpression |
| F0252 | `CalendarConfigurationApplication.saveCalendarConfiguration` | 43 | 43 | init |
| F0253 | `CalendarConfigurationApplication.(callback)` | 43 | 43 | ArrowFunctionExpression |
| F0254 | `CalendarConfigurationApplication.cancelCalendarConfiguration` | 44 | 44 | init |
| F0255 | `CalendarConfigurationApplication.exportCalendar` | 45 | 45 | init |
| F0256 | `CalendarConfigurationApplication.importCalendar` | 46 | 46 | init |
| F0257 | `CalendarConfigurationApplication.(callback)` | 46 | 46 | ArrowFunctionExpression |
| F0258 | `CalendarConfigurationApplication.constructor` | 49 | 49 | constructor |
| F0259 | `CalendarConfigurationApplication._renderHTML` | 50 | 53 | async method |
| F0260 | `CalendarConfigurationApplication._replaceHTML` | 54 | 54 | method |
| F0261 | `CalendarConfigurationApplication._onRender` | 55 | 62 | method |
| F0262 | `CalendarConfigurationApplication.(callback)` | 56 | 61 | async ArrowFunctionExpression |
| F0263 | `CalendarConfigurationApplication.save` | 63 | 85 | async method |
| F0264 | `CalendarConfigurationApplication.value` | 64 | 64 | ArrowFunctionExpression |
| F0265 | `CalendarConfigurationApplication.checked` | 65 | 65 | ArrowFunctionExpression |
| F0266 | `CalendarConfigurationApplication.time` | 71 | 75 | ArrowFunctionExpression |
| F0267 | `CalendarConfigurationApplication.(callback)` | 78 | 78 | ArrowFunctionExpression |
| F0268 | `CalendarConfigurationApplication.(callback)` | 79 | 79 | ArrowFunctionExpression |
| F0269 | `CalendarConfigurationApplication.(callback)` | 80 | 80 | ArrowFunctionExpression |
| F0270 | `CalendarConfigurationApplication.export` | 86 | 92 | method |
| F0271 | `CalendarConfigurationApplication.(callback)` | 91 | 91 | ArrowFunctionExpression |
| F0272 | `CalendarConfigurationApplication.import` | 93 | 105 | async method |
### [scripts/calendar-date.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/calendar-date.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0273 | `calendarClockSpeed` | 9 | 14 | FunctionDeclaration |
| F0274 | `calendarClock` | 16 | 27 | FunctionDeclaration |
| F0275 | `calendarDayPeriod` | 30 | 36 | FunctionDeclaration |
| F0276 | `calendarTimeDelta` | 38 | 43 | FunctionDeclaration |
| F0277 | `validateCalendarDate` | 46 | 53 | FunctionDeclaration |
| F0278 | `advanceCalendarDate` | 55 | 63 | FunctionDeclaration |
| F0279 | `calendarDayNumber` | 65 | 68 | FunctionDeclaration |
| F0280 | `createCalendarAnchor` | 71 | 74 | FunctionDeclaration |
| F0281 | `calendarDateAtTime` | 76 | 79 | FunctionDeclaration |
| F0282 | `calendarMoon` | 88 | 92 | FunctionDeclaration |
| F0283 | `(callback)` | 90 | 90 | ArrowFunctionExpression |
| F0284 | `calendarSeason` | 95 | 101 | FunctionDeclaration |
| F0285 | `calendarMonthDays` | 103 | 112 | FunctionDeclaration |
| F0286 | `(callback)` | 107 | 110 | ArrowFunctionExpression |
| F0287 | `shiftCalendarMonth` | 114 | 119 | FunctionDeclaration |
### [scripts/calendar-experience-view.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/calendar-experience-view.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0288 | `label` | 6 | 6 | ArrowFunctionExpression |
| F0289 | `same` | 7 | 7 | ArrowFunctionExpression |
| F0290 | `button` | 8 | 8 | ArrowFunctionExpression |
| F0291 | `timeText` | 9 | 9 | ArrowFunctionExpression |
| F0292 | `buildExperienceMonth` | 11 | 26 | FunctionDeclaration |
| F0293 | `(callback)` | 13 | 13 | ArrowFunctionExpression |
| F0294 | `(callback)` | 15 | 15 | ArrowFunctionExpression |
| F0295 | `(callback)` | 16 | 16 | ArrowFunctionExpression |
| F0296 | `(callback)` | 24 | 24 | ArrowFunctionExpression |
| F0297 | `buildExperienceControls` | 28 | 36 | FunctionDeclaration |
| F0298 | `(callback)` | 31 | 31 | ArrowFunctionExpression |
| F0299 | `(callback)` | 33 | 33 | ArrowFunctionExpression |
| F0300 | `(callback)` | 34 | 34 | ArrowFunctionExpression |
| F0301 | `buildCalendarExperience` | 38 | 65 | FunctionDeclaration |
| F0302 | `(callback)` | 44 | 44 | ArrowFunctionExpression |
| F0303 | `(callback)` | 49 | 49 | ArrowFunctionExpression |
| F0304 | `(callback)` | 50 | 50 | ArrowFunctionExpression |
### [scripts/calendar-options.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/calendar-options.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0305 | `validateCalendarWorldOptions` | 11 | 28 | FunctionDeclaration |
| F0306 | `(callback)` | 16 | 16 | ArrowFunctionExpression |
| F0307 | `(callback)` | 18 | 18 | ArrowFunctionExpression |
| F0308 | `(callback)` | 22 | 22 | ArrowFunctionExpression |
| F0309 | `validateCalendarClientOptions` | 30 | 51 | FunctionDeclaration |
| F0310 | `readCalendarWorldOptions` | 53 | 56 | FunctionDeclaration |
| F0311 | `readCalendarClientOptions` | 57 | 60 | FunctionDeclaration |
| F0312 | `calendarUserCanControl` | 61 | 63 | FunctionDeclaration |
| F0313 | `calendarPausesForCombat` | 64 | 67 | FunctionDeclaration |
| F0314 | `(callback)` | 65 | 66 | ArrowFunctionExpression |
| F0315 | `calendarDaylight` | 70 | 80 | FunctionDeclaration |
| F0316 | `(callback)` | 75 | 75 | ArrowFunctionExpression |
| F0317 | `(callback)` | 78 | 78 | ArrowFunctionExpression |
| F0318 | `calendarPresetDelta` | 81 | 88 | FunctionDeclaration |
| F0319 | `desired` | 84 | 84 | ArrowFunctionExpression |
| F0320 | `calendarIntervalSeconds` | 89 | 93 | FunctionDeclaration |
| F0321 | `formatCalendarTime` | 94 | 98 | FunctionDeclaration |
| F0322 | `validateCalendarBackup` | 99 | 104 | FunctionDeclaration |
### [scripts/calendar-runner.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/calendar-runner.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0323 | `CalendarClockRunner.constructor` | 10 | 14 | constructor |
| F0324 | `CalendarClockRunner.(callback)` | 10 | 10 | ArrowFunctionExpression |
| F0325 | `CalendarClockRunner.(callback)` | 10 | 10 | ArrowFunctionExpression |
| F0326 | `CalendarClockRunner.(callback)` | 11 | 11 | ArrowFunctionExpression |
| F0327 | `CalendarClockRunner.(callback)` | 12 | 12 | ArrowFunctionExpression |
| F0328 | `CalendarClockRunner.synchronize` | 16 | 26 | method |
| F0329 | `CalendarClockRunner.(callback)` | 24 | 24 | ArrowFunctionExpression |
| F0330 | `CalendarClockRunner.stop` | 28 | 34 | method |
| F0331 | `CalendarClockRunner.tick` | 36 | 57 | async method |
| F0332 | `CalendarClockRunner.(callback)` | 50 | 50 | ArrowFunctionExpression |
### [scripts/calendar-view.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/calendar-view.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0333 | `label` | 8 | 8 | ArrowFunctionExpression |
| F0334 | `sameDate` | 9 | 9 | ArrowFunctionExpression |
| F0335 | `buildCalendarClockToggle` | 11 | 15 | FunctionDeclaration |
| F0336 | `buildCalendarClock` | 17 | 25 | FunctionDeclaration |
| F0337 | `control` | 19 | 19 | ArrowFunctionExpression |
| F0338 | `updateCalendarClock` | 28 | 54 | FunctionDeclaration |
| F0339 | `formatCalendarDate` | 56 | 60 | FunctionDeclaration |
| F0340 | `calendarMoonIcon` | 63 | 75 | FunctionDeclaration |
| F0341 | `calendarSeasonIcon` | 77 | 85 | FunctionDeclaration |
| F0342 | `calendarDaylightIcon` | 87 | 92 | FunctionDeclaration |
| F0343 | `calendarSkyContent` | 94 | 107 | FunctionDeclaration |
| F0344 | `buildCalendarSky` | 109 | 112 | FunctionDeclaration |
| F0345 | `buildCalendarAlmanac` | 114 | 119 | FunctionDeclaration |
| F0346 | `buildCalendarPage` | 121 | 148 | FunctionDeclaration |
| F0347 | `(callback)` | 123 | 123 | ArrowFunctionExpression |
| F0348 | `(callback)` | 124 | 124 | ArrowFunctionExpression |
| F0349 | `(callback)` | 125 | 129 | ArrowFunctionExpression |
| F0350 | `(callback)` | 130 | 130 | ArrowFunctionExpression |
| F0351 | `(callback)` | 133 | 133 | ArrowFunctionExpression |
### [scripts/calendar.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/calendar.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0352 | `queueCalendarChange` | 23 | 27 | FunctionDeclaration |
| F0353 | `(callback)` | 24 | 24 | ArrowFunctionExpression |
| F0354 | `label` | 29 | 29 | ArrowFunctionExpression |
| F0355 | `CalendarService.register` | 39 | 124 | static method |
| F0356 | `CalendarService.onChange` | 45 | 45 | init |
| F0357 | `CalendarService.onChange` | 49 | 49 | init |
| F0358 | `CalendarService.onChange` | 53 | 53 | init |
| F0359 | `CalendarService.onChange` | 60 | 60 | init |
| F0360 | `CalendarService.onChange` | 64 | 67 | init |
| F0361 | `CalendarService.onChange` | 70 | 70 | init |
| F0362 | `CalendarService.canRun` | 72 | 72 | init |
| F0363 | `CalendarService.getRate` | 73 | 73 | init |
| F0364 | `CalendarService.advance` | 74 | 77 | init |
| F0365 | `CalendarService.(callback)` | 74 | 77 | async ArrowFunctionExpression |
| F0366 | `CalendarService.onError` | 78 | 83 | async init |
| F0367 | `CalendarService.(callback)` | 81 | 81 | ArrowFunctionExpression |
| F0368 | `CalendarService.(callback)` | 87 | 93 | ArrowFunctionExpression |
| F0369 | `CalendarService.(callback)` | 89 | 89 | ArrowFunctionExpression |
| F0370 | `CalendarService.onChange` | 92 | 92 | init |
| F0371 | `CalendarService.(callback)` | 95 | 95 | ArrowFunctionExpression |
| F0372 | `CalendarService.(callback)` | 96 | 96 | ArrowFunctionExpression |
| F0373 | `CalendarService.(callback)` | 98 | 98 | ArrowFunctionExpression |
| F0374 | `CalendarService.(callback)` | 100 | 100 | ArrowFunctionExpression |
| F0375 | `CalendarService.(callback)` | 102 | 102 | ArrowFunctionExpression |
| F0376 | `CalendarService.(callback)` | 104 | 115 | ArrowFunctionExpression |
| F0377 | `CalendarService.(callback)` | 108 | 113 | async ArrowFunctionExpression |
| F0378 | `CalendarService.(callback)` | 113 | 113 | ArrowFunctionExpression |
| F0379 | `CalendarService.onDown` | 117 | 117 | init |
| F0380 | `CalendarService.(callback)` | 119 | 122 | ArrowFunctionExpression |
| F0381 | `CalendarService.(callback)` | 123 | 123 | ArrowFunctionExpression |
| F0382 | `CalendarService.canRunClock` | 126 | 133 | static method |
| F0383 | `CalendarService.synchronizeClock` | 135 | 138 | static method |
| F0384 | `CalendarService.getDate` | 140 | 143 | static method |
| F0385 | `CalendarService.getTime` | 145 | 149 | static method |
| F0386 | `CalendarService.canView` | 150 | 153 | static method |
| F0387 | `CalendarService.canControl` | 154 | 156 | static method |
| F0388 | `CalendarService.getClockStatus` | 157 | 162 | static method |
| F0389 | `CalendarService.toggle` | 163 | 166 | static async method |
| F0390 | `CalendarService.openConfiguration` | 167 | 170 | static method |
| F0391 | `CalendarService.exportConfiguration` | 171 | 174 | static method |
| F0392 | `CalendarService.refresh` | 176 | 218 | static method |
| F0393 | `CalendarService.(callback)` | 181 | 181 | ArrowFunctionExpression |
| F0394 | `CalendarService.(callback)` | 188 | 205 | ArrowFunctionExpression |
| F0395 | `CalendarService.(callback)` | 201 | 201 | ArrowFunctionExpression |
| F0396 | `CalendarService.(callback)` | 204 | 204 | ArrowFunctionExpression |
| F0397 | `CalendarService.change` | 220 | 225 | static async method |
| F0398 | `CalendarService.openDateDialog` | 227 | 232 | static async method |
| F0399 | `CalendarService.reportError` | 234 | 237 | static method |
| F0400 | `changeCalendarDateAsGM` | 241 | 319 | FunctionDeclaration |
| F0401 | `authorize` | 244 | 250 | ArrowFunctionExpression |
| F0402 | `(callback)` | 282 | 318 | async ArrowFunctionExpression |
| F0403 | `advanceCalendarTime` | 321 | 334 | async FunctionDeclaration |
| F0404 | `configureCalendar` | 336 | 358 | async FunctionDeclaration |
| F0405 | `buildCalendarPanel` | 360 | 369 | FunctionDeclaration |
| F0406 | `button` | 363 | 363 | ArrowFunctionExpression |
| F0407 | `CalendarApplication.previousMonth` | 378 | 378 | init |
| F0408 | `CalendarApplication.nextMonth` | 379 | 379 | init |
| F0409 | `CalendarApplication.today` | 380 | 380 | init |
| F0410 | `CalendarApplication.selectDay` | 381 | 384 | init |
| F0411 | `CalendarApplication.previousPeriod` | 385 | 385 | init |
| F0412 | `CalendarApplication.nextPeriod` | 386 | 386 | init |
| F0413 | `CalendarApplication.viewMode` | 387 | 387 | init |
| F0414 | `CalendarApplication.calendarSettings` | 388 | 388 | init |
| F0415 | `CalendarApplication.calendarDetails` | 389 | 389 | init |
| F0416 | `CalendarApplication.timeInterval` | 390 | 390 | init |
| F0417 | `CalendarApplication.(callback)` | 390 | 390 | ArrowFunctionExpression |
| F0418 | `CalendarApplication.timePreset` | 391 | 391 | init |
| F0419 | `CalendarApplication.(callback)` | 391 | 391 | ArrowFunctionExpression |
| F0420 | `CalendarApplication.reverseTime` | 392 | 392 | init |
| F0421 | `CalendarApplication.largerSteps` | 393 | 393 | init |
| F0422 | `CalendarApplication.stopClock` | 394 | 394 | init |
| F0423 | `CalendarApplication.(callback)` | 394 | 394 | ArrowFunctionExpression |
| F0424 | `CalendarApplication.editDateTime` | 395 | 395 | init |
| F0425 | `CalendarApplication.(callback)` | 395 | 395 | ArrowFunctionExpression |
| F0426 | `CalendarApplication.changeTime` | 396 | 396 | init |
| F0427 | `CalendarApplication.(callback)` | 396 | 396 | ArrowFunctionExpression |
| F0428 | `CalendarApplication.toggleClock` | 397 | 397 | init |
| F0429 | `CalendarApplication.(callback)` | 397 | 397 | ArrowFunctionExpression |
| F0430 | `CalendarApplication.applyDate` | 398 | 398 | init |
| F0431 | `CalendarApplication.(callback)` | 398 | 398 | ArrowFunctionExpression |
| F0432 | `CalendarApplication.constructor` | 410 | 413 | constructor |
| F0433 | `CalendarApplication.showCurrent` | 415 | 421 | method |
| F0434 | `CalendarApplication.browseMonth` | 423 | 430 | method |
| F0435 | `CalendarApplication.selectDay` | 432 | 437 | method |
| F0436 | `CalendarApplication.setView` | 439 | 444 | method |
| F0437 | `CalendarApplication.changeMode` | 446 | 453 | async method |
| F0438 | `CalendarApplication.savePosition` | 455 | 462 | async method |
| F0439 | `CalendarApplication.close` | 464 | 467 | async method |
| F0440 | `CalendarApplication.editDateTime` | 469 | 485 | async method |
| F0441 | `CalendarApplication.callback` | 475 | 484 | async init |
| F0442 | `CalendarApplication.value` | 476 | 476 | ArrowFunctionExpression |
| F0443 | `CalendarApplication.applyDate` | 487 | 491 | async method |
| F0444 | `CalendarApplication.syncDate` | 493 | 502 | method |
| F0445 | `CalendarApplication.refresh` | 504 | 504 | method |
| F0446 | `CalendarApplication.(callback)` | 504 | 504 | ArrowFunctionExpression |
| F0447 | `CalendarApplication._renderHTML` | 506 | 511 | async method |
| F0448 | `CalendarApplication._replaceHTML` | 513 | 513 | method |
| F0449 | `CalendarApplication._onRender` | 515 | 562 | method |
| F0450 | `CalendarApplication.(callback)` | 532 | 536 | ArrowFunctionExpression |
| F0451 | `CalendarApplication.(callback)` | 538 | 538 | ArrowFunctionExpression |
| F0452 | `CalendarApplication.(callback)` | 540 | 549 | ArrowFunctionExpression |
| F0453 | `CalendarApplication.callback` | 548 | 548 | init |
| F0454 | `CalendarApplication.(callback)` | 553 | 560 | ArrowFunctionExpression |
### [scripts/chat-controller.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/chat-controller.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0455 | `ChatController.registerRenderHook` | 7 | 21 | static method |
| F0456 | `ChatController.(callback)` | 11 | 19 | ArrowFunctionExpression |
### [scripts/chat-item-use.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/chat-item-use.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0457 | `ChatItemUseService.isEnabled` | 24 | 26 | static method |
| F0458 | `ChatItemUseService.canSend` | 28 | 36 | static method |
| F0459 | `ChatItemUseService.send` | 38 | 90 | static async method |
| F0460 | `isSupportedChatItem` | 93 | 111 | FunctionDeclaration |
| F0461 | `renderSymbaroumItemCard` | 113 | 132 | async FunctionDeclaration |
| F0462 | `buildUseHeader` | 134 | 157 | FunctionDeclaration |
| F0463 | `itemTypeLabel` | 159 | 172 | FunctionDeclaration |
| F0464 | `buildAutomatedAnimationsContext` | 174 | 192 | FunctionDeclaration |
| F0465 | `getSpeakerToken` | 194 | 200 | FunctionDeclaration |
| F0466 | `(callback)` | 195 | 195 | ArrowFunctionExpression |
| F0467 | `getPrimaryTarget` | 202 | 204 | FunctionDeclaration |
| F0468 | `isUnknownImage` | 206 | 208 | FunctionDeclaration |
| F0469 | `fallbackItemCard` | 210 | 225 | FunctionDeclaration |
### [scripts/chat-original-preview.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/chat-original-preview.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0470 | `appendOriginalChatPreview` | 2 | 39 | FunctionDeclaration |
| F0471 | `(callback)` | 23 | 35 | ArrowFunctionExpression |
| F0472 | `highlightUnadaptedContent` | 41 | 59 | FunctionDeclaration |
| F0473 | `findMatchingClone` | 61 | 83 | FunctionDeclaration |
### [scripts/compatibility.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/compatibility.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0474 | `CompatibilityService.register` | 43 | 48 | static method |
| F0475 | `CompatibilityService.applyCrlngnUiCompatibility` | 50 | 88 | static method |
| F0476 | `CompatibilityService.(callback)` | 58 | 87 | ArrowFunctionExpression |
| F0477 | `CompatibilityService.patchRule` | 60 | 76 | ArrowFunctionExpression |
| F0478 | `CompatibilityService.(callback)` | 64 | 70 | ArrowFunctionExpression |
| F0479 | `CompatibilityService.(callback)` | 78 | 78 | ArrowFunctionExpression |
| F0480 | `CompatibilityService.applySheetTitleBarCompatibility` | 90 | 97 | static method |
| F0481 | `CompatibilityService.refresh` | 99 | 102 | static method |
| F0482 | `CompatibilityService.isModuleActive` | 104 | 106 | static method |
| F0483 | `CompatibilityService.isModuleInstalled` | 108 | 110 | static method |
| F0484 | `CompatibilityService.getModule` | 112 | 114 | static method |
| F0485 | `CompatibilityService.canUseLibWrapper` | 116 | 119 | static method |
| F0486 | `CompatibilityService.buildVisualActiveEffectData` | 121 | 123 | static method |
| F0487 | `CompatibilityService.buildContextMenuEntry` | 125 | 127 | static method |
| F0488 | `CompatibilityService.shouldSkipBundledBithir` | 129 | 131 | static method |
| F0489 | `CompatibilityService.shouldSkipMovementRuler` | 133 | 135 | static method |
| F0490 | `CompatibilityService.shouldSkipMovementValidation` | 137 | 139 | static method |
| F0491 | `CompatibilityService.getNoticeDecisions` | 141 | 151 | static method |
| F0492 | `CompatibilityService.(callback)` | 143 | 143 | ArrowFunctionExpression |
| F0493 | `CompatibilityService.(callback)` | 144 | 150 | ArrowFunctionExpression |
| F0494 | `CompatibilityService.showStartupNotice` | 153 | 209 | static async method |
| F0495 | `CompatibilityService.render` | 177 | 177 | init |
| F0496 | `CompatibilityService.callback` | 184 | 187 | async init |
| F0497 | `CompatibilityService.callback` | 202 | 202 | async init |
| F0498 | `CompatibilityService.render` | 206 | 206 | init |
| F0499 | `CompatibilityService.getReport` | 211 | 219 | static method |
| F0500 | `CompatibilityService.(callback)` | 217 | 217 | ArrowFunctionExpression |
| F0501 | `CompatibilityService.getKnownModuleStates` | 221 | 236 | static method |
| F0502 | `CompatibilityService.(callback)` | 223 | 234 | ArrowFunctionExpression |
| F0503 | `CompatibilityService.buildDecisions` | 238 | 329 | static method |
| F0504 | `CompatibilityService.logSummary` | 331 | 341 | static method |
| F0505 | `buildVisualActiveEffectData` | 344 | 359 | FunctionDeclaration |
| F0506 | `buildContextMenuEntry` | 361 | 382 | FunctionDeclaration |
| F0507 | `resolveTarget` | 362 | 362 | ArrowFunctionExpression |
| F0508 | `(callback)` | 364 | 364 | ArrowFunctionExpression |
| F0509 | `onClick` | 372 | 372 | init |
| F0510 | `callback` | 380 | 380 | init |
| F0511 | `resolveDialogElement` | 384 | 389 | FunctionDeclaration |
| F0512 | `decision` | 391 | 400 | FunctionDeclaration |
| F0513 | `getFoundryGeneration` | 402 | 408 | FunctionDeclaration |
| F0514 | `getDecisionModules` | 410 | 423 | FunctionDeclaration |
| F0515 | `(callback)` | 413 | 413 | ArrowFunctionExpression |
| F0516 | `(callback)` | 415 | 422 | ArrowFunctionExpression |
| F0517 | `buildCompatibilityNoticeContent` | 425 | 458 | FunctionDeclaration |
| F0518 | `(callback)` | 426 | 445 | ArrowFunctionExpression |
| F0519 | `(callback)` | 428 | 428 | ArrowFunctionExpression |
| F0520 | `activateNoticeControls` | 460 | 468 | FunctionDeclaration |
| F0521 | `(callback)` | 463 | 467 | ArrowFunctionExpression |
| F0522 | `persistNoticeSuppression` | 470 | 476 | async FunctionDeclaration |
| F0523 | `isNoticeSuppressed` | 478 | 483 | FunctionDeclaration |
| F0524 | `(callback)` | 482 | 482 | ArrowFunctionExpression |
| F0525 | `getNoticeDecisionKeys` | 485 | 490 | FunctionDeclaration |
| F0526 | `(callback)` | 487 | 487 | ArrowFunctionExpression |
| F0527 | `getNoticeDecisionKey` | 492 | 501 | FunctionDeclaration |
| F0528 | `(callback)` | 495 | 495 | ArrowFunctionExpression |
| F0529 | `getAcknowledgedNoticeKeys` | 503 | 509 | FunctionDeclaration |
| F0530 | `(callback)` | 508 | 508 | ArrowFunctionExpression |
| F0531 | `acknowledgeNoticeKeys` | 511 | 523 | async FunctionDeclaration |
| F0532 | `resolveRoot` | 525 | 530 | FunctionDeclaration |
### [scripts/constants.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/constants.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
### [scripts/container-transfer.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/container-transfer.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0533 | `ContainerTransferService.registerHooks` | 19 | 32 | static method |
| F0534 | `ContainerTransferService.(callback)` | 27 | 29 | ArrowFunctionExpression |
| F0535 | `ContainerTransferService.handleActorItemDrop` | 34 | 75 | static async method |
| F0536 | `ContainerTransferService.transferBetweenActors` | 77 | 127 | static async method |
| F0537 | `ContainerTransferService.(callback)` | 115 | 115 | ArrowFunctionExpression |
| F0538 | `ContainerTransferService.handleItemPilePreTransfer` | 129 | 253 | static method |
| F0539 | `ContainerTransferService.(callback)` | 137 | 137 | ArrowFunctionExpression |
| F0540 | `ContainerTransferService.(callback)` | 147 | 147 | ArrowFunctionExpression |
| F0541 | `ContainerTransferService.(callback)` | 151 | 151 | ArrowFunctionExpression |
| F0542 | `ContainerTransferService.(callback)` | 153 | 153 | ArrowFunctionExpression |
| F0543 | `ContainerTransferService.(callback)` | 155 | 155 | ArrowFunctionExpression |
| F0544 | `ContainerTransferService.(callback)` | 157 | 157 | ArrowFunctionExpression |
| F0545 | `ContainerTransferService.(callback)` | 163 | 163 | ArrowFunctionExpression |
| F0546 | `ContainerTransferService.(callback)` | 164 | 164 | ArrowFunctionExpression |
| F0547 | `ContainerTransferService.(callback)` | 164 | 164 | ArrowFunctionExpression |
| F0548 | `ContainerTransferService.(callback)` | 165 | 165 | ArrowFunctionExpression |
| F0549 | `ContainerTransferService.(callback)` | 166 | 166 | ArrowFunctionExpression |
| F0550 | `ContainerTransferService.(callback)` | 187 | 189 | ArrowFunctionExpression |
| F0551 | `ContainerTransferService.(callback)` | 201 | 201 | ArrowFunctionExpression |
| F0552 | `ContainerTransferService.(callback)` | 215 | 215 | ArrowFunctionExpression |
| F0553 | `ContainerTransferService.(callback)` | 225 | 225 | ArrowFunctionExpression |
| F0554 | `ContainerTransferService.dropToItemPile` | 255 | 344 | static async method |
| F0555 | `collectContainerTree` | 347 | 361 | FunctionDeclaration |
| F0556 | `walk` | 351 | 358 | ArrowFunctionExpression |
| F0557 | `findTransferredContainerRoots` | 363 | 371 | FunctionDeclaration |
| F0558 | `(callback)` | 366 | 366 | ArrowFunctionExpression |
| F0559 | `(callback)` | 369 | 369 | ArrowFunctionExpression |
| F0560 | `(callback)` | 370 | 370 | ArrowFunctionExpression |
| F0561 | `normalizeUpdateIds` | 373 | 377 | FunctionDeclaration |
| F0562 | `(callback)` | 375 | 375 | ArrowFunctionExpression |
| F0563 | `buildTransferredItemData` | 379 | 398 | FunctionDeclaration |
| F0564 | `getTransferDeleteAuthorization` | 400 | 402 | FunctionDeclaration |
| F0565 | `findItemPileAt` | 404 | 414 | FunctionDeclaration |
| F0566 | `(callback)` | 406 | 406 | ArrowFunctionExpression |
| F0567 | `(callback)` | 407 | 413 | ArrowFunctionExpression |
| F0568 | `resolveCreatedPile` | 416 | 432 | async FunctionDeclaration |
| F0569 | `(callback)` | 425 | 429 | ArrowFunctionExpression |
| F0570 | `deleteCreatedPile` | 434 | 437 | async FunctionDeclaration |
| F0571 | `(callback)` | 436 | 436 | ArrowFunctionExpression |
| F0572 | `transferContainerWithItemPiles` | 439 | 474 | async FunctionDeclaration |
| F0573 | `(callback)` | 446 | 446 | ArrowFunctionExpression |
| F0574 | `(callback)` | 452 | 452 | ArrowFunctionExpression |
| F0575 | `(callback)` | 457 | 457 | ArrowFunctionExpression |
| F0576 | `(callback)` | 463 | 463 | ArrowFunctionExpression |
| F0577 | `(callback)` | 471 | 471 | ArrowFunctionExpression |
| F0578 | `orderedDeltaSourceIds` | 476 | 480 | FunctionDeclaration |
| F0579 | `(callback)` | 478 | 478 | ArrowFunctionExpression |
| F0580 | `isContainerTransferInteraction` | 482 | 486 | FunctionDeclaration |
| F0581 | `getItemPilesProvider` | 488 | 506 | FunctionDeclaration |
| F0582 | `isModuleActive` | 508 | 510 | FunctionDeclaration |
| F0583 | `notifyProviderIssue` | 512 | 523 | FunctionDeclaration |
| F0584 | `notifyInaccessibleGroundDrop` | 525 | 529 | FunctionDeclaration |
| F0585 | `canTransferActors` | 531 | 534 | FunctionDeclaration |
| F0586 | `canReceiveTransferredContainer` | 536 | 539 | FunctionDeclaration |
| F0587 | `isTopLevelContainer` | 541 | 543 | FunctionDeclaration |
| F0588 | `isTransferableContainerRoot` | 545 | 547 | FunctionDeclaration |
| F0589 | `isGroundContainerRoot` | 549 | 560 | FunctionDeclaration |
| F0590 | `getStoredIn` | 562 | 564 | FunctionDeclaration |
| F0591 | `rootPreviousState` | 566 | 571 | FunctionDeclaration |
| F0592 | `newItemId` | 573 | 576 | FunctionDeclaration |
| F0593 | `clone` | 578 | 581 | FunctionDeclaration |
| F0594 | `resolveUuid` | 583 | 587 | async FunctionDeclaration |
| F0595 | `deleteCreatedItems` | 589 | 596 | async FunctionDeclaration |
| F0596 | `(callback)` | 590 | 590 | ArrowFunctionExpression |
| F0597 | `(callback)` | 595 | 595 | ArrowFunctionExpression |
| F0598 | `resolveActor` | 598 | 603 | FunctionDeclaration |
| F0599 | `(callback)` | 600 | 600 | ArrowFunctionExpression |
| F0600 | `hasCanvasCoordinate` | 605 | 608 | FunctionDeclaration |
### [scripts/containers.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/containers.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0601 | `ContainerService.registerHooks` | 129 | 158 | static method |
| F0602 | `ContainerService.(callback)` | 133 | 142 | ArrowFunctionExpression |
| F0603 | `ContainerService.(callback)` | 144 | 147 | ArrowFunctionExpression |
| F0604 | `ContainerService.(callback)` | 149 | 157 | ArrowFunctionExpression |
| F0605 | `ContainerService.(callback)` | 154 | 156 | ArrowFunctionExpression |
| F0606 | `ContainerService.isContainer` | 160 | 169 | static method |
| F0607 | `ContainerService.isCampingEquipment` | 171 | 173 | static method |
| F0608 | `ContainerService.isCampingContentAllowed` | 175 | 178 | static method |
| F0609 | `ContainerService.(callback)` | 177 | 177 | ArrowFunctionExpression |
| F0610 | `ContainerService.isStoredInCampingEquipment` | 180 | 184 | static method |
| F0611 | `ContainerService.isEnabled` | 186 | 192 | static method |
| F0612 | `ContainerService.isStored` | 194 | 196 | static method |
| F0613 | `ContainerService.isAccessible` | 198 | 200 | static method |
| F0614 | `ContainerService.getStoredIn` | 202 | 204 | static method |
| F0615 | `ContainerService.canStoreItem` | 206 | 208 | static method |
| F0616 | `ContainerService.canAttemptStoreItem` | 210 | 220 | static method |
| F0617 | `ContainerService.getContainers` | 222 | 230 | static method |
| F0618 | `ContainerService.(callback)` | 224 | 229 | ArrowFunctionExpression |
| F0619 | `ContainerService.getAvailableContainers` | 232 | 236 | static method |
| F0620 | `ContainerService.(callback)` | 233 | 235 | ArrowFunctionExpression |
| F0621 | `ContainerService.getContainerCapacity` | 238 | 246 | static method |
| F0622 | `ContainerService.getContainerUsedSlots` | 248 | 250 | static method |
| F0623 | `ContainerService.getContainerCapacityLabel` | 252 | 256 | static method |
| F0624 | `ContainerService.canStoreInContainer` | 258 | 270 | static method |
| F0625 | `ContainerService.setContainerCapacity` | 272 | 282 | static async method |
| F0626 | `ContainerService.configureItemContainerPrompt` | 284 | 402 | static async method |
| F0627 | `ContainerService.render` | 352 | 367 | init |
| F0628 | `ContainerService.(callback)` | 358 | 360 | ArrowFunctionExpression |
| F0629 | `ContainerService.(callback)` | 362 | 366 | ArrowFunctionExpression |
| F0630 | `ContainerService.(callback)` | 363 | 365 | ArrowFunctionExpression |
| F0631 | `ContainerService.callback` | 368 | 372 | init |
| F0632 | `ContainerService.configureContainerPrompt` | 404 | 406 | static async method |
| F0633 | `ContainerService.getStoredItems` | 408 | 411 | static method |
| F0634 | `ContainerService.(callback)` | 410 | 410 | ArrowFunctionExpression |
| F0635 | `ContainerService.canPreserveContentsOnDelete` | 413 | 423 | static method |
| F0636 | `ContainerService.allowDeleteWithTransferredContents` | 425 | 432 | static method |
| F0637 | `ContainerService.(callback)` | 429 | 429 | ArrowFunctionExpression |
| F0638 | `ContainerService.isTransferredDeleteAuthorized` | 434 | 440 | static method |
| F0639 | `ContainerService.authorizeTransferredDeletes` | 442 | 457 | static async method |
| F0640 | `ContainerService.(callback)` | 445 | 445 | ArrowFunctionExpression |
| F0641 | `ContainerService.(callback)` | 446 | 453 | ArrowFunctionExpression |
| F0642 | `ContainerService.revokeTransferredDeletes` | 459 | 470 | static async method |
| F0643 | `ContainerService.(callback)` | 462 | 462 | ArrowFunctionExpression |
| F0644 | `ContainerService.(callback)` | 463 | 466 | ArrowFunctionExpression |
| F0645 | `ContainerService.consumeAllowedTransferredDelete` | 472 | 476 | static method |
| F0646 | `ContainerService.deleteContainerPreservingContents` | 478 | 485 | static async method |
| F0647 | `ContainerService.storeItemPrompt` | 487 | 543 | static async method |
| F0648 | `ContainerService.(callback)` | 498 | 498 | ArrowFunctionExpression |
| F0649 | `ContainerService.(callback)` | 500 | 502 | ArrowFunctionExpression |
| F0650 | `ContainerService.(callback)` | 507 | 507 | ArrowFunctionExpression |
| F0651 | `ContainerService.callback` | 533 | 536 | init |
| F0652 | `ContainerService.storeItemInContainerPrompt` | 545 | 576 | static async method |
| F0653 | `ContainerService.callback` | 571 | 571 | init |
| F0654 | `ContainerService.storeItem` | 578 | 633 | static async method |
| F0655 | `ContainerService.openContainer` | 635 | 637 | static async method |
| F0656 | `ContainerService.toggleContainer` | 639 | 649 | static async method |
| F0657 | `ContainerService.isContainerExpanded` | 651 | 654 | static method |
| F0658 | `ContainerService.collapseContainer` | 656 | 661 | static async method |
| F0659 | `ContainerService.recoverStoredItemsFromDeletedContainer` | 663 | 676 | static async method |
| F0660 | `ContainerService.(callback)` | 667 | 667 | ArrowFunctionExpression |
| F0661 | `ContainerService.recoverOrphanedStoredItems` | 678 | 690 | static async method |
| F0662 | `ContainerService.(callback)` | 680 | 685 | ArrowFunctionExpression |
| F0663 | `ContainerService.synchronizeActorStates` | 692 | 723 | static async method |
| F0664 | `ContainerService.withdrawItemPrompt` | 725 | 727 | static async method |
| F0665 | `ContainerService.splitItemPrompt` | 729 | 762 | static async method |
| F0666 | `ContainerService.callback` | 756 | 756 | init |
| F0667 | `ContainerService.withdrawItem` | 764 | 812 | static async method |
| F0668 | `getStorableQuantity` | 815 | 817 | FunctionDeclaration |
| F0669 | `buildStoreDialogContent` | 819 | 843 | FunctionDeclaration |
| F0670 | `buildContainerSelect` | 845 | 857 | FunctionDeclaration |
| F0671 | `(callback)` | 846 | 849 | ArrowFunctionExpression |
| F0672 | `normalizeCapacityConfig` | 859 | 866 | FunctionDeclaration |
| F0673 | `getDefaultContainerCapacity` | 868 | 874 | FunctionDeclaration |
| F0674 | `isAccessibleState` | 876 | 878 | FunctionDeclaration |
| F0675 | `canMutateActor` | 880 | 882 | FunctionDeclaration |
| F0676 | `isValidOwnedActorItem` | 884 | 887 | FunctionDeclaration |
| F0677 | `isValidStoreRelationship` | 889 | 893 | FunctionDeclaration |
| F0678 | `warnInaccessibleState` | 895 | 897 | FunctionDeclaration |
| F0679 | `warnCampingRestriction` | 899 | 904 | FunctionDeclaration |
| F0680 | `findVisibleStack` | 906 | 920 | FunctionDeclaration |
| F0681 | `(callback)` | 909 | 919 | ArrowFunctionExpression |
| F0682 | `findStoredStack` | 922 | 936 | FunctionDeclaration |
| F0683 | `(callback)` | 924 | 935 | ArrowFunctionExpression |
| F0684 | `areStackCompatible` | 938 | 941 | FunctionDeclaration |
| F0685 | `stackComparableSource` | 943 | 959 | FunctionDeclaration |
| F0686 | `createSplitStack` | 961 | 976 | async FunctionDeclaration |
| F0687 | `(callback)` | 966 | 966 | ArrowFunctionExpression |
| F0688 | `mergeAndDeleteStack` | 978 | 991 | async FunctionDeclaration |
| F0689 | `stableStringify` | 993 | 999 | FunctionDeclaration |
| F0690 | `(callback)` | 996 | 996 | ArrowFunctionExpression |
| F0691 | `itemTransferDeleteKey` | 1001 | 1004 | FunctionDeclaration |
| F0692 | `createStoredItemData` | 1006 | 1020 | FunctionDeclaration |
| F0693 | `restoreStoredItems` | 1022 | 1035 | async FunctionDeclaration |
| F0694 | `(callback)` | 1023 | 1032 | ArrowFunctionExpression |
| F0695 | `seedContainerContents` | 1037 | 1049 | async FunctionDeclaration |
| F0696 | `seedContainerContentsNow` | 1051 | 1072 | async FunctionDeclaration |
| F0697 | `scheduleCampingContentsSeed` | 1074 | 1089 | FunctionDeclaration |
| F0698 | `(callback)` | 1081 | 1088 | ArrowFunctionExpression |
| F0699 | `(callback)` | 1085 | 1087 | ArrowFunctionExpression |
| F0700 | `isCampingEquipment` | 1091 | 1093 | FunctionDeclaration |
| F0701 | `extractCampingContentRefs` | 1095 | 1113 | FunctionDeclaration |
| F0702 | `addContentRef` | 1115 | 1123 | FunctionDeclaration |
| F0703 | `(callback)` | 1119 | 1119 | ArrowFunctionExpression |
| F0704 | `findReferencedItem` | 1125 | 1133 | async FunctionDeclaration |
| F0705 | `(callback)` | 1132 | 1132 | ArrowFunctionExpression |
| F0706 | `createSeededStoredItemData` | 1135 | 1160 | FunctionDeclaration |
| F0707 | `stripHtml` | 1162 | 1168 | FunctionDeclaration |
| F0708 | `hasAlias` | 1170 | 1176 | FunctionDeclaration |
| F0709 | `(callback)` | 1172 | 1175 | ArrowFunctionExpression |
| F0710 | `toSearchableText` | 1178 | 1180 | FunctionDeclaration |
| F0711 | `containerExpansionKey` | 1182 | 1184 | FunctionDeclaration |
| F0712 | `getContainerExpansionState` | 1186 | 1202 | FunctionDeclaration |
| F0713 | `setContainerExpanded` | 1204 | 1219 | async FunctionDeclaration |
| F0714 | `mergeItemUpdates` | 1221 | 1227 | FunctionDeclaration |
### [scripts/death-automation.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/death-automation.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0715 | `resolveDeathTestOutcome` | 20 | 39 | FunctionDeclaration |
| F0716 | `buildDeathTurnKey` | 41 | 44 | FunctionDeclaration |
| F0717 | `getDeathState` | 46 | 50 | FunctionDeclaration |
| F0718 | `isDyingActor` | 52 | 55 | FunctionDeclaration |
| F0719 | `isDeadActor` | 57 | 59 | FunctionDeclaration |
| F0720 | `isDeathIncapacitated` | 61 | 63 | FunctionDeclaration |
| F0721 | `shouldRecoverAfterStatusRemoval` | 69 | 77 | FunctionDeclaration |
| F0722 | `removeStatus` | 79 | 98 | async FunctionDeclaration |
| F0723 | `(callback)` | 90 | 90 | ArrowFunctionExpression |
| F0724 | `(callback)` | 91 | 91 | ArrowFunctionExpression |
| F0725 | `isRegisteredStatus` | 100 | 102 | FunctionDeclaration |
| F0726 | `(callback)` | 101 | 101 | ArrowFunctionExpression |
| F0727 | `shouldEnterDyingState` | 104 | 111 | FunctionDeclaration |
| F0728 | `selectDeathManager` | 113 | 121 | FunctionDeclaration |
| F0729 | `(callback)` | 114 | 114 | ArrowFunctionExpression |
| F0730 | `(callback)` | 116 | 116 | ArrowFunctionExpression |
| F0731 | `(callback)` | 116 | 116 | ArrowFunctionExpression |
| F0732 | `(callback)` | 119 | 119 | ArrowFunctionExpression |
| F0733 | `(callback)` | 120 | 120 | ArrowFunctionExpression |
| F0734 | `buildDyingEffectData` | 123 | 133 | FunctionDeclaration |
| F0735 | `DeathAutomationService.register` | 136 | 189 | static method |
| F0736 | `DeathAutomationService.(callback)` | 141 | 145 | ArrowFunctionExpression |
| F0737 | `DeathAutomationService.(callback)` | 147 | 160 | ArrowFunctionExpression |
| F0738 | `DeathAutomationService.(callback)` | 162 | 168 | ArrowFunctionExpression |
| F0739 | `DeathAutomationService.(callback)` | 170 | 173 | ArrowFunctionExpression |
| F0740 | `DeathAutomationService.(callback)` | 174 | 178 | ArrowFunctionExpression |
| F0741 | `DeathAutomationService.(callback)` | 179 | 179 | ArrowFunctionExpression |
| F0742 | `DeathAutomationService.(callback)` | 180 | 180 | ArrowFunctionExpression |
| F0743 | `DeathAutomationService.(callback)` | 181 | 188 | ArrowFunctionExpression |
| F0744 | `DeathAutomationService.ready` | 191 | 194 | static async method |
| F0745 | `DeathAutomationService.isEnabled` | 196 | 198 | static method |
| F0746 | `DeathAutomationService.isManager` | 200 | 204 | static method |
| F0747 | `DeathAutomationService.reconcileAll` | 206 | 211 | static async method |
| F0748 | `DeathAutomationService.suspendAll` | 213 | 223 | static async method |
| F0749 | `DeathAutomationService.reconcileActor` | 225 | 261 | static async method |
| F0750 | `DeathAutomationService.enterDying` | 263 | 282 | static async method |
| F0751 | `DeathAutomationService.recoverActor` | 284 | 293 | static async method |
| F0752 | `DeathAutomationService.killActor` | 295 | 312 | static async method |
| F0753 | `DeathAutomationService.promptCurrentCombatant` | 314 | 318 | static async method |
| F0754 | `DeathAutomationService.ensurePrompt` | 320 | 343 | static async method |
| F0755 | `DeathAutomationService.syncNativeSheetButtons` | 345 | 365 | static method |
| F0756 | `DeathAutomationService.(callback)` | 357 | 363 | ArrowFunctionExpression |
| F0757 | `resolveDeathTestAsAuthority` | 368 | 446 | async FunctionDeclaration |
| F0758 | `(callback)` | 432 | 432 | ArrowFunctionExpression |
| F0759 | `(callback)` | 436 | 436 | ArrowFunctionExpression |
| F0760 | `bindDeathPrompt` | 448 | 480 | FunctionDeclaration |
| F0761 | `(callback)` | 463 | 479 | async ArrowFunctionExpression |
| F0762 | `requestDeathRollOptions` | 482 | 514 | FunctionDeclaration |
| F0763 | `(callback)` | 484 | 513 | ArrowFunctionExpression |
| F0764 | `callback` | 498 | 505 | init |
| F0765 | `callback` | 507 | 507 | init |
| F0766 | `close` | 510 | 510 | init |
| F0767 | `buildDeathPromptHtml` | 516 | 526 | FunctionDeclaration |
| F0768 | `buildDeathResultHtml` | 528 | 547 | FunctionDeclaration |
| F0769 | `createDyingMessage` | 549 | 554 | async FunctionDeclaration |
| F0770 | `createRecoveryMessage` | 556 | 561 | async FunctionDeclaration |
| F0771 | `createDeathMessage` | 563 | 568 | async FunctionDeclaration |
| F0772 | `applyStatus` | 570 | 585 | async FunctionDeclaration |
| F0773 | `setDeadPresentation` | 587 | 601 | async FunctionDeclaration |
| F0774 | `clearDeathPrompts` | 603 | 614 | async FunctionDeclaration |
| F0775 | `findCombatant` | 616 | 618 | FunctionDeclaration |
| F0776 | `(callback)` | 617 | 617 | ArrowFunctionExpression |
| F0777 | `normalizeRollOptions` | 620 | 624 | FunctionDeclaration |
| F0778 | `requestUser` | 626 | 631 | FunctionDeclaration |
| F0779 | `ownsActor` | 633 | 640 | FunctionDeclaration |
| F0780 | `hasToughnessChange` | 642 | 645 | FunctionDeclaration |
| F0781 | `toughness` | 647 | 649 | FunctionDeclaration |
| F0782 | `actorKey` | 651 | 653 | FunctionDeclaration |
| F0783 | `allPlayerActors` | 655 | 665 | FunctionDeclaration |
| F0784 | `isAutomationEnabled` | 667 | 673 | FunctionDeclaration |
| F0785 | `actorByUuidSync` | 675 | 678 | FunctionDeclaration |
| F0786 | `(callback)` | 677 | 677 | ArrowFunctionExpression |
| F0787 | `hasStatus` | 680 | 683 | FunctionDeclaration |
| F0788 | `(callback)` | 682 | 682 | ArrowFunctionExpression |
| F0789 | `statusEffectId` | 685 | 691 | FunctionDeclaration |
| F0790 | `portraitHtml` | 693 | 696 | FunctionDeclaration |
| F0791 | `logError` | 698 | 700 | FunctionDeclaration |
### [scripts/dice.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/dice.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0792 | `registerDiceHooks` | 5 | 12 | FunctionDeclaration |
| F0793 | `(callback)` | 8 | 11 | ArrowFunctionExpression |
| F0794 | `evaluateRoll` | 14 | 22 | async FunctionDeclaration |
| F0795 | `rollTotal` | 24 | 26 | FunctionDeclaration |
| F0796 | `createChatMessageAfterDice` | 28 | 56 | async FunctionDeclaration |
| F0797 | `(callback)` | 36 | 36 | ArrowFunctionExpression |
| F0798 | `showDice3dRoll` | 58 | 60 | async FunctionDeclaration |
| F0799 | `isFoundryRoll` | 62 | 64 | FunctionDeclaration |
| F0800 | `getRollMode` | 66 | 79 | FunctionDeclaration |
| F0801 | `getRollVisibility` | 81 | 96 | FunctionDeclaration |
| F0802 | `(callback)` | 90 | 90 | ArrowFunctionExpression |
| F0803 | `(callback)` | 90 | 90 | ArrowFunctionExpression |
| F0804 | `showDice3d` | 98 | 112 | async FunctionDeclaration |
| F0805 | `createFallbackRoll` | 114 | 125 | FunctionDeclaration |
### [scripts/encumbrance-db.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/encumbrance-db.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0806 | `loadEncumbranceWeights` | 18 | 38 | async FunctionDeclaration |
| F0807 | `applyDynamicEncumbranceWeights` | 40 | 43 | FunctionDeclaration |
| F0808 | `getDynamicEncumbranceWeights` | 45 | 51 | FunctionDeclaration |
| F0809 | `hasConfiguredEncumbranceRule` | 53 | 55 | FunctionDeclaration |
| F0810 | `upsertDynamicSlotRule` | 57 | 65 | FunctionDeclaration |
| F0811 | `detectEncumbranceSlots` | 71 | 74 | FunctionDeclaration |
| F0812 | `hasExactEncumbranceItem` | 76 | 78 | FunctionDeclaration |
| F0813 | `hasMassiveQuality` | 83 | 103 | FunctionDeclaration |
| F0814 | `getStackBundleRule` | 108 | 110 | FunctionDeclaration |
| F0815 | `calculateStackBundleSlots` | 115 | 121 | FunctionDeclaration |
| F0816 | `getWeightConfigVersion` | 126 | 128 | FunctionDeclaration |
| F0817 | `rebuildWeightConfig` | 130 | 137 | FunctionDeclaration |
| F0818 | `sanitizeWeightConfig` | 139 | 158 | FunctionDeclaration |
| F0819 | `sanitizeItems` | 160 | 165 | FunctionDeclaration |
| F0820 | `(callback)` | 163 | 163 | ArrowFunctionExpression |
| F0821 | `(callback)` | 164 | 164 | ArrowFunctionExpression |
| F0822 | `sanitizeBundles` | 167 | 186 | FunctionDeclaration |
| F0823 | `(callback)` | 184 | 184 | ArrowFunctionExpression |
| F0824 | `(callback)` | 185 | 185 | ArrowFunctionExpression |
| F0825 | `sanitizeBundleValue` | 188 | 196 | FunctionDeclaration |
| F0826 | `legacySlotsToItems` | 198 | 209 | FunctionDeclaration |
| F0827 | `sanitizeAliases` | 211 | 214 | FunctionDeclaration |
| F0828 | `(callback)` | 213 | 213 | ArrowFunctionExpression |
| F0829 | `cloneBundles` | 216 | 221 | FunctionDeclaration |
| F0830 | `(callback)` | 217 | 220 | ArrowFunctionExpression |
| F0831 | `emptyWeightConfig` | 223 | 225 | FunctionDeclaration |
| F0832 | `findExactItemEntry` | 227 | 235 | FunctionDeclaration |
### [scripts/encumbrance-visuals.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/encumbrance-visuals.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0833 | `registerHooks` | 13 | 29 | init |
| F0834 | `(callback)` | 14 | 14 | ArrowFunctionExpression |
| F0835 | `(callback)` | 15 | 15 | ArrowFunctionExpression |
| F0836 | `(callback)` | 16 | 16 | ArrowFunctionExpression |
| F0837 | `(callback)` | 17 | 19 | ArrowFunctionExpression |
| F0838 | `(callback)` | 20 | 22 | ArrowFunctionExpression |
| F0839 | `(callback)` | 23 | 27 | ArrowFunctionExpression |
| F0840 | `(callback)` | 28 | 28 | ArrowFunctionExpression |
| F0841 | `refreshAllIndicators` | 31 | 33 | init |
| F0842 | `syncActorIndicator` | 35 | 49 | async init |
| F0843 | `(callback)` | 47 | 47 | ArrowFunctionExpression |
| F0844 | `runQueuedIndicatorSync` | 52 | 59 | async FunctionDeclaration |
| F0845 | `isEncumbranceIndicatorEffect` | 61 | 64 | FunctionDeclaration |
| F0846 | `actorUpdateAffectsEncumbrance` | 66 | 73 | FunctionDeclaration |
| F0847 | `(callback)` | 69 | 72 | ArrowFunctionExpression |
| F0848 | `syncActorIndicator` | 75 | 105 | async FunctionDeclaration |
| F0849 | `(callback)` | 82 | 82 | ArrowFunctionExpression |
| F0850 | `(callback)` | 89 | 89 | ArrowFunctionExpression |
| F0851 | `buildIndicatorData` | 107 | 118 | FunctionDeclaration |
| F0852 | `indicatorMatches` | 120 | 129 | FunctionDeclaration |
| F0853 | `(callback)` | 127 | 127 | ArrowFunctionExpression |
| F0854 | `queueIndicatorSync` | 131 | 135 | FunctionDeclaration |
| F0855 | `(callback)` | 134 | 134 | ArrowFunctionExpression |
| F0856 | `getRelevantActors` | 137 | 144 | FunctionDeclaration |
### [scripts/encumbrance.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/encumbrance.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0857 | `itemSlotsCacheKey` | 23 | 27 | FunctionDeclaration |
| F0858 | `EncumbranceService.loadWeightConfig` | 137 | 140 | static async method |
| F0859 | `EncumbranceService.applyDynamicWeightConfig` | 142 | 144 | static method |
| F0860 | `EncumbranceService.discoverKnownItems` | 150 | 175 | static async method |
| F0861 | `EncumbranceService.learnItem` | 177 | 189 | static method |
| F0862 | `EncumbranceService.(callback)` | 184 | 186 | ArrowFunctionExpression |
| F0863 | `EncumbranceService.rememberItemWeight` | 191 | 196 | static async method |
| F0864 | `EncumbranceService.getItemSlots` | 202 | 209 | static method |
| F0865 | `EncumbranceService.computeItemSlots` | 211 | 228 | static method |
| F0866 | `EncumbranceService.getItemStackSlots` | 234 | 245 | static method |
| F0867 | `EncumbranceService.hasComputedStackWeight` | 247 | 249 | static method |
| F0868 | `EncumbranceService.getItemLoad` | 254 | 351 | static method |
| F0869 | `EncumbranceService.calculateLoad` | 357 | 405 | static method |
| F0870 | `EncumbranceService.applyDefensePenalty` | 411 | 426 | static method |
| F0871 | `EncumbranceService.(callback)` | 420 | 420 | ArrowFunctionExpression |
| F0872 | `EncumbranceService.clearDefensePenalty` | 428 | 438 | static method |
| F0873 | `EncumbranceService.(callback)` | 434 | 434 | ArrowFunctionExpression |
| F0874 | `getStrongValue` | 442 | 451 | FunctionDeclaration |
| F0875 | `sanitizeSlots` | 453 | 457 | FunctionDeclaration |
| F0876 | `isTrackedGear` | 459 | 461 | FunctionDeclaration |
| F0877 | `hasGearState` | 463 | 465 | FunctionDeclaration |
| F0878 | `isEquippedGearState` | 467 | 470 | FunctionDeclaration |
| F0879 | `isStoredInCarriedContainer` | 472 | 477 | FunctionDeclaration |
| F0880 | `encumbranceQuantity` | 479 | 482 | FunctionDeclaration |
| F0881 | `calculateStackedSlots` | 484 | 488 | FunctionDeclaration |
| F0882 | `isProjectileBundleRule` | 490 | 492 | FunctionDeclaration |
| F0883 | `armorCarriedSlots` | 494 | 511 | FunctionDeclaration |
| F0884 | `weaponCarriedSlots` | 513 | 515 | FunctionDeclaration |
| F0885 | `isHeavyWeapon` | 517 | 531 | FunctionDeclaration |
| F0886 | `(callback)` | 525 | 525 | ArrowFunctionExpression |
| F0887 | `(callback)` | 530 | 530 | ArrowFunctionExpression |
| F0888 | `isNoArmorName` | 533 | 535 | FunctionDeclaration |
| F0889 | `(callback)` | 534 | 534 | ArrowFunctionExpression |
| F0890 | `isLightArmorName` | 537 | 539 | FunctionDeclaration |
| F0891 | `(callback)` | 538 | 538 | ArrowFunctionExpression |
| F0892 | `isMediumArmorName` | 541 | 543 | FunctionDeclaration |
| F0893 | `(callback)` | 542 | 542 | ArrowFunctionExpression |
| F0894 | `isHeavyArmorName` | 545 | 547 | FunctionDeclaration |
| F0895 | `(callback)` | 546 | 546 | ArrowFunctionExpression |
| F0896 | `defaultLoadResult` | 549 | 562 | FunctionDeclaration |
| F0897 | `applyPenaltyToArmorData` | 564 | 573 | FunctionDeclaration |
| F0898 | `actorHasAbility` | 575 | 586 | FunctionDeclaration |
| F0899 | `readDynamicWeightSetting` | 588 | 593 | FunctionDeclaration |
| F0900 | `canPersistDynamicWeights` | 595 | 600 | FunctionDeclaration |
| F0901 | `persistDynamicWeightConfig` | 602 | 606 | async FunctionDeclaration |
| F0902 | `loadCompendiumItems` | 608 | 632 | async FunctionDeclaration |
| F0903 | `compendiumIndexEntryToItem` | 634 | 642 | FunctionDeclaration |
| F0904 | `getFlag` | 640 | 640 | init |
### [scripts/expedition-data.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/expedition-data.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0905 | `getDavokarMishapsTableData` | 190 | 217 | FunctionDeclaration |
| F0906 | `(callback)` | 191 | 199 | ArrowFunctionExpression |
### [scripts/expedition-orientation.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/expedition-orientation.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0907 | `orientationRequirements` | 5 | 8 | FunctionDeclaration |
| F0908 | `orientationBoon` | 10 | 22 | FunctionDeclaration |
| F0909 | `(callback)` | 16 | 16 | ArrowFunctionExpression |
| F0910 | `orientationContext` | 24 | 46 | FunctionDeclaration |
| F0911 | `boundOrientationTarget` | 48 | 51 | FunctionDeclaration |
| F0912 | `(callback)` | 49 | 49 | ArrowFunctionExpression |
| F0913 | `rollOrientationTest` | 54 | 56 | async FunctionDeclaration |
| F0914 | `rollExpeditionAttribute` | 58 | 72 | async FunctionDeclaration |
### [scripts/expedition-private.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/expedition-private.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0915 | `privatePack` | 10 | 28 | async FunctionDeclaration |
| F0916 | `(callback)` | 21 | 21 | ArrowFunctionExpression |
| F0917 | `ensureExpeditionPrivateStorage` | 30 | 30 | async FunctionDeclaration |
| F0918 | `canReadExpeditionResult` | 32 | 37 | FunctionDeclaration |
| F0919 | `readPrivateExpeditionResult` | 39 | 48 | async FunctionDeclaration |
| F0920 | `storePrivateExpeditionResult` | 50 | 62 | async FunctionDeclaration |
| F0921 | `expeditionReadKey` | 66 | 69 | async FunctionDeclaration |
| F0922 | `readCipher` | 71 | 75 | async FunctionDeclaration |
| F0923 | `(callback)` | 72 | 72 | ArrowFunctionExpression |
| F0924 | `sealExpeditionRead` | 77 | 83 | async FunctionDeclaration |
| F0925 | `openExpeditionRead` | 85 | 89 | async FunctionDeclaration |
### [scripts/expedition-state.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/expedition-state.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0926 | `getActorExpeditionData` | 6 | 28 | FunctionDeclaration |
| F0927 | `expeditionDayKey` | 31 | 34 | FunctionDeclaration |
| F0928 | `expeditionOrientationKey` | 36 | 41 | FunctionDeclaration |
| F0929 | `expeditionEventKey` | 43 | 46 | FunctionDeclaration |
| F0930 | `(callback)` | 45 | 45 | ArrowFunctionExpression |
| F0931 | `expeditionDayUpdate` | 48 | 60 | FunctionDeclaration |
| F0932 | `runExpeditionOperation` | 63 | 73 | async FunctionDeclaration |
| F0933 | `(callback)` | 66 | 66 | ArrowFunctionExpression |
### [scripts/gm-log-events.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/gm-log-events.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0934 | `normalizeGmLogEvent` | 116 | 141 | FunctionDeclaration |
| F0935 | `gmLogEventKey` | 144 | 150 | FunctionDeclaration |
| F0936 | `deduplicateGmLogEvents` | 156 | 179 | FunctionDeclaration |
| F0937 | `(callback)` | 178 | 178 | ArrowFunctionExpression |
| F0938 | `gmLogEventPresentation` | 182 | 222 | FunctionDeclaration |
| F0939 | `normalizeSource` | 224 | 232 | FunctionDeclaration |
| F0940 | `normalizeReference` | 234 | 241 | FunctionDeclaration |
| F0941 | `normalizeValues` | 243 | 260 | FunctionDeclaration |
| F0942 | `(callback)` | 256 | 256 | ArrowFunctionExpression |
| F0943 | `normalizeOutcome` | 262 | 265 | FunctionDeclaration |
| F0944 | `normalizeTimestamp` | 267 | 270 | FunctionDeclaration |
| F0945 | `sourcePriority` | 272 | 274 | FunctionDeclaration |
| F0946 | `scalarText` | 276 | 281 | FunctionDeclaration |
| F0947 | `cleanIdentifier` | 283 | 285 | FunctionDeclaration |
| F0948 | `cleanText` | 287 | 289 | FunctionDeclaration |
| F0949 | `isPlainObject` | 291 | 293 | FunctionDeclaration |
### [scripts/gm-log-message-adapter.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/gm-log-message-adapter.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0950 | `gmLogEventFromMessage` | 8 | 29 | FunctionDeclaration |
| F0951 | `structuredModuleEvent` | 61 | 86 | FunctionDeclaration |
| F0952 | `structuredValues` | 88 | 96 | FunctionDeclaration |
| F0953 | `(callback)` | 91 | 94 | ArrowFunctionExpression |
| F0954 | `combatEvent` | 98 | 120 | FunctionDeclaration |
| F0955 | `weaponReadinessEvent` | 122 | 134 | FunctionDeclaration |
| F0956 | `itemUseEvent` | 136 | 147 | FunctionDeclaration |
| F0957 | `contentEvent` | 149 | 160 | FunctionDeclaration |
| F0958 | `nativeCombatEvent` | 162 | 191 | FunctionDeclaration |
| F0959 | `(callback)` | 172 | 172 | ArrowFunctionExpression |
| F0960 | `(callback)` | 173 | 173 | ArrowFunctionExpression |
| F0961 | `nativeRollEvent` | 193 | 207 | FunctionDeclaration |
| F0962 | `nativeAbilityEvent` | 209 | 225 | FunctionDeclaration |
| F0963 | `maneuverEvent` | 227 | 246 | FunctionDeclaration |
| F0964 | `ammoReloadEvent` | 248 | 263 | FunctionDeclaration |
| F0965 | `ammoRecoveryEvent` | 265 | 283 | FunctionDeclaration |
| F0966 | `rationEvent` | 285 | 300 | FunctionDeclaration |
| F0967 | `restEvent` | 302 | 317 | FunctionDeclaration |
| F0968 | `contentRoot` | 319 | 324 | FunctionDeclaration |
| F0969 | `actorFromMessage` | 326 | 331 | FunctionDeclaration |
| F0970 | `itemFromUuid` | 333 | 335 | FunctionDeclaration |
| F0971 | `documentFromUuid` | 337 | 344 | FunctionDeclaration |
| F0972 | `referenceFromUuid` | 346 | 348 | FunctionDeclaration |
| F0973 | `referenceFromUuidOrName` | 350 | 355 | FunctionDeclaration |
| F0974 | `documentReference` | 357 | 364 | FunctionDeclaration |
| F0975 | `speakerReference` | 366 | 368 | FunctionDeclaration |
| F0976 | `referenceByName` | 370 | 373 | FunctionDeclaration |
| F0977 | `findItemByName` | 375 | 378 | FunctionDeclaration |
| F0978 | `(callback)` | 377 | 377 | ArrowFunctionExpression |
| F0979 | `itemNames` | 380 | 382 | FunctionDeclaration |
| F0980 | `(callback)` | 381 | 381 | ArrowFunctionExpression |
| F0981 | `labeledRows` | 384 | 390 | FunctionDeclaration |
| F0982 | `(callback)` | 385 | 389 | ArrowFunctionExpression |
| F0983 | `rowByLabels` | 392 | 395 | FunctionDeclaration |
| F0984 | `(callback)` | 394 | 394 | ArrowFunctionExpression |
| F0985 | `opposedFormula` | 397 | 403 | FunctionDeclaration |
| F0986 | `(callback)` | 399 | 399 | ArrowFunctionExpression |
| F0987 | `combatDamage` | 405 | 408 | FunctionDeclaration |
| F0988 | `ammoNameFromRecovery` | 410 | 412 | FunctionDeclaration |
| F0989 | `outcomeFromText` | 414 | 420 | FunctionDeclaration |
| F0990 | `numericValue` | 422 | 427 | FunctionDeclaration |
| F0991 | `cleanId` | 429 | 431 | FunctionDeclaration |
| F0992 | `cleanText` | 433 | 435 | FunctionDeclaration |
| F0993 | `comparable` | 437 | 439 | FunctionDeclaration |
| F0994 | `escapeRegExp` | 441 | 443 | FunctionDeclaration |
| F0995 | `isPlainObject` | 445 | 447 | FunctionDeclaration |
### [scripts/gm-log-service.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/gm-log-service.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F0996 | `isGmLogEnabled` | 17 | 23 | FunctionDeclaration |
| F0997 | `GmLogStore.constructor` | 30 | 32 | constructor |
| F0998 | `GmLogStore.add` | 34 | 49 | method |
| F0999 | `GmLogStore.removeMessage` | 51 | 61 | method |
| F1000 | `GmLogStore.clear` | 63 | 68 | method |
| F1001 | `GmLogStore.snapshot` | 70 | 75 | method |
| F1002 | `GmLogStore.(callback)` | 72 | 72 | ArrowFunctionExpression |
| F1003 | `GmLogStore.(callback)` | 73 | 73 | ArrowFunctionExpression |
| F1004 | `GmLogStore.#trimVariants` | 77 | 85 | method |
| F1005 | `GmLogStore.(callback)` | 82 | 82 | ArrowFunctionExpression |
| F1006 | `GmLogService.register` | 92 | 104 | static method |
| F1007 | `GmLogService.(callback)` | 96 | 96 | ArrowFunctionExpression |
| F1008 | `GmLogService.(callback)` | 97 | 97 | ArrowFunctionExpression |
| F1009 | `GmLogService.(callback)` | 98 | 98 | ArrowFunctionExpression |
| F1010 | `GmLogService.(callback)` | 99 | 101 | ArrowFunctionExpression |
| F1011 | `GmLogService.events` | 106 | 108 | static get |
| F1012 | `GmLogService.clear` | 110 | 114 | static method |
| F1013 | `GmLogService.recordItemQuantityChange` | 117 | 165 | static async method |
| F1014 | `GmLogService.(callback)` | 131 | 131 | ArrowFunctionExpression |
| F1015 | `GmLogService.(callback)` | 132 | 132 | ArrowFunctionExpression |
| F1016 | `GmLogService.recordAbilityActiveChange` | 168 | 223 | static async method |
| F1017 | `GmLogService.(callback)` | 183 | 183 | ArrowFunctionExpression |
| F1018 | `GmLogService.(callback)` | 184 | 184 | ArrowFunctionExpression |
| F1019 | `GmLogService.syncEnabledState` | 225 | 233 | static method |
| F1020 | `GmLogService.#hydrate` | 235 | 242 | static method |
| F1021 | `GmLogService.#ingest` | 244 | 249 | static method |
| F1022 | `GmLogService.#remove` | 251 | 254 | static method |
| F1023 | `GmLogService.#notify` | 256 | 258 | static method |
| F1024 | `normalizeQuantity` | 261 | 264 | FunctionDeclaration |
| F1025 | `normalizeAbilityLevel` | 266 | 269 | FunctionDeclaration |
| F1026 | `localizeAbilityLevel` | 271 | 278 | FunctionDeclaration |
### [scripts/gm-log-ui.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/gm-log-ui.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F1027 | `filterGmLogEvents` | 20 | 26 | FunctionDeclaration |
| F1028 | `(callback)` | 25 | 25 | ArrowFunctionExpression |
| F1029 | `formatGmLogEvent` | 28 | 38 | FunctionDeclaration |
| F1030 | `hideGmLogOnlyMessage` | 41 | 51 | FunctionDeclaration |
| F1031 | `GmLogUiService.register` | 60 | 80 | static method |
| F1032 | `GmLogUiService.(callback)` | 64 | 67 | ArrowFunctionExpression |
| F1033 | `GmLogUiService.(callback)` | 68 | 70 | ArrowFunctionExpression |
| F1034 | `GmLogUiService.(callback)` | 71 | 74 | ArrowFunctionExpression |
| F1035 | `GmLogUiService.(callback)` | 75 | 77 | ArrowFunctionExpression |
| F1036 | `GmLogUiService.syncEnabledState` | 82 | 89 | static method |
| F1037 | `GmLogUiService.#mount` | 91 | 115 | static method |
| F1038 | `GmLogUiService.#createNavigation` | 117 | 128 | static method |
| F1039 | `GmLogUiService.#createPageButton` | 130 | 146 | static method |
| F1040 | `GmLogUiService.(callback)` | 138 | 144 | ArrowFunctionExpression |
| F1041 | `GmLogUiService.#showPage` | 148 | 154 | static method |
| F1042 | `GmLogUiService.#applyPageState` | 156 | 168 | static method |
| F1043 | `GmLogUiService.#renderLogPage` | 170 | 207 | static async method |
| F1044 | `GmLogUiService.(callback)` | 180 | 183 | ArrowFunctionExpression |
| F1045 | `GmLogUiService.localize` | 181 | 181 | init |
| F1046 | `GmLogUiService.(callback)` | 188 | 192 | ArrowFunctionExpression |
| F1047 | `GmLogUiService.#bindLogControls` | 209 | 220 | static method |
| F1048 | `GmLogUiService.(callback)` | 210 | 215 | ArrowFunctionExpression |
| F1049 | `GmLogUiService.(callback)` | 216 | 219 | ArrowFunctionExpression |
| F1050 | `GmLogUiService.#unmount` | 222 | 234 | static method |
| F1051 | `createIcon` | 237 | 242 | FunctionDeclaration |
| F1052 | `categoryOptions` | 244 | 254 | FunctionDeclaration |
| F1053 | `resolveChatRoot` | 256 | 266 | FunctionDeclaration |
| F1054 | `formatTime` | 268 | 279 | FunctionDeclaration |
### [scripts/ground-containers.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/ground-containers.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F1055 | `GroundContainerService.registerHooks` | 16 | 48 | static method |
| F1056 | `GroundContainerService.(callback)` | 20 | 26 | ArrowFunctionExpression |
| F1057 | `GroundContainerService.(callback)` | 22 | 25 | ArrowFunctionExpression |
| F1058 | `GroundContainerService.(callback)` | 28 | 31 | ArrowFunctionExpression |
| F1059 | `GroundContainerService.(callback)` | 33 | 39 | ArrowFunctionExpression |
| F1060 | `GroundContainerService.(callback)` | 35 | 38 | ArrowFunctionExpression |
| F1061 | `GroundContainerService.(callback)` | 41 | 47 | ArrowFunctionExpression |
| F1062 | `GroundContainerService.(callback)` | 44 | 46 | ArrowFunctionExpression |
| F1063 | `GroundContainerService.buildDragData` | 50 | 58 | static method |
| F1064 | `GroundContainerService.isGroundContainerDragData` | 60 | 71 | static method |
| F1065 | `GroundContainerService.buildGroundTokenData` | 73 | 104 | static method |
| F1066 | `GroundContainerService.getGroundReference` | 106 | 113 | static method |
| F1067 | `GroundContainerService.getItemGroundReference` | 115 | 121 | static method |
| F1068 | `GroundContainerService.hasGroundToken` | 123 | 125 | static method |
| F1069 | `GroundContainerService.buildItemDragData` | 127 | 132 | static method |
| F1070 | `GroundContainerService.findGroundContainerForToken` | 134 | 157 | static method |
| F1071 | `GroundContainerService.(callback)` | 148 | 154 | ArrowFunctionExpression |
| F1072 | `GroundContainerService.addPickupButton` | 159 | 187 | static method |
| F1073 | `GroundContainerService.(callback)` | 178 | 185 | ArrowFunctionExpression |
| F1074 | `GroundContainerService.(callback)` | 181 | 184 | ArrowFunctionExpression |
| F1075 | `GroundContainerService.addTransferDragControl` | 189 | 222 | static method |
| F1076 | `GroundContainerService.(callback)` | 211 | 220 | ArrowFunctionExpression |
| F1077 | `GroundContainerService.dropToCanvas` | 224 | 297 | static async method |
| F1078 | `GroundContainerService.(callback)` | 247 | 250 | ArrowFunctionExpression |
| F1079 | `GroundContainerService.(callback)` | 287 | 289 | ArrowFunctionExpression |
| F1080 | `GroundContainerService.restoreFromToken` | 299 | 326 | static async method |
| F1081 | `GroundContainerService.pickupToken` | 328 | 366 | static async method |
| F1082 | `GroundContainerService.(callback)` | 357 | 359 | ArrowFunctionExpression |
| F1083 | `GroundContainerService.reconcileGroundContainers` | 368 | 473 | static async method |
| F1084 | `GroundContainerService.(callback)` | 449 | 454 | ArrowFunctionExpression |
| F1085 | `GroundContainerService.getOperationKey` | 475 | 477 | static method |
| F1086 | `GroundContainerService.buildItemGroundReference` | 479 | 489 | static method |
| F1087 | `GroundContainerService.isPrimaryActiveGm` | 491 | 493 | static method |
| F1088 | `GroundContainerService.canMutateScene` | 495 | 497 | static method |
| F1089 | `GroundContainerService.removeTokenForDeletedItem` | 499 | 513 | static async method |
| F1090 | `GroundContainerService.(callback)` | 505 | 509 | ArrowFunctionExpression |
| F1091 | `GroundContainerService.canMutateGroundContainer` | 516 | 520 | static method |
| F1092 | `GroundContainerService.canDragGroundContainer` | 522 | 525 | static method |
| F1093 | `getHtmlRoot` | 528 | 530 | FunctionDeclaration |
| F1094 | `referencesMatch` | 532 | 540 | FunctionDeclaration |
| F1095 | `hasCanvasCoordinate` | 542 | 545 | FunctionDeclaration |
| F1096 | `resolveActor` | 547 | 552 | FunctionDeclaration |
| F1097 | `(callback)` | 549 | 549 | ArrowFunctionExpression |
| F1098 | `notifyGroundContainer` | 554 | 556 | FunctionDeclaration |
### [scripts/herbal-cure-rules.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/herbal-cure-rules.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F1099 | `isHerbalCureItem` | 5 | 9 | FunctionDeclaration |
| F1100 | `medicusLevel` | 11 | 24 | FunctionDeclaration |
| F1101 | `(callback)` | 12 | 15 | ArrowFunctionExpression |
| F1102 | `herbalCureFormula` | 26 | 31 | FunctionDeclaration |
| F1103 | `herbalCureMethodLevel` | 33 | 37 | FunctionDeclaration |
| F1104 | `resolveHerbalCureTarget` | 39 | 43 | FunctionDeclaration |
| F1105 | `isSelfHerbalCure` | 45 | 54 | FunctionDeclaration |
### [scripts/herbal-cure.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/herbal-cure.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F1106 | `HerbalCureService.register` | 15 | 17 | static method |
| F1107 | `HerbalCureService.use` | 19 | 58 | static async method |
| F1108 | `useHerbalCureAsAuthority` | 61 | 103 | async FunctionDeclaration |
| F1109 | `promptHerbalCureMethod` | 105 | 169 | async FunctionDeclaration |
| F1110 | `callback` | 119 | 119 | init |
| F1111 | `callback` | 128 | 128 | init |
| F1112 | `callback` | 134 | 134 | init |
| F1113 | `(callback)` | 149 | 168 | ArrowFunctionExpression |
| F1114 | `complete` | 151 | 155 | ArrowFunctionExpression |
| F1115 | `(callback)` | 156 | 160 | ArrowFunctionExpression |
| F1116 | `callback` | 159 | 159 | init |
| F1117 | `close` | 166 | 166 | init |
| F1118 | `buildHerbalCureChat` | 171 | 214 | FunctionDeclaration |
| F1119 | `buildHerbalCureFigure` | 216 | 222 | FunctionDeclaration |
| F1120 | `requestUser` | 224 | 229 | FunctionDeclaration |
| F1121 | `ownsActor` | 231 | 233 | FunctionDeclaration |
| F1122 | `isTargetedByUser` | 235 | 237 | FunctionDeclaration |
| F1123 | `(callback)` | 236 | 236 | ArrowFunctionExpression |
### [scripts/hotbar.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/hotbar.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F1124 | `HotbarService.register` | 13 | 28 | static method |
| F1125 | `HotbarService.(callback)` | 17 | 17 | ArrowFunctionExpression |
| F1126 | `HotbarService.(callback)` | 18 | 18 | ArrowFunctionExpression |
| F1127 | `HotbarService.(callback)` | 19 | 19 | ArrowFunctionExpression |
| F1128 | `HotbarService.(callback)` | 20 | 20 | ArrowFunctionExpression |
| F1129 | `HotbarService.(callback)` | 21 | 21 | ArrowFunctionExpression |
| F1130 | `HotbarService.(callback)` | 22 | 22 | ArrowFunctionExpression |
| F1131 | `HotbarService.(callback)` | 23 | 23 | ArrowFunctionExpression |
| F1132 | `HotbarService.(callback)` | 24 | 24 | ArrowFunctionExpression |
| F1133 | `HotbarService.(callback)` | 25 | 25 | ArrowFunctionExpression |
| F1134 | `HotbarService.refreshSoon` | 30 | 33 | static method |
| F1135 | `HotbarService.(callback)` | 32 | 32 | ArrowFunctionExpression |
| F1136 | `HotbarService.refresh` | 35 | 50 | static method |
| F1137 | `renderRecoveryHud` | 53 | 99 | FunctionDeclaration |
| F1138 | `(callback)` | 85 | 90 | async ArrowFunctionExpression |
| F1139 | `(callback)` | 92 | 96 | ArrowFunctionExpression |
| F1140 | `renderQuiverHud` | 101 | 150 | FunctionDeclaration |
| F1141 | `(callback)` | 111 | 111 | ArrowFunctionExpression |
| F1142 | `(callback)` | 112 | 116 | ArrowFunctionExpression |
| F1143 | `(callback)` | 116 | 120 | ArrowFunctionExpression |
| F1144 | `getHudActor` | 152 | 162 | FunctionDeclaration |
| F1145 | `(callback)` | 154 | 154 | ArrowFunctionExpression |
| F1146 | `(callback)` | 155 | 155 | ArrowFunctionExpression |
| F1147 | `getOrCreateHud` | 164 | 173 | FunctionDeclaration |
| F1148 | `removeHud` | 175 | 178 | FunctionDeclaration |
| F1149 | `positionHud` | 180 | 202 | FunctionDeclaration |
| F1150 | `applyHudPosition` | 204 | 215 | FunctionDeclaration |
| F1151 | `getPlayersBoundaryRect` | 217 | 258 | FunctionDeclaration |
| F1152 | `includeElement` | 222 | 250 | ArrowFunctionExpression |
| F1153 | `shouldRefreshHud` | 260 | 266 | FunctionDeclaration |
| F1154 | `(callback)` | 264 | 264 | ArrowFunctionExpression |
### [scripts/hunger.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/hunger.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F1155 | `HungerService.registerStatusEffect` | 14 | 48 | static method |
| F1156 | `HungerService.(callback)` | 35 | 41 | ArrowFunctionExpression |
| F1157 | `HungerService.unregisterStatusEffect` | 50 | 61 | static method |
| F1158 | `HungerService.(callback)` | 51 | 56 | ArrowFunctionExpression |
| F1159 | `HungerService.hasHunger` | 63 | 66 | static method |
| F1160 | `HungerService.(callback)` | 65 | 65 | ArrowFunctionExpression |
| F1161 | `HungerService.registerHooks` | 68 | 88 | static method |
| F1162 | `HungerService.(callback)` | 69 | 77 | async ArrowFunctionExpression |
| F1163 | `HungerService.(callback)` | 79 | 87 | async ArrowFunctionExpression |
| F1164 | `HungerService.isHungerEffect` | 90 | 104 | static method |
| F1165 | `HungerService.applyDisfavour` | 106 | 109 | static method |
| F1166 | `HungerService.naturalHealingAllowed` | 111 | 113 | static method |
| F1167 | `HungerService.getMovementMultiplier` | 115 | 117 | static method |
| F1168 | `HungerService.getStrongPenalty` | 119 | 121 | static method |
| F1169 | `HungerService.getStrongTotal` | 123 | 125 | static method |
| F1170 | `HungerService.applyStrongPenalty` | 127 | 140 | static async method |
| F1171 | `HungerService.clearStrongPenalty` | 142 | 151 | static async method |
| F1172 | `HungerService.recoverStrongPenalty` | 153 | 181 | static async method |
| F1173 | `HungerService.postAppliedMessage` | 183 | 206 | static async method |
| F1174 | `HungerService.postRemovedMessage` | 208 | 221 | static async method |
| F1175 | `HungerService.postRecoveryMessage` | 223 | 237 | static async method |
| F1176 | `HungerService.markDead` | 239 | 242 | static async method |
| F1177 | `HungerService.rollStarvationDay` | 244 | 263 | static async method |
### [scripts/init.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/init.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F1178 | `(callback)` | 52 | 124 | ArrowFunctionExpression |
| F1179 | `(callback)` | 66 | 70 | ArrowFunctionExpression |
| F1180 | `(callback)` | 126 | 128 | ArrowFunctionExpression |
| F1181 | `(callback)` | 130 | 136 | ArrowFunctionExpression |
| F1182 | `(callback)` | 138 | 150 | ArrowFunctionExpression |
| F1183 | `(callback)` | 143 | 147 | ArrowFunctionExpression |
| F1184 | `(callback)` | 144 | 146 | ArrowFunctionExpression |
| F1185 | `(callback)` | 152 | 318 | async ArrowFunctionExpression |
| F1186 | `applyNpcAttackContextToMessage` | 186 | 245 | FunctionDeclaration |
| F1187 | `(callback)` | 213 | 213 | ArrowFunctionExpression |
| F1188 | `(callback)` | 222 | 222 | ArrowFunctionExpression |
| F1189 | `wrappedRollAttribute` | 250 | 258 | FunctionExpression |
| F1190 | `tenebreRollAttribute` | 263 | 265 | FunctionExpression |
| F1191 | `(callback)` | 312 | 314 | ArrowFunctionExpression |
| F1192 | `exposePublicApi` | 320 | 376 | FunctionDeclaration |
| F1193 | `useItem` | 355 | 360 | async init |
| F1194 | `isUsableItem` | 361 | 364 | init |
| F1195 | `inspectActorResources` | 378 | 410 | FunctionDeclaration |
| F1196 | `(callback)` | 400 | 400 | ArrowFunctionExpression |
| F1197 | `(callback)` | 401 | 408 | ArrowFunctionExpression |
| F1198 | `registerKeybindings` | 412 | 434 | FunctionDeclaration |
| F1199 | `onDown` | 419 | 432 | init |
| F1200 | `(callback)` | 421 | 421 | ArrowFunctionExpression |
| F1201 | `(callback)` | 421 | 421 | ArrowFunctionExpression |
| F1202 | `patchSymbaroumRollDialogs` | 442 | 479 | FunctionDeclaration |
| F1203 | `wrappedRender` | 446 | 467 | FunctionExpression |
| F1204 | `tenebreRenderDialog` | 472 | 474 | FunctionExpression |
| F1205 | `hasFavourRollOptions` | 481 | 486 | FunctionDeclaration |
| F1206 | `patchSymbaroumActorUsePower` | 488 | 519 | FunctionDeclaration |
| F1207 | `wrappedUsePower` | 493 | 510 | async FunctionExpression |
| F1208 | `tenebreUsePower` | 514 | 516 | async FunctionExpression |
| F1209 | `wrapDialogRollButton` | 521 | 538 | FunctionDeclaration |
| F1210 | `tenebreRollDialogCallback` | 527 | 536 | async FunctionExpression |
| F1211 | `(callback)` | 529 | 535 | async ArrowFunctionExpression |
| F1212 | `applyPowerChatContextToMessage` | 540 | 600 | FunctionDeclaration |
| F1213 | `(callback)` | 559 | 559 | ArrowFunctionExpression |
| F1214 | `(callback)` | 560 | 560 | ArrowFunctionExpression |
| F1215 | `(callback)` | 570 | 570 | ArrowFunctionExpression |
| F1216 | `isSymbaroumAbilityChat` | 602 | 604 | FunctionDeclaration |
| F1217 | `buildPowerUseChatContext` | 606 | 628 | FunctionDeclaration |
| F1218 | `getActorTokenForContext` | 630 | 635 | FunctionDeclaration |
| F1219 | `(callback)` | 631 | 631 | ArrowFunctionExpression |
| F1220 | `powerContextActorId` | 637 | 639 | FunctionDeclaration |
| F1221 | `setActivePowerChatContext` | 641 | 651 | FunctionDeclaration |
| F1222 | `(callback)` | 647 | 649 | ArrowFunctionExpression |
| F1223 | `takeActivePowerChatContext` | 653 | 659 | FunctionDeclaration |
| F1224 | `extractActorIdFromDialogContent` | 661 | 668 | FunctionDeclaration |
| F1225 | `(callback)` | 667 | 667 | ArrowFunctionExpression |
| F1226 | `applyStatusFavourToDialog` | 670 | 696 | FunctionDeclaration |
| F1227 | `(callback)` | 682 | 682 | ArrowFunctionExpression |
| F1228 | `getDialogActingAttribute` | 698 | 719 | FunctionDeclaration |
| F1229 | `getHungerFavourValue` | 721 | 729 | FunctionDeclaration |
| F1230 | `(callback)` | 725 | 725 | ArrowFunctionExpression |
| F1231 | `(callback)` | 731 | 768 | ArrowFunctionExpression |
### [scripts/inventory-cleanup.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/inventory-cleanup.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F1232 | `isInventoryCleanupEnabled` | 6 | 12 | FunctionDeclaration |
| F1233 | `isDepletableInventoryItem` | 14 | 16 | FunctionDeclaration |
| F1234 | `isDepletedInventoryItem` | 18 | 21 | FunctionDeclaration |
| F1235 | `updateDepletesInventoryItem` | 23 | 28 | FunctionDeclaration |
| F1236 | `deleteDepletedInventoryItem` | 30 | 43 | async FunctionDeclaration |
| F1237 | `isDepletedQuantity` | 45 | 48 | FunctionDeclaration |
| F1238 | `InventoryCleanupService.registerHooks` | 51 | 68 | static method |
| F1239 | `InventoryCleanupService.(callback)` | 55 | 60 | ArrowFunctionExpression |
| F1240 | `InventoryCleanupService.(callback)` | 62 | 67 | ArrowFunctionExpression |
| F1241 | `InventoryCleanupService.deleteFromHook` | 70 | 74 | static method |
| F1242 | `InventoryCleanupService.(callback)` | 71 | 73 | ArrowFunctionExpression |
| F1243 | `InventoryCleanupService.cleanupExisting` | 76 | 95 | static async method |
### [scripts/inventory-default-state.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/inventory-default-state.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F1244 | `InventoryDefaultStateService.registerHooks` | 11 | 22 | static method |
| F1245 | `InventoryDefaultStateService.(callback)` | 14 | 16 | ArrowFunctionExpression |
| F1246 | `InventoryDefaultStateService.(callback)` | 17 | 19 | ArrowFunctionExpression |
| F1247 | `applyDefaultInventoryState` | 25 | 29 | FunctionDeclaration |
| F1248 | `shouldDefaultToEquipped` | 31 | 35 | FunctionDeclaration |
| F1249 | `normalizeAdventureInventory` | 37 | 45 | FunctionDeclaration |
| F1250 | `normalizeEmbeddedInventoryItems` | 47 | 57 | FunctionDeclaration |
| F1251 | `isModuleAdventure` | 59 | 61 | FunctionDeclaration |
| F1252 | `shouldDefaultInventorySource` | 63 | 70 | FunctionDeclaration |
### [scripts/item-flags.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/item-flags.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F1253 | `getFlag` | 57 | 59 | FunctionDeclaration |
| F1254 | `isRation` | 61 | 63 | FunctionDeclaration |
| F1255 | `getRationRule` | 65 | 91 | FunctionDeclaration |
| F1256 | `isAmmo` | 93 | 97 | FunctionDeclaration |
| F1257 | `getAmmoType` | 99 | 115 | FunctionDeclaration |
| F1258 | `getWeaponAmmoType` | 117 | 123 | FunctionDeclaration |
| F1259 | `itemQuantity` | 125 | 127 | FunctionDeclaration |
| F1260 | `changeItemQuantity` | 129 | 137 | async FunctionDeclaration |
| F1261 | `actorItems` | 139 | 141 | FunctionDeclaration |
| F1262 | `findRationItems` | 143 | 145 | FunctionDeclaration |
| F1263 | `mergeExtraRationFoods` | 147 | 172 | FunctionDeclaration |
| F1264 | `normalizeExtraRationFood` | 174 | 188 | FunctionDeclaration |
| F1265 | `customRationFoodExists` | 190 | 196 | FunctionDeclaration |
| F1266 | `(callback)` | 195 | 195 | ArrowFunctionExpression |
| F1267 | `findAmmoItems` | 198 | 200 | FunctionDeclaration |
| F1268 | `(callback)` | 199 | 199 | ArrowFunctionExpression |
| F1269 | `findLoadedQuiverItems` | 202 | 210 | FunctionDeclaration |
| F1270 | `(callback)` | 203 | 209 | ArrowFunctionExpression |
| F1271 | `sumItemQuantities` | 212 | 214 | FunctionDeclaration |
| F1272 | `(callback)` | 213 | 213 | ArrowFunctionExpression |
| F1273 | `isQuiver` | 216 | 219 | FunctionDeclaration |
| F1274 | `isActiveOrEquipped` | 221 | 224 | FunctionDeclaration |
| F1275 | `getQuiverLoadedAmmo` | 226 | 243 | FunctionDeclaration |
| F1276 | `getQuiverLoadedTotal` | 245 | 248 | FunctionDeclaration |
| F1277 | `(callback)` | 247 | 247 | ArrowFunctionExpression |
| F1278 | `getQuiverCapacity` | 250 | 252 | FunctionDeclaration |
| F1279 | `getAmmoShots` | 254 | 261 | FunctionDeclaration |
| F1280 | `localizeAmmoType` | 263 | 265 | FunctionDeclaration |
| F1281 | `hasAlias` | 268 | 270 | FunctionDeclaration |
| F1282 | `safeSetting` | 272 | 279 | FunctionDeclaration |
### [scripts/journal-categories.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/journal-categories.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F1283 | `journalCategoryGroups` | 6 | 16 | FunctionDeclaration |
| F1284 | `(callback)` | 8 | 8 | ArrowFunctionExpression |
| F1285 | `(callback)` | 10 | 10 | ArrowFunctionExpression |
| F1286 | `(callback)` | 11 | 11 | ArrowFunctionExpression |
| F1287 | `(callback)` | 15 | 15 | ArrowFunctionExpression |
| F1288 | `orderedJournalPages` | 18 | 22 | FunctionDeclaration |
| F1289 | `(callback)` | 21 | 21 | ArrowFunctionExpression |
| F1290 | `(callback)` | 21 | 21 | ArrowFunctionExpression |
| F1291 | `renderJournalCategories` | 24 | 41 | FunctionDeclaration |
| F1292 | `(callback)` | 27 | 27 | ArrowFunctionExpression |
| F1293 | `(callback)` | 29 | 29 | ArrowFunctionExpression |
| F1294 | `(callback)` | 31 | 31 | ArrowFunctionExpression |
| F1295 | `(callback)` | 36 | 36 | ArrowFunctionExpression |
| F1296 | `withJournalCategories` | 43 | 91 | FunctionDeclaration |
| F1297 | `SymbaroumWide._getInheritanceChain` | 49 | 53 | static method |
| F1298 | `SymbaroumWide.(callback)` | 52 | 52 | ArrowFunctionExpression |
| F1299 | `SymbaroumWide.defaultOptions` | 55 | 58 | static get |
| F1300 | `SymbaroumWide._getPageData` | 60 | 62 | method |
| F1301 | `SymbaroumWide._getHeaderButtons` | 64 | 79 | method |
| F1302 | `SymbaroumWide.onclick` | 72 | 75 | init |
| F1303 | `SymbaroumWide.activateListeners` | 81 | 84 | method |
| F1304 | `SymbaroumWide._onSearchFilter` | 86 | 89 | method |
| F1305 | `JournalCategoryService.register` | 94 | 110 | static method |
### [scripts/journal-integration.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/journal-integration.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F1306 | `JournalIntegrationService.loadManifest` | 18 | 24 | static async method |
| F1307 | `JournalIntegrationService.validateManifest` | 26 | 28 | static method |
| F1308 | `JournalIntegrationService.dryRun` | 30 | 35 | static async method |
| F1309 | `JournalIntegrationService.importManifest` | 37 | 47 | static async method |
| F1310 | `JournalIntegrationService.cleanupLegacyFolders` | 49 | 54 | static async method |
| F1311 | `validateJournalManifest` | 57 | 93 | FunctionDeclaration |
| F1312 | `planJournalImport` | 95 | 125 | FunctionDeclaration |
| F1313 | `importJournalManifest` | 127 | 190 | async FunctionDeclaration |
| F1314 | `(callback)` | 166 | 166 | ArrowFunctionExpression |
| F1315 | `buildJournalData` | 192 | 215 | async FunctionDeclaration |
| F1316 | `(callback)` | 198 | 198 | ArrowFunctionExpression |
| F1317 | `buildPageData` | 217 | 252 | FunctionDeclaration |
| F1318 | `getOrCreateFolderForEntry` | 254 | 294 | async FunctionDeclaration |
| F1319 | `(callback)` | 258 | 258 | ArrowFunctionExpression |
| F1320 | `(callback)` | 267 | 271 | ArrowFunctionExpression |
| F1321 | `cleanupLegacyJournalFolders` | 296 | 331 | async FunctionDeclaration |
| F1322 | `(callback)` | 307 | 307 | ArrowFunctionExpression |
| F1323 | `(callback)` | 308 | 308 | ArrowFunctionExpression |
| F1324 | `(callback)` | 323 | 323 | ArrowFunctionExpression |
| F1325 | `formatSymbaroumJournalHtml` | 333 | 341 | FunctionDeclaration |
| F1326 | `addClassToTags` | 343 | 356 | FunctionDeclaration |
| F1327 | `(callback)` | 345 | 355 | ArrowFunctionExpression |
| F1328 | `(callback)` | 348 | 352 | ArrowFunctionExpression |
| F1329 | `findJournalFolder` | 358 | 364 | FunctionDeclaration |
| F1330 | `(callback)` | 359 | 363 | ArrowFunctionExpression |
| F1331 | `collectFolderSubtree` | 366 | 381 | FunctionDeclaration |
| F1332 | `(callback)` | 367 | 367 | ArrowFunctionExpression |
| F1333 | `folderDepthWithin` | 383 | 394 | FunctionDeclaration |
| F1334 | `(callback)` | 390 | 390 | ArrowFunctionExpression |
| F1335 | `folderIdOf` | 396 | 398 | FunctionDeclaration |
| F1336 | `findJournalBySource` | 400 | 405 | FunctionDeclaration |
| F1337 | `(callback)` | 401 | 404 | ArrowFunctionExpression |
| F1338 | `ownershipForVisibility` | 407 | 415 | FunctionDeclaration |
| F1339 | `sanitizeJournalHtml` | 417 | 436 | FunctionDeclaration |
| F1340 | `stripDangerousHtml` | 438 | 443 | FunctionDeclaration |
| F1341 | `summarizePlan` | 445 | 450 | FunctionDeclaration |
| F1342 | `(callback)` | 446 | 449 | ArrowFunctionExpression |
| F1343 | `isManifest` | 452 | 454 | FunctionDeclaration |
| F1344 | `slugify` | 456 | 464 | FunctionDeclaration |
### [scripts/maneuvers.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/maneuvers.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F1345 | `ManeuverService.grantFreeAttack` | 229 | 231 | static method |
| F1346 | `ManeuverService.registerStatusEffects` | 233 | 246 | static method |
| F1347 | `ManeuverService.(callback)` | 240 | 240 | ArrowFunctionExpression |
| F1348 | `ManeuverService.(callback)` | 243 | 243 | ArrowFunctionExpression |
| F1349 | `ManeuverService.list` | 248 | 250 | static method |
| F1350 | `ManeuverService.isEnabled` | 252 | 254 | static method |
| F1351 | `ManeuverService.registerHooks` | 256 | 288 | static method |
| F1352 | `ManeuverService.(callback)` | 257 | 266 | async ArrowFunctionExpression |
| F1353 | `ManeuverService.(callback)` | 268 | 273 | ArrowFunctionExpression |
| F1354 | `ManeuverService.(callback)` | 270 | 272 | ArrowFunctionExpression |
| F1355 | `ManeuverService.(callback)` | 275 | 287 | async ArrowFunctionExpression |
| F1356 | `ManeuverService.get` | 290 | 292 | static method |
| F1357 | `ManeuverService.(callback)` | 291 | 291 | ArrowFunctionExpression |
| F1358 | `ManeuverService.execute` | 294 | 347 | static async method |
| F1359 | `ManeuverService.hasEffect` | 349 | 351 | static method |
| F1360 | `ManeuverService.getActiveEffects` | 353 | 355 | static method |
| F1361 | `ManeuverService.hasActiveEffects` | 357 | 359 | static method |
| F1362 | `ManeuverService.clearEffects` | 361 | 367 | static async method |
| F1363 | `ManeuverService.(callback)` | 365 | 365 | ArrowFunctionExpression |
| F1364 | `ManeuverService.prepareEffectsForRemoval` | 369 | 371 | static async method |
| F1365 | `ManeuverService.cleanupExpiredEffects` | 373 | 385 | static async method |
| F1366 | `ManeuverService.(callback)` | 379 | 379 | ArrowFunctionExpression |
| F1367 | `ManeuverService.(callback)` | 383 | 383 | ArrowFunctionExpression |
| F1368 | `ManeuverService.blocksAttacks` | 387 | 391 | static method |
| F1369 | `ManeuverService.applyRollFavour` | 393 | 420 | static method |
| F1370 | `ManeuverService.afterWeaponRoll` | 422 | 452 | static async method |
| F1371 | `rollOpposedManeuver` | 455 | 497 | async FunctionDeclaration |
| F1372 | `buildContent` | 469 | 486 | ArrowFunctionExpression |
| F1373 | `(callback)` | 485 | 485 | ArrowFunctionExpression |
| F1374 | `finalize` | 493 | 493 | async init |
| F1375 | `rollAttackManeuver` | 499 | 550 | async FunctionDeclaration |
| F1376 | `buildContent` | 509 | 525 | ArrowFunctionExpression |
| F1377 | `(callback)` | 524 | 524 | ArrowFunctionExpression |
| F1378 | `finalize` | 532 | 546 | async init |
| F1379 | `rollKnockdownManeuver` | 552 | 600 | async FunctionDeclaration |
| F1380 | `buildContent` | 569 | 589 | ArrowFunctionExpression |
| F1381 | `(callback)` | 588 | 588 | ArrowFunctionExpression |
| F1382 | `finalize` | 596 | 596 | async init |
| F1383 | `rollAttributeManeuver` | 602 | 634 | async FunctionDeclaration |
| F1384 | `buildContent` | 609 | 623 | ArrowFunctionExpression |
| F1385 | `(callback)` | 622 | 622 | ArrowFunctionExpression |
| F1386 | `finalize` | 630 | 630 | async init |
| F1387 | `rollDamageCheck` | 636 | 673 | async FunctionDeclaration |
| F1388 | `buildContent` | 648 | 662 | ArrowFunctionExpression |
| F1389 | `(callback)` | 661 | 661 | ArrowFunctionExpression |
| F1390 | `finalize` | 669 | 669 | async init |
| F1391 | `promptDamageValue` | 675 | 677 | async FunctionDeclaration |
| F1392 | `choosePoisonDose` | 679 | 698 | async FunctionDeclaration |
| F1393 | `(callback)` | 680 | 684 | ArrowFunctionExpression |
| F1394 | `(callback)` | 690 | 690 | ArrowFunctionExpression |
| F1395 | `callback` | 694 | 694 | init |
| F1396 | `(callback)` | 697 | 697 | ArrowFunctionExpression |
| F1397 | `consumePoisonDose` | 700 | 704 | async FunctionDeclaration |
| F1398 | `promptNumericValue` | 706 | 735 | async FunctionDeclaration |
| F1399 | `callback` | 722 | 724 | init |
| F1400 | `resolveShoveDamage` | 737 | 767 | async FunctionDeclaration |
| F1401 | `postStatement` | 769 | 788 | async FunctionDeclaration |
| F1402 | `(callback)` | 778 | 778 | ArrowFunctionExpression |
| F1403 | `createManeuverMessageAfterDice` | 790 | 800 | async FunctionDeclaration |
| F1404 | `yieldToManeuverChat` | 802 | 808 | async FunctionDeclaration |
| F1405 | `(callback)` | 804 | 804 | ArrowFunctionExpression |
| F1406 | `(callback)` | 807 | 807 | ArrowFunctionExpression |
| F1407 | `maneuverLogFlags` | 810 | 825 | FunctionDeclaration |
| F1408 | `getSingleTargetActor` | 827 | 841 | FunctionDeclaration |
| F1409 | `getAttributeValue` | 843 | 847 | FunctionDeclaration |
| F1410 | `applyOpposedManeuverEffects` | 849 | 879 | async FunctionDeclaration |
| F1411 | `applyDamageCheckEffects` | 881 | 889 | async FunctionDeclaration |
| F1412 | `applyAttackManeuverEffects` | 891 | 918 | async FunctionDeclaration |
| F1413 | `applyKnockdownManeuverEffects` | 920 | 932 | async FunctionDeclaration |
| F1414 | `applyAttributeManeuverEffects` | 934 | 963 | async FunctionDeclaration |
| F1415 | `applyStatementEffects` | 965 | 997 | async FunctionDeclaration |
| F1416 | `grantFreeAttack` | 999 | 1001 | async FunctionDeclaration |
| F1417 | `applyManeuverEffect` | 1003 | 1046 | async FunctionDeclaration |
| F1418 | `removeManeuverEffect` | 1048 | 1054 | async FunctionDeclaration |
| F1419 | `applyCombatInitiativeBonus` | 1056 | 1078 | async FunctionDeclaration |
| F1420 | `prepareManeuverEffectsForRemoval` | 1080 | 1088 | async FunctionDeclaration |
| F1421 | `(callback)` | 1082 | 1082 | ArrowFunctionExpression |
| F1422 | `(callback)` | 1085 | 1085 | ArrowFunctionExpression |
| F1423 | `maintainCurrentGrapple` | 1092 | 1110 | async FunctionDeclaration |
| F1424 | `releaseGrapple` | 1112 | 1115 | async FunctionDeclaration |
| F1425 | `findActorById` | 1117 | 1123 | FunctionDeclaration |
| F1426 | `(callback)` | 1120 | 1120 | ArrowFunctionExpression |
| F1427 | `(callback)` | 1121 | 1121 | ArrowFunctionExpression |
| F1428 | `disarmEquippedItem` | 1125 | 1147 | async FunctionDeclaration |
| F1429 | `(callback)` | 1126 | 1130 | ArrowFunctionExpression |
| F1430 | `(callback)` | 1135 | 1135 | ArrowFunctionExpression |
| F1431 | `callback` | 1139 | 1139 | init |
| F1432 | `(callback)` | 1142 | 1142 | ArrowFunctionExpression |
| F1433 | `delayInitiative` | 1149 | 1183 | async FunctionDeclaration |
| F1434 | `(callback)` | 1157 | 1157 | ArrowFunctionExpression |
| F1435 | `(callback)` | 1158 | 1158 | ArrowFunctionExpression |
| F1436 | `(callback)` | 1163 | 1163 | ArrowFunctionExpression |
| F1437 | `callback` | 1167 | 1167 | init |
| F1438 | `(callback)` | 1170 | 1170 | ArrowFunctionExpression |
| F1439 | `(callback)` | 1172 | 1172 | ArrowFunctionExpression |
| F1440 | `(callback)` | 1173 | 1173 | ArrowFunctionExpression |
| F1441 | `(callback)` | 1180 | 1180 | ArrowFunctionExpression |
| F1442 | `getActorsWithManeuverEffects` | 1185 | 1202 | FunctionDeclaration |
| F1443 | `addActor` | 1189 | 1195 | ArrowFunctionExpression |
| F1444 | `(callback)` | 1201 | 1201 | ArrowFunctionExpression |
| F1445 | `revertTemporaryInitiativeBonus` | 1204 | 1221 | async FunctionDeclaration |
| F1446 | `revertDelayedInitiative` | 1223 | 1234 | async FunctionDeclaration |
| F1447 | `findCombatantForActor` | 1236 | 1242 | FunctionDeclaration |
| F1448 | `(callback)` | 1237 | 1241 | ArrowFunctionExpression |
| F1449 | `findActorEffect` | 1244 | 1253 | FunctionDeclaration |
| F1450 | `(callback)` | 1245 | 1252 | ArrowFunctionExpression |
| F1451 | `isManeuverEffect` | 1255 | 1267 | FunctionDeclaration |
| F1452 | `getManeuverEffectId` | 1269 | 1281 | FunctionDeclaration |
| F1453 | `getEffectAutomationFlags` | 1283 | 1297 | FunctionDeclaration |
| F1454 | `getMovementAutomationFlags` | 1299 | 1319 | FunctionDeclaration |
| F1455 | `shouldExpireEffect` | 1321 | 1354 | FunctionDeclaration |
| F1456 | `isActorTurn` | 1356 | 1359 | FunctionDeclaration |
| F1457 | `getStatusEffectData` | 1361 | 1380 | FunctionDeclaration |
| F1458 | `(callback)` | 1362 | 1362 | ArrowFunctionExpression |
| F1459 | `effectLabelFor` | 1382 | 1384 | FunctionDeclaration |
| F1460 | `getEffectDuration` | 1386 | 1394 | FunctionDeclaration |
| F1461 | `effectRows` | 1396 | 1400 | FunctionDeclaration |
| F1462 | `getRobustGrappleBonus` | 1402 | 1414 | FunctionDeclaration |
| F1463 | `(callback)` | 1403 | 1407 | ArrowFunctionExpression |
| F1464 | `isCurrentMeleeWeaponRoll` | 1416 | 1420 | FunctionDeclaration |
| F1465 | `isCurrentRangedWeaponRoll` | 1422 | 1424 | FunctionDeclaration |
| F1466 | `isSuccessfulWeaponResult` | 1426 | 1433 | FunctionDeclaration |
| F1467 | `(callback)` | 1430 | 1430 | ArrowFunctionExpression |
| F1468 | `clampDiceTarget` | 1435 | 1440 | FunctionDeclaration |
| F1469 | `getSymbaroumSetting` | 1442 | 1448 | FunctionDeclaration |
| F1470 | `buildChatCard` | 1450 | 1473 | FunctionDeclaration |
| F1471 | `(callback)` | 1457 | 1459 | ArrowFunctionExpression |
| F1472 | `(callback)` | 1461 | 1461 | ArrowFunctionExpression |
| F1473 | `attributeLabel` | 1475 | 1477 | FunctionDeclaration |
| F1474 | `signedNumber` | 1479 | 1482 | FunctionDeclaration |
### [scripts/money.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/money.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F1475 | `MoneyService.getMoney` | 17 | 19 | static method |
| F1476 | `MoneyService.getTotalOrtegs` | 21 | 23 | static method |
| F1477 | `MoneyService.open` | 25 | 53 | static async method |
| F1478 | `normalizeMoney` | 56 | 62 | FunctionDeclaration |
| F1479 | `moneyToOrtegs` | 64 | 69 | FunctionDeclaration |
| F1480 | `parseMoneyFormData` | 71 | 77 | FunctionDeclaration |
| F1481 | `applyMoneyOperation` | 79 | 117 | FunctionDeclaration |
| F1482 | `buildMoneyDialogContent` | 119 | 145 | FunctionDeclaration |
| F1483 | `formatMoney` | 147 | 150 | FunctionDeclaration |
| F1484 | `moneyInput` | 152 | 159 | FunctionDeclaration |
| F1485 | `moneyBalanceItem` | 161 | 168 | FunctionDeclaration |
| F1486 | `parseMoneyFormElement` | 170 | 176 | FunctionDeclaration |
| F1487 | `promptMoneyOperation` | 178 | 216 | async FunctionDeclaration |
| F1488 | `resultFor` | 185 | 188 | ArrowFunctionExpression |
| F1489 | `callback` | 199 | 199 | init |
| F1490 | `callback` | 205 | 205 | init |
| F1491 | `callback` | 211 | 211 | init |
| F1492 | `toActorMoneyUpdate` | 218 | 225 | FunctionDeclaration |
| F1493 | `toNonNegativeInteger` | 227 | 231 | FunctionDeclaration |
| F1494 | `defaultLabels` | 233 | 243 | FunctionDeclaration |
### [scripts/movement-ruler.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/movement-ruler.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F1495 | `MovementService.register` | 37 | 42 | static method |
| F1496 | `MovementService.registerTokenHud` | 44 | 51 | static method |
| F1497 | `MovementService.(callback)` | 46 | 48 | ArrowFunctionExpression |
| F1498 | `MovementService.patchTokenRuler` | 53 | 134 | static method |
| F1499 | `TenebreTokenRuler._getSegmentStyle` | 61 | 72 | method |
| F1500 | `TenebreTokenRuler._getGridHighlightStyle` | 74 | 86 | method |
| F1501 | `TenebreTokenRuler._getWaypointStyle` | 88 | 97 | method |
| F1502 | `TenebreTokenRuler._getWaypointLabelContext` | 99 | 128 | method |
| F1503 | `MovementService.patchMovementValidation` | 136 | 143 | static method |
| F1504 | `MovementService.(callback)` | 138 | 140 | ArrowFunctionExpression |
| F1505 | `MovementService.validateMovement` | 145 | 199 | static method |
| F1506 | `MovementService.(callback)` | 154 | 154 | ArrowFunctionExpression |
| F1507 | `MovementService.(callback)` | 181 | 185 | ArrowFunctionExpression |
| F1508 | `MovementService.getProfile` | 201 | 286 | static method |
| F1509 | `MovementService.getWaypointState` | 288 | 294 | static method |
| F1510 | `MovementService.getColorForActorDistance` | 296 | 301 | static method |
| F1511 | `MovementService.getMovementSummary` | 303 | 314 | static method |
| F1512 | `MovementService.shouldColorMovement` | 316 | 320 | static method |
| F1513 | `MovementService.getScene` | 322 | 324 | static method |
| F1514 | `MovementService.isTravelScene` | 326 | 328 | static method |
| F1515 | `MovementService.getWaypointDistance` | 330 | 333 | static method |
| F1516 | `MovementService.getTravelConfiguration` | 335 | 340 | static method |
| F1517 | `MovementService.getTravelEstimate` | 342 | 353 | static method |
| F1518 | `MovementService.addTravelHudControl` | 355 | 381 | static method |
| F1519 | `MovementService.(callback)` | 371 | 378 | ArrowFunctionExpression |
| F1520 | `MovementService.(callback)` | 374 | 377 | ArrowFunctionExpression |
| F1521 | `MovementService.canConfigureTravel` | 383 | 389 | static method |
| F1522 | `MovementService.configureTokenTravel` | 391 | 400 | static async method |
| F1523 | `MovementService.getUnitSystem` | 402 | 405 | static method |
| F1524 | `MovementService.getBaseActionDistance` | 407 | 411 | static method |
| F1525 | `MovementService.getUnits` | 413 | 417 | static method |
| F1526 | `isKilometerUnit` | 420 | 428 | FunctionDeclaration |
| F1527 | `getTravelRate` | 430 | 430 | FunctionDeclaration |
| F1528 | `normalizeTravelConfiguration` | 431 | 431 | FunctionDeclaration |
| F1529 | `buildTravelDialogContent` | 433 | 467 | FunctionDeclaration |
| F1530 | `localize` | 434 | 434 | ArrowFunctionExpression |
| F1531 | `option` | 435 | 435 | ArrowFunctionExpression |
| F1532 | `readTravelDialog` | 469 | 477 | FunctionDeclaration |
| F1533 | `promptTravelConfiguration` | 479 | 533 | async FunctionDeclaration |
| F1534 | `callback` | 494 | 494 | init |
| F1535 | `callback` | 500 | 500 | init |
| F1536 | `(callback)` | 507 | 532 | ArrowFunctionExpression |
| F1537 | `complete` | 509 | 513 | ArrowFunctionExpression |
| F1538 | `callback` | 521 | 521 | init |
| F1539 | `callback` | 526 | 526 | init |
| F1540 | `close` | 530 | 530 | init |
| F1541 | `getEffectId` | 535 | 544 | FunctionDeclaration |
| F1542 | `hasStatus` | 546 | 556 | FunctionDeclaration |
| F1543 | `(callback)` | 549 | 555 | ArrowFunctionExpression |
| F1544 | `formatDistance` | 558 | 565 | FunctionDeclaration |
### [scripts/npc-attack-chat.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/npc-attack-chat.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F1545 | `NpcAttackChatService.register` | 11 | 28 | static method |
| F1546 | `NpcAttackChatService.(callback)` | 15 | 19 | ArrowFunctionExpression |
| F1547 | `NpcAttackChatService.(callback)` | 21 | 27 | ArrowFunctionExpression |
| F1548 | `enhanceNpcAttackCards` | 31 | 35 | FunctionDeclaration |
| F1549 | `restoreNpcAttackCards` | 37 | 46 | FunctionDeclaration |
| F1550 | `parseOpposedTest` | 48 | 60 | FunctionDeclaration |
| F1551 | `(callback)` | 51 | 51 | ArrowFunctionExpression |
| F1552 | `parseRollValue` | 62 | 65 | FunctionDeclaration |
| F1553 | `compactActorName` | 67 | 70 | FunctionDeclaration |
| F1554 | `stripNpcParenthetical` | 72 | 74 | FunctionDeclaration |
| F1555 | `extractMissOutcomeSuffix` | 76 | 81 | FunctionDeclaration |
| F1556 | `canViewNpcDamageDetails` | 83 | 85 | FunctionDeclaration |
| F1557 | `isPainStunText` | 87 | 91 | FunctionDeclaration |
| F1558 | `isArmorProtectionText` | 93 | 100 | FunctionDeclaration |
| F1559 | `parseDamageResult` | 102 | 131 | FunctionDeclaration |
| F1560 | `extractDamageFormula` | 133 | 141 | FunctionDeclaration |
| F1561 | `resolveActiveArmor` | 143 | 150 | FunctionDeclaration |
| F1562 | `enhanceNpcAttackCard` | 152 | 181 | FunctionDeclaration |
| F1563 | `refreshPainThresholdOutcome` | 183 | 199 | FunctionDeclaration |
| F1564 | `buildNpcAttackModel` | 201 | 264 | FunctionDeclaration |
| F1565 | `extractResolution` | 266 | 338 | FunctionDeclaration |
| F1566 | `(callback)` | 306 | 308 | ArrowFunctionExpression |
| F1567 | `(callback)` | 311 | 313 | ArrowFunctionExpression |
| F1568 | `(callback)` | 325 | 325 | ArrowFunctionExpression |
| F1569 | `hasUnrepresentedWeaponDetails` | 340 | 350 | FunctionDeclaration |
| F1570 | `(callback)` | 349 | 349 | ArrowFunctionExpression |
| F1571 | `isPlayerNpcAttack` | 352 | 366 | FunctionDeclaration |
| F1572 | `buildPainThresholdOutcomeText` | 368 | 384 | FunctionDeclaration |
| F1573 | `createAttackFlow` | 386 | 398 | FunctionDeclaration |
| F1574 | `resolveAttackFlow` | 400 | 411 | FunctionDeclaration |
| F1575 | `createParticipant` | 413 | 425 | FunctionDeclaration |
| F1576 | `createArrow` | 427 | 431 | FunctionDeclaration |
| F1577 | `createResolution` | 433 | 536 | FunctionDeclaration |
| F1578 | `directTextWithout` | 538 | 545 | FunctionDeclaration |
| F1579 | `(callback)` | 541 | 541 | ArrowFunctionExpression |
| F1580 | `(callback)` | 542 | 542 | ArrowFunctionExpression |
| F1581 | `resolveChatMessage` | 547 | 551 | FunctionDeclaration |
| F1582 | `actorByDisplayedName` | 553 | 559 | FunctionDeclaration |
| F1583 | `(callback)` | 556 | 556 | ArrowFunctionExpression |
| F1584 | `(callback)` | 558 | 558 | ArrowFunctionExpression |
| F1585 | `weaponDamageDie` | 561 | 566 | FunctionDeclaration |
| F1586 | `(callback)` | 563 | 563 | ArrowFunctionExpression |
| F1587 | `displayedOutcome` | 568 | 583 | FunctionDeclaration |
| F1588 | `isNpcAgainstPlayer` | 585 | 592 | FunctionDeclaration |
| F1589 | `isPlayerAgainstNpc` | 594 | 601 | FunctionDeclaration |
| F1590 | `isPlayerAgainstPlayer` | 603 | 608 | FunctionDeclaration |
| F1591 | `isNpcParticipant` | 610 | 612 | FunctionDeclaration |
| F1592 | `replaceNpcNames` | 614 | 621 | FunctionDeclaration |
| F1593 | `matchingElements` | 623 | 628 | FunctionDeclaration |
| F1594 | `htmlElement` | 630 | 632 | FunctionDeclaration |
| F1595 | `backgroundImageUrl` | 634 | 637 | FunctionDeclaration |
| F1596 | `createTextElement` | 639 | 644 | FunctionDeclaration |
| F1597 | `isEnabled` | 647 | 654 | FunctionDeclaration |
| F1598 | `areNpcDetailsHidden` | 656 | 662 | FunctionDeclaration |
| F1599 | `normalize` | 664 | 666 | FunctionDeclaration |
| F1600 | `cleanText` | 668 | 670 | FunctionDeclaration |
| F1601 | `signed` | 672 | 674 | FunctionDeclaration |
### [scripts/opposed-test-chat.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/opposed-test-chat.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F1602 | `OpposedTestChatService.register` | 12 | 33 | static method |
| F1603 | `OpposedTestChatService.(callback)` | 16 | 18 | ArrowFunctionExpression |
| F1604 | `OpposedTestChatService.(callback)` | 20 | 24 | ArrowFunctionExpression |
| F1605 | `OpposedTestChatService.(callback)` | 26 | 32 | ArrowFunctionExpression |
| F1606 | `formatOpposedTestResult` | 36 | 47 | FunctionDeclaration |
| F1607 | `formatAttributeTestTitle` | 49 | 55 | FunctionDeclaration |
| F1608 | `formatAttributeTestResult` | 57 | 63 | FunctionDeclaration |
| F1609 | `enhanceOpposedTestCards` | 65 | 69 | FunctionDeclaration |
| F1610 | `restoreOpposedTestCards` | 71 | 80 | FunctionDeclaration |
| F1611 | `captureOpposedTestTarget` | 82 | 104 | FunctionDeclaration |
| F1612 | `isDefenseRoll` | 106 | 121 | FunctionDeclaration |
| F1613 | `extractArmorData` | 123 | 157 | FunctionDeclaration |
| F1614 | `createArmorSummary` | 159 | 195 | FunctionDeclaration |
| F1615 | `isNativeOpposedAttributeTest` | 197 | 208 | FunctionDeclaration |
| F1616 | `enhanceOpposedTestCard` | 210 | 246 | FunctionDeclaration |
| F1617 | `buildOpposedTestModel` | 248 | 301 | FunctionDeclaration |
| F1618 | `(callback)` | 263 | 263 | ArrowFunctionExpression |
| F1619 | `createPortraits` | 303 | 313 | FunctionDeclaration |
| F1620 | `createPortrait` | 315 | 328 | FunctionDeclaration |
| F1621 | `createRollSummary` | 330 | 346 | FunctionDeclaration |
| F1622 | `messageFlag` | 348 | 350 | FunctionDeclaration |
| F1623 | `matchingElements` | 352 | 357 | FunctionDeclaration |
| F1624 | `htmlElement` | 359 | 361 | FunctionDeclaration |
| F1625 | `createTextElement` | 363 | 368 | FunctionDeclaration |
| F1626 | `isEnabled` | 371 | 378 | FunctionDeclaration |
| F1627 | `cleanText` | 380 | 382 | FunctionDeclaration |
| F1628 | `signed` | 384 | 386 | FunctionDeclaration |
| F1629 | `normalize` | 388 | 394 | FunctionDeclaration |
### [scripts/pain-threshold-choice.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/pain-threshold-choice.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F1630 | `PainThresholdChoiceService.register` | 19 | 49 | static method |
| F1631 | `PainThresholdChoiceService.(callback)` | 25 | 27 | ArrowFunctionExpression |
| F1632 | `PainThresholdChoiceService.(callback)` | 29 | 36 | ArrowFunctionExpression |
| F1633 | `PainThresholdChoiceService.(callback)` | 32 | 35 | async ArrowFunctionExpression |
| F1634 | `PainThresholdChoiceService.(callback)` | 38 | 40 | ArrowFunctionExpression |
| F1635 | `PainThresholdChoiceService.(callback)` | 42 | 48 | ArrowFunctionExpression |
| F1636 | `extractPainThresholdActions` | 52 | 82 | FunctionDeclaration |
| F1637 | `(callback)` | 73 | 78 | ArrowFunctionExpression |
| F1638 | `selectPainChoiceRecipients` | 84 | 90 | FunctionDeclaration |
| F1639 | `(callback)` | 85 | 85 | ArrowFunctionExpression |
| F1640 | `(callback)` | 86 | 86 | ArrowFunctionExpression |
| F1641 | `(callback)` | 87 | 87 | ArrowFunctionExpression |
| F1642 | `(callback)` | 89 | 89 | ArrowFunctionExpression |
| F1643 | `(callback)` | 89 | 89 | ArrowFunctionExpression |
| F1644 | `buildPainThresholdPromptHtml` | 92 | 111 | FunctionDeclaration |
| F1645 | `waitForPainThresholdReveal` | 113 | 137 | async FunctionDeclaration |
| F1646 | `(callback)` | 128 | 128 | ArrowFunctionExpression |
| F1647 | `preparePainThresholdChoice` | 139 | 178 | FunctionDeclaration |
| F1648 | `createPainThresholdPrompt` | 180 | 214 | async FunctionDeclaration |
| F1649 | `bindPainThresholdUi` | 216 | 248 | FunctionDeclaration |
| F1650 | `(callback)` | 234 | 245 | async ArrowFunctionExpression |
| F1651 | `resolvePainThresholdChoiceAsGm` | 250 | 289 | async FunctionDeclaration |
| F1652 | `(callback)` | 281 | 283 | ArrowFunctionExpression |
| F1653 | `recordPainThresholdOutcome` | 291 | 300 | async FunctionDeclaration |
| F1654 | `restoreDefaultFallChoice` | 302 | 311 | async FunctionDeclaration |
| F1655 | `applyProne` | 313 | 327 | async FunctionDeclaration |
| F1656 | `(callback)` | 323 | 323 | ArrowFunctionExpression |
| F1657 | `findLatestPainAttackContext` | 329 | 347 | FunctionDeclaration |
| F1658 | `(callback)` | 338 | 338 | ArrowFunctionExpression |
| F1659 | `actorFromAction` | 349 | 351 | FunctionDeclaration |
| F1660 | `isPlayerActor` | 353 | 355 | FunctionDeclaration |
| F1661 | `actorFromSpeaker` | 357 | 360 | FunctionDeclaration |
| F1662 | `attackerFromMessage` | 362 | 382 | FunctionDeclaration |
| F1663 | `consider` | 372 | 377 | ArrowFunctionExpression |
| F1664 | `tokenById` | 384 | 390 | FunctionDeclaration |
| F1665 | `(callback)` | 387 | 387 | ArrowFunctionExpression |
| F1666 | `(callback)` | 388 | 388 | ArrowFunctionExpression |
| F1667 | `requestUser` | 392 | 397 | FunctionDeclaration |
| F1668 | `ownsActor` | 399 | 406 | FunctionDeclaration |
| F1669 | `hasStatus` | 408 | 411 | FunctionDeclaration |
| F1670 | `(callback)` | 410 | 410 | ArrowFunctionExpression |
| F1671 | `statusEffectId` | 413 | 419 | FunctionDeclaration |
| F1672 | `hasActionOperation` | 421 | 424 | FunctionDeclaration |
| F1673 | `(callback)` | 423 | 423 | ArrowFunctionExpression |
| F1674 | `foundryClone` | 426 | 430 | FunctionDeclaration |
| F1675 | `normalize` | 432 | 439 | FunctionDeclaration |
| F1676 | `stripHtml` | 441 | 443 | FunctionDeclaration |
| F1677 | `delay` | 445 | 447 | FunctionDeclaration |
| F1678 | `(callback)` | 446 | 446 | ArrowFunctionExpression |
| F1679 | `settleAnimationWait` | 449 | 465 | FunctionDeclaration |
| F1680 | `(callback)` | 450 | 464 | ArrowFunctionExpression |
| F1681 | `finish` | 452 | 457 | ArrowFunctionExpression |
| F1682 | `(callback)` | 458 | 458 | ArrowFunctionExpression |
| F1683 | `(callback)` | 460 | 460 | ArrowFunctionExpression |
| F1684 | `(callback)` | 460 | 460 | ArrowFunctionExpression |
### [scripts/party-actor.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/party-actor.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F1685 | `isPartyActor` | 23 | 25 | FunctionDeclaration |
| F1686 | `calculateBushcraftPenalty` | 28 | 42 | FunctionDeclaration |
| F1687 | `detectBushcraftTier` | 47 | 50 | FunctionDeclaration |
| F1688 | `calculateOrientationTarget` | 55 | 64 | FunctionDeclaration |
| F1689 | `evaluateOrientationRoll` | 69 | 115 | FunctionDeclaration |
| F1690 | `getMishapsModifier` | 125 | 133 | FunctionDeclaration |
| F1691 | `isDavokarMishapsTable` | 139 | 159 | FunctionDeclaration |
| F1692 | `resolveMishapsTable` | 165 | 216 | async FunctionDeclaration |
| F1693 | `(callback)` | 178 | 178 | ArrowFunctionExpression |
| F1694 | `(callback)` | 187 | 187 | ArrowFunctionExpression |
| F1695 | `(callback)` | 189 | 189 | ArrowFunctionExpression |
| F1696 | `(callback)` | 195 | 195 | ArrowFunctionExpression |
| F1697 | `drawMishapTable` | 221 | 252 | async FunctionDeclaration |
| F1698 | `isDavokarRuinsTable` | 257 | 265 | FunctionDeclaration |
| F1699 | `isDavokarEncountersTable` | 270 | 279 | FunctionDeclaration |
| F1700 | `isDavokarEnemiesTable` | 284 | 293 | FunctionDeclaration |
| F1701 | `isDavokarTerrainTable` | 298 | 309 | FunctionDeclaration |
| F1702 | `isLegacyEventTable` | 311 | 315 | FunctionDeclaration |
| F1703 | `(callback)` | 313 | 314 | ArrowFunctionExpression |
| F1704 | `getAvailableRollTables` | 320 | 351 | FunctionDeclaration |
| F1705 | `(callback)` | 350 | 350 | ArrowFunctionExpression |
| F1706 | `resolveDavokarEventTable` | 356 | 401 | async FunctionDeclaration |
| F1707 | `(callback)` | 375 | 375 | ArrowFunctionExpression |
| F1708 | `(callback)` | 386 | 387 | ArrowFunctionExpression |
| F1709 | `calculateDavokarEventModifiers` | 406 | 474 | FunctionDeclaration |
| F1710 | `formatFormula` | 438 | 442 | ArrowFunctionExpression |
| F1711 | `drawTableResult` | 479 | 571 | async FunctionDeclaration |
| F1712 | `(callback)` | 492 | 496 | ArrowFunctionExpression |
| F1713 | `(callback)` | 508 | 508 | ArrowFunctionExpression |
| F1714 | `buildOrientationChatHtml` | 576 | 634 | FunctionDeclaration |
| F1715 | `text` | 577 | 577 | ArrowFunctionExpression |
| F1716 | `signed` | 583 | 583 | ArrowFunctionExpression |
| F1717 | `row` | 584 | 584 | ArrowFunctionExpression |
| F1718 | `(callback)` | 628 | 628 | ArrowFunctionExpression |
| F1719 | `detectStorageCategory` | 654 | 666 | FunctionDeclaration |
| F1720 | `detectStorageCapacity` | 668 | 692 | FunctionDeclaration |
| F1721 | `PartyDataModel.defineSchema` | 698 | 746 | static method |
| F1722 | `PartyDataModel.prepareDerivedData` | 749 | 783 | method |
| F1723 | `PartyActorSheet.defaultOptions` | 793 | 824 | static get |
| F1724 | `PartyActorSheet.getRegionModifier` | 831 | 839 | static method |
| F1725 | `PartyActorSheet._resolveActor` | 841 | 843 | method |
| F1726 | `PartyActorSheet._getExpeditionData` | 845 | 847 | method |
| F1727 | `PartyActorSheet._prepareMemberCardData` | 849 | 925 | method |
| F1728 | `PartyActorSheet.getData` | 927 | 1437 | async method |
| F1729 | `PartyActorSheet.(callback)` | 934 | 934 | async ArrowFunctionExpression |
| F1730 | `PartyActorSheet.(callback)` | 965 | 985 | ArrowFunctionExpression |
| F1731 | `PartyActorSheet.(callback)` | 985 | 985 | ArrowFunctionExpression |
| F1732 | `PartyActorSheet.(callback)` | 987 | 987 | ArrowFunctionExpression |
| F1733 | `PartyActorSheet.(callback)` | 988 | 988 | ArrowFunctionExpression |
| F1734 | `PartyActorSheet.(callback)` | 989 | 989 | ArrowFunctionExpression |
| F1735 | `PartyActorSheet.(callback)` | 990 | 990 | ArrowFunctionExpression |
| F1736 | `PartyActorSheet.(callback)` | 997 | 997 | ArrowFunctionExpression |
| F1737 | `PartyActorSheet.(callback)` | 1108 | 1108 | ArrowFunctionExpression |
| F1738 | `PartyActorSheet.getAttrVal` | 1139 | 1142 | ArrowFunctionExpression |
| F1739 | `PartyActorSheet.(callback)` | 1300 | 1300 | ArrowFunctionExpression |
| F1740 | `PartyActorSheet.(callback)` | 1301 | 1301 | ArrowFunctionExpression |
| F1741 | `PartyActorSheet.(callback)` | 1351 | 1351 | ArrowFunctionExpression |
| F1742 | `PartyActorSheet.(callback)` | 1354 | 1354 | ArrowFunctionExpression |
| F1743 | `PartyActorSheet.(callback)` | 1384 | 1387 | ArrowFunctionExpression |
| F1744 | `PartyActorSheet.(callback)` | 1405 | 1405 | ArrowFunctionExpression |
| F1745 | `PartyActorSheet.(callback)` | 1406 | 1406 | ArrowFunctionExpression |
| F1746 | `PartyActorSheet._getItemTypeLabel` | 1439 | 1473 | method |
| F1747 | `PartyActorSheet._getItemDetail` | 1475 | 1491 | method |
| F1748 | `PartyActorSheet._getMemberTopAttributes` | 1493 | 1532 | method |
| F1749 | `PartyActorSheet.(callback)` | 1530 | 1530 | ArrowFunctionExpression |
| F1750 | `PartyActorSheet._onRollMemberAttribute` | 1534 | 1559 | async method |
| F1751 | `PartyActorSheet.preventDefault` | 1552 | 1552 | init |
| F1752 | `PartyActorSheet._activateMemberSearch` | 1561 | 1649 | method |
| F1753 | `PartyActorSheet.apply` | 1572 | 1617 | ArrowFunctionExpression |
| F1754 | `PartyActorSheet.(callback)` | 1576 | 1576 | ArrowFunctionExpression |
| F1755 | `PartyActorSheet.(callback)` | 1581 | 1581 | ArrowFunctionExpression |
| F1756 | `PartyActorSheet.(callback)` | 1585 | 1585 | ArrowFunctionExpression |
| F1757 | `PartyActorSheet.(callback)` | 1597 | 1597 | ArrowFunctionExpression |
| F1758 | `PartyActorSheet.(callback)` | 1607 | 1612 | ArrowFunctionExpression |
| F1759 | `PartyActorSheet.(callback)` | 1618 | 1622 | ArrowFunctionExpression |
| F1760 | `PartyActorSheet.(callback)` | 1624 | 1624 | ArrowFunctionExpression |
| F1761 | `PartyActorSheet.(callback)` | 1625 | 1629 | ArrowFunctionExpression |
| F1762 | `PartyActorSheet.(callback)` | 1630 | 1638 | ArrowFunctionExpression |
| F1763 | `PartyActorSheet.(callback)` | 1639 | 1641 | ArrowFunctionExpression |
| F1764 | `PartyActorSheet.(callback)` | 1642 | 1647 | ArrowFunctionExpression |
| F1765 | `PartyActorSheet.activateListeners` | 1651 | 2028 | method |
| F1766 | `PartyActorSheet.(callback)` | 1662 | 1668 | ArrowFunctionExpression |
| F1767 | `PartyActorSheet.(callback)` | 1663 | 1667 | async ArrowFunctionExpression |
| F1768 | `PartyActorSheet.(callback)` | 1670 | 1679 | ArrowFunctionExpression |
| F1769 | `PartyActorSheet.(callback)` | 1671 | 1678 | async ArrowFunctionExpression |
| F1770 | `PartyActorSheet.(callback)` | 1681 | 1690 | ArrowFunctionExpression |
| F1771 | `PartyActorSheet.(callback)` | 1682 | 1689 | async ArrowFunctionExpression |
| F1772 | `PartyActorSheet.(callback)` | 1692 | 1699 | ArrowFunctionExpression |
| F1773 | `PartyActorSheet.(callback)` | 1693 | 1698 | ArrowFunctionExpression |
| F1774 | `PartyActorSheet.(callback)` | 1701 | 1709 | ArrowFunctionExpression |
| F1775 | `PartyActorSheet.(callback)` | 1702 | 1708 | ArrowFunctionExpression |
| F1776 | `PartyActorSheet.(callback)` | 1711 | 1718 | ArrowFunctionExpression |
| F1777 | `PartyActorSheet.(callback)` | 1712 | 1717 | ArrowFunctionExpression |
| F1778 | `PartyActorSheet.(callback)` | 1720 | 1728 | ArrowFunctionExpression |
| F1779 | `PartyActorSheet.(callback)` | 1721 | 1727 | ArrowFunctionExpression |
| F1780 | `PartyActorSheet.(callback)` | 1730 | 1738 | ArrowFunctionExpression |
| F1781 | `PartyActorSheet.(callback)` | 1731 | 1737 | ArrowFunctionExpression |
| F1782 | `PartyActorSheet.(callback)` | 1740 | 1748 | ArrowFunctionExpression |
| F1783 | `PartyActorSheet.(callback)` | 1741 | 1747 | ArrowFunctionExpression |
| F1784 | `PartyActorSheet.(callback)` | 1750 | 1777 | ArrowFunctionExpression |
| F1785 | `PartyActorSheet.(callback)` | 1751 | 1776 | async ArrowFunctionExpression |
| F1786 | `PartyActorSheet.(callback)` | 1779 | 1784 | ArrowFunctionExpression |
| F1787 | `PartyActorSheet.(callback)` | 1780 | 1783 | ArrowFunctionExpression |
| F1788 | `PartyActorSheet.(callback)` | 1786 | 1791 | ArrowFunctionExpression |
| F1789 | `PartyActorSheet.(callback)` | 1787 | 1790 | ArrowFunctionExpression |
| F1790 | `PartyActorSheet.(callback)` | 1793 | 1798 | ArrowFunctionExpression |
| F1791 | `PartyActorSheet.(callback)` | 1794 | 1797 | ArrowFunctionExpression |
| F1792 | `PartyActorSheet.(callback)` | 1800 | 1806 | ArrowFunctionExpression |
| F1793 | `PartyActorSheet.(callback)` | 1801 | 1805 | async ArrowFunctionExpression |
| F1794 | `PartyActorSheet.(callback)` | 1808 | 1813 | ArrowFunctionExpression |
| F1795 | `PartyActorSheet.(callback)` | 1809 | 1812 | ArrowFunctionExpression |
| F1796 | `PartyActorSheet.(callback)` | 1815 | 1841 | ArrowFunctionExpression |
| F1797 | `PartyActorSheet.(callback)` | 1816 | 1840 | async ArrowFunctionExpression |
| F1798 | `PartyActorSheet.callback` | 1829 | 1829 | init |
| F1799 | `PartyActorSheet.(callback)` | 1845 | 1853 | ArrowFunctionExpression |
| F1800 | `PartyActorSheet.(callback)` | 1846 | 1852 | async ArrowFunctionExpression |
| F1801 | `PartyActorSheet.(callback)` | 1855 | 1860 | ArrowFunctionExpression |
| F1802 | `PartyActorSheet.(callback)` | 1856 | 1859 | ArrowFunctionExpression |
| F1803 | `PartyActorSheet.(callback)` | 1862 | 1869 | ArrowFunctionExpression |
| F1804 | `PartyActorSheet.(callback)` | 1863 | 1868 | async ArrowFunctionExpression |
| F1805 | `PartyActorSheet.(callback)` | 1871 | 1879 | ArrowFunctionExpression |
| F1806 | `PartyActorSheet.(callback)` | 1872 | 1877 | ArrowFunctionExpression |
| F1807 | `PartyActorSheet.(callback)` | 1878 | 1878 | ArrowFunctionExpression |
| F1808 | `PartyActorSheet.(callback)` | 1880 | 1886 | ArrowFunctionExpression |
| F1809 | `PartyActorSheet.(callback)` | 1881 | 1885 | async ArrowFunctionExpression |
| F1810 | `PartyActorSheet.(callback)` | 1888 | 1894 | ArrowFunctionExpression |
| F1811 | `PartyActorSheet.(callback)` | 1889 | 1893 | async ArrowFunctionExpression |
| F1812 | `PartyActorSheet.(callback)` | 1896 | 1911 | ArrowFunctionExpression |
| F1813 | `PartyActorSheet.(callback)` | 1897 | 1910 | async ArrowFunctionExpression |
| F1814 | `PartyActorSheet.(callback)` | 1913 | 1919 | ArrowFunctionExpression |
| F1815 | `PartyActorSheet.(callback)` | 1914 | 1918 | async ArrowFunctionExpression |
| F1816 | `PartyActorSheet.(callback)` | 1921 | 1927 | ArrowFunctionExpression |
| F1817 | `PartyActorSheet.(callback)` | 1922 | 1926 | async ArrowFunctionExpression |
| F1818 | `PartyActorSheet.(callback)` | 1929 | 1935 | ArrowFunctionExpression |
| F1819 | `PartyActorSheet.(callback)` | 1930 | 1934 | async ArrowFunctionExpression |
| F1820 | `PartyActorSheet.(callback)` | 1937 | 1943 | ArrowFunctionExpression |
| F1821 | `PartyActorSheet.(callback)` | 1938 | 1942 | async ArrowFunctionExpression |
| F1822 | `PartyActorSheet.(callback)` | 1945 | 1953 | ArrowFunctionExpression |
| F1823 | `PartyActorSheet.(callback)` | 1946 | 1952 | async ArrowFunctionExpression |
| F1824 | `PartyActorSheet.(callback)` | 1955 | 1963 | ArrowFunctionExpression |
| F1825 | `PartyActorSheet.(callback)` | 1956 | 1962 | async ArrowFunctionExpression |
| F1826 | `PartyActorSheet.(callback)` | 1965 | 1971 | ArrowFunctionExpression |
| F1827 | `PartyActorSheet.(callback)` | 1966 | 1970 | async ArrowFunctionExpression |
| F1828 | `PartyActorSheet.(callback)` | 1973 | 1981 | ArrowFunctionExpression |
| F1829 | `PartyActorSheet.(callback)` | 1974 | 1980 | async ArrowFunctionExpression |
| F1830 | `PartyActorSheet.(callback)` | 1983 | 1989 | ArrowFunctionExpression |
| F1831 | `PartyActorSheet.(callback)` | 1984 | 1988 | async ArrowFunctionExpression |
| F1832 | `PartyActorSheet.(callback)` | 1991 | 1998 | ArrowFunctionExpression |
| F1833 | `PartyActorSheet.(callback)` | 1992 | 1997 | async ArrowFunctionExpression |
| F1834 | `PartyActorSheet.(callback)` | 2000 | 2007 | ArrowFunctionExpression |
| F1835 | `PartyActorSheet.(callback)` | 2001 | 2006 | async ArrowFunctionExpression |
| F1836 | `PartyActorSheet.(callback)` | 2009 | 2016 | ArrowFunctionExpression |
| F1837 | `PartyActorSheet.(callback)` | 2010 | 2015 | async ArrowFunctionExpression |
| F1838 | `PartyActorSheet.(callback)` | 2018 | 2024 | ArrowFunctionExpression |
| F1839 | `PartyActorSheet.(callback)` | 2019 | 2023 | async ArrowFunctionExpression |
| F1840 | `PartyActorSheet._bindRationContextMenu` | 2030 | 2073 | method |
| F1841 | `PartyActorSheet.state` | 2035 | 2044 | ArrowFunctionExpression |
| F1842 | `PartyActorSheet.canFeed` | 2045 | 2050 | ArrowFunctionExpression |
| F1843 | `PartyActorSheet.feedEntry` | 2051 | 2059 | ArrowFunctionExpression |
| F1844 | `PartyActorSheet.visible` | 2053 | 2053 | init |
| F1845 | `PartyActorSheet.onClick` | 2054 | 2058 | async init |
| F1846 | `PartyActorSheet.visible` | 2065 | 2065 | init |
| F1847 | `PartyActorSheet.onClick` | 2066 | 2066 | async init |
| F1848 | `PartyActorSheet._bindMemberContextMenu` | 2075 | 2187 | method |
| F1849 | `PartyActorSheet._getActorId` | 2080 | 2083 | ArrowFunctionExpression |
| F1850 | `PartyActorSheet.visible` | 2088 | 2088 | init |
| F1851 | `PartyActorSheet.onClick` | 2089 | 2094 | async init |
| F1852 | `PartyActorSheet.visible` | 2100 | 2107 | init |
| F1853 | `PartyActorSheet.onClick` | 2108 | 2112 | init |
| F1854 | `PartyActorSheet.visible` | 2118 | 2125 | init |
| F1855 | `PartyActorSheet.onClick` | 2126 | 2129 | init |
| F1856 | `PartyActorSheet.visible` | 2135 | 2141 | init |
| F1857 | `PartyActorSheet.onClick` | 2142 | 2145 | init |
| F1858 | `PartyActorSheet.visible` | 2151 | 2157 | init |
| F1859 | `PartyActorSheet.onClick` | 2158 | 2161 | init |
| F1860 | `PartyActorSheet.visible` | 2167 | 2170 | init |
| F1861 | `PartyActorSheet.onClick` | 2171 | 2174 | init |
| F1862 | `PartyActorSheet._bindGuideContextMenu` | 2189 | 2253 | method |
| F1863 | `PartyActorSheet._getGuideActor` | 2194 | 2199 | ArrowFunctionExpression |
| F1864 | `PartyActorSheet.visible` | 2204 | 2208 | init |
| F1865 | `PartyActorSheet.onClick` | 2209 | 2212 | init |
| F1866 | `PartyActorSheet.visible` | 2218 | 2223 | init |
| F1867 | `PartyActorSheet.onClick` | 2224 | 2226 | init |
| F1868 | `PartyActorSheet.visible` | 2232 | 2237 | init |
| F1869 | `PartyActorSheet.onClick` | 2238 | 2240 | async init |
| F1870 | `PartyActorSheet._onSetGuide` | 2255 | 2273 | async method |
| F1871 | `PartyActorSheet._onUnsetGuide` | 2275 | 2289 | async method |
| F1872 | `PartyActorSheet._getOrientationModifierDraft` | 2291 | 2299 | method |
| F1873 | `PartyActorSheet._onRollOrientation` | 2301 | 2353 | async method |
| F1874 | `PartyActorSheet._onResetOrientation` | 2355 | 2359 | async method |
| F1875 | `PartyActorSheet._onStartExpedition` | 2361 | 2366 | async method |
| F1876 | `PartyActorSheet._onEndExpedition` | 2368 | 2399 | async method |
| F1877 | `PartyActorSheet.doEnd` | 2373 | 2377 | async ArrowFunctionExpression |
| F1878 | `PartyActorSheet._onNextExpeditionDay` | 2401 | 2413 | async method |
| F1879 | `PartyActorSheet._onPrevExpeditionDay` | 2415 | 2423 | async method |
| F1880 | `PartyActorSheet._setExpeditionDay` | 2425 | 2429 | async method |
| F1881 | `PartyActorSheet._onFeedMemberGroup` | 2431 | 2434 | async method |
| F1882 | `PartyActorSheet._onFeedMemberPersonal` | 2436 | 2439 | async method |
| F1883 | `PartyActorSheet._onFeedAllGroup` | 2441 | 2450 | async method |
| F1884 | `PartyActorSheet.(callback)` | 2444 | 2444 | ArrowFunctionExpression |
| F1885 | `PartyActorSheet.(callback)` | 2444 | 2444 | ArrowFunctionExpression |
| F1886 | `PartyActorSheet._feedExpeditionMembers` | 2452 | 2477 | async method |
| F1887 | `PartyActorSheet._onToggleFeedMember` | 2479 | 2493 | async method |
| F1888 | `PartyActorSheet._onToggleActiveSearch` | 2495 | 2504 | async method |
| F1889 | `PartyActorSheet._onChangeEventTable` | 2506 | 2516 | async method |
| F1890 | `PartyActorSheet._onRollSingleEvent` | 2518 | 2523 | async method |
| F1891 | `PartyActorSheet._onResetSingleEvent` | 2525 | 2531 | async method |
| F1892 | `PartyActorSheet._onRollAllEvents` | 2533 | 2538 | async method |
| F1893 | `PartyActorSheet._onSelectGuide` | 2540 | 2623 | async method |
| F1894 | `PartyActorSheet.(callback)` | 2569 | 2569 | ArrowFunctionExpression |
| F1895 | `PartyActorSheet.(callback)` | 2570 | 2570 | ArrowFunctionExpression |
| F1896 | `PartyActorSheet.(callback)` | 2575 | 2575 | ArrowFunctionExpression |
| F1897 | `PartyActorSheet.(callback)` | 2580 | 2580 | ArrowFunctionExpression |
| F1898 | `PartyActorSheet.callback` | 2608 | 2614 | async init |
| F1899 | `PartyActorSheet._onDropGuide` | 2625 | 2640 | async method |
| F1900 | `PartyActorSheet._onDragStart` | 2642 | 2669 | method |
| F1901 | `PartyActorSheet._onDrop` | 2671 | 2700 | async method |
| F1902 | `PartyActorSheet._onDropItem` | 2702 | 2731 | async method |
| F1903 | `PartyActorSheet._onDropItemCreate` | 2733 | 2736 | async method |
| F1904 | `PartyActorSheet._onDeleteItem` | 2738 | 2764 | async method |
| F1905 | `PartyActorSheet.callback` | 2753 | 2753 | init |
| F1906 | `PartyActorSheet._onIncreaseItemQuantity` | 2766 | 2773 | async method |
| F1907 | `PartyActorSheet._onDecreaseItemQuantity` | 2775 | 2784 | async method |
| F1908 | `PartyActorSheet._onToggleMemberType` | 2786 | 2808 | async method |
| F1909 | `PartyActorSheet.matches` | 2792 | 2792 | ArrowFunctionExpression |
| F1910 | `PartyActorSheet.(callback)` | 2794 | 2794 | ArrowFunctionExpression |
| F1911 | `PartyActorSheet.(callback)` | 2795 | 2795 | ArrowFunctionExpression |
| F1912 | `PartyActorSheet.(callback)` | 2801 | 2801 | ArrowFunctionExpression |
| F1913 | `PartyActorSheet.(callback)` | 2802 | 2802 | ArrowFunctionExpression |
| F1914 | `PartyActorSheet._onDropActor` | 2810 | 2856 | async method |
| F1915 | `PartyActorSheet.(callback)` | 2834 | 2834 | ArrowFunctionExpression |
| F1916 | `PartyActorSheet.(callback)` | 2837 | 2837 | ArrowFunctionExpression |
| F1917 | `PartyActorSheet.(callback)` | 2845 | 2845 | ArrowFunctionExpression |
| F1918 | `PartyActorSheet.(callback)` | 2848 | 2848 | ArrowFunctionExpression |
| F1919 | `PartyActorSheet._onRemoveMember` | 2858 | 2876 | async method |
| F1920 | `PartyActorSheet.keep` | 2863 | 2863 | ArrowFunctionExpression |
| F1921 | `PartyActorSheet._onDropStorageLocation` | 2878 | 2994 | async method |
| F1922 | `PartyActorSheet._onSelectStorageLocation` | 2996 | 3159 | async method |
| F1923 | `PartyActorSheet.(callback)` | 3018 | 3018 | ArrowFunctionExpression |
| F1924 | `PartyActorSheet.(callback)` | 3023 | 3023 | ArrowFunctionExpression |
| F1925 | `PartyActorSheet.callback` | 3064 | 3123 | async init |
| F1926 | `PartyActorSheet.(callback)` | 3074 | 3074 | ArrowFunctionExpression |
| F1927 | `PartyActorSheet.(callback)` | 3088 | 3088 | ArrowFunctionExpression |
| F1928 | `PartyActorSheet.render` | 3131 | 3157 | init |
| F1929 | `PartyActorSheet.updateFields` | 3137 | 3153 | ArrowFunctionExpression |
| F1930 | `PartyActorSheet.(callback)` | 3145 | 3145 | ArrowFunctionExpression |
| F1931 | `PartyActorSheet.(callback)` | 3150 | 3150 | ArrowFunctionExpression |
| F1932 | `PartyActorSheet._onEditStorageCapacity` | 3161 | 3195 | async method |
| F1933 | `PartyActorSheet.callback` | 3180 | 3186 | async init |
| F1934 | `PartyActorSheet._onUnlinkStorageLocation` | 3197 | 3222 | async method |
| F1935 | `PartyActorSheet._onLinkDraftAnimal` | 3224 | 3382 | async method |
| F1936 | `PartyActorSheet.(callback)` | 3243 | 3243 | ArrowFunctionExpression |
| F1937 | `PartyActorSheet.(callback)` | 3248 | 3248 | ArrowFunctionExpression |
| F1938 | `PartyActorSheet.(callback)` | 3253 | 3253 | ArrowFunctionExpression |
| F1939 | `PartyActorSheet.callback` | 3294 | 3346 | async init |
| F1940 | `PartyActorSheet.(callback)` | 3304 | 3304 | ArrowFunctionExpression |
| F1941 | `PartyActorSheet.(callback)` | 3317 | 3317 | ArrowFunctionExpression |
| F1942 | `PartyActorSheet.render` | 3354 | 3380 | init |
| F1943 | `PartyActorSheet.updateFields` | 3360 | 3376 | ArrowFunctionExpression |
| F1944 | `PartyActorSheet.(callback)` | 3368 | 3368 | ArrowFunctionExpression |
| F1945 | `PartyActorSheet.(callback)` | 3373 | 3373 | ArrowFunctionExpression |
| F1946 | `PartyActorSheet._onUnlinkDraftAnimal` | 3384 | 3400 | async method |
| F1947 | `PartyActorService.register` | 3411 | 3446 | static method |
| F1948 | `PartyActorService.(callback)` | 3420 | 3420 | ArrowFunctionExpression |
| F1949 | `PartyActorService.(callback)` | 3422 | 3425 | ArrowFunctionExpression |
| F1950 | `PartyActorService.refreshRelatedSheets` | 3448 | 3467 | static method |
| F1951 | `PartyActorService.(callback)` | 3453 | 3466 | ArrowFunctionExpression |
| F1952 | `PartyActorService.(callback)` | 3461 | 3461 | ArrowFunctionExpression |
| F1953 | `PartyActorService.(callback)` | 3461 | 3461 | ArrowFunctionExpression |
| F1954 | `PartyActorService.rollOrientation` | 3470 | 3475 | static async method |
| F1955 | `PartyActorService.visibleExpedition` | 3477 | 3492 | static async method |
| F1956 | `PartyActorService.(callback)` | 3479 | 3479 | ArrowFunctionExpression |
| F1957 | `PartyActorService.rollEvents` | 3494 | 3498 | static async method |
| F1958 | `PartyActorService.resetEvent` | 3500 | 3504 | static async method |
| F1959 | `PartyActorService.resetOrientation` | 3506 | 3511 | static async method |
| F1960 | `PartyActorService.setExpeditionDay` | 3513 | 3527 | static async method |
| F1961 | `PartyActorService.(callback)` | 3521 | 3526 | async ArrowFunctionExpression |
| F1962 | `PartyActorService._protectActorCalculations` | 3530 | 3532 | static method |
| F1963 | `setExpeditionDayAsAuthority` | 3535 | 3544 | async FunctionDeclaration |
| F1964 | `orientationRequest` | 3546 | 3554 | async FunctionDeclaration |
| F1965 | `rollOrientationAsAuthority` | 3556 | 3569 | async FunctionDeclaration |
| F1966 | `(callback)` | 3560 | 3568 | async ArrowFunctionExpression |
| F1967 | `resetOrientationAsAuthority` | 3571 | 3582 | async FunctionDeclaration |
| F1968 | `(callback)` | 3574 | 3581 | async ArrowFunctionExpression |
| F1969 | `performOrientationRoll` | 3584 | 3707 | async FunctionDeclaration |
| F1970 | `getAttrVal` | 3588 | 3591 | ArrowFunctionExpression |
| F1971 | `isCurrent` | 3598 | 3601 | async ArrowFunctionExpression |
| F1972 | `expeditionVisibility` | 3710 | 3713 | FunctionDeclaration |
| F1973 | `orientationGuideKey` | 3715 | 3719 | FunctionDeclaration |
| F1974 | `(callback)` | 3716 | 3716 | ArrowFunctionExpression |
| F1975 | `(callback)` | 3717 | 3717 | ArrowFunctionExpression |
| F1976 | `(callback)` | 3718 | 3718 | ArrowFunctionExpression |
| F1977 | `readExpeditionResultsAsAuthority` | 3721 | 3739 | async FunctionDeclaration |
| F1978 | `visible` | 3727 | 3731 | async ArrowFunctionExpression |
| F1979 | `rollEventsAsAuthority` | 3742 | 3759 | async FunctionDeclaration |
| F1980 | `(callback)` | 3745 | 3745 | ArrowFunctionExpression |
| F1981 | `(callback)` | 3747 | 3747 | ArrowFunctionExpression |
| F1982 | `(callback)` | 3748 | 3758 | async ArrowFunctionExpression |
| F1983 | `performEventRoll` | 3761 | 3828 | async FunctionDeclaration |
| F1984 | `isCurrent` | 3765 | 3765 | async ArrowFunctionExpression |
| F1985 | `(callback)` | 3779 | 3779 | ArrowFunctionExpression |
| F1986 | `(callback)` | 3790 | 3790 | ArrowFunctionExpression |
| F1987 | `(callback)` | 3790 | 3790 | ArrowFunctionExpression |
| F1988 | `(callback)` | 3791 | 3791 | ArrowFunctionExpression |
| F1989 | `(callback)` | 3791 | 3791 | ArrowFunctionExpression |
| F1990 | `getResultsForRoll` | 3795 | 3795 | init |
| F1991 | `resetEventAsAuthority` | 3831 | 3840 | async FunctionDeclaration |
| F1992 | `(callback)` | 3835 | 3839 | async ArrowFunctionExpression |
| F1993 | `encounterDetectionModifier` | 3843 | 3850 | FunctionDeclaration |
### [scripts/party-search.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/party-search.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F1994 | `normalizePartySearch` | 2 | 4 | FunctionDeclaration |
| F1995 | `buildPartySearchEntries` | 6 | 22 | FunctionDeclaration |
| F1996 | `(callback)` | 7 | 21 | ArrowFunctionExpression |
| F1997 | `(callback)` | 10 | 14 | ArrowFunctionExpression |
| F1998 | `(callback)` | 15 | 19 | ArrowFunctionExpression |
| F1999 | `(callback)` | 16 | 16 | ArrowFunctionExpression |
| F2000 | `partySearchSuggestions` | 24 | 32 | FunctionDeclaration |
| F2001 | `(callback)` | 31 | 31 | ArrowFunctionExpression |
| F2002 | `searchPartyMembers` | 34 | 45 | FunctionDeclaration |
| F2003 | `(callback)` | 36 | 36 | ArrowFunctionExpression |
| F2004 | `(callback)` | 37 | 37 | ArrowFunctionExpression |
| F2005 | `(callback)` | 37 | 37 | ArrowFunctionExpression |
| F2006 | `(callback)` | 39 | 42 | ArrowFunctionExpression |
| F2007 | `(callback)` | 40 | 40 | ArrowFunctionExpression |
| F2008 | `(callback)` | 43 | 43 | ArrowFunctionExpression |
### [scripts/prone-advantage.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/prone-advantage.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2009 | `isProneActor` | 4 | 14 | FunctionDeclaration |
| F2010 | `(callback)` | 8 | 13 | ArrowFunctionExpression |
| F2011 | `isMeleeWeapon` | 16 | 23 | FunctionDeclaration |
| F2012 | `buildProneAdvantageContext` | 25 | 43 | FunctionDeclaration |
| F2013 | `ProneAdvantageService.captureWeaponAttack` | 46 | 51 | static method |
| F2014 | `ProneAdvantageService.applyToDialog` | 53 | 69 | static method |
| F2015 | `findWeaponAdvantageInput` | 72 | 86 | FunctionDeclaration |
| F2016 | `insertProneNotice` | 88 | 102 | FunctionDeclaration |
### [scripts/rations.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/rations.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2017 | `RationService.register` | 15 | 21 | static method |
| F2018 | `RationService.getState` | 23 | 31 | static method |
| F2019 | `RationService.(callback)` | 28 | 28 | ArrowFunctionExpression |
| F2020 | `RationService.(callback)` | 30 | 30 | ArrowFunctionExpression |
| F2021 | `RationService.getStates` | 33 | 37 | static method |
| F2022 | `RationService.(callback)` | 36 | 36 | ArrowFunctionExpression |
| F2023 | `RationService.getTotalUses` | 39 | 41 | static method |
| F2024 | `RationService.(callback)` | 40 | 40 | ArrowFunctionExpression |
| F2025 | `RationService.getItemState` | 43 | 45 | static method |
| F2026 | `RationService.sync` | 47 | 64 | static async method |
| F2027 | `RationService.(callback)` | 57 | 57 | ArrowFunctionExpression |
| F2028 | `RationService.needsConsolidation` | 66 | 68 | static method |
| F2029 | `RationService.(callback)` | 67 | 67 | ArrowFunctionExpression |
| F2030 | `RationService.consolidate` | 70 | 76 | static async method |
| F2031 | `RationService.(callback)` | 75 | 75 | ArrowFunctionExpression |
| F2032 | `RationService.#consolidate` | 78 | 102 | static async method |
| F2033 | `RationService.(callback)` | 79 | 79 | ArrowFunctionExpression |
| F2034 | `RationService.(callback)` | 86 | 86 | ArrowFunctionExpression |
| F2035 | `RationService.(callback)` | 90 | 90 | ArrowFunctionExpression |
| F2036 | `RationService.consumeDay` | 104 | 123 | static async method |
| F2037 | `RationService.(callback)` | 115 | 119 | async ArrowFunctionExpression |
| F2038 | `RationService.#enqueue` | 125 | 136 | static async method |
| F2039 | `RationService.(callback)` | 129 | 129 | ArrowFunctionExpression |
| F2040 | `RationService.#consumeDay` | 138 | 160 | static async method |
| F2041 | `RationService.#consumeState` | 162 | 201 | static async method |
| F2042 | `RationService.(callback)` | 166 | 166 | ArrowFunctionExpression |
| F2043 | `RationService.(callback)` | 167 | 167 | ArrowFunctionExpression |
| F2044 | `RationService.(callback)` | 199 | 199 | ArrowFunctionExpression |
| F2045 | `RationService.#syncExpeditionRation` | 203 | 215 | static async method |
| F2046 | `RationService.(callback)` | 206 | 210 | async ArrowFunctionExpression |
| F2047 | `RationService.feedExpedition` | 217 | 222 | static async method |
| F2048 | `RationService.#postRationChat` | 224 | 265 | static async method |
| F2049 | `normalizeRationDays` | 268 | 271 | FunctionDeclaration |
| F2050 | `assertRationExecutor` | 273 | 277 | FunctionDeclaration |
| F2051 | `getOwnedRationActor` | 279 | 286 | async FunctionDeclaration |
| F2052 | `consumeRationsAsAuthority` | 288 | 294 | async FunctionDeclaration |
| F2053 | `consolidateRationsAsAuthority` | 296 | 299 | async FunctionDeclaration |
| F2054 | `partyIncludesActor` | 301 | 304 | FunctionDeclaration |
| F2055 | `(callback)` | 303 | 303 | ArrowFunctionExpression |
| F2056 | `activeExpeditionMemberships` | 306 | 311 | FunctionDeclaration |
| F2057 | `(callback)` | 308 | 309 | ArrowFunctionExpression |
| F2058 | `(callback)` | 310 | 310 | ArrowFunctionExpression |
| F2059 | `fedMemberUpdates` | 313 | 322 | FunctionDeclaration |
| F2060 | `feedExpeditionRationsAsAuthority` | 324 | 364 | async FunctionDeclaration |
| F2061 | `(callback)` | 328 | 328 | ArrowFunctionExpression |
| F2062 | `(callback)` | 338 | 363 | async ArrowFunctionExpression |
| F2063 | `(callback)` | 349 | 349 | ArrowFunctionExpression |
| F2064 | `(callback)` | 350 | 350 | ArrowFunctionExpression |
| F2065 | `(callback)` | 355 | 355 | ArrowFunctionExpression |
| F2066 | `buildState` | 366 | 387 | FunctionDeclaration |
| F2067 | `currentUnitUses` | 389 | 392 | FunctionDeclaration |
| F2068 | `updateRuleState` | 394 | 410 | async FunctionDeclaration |
| F2069 | `rationGroups` | 412 | 424 | FunctionDeclaration |
| F2070 | `rationStacks` | 426 | 447 | FunctionDeclaration |
| F2071 | `emptyState` | 449 | 461 | FunctionDeclaration |
### [scripts/resistance-chat.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/resistance-chat.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2072 | `ResistanceChatService.register` | 9 | 26 | static method |
| F2073 | `ResistanceChatService.(callback)` | 13 | 15 | ArrowFunctionExpression |
| F2074 | `ResistanceChatService.(callback)` | 17 | 21 | ArrowFunctionExpression |
| F2075 | `ResistanceChatService.(callback)` | 18 | 20 | ArrowFunctionExpression |
| F2076 | `ResistanceChatService.(callback)` | 23 | 25 | ArrowFunctionExpression |
| F2077 | `bindResistancePrompt` | 29 | 43 | FunctionDeclaration |
| F2078 | `(callback)` | 39 | 39 | ArrowFunctionExpression |
| F2079 | `removeCompletedResistancePrompt` | 45 | 52 | async FunctionDeclaration |
### [scripts/rest.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/rest.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2080 | `RestService.openRestDialog` | 11 | 67 | static async method |
| F2081 | `RestService.callback` | 54 | 60 | init |
| F2082 | `RestService.applyRest` | 70 | 185 | static async method |
| F2083 | `RestService.(callback)` | 171 | 171 | ArrowFunctionExpression |
| F2084 | `RestService.(callback)` | 181 | 181 | ArrowFunctionExpression |
| F2085 | `RestService.#postRestMessage` | 188 | 247 | static async method |
| F2086 | `RestService.(callback)` | 228 | 228 | ArrowFunctionExpression |
| F2087 | `RestService.(callback)` | 231 | 231 | ArrowFunctionExpression |
### [scripts/ritual-browser.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/ritual-browser.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2088 | `isEnabled` | 13 | 19 | init |
| F2089 | `open` | 21 | 68 | async init |
| F2090 | `render` | 37 | 40 | init |
| F2091 | `render` | 63 | 66 | init |
| F2092 | `clearCache` | 70 | 73 | init |
| F2093 | `isRitualistAbility` | 76 | 78 | FunctionDeclaration |
| F2094 | `isRitualDocument` | 80 | 82 | FunctionDeclaration |
| F2095 | `isRestrictedTradition` | 84 | 87 | FunctionDeclaration |
| F2096 | `loadCatalog` | 89 | 102 | async FunctionDeclaration |
| F2097 | `(callback)` | 91 | 94 | ArrowFunctionExpression |
| F2098 | `(callback)` | 95 | 95 | ArrowFunctionExpression |
| F2099 | `(callback)` | 96 | 100 | ArrowFunctionExpression |
| F2100 | `loadInstalledRituals` | 104 | 107 | async FunctionDeclaration |
| F2101 | `collectInstalledRituals` | 109 | 130 | async FunctionDeclaration |
| F2102 | `(callback)` | 113 | 115 | ArrowFunctionExpression |
| F2103 | `addRitualDocuments` | 132 | 143 | FunctionDeclaration |
| F2104 | `mergeRitualSources` | 145 | 175 | FunctionDeclaration |
| F2105 | `(callback)` | 155 | 155 | ArrowFunctionExpression |
| F2106 | `(callback)` | 159 | 174 | ArrowFunctionExpression |
| F2107 | `(callback)` | 174 | 174 | ArrowFunctionExpression |
| F2108 | `buildRitualBrowserContent` | 177 | 215 | FunctionDeclaration |
| F2109 | `renderRitual` | 217 | 236 | FunctionDeclaration |
| F2110 | `activateRitualLinks` | 238 | 251 | FunctionDeclaration |
| F2111 | `(callback)` | 244 | 244 | ArrowFunctionExpression |
| F2112 | `(callback)` | 246 | 249 | async ArrowFunctionExpression |
| F2113 | `resolveElement` | 253 | 259 | FunctionDeclaration |
| F2114 | `resetRitualBrowserScroll` | 261 | 272 | FunctionDeclaration |
| F2115 | `reset` | 265 | 269 | ArrowFunctionExpression |
| F2116 | `(callback)` | 271 | 271 | ArrowFunctionExpression |
| F2117 | `openRitualSheet` | 274 | 290 | async FunctionDeclaration |
### [scripts/roll-context.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/roll-context.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2118 | `beginWeaponRoll` | 11 | 16 | FunctionDeclaration |
| F2119 | `(callback)` | 13 | 13 | ArrowFunctionExpression |
| F2120 | `(callback)` | 15 | 15 | ArrowFunctionExpression |
| F2121 | `endWeaponRoll` | 18 | 21 | FunctionDeclaration |
| F2122 | `getWeaponRoll` | 23 | 25 | FunctionDeclaration |
| F2123 | `actorIdFromRollDialog` | 27 | 31 | FunctionDeclaration |
| F2124 | `getWeaponRollForDialog` | 33 | 36 | FunctionDeclaration |
### [scripts/roll-privacy.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/roll-privacy.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2125 | `RollPrivacyService.register` | 9 | 26 | static method |
| F2126 | `RollPrivacyService.(callback)` | 12 | 25 | ArrowFunctionExpression |
| F2127 | `RollPrivacyService.isEnabled` | 28 | 34 | static method |
| F2128 | `RollPrivacyService.isPrivateRollActive` | 36 | 41 | static method |
| F2129 | `RollPrivacyService.runPrivateRoll` | 43 | 57 | static async method |
| F2130 | `RollPrivacyService.isChecked` | 59 | 63 | static method |
| F2131 | `RollPrivacyService.fieldHtml` | 65 | 75 | static method |
| F2132 | `RollPrivacyService.injectField` | 77 | 88 | static method |
| F2133 | `RollPrivacyService.prepareChatData` | 90 | 102 | static method |
| F2134 | `RollPrivacyService.applyToMessageSource` | 104 | 117 | static method |
| F2135 | `RollPrivacyService.diceRecipients` | 119 | 122 | static method |
| F2136 | `RollPrivacyService.(callback)` | 121 | 121 | ArrowFunctionExpression |
| F2137 | `RollPrivacyService.#isRollMessage` | 124 | 133 | static method |
| F2138 | `RollPrivacyService.#queuePendingAction` | 135 | 149 | static method |
| F2139 | `RollPrivacyService.(callback)` | 145 | 145 | ArrowFunctionExpression |
| F2140 | `RollPrivacyService.#pendingAction` | 151 | 153 | static method |
| F2141 | `RollPrivacyService.#clearPendingAction` | 155 | 161 | static method |
| F2142 | `RollPrivacyService.#gmUserIds` | 163 | 167 | static method |
| F2143 | `RollPrivacyService.(callback)` | 165 | 165 | ArrowFunctionExpression |
| F2144 | `RollPrivacyService.(callback)` | 166 | 166 | ArrowFunctionExpression |
### [scripts/settings.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/settings.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2145 | `TenebreSettingsForm._prepareContext` | 38 | 59 | async method |
| F2146 | `TenebreSettingsForm.(callback)` | 41 | 41 | ArrowFunctionExpression |
| F2147 | `TenebreSettingsForm.(callback)` | 46 | 46 | ArrowFunctionExpression |
| F2148 | `TenebreSettingsForm._onRender` | 61 | 118 | method |
| F2149 | `TenebreSettingsForm.(callback)` | 65 | 65 | ArrowFunctionExpression |
| F2150 | `TenebreSettingsForm.(callback)` | 66 | 66 | ArrowFunctionExpression |
| F2151 | `TenebreSettingsForm.(callback)` | 68 | 68 | ArrowFunctionExpression |
| F2152 | `TenebreSettingsForm.(callback)` | 70 | 70 | ArrowFunctionExpression |
| F2153 | `TenebreSettingsForm.(callback)` | 71 | 71 | ArrowFunctionExpression |
| F2154 | `TenebreSettingsForm.(callback)` | 72 | 72 | ArrowFunctionExpression |
| F2155 | `TenebreSettingsForm.(callback)` | 73 | 73 | ArrowFunctionExpression |
| F2156 | `TenebreSettingsForm.(callback)` | 75 | 75 | ArrowFunctionExpression |
| F2157 | `TenebreSettingsForm.(callback)` | 77 | 77 | ArrowFunctionExpression |
| F2158 | `TenebreSettingsForm.(callback)` | 78 | 78 | ArrowFunctionExpression |
| F2159 | `TenebreSettingsForm.(callback)` | 80 | 80 | ArrowFunctionExpression |
| F2160 | `TenebreSettingsForm.(callback)` | 81 | 81 | ArrowFunctionExpression |
| F2161 | `TenebreSettingsForm.(callback)` | 82 | 85 | async ArrowFunctionExpression |
| F2162 | `TenebreSettingsForm.(callback)` | 86 | 88 | ArrowFunctionExpression |
| F2163 | `TenebreSettingsForm.(callback)` | 89 | 91 | ArrowFunctionExpression |
| F2164 | `TenebreSettingsForm.(callback)` | 92 | 94 | async ArrowFunctionExpression |
| F2165 | `TenebreSettingsForm.(callback)` | 95 | 107 | async ArrowFunctionExpression |
| F2166 | `TenebreSettingsForm.(callback)` | 108 | 117 | ArrowFunctionExpression |
| F2167 | `TenebreSettingsForm.(callback)` | 114 | 114 | ArrowFunctionExpression |
| F2168 | `TenebreSettingsForm.#onSubmit` | 120 | 224 | static async method |
| F2169 | `TenebreSettingsForm.(callback)` | 123 | 123 | ArrowFunctionExpression |
| F2170 | `TenebreSettingsForm.(callback)` | 213 | 213 | ArrowFunctionExpression |
| F2171 | `categoryOptions` | 267 | 276 | FunctionDeclaration |
| F2172 | `TenebreSettings.register` | 279 | 359 | static method |
| F2173 | `TenebreSettings.get` | 361 | 363 | static method |
| F2174 | `TenebreSettings.export` | 365 | 372 | static method |
| F2175 | `TenebreSettings.(callback)` | 367 | 367 | ArrowFunctionExpression |
| F2176 | `TenebreSettings.(callback)` | 368 | 371 | ArrowFunctionExpression |
| F2177 | `registerMenu` | 375 | 384 | FunctionDeclaration |
| F2178 | `register` | 386 | 401 | FunctionDeclaration |
| F2179 | `onChange` | 399 | 399 | init |
| F2180 | `onSettingChanged` | 403 | 472 | FunctionDeclaration |
| F2181 | `refreshEncumbranceActors` | 475 | 481 | FunctionDeclaration |
| F2182 | `synchronizeContainerStates` | 483 | 490 | FunctionDeclaration |
| F2183 | `(callback)` | 487 | 487 | ArrowFunctionExpression |
| F2184 | `(callback)` | 488 | 488 | ArrowFunctionExpression |
| F2185 | `syncAmmoSettingsVisibility` | 492 | 504 | FunctionDeclaration |
| F2186 | `syncRationSettingsVisibility` | 506 | 513 | FunctionDeclaration |
| F2187 | `syncRestSettingsVisibility` | 515 | 519 | FunctionDeclaration |
| F2188 | `syncMovementSettingsVisibility` | 521 | 525 | FunctionDeclaration |
| F2189 | `syncCombatSettingsVisibility` | 527 | 534 | FunctionDeclaration |
| F2190 | `syncUtilitiesSettingsVisibility` | 536 | 543 | FunctionDeclaration |
| F2191 | `setHidden` | 545 | 549 | FunctionDeclaration |
| F2192 | `normalizeSettingNumber` | 551 | 569 | FunctionDeclaration |
| F2193 | `settingsValuesEqual` | 571 | 575 | FunctionDeclaration |
| F2194 | `normalizeSubmittedExtraRationFoods` | 577 | 583 | FunctionDeclaration |
| F2195 | `normalizeExtraRationFoods` | 585 | 610 | FunctionDeclaration |
| F2196 | `normalizeRationFood` | 612 | 626 | FunctionDeclaration |
| F2197 | `groupRationFoods` | 628 | 636 | FunctionDeclaration |
| F2198 | `(callback)` | 635 | 635 | ArrowFunctionExpression |
| F2199 | `localizeRationCategory` | 638 | 653 | FunctionDeclaration |
| F2200 | `addSelectedRationFood` | 655 | 672 | FunctionDeclaration |
| F2201 | `addAllRationFoods` | 674 | 688 | FunctionDeclaration |
| F2202 | `removeAllRationFoods` | 690 | 700 | FunctionDeclaration |
| F2203 | `addRationFoodRow` | 702 | 730 | FunctionDeclaration |
| F2204 | `(callback)` | 703 | 703 | ArrowFunctionExpression |
| F2205 | `expandRationFoodCreator` | 732 | 740 | FunctionDeclaration |
| F2206 | `createRationFood` | 742 | 788 | async FunctionDeclaration |
| F2207 | `(callback)` | 753 | 753 | ArrowFunctionExpression |
| F2208 | `(callback)` | 754 | 754 | ArrowFunctionExpression |
| F2209 | `getOrCreateRationFoodFolder` | 790 | 799 | async FunctionDeclaration |
| F2210 | `(callback)` | 792 | 792 | ArrowFunctionExpression |
| F2211 | `makeCustomRationKey` | 801 | 806 | FunctionDeclaration |
| F2212 | `customRationFoodExists` | 808 | 814 | FunctionDeclaration |
| F2213 | `(callback)` | 813 | 813 | ArrowFunctionExpression |
| F2214 | `confirmRationFoodBulkAction` | 816 | 836 | async FunctionDeclaration |
| F2215 | `callback` | 826 | 826 | init |
| F2216 | `callback` | 831 | 831 | init |
| F2217 | `toggleRationEmptyState` | 838 | 842 | FunctionDeclaration |
| F2218 | `refreshTokenActionHud` | 844 | 853 | FunctionDeclaration |
| F2219 | `(callback)` | 851 | 851 | ArrowFunctionExpression |
| F2220 | `rerenderOpenSheets` | 855 | 871 | FunctionDeclaration |
| F2221 | `scheduleOpenSheetRerender` | 873 | 879 | FunctionDeclaration |
| F2222 | `(callback)` | 875 | 878 | ArrowFunctionExpression |
### [scripts/sheet-ui.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/sheet-ui.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2223 | `registerSheetHooks` | 53 | 70 | FunctionDeclaration |
| F2224 | `(callback)` | 67 | 67 | ArrowFunctionExpression |
| F2225 | `(callback)` | 68 | 68 | ArrowFunctionExpression |
| F2226 | `patchRitualistDropCreation` | 72 | 96 | FunctionDeclaration |
| F2227 | `tenebreRitualistDrop` | 77 | 93 | async FunctionExpression |
| F2228 | `patchRitualistInlineDeletion` | 98 | 121 | FunctionDeclaration |
| F2229 | `tenebreRitualistItemDelete` | 103 | 118 | async FunctionExpression |
| F2230 | `callback` | 113 | 113 | init |
| F2231 | `onOwnedRitualWillDelete` | 123 | 141 | FunctionDeclaration |
| F2232 | `(callback)` | 136 | 136 | ArrowFunctionExpression |
| F2233 | `(callback)` | 140 | 140 | ArrowFunctionExpression |
| F2234 | `onOwnedRitualCollectionChanged` | 143 | 165 | FunctionDeclaration |
| F2235 | `(callback)` | 159 | 159 | ArrowFunctionExpression |
| F2236 | `(callback)` | 161 | 164 | ArrowFunctionExpression |
| F2237 | `forEachOpenActorSheet` | 167 | 174 | FunctionDeclaration |
| F2238 | `refreshOpenRitualistLists` | 176 | 180 | FunctionDeclaration |
| F2239 | `(callback)` | 177 | 179 | ArrowFunctionExpression |
| F2240 | `patchSymbaroumItemChatSender` | 182 | 199 | FunctionDeclaration |
| F2241 | `tenebreSendToChat` | 188 | 195 | async FunctionExpression |
| F2242 | `patchSymbaroumSheetListeners` | 205 | 217 | FunctionDeclaration |
| F2243 | `(callback)` | 208 | 208 | ArrowFunctionExpression |
| F2244 | `(callback)` | 214 | 214 | ArrowFunctionExpression |
| F2245 | `getSymbaroumSheetClasses` | 219 | 225 | FunctionDeclaration |
| F2246 | `(callback)` | 222 | 222 | ArrowFunctionExpression |
| F2247 | `(callback)` | 223 | 223 | ArrowFunctionExpression |
| F2248 | `patchSheetActivateListeners` | 227 | 241 | FunctionDeclaration |
| F2249 | `tenebreActivateListeners` | 232 | 240 | FunctionExpression |
| F2250 | `onRenderApplicationV2` | 243 | 247 | FunctionDeclaration |
| F2251 | `getActorFromDom` | 249 | 258 | FunctionDeclaration |
| F2252 | `patchContextMenu` | 260 | 478 | FunctionDeclaration |
| F2253 | `handler` | 265 | 464 | FunctionExpression |
| F2254 | `isVisible` | 273 | 278 | init |
| F2255 | `callback` | 279 | 286 | init |
| F2256 | `isVisible` | 292 | 294 | init |
| F2257 | `callback` | 295 | 302 | init |
| F2258 | `isVisible` | 308 | 310 | init |
| F2259 | `callback` | 311 | 318 | init |
| F2260 | `isVisible` | 324 | 326 | init |
| F2261 | `callback` | 327 | 332 | init |
| F2262 | `isVisible` | 338 | 344 | init |
| F2263 | `callback` | 345 | 350 | init |
| F2264 | `isVisible` | 356 | 358 | init |
| F2265 | `callback` | 359 | 366 | init |
| F2266 | `isVisible` | 372 | 373 | init |
| F2267 | `callback` | 374 | 377 | init |
| F2268 | `isVisible` | 383 | 385 | init |
| F2269 | `callback` | 386 | 390 | init |
| F2270 | `isVisible` | 396 | 398 | init |
| F2271 | `callback` | 399 | 403 | init |
| F2272 | `isVisible` | 409 | 415 | init |
| F2273 | `callback` | 416 | 423 | init |
| F2274 | `isVisible` | 429 | 436 | init |
| F2275 | `callback` | 437 | 444 | init |
| F2276 | `(callback)` | 442 | 442 | ArrowFunctionExpression |
| F2277 | `(callback)` | 455 | 457 | ArrowFunctionExpression |
| F2278 | `(callback)` | 467 | 469 | FunctionExpression |
| F2279 | `tenebreContextMenuRender` | 472 | 475 | FunctionExpression |
| F2280 | `wrapped` | 473 | 473 | ArrowFunctionExpression |
| F2281 | `onRenderActorSheet` | 482 | 514 | FunctionDeclaration |
| F2282 | `wireHerbalCureIconUse` | 516 | 525 | FunctionDeclaration |
| F2283 | `bindHerbalCureControl` | 527 | 553 | FunctionDeclaration |
| F2284 | `activate` | 535 | 548 | async ArrowFunctionExpression |
| F2285 | `injectMoneyControls` | 555 | 576 | FunctionDeclaration |
| F2286 | `(callback)` | 562 | 562 | ArrowFunctionExpression |
| F2287 | `(callback)` | 570 | 574 | ArrowFunctionExpression |
| F2288 | `injectWeaponReadinessControls` | 578 | 604 | FunctionDeclaration |
| F2289 | `(callback)` | 582 | 582 | ArrowFunctionExpression |
| F2290 | `(callback)` | 583 | 583 | ArrowFunctionExpression |
| F2291 | `(callback)` | 584 | 584 | ArrowFunctionExpression |
| F2292 | `(callback)` | 597 | 601 | ArrowFunctionExpression |
| F2293 | `injectRitualistInlineList` | 606 | 717 | FunctionDeclaration |
| F2294 | `(callback)` | 611 | 611 | ArrowFunctionExpression |
| F2295 | `getRituals` | 612 | 612 | ArrowFunctionExpression |
| F2296 | `revealRitualRows` | 614 | 622 | ArrowFunctionExpression |
| F2297 | `(callback)` | 625 | 625 | ArrowFunctionExpression |
| F2298 | `(callback)` | 637 | 637 | ArrowFunctionExpression |
| F2299 | `hideRitualRows` | 653 | 661 | ArrowFunctionExpression |
| F2300 | `renderExpandedState` | 674 | 688 | ArrowFunctionExpression |
| F2301 | `(callback)` | 675 | 675 | ArrowFunctionExpression |
| F2302 | `toggleHandler` | 693 | 710 | async ArrowFunctionExpression |
| F2303 | `getKnownRituals` | 719 | 728 | FunctionDeclaration |
| F2304 | `(callback)` | 723 | 723 | ArrowFunctionExpression |
| F2305 | `(callback)` | 725 | 725 | ArrowFunctionExpression |
| F2306 | `scheduleRitualistInjectionRetry` | 730 | 749 | FunctionDeclaration |
| F2307 | `(callback)` | 742 | 747 | ArrowFunctionExpression |
| F2308 | `cancelRitualistInjectionRetry` | 751 | 756 | FunctionDeclaration |
| F2309 | `findAbilityItemRow` | 758 | 761 | FunctionDeclaration |
| F2310 | `moveAbilityRowToEnd` | 763 | 767 | FunctionDeclaration |
| F2311 | `isAbilityRowInRightColumn` | 769 | 775 | FunctionDeclaration |
| F2312 | `buildRitualistInlineRow` | 777 | 798 | FunctionDeclaration |
| F2313 | `buildRitualistItem` | 800 | 838 | FunctionDeclaration |
| F2314 | `(callback)` | 811 | 817 | async ArrowFunctionExpression |
| F2315 | `(callback)` | 825 | 829 | ArrowFunctionExpression |
| F2316 | `wireChatItemUseIconFallback` | 840 | 863 | FunctionDeclaration |
| F2317 | `(callback)` | 855 | 861 | async ArrowFunctionExpression |
| F2318 | `shouldUseChatItemFromIcon` | 865 | 869 | FunctionDeclaration |
| F2319 | `wireInventoryItemIconUse` | 871 | 915 | FunctionDeclaration |
| F2320 | `activate` | 901 | 910 | async ArrowFunctionExpression |
| F2321 | `wireContainerLeftClickToggle` | 917 | 954 | FunctionDeclaration |
| F2322 | `activate` | 940 | 948 | async ArrowFunctionExpression |
| F2323 | `wireContainerDragDrop` | 956 | 1027 | FunctionDeclaration |
| F2324 | `(callback)` | 963 | 973 | ArrowFunctionExpression |
| F2325 | `(callback)` | 975 | 978 | ArrowFunctionExpression |
| F2326 | `(callback)` | 980 | 998 | ArrowFunctionExpression |
| F2327 | `(callback)` | 1000 | 1002 | ArrowFunctionExpression |
| F2328 | `(callback)` | 1004 | 1026 | async ArrowFunctionExpression |
| F2329 | `prepareContainerDraggables` | 1029 | 1046 | FunctionDeclaration |
| F2330 | `getContainerDragStartData` | 1048 | 1066 | FunctionDeclaration |
| F2331 | `getContainerDropData` | 1068 | 1078 | FunctionDeclaration |
| F2332 | `getContainerDropTarget` | 1080 | 1088 | FunctionDeclaration |
| F2333 | `isStoredItemWithdrawDrop` | 1090 | 1092 | FunctionDeclaration |
| F2334 | `markContainerDropTarget` | 1094 | 1099 | FunctionDeclaration |
| F2335 | `clearContainerDropMarkers` | 1101 | 1106 | FunctionDeclaration |
| F2336 | `(callback)` | 1103 | 1105 | ArrowFunctionExpression |
| F2337 | `onTenebreSettingChanged` | 1108 | 1112 | FunctionDeclaration |
| F2338 | `onActiveEffectChanged` | 1114 | 1123 | FunctionDeclaration |
| F2339 | `(callback)` | 1120 | 1120 | ArrowFunctionExpression |
| F2340 | `(callback)` | 1121 | 1121 | ArrowFunctionExpression |
| F2341 | `(callback)` | 1122 | 1122 | ArrowFunctionExpression |
| F2342 | `syncOpenActorSheetHeaders` | 1125 | 1134 | FunctionDeclaration |
| F2343 | `syncActorSheetHeaders` | 1136 | 1151 | FunctionDeclaration |
| F2344 | `syncActorSheetHeaderButtons` | 1153 | 1195 | FunctionDeclaration |
| F2345 | `onClick` | 1172 | 1180 | async init |
| F2346 | `(callback)` | 1177 | 1177 | ArrowFunctionExpression |
| F2347 | `(callback)` | 1178 | 1178 | ArrowFunctionExpression |
| F2348 | `onClick` | 1189 | 1192 | async init |
| F2349 | `removeTenebreActorHeaderButtons` | 1197 | 1201 | FunctionDeclaration |
| F2350 | `(callback)` | 1200 | 1200 | ArrowFunctionExpression |
| F2351 | `isSymbaroumActorSheetApplication` | 1203 | 1205 | FunctionDeclaration |
| F2352 | `isSymbaroumItemSheetApplication` | 1207 | 1209 | FunctionDeclaration |
| F2353 | `isRegisteredSymbaroumSheetApplication` | 1211 | 1220 | FunctionDeclaration |
| F2354 | `(callback)` | 1219 | 1219 | ArrowFunctionExpression |
| F2355 | `insertHeaderButton` | 1222 | 1228 | FunctionDeclaration |
| F2356 | `hideStoredItemRows` | 1230 | 1248 | FunctionDeclaration |
| F2357 | `hideRows` | 1234 | 1243 | ArrowFunctionExpression |
| F2358 | `injectContainerInlineLists` | 1250 | 1275 | FunctionDeclaration |
| F2359 | `(callback)` | 1256 | 1256 | ArrowFunctionExpression |
| F2360 | `decorateContainerCapacity` | 1277 | 1293 | FunctionDeclaration |
| F2361 | `(callback)` | 1278 | 1278 | ArrowFunctionExpression |
| F2362 | `buildContainerInlineRow` | 1295 | 1335 | FunctionDeclaration |
| F2363 | `buildContainerInlineItem` | 1337 | 1410 | FunctionDeclaration |
| F2364 | `openItem` | 1343 | 1348 | ArrowFunctionExpression |
| F2365 | `useItem` | 1362 | 1369 | async ArrowFunctionExpression |
| F2366 | `(callback)` | 1395 | 1399 | async ArrowFunctionExpression |
| F2367 | `bindStoredItemContextMenu` | 1412 | 1441 | FunctionDeclaration |
| F2368 | `visible` | 1422 | 1427 | init |
| F2369 | `onClick` | 1428 | 1431 | init |
| F2370 | `updateQuiverQuantityDisplay` | 1444 | 1466 | FunctionDeclaration |
| F2371 | `updateRationQuantityDisplay` | 1470 | 1499 | FunctionDeclaration |
| F2372 | `(callback)` | 1479 | 1479 | ArrowFunctionExpression |
| F2373 | `hasActorEffects` | 1501 | 1503 | FunctionDeclaration |
| F2374 | `(callback)` | 1502 | 1502 | ArrowFunctionExpression |
| F2375 | `clearActorEffects` | 1505 | 1511 | async FunctionDeclaration |
| F2376 | `(callback)` | 1506 | 1506 | ArrowFunctionExpression |
| F2377 | `(callback)` | 1509 | 1509 | ArrowFunctionExpression |
| F2378 | `onRenderItemSheet` | 1513 | 1529 | FunctionDeclaration |
| F2379 | `injectItemContainerControls` | 1531 | 1561 | FunctionDeclaration |
| F2380 | `(callback)` | 1539 | 1539 | ArrowFunctionExpression |
| F2381 | `(callback)` | 1548 | 1548 | ArrowFunctionExpression |
| F2382 | `(callback)` | 1555 | 1558 | async ArrowFunctionExpression |
| F2383 | `skipDuplicateSheetRender` | 1563 | 1577 | FunctionDeclaration |
| F2384 | `clearQueuedFlag` | 1571 | 1573 | ArrowFunctionExpression |
| F2385 | `injectItemWeightField` | 1580 | 1620 | FunctionDeclaration |
| F2386 | `(callback)` | 1596 | 1596 | ArrowFunctionExpression |
| F2387 | `(callback)` | 1603 | 1603 | ArrowFunctionExpression |
| F2388 | `(callback)` | 1612 | 1619 | async ArrowFunctionExpression |
| F2389 | `findItemWeightAnchor` | 1622 | 1662 | FunctionDeclaration |
| F2390 | `createWeightRow` | 1664 | 1691 | FunctionDeclaration |
| F2391 | `refreshActorEncumbrance` | 1693 | 1703 | FunctionDeclaration |
| F2392 | `onEncumbranceItemUpdated` | 1705 | 1721 | FunctionDeclaration |
| F2393 | `(callback)` | 1710 | 1717 | ArrowFunctionExpression |
| F2394 | `injectEncumbrancePanel` | 1724 | 1748 | FunctionDeclaration |
| F2395 | `findEquipmentSectionTitle` | 1750 | 1779 | FunctionDeclaration |
| F2396 | `matchesEquipmentTitle` | 1781 | 1786 | FunctionDeclaration |
| F2397 | `buildEncumbranceIndicatorHtml` | 1788 | 1814 | FunctionDeclaration |
| F2398 | `injectManeuverPanel` | 1816 | 1867 | FunctionDeclaration |
| F2399 | `(callback)` | 1826 | 1826 | ArrowFunctionExpression |
| F2400 | `(callback)` | 1829 | 1829 | ArrowFunctionExpression |
| F2401 | `(callback)` | 1844 | 1847 | ArrowFunctionExpression |
| F2402 | `(callback)` | 1850 | 1863 | async ArrowFunctionExpression |
| F2403 | `(callback)` | 1857 | 1862 | ArrowFunctionExpression |
| F2404 | `getManeuverSelectionKey` | 1869 | 1871 | FunctionDeclaration |
| F2405 | `buildManeuverPanelHtml` | 1873 | 1905 | FunctionDeclaration |
| F2406 | `(callback)` | 1874 | 1878 | ArrowFunctionExpression |
| F2407 | `updateManeuverInformation` | 1907 | 1923 | FunctionDeclaration |
| F2408 | `(callback)` | 1915 | 1915 | ArrowFunctionExpression |
| F2409 | `(callback)` | 1921 | 1921 | ArrowFunctionExpression |
| F2410 | `getRoot` | 1927 | 1935 | FunctionDeclaration |
| F2411 | `isPlayerActor` | 1937 | 1939 | FunctionDeclaration |
| F2412 | `isManagedActor` | 1941 | 1943 | FunctionDeclaration |
| F2413 | `onRenderDialog` | 1947 | 2086 | FunctionDeclaration |
| F2414 | `(callback)` | 1967 | 1967 | ArrowFunctionExpression |
| F2415 | `(callback)` | 1977 | 2013 | async FunctionExpression |
| F2416 | `syncSelection` | 2065 | 2068 | ArrowFunctionExpression |
| F2417 | `getDisplayedItemWeight` | 2088 | 2090 | FunctionDeclaration |
| F2418 | `attachAmmoRollButtonCapture` | 2092 | 2126 | FunctionDeclaration |
| F2419 | `(callback)` | 2105 | 2118 | ArrowFunctionExpression |
| F2420 | `(callback)` | 2124 | 2124 | ArrowFunctionExpression |
| F2421 | `getAmmoUnavailableMessage` | 2128 | 2136 | FunctionDeclaration |
| F2422 | `prepareSelectedAmmoForRoll` | 2138 | 2146 | FunctionDeclaration |
| F2423 | `updateSelectedAmmoForRoll` | 2148 | 2153 | FunctionDeclaration |
| F2424 | `getSelectedAmmoFromDialog` | 2155 | 2196 | FunctionDeclaration |
| F2425 | `(callback)` | 2165 | 2165 | ArrowFunctionExpression |
| F2426 | `(callback)` | 2168 | 2168 | ArrowFunctionExpression |
| F2427 | `getFlag` | 2188 | 2191 | init |
| F2428 | `onCloseDialog` | 2199 | 2203 | FunctionDeclaration |
### [scripts/socket-policy.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/socket-policy.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2429 | `assertSafeBatch` | 48 | 53 | FunctionDeclaration |
| F2430 | `assertSafePayload` | 55 | 65 | FunctionDeclaration |
| F2431 | `isModuleManeuverEffect` | 67 | 71 | FunctionDeclaration |
| F2432 | `isAllowedManeuverEffectCreate` | 73 | 84 | FunctionDeclaration |
| F2433 | `isAllowedManeuverEffectUpdate` | 86 | 94 | FunctionDeclaration |
| F2434 | `isAllowedToughnessUpdate` | 96 | 104 | FunctionDeclaration |
| F2435 | `isAllowedCombatantUpdate` | 106 | 113 | FunctionDeclaration |
| F2436 | `(callback)` | 109 | 109 | ArrowFunctionExpression |
| F2437 | `sanitizeSocketOptions` | 115 | 117 | FunctionDeclaration |
| F2438 | `isPlainObject` | 119 | 121 | FunctionDeclaration |
| F2439 | `hasOnlyKeys` | 123 | 125 | FunctionDeclaration |
| F2440 | `(callback)` | 124 | 124 | ArrowFunctionExpression |
| F2441 | `isAllowedDuration` | 127 | 133 | FunctionDeclaration |
| F2442 | `(callback)` | 129 | 132 | ArrowFunctionExpression |
| F2443 | `isAllowedManeuverFlags` | 135 | 152 | FunctionDeclaration |
| F2444 | `(callback)` | 137 | 137 | ArrowFunctionExpression |
| F2445 | `(callback)` | 140 | 140 | ArrowFunctionExpression |
| F2446 | `(callback)` | 149 | 149 | ArrowFunctionExpression |
| F2447 | `isAllowedManeuverFlagValue` | 154 | 168 | FunctionDeclaration |
| F2448 | `hasCanonicalManeuverTiming` | 170 | 181 | FunctionDeclaration |
| F2449 | `hasCanonicalManeuverMovement` | 183 | 191 | FunctionDeclaration |
| F2450 | `isSafeEffectLabel` | 193 | 198 | FunctionDeclaration |
| F2451 | `isSafeEffectIcon` | 200 | 206 | FunctionDeclaration |
### [scripts/sockets.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/sockets.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2452 | `(callback)` | 29 | 41 | ArrowFunctionExpression |
| F2453 | `SocketService.disarmItem` | 44 | 51 | static async method |
| F2454 | `SocketService.shoveToken` | 53 | 58 | static async method |
| F2455 | `SocketService.registerHandler` | 60 | 65 | static method |
| F2456 | `SocketService.active` | 67 | 69 | static get |
| F2457 | `SocketService.hasActiveGM` | 71 | 73 | static method |
| F2458 | `SocketService.isPrimaryGM` | 75 | 77 | static method |
| F2459 | `SocketService.canModify` | 79 | 94 | static method |
| F2460 | `SocketService.createEmbeddedDocuments` | 96 | 102 | static async method |
| F2461 | `SocketService.deleteEmbeddedDocuments` | 104 | 110 | static async method |
| F2462 | `SocketService.markActorDead` | 113 | 117 | static async method |
| F2463 | `SocketService.setFlag` | 119 | 125 | static async method |
| F2464 | `SocketService.unsetFlag` | 127 | 133 | static async method |
| F2465 | `SocketService.updateCombatant` | 135 | 143 | static async method |
| F2466 | `SocketService.updateDocument` | 145 | 151 | static async method |
| F2467 | `SocketService.updateEmbeddedDocuments` | 153 | 159 | static async method |
| F2468 | `SocketService.executeAsGM` | 161 | 178 | static async method |
| F2469 | `SocketService.executeAsPrimaryGM` | 181 | 188 | static async method |
| F2470 | `disarmItemAsGM` | 191 | 202 | async FunctionDeclaration |
| F2471 | `shoveTokenAsGM` | 204 | 229 | async FunctionDeclaration |
| F2472 | `createEmbeddedDocumentsAsGM` | 231 | 238 | async FunctionDeclaration |
| F2473 | `deleteEmbeddedDocumentsAsGM` | 240 | 249 | async FunctionDeclaration |
| F2474 | `(callback)` | 244 | 244 | ArrowFunctionExpression |
| F2475 | `markActorDeadAsGM` | 251 | 255 | async FunctionDeclaration |
| F2476 | `setFlagAsGM` | 257 | 265 | async FunctionDeclaration |
| F2477 | `unsetFlagAsGM` | 267 | 273 | async FunctionDeclaration |
| F2478 | `updateCombatantAsGM` | 275 | 284 | async FunctionDeclaration |
| F2479 | `updateDocumentAsGM` | 286 | 303 | async FunctionDeclaration |
| F2480 | `updateEmbeddedDocumentsAsGM` | 305 | 317 | async FunctionDeclaration |
| F2481 | `(callback)` | 309 | 313 | ArrowFunctionExpression |
| F2482 | `getRequestUser` | 319 | 324 | FunctionDeclaration |
| F2483 | `authorizeEmbeddedOperation` | 326 | 341 | FunctionDeclaration |
| F2484 | `(callback)` | 332 | 332 | ArrowFunctionExpression |
| F2485 | `(callback)` | 334 | 334 | ArrowFunctionExpression |
| F2486 | `(callback)` | 336 | 336 | ArrowFunctionExpression |
| F2487 | `authorizeOwnedDocument` | 343 | 346 | FunctionDeclaration |
| F2488 | `hasOwnerPermission` | 348 | 355 | FunctionDeclaration |
| F2489 | `isTargetedActor` | 357 | 362 | FunctionDeclaration |
| F2490 | `(callback)` | 359 | 361 | ArrowFunctionExpression |
| F2491 | `getDocument` | 364 | 368 | async FunctionDeclaration |
| F2492 | `getCombat` | 370 | 384 | async FunctionDeclaration |
| F2493 | `markActorDeadLocal` | 386 | 413 | async FunctionDeclaration |
| F2494 | `(callback)` | 405 | 405 | ArrowFunctionExpression |
| F2495 | `hasDeadCondition` | 415 | 422 | FunctionDeclaration |
| F2496 | `(callback)` | 416 | 421 | ArrowFunctionExpression |
| F2497 | `findPendingShoveEffect` | 428 | 435 | FunctionDeclaration |
| F2498 | `(callback)` | 429 | 434 | ArrowFunctionExpression |
| F2499 | `findActorTokenCombatants` | 437 | 448 | FunctionDeclaration |
| F2500 | `(callback)` | 443 | 443 | ArrowFunctionExpression |
| F2501 | `(callback)` | 444 | 444 | ArrowFunctionExpression |
| F2502 | `markActorCombatantsDefeated` | 450 | 456 | async FunctionDeclaration |
### [scripts/special-ammo.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/special-ammo.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2503 | `getSpecialAmmo` | 73 | 77 | FunctionDeclaration |
| F2504 | `(callback)` | 76 | 76 | ArrowFunctionExpression |
| F2505 | `getAmmoDescription` | 79 | 83 | FunctionDeclaration |
| F2506 | `getSpecialAmmoType` | 85 | 87 | FunctionDeclaration |
| F2507 | `getAmmoModifiers` | 94 | 152 | FunctionDeclaration |
| F2508 | `(callback)` | 101 | 101 | ArrowFunctionExpression |
| F2509 | `(callback)` | 114 | 114 | ArrowFunctionExpression |
| F2510 | `(callback)` | 132 | 132 | ArrowFunctionExpression |
| F2511 | `(callback)` | 143 | 143 | ArrowFunctionExpression |
| F2512 | `getAmmoRecoveryThreshold` | 162 | 176 | FunctionDeclaration |
| F2513 | `getAmmoRecoveryClass` | 178 | 217 | FunctionDeclaration |
| F2514 | `(callback)` | 196 | 196 | ArrowFunctionExpression |
| F2515 | `(callback)` | 212 | 212 | ArrowFunctionExpression |
### [scripts/stand-up.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/stand-up.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2516 | `resolveStandUpTest` | 16 | 29 | FunctionDeclaration |
| F2517 | `buildStandUpActionState` | 31 | 39 | FunctionDeclaration |
| F2518 | `getStandUpRemainingMovementActions` | 41 | 51 | FunctionDeclaration |
| F2519 | `resolveStandUpPortrait` | 53 | 60 | FunctionDeclaration |
| F2520 | `shouldShowStandUpButton` | 62 | 67 | FunctionDeclaration |
| F2521 | `getStandUpButtonPosition` | 69 | 76 | FunctionDeclaration |
| F2522 | `StandUpService.register` | 79 | 91 | static method |
| F2523 | `StandUpService.(callback)` | 82 | 82 | ArrowFunctionExpression |
| F2524 | `StandUpService.(callback)` | 83 | 83 | ArrowFunctionExpression |
| F2525 | `StandUpService.(callback)` | 85 | 85 | ArrowFunctionExpression |
| F2526 | `StandUpService.(callback)` | 86 | 86 | ArrowFunctionExpression |
| F2527 | `StandUpService.(callback)` | 87 | 87 | ArrowFunctionExpression |
| F2528 | `StandUpService.(callback)` | 88 | 88 | ArrowFunctionExpression |
| F2529 | `StandUpService.(callback)` | 89 | 89 | ArrowFunctionExpression |
| F2530 | `StandUpService.(callback)` | 90 | 90 | ArrowFunctionExpression |
| F2531 | `StandUpService.queueRefreshAllButtons` | 93 | 95 | static method |
| F2532 | `StandUpService.(callback)` | 94 | 94 | ArrowFunctionExpression |
| F2533 | `StandUpService.queueRefreshActorButtons` | 97 | 100 | static method |
| F2534 | `StandUpService.(callback)` | 99 | 99 | ArrowFunctionExpression |
| F2535 | `StandUpService.refreshAllButtons` | 102 | 104 | static method |
| F2536 | `StandUpService.refreshActorButtons` | 106 | 113 | static method |
| F2537 | `StandUpService.repositionTokenButton` | 115 | 121 | static method |
| F2538 | `StandUpService.syncTokenButton` | 123 | 137 | static method |
| F2539 | `StandUpService.findTokenButton` | 139 | 146 | static method |
| F2540 | `StandUpService.createTokenButton` | 148 | 192 | static method |
| F2541 | `StandUpService.(callback)` | 169 | 169 | ArrowFunctionExpression |
| F2542 | `StandUpService.(callback)` | 170 | 170 | ArrowFunctionExpression |
| F2543 | `StandUpService.(callback)` | 171 | 171 | ArrowFunctionExpression |
| F2544 | `StandUpService.(callback)` | 172 | 172 | ArrowFunctionExpression |
| F2545 | `StandUpService.(callback)` | 173 | 187 | ArrowFunctionExpression |
| F2546 | `StandUpService.(callback)` | 179 | 186 | ArrowFunctionExpression |
| F2547 | `StandUpService.removeTokenButton` | 194 | 201 | static method |
| F2548 | `StandUpService.attempt` | 203 | 258 | static async method |
| F2549 | `StandUpService.(callback)` | 233 | 233 | ArrowFunctionExpression |
| F2550 | `StandUpService.(callback)` | 242 | 244 | ArrowFunctionExpression |
| F2551 | `isActorsTurn` | 261 | 269 | FunctionDeclaration |
| F2552 | `(callback)` | 264 | 264 | ArrowFunctionExpression |
| F2553 | `removeProne` | 271 | 285 | async FunctionDeclaration |
| F2554 | `(callback)` | 277 | 281 | ArrowFunctionExpression |
| F2555 | `buildStandUpChat` | 287 | 309 | FunctionDeclaration |
| F2556 | `createStandUpButtonBackground` | 311 | 330 | FunctionDeclaration |
| F2557 | `createStandUpButtonIcon` | 332 | 352 | FunctionDeclaration |
| F2558 | `drawCircle` | 354 | 367 | FunctionDeclaration |
| F2559 | `setStandUpButtonHover` | 369 | 373 | FunctionDeclaration |
### [scripts/status-effect-picker.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/status-effect-picker.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2560 | `open` | 10 | 71 | async init |
| F2561 | `render` | 37 | 37 | init |
| F2562 | `render` | 60 | 60 | init |
| F2563 | `installMacro` | 73 | 93 | async init |
| F2564 | `toggle` | 95 | 100 | async init |
| F2565 | `collectAvailableStatusEffects` | 103 | 121 | FunctionDeclaration |
| F2566 | `(callback)` | 120 | 120 | ArrowFunctionExpression |
| F2567 | `statusEffectValues` | 123 | 130 | FunctionDeclaration |
| F2568 | `isEffectActive` | 132 | 140 | FunctionDeclaration |
| F2569 | `(callback)` | 135 | 139 | ArrowFunctionExpression |
| F2570 | `findFirstEmptyHotbarSlot` | 142 | 151 | FunctionDeclaration |
| F2571 | `(callback)` | 150 | 150 | ArrowFunctionExpression |
| F2572 | `getSelectedToken` | 153 | 156 | FunctionDeclaration |
| F2573 | `(callback)` | 154 | 154 | ArrowFunctionExpression |
| F2574 | `canModifyActor` | 158 | 160 | FunctionDeclaration |
| F2575 | `statusEffectId` | 162 | 164 | FunctionDeclaration |
| F2576 | `effectDescription` | 166 | 173 | FunctionDeclaration |
| F2577 | `localizeValue` | 175 | 180 | FunctionDeclaration |
| F2578 | `buildPickerContent` | 182 | 216 | FunctionDeclaration |
| F2579 | `(callback)` | 187 | 197 | ArrowFunctionExpression |
| F2580 | `activatePicker` | 218 | 282 | FunctionDeclaration |
| F2581 | `(callback)` | 228 | 238 | ArrowFunctionExpression |
| F2582 | `(callback)` | 240 | 281 | async ArrowFunctionExpression |
| F2583 | `(callback)` | 244 | 244 | ArrowFunctionExpression |
| F2584 | `buildAppliedEffectChatContent` | 284 | 306 | FunctionDeclaration |
| F2585 | `publishAppliedEffectChatMessage` | 308 | 322 | async FunctionDeclaration |
| F2586 | `isAppliedEffectChatEnabled` | 324 | 330 | FunctionDeclaration |
| F2587 | `pickerDialogPosition` | 332 | 339 | FunctionDeclaration |
| F2588 | `findUsablePickerMacro` | 341 | 347 | FunctionDeclaration |
| F2589 | `(callback)` | 342 | 346 | ArrowFunctionExpression |
| F2590 | `createPickerMacro` | 349 | 368 | async FunctionDeclaration |
| F2591 | `notify` | 370 | 373 | FunctionDeclaration |
### [scripts/symbaroum-i18n.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/symbaroum-i18n.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2592 | `symbaroumLabelVariants` | 20 | 33 | FunctionDeclaration |
| F2593 | `matchesSymbaroumLabel` | 38 | 45 | FunctionDeclaration |
### [scripts/token-action-hud.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/token-action-hud.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2594 | `TokenActionHudIntegration.register` | 15 | 34 | static method |
| F2595 | `TokenActionHudIntegration.(callback)` | 19 | 25 | ArrowFunctionExpression |
| F2596 | `TokenActionHudIntegration.(callback)` | 27 | 33 | ArrowFunctionExpression |
| F2597 | `TokenActionHudIntegration.extendDefaults` | 36 | 66 | static method |
| F2598 | `TokenActionHudIntegration.(callback)` | 49 | 49 | ArrowFunctionExpression |
| F2599 | `TokenActionHudIntegration.(callback)` | 53 | 53 | ArrowFunctionExpression |
| F2600 | `TokenActionHudIntegration.extendActionHandler` | 68 | 80 | static method |
| F2601 | `TokenActionHudIntegration.tenebreBuildSystemActions` | 73 | 77 | async FunctionExpression |
| F2602 | `TokenActionHudIntegration.getGroupId` | 82 | 84 | static method |
| F2603 | `TokenActionHudIntegration.buildActions` | 86 | 122 | static method |
| F2604 | `TokenActionHudIntegration.(callback)` | 91 | 106 | ArrowFunctionExpression |
| F2605 | `TokenActionHudIntegration.(callback)` | 94 | 94 | ArrowFunctionExpression |
| F2606 | `TokenActionHudIntegration.onClick` | 104 | 104 | async init |
| F2607 | `TokenActionHudIntegration.onClick` | 114 | 117 | async init |
| F2608 | `addManeuverActions` | 125 | 134 | async FunctionDeclaration |
| F2609 | `getHandlerActor` | 136 | 143 | FunctionDeclaration |
| F2610 | `hasActorEffects` | 145 | 147 | FunctionDeclaration |
| F2611 | `(callback)` | 146 | 146 | ArrowFunctionExpression |
| F2612 | `clearActorEffects` | 149 | 156 | async FunctionDeclaration |
| F2613 | `(callback)` | 150 | 150 | ArrowFunctionExpression |
| F2614 | `(callback)` | 154 | 154 | ArrowFunctionExpression |
| F2615 | `isTokenActionHudAvailable` | 158 | 160 | FunctionDeclaration |
### [scripts/travel-context.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/travel-context.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2616 | `travelSetting` | 16 | 18 | FunctionDeclaration |
| F2617 | `normalizeTravelConfiguration` | 19 | 23 | FunctionDeclaration |
| F2618 | `getTravelRate` | 24 | 27 | FunctionDeclaration |
| F2619 | `effectiveExpeditionSearch` | 29 | 31 | FunctionDeclaration |
| F2620 | `partyTravelReferences` | 32 | 36 | FunctionDeclaration |
| F2621 | `resolvePartyTravelActors` | 37 | 39 | async FunctionDeclaration |
| F2622 | `actorTravelProfile` | 40 | 51 | FunctionDeclaration |
| F2623 | `journeyContextKey` | 52 | 63 | FunctionDeclaration |
| F2624 | `(callback)` | 56 | 56 | ArrowFunctionExpression |
| F2625 | `(callback)` | 57 | 57 | ArrowFunctionExpression |
| F2626 | `(callback)` | 58 | 58 | ArrowFunctionExpression |
| F2627 | `(callback)` | 58 | 58 | ArrowFunctionExpression |
### [scripts/utils.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/utils.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2628 | `escapeHtml` | 4 | 12 | FunctionDeclaration |
| F2629 | `localize` | 15 | 18 | FunctionDeclaration |
| F2630 | `format` | 21 | 25 | FunctionDeclaration |
| F2631 | `(callback)` | 24 | 24 | ArrowFunctionExpression |
| F2632 | `isActiveGM` | 31 | 36 | FunctionDeclaration |
| F2633 | `isActorExecutor` | 41 | 48 | FunctionDeclaration |
| F2634 | `(callback)` | 45 | 45 | ArrowFunctionExpression |
| F2635 | `(callback)` | 46 | 46 | ArrowFunctionExpression |
| F2636 | `isGroundContainerToken` | 54 | 57 | FunctionDeclaration |
| F2637 | `getActorTokens` | 60 | 62 | FunctionDeclaration |
| F2638 | `(callback)` | 61 | 61 | ArrowFunctionExpression |
| F2639 | `getCanvasCreatureTokens` | 65 | 67 | FunctionDeclaration |
| F2640 | `(callback)` | 66 | 66 | ArrowFunctionExpression |
| F2641 | `rerenderActorSheets` | 70 | 82 | FunctionDeclaration |
| F2642 | `sanitizeHtml` | 84 | 88 | FunctionDeclaration |
| F2643 | `normalize` | 90 | 95 | FunctionDeclaration |
| F2644 | `normalizeText` | 97 | 99 | FunctionDeclaration |
| F2645 | `toWordText` | 101 | 103 | FunctionDeclaration |
| F2646 | `matchesAnyAlias` | 111 | 120 | FunctionDeclaration |
| F2647 | `(callback)` | 116 | 116 | ArrowFunctionExpression |
| F2648 | `(callback)` | 119 | 119 | ArrowFunctionExpression |
| F2649 | `documentSourceUuid` | 122 | 129 | FunctionDeclaration |
| F2650 | `promptDialog` | 131 | 170 | async FunctionDeclaration |
| F2651 | `(callback)` | 138 | 138 | ArrowFunctionExpression |
| F2652 | `callback` | 153 | 153 | init |
| F2653 | `(callback)` | 161 | 161 | ArrowFunctionExpression |
| F2654 | `callback` | 166 | 166 | async init |
### [scripts/verses.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/verses.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2655 | `load` | 2 | 5 | async init |
| F2656 | `roll` | 7 | 19 | async init |
| F2657 | `speak` | 21 | 33 | async init |
### [scripts/weapon-quality-tooltips.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/weapon-quality-tooltips.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2658 | `weaponQualityTooltipKey` | 36 | 38 | FunctionDeclaration |
| F2659 | `extractWeaponQualityId` | 40 | 45 | FunctionDeclaration |
| F2660 | `injectWeaponQualityTooltips` | 47 | 63 | FunctionDeclaration |
### [scripts/weapon-readiness-hud.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/weapon-readiness-hud.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2661 | `WeaponReadinessHudService.register` | 17 | 36 | static method |
| F2662 | `WeaponReadinessHudService.(callback)` | 21 | 21 | ArrowFunctionExpression |
| F2663 | `WeaponReadinessHudService.(callback)` | 22 | 22 | ArrowFunctionExpression |
| F2664 | `WeaponReadinessHudService.(callback)` | 23 | 23 | ArrowFunctionExpression |
| F2665 | `WeaponReadinessHudService.(callback)` | 24 | 24 | ArrowFunctionExpression |
| F2666 | `WeaponReadinessHudService.(callback)` | 25 | 25 | ArrowFunctionExpression |
| F2667 | `WeaponReadinessHudService.(callback)` | 26 | 26 | ArrowFunctionExpression |
| F2668 | `WeaponReadinessHudService.(callback)` | 27 | 27 | ArrowFunctionExpression |
| F2669 | `WeaponReadinessHudService.(callback)` | 28 | 28 | ArrowFunctionExpression |
| F2670 | `WeaponReadinessHudService.(callback)` | 29 | 29 | ArrowFunctionExpression |
| F2671 | `WeaponReadinessHudService.(callback)` | 30 | 33 | ArrowFunctionExpression |
| F2672 | `WeaponReadinessHudService.refreshSoon` | 38 | 41 | static method |
| F2673 | `WeaponReadinessHudService.(callback)` | 40 | 40 | ArrowFunctionExpression |
| F2674 | `WeaponReadinessHudService.refresh` | 43 | 69 | static method |
| F2675 | `clampWeaponReadinessButtonPosition` | 72 | 79 | FunctionDeclaration |
| F2676 | `getHudActor` | 81 | 90 | FunctionDeclaration |
| F2677 | `(callback)` | 83 | 83 | ArrowFunctionExpression |
| F2678 | `(callback)` | 84 | 84 | ArrowFunctionExpression |
| F2679 | `getOrCreateButton` | 92 | 117 | FunctionDeclaration |
| F2680 | `(callback)` | 105 | 109 | ArrowFunctionExpression |
| F2681 | `(callback)` | 110 | 114 | ArrowFunctionExpression |
| F2682 | `registerPointerControls` | 119 | 179 | FunctionDeclaration |
| F2683 | `(callback)` | 122 | 137 | ArrowFunctionExpression |
| F2684 | `(callback)` | 139 | 151 | ArrowFunctionExpression |
| F2685 | `(callback)` | 153 | 172 | ArrowFunctionExpression |
| F2686 | `(callback)` | 168 | 168 | ArrowFunctionExpression |
| F2687 | `(callback)` | 174 | 178 | ArrowFunctionExpression |
| F2688 | `openForCurrentActor` | 181 | 186 | async FunctionDeclaration |
| F2689 | `openQuickSwapMenu` | 188 | 260 | async FunctionDeclaration |
| F2690 | `(callback)` | 219 | 230 | async ArrowFunctionExpression |
| F2691 | `(callback)` | 220 | 220 | ArrowFunctionExpression |
| F2692 | `(callback)` | 239 | 249 | async ArrowFunctionExpression |
| F2693 | `(callback)` | 255 | 259 | ArrowFunctionExpression |
| F2694 | `positionQuickSwapMenu` | 262 | 275 | FunctionDeclaration |
| F2695 | `closeQuickSwapMenu` | 277 | 281 | FunctionDeclaration |
| F2696 | `closeQuickSwapMenuOnOutsidePointer` | 283 | 286 | FunctionDeclaration |
| F2697 | `closeQuickSwapMenuOnEscape` | 288 | 290 | FunctionDeclaration |
| F2698 | `applyStoredPosition` | 292 | 299 | FunctionDeclaration |
| F2699 | `hasStoredPosition` | 301 | 305 | FunctionDeclaration |
| F2700 | `getInitialPosition` | 307 | 319 | FunctionDeclaration |
| F2701 | `(callback)` | 309 | 312 | ArrowFunctionExpression |
| F2702 | `(callback)` | 313 | 315 | ArrowFunctionExpression |
| F2703 | `setButtonPosition` | 321 | 324 | FunctionDeclaration |
| F2704 | `shouldRefreshHud` | 326 | 332 | FunctionDeclaration |
| F2705 | `(callback)` | 330 | 330 | ArrowFunctionExpression |
### [scripts/weapon-readiness-visuals.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/weapon-readiness-visuals.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2706 | `registerHooks` | 17 | 40 | init |
| F2707 | `(callback)` | 18 | 25 | ArrowFunctionExpression |
| F2708 | `(callback)` | 26 | 28 | ArrowFunctionExpression |
| F2709 | `(callback)` | 29 | 33 | ArrowFunctionExpression |
| F2710 | `(callback)` | 34 | 38 | ArrowFunctionExpression |
| F2711 | `(callback)` | 39 | 39 | ArrowFunctionExpression |
| F2712 | `refreshAllIndicators` | 42 | 44 | init |
| F2713 | `syncActorIndicator` | 46 | 60 | async init |
| F2714 | `(callback)` | 58 | 58 | ArrowFunctionExpression |
| F2715 | `isPlayerActor` | 63 | 66 | FunctionDeclaration |
| F2716 | `queueCombatSync` | 68 | 82 | FunctionDeclaration |
| F2717 | `(callback)` | 74 | 80 | ArrowFunctionExpression |
| F2718 | `(callback)` | 78 | 78 | ArrowFunctionExpression |
| F2719 | `runQueuedIndicatorSync` | 84 | 91 | async FunctionDeclaration |
| F2720 | `isWeaponReadinessIndicatorEffect` | 93 | 96 | FunctionDeclaration |
| F2721 | `syncActorIndicator` | 98 | 140 | async FunctionDeclaration |
| F2722 | `(callback)` | 102 | 102 | ArrowFunctionExpression |
| F2723 | `(callback)` | 106 | 106 | ArrowFunctionExpression |
| F2724 | `(callback)` | 111 | 111 | ArrowFunctionExpression |
| F2725 | `buildIndicatorData` | 142 | 155 | FunctionDeclaration |
| F2726 | `indicatorMatches` | 157 | 173 | FunctionDeclaration |
| F2727 | `(callback)` | 169 | 169 | ArrowFunctionExpression |
| F2728 | `(callback)` | 171 | 171 | ArrowFunctionExpression |
| F2729 | `getIndicatorWeaponId` | 175 | 182 | FunctionDeclaration |
| F2730 | `getWeaponReadinessStatusId` | 184 | 186 | FunctionDeclaration |
| F2731 | `queueIndicatorSync` | 188 | 192 | FunctionDeclaration |
| F2732 | `(callback)` | 191 | 191 | ArrowFunctionExpression |
| F2733 | `getRelevantActors` | 194 | 201 | FunctionDeclaration |
| F2734 | `playReadinessAnimation` | 203 | 226 | async FunctionDeclaration |
| F2735 | `getActorToken` | 228 | 231 | FunctionDeclaration |
| F2736 | `(callback)` | 230 | 230 | ArrowFunctionExpression |
| F2737 | `syncActorCombatState` | 233 | 304 | async FunctionDeclaration |
| F2738 | `(callback)` | 250 | 250 | ArrowFunctionExpression |
| F2739 | `(callback)` | 274 | 274 | ArrowFunctionExpression |
| F2740 | `(callback)` | 275 | 275 | ArrowFunctionExpression |
### [scripts/weapon-readiness.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/weapon-readiness.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2741 | `registerHooks` | 16 | 19 | init |
| F2742 | `isEnabled` | 21 | 23 | init |
| F2743 | `getEligibleWeapons` | 28 | 30 | init |
| F2744 | `getDrawnWeapons` | 32 | 34 | init |
| F2745 | `open` | 36 | 58 | async init |
| F2746 | `render` | 54 | 56 | init |
| F2747 | `setDrawn` | 60 | 91 | async init |
| F2748 | `(callback)` | 66 | 66 | ArrowFunctionExpression |
| F2749 | `(callback)` | 70 | 86 | async ArrowFunctionExpression |
| F2750 | `(callback)` | 84 | 84 | ArrowFunctionExpression |
| F2751 | `(callback)` | 84 | 84 | ArrowFunctionExpression |
| F2752 | `(callback)` | 86 | 86 | ArrowFunctionExpression |
| F2753 | `setDrawnWeapons` | 93 | 112 | async init |
| F2754 | `(callback)` | 109 | 109 | ArrowFunctionExpression |
| F2755 | `isEligibleWeapon` | 115 | 121 | FunctionDeclaration |
| F2756 | `isDrawn` | 123 | 125 | FunctionDeclaration |
| F2757 | `buildWeaponReadinessDialogContent` | 127 | 156 | FunctionDeclaration |
| F2758 | `(callback)` | 131 | 148 | ArrowFunctionExpression |
| F2759 | `canAttackWithWeapon` | 158 | 165 | FunctionDeclaration |
| F2760 | `shouldBlockDrawnWeaponDeletion` | 167 | 177 | FunctionDeclaration |
| F2761 | `getWeaponHandCost` | 180 | 189 | FunctionDeclaration |
| F2762 | `getWeaponHandUsage` | 191 | 199 | FunctionDeclaration |
| F2763 | `(callback)` | 195 | 195 | ArrowFunctionExpression |
| F2764 | `(callback)` | 196 | 198 | ArrowFunctionExpression |
| F2765 | `getOneHandedLongWeaponIds` | 201 | 212 | FunctionDeclaration |
| F2766 | `(callback)` | 205 | 207 | ArrowFunctionExpression |
| F2767 | `(callback)` | 210 | 210 | ArrowFunctionExpression |
| F2768 | `(callback)` | 211 | 211 | ArrowFunctionExpression |
| F2769 | `resolveWeaponItem` | 214 | 221 | FunctionDeclaration |
| F2770 | `(callback)` | 219 | 219 | ArrowFunctionExpression |
| F2771 | `buildWeaponReadinessPatches` | 223 | 258 | FunctionDeclaration |
| F2772 | `(callback)` | 226 | 257 | ArrowFunctionExpression |
| F2773 | `updateWeaponReadiness` | 260 | 278 | async FunctionDeclaration |
| F2774 | `(callback)` | 262 | 262 | ArrowFunctionExpression |
| F2775 | `(callback)` | 263 | 263 | ArrowFunctionExpression |
| F2776 | `(callback)` | 270 | 270 | ArrowFunctionExpression |
| F2777 | `(callback)` | 271 | 271 | ArrowFunctionExpression |
| F2778 | `(callback)` | 271 | 271 | ArrowFunctionExpression |
| F2779 | `(callback)` | 272 | 272 | ArrowFunctionExpression |
| F2780 | `isWeaponReadinessChatEnabled` | 280 | 286 | FunctionDeclaration |
| F2781 | `createReadinessChatMessage` | 288 | 318 | async FunctionDeclaration |
| F2782 | `(callback)` | 313 | 313 | ArrowFunctionExpression |
| F2783 | `(callback)` | 314 | 314 | ArrowFunctionExpression |
| F2784 | `buildWeaponReadinessChatContent` | 320 | 330 | FunctionDeclaration |
| F2785 | `formatWeaponNames` | 332 | 336 | FunctionDeclaration |
| F2786 | `(callback)` | 333 | 333 | ArrowFunctionExpression |
| F2787 | `canManageActor` | 338 | 343 | FunctionDeclaration |
| F2788 | `bindWeaponReadinessDialog` | 345 | 370 | FunctionDeclaration |
| F2789 | `(callback)` | 351 | 369 | async ArrowFunctionExpression |
| F2790 | `syncWeaponReadinessDialog` | 372 | 385 | FunctionDeclaration |
| F2791 | `setWeaponReadinessDialogBusy` | 387 | 390 | FunctionDeclaration |
| F2792 | `clearReadinessWhenWeaponBecomesInactive` | 392 | 414 | FunctionDeclaration |
| F2793 | `preventDrawnWeaponDeletion` | 416 | 422 | FunctionDeclaration |
| F2794 | `isLongWeapon` | 424 | 426 | FunctionDeclaration |
| F2795 | `isShieldWeapon` | 428 | 430 | FunctionDeclaration |
| F2796 | `getReadinessFlag` | 432 | 435 | FunctionDeclaration |
### [scripts/weapon-wrapper.mjs](https://github.com/Crespo767/symbaroum-ind-resources/blob/9ef05078ce3d5acfd602314d83756ef1cbd2cd7b/scripts/weapon-wrapper.mjs)

| ID | Função/método | Linha | Fim | Tipo |
| --- | --- | ---: | ---: | --- |
| F2797 | `patchWeaponRolls` | 16 | 120 | FunctionDeclaration |
| F2798 | `wrappedRollWeapon` | 22 | 109 | async FunctionExpression |
| F2799 | `(callback)` | 80 | 80 | ArrowFunctionExpression |
| F2800 | `tenebreRollWeapon` | 114 | 116 | async FunctionExpression |
| F2801 | `isSuccessfulWeaponResult` | 122 | 129 | FunctionDeclaration |
| F2802 | `(callback)` | 126 | 126 | ArrowFunctionExpression |

## Conteúdo adicional indexado

### Macros reais

1. **Gerar Miniaturas** — `(async () => {`
2. **Assim Falou Aroaleta** — `game.bithirmod.macros.thusSpoke();`
3. **Gerador de Monstros/PNJ** — `game.bithirmod.macros.generateNPCMacro();`
4. **Rolagem de Inspiração** — `game.bithirmod.macros.rollRollInspiration();`
5. **Eventos de Floresta** — `await game.tenebreResources?.bithir?.macros?.rollForestEvents?.();`

### Depósitos e transportes do Grupo

| Preset | Capacidade no código |
| --- | ---: |
| Carroça | 200 |
| Carruagem / Carreta | 500 |
| Canoa | 60 |
| Barco a remo | 120 |
| Barco de rio | 600 |
| Trenó | 150 |
| Mula de carga | 80 |
| Cavalo de carga | 80 |
| Boi de tração | 100 |
| Baú grande | 30 |
| Barril | 25 |
| Baú de viagem | 20 |
| Saco grande | 10 |

Valores são os presets encontrados; não declaram validação editorial das regras oficiais.

### Dados de importação de diários

- `symbaroumlore`: 15 entradas, 45 páginas.
- `tenebre-chronicle`: 21 entradas, 39 páginas.

## Arquivos auditados e hashes

A relação inclui runtime, conteúdo, testes e build. Arquivos temporários, bancos copiados, caches, logs e alterações de outras pastas não são parte dos artefatos de entrega. Hashes são do checkout, não da instalação online.

| Arquivo | Bytes | SHA-256 |
| --- | ---: | --- |
| .github/workflows/validate.yml | 443 | `4e5aebe8ae2bc8f6587390f0666eac7ca13b327b597e9e8c69e1396a52dfe58e` |
| AGENTS.md | 3639 | `4c259ed5e70178233a0451e65c2c54394f14f8b9a7023f696eb53d7be72829eb` |
| README.md | 52490 | `49a1f374cd17e4e31202ee43b5879b1789d6cbaac1741eb760c404de77462ca8` |
| SECURITY.md | 1590 | `e2a89f44743aa1bbb7f6f5f417824d2211ffb886bc391c344b6c08c7bd718aea` |
| THIRD_PARTY_NOTICES.md | 2060 | `f850711a825749878941f8b627f7eeb00d6a88b42e9ae956f9ebba0cd283bdb8` |
| assets/icons/hunger.svg | 579 | `0b854516225c8848c701a3d3954c5d792d553e8e2f4d9347ec0805567e3f5c22` |
| assets/imported/symbaroumlore/images/Mapa.png | 11446374 | `c15a0bff71595d0495b80f6a149ff8aa898e872b3c52843dd0bd30023c3bb997` |
| assets/inspirationdice/icd1.png | 18494 | `758a1ea8fefdce799ef5a50e2b2be20fe6ca18bdf7207a0c13ed4c57d8013169` |
| assets/inspirationdice/icd1b.png | 10132 | `b2f61726a0523370d0ef81612f23f8328d7159531a7b1de4b22296e232d2685d` |
| assets/inspirationdice/icd1d.png | 24629 | `f5ef6675206a3e2dbe3fcc4ced4be1a06d7806c5a60d121ff6576fe0a4374b0a` |
| assets/inspirationdice/icd2.png | 20068 | `9e1a72994424554c780aaaf7652851c488aed0c933b56d58a7080435c85f5b3b` |
| assets/inspirationdice/icd2b.png | 10273 | `2b73a97fee2bc43a0df82847a7fa20ba7f1daeeba8dc263a3411c094d9841b10` |
| assets/inspirationdice/icd2d.png | 26047 | `ae107907aee180010371eecd0e949cad41abc183f29db86972b7e371def85d53` |
| assets/inspirationdice/icd3.png | 17282 | `c9e7c564f491af3e2556a8581cfabe1e753e6a145c4580a562c78546ed940c41` |
| assets/inspirationdice/icd3b.png | 11811 | `bcd86c6d164089f81ee8339c871955e58e00223956bbedc61ddbb55e5767b37b` |
| assets/inspirationdice/icd3d.png | 28346 | `9145d5e2ebc927906488c5988874451c64983c187ffcf56aafe29d621d7935ea` |
| assets/inspirationdice/icd4.png | 18015 | `5a8d2e4ea967b9c68a3ee4b826c9c1a6f4ec463b3677c27aced0fdc1027b21eb` |
| assets/inspirationdice/icd4b.png | 13697 | `91374ce5d0a78dacd8d665e9f6ce2b35f3dfcff28577468886dc3b9819033514` |
| assets/inspirationdice/icd4d.png | 23869 | `e6d34aa5ed53d32413963033e5ca46c3e7719793690b28be5ac0d263c173d29d` |
| assets/inspirationdice/icd5.png | 9752 | `7322315373fb37e80a3aa1df61a0746e942d36f237fdfbcc9075fdfb93aa5f68` |
| assets/inspirationdice/icd5b.png | 4391 | `9d06b367869f9f1fa05624005af6ec6053104edc379569e10f5219de13b7a409` |
| assets/inspirationdice/icd5d.png | 11309 | `5bfd26dfba2a6c2aa7c27ac7d4815ba0e8abd918c56095fd62581fe32e30a779` |
| assets/inspirationdice/icd6.png | 22727 | `4a45fe7911ada93d6b771f9fd35f029ff0323b0fa0d92bdc0cf16c2e2726ba0a` |
| assets/inspirationdice/icd6b.png | 17331 | `744cb32c7ffd619b655c1225a30949c6dbb95b00bd0d1ffa9b6705925a038145` |
| assets/inspirationdice/icd6d.png | 30180 | `adf177950e1fde4f83accf5ad159d71c3b3cfe4150d4e3a77447828d47adc707` |
| assets/inspirationdice/ied1.png | 23183 | `78a4dd8161913582fa57a7d35160152bd6b5be9394bc58eabbe55dbbb2b784c8` |
| assets/inspirationdice/ied1b.png | 11179 | `0a9e188c573fae9cc8dd2cbd416d762f1b14f11c69e07c14cdb11fb8d92cc4a3` |
| assets/inspirationdice/ied1d.png | 13795 | `3a1674bbc91b42eb1102ba36cbf3a91171fa51510d288c3f428e79d1725c9b39` |
| assets/inspirationdice/ied2.png | 32522 | `b01254ead81bf0e92e7d339ccf769b5ae204a23c46259a8fedca1ebd7bf4b403` |
| assets/inspirationdice/ied2b.png | 11286 | `44ca815b114a741ec5a33b3ffb4691b1317de20139fb422831639c0ff140891e` |
| assets/inspirationdice/ied2d.png | 14362 | `0e734268d2581103c25458f35c5d21660b4d56b598aa46d0d2dfda19e3fc9ed2` |
| assets/inspirationdice/ied3.png | 20350 | `b842879d4aa171759214be2f41ea3d04f4176b09beae7beaa18e3bec42a591cb` |
| assets/inspirationdice/ied3b.png | 7391 | `41771dcebc724a980dacc88e4b11776075ad1132011e5791637844c16e9fab42` |
| assets/inspirationdice/ied3d.png | 10781 | `14cc9cbda6ee3bd57ecba6b651d0b0a105a05810f1956c595b6e0069085f9c18` |
| assets/inspirationdice/ied4.png | 18725 | `94aaeba9893a3f77290ec5cbaa1fdc83e06eecb0f915b18ebfb7cb0d3072e632` |
| assets/inspirationdice/ied4b.png | 7285 | `4b34e12dd99e2bd85decf08c63364583dcd3f190197af613dbca3cb9c701d111` |
| assets/inspirationdice/ied4d.png | 10395 | `834ce14093feaa13368d21cffa32b1dcfedbdd7d5b51b7fab0f88c01b7ef0629` |
| assets/inspirationdice/ied5.png | 18128 | `2a8d27995f4e4636f21c51acd154b96df4cc84b5150f6fcf18ad93d330cffdb6` |
| assets/inspirationdice/ied5b.png | 6805 | `ed3d0c7e20984b30c906520abc0ffead4cfdfe38563d16fa4147184eb975db98` |
| assets/inspirationdice/ied5d.png | 9799 | `a98b8163394ef8b05a9b11c69299dc00050d21af037eec5d9cab5b41826c138c` |
| assets/inspirationdice/ied6.png | 24013 | `7447a5c4e56eb40413b8dd0a78e47b0c356c7874ecdf61500f7086e424f5900b` |
| assets/inspirationdice/ied6b.png | 9556 | `cb17fb525df7fd56f94bc360bf3f6a31f493049ff48602f502adaef0cc83568e` |
| assets/inspirationdice/ied6d.png | 11071 | `6b0bc1984f3cb326c4090b705a18f15dff971921f2724bbaa88f3b833f629822` |
| assets/inspirationdice/ild1.png | 24425 | `88ef2a787cd9508a4502d177f5647b61672eab7be7c091af57e187cc3cc1118a` |
| assets/inspirationdice/ild1b.png | 24726 | `94f91d6f69397133d0b3a9045de052c9b675100bd532878ee515876a3cac741b` |
| assets/inspirationdice/ild1d.png | 14643 | `25ea3b2b639f4944ef2ee90f503991c66b774b96e6015658c9efec6c0f5d1bf7` |
| assets/inspirationdice/ild2.png | 22519 | `2e35727d580b1f94ec4589d126467202614b4b6b30efe03e2b9db8e1d03acad0` |
| assets/inspirationdice/ild2b.png | 17041 | `90b20a065db5d9b7bccbad3c6c2b8dc9d16faaffb820f898ed07ebce214ba01f` |
| assets/inspirationdice/ild2d.png | 11462 | `ea1872b8801351aebb9929d71dbd9ce63b3e6b59b763295dbcbcca0ccf95fed2` |
| assets/inspirationdice/ild3.png | 11871 | `53a959eb224b56ebc56dee85ad3f2cf2014d725c1f7a800b9cc933b703a1f84a` |
| assets/inspirationdice/ild3b.png | 9579 | `a82ea31ff2c4b87b758a4e12730ab230a170706530ee75d898eb277f728b600f` |
| assets/inspirationdice/ild3d.png | 6182 | `58518c6818716d818d22397c7f9df6063453dae787d7efd7375831c3c96d7908` |
| assets/inspirationdice/ild4.png | 19404 | `d8ad214e7a0dd5c5f7de5f6785b97290a0360d612e81d8661830760b2b7c5970` |
| assets/inspirationdice/ild4b.png | 13045 | `dc3598d11528ff3d2ea262c4b2964b161aa999b6dca3fbe2c655d445dd14038d` |
| assets/inspirationdice/ild4d.png | 9789 | `a1beed72ae0854a55ff3b9a3596c7ebac126069e013bdd752debfe81f6c0388f` |
| assets/inspirationdice/ild5.png | 17155 | `cf941ae058eb47d4c3e3a46c2ef8b23e0fc5910665404e8b5f197968a0927e5c` |
| assets/inspirationdice/ild5b.png | 12340 | `f104c2ca007043404d3cdd124044c514e46dc3e1e4cb47029d4e3c8daeb9e04f` |
| assets/inspirationdice/ild5d.png | 7932 | `064ad096c9626962d5dcfb52df0da8b99cf747ff4b4dc8d794765f68540d8f44` |
| assets/inspirationdice/ild6.png | 31919 | `86e6b8dd75f05172491f86c807bb5912b128bf66aca660aebb36b52686405999` |
| assets/inspirationdice/ild6b.png | 20074 | `0cefa64304da8c3d8797555680e11a472e4a9e9319dfb6c681b36e3a2023af1a` |
| assets/inspirationdice/ild6d.png | 12822 | `af7960233dcf3ba112957408ebea7f23d0d2d014c0828f41723530ff5059a8cc` |
| assets/inspirationdice/inspirationicon.png | 41160 | `45d0f84e6bcd12bec30080d8439149a78b1267ea699ad6546edd90332ab880e6` |
| assets/inspirationdice/ird1.png | 31829 | `023c0d12b2ff00bd1c930a750f2e3b002965e093de6c0addebecdca26ba65443` |
| assets/inspirationdice/ird1b.png | 12899 | `e17e1f2214b01350436c54c8276cb012b1e6bc9b3b1c965d01f3e5d5d03e7791` |
| assets/inspirationdice/ird1d.png | 19243 | `cefd4d87498f3ef821ea2451015b038915502feefc3021e686c4917df86b4f2c` |
| assets/inspirationdice/ird2.png | 37094 | `4a6a3d407b4e1d9b5ca494f91e5518cf514cec0edc4e08a3339c25174e541c1a` |
| assets/inspirationdice/ird2b.png | 15047 | `382faeb491c1133df13c405106435a335856841cae5431f4d863ecc47dc111b3` |
| assets/inspirationdice/ird2d.png | 22264 | `63fdfd8ed05297ee564001dcbf86cb7867e4de59882882ae4b492dc482e0fc22` |
| assets/inspirationdice/ird3.png | 22053 | `9af97ca03e50dbaf30371df012a5fc8fb56e084153690868874c6132b9ecc3d9` |
| assets/inspirationdice/ird3b.png | 8427 | `32d51925248d184560e63e4de2046c044e37b90cf6d2761e1d13e26036bc065c` |
| assets/inspirationdice/ird3d.png | 13584 | `794e4dc6d2e44fff76bc9cd0c0aa944814b9c931c61cc70b91b5900dc9213e6d` |
| assets/inspirationdice/ird4.png | 29925 | `95f37cbbdb137b60a53cf4a0aca7c0f4321992bf2b7eb0876176b95546ba23c6` |
| assets/inspirationdice/ird4b.png | 4506 | `adf135807ea4d7e10f650953a92241eee49132f32b24654d57efd3e1cead2bb7` |
| assets/inspirationdice/ird4d.png | 15676 | `14e764f1df7dee10e82d4e47ec1f6adda49018cd471801f567813cd76e188183` |
| assets/inspirationdice/ird5.png | 27816 | `4942d1407d7bd8adf760ee1d59d29c8b2e7d6de51df9e00ecb53b87b4adba009` |
| assets/inspirationdice/ird5b.png | 10353 | `44df94d287df07fb967d4e86c8c23b625f3062f7581fa81b9cbb371fd1994063` |
| assets/inspirationdice/ird5d.png | 16350 | `4c1f4f7802b1cd9e294031168725389be7c88bf083f18326d63b2b6b812ea86f` |
| assets/inspirationdice/ird6.png | 22377 | `d2c616b36e5357cc54ecd1f85f5b14b0834579033a63211c5de5912418493d3e` |
| assets/inspirationdice/ird6b.png | 13113 | `f9c00ae72a33d8a559ae93ec8e8fd67a4e8b9afa2131f045a03653313e8c05f5` |
| assets/inspirationdice/ird6d.png | 18602 | `b9c2a6f25cb4695e48ddbcb07288b40511531c9d7da2dc4e6037b020c1e312da` |
| assets/midjourney/non-paid-scenery/Kuffer_cave_entrance_inside_a_forest_with_a_skeleton_on_the_flo_0549f718-606a-4931-a6aa-35135ef27127-banner.webp | 53706 | `2b1570033f1f7a90050e13a58ca43251a1071a234dd7b0364ab97d04c9843c12` |
| assets/midjourney/non-paid-scenery/compendium-banner.webp | 6358 | `15f6057f522a808e2e29b33b71a8f44a44a10a7dd8e7a68b6c82740cc45831ac` |
| assets/midjourney/non-paid/Screw_werewolf_mid_transformation_John_carpenter_the_thing_ultr_03cf7cc6-187b-45f1-b9cf-37d81736b985.webp | 143248 | `dd3c4f13503c4fb17728c478dd726dacf24299da56fefb6367aacfb6db3a937d` |
| assets/midjourney/non-paid/Sean_prehistoric_dinopunk_temple_priestess_bone_jewelry_junglep_4a491f21-2391-4d48-9a5c-851ab10e978d.webp | 26768 | `3cc031c49acacaac3708b953764017c5245c541fd94dd4a87edfa41deaeece4b` |
| assets/midjourney/non-paid/Sean_prehistoric_dinopunk_temple_priestess_bone_jewelry_junglep_b37e6b08-0cd2-4477-bc88-45a546885b3b.webp | 31468 | `2d1c29658d194c57a4c2443092ce86e4b46f6653a98660045cfc9f88c6a84543` |
| assets/midjourney/non-paid/SugarSniper_dark_skeleton_leaking_black_smoke_wearing_dark_cloa_c815221e-b2ac-42e2-afbc-1c5591e26f58.webp | 68154 | `987e2ef15b49ae94dbb85b889c9215e4115c2bdc97bf9596d28439a9a877bf37` |
| assets/npcgeneration/abductedhuman/feminine/Les_Dudas_Byzantine_woman_dark_fantasystyle_of_Symbaroum_style_2bac7763-1a39-423a-ba89-4c1ebe5bf4fa.webp | 72906 | `59452b11b156f85b3a2e1c27f1c12e15c677b4c648d376bf9ae3e5172ccaf48a` |
| assets/npcgeneration/abductedhuman/masculine/Les_Dudas_cultist_man_dark_fantasy_style_of_Symbaroum_style_of__415b46bb-6c12-4ee7-8dc0-a30508222371.webp | 83106 | `bc9bfe96fbe6802dcacdf64b6f6a7223abf6f72df798b73f8f2250c62a8833f2` |
| assets/npcgeneration/ambrian/feminine/Les_Dudas_Byzantine_woman_dark_fantasystyle_of_Symbaroum_style_2bac7763-1a39-423a-ba89-4c1ebe5bf4fa.webp | 72906 | `59452b11b156f85b3a2e1c27f1c12e15c677b4c648d376bf9ae3e5172ccaf48a` |
| assets/npcgeneration/ambrian/feminine/Les_Dudas_black_woman_dark_fantasy_style_of_Symbaroum_style_of__23e998ed-52b5-4d3a-b0e4-c2d164ea9888.webp | 89322 | `007651bf6d427b8c3e64159f15ab1c16b0e656b7217a02d36d6ce5e5d8e1348a` |
| assets/npcgeneration/ambrian/masculine/Les_Dudas_black_man_medieval_rogue_hunter_dark_fantasy_style_of_a4537129-f6ea-4b6f-bd8f-25ae87fab025.webp | 45028 | `87b5a049eb434dc39f22205267a176746cf6d079c84d18f93e3e2b83c23e041e` |
| assets/npcgeneration/ambrian/masculine/Les_Dudas_cultist_man_dark_fantasy_style_of_Symbaroum_style_of__415b46bb-6c12-4ee7-8dc0-a30508222371.webp | 83106 | `bc9bfe96fbe6802dcacdf64b6f6a7223abf6f72df798b73f8f2250c62a8833f2` |
| assets/npcgeneration/barbarian/feminine/Les_Dudas_Celtic_woman_dark_fantasy_style_of_Symbaroum_style_of_8316ade4-b2fb-4cde-818e-a6e1805601e0.webp | 91254 | `9ff3fecf76a5b852da99ca7267c6e4e97b8a420b2a127805909d569a6591ffde` |
| assets/npcgeneration/barbarian/feminine/Les_Dudas_black_woman_dark_fantasy_style_of_Symbaroum_style_of__adf2bb49-4023-4ec8-973c-098322efa892.webp | 79392 | `ccba58bac3f8a2c8fd31999c188b2db4416d30ddf01099d5789ef1831e38e07a` |
| assets/npcgeneration/barbarian/masculine/Les_Dudas_Celtic_man_dark_fantasy_style_of_Symbaroum_style_of_m_08fe5326-d7ef-40d5-b702-3b71246865c8.webp | 130468 | `2e1d7bfd5edfbd5c654fe585202745f2a5de624470ed0b8321e2b04379447b81` |
| assets/npcgeneration/barbarian/masculine/Les_Dudas_Celtic_man_dark_fantasy_style_of_Symbaroum_style_of_m_cf5a10a1-e7e0-4b29-ab86-e2801e4e8b7a.webp | 168470 | `520908d9c215812c43e8af798fe9e077d53766360af7e2feaeed3d17d2838c47` |
| assets/npcgeneration/dwarf/Les_Dudas_elderly_halfling_hairless_rune_tattoos_grey_skin_male_5eb2d8c1-30ba-46c3-8f5f-ef34bf1193b6.webp | 57522 | `ca014ae602a2e213ef351222048f380de2298e1c287711f97a0a2691220c4e76` |
| assets/npcgeneration/elf/feminine/elf_d.webp | 72934 | `2918e56fd58e828d62b4922b47d74aa8166f5bcc2d05271cbf85d549c08faa2c` |
| assets/npcgeneration/elf/masculine/elf_d.webp | 72934 | `2918e56fd58e828d62b4922b47d74aa8166f5bcc2d05271cbf85d549c08faa2c` |
| assets/npcgeneration/goblin/feminine/Les_Dudas_elderly_halfling_hairless_rune_tattoos_grey_skin_styl_366240c3-a1be-4b0f-afc0-4eb2eafc8032.webp | 100194 | `8bfc86cce5a2ade01852e311d60bd9253498429921ebfb7221d42bc85b7c5f54` |
| assets/npcgeneration/goblin/masculine/Les_Dudas_elderly_halfling_hairless_rune_tattoos_grey_skin_styl_366240c3-a1be-4b0f-afc0-4eb2eafc8032.webp | 100194 | `8bfc86cce5a2ade01852e311d60bd9253498429921ebfb7221d42bc85b7c5f54` |
| assets/npcgeneration/symbaroum/Les_Dudas_forest_man_dark_fantasy_style_of_Symbaroum_style_of_m_15707767-a055-4d24-9ff6-58a8f16c35d0.webp | 113122 | `219395ec5caa575d4be61c22b7aba4a3fa09b9be37dc8ebb603c240351de1896` |
| data/abomination-generator.json | 33837 | `3bd1375dd3772ce2033202c328b82845b2b2d5b6b2b31ecb7eca9aaab3cffbfb` |
| data/ambrian-generator.json | 55773 | `18fc95c249f48a0dc763588d9124323b4c9c87889c95edf303dea8bb4b4f9a9a` |
| data/aroaleta-verses.json | 10118 | `3fc26fd11fdae5eb5a7f4456f214264c66e9280a79178c322ccff9b85d9a14e5` |
| data/barbarian-generator.json | 52280 | `a87155fa2330d8168659e5c9be4df499715bd788b000faef4cca2360ca8196c5` |
| data/encumbrance-weights.json | 19275 | `34bbe844fba6801d0e74fbabdefa2a2d128dd4bf3cad949e2d7b021074e8fd03` |
| data/equipment.json | 916 | `b5e7115efe1dd114e76f006617b1ce135d76e6dafe7f02b818e1c539ab75255f` |
| data/forest-events-pt-BR.json | 21800 | `30189c1a74cbcb751852111c4f0a1b6043532a4b31ae4cdd491ec6f777b14765` |
| data/journal-import-manifest.json | 196118 | `ac85994a92822a599b7ef684c98032d892311b831c623b14a9611bea66742472` |
| data/rituals.json | 12022 | `aac05f7e6fa189384c18ff3d330dd9a8e40141ce345534e3fc501139a9b23316` |
| languages/en.json | 99915 | `2f6e4f6516f8ec9d3970d282bf895f5749874c40c053f0cf8003e6192e35f7ad` |
| languages/pt-BR.json | 107262 | `ad33f3e911b9835ae172f0d32743b186fa6ca23d4057d99c0299245a7c4c635a` |
| licenses/BITHIR-MIT.txt | 1096 | `0cd5cb475656eacf2a0b8577f01e711fbbc61004ebf2cc9937ce3e2fe3d82fe9` |
| licenses/simple-calendar-MIT.txt | 1140 | `9ace29cc1dc0296520902306d2fca7ca645ddc74b75accd7a8fe7363b43b7a27` |
| module.json | 3069 | `98e5ef69c3de850fad4ad2e4f1a1c577bb93e9b0da0176aaf3d015698fe8b35a` |
| package.json | 326 | `1c311e5a76b85eb9f56fbfe71748a7108a13644abb80a45769669d00c0b48cf0` |
| scripts/actor-creation.mjs | 986 | `ec9e33434b00759803cbc7b5e0277079504632d3192088ffe444eda6bb097ab9` |
| scripts/actor-preparation.mjs | 2314 | `bc785d797ab6ce05064ff8c2bbd6fd35b69c57b645a4b626f19e266354b519a8` |
| scripts/actor-references.mjs | 1251 | `ef92273abff741a186eeaa116e1cf0665e8d8dbe99e720211c16d9ddff6166dd` |
| scripts/ammo-roll.mjs | 3334 | `4f473e2a1a1cd0d427eab0ee554ba1ef72ef5f5d76257e7e7522e9edd7548dee` |
| scripts/ammo.mjs | 27510 | `103b41d8d21987555ec1aa20dfe9dd9eafeb9e752c3baaa10fcdd73ab73445f3` |
| scripts/berserker-chat.mjs | 22707 | `34abd4053c1989184e76e93a42ba10aa9b0558253c008c0954e92ccbad269298` |
| scripts/bithir-macros.mjs | 51312 | `4d94d49b4edc6a4fe219c634b88aa04baaada579a7aa82abdc80427a54c22355` |
| scripts/calendar-chat.mjs | 1760 | `23850e6817c7ae1ace28335c562bdcb1bbc1575a7359e3029c61006ba982b3bb` |
| scripts/calendar-configuration.mjs | 9151 | `35569be345b3738e03807723857435b06926a4155f02f3b4f898bd05c8e8d05c` |
| scripts/calendar-date.mjs | 5448 | `c6cb8f17ce75997fbda2c2c47bcf96666ea8f070e521cc462ea535bc322b7499` |
| scripts/calendar-experience-view.mjs | 10396 | `c13ed259e194c28491c6db2eb5006929f6808f26f6193f9d41a662c3f27f1397` |
| scripts/calendar-options.mjs | 6978 | `9b1149fe4d7c7af63e8c8ae5cfa031ff3fc88b7b96648ef123beb2be756cb4d7` |
| scripts/calendar-runner.mjs | 1926 | `67b7f87b9e9d151d09cbe080e1bf132c43dea18d950b282d523428e84c468ece` |
| scripts/calendar-view.mjs | 11889 | `fb375cb6ab44e35f17c4d9a3ed551f1de907d3f6d5051e4ba260672f7c5f054b` |
| scripts/calendar.mjs | 32429 | `69751faafc3891b2c6843498d4ac5540bdc907ec6d0a48180346dbfeea29dc4d` |
| scripts/chat-controller.mjs | 562 | `df37d5e9aa935a67fe5208ec4f4881387918d9dc8d5b25748129f16b95be9f5b` |
| scripts/chat-item-use.mjs | 7624 | `e19b21ea2b9e2cc2ff0220feab2c34068cb9236853536ff963dd9b0f538d78e1` |
| scripts/chat-original-preview.mjs | 2985 | `5ac9388df3a63843f88d8be517799baad0403b80fef3edcefb53afd9cf8ceb53` |
| scripts/compatibility.mjs | 17708 | `c43bee73ce70b1ff56d67bf7ba2918c7015f75e3e2bddd3459fc8f70fcda7393` |
| scripts/constants.mjs | 11422 | `7e5054c7116ed3cce388d9d097da93b753055ae590faebd188e9a5eea45dfdc5` |
| scripts/container-transfer.mjs | 24693 | `5db3f9f15c96ad5b9dcd97333494fd4ddeb563a15bf064926c904aad5d61a3cf` |
| scripts/containers.mjs | 44426 | `22f88a2f67c96f52b3dc89058929a4ddb4986719931a7a74188cf35398b05499` |
| scripts/death-automation.mjs | 29647 | `0f2edff9a03af2acbe28072e8f446dd68e2b54b532e192cb9f4951d6d0d0b804` |
| scripts/dice.mjs | 4461 | `be86e1d54099013184c13a1508f1876ef2232154f5324986ecca5e958fad8c9b` |
| scripts/encumbrance-db.mjs | 7613 | `110966ec67cdc748b78078483c19a615a10f4137de0e74aa6fcacf923f157d95` |
| scripts/encumbrance-visuals.mjs | 5086 | `f5848f5af897663fb1f5720049823ef5d78b7c092dbf3603f3c0067fe4a4b3af` |
| scripts/encumbrance.mjs | 18288 | `d95e9c215d2e4474adbd077a1c37654ff47b2ff235fd45e9f182ec1b2d232e43` |
| scripts/expedition-calendar.mjs | 4923 | `348412826a2097606482a03c9c9d9062ea91720c3ed81af9e6ab044846b1dc3b` |
| scripts/expedition-data.mjs | 13939 | `eb33b12b879961b765731246ebd62d2edb90320774cf38e3046e480a9e0d81ef` |
| scripts/expedition-orientation.mjs | 4158 | `a1ac178be50b32ddd01587415b0d5993baced3035ec6bdfcf006695d69bc8f47` |
| scripts/expedition-private.mjs | 5597 | `e94b9dfe6aa3b17ddc276814b6380afd1d6b08dd8c9e154aea2c58200d1899ae` |
| scripts/expedition-state.mjs | 4117 | `e5892972382467fc762ccae0e4c02859bdbd1f7057c70c0404b3a9e390b18271` |
| scripts/gm-log-events.mjs | 9803 | `23b7f6177084833695a3f3a0015662885b5e05acecb4a431b897bfa9ad165f61` |
| scripts/gm-log-message-adapter.mjs | 16327 | `b2fd86408ccb27ea1939ba7a0f1093bb8f3aca15b3b279d15daf3047514b1eb1` |
| scripts/gm-log-service.mjs | 8521 | `27fec0a4566111c148ef2aad8a707214e38671c47083e315399c6fd021dfd546` |
| scripts/gm-log-ui.mjs | 10483 | `f10eecfb9f4b21932c76eafca3fee49c2b0a11647767acbd2c1c47a593c85e73` |
| scripts/ground-containers.mjs | 20828 | `ca2f7ca9ad0b356adb476371044eaf2a6cb99e340d4d6b669f32c2c58bbfec51` |
| scripts/herbal-cure-rules.mjs | 2225 | `d1e7d8091b7600630d51be30c0405a9017a65c45c1579b1062663d739714cead` |
| scripts/herbal-cure.mjs | 10711 | `8b2f00c76d613d66b38dde4906c769966bd687ff243fd4aae588877f305b1b5b` |
| scripts/hotbar.mjs | 8295 | `efd356191b4611d2db442a86f4bea0a8d95031560c5fec47e5949aed4af75dad` |
| scripts/hunger.mjs | 9748 | `79b84cd99765d991ecf3a2116a8f669b16b791d19bde149cca501904f431a073` |
| scripts/init.mjs | 28800 | `6ac640f11f14919f91eeeef32e490d898011898d7f3372a5779abad92a0f8a48` |
| scripts/inventory-cleanup.mjs | 3103 | `590e184b7be91ad2f0a2291768e5c2c1cb8b5170efa6cd6c51249a6bff6a2247` |
| scripts/inventory-default-state.mjs | 2405 | `ce943da845efed6a04c6a63b98930a74ecb16aff802bd7994cef2d96eec475c5` |
| scripts/item-flags.mjs | 9271 | `fb28585f14f87f38317c503fa038b455aa946fa26fe4e447c600a34baf082830` |
| scripts/journal-categories.mjs | 4933 | `cae3157c3727ecc5dc6b59081beaadeab422504b655d5fe8e04732ff0c290fcd` |
| scripts/journal-integration.mjs | 16009 | `699178998b8c48ed6cd4df0901ef3a58fd5677189afc2825af8eceb85972837f` |
| scripts/maneuvers.mjs | 55213 | `a315a7a25664371509f42c4a034623c2ccf1ab48b3a3b84de110308eeb9e3260` |
| scripts/money.mjs | 7269 | `be5002954b256653690c0e64dfcda5e357610c147c5e6ffd85d0ad55268d8477` |
| scripts/movement-ruler.mjs | 22271 | `eca2e97d734f22a8be4db67fb57c59a60df1fa8111f9d49b029099881d14947b` |
| scripts/npc-attack-chat.mjs | 25997 | `bcfa6575e49729cbc269d7374f62b8aa51a4e7c2c211a196fec133bb99448be2` |
| scripts/opposed-test-chat.mjs | 13935 | `a65953cd700f455ae26851fd1d466b6faa9673aaf5362a22661e81a0b1629423` |
| scripts/pain-threshold-choice.mjs | 18496 | `7aaea6963edf0996f22c4b4c2b0763c85a8b38bbeb9dec6a2e828d9599b25f10` |
| scripts/party-actor.mjs | 178976 | `6892e94ca5ca5171068d206264d346a3bb18d6686d6eadb2e4dcdb001af62bff` |
| scripts/party-search.mjs | 2707 | `82a7aa10854f4ffc13a241f542679e64e067bee9e85b08287686e401cabfc1b3` |
| scripts/prone-advantage.mjs | 3568 | `9a665388981f03aefbee63c8cae17847ab5c4ca997fe6988bd8b719290035afb` |
| scripts/rations.mjs | 18382 | `4f50bbd5921363cc89f6b10458a01f168525dc06a1348685100ffc103d66e826` |
| scripts/resistance-chat.mjs | 1772 | `d68ff5c2c59f4f1d2b298c25465f852ef4b336e7da138f9d1b0595ed324003ee` |
| scripts/rest.mjs | 10741 | `c1422c371b1f1eced20ae039f8221ff273a58ec6981ac907d5ada0cbb4daf362` |
| scripts/ritual-browser.mjs | 10035 | `e5c7279078bd4b90ec91f4f723416f3d490aba53bd85e664c36318a2c3afbc7e` |
| scripts/roll-context.mjs | 1274 | `ffef8c696be45ec8a9e696a7d8c793fc78302615498a3b6c8b2613d349fc29db` |
| scripts/roll-privacy.mjs | 5517 | `14175e557044514db58af08fbe0e6c332283a8d9c3aa9171fca381311f19181a` |
| scripts/settings.mjs | 42868 | `faf3dcf4aec8f2f77e89e825a62ec53558573401ef9a2318a26f3760ec0b5d68` |
| scripts/sheet-ui.mjs | 82028 | `25ce0da8a9479ce724c28665a92abfada8afbfae3a37c4a68fdfd82ffea6ad74` |
| scripts/socket-policy.mjs | 7839 | `e5d7ee91f8b980e68371240c639564df1263aaca2a07b01daa744dcd78c1a975` |
| scripts/sockets.mjs | 18842 | `199fabe9a10d28102609e90c14828ad559fdc35277101ed0bb64b7f2abed833b` |
| scripts/special-ammo.mjs | 9502 | `e8e83840e069e89cd3fd77936959a6181ddc8c35d557b3b75b107b0e9a0a3954` |
| scripts/stand-up.mjs | 14273 | `54dc70b12b5d53fec65b03fbbfd98e72ce9afc11aa1cb8ddc4579bbf44afa573` |
| scripts/status-effect-picker.mjs | 14122 | `ce683a4f4a0fa359e1e2af65114dabdb35c2215a4194504681c0de9f3ecd9237` |
| scripts/symbaroum-i18n.mjs | 1437 | `21c2252fe266ce7da317e92b206c1c6a4666592ee6cb5a01a7ae89a92b6d1f92` |
| scripts/token-action-hud.mjs | 5539 | `b6c971f2d3627b921cb68ee9b378e276d16bafd974672de3e141586598410d99` |
| scripts/travel-context.mjs | 4875 | `e548cc9292ede232718d96957a7b9d9cf503ac42f7ee9ef44407d0ee2e5334b0` |
| scripts/utils.mjs | 5850 | `6568a25133351c7955a3a5e4078ed89049933a6b4979721b4f681edd09cabe07` |
| scripts/verses.mjs | 828 | `51f0aa671199d9f5c8a78613d56fb124a37818201785d5bb16e141acfa152837` |
| scripts/weapon-quality-tooltips.mjs | 2994 | `94eab9a6ce30487c1e7c96cfa2b2300eae6edb0309eed78f751778ba43d802d5` |
| scripts/weapon-readiness-hud.mjs | 12340 | `1c3383ac2ba1faed047447d4f0786f00a6d1bb3235cec6d847d6f279d041c823` |
| scripts/weapon-readiness-visuals.mjs | 11736 | `58db2e4644d8c13d2dcbc70891a9541327e73477a814ba4b625843fc2db97b32` |
| scripts/weapon-readiness.mjs | 17734 | `2996037b049893dede783addd1aca5ec2b8d658b50a2cd8ff5106e978a4159d1` |
| scripts/weapon-wrapper.mjs | 4842 | `9633565dab9abf19186b1288ed6014a27d3692b755f64eb2fe8debe7836a66d7` |
| styles/calendar.css | 17947 | `ad90b07ba84ed07ecd9ff28e90a5535f0e1c4ccf6bcf8c291dd95ff04285a2a6` |
| styles/journal-categories.css | 553 | `9c96bd95363335cb07427aecdc636962f9fa6c8177cb8f54746dfe8e7ecf2c7b` |
| styles/symbaroum-ind-resources.css | 153090 | `3a3259bff6cfa7f7708e78eb0ded237b4d2d811dda5a96bd6b9e67ba74047b7d` |
| templates/gm-log.hbs | 1186 | `6668432bdc8f8831e3eb36dab9f488ec8d2072d18076a38afa767c20dcf08616` |
| templates/inspirationroll.hbs | 295 | `00d97a132b6844b4b47b5dd42dba972da93a18046207242a022c9aed698e5da2` |
| templates/party-sheet.hbs | 55072 | `56c3ff58c107095e69b5e7e505afbeec9b2e8347d042be37e584e4f11b43b02a` |
| templates/settings.hbs | 21000 | `2c4477ba6fa5452bbb09a36b103cbbf2f8264b7d8af07b21d47cecddd123846a` |
| tests/actor-creation.test.mjs | 2027 | `dfc56570c16816112477ea8277ab985c7495516b6e57f6350dae102381c12302` |
| tests/berserker-chat.test.mjs | 13189 | `d93b1df69c8a651b5cbb71cba30ef0d96ced5fb621d8b4f1faaa4bdd516c994d` |
| tests/calendar-chat.test.mjs | 2487 | `a724a596e11f7ffe00fbd5a4cfcb372bdc5692a7ea7ec6b8960e1f6d509267dd` |
| tests/calendar-experience.test.mjs | 8230 | `a2e3dde545ab00480a5541ed665f538f3064267734f06e0f2eb76179aaccf5d9` |
| tests/calendar-runner.test.mjs | 3351 | `8353df0dc6d6b4c3a53f681751c761565918e6497b5611bad348c1886197c9b8` |
| tests/calendar.test.mjs | 35704 | `fdcd11802a10baf0f82fa30edf7ece56e5a24d84237d291904a79e9151e1cadf` |
| tests/chat-original-preview.test.mjs | 1735 | `c1aa383e68feb9788a0e977c44f6c016760176548ff5888694dd493a43f8a041` |
| tests/cleaner-sheet-title-bar.test.mjs | 1753 | `d1f04c4f4791bc43be4c6f9ba59031a8fd08633fceaa16a27ab2aa305c24ba77` |
| tests/combat-fixes.test.mjs | 7322 | `243733366b3244ac3fce498a3635eae28548c9fb75f5b7524aa834949f2c3f9f` |
| tests/compendium-adventure.test.mjs | 2258 | `0a81f8906b27c1952b32172c3d844d5525c28af1b144acf5260e7e1a0ae1d5ec` |
| tests/container-transfer.test.mjs | 22975 | `d1252e169d49608bc1dfc5315b46eddf9b6509c5527c405fb91f8c8afebee8ec` |
| tests/containers.test.mjs | 24760 | `a823a3c312d726a2f1d6befb9c07f36bb308a568b6257a86008cb0a792db498e` |
| tests/context-menu-compat.test.mjs | 1400 | `374082643700b5a87edf53eb5cabc5da259b04275c83ced86b474d6d7b9bf8d2` |
| tests/data-protection.test.mjs | 6005 | `fa27a072ee06882471d74cac6e2d58afa433115b58b6076f7e0d0f4408421de9` |
| tests/death-automation.test.mjs | 7246 | `40a6ce80069394328f6f4542dce773725f362325b87765acc8ea3275d50e76f0` |
| tests/encumbrance-projectiles.test.mjs | 1415 | `5b6f739733ca6e9c539b60ba67d8df687447b05b7dc12540abb218186e3370c8` |
| tests/encumbrance-visuals.test.mjs | 5402 | `2e8b6bccc47995dd60320e3f0e6c92d1d5af5e3e3f8edb216b8a8b975de4a17c` |
| tests/encumbrance-weapon-state.test.mjs | 5719 | `5200e842272bbfff8b2209a1fedf7ff773a6a98bada0137b7a312fe5627f1125` |
| tests/equipment-chat-use.test.mjs | 1065 | `7bcc2431a2eb08bf48aa399b7a64c3eb6b05c22113e805886fc749401b2c5473` |
| tests/expedition-calendar.test.mjs | 13016 | `d0136859a2c1068b06ea2f83d7a468559e38003d9c4aa8bc5f85e8624058cc71` |
| tests/expedition-orientation.test.mjs | 10305 | `ea7c6685b9e611b0634e9cd428ae36abe4328ae3a674f0c07bab7d57457f1551` |
| tests/expedition-pack.test.mjs | 3624 | `16ad5c24b87ea74e21f1f4b61615e563be51d03bb2ba509b896a0984edacd91b` |
| tests/expedition-stabilization.test.mjs | 21367 | `5aeef1c0d7a596362b817d137d140dfea968b2b3f688ff9b3fbe2319d7f7ac95` |
| tests/expedition-travel.test.mjs | 3900 | `2a1025f5ed733a80fb30ee8fa9ca22a5b8ac4e09458e7cecd943b08a0489997e` |
| tests/gm-log-events.test.mjs | 5285 | `56a597228b60967eff5ae48566ee5a37c028eb756036d408cbd2d340cc9a2108` |
| tests/gm-log-message-adapter.test.mjs | 7319 | `caaea2a00beb283f17d80c7f0e10252d38da0f503dbf4c56c8f0cb21d2cd84a5` |
| tests/gm-log-service.test.mjs | 8887 | `632e5bc240299222d70883e6f0d78ee03f0bfbdad4d5083ba224fc704fe57950` |
| tests/gm-log-ui.test.mjs | 4849 | `3f82e022d106ccfad91213e2724bc836fc5260125d45a49c24a8f7646f4dad94` |
| tests/ground-container-isolation.test.mjs | 3375 | `bd5f505c81ef605e74dd9c0aa2a0f33f20eb627cbc96336b903da0fc0cd46b74` |
| tests/ground-containers.test.mjs | 8138 | `37ef6959bb9eb448e352fec29ae92211ba2d651640d09b0f5fe85e08acf52a39` |
| tests/herbal-cure.test.mjs | 4801 | `4357494f734766741fbba5b60df5c22422cd2e0646d7e3daf008ecddc82a249e` |
| tests/hotbar-quiver.test.mjs | 707 | `ef3aa05f8ba5f18ec7362253d4da7559db0e9d6b2d0b99a3f0c510b63734b795` |
| tests/html-safety.test.mjs | 711 | `ff901a15c20df4b4b41add8b4aed290d235ada6071320b2e70be0a48f2e33582` |
| tests/inventory-cleanup.test.mjs | 2081 | `df40215e3a7202b2f325219593b9a86c7da7836b7ad1a30d33d1f2b5e08522d5` |
| tests/inventory-default-state.test.mjs | 3973 | `11cff02939f64d0639777dafe887bf17aa56493d04103399cb91f97031ef48d7` |
| tests/inventory-icon-use.test.mjs | 3864 | `6ac83d2007d6de59e00edd42b3bf11f9a35d4f7cd2174aba9a86290773b8bfbe` |
| tests/journal-categories.test.mjs | 10005 | `916853d7737bbacd3ac504bb878c4a046cd25eb4688267a7d764943c7b594ba4` |
| tests/journal-integration.test.mjs | 5689 | `1c2cbf0ba7a8b81c0bbefd98a61483b56af0e3368867c01ad17d13f6cc5afef2` |
| tests/libwrapper-targets.test.mjs | 1519 | `585d8014b9eac78412116cefa410c66e75234837c7f522fabd1398299349ea53` |
| tests/lifecycle-audit.test.mjs | 5180 | `dfc671a410058e9eb05b3bf45e62ed3eca120ae152ef1ee764df5c3a1a2b5748` |
| tests/maneuver-automation.test.mjs | 3614 | `1d113dda6b749f54bdec0d97d9d5d35a02c9c55a89eee83cfd1faad9cf87bb05` |
| tests/maneuver-chat.test.mjs | 1596 | `ae428203cde6ab57261edb659329336117e522d9426d486b36bdacdb14ae3e78` |
| tests/module-structure.test.mjs | 4296 | `7c8cdc260ae04ad9060808b187c0b7d75ee729354e2c16de8223adb693bad166` |
| tests/money.test.mjs | 3800 | `63a1c5e280e379a99531fa0b17a5f135595f52c4aff80edfeb1d48bb85fe4bc8` |
| tests/movement-travel.test.mjs | 3902 | `e3fcb701687ca371938b0205d6fd833bb7bb60d837259fb609ead3a6c76d1367` |
| tests/native-chat-only.test.mjs | 5202 | `90a5e98901ac0607ae3cb454187ff667400fb49b3dae4fb62cba7f88159e2c21` |
| tests/native-roll-table-fixture.mjs | 1391 | `e6c94a9b3dcff0e704963b8e155f227ca018649a06a66c0c81bda4a40eb849f8` |
| tests/npc-attack-chat.test.mjs | 14243 | `cfb83cab1b6c3b2c98f84d22f37d90a7f9f92e6cae4ca05ed6a2815a8dc106e3` |
| tests/opposed-test-chat.test.mjs | 6792 | `32584de58e867eb3e379fd13f54e66b39fa8d03848ae60147193b68ea490f172` |
| tests/pain-threshold-choice.test.mjs | 10488 | `1d25b0a7c5860458a48db0f6b2c4f4afc222b3f0c3d0804bf3793a25ac968273` |
| tests/party-actor.test.mjs | 65278 | `22dd32b85fab81d372c477a5e84adf40eeccff8eaa77bf415499289a92a42735` |
| tests/party-expedition-access.test.mjs | 2377 | `17be04d6c1138ea933d6a114367591a885e3a0914d36c498d88bf9dd446a4e7d` |
| tests/party-search.test.mjs | 4811 | `c1d6293473ae73b6da031f688fcebbccbde9d798fc8c4846d66a4aa0e3b7e818` |
| tests/performance.test.mjs | 2131 | `d8311b80067e8c5601095d8339169847a19eb4610a3db0797543832aed0870d8` |
| tests/prone-advantage.test.mjs | 3637 | `5f4ca1345ab9c4e58cbc869dc60ad210b2cc7de023955a514fff34c4b377665f` |
| tests/prone-movement.test.mjs | 3023 | `9bf2b3bcf445e44aefbf9c82873dbe6c213a3b5b111672e3be0b79425f81782a` |
| tests/ration-authority.test.mjs | 56690 | `c3f442f1dc189276d0b711a1a9932e28b8bdb712eea200b12b8c85008470c084` |
| tests/rest-dialog.test.mjs | 3891 | `4a17492c236f4214c0848af10560e389fe52fb0b5f94c406f594424c5eaaa2ca` |
| tests/risk-fixes.test.mjs | 3903 | `0c786c81f81c4d346d06265721f0ed39f08c2194133310fdebcea370739b2035` |
| tests/ritual-browser.test.mjs | 4299 | `412b4a6f33e887112a8b446c92bc45ef9ac46199d382fdfe6973484a014cbe9d` |
| tests/roll-context.test.mjs | 2952 | `6986d294ef8c68dc9d31d48bc529ba78a39f58e4176f1fe9f38bd565139ae261` |
| tests/roll-privacy.test.mjs | 4224 | `50ddfcbb7d4a069bda39c5ecec403d5b6efa9edf7ee252c1b321ad3e9a8048f2` |
| tests/security-static.test.mjs | 3662 | `9b3cb4d07e846cd4d899e90b951d19f300d2bdac68528e018f9678ab1387cda2` |
| tests/settings-coverage.test.mjs | 5481 | `122600f3a824d0a0c73d7e023ba1db4f7328efb390b417b6d83d80d045b44bce` |
| tests/shared-helpers.test.mjs | 3863 | `37f8adef8bea37c290d38e9528f9f819ff673a5cc9aaaa32f75c004697fb1493` |
| tests/socket-policy.test.mjs | 4961 | `754a69a9e9e30682c369c3f80c9eb8986e90503d1f1b2c8d75909bb3e4c4e51b` |
| tests/special-ammo.test.mjs | 4044 | `ec407a7fe8ac43c5c46eb4fc6124459774fae634b9115d4b24d207f59f29340d` |
| tests/stand-up.test.mjs | 8479 | `3632ff885cc8fa5a3d3fc4fde0c419c3d8232a9a645511c1e0ebf647c023b393` |
| tests/status-effect-picker.test.mjs | 8627 | `848e1a34bbceefc7fa82657137e21e28dff9cc8ba9152d8b22c8eca673081460` |
| tests/weapon-quality-tooltips.test.mjs | 3218 | `88e02eb8ef3f847490af7c68dbb569d92033b1e1ce746fa2f343bab7cd472ce3` |
| tests/weapon-readiness-combat.test.mjs | 6082 | `ddc97e9c1aa1f2101c6f4c8fb8fb9632dfe7067b67f9a77e356bec424ad0aa42` |
| tests/weapon-readiness-swap.test.mjs | 9522 | `f2226bb75d40fcc0842148cfe8150d9ec2ae6f0e0001c0e54b600cff95f9e0a7` |
| tests/weapon-readiness.test.mjs | 17407 | `f27e013e6161e7e388385da45822a99aab0ec3b0d899afa022464526e6c829c7` |
| tools/build-expedition-tables.cjs | 1861 | `d3322f850bb821775dd0a7f4fc492aa4b44a14e6aff6a3590ea5efa7baaecf7c` |
| tools/expedition-pack-data.mjs | 721 | `22d0e6fcd52848b7e310f4ee542dfe0f62c0b6363c2662a56d1a6073cd3e1284` |
| tools/journal-integration/extract-local-content.mjs | 21121 | `7ede8cf94d5f728b5bc4c3b650c0cf2bd8c2197754e39fb0141c1bc924ac2af8` |
| tools/original-tables.json | 350986 | `468c1c135c7c28ea6a167cf7321925eace818b929837608e4710dcb54ef2c5ce` |
| tools/run-tests.mjs | 664 | `557df6b7132acf47d371523baf8f1982f284c37a64531e89923be0fde65cbdca` |
| tools/update-adventure-pack.cjs | 34320 | `95d568783441ecf78be0c4302bca7c0bb84be4441d063c79c3f8c049f77f92c6` |
| tools/validate-expedition-assets.mjs | 876 | `9a0031adf6e985245958859a9ae34d6fa5081b113e050d4c737df9b7432d413f` |
| tools/validate-syntax.mjs | 1161 | `c462c8ec9b5eb37bf38f8dce6913ff035225eefc4542375b3dceb45ebd55ab1a` |

<a id="validacao"></a>

## Validação

Executado em 09/11/2026:

- `node tools/validate-syntax.mjs`: **159 módulos JavaScript locais aprovados**.
- `node tools/run-tests.mjs` no checkout local: **700 testes, 0 falhas**. Inclui os testes das alterações locais preexistentes.
- O mesmo comando na cópia limpa da publicação 0.19.3: **686 testes, 0 falhas**.
- Inventário AST: todos os 78 scripts publicados e 79 scripts locais analisados sintaticamente e relacionados a blocos manuais.
- Consistência do roteiro/CSV/JSON: IDs contínuos, nomes e resultados correspondentes e todos os casos inicialmente Não testado; conferida por validador do artefato.
- JSON e paridade de idiomas conferidos separadamente no checkout e na cópia publicada. As quatro chaves locais adicionais de expedição ficam fora da referência publicada.

Esses testes incluem funções puras, verificações estáticas e simulações com mocks. Não representam 700 mecânicas validadas em sessão de Foundry. Nenhum dos **786 casos manuais** foi executado ou marcado como aprovado.
