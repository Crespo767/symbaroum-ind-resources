# Simple Calendar: análise e adaptação para Symbaroum

Data: 04/11/2026. Escopo definido pelo usuário: apenas Symbaroum; sem notas.

## Referência e cobertura

Referência: [Simple Calendar Reborn](https://github.com/Fireblight-Studios/foundryvtt-simple-calendar), versão 2.6.1, commit `5670bbe18f0516b514fff5ee1f19e394883701b5`. A árvore foi obtida integralmente e inventariada: 74 módulos TypeScript de execução e 68 arquivos de teste, além de templates, presets, estilos e documentação. Foram mapeados imports, símbolos e dependências; os fluxos centrais de data, relógio, interface, configuração, permissões e sockets foram aprofundados para orientar a implementação.

O inventário não é uma auditoria de segurança linha a linha nem certifica equivalência de todos os caminhos da referência. Os testes Jest do projeto de origem não foram executados; a adaptação recebe testes de regressão no Ind Resources.

## Arquitetura e correspondência

| Referência | Responsabilidade | Decisão no Ind Resources |
| --- | --- | --- |
| `src/index.ts`, `classes/s-c-controller.ts` | Inicialização, eventos do Foundry, controles de cena, estado global | Registro único no `CalendarService`, botão de cena e atalho configurável sem tecla padrão imposta |
| `calendar/calendar-manager.ts` | Calendário ativo/consultado e sincronização entre calendários | Um calendário Symbaroum; mês/ano consultado e dia selecionado separados da data corrente |
| `calendar/{year,month,day,weekday,leap-year,index}.ts` | Conversão de data para dias/segundos, semanas contínuas, meses e bissextos | Mantém o preset: 12 meses de 30 dias, semana de 7 dias, anos 0–9999, sem bissextos |
| `calendar/moon.ts` | Cálculo de ciclo e fases, várias luas possíveis | Mantém a lua Symbaroum de 28 dias e suas oito fases; grade e próximas luas cheia/nova |
| `calendar/season.ts`, `getSunriseSunsetTime` | Estações, horários solares e interpolação entre os inícios das estações | Estações fixas do preset; nascer/pôr do sol configuráveis nos quatro limites e interpolação diária, inclusive na virada do ano |
| `time/index.ts`, `time/time-keeper.ts` | Tempo fracionário, proporção real/jogo, estado parado/pausado/rodando, sincronização | Reutiliza `CalendarClockRunner` e sua fila; GM principal único, sem compensar tempo offline, preservando frações e invalidando ticks após pausa |
| `applications/main-app.ts`, `renderer/calendar-full.ts`, `templates/main.hbs` | Visões mensal/anual/compacta, seleção, navegação, menus | Três modos, alternância por botões ou duplo clique no título, hoje, seleção e aplicação explícita; consulta não muda o mundo |
| `renderer/date-time-controls.ts`, `utilities/date-time.ts` | Unidade selecionável, passos ±1/±5, controles rápidos, horários predefinidos | Segundo, rodada, minuto, hora, dia, mês e ano; rodada usa `CONFIG.time.roundTime`; nascer do sol/meio-dia/pôr do sol/meia-noite avançam para a próxima ocorrência |
| `configuration/general-settings.ts` | Integração temporal, formatos e layout | Quatro integrações temporais; formatos 12/24 horas, segundos e controles por seletor/incrementos rápidos/ocultos |
| `configuration/user-permissions.ts` | Matrizes de permissão por papel e usuário | Consulta de jogadores configurável; controle delegado por papel/usuário; configuração e importação continuam exclusivas do GM |
| `foundry-interfacing/`, `sockets/` | Persistência, eleição do GM e transporte de pedidos | Mantém socketlib do módulo, remetente autenticado, validação de payload e nova checagem ao executar a fila |
| `applications/configuration-app.ts` | Preferências pessoais, configuração do mundo e backup | Aplicação própria, temas escuro/claro/clássico, escala e posições por usuário; backup JSON próprio versionado, restauração confirmada |
| `chat/` | Data fictícia nas mensagens e exportação de texto | Carimbo opcional, com snapshot na criação e leitura de flags na renderização; não substitui métodos nativos de ChatMessage |
| `api/` | API extensa, hooks, seletores incorporáveis e addons | Serviço público próprio em `game.tenebreResources.calendar` e na API do módulo; não substitui a variável global `SimpleCalendar` nem simula compatibilidade completa com sua API |
| `notes/`, `triggers/` e integração com Journals | Notas, busca, categorias, recorrência, lembretes e comandos associados | Fora do escopo por decisão do usuário; nenhum Journal, pasta ou nota é criado |
| `systems/`, outros presets e migrações legadas | PF1/PF2/D35E, calendários arbitrários e migração do Simple Calendar antigo | Fora do escopo exclusivo de Symbaroum; dados e configurações de outros módulos não são alterados |

## Quatro modos de integração

- **Misto:** padrão preservado; usa `game.time.worldTime`, altera o mundo pela API pública e acompanha mudanças externas.
- **Autoridade:** mantém referência própria, ignora avanços externos na exibição e sincroniza o mundo na próxima alteração iniciada no calendário. Avanços temporais nativos do combate atualizam sua referência sem avançar o mundo outra vez.
- **Independente:** mantém data/hora própria e não altera nem acompanha o tempo mundial.
- **Externo:** consulta o tempo do mundo; controles de mudança e relógio automático desativados também no executor. O GM pode voltar a outro modo pela configuração.

Trocar o modo preserva a data civil corrente. Ao voltar a um modo que acompanha o mundo, o horário passa a ser o horário mundial. As novas opções mantêm defaults compatíveis com o calendário anterior: misto, controles somente para GM, pausa por combate inicialmente desligada.

A pausa por combate pode considerar a cena atual ou qualquer cena. Um encontro apenas criado ao sacar arma, ainda não iniciado, não suspende o relógio. Pausar, parar e retomar são ações distintas; tempo pausado ou offline não é compensado.

## Persistência e segurança

São reaproveitados `calendarDate`, `calendarClockRunning` e `calendarClockSpeed`. Novos dados: `calendarWorldOptions`, `calendarIndependentTime`, `calendarClientOptions` e `calendarClockManualPause`. A data legada não exige migração automática. A fila permanece disponível para integrações internas.

Renderização e consulta não gravam documentos nem avançam o tempo. Posição é gravada em ações pessoais de fechar/alternar modo, não em hooks de render. O horário é atualizado sem reconstruir os campos e a grade a cada segundo.

O executor não aceita nome arbitrário de setting nem identidade de usuário no payload: usa o remetente de socketlib e o GM principal atual. Usuários delegados só podem alterar o tempo; configuração e restauração exigem GM. O modo externo é validado no servidor, além de esconder seus controles.

O backup exporta somente data, horário e configurações do calendário do Ind Resources, sem notas, fichas ou dados do mundo. Não é um importador universal de backups do Simple Calendar. A restauração requer confirmação e deixa o relógio parado. Viagens e permanências da expedição não recebem novos avanços automáticos.

## Interface e licenciamento

A janela possui os temas escuro, claro e clássico, escala de 70% a 200%, posição separada para compacto, formato de horas e abertura automática por usuário. A grade distingue o dia atual da seleção, fases de referência e dias da semana. O menu de contexto oferece consulta/aplicação da data.

Os SVGs de lua e estações continuam sendo os desenhos originais do Ind Resources. Não são copiados ícones externos, imagens de marcas ou temas dependentes de outros sistemas. O aviso MIT da referência acompanha a distribuição pela adaptação dos comportamentos/algoritmos e dados do preset.

## Validação

Os testes cobrem datas legadas e seus limites, quatro integrações, permissões e revogação na fila, pausa manual/combate, rodada sem duplicação de tempo mundial, horários predefinidos, interpolação solar, três modos visuais, formatos, backup e carimbo de chat sem escrita durante render.

A prévia com as mesmas classes e componentes confirmou modos, consulta anual como jogador, tema claro, incrementos rápidos, formato de 12 horas e suspensão por combate. Ela usa documentos simulados. A validação do servidor e os casos ainda manuais serão registrados na preparação da release; testes Node não equivalem a sessões reais v13/v14.

## Inventário dos módulos TypeScript da referência

O inventário abaixo cobre a árvore de execução. Testes, documentação, templates e estilos foram catalogados à parte. O mapeamento de uma unidade não equivale a uma auditoria de segurança linha a linha; os fluxos de data, relógio, aplicações, permissões, sockets e integração temporal foram aprofundados para orientar a adaptação.

| Arquivo na referência | Linhas | Símbolos identificados |
| --- | ---: | ---: |
| `src/constants.ts` | 531 | 0 |
| `src/index.ts` | 113 | 0 |
| `src/classes/index.ts` | 62 | 6 |
| `src/classes/key-bindings.ts` | 20 | 1 |
| `src/classes/logging.ts` | 48 | 4 |
| `src/classes/s-c-controller.ts` | 488 | 33 |
| `src/classes/api/handlebars-helpers.ts` | 232 | 8 |
| `src/classes/api/hook.ts` | 43 | 1 |
| `src/classes/api/index.ts` | 2114 | 46 |
| `src/classes/applications/configuration-app.ts` | 1918 | 48 |
| `src/classes/applications/main-app-config-wrapper.ts` | 12 | 0 |
| `src/classes/applications/main-app.ts` | 1413 | 57 |
| `src/classes/applications/migration-app.ts` | 223 | 17 |
| `src/classes/calendar/calendar-manager.ts` | 382 | 26 |
| `src/classes/calendar/day.ts` | 65 | 3 |
| `src/classes/calendar/index.ts` | 1293 | 39 |
| `src/classes/calendar/leap-year.ts` | 159 | 11 |
| `src/classes/calendar/month.ts` | 283 | 14 |
| `src/classes/calendar/moon.ts` | 255 | 8 |
| `src/classes/calendar/season.ts` | 154 | 6 |
| `src/classes/calendar/weekday.ts` | 82 | 6 |
| `src/classes/calendar/year.ts` | 213 | 9 |
| `src/classes/chat/chat-timestamp.ts` | 100 | 4 |
| `src/classes/chat/index.ts` | 23 | 3 |
| `src/classes/configuration/configuration-item-base.ts` | 98 | 5 |
| `src/classes/configuration/general-settings.ts` | 133 | 6 |
| `src/classes/configuration/predefined-calendar.ts` | 61 | 1 |
| `src/classes/configuration/user-permissions.ts` | 133 | 8 |
| `src/classes/date-selector/date-selector-manager.ts` | 53 | 5 |
| `src/classes/date-selector/index.ts` | 670 | 16 |
| `src/classes/foundry-interfacing/game-data.ts` | 28 | 3 |
| `src/classes/foundry-interfacing/game-settings-registration.ts` | 286 | 1 |
| `src/classes/foundry-interfacing/game-settings.ts` | 230 | 18 |
| `src/classes/foundry-interfacing/game-sockets.ts` | 31 | 2 |
| `src/classes/foundry-interfacing/utilities.ts` | 29 | 1 |
| `src/classes/migrations/v1-to-v2.ts` | 212 | 8 |
| `src/classes/notes/note-manager.ts` | 466 | 22 |
| `src/classes/notes/note-sheet.ts` | 1137 | 45 |
| `src/classes/notes/note-stub.ts` | 615 | 25 |
| `src/classes/notes/note-trigger.ts` | 41 | 1 |
| `src/classes/renderer/calendar-full.ts` | 801 | 7 |
| `src/classes/renderer/clock.ts` | 101 | 5 |
| `src/classes/renderer/date-time-controls.ts` | 147 | 1 |
| `src/classes/renderer/index.ts` | 14 | 0 |
| `src/classes/renderer/multi-select.ts` | 134 | 4 |
| `src/classes/renderer/time-selector.ts` | 258 | 5 |
| `src/classes/renderer/utilities.ts` | 25 | 1 |
| `src/classes/sockets/check-clock-running-socket.ts` | 35 | 3 |
| `src/classes/sockets/clock-socket.ts` | 28 | 1 |
| `src/classes/sockets/date-time-change-socket.ts` | 36 | 2 |
| `src/classes/sockets/emit-hook-socket.ts` | 30 | 1 |
| `src/classes/sockets/index.ts` | 63 | 2 |
| `src/classes/sockets/main-app-update.ts` | 29 | 2 |
| `src/classes/sockets/note-update-socket.ts` | 49 | 1 |
| `src/classes/sockets/primary-socket.ts` | 121 | 4 |
| `src/classes/sockets/render-chat-log-socket.ts` | 20 | 1 |
| `src/classes/sockets/set-active-calendar.ts` | 19 | 2 |
| `src/classes/sockets/socket-base.ts` | 25 | 2 |
| `src/classes/systems/D35E.ts` | 11 | 1 |
| `src/classes/systems/pf1e.ts` | 11 | 1 |
| `src/classes/systems/pf2e.ts` | 150 | 7 |
| `src/classes/time/index.ts` | 215 | 11 |
| `src/classes/time/time-keeper.ts` | 257 | 13 |
| `src/classes/triggers/ parameter.ts` | 35 | 1 |
| `src/classes/triggers/command.ts` | 14 | 0 |
| `src/classes/triggers/condition.ts` | 75 | 1 |
| `src/classes/utilities/chat-commands.ts` | 92 | 3 |
| `src/classes/utilities/date-time.ts` | 478 | 9 |
| `src/classes/utilities/inputs.ts` | 51 | 5 |
| `src/classes/utilities/object.ts` | 39 | 3 |
| `src/classes/utilities/permissions.ts` | 18 | 1 |
| `src/classes/utilities/search.ts` | 440 | 9 |
| `src/classes/utilities/string.ts` | 79 | 7 |
| `src/classes/utilities/visual.ts` | 246 | 11 |
