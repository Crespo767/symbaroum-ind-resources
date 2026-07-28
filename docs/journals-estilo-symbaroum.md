# Padrao visual dos Journals de Symbaroum

Este documento registra o contrato visual usado pelos Journals nativos do
sistema Symbaroum e pelo modulo Symbaroum Core Rulebook. A referencia analisada
foi:

- sistema `symbaroum` 6.1.6;
- modulo `symbaroum-corerules` 2.2.0;
- Foundry VTT v13.

O objetivo e permitir que conteudo proprio use a mesma linguagem visual sem
copiar os arquivos protegidos do livro ou depender do HTML interno de um
Journal especifico.

## 1. A sheet e a moldura

O sistema registra a sheet de Journal
`symbaroum.SymbaroumWide`. Um Journal seleciona essa sheet pelo campo:

```json
{
  "flags": {
    "core": {
      "sheetClass": "symbaroum.SymbaroumWide"
    }
  }
}
```

A sheet tem largura de 1268 px e adiciona a classe CSS `symbaroum-mod` a janela.
O CSS do sistema usa essa classe para aplicar:

- moldura externa com `sym-journal-border.webp`;
- fundo de pergaminho com `foreground2a.png`;
- barra e cabecalho escuros com `foreground.jpg`;
- titulo central em cor clara;
- barra de rolagem em cinza.

Esses recursos pertencem ao sistema e sao carregados por ele. O modulo nao deve
duplicar as imagens nem as fontes.

## 2. Fontes

O sistema declara tres familias principais:

| Fonte | Uso |
| --- | --- |
| `Primitive` | titulo do Journal, titulo principal e secoes grandes |
| `Fondamento` | subtitulos, chamadas e links editoriais |
| `Jim Nightshade` | texto de abertura e variacoes manuscritas |
| `BarloesiusSchrift` | capitulares e cartas |

`Primitive` e `BarloesiusSchrift` sao distribuidas localmente pelo sistema.
`Fondamento` e `Jim Nightshade` sao declaradas pelo CSS do sistema.

## 3. Estrutura minima do conteudo

O conteudo de cada pagina deve ficar dentro de um elemento com
`class="symbaroum-mod"`. Isso preserva o estilo mesmo quando a pagina e
renderizada fora do fluxo principal da sheet.

```html
<div class="symbaroum-mod tenebre-journal-page">
  <h2 class="h1mod">Titulo da pagina</h2>
  <h2 class="heading2">Secao</h2>
  <p class="pblock">Texto corrido da secao.</p>
</div>
```

O importador do Tenebre aplica essa estrutura automaticamente.

## 4. Hierarquia editorial

| Elemento | Classe recomendada | Resultado |
| --- | --- | --- |
| titulo principal | `h1mod` em um `h2` | `Primitive`, 68 pt |
| titulo de secao | `heading2` em um `h2` | `Primitive`, 25 pt, filete vinho |
| subtitulo curto | `h3` | `Fondamento`, vinho, negrito |
| texto corrido | `pblock` em um `p` | 12 pt, justificado |
| chamada inicial | `parahead` | `Fondamento`, vinho, negrito |
| capitular | `subhead` no paragrafo | primeira letra ornamental |

O estilo nativo usa letras maiusculas em chamadas curtas, mas preserva caixa
normal no corpo. Paragrafos longos ficam justificados e com margens laterais
discretas.

## 5. Caixas e dados estruturados

As classes nativas mais uteis para conteudo proprio sao:

| Classe | Uso |
| --- | --- |
| `statblockcenter` | bloco de dados com fundo cinza claro |
| `blockquoteright` | caixa de destaque flutuante a direita |
| `blockquoteleft` | caixa de destaque flutuante a esquerda |
| `blockquotecenter` | caixa larga de destaque |
| `boxtext` | texto em pergaminho com borda dupla |
| `fancytext` | citacao em vinho |
| `fancyheader` | ornamento horizontal de citacao |
| `lettertext` | carta ou documento com fonte ornamental |

Caixas flutuantes devem ser usadas com moderacao. Em paginas curtas ou estreitas,
`statblockcenter` e mais previsivel e evita colisao com o texto.

## 6. Imagens

Imagens de conteudo devem usar os assets do proprio modulo e caminhos Foundry,
por exemplo:

```html
<img src="modules/symbaroum-ind-resources/assets/imported/exemplo.webp"
     alt="Descricao objetiva da imagem">
```

Assets editoriais do sistema podem ser referenciados pelo CSS carregado pelo
proprio sistema, mas nao devem ser copiados para este modulo. Imagens do Core
Rulebook nao devem ser reutilizadas fora do conteudo licenciado que as fornece.

## 7. Navegacao e pastas

O Journal nativo usa uma entrada com varias paginas. A barra lateral e gerada
pelo Foundry a partir do nome e da ordenacao das paginas; nao deve ser recriada
em HTML.

A hierarquia adotada para este modulo e:

```text
Tenebre Journals
|-- Conhecimento de Symbaroum
|   |-- Historia
|   |-- Davokar
|   |-- Locais
|   |-- Faccoes
|   |-- Crencas
|   |-- Povos e Racas
|   |-- Criaturas
|   |-- Regras de Referencia
|   `-- Galeria e Mapas
`-- Cronica Tenebre
    |-- Sessoes
    |-- Personagens
    |-- NPCs
    |-- Arquivo da Campanha
    `-- Notas Compartilhadas
```

As antigas pastas intermediarias `Symbaroumlore` e `Tenebre Chronicle` nao fazem
parte do modelo final. A limpeza automatizada so remove essas arvores quando
nao existe nenhum Journal dentro delas.

## 8. Compatibilidade

O contrato acima foi confirmado no runtime e nos arquivos locais da v13. O
sistema 6.1.6 declara v13 como versao maxima e implementa a sheet com a API
legada de aplicacoes. Para v14, o conteudo HTML e as classes permanecem
reutilizaveis, mas a disponibilidade de `symbaroum.SymbaroumWide` deve ser
revalidada quando houver uma versao do sistema oficialmente compativel com v14.
