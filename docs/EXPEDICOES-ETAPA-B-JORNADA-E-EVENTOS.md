# Etapa B — jornada, esforço e eventos

Implementação local de 16/10/2026, sobre o release 0.18.43. Sem nova versão, publicação ou atualização dos bancos de compêndio. O calendário desenvolvido em paralelo foi preservado; esta etapa não avança datas nem relógios.

## Uso na ficha

A aba Expedição possui o painel **Jornada e permanência**. **Configurar jornada** define atividade, ritmo, rio, local, participantes e montarias. A região continua vindo do campo existente do Grupo. Não há gravação durante a renderização.

Na atividade de viagem, **Resolver esforço** cria uma prévia. O GM revisa os valores individuais e usa **Revisar e aplicar esforço**. O dano e a permissão de cura não são aplicados pelo simples sorteio. Detecção e permanência têm ações próprias. O GM também pode escolher um resultado existente de uma tabela pelo botão de escolha em cada categoria.

## Regras e decisões aplicadas

Fontes: [levantamento dos livros](EXPEDICOES-REGRAS-E-FONTES.md), especialmente GM pp.90, 97–99, GAJ p.54 e pp.107–108.

| Tema | Comportamento |
|---|---|
| Velocidades | Mantidas as 18 velocidades existentes. Selvagem usa a coluna Iluminada, conservando sua região real. |
| Rio | Melhora uma coluna de velocidade. Em Davokar acrescenta +2 em Terreno, segundo o GM PT-BR consultado; não reduz Mateiro nem os modificadores regionais. |
| Busca ativa | Com a regra opcional adotada, só fica efetiva no ritmo normal e durante viagem. Em ritmo superior, Ruínas recebe −5 e não recebe o bônus de orientação. A preferência original não é apagada ao mudar de ritmo. A regra pode ser desativada explicitamente na configuração. |
| Participantes | Seleção explícita de atores do Grupo, incluindo companheiros e guia. Não exclui PNJs por serem tecnicamente `monster`. O mais lento limita a distância. Participantes ausentes, falta de montaria ou impedimentos bloqueiam a prévia. |
| Cavalgada | A montaria deve ser identificada. Fome e carga da montaria afetam a velocidade. Seu inventário deve representar a carga transportada; não se inventa peso corporal para o cavaleiro nem se deduz montaria pelo tipo do ator. Cada participante selecionado recebe sua resolução individual de esforço; o GM deve incluir/excluir montarias e viajantes conscientemente. |
| Fome | Reduz a velocidade de viagem à metade quando as opções existentes estão ativas. A integração de chances conserva a política documentada na etapa A. |
| Sobrecarga | Usa o cálculo de carga existente. Aumenta o esforço em um patamar, sem aumentar a velocidade. Impede marcha mortal verdadeira e deslocamento longo acima do limite. O excesso penaliza Vigoroso quando há teste de esforço mortal. As opções existentes de carga/movimento são respeitadas. |
| Marcha forçada | Bloqueia cura natural. Marcha Duradoura permite cura ao próprio portador e teste de Vigoroso aos companheiros. A permissão dos companheiros precisa ser revisada/aplicada antes do descanso. |
| Marcha mortal | Propõe a perda básica de 1 e, na falha de Vigoroso, mais 1d6. Marcha Duradoura dispensa o teste do portador e concede uma segunda chance aos companheiros, conservando a perda básica. |
| Resultado 20 | É marcado como ferimento mortal. O GM pode deixá-lo pendente para resolução manual ou escolher explicitamente Vitalidade 0, acionando o procedimento normal do sistema. Não se presume equivalência com três falhas de morte nem morte instantânea de todo tipo de ator. |
| Detecção | Usa o maior Vigilante entre PJs/guia participantes elegíveis, com o modificador da linha do encontro. Sucesso abre as escolhas de esconder-se, emboscar ou outra abordagem; não inicia combate. Dádivas de orientação não são somadas indiscriminadamente a detecção. |
| Permanência | Conta dias consecutivos no local. Do segundo dia em diante, resolve o maior Discreto; falha consulta Inimigos sem desconto de orientação. Orientação e descoberta diária de novas ruínas ficam reservadas à viagem; escolha manual de ruína pelo GM permanece disponível. Escavação continua na etapa E. |

**Política explícita de permanência:** a consulta provocada por falha de Discreto não sobrescreve o resultado diário de Inimigos. A interface informa que a consulta é própria e permite desativar a rolagem diária geral nesse modo. Isso deixa visível a decisão sobre a interação dos dois procedimentos, sem duplicar risco por interpretação oculta.

**Tabelas personalizadas:** detecção automática exige um único resultado com `flags.symbaroum-ind-resources.detectionModifier` numérico, entre −20 e +20. Para a tabela canônica, são usadas as oito linhas já conferidas no GM. Não se adivinha o modificador de uma tabela customizada pela posição de sua faixa. Resultados aninhados ou múltiplos continuam exigindo condução do GM.

## Integração, privacidade e persistência

- Grupo e marcadores de seus participantes usam a mesma configuração durante uma expedição configurada e ativa. Marcadores avulsos mantêm suas flags anteriores; o movimento tático não foi alterado. O HUD de um marcador vinculado informa que ritmo/rio pertencem ao Grupo e não oferece editar a região por uma coluna de velocidade.
- A jornada usa a referência canônica dos atores e resolve vínculos de token/compêndio. Para aplicar esforço, o ator precisa ser modificável no mundo; um modelo de compêndio deve ser importado. Participação em mais de uma jornada ativa impede aplicação ambígua de esforço.
- A configuração persiste ao trocar o dia. Testes e resultados diários são limpos pelo mecanismo existente; um novo início reinicia a contagem de permanência. Navegar no contador não desfaz dano nem equivale a uma viagem ou descanso resolvido.
- Estado relevante recebe uma impressão para detectar alterações de contexto; os atributos usados não são copiados para o Grupo nessa impressão. Resultados preparados sob outro contexto são sinalizados e deixam de fornecer benefícios automáticos.
- As novas ações são autenticadas e executadas no GM designado, usando a fila do Grupo. Jogadores não enviam dano, atributos ou texto de resultado para aplicação privilegiada.
- Esforço completo é guardado no armazenamento controlado pelo GM mesmo quando seu cartão é público. O Grupo recebe uma referência, evitando que um resultado editável seja usado como cálculo privilegiado de dano. As permissões de leitura seguem o modo escolhido.
- Detecção herda a privacidade de orientação/encontro. Pais com públicos privados diferentes restringem a resolução aos GMs. Um jogador sem leitura dos pais não pode sondar o sucesso de uma orientação cega tentando disparar detecção.
- Escolhas manuais não fabricam dados de rolagem. Se herdarem modo cego, o cartão usa o GM como autor para que a visibilidade nativa de mensagens sem dados não revele o resultado ao autor jogador da orientação.
- A aplicação revalida os participantes e sua Vitalidade antes da primeira escrita. Cada ator recebe a perda e um recibo na mesma atualização. Repetições após falha na gravação do Grupo reconhecem o recibo e não cobram o dano novamente. Operações parcialmente aplicadas não podem ser rerroladas para gerar nova cobrança.
- A permissão de cura natural é uma consequência consultável após a aplicação pelo GM; os dados privados do teste continuam no armazenamento restrito. Descansos continuam sujeitos a Fome e às demais regras existentes.

Não existe transação única entre vários atores, chat e compêndio. Uma falha de integração após a primeira escrita pode exigir revisão manual; recibos protegem a repetição, sem prometer reversão automática. Mudanças de contexto após aplicação parcial bloqueiam uma reaplicação incompatível.

## Validação e pendências

Os testes novos verificam composição de rota/ritmo, as opções existentes, carga, Fome, montarias, configuração e propriedade, resultados manuais, esforço e revisão de ferimentos, cura, recibos, concorrência, privacidade, detecção, permanência e invalidação de preparações.

Validação local: **210 testes focados aprovados** e **564 testes na suíte completa aprovados**, sem falhas ou testes ignorados. A suíte completa também inclui os testes do calendário desenvolvido em paralelo. A gravação protegida revalida o contexto após a espera pelo compêndio; uma configuração alterada durante essa espera não recebe um resultado obsoleto.

Também passaram a validação de sintaxe dos 141 módulos JavaScript, a compilação do template da ficha, a leitura de JSON do manifesto e idiomas e a conferência de paridade das chaves de tradução. `git diff --check` não indicou erros de espaços ou conflitos.

Continuam pendentes ensaios reais em Foundry v13/v14, GM/jogador/jogador confiável e dois GMs; chat Ilustrado/Legacy; DSN ativo/ausente; recarga do mundo; ator sintético, compêndio e cenas reais em quilômetros; idiomas e disposição visual do painel; hooks de morte e efeitos de terceiros após aplicar perda de Vitalidade. Testes com documentos simulados e compilação de template não equivalem a esses ensaios.

Continuam fora desta etapa: coleta, classificação de alimentos, entrada em Fome por dias deficitários, integração alimentar de vários dias de descanso, consequências persistentes dos Infortúnios, natureza corrompida, escavação e preparação financeira. Capacidades simplificadas de transportes e animais não foram recalculadas.

## Distribuição para teste — 0.18.45

Release de 16/10/2026 preparada a pedido do usuário para teste no Foundry da nuvem. Inclui a etapa B e conserva o calendário já publicado em 0.18.44. Novas alterações locais do calendário não entram neste pacote.

A árvore exata de distribuição passou novamente pelos 564 testes, sem falhas ou testes ignorados, e pela validação de sintaxe. A compatibilidade declarada e os bancos de compêndio foram preservados. Validação interativa no Foundry continua pendente.
