# Roadmap de Implementacao - Symbaroumlore e Tenebre Chronicle

## Objetivo

Levar o conteudo dos projetos locais **Symbaroumlore** e
**Tenebre Chronicle** para dentro do Foundry VTT como conteudo
nativo de Journal, sem depender dos sites externos durante a mesa.

O Foundry deve ser a experiencia principal para leitura, busca, edicao,
permissoes, links e apresentacao aos jogadores.

## Estado atual

### Concluido

- Extrator local para os dois projetos.
- Manifesto normalizado em `data/journal-import-manifest.json`.
- Copia local de assets importados para `assets/imported/`.
- Importador idempotente exposto em `game.tenebreResources.journalIntegration`.
- Criacao e atualizacao de `JournalEntry` e `JournalEntryPage` no mundo.
- Uso da sheet nativa `symbaroum.SymbaroumWide`.
- Conteudo textual embrulhado com classes visuais do sistema Symbaroum.
- Limpeza segura das pastas legadas vazias `Symbaroumlore` e
  `Tenebre Chronicle`.
- Testes automatizados cobrindo plano, importacao, formatacao, sanitizacao e
  limpeza de pastas.
- Documentacao do padrao visual dos Journals de Symbaroum.

### Limitacoes atuais

- A importacao atual escreve Journals no mundo, nao em compendio versionado.
- O conteudo ainda nao esta revisado editorialmente pagina por pagina.
- Links internos ainda nao foram resolvidos para UUIDs nativos.
- Personagens, NPCs, locais, itens e criaturas ainda nao estao vinculados a
  Actors, Items ou Scenes existentes.
- Permissoes estao em um modelo inicial, sem classificacao fina por nota.
- Nao ha dashboard proprio; a navegacao usa o diretorio nativo de Journals.
- Foundry v14 ainda depende de validacao futura do sistema Symbaroum compativel.

## Principios de implementacao

- O site externo e fonte de extracao, nao dependencia de runtime.
- O conteudo final deve ser Document nativo do Foundry.
- Symbaroumlore e lore versionado; Tenebre Chronicle e cronica editavel da mesa.
- Conteudo publico e segredo de GM devem ficar em Documents separados.
- Importacoes repetidas nao podem duplicar Journals nem pastas.
- Edicoes feitas dentro do Foundry nao devem ser sobrescritas sem comando
  explicito.
- Assets essenciais devem ficar em caminho estavel do modulo ou do mundo.
- Toda acao em massa precisa de relatorio, flags de origem e caminho de rollback.

## Roadmap

### Fase 1 - Estabilizacao do importador atual

Objetivo: tornar a importacao atual confiavel como base de trabalho.

Entregas:

- Revisar o manifesto gerado e corrigir nomes, secoes vazias e paginas
  genericas.
- Melhorar mensagens de erro para assets ausentes, sourceIds duplicados e
  paginas invalidas.
- Adicionar `dryRun` com relatorio completo antes de gravar no mundo.
- Registrar um `migrationRunId` por execucao que criou ou atualizou Documents.
- Criar comando de diagnostico para listar Journals importados, versao de
  formato, pastas e problemas encontrados.

Criterios de aceite:

- Segunda importacao nao cria duplicatas.
- Erros parciais aparecem no relatorio sem interromper todo o lote quando for
  seguro continuar.
- O GM consegue saber exatamente o que sera criado, atualizado, ignorado ou
  preservado.

### Fase 2 - Revisao editorial e visual

Objetivo: deixar o conteudo com leitura parecida com os Journals nativos do
Symbaroum, nao apenas convertido mecanicamente.

Entregas:

- Aplicar hierarquia editorial por tipo de conteudo: historia, local, faccao,
  criatura, sessao, personagem, NPC, arquivo e nota.
- Converter blocos de dados para `statblockcenter`, chamadas para `parahead` ou
  `fancytext`, e secoes principais para `heading2`.
- Padronizar nomes de paginas para navegacao lateral clara.
- Revisar imagens, `alt`, proporcao e posicionamento.
- Criar exemplos aprovados para uma pagina de lore e uma pagina de cronica.

Criterios de aceite:

- Journals importados abrem diretamente com a moldura, fundo, fontes e cabecalho
  do Symbaroum.
- Paginas longas ficam legiveis sem blocos quebrados ou texto solto demais.
- O conteudo nao parece pagina web colada dentro do Journal.

### Fase 3 - Symbaroumlore como compendio do modulo

Objetivo: transformar o Symbaroumlore em conteudo distribuivel, versionado e
pesquisavel via compendio.

Entregas:

- Criar pack de `JournalEntry` para lore.
- Gerar o pack a partir do manifesto, sem editar banco de compendio diretamente.
- Marcar origem com `sourceId`, `sourceHash`, versao de schema e versao de
  formato.
- Bloquear o pack por padrao e permitir importacao de copia editavel para o
  mundo.
- Separar conteudo autorizado para release publico de conteudo privado.

Criterios de aceite:

- O compendio abre em mundo novo.
- Entradas podem ser pesquisadas e importadas para o mundo.
- Atualizacao do modulo nao sobrescreve copias editadas no mundo.
- Nenhum conteudo sem autorizacao entra em release publico.

### Fase 4 - Tenebre Chronicle como cronica editavel no mundo

Objetivo: migrar a campanha para Journals de mundo, preservando edicao e
permissoes.

Entregas:

- Classificar sessoes, personagens, NPCs, arquivo e notas por visibilidade.
- Separar preparacao do mestre de conteudo publico.
- Criar modelo de ownership por categoria e por entrada.
- Preservar imagens e metadados de enquadramento em flags.
- Criar importacao inicial e politica de atualizacao posterior.

Criterios de aceite:

- Jogadores veem somente o conteudo publico ou compartilhado.
- GM ve e edita tudo.
- Notas secretas nao ficam escondidas apenas por CSS ou texto recolhido.
- Edicoes feitas no Foundry passam a ser a fonte de verdade da campanha.

### Fase 5 - Links nativos e relacoes

Objetivo: transformar o acervo em conteudo realmente integrado ao Foundry.

Entregas:

- Criar indice `sourceId -> UUID`.
- Resolver links entre Journals em segunda passagem.
- Ligar personagens e NPCs a Actors existentes quando houver correspondencia.
- Ligar locais a Scenes ou map notes quando existirem mapas.
- Ligar itens, poderes, rituais e criaturas a compendios oficiais quando ja
  existirem.
- Relatar links nao resolvidos sem criar duplicatas mecanicas.

Criterios de aceite:

- Links sobrevivem a reload e reconexao.
- O mesmo NPC, personagem ou local nao aparece como varias entidades
  contraditorias.
- Conteudo mecanico oficial nao e duplicado como texto divergente.

### Fase 6 - Fluxos de GM e jogador

Objetivo: validar o uso real em mesa.

Entregas:

- Testar abertura, busca, edicao, ownership e exibicao para jogadores.
- Testar criacao de novas notas dentro das pastas preparadas.
- Definir rotina para revelar arquivo, NPC ou sessao aos jogadores.
- Definir rotina para notas pessoais e notas compartilhadas.
- Documentar comandos de importacao, diagnostico e rollback.

Criterios de aceite:

- GM consegue preparar e conduzir sessao sem abrir os sites.
- Jogador consegue ler e editar apenas o que deveria.
- Mostrar Journal aos jogadores funciona sem expor paginas secretas.

### Fase 7 - Dashboard opcional

Objetivo: criar uma interface propria apenas se a navegacao nativa ficar
insuficiente.

Entregas:

- ApplicationV2 com abas de Lore, Sessoes, Personagens, NPCs, Arquivo e Notas.
- Filtros por categoria, status, visibilidade e relacao.
- Botoes que abrem Documents nativos.
- Nenhum banco paralelo de conteudo.
- Atualizacao por hooks publicos de Journal, com listeners registrados uma unica
  vez.

Criterios de aceite:

- Dashboard acelera a navegacao sem substituir Journals.
- Permissoes sao calculadas pelos Documents, nao por filtro visual.
- Desativar o dashboard nao remove nem corrompe conteudo.

### Fase 8 - Rollback, exportacao e manutencao

Objetivo: permitir manutencao segura do acervo depois da migracao.

Entregas:

- Relatorio persistido de cada execucao de importacao.
- Rollback por `migrationRunId`, apagando somente Documents criados por aquela
  execucao e preservando Documents alterados depois.
- Exportacao dos Journals da campanha para snapshot portavel.
- Comparacao de hashes para detectar novas versoes de origem.
- Diff antes de atualizar entradas ja existentes.

Criterios de aceite:

- Uma importacao ruim pode ser revertida com baixo risco.
- Atualizacoes futuras sao revisaveis antes de sobrescrever conteudo.
- O mundo continua operavel mesmo sem os sites originais.

### Fase 9 - Compatibilidade v14

Objetivo: validar o modulo quando houver base real do sistema Symbaroum
compativel com Foundry v14.

Entregas:

- Testar importacao em Foundry v13 e v14.
- Confirmar disponibilidade ou substituto da sheet `symbaroum.SymbaroumWide`.
- Criar adapter pequeno para sheet/formatacao se a API mudar.
- Validar Journals, pages, folders, ownership e compendios nas duas versoes.

Criterios de aceite:

- O mesmo manifesto importa corretamente nas duas versoes suportadas.
- A ausencia da sheet nativa falha de forma clara ou usa fallback documentado.
- A compatibilidade v14 so e declarada depois de teste real.

## Ordem recomendada

1. Estabilizar importador atual.
2. Revisar visual/editorial de uma amostra pequena.
3. Fechar modelo de permissoes do Tenebre Chronicle.
4. Criar compendio do Symbaroumlore.
5. Completar migracao da cronica para Journals de mundo.
6. Resolver UUIDs e relacoes com Actors, Items e Scenes.
7. Validar GM/jogador em mesa de teste.
8. Adicionar dashboard somente se a navegacao nativa nao bastar.
9. Planejar v14 quando o sistema Symbaroum tiver base compativel.

## Decisoes pendentes

- Quais secoes do Symbaroumlore podem ser distribuidas publicamente no modulo.
- Quais imagens podem ser redistribuidas e quais devem ficar apenas no mundo
  local.
- Quais notas do Tenebre Chronicle sao publicas, compartilhadas, pessoais ou
  segredo de GM.
- Quais personagens e NPCs ja possuem Actor correspondente.
- Se o primeiro release deve conter compendio completo ou apenas uma amostra
  validada.
- Se o site externo sera mantido como exportacao secundaria ou arquivado.

## Proximo marco recomendado

O proximo marco deve ser uma versao piloto revisada manualmente:

- 3 entradas de Symbaroumlore: uma historia, um local e uma faccao.
- 1 sessao publica do Tenebre Chronicle.
- 1 nota secreta de preparacao do mestre.
- 1 personagem ou NPC ligado a Actor existente.
- 1 imagem importada e validada.

Esse piloto deve ser testado como GM e jogador antes de expandir para todo o
conteudo.
