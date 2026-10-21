# Jornada e permanência: controle manual

O bloco de Jornada e permanência foi retirado da aba Expedição a pedido do usuário. Também foram removidos o diálogo de configuração, os testes de esforço, detecção e permanência, a aplicação de dano de marcha e os respectivos endpoints de socket e API.

Orientação, alimentação e as quatro tabelas de eventos diários continuam disponíveis ao mestre. A busca ativa é controlada exclusivamente pelo botão do passo 3; configurações antigas de ritmo ou permanência não bloqueiam orientação, não suprimem eventos e não adicionam modificadores de rio. Ajustes ligados a jornada e permanência passam a ser controlados manualmente pelo mestre.

O descanso deixa de consultar esforço ou recibos de jornada; suas configurações próprias e as regras de fome continuam valendo. A régua de viagem permanece disponível com configuração própria por token, sem ler ou alterar a antiga configuração da expedição.

Os dados históricos de configuração, resultados privados e recibos permanecem nos mundos existentes, sem produzir novas automações. Danos já aplicados não são revertidos. Não há migração destrutiva nem alteração de permissões dos compêndios.

Foram substituídos os testes específicos das automações retiradas por regressões que verificam ausência dos controles e endpoints, independência da régua, recuperação de vitalidade e ausência de efeitos das flags antigas sobre orientação, busca e eventos. As verificações restantes de regras, permissões e privacidade foram preservadas.

Pendente de teste manual no Foundry v13/v14: reabrir a ficha como GM e jogador, conferir os três passos restantes, rolar orientação e eventos nos modos público/privado/cego/direcionado, descansar e configurar a régua pelo HUD de um token. A aba Expedição continua exclusiva do mestre. Recarregar o Foundry é necessário para descarregar o código anterior.
