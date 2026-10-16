# Estabilização do Ind Resources

Iniciada em 15/10/2026 a partir da auditoria da versão 0.18.42, commit `1d9c98d`.
Esta etapa não altera a versão nem publica release. Por orientação do usuário, as alterações são feitas diretamente no código instalado.

## Direção do trabalho

1. Proteger a persistência e o estoque antes de otimizar.
2. Corrigir cada fluxo com regressões executáveis sobre o estado final dos documentos.
3. Simplificar duplicações ligadas ao defeito corrigido, preservando APIs e configurações existentes.
4. Conferir regras contra a edição oficial usada pela mesa antes de modificar parâmetros mecânicos.
5. Separar validação automatizada de teste interativo no Foundry.

## Primeiro lote

| Achado | Alteração | Estado |
|---|---|---|
| F01 — reset diário | Um único método limpa orientação, alimentação e eventos em `system` e flags. Reset de evento usa exclusão explícita | Implementado; validação interativa pendente |
| F02 — duplicação de rações | Debita unidades das pilhas existentes, preservando pilhas diferentes e o item selecionado | Implementado; validação interativa pendente |
| F03 — privacidade | Chat e animação usam o mesmo modo do core; preserva a opção própria de rolagem cega | Parcial: falta definir a visibilidade dos resultados persistidos no Grupo |
| F04 — concorrência | Consumos no mesmo cliente são executados em sequência por ator | Parcial: falta autoridade única entre clientes e idempotência da alimentação por membro/dia |
| F06 — peso e quantidade zero | Zero é preservado como valor válido | Implementado; validação interativa pendente |
| F07 — dia anterior | A mudança de dia limpa o estado diário; não recupera histórico de dias passados | Implementado; validação interativa pendente |
| F08 — seleção de tabela quebrada | Referência explícita indisponível retorna falha para os avisos existentes; seleção Automático mantém o fallback | Implementado; validação interativa pendente |
| F13 — HTML nos diálogos | Escapa nomes de itens, guias e companheiros nos diálogos afetados | Implementado; validação interativa pendente |

### Simplificações realizadas

- Iniciar, encerrar, avançar e voltar o dia usam `_setExpeditionDay`, em vez de repetir atualizações semelhantes.
- O reset de um evento remove apenas sua chave e evita copiar/sobrescrever os demais resultados.
- O consumo calcula quantas unidades precisam sair do estoque e distribui o débito pelas pilhas; não atribui a soma de todo o estoque a um único item.
- A definição de destinatários é compartilhada entre mensagem e animação, usando `ChatMessage.applyRollMode` quando disponível.

### Cobertura acrescentada

Os testes verificam o estado depois da mescla de documentos e da releitura, conservação de campos não relacionados, pilhas distintas, item selecionado, recipientes diferentes, esgotamento com limpeza ligada, consumo concorrente no cliente e recuperação após falha de escrita. Também cobrem os quatro modos de rolagem com/sem dados 3D, conclusão/falha de animação, configuração desligada, referências de tabela removidas e nomes contendo HTML.

O estoque continua usando o modelo de usos parciais por regra já existente. Esta etapa não migra dados para usos individuais por item, não muda a duração oficial de alimentos e não altera as regras de Fome.

### Validação automatizada de 15/10/2026

- Testes focados: **103 aprovados**.
- Suíte completa: **430 aprovados, zero falhas**; inclui 31 regressões novas.
- Sintaxe: **124 módulos ES aprovados**.
- `git diff --check`: sem erros.
- Reset de evento e mudança de dia também verificados isoladamente com o `mergeObject` real do Foundry 13.351 instalado.

Esses resultados são locais e não representam teste em uma sessão real do Foundry.

## Segundo lote — consumo compartilhado e permissões de alimentação

Implementado em 15/10/2026, preservando as alterações do primeiro lote:

- Consumo e consolidação de rações são encaminhados ao GM designado pelo Foundry quando houver GM ativo. GMs secundários também usam esse executor.
- Consolidação e consumo compartilham uma fila por ator. Isso impede que o saldo seja lido enquanto outra dessas operações ainda o está gravando.
- Alimentação individual, pessoal e do grupo inteiro usa um único serviço. O executor valida o usuário autenticado pelo socket, propriedade das provisões e vínculo dos personagens com o Grupo.
- Pedidos simultâneos e sobrepostos reavaliam quem já foi alimentado dentro da fila. IDs repetidos não multiplicam o consumo.
- Pedidos para alimentar vários membros exigem saldo suficiente dentro da operação; não marcam todos como alimentados após um consumo parcial.
- Alimentação e mudança de dia compartilham a fila do Grupo. Uma revisão interna do estado diário diferencia inclusive reinícios com o mesmo número de dia e impede registros atrasados no dia novo.
- Consumo pessoal é sincronizado pelo GM, sem conceder propriedade do Grupo ao jogador. Uma falha de sincronização de um Grupo não interrompe os seguintes.
- A falha de publicação do chat não transforma um consumo já persistido em falha que incentive novo desconto.
- Foram mantidos o retorno booleano de `consumeDay`, a leitura dos dados antigos e a exportação de `getActorExpeditionData` pelo arquivo da ficha. O normalizador foi compartilhado com o serviço de recursos para evitar leituras divergentes.

### Validação automatizada do segundo lote

- Suíte completa: **455 aprovados, zero falhas**, com 25 testes novos de autoridade e concorrência.
- Sintaxe: **126 módulos ES aprovados**; `git diff --check` sem erros. JSON e paridade dos idiomas também aprovados pela suíte.
- Os testes simulam requisições autenticadas de clientes diferentes, GM secundário, jogador confiável, falta de propriedade, payloads inválidos, falha de conexão, pedidos duplicados, estoque insuficiente e troca/reinício de dia.
- As verificações do primeiro lote continuam passando. Estes testes não são sessões reais de múltiplos usuários no Foundry.

Sem GM ativo, o dono continua podendo usar seu próprio inventário e alimentar um Grupo que possa editar. A fila nessa situação é local ao cliente; gravações em um Grupo sem permissão não são elevadas nem tentadas após gastar suas provisões pela ficha de Grupo. Não há garantia de serialização entre clientes diferentes sem o executor comum.

Continuam pendentes neste eixo: orientação do guia sem propriedade do Grupo, política de visibilidade dos resultados persistidos e teste interativo com múltiplas sessões. Falhas entre a gravação do estoque e a do Grupo também precisam de ensaio específico; a fila não substitui uma transação de múltiplos documentos.

## Terceiro lote — guia, referências, inventário e compêndios

Implementado em 15/10/2026, sem alterar versão, identidade do módulo ou regras de viagem:

| Achado | Alteração | Estado atual |
|---|---|---|
| F03 — privacidade | Autor e modo de rolagem acompanham a requisição remota; dados são preservados no ChatMessage mesmo com animação 3D | Parcial: resultados privados continuam espelhados no documento de Grupo; isso ainda precisa ser corrigido |
| F04/F05 — orientação | GM designado valida o usuário autenticado, propriedade do Grupo ou do guia e calcula o teste; usa a fila do dia | Implementado; falta teste entre sessões reais |
| F09 — referências | UUID completo para atores de token e compêndio; carregamento assíncrono na ficha e ações compatíveis com IDs antigos de mundo | Implementado para novos vínculos; referências antigas já ambíguas não são migradas por adivinhação |
| F10 — tabelas | Geradores compartilham as cinco tabelas do runtime, IDs canônicos, flags e resultados; resolução reconhece o ID histórico dos Infortúnios | Fonte e geração validadas; bancos distribuídos/instalados ainda não substituídos |
| F11 — imagens | 41 caminhos ausentes substituídos por arquivos conferidos no Foundry instalado, incluindo a bússola | Corrigido nas fontes; documentos anteriormente importados mantêm suas imagens |
| F12 — provisões | Total soma todos os alimentos habilitados; consumo sem item percorre os tipos; consumo parcial retorna falso | Implementado, com testes de saldo e seleção explícita |
| F12 — descanso | Exige saldo para todo o período antes de consumir e informa falta de provisões no resumo | Implementado; não altera automaticamente a condição Fome nem as regras de cura |
| F14 — cards | Hooks de atores, itens e efeitos atualizam apenas fichas abertas dos Grupos relacionados, agrupando notificações repetidas | Implementado; falta conferência visual no Foundry |
| F15 — manutenção | README corresponde à versão instalada; novos avisos traduzidos; validação de sintaxe inclui ferramentas `.cjs` | Parcial: ainda existem textos fixos na interface de expedição |

### Detalhes de integração e simplificação

- A orientação foi separada da manipulação dos botões da ficha. O executor recebe a intenção de rolar, nunca um resultado ou patch arbitrário enviado pelo cliente.
- Pedidos simultâneos para o mesmo estado de orientação produzem uma única rolagem. A revisão do resultado preserva a opção existente de rerrolar deliberadamente. Trocar de guia durante a animação impede registrar o resultado para o guia novo.
- Mudança de dia aguarda a orientação em andamento e limpa o resultado. O reset passa pelo executor e continua restrito ao dono do Grupo ou GM.
- A identidade dos membros é compartilhada entre ficha e alimentação. UUIDs de tokens não viram caminhos pontuados nas flags; dois tokens do mesmo ator mantêm registros separados.
- O inventário de um ator de compêndio não é consumido pela alimentação pessoal. Ele pode participar da alimentação com estoque do Grupo, que grava apenas o estado do Grupo.
- A rolagem conserva os objetos Roll depois da animação: o core precisa deles para reconhecer uma rolagem cega e ocultar seu conteúdo do autor. O hook público `diceSoNiceMessageProcessed` evita repetir a animação já exibida pelo módulo.
- O gerador isolado exige destino vazio fora de `packs`, fecha o banco em caso de erro e não remove bancos existentes. A geração usa a mesma fonte do gerador de Adventure, eliminando a cópia divergente dos Infortúnios.
- Botão de aumentar quantidade também passa corretamente de zero para um.

### Validação do terceiro lote

- Testes focados: **139 aprovados**.
- Suíte completa: **484 aprovados, zero falhas**, com 29 testes novos neste lote.
- Sintaxe: **132 módulos JavaScript aprovados**, incluindo `.cjs`.
- Ícones da expedição e ficha de Grupo: **73 caminhos únicos conferidos**, nenhum ausente no Foundry 13.351 instalado.
- Banco LevelDB gerado e reaberto fora dos bancos instalados: **cinco tabelas e 70 resultados**, com IDs, flags e subdocumentos conferidos. Não é validação de importação em uma sessão real do Foundry.
- JSON, traduções e estrutura passaram pela suíte; `git diff --check` sem erros.
- A pasta dos livros no Drive continua retornando acesso negado. Nenhum parâmetro mecânico foi alterado com base apenas nos comentários que os chamam de oficiais.

### Limites e testes manuais adicionais

- Persistência privada é uma pendência real: acertar destinatários do chat e da animação não protege os resultados copiados para `system`/flags do Grupo. Não tratar a privacidade da expedição como concluída.
- Conferir orientação e rerrolagem por dono do guia sem propriedade do Grupo; usuário sem vínculo; GM secundário; conexão perdida; troca de guia/dia durante animação; reset autorizado.
- Conferir público/privado/cego/autor com e sem Dice So Nice, inclusive ocultação do conteúdo pelo core e ausência de animação duplicada, nos dois formatos de chat.
- Conferir vínculos de compêndio, token não vinculado e atores de mundo com IDs coincidentes; reabrir ficha e recarregar mundo; alimentar, mover entre seções e remover o vínculo.
- Conferir atualização de vida, corrupção, XP, inventário e efeitos dos membros em duas sessões, sem abrir fichas fechadas nem atualizar Grupos não relacionados.
- Imagens e tabelas personalizadas já importadas não foram sobrescritas. A substituição dos bancos empacotados e a importação precisam de validação com o Foundry fechado antes de sua instalação.
- A fila não oferece transação entre documentos nem serialização entre clientes sem GM ativo. Foundry v14 continua sem teste de runtime.

## Conferência das regras com os livros — 15/10/2026

O acesso ao Drive foi resolvido para leitura dos PDFs. O Guia do Mestre, o Livro Básico, o Guia Avançado do Jogador e o Códice de Monstros foram usados para conferir o procedimento de expedições e as regras relacionadas. A situação anterior de acesso negado permanece registrada acima apenas como histórico dos lotes técnicos.

O resultado é **conformidade parcial**, com cinco divergências reproduzidas em funções reais e outras lacunas determinadas pela leitura do fluxo. A suíte técnica continua com 484 testes aprovados; não cobria integralmente essas regras.

Foram acrescentados:

- [Regras e fontes das expedições](EXPEDICOES-REGRAS-E-FONTES.md), com páginas impressas e correspondência dos PDFs.
- [Auditoria de conformidade](EXPEDICOES-AUDITORIA-DE-CONFORMIDADE.md), separando regras corretas, divergências, funcionalidades ausentes e decisões sem fonte suficiente.
- [Plano de automação](EXPEDICOES-PLANO-DE-AUTOMACAO.md), com etapas, integrações, critérios de aceitação e proteção dos dados existentes.

A primeira prioridade mecânica passa a ser corrigir a elegibilidade do guia e os benefícios de orientação: sem Mateiro não há a tentativa prevista no GM p.92; com nível insuficiente, sucesso pode evitar Infortúnio, mas não concede os bônus normais. Também é preciso separar margem de cinco de um resultado natural 1. A proteção dos resultados privados continua prioritária antes de ampliar histórico e automações.

Este estudo não implementou as novas mecânicas nem alterou parâmetros do mundo. Os próximos lotes abaixo devem ser executados à luz desse plano e das fontes agora verificadas.

## Próximos lotes

### Autoridade e permissões

- Validar ao vivo o encaminhamento ao executor único, as permissões e a alimentação duplicada, inclusive com dois GMs.
- Testar desconexão/troca do GM e falhas de escrita entre documentos, antes de ampliar garantias sobre recuperação de operações.
- Validar ao vivo a orientação autorizada ao dono do guia, implementada no terceiro lote.
- Validar no Foundry o armazenamento e a leitura privada implementados na [etapa A](EXPEDICOES-ETAPA-A-ORIENTACAO-E-PRIVACIDADE.md); revisar separadamente os resultados legados, cuja privacidade original não está registrada.

### Referências, compêndios e interface

- F09/F14: validar os fluxos implementados em uma sessão real e avaliar a recuperação de vínculos antigos já ambíguos.
- F10/F11: validar importação dos compêndios gerados e definir a atualização dos bancos distribuídos, sem sobrescrever tabelas personalizadas já importadas.
- Rever o fluxo de recipientes no inventário do Grupo com e sem Item Piles Symbaroum.

### Mecânicas, parâmetros e manutenção

- F12: validar o consumo misto e a insuficiência no descanso com as configurações reais da mesa; o retorno público continua booleano e agora informa conclusão integral.
- Implementar as correções de conformidade já verificadas nos livros e seguir o plano específico de expedições; manter explícitas as ambiguidades e capacidades sem referência comprovada.
- Estabelecer o comportamento suportado para tabelas aninhadas, sem reposição e com lacunas de intervalos.
- F15: corrigir textos fixos em português e documentação desatualizada.
- Validar no Foundry os compêndios gerados em diretório separado; a validação estática de `.cjs` e a releitura do LevelDB foram concluídas no terceiro lote.
- Medir antes de otimizar catálogo de tabelas e renderização. Não remover indicadores usados por integrações existentes.

## Testes manuais pendentes do primeiro lote

- GM/jogador/jogador confiável; ficha editável e somente leitura.
- Alimentação e reset após fechar/reabrir a ficha e recarregar o mundo.
- Pilhas separadas, item em recipiente, quantidade esgotada e limpeza ligada/desligada.
- Privado, cego, público e autor com/sem Dice So Nice; conferir também o resultado que a ficha do Grupo mostra.
- Tabela configurada removida versus opção Automático.
- Menus/diálogos em português e inglês, nos temas usados pela mesa.
- Regressão interativa em Foundry v13; v14 permanece sem validação de runtime.

Passar na suíte local não encerra esses casos. O plano permanece aberto para os lotes seguintes.


## Entrega de orientação e privacidade — etapa A

O registro detalhado está em [EXPEDICOES-ETAPA-A-ORIENTACAO-E-PRIVACIDADE.md](EXPEDICOES-ETAPA-A-ORIENTACAO-E-PRIVACIDADE.md). O código passou a distinguir elegibilidade, evitar Infortúnio e benefícios de eventos, usar a API nativa para o teste, compor dádivas/Fome e oferecer ajuste circunstancial ao GM. Resultados privados novos deixam o Actor compartilhado; sua leitura é autorizada pelo GM e cifrada no transporte do módulo. Eventos dependentes conservam a privacidade da orientação.

Os textos dos lotes anteriores são registros históricos. As pendências atuais incluem aceitação em sessões reais, resultados legados e as etapas B–F; não há release novo.
