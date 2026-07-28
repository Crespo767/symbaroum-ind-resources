# Contribuindo

Obrigado por ajudar o Symbaroum Ind Resources.

## Ambiente

- Node.js 22 ou superior para as validacoes locais.
- Foundry VTT v13.350 com Symbaroum 6.1.6 para o baseline de runtime.
- Uma instalacao separada para validar Foundry v14 quando houver uma versao
  compativel do sistema.

Clone o repositorio e execute:

```powershell
npm run validate
```

O comando verifica a sintaxe e executa todos os testes. Pull requests tambem
passam pelo mesmo fluxo no GitHub Actions.

## Regras para alteracoes

- Preserve dados de mundos existentes e use as APIs publicas de Documents.
- Mantenha compatibilidade com Foundry v13 e v14; isole diferencas em adapters.
- Nao edite diretamente arquivos LevelDB em `packs/`.
- Feche o Foundry antes de copiar ou empacotar o compendio.
- Nao inclua `LOCK`, `LOG`, `LOG.old`, `.log`, `lost/`, caches ou arquivos
  pessoais.
- Localize todo texto visivel em `languages/pt-BR.json` e
  `languages/en.json`.
- Adicione um teste de regressao para logica que possa ser exercitada fora do
  Foundry.
- Nao inclua texto, imagem ou audio sem autoria, licenca e atribuicao
  confirmadas.

## Relatos

Use Issues para defeitos que possam ser publicados. Vulnerabilidades devem
seguir [SECURITY.md](SECURITY.md) e nao devem ser divulgadas em uma issue
aberta.

Inclua versoes do Foundry, Symbaroum, modulo e dependencias, papel do usuario,
configuracoes relevantes, passos de reproducao e logs sem dados pessoais.

## Antes do pull request

1. Rode `npm run validate`.
2. Teste o fluxo afetado como GM e jogador.
3. Teste a configuracao ligada e desligada.
4. Confirme que o comportamento Original e Ind Resources do chat continua
   correto quando a alteracao tocar mensagens.
5. Liste qualquer teste manual que nao foi possivel executar.
