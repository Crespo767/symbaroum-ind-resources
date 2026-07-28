# Symbaroum Ind Resources - memoria operacional

Esta nota resume a leitura do modulo, do sistema Foundry `symbaroum` 6.1.6 e dos textos locais do Livro Basico e Guia Avancado do Jogador. Ela e uma referencia de trabalho para evoluir o modulo sem depender de reler tudo a cada alteracao.

## Escopo do modulo

- Modulo Foundry VTT v13 para o sistema `symbaroum`.
- Entrada principal: `scripts/init.mjs`.
- API publica interna: `game.tenebreResources`.
- Estado persistente proprio: `flags.symbaroum-ind-resources`.
- Areas implementadas: Pao de Viagem, aljavas/municao, recuperacao de projeteis, projeteis especiais, Fome, Descanso, Sobrecarga, containers e HUD perto da hotbar.

## Referencias locais lidas

- O codigo do proprio modulo.
- A instalacao local do sistema `symbaroum` 6.1.6 para Foundry VTT v13.
- Copias locais licenciadas do Livro Basico e do Guia Avancado do Jogador.

Os caminhos pessoais usados durante a pesquisa nao fazem parte do projeto
publico. Os livros nao sao redistribuidos por este repositorio.

## Regras importantes dos livros para este modulo

- Pao de Viagem: no Livro Basico, uma unidade equivale a uma semana de suprimento de comida para uma pessoa. O default do modulo de 7 usos por unidade esta alinhado.
- Cura natural: no Livro Basico, cura natural e 1 ponto de Vitalidade por dia. Marcha/cavalgada forcada impede cura normal; marcha/cavalgada mortal causa perda de Vitalidade e teste de Vigoroso para evitar dano extra.
- Sobrecarga: no Guia Avancado, e regra opcional. Capacidade basica igual a Vigoroso; acima disso, cada item extra aplica -1 em Defesa; acima do dobro de Vigoroso o personagem quase nao consegue se mover. Transportador usa Vigoroso x 1,5, arredondado para baixo.
- Sobrecarga e itens: recipientes leves nao contam por si, so conteudo; recipientes volumosos contam por si e somam conteudo; objetos pequenos contam em lotes de 50; armadura vestida usa Obstrutiva em vez de contar como carga; arma segurada nao conta; arma carregada conta; Macica conta como dois itens.
- Recuperacao de flechas/virotes: no Guia Avancado, regra opcional. Projeteis comuns quebram em resultado maior que 10 no d20; com qualidade quebram acima de 15; com qualidades misticas quebram acima de 17. O modulo modela isso como recupera com `<= 10`, `<= 15`, `<= 17`.
- Flechas/virotes especiais: Guia Avancado lista Arpeu, Cabeca de Martelo, Cauda de Andorinha Sangrenta, Cortador de Corda, Flecha Flamejante, Flecha de Laco, Flecha de Precisao, Ponta Perfurante de Armadura e Sibilante. Flecha Certeira e Raio Atordoante entram como elixires/alquimicos.
- Manobras: no Guia Avancado, sao regra alternativa. Agarrar usa `[Vigoroso<-Vigoroso]`; Robusto soma +2/+4/+8 para quem agarra e tambem favorece o alvo Robusto; sucesso prende, falha abre Ataque Livre e manter o agarramento impede outras acoes. Desarmar usa `[Preciso<-Vigoroso]`, nao causa dano, sucesso faz largar arma/escudo e falha abre Ataque Livre. Nocaute exige ataque com Vantagem antes; no lugar do dano rola `1d12`, e se o resultado for menor que o dano o alvo fica inconsciente. Defesa Total da segunda chance em Defesa e impede ataques no turno. Ofensiva Total da segunda chance em ataques corpo a corpo e segunda chance de falhar em Defesa no turno. Empurrao deve iniciar o turno e gastar acao de combate e movimento; no sucesso causa metade do dano e empurra 5 metros; falha abre Ataque Livre. Veneno em Armas usa Teste de Astuto para aplicar uma dose a um unico golpe; resultado 20 envenena o usuario.
- Automacao de efeitos das manobras: Adiar a Iniciativa aplica `Iniciativa Adiada`; Agarrar aplica `Agarrado` no alvo e `Mantendo Agarrar` no ator; Desarmar aplica `Desarmado` no alvo ou `Aberto a Ataque Livre` no ator se falhar; Defesa Total aplica `Defesa Total`; Empurrao aplica `Empurrado` no alvo e metade do dano informado, ou abertura se falhar; Encontrão aplica `Derrubado` no alvo se vencer e no ator se falhar no teste de Rapido; Investida aplica `Investida` no ator e abertura se falhar; Mira Cuidadosa aplica `Mira Cuidadosa`, da favor no proximo ataque a distancia e consome o efeito apos a rolagem; Nocaute aplica `Nocauteado`; Ofensiva Total aplica `Ofensiva Total`; Veneno em Armas aplica `Arma Envenenada`, aplica `Envenenado` no alvo quando acertar e consome o efeito; Tomar a Iniciativa aplica `Tomando a Iniciativa` sempre, e `Iniciativa +5`/bonus no combate se o teste passar.
- Fome: a implementacao atual parece ser uma regra de mesa/modulo inspirada em viagem, privacao e cura natural, nao uma regra oficial exatamente igual encontrada nos trechos relevantes dos livros.

## Pontos tecnicos do sistema Foundry/Symbaroum

- Sistema instalado: `symbaroum` 6.1.6, Foundry v13.
- As sheets do sistema ainda estendem `foundry.appv1.sheets.ActorSheet` / `ItemSheet`.
- Classes relevantes do sistema: `PlayerSheet`, `SymbaroumActorSheet`, `SymbaroumItemSheet`.
- `rollWeapon(weapon)` chama `enhancedAttackRoll(weapon)` quando `game.settings.get("symbaroum", "combatAutomation")` esta ativo; caso contrario chama `prepareRollAttribute`.
- O dialogo de combate usa `systems/symbaroum/template/chat/dialog.hbs` e processa `weaponModifiers.package`.
- Constantes do sistema relevantes: `game.symbaroum.config.TYPE_ROLL_MOD`, `DAM_MOD`, `STATUS_DOT`, `PACK_DEFAULT`.

## Riscos/atencoes para proximas alteracoes

- O modulo mistura APIs antigas (`Dialog`, `ui.windows`, appv1 sheets) com APIs v13 (`DialogV2`, `ApplicationV2`, `foundry.applications.instances`). Testar sempre dentro do Foundry aberto.
- Wrappers diretos em prototipos (`rollWeapon`, `Dialog.prototype.render`, `prepareDerivedData`, `_getHeaderButtons`, `ContextMenu.prototype.render`) sao areas frageis.
- A injecao de UI depende bastante do DOM do sistema (`data-item-id`, `.quantity`, `.equipments`, `.damagemodifier`). Mudancas no sistema podem quebrar exibicao sem quebrar o console.
- O arquivo `data/encumbrance-weights.json` deve continuar sendo validado com nomes PT/EN e normalizacao de acentos. Correspondencias exatas vindas do JSON podem falhar se houver problema real de encoding.
- A regra de Fome deve ser documentada como opcional/de mesa, salvo se for ajustada para alguma regra oficial especifica.
