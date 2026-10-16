# Etapa A — orientação e privacidade

Implementação de 15/10/2026 no código instalado. Sem alteração de versão, identidade ou compatibilidade declarada. **Implementada e verificada localmente; aceitação em sessões reais do Foundry pendente.**

Revisão posterior de 16/10/2026: [conferência de regras, correções técnicas e novo cartão de orientação](EXPEDICOES-REVISAO-ORIENTACAO-E-CHAT.md). O registro abaixo preserva a entrega original; a revisão posterior está incluída na versão 0.18.46.

## Mecânica corrigida

- Em Davokar, nível zero de Mateiro impede a tentativa; a interface informa o motivo sem gerar um teste fictício. Isso não implementa a resolução automática de um dia sem guia elegível.
- Mateiro I/II abaixo da exigência regional usa a penalidade existente de −3/−5. Um sucesso apenas evita Infortúnio: não dá bônus a Ruínas, Inimigos, Terreno ou detecção antecipada.
- Com Mateiro suficiente, a melhoria de −1 para −2 em Inimigos/Terreno exige margem mínima de cinco. Um resultado natural 1, sozinho, não concede essa melhoria.
- A resolução usa `game.symbaroum.api.baseRoll`, sem publicar o chat nativo duplicado. Alvo, sucesso e dados de confirmação vêm dessa API, respeitando as opções do sistema instalado. O adaptador de contingência mantém os limites condicionais e o dado de confirmação de crítico raro.
- Cartógrafo e Dedo Verde contribuem com seus níveis, descontando os bônus identificáveis já preparados pelo próprio item ou por efeitos aditivos ligados à sua origem. Desbravador entra nas chances do teste.
- A combinação com Fome mantém a política atual de desfavor do módulo: Fome força duas chances de falhar, inclusive na presença de Desbravador. Essa combinação é uma política de integração, não uma nova comprovação de regra explícita dos livros. Fome desativada ou suprimida não afeta o teste; a correção pequena em `HungerService.hasHunger` também mantém os demais consumidores coerentes.
- O GM pode usar **Modificador circunstancial** para informação, mapas e outras circunstâncias, válido apenas naquela rolagem. O cliente jogador não pode enviar um modificador diferente de zero. O botão normal continua direto. A preparação persistente de informação regional permanece na etapa F.

As referências são as já conferidas em [regras e fontes](EXPEDICOES-REGRAS-E-FONTES.md): GM p.92 e pp.98–99; GAJ p.52. O registro do resultado e seu cartão mostram os componentes adicionais. Efeitos personalizados sem vínculo identificável ao item, substituições e fórmulas arbitrárias continuam exigindo conferência pelo GM; o código não tenta adivinhar sua origem.

## Onde os dados ficam

Rolagens públicas continuam armazenadas no Grupo. Para GM, cegas e próprias, o Grupo recebe apenas um marcador de conclusão, ID e revisão, em `system` e flags. A substituição explícita remove campos antigos daquele resultado, evitando que uma mescla conserve dado, alvo ou bônus anteriores.

Os resultados completos ficam em um compêndio **do mundo**, criado no primeiro uso privado: `world.symbaroum-ind-resources-expeditions`, do tipo `JournalEntry`, rotulado como **Expedições — resultados privados**. Jogador e jogador confiável têm `NONE`; GMs têm acesso. O nome das entradas é genérico e os resultados não são adicionados ao índice. Não houve criação de compêndio em mundo real durante esta implementação: os testes usam documentos simulados.

O GM executor valida usuário autenticado, vínculo com o Grupo/guia e visibilidade do resultado antes de responder à ficha. Cada referência é conferida contra Grupo, dia, tipo de resultado e revisão. GMs podem inspecionar os resultados; o autor de uma rolagem cega recebe somente o marcador privado.

As respostas privadas de leitura são cifradas para uma chave efêmera do cliente, porque respostas do socketlib passam pelo canal do módulo. A chave privada não é persistida nem transmitida. A leitura requer Web Crypto disponível no navegador; se a leitura, o GM ou o compêndio estiver indisponível, a ficha conserva o marcador privado. Não existe retorno dos resultados em texto aberto como contingência.

Os eventos são calculados no executor usando o resultado real de orientação. Quando dependem de orientação privada, herdam seu modo e autor, sem expor a fórmula na ficha de outros usuários. Os dois caminhos de eventos passaram a compartilhar a mesma implementação. Rolagem, reset e mudança de dia usam a fila do Grupo; pedidos sobrepostos e resets atrasados são descartados por revisão.

Se as permissões de um compêndio existente forem alteradas, o módulo interrompe a leitura/escrita privada em vez de alterar essas permissões ou usar o Actor como alternativa. Resultados de dias anteriores permanecem no compêndio; não há limpeza automática. Inclua esse compêndio nos backups do mundo.

## Limites e compatibilidade

- A proteção nova cobre armazenamento e leitura de orientação/eventos do módulo. O chat e o Dice So Nice seguem seus próprios mecanismos nativos de visibilidade e transporte; esta entrega não promete criptografia dos dados nativos do Foundry nem proteção adicional contra extensões com acesso ao navegador autorizado.
- Resultados antigos já gravados integralmente no Grupo não têm identificação confiável de sua privacidade original. Não foram reclassificados ou migrados automaticamente. Rerrolar substitui o resultado correspondente pelo novo formato; isso não apaga exposições históricas ou mensagens antigas.
- Mudanças de guia, região, tabelas, procura ativa, atributo, efeitos ou opções relevantes durante a orientação impedem persistir um resultado desatualizado. Cartões já enviados antes dessa mudança podem permanecer no chat.
- As novas fontes/rótulos de Infortúnios usam pp.92–94, sem chamar a lista de Tabela 25. IDs e reconhecimento de nomes históricos foram preservados. Compêndios distribuídos e tabelas importadas não foram regenerados nem renomeados nesta etapa.
- Escrita de chat, compêndio e Actor não forma uma transação única. Falha intermediária pode deixar uma mensagem ou registro privado sem ligação; não há alternativa que copie o segredo ao Grupo.
- Procura ativa versus ritmo, rio, alimentos, deslocamento, consequências e preparação persistente continuam nas etapas B–F.

## Validação

Testes automatizados exercitam funções reais do módulo, com APIs/documentos simulados quando dependem do Foundry. A cifragem usa Web Crypto real do Node.

Resultado da entrega: **162 testes focados aprovados; suíte completa com 515 testes aprovados, zero falhas**. Validação de sintaxe aprovada em **135 módulos JavaScript**; template da ficha compilado; **1056 chaves** coincidentes entre PT-BR/EN; `git diff --check` sem erros. Os logs de execução ficam fora do módulo instalado.

| Fluxo | Cobertura local |
|---|---|
| Mateiro 0–III nas três regiões; margem 4/5; natural 1 | Elegibilidade, evitar Infortúnio e benefícios separados |
| Opções nativas; atributo fora de 1–19 | Contrato da API, limites condicionais e retorno inválido |
| Cartógrafo, Dedo Verde, Desbravador, Fome | Adição contextual, bônus identificáveis preparados, efeito desativado/suprimido e setting desligado |
| GM, dono apenas do guia, outro jogador | Autenticação, propriedade e rejeição de parâmetros arbitrários |
| Público, GM, cego, próprio; DSN | Autor/destinatários e manutenção dos dados necessários à visibilidade nativa |
| Actor compartilhado e resposta do socket | Ausência dos campos secretos no Actor; resposta cifrada; outra chave/dia não decifra |
| Reset, rerrolagem e eventos | Fila, concorrência, herança de privacidade e revisão |
| Referência trocada, compêndio ausente ou permissões abertas | Rejeição sem divulgar o resultado ou alterar permissões existentes |

Pendente em runtime: GM/jogador/jogador confiável em navegadores separados; GM secundário e troca/desconexão do executor; recarga real do mundo; permissões reais do compêndio; cenários de Web Crypto indisponível; chat Ilustrado/Legacy; DSN ativo/ausente/desativado; diálogo e layout PT-BR/EN; efeitos personalizados; Foundry v13 e v14. Análise do código do Foundry 13.351/Symbaroum 6.1.6 e testes simulados não substituem esses ensaios.
