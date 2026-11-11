# Preparação para publicação pública

Este documento registra o estado técnico verificado antes da publicação do
Symbaroum Ind Resources. Ele deve ser atualizado a cada release pública.

## Release v0.19.6 — 11/11/2026

- Corrige a integracao registrada mas ausente em diarios cuja janela nativa
  foi instanciada antes do registro da ficha aprimorada. O cache de sheet do
  Document sobrevive a registerSheet no Foundry v13. Diagnostico do usuario
  confirmou ficha registrada integrada, janela antiga nao integrada e duas
  categorias ainda salvas. A recriacao nativa da janela restaurou tudo, com
  confirmacao do usuario no Foundry online.
- Corrige a origem: o registro sai de ready e passa para setup, antes de
  initializeSheets do Foundry. O construtor nativo e carregado antecipadamente,
  com import aguardado antes dos hooks, pois o registro CONFIG ainda nao esta
  preenchido em setup. A API publica enfileira a integracao depois do init do
  sistema, preservando o ID symbaroum.SymbaroumWide e a preferencia de ficha.
- Nao percorre diarios ou compendios, nao recria janelas e nao executa reparo de
  cache em cada carregamento. O primeiro acesso a ficha ja recebe a integracao.
  O registro e idempotente mesmo enquanto a fila do Foundry ainda esta pendente.
- Validacao: 35 testes focados, 713 locais e 699 na copia isolada da publicacao,
  todos aprovados; sintaxe de 157 modulos, 15 JSON validos e paridade de 1279
  chaves de idioma. Inclui simulacao da fila init/setup/initializeSheets,
  acesso anterior a ready, defaults salvos, idempotencia e ausencia de varredura.
- A restauracao manual foi confirmada no ambiente real pelo usuario; a nova
  inicializacao antecipada no proximo carregamento e a execucao real em v14 ainda
  precisam de verificacao no Foundry. Alteracoes locais de expedicao e anotacoes
  do checklist permanecem fora da publicacao.

## Release v0.19.5 — 10/11/2026

- Substitui o ponto de listas nao numeradas do Diario Amplo por um losango
  duplo marrom-avermelhado. Referencia visual: ornamento de Tomb of Dying
  Dreams, p. 30 (pagina 3 do PDF consultado), conferido em renderizacao local.
  A forma geometrica e representada pelo glifo Unicode U+25C8 em CSS; nao
  distribui recorte, imagem ou pagina do livro.
- Seletor restrito ao conteudo das paginas do Diario Amplo, com exclusao
  das classes/atributos usuais de listas de tarefas. Listas numeradas,
  indice, fichas e chat mantem seus controles e marcadores existentes.
- Alteracao exclusivamente visual, sem reescrever HTML ou criar hooks.
  Validacao: CSS analisado por PostCSS, 29 testes focados e 693 testes na
  copia isolada de publicacao, todos aprovados; sintaxe de 157 modulos,
  15 JSON validos e paridade de 1279 chaves de idioma.
- Conferencia visual do marcador no Foundry, inclusive listas aninhadas,
  e execucao real em v14 seguem pendentes com o usuario.

## Release v0.19.4 — 09/11/2026

- Corrige categorias vazias ausentes do indice: a adaptacao anterior filtrava
  grupos sem paginas. Agora segue o diario nativo, mantendo categorias nomeadas
  vazias e preservando a filtragem nativa de acesso as paginas. Durante busca,
  cabecalhos sem paginas correspondentes ficam ocultos.
- O Diario Amplo passa a usar a API publica createDialog e o formulario nativo
  de paginas com campo Categoria, incluindo a atribuicao na criacao. Preserva
  tipos nativos, cancelamento, bloqueios de edicao e fallback da interface antiga.
  A ordem inicial usa o maior sort existente, independente da ordem dos grupos.
- Tema restrito ao Diario Amplo: Primitive no titulo da janela/pagina e no
  Cabecalho 1, Jim Nightshade no Cabecalho 2 e Fondamento mantida no Cabecalho 3.
  O conteudo salvo das paginas nao e reescrito; outras fichas nao sao tematizadas.
- Reproduzidas falhas de categoria vazia, ausencia do seletor na criacao e
  protecao de criacao somente leitura antes da correcao. Validacao: 29 testes
  focados, 707 na instalacao local e 693 na copia isolada da publicacao, todos
  aprovados; sintaxe de 157 modulos publicados, 15 JSON validos e paridade de
  1279 chaves de idioma na publicacao.
- Conferencia visual das fontes, criacao real no Foundry, usuarios simultaneos
  e execucao real em v14 ficam pendentes; testes visuais permanecem com o usuario.
  Alteracoes locais de expedicao e anotacoes no checklist nao entram no release.

## Release v0.19.3 — 09/11/2026

- Habilita as categorias nativas no diario personalizado SymbaroumWide,
  que ainda usa a interface AppV1 sem gerenciador ou agrupamento de categorias.
  Restaura tambem o seletor de categoria ocultado pelo CSS do sistema.
- Reutiliza JournalEntryCategoryConfig e as permissoes nativas de edicao,
  incluindo compendios bloqueados. Preserva identificacao, aparencia, ficha
  padrao e dados existentes, sem migracao ou escrita em renderizacao.
- Indice, ordem das paginas e navegacao seguem a ordem das categorias;
  paginas sem categoria ou com referencia removida continuam acessiveis.
  A busca oculta cabecalhos sem resultados e nao expoe paginas invisiveis.
- Impede emissao duplicada de hooks ao preservar o nome da ficha original.
  Outras fichas e uma eventual implementacao AppV2 nativa nao sao alteradas.
- Validacao: 22 testes focados, 700 testes na instalacao local e 686 na
  copia isolada de publicacao, todos aprovados; sintaxe de 157 modulos na
  publicacao, 14 JSON validos e paridade de 1279 chaves entre idiomas.
- Teste visual, persistencia apos recarregar, compartilhar paginas entre
  clientes e verificacao real no Foundry v13/v14 ficam pendentes com o
  usuario, conforme a orientacao de deixar os testes visuais a cargo dele.

## Release v0.19.2 — 04/11/2026

- Reorganiza a janela para se aproximar do Simple Calendar: mes/ano e estacao
  acima da grade, dias circulares, atalhos laterais e relogio abaixo do mes.
  Remove o cabecalho de marca repetido e o bloco fixo de informacoes extras.
- Lua, horarios solares e proximas fases passam a um painel opcional de
  detalhes, preservado ao consultar outra data. A acao de aplicar uma data
  aparece quando a selecao difere da data atual. Atalhos solares usam icone
  e texto; temas e modos mensal/anual/compacto continuam disponiveis.
- Alteracoes limitadas a apresentacao e estado local do painel de detalhes;
  regras de tempo, fila, permissoes e dados salvos permanecem no fluxo existente.
- Testes focados cobrem o painel de detalhes, selecao sem mudar o tempo,
  permissoes e as operacoes temporais existentes. A validacao visual real
  fica com o usuario, conforme pedido.
- Validacao: 63 testes focados, 685 na instalacao local e 671 na copia
  isolada de publicacao, todos aprovados; sintaxe de 155 modulos, 14 JSON
  validos e paridade de 1279 chaves de idioma.

## Release v0.19.1 — 04/11/2026

- Corrige o aviso incorreto de data invalida ao usar controles de hora/dia
  quando `CONFIG.time.roundTime` e zero, o padrao do core Foundry v13.351.
  A validacao de duracao de rodada agora se aplica somente a essa unidade;
  zero e valido e nao avanca tempo, conforme a configuracao nativa.
- Regressao reproduzida antes do patch com dois testes falhando. Cobertura
  inclui todas as outras unidades, avanco/recuo, meia-noite, virada do ano,
  GM secundario, rodada zero e preservacao da ancora salva.
- Validacao: 61 testes focados, 683 na suite local e 669 na copia isolada
  de publicacao, todos aprovados; sintaxe de 155 modulos na publicacao,
  14 arquivos JSON validos e paridade de 1278 chaves de idioma.
- Testes visuais em sessoes reais continuam com o usuario, conforme pedido.

## Release v0.19.0 — 04/11/2026

- Adapta a experiência do Simple Calendar Reborn ao calendário exclusivo de
  Symbaroum: visões mensal/anual/compacta, controles de unidades e incrementos
  rápidos, horários solares, estados parado/pausado/rodando e preferências
  pessoais. Análise e inventário em `CALENDARIO-SIMPLE-CALENDAR-ANALISE.md`.
- Quatro integrações temporais (misto, autoridade, independente, externo),
  pausa por combate opcional, configuração por GM e permissões delegadas
  autenticadas e revalidadas ao executar a fila.
- Preserva a data legada e o modo misto padrão; não adiciona calendários,
  notas ou automações de viagem/permanência. Alterações locais de expedição
  em andamento ficam fora desta publicação.
- Inclui backup JSON próprio, API pública de calendário, acesso por controle
  de cena/atalho configurável e carimbo opcional da data do jogo no chat.
- Licença e atribuição MIT da referência incluídas; não distribui assets
  externos nem substitui internals do Foundry.
- Prévia isolada conferida no navegador: mensal/compacto/anual, consulta como
  jogador, configurações, tema claro, formato 12 horas, incrementos rápidos
  e pausa por combate. Documentos da prévia são simulados.
- Validacao automatizada: 59 testes focados, 681 na instalacao local e 667
  na copia isolada da publicacao, todos aprovados; sintaxe de 155 modulos,
  14 arquivos JSON validos e paridade completa de idiomas.
- A pedido expresso do usuario, a validacao visual no servidor v13.351 fica
  a cargo dele. Nao foi aberto nem alterado um mundo online para testes.
  v14 e testes entre clientes distintos seguem pendentes de execucao real.

## Release v0.18.53 — 02/11/2026

- Limiar de Dor: PNJs e monstros mantem a queda nativa ao aplicar os efeitos
  do ataque, sem pergunta adicional. Dano, corrupcao e demais efeitos nativos
  permanecem no controle de aplicacao do GM.
- A escolha entre cair e conceder ataque livre fica restrita a ataques de PNJs
  contra personagens jogadores. Destinatarios: donos ativos da vitima ou GMs
  quando nao houver dono online; donos do atacante nao recebem essa escolha.
- Corrige a identificacao do atacante quando o Symbaroum registra o defensor
  como speaker do ataque de PNJ. Usa a introducao nativa PT/EN e prioriza o
  ator do token da cena, preservando PNJs nao vinculados. Identificacao ausente
  ou ambigua mantem os efeitos nativos, sem conceder ataque livre a outro ator.
- Testes de regressao cobrem as duas direcoes do ataque, PNJ controlado por
  jogador, jogador contra jogador, permissoes de GM, destinatarios, speaker do
  defensor em PT/EN e ator sintetico do token.
- Validacao: 48 testes focados, 653 na suite local e 639 na copia isolada
  de publicacao, todos aprovados; sintaxe de 149 modulos, 14 JSON validos e
  paridade de 1201 chaves de idioma na publicacao.
- Pendente: sessoes reais Foundry v13/v14, GM/jogador/confiavel, chat
  Ilustrado/Legacy, mensagens publicas/privadas/cegas e Dice So Nice. Ensaios
  automatizados usam documentos simulados; compatibilidade declarada preservada.

## Release v0.18.52 — 02/11/2026

- Ao sacar uma arma que excederia o limite de maos, oferece confirmacao de
  troca, com os nomes dos equipamentos envolvidos. Cancelar/fechar nao altera
  armas nem combate; confirmar atualiza os itens numa unica operacao.
- Preserva combinacoes validas, valida novamente a arma/estado/permissao apos
  o dialogo e evita janelas duplicadas por cliques repetidos.
- O Symbaroum HUD 0.1.90 acompanha a correcao: encaminha a acao para a API
  de prontidao antes de alterar o Item, permitindo cancelar sem ativar a arma.
- Testes locais: 642 aprovados no Ind Resources e 291 no HUD. A regressao
  cobre troca atomica, cancelamento, fechamento, nomes escapados, combinacoes
  validas, alvo removido/guardado, permissao e preservacao de iniciativa/turno.
- Copias isoladas de publicacao: 628 testes no Ind Resources e 269 no HUD,
  todos aprovados, sem incluir desenvolvimentos locais de calendario/expedicao
  ou de posicionamento/visibilidade do HUD.
- Validacao em sessoes reais Foundry v13/v14 entre GM/jogadores, chat
  Ilustrado/Legacy e Token Variants permanece pendente. Ensaios automatizados
  usam documentos simulados; compatibilidade verificada preservada.

## Release v0.18.51 — 02/11/2026

- Guardar todas as armas agora encerra automaticamente o encontro quando a
  remocao do personagem deixa a lista de combatentes vazia, tanto antes
  quanto depois do inicio do combate. Outros participantes preservam o encontro.
- A sincronizacao usa o executor unico do ator (GM ativo quando disponivel),
  evitando remocoes duplicadas entre jogadores e GMs. Somente um GM encerra
  o encontro pela API publica `Combat.delete`, a mesma usada pelo core ao
  confirmar o fim de combate, sem dialogo adicional.
- Regressao automatizada cobre encerramento, encontros com outros participantes,
  multiplos tokens, remocao cancelada, chegada de combatente durante a remocao,
  opcao desativada, jogador/confiavel/GM secundario, ausencia de GM e criacao
  de encontro ao sacar arma. Suite local: 627 testes e sintaxe de 150 modulos.
- Copia exata de publicacao: 613 testes aprovados, sintaxe de 148 modulos,
  14 arquivos JSON validos e paridade de 1199 chaves de idioma.
- Alteracoes locais de calendario e expedicao em andamento ficam fora da release.
- Pendente: validacao em sessoes reais Foundry v13/v14 entre GM e jogadores,
  com Token Variants ativo/ausente. Os ensaios automatizados usam documentos
  simulados; a compatibilidade verificada do manifesto permanece a existente.

## Release v0.18.48 — 20/10/2026

- Calendário: avanço automático de tempo (`CalendarClockRunner`) com controle de iniciar/pausar, suporte a pausa do Foundry, velocidade configurável (`calendarClockSpeed`, 0,01 a 86400 segundos do mundo por segundo real), exibição com segundos e editor de horário no próprio painel da barra lateral.
- Ficha de Grupo: ferramenta de busca rápida de integrantes por nome, atributos, habilidades e itens, com sugestões categorizadas, navegação por teclado e ordenação dinâmica por atributos.
- Ficha de Grupo: aba e controles de expedição restritos estritamente ao GM, com redirecionamento automático de jogadores para a aba de personagens.
- Metadados, manifesto e README atualizados para `0.18.48`; paridade de 1195 chaves de idioma mantida.

## Release v0.18.47 — 16/10/2026

- Janela completa do Calendário (ApplicationV2) com relógio analógico e digital em SVG, almanaque com fases da lua e estações do ano, controles de navegação e avanço de tempo mundial (±10m, ±1h).
- Integração com as tabelas oficiais de eventos diários do Master's Guide (GMG), resolvendo por IDs canônicos e descontinuando tabelas duplicadas geradas pelo módulo.
- Modificador inline de orientação na Ficha de Grupo exclusivo para GM com suporte a inteiros com sinal, sem necessidade de diálogo modal.
- Mateiro integrado na linha de identidade do guia da expedição.
- Menu de contexto (botão direito) no membro para opções de alimentação pelo grupo ou pessoalmente.
- Manifesto, metadados de desenvolvimento e README atualizados para 0.18.47; compatibilidade declarada e URLs de atualização mantidas.

## Release v0.18.44 — 16/10/2026

- Calendario de Symbaroum em todas as abas da lateral direita, com controles
  exclusivos de GM e exibicao compartilhada para jogadores.
- Integracao bidirecional com o tempo mundial via API publica do Foundry.
- Publicacao restrita ao calendario; alteracoes locais em viagem e expedicao
  nao fazem parte desta release.
- Identidade, URLs e compatibilidade declarada preservadas.
- Validacao da copia isolada: 524 testes passaram, sintaxe de 138 modulos
  JavaScript validada, 13 arquivos JSON validos e paridade completa de idiomas.
- Validacao visual, GM/jogador em clientes reais e integracoes com modulos
  temporais especificos pendentes. Esta entrega permite esses testes no Foundry.

## Release v0.18.43 — 15/10/2026

- Atualização instalável com os ajustes de estabilização, provisões, orientação
  e privacidade publicados no commit `3913045`.
- Manifesto, metadados de desenvolvimento e README usam `0.18.43`; ID, URLs
  de atualização e compatibilidade declarada permanecem os existentes.
- ZIP gerado do commit de release, com `module.json` na raiz, scripts, estilos,
  templates, idiomas, dados, assets, packs e avisos/licenças. Arquivos de
  desenvolvimento, caches e logs não entram no pacote.
- Os packs já rastreados são empacotados a partir do Git, sem leitura de bancos
  em uso nem regeneração de tabelas ou alteração dos mundos.
- Validação local: 515 testes e sintaxe de 135 módulos JavaScript. A conferência
  interativa desta entrega entre GM/jogador, DSN e Foundry v13/v14 permanece
  pendente; o release não amplia a compatibilidade verificada.
- Detalhes e limites de dados legados: [etapa A de expedições](EXPEDICOES-ETAPA-A-ORIENTACAO-E-PRIVACIDADE.md).

## Situação técnica

- O manifesto possui ID, sistema, dependência obrigatória, URLs estáveis,
  idiomas, ES module, CSS e pack declarados.
- A suíte automatizada cobre regras puras, estrutura, traduções, chat,
  recipientes, sockets, permissões, manobras, inventário, HUDs e dinheiro.
- O canal socketlib limita lote e tamanho, usa o identificador de remetente
  fornecido pelo transporte, valida ownership e aceita somente operações
  explícitas.
- Efeitos de manobra remotos aceitam apenas IDs, campos, flags e durações
  previstos pelo módulo.
- Mensagens HTML criadas pelo módulo escapam nomes e textos variáveis; o
  importador de Journal remove elementos e atributos executáveis.
- Não foram encontradas chamadas a `eval`, `Function`, credenciais embutidas,
  telemetria ou endpoints externos de runtime.
- `npm run validate` reproduz a validacao de sintaxe e a suite completa; o
  mesmo comando e executado pelo GitHub Actions em pushes e pull requests.

## Correcoes aplicadas nesta auditoria

- O socket de manobras deixou de aceitar efeitos arbitrarios enviados por um
  jogador que tivesse um NPC como alvo. IDs, operacao, campos, flags, duracao,
  movimento e documento existente agora usam listas fechadas e validacao
  contextual.
- Atualizacoes remotas de Combatant exigem GM ou propriedade do Actor; a mera
  selecao de um alvo nao concede essa autorizacao.
- Descricoes de municao publicadas no chat passam pelo sanitizador HTML publico
  do Foundry, com escape seguro como fallback fora do runtime.
- A API publica passa a existir durante `setup`, tanto no contrato moderno do
  pacote quanto no alias historico `game.tenebreResources`.
- Caminhos pessoais foram removidos da documentacao e do extrator de Journals;
  fontes locais de manutencao agora precisam ser informadas por variaveis de
  ambiente.
- O workflow de CI usa permissoes somente de leitura e Actions fixadas por
  commits imutaveis.
- Arquivos administrativos do pack LevelDB foram ignorados ou protegidos contra
  conversao de final de linha; a auditoria nao fez escrita direta no pack.
- Um script morto de uma linha, sem importacao ou consumidor, foi removido.

## Teste de runtime registrado

Em 28 de julho de 2026 foi executado um smoke test real em Foundry VTT v13
build 351, Symbaroum 6.1.6 e Symbaroum Ind Resources 0.16.2:

- o mundo iniciou com o modulo ativo e sem falha visivel de carregamento;
- chat, barra lateral, HUD e configuracoes do cliente foram renderizados;
- o manifesto e a dependencia socketlib apareceram corretamente na lista de
  modulos ativos;
- a sessao usada foi de jogador sem ator atribuido nem permissao sobre fichas.

Esse teste confirma o carregamento basico do cliente no ambiente descrito. Ele
nao substitui a matriz manual de GM/jogador, as operacoes em fichas, os modos
de chat, a reconexao nem um teste real no Foundry v14.

## Validações antes de cada release

1. Fechar o Foundry para impedir alterações administrativas no pack LevelDB.
2. Confirmar que `git status` não contém `LOCK`, `LOG`, `LOG.old`, `lost/`,
   `.log` de LevelDB, caches ou arquivos temporários.
3. Executar todos os testes em `tests/*.test.mjs`.
4. Validar sintaxe de todos os arquivos `.mjs`.
5. Validar JSON do manifesto, idiomas e arquivos em `data/`.
6. Conferir que inglês e português possuem as mesmas chaves.
7. Testar em runtime no Foundry v13 como GM e jogador.
8. Testar o fallback em runtime no Foundry v14 antes de declarar v14 como
   `verified`.
9. Gerar o ZIP com `module.json` na raiz e sem arquivos de desenvolvimento.
10. Conferir versão, tag, release, ZIP, manifest e download remoto.

## Riscos tecnicos ainda dependentes de runtime

- O sistema Symbaroum 6.1.6 usa fichas e dialogos legados de Application V1.
  Algumas integracoes do modulo precisam envolver metodos dessa implementacao
  para preservar o comportamento do sistema. Esses pontos possuem guardas,
  libWrapper quando disponivel e testes estaticos, mas precisam ser retestados
  quando o sistema migrar suas fichas.
- Os adapters cobrem diferencas conhecidas de contexto, efeitos visuais e menus
  entre Foundry v13 e v14. Nao existe, neste checkout, evidencia de um teste
  completo em runtime com sistema Symbaroum funcional na v14; por isso o
  manifesto permanece `verified: 13.350`.
- A reducao de Vitalidade de um NPC alvo por uma manobra e uma operacao
  intencionalmente mediada pelo GM via socket. O payload e limitado a uma
  reducao numerica no alvo atual, mas mesas hostis nao devem tratar a automacao
  de cliente como prova criptografica de que uma rolagem legitima ocorreu.

## Bloqueadores editoriais e jurídicos

Os itens abaixo não podem ser resolvidos apenas por teste de código:

- escolher e adicionar uma licença principal para o módulo;
- confirmar os nomes públicos e contatos dos autores no `module.json`;
- confirmar direitos de redistribuição de todo conteúdo do Adventure pack;
- confirmar autoria e atribuição de cada face de dado do Game-icons.net;
- substituir ou retirar `assets/midjourney/` e `assets/npcgeneration/` antes de
  uma nova submissão oficial, pois a política atual do Foundry não aceita
  imagens preparadas geradas por IA;
- revisar ou retirar `data/journal-import-manifest.json`, que contém texto de
  lore preparado e cuja autoria e licença precisam ser comprovadas;
- confirmar a licença do mapa em `assets/imported/symbaroumlore/images/Mapa.png`;
- tratar esta documentação e os demais textos preparados com assistência de IA
  como rascunho técnico: a redação final do README, manifesto, interface e
  página oficial precisa ser escrita e assumida pelos autores humanos;
- garantir que os mantenedores entendem, conseguem explicar, modificar e
  manter todo o código que será submetido.

Enquanto esses itens estiverem pendentes, o código pode ser disponibilizado no
GitHub conforme a licença escolhida, mas o pacote não deve ser declarado pronto
para a listagem oficial.

O mapa importado possui aproximadamente 11,4 MB e representa a maior parte do
tamanho atual do repositorio rastreado. Se o importador de Journals nao entrar
no release, remover esse asset do pacote reduz substancialmente o download.

Referencias oficiais usadas nesta revisao:

- https://foundryvtt.com/article/module-development/
- https://foundryvtt.com/article/package-management/
- https://foundryvtt.com/article/licensing-guide/
- https://foundryvtt.com/article/ai-policy/
