# Calendário próprio — estudo de implementação

Estudo e implementação local em 16/10/2026. Validação manual no Foundry ainda pendente.

## Escopo solicitado

- Calendário próprio do Ind Resources, simplificado e sem notas.
- Exibição de data de Symbaroum: dia, mês e ano, conforme resposta do usuário.
- Integração com o tempo mundial e outros módulos, conforme correção explícita do usuário durante a implementação.
- Interface na barra lateral direita, na região indicada na captura da aba Atores.
- Referências: Simple Calendar para calendário e PF2e HUD para apresentação.
- Painel acima dos conteúdos das abas da barra lateral, visível em todas elas, seguindo o comportamento do PF2e HUD aceito pelo usuário.

## Fontes inspecionadas

Simple Calendar Reborn, commit `5670bbe18f0516b514fff5ee1f19e394883701b5`:

- [Entrada e hooks](https://github.com/Fireblight-Studios/foundryvtt-simple-calendar/blob/5670bbe18f0516b514fff5ee1f19e394883701b5/src/index.ts).
- [Modelo do calendário](https://github.com/Fireblight-Studios/foundryvtt-simple-calendar/blob/5670bbe18f0516b514fff5ee1f19e394883701b5/src/classes/calendar/index.ts).
- [Carregamento dos calendários](https://github.com/Fireblight-Studios/foundryvtt-simple-calendar/blob/5670bbe18f0516b514fff5ee1f19e394883701b5/src/classes/calendar/calendar-manager.ts).
- [Registro das configurações](https://github.com/Fireblight-Studios/foundryvtt-simple-calendar/blob/5670bbe18f0516b514fff5ee1f19e394883701b5/src/classes/foundry-interfacing/game-settings-registration.ts).
- [Alteração de data por socket](https://github.com/Fireblight-Studios/foundryvtt-simple-calendar/blob/5670bbe18f0516b514fff5ee1f19e394883701b5/src/classes/sockets/date-time-change-socket.ts).
- [Preset de Symbaroum](https://github.com/Fireblight-Studios/foundryvtt-simple-calendar/blob/5670bbe18f0516b514fff5ee1f19e394883701b5/src/predefined-calendars/symbaroum.json).

PF2e HUD, commit `df3fe9662667428f38bb0fa5d97f21d115b73056`:

- [Componente de tempo](https://github.com/reonZ/pf2e-hud/blob/df3fe9662667428f38bb0fa5d97f21d115b73056/src/hud/time.ts).
- [Base da integração com a barra lateral](https://github.com/reonZ/pf2e-hud/blob/df3fe9662667428f38bb0fa5d97f21d115b73056/src/hud/base/sidebar.ts).
- [Template](https://github.com/reonZ/pf2e-hud/blob/df3fe9662667428f38bb0fa5d97f21d115b73056/templates/time.hbs).
- [Estilo do painel](https://github.com/reonZ/pf2e-hud/blob/df3fe9662667428f38bb0fa5d97f21d115b73056/styles/_time.scss).

## O que aproveitar das referências

O Simple Calendar separa a definição do calendário, a data atual e a interface. Persiste a configuração em settings de mundo e reage a alterações para recarregar a apresentação. Sua integração com `worldTime` tem modos e proteções para evitar ciclos de sincronização. A coordenação de alterações entre usuários inclui um GM primário.

Para a primeira versão, essa arquitetura foi reduzida a regras de data, estado compartilhado e apresentação. Na etapa visual solicitada depois, foram acrescentadas as fases da lua e as estações do preset. Múltiplos calendários, notas e relógio contínuo continuam fora do escopo.

O PF2e HUD usa um componente próprio para exibir data e hora. Insere seu elemento antes do elemento do chat, dentro da estrutura da barra lateral, usa largura limitada pela sidebar e mostra controles de incremento apenas ao GM. Ativa o hook de atualização temporal quando o componente é aberto e o remove ao fechar.

Seu componente depende de `game.pf2e.worldClock`, configurações do PF2e e da biblioteca `foundry-helpers`. Também acessa `_prepareContext` do relógio do sistema. A implementação do Ind Resources deve usar seu próprio serviço e APIs públicas, aproveitando a ideia visual e o ciclo de vida, sem portar essas dependências.

## Calendário encontrado na referência

O preset de Symbaroum define 12 meses de 30 dias, totalizando 360 dias por ano, sem anos bissextos:

1. Ynedar
2. Olandan
3. Adonia
4. Tomol
5. Serliela
6. Morangal
7. Ofelya
8. Agani
9. Elisal
10. Verion
11. Konelia
12. Leandro

Esses dados foram verificados no preset do módulo de referência. Ainda não foram confrontados com os livros ou a tradução PT-BR; não representam uma validação independente do cânone. A data inicial presente no preset é um exemplo e não deve ser aplicada ao mundo do usuário automaticamente. O preset armazena índices de mês e dia começando em zero; a interface deve apresentar dias começando em um.

## Proposta mínima

- Painel compacto com data centralizada e botões de recuar/avançar um dia para GM.
- Ação discreta de definir data para corrigir dia, mês e ano, restrita a GM.
- Jogadores e jogadores confiáveis visualizam a mesma data, sem permissão de edição.
- Data de referência persistente em setting de mundo; a data exibida acompanha `game.time.worldTime`.
- Validação de autorização e valores no caminho de gravação, além da ocultação visual dos controles.
- Serialização de cliques locais. Se for utilizado um GM coordenador, validar o remetente no servidor lógico e reler o estado antes de aplicar cada operação, inclusive com dois GMs conectados.
- Regras de conversão de dias e virada de mês/ano em módulo independente do Foundry para testes.
- Serviço visual com registro idempotente, CSS exclusivo do módulo e remoção do painel/listeners quando desativado.
- Controle de ativação conforme o padrão de recursos opcionais do Ind Resources.

A faixa foi implementada no topo de `#sidebar-content`, como irmã das abas. Preserva os controles, a lista e sua busca. O recolhimento do painel segue o recolhimento nativo da barra lateral.

O usuário solicitou explicitamente integração temporal. A implementação usa `game.time.advance` e reage a `updateWorldTime`. Cada dia equivale a 86400 segundos. A configuração inicial associa uma data ao dia mundial atual sem reiniciar o tempo. Avançar/recuar dias e editar uma data já configurada modifica o tempo mundial preservando horas/minutos/segundos. Mudanças de tempo externas, inclusive parciais e para trás, alteram a data ao cruzar a meia-noite mundial.

O calendário começa sem data definida. Anos aceitos: 0 a 9999. Se uma mudança externa sair desse intervalo, a data fica indisponível e o GM pode estabelecer nova referência pelo botão de data. A implementação não reconfigura os calendários internos de terceiros: compartilha o tempo decorrido com consumidores do relógio mundial. Módulos que mantêm relógio privado e ignoram `worldTime` exigem integração específica.

Os pedidos dos GMs passam pelo executor principal e por uma fila única do serviço. O remetente autenticado deve ser um GM ativo. Alterações feitas por outros módulos fora dessa fila seguem a concorrência da API nativa do Foundry.

## Encaixe no Ind Resources

- `scripts/init.mjs`: inicialização do serviço, seguindo o ciclo existente.
- `scripts/calendar-date.mjs`: regras de data e conversão do tempo.
- `scripts/calendar.mjs`: serviço, settings, interface compacta e formulário de data. A opção aparece nas configurações nativas do módulo e atualiza o painel sem recarregar.
- `languages/en.json` e `languages/pt-BR.json`: novos textos do calendário.
- `styles/calendar.css` e registro em `module.json`: estilos limitados ao novo painel, sem mudar versão ou compatibilidade declarada.
- O sistema Symbaroum local é 6.1.6 e declara Foundry 13. A busca no código textual do sistema não encontrou calendário nem uso de `worldTime`; isso não prova ausência de toda integração externa.
- Descanso e expedição já trabalham com dias próprios. O calendário proposto não deve avançar uma vez por personagem nem alterar suas regras. Uma integração futura deve definir qual ação coletiva avança a data.
- Existem alterações locais anteriores em descanso, expedição, movimento e ficha de grupo. Nenhuma foi alterada durante este estudo.

## Validação necessária na implementação

- Testes de data: último dia do mês, último mês do ano, avanço/recuo de vários dias, limites de ano e entrada inválida.
- Testes de autorização, gravação e atualização dos clientes; cliques rápidos e GMs simultâneos.
- Testes do ciclo visual: renderizações repetidas, troca de abas, recolher/expandir sidebar, ativar/desativar e recarregar mundo.
- Testes manuais com GM, jogador e jogador confiável; PT-BR e inglês; outros módulos de calendário ativos e ausentes.
- Executar testes focados, suíte completa e validação de sintaxe/JSON após a implementação.
- Validar o encaixe real em Foundry v13 e revisar/testar o caminho para v14. Não declarar compatibilidade validada apenas pela análise do código.

## Resultado da validação local

- Nove testes automatizados em `tests/calendar.test.mjs` passaram: regras de data, limites, meia-noite, tempo negativo, permissões, serialização, falha de gravação, ativação/desativação, atualização externa, recarga simulada e idiomas.
- Validação de sintaxe passou em 141 módulos JavaScript.
- Execução final da suíte completa: 556 testes passaram, sem falhas. Uma execução anterior encontrou falha isolada no teste de permanência da expedição; alterações concorrentes nessa área resolveram o caso e acrescentaram testes. Esses arquivos não foram modificados por esta implementação.
- JSON do manifesto e dos idiomas válido; arquivos registrados no manifesto presentes; 14 chaves de calendário disponíveis em inglês e PT-BR; `git diff --check` sem erros.
- O Foundry local não respondeu em `http://localhost:30000` durante a tentativa de validação. Encaixe visual real, clientes GM/jogador simultâneos, módulos temporais concretos e Foundry v13/v14 seguem como validação manual pendente.

## Etapa visual — calendário mensal, lua e estações

Solicitada após o usuário confirmar que a primeira release apareceu e funcionou no Foundry.

- A janela de formulário foi substituída por uma aplicação mensal com 30 dias, sete colunas de semana, navegação por mês/ano, destaque do dia atual e seleção de data.
- A consulta de outros dias e meses não muda o tempo. Somente a ação explícita de aplicar data, restrita ao GM também no executor, altera o mundo.
- Jogadores podem abrir e consultar a janela pelo mesmo botão da lateral; não recebem controles de alteração do tempo.
- A lateral mantém as setas do GM e acrescenta uma segunda linha com estação e fase lunar. A janela mostra os mesmos indicadores para a data do mundo e a data selecionada; cada célula inclui o ícone da lua.
- Ciclo lunar do preset: 28 dias contínuos, com lua nova em 1 de Ynedar do ano zero. As oito fases começam nos deslocamentos 0, 1, 7, 8, 14, 15, 21 e 22. Não reinicia na virada do mês ou ano.
- Estações do preset, sempre a partir do dia 1: outono em Olandan, inverno em Serliela, primavera em Agani e verão em Konelia. O verão atravessa Leandro e Ynedar.
- Dias da semana do preset: Terra, Água, Vento, Floresta, Montanha, Povo e Festa; a semana segue continuamente entre meses e anos.
- Os dados foram novamente conferidos no preset e no cálculo lunar do Simple Calendar. São os padrões da referência, não uma validação independente contra os livros.
- SVGs originais desenham as fases da lua e os símbolos das estações, sem assets externos. Estilos ficam limitados ao painel e à janela do calendário.
- A data salva e sua referência temporal foram preservadas. Não houve alteração no protocolo de gravação ou nos cálculos de avanço do tempo mundial.
- Validação desta etapa: 15 testes de calendário e 570 testes da suíte completa passaram; sintaxe de 142 módulos JavaScript validada; 51 chaves de calendário em cada idioma, com paridade completa das traduções e JSONs válidos.
- A prévia isolada usa os componentes reais de apresentação e uma simulação do ciclo de aplicação e tempo. Foi conferida no navegador: aparência da grade e ícones, seleção sem mudar o mundo, aplicação da data pelo GM, consulta como jogador, mudança de estação ao consultar outro mês e atualização externa sem perder o mês consultado.
- A prévia não substitui a validação da nova janela em clientes reais do Foundry v13/v14. Não foi publicada uma nova release nesta etapa.

## Relógio integrado

- Horário mundial em formato de 24 horas (`HH:mm`) na lateral e na janela, com mostrador analógico vetorial na janela.
- GM dispõe de controles de recuar/avançar 10 minutos e uma hora. Jogadores veem o relógio, sem os controles de alteração.
- Operações usam a mesma fila e o mesmo executor principal da data, com validação do remetente e dos quatro intervalos aceitos. O relógio também funciona antes da definição inicial da data.
- Nesta primeira etapa de horas, o tempo continuou sendo `game.time.worldTime`, sem avanço automático. Alterações externas acompanham o fluxo de `updateWorldTime`. O avanço automático foi solicitado depois, na etapa abaixo.
- Cruzar a meia-noite atualiza a data, a lua e a estação conforme o calendário. A referência temporal salva permanece intacta.
- Quando somente o horário muda, os textos e ponteiros são atualizados diretamente, preservando o mês consultado, a seleção e os campos em edição.
- Validação: 20 testes de calendário e 575 testes completos passaram. A prévia confirmou atualização simultânea da lateral e da janela, posição dos ponteiros e ausência de controles para jogador. Integração real da nova interface em Foundry v13/v14 permanece pendente.

## Avanço automático e proporção configurável — 17/10/2026

- O painel ganhou botões compactos de ajustar horário e iniciar/pausar. O ajuste abre um campo `HH:mm` no próprio painel e aplica o horário mantendo o dia do mundo. A janela mensal também possui iniciar/pausar.
- A exibição passa a incluir segundos (`HH:mm:ss`). Os ponteiros e textos são atualizados sem substituir a grade ou o campo de horário em edição.
- `calendarClockRunning` guarda a intenção de iniciar/pausar no mundo; começa desligado. A pausa do Foundry suspende o avanço, mantendo a intenção de retomar quando o jogo voltar.
- `calendarClockSpeed`, nas configurações nativas do módulo, define quantos segundos do mundo passam por segundo real. Padrão 1; valores aceitos de 0,01 a 86400. Exemplos: 60 equivale a um minuto por segundo; 0,5 equivale à metade da velocidade.
- A proporção tem validação numérica e efeito sem recarregar. O motor mantém frações para velocidades abaixo de 1, sem perder os avanços acumulados.
- Somente o GM principal ativo executa o motor. Jogadores e GMs secundários não criam avanço local. Os pedidos de controle passam pelo remetente autenticado e pela mesma fila das mudanças manuais.
- A medição usa o tempo monotônico do cliente durante a sessão e atualiza `game.time.advance`. Não existe uma data paralela; módulos consumidores continuam recebendo `updateWorldTime`.
- Pausa, troca de autoridade, desativação e saída cancelam o agendamento. Ao reabrir o mundo, o relógio iniciado retoma a partir do tempo salvo, sem contar o período fechado. Falhas de gravação param o motor, em vez de repetir erros a cada segundo.
- Outros motores automáticos que também avancem o tempo mundial podem somar seus avanços; esta implementação não desativa módulos de terceiros.
- Validação: 28 testes focados e 618 testes da suíte completa passaram, sintaxe de 147 módulos validada, JSONs e paridade de idiomas válidos, `git diff --check` sem erros.
- Conferência na prévia isolada: iniciar/pausar pela lateral, sincronização com a janela, proporção 60, pausa do jogo sem avanço, e ajuste direto de horário. A simulação possui um botão para aplicar a proporção; no Foundry ela é salva nas configurações do módulo.
- Pendentes em clientes reais do Foundry v13/v14: troca de GM com relógio ativo, permissões nativas da configuração e convivência com módulos temporais concretos. Não houve publicação de release nesta solicitação.

## Indicador de período do dia — 21/10/2026

- O indicador ao lado da estação, na lateral e no cabeçalho da data do mundo, acompanha o horário compartilhado: amanhecendo das 05h às 07h, dia das 07h às 17h, entardecendo das 17h às 19h e fase lunar das 19h às 05h. Os limites finais são exclusivos.
- São faixas visuais fixas, sem cálculo astronômico de nascer da lua ou variação sazonal da duração do dia. Sol e horizonte usam SVGs originais; à noite reaparece o ícone da fase lunar existente.
- A grade mensal e a data selecionada continuam mostrando suas fases lunares para consulta. Os cálculos de lua, estação e data permanecem iguais.
- A atualização direta do indicador acompanha `updateWorldTime`, inclusive ajustes externos e recuos, preservando os campos em edição e o mês consultado. A apresentação não grava settings nem altera o tempo mundial.
- Validação: 31 testes focados e 621 testes da suíte completa passaram; sintaxe de 147 módulos, JSONs e paridade dos idiomas validados. A prévia isolada confirmou amanhecer às 06h, dia às 07h, entardecer às 18h e lua às 19h na lateral e na janela.
- A conferência em mundos reais do Foundry v13/v14 permanece pendente. Não houve publicação de release nesta solicitação.

## Visibilidade nas abas Atores e Itens — 21/10/2026

- A pedido do usuário, o painel compacto passa a aparecer somente nas abas Atores e Itens. A regra CSS usa as classes nativas `active-actors` e `active-items` de `#sidebar-content`, conferidas no código local do Foundry v13.351. A troca de aba oculta o painel sem reservar espaço e sem pausar o relógio ou fechar a janela mensal aberta.
- A prévia isolada confirmou a visibilidade em Atores/Itens e a ocultação nas dez demais abas simuladas; também confirmou a ocultação para jogador e a permanência da janela mensal.
- Os 31 testes focados passaram; sintaxe de 146 módulos e `git diff --check` validados. A suíte completa executada neste estado do diretório teve 582 resultados aprovados e 12 falhas em expedição/rações: funções de viagem indisponíveis e importação de `scripts/expedition-journey.mjs`, removido por alterações concorrentes. Esses arquivos não foram modificados nesta solicitação.
- Validação de troca de abas no Foundry real v13/v14 permanece pendente. Sem publicação de release.

## Preparação da release 0.18.49 — 21/10/2026

- O usuário solicitou a publicação para testar no Foundry hospedado na Oracle. A versão inclui o indicador de período do dia e a restrição do painel às abas Atores e Itens.
- O candidato foi preparado a partir da versão 0.18.48 publicada, acrescentando somente os arquivos desta implementação e a atualização de versão no manifesto e no pacote. Alterações concorrentes de expedição, rações e movimento ficaram fora do candidato.
- A suíte completa do candidato isolado passou: 621 testes, nenhuma falha. A validação real em clientes Foundry v13/v14 será feita após a instalação no servidor.
