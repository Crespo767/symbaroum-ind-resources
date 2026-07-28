# Preparação para publicação pública

Este documento registra o estado técnico verificado antes da publicação do
Symbaroum Ind Resources. Ele deve ser atualizado a cada release pública.

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
