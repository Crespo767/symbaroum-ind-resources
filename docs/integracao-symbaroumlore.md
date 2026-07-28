# Integracao do Symbaroumlore

## Objetivo

Planejar a conversao do projeto local **Symbaroumlore** em um compendio nativo de conhecimento para Foundry VTT, sem depender do site externo para leitura.

Este documento nao autoriza redistribuicao do conteudo. Direitos sobre textos e imagens devem ser verificados antes de incluir o material em um release publico.

## Estado atual do projeto

O Symbaroumlore e uma aplicacao React 19/Vite com conteudo editorial embutido principalmente em arrays TypeScript/JSX. Nao existe banco editorial independente nem interface persistente de autoria.

Secoes publicadas na pagina principal:

- Historia;
- Davokar;
- Locais;
- Faccoes;
- Crencas;
- Racas;
- Atributos.

Secoes presentes no codigo, mas desativadas ou nao expostas na navegacao atual:

- Corrupcao;
- Sistema;
- Habilidades;
- Poderes;
- Equipamentos;
- Criacao de personagem;
- Galeria;
- Criaturas e outros componentes auxiliares.

O projeto possui dezenas de imagens locais e pelo menos uma dependencia de imagem remota. O estado de navegacao e apenas local ao navegador e nao representa conteudo editavel.

## Estrategia de representacao

O Symbaroumlore deve ser uma fonte editorial versionada. A representacao recomendada e um pack de `JournalEntry`, distribuido bloqueado, com opcao explicita de importar copias editaveis para o mundo.

### Mapeamento

| Origem | Destino Foundry | Observacao |
| --- | --- | --- |
| Historia/linha do tempo | JournalEntry com paginas cronologicas | Uma pagina por periodo ou evento maior |
| Davokar | JournalEntry tematico | Subpaginas por regiao, ameaca ou tema |
| Locais | JournalEntry por local | Pode ser ligado a Scene e map notes |
| Faccoes | JournalEntry por faccao | Links para NPCs, locais e eventos |
| Crencas | JournalEntry por tradicao ou divindade | Links para rituais/itens existentes |
| Racas | JournalEntry por raca | Evitar duplicar regras mecanicas em Actor/Item |
| Regras gerais | JournalEntry de referencia | Somente conteudo autorizado |
| Galeria | Paginas `image` | Imagens locais e creditadas |
| Mapa | Scene ou pagina `image` com pins | Nao reproduzir interatividade React em HTML de Journal |
| Calculadora de atributos | Application propria futura | Nao e conteudo de Journal |
| Poderes, rituais e itens | Links UUID para compendios existentes | Evitar duplicar Documents mecanicos |
| Criaturas | Links para Actor compendia | Lore pode ficar em pagina separada |

## Extracao de conteudo

Nao raspar o HTML renderizado. O importador deve ler estruturas de dados conhecidas dos componentes e gerar um manifesto intermediario normalizado.

Formato sugerido:

```json
{
  "schema": 1,
  "source": "symbaroumlore",
  "entries": [
    {
      "sourceId": "factions-ordamagi",
      "kind": "faction",
      "name": "Ordo Magica",
      "visibility": "public",
      "pages": []
    }
  ]
}
```

O manifesto intermediario permite:

- validar nomes e IDs antes de escrever no mundo;
- detectar imagens ausentes;
- gerar relatorio de conteudo ignorado;
- comparar versoes por hash;
- testar a conversao sem depender do Foundry.

## Organizacao recomendada

```text
Conhecimento de Symbaroum
|-- Historia
|-- Davokar
|-- Locais
|-- Faccoes
|-- Crencas
|-- Povos e Racas
|-- Regras de Referencia
`-- Galeria e Mapas
```

As entradas do pack devem ser somente leitura. Quando um GM quiser personalizar o texto, o modulo deve importar uma copia para uma pasta de mundo, mantendo nas flags a origem da copia.

## Links e relacionamentos

Durante a importacao:

1. criar ou localizar todos os Documents de destino;
2. construir um indice `sourceId -> UUID`;
3. resolver links internos em uma segunda passagem;
4. preferir links para Actor/Item oficiais quando o conteudo mecanico ja existir;
5. relatar links nao resolvidos sem quebrar a importacao inteira.

## Midia

- Copiar somente assets autorizados.
- Usar caminhos estaveis e relativos ao modulo ou ao mundo.
- Nao depender de CloudFront ou outro host externo para conteudo essencial.
- Preservar creditos e origem no manifesto.
- Validar dimensoes e tamanho antes de empacotar.
- Nao embutir base64 em flags ou paginas.

## Atualizacao

O pack e a fonte oficial. Atualizacoes devem comparar `sourceId` e `sourceHash`.

Para copias editadas no mundo, nunca sobrescrever silenciosamente. Opcoes futuras seguras:

- manter a copia local intacta e informar que existe nova versao;
- mostrar diff textual antes de atualizar;
- criar uma nova copia versionada;
- atualizar apenas Documents sem alteracao local comprovada.

## Permissoes

O lore geral pode ser `OBSERVER` para todos. Materiais marcados como spoiler ou exclusivos de GM devem estar em entradas separadas e permanecer `NONE` para jogadores.

Nao publicar conteudo secreto no mesmo Journal apenas dentro de um bloco visualmente recolhido.

## Conteudo interativo

Elementos React nao devem ser inseridos diretamente em paginas de Journal.

Tratamento recomendado:

- mapa navegavel: Scene e map notes;
- calculadora: ApplicationV2 propria em fase posterior;
- filtros e indice: dashboard opcional que consulta os Journals;
- fichas mecanicas: Actor/Item Documents;
- conteudo narrativo: JournalEntry/JournalEntryPage.

## Riscos

1. **Direitos autorais:** textos e imagens podem nao poder ser redistribuidos no release publico.
2. **Conteudo duplicado:** habilidades, poderes, itens e criaturas podem divergir dos compendios oficiais.
3. **IDs instaveis:** arrays JSX nao possuem necessariamente identificadores editoriais permanentes.
4. **Links externos:** imagens remotas podem desaparecer ou expor acessos.
5. **Secoes desativadas:** estar no codigo nao significa estar aprovada para publicacao.

## Criterios de aceite

- todo item importado possui `sourceId` unico;
- nenhum HTML executavel e importado;
- nenhum asset essencial depende de URL temporaria;
- links internos e UUIDs sao validados;
- pack abre em v13 e v14;
- conteudo de GM nao aparece para jogadores;
- uma segunda importacao nao duplica Documents;
- relatorio lista entradas criadas, atualizadas, ignoradas e com erro;
- distribuicao foi autorizada antes do empacotamento.

