# Auditoria funcional e roteiro completo de testes — IND Resources

Data: **09/11/2026**. Referência publicada: **v0.19.3**, commit **9ef05078ce3d5acfd602314d83756ef1cbd2cd7b**.

Este documento contém **786 verificações numeradas**, distribuídas em **40 blocos**, para testar uma ação/configuração de cada vez. É uma auditoria funcional estática do código e do conteúdo entregue, com inventário sintático de todas as funções. Não é uma certificação de segurança, de regra oficial ou de compatibilidade real por leitura de código.

A versão publicada possui **78 scripts**, **29.399 linhas físicas** e **2.802 funções/métodos/callbacks declarados**. A árvore local possui **79 scripts**, **29.496 linhas** e **2.815 funções/métodos/callbacks**. Números de funções são nós sintáticos, não funções únicas ou recursos independentes.

O roteiro cobre interface, mecânicas, configurações, conteúdo, persistência, integrações e permissões. Helpers internos estão no [inventário técnico](INVENTARIO-CODIGO-IND-2026-11-09.md); não são todos comandos acionáveis manualmente. Cada caso traz o **comportamento programado atual**, que pode ser uma regra da mesa.

## Como executar

Use uma cópia do mundo para os testes que consomem, excluem ou importam documentos. Prepare um personagem dono do jogador, outro sem propriedade, um PNJ/monstro, um Grupo, uma cena tática e outra em quilômetros. Tenha GM e jogador conectados para os casos entre clientes. Adicione duas armas de uma mão, arma longa, arma pesada, escudo, arco/besta, aljavas, projéteis regulares/especiais, alimentos, Cura Herbal, veneno e recipientes. As integrações opcionais só são requisitos nos seus próprios casos.

Marque cada caso como **OK**, **Falhou**, **Mudar** ou **Não se aplica** na [planilha CSV](CHECKLIST-TESTES-IND-2026-11-09.csv). Todos começam como **Não testado**. Para falha ou mudança, anote: número do teste, versão, GM/jogador, opções ligadas, passos realizados, observado, desejado e console/imagem. Você pode retornar apenas os números para retomarmos os pontos exatos.

**Publicado** indica comportamento previsto na 0.19.3, sem afirmar instalação conferida no seu servidor. **LOCAL — não publicado** indica alteração já existente neste checkout e fora dessa release. **Código — ver descrição** inclui funções pausadas ou acessíveis por API. A auditoria não alterou mecânicas nem publicou uma versão funcional nova.

## Índice numerado

1. [001–016 — Preparação, ativação e configurações](#bloco-1)
2. [017–029 — Criação de personagens e inventário básico](#bloco-2)
3. [030–047 — Alimentação e Pão de Viagem](#bloco-3)
4. [048–067 — Fome, inanição e descanso](#bloco-4)
5. [068–081 — Cura Herbal e Médico](#bloco-5)
6. [082–109 — Aljavas, disparos e recuperação de munição](#bloco-6)
7. [110–120 — Tipos de munição especial](#bloco-7)
8. [121–138 — Sobrecarga, peso e painel da ficha](#bloco-8)
9. [139–165 — Recipientes dentro das fichas](#bloco-9)
10. [166–180 — Recipientes no canvas e transferência](#bloco-10)
11. [181–188 — Gerenciador de dinheiro](#bloco-11)
12. [189–218 — Sacar, guardar e trocar armas](#bloco-12)
13. [219–243 — Manobras de combate](#bloco-13)
14. [244–260 — Limiar de Dor, Caído e Levantar](#bloco-14)
15. [261–279 — Morrendo, testes de morte e recuperação](#bloco-15)
16. [280–296 — Régua tática e estimativa de viagem](#bloco-16)
17. [297–320 — Chat Original e apresentação Ind Resources](#bloco-17)
18. [321–329 — Privacidade das rolagens e dados 3D](#bloco-18)
19. [330–339 — Registro do Mestre](#bloco-19)
20. [340–349 — Condições e seletor Efeitos do Token](#bloco-20)
21. [350–360 — Ritualista e catálogo de rituais](#bloco-21)
22. [361–378 — Macros e utilidades Bithir incorporadas](#bloco-22)
23. [379–410 — Calendário: navegação, data e apresentação](#bloco-23)
24. [411–436 — Calendário: relógio, integração, permissões e backup](#bloco-24)
25. [437–452 — Ficha de Grupo: membros e informações](#bloco-25)
26. [453–463 — Ficha de Grupo: inventário, depósitos e animais](#bloco-26)
27. [464–485 — Expedição: acesso, dias e orientação](#bloco-27)
28. [486–504 — Expedição: alimentação e eventos de Davokar](#bloco-28)
29. [505–510 — Expedição: alterações locais ainda não publicadas](#bloco-29)
30. [511–525 — Diários Symbaroum e importador de conteúdo](#bloco-30)
31. [526–545 — Integrações externas e regressão entre clientes](#bloco-31)
32. [546–550 — Recursos presentes no código mas pausados ou sem interface](#bloco-32)
33. [551–610 — Verificação individual de todas as configurações principais](#bloco-33)
34. [611–619 — Demais registros de configuração e estados persistidos](#bloco-34)
35. [620–668 — Cada alimento pré-cadastrado](#bloco-35)
36. [669–734 — Cada ritual do catálogo incorporado](#bloco-36)
37. [735–742 — Cada Item entregue pela Adventure](#bloco-37)
38. [743–746 — Cada animal entregue pela Adventure](#bloco-38)
39. [747–759 — Cada preset de depósito e transporte do Grupo](#bloco-39)
40. [760–786 — Cada tabela entregue pela Adventure](#bloco-40)

## Pontos de atenção encontrados

- **A01 — Envio adicional de itens ao chat está pausado** (Confirmado no código; decisão de escopo). Não tratar esse recurso como disponível no formulário atual. Cards e envio nativos do sistema continuam sendo outra rota. Ver teste **546**.
- **A02 — README cita macros que não estão na Adventure atual** (Confirmado por leitura dos compêndios). A lista foi baseada nos documentos reais do pacote; o README precisa de revisão numa futura atualização. Ver teste **378**.
- **A03 — Não existe uma opção dedicada de mensagem de munição especial** (Confirmado no registro de settings). Links de munição são testados pelo comportamento integrado; não procurar uma configuração inexistente. Ver teste **108**.
- **A04 — Limpar efeitos apaga mais que manobras** (Confirmado no código; confirmar intenção na mesa). Pode retirar efeitos nativos e de outros módulos. Testar em cópia e decidir se o comando deve ser limitado no futuro. Ver teste **243**.
- **A05 — Limpeza de existentes e limpeza por evento têm escopos diferentes** (Confirmado no código; diferença de alcance). Com opção ativa, um equipamento de PNJ atualizado para zero também pode ser excluído. Não confundir isso com a varredura restrita aos jogadores. Ver teste **026**.
- **A06 — Dinheiro não possui fila própria para alterações concorrentes** (Risco estático; não reproduzido no Foundry). Duas sessões que calculem sobre o mesmo saldo podem perder uma atualização. O roteiro contém tentativa simultânea para confirmar ou descartar o problema. Ver teste **188**.
- **A07 — Falhas de Médico Novato/Adepto ainda curam 1** (Confirmado no código; divergência de descrição). O esperado do roteiro reproduz o código atual. A adequação da regra e eventual mudança ficam para decisão posterior. Ver teste **074**.
- **A08 — Duas tabelas de Sombra contêm faixas inalcançáveis pela fórmula própria** (Confirmado nos dados do pacote). BithirApi.parseSimpleElement usa table.roll() sem acrescentar modificador a essas tabelas; as faixas excedentes não são sorteadas por essa rota. Ver teste **372**.
- **A09 — Finalizar dia ligado ao calendário não está na release 0.19.3** (Confirmado no código; interface local ainda não publicada). A release usa os controles de próximo/anterior dia de Grupo. Os casos locais estão sinalizados e não são requisitos da instalação online atual. Ver teste **505**.
- **A10 — Várias munições especiais fornecem descrição, sem automação completa** (Limite funcional confirmado). Não interpretar texto descritivo como teste, dano, queda ou condição automaticamente executados em todos os onze tipos. Ver teste **115**.
- **A11 — Ocultar detalhes de PNJ não equivale a uma permissão de documento** (Limite de apresentação). A audiência continua sendo a da mensagem nativa. Verificar dados recebidos pelo jogador; usar modos nativos privados/cegos para segredos reais. Ver teste **305**.
- **A12 — Descanso e consumo não executam todas as consequências narrativas** (Confirmado no código; interação não automatizada). Essas ações estão em itens próprios do checklist para decidir se a futura atualização deve integrá-las. Ver teste **067**.

A Tabela 25 ter fórmula **1d20** e resultados até **30** é coerente com o modificador regional da expedição; isso, por si só, **não** é defeito. Os dois casos de Sombra citados acima não têm esse acréscimo na rota observada.

## Roteiro de execução

<a id="bloco-1"></a>

### 001–016 — Preparação, ativação e configurações

Fontes: [init.mjs](../scripts/init.mjs), [settings.mjs](../scripts/settings.mjs), [compatibility.mjs](../scripts/compatibility.mjs), [constants.mjs](../scripts/constants.mjs), [symbaroum-i18n.mjs](../scripts/symbaroum-i18n.mjs).

1. [ ] **Base de comparação**

   **Fazer:** Anotar Foundry, sistema, módulo e dependências instaladas antes dos testes.

   **Esperado:** A versão deste roteiro é 0.19.3; registrar qualquer versão diferente.

   **Perfil:** GM, jogador, confiável e observador.

2. [ ] **GM e jogador simultâneos**

   **Fazer:** Abrir duas sessões, uma GM e uma jogador dono de um personagem.

   **Esperado:** Ambas enxergam as alterações autorizadas; não há ações duplicadas por cliente.

   **Perfil:** GM, jogador, confiável e observador.

3. [ ] **Jogador confiável**

   **Fazer:** Repetir alterações permitidas com usuário confiável e com observador sem propriedade.

   **Esperado:** O papel confiável não substitui a propriedade exigida em cada documento.

   **Perfil:** GM, jogador, confiável e observador.

4. [ ] **Oito menus do módulo**

   **Fazer:** Abrir Alimentação, Descanso/Fome, Munição, Sobrecarga, Movimento, Combate, Mensagens e Utilidades.

   **Esperado:** Cada categoria apresenta e salva seus próprios campos; acesso restrito a GM.

   **Perfil:** GM, jogador, confiável e observador.

5. [ ] **Salvar uma categoria**

   **Fazer:** Alterar uma opção de Alimentação e salvar sem abrir os outros menus.

   **Esperado:** As configurações de outras categorias permanecem iguais.

   **Perfil:** GM, jogador, confiável e observador.

6. [ ] **Atualização em tempo real**

   **Fazer:** Com ficha, chat e HUD abertos, ligar e desligar opções de cada grupo e salvar.

   **Esperado:** Controles afetados atualizam sem duplicar elementos; anotar qualquer caso que exija F5.

   **Perfil:** GM, jogador, confiável e observador.

7. [ ] **Persistência das opções**

   **Fazer:** Salvar configurações, fechar formulários e recarregar o mundo.

   **Esperado:** Valores salvos permanecem; padrões só valem para configurações ainda não definidas.

   **Perfil:** GM, jogador, confiável e observador.

8. [ ] **Valores fora do limite**

   **Fazer:** Nos campos numéricos, tentar vazio, negativo e valores extremos.

   **Esperado:** A interface normaliza ou rejeita conforme o campo; nenhum dado inválido é gravado.

   **Perfil:** GM, jogador, confiável e observador.

9. [ ] **Idiomas PT-BR e inglês**

   **Fazer:** Percorrer os mesmos menus e ações nos dois idiomas.

   **Esperado:** Rótulos são traduzidos e o reconhecimento dos itens preserva as mecânicas.

   **Perfil:** GM, jogador, confiável e observador.

10. [ ] **Desativação completa**

   **Fazer:** Em mundo de teste, desativar o IND e depois reativar.

   **Esperado:** Dados nativos continuam acessíveis; flags existentes não são apagadas pela desativação.

   **Perfil:** GM, jogador, confiável e observador.

11. [ ] **Aviso de compatibilidade**

   **Fazer:** Abrir como GM com integrações conhecidas e inspecionar o aviso inicial.

   **Esperado:** O aviso informa decisões/conflitos detectados sem bloquear o mundo.

   **Perfil:** GM, jogador, confiável e observador.

12. [ ] **Suprimir aviso já reconhecido**

   **Fazer:** Marcar a preferência no aviso e recarregar neste cliente.

   **Esperado:** O aviso reconhecido não se repete indevidamente; mudanças relevantes podem gerar novo aviso.

   **Perfil:** GM, jogador, confiável e observador.

13. [ ] **Diagnóstico por API**

   **Fazer:** No console, consultar game.tenebreResources.diagnostics e compatibility.getReport().

   **Esperado:** Relatório identifica versão e integrações; não altera personagens.

   **Perfil:** GM, jogador, confiável e observador.

14. [ ] **Atalho de descanso**

   **Fazer:** Selecionar personagens e usar Ctrl+Shift+R; repetir como jogador com personagem atribuído.

   **Esperado:** Abre descanso para personagens autorizados; atalho configurável pelo Foundry.

   **Perfil:** GM, jogador, confiável e observador.

15. [ ] **Sem GM conectado**

   **Fazer:** Repetir consumo próprio, ação contra outro ator, calendário e alimentação de grupo sem GM.

   **Esperado:** Registrar quais rotas têm fallback permitido e quais dependem de autoridade; nenhuma falha deve duplicar dados.

   **Perfil:** GM, jogador, confiável e observador.

16. [ ] **Observação sem efeitos colaterais**

   **Fazer:** Abrir e fechar repetidamente fichas de atores, itens, diário e grupo sem interagir.

   **Esperado:** A simples renderização não consome recursos nem cria alterações de documentos.

   **Perfil:** GM, jogador, confiável e observador.


<a id="bloco-2"></a>

### 017–029 — Criação de personagens e inventário básico

Fontes: [actor-creation.mjs](../scripts/actor-creation.mjs), [actor-preparation.mjs](../scripts/actor-preparation.mjs), [inventory-default-state.mjs](../scripts/inventory-default-state.mjs), [inventory-cleanup.mjs](../scripts/inventory-cleanup.mjs), [sheet-ui.mjs](../scripts/sheet-ui.mjs), [item-flags.mjs](../scripts/item-flags.mjs), [weapon-quality-tooltips.mjs](../scripts/weapon-quality-tooltips.mjs).

17. [ ] **Vitalidade de personagem novo**

   **Fazer:** Criar personagem jogador sem informar Vitalidade explicitamente.

   **Esperado:** O módulo preenche Vitalidade inicial 10.

   **Perfil:** GM e dono da ficha.

18. [ ] **Vitalidade explícita na criação**

   **Fazer:** Importar/criar personagem com Vitalidade já definida.

   **Esperado:** O valor explícito é preservado.

   **Perfil:** GM e dono da ficha.

19. [ ] **PNJ e monstro novos**

   **Fazer:** Criar PNJ/monstro e comparar com personagem jogador.

   **Esperado:** A regra de Vitalidade inicial do personagem não sobrescreve essas fichas.

   **Perfil:** GM e dono da ficha.

20. [ ] **Estado de item novo**

   **Fazer:** Adicionar equipamento, arma, armadura e artefato a personagem com estado Outro automático.

   **Esperado:** Itens elegíveis sem vínculo de armazenamento entram como Equipado.

   **Perfil:** GM e dono da ficha.

21. [ ] **Estado explícito do item**

   **Fazer:** Criar/importar itens já Ativos, Equipados e itens guardados ou largados no chão.

   **Esperado:** Ativo/Equipado e vínculos protegidos são preservados; Outro também é convertido, a menos que a operação use a opção preserveItemState ou tenha vínculo protegido.

   **Perfil:** GM e dono da ficha.

22. [ ] **Importar Adventure**

   **Fazer:** Importar a Adventure do IND em mundo de teste.

   **Esperado:** Equipamentos elegíveis das fichas importadas são normalizados sem alterar os originais do compêndio.

   **Perfil:** GM e dono da ficha.

23. [ ] **Limpeza desligada**

   **Fazer:** Zerar a quantidade de equipamento de Actor com limpeza automática desligada.

   **Esperado:** O item não é removido por essa opção.

   **Perfil:** GM e dono da ficha. **Opções:** `enableInventoryCleanup`.

24. [ ] **Limpeza ligada em personagem**

   **Fazer:** Ativar limpeza e reduzir quantidade de equipamento do personagem a zero.

   **Esperado:** O equipamento esgotado é excluído uma vez.

   **Perfil:** GM e dono da ficha. **Opções:** `enableInventoryCleanup`.

25. [ ] **Limpeza ao ativar opção**

   **Fazer:** Criar equipamentos esgotados previamente e então ativar a opção.

   **Esperado:** A varredura de itens existentes atua nos personagens jogadores, por um GM ativo.

   **Perfil:** GM e dono da ficha.

26. [ ] **Limpeza em PNJ por evento**

   **Fazer:** Com limpeza ativa, criar/atualizar equipamento de PNJ/monstro para zero.

   **Esperado:** PONTO DE ATENÇÃO: os hooks aceitam equipment de qualquer Actor; registrar se a exclusão é desejada.

   **Perfil:** GM e dono da ficha.

27. [ ] **Tipos protegidos da limpeza**

   **Fazer:** Zerar arma, armadura, habilidade, ritual, Item do mundo e Item de compêndio.

   **Esperado:** A rotina específica de equipamentos esgotados não deve excluir esses tipos.

   **Perfil:** GM e dono da ficha.

28. [ ] **Recarregar sem limpeza global**

   **Fazer:** Deixar equipamentos com quantidade zero e recarregar o mundo com a opção ativa.

   **Esperado:** O carregamento não chama uma varredura destrutiva de todos os itens existentes.

   **Perfil:** GM e dono da ficha.

29. [ ] **Tooltips de qualidades**

   **Fazer:** Passar o mouse sobre qualidades de armas em ficha e diálogo.

   **Esperado:** Descrições das qualidades reconhecidas aparecem sem repetir tooltips.

   **Perfil:** GM e dono da ficha.


<a id="bloco-3"></a>

### 030–047 — Alimentação e Pão de Viagem

Fontes: [rations.mjs](../scripts/rations.mjs), [item-flags.mjs](../scripts/item-flags.mjs), [settings.mjs](../scripts/settings.mjs), [sheet-ui.mjs](../scripts/sheet-ui.mjs).

30. [ ] **Reconhecer Pão de Viagem**

   **Fazer:** Adicionar Pão de Viagem/Waybread e abrir a ficha.

   **Esperado:** O item recebe o controle especial de usos.

   **Perfil:** GM e dono da ficha. **Opções:** `enableRations`.

31. [ ] **Usos por unidade**

   **Fazer:** Com padrão 7, adicionar quatro pães.

   **Esperado:** O saldo é 28 usos e o display mostra quantidade e saldo agregado.

   **Perfil:** GM e dono da ficha. **Opções:** `rationUses`.

32. [ ] **Consumir um uso**

   **Fazer:** Clicar no controle de consumo uma vez.

   **Esperado:** Remove um uso e publica o saldo; não remove unidade inteira antes de esgotá-la.

   **Perfil:** GM e dono da ficha.

33. [ ] **Esgotar uma unidade**

   **Fazer:** Consumir sete usos de uma pilha com mais de um pão.

   **Esperado:** A quantidade diminui em uma unidade e o saldo restante continua correto.

   **Perfil:** GM e dono da ficha.

34. [ ] **Esgotar toda a pilha**

   **Fazer:** Consumir até não restar nenhum uso.

   **Esperado:** Não permite saldo negativo; eventual exclusão depende da opção de limpeza.

   **Perfil:** GM e dono da ficha.

35. [ ] **Sem suprimentos**

   **Fazer:** Tentar consumir sem alimento elegível.

   **Esperado:** Mostra aviso e não altera a ficha.

   **Perfil:** GM e dono da ficha.

36. [ ] **Comer estando com Fome**

   **Fazer:** Consumir alimento com o status Fome ativo.

   **Esperado:** O consumo de rações por si só não remove automaticamente o efeito Fome nesta rotina; registrar a decisão de regra desejada para a mesa.

   **Perfil:** GM e dono da ficha.

37. [ ] **Cancelar consumo**

   **Fazer:** Fechar/cancelar diálogos de consumo quando apresentados.

   **Esperado:** Nenhum uso ou unidade é gasto.

   **Perfil:** GM e dono da ficha.

38. [ ] **Consolidar pilhas equivalentes**

   **Fazer:** Adicionar duas pilhas equivalentes de pão e consumir/reabrir o mundo.

   **Esperado:** O total se mantém durante a consolidação; itens com dados diferentes não são perdidos.

   **Perfil:** GM e dono da ficha.

39. [ ] **Cliques concorrentes**

   **Fazer:** GM e dono tentam consumir simultaneamente o mesmo saldo final.

   **Esperado:** As operações são serializadas; não há consumo duplicado, saldo negativo ou criação de comida.

   **Perfil:** GM e dono da ficha.

40. [ ] **Ativar outros alimentos**

   **Fazer:** Ligar a opção e selecionar um alimento configurável.

   **Esperado:** O alimento habilitado passa a fornecer os usos definidos.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

41. [ ] **Configurar usos diferentes**

   **Fazer:** Definir um alimento com três usos e outro com um.

   **Esperado:** Cada tipo mantém saldo e consumo próprios.

   **Perfil:** GM e dono da ficha.

42. [ ] **Criar alimento personalizado**

   **Fazer:** Criar alimento no formulário com nome e usos.

   **Esperado:** Cria Item na pasta Alimentos e inclui a configuração correspondente.

   **Perfil:** GM e dono da ficha.

43. [ ] **Adicionar todos os alimentos**

   **Fazer:** Usar adicionar todos e confirmar.

   **Esperado:** Inclui as opções disponíveis; cancelar mantém o conjunto anterior.

   **Perfil:** GM e dono da ficha.

44. [ ] **Remover todos os alimentos**

   **Fazer:** Usar remover todos e confirmar.

   **Esperado:** Retira tratamento especial sem excluir as cópias já existentes nas fichas.

   **Perfil:** GM e dono da ficha.

45. [ ] **Remover um alimento da configuração**

   **Fazer:** Remover apenas um alimento habilitado.

   **Esperado:** Os demais continuam funcionando; o Item do mundo não é excluído por isso.

   **Perfil:** GM e dono da ficha.

46. [ ] **Excluir Item personalizado**

   **Fazer:** Excluir do mundo um alimento personalizado cadastrado e reabrir configuração.

   **Esperado:** Sua opção deixa de ser oferecida como Item disponível.

   **Perfil:** GM e dono da ficha.

47. [ ] **Múltiplos estoques de comida**

   **Fazer:** Consumir com diferentes tipos habilitados e pães parcialmente usados.

   **Esperado:** O saldo agregado não é atribuído indevidamente a uma pilha individual.

   **Perfil:** GM e dono da ficha.


<a id="bloco-4"></a>

### 048–067 — Fome, inanição e descanso

Fontes: [hunger.mjs](../scripts/hunger.mjs), [rest.mjs](../scripts/rest.mjs), [settings.mjs](../scripts/settings.mjs), [init.mjs](../scripts/init.mjs), [dice.mjs](../scripts/dice.mjs).

48. [ ] **Aplicar Fome**

   **Fazer:** Aplicar o status Fome a personagem.

   **Esperado:** Status e descrição ficam disponíveis; publica apenas a mensagem prevista.

   **Perfil:** GM e dono da ficha. **Opções:** `enableHunger`.

49. [ ] **Remover Fome em vários clientes**

   **Fazer:** Remover o efeito com GM e jogadores conectados.

   **Esperado:** Há uma mensagem de remoção, sem multiplicação por cliente.

   **Perfil:** GM e dono da ficha.

50. [ ] **Desvantagem por Fome**

   **Fazer:** Abrir testes de atributo e ataques com Fome.

   **Esperado:** Segunda chance de falha é aplicada nas rotas integradas sem ser duplicada.

   **Perfil:** GM e dono da ficha.

51. [ ] **Fome e favor existente**

   **Fazer:** Rolar com favor prévio e Fome.

   **Esperado:** A composição segue a implementação; anotar o número de dados e o resultado escolhido.

   **Perfil:** GM e dono da ficha.

52. [ ] **Movimento faminto**

   **Fazer:** Medir o deslocamento com e sem Fome.

   **Esperado:** A metade é aplicada uma vez quando o modificador está ligado.

   **Perfil:** GM e dono da ficha. **Opções:** `enableMovementHungerModifier`.

53. [ ] **Bloqueio de cura natural**

   **Fazer:** Descansar ferido enquanto está com Fome.

   **Esperado:** Não recebe cura natural de Vitalidade.

   **Perfil:** GM e dono da ficha.

54. [ ] **Teste diário de inanição**

   **Fazer:** Descansar um dia com Fome.

   **Esperado:** Faz 1d20 contra Vigoroso e apresenta o resultado.

   **Perfil:** GM e dono da ficha.

55. [ ] **Falha na inanição**

   **Fazer:** Obter falha no teste diário.

   **Esperado:** Perde um ponto temporário de Vigoroso, preservando outros modificadores.

   **Perfil:** GM e dono da ficha.

56. [ ] **Morte por inanição**

   **Fazer:** Preparar Vigoroso reduzido e obter falha que o leve a zero.

   **Esperado:** Marca morte e encerra a sequência pertinente sem ressuscitar automaticamente.

   **Perfil:** GM e dono da ficha.

57. [ ] **Remover Fome não cura a penalidade**

   **Fazer:** Retirar o efeito após perder Vigoroso.

   **Esperado:** A redução temporária continua até ser recuperada por mecanismo apropriado.

   **Perfil:** GM e dono da ficha.

58. [ ] **Recuperar Vigoroso descansando**

   **Fazer:** Sem Fome e com penalidade acumulada, descansar vários dias.

   **Esperado:** Recupera até um ponto de Vigoroso por dia, sem ultrapassar a penalidade acumulada.

   **Perfil:** GM e dono da ficha.

59. [ ] **Botão Descanso**

   **Fazer:** Alternar exibição do botão e abrir ficha de jogador.

   **Esperado:** Botão aparece conforme a configuração.

   **Perfil:** GM e dono da ficha. **Opções:** `enableRestButton`.

60. [ ] **Descanso de vários dias**

   **Fazer:** Informar dias e cura por dia com personagem ferido.

   **Esperado:** Soma a cura de cada dia até a Vitalidade máxima.

   **Perfil:** GM e dono da ficha. **Opções:** `enableRestHealing`, `restHealing`.

61. [ ] **Cura automática desligada**

   **Fazer:** Desligar recuperação automática e descansar.

   **Esperado:** Não restaura Vitalidade por essa opção; demais rotinas de descanso continuam independentes.

   **Perfil:** GM e dono da ficha.

62. [ ] **Corrupção temporária**

   **Fazer:** Descansar ao menos um dia sobrevivendo.

   **Esperado:** Zera corrupção temporária e preserva a permanente.

   **Perfil:** GM e dono da ficha.

63. [ ] **Falhas de morte após descanso**

   **Fazer:** Descansar com falhas de morte registradas.

   **Esperado:** A rotina zera o contador de testes de morte falhos.

   **Perfil:** GM e dono da ficha.

64. [ ] **Gastar suprimentos no descanso**

   **Fazer:** Marcar gasto de pão/alimentos com saldo para todo o período.

   **Esperado:** Consome os dias solicitados uma vez e publica o saldo.

   **Perfil:** GM e dono da ficha.

65. [ ] **Suprimentos insuficientes para o período**

   **Fazer:** Tentar descanso de vários dias com gasto marcado e saldo insuficiente.

   **Esperado:** Não trata consumo parcial como abastecimento completo; registrar aviso e resultados do descanso.

   **Perfil:** GM e dono da ficha.

66. [ ] **Cancelar descanso**

   **Fazer:** Fechar/cancelar sem confirmar.

   **Esperado:** Não altera Vitalidade, corrupção, falhas ou estoque.

   **Perfil:** GM e dono da ficha.

67. [ ] **Descanso e calendário**

   **Fazer:** Anotar data, descansar vários dias e consultar data novamente.

   **Esperado:** RestService não chama avanço do calendário; não pressupor avanço de data só por resolver a cura do descanso.

   **Perfil:** GM e dono da ficha.


<a id="bloco-5"></a>

### 068–081 — Cura Herbal e Médico

Fontes: [herbal-cure.mjs](../scripts/herbal-cure.mjs), [herbal-cure-rules.mjs](../scripts/herbal-cure-rules.mjs), [sheet-ui.mjs](../scripts/sheet-ui.mjs), [sockets.mjs](../scripts/sockets.mjs).

68. [ ] **Usar pela imagem**

   **Fazer:** Clicar na imagem de Cura Herbal no inventário.

   **Esperado:** Abre o uso específico; clicar no restante da linha conserva a ação correspondente da ficha.

   **Perfil:** GM e dono da ficha.

69. [ ] **Curar a si mesmo**

   **Fazer:** Sem alvo, usar uma dose com ferimento.

   **Esperado:** O próprio personagem recebe a cura.

   **Perfil:** GM e dono da ficha.

70. [ ] **Curar um alvo**

   **Fazer:** Marcar exatamente um token e usar Cura Herbal.

   **Esperado:** A cura vai ao alvo marcado, com autorização validada pelo GM.

   **Perfil:** GM e dono da ficha.

71. [ ] **Mais de um alvo**

   **Fazer:** Marcar dois tokens e tentar usar.

   **Esperado:** Bloqueia a escolha ambígua sem consumir dose.

   **Perfil:** GM e dono da ficha.

72. [ ] **Sem Médico**

   **Fazer:** Usar o método simples com personagem sem a habilidade.

   **Esperado:** Recupera 1 de Vitalidade e consome uma dose.

   **Perfil:** GM e dono da ficha.

73. [ ] **Escolher método**

   **Fazer:** Com Médico, escolher cura simples ou aplicação da habilidade.

   **Esperado:** A escolha determina se há teste e qual fórmula será usada.

   **Perfil:** GM e dono da ficha.

74. [ ] **Médico Novato**

   **Fazer:** Usar a habilidade e obter sucesso/falha.

   **Esperado:** Código atual: sucesso cura 1d6; falha cura 1. Conferir ambos os resultados.

   **Perfil:** GM e dono da ficha.

75. [ ] **Médico Adepto**

   **Fazer:** Usar a habilidade e obter sucesso/falha.

   **Esperado:** Código atual: sucesso cura 1d8; falha cura 1.

   **Perfil:** GM e dono da ficha.

76. [ ] **Médico Mestre**

   **Fazer:** Usar a habilidade e obter sucesso/falha.

   **Esperado:** Sucesso cura 1d10; falha cura 1d6.

   **Perfil:** GM e dono da ficha.

77. [ ] **Consumo da dose**

   **Fazer:** Usar com sucesso e com falha na aplicação.

   **Esperado:** Uma tentativa válida consome uma dose, inclusive na falha.

   **Perfil:** GM e dono da ficha.

78. [ ] **Alvo sem ferimentos**

   **Fazer:** Usar em alvo com Vitalidade cheia.

   **Esperado:** Não consome dose.

   **Perfil:** GM e dono da ficha.

79. [ ] **Alvo morto**

   **Fazer:** Usar em alvo morto.

   **Esperado:** Não consome dose nem trata a cura como ressurreição.

   **Perfil:** GM e dono da ficha.

80. [ ] **Alvo Morrendo**

   **Fazer:** Curar personagem a zero, sem estado de morte final.

   **Esperado:** Ao passar de zero pode remover Morrendo pelo fluxo de recuperação.

   **Perfil:** GM e dono da ficha.

81. [ ] **Dose esgotada e cancelamento**

   **Fazer:** Usar sem estoque e cancelar escolha de método.

   **Esperado:** Não cura nem consome recursos indevidos.

   **Perfil:** GM e dono da ficha.


<a id="bloco-6"></a>

### 082–109 — Aljavas, disparos e recuperação de munição

Fontes: [ammo.mjs](../scripts/ammo.mjs), [ammo-roll.mjs](../scripts/ammo-roll.mjs), [weapon-wrapper.mjs](../scripts/weapon-wrapper.mjs), [item-flags.mjs](../scripts/item-flags.mjs), [hotbar.mjs](../scripts/hotbar.mjs), [sheet-ui.mjs](../scripts/sheet-ui.mjs), [roll-context.mjs](../scripts/roll-context.mjs).

82. [ ] **Reconhecer arma de projétil**

   **Fazer:** Abrir ataque com arco e besta reconhecidos pelo sistema.

   **Esperado:** Cada rota usa a categoria de munição configurada; ataque corpo a corpo não consome projétil.

   **Perfil:** GM e dono da ficha. **Opções:** `enableAmmoConsumption`.

83. [ ] **Aljava equipada e ativa**

   **Fazer:** Adicionar aljavas nos estados Equipado, Ativo e Outro.

   **Esperado:** Somente aljavas acessíveis são oferecidas no fluxo de ataque/HUD.

   **Perfil:** GM e dono da ficha. **Opções:** `enableQuiverAmmoContainers`.

84. [ ] **Capacidade da aljava**

   **Fazer:** Recarregar uma aljava vazia com quantidade superior ao limite.

   **Esperado:** Não excede a capacidade, padrão 12.

   **Perfil:** GM e dono da ficha. **Opções:** `quiverCapacity`.

85. [ ] **Recarga parcial**

   **Fazer:** Carregar parte de uma pilha de flechas/virotes.

   **Esperado:** Diminui estoque avulso e aumenta carga na mesma quantidade.

   **Perfil:** GM e dono da ficha.

86. [ ] **Recarga sem estoque**

   **Fazer:** Tentar carregar mais do que existe.

   **Esperado:** Limita ou recusa sem criar munição.

   **Perfil:** GM e dono da ficha.

87. [ ] **Vários tipos na aljava**

   **Fazer:** Carregar munições regulares e especiais em quantidades distintas.

   **Esperado:** As entradas preservam identidade, quantidade e metadados.

   **Perfil:** GM e dono da ficha.

88. [ ] **Descarregar parcialmente**

   **Fazer:** Retirar parte da carga pelo menu da aljava.

   **Esperado:** A quantidade volta ao inventário como munição avulsa.

   **Perfil:** GM e dono da ficha.

89. [ ] **Descarregar totalmente**

   **Fazer:** Esvaziar a aljava.

   **Esperado:** Carga e estoque final fecham sem perdas ou duplicação.

   **Perfil:** GM e dono da ficha.

90. [ ] **Cancelar recarga/descarregamento**

   **Fazer:** Fechar o diálogo sem confirmar.

   **Esperado:** Estoque e carga ficam iguais.

   **Perfil:** GM e dono da ficha.

91. [ ] **Selecionar aljava e projétil no ataque**

   **Fazer:** Abrir ataque com duas aljavas e escolher uma entrada específica.

   **Esperado:** O seletor mostra a munição disponível e o disparo usa a entrada escolhida.

   **Perfil:** GM e dono da ficha.

92. [ ] **Consumo no disparo**

   **Fazer:** Confirmar um ataque com estoque.

   **Esperado:** Consome exatamente um projétil.

   **Perfil:** GM e dono da ficha.

93. [ ] **Cancelar ataque**

   **Fazer:** Fechar diálogo antes de rolar.

   **Esperado:** Não consome munição.

   **Perfil:** GM e dono da ficha.

94. [ ] **Sem munição carregada**

   **Fazer:** Tentar atacar com aljava vazia e modo de aljava ligado.

   **Esperado:** Informa falta de carga e impede o disparo integrado.

   **Perfil:** GM e dono da ficha.

95. [ ] **Consumo direto sem aljava**

   **Fazer:** Desligar aljavas e atacar com munição avulsa.

   **Esperado:** Consome diretamente do estoque elegível.

   **Perfil:** GM e dono da ficha. **Opções:** `enableQuiverAmmoContainers`.

96. [ ] **Consumo desligado**

   **Fazer:** Desligar consumo automático e atacar.

   **Esperado:** A arma conserva o fluxo de rolagem sem desconto automático.

   **Perfil:** GM e dono da ficha. **Opções:** `enableAmmoConsumption`.

97. [ ] **Registrar acerto**

   **Fazer:** Acertar com uma flecha ou virote.

   **Esperado:** Adiciona um projétil à fila recuperável.

   **Perfil:** GM e dono da ficha. **Opções:** `enableHitTracking`.

98. [ ] **Ataque sem acerto**

   **Fazer:** Errar o ataque.

   **Esperado:** O consumo ocorre, mas a fila de acertos não cresce por esse disparo.

   **Perfil:** GM e dono da ficha.

99. [ ] **HUD de recuperação**

   **Fazer:** Acumular acertos e testar com fila vazia.

   **Esperado:** Contador aparece quando há pendências e respeita a opção de exibição.

   **Perfil:** GM e dono da ficha. **Opções:** `showAmmoRecoveryHud`.

100. [ ] **HUD de aljavas**

   **Fazer:** Selecionar tokens e alterar cargas/estados das aljavas.

   **Esperado:** A HUD acompanha o personagem e as cargas sem duplicação.

   **Perfil:** GM e dono da ficha. **Opções:** `showQuiverHud`.

101. [ ] **Recuperar sessão inteira**

   **Fazer:** Clicar uma vez no controle de recuperação com vários projéteis.

   **Esperado:** Rola por projétil e processa a sessão pendente sem exigir vários cliques.

   **Perfil:** GM e dono da ficha. **Opções:** `enableAmmoRecovery`.

102. [ ] **Munição comum**

   **Fazer:** Recuperar projétil comum com alvo padrão.

   **Esperado:** O limite usado é 10, salvo configuração.

   **Perfil:** GM e dono da ficha. **Opções:** `ammoRecoveryCommonTarget`.

103. [ ] **Munição de qualidade**

   **Fazer:** Recuperar projétil classificado como de qualidade.

   **Esperado:** O limite usado é 15, salvo configuração.

   **Perfil:** GM e dono da ficha. **Opções:** `ammoRecoveryQualityTarget`.

104. [ ] **Munição mística/alquímica**

   **Fazer:** Recuperar munição classificada nessa categoria.

   **Esperado:** O limite usado é 17, salvo configuração.

   **Perfil:** GM e dono da ficha. **Opções:** `ammoRecoveryMysticalTarget`.

105. [ ] **Recuperação única**

   **Fazer:** Desligar separação por qualidade e definir outro alvo.

   **Esperado:** Todas as classes passam a usar o alvo único configurado.

   **Perfil:** GM e dono da ficha. **Opções:** `enableAmmoRecoveryByQuality`, `ammoRecoveryFlatTarget`.

106. [ ] **Destino da munição recuperada**

   **Fazer:** Concluir sessão com projéteis recuperados e perdidos.

   **Esperado:** Somente recuperados retornam; identidade/descrição da munição se mantém.

   **Perfil:** GM e dono da ficha.

107. [ ] **Repetir recuperação**

   **Fazer:** Clicar novamente ou por dois clientes na mesma sessão já resolvida.

   **Esperado:** Não cria um segundo lote de munição a partir da mesma pendência.

   **Perfil:** GM e dono da ficha.

108. [ ] **Links de munição no chat**

   **Fazer:** Clicar no nome de munição conhecida em ataque, recarga e recuperação.

   **Esperado:** Abre a ficha correspondente quando há UUID válido; não depende de um toggle dedicado atualmente registrado.

   **Perfil:** GM e dono da ficha.

109. [ ] **Trocar munição no diálogo**

   **Fazer:** Selecionar munições especiais diferentes antes de rolar.

   **Esperado:** Os pacotes de modificadores acompanham a seleção final, sem acumular bônus de munições anteriores.

   **Perfil:** GM e dono da ficha.


<a id="bloco-7"></a>

### 110–120 — Tipos de munição especial

Fontes: [special-ammo.mjs](../scripts/special-ammo.mjs), [ammo-roll.mjs](../scripts/ammo-roll.mjs), [sheet-ui.mjs](../scripts/sheet-ui.mjs).

110. [ ] **Precisão**

   **Fazer:** Selecionar Flecha de Precisão/Precision Arrow e comparar ataque regular.

   **Esperado:** Pacote de ataque adiciona +1 conforme o código.

   **Perfil:** GM e dono da ficha.

111. [ ] **Ponta perfurante**

   **Fazer:** Selecionar ponta perfurante/Bodkin.

   **Esperado:** Pacote de dano +1 fica disponível; conferir adequação da condição de armadura na mesa.

   **Perfil:** GM e dono da ficha.

112. [ ] **Flamejante**

   **Fazer:** Selecionar munição flamejante e conferir os modificadores nativos.

   **Esperado:** Disponibiliza pacote de queima 1d4 por rodada e duração 1d4; resolução efetiva segue o sistema.

   **Perfil:** GM e dono da ficha.

113. [ ] **Sibilante**

   **Fazer:** Usar munição sibilante e consultar descrição.

   **Esperado:** Mostra a descrição de sinal sonoro; não pressupor automação tática de aliados.

   **Perfil:** GM e dono da ficha.

114. [ ] **Arpéu**

   **Fazer:** Usar munição Arpéu e abrir sua descrição.

   **Esperado:** Descreve gancho e distâncias; não cria corda/objeto no canvas automaticamente.

   **Perfil:** GM e dono da ficha.

115. [ ] **Cabeça de martelo**

   **Fazer:** Usar essa munição e consultar o texto do projétil.

   **Esperado:** Descreve o teste Vigoroso menos dano e perda de ações; não confundir descrição com efeito automaticamente aplicado.

   **Perfil:** GM e dono da ficha.

116. [ ] **Cauda de andorinha**

   **Fazer:** Usar essa munição e abrir descrição.

   **Esperado:** Descreve bônus de Armadura e sangramento; conferir manualmente o que o sistema efetivamente resolve.

   **Perfil:** GM e dono da ficha.

117. [ ] **Cortador de corda**

   **Fazer:** Usar essa munição.

   **Esperado:** Descrição informa -5 e corte em sucesso; não supor alvo corda ou destruição automática.

   **Perfil:** GM e dono da ficha.

118. [ ] **Flecha de laço**

   **Fazer:** Usar essa munição.

   **Esperado:** Descrição inclui remoção, dano e restrição; efeitos narrativos não são uma automação completa de agarrar.

   **Perfil:** GM e dono da ficha.

119. [ ] **Flecha Certeira**

   **Fazer:** Usar True Arrow e conferir a classe de recuperação.

   **Esperado:** É reconhecida como mística; a regra de passagem por combatentes é descritiva.

   **Perfil:** GM e dono da ficha.

120. [ ] **Raio Atordoante**

   **Fazer:** Usar Stun/Stunning Bolt.

   **Esperado:** Reconhece classe mística e descrição do teste/queda; não presumir que a descrição executa tudo sozinha.

   **Perfil:** GM e dono da ficha.


<a id="bloco-8"></a>

### 121–138 — Sobrecarga, peso e painel da ficha

Fontes: [encumbrance.mjs](../scripts/encumbrance.mjs), [encumbrance-db.mjs](../scripts/encumbrance-db.mjs), [encumbrance-visuals.mjs](../scripts/encumbrance-visuals.mjs), [sheet-ui.mjs](../scripts/sheet-ui.mjs), [actor-preparation.mjs](../scripts/actor-preparation.mjs).

121. [ ] **Painel de carga**

   **Fazer:** Abrir ficha com equipamentos carregados.

   **Esperado:** Mostra carga, capacidade e situação do personagem.

   **Perfil:** GM e dono da ficha. **Opções:** `enableEncumbrance`.

122. [ ] **Capacidade por Vigoroso**

   **Fazer:** Alterar Vigoroso e conferir o limite.

   **Esperado:** A capacidade acompanha o valor considerado pela regra.

   **Perfil:** GM e dono da ficha.

123. [ ] **Transportador**

   **Fazer:** Adicionar/remover o dom Transportador.

   **Esperado:** Capacidade passa a 1,5 vez Vigoroso conforme reconhecimento da habilidade.

   **Perfil:** GM e dono da ficha.

124. [ ] **Penalidade de Defesa**

   **Fazer:** Exceder a capacidade em alguns pontos.

   **Esperado:** Aplica penalidade por excesso sem acumulá-la novamente a cada renderização.

   **Perfil:** GM e dono da ficha.

125. [ ] **Imobilização**

   **Fazer:** Ultrapassar o dobro da capacidade pertinente.

   **Esperado:** Perfil de movimento fica bloqueado pela sobrecarga quando a integração está ativa.

   **Perfil:** GM e dono da ficha.

126. [ ] **Indicador de sobrecarga no token**

   **Fazer:** Cruzar o limite e voltar para carga normal.

   **Esperado:** O indicador é adicionado/removido automaticamente, sem efeito mecânico duplicado.

   **Perfil:** GM e dono da ficha.

127. [ ] **Arma e armadura ativas**

   **Fazer:** Comparar peso de arma empunhada e armadura vestida com estado Equipado.

   **Esperado:** Ativas seguem as exceções de carga; Equipadas carregadas contam conforme regra.

   **Perfil:** GM e dono da ficha.

128. [ ] **Equipamento/artefato ativo**

   **Fazer:** Comparar os estados Ativo, Equipado e Outro.

   **Esperado:** Ativo/Equipado contam como carregados; Outro fora de recipiente carregado não conta.

   **Perfil:** GM e dono da ficha.

129. [ ] **Peso dos conteúdos**

   **Fazer:** Guardar itens em recipiente carregado e depois deixar o recipiente em Outro.

   **Esperado:** O peso acompanha o estado da raiz carregada, sem dupla contagem dos conteúdos.

   **Perfil:** GM e dono da ficha.

130. [ ] **Pilhas de projéteis**

   **Fazer:** Comparar quantidades imediatamente abaixo, no limite e acima de um pacote.

   **Esperado:** Arredondamento do pacote e peso agregado seguem o banco de pesos.

   **Perfil:** GM e dono da ficha.

131. [ ] **Moedas e outros pacotes**

   **Fazer:** Variar estoque de itens com regra de pacote.

   **Esperado:** Carga usa tamanho e slots do pacote, sem tratar cada unidade como um item inteiro.

   **Perfil:** GM e dono da ficha.

132. [ ] **Campo Peso no Item**

   **Fazer:** Abrir equipamento, arma e armadura e alterar Peso quando editável.

   **Esperado:** Persiste regra manual do Item e atualiza o painel do ator.

   **Perfil:** GM e dono da ficha.

133. [ ] **Peso calculado por pacote**

   **Fazer:** Abrir Item cujo peso de pilha é calculado automaticamente.

   **Esperado:** O campo calculado não pode ser sobrescrito como se fosse peso simples.

   **Perfil:** GM e dono da ficha.

134. [ ] **Regra de peso aprendida**

   **Fazer:** Definir peso de item novo como GM e criar outra cópia equivalente.

   **Esperado:** Regra dinâmica pode ser reutilizada conforme normalização e banco de pesos.

   **Perfil:** GM e dono da ficha.

135. [ ] **Nomes e acentos**

   **Fazer:** Comparar itens reconhecidos com acentos/maiúsculas e nomes não catalogados.

   **Esperado:** Reconhecimento normaliza texto; os dados do item não são renomeados.

   **Perfil:** GM e dono da ficha.

136. [ ] **Armas pesadas e qualidade Maciça**

   **Fazer:** Comparar armas e armaduras com classes/qualidades reconhecidas.

   **Esperado:** O cálculo específico se mantém; verificar o peso exibido contra a escolha de regra da mesa.

   **Perfil:** GM e dono da ficha.

137. [ ] **Desativar carga**

   **Fazer:** Desligar a regra com ator sobrecarregado.

   **Esperado:** Remove a penalidade derivada e o indicador pertinentes sem apagar o inventário.

   **Perfil:** GM e dono da ficha.

138. [ ] **Atualizar sem F5**

   **Fazer:** Adicionar/excluir item, mudar quantidade e estados, fechar/reabrir ficha.

   **Esperado:** Carga e Defesa se recalculam sem persistir penalidade a cada render.

   **Perfil:** GM e dono da ficha.


<a id="bloco-9"></a>

### 139–165 — Recipientes dentro das fichas

Fontes: [containers.mjs](../scripts/containers.mjs), [sheet-ui.mjs](../scripts/sheet-ui.mjs), [item-flags.mjs](../scripts/item-flags.mjs), [settings.mjs](../scripts/settings.mjs).

139. [ ] **Reconhecer recipiente**

   **Fazer:** Adicionar mochila, saco, bolsa e baú.

   **Esperado:** Oferece interface de recipiente nos nomes/tipos reconhecidos.

   **Perfil:** GM e dono da ficha. **Opções:** `enableContainers`.

140. [ ] **Marcar Item como recipiente**

   **Fazer:** Usar configuração de recipiente em Item não reconhecido.

   **Esperado:** A marca manual permite gerenciar seu conteúdo.

   **Perfil:** GM e dono da ficha.

141. [ ] **Desmarcar recipiente**

   **Fazer:** Remover a marca manual quando apropriado.

   **Esperado:** O comportamento segue a marca explícita e não apenas o nome.

   **Perfil:** GM e dono da ficha.

142. [ ] **Capacidade de recipiente**

   **Fazer:** Configurar slots ou limite conforme o diálogo.

   **Esperado:** A ficha mostra capacidade e uso; impede armazenar além da regra definida.

   **Perfil:** GM e dono da ficha.

143. [ ] **Guardar pilha inteira**

   **Fazer:** Usar menu Guardar em item acessível e escolher mochila.

   **Esperado:** O item passa à sublista, preserva quantidade e guarda seu estado anterior.

   **Perfil:** GM e dono da ficha.

144. [ ] **Guardar parte da pilha**

   **Fazer:** Informar quantidade parcial no armazenamento.

   **Esperado:** Separa a parte guardada e conserva o restante no inventário.

   **Perfil:** GM e dono da ficha.

145. [ ] **Recipiente ou item em Outro**

   **Fazer:** Tentar guardar/retirar sem acesso ao item ou recipiente.

   **Esperado:** A operação inacessível é bloqueada com aviso.

   **Perfil:** GM e dono da ficha.

146. [ ] **Abrir/recolher**

   **Fazer:** Clicar com botão esquerdo no recipiente.

   **Esperado:** Alterna somente a sublista apropriada.

   **Perfil:** GM e dono da ficha.

147. [ ] **Expansão por cliente**

   **Fazer:** Abrir no GM, recolher no jogador, fechar e reabrir.

   **Esperado:** Cada cliente preserva sua preferência sem alterar a do outro.

   **Perfil:** GM e dono da ficha.

148. [ ] **Ver item guardado**

   **Fazer:** Usar Ver na sublista.

   **Esperado:** Abre a ficha real do Item.

   **Perfil:** GM e dono da ficha.

149. [ ] **Usar item guardado elegível**

   **Fazer:** Acionar uso de alimento/Cura Herbal na sublista quando permitido.

   **Esperado:** Respeita acessibilidade, estoque e a ação específica, sem cópia temporária indevida.

   **Perfil:** GM e dono da ficha.

150. [ ] **Retirar tudo**

   **Fazer:** Usar Retirar em item guardado.

   **Esperado:** Devolve a pilha inteira e restaura o estado anterior.

   **Perfil:** GM e dono da ficha.

151. [ ] **Dividir na retirada**

   **Fazer:** Usar Dividir e informar apenas parte.

   **Esperado:** Retira somente a quantidade solicitada e mantém o restante guardado.

   **Perfil:** GM e dono da ficha.

152. [ ] **Arrastar para guardar**

   **Fazer:** Arrastar Item para a linha de recipiente da mesma ficha.

   **Esperado:** Executa o armazenamento e preserva o vínculo correto.

   **Perfil:** GM e dono da ficha.

153. [ ] **Arrastar para retirar**

   **Fazer:** Arrastar conteúdo para fora da sublista em zona aceita.

   **Esperado:** Executa a retirada, sem duplicar o Item.

   **Perfil:** GM e dono da ficha.

154. [ ] **Recipiente dentro de recipiente**

   **Fazer:** Tentar guardar recipiente em outro recipiente ou nele mesmo.

   **Esperado:** O fluxo normal de Guardar exclui recipientes como conteúdo elegível; não oferece aninhamento comum. Transferências preservam árvores legadas existentes.

   **Perfil:** GM e dono da ficha.

155. [ ] **Combinar itens equivalentes**

   **Fazer:** Guardar/retirar pilhas realmente equivalentes.

   **Esperado:** Pode combinar quantidades preservando todos os dados pertinentes.

   **Perfil:** GM e dono da ficha.

156. [ ] **Itens apenas parecidos**

   **Fazer:** Repetir com mesmo nome e efeitos/flags/estados diferentes.

   **Esperado:** Itens diferentes não devem ser fundidos perdendo informação.

   **Perfil:** GM e dono da ficha.

157. [ ] **Excluir recipiente com conteúdo**

   **Fazer:** Tentar excluir mochila cheia.

   **Esperado:** Bloqueia exclusão até retirar ou transferir corretamente o conteúdo.

   **Perfil:** GM e dono da ficha.

158. [ ] **Zerar recipiente cheio**

   **Fazer:** Tentar reduzir sua quantidade a zero.

   **Esperado:** Bloqueia esgotamento que deixaria conteúdos órfãos.

   **Perfil:** GM e dono da ficha.

159. [ ] **Recipiente vazio**

   **Fazer:** Esvaziar e então excluir.

   **Esperado:** Exclusão é permitida pelo fluxo normal.

   **Perfil:** GM e dono da ficha.

160. [ ] **Vínculo órfão**

   **Fazer:** Em cópia de teste, carregar ator com vínculo para recipiente inexistente.

   **Esperado:** Um GM ativo recupera conteúdo para inventário e estado acessível.

   **Perfil:** GM e dono da ficha.

161. [ ] **Desligar recipientes**

   **Fazer:** Desativar com itens guardados.

   **Esperado:** Suspende interface e restaura estados visíveis sem apagar vínculos.

   **Perfil:** GM e dono da ficha.

162. [ ] **Religar recipientes**

   **Fazer:** Reativar após teste anterior.

   **Esperado:** Restaura organização e estados internos sem duplicação.

   **Perfil:** GM e dono da ficha.

163. [ ] **Equipamento de Acampar**

   **Fazer:** Adicionar item e conferir a lista Contém da descrição ou referências reconhecidas.

   **Esperado:** Inicializa conteúdos elegíveis uma única vez quando as referências podem ser resolvidas.

   **Perfil:** GM e dono da ficha.

164. [ ] **Restrição do kit de acampar**

   **Fazer:** Tentar guardar conteúdo permitido e conteúdo estranho ao kit.

   **Esperado:** As restrições do recipiente especial são respeitadas.

   **Perfil:** GM e dono da ficha.

165. [ ] **Sem conteúdo oficial disponível**

   **Fazer:** Adicionar kit sem conseguir resolver referências dos itens internos.

   **Esperado:** Não cria duplicatas genéricas nem corrompe o kit; registrar itens que não puderam ser inicializados.

   **Perfil:** GM e dono da ficha.


<a id="bloco-10"></a>

### 166–180 — Recipientes no canvas e transferência

Fontes: [ground-containers.mjs](../scripts/ground-containers.mjs), [container-transfer.mjs](../scripts/container-transfer.mjs), [containers.mjs](../scripts/containers.mjs), [sockets.mjs](../scripts/sockets.mjs).

166. [ ] **Largar recipiente na cena**

   **Fazer:** Arrastar recipiente acessível da ficha para o canvas.

   **Esperado:** Cria token vinculado ao recipiente e conserva sua árvore de conteúdo.

   **Perfil:** GM e dono da ficha.

167. [ ] **Estado do recipiente largado**

   **Fazer:** Largar mochila carregada e verificar ficha/carga.

   **Esperado:** Estado e peso refletem o recipiente no chão, sem apagar o Item de origem.

   **Perfil:** GM e dono da ficha.

168. [ ] **Recolher pelo token**

   **Fazer:** Usar Recolher no HUD do recipiente.

   **Esperado:** Remove representação no chão e restaura estado anterior na ficha.

   **Perfil:** GM e dono da ficha.

169. [ ] **Sem permissão de cena**

   **Fazer:** Tentar largar/recolher como usuário sem criar/remover Tokens.

   **Esperado:** Informa a limitação sem perder o recipiente.

   **Perfil:** GM e dono da ficha.

170. [ ] **Transferir entre fichas**

   **Fazer:** Usar arraste/HUD para entregar recipiente a outro Actor autorizado.

   **Esperado:** Move recipiente e conteúdos como uma árvore integral.

   **Perfil:** GM e dono da ficha.

171. [ ] **Transferência sem propriedade**

   **Fazer:** Tentar receber ou retirar de ficha não autorizada.

   **Esperado:** Bloqueia a operação privilegiada sem alterar origem ou destino.

   **Perfil:** GM e dono da ficha.

172. [ ] **Transferência de recipiente cheio**

   **Fazer:** Transferir árvore com itens em vários níveis.

   **Esperado:** Remapeia vínculos para os novos IDs e preserva quantidades e flags.

   **Perfil:** GM e dono da ficha.

173. [ ] **Sem divisão de recipiente cheio**

   **Fazer:** Tentar transferir apenas parte de um recipiente com conteúdo.

   **Esperado:** A transferência integral prevalece; não divide a árvore pela metade.

   **Perfil:** GM e dono da ficha.

174. [ ] **Item Piles Symbaroum ativo**

   **Fazer:** Entregar recipiente completo a uma pilha compatível.

   **Esperado:** Mantém a hierarquia via provedor reconhecido.

   **Perfil:** GM e dono da ficha.

175. [ ] **Sem Item Piles**

   **Fazer:** Repetir fluxo entre fichas com módulo de pilhas ausente.

   **Esperado:** Fluxo nativo autorizado continua utilizável.

   **Perfil:** GM e dono da ficha.

176. [ ] **Pilhas incompatíveis**

   **Fazer:** Ativar provedor genérico/incompatível em ambiente de teste e tentar transferência.

   **Esperado:** Informa o conflito; não faz transferência parcial nem apaga os originais.

   **Perfil:** GM e dono da ficha.

177. [ ] **Token removido manualmente**

   **Fazer:** Excluir token de recipiente e recarregar/reconciliar.

   **Esperado:** A reconciliação recupera ou repara o vínculo pertinente.

   **Perfil:** GM e dono da ficha.

178. [ ] **Item de origem removido**

   **Fazer:** Simular referência de chão órfã em cópia de teste.

   **Esperado:** Reconciliação trata o token órfão sem confundir outros tokens.

   **Perfil:** GM e dono da ficha.

179. [ ] **Token de recipiente não é criatura**

   **Fazer:** Aplicar rotinas de combate/levantar/seleção perto de recipiente no chão.

   **Esperado:** Não recebe os controles destinados a personagens e monstros.

   **Perfil:** GM e dono da ficha.

180. [ ] **Falha parcial de transferência**

   **Fazer:** Interromper uma transferência em ambiente de teste e conferir ambos os lados.

   **Esperado:** Não deixar perda/duplicação silenciosa; guardar console e IDs se houver falha.

   **Perfil:** GM e dono da ficha.


<a id="bloco-11"></a>

### 181–188 — Gerenciador de dinheiro

Fontes: [money.mjs](../scripts/money.mjs), [sheet-ui.mjs](../scripts/sheet-ui.mjs).

181. [ ] **Abrir pela ficha**

   **Fazer:** Clicar no botão de moedas junto a Dinheiro.

   **Esperado:** Abre operações Adicionar e Gastar para dono/GM.

   **Perfil:** GM e dono da ficha.

182. [ ] **Adicionar moedas**

   **Fazer:** Adicionar combinações de Taler, Xelim e Ortega.

   **Esperado:** Soma ao saldo e normaliza 1 Taler = 10 Xelins = 100 Ortegas.

   **Perfil:** GM e dono da ficha.

183. [ ] **Gastar com troco**

   **Fazer:** Com 1 Taler, gastar 1 Ortega.

   **Esperado:** Saldo normalizado fica 0 Taler, 9 Xelins e 9 Ortegas.

   **Perfil:** GM e dono da ficha.

184. [ ] **Gasto acima do saldo**

   **Fazer:** Tentar gastar mais do que existe.

   **Esperado:** Recusa sem alterar o saldo.

   **Perfil:** GM e dono da ficha.

185. [ ] **Valores inválidos**

   **Fazer:** Informar negativos, decimais e valores muito altos.

   **Esperado:** Interface valida/normaliza e impede estouro de inteiro seguro.

   **Perfil:** GM e dono da ficha.

186. [ ] **Cancelar operação**

   **Fazer:** Fechar diálogo sem confirmar.

   **Esperado:** Saldo não muda.

   **Perfil:** GM e dono da ficha.

187. [ ] **Sem propriedade**

   **Fazer:** Abrir ficha como observador e tentar o controle.

   **Esperado:** Não permite alteração de dinheiro.

   **Perfil:** GM e dono da ficha.

188. [ ] **Duas operações simultâneas**

   **Fazer:** GM e dono adicionam/gastam sobre o mesmo saldo ao mesmo tempo.

   **Esperado:** RISCO A INVESTIGAR: a implementação lê e atualiza diretamente o Actor, sem fila própria; verificar se algum lançamento é perdido.

   **Perfil:** GM e dono da ficha.


<a id="bloco-12"></a>

### 189–218 — Sacar, guardar e trocar armas

Fontes: [weapon-readiness.mjs](../scripts/weapon-readiness.mjs), [weapon-readiness-hud.mjs](../scripts/weapon-readiness-hud.mjs), [weapon-readiness-visuals.mjs](../scripts/weapon-readiness-visuals.mjs), [weapon-wrapper.mjs](../scripts/weapon-wrapper.mjs), [sheet-ui.mjs](../scripts/sheet-ui.mjs).

189. [ ] **Botão rápido de armas**

   **Fazer:** Selecionar personagem com armas e clicar no controle.

   **Esperado:** Abre lista de armas elegíveis.

   **Perfil:** GM e dono da ficha. **Opções:** `enableWeaponReadiness`, `showWeaponReadinessButton`.

190. [ ] **Somente personagens**

   **Fazer:** Comparar personagem, PNJ, monstro e token de recipiente.

   **Esperado:** Controle e bloqueio de prontidão são destinados a personagens jogadores.

   **Perfil:** GM e dono da ficha.

191. [ ] **Armas naturais/desarmado**

   **Fazer:** Atacar com arma natural/referência unarmed.

   **Esperado:** Continua disponível sem exigir saque de uma arma física.

   **Perfil:** GM e dono da ficha.

192. [ ] **Arma guardada em recipiente**

   **Fazer:** Tentar sacá-la ou atacar por atalhos.

   **Esperado:** Não a oferece como arma acessível enquanto estiver guardada.

   **Perfil:** GM e dono da ficha.

193. [ ] **Sacar uma arma**

   **Fazer:** Selecionar arma na lista ou menu de contexto.

   **Esperado:** Passa ao estado empunhado e atualiza indicadores.

   **Perfil:** GM e dono da ficha.

194. [ ] **Guardar uma arma**

   **Fazer:** Selecionar arma já sacada.

   **Esperado:** Guarda e atualiza os mesmos indicadores.

   **Perfil:** GM e dono da ficha.

195. [ ] **Guardar todas**

   **Fazer:** Usar ação específica com mais de uma arma em mãos.

   **Esperado:** Guarda todas em uma operação coerente.

   **Perfil:** GM e dono da ficha.

196. [ ] **Atacar com arma guardada**

   **Fazer:** Tentar pela ficha, HUD e rota de macro integrada.

   **Esperado:** Bloqueia o ataque elegível até sacar a arma.

   **Perfil:** GM e dono da ficha.

197. [ ] **Duas armas de uma mão**

   **Fazer:** Sacar uma combinação que use duas mãos no total.

   **Esperado:** Aceita sem exigir substituição indevida.

   **Perfil:** GM e dono da ficha.

198. [ ] **Arma e escudo**

   **Fazer:** Sacar arma de uma mão e escudo.

   **Esperado:** Permite combinação válida de duas mãos.

   **Perfil:** GM e dono da ficha.

199. [ ] **Arma pesada ou à distância**

   **Fazer:** Sacar arma que ocupe duas mãos.

   **Esperado:** Aplica o custo de mãos da classe nativa.

   **Perfil:** GM e dono da ficha.

200. [ ] **Arma longa com escudo**

   **Fazer:** Sacar arma longa e escudo conforme os modos reconhecidos.

   **Esperado:** Representa modo de uma mão e restaura qualidade Longa ao sair dessa combinação.

   **Perfil:** GM e dono da ficha.

201. [ ] **Escudo flexível**

   **Fazer:** Testar escudo com qualidade Flexível.

   **Esperado:** Segue o custo especial de mãos previsto no código.

   **Perfil:** GM e dono da ficha.

202. [ ] **Confirmação de troca**

   **Fazer:** Com mãos ocupadas, clicar em outra arma que ultrapasse o limite.

   **Esperado:** Pergunta se deseja trocar a arma.

   **Perfil:** GM e dono da ficha.

203. [ ] **Confirmar troca**

   **Fazer:** Aceitar a substituição.

   **Esperado:** Guarda as atuais e saca a nova atomicamente, mantendo o combatente e a iniciativa.

   **Perfil:** GM e dono da ficha.

204. [ ] **Cancelar/fechar troca**

   **Fazer:** Recusar ou fechar a confirmação.

   **Esperado:** Mantém exatamente as armas anteriores.

   **Perfil:** GM e dono da ficha.

205. [ ] **Troca pelo botão direito**

   **Fazer:** Abrir menu rápido do controle e escolher arma.

   **Esperado:** Realiza a substituição sem exigir guardar manualmente primeiro.

   **Perfil:** GM e dono da ficha.

206. [ ] **Excluir arma sacada**

   **Fazer:** Tentar excluir a arma do inventário.

   **Esperado:** Bloqueia exclusão enquanto estiver em mãos, quando a regra está ativa.

   **Perfil:** GM e dono da ficha.

207. [ ] **Entrar em combate ao sacar**

   **Fazer:** Ativar sincronização e sacar com token na cena.

   **Esperado:** Inclui o token no encontro e cria encontro se necessário.

   **Perfil:** GM e dono da ficha. **Opções:** `enableWeaponReadinessCombatSync`.

208. [ ] **Sacar em encontro existente**

   **Fazer:** Repetir com combate já aberto.

   **Esperado:** Reutiliza o encontro pertinente sem duplicar combatente.

   **Perfil:** GM e dono da ficha.

209. [ ] **Guardar durante combate**

   **Fazer:** Guardar todas as armas com sincronização ativa.

   **Esperado:** Remove os tokens do personagem conforme o fluxo implementado.

   **Perfil:** GM e dono da ficha.

210. [ ] **Último participante sai**

   **Fazer:** Guardar armas do último participante do encontro.

   **Esperado:** GM ativo apaga/encerra o encontro vazio, inclusive se não iniciado.

   **Perfil:** GM e dono da ficha.

211. [ ] **Ainda há outro participante**

   **Fazer:** Guardar armas de um personagem com outro combatente presente.

   **Esperado:** O encontro permanece aberto.

   **Perfil:** GM e dono da ficha.

212. [ ] **Trocar no próprio turno**

   **Fazer:** Trocar arma com iniciativa e turno definidos.

   **Esperado:** Não sai/reentra no encontro nem perde a posição do turno.

   **Perfil:** GM e dono da ficha.

213. [ ] **Sincronização desligada**

   **Fazer:** Sacar/guardar com sincronização de encontro desligada.

   **Esperado:** Não altera participação em combate por essa opção.

   **Perfil:** GM e dono da ficha.

214. [ ] **Indicadores por arma**

   **Fazer:** Sacar duas armas e guardar apenas uma.

   **Esperado:** Contador, ficha e indicadores no token representam corretamente as armas restantes.

   **Perfil:** GM e dono da ficha. **Opções:** `showWeaponReadinessTokenIndicator`.

215. [ ] **Animação opcional**

   **Fazer:** Ligar/desligar animação e sacar/guardar.

   **Esperado:** Só executa o feedback visual quando ativado.

   **Perfil:** GM e dono da ficha. **Opções:** `enableWeaponReadinessAnimation`.

216. [ ] **Mensagens opcionais**

   **Fazer:** Alternar mensagens de prontidão e realizar trocas.

   **Esperado:** Publica somente quando ativado, sem duplicar por cliente.

   **Perfil:** GM e dono da ficha. **Opções:** `showWeaponReadinessChatMessages`.

217. [ ] **Posição por usuário**

   **Fazer:** Arrastar botão, recarregar e comparar outro cliente.

   **Esperado:** Cada cliente recupera a própria posição.

   **Perfil:** GM e dono da ficha.

218. [ ] **Prontidão desligada**

   **Fazer:** Desativar regra e realizar ataques normais.

   **Esperado:** O bloqueio específico deixa de atuar; dados de armas são preservados.

   **Perfil:** GM e dono da ficha.


<a id="bloco-13"></a>

### 219–243 — Manobras de combate

Fontes: [maneuvers.mjs](../scripts/maneuvers.mjs), [sockets.mjs](../scripts/sockets.mjs), [socket-policy.mjs](../scripts/socket-policy.mjs), [sheet-ui.mjs](../scripts/sheet-ui.mjs), [token-action-hud.mjs](../scripts/token-action-hud.mjs).

219. [ ] **Painel e descrições**

   **Fazer:** Abrir ficha de jogador, selecionar cada manobra e ler explicação.

   **Esperado:** Lista contém as doze manobras e detalhes correspondentes.

   **Perfil:** GM e dono da ficha. **Opções:** `enableManeuvers`.

220. [ ] **Alvo ausente/ambíguo**

   **Fazer:** Tentar manobra direcionada sem alvo e com alvos demais.

   **Esperado:** Pede seleção válida sem aplicar efeitos em vítima arbitrária.

   **Perfil:** GM e dono da ficha.

221. [ ] **Adiar a Iniciativa**

   **Fazer:** Usar em encontro com iniciativa definida e avançar rodadas.

   **Esperado:** Ajusta iniciativa e a restaura no prazo previsto.

   **Perfil:** GM e dono da ficha.

222. [ ] **Agarrar com sucesso**

   **Fazer:** Realizar disputa com alvo e obter sucesso.

   **Esperado:** Aplica Agarrado e Mantendo Agarrão nos participantes.

   **Perfil:** GM e dono da ficha.

223. [ ] **Agarrar com falha**

   **Fazer:** Falhar na tentativa inicial ou manutenção.

   **Esperado:** Aplica abertura de ataque livre/release conforme a rota, sem manter vínculo inválido.

   **Perfil:** GM e dono da ficha.

224. [ ] **Manter agarrão**

   **Fazer:** Avançar até o turno do agarrador e testar manutenção.

   **Esperado:** Revalida o agarrão; impede movimentos/ações incompatíveis enquanto mantido.

   **Perfil:** GM e dono da ficha.

225. [ ] **Desarmar com sucesso**

   **Fazer:** Alvejar criatura com item ativo e vencer o teste.

   **Esperado:** Desarma item elegível pelo GM e aplica o estado correspondente.

   **Perfil:** GM e dono da ficha.

226. [ ] **Desarmar com falha**

   **Fazer:** Falhar na disputa.

   **Esperado:** Concede abertura para ataque livre conforme a manobra.

   **Perfil:** GM e dono da ficha.

227. [ ] **Empurrão**

   **Fazer:** Executar com alvo e comparar sucesso/falha.

   **Esperado:** Move token quando possível, aplica efeito e informa alternativa manual quando não consegue mover.

   **Perfil:** GM e dono da ficha.

228. [ ] **Investida**

   **Fazer:** Executar ataque pela manobra.

   **Esperado:** Integra rolagem nativa e efeito de investida; falha pode conceder abertura de ataque livre.

   **Perfil:** GM e dono da ficha.

229. [ ] **Encontrão**

   **Fazer:** Executar e observar teste do alvo e do próprio personagem.

   **Esperado:** Aplica queda no alvo e/ou no atacante conforme os resultados específicos.

   **Perfil:** GM e dono da ficha.

230. [ ] **Mira Cuidadosa**

   **Fazer:** Ativar e depois atacar no momento pertinente.

   **Esperado:** Concede o benefício previsto e remove/expira o efeito corretamente.

   **Perfil:** GM e dono da ficha.

231. [ ] **Nocaute**

   **Fazer:** Preparar a manobra e resolver ataque/teste de dano.

   **Esperado:** A comparação de nocaute usa resultado menor que o dano informado, conforme o código.

   **Perfil:** GM e dono da ficha.

232. [ ] **Defesa Total**

   **Fazer:** Ativar e tentar atacar/mover durante a vigência.

   **Esperado:** Aplica restrições e benefício de Defesa Total, sem durar indefinidamente.

   **Perfil:** GM e dono da ficha.

233. [ ] **Ofensiva Total**

   **Fazer:** Ativar e resolver ataque/defesa durante a vigência.

   **Esperado:** Aplica benefício e restrição da postura e expira no prazo.

   **Perfil:** GM e dono da ficha.

234. [ ] **Veneno em Armas: sucesso**

   **Fazer:** Escolher dose de veneno e obter sucesso.

   **Esperado:** Consome uma dose e aplica arma envenenada.

   **Perfil:** GM e dono da ficha.

235. [ ] **Veneno em Armas: falha comum**

   **Fazer:** Obter falha que não seja 20.

   **Esperado:** Conferir resultado e ausência de consumo/efeito adicional conforme a rota atual.

   **Perfil:** GM e dono da ficha.

236. [ ] **Veneno em Armas: 20**

   **Fazer:** Obter falha crítica.

   **Esperado:** Consome dose e aplica envenenamento ao próprio personagem por três rodadas.

   **Perfil:** GM e dono da ficha.

237. [ ] **Veneno no próximo acerto**

   **Fazer:** Com arma envenenada, acertar alvo e avançar turnos.

   **Esperado:** Integra efeito de veneno no alvo e a expiração correspondente.

   **Perfil:** GM e dono da ficha.

238. [ ] **Sem dose de veneno**

   **Fazer:** Tentar a manobra sem estoque elegível.

   **Esperado:** Não concede efeito gratuito.

   **Perfil:** GM e dono da ficha.

239. [ ] **Tomar a Iniciativa**

   **Fazer:** Resolver sucesso/falha com combatente presente.

   **Esperado:** Aplica estado; sucesso acrescenta +5 de iniciativa temporariamente.

   **Perfil:** GM e dono da ficha.

240. [ ] **Expiração dos efeitos**

   **Fazer:** Avançar turno/rodada e encerrar encontro com manobras ativas.

   **Esperado:** Remove efeitos temporários e restaura ajustes pertinentes sem duplicação.

   **Perfil:** GM e dono da ficha.

241. [ ] **Reaplicar manobra**

   **Fazer:** Aplicar novamente um efeito antes de expirar.

   **Esperado:** Atualiza prazo/estado coerentemente, sem acumular cópias indevidas.

   **Perfil:** GM e dono da ficha.

242. [ ] **Manobras em PNJ**

   **Fazer:** Tentar rota da ficha/API com PNJ.

   **Esperado:** A execução de manobras desta implementação é restrita a player, sem substituir ações nativas de PNJ.

   **Perfil:** GM e dono da ficha.

243. [ ] **Limpar efeitos**

   **Fazer:** Usar Limpar efeitos na ficha com efeitos ativos.

   **Esperado:** Exclui efeitos do Actor, exceto indicadores de prontidão de armas; não se limita a remover manobras. Preparar cópia antes de testar.

   **Perfil:** GM e dono da ficha. **Opções:** `enableClearEffectsButton`.


<a id="bloco-14"></a>

### 244–260 — Limiar de Dor, Caído e Levantar

Fontes: [pain-threshold-choice.mjs](../scripts/pain-threshold-choice.mjs), [prone-advantage.mjs](../scripts/prone-advantage.mjs), [stand-up.mjs](../scripts/stand-up.mjs), [movement-ruler.mjs](../scripts/movement-ruler.mjs).

244. [ ] **Personagem atinge PNJ acima do limiar**

   **Fazer:** Aplicar os efeitos nativos de ataque que ultrapasse Limiar de Dor do PNJ.

   **Esperado:** PNJ cai pelo fluxo de aplicação; não pergunta ao atacante se prefere ataque livre.

   **Perfil:** GM e dono da ficha.

245. [ ] **PNJ atinge personagem acima do limiar**

   **Fazer:** Resolver ataque acima do limiar do jogador.

   **Esperado:** Dono ativo da vítima recebe escolha entre cair e conceder ataque livre.

   **Perfil:** GM e dono da ficha.

246. [ ] **Escolher Cair**

   **Fazer:** Aceitar queda na solicitação.

   **Esperado:** Aplica Caído na vítima e resolve a pergunta uma única vez.

   **Perfil:** GM e dono da ficha.

247. [ ] **Escolher ataque livre**

   **Fazer:** Escolher alternativa ao cair.

   **Esperado:** Registra abertura de ataque livre para o inimigo em vez de aplicar a queda dessa escolha.

   **Perfil:** GM e dono da ficha.

248. [ ] **Vítima sem dono ativo**

   **Fazer:** Repetir com dono desconectado.

   **Esperado:** A decisão fica com GM.

   **Perfil:** GM e dono da ficha.

249. [ ] **Usuário não destinatário**

   **Fazer:** Abrir o mesmo chat em outro jogador.

   **Esperado:** Não consegue decidir pela vítima.

   **Perfil:** GM e dono da ficha.

250. [ ] **Reutilizar pergunta resolvida**

   **Fazer:** Clicar novamente após uma escolha já aplicada.

   **Esperado:** Não aplica duas consequências.

   **Perfil:** GM e dono da ficha.

251. [ ] **Caído e movimento**

   **Fazer:** Tentar deslocamento tático com personagem caído.

   **Esperado:** O perfil de movimento fica bloqueado até levantar.

   **Perfil:** GM e dono da ficha.

252. [ ] **Vantagem corpo a corpo**

   **Fazer:** Alvejar exatamente um inimigo caído e abrir ataque corpo a corpo.

   **Esperado:** Marca Vantagem e mostra indicação do alvo caído.

   **Perfil:** GM e dono da ficha.

253. [ ] **Sem vantagem indevida**

   **Fazer:** Repetir com arma à distância, alvo em pé e múltiplos alvos.

   **Esperado:** Não herda automaticamente a vantagem do ataque anterior.

   **Perfil:** GM e dono da ficha.

254. [ ] **Botão flutuante Levantar**

   **Fazer:** Aplicar Caído e observar o token.

   **Esperado:** Botão aparece para usuário autorizado e acompanha a posição do token.

   **Perfil:** GM e dono da ficha.

255. [ ] **Levantar com sucesso**

   **Fazer:** No próprio turno, resolver teste de Rápido com sucesso.

   **Esperado:** Remove Caído e deixa no máximo uma ação de movimento restante.

   **Perfil:** GM e dono da ficha.

256. [ ] **Levantar com falha**

   **Fazer:** Obter falha no teste.

   **Esperado:** Ainda remove Caído, mas gasta o turno e deixa zero ações de movimento restantes.

   **Perfil:** GM e dono da ficha.

257. [ ] **Levantar fora do turno**

   **Fazer:** Tentar com combatente fora da própria vez.

   **Esperado:** Bloqueia a ação se o encontro está iniciado e o ator participa dele.

   **Perfil:** GM e dono da ficha.

258. [ ] **Levantar fora de combate**

   **Fazer:** Usar sem encontro iniciado.

   **Esperado:** Permite a ação autorizada sem exigir turno.

   **Perfil:** GM e dono da ficha.

259. [ ] **Morrendo não levanta**

   **Fazer:** Tentar usar o controle com estado incapacitante de morte.

   **Esperado:** Não permite ignorar a incapacidade.

   **Perfil:** GM e dono da ficha.

260. [ ] **Reset de custo ao levantar**

   **Fazer:** Avançar turno/rodada após custo de movimento.

   **Esperado:** O estado temporário não se aplica indevidamente aos turnos seguintes.

   **Perfil:** GM e dono da ficha.


<a id="bloco-15"></a>

### 261–279 — Morrendo, testes de morte e recuperação

Fontes: [death-automation.mjs](../scripts/death-automation.mjs), [init.mjs](../scripts/init.mjs), [weapon-wrapper.mjs](../scripts/weapon-wrapper.mjs), [movement-ruler.mjs](../scripts/movement-ruler.mjs).

261. [ ] **Ativar automação de morte**

   **Fazer:** Ligar opção e preparar personagem com Vitalidade positiva.

   **Esperado:** Registra controles e concilia estado sem iniciar morte indevida.

   **Perfil:** GM e dono da ficha. **Opções:** `enableDeathAutomation`.

262. [ ] **Vitalidade chega a zero**

   **Fazer:** Reduzir personagem a zero.

   **Esperado:** Entra em Morrendo e aplica apresentação/efeito correspondente.

   **Perfil:** GM e dono da ficha.

263. [ ] **Bloqueio de ações incapacitadas**

   **Fazer:** Tentar atacar, usar poderes/manobras e mover enquanto Morrendo/Morto.

   **Esperado:** Rotas integradas são bloqueadas, sem consumir recursos por ação negada.

   **Perfil:** GM e dono da ficha.

264. [ ] **Solicitação no turno**

   **Fazer:** Avançar para turno de personagem Morrendo.

   **Esperado:** Cria solicitação de teste de morte para o responsável.

   **Perfil:** GM e dono da ficha.

265. [ ] **Uma solicitação por turno**

   **Fazer:** Reabrir ficha, atualizar encontro e conectar outro GM no mesmo turno.

   **Esperado:** Não duplica a solicitação para a mesma chave de turno.

   **Perfil:** GM e dono da ficha.

266. [ ] **Responsável pelo teste**

   **Fazer:** Testar com GM ativo e com dono ativo sem GM.

   **Esperado:** Eleição do executor evita vários clientes resolvendo o mesmo personagem.

   **Perfil:** GM e dono da ficha.

267. [ ] **Sucesso comum no teste**

   **Fazer:** Rolar resultado aprovado que não recupere criticamente.

   **Esperado:** Sobrevive e conserva o contador de falhas anterior conforme a regra.

   **Perfil:** GM e dono da ficha.

268. [ ] **Falha comum**

   **Fazer:** Rolar falha que não seja 20.

   **Esperado:** Acrescenta uma falha.

   **Perfil:** GM e dono da ficha.

269. [ ] **Terceira falha**

   **Fazer:** Resolver com duas falhas anteriores e obter nova falha.

   **Esperado:** Marca morte final.

   **Perfil:** GM e dono da ficha.

270. [ ] **Resultado 20**

   **Fazer:** Resolver teste com resultado 20.

   **Esperado:** Marca morte crítica independentemente das falhas anteriores.

   **Perfil:** GM e dono da ficha.

271. [ ] **Resultado 1**

   **Fazer:** Resolver recuperação crítica.

   **Esperado:** Recupera pelo procedimento da automação e limpa as falhas pertinentes.

   **Perfil:** GM e dono da ficha.

272. [ ] **Modificadores e crítico ampliado**

   **Fazer:** Repetir com opções nativas de teste e crítico ativadas.

   **Esperado:** Objetivos e resultados respeitam as opções selecionadas.

   **Perfil:** GM e dono da ficha.

273. [ ] **Cura acima de zero**

   **Fazer:** Curar Morrendo para Vitalidade positiva.

   **Esperado:** Remove incapacidade e solicitações antigas sem criar morte nova.

   **Perfil:** GM e dono da ficha.

274. [ ] **Remover Morrendo manualmente**

   **Fazer:** Remover efeito como GM/dono autorizado.

   **Esperado:** Estabiliza pelo fluxo previsto.

   **Perfil:** GM e dono da ficha.

275. [ ] **Remover Morto manualmente**

   **Fazer:** Retirar o estado/apresentação de morte pelo fluxo suportado.

   **Esperado:** Recupera estado interno coerentemente; registrar Vitalidade resultante.

   **Perfil:** GM e dono da ficha.

276. [ ] **Transição Morrendo para Morto**

   **Fazer:** Provocar morte após estado Morrendo.

   **Esperado:** A remoção interna de Morrendo não provoca ressurreição acidental.

   **Perfil:** GM e dono da ficha.

277. [ ] **Recarregar com Morrendo**

   **Fazer:** Fechar/reabrir mundo com personagem já incapaz.

   **Esperado:** Reconcilia sem duplicar efeito ou pergunta antiga.

   **Perfil:** GM e dono da ficha.

278. [ ] **Desligar automação**

   **Fazer:** Desativar com personagem no estado.

   **Esperado:** Suspende bloqueios/controles específicos e preserva os documentos conforme a conciliação implementada.

   **Perfil:** GM e dono da ficha.

279. [ ] **PNJ e monstro a zero**

   **Fazer:** Repetir dano em criaturas não player.

   **Esperado:** Não injeta automaticamente a automação exclusiva dos jogadores.

   **Perfil:** GM e dono da ficha.


<a id="bloco-16"></a>

### 280–296 — Régua tática e estimativa de viagem

Fontes: [movement-ruler.mjs](../scripts/movement-ruler.mjs), [travel-context.mjs](../scripts/travel-context.mjs), [stand-up.mjs](../scripts/stand-up.mjs), [compatibility.mjs](../scripts/compatibility.mjs).

280. [ ] **Régua do token**

   **Fazer:** Arrastar token em cena com grade e escala normal.

   **Esperado:** Mede percurso com perfil do ator.

   **Perfil:** GM e dono da ficha. **Opções:** `enableMovementRuler`.

281. [ ] **Cores por distância**

   **Fazer:** Medir dentro de uma ação, duas ações e além do limite.

   **Esperado:** Aplica cores correspondentes quando ativado.

   **Perfil:** GM e dono da ficha. **Opções:** `enableMovementColors`.

282. [ ] **Etiquetas de limite**

   **Fazer:** Alternar etiquetas e medir trajetos com waypoints.

   **Esperado:** Exibe distância e limite conforme a configuração.

   **Perfil:** GM e dono da ficha. **Opções:** `enableMovementLimitLabels`.

283. [ ] **Bloqueio em combate**

   **Fazer:** Tentar deslocamento acima do limite no encontro iniciado.

   **Esperado:** Cancela movimento quando bloqueio está ativo.

   **Perfil:** GM e dono da ficha. **Opções:** `enableMovementBlocking`.

284. [ ] **Bloqueio desligado**

   **Fazer:** Repetir distância com bloqueio desativado.

   **Esperado:** A informação visual pode permanecer sem impedir o movimento.

   **Perfil:** GM e dono da ficha.

285. [ ] **Metros**

   **Fazer:** Definir distância-base em metros e cena compatível.

   **Esperado:** Usa padrão 10 m por ação ou valor configurado.

   **Perfil:** GM e dono da ficha. **Opções:** `movementUnitSystem`, `movementBaseMeters`.

286. [ ] **Pés**

   **Fazer:** Mudar sistema de unidades e valor-base.

   **Esperado:** Usa padrão 30 ft por ação ou valor configurado.

   **Perfil:** GM e dono da ficha. **Opções:** `movementBaseFeet`.

287. [ ] **Fome e sobrecarga independentes**

   **Fazer:** Ativar/desativar cada integração e medir o mesmo token.

   **Esperado:** Somente modificadores ativos alteram o perfil.

   **Perfil:** GM e dono da ficha. **Opções:** `enableMovementHungerModifier`, `enableMovementEncumbranceModifier`.

288. [ ] **Efeitos de movimento**

   **Fazer:** Aplicar Agarrado, ações gastas e flags de movimento reconhecidas.

   **Esperado:** Respeita bloqueios/multiplicadores quando a opção está ligada.

   **Perfil:** GM e dono da ficha. **Opções:** `enableMovementEffectModifiers`.

289. [ ] **Arrastar fora de combate**

   **Fazer:** Comparar deslocamento tático antes/depois de iniciar encontro.

   **Esperado:** Regras de bloqueio se aplicam conforme contexto; anotar exceções previstas.

   **Perfil:** GM e dono da ficha.

290. [ ] **Cena em quilômetros**

   **Fazer:** Definir unidades de km e medir marcador/token no mapa de mundo.

   **Esperado:** Mostra estimativa de dias em vez de apenas impor limite tático.

   **Perfil:** GM e dono da ficha.

291. [ ] **Configurar viagem no HUD**

   **Fazer:** Abrir controle de viagem do token.

   **Esperado:** Escolhe terreno, modo de marcha/cavalgada e trajeto ao longo de rio.

   **Perfil:** GM e dono da ficha.

292. [ ] **Viagem por token**

   **Fazer:** Configurar dois tokens do mesmo ator de formas diferentes.

   **Esperado:** Cada token preserva seu perfil próprio.

   **Perfil:** GM e dono da ficha.

293. [ ] **Ritmos e terrenos**

   **Fazer:** Comparar planícies, Davokar iluminada/escura e seis modos de deslocamento.

   **Esperado:** Usa matriz de velocidades da implementação; valores estão no anexo técnico.

   **Perfil:** GM e dono da ficha.

294. [ ] **Trajeto junto a rio**

   **Fazer:** Alternar a opção em terreno difícil.

   **Esperado:** Usa o terreno um passo mais fácil conforme a regra programada.

   **Perfil:** GM e dono da ficha.

295. [ ] **Marcador de mapa não é combate tático**

   **Fazer:** Usar token marcador em km com estados táticos.

   **Esperado:** A estimativa não bloqueia o mapa como se fosse uma ação de combate.

   **Perfil:** GM e dono da ficha.

296. [ ] **Outro módulo de régua**

   **Fazer:** Ativar Drag Ruler compatível e observar relatório/medição.

   **Esperado:** IND cede a parte definida pela política de compatibilidade, evitando duas réguas concorrentes.

   **Perfil:** GM e dono da ficha.


<a id="bloco-17"></a>

### 297–320 — Chat Original e apresentação Ind Resources

Fontes: [chat-controller.mjs](../scripts/chat-controller.mjs), [npc-attack-chat.mjs](../scripts/npc-attack-chat.mjs), [opposed-test-chat.mjs](../scripts/opposed-test-chat.mjs), [berserker-chat.mjs](../scripts/berserker-chat.mjs), [resistance-chat.mjs](../scripts/resistance-chat.mjs), [chat-original-preview.mjs](../scripts/chat-original-preview.mjs), [init.mjs](../scripts/init.mjs).

297. [ ] **Modo Original**

   **Fazer:** Selecionar Original e realizar ataques/testes.

   **Esperado:** Conserva os cards do sistema.

   **Perfil:** GM e dono da ficha. **Opções:** `enableCompactNpcAttackChat`.

298. [ ] **Modo Ind Resources**

   **Fazer:** Selecionar Ind Resources e repetir.

   **Esperado:** Adapta visualmente mensagens reconhecidas sem criar segunda rolagem ou alterar audiência.

   **Perfil:** GM e dono da ficha.

299. [ ] **Personagem contra PNJ**

   **Fazer:** Atacar e comparar retratos, arma, alvo, atributo e dado.

   **Esperado:** Resumo identifica corretamente os envolvidos e o resultado.

   **Perfil:** GM e dono da ficha.

300. [ ] **PNJ contra personagem**

   **Fazer:** Resolver ataque e resistência.

   **Esperado:** A vítima e o atacante não são invertidos no resumo.

   **Perfil:** GM e dono da ficha.

301. [ ] **Ataque entre personagens**

   **Fazer:** Resolver ataque player contra player quando o sistema permitir.

   **Esperado:** Não aplica indevidamente as regras exclusivas de PNJ.

   **Perfil:** GM e dono da ficha.

302. [ ] **Sucesso, falha e crítico**

   **Fazer:** Produzir resultados diferentes.

   **Esperado:** Texto, cores e resultado numérico correspondem ao card nativo.

   **Perfil:** GM e dono da ficha.

303. [ ] **Dano com múltiplos termos**

   **Fazer:** Atacar com bônus de Amoque/Robusto e outros dados.

   **Esperado:** Não perde termos de dano reconhecidos.

   **Perfil:** GM e dono da ficha.

304. [ ] **Proteção e dano recebido**

   **Fazer:** Atacar PNJ com armadura.

   **Esperado:** Resumo representa Proteção e dano efetivo quando obtidos do card.

   **Perfil:** GM e dono da ficha.

305. [ ] **Ocultar detalhes de PNJ**

   **Fazer:** Ligar opção e comparar GM com jogador.

   **Esperado:** Detalhes de PNJ ficam ocultos na apresentação do jogador; também conferir disponibilidade no conteúdo original da mensagem.

   **Perfil:** GM e dono da ficha. **Opções:** `hideNpcDetailsInChat`.

306. [ ] **Teste de atributo simples**

   **Fazer:** Rolar atributo com modificador positivo e negativo.

   **Esperado:** Mostra objetivo, sinal do modificador, dado e desfecho.

   **Perfil:** GM e dono da ficha.

307. [ ] **Teste oposto**

   **Fazer:** Rolar Atributo contra Atributo.

   **Esperado:** Atributos e alvo exibidos correspondem à rolagem nativa.

   **Perfil:** GM e dono da ficha.

308. [ ] **Resumo de defesa/armadura**

   **Fazer:** Abrir defesa com opções de armadura.

   **Esperado:** Mantém informações reconhecidas e não aplica proteção novamente.

   **Perfil:** GM e dono da ficha.

309. [ ] **Amoque**

   **Fazer:** Usar habilidade nativa e observar card.

   **Esperado:** Reorganiza apresentação reconhecida sem executar a habilidade duas vezes.

   **Perfil:** GM e dono da ficha.

310. [ ] **Imposição de Mãos**

   **Fazer:** Usar poder no fluxo nativo.

   **Esperado:** Mostra participantes/teste/resultado reconhecidos.

   **Perfil:** GM e dono da ficha.

311. [ ] **Aura Sagrada**

   **Fazer:** Usar poder no fluxo nativo.

   **Esperado:** Preserva as informações pertinentes no resumo.

   **Perfil:** GM e dono da ficha.

312. [ ] **Cascata de Enxofre**

   **Fazer:** Usar poder no fluxo nativo.

   **Esperado:** Preserva teste, alvos e efeitos informados pelo sistema na medida reconhecida.

   **Perfil:** GM e dono da ficha.

313. [ ] **Alquimia**

   **Fazer:** Usar a ação nativa reconhecida de Alquimia.

   **Esperado:** Apresentação adapta o card sem inventar resultado ausente.

   **Perfil:** GM e dono da ficha.

314. [ ] **Prévia do original**

   **Fazer:** Gerar mensagem com conteúdo não representado e usar indicador vermelho como GM.

   **Esperado:** Abre prévia do original e destaca partes omitidas.

   **Perfil:** GM e dono da ficha.

315. [ ] **Original indisponível a outros usuários**

   **Fazer:** Procurar prévia de GM em sessão de jogador.

   **Esperado:** Não expõe controle exclusivo de GM ao jogador.

   **Perfil:** GM e dono da ficha.

316. [ ] **Restaurar mensagens anteriores**

   **Fazer:** Alternar modo compacto para Original com mensagens já no chat.

   **Esperado:** Restaura os cards sem apagar histórico.

   **Perfil:** GM e dono da ficha.

317. [ ] **Resistência pendente**

   **Fazer:** PNJ solicita resistência ao jogador.

   **Esperado:** Mostra pedido simples com botão de rolar.

   **Perfil:** GM e dono da ficha.

318. [ ] **Resistência concluída**

   **Fazer:** Jogador rola a resistência uma vez.

   **Esperado:** Pedido concluído é removido/atualizado e aparece a resolução nativa.

   **Perfil:** GM e dono da ficha.

319. [ ] **Nomes e texto longos**

   **Fazer:** Usar atores/armas com nomes longos, acentos e parênteses.

   **Esperado:** O layout continua legível e não remove partes essenciais.

   **Perfil:** GM e dono da ficha.

320. [ ] **Mensagens sem padrão reconhecido**

   **Fazer:** Publicar card de outro módulo e tabela comum.

   **Esperado:** Não deve transformar texto arbitrário como se fosse um ataque reconhecido.

   **Perfil:** GM e dono da ficha.


<a id="bloco-18"></a>

### 321–329 — Privacidade das rolagens e dados 3D

Fontes: [roll-privacy.mjs](../scripts/roll-privacy.mjs), [dice.mjs](../scripts/dice.mjs), [expedition-private.mjs](../scripts/expedition-private.mjs), [socket-policy.mjs](../scripts/socket-policy.mjs), [sockets.mjs](../scripts/sockets.mjs).

321. [ ] **Controle Rolagem privada**

   **Fazer:** Abrir diálogo integrado com opção ativada.

   **Esperado:** Mostra checkbox para a rolagem atual.

   **Perfil:** GM e dono da ficha. **Opções:** `enableRollPrivacy`.

322. [ ] **Rolar para GM**

   **Fazer:** Marcar privado e confirmar.

   **Esperado:** Resultado e dados 3D são destinados aos GMs conforme a implementação.

   **Perfil:** GM e dono da ficha.

323. [ ] **Próxima rolagem pública**

   **Fazer:** Depois de privado, abrir outra rolagem sem marcar.

   **Esperado:** Não herda privacidade indevidamente; usa modo configurado no Foundry.

   **Perfil:** GM e dono da ficha.

324. [ ] **Modos nativos**

   **Fazer:** Repetir públicos, privados, cegos e para si mesmo.

   **Esperado:** Preserva destinatários e visibilidade do Foundry.

   **Perfil:** GM e dono da ficha.

325. [ ] **Dice So Nice presente**

   **Fazer:** Executar rolagens de cura, descanso, manobra, morte e recuperação.

   **Esperado:** Chat espera os dados 3D quando a integração está disponível.

   **Perfil:** GM e dono da ficha.

326. [ ] **Dice So Nice ausente**

   **Fazer:** Repetir sem o módulo.

   **Esperado:** As ações continuam resolvendo sem erro de referência.

   **Perfil:** GM e dono da ficha.

327. [ ] **Dados privados 3D**

   **Fazer:** Observar um teste privado em sessão não destinatária.

   **Esperado:** Não mostra os dados privados a quem não recebeu a rolagem.

   **Perfil:** GM e dono da ficha.

328. [ ] **Autoridade de GM**

   **Fazer:** Executar ação que altera outro Actor a partir do jogador.

   **Esperado:** GM revalida usuário, propriedade, documentos e operação permitida.

   **Perfil:** GM e dono da ficha.

329. [ ] **Sem repetir após falha de socket**

   **Fazer:** Em teste controlado, interromper resposta de ação privilegiada.

   **Esperado:** Não aplica localmente uma segunda mutação só por não ter recebido resposta.

   **Perfil:** GM e dono da ficha.


<a id="bloco-19"></a>

### 330–339 — Registro do Mestre

Fontes: [gm-log-events.mjs](../scripts/gm-log-events.mjs), [gm-log-message-adapter.mjs](../scripts/gm-log-message-adapter.mjs), [gm-log-service.mjs](../scripts/gm-log-service.mjs), [gm-log-ui.mjs](../scripts/gm-log-ui.mjs).

330. [ ] **Abrir painel**

   **Fazer:** Ativar Registro do Mestre e abrir a aba de chat como GM.

   **Esperado:** Alterna Chat Geral e Registro no mesmo espaço.

   **Perfil:** GM e dono da ficha. **Opções:** `enableGmLog`.

331. [ ] **Somente GM**

   **Fazer:** Abrir o chat como jogador e confiável sem status GM.

   **Esperado:** Não recebe painel/histórico exclusivo de GM.

   **Perfil:** GM e dono da ficha.

332. [ ] **Ataques e rolagens**

   **Fazer:** Fazer combate e testes com dados reconhecidos.

   **Esperado:** Registra resumos com resultado, referências e valores pertinentes.

   **Perfil:** GM e dono da ficha.

333. [ ] **Itens e recursos**

   **Fazer:** Consumir alimentos/munição, recarregar, descansar e trocar armas.

   **Esperado:** Eventos suportados aparecem sem gerar ChatMessages duplicadas.

   **Perfil:** GM e dono da ficha.

334. [ ] **Alterar habilidade/quantidade**

   **Fazer:** Mudar habilidade ativa ou quantidade por rota suportada.

   **Esperado:** Resumo registra a alteração estruturada quando previsto.

   **Perfil:** GM e dono da ficha.

335. [ ] **Filtrar categorias**

   **Fazer:** Alternar categorias do registro.

   **Esperado:** Exibe somente eventos do filtro sem apagar o histórico.

   **Perfil:** GM e dono da ficha.

336. [ ] **Deduplicar combate**

   **Fazer:** Gerar variantes pública e privada do mesmo ataque.

   **Esperado:** Mostra um resumo lógico quando o identificador permite deduplicação.

   **Perfil:** GM e dono da ficha.

337. [ ] **Atualizar/excluir mensagem**

   **Fazer:** Editar ou remover mensagem de origem.

   **Esperado:** Registro acompanha as mudanças correspondentes.

   **Perfil:** GM e dono da ficha.

338. [ ] **Desligar/religar sem F5**

   **Fazer:** Desativar e reativar o Registro.

   **Esperado:** Painel some e é reconstruído das mensagens atuais.

   **Perfil:** GM e dono da ficha.

339. [ ] **Limpar registro**

   **Fazer:** Usar botão Limpar do painel; comparar com game.tenebreResources.gmLog.clear() se necessário.

   **Esperado:** Limpa o armazenamento do registro, sem excluir o chat original; registrar o comportamento após reconstrução/recarregamento.

   **Perfil:** GM e dono da ficha.


<a id="bloco-20"></a>

### 340–349 — Condições e seletor Efeitos do Token

Fontes: [status-effect-picker.mjs](../scripts/status-effect-picker.mjs), [compatibility.mjs](../scripts/compatibility.mjs), [sheet-ui.mjs](../scripts/sheet-ui.mjs).

340. [ ] **Instalar macro**

   **Fazer:** Usar Instalar macro Efeitos do Token em Utilidades.

   **Esperado:** Cria/reutiliza macro própria e associa à hotbar quando possível.

   **Perfil:** GM e dono da ficha.

341. [ ] **Instalar novamente**

   **Fazer:** Repetir instalação.

   **Esperado:** Não cria cópias desnecessárias da macro.

   **Perfil:** GM e dono da ficha.

342. [ ] **Abrir com um token**

   **Fazer:** Selecionar um token autorizado e executar.

   **Esperado:** Abre lista atual de CONFIG.statusEffects.

   **Perfil:** GM e dono da ficha.

343. [ ] **Zero ou vários tokens**

   **Fazer:** Executar sem seleção e com múltiplos tokens.

   **Esperado:** Solicita exatamente um token.

   **Perfil:** GM e dono da ficha.

344. [ ] **Pesquisar condições**

   **Fazer:** Buscar nome e descrição, rolar e redimensionar janela.

   **Esperado:** Filtro e navegação funcionam sem lista fixa desatualizada.

   **Perfil:** GM e dono da ficha.

345. [ ] **Aplicar condição**

   **Fazer:** Clicar em condição inativa.

   **Esperado:** Aplica uma vez ao ator/token correspondente.

   **Perfil:** GM e dono da ficha.

346. [ ] **Remover condição**

   **Fazer:** Clicar novamente no efeito ativo.

   **Esperado:** Remove a condição pertinente.

   **Perfil:** GM e dono da ficha.

347. [ ] **Mensagem descritiva opcional**

   **Fazer:** Aplicar com opção de mensagens ligada e desligada.

   **Esperado:** Publicação acompanha o toggle.

   **Perfil:** GM e dono da ficha. **Opções:** `showAppliedStatusEffectChatMessages`.

348. [ ] **Sem propriedade**

   **Fazer:** Tentar usar macro sobre token não autorizado.

   **Esperado:** Bloqueia alteração.

   **Perfil:** GM e dono da ficha.

349. [ ] **Condição de outro módulo**

   **Fazer:** Ativar módulo que registre um status novo e reabrir.

   **Esperado:** A lista incorpora a condição registrada dinamicamente.

   **Perfil:** GM e dono da ficha.


<a id="bloco-21"></a>

### 350–360 — Ritualista e catálogo de rituais

Fontes: [ritual-browser.mjs](../scripts/ritual-browser.mjs), [sheet-ui.mjs](../scripts/sheet-ui.mjs).

350. [ ] **Ver Rituais**

   **Fazer:** Clicar direito em Ritualista e usar Ver Rituais.

   **Esperado:** Abre catálogo quando ativado.

   **Perfil:** GM e dono da ficha. **Opções:** `enableRitualCatalog`.

351. [ ] **Tradições do catálogo**

   **Fazer:** Percorrer as tradições e rituais.

   **Esperado:** Agrupa conforme data/rituals.json e idioma.

   **Perfil:** GM e dono da ficha.

352. [ ] **Ritual conhecido**

   **Fazer:** Adicionar ritual à ficha e reabrir catálogo.

   **Esperado:** Marca ritual já conhecido sem criar outra cópia.

   **Perfil:** GM e dono da ficha.

353. [ ] **Ritual restrito**

   **Fazer:** Abrir entrada de profissão/especialização.

   **Esperado:** Identifica restrição; não apresenta como escolha livre automática.

   **Perfil:** GM e dono da ficha.

354. [ ] **Descrição oficial**

   **Fazer:** Clicar em ritual com documento oficial instalado.

   **Esperado:** Abre a ficha oficial correspondente.

   **Perfil:** GM e dono da ficha.

355. [ ] **Sem compêndio oficial**

   **Fazer:** Abrir entrada sem documento resolvível.

   **Esperado:** Trata ausência de conteúdo sem inventar ficha oficial completa.

   **Perfil:** GM e dono da ficha.

356. [ ] **Agrupar em Ritualista**

   **Fazer:** Ativar agrupamento e clicar na habilidade.

   **Esperado:** Expande/recolhe sublista dos rituais conhecidos.

   **Perfil:** GM e dono da ficha. **Opções:** `enableRitualistGrouping`.

357. [ ] **Usar/ver/excluir ritual na sublista**

   **Fazer:** Acionar cada controle em um ritual conhecido.

   **Esperado:** Continua usando os documentos e fluxos normais da ficha.

   **Perfil:** GM e dono da ficha.

358. [ ] **Adicionar/excluir com ficha aberta**

   **Fazer:** Importar ou remover ritual enquanto lista está aberta.

   **Esperado:** A lista se atualiza sem duplicar linhas ou handlers.

   **Perfil:** GM e dono da ficha.

359. [ ] **Agrupamento desligado**

   **Fazer:** Desativar com sublista aberta.

   **Esperado:** Rituais voltam à apresentação normal, sem serem apagados.

   **Perfil:** GM e dono da ficha.

360. [ ] **Sem Ritualista**

   **Fazer:** Abrir personagem com rituais mas sem a habilidade.

   **Esperado:** Não esconde rituais indevidamente em grupo inexistente.

   **Perfil:** GM e dono da ficha.


<a id="bloco-22"></a>

### 361–378 — Macros e utilidades Bithir incorporadas

Fontes: [bithir-macros.mjs](../scripts/bithir-macros.mjs), [verses.mjs](../scripts/verses.mjs), [dice.mjs](../scripts/dice.mjs), [compatibility.mjs](../scripts/compatibility.mjs).

361. [ ] **Importar cinco macros reais**

   **Fazer:** Importar Adventure e localizar macros.

   **Esperado:** O pacote contém Gerar Miniaturas, Assim Falou Aroaleta, Gerador de Monstros/PNJ, Rolagem de Inspiração e Eventos de Floresta.

   **Perfil:** GM e dono da ficha.

362. [ ] **Assim Falou Aroaleta**

   **Fazer:** Executar macro e selecionar/rolar verso conforme interface.

   **Esperado:** Publica verso e origem de categoria usando os dados incorporados.

   **Perfil:** GM e dono da ficha.

363. [ ] **Versos pela API direta**

   **Fazer:** Usar game.tenebreResources.verses.speak() em cópia de teste.

   **Esperado:** Publica verso pelo serviço direto; conferir diferenças de apresentação e toggle em relação à macro Bithir.

   **Perfil:** GM e dono da ficha.

364. [ ] **Gerador de Monstros/PNJ**

   **Fazer:** Executar macro e escolher tipo e resistência.

   **Esperado:** Cria ator com atributos, itens e apresentação conforme gerador.

   **Perfil:** GM e dono da ficha.

365. [ ] **Três bases de geração**

   **Fazer:** Testar modelos ambriano, bárbaro e abominação disponíveis.

   **Esperado:** Usa respectivos arquivos de geração sem referências quebradas.

   **Perfil:** GM e dono da ficha.

366. [ ] **Seis resistências de geração**

   **Fazer:** Comparar Fraco, Comum, Desafiador, Forte, Poderoso e Lendário.

   **Esperado:** Ajusta orçamento/nível conforme configuração do gerador.

   **Perfil:** GM e dono da ficha.

367. [ ] **Retratos gerados**

   **Fazer:** Gerar tipos/sexos com imagens disponíveis.

   **Esperado:** Usa recursos existentes; não aponta para caminho local do desenvolvedor.

   **Perfil:** GM e dono da ficha.

368. [ ] **Rolagem de Inspiração**

   **Fazer:** Rolar quantidades diferentes de dados de Lugar, Evento, Criatura e Recompensa.

   **Esperado:** Monta símbolos/resultados a partir dos quatro dados especiais.

   **Perfil:** GM e dono da ficha.

369. [ ] **Dados especiais com 3D**

   **Fazer:** Rolar inspiração com Dice So Nice.

   **Esperado:** Usa faces/estilos registrados quando suportados.

   **Perfil:** GM e dono da ficha.

370. [ ] **Eventos de Floresta**

   **Fazer:** Executar macro após importar tabelas necessárias.

   **Esperado:** Sorteia categoria e evento da tabela adequada e publica resultado.

   **Perfil:** GM e dono da ficha.

371. [ ] **Evento privado**

   **Fazer:** Executar evento de floresta com modo privado configurado.

   **Esperado:** Resultado respeita a audiência escolhida.

   **Perfil:** GM e dono da ficha.

372. [ ] **Gerar Sombra na ficha**

   **Fazer:** Usar sombras civilizada, natural e corrupta.

   **Esperado:** Gera texto a partir das tabelas e atributos reconhecidos.

   **Perfil:** GM e dono da ficha. **Opções:** `enableGenerateShadow`.

373. [ ] **Ocultar geração e texto**

   **Fazer:** Alternar os dois controles de ocultação e reabrir ficha.

   **Esperado:** Botão e rótulo respondem às opções sem desligar outras utilidades.

   **Perfil:** GM e dono da ficha. **Opções:** `hideShadowGeneration`, `hideShadowLabel`.

374. [ ] **Tabelas de Sombra ausentes**

   **Fazer:** Tentar gerar sem as tabelas importadas.

   **Esperado:** Registrar aviso/console e comportamento; não considerar o texto incompleto um sucesso.

   **Perfil:** GM e dono da ficha.

375. [ ] **Utilidades desligadas**

   **Fazer:** Desligar macros/tabelas internas e tentar as macros incorporadas.

   **Esperado:** Rotas Bithir protegidas deixam de executar; macros independentes devem ser avaliadas separadamente.

   **Perfil:** GM e dono da ficha. **Opções:** `enableBithirUtilities`.

376. [ ] **Bithir oficial ativo**

   **Fazer:** Ativar Bithir's Symbaroum Mods em ambiente de teste.

   **Esperado:** IND cede o namespace/rotas equivalentes conforme relatório, sem registrar duas implementações.

   **Perfil:** GM e dono da ficha.

377. [ ] **Gerar Miniaturas**

   **Fazer:** Como GM, em cópia do mundo, executar macro importada.

   **Esperado:** Recria e salva thumbs de todas as cenas, informando progresso; esta macro faz gravações e não é só uma prévia.

   **Perfil:** GM e dono da ficha.

378. [ ] **Macros citadas apenas no README**

   **Fazer:** Procurar experiência, rerrolagem e corrupção temporária nos compêndios atuais.

   **Esperado:** Não estão nas cinco macros desta Adventure; não tratá-las como controles fornecidos atualmente pelo IND.

   **Perfil:** GM e dono da ficha.


<a id="bloco-23"></a>

### 379–410 — Calendário: navegação, data e apresentação

Fontes: [calendar.mjs](../scripts/calendar.mjs), [calendar-date.mjs](../scripts/calendar-date.mjs), [calendar-view.mjs](../scripts/calendar-view.mjs), [calendar-experience-view.mjs](../scripts/calendar-experience-view.mjs), [calendar-configuration.mjs](../scripts/calendar-configuration.mjs), [calendar-options.mjs](../scripts/calendar-options.mjs), [calendar-chat.mjs](../scripts/calendar-chat.mjs).

379. [ ] **Abrir pelo controle de cena**

   **Fazer:** Usar calendário nos controles de notas quando disponível.

   **Esperado:** Abre janela do calendário Symbaroum.

   **Perfil:** GM e dono da ficha. **Opções:** `enableCalendar`.

380. [ ] **Atalho configurável**

   **Fazer:** Atribuir atalho Toggle Calendar nas preferências de teclado e usar.

   **Esperado:** Abre/fecha a janela sem duplicatas.

   **Perfil:** GM e dono da ficha.

381. [ ] **Painel nas abas corretas**

   **Fazer:** Alternar Atores, Itens e outras abas laterais.

   **Esperado:** Painel de data fica no contexto previsto de Atores/Itens.

   **Perfil:** GM e dono da ficha.

382. [ ] **Data inicial**

   **Fazer:** Definir primeira data com tempo mundial já existente.

   **Esperado:** Ancora a data sem reiniciar indiscriminadamente worldTime.

   **Perfil:** GM e dono da ficha.

383. [ ] **Calendário fixo**

   **Fazer:** Percorrer meses e dias.

   **Esperado:** Usa doze meses de trinta dias, sete dias de semana e ano de 360 dias.

   **Perfil:** GM e dono da ficha.

384. [ ] **Virada de mês/ano**

   **Fazer:** Avançar/recuar ao redor de dia 30 e último mês.

   **Esperado:** A data transita corretamente preservando horário pertinente.

   **Perfil:** GM e dono da ficha.

385. [ ] **Limites de ano**

   **Fazer:** Tentar datas em 0 e 9999 e valores fora dessa faixa.

   **Esperado:** Aceita limites suportados e rejeita datas inválidas.

   **Perfil:** GM e dono da ficha.

386. [ ] **Modo mensal**

   **Fazer:** Selecionar visão mensal.

   **Esperado:** Mostra grade e navegação do mês.

   **Perfil:** GM e dono da ficha.

387. [ ] **Modo anual**

   **Fazer:** Selecionar visão anual e escolher mês/dia.

   **Esperado:** Consulta o ano sem alterar o tempo apenas por navegar.

   **Perfil:** GM e dono da ficha.

388. [ ] **Modo compacto**

   **Fazer:** Alternar para compacto e usar duplo clique no título.

   **Esperado:** Alterna apresentação preservando data e estado do serviço.

   **Perfil:** GM e dono da ficha.

389. [ ] **Selecionar dia sem aplicar**

   **Fazer:** Clicar em outro dia da grade.

   **Esperado:** Consulta seleção e mostra aplicar quando diferente; não altera worldTime só pela seleção.

   **Perfil:** GM e dono da ficha.

390. [ ] **Aplicar data selecionada**

   **Fazer:** Confirmar Definir como data atual.

   **Esperado:** Altera a data pela autoridade apropriada.

   **Perfil:** GM e dono da ficha.

391. [ ] **Hoje**

   **Fazer:** Navegar para outro período e usar Hoje.

   **Esperado:** Volta à consulta da data atual.

   **Perfil:** GM e dono da ficha.

392. [ ] **Editar data/hora**

   **Fazer:** Usar edição direta e informar data/hora válida.

   **Esperado:** Aplica sem aviso incorreto de data inválida.

   **Perfil:** GM e dono da ficha.

393. [ ] **Unidades de avanço**

   **Fazer:** Testar segundo, rodada, minuto, hora, dia, mês e ano para frente/para trás.

   **Esperado:** Usa duração de unidade adequada; rodada usa CONFIG.time.roundTime.

   **Perfil:** GM e dono da ficha.

394. [ ] **Rodada com duração zero**

   **Fazer:** Com roundTime nativo zero, avançar hora/dia e depois rodada.

   **Esperado:** Hora/dia funcionam; rodada zero não avança e não invalida outras unidades.

   **Perfil:** GM e dono da ficha.

395. [ ] **Passos de uma e cinco unidades**

   **Fazer:** Usar setas simples e duplas.

   **Esperado:** Aplica exatamente os incrementos indicados.

   **Perfil:** GM e dono da ficha.

396. [ ] **Incrementos rápidos**

   **Fazer:** Usar cada incremento rápido oferecido pela janela.

   **Esperado:** A diferença de data/hora corresponde ao botão.

   **Perfil:** GM e dono da ficha.

397. [ ] **Atalhos solares**

   **Fazer:** Usar nascer do sol, meio-dia, pôr do sol e meia-noite.

   **Esperado:** Avança à próxima ocorrência, inclusive no dia seguinte quando necessário.

   **Perfil:** GM e dono da ficha.

398. [ ] **Detalhes de data**

   **Fazer:** Abrir informações e trocar seleção.

   **Esperado:** Mostra lua, estação e horários pertinentes; estado local do painel se mantém.

   **Perfil:** GM e dono da ficha.

399. [ ] **Fases da lua**

   **Fazer:** Percorrer um ciclo de 28 dias e consultar próximas fases.

   **Esperado:** Ícone e descrição seguem o ciclo do preset.

   **Perfil:** GM e dono da ficha.

400. [ ] **Estações e luz solar**

   **Fazer:** Configurar horários nas quatro estações e navegar nas transições.

   **Esperado:** Horários são interpolados gradualmente conforme o preset.

   **Perfil:** GM e dono da ficha.

401. [ ] **Temas**

   **Fazer:** Testar escuro, claro e clássico.

   **Esperado:** Muda aparência local sem alterar regra ou tempo mundial.

   **Perfil:** GM e dono da ficha.

402. [ ] **Layout dos controles**

   **Fazer:** Testar completo, rápido e oculto.

   **Esperado:** Exibe somente os grupos correspondentes.

   **Perfil:** GM e dono da ficha.

403. [ ] **Escala**

   **Fazer:** Testar 70%, 100% e 200%.

   **Esperado:** Janela continua operável na faixa permitida.

   **Perfil:** GM e dono da ficha.

404. [ ] **Relógio visível**

   **Fazer:** Alternar mostrar relógio.

   **Esperado:** Oculta/exibe a leitura sem parar o tempo por esse motivo.

   **Perfil:** GM e dono da ficha.

405. [ ] **Formato 12/24 horas**

   **Fazer:** Alternar formato.

   **Esperado:** Exibe AM/PM quando selecionado e conserva o instante real.

   **Perfil:** GM e dono da ficha.

406. [ ] **Segundos**

   **Fazer:** Alternar segundos visíveis.

   **Esperado:** Altera formato, não a precisão do tempo.

   **Perfil:** GM e dono da ficha.

407. [ ] **Semana**

   **Fazer:** Mudar primeiro dia e visibilidade de nomes dos dias.

   **Esperado:** Reorganiza a grade sem modificar a data salva.

   **Perfil:** GM e dono da ficha.

408. [ ] **Posição e abertura automática**

   **Fazer:** Mover janela, salvar preferências e recarregar.

   **Esperado:** Recorda posição quando habilitado e abre ao carregar quando selecionado.

   **Perfil:** GM e dono da ficha.

409. [ ] **Preferências por cliente**

   **Fazer:** Alterar tema/modo num cliente e consultar outro.

   **Esperado:** Preferências de apresentação são individuais.

   **Perfil:** GM e dono da ficha.

410. [ ] **Carimbo da data no chat**

   **Fazer:** Ativar preferência e criar mensagens em datas diferentes.

   **Esperado:** Exibe o carimbo correspondente à data da mensagem, conforme metadados disponíveis.

   **Perfil:** GM e dono da ficha.


<a id="bloco-24"></a>

### 411–436 — Calendário: relógio, integração, permissões e backup

Fontes: [calendar.mjs](../scripts/calendar.mjs), [calendar-options.mjs](../scripts/calendar-options.mjs), [calendar-runner.mjs](../scripts/calendar-runner.mjs), [calendar-configuration.mjs](../scripts/calendar-configuration.mjs), [sockets.mjs](../scripts/sockets.mjs).

411. [ ] **Iniciar relógio**

   **Fazer:** Iniciar com velocidade 1.

   **Esperado:** Avança por tempo real usando um único GM executor.

   **Perfil:** GM e dono da ficha.

412. [ ] **Parar relógio**

   **Fazer:** Parar e aguardar.

   **Esperado:** O relógio automático deixa de avançar.

   **Perfil:** GM e dono da ficha.

413. [ ] **Pausa manual**

   **Fazer:** Pausar e retomar.

   **Esperado:** Preserva estado de execução e retoma sem salto indevido.

   **Perfil:** GM e dono da ficha.

414. [ ] **Velocidade do relógio**

   **Fazer:** Mudar velocidade para valores válidos diferentes.

   **Esperado:** Relação entre segundos reais e de jogo acompanha a configuração.

   **Perfil:** GM e dono da ficha. **Opções:** `calendarClockSpeed`.

415. [ ] **Pausa do Foundry**

   **Fazer:** Pausar o jogo e retomar.

   **Esperado:** Relógio respeita a condição de execução e não recupera tempo indevido.

   **Perfil:** GM e dono da ficha.

416. [ ] **Pausa por combate nunca**

   **Fazer:** Configurar Nunca e iniciar encontro.

   **Esperado:** Não pausa por esse motivo.

   **Perfil:** GM e dono da ficha.

417. [ ] **Pausa por combate da cena ativa**

   **Fazer:** Configurar essa regra e iniciar encontro na cena atual e noutra.

   **Esperado:** Pausa somente no contexto abrangido pela regra.

   **Perfil:** GM e dono da ficha.

418. [ ] **Pausa por qualquer combate**

   **Fazer:** Configurar Qualquer e iniciar encontro em outra cena.

   **Esperado:** Combate iniciado abrangido pausa o relógio.

   **Perfil:** GM e dono da ficha.

419. [ ] **Dois GMs**

   **Fazer:** Deixar relógio rodando com dois GMs conectados.

   **Esperado:** Não dobra a velocidade.

   **Perfil:** GM e dono da ficha.

420. [ ] **Troca de GM ativo**

   **Fazer:** Desconectar GM executor mantendo outro GM.

   **Esperado:** O novo executor assume sem cronômetros duplicados.

   **Perfil:** GM e dono da ficha.

421. [ ] **Retorno após desconexão**

   **Fazer:** Fechar todos os GMs e reconectar depois.

   **Esperado:** Não aplica recuperação automática do tempo offline.

   **Perfil:** GM e dono da ficha.

422. [ ] **Modo Misto**

   **Fazer:** Alterar no calendário e também por API nativa game.time.

   **Esperado:** Acompanha worldTime e escreve pelo fluxo misto.

   **Perfil:** GM e dono da ficha.

423. [ ] **Modo Autoridade**

   **Fazer:** Selecionar Autoridade e avançar calendário/combate.

   **Esperado:** Verificar sincronização do relógio independente com worldTime e avanços de combate conforme esse modo.

   **Perfil:** GM e dono da ficha.

424. [ ] **Modo Independente**

   **Fazer:** Selecionar e alterar calendário.

   **Esperado:** Mantém relógio próprio sem avançar worldTime por essa edição.

   **Perfil:** GM e dono da ficha.

425. [ ] **Modo Externo**

   **Fazer:** Selecionar integração externa e tentar editar.

   **Esperado:** Fica em leitura para controle externo; não assume autoridade de tempo.

   **Perfil:** GM e dono da ficha.

426. [ ] **Jogador consulta**

   **Fazer:** Entrar como jogador sem delegação.

   **Esperado:** Consulta se playerView permitir e não recebe controle de alteração.

   **Perfil:** GM e dono da ficha.

427. [ ] **Ocultar dos jogadores**

   **Fazer:** Desligar visualização e recarregar controles.

   **Esperado:** Jogador não abre o calendário pela interface protegida.

   **Perfil:** GM e dono da ficha.

428. [ ] **Delegar por papel**

   **Fazer:** Autorizar papel específico e testar com os outros.

   **Esperado:** Só usuários ativos abrangidos ganham controles de data/hora.

   **Perfil:** GM e dono da ficha.

429. [ ] **Delegar por usuário**

   **Fazer:** Autorizar uma pessoa sem ampliar todo o papel.

   **Esperado:** Somente o usuário autorizado recebe a permissão extra.

   **Perfil:** GM e dono da ficha.

430. [ ] **Configuração mundial exclusiva de GM**

   **Fazer:** Entrar como jogador delegado e abrir engrenagem.

   **Esperado:** Delegação de tempo não concede edição de integração, permissões ou backup mundial.

   **Perfil:** GM e dono da ficha.

431. [ ] **Exportar backup**

   **Fazer:** Como GM, exportar JSON.

   **Esperado:** Inclui formato próprio, data, tempo, opções e velocidade.

   **Perfil:** GM e dono da ficha.

432. [ ] **Importar backup válido**

   **Fazer:** Como GM, importar e confirmar backup próprio.

   **Esperado:** Restaura os campos previstos, sem importar calendários/notas do Simple Calendar.

   **Perfil:** GM e dono da ficha.

433. [ ] **Cancelar importação**

   **Fazer:** Recusar a confirmação de restauração.

   **Esperado:** Não modifica tempo/configuração.

   **Perfil:** GM e dono da ficha.

434. [ ] **Backup inválido**

   **Fazer:** Tentar JSON quebrado, formato de outro módulo ou data fora do limite.

   **Esperado:** Rejeita com aviso e mantém o estado anterior.

   **Perfil:** GM e dono da ficha.

435. [ ] **Desligar calendário**

   **Fazer:** Desativar a opção com janela/relógio abertos.

   **Esperado:** Remove interface pertinente e interrompe execução protegida sem apagar a data salva.

   **Perfil:** GM e dono da ficha.

436. [ ] **API de calendário**

   **Fazer:** Consultar getDate(), getTime(), getClockStatus() e executar change() autorizado.

   **Esperado:** As mesmas permissões da interface se aplicam às alterações.

   **Perfil:** GM e dono da ficha.


<a id="bloco-25"></a>

### 437–452 — Ficha de Grupo: membros e informações

Fontes: [party-actor.mjs](../scripts/party-actor.mjs), [party-search.mjs](../scripts/party-search.mjs), [actor-references.mjs](../scripts/actor-references.mjs), [actor-preparation.mjs](../scripts/actor-preparation.mjs).

437. [ ] **Criar Actor Grupo**

   **Fazer:** Criar Actor do tipo Grupo fornecido pelo IND.

   **Esperado:** Abre ficha específica sem quebrar criação dos tipos nativos.

   **Perfil:** GM e dono da ficha.

438. [ ] **Identidade do grupo**

   **Fazer:** Editar nome, imagem e campos disponíveis.

   **Esperado:** Persiste somente os dados do grupo.

   **Perfil:** GM e dono da ficha.

439. [ ] **Experiência de grupo**

   **Fazer:** Editar total, custos e gastos nos campos existentes.

   **Esperado:** Saldo disponível segue total menos parcelas previstas.

   **Perfil:** GM e dono da ficha.

440. [ ] **Adicionar membro**

   **Fazer:** Arrastar personagem para a área de integrantes.

   **Esperado:** Cria vínculo ao ator existente, sem duplicá-lo.

   **Perfil:** GM e dono da ficha.

441. [ ] **Adicionar companheiro**

   **Fazer:** Arrastar criatura/PNJ à área apropriada.

   **Esperado:** Aparece como companheiro conforme a classificação.

   **Perfil:** GM e dono da ficha.

442. [ ] **Alternar membro/companheiro**

   **Fazer:** Usar menu de contexto correspondente.

   **Esperado:** Move a referência entre as listas sem excluir o ator.

   **Perfil:** GM e dono da ficha.

443. [ ] **Remover integrante**

   **Fazer:** Remover da ficha de Grupo.

   **Esperado:** Apaga apenas o vínculo, preservando a ficha do integrante.

   **Perfil:** GM e dono da ficha.

444. [ ] **Duplicidade de membro**

   **Fazer:** Arrastar mesmo ator duas vezes.

   **Esperado:** Não duplica a participação indevidamente.

   **Perfil:** GM e dono da ficha.

445. [ ] **Abrir ficha vinculada**

   **Fazer:** Clicar em retrato/nome.

   **Esperado:** Abre a ficha real quando permitido.

   **Perfil:** GM e dono da ficha.

446. [ ] **Cartões resumidos**

   **Fazer:** Alterar Vitalidade, corrupção e atributos de integrante com grupo aberto.

   **Esperado:** Resumo acompanha os valores relevantes.

   **Perfil:** GM e dono da ficha.

447. [ ] **Rolar atributo pelo cartão**

   **Fazer:** Usar atributo exibido no integrante.

   **Esperado:** Rola para o ator correto, respeitando propriedade.

   **Perfil:** GM e dono da ficha.

448. [ ] **Pesquisar integrantes**

   **Fazer:** Buscar nome do integrante, atributo e nome de item/habilidade/ritual indexado.

   **Esperado:** Filtra membros observáveis; busca exata por atributo pode ordenar pelo valor. Raça e descrição de qualidades não são campos independentes indexados.

   **Perfil:** GM e dono da ficha.

449. [ ] **Limpar busca**

   **Fazer:** Usar botão de limpar.

   **Esperado:** Restaura cartões e contagem.

   **Perfil:** GM e dono da ficha.

450. [ ] **Dados privados de membro**

   **Fazer:** Abrir Grupo com integrante cuja ficha não é observável.

   **Esperado:** Não revela dados que o usuário não pode consultar.

   **Perfil:** GM e dono da ficha.

451. [ ] **Referências de token**

   **Fazer:** Usar atores não vinculados/token sintético nos fluxos aceitos.

   **Esperado:** Resolução por UUID evita confundir atores com o mesmo nome.

   **Perfil:** GM e dono da ficha.

452. [ ] **Região atual**

   **Fazer:** Trocar região/localização disponíveis na ficha.

   **Esperado:** Atualiza contexto de expedição e modificadores pertinentes.

   **Perfil:** GM e dono da ficha.


<a id="bloco-26"></a>

### 453–463 — Ficha de Grupo: inventário, depósitos e animais

Fontes: [party-actor.mjs](../scripts/party-actor.mjs), [containers.mjs](../scripts/containers.mjs), [encumbrance.mjs](../scripts/encumbrance.mjs), [rations.mjs](../scripts/rations.mjs), [travel-context.mjs](../scripts/travel-context.mjs).

453. [ ] **Inventário do grupo**

   **Fazer:** Adicionar equipamentos ao Grupo.

   **Esperado:** Itens pertencem ao Grupo e conservam suas quantidades.

   **Perfil:** GM e dono da ficha.

454. [ ] **Alterar quantidade**

   **Fazer:** Usar aumentar/diminuir e excluir item no grupo.

   **Esperado:** Atualiza quantidade real sem afetar o inventário pessoal dos membros.

   **Perfil:** GM e dono da ficha.

455. [ ] **Local de armazenamento**

   **Fazer:** Selecionar/arrastar local suportado pelo seletor.

   **Esperado:** Vincula o depósito/veículo e mostra sua identificação/capacidade.

   **Perfil:** GM e dono da ficha.

456. [ ] **Abrir depósito vinculado**

   **Fazer:** Clicar no controle de abrir ficha do depósito já associado.

   **Esperado:** Abre documento real quando acessível, sem criar uma segunda cópia do depósito.

   **Perfil:** GM e dono da ficha.

457. [ ] **Detectar categoria de transporte**

   **Fazer:** Testar carroça, vagão, trenó, embarcações e animal de carga.

   **Esperado:** Usa categoria e capacidade reconhecidas para cada referência.

   **Perfil:** GM e dono da ficha.

458. [ ] **Capacidade manual de depósito**

   **Fazer:** Editar a capacidade quando permitido.

   **Esperado:** Persiste o valor configurado e atualiza uso/carga.

   **Perfil:** GM e dono da ficha.

459. [ ] **Desvincular depósito**

   **Fazer:** Retirar o vínculo pelo controle.

   **Esperado:** Não apaga o documento original nem os itens sem confirmação pertinente.

   **Perfil:** GM e dono da ficha.

460. [ ] **Animal de tração**

   **Fazer:** Vincular um animal ao transporte.

   **Esperado:** Mostra vínculo e dados pertinentes do animal.

   **Perfil:** GM e dono da ficha.

461. [ ] **Desvincular animal**

   **Fazer:** Remover associação.

   **Esperado:** O animal continua existindo como Actor.

   **Perfil:** GM e dono da ficha.

462. [ ] **Suprimentos do grupo**

   **Fazer:** Adicionar alimentos habilitados ao Grupo.

   **Esperado:** Ficam disponíveis como estoque de alimentação coletiva.

   **Perfil:** GM e dono da ficha.

463. [ ] **Ator vinculado removido**

   **Fazer:** Em cópia de teste, excluir referência de depósito/animal/integrante.

   **Esperado:** Ficha trata referência ausente sem corromper outros vínculos.

   **Perfil:** GM e dono da ficha.


<a id="bloco-27"></a>

### 464–485 — Expedição: acesso, dias e orientação

Fontes: [party-actor.mjs](../scripts/party-actor.mjs), [expedition-state.mjs](../scripts/expedition-state.mjs), [expedition-orientation.mjs](../scripts/expedition-orientation.mjs), [expedition-private.mjs](../scripts/expedition-private.mjs), [travel-context.mjs](../scripts/travel-context.mjs).

464. [ ] **Acesso à aba Expedição**

   **Fazer:** Abrir Grupo como GM e como jogador.

   **Esperado:** Acesso/visibilidade seguem permissões; não confundir ficha visível com resultados secretos liberados.

   **Perfil:** GM e dono da ficha.

465. [ ] **Iniciar expedição**

   **Fazer:** Acionar Iniciar.

   **Esperado:** Ativa expedição no dia 1 e prepara estado diário.

   **Perfil:** GM e dono da ficha.

466. [ ] **Encerrar expedição**

   **Fazer:** Acionar Encerrar, primeiro cancelando e depois confirmando.

   **Esperado:** Cancelar preserva; confirmar reinicia contador/estado pertinente.

   **Perfil:** GM e dono da ficha.

467. [ ] **Escolher guia**

   **Fazer:** Selecionar guia pelo diálogo, cartão ou arraste suportado.

   **Esperado:** Vincula o Actor correto e mostra o indicador de guia.

   **Perfil:** GM e dono da ficha.

468. [ ] **Retirar/trocar guia**

   **Fazer:** Trocar integrante que guia com resultado já existente.

   **Esperado:** Atualiza contexto; solicitações antigas não sobrescrevem o novo dia/contexto.

   **Perfil:** GM e dono da ficha.

469. [ ] **Sem guia**

   **Fazer:** Tentar orientação sem guia válido.

   **Esperado:** Informa requisito sem criar rolagem para ator arbitrário.

   **Perfil:** GM e dono da ficha.

470. [ ] **Mateiro e região**

   **Fazer:** Testar sem Mateiro e com níveis I, II e III em Ambria/Iluminada/Selvagem/Escura.

   **Esperado:** Requisitos e benefícios variam pelo nível e região conforme código.

   **Perfil:** GM e dono da ficha.

471. [ ] **Rolar orientação**

   **Fazer:** Informar modificador circunstancial e executar.

   **Esperado:** Usa Vigilante do guia e dados/opções nativos quando disponíveis.

   **Perfil:** GM e dono da ficha.

472. [ ] **Cartógrafo e Dedo Verde**

   **Fazer:** Adicionar os dons e repetir orientação.

   **Esperado:** Acrescenta somente bônus ainda não preparados pelo sistema, sem dupla contagem.

   **Perfil:** GM e dono da ficha.

473. [ ] **Desbravador e Fome**

   **Fazer:** Testar vantagem do Desbravador e penalidade de Fome.

   **Esperado:** Composição de favor e objetivo segue a integração.

   **Perfil:** GM e dono da ficha.

474. [ ] **Sucesso de orientação por margem**

   **Fazer:** Obter sucesso com margem inferior a cinco e depois margem de pelo menos cinco.

   **Esperado:** Com benefícios elegíveis, distingue Sucesso e Grande Sucesso; modificadores estão na matriz do inventário técnico.

   **Perfil:** GM e dono da ficha.

475. [ ] **Mateiro insuficiente mas teste aprovado**

   **Fazer:** Usar guia com nível inferior ao benefício regional, mas que possa fazer o teste, e obter sucesso.

   **Esperado:** Pode evitar Infortúnio sem receber os bônus de eventos do sucesso pleno.

   **Perfil:** GM e dono da ficha.

476. [ ] **Opções críticas nativas**

   **Fazer:** Alternar regras nativas de crítico e repetir testes.

   **Esperado:** Respeita política de sucesso/falha/crítico da rota implementada.

   **Perfil:** GM e dono da ficha.

477. [ ] **Resultado de orientação diário**

   **Fazer:** Tentar rolar novamente sem reiniciar.

   **Esperado:** Mantém o resultado diário e evita duplicação de resolução.

   **Perfil:** GM e dono da ficha.

478. [ ] **Reiniciar orientação**

   **Fazer:** Usar o reset autorizado e rolar novamente.

   **Esperado:** Reinicia somente contexto apropriado; preserva outras informações conforme invalidação prevista.

   **Perfil:** GM e dono da ficha.

479. [ ] **Dia/contexto mudou durante rolagem**

   **Fazer:** Trocar guia/região/dia enquanto outra sessão está prestes a resolver.

   **Esperado:** Rejeita solicitação obsoleta em vez de gravar no dia novo.

   **Perfil:** GM e dono da ficha.

480. [ ] **Privacidade de orientação**

   **Fazer:** Rolar em modo privado/cego e abrir ficha como outro jogador.

   **Esperado:** Não revela atributo, dado, objetivo ou resultado protegido por flags comuns.

   **Perfil:** GM e dono da ficha.

481. [ ] **Persistência da expedição**

   **Fazer:** Fechar/reabrir mundo com resultado diário salvo.

   **Esperado:** Mantém estado correspondente e recupera dados privados somente para autorizados.

   **Perfil:** GM e dono da ficha.

482. [ ] **Próximo dia na versão publicada**

   **Fazer:** Na 0.19.3, usar controle de avançar dia da expedição.

   **Esperado:** Incrementa o dia do Grupo e reinicia estado diário pertinente; esse controle é substituído pelo fluxo de calendário somente na alteração local.

   **Perfil:** GM e dono da ficha.

483. [ ] **Dia anterior na versão publicada**

   **Fazer:** Na 0.19.3, tentar recuar do dia 2 e depois do dia 1.

   **Esperado:** Recua até dia 1; não gera dia zero ativo pelo controle.

   **Perfil:** GM e dono da ficha.

484. [ ] **Compêndio privado de expedição**

   **Fazer:** Como GM, resolver informação privada e inspecionar os compêndios do mundo.

   **Esperado:** Pode criar world.symbaroum-ind-resources-expeditions como JournalEntry exclusivo de GM/assistente, fora dos dados compartilhados do Actor.

   **Perfil:** GM e dono da ficha.

485. [ ] **Permissão alterada no compêndio privado**

   **Fazer:** Em cópia de teste, abrir permissões do compêndio e tentar gravar outro segredo.

   **Esperado:** Recusa gravar segredos em armazenamento cuja configuração foi exposta; não publica o resultado por fallback.

   **Perfil:** GM e dono da ficha.


<a id="bloco-28"></a>

### 486–504 — Expedição: alimentação e eventos de Davokar

Fontes: [party-actor.mjs](../scripts/party-actor.mjs), [rations.mjs](../scripts/rations.mjs), [expedition-data.mjs](../scripts/expedition-data.mjs), [expedition-private.mjs](../scripts/expedition-private.mjs), [expedition-state.mjs](../scripts/expedition-state.mjs).

486. [ ] **Alimentar membro pelo estoque coletivo**

   **Fazer:** Usar alimentar com rações do Grupo.

   **Esperado:** Consome uso coletivo e marca membro alimentado no dia.

   **Perfil:** GM e dono da ficha.

487. [ ] **Alimentar com estoque pessoal**

   **Fazer:** Usar alimento do integrante.

   **Esperado:** Consome o saldo pessoal autorizado e marca o dia.

   **Perfil:** GM e dono da ficha.

488. [ ] **Alimentar todos**

   **Fazer:** Usar ação coletiva com estoque suficiente.

   **Esperado:** Alimenta apenas os ainda pendentes e cobra o total correspondente.

   **Perfil:** GM e dono da ficha.

489. [ ] **Membro já alimentado**

   **Fazer:** Repetir ação no mesmo dia.

   **Esperado:** Não cobra novamente pela mesma alimentação diária.

   **Perfil:** GM e dono da ficha.

490. [ ] **Estoque coletivo insuficiente**

   **Fazer:** Tentar alimentar conjunto sem saldo suficiente.

   **Esperado:** Recusa/informa sem marcar todo o grupo como alimentado indevidamente.

   **Perfil:** GM e dono da ficha.

491. [ ] **Marcação manual de alimentação**

   **Fazer:** Alternar estado pelo controle manual existente.

   **Esperado:** Altera o estado diário sem fingir consumo de estoque.

   **Perfil:** GM e dono da ficha.

492. [ ] **Comer fora da ficha de Grupo**

   **Fazer:** Integrante de expedição ativa consome alimento pessoal.

   **Esperado:** Sincroniza marcação diária pertinente sem travar fila de estoque/grupo.

   **Perfil:** GM e dono da ficha.

493. [ ] **Busca ativa**

   **Fazer:** Alternar busca ativa na etapa de eventos.

   **Esperado:** Altera a busca de ruínas conforme regra explícita; não ressuscita controles de jornada aposentados.

   **Perfil:** GM e dono da ficha.

494. [ ] **Selecionar tabelas**

   **Fazer:** Configurar tabelas de Ruínas, Encontros, Inimigos e Terreno disponíveis.

   **Esperado:** Resolve UUID/ID configurado e usa documentos pertinentes.

   **Perfil:** GM e dono da ficha.

495. [ ] **Sem tabelas oficiais**

   **Fazer:** Tentar evento com documento oficial ausente.

   **Esperado:** Informa ausência; o IND não distribui substituto genérico dessas quatro tabelas.

   **Perfil:** GM e dono da ficha.

496. [ ] **Rolar evento individual**

   **Fazer:** Executar apenas um slot de evento.

   **Esperado:** Salva resultado somente desse slot no contexto diário.

   **Perfil:** GM e dono da ficha.

497. [ ] **Rolar todos os eventos**

   **Fazer:** Acionar ação conjunta.

   **Esperado:** Resolve cada etapa elegível sem repetir as já resolvidas.

   **Perfil:** GM e dono da ficha.

498. [ ] **Sem busca ativa de ruínas**

   **Fazer:** Desligar busca ativa e rolar eventos.

   **Esperado:** Ruínas não recebe benefício de busca por controles aposentados.

   **Perfil:** GM e dono da ficha.

499. [ ] **Modificadores regionais e orientação**

   **Fazer:** Comparar regiões e resultados de orientação.

   **Esperado:** Aplica modificadores pertinentes às tabelas; conferir valores exibidos.

   **Perfil:** GM e dono da ficha.

500. [ ] **Infortúnios**

   **Fazer:** Gerar teste da Tabela 25 com região Iluminada/Selvagem/Escura.

   **Esperado:** Usa 1d20 com modificador 0/+5/+10 conforme contexto; 21–30 dependem do bônus, não de 1d30.

   **Perfil:** GM e dono da ficha.

501. [ ] **Tabela personalizada de encontros**

   **Fazer:** Selecionar tabela customizada com/sem metadados de detecção.

   **Esperado:** Não adivinha faixas de detecção apenas pelo nome ou intervalos.

   **Perfil:** GM e dono da ficha.

502. [ ] **Reiniciar um evento**

   **Fazer:** Usar reset de slot autorizado.

   **Esperado:** Libera nova resolução daquele evento sem apagar indevidamente os demais.

   **Perfil:** GM e dono da ficha.

503. [ ] **Sigilo de eventos**

   **Fazer:** Resolver privado/cego e comparar sessões.

   **Esperado:** Resultados protegidos não são publicados por atualização da ficha para quem não pode lê-los.

   **Perfil:** GM e dono da ficha.

504. [ ] **Dois usuários resolvem o mesmo evento**

   **Fazer:** Acionar o mesmo slot simultaneamente.

   **Esperado:** Autoridade/fila resolve uma operação lógica por estado diário.

   **Perfil:** GM e dono da ficha.


<a id="bloco-29"></a>

### 505–510 — Expedição: alterações locais ainda não publicadas

Fontes: [expedition-calendar.mjs](../scripts/expedition-calendar.mjs), [expedition-state.mjs](../scripts/expedition-state.mjs), [party-actor.mjs](../scripts/party-actor.mjs).

505. [ ] **Finalizar dia vinculado ao calendário** — **LOCAL — não publicado**

   **Fazer:** Na instalação local com alterações em andamento, usar Finalizar dia como GM.

   **Esperado:** Avança data pelo serviço de calendário e sincroniza contador/dados diários do Grupo.

   **Perfil:** GM e jogador dono do Grupo.

506. [ ] **Contador segue data mundial** — **LOCAL — não publicado**

   **Fazer:** Com expedição vinculada, avançar e recuar a data.

   **Esperado:** Dias refletem o vínculo salvo e não incrementam duas vezes por cliente.

   **Perfil:** GM e jogador dono do Grupo.

507. [ ] **Vários grupos** — **LOCAL — não publicado**

   **Fazer:** Manter duas expedições ativas e alterar a data.

   **Esperado:** Cada vínculo é conciliado independentemente.

   **Perfil:** GM e jogador dono do Grupo.

508. [ ] **Calendário sem data** — **LOCAL — não publicado**

   **Fazer:** Tentar finalizar dia antes de configurar data inicial.

   **Esperado:** Informa necessidade de calendário sem avançar parcialmente a expedição.

   **Perfil:** GM e jogador dono do Grupo.

509. [ ] **Sem permissão de GM** — **LOCAL — não publicado**

   **Fazer:** Como jogador dono do grupo, tentar finalizar dia pela rota nova.

   **Esperado:** Não ganha permissão para alterar o calendário mundial por possuir o Grupo.

   **Perfil:** GM e jogador dono do Grupo.

510. [ ] **Sem controles antigos de próximo/anterior dia** — **LOCAL — não publicado**

   **Fazer:** Comparar ficha local com publicação 0.19.3.

   **Esperado:** A versão local usa o fluxo novo; não exigir o mesmo controle no Foundry online enquanto não publicado.

   **Perfil:** GM e jogador dono do Grupo.


<a id="bloco-30"></a>

### 511–525 — Diários Symbaroum e importador de conteúdo

Fontes: [journal-categories.mjs](../scripts/journal-categories.mjs), [journal-integration.mjs](../scripts/journal-integration.mjs).

511. [ ] **Configurar categorias**

   **Fazer:** Abrir diário na ficha Symbaroum e usar Configurar Categorias.

   **Esperado:** Abre gerenciador nativo sem trocar a ficha nem reimportar diário.

   **Perfil:** GM e dono da ficha.

512. [ ] **Criar/renomear categoria**

   **Fazer:** Adicionar categoria e editar seu nome.

   **Esperado:** Usa documentos nativos de categoria e persiste o nome.

   **Perfil:** GM e dono da ficha.

513. [ ] **Ordenar categorias**

   **Fazer:** Reordenar no gerenciador.

   **Esperado:** Índice e navegação seguem a ordem das categorias.

   **Perfil:** GM e dono da ficha.

514. [ ] **Categoria da página**

   **Fazer:** Editar uma página e selecionar categoria.

   **Esperado:** Seletor fica utilizável e página aparece no grupo correspondente.

   **Perfil:** GM e dono da ficha.

515. [ ] **Sem categoria**

   **Fazer:** Manter página sem atribuição.

   **Esperado:** Aparece em Sem Categoria ao final quando existem grupos.

   **Perfil:** GM e dono da ficha.

516. [ ] **Excluir categoria**

   **Fazer:** Excluir categoria que possui páginas.

   **Esperado:** As páginas continuam existentes e acessíveis, sem exclusão em cascata indevida.

   **Perfil:** GM e dono da ficha.

517. [ ] **Buscar dentro do diário**

   **Fazer:** Pesquisar palavra com páginas em categorias diferentes.

   **Esperado:** Busca preservada; cabeçalho sem resultados fica oculto.

   **Perfil:** GM e dono da ficha.

518. [ ] **Permissões e compêndios**

   **Fazer:** Comparar GM/dono, observador e compêndio bloqueado.

   **Esperado:** Somente editores autorizados recebem o controle de gerenciar categorias.

   **Perfil:** GM e dono da ficha.

519. [ ] **Outras fichas de diário**

   **Fazer:** Abrir mesma entrada em outra ficha nativa/de módulo.

   **Esperado:** O IND não substitui comportamento de fichas fora da integração específica.

   **Perfil:** GM e dono da ficha.

520. [ ] **Recarga e módulo desligado**

   **Fazer:** Reabrir mundo e depois desativar IND em teste.

   **Esperado:** Categorias e páginas persistem como dados nativos.

   **Perfil:** GM e dono da ficha.

521. [ ] **Simulação de importação**

   **Fazer:** Como GM, usar journalIntegration.dryRun() pela API.

   **Esperado:** Mostra criar/atualizar/inalterado sem modificar diários.

   **Perfil:** GM e dono da ficha.

522. [ ] **Importação explícita**

   **Fazer:** Executar importManifest() somente em mundo de teste.

   **Esperado:** Cria entradas/páginas/pastas e permissões conforme manifesto; não roda automaticamente ao carregar.

   **Perfil:** GM e dono da ficha.

523. [ ] **Importação repetida**

   **Fazer:** Reimportar sem updateExisting e depois com a opção habilitada.

   **Esperado:** Não duplica fontes existentes; a atualização explícita pode substituir páginas importadas e deve ser conferida em cópia.

   **Perfil:** GM e dono da ficha.

524. [ ] **Visibilidade pública e GM**

   **Fazer:** Inspecionar entradas/páginas importadas de cada tipo.

   **Esperado:** Ownership segue o manifesto e não expõe material GM ao jogador.

   **Perfil:** GM e dono da ficha.

525. [ ] **Limpar pastas legadas**

   **Fazer:** Executar limpeza própria do importador em teste.

   **Esperado:** Remove só pastas legadas vazias gerenciadas; preserva pastas com diários.

   **Perfil:** GM e dono da ficha.


<a id="bloco-31"></a>

### 526–545 — Integrações externas e regressão entre clientes

Fontes: [compatibility.mjs](../scripts/compatibility.mjs), [token-action-hud.mjs](../scripts/token-action-hud.mjs), [init.mjs](../scripts/init.mjs), [sockets.mjs](../scripts/sockets.mjs), [socket-policy.mjs](../scripts/socket-policy.mjs), [actor-references.mjs](../scripts/actor-references.mjs), [utils.mjs](../scripts/utils.mjs).

526. [ ] **Token Action HUD presente**

   **Fazer:** Ativar dependências compatíveis e opção do IND.

   **Esperado:** Oferece manobras/ações integradas sem repetir categorias.

   **Perfil:** GM e dono da ficha. **Opções:** `enableTokenActionHudIntegration`.

527. [ ] **Token Action HUD ausente**

   **Fazer:** Desligar dependências e usar ficha normal.

   **Esperado:** As ações próprias do IND continuam acessíveis pelas rotas de ficha.

   **Perfil:** GM e dono da ficha.

528. [ ] **Symbaroum HUD separado**

   **Fazer:** Se instalado, testar ataque, troca de arma e recuperação por ele.

   **Esperado:** Usa APIs do IND; alterações próprias desse outro módulo não integram este inventário.

   **Perfil:** GM e dono da ficha.

529. [ ] **Automated Animations presente**

   **Fazer:** Resolver ataques e poderes nativos com integração ligada.

   **Esperado:** Fornece contexto de item, ator e alvo para integração, sem prometer animação quando não há preset externo.

   **Perfil:** GM e dono da ficha. **Opções:** `enableAutomatedAnimationsIntegration`.

530. [ ] **Automated Animations desligado**

   **Fazer:** Repetir ação com integração desligada/ausente.

   **Esperado:** Não depende do módulo externo para resolver dados e efeitos nativos.

   **Perfil:** GM e dono da ficha.

531. [ ] **libWrapper presente**

   **Fazer:** Carregar mundo com libWrapper e executar rotas alteradas.

   **Esperado:** Usa wrappers disponíveis sem registrar a mesma camada mais de uma vez.

   **Perfil:** GM e dono da ficha.

532. [ ] **libWrapper ausente**

   **Fazer:** Repetir sem ele em ambiente de teste.

   **Esperado:** Fallback continua operando onde previsto; anotar conflitos com outros modificadores.

   **Perfil:** GM e dono da ficha.

533. [ ] **Item Piles Symbaroum e genérico**

   **Fazer:** Comparar cada provedor separadamente conforme relatório.

   **Esperado:** Não ativar ambos como se fossem provedores equivalentes; conferir preservação de conteúdos.

   **Perfil:** GM e dono da ficha.

534. [ ] **Dependência socketlib**

   **Fazer:** Conferir a dependência obrigatória e ações de autoridade em mundo de teste.

   **Esperado:** Foundry e IND devem apontar a falta da dependência/serviço; não autorizar mutações arbitrárias como substituto.

   **Perfil:** GM e dono da ficha.

535. [ ] **Cleaner Sheet Title Bar**

   **Fazer:** Abrir fichas e usar controles de cabeçalho com ele ativo.

   **Esperado:** Botões do IND permanecem utilizáveis no cabeçalho compatível.

   **Perfil:** GM e dono da ficha.

536. [ ] **CRLNGN UI**

   **Fazer:** Abrir fichas, diálogos e controles com essa interface.

   **Esperado:** Isolamento visual protege as fichas Symbaroum sem duplicar estilos/controles.

   **Perfil:** GM e dono da ficha.

537. [ ] **ATL, TokenMagic e visuais**

   **Fazer:** Usar indicadores do IND com modificadores visuais externos.

   **Esperado:** Indicadores mecânicos vazios não viram iluminação/efeito permanente acidental.

   **Perfil:** GM e dono da ficha.

538. [ ] **Diagnóstico de áudio e calendários externos**

   **Fazer:** Inspecionar relatório com Token Audio FX anterior ao core exigido, Tabletop RPG Music ou Calendaria SDM sem base.

   **Esperado:** Os casos conhecidos geram diagnóstico; não são novos players de áudio ou calendários adicionados pelo IND.

   **Perfil:** GM e dono da ficha.

539. [ ] **Dois Tokenizers ativos**

   **Fazer:** Inspecionar relatório com as duas gerações instaladas/ativas.

   **Esperado:** Informa sobreposição potencial de edição de imagem, sem substituir o Tokenizer.

   **Perfil:** GM e dono da ficha.

540. [ ] **Troca de cena**

   **Fazer:** Com fichas/HUD abertos, mudar de cena.

   **Esperado:** Controles passam a resolver tokens e encontro corretos.

   **Perfil:** GM e dono da ficha.

541. [ ] **Token não vinculado**

   **Fazer:** Repetir dano, cura, suprimentos, recipiente e indicadores com token sintético.

   **Esperado:** Não altera acidentalmente outro token ou ator do mundo por nome compartilhado.

   **Perfil:** GM e dono da ficha.

542. [ ] **Dois GMs e dois jogadores**

   **Fazer:** Executar efeitos, consumos e solicitações com quatro sessões.

   **Esperado:** Não multiplica escritas, mensagens ou avanço de relógio por cliente.

   **Perfil:** GM e dono da ficha.

543. [ ] **Reabrir interface muitas vezes**

   **Fazer:** Abrir/fechar ficha, menus, catálogos, chat e HUD repetidamente.

   **Esperado:** Não acumula listeners ou aciona a mesma mecânica várias vezes por clique.

   **Perfil:** GM e dono da ficha.

544. [ ] **Foundry v13**

   **Fazer:** Percorrer o roteiro na versão usada na mesa.

   **Esperado:** Registrar resultado real desta geração, separando de testes automatizados.

   **Perfil:** GM e dono da ficha.

545. [ ] **Foundry v14**

   **Fazer:** Quando houver ambiente separado compatível, repetir partes de UI e documentos.

   **Esperado:** Fallback técnico precisa de teste real; este roteiro não certifica compatibilidade visual v14.

   **Perfil:** GM e dono da ficha.


<a id="bloco-32"></a>

### 546–550 — Recursos presentes no código mas pausados ou sem interface

Fontes: [chat-item-use.mjs](../scripts/chat-item-use.mjs), [init.mjs](../scripts/init.mjs), [verses.mjs](../scripts/verses.mjs), [settings.mjs](../scripts/settings.mjs).

546. [ ] **Envio adicional de itens ao chat pausado** — **Código — ver descrição**

   **Fazer:** Procurar a opção de envio extra em Utilidades e tentar chatItemUse.send() em teste.

   **Esperado:** CHAT_ITEM_USE_PAUSED=true impede a função; não confundir com o envio nativo do Symbaroum.

   **Perfil:** GM/desenvolvedor.

547. [ ] **API de inspeção de recursos** — **Código — ver descrição**

   **Fazer:** Consultar game.tenebreResources.inspectActorResources(ator) no console.

   **Esperado:** Retorna diagnóstico de alimentos/munição/carga sem consumir nada.

   **Perfil:** GM/desenvolvedor.

548. [ ] **Recuperação de Vigoroso pela API** — **Código — ver descrição**

   **Fazer:** Em cópia de teste, chamar game.tenebreResources.hunger.recoverStrongPenalty(ator, 1).

   **Esperado:** Sem Fome e com penalidade própria negativa, recupera até um ponto; bloqueia enquanto Fome estiver ativa. Não há ligação automática desse helper a toda cura de outro módulo.

   **Perfil:** GM/desenvolvedor.

549. [ ] **Exportação de configurações pela API** — **Código — ver descrição**

   **Fazer:** Consultar TenebreSettings.export() via código/console se importado pelo desenvolvedor.

   **Esperado:** Reúne settings do namespace; não há garantia de botão geral de importação/exportação na UI.

   **Perfil:** GM/desenvolvedor.

550. [ ] **Funções auxiliares internas** — **Código — ver descrição**

   **Fazer:** Consultar o inventário técnico de funções por arquivo/linha.

   **Esperado:** Helpers e callbacks sustentam os casos acima; não são todos botões ou ações diretamente testáveis no Foundry.

   **Perfil:** GM/desenvolvedor.


<a id="bloco-33"></a>

### 551–610 — Verificação individual de todas as configurações principais

Fontes: [settings.mjs](../scripts/settings.mjs), [constants.mjs](../scripts/constants.mjs).

551. [ ] **Ativar Pão de Viagem (enableRations)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableRations`.

552. [ ] **Usos por pão (rationUses)**

   **Fazer:** Salvar dois valores válidos diferentes, exercitar a função e reabrir o formulário.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `rationUses`.

553. [ ] **Usar outros alimentos (enableOtherRations)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableOtherRations`.

554. [ ] **Alimentos configuráveis (extraRationFoods)**

   **Fazer:** Modificar a lista pelo formulário próprio, salvar e reabrir.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `extraRationFoods`.

555. [ ] **Ativar consumo automático (enableAmmoConsumption)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableAmmoConsumption`.

556. [ ] **Usar aljava carregada (enableQuiverAmmoContainers)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableQuiverAmmoContainers`.

557. [ ] **Capacidade da aljava (quiverCapacity)**

   **Fazer:** Salvar dois valores válidos diferentes, exercitar a função e reabrir o formulário.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `quiverCapacity`.

558. [ ] **Ativar rastreamento de acertos (enableHitTracking)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableHitTracking`.

559. [ ] **Ativar recuperação (enableAmmoRecovery)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableAmmoRecovery`.

560. [ ] **Recuperação por tipo/qualidade (enableAmmoRecoveryByQuality)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableAmmoRecoveryByQuality`.

561. [ ] **Recuperação única (ammoRecoveryFlatTarget)**

   **Fazer:** Salvar dois valores válidos diferentes, exercitar a função e reabrir o formulário.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `ammoRecoveryFlatTarget`.

562. [ ] **Recuperação comum (ammoRecoveryCommonTarget)**

   **Fazer:** Salvar dois valores válidos diferentes, exercitar a função e reabrir o formulário.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `ammoRecoveryCommonTarget`.

563. [ ] **Recuperação de qualidade (ammoRecoveryQualityTarget)**

   **Fazer:** Salvar dois valores válidos diferentes, exercitar a função e reabrir o formulário.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `ammoRecoveryQualityTarget`.

564. [ ] **Recuperação mística (ammoRecoveryMysticalTarget)**

   **Fazer:** Salvar dois valores válidos diferentes, exercitar a função e reabrir o formulário.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `ammoRecoveryMysticalTarget`.

565. [ ] **Exibir botão de recuperação na HUD (showAmmoRecoveryHud)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `showAmmoRecoveryHud`.

566. [ ] **Exibir aljavas na HUD (showQuiverHud)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `showQuiverHud`.

567. [ ] **Ativar Fome (enableHunger)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableHunger`.

568. [ ] **Ativar recuperação automática (enableRestHealing)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableRestHealing`.

569. [ ] **HP/Vitalidade por dia de descanso (restHealing)**

   **Fazer:** Salvar dois valores válidos diferentes, exercitar a função e reabrir o formulário.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `restHealing`.

570. [ ] **Exibir botão Descanso nas fichas (enableRestButton)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableRestButton`.

571. [ ] **Ativar Sobrecarga (enableEncumbrance)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableEncumbrance`.

572. [ ] **Ativar gerenciamento de recipientes (enableContainers)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableContainers`.

573. [ ] **Estado de expansão dos recipientes (containerExpansionState)**

   **Fazer:** Usar a função de interface correspondente, recarregar e comparar os dados persistidos.

   **Esperado:** Estado interno persiste no escopo indicado no inventário; não é uma opção que deva aparecer em menu.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `containerExpansionState`.

574. [ ] **Ativar régua de movimento (enableMovementRuler)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableMovementRuler`.

575. [ ] **Colorir régua por distância (enableMovementColors)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableMovementColors`.

576. [ ] **Exibir limites na etiqueta (enableMovementLimitLabels)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableMovementLimitLabels`.

577. [ ] **Bloquear movimento acima do limite (enableMovementBlocking)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableMovementBlocking`.

578. [ ] **Aplicar Fome ao movimento (enableMovementHungerModifier)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableMovementHungerModifier`.

579. [ ] **Aplicar Sobrecarga ao movimento (enableMovementEncumbranceModifier)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableMovementEncumbranceModifier`.

580. [ ] **Aplicar efeitos e manobras ao movimento (enableMovementEffectModifiers)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableMovementEffectModifiers`.

581. [ ] **Unidades de movimento (movementUnitSystem)**

   **Fazer:** Escolher cada alternativa do controle, salvar e exercitar a função.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `movementUnitSystem`.

582. [ ] **Distância de um movimento (metros) (movementBaseMeters)**

   **Fazer:** Salvar dois valores válidos diferentes, exercitar a função e reabrir o formulário.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `movementBaseMeters`.

583. [ ] **Distância de um movimento (pés) (movementBaseFeet)**

   **Fazer:** Salvar dois valores válidos diferentes, exercitar a função e reabrir o formulário.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `movementBaseFeet`.

584. [ ] **Ativar manobras (enableManeuvers)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableManeuvers`.

585. [ ] **Automatizar morte de personagens (enableDeathAutomation)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableDeathAutomation`.

586. [ ] **Exibir opção de rolagem privada (enableRollPrivacy)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableRollPrivacy`.

587. [ ] **Apresentação das mensagens (enableCompactNpcAttackChat)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableCompactNpcAttackChat`.

588. [ ] **Ocultar detalhes de NPC (hideNpcDetailsInChat)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `hideNpcDetailsInChat`.

589. [ ] **Ativar Sacar/Guardar Arma (enableWeaponReadiness)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableWeaponReadiness`.

590. [ ] **Colocar em combate ao sacar arma (enableWeaponReadinessCombatSync)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableWeaponReadinessCombatSync`.

591. [ ] **Exibir botão flutuante Sacar/Guardar Arma (showWeaponReadinessButton)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `showWeaponReadinessButton`.

592. [ ] **Exibir arma sacada no token (showWeaponReadinessTokenIndicator)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `showWeaponReadinessTokenIndicator`.

593. [ ] **Animar Sacar/Guardar Arma (enableWeaponReadinessAnimation)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableWeaponReadinessAnimation`.

594. [ ] **Exibir mensagens de Sacar/Guardar Arma no chat (showWeaponReadinessChatMessages)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `showWeaponReadinessChatMessages`.

595. [ ] **Posição do botão Sacar/Guardar Arma (weaponReadinessButtonPosition)**

   **Fazer:** Usar a função de interface correspondente, recarregar e comparar os dados persistidos.

   **Esperado:** Estado interno persiste no escopo indicado no inventário; não é uma opção que deva aparecer em menu.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `weaponReadinessButtonPosition`.

596. [ ] **Ativar uso e envio de itens/habilidades no chat (enableChatItemUse)**

   **Fazer:** Verificar ausência de controle enquanto envio extra está pausado.

   **Esperado:** O valor salvo não supera CHAT_ITEM_USE_PAUSED=true.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableChatItemUse`.

597. [ ] **Ativar integração com Automated Animations (enableAutomatedAnimationsIntegration)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableAutomatedAnimationsIntegration`.

598. [ ] **Exibir botão Limpar efeitos (enableClearEffectsButton)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableClearEffectsButton`.

599. [ ] **Enviar condição aplicada para o chat (showAppliedStatusEffectChatMessages)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `showAppliedStatusEffectChatMessages`.

600. [ ] **Ativar integração com Token Action HUD (enableTokenActionHudIntegration)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableTokenActionHudIntegration`.

601. [ ] **Ativar macros e tabelas de utilidade (enableBithirUtilities)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableBithirUtilities`.

602. [ ] **Ativar catálogo de rituais (enableRitualCatalog)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableRitualCatalog`.

603. [ ] **Agrupar rituais em Ritualista (enableRitualistGrouping)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableRitualistGrouping`.

604. [ ] **Ativar Registro do Mestre (enableGmLog)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableGmLog`.

605. [ ] **Excluir equipamentos esgotados automaticamente (enableInventoryCleanup)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableInventoryCleanup`.

606. [ ] **Ativar Gerar Sombra (enableGenerateShadow)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `enableGenerateShadow`.

607. [ ] **Ocultar geração de Sombra (hideShadowGeneration)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `hideShadowGeneration`.

608. [ ] **Ocultar texto de Sombra (hideShadowLabel)**

   **Fazer:** Salvar ligada, testar a função correspondente, salvar desligada e repetir; depois recarregar.

   **Esperado:** Apenas o comportamento relacionado muda; a opção persiste e as demais categorias não são redefinidas.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `hideShadowLabel`.

609. [ ] **Avisos de compatibilidade reconhecidos (compatibilityNoticeAcknowledged)**

   **Fazer:** Usar a função de interface correspondente, recarregar e comparar os dados persistidos.

   **Esperado:** Estado interno persiste no escopo indicado no inventário; não é uma opção que deva aparecer em menu.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `compatibilityNoticeAcknowledged`.

610. [ ] **Pesos descobertos automaticamente (encumbranceDiscoveredWeights)**

   **Fazer:** Usar a função de interface correspondente, recarregar e comparar os dados persistidos.

   **Esperado:** Estado interno persiste no escopo indicado no inventário; não é uma opção que deva aparecer em menu.

   **Perfil:** GM; estados locais também pelo jogador. **Opções:** `encumbranceDiscoveredWeights`.


<a id="bloco-34"></a>

### 611–619 — Demais registros de configuração e estados persistidos

Fontes: [calendar.mjs](../scripts/calendar.mjs), [calendar-options.mjs](../scripts/calendar-options.mjs), [bithir-macros.mjs](../scripts/bithir-macros.mjs).

611. [ ] **enableCalendar**

   **Fazer:** Alternar ativação geral do calendário, salvar e reabrir o mundo.

   **Esperado:** A regra fica ligada/desligada e a data existente é preservada; escopo world.

   **Perfil:** GM; preferências client também pelo jogador.

612. [ ] **calendarDate**

   **Fazer:** Definir uma data inicial pela interface e depois recarregar.

   **Esperado:** Âncora de data persiste; é objeto interno, não um campo JSON para editar no menu.

   **Perfil:** GM; preferências client também pelo jogador.

613. [ ] **calendarClockRunning**

   **Fazer:** Usar iniciar/parar e reabrir preferências ou recarregar.

   **Esperado:** Estado booleano de execução reflete os controles; não cria executor duplicado.

   **Perfil:** GM; preferências client também pelo jogador.

614. [ ] **calendarClockSpeed**

   **Fazer:** Salvar duas velocidades válidas e medir o relógio.

   **Esperado:** Persiste world; faixa aceita de 0,01 a 86400.

   **Perfil:** GM; preferências client também pelo jogador.

615. [ ] **calendarWorldOptions**

   **Fazer:** Salvar integração, pausa por combate, visibilidade, permissões e horários solares.

   **Esperado:** Objeto mundial mantém seus campos sem apagar a data.

   **Perfil:** GM; preferências client também pelo jogador.

616. [ ] **calendarIndependentTime**

   **Fazer:** Em modo independente, avançar o tempo e recarregar.

   **Esperado:** O estado interno mantém segundos próprios; não é um controle exposto separado.

   **Perfil:** GM; preferências client também pelo jogador.

617. [ ] **calendarClientOptions**

   **Fazer:** Salvar modo, tema, layout e preferências em dois clientes.

   **Esperado:** Cada cliente conserva seus próprios campos e posições.

   **Perfil:** GM; preferências client também pelo jogador.

618. [ ] **calendarClockManualPause**

   **Fazer:** Usar pausa manual e retomar em outro cliente autorizado.

   **Esperado:** Estado mundial de pausa fica coerente entre clientes.

   **Perfil:** GM; preferências client também pelo jogador.

619. [ ] **utilityTranslationMigrationVersion**

   **Fazer:** Importar utilidades legadas em mundo de teste e carregar como GM com Bithir interno permitido.

   **Esperado:** Migração atual, versão 3, atualiza nomes/textos gerenciados e não se repete após marcada; não é toggle de usuário.

   **Perfil:** GM; preferências client também pelo jogador.


<a id="bloco-35"></a>

### 620–668 — Cada alimento pré-cadastrado

Fontes: [constants.mjs](../scripts/constants.mjs), [settings.mjs](../scripts/settings.mjs), [item-flags.mjs](../scripts/item-flags.mjs), [rations.mjs](../scripts/rations.mjs).

620. [ ] **Copo de Vesa**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

621. [ ] **Caneca de Caldo Negro zarekiano**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

622. [ ] **Assado lentamente com cenoura cozida**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

623. [ ] **Bife do rei em molho**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

624. [ ] **Fricassê de frango com nabos**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

625. [ ] **Javali assado com batatas**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

626. [ ] **Pulmão recheado com purê preto**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

627. [ ] **Salsicha roka com purê de beterraba**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

628. [ ] **Chá de carvalho ferro**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

629. [ ] **Chá de ervas**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

630. [ ] **Chá de especiarias**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

631. [ ] **Chá de frutas**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

632. [ ] **Chá defumado**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

633. [ ] **Carne com batata**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

634. [ ] **Ensopado de legumes**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

635. [ ] **Ensopado de repolho**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

636. [ ] **Ensopado misto**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

637. [ ] **Peixe e nabos**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

638. [ ] **Mingau de aveia com manteiga**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

639. [ ] **Mingau de creme picante**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

640. [ ] **Mingau regado**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

641. [ ] **Arenque salgado com nabos**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

642. [ ] **Molho de peixe e torrada**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

643. [ ] **Pudim de truta com nabos**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

644. [ ] **Zander com manteiga e purê**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

645. [ ] **Agulhas salgadas**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

646. [ ] **Biscoito com manteiga de trufas**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

647. [ ] **Bonequinhos de maçapão**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

648. [ ] **Canela assada com mel**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

649. [ ] **Confeito de nogado**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

650. [ ] **Gengibre cristalizado**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

651. [ ] **Marmelada**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

652. [ ] **Nozes em chocolate**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

653. [ ] **Pastel frito**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

654. [ ] **Pétalas de rosa revestidas de açúcar**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

655. [ ] **Pudim de frutas**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

656. [ ] **Sorvete de frutas**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

657. [ ] **Sorvete com frutas**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

658. [ ] **Torta de frutas**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

659. [ ] **Waffles com manteiga e mel**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

660. [ ] **Sopa de cebola com torrada**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

661. [ ] **Sopa de sangue com pão escuro**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

662. [ ] **Torta de carne**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

663. [ ] **Torta de cogumelos**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

664. [ ] **Torta de miúdos**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

665. [ ] **Torta de peixe**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

666. [ ] **Torta de repolho**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

667. [ ] **Torta de rim**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.

668. [ ] **Torta de truta**

   **Fazer:** Habilitar este alimento em Outros alimentos, adicionar uma cópia e consumir um uso.

   **Esperado:** É reconhecido pelo nome/alias previsto; usa o número de usos configurado e não afeta outro alimento.

   **Perfil:** GM e dono da ficha. **Opções:** `enableOtherRations`, `extraRationFoods`.


<a id="bloco-36"></a>

### 669–734 — Cada ritual do catálogo incorporado

Fontes: [ritual-browser.mjs](../scripts/ritual-browser.mjs).

669. [ ] **Servos Gêmeos / Twin Servants**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Apenas Piromante; marcado como restrito. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

670. [ ] **Cantiga da Natureza / Nature's Lullaby**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Bruxaria; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

671. [ ] **Círculo de Bruxa / Witch Circle**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Bruxaria; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

672. [ ] **Convocação / Summoning**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Bruxaria; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

673. [ ] **Crescimento Rápido / Quick Growth**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Bruxaria; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

674. [ ] **Emprestar Besta / Borrow Beast**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Bruxaria; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

675. [ ] **Familiar / Familiar**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Bruxaria; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

676. [ ] **Laço de Sangue / Blood Bond**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Bruxaria; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

677. [ ] **Leitura da Sorte / Fortune Telling**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Bruxaria; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

678. [ ] **Necromancia / Necromancy**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Bruxaria; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

679. [ ] **Sem Rastro / Traceless**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Bruxaria; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

680. [ ] **Sobrecarregado pelo Destino / Burdened by Fate**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Bruxaria; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

681. [ ] **Virar o Clima / Turn Weather**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Bruxaria; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

682. [ ] **Tormento / Torment**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Bruxaria, Feitiçaria; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

683. [ ] **Simpatia Sombria / Black Sympathy**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Bruxaria, Feitiçaria, Teurgia; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

684. [ ] **Recuperar / Retrieve**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Canto do Troll; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

685. [ ] **Restaurar / Restore**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Canto do Troll; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

686. [ ] **Rito de Selar/Abrir / Sealing/Opening Rite**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Canto do Troll; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

687. [ ] **Besta Companheira / Beast Companion**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Disponível apenas para Aves de Sangue; marcado como restrito. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

688. [ ] **Expiação / Atonement**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Disponível apenas para Confessores; marcado como restrito. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

689. [ ] **Convocar Daemon / Summon Daemon**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Disponível apenas para Demonologistas; marcado como restrito. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

690. [ ] **Servo Daemon / Servant Daemon**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Disponível apenas para Demonologistas; marcado como restrito. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

691. [ ] **Adivinhação da Morte / Death Divination**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Disponível apenas para Espiritualistas; marcado como restrito. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

692. [ ] **Fata Morgana / Fata Morgana**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Disponível apenas para Ilusionistas; marcado como restrito. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

693. [ ] **Olhar penetrante / Piercing Gaze**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Disponível apenas para Inquisidores; marcado como restrito. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

694. [ ] **Tempestade de Sangue / Blood Storm**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Disponível apenas para Magistas do Cajado; marcado como restrito. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

695. [ ] **Tremor / Quake**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Disponível apenas para Magistas do Cajado; marcado como restrito. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

696. [ ] **Túnel de Magia / Spell Tunnel**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Disponível apenas para Mentalistas; marcado como restrito. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

697. [ ] **Lorde da Morte / Death Lord**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Disponível apenas para Necromantes; marcado como restrito. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

698. [ ] **Fortaleza Viva / Living Fortress**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Disponível apenas para Tecelões Verdes; marcado como restrito. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

699. [ ] **Armadilha de Alma / Soul Trap**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Feitiçaria; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

700. [ ] **Erguer os Mortos / Raise Undead**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Feitiçaria; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

701. [ ] **Escravizar / Enslave**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Feitiçaria; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

702. [ ] **Filactério / Phylactery**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Feitiçaria; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

703. [ ] **Moldar Carne / Flesh Craft**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Feitiçaria; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

704. [ ] **Possessão / Possess**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Feitiçaria; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

705. [ ] **Rito de Profanação / Desecrating Rite**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Feitiçaria; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

706. [ ] **Trocar sombra / Exchange Shadow**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Feitiçaria; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

707. [ ] **Círculo Mágico / Magic Circle**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Magismo; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

708. [ ] **Clarividência / Clairvoyance**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Magismo; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

709. [ ] **Conto das Cinzas / Tale of Ashes**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Magismo; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

710. [ ] **Estender Vida / Life Extension**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Magismo; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

711. [ ] **Forma Falsa / False Shape**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Magismo; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

712. [ ] **Ilusão / Illusion**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Magismo; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

713. [ ] **Interrogatório Telepático / Telepathic Interrogation**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Magismo; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

714. [ ] **Paisagem encantadora / Bewitching Landscape**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Magismo; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

715. [ ] **Passo de sete léguas / Seven-League Stride**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Magismo; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

716. [ ] **Pedra da Alma / Soul Stone**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Magismo; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

717. [ ] **Quebrar Vínculo / Break Link**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Magismo; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

718. [ ] **Sacrário / Sanctum**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Magismo; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

719. [ ] **Servo Flamejante / Flaming Servant**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Magismo; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

720. [ ] **Terreno Falso / False Terrain**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Magismo; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

721. [ ] **Armadilha de Feitiços / Spell Trap**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Simbolismo; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

722. [ ] **Escrita distante / Faraway Writing**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Simbolismo; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

723. [ ] **Esculpir Tatuagem Rúnica / Carve Rune Tattoo**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Simbolismo; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

724. [ ] **Guardião Rúnico / Rune Guardian**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Simbolismo; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

725. [ ] **Comandar Confissão / Command Confession**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Teurgia; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

726. [ ] **Elos de Julgamento / Judging Bonds**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Teurgia; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

727. [ ] **Exorcismo / Exorcism**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Teurgia; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

728. [ ] **Fogo Purgante / Purging Fire**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Teurgia; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

729. [ ] **Fumaça Sagrada / Holy Smoke**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Teurgia; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

730. [ ] **Oráculo / Oracle**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Teurgia; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

731. [ ] **Rastro do Herege / Heretic's Trail**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Teurgia; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

732. [ ] **Rito de Santificação / Sanctifying Rite**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Teurgia; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

733. [ ] **Santo Patrono / Patron Saint**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Teurgia; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.

734. [ ] **Ungir / Anoint**

   **Fazer:** Abrir entrada no catálogo PT-BR e inglês; conferir tradição e abertura do documento oficial se instalado.

   **Esperado:** Tradição: Teurgia; sem marca de restrição exclusiva. Ausência de livro oficial não deve criar uma ficha oficial falsa.

   **Perfil:** GM e dono da ficha.


<a id="bloco-37"></a>

### 735–742 — Cada Item entregue pela Adventure

Fontes: [party-actor.mjs](../scripts/party-actor.mjs), [containers.mjs](../scripts/containers.mjs).

735. [ ] **Carroça**

   **Fazer:** Importar o Item, abrir descrição e arrastá-lo para ficha/seleção pertinente.

   **Esperado:** Documento de tipo equipment com referência cart é criado; dados e imagem permanecem acessíveis.

   **Perfil:** GM e dono da ficha.

736. [ ] **Vagão**

   **Fazer:** Importar o Item, abrir descrição e arrastá-lo para ficha/seleção pertinente.

   **Esperado:** Documento de tipo equipment com referência wagon é criado; dados e imagem permanecem acessíveis.

   **Perfil:** GM e dono da ficha.

737. [ ] **Trenó**

   **Fazer:** Importar o Item, abrir descrição e arrastá-lo para ficha/seleção pertinente.

   **Esperado:** Documento de tipo equipment com referência sleigh é criado; dados e imagem permanecem acessíveis.

   **Perfil:** GM e dono da ficha.

738. [ ] **Canoa**

   **Fazer:** Importar o Item, abrir descrição e arrastá-lo para ficha/seleção pertinente.

   **Esperado:** Documento de tipo equipment com referência canoe é criado; dados e imagem permanecem acessíveis.

   **Perfil:** GM e dono da ficha.

739. [ ] **Barco a remo**

   **Fazer:** Importar o Item, abrir descrição e arrastá-lo para ficha/seleção pertinente.

   **Esperado:** Documento de tipo equipment com referência rowingboat é criado; dados e imagem permanecem acessíveis.

   **Perfil:** GM e dono da ficha.

740. [ ] **Barco de rio**

   **Fazer:** Importar o Item, abrir descrição e arrastá-lo para ficha/seleção pertinente.

   **Esperado:** Documento de tipo equipment com referência riverboat é criado; dados e imagem permanecem acessíveis.

   **Perfil:** GM e dono da ficha.

741. [ ] **Navio / Galé**

   **Fazer:** Importar o Item, abrir descrição e arrastá-lo para ficha/seleção pertinente.

   **Esperado:** Documento de tipo equipment com referência galley é criado; dados e imagem permanecem acessíveis.

   **Perfil:** GM e dono da ficha.

742. [ ] **Mateiro**

   **Fazer:** Importar o Item, abrir descrição e arrastá-lo para ficha/seleção pertinente.

   **Esperado:** Documento de tipo boon com referência bushcraft é criado; dados e imagem permanecem acessíveis.

   **Perfil:** GM e dono da ficha.


<a id="bloco-38"></a>

### 743–746 — Cada animal entregue pela Adventure

Fontes: [party-actor.mjs](../scripts/party-actor.mjs), [travel-context.mjs](../scripts/travel-context.mjs).

743. [ ] **Mula**

   **Fazer:** Importar o Actor, abrir ficha e usá-lo como companheiro/animal de tração onde permitido.

   **Esperado:** Actor de tipo monster conserva itens internos, atributos, imagem e referências.

   **Perfil:** GM e dono da ficha.

744. [ ] **Burro**

   **Fazer:** Importar o Actor, abrir ficha e usá-lo como companheiro/animal de tração onde permitido.

   **Esperado:** Actor de tipo monster conserva itens internos, atributos, imagem e referências.

   **Perfil:** GM e dono da ficha.

745. [ ] **Boi**

   **Fazer:** Importar o Actor, abrir ficha e usá-lo como companheiro/animal de tração onde permitido.

   **Esperado:** Actor de tipo monster conserva itens internos, atributos, imagem e referências.

   **Perfil:** GM e dono da ficha.

746. [ ] **Cavalo**

   **Fazer:** Importar o Actor, abrir ficha e usá-lo como companheiro/animal de tração onde permitido.

   **Esperado:** Actor de tipo monster conserva itens internos, atributos, imagem e referências.

   **Perfil:** GM e dono da ficha.


<a id="bloco-39"></a>

### 747–759 — Cada preset de depósito e transporte do Grupo

Fontes: [party-actor.mjs](../scripts/party-actor.mjs).

747. [ ] **Carroça**

   **Fazer:** Escolher o preset no seletor de armazenamento e confirmar.

   **Esperado:** Categoria vehicle; capacidade sugerida 200 slots, editável pelo controle próprio quando autorizado.

   **Perfil:** GM e dono da ficha.

748. [ ] **Carruagem / Carreta**

   **Fazer:** Escolher o preset no seletor de armazenamento e confirmar.

   **Esperado:** Categoria vehicle; capacidade sugerida 500 slots, editável pelo controle próprio quando autorizado.

   **Perfil:** GM e dono da ficha.

749. [ ] **Canoa**

   **Fazer:** Escolher o preset no seletor de armazenamento e confirmar.

   **Esperado:** Categoria vehicle; capacidade sugerida 60 slots, editável pelo controle próprio quando autorizado.

   **Perfil:** GM e dono da ficha.

750. [ ] **Barco a Remo**

   **Fazer:** Escolher o preset no seletor de armazenamento e confirmar.

   **Esperado:** Categoria vehicle; capacidade sugerida 120 slots, editável pelo controle próprio quando autorizado.

   **Perfil:** GM e dono da ficha.

751. [ ] **Barco de Rio**

   **Fazer:** Escolher o preset no seletor de armazenamento e confirmar.

   **Esperado:** Categoria vehicle; capacidade sugerida 600 slots, editável pelo controle próprio quando autorizado.

   **Perfil:** GM e dono da ficha.

752. [ ] **Trenó**

   **Fazer:** Escolher o preset no seletor de armazenamento e confirmar.

   **Esperado:** Categoria vehicle; capacidade sugerida 150 slots, editável pelo controle próprio quando autorizado.

   **Perfil:** GM e dono da ficha.

753. [ ] **Mula de Carga**

   **Fazer:** Escolher o preset no seletor de armazenamento e confirmar.

   **Esperado:** Categoria animal; capacidade sugerida 80 slots, editável pelo controle próprio quando autorizado.

   **Perfil:** GM e dono da ficha.

754. [ ] **Cavalo de Carga**

   **Fazer:** Escolher o preset no seletor de armazenamento e confirmar.

   **Esperado:** Categoria animal; capacidade sugerida 80 slots, editável pelo controle próprio quando autorizado.

   **Perfil:** GM e dono da ficha.

755. [ ] **Boi de Tração**

   **Fazer:** Escolher o preset no seletor de armazenamento e confirmar.

   **Esperado:** Categoria animal; capacidade sugerida 100 slots, editável pelo controle próprio quando autorizado.

   **Perfil:** GM e dono da ficha.

756. [ ] **Baú Grande**

   **Fazer:** Escolher o preset no seletor de armazenamento e confirmar.

   **Esperado:** Categoria container; capacidade sugerida 30 slots, editável pelo controle próprio quando autorizado.

   **Perfil:** GM e dono da ficha.

757. [ ] **Barril**

   **Fazer:** Escolher o preset no seletor de armazenamento e confirmar.

   **Esperado:** Categoria container; capacidade sugerida 25 slots, editável pelo controle próprio quando autorizado.

   **Perfil:** GM e dono da ficha.

758. [ ] **Baú de Viagem**

   **Fazer:** Escolher o preset no seletor de armazenamento e confirmar.

   **Esperado:** Categoria container; capacidade sugerida 20 slots, editável pelo controle próprio quando autorizado.

   **Perfil:** GM e dono da ficha.

759. [ ] **Saco Grande**

   **Fazer:** Escolher o preset no seletor de armazenamento e confirmar.

   **Esperado:** Categoria container; capacidade sugerida 10 slots, editável pelo controle próprio quando autorizado.

   **Perfil:** GM e dono da ficha.


<a id="bloco-40"></a>

### 760–786 — Cada tabela entregue pela Adventure

Fontes: [bithir-macros.mjs](../scripts/bithir-macros.mjs), [expedition-data.mjs](../scripts/expedition-data.mjs).

760. [ ] **corrupt-adjective**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 48 resultados e fórmula 1d48; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

761. [ ] **corrupt-armor**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 4 resultados e fórmula 1d2; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

762. [ ] **corrupt-armor-name**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 9 resultados e fórmula 1d9; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

763. [ ] **corrupt-weapon**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 4 resultados e fórmula 1d2; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

764. [ ] **corrupt-weapon-name**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 10 resultados e fórmula 1d10; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

765. [ ] **civilised-accurate-vigilant**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 7 resultados e fórmula 1d7; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

766. [ ] **civilised-base**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 24 resultados e fórmula 1d24; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

767. [ ] **civilised-cunning-resolute**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 6 resultados e fórmula 1d10; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

768. [ ] **civilised-discreet-persuasive**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 8 resultados e fórmula 1d8; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

769. [ ] **civilised-metallic-adjectives**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 18 resultados e fórmula 1d18; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

770. [ ] **civilised-quick-strong**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 11 resultados e fórmula 1d10; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

771. [ ] **civilised-with**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 9 resultados e fórmula 1d9; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

772. [ ] **corrupt-base**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 18 resultados e fórmula 1d18; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

773. [ ] **corrupt-color**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 9 resultados e fórmula 1d9; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

774. [ ] **corrupt-color-adjective**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 12 resultados e fórmula 1d12; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

775. [ ] **natural-accurate-vigilant**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 23 resultados e fórmula 1d22; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

776. [ ] **natural-adjectives**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 13 resultados e fórmula 1d13; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

777. [ ] **natural-base**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 19 resultados e fórmula 1d19; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

778. [ ] **natural-cunning-resolute**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 21 resultados e fórmula 1d21; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

779. [ ] **natural-discreet-persuasive**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 13 resultados e fórmula 1d13; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

780. [ ] **natural-quick-strong**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 18 resultados e fórmula 1d18; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

781. [ ] **Eventos na Floresta**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 5 resultados e fórmula 1d20; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

782. [ ] **Eventos na Floresta - Horror**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 50 resultados e fórmula 1d50; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

783. [ ] **Eventos na Floresta - Mundano**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 50 resultados e fórmula 1d50; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

784. [ ] **Eventos na Floresta - M?stico / Inspirador**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 50 resultados e fórmula 1d50; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

785. [ ] **Eventos na Floresta - Na trilha**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 20 resultados e fórmula 1d20; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

786. [ ] **Tabela 25 - Infortúnios na Davokar**

   **Fazer:** Importar, abrir e conferir faixas/resultados; executar pela macro/fluxo que a usa.

   **Esperado:** A tabela contém 30 resultados e fórmula 1d20; em Infortúnios a expedição acrescenta modificador regional. Conferir também os pontos de atenção do relatório.

   **Perfil:** GM e dono da ficha.

## Alcance e evidência

- Os compêndios foram copiados para uma pasta temporária e lidos sem abrir os bancos originais. A Adventure contém **5 macros, 27 tabelas, 8 Items e 4 Actors**; outro pack contém a Tabela 25 e seus 30 resultados.
- O catálogo possui **66 rituais** e o preset de alimentos **49 alimentos extras**. Cada entrada recebeu caso próprio; isso não significa que todos os livros oficiais estejam instalados no mundo.
- O importador experimental tem **15 entradas / 45 páginas** da fonte `symbaroumlore` e **21 entradas / 39 páginas** da fonte `tenebre-chronicle`. Páginas individuais são conteúdo, não uma automação por parágrafo. A validação de importação usa os casos do bloco de diários.
- As referências do código em andamento e os resultados esperados locais não foram enviados para a release 0.19.3.
- **Nenhum dos casos manuais deste documento foi marcado como aprovado.** Testes automatizados não substituem sessões reais de GM/jogador. O uso de v14, integrações opcionais, desempenho e conteúdo oficial exige o ambiente correspondente.
- A evidência automatizada executada nesta auditoria fica em [inventário técnico](INVENTARIO-CODIGO-IND-2026-11-09.md#validacao).
