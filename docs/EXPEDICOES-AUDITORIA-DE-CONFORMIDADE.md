# Auditoria de conformidade: expedições

Data: 15/10/2026. Versão declarada do módulo: 0.18.42, com os três lotes locais de estabilização ainda não publicados. O código examinado é o instalado, incluindo esses ajustes. As conclusões abaixo não se referem apenas ao último release ou ao texto do README.

**Atualização posterior ao diagnóstico:** orientação e armazenamento privado foram tratados na [etapa A](EXPEDICOES-ETAPA-A-ORIENTACAO-E-PRIVACIDADE.md). Jornada compartilhada, rio, busca ativa, esforço, detecção e permanência foram tratados localmente na [etapa B](EXPEDICOES-ETAPA-B-JORNADA-E-EVENTOS.md), em 16/10/2026. Ambas possuem testes locais e aceitação em runtime pendente. Este documento preserva o diagnóstico anterior; alimentos e etapas C–F continuam abertos.

## Resultado

**A automação é parcialmente compatível com o Guia do Mestre.** Há bases numéricas corretas, mas orientação, recursos, deslocamento e resolução do dia ainda não constituem um procedimento integrado fiel ao livro. Os testes técnicos existentes também contêm expectativas que precisam ser revistas contra as fontes.

As fontes e suas páginas estão descritas em [EXPEDICOES-REGRAS-E-FONTES.md](EXPEDICOES-REGRAS-E-FONTES.md). Este diagnóstico não modifica as mecânicas. O trabalho de implementação proposto está em [EXPEDICOES-PLANO-DE-AUTOMACAO.md](EXPEDICOES-PLANO-DE-AUTOMACAO.md).

## Método e alcance

- Leitura do capítulo de expedições e de suas notas laterais, confrontada com GAJ, LB e CM nos assuntos referenciados.
- Conferência visual das tabelas principais e dos quadros de orientação, Fome, carga e natureza corrompida.
- Leitura de `party-actor.mjs`, `expedition-data.mjs`, `expedition-state.mjs`, `rations.mjs`, `item-flags.mjs`, `hunger.mjs`, `rest.mjs`, `movement-ruler.mjs`, `encumbrance.mjs`, dados de pesos e pontos de integração em `init.mjs`.
- Comparação com o contrato do sistema Symbaroum 6.1.6, incluindo a ficha de benefícios, `system.level`, `baseRoll` e opções nativas de críticos/sucesso automático.
- Onze verificações locais sobre funções reais e dados do módulo: seis concordâncias e cinco divergências. Elas são evidência de funções e fórmulas, não sessões reais do Foundry.
- Suíte existente reexecutada: **484 testes aprovados, zero falhas**. Isso demonstra ausência de falhas na suíte atual, não conformidade total com os livros.

Nenhum livro, mundo, ator, inventário, tabela importada ou banco de compêndio foi alterado durante este estudo. Não houve teste interativo entre GM e jogador, nem validação de runtime em v14.

## O que está de acordo

| Tema | Código / fluxo | Conferência |
|---|---|---|
| Velocidades | `TRAVEL_RATES_KM_PER_DAY` em `movement-ruler.mjs` | As 18 entradas correspondem ao GM p.90 / LB p.184 |
| Selvagem para movimento | Perfil compartilhado `brightDavokar` | Correto compartilhar a velocidade com Iluminada; não seria correto compartilhar automaticamente os demais riscos |
| Rio e velocidade | `getTravelRate` | Reduz um patamar de dificuldade para o deslocamento, como GM pp.89–90 |
| Região e eventos | `calculateDavokarEventModifiers` | 0/+2/+5 para as quatro tabelas, como GM p.97 |
| Região e Infortúnios | `getMishapsModifier` | 0/+5/+10, como GM p.92 |
| Quatro tabelas | Eventos separados em Ruínas, Encontros, Inimigos, Terreno | Estrutura correspondente ao procedimento do GM pp.97–99 |
| Faixas centrais | Arrays de eventos em `expedition-data.mjs` | A conferência por resultados de 1 a 25 corresponde às tabelas; extensões numéricas além disso precisam ser identificadas |
| Conteúdo de Infortúnios | Lista de 30 incidentes | Corresponde em grande parte ao texto das pp.92–94; o nome “Tabela 25” e certas referências de página estão errados |
| Pão de viagem | Regra de sete usos | Confere com GM p.90 / LB p.153 |
| Bônus normais | +2 Ruínas; -1/-2 Inimigos/Terreno | Números corretos **quando o guia é elegível, a margem é correta e a busca opcional permite o bônus** |
| Fome já aplicada | Bloqueio de cura natural e teste de inanição com duas chances de falhar | Compatíveis com o quadro do GM p.90 para o caso simples, sem outras chances/bônus em disputa |
| Carga comum | Vigoroso, Transportador com arredondamento e excesso | Base correspondente ao GAJ p.107; isso não valida todos os pesos, exceções e integrações |
| Segurança da operação | Executor GM, autenticação, filas e revisão do dia | Proteções técnicas úteis; não são regras do livro e não corrigem por si só as divergências abaixo |

## Divergências reproduzidas

| ID | Caso observado | Regra de referência | Impacto e correção proposta |
|---|---|---|---|
| C05 | Mateiro I, Escura, Vigilante 12, resultado 6: alvo 7 e sucesso com +2 Ruínas/-1 Inimigos/-1 Terreno | GM p.92: pode evitar Infortúnio com -5, mas não recebe os bônus normais | Separar `avoidsMishap` de `grantsEventBenefits`; o resultado correto evita o Infortúnio e deixa esses três bônus em zero |
| C06 | Resultado 1, alvo 5, margem 4: recebe a redução -2 de grande sucesso | GM pp.98–99 exige diferença de pelo menos cinco para -2 | Resultado 1 não pode substituir a verificação da margem; críticos nativos são outro assunto |
| C07 | Contexto de rio na Iluminada, sem orientação: `terrain.totalMod` continua 0 | GM PT-BR p.97 manda +2 na Tabela 29 ao viajar por cursos d'água | Conectar rota à composição dos modificadores de eventos, preservando a edição adotada |
| C09 | Item genérico `Ração` é reconhecido com sete usos por unidade | GM p.92: provisão ordinária corresponde a um dia; pão de viagem tem a regra semanal própria | Classificar o alimento explicitamente; não promover nomes genéricos a pão de viagem |
| C10 | Token com Fome, marcha normal na Iluminada, distância de 20 km: régua estima um dia | GM p.90 reduz o movimento à metade; nesse caso a estimativa seria dois dias | Levar a condição à estimativa de viagem; a aplicação tática existente não atende esse caminho |

O caso C09 depende de a ração representar provisão ordinária, como no exemplo. Se a mesa usa o nome como sinônimo deliberado de pão semanal, essa escolha precisa ser conservada e declarada, não inferida para todos os alimentos.

As verificações favoráveis foram: C01, velocidades; C02, rio para velocidade; C03, Infortúnios por região; C04, eventos por região; C08, duração do pão; C11, faixas das tabelas. Os resultados e hashes dos arquivos examinados foram registrados no artefato local `conferencia-codigo.json`, fora dos arquivos distribuídos do módulo.

## Outros problemas comprovados por leitura do fluxo

### Prioridade 1: corrigir a regra aplicada

| ID | Constatação | Evidência no código | Fonte / ação |
|---|---|---|---|
| E01 | Guia sem Mateiro ainda pode tentar e receber benefícios | `calculateBushcraftPenalty` transforma nível zero em penalidade; `rollOrientationAsAuthority` valida propriedade, mas não a elegibilidade mecânica | GM p.92 exige ao menos I para a tentativa de evitar Infortúnio; validar antes de rolar |
| E02 | Orientação é um `1d20` direto | `performOrientationRoll` não compõe Desbravador, Cartógrafo, Dedo Verde e demais fontes; não usa o caminho de testes em que o módulo injeta Fome | GM p.92 / GAJ p.52 / GM p.90; criar resolução contextual compatível com as opções nativas |
| E03 | Opções nativas de teste são contornadas | `calculateOrientationTarget` força mínimo 1; avaliador não consulta `alwaysSucceedOnOne`, `optionalCrit` ou `optionalRareCrit` | O sistema instalado ajusta alvo conforme suas opções; reutilizar o contrato sem duplicar settings |
| E04 | Procura ativa não é ligada ao ritmo de viagem | `activeSearch` é independente do perfil/marcha do token | GM p.98: se a regra opcional for adotada, não pode ser busca ativa a ritmo acima do normal |
| E05 | Provisões ordinárias também precisam de peso próprio | Os aliases genéricos de ração entram na regra de pão, e a tabela de pesos contém `ration/rations = 1` | GM pp.90–92: 1 para pão semanal; 0,5 para ração ordinária. Preservar personalizações explícitas |
| E06 | Orientação em nível insuficiente e margem baixa alteram a distribuição dos eventos | Casos C05/C06 | Corrigir os critérios antes de recalibrar tabelas ou propor probabilidades novas |
| E07 | Resultados secretos ficam no documento compartilhado do Grupo | Orientação e eventos são copiados para `system.expedition.dayState` e flags | Requisito técnico de privacidade já aberto na estabilização; separar os resultados restritos do resumo público, sem confiar apenas em ocultar HTML |

E02 não significa que todo bônus precise ser somado novamente. Se um efeito já alterou `attributes.vigilant.total`, ele não deve ser aplicado duas vezes. O problema é a ausência de uma composição contextual rastreável e das chances adicionais, não a obrigação de acrescentar um número fixo indiscriminadamente.

### Prioridade 2: completar o procedimento diário

| ID | Lacuna | Consequência atual | Fonte / requisito |
|---|---|---|---|
| E08 | Coleta diária com Mateiro não existe no fluxo do Grupo | Não há a atividade de 1d6/1d10, seu teste e vínculo com deslocamento | GM p.92 |
| E09 | Fome depende de aplicar a condição manualmente | Não há contador de dias sem comida / alimentação reduzida que determine o início | GM p.90; explicitar as ambiguidades de racionamento |
| E10 | Ritmo só fornece estimativa de distância | Não aplica o impedimento de cura, a perda básica, o teste e o dano da marcha mortal, nem Marcha Duradoura | GM p.90 / GAJ p.54 |
| E11 | Sobrecarga não compõe o esforço da expedição | Carga afeta a ficha e o movimento tático, mas não o procedimento de viagem longa | GAJ pp.107–108 |
| E12 | Avançar o dia limpa o estado sem resolver o dia | `_onNextExpeditionDay` não relaciona alimentação, tempo, viagem, condições e consequências | Deve existir uma resolução distinta de simplesmente navegar no contador |
| E13 | Descanso pode consumir provisões de um período que já foi alimentado por outro caminho | Consumo pessoal, alimentação do Grupo e `applyRest` não compartilham um registro único de dias alimentados | Definir que período cada ação representa antes de impedir ou autorizar novo débito |
| E14 | Fome e cura não evoluem dia a dia numa sequência integrada | `applyRest` considera a condição presente no começo de todo o bloco; não acompanha refeições ou mudança de situação durante os dias | Resolver cada dia na ordem escolhida e registrada pela mesa |
| E15 | Todos os companheiros do tipo técnico `monster` são excluídos da alimentação | `getData` pula `comp.isMonster`, além dos rótulos de animal | PNJs humanos e outras criaturas representadas nesse tipo podem precisar de comida; definir dieta por participante |
| E16 | Detecção antecipada termina em um indicador | O código calcula `earlyDetection`, mas não resolve o teste com o melhor Vigilante elegível e o modificador da linha sorteada | GM pp.98–99 |
| E17 | Permanência no mesmo lugar não é um modo próprio | Não há teste diário do maior Discreto a partir do segundo dia e seu resultado sem bônus de orientação | GM pp.98–99; registrar política de interação com a rolagem diária geral |
| E18 | Infortúnios são textos publicados | Perdido, animais doentes, comida estragada, contaminação e outros não criam os estados/testes correspondentes | GM pp.92–94; automatizar os componentes objetivos e manter as escolhas do mestre |
| E19 | Natureza corrompida não encadeia o CM | O resultado diz quantas rolagens fazer, mas não as executa nem administra proteções/limites | GM p.99 / CM pp.74–77 |
| E20 | Escavação e limite de achados não são acompanhados | Ruína aparece como resultado diário; não há local persistente, cota, testes por participante e saque remanescente | GM pp.98, 100–107 |
| E21 | Estado perde o contexto no dia seguinte | Perdas de direção, corrupção retida, contaminação e histórico não cabem apenas no `dayState` limpo | Separar estado diário, consequências persistentes e histórico de operações |

Não implementar um subsistema é diferente de implementar uma regra errada. E08–E21 identificam o que falta para a automação completa desejada; nem todos são regressões de funcionalidades já existentes.

### Prioridade 3: procedência e pontos sem sustentação suficiente

| ID | Tema | Avaliação |
|---|---|---|
| E22 | “Tabela 25 — Infortúnios” | Referência incorreta nesta edição. Tabela 25 é de Guias dos Ermos, p.96; os Infortúnios são a lista numerada das pp.92–94. Corrigir o rótulo/referência preservando IDs e UUIDs existentes |
| E23 | Páginas indicadas como 91/95/100/115 | Há referências incorretas nos comentários e metadados. Usar a numeração impressa e registrar a correspondência do PDF |
| E24 | Presets “oficiais” de transporte e recipientes | 200/500 para carroças, 60/120/600 para embarcações, 100 para boi e capacidades de baús/barris não foram comprovados nas passagens examinadas. Classificar como valores do módulo/mesa até haver fonte, sem destruir configurações |
| E25 | Recuperação de Vigoroso por Fome | O módulo oferece recuperação natural e um serviço de recuperação por curas; o quadro do GM p.90 não fornece essas regras. A descrição se aproxima das doenças do CM p.169, o que não autoriza transferi-la para Fome |
| E26 | Generalização de alimentos adicionais | Usos e categorias configuráveis são úteis, mas uma bebida ou item gastronômico não é automaticamente uma ração completa segundo o capítulo 12 |
| E27 | Extremos das tabelas e tabelas personalizadas | `drawTableResult` pode usar extremos, recuperar entradas marcadas como sorteadas e recorrer a `roll()`. Isso não respeita necessariamente uma tabela customizada sem reposição, com lacunas ou resultados aninhados |
| E28 | Limite 35 em certas faixas | Ruínas, Encontros e Terreno têm limites abertos no livro; Inimigos termina em 25. O +1 de informação enganosa pode levar Inimigos a 26 com a região Escura. A fonte deixa um caso de borda a arbitrar; estender até 35 não deve ser descrito como transcrição literal |
| E29 | Incidentes repetidos / consultas extras | `De Mal a Pior`, `Covil do Mal` e natureza corrompida precisam de encadeamento próprio; recursão, exaustão de tabelas e intervenções devem permanecer auditáveis |

## Impacto nos testes

Os testes atuais verificam funções e contratos que foram implementados anteriormente. Alguns reproduzem os mesmos pressupostos do código, como níveis insuficientes recebendo bônus ou um 1 natural ser “grande sucesso”. Portanto, sua aprovação não soluciona E01–E06.

Na implementação, os cenários devem vir das páginas verificadas, com resultado esperado independente da fórmula em produção. Não corrigir um teste apenas para aceitar o comportamento atual.

Casos mínimos: sem Mateiro; três níveis nas três regiões; sucesso insuficiente sem bônus; margem 4 versus 5; benefícios e Fome combinados; busca ativa em marcha rápida; rio com região real preservada; ração comum versus pão; alimentação e descanso no mesmo período; estados persistentes após virar o dia; permanência e escavação; cada modo de privacidade; jogador dono apenas do guia.

## Limites desta conclusão

As faixas e os principais efeitos mecânicos das tabelas foram comparados. Isso não equivale a revisão editorial palavra por palavra de todo o conteúdo empacotado, a validação de todos os pesos da base de equipamentos ou a certificação de suplementos ainda não examinados.

O estudo encontrou referências suficientemente claras para iniciar as correções de orientação e recursos. Já as ambiguidades listadas no documento de regras devem permanecer explícitas. Nem o fato de uma constante ter `OFFICIAL` no nome nem uma suíte verde transforma uma decisão de implementação em regra publicada.
