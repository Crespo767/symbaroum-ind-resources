# Integracao do Tenebre Chronicle

## Objetivo

Planejar a migracao do projeto local **Tenebre Chronicle** para conteudo nativo e editavel dentro do mundo Foundry, eliminando a necessidade operacional de acessar o site externo durante a mesa.

## Estado atual do projeto

O Tenebre Chronicle e uma aplicacao React 19/TanStack com backend Vercel/Supabase. Possui paginas publicas e painel administrativo para editar conteudo da campanha.

Modelo principal identificado:

```ts
CampaignContent {
  sessions: Session[];
  characters: Character[];
  npcs: Npc[];
  archive: ArchiveItem[];
  masterNotes: MasterNote[];
}
```

O projeto possui dados locais de fallback e persistencia remota. As operacoes administrativas incluem criacao, edicao, exclusao, upload de imagens, enquadramento de retratos e ordenacao.

## Mapeamento de dominio

### Sessoes

Campos encontrados incluem numero, titulo, data, presentes, resumo, eventos, NPCs, locais, consequencias, ganchos e notas do mestre.

Destino recomendado:

- um `JournalEntry` publico por sessao;
- paginas para resumo, eventos, participantes, locais, NPCs, consequencias e ganchos publicos;
- um `JournalEntry` separado e restrito para preparacao e notas secretas;
- flags ligando os dois registros pelo mesmo `sourceId`.

Separar publico e secreto evita vazamento por ownership ou por exibicao acidental de pagina.

### Personagens

Campos narrativos incluem nome, papel, povo, sombra, citacao, jogador, status, aparencia, objetivo, historia e companheiros.

Destino recomendado:

- localizar o Actor correspondente;
- criar um dossie narrativo em Journal;
- guardar o UUID do Actor nas flags do Journal e o UUID do Journal em flag namespaced do Actor;
- conceder `OWNER` ao jogador responsavel e `OBSERVER` aos demais, conforme decisao do GM.

Nao copiar atributos mecanicos para o Journal.

### NPCs

Campos incluem nome, papel, local, relacao, status, resumo, imagem e companheiros.

Destino recomendado:

- dossie publico ou secreto conforme classificacao;
- link UUID para Actor existente quando houver;
- segredo de GM em entrada separada;
- ownership definido por NPC, nao por uma regra global implicita.

### Arquivo

Itens possuem titulo, tipo, estado de descoberta, descricao e link opcional.

Destino recomendado:

- pasta `Arquivo da Campanha`;
- uma entrada por documento importante ou uma entrada por categoria com paginas;
- itens nao descobertos permanecem ocultos;
- ao serem descobertos, o GM altera ownership ou usa uma acao explicita de revelacao.

### Notas do mestre

O nome tecnico sugere segredo, mas a interface descreve parte dessas notas como avisos publicos e a migracao do Supabase permite leitura publica.

Antes de importar, cada nota deve receber classificacao explicita:

| Classificacao | Destino |
| --- | --- |
| `public-announcement` | Journal publico ou aviso |
| `shared-note` | Journal editavel pelo grupo |
| `gm-secret` | Pasta exclusiva do GM |
| `player-private` | Journal do jogador e GM |

Nenhuma nota deve ser classificada apenas pelo nome da tabela.

## Arquitetura de autoridade

Se o objetivo e abandonar o site durante o jogo, o Foundry deve se tornar a fonte de verdade apos a migracao.

Fluxo recomendado:

1. exportar snapshot consistente do Supabase ou do fallback local;
2. validar e normalizar para um manifesto intermediario;
3. importar uma unica vez para Documents nativos;
4. editar pelo Foundry dali em diante;
5. manter o snapshot e um relatorio como rollback.

Sincronizacao bidirecional com Supabase nao deve fazer parte da primeira implementacao. Ela exigiria resolucao de conflitos, autenticacao, auditoria, tratamento offline e protecao contra sobrescrita.

## Organizacao recomendada

```text
Cronica Tenebre
|-- Sessoes
|   |-- Publicadas
|   `-- Preparacao do Mestre
|-- Personagens
|-- NPCs
|   |-- Conhecidos
|   `-- Segredos do Mestre
|-- Locais
|-- Arquivo da Campanha
|-- Notas Compartilhadas
|-- Diarios Pessoais
`-- Notas do Mestre
```

## Edicao dentro do Foundry

O editor e as sheets nativas atendem o CRUD principal. O modulo pode adicionar posteriormente um dashboard de cronica para facilitar navegacao, mas o dashboard deve consultar e abrir Documents, nunca armazenar uma segunda copia dos dados.

Fluxos esperados:

- GM cria e edita qualquer entrada;
- jogadores editam somente entradas em que sao `OWNER`;
- jogadores leem entradas `OBSERVER`;
- links entre sessao, personagem, NPC, local, Item e Actor usam UUID;
- imagens ficam em armazenamento estavel do Foundry;
- busca e pastas continuam nativas.

## Imagens e enquadramento

O projeto possui coordenadas e escala de enquadramento de retratos. O Journal nativo nao reproduz automaticamente esse editor.

Na primeira fase:

- importar a imagem original;
- preservar os valores de enquadramento em flags para futura UI;
- nao alterar o arquivo original destrutivamente;
- usar a imagem como pagina ou retrato do Actor quando apropriado.

Uma ferramenta de recorte pode ser fase separada, nao requisito da migracao.

## Atualizacao e conflitos

Cada registro deve usar o `slug` atual como `sourceId`, apos validacao de unicidade. O hash da origem permite detectar mudancas.

Politica da primeira importacao:

- criar se nao existir;
- atualizar apenas durante a migracao confirmada;
- nao excluir automaticamente Documents locais ausentes na origem;
- relatar duplicatas e conflitos;
- nao sobrescrever edicoes feitas no Foundry em importacoes posteriores sem confirmacao.

## Seguranca

- Credenciais Supabase nunca entram em codigo cliente do modulo.
- O importador deve aceitar somente um snapshot exportado ou uma chamada autenticada executada fora do cliente comum.
- HTML deve ser sanitizado.
- Operacoes globais devem ter um unico GM executor.
- Exclusoes em massa exigem confirmacao e backup.
- A API de socket do modulo nao deve aceitar payload arbitrario para criar ou editar Journals.

## Criterios de aceite

- todas as colecoes de campanha possuem contagem conciliada com a origem;
- publico, compartilhado e secreto estao classificados;
- nenhuma nota secreta e visivel para jogador sem permissao;
- personagens e NPCs sao ligados a Actors sem duplicar regras;
- imagens e links permanecem validos apos reload;
- GM e jogador conseguem editar somente o que lhes pertence;
- importacao repetida nao duplica registros;
- rollback restaura o estado anterior;
- testes runtime cobrem v13 e v14.

