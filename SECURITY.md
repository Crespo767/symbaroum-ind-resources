# Política de segurança

## Versões suportadas

Correções de segurança são aplicadas à versão mais recente publicada do
Symbaroum Ind Resources. O manifesto atual usa Foundry VTT v13 como baseline e
o módulo mantém fallbacks técnicos para v14; a compatibilidade completa depende
também de uma versão do sistema Symbaroum compatível com a geração utilizada.

## Como relatar uma vulnerabilidade

Não publique detalhes exploráveis em uma issue aberta. Use **Report a
vulnerability** na aba Security do repositório quando o envio privado estiver
habilitado. Se a opção não estiver disponível, envie um aviso privado aos
mantenedores pelos contatos Discord declarados no `module.json`. Inclua:

- versão do Foundry, do sistema Symbaroum e do módulo;
- papel do usuário afetado (GM, jogador confiável ou jogador);
- configuração necessária para reproduzir;
- passos mínimos e impacto observado;
- logs sem tokens, senhas, chaves ou dados pessoais.

Os mantenedores confirmarão o recebimento, avaliarão o impacto e coordenarão a
correção antes da divulgação pública.

## Limites de confiança

- Mensagens recebidas por socket são tratadas como não confiáveis.
- Operações privilegiadas exigem um GM ativo e validam usuário, ownership,
  tipo de documento, campos permitidos, tamanho e quantidade do payload.
- O módulo não solicita credenciais, não transmite telemetria e não acessa
  serviços externos durante o jogo.
- Conteúdo de nomes e descrições inserido em HTML pelo módulo deve ser escapado
  ou sanitizado antes da renderização.
