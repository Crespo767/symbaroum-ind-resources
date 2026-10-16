const { ClassicLevel } = require('classic-level');
const fs = require('fs');
const path = require('path');

function makeId(prefix, num) {
  const pad = '0'.repeat(16 - prefix.length - String(num).length);
  const id = `${prefix}${pad}${num}`;
  if (id.length !== 16 || !/^[a-zA-Z0-9]{16}$/.test(id)) {
    throw new Error(`Invalid ID "${id}" generated with prefix "${prefix}" (length: ${id.length})`);
  }
  return id;
}

function validateDocumentId(id, label) {
  if (typeof id !== 'string' || id.length !== 16 || !/^[a-zA-Z0-9]{16}$/.test(id)) {
    throw new Error(`Validation failed: ${label} ID "${id}" must be a 16-character alphanumeric string (length: ${id?.length})`);
  }
  return id;
}

function createItem({ id, name, img, description, reference, cost, folder }) {
  validateDocumentId(id, `Item ${name}`);
  return {
    _id: id,
    name,
    type: 'equipment',
    img,
    folder: folder || null,
    sort: 0,
    effects: [],
    flags: {
      core: {}
    },
    system: {
      bonus: {
        defense: 0,
        accurate: 0,
        cunning: 0,
        discreet: 0,
        persuasive: 0,
        quick: 0,
        resolute: 0,
        strong: 0,
        vigilant: 0,
        toughness: { max: 0, threshold: 0 },
        corruption: { max: 0, threshold: 0 },
        experience: { value: 0, cost: 0 }
      },
      isArtifact: null,
      power: {},
      description,
      reference,
      cost,
      number: 1,
      state: 'other'
    },
    ownership: {
      default: 0
    },
    _stats: {
      systemId: 'symbaroum',
      systemVersion: '6.1.6',
      coreVersion: '13.350',
      createdTime: Date.now(),
      modifiedTime: Date.now(),
      lastModifiedBy: null,
      compendiumSource: null,
      duplicateSource: null,
      exportSource: null
    }
  };
}

function createBoon({ id, name, img, description, reference = 'bushcraft', level = 1, folder }) {
  validateDocumentId(id, `Boon ${name}`);
  return {
    _id: id,
    name,
    type: 'boon',
    img: img || 'icons/environment/wilderness/tree-ash.webp',
    folder: folder || null,
    sort: 0,
    effects: [],
    flags: { core: {} },
    system: {
      bonus: {
        defense: 0,
        accurate: 0,
        cunning: 0,
        discreet: 0,
        persuasive: 0,
        quick: 0,
        resolute: 0,
        strong: 0,
        vigilant: 0,
        toughness: { max: 0, threshold: 0 },
        corruption: { max: 0, threshold: 0 },
        experience: { value: 0, cost: 0 }
      },
      description,
      reference,
      level: Number(level) || 1
    },
    ownership: { default: 0 },
    _stats: {
      systemId: 'symbaroum',
      systemVersion: '6.1.6',
      coreVersion: '13.350',
      createdTime: Date.now(),
      modifiedTime: Date.now(),
      lastModifiedBy: null,
      compendiumSource: null,
      duplicateSource: null,
      exportSource: null
    }
  };
}

function createTrait({ id, name, img, description, reference, noviceDesc, adeptDesc, masterDesc, noviceActive = true, adeptActive = false, masterActive = false }) {
  validateDocumentId(id, `Trait ${name}`);
  return {
    _id: id,
    name,
    type: 'trait',
    img: img || 'systems/symbaroum/asset/image/trait.png',
    effects: [],
    flags: { core: {} },
    system: {
      bonus: {
        defense: 0,
        accurate: 0,
        cunning: 0,
        discreet: 0,
        persuasive: 0,
        quick: 0,
        resolute: 0,
        strong: 0,
        vigilant: 0,
        toughness: { max: 0, threshold: 0 },
        corruption: { max: 0, threshold: 0 },
        experience: { value: 0, cost: 0 }
      },
      description,
      reference,
      novice: {
        isActive: noviceActive,
        action: 'P',
        description: noviceDesc || ''
      },
      adept: {
        isActive: adeptActive,
        action: 'P',
        description: adeptDesc || ''
      },
      master: {
        isActive: masterActive,
        action: 'P',
        description: masterDesc || ''
      },
      marker: false
    },
    ownership: { default: 0 },
    _stats: {
      systemId: 'symbaroum',
      systemVersion: '6.1.6',
      coreVersion: '13.350',
      createdTime: Date.now(),
      modifiedTime: Date.now(),
      lastModifiedBy: null,
      compendiumSource: null,
      duplicateSource: null,
      exportSource: null
    }
  };
}

function createWeapon({ id, name, img, damage, quality, attribute = 'accurate' }) {
  validateDocumentId(id, `Weapon ${name}`);
  return {
    _id: id,
    name,
    type: 'weapon',
    img: img || 'icons/weapons/melee/claws-bear.webp',
    effects: [],
    flags: { core: {} },
    system: {
      bonus: {
        defense: 0,
        accurate: 0,
        cunning: 0,
        discreet: 0,
        persuasive: 0,
        quick: 0,
        resolute: 0,
        strong: 0,
        vigilant: 0,
        toughness: { max: 0, threshold: 0 },
        corruption: { max: 0, threshold: 0 },
        experience: { value: 0, cost: 0 }
      },
      isArtifact: null,
      power: {},
      description: '',
      reference: 'unarmed',
      baseDamage: damage,
      bonusDamage: '',
      alternativeDamage: 'none',
      qualities: {
        bastard: false,
        returning: false,
        blunt: false,
        short: false,
        unwieldy: false,
        wrecking: quality === 'wrecking' || quality === 'devastador',
        concealed: false,
        balanced: false,
        deepImpact: false,
        jointed: false,
        ensnaring: false,
        long: quality === 'long' || quality === 'longo',
        massive: false,
        precise: false,
        bloodLetting: false,
        areaMeleeRadius: false,
        areaShortRadius: false,
        areaCone: false,
        acidcoated: false,
        bane: false,
        deathrune: false,
        desecrated: false,
        flaming: false,
        hallowed: false,
        poison: false,
        thundering: false,
        mystical: false,
        staffFightingCompatibility: false,
        swordSaintCompatibility: false,
        knifePlayCompatibility: false
      },
      cost: '',
      number: 1,
      attribute,
      state: 'equipped'
    },
    ownership: { default: 0 },
    _stats: {
      systemId: 'symbaroum',
      systemVersion: '6.1.6',
      coreVersion: '13.350',
      createdTime: Date.now(),
      modifiedTime: Date.now(),
      lastModifiedBy: null,
      compendiumSource: null,
      duplicateSource: null,
      exportSource: null
    }
  };
}

function createActor({ id, name, img, race, shadow, appearance, tactics, attributes, toughness, items, folder }) {
  validateDocumentId(id, `Actor ${name}`);
  for (const item of (items || [])) {
    validateDocumentId(item._id, `Actor ${name} item ${item.name}`);
  }

  return {
    _id: id,
    name,
    type: 'monster',
    img,
    folder: folder || null,
    sort: 0,
    effects: [],
    flags: {},
    system: {
      attributes: {
        accurate: { label: 'ATTRIBUTE.ACCURATE', total: attributes.accurate, value: attributes.accurate, temporaryMod: 0 },
        cunning: { label: 'ATTRIBUTE.CUNNING', total: attributes.cunning, value: attributes.cunning, temporaryMod: 0 },
        discreet: { label: 'ATTRIBUTE.DISCREET', total: attributes.discreet, value: attributes.discreet, temporaryMod: 0 },
        persuasive: { label: 'ATTRIBUTE.PERSUASIVE', total: attributes.persuasive, value: attributes.persuasive, temporaryMod: 0 },
        quick: { label: 'ATTRIBUTE.QUICK', total: attributes.quick, value: attributes.quick, temporaryMod: 0 },
        resolute: { label: 'ATTRIBUTE.RESOLUTE', total: attributes.resolute, value: attributes.resolute, temporaryMod: 0 },
        strong: { label: 'ATTRIBUTE.STRONG', total: attributes.strong, value: attributes.strong, temporaryMod: 0 },
        vigilant: { label: 'ATTRIBUTE.VIGILANT', total: attributes.vigilant, value: attributes.vigilant, temporaryMod: 0 }
      },
      health: {
        toughness: {
          max: toughness.max || toughness.value,
          value: toughness.value,
          threshold: toughness.threshold || Math.ceil(toughness.value / 2)
        },
        corruption: {
          max: 0,
          permanent: 0,
          temporary: 0,
          threshold: 0,
          value: 0,
          longterm: 0
        }
      },
      money: {
        thaler: 0,
        shilling: 0,
        orteg: 0
      },
      defense: {
        attribute: 'quick'
      },
      initiative: {
        attribute: 'quick',
        value: 10
      },
      experience: {
        current: 0,
        total: 0,
        spent: 0,
        available: 0,
        artifactrr: 0
      },
      bio: {
        race,
        occupation: '',
        resistance: 'Ordinária',
        shadow,
        quote: '',
        age: '',
        height: '',
        weight: '',
        appearance,
        background: '',
        personalGoal: '',
        tactics,
        manner: ''
      }
    },
    items: items || [],
    ownership: {
      default: 0
    },
    prototypeToken: {
      name,
      displayName: 20,
      actorLink: false,
      width: 1,
      height: 1,
      lockRotation: false,
      rotation: 0,
      alpha: 1,
      disposition: 0,
      displayBars: 20,
      bar1: { attribute: 'health.toughness' },
      bar2: { attribute: 'combat.defense' },
      texture: {
        src: img,
        scaleX: 1,
        scaleY: 1,
        offsetX: 0,
        offsetY: 0,
        rotation: 0,
        anchorX: 0.5,
        anchorY: 0.5,
        fit: 'contain',
        alphaThreshold: 0.75
      },
      sight: {
        angle: 360,
        enabled: true,
        range: 12,
        brightness: 0,
        color: null,
        attenuation: 0.1,
        saturation: 0,
        contrast: 0,
        visionMode: 'basic'
      }
    },
    _stats: {
      systemId: 'symbaroum',
      systemVersion: '6.1.6',
      coreVersion: '13.350',
      createdTime: Date.now(),
      modifiedTime: Date.now(),
      lastModifiedBy: null,
      compendiumSource: null,
      duplicateSource: null,
      exportSource: null
    }
  };
}

async function run() {
  const { getExpeditionPackTables } = await import('./expedition-pack-data.mjs');
  const dbPath = path.resolve('packs/symbaroum-ind-resources');
  console.log('Connecting to LevelDB:', dbPath);
  const db = new ClassicLevel(dbPath, { valueEncoding: 'utf8' });
  await db.open();

  const advKey = '!adventures!6U6sXU05UOTd9FBe';
  const rawAdv = await db.get(advKey);
  const adventure = JSON.parse(rawAdv);

  console.log('Existing Adventure:', adventure.name);
  console.log('Existing Tables:', adventure.tables?.length || 0);

  // Folder IDs (strictly 16 characters)
  const itemFolderId = makeId('fldIndItm', 1);     // fldIndItm0000001
  const actorFolderId = makeId('fldIndAct', 1);    // fldIndAct0000001
  const tableRootFolderId = 'sZexcUw9eW4dVevS';    // Ind Resources - Tabelas
  const tableEquipFolderId = 'GS9u5kHIlHI0DgIA';   // Equipamentos
  const tableShadowFolderId = 'TupSLuYxLsjNGCy5';  // Sombras
  const tableEventFolderId = '4HaLWecuTkmNBMCm';   // Eventos
  const macroIndFolderId = 'keiBTL2WxCWPxGhJ';     // Ind Resources - Utilidades
  const macroUtilFolderId = 'eCk060eQBtIEtASn';    // Utilidades

  validateDocumentId(itemFolderId, 'itemFolderId');
  validateDocumentId(actorFolderId, 'actorFolderId');
  validateDocumentId(tableRootFolderId, 'tableRootFolderId');
  validateDocumentId(tableEquipFolderId, 'tableEquipFolderId');
  validateDocumentId(tableShadowFolderId, 'tableShadowFolderId');
  validateDocumentId(tableEventFolderId, 'tableEventFolderId');
  validateDocumentId(macroIndFolderId, 'macroIndFolderId');
  validateDocumentId(macroUtilFolderId, 'macroUtilFolderId');

  adventure.folders = [
    {
      _id: tableRootFolderId,
      name: 'Ind Resources - Tabelas',
      type: 'RollTable',
      folder: null,
      sorting: 'a',
      color: '#7a3e1d',
      flags: {}
    },
    {
      _id: tableEquipFolderId,
      name: 'Equipamentos',
      type: 'RollTable',
      folder: tableRootFolderId,
      sorting: 'a',
      color: null,
      flags: {}
    },
    {
      _id: tableShadowFolderId,
      name: 'Sombras',
      type: 'RollTable',
      folder: tableRootFolderId,
      sorting: 'a',
      color: null,
      flags: {}
    },
    {
      _id: tableEventFolderId,
      name: 'Eventos',
      type: 'RollTable',
      folder: tableRootFolderId,
      sorting: 'a',
      color: null,
      flags: {}
    },
    {
      _id: actorFolderId,
      name: 'Ind Resources - atores',
      type: 'Actor',
      folder: null,
      sorting: 'a',
      color: '#2d5a27',
      flags: {}
    },
    {
      _id: itemFolderId,
      name: 'Ind Resources - itens',
      type: 'Item',
      folder: null,
      sorting: 'a',
      color: '#6b4226',
      flags: {}
    },
    {
      _id: macroIndFolderId,
      name: 'Ind Resources - Utilidades',
      type: 'Macro',
      folder: null,
      sorting: 'a',
      color: '#994d4d',
      flags: {}
    },
    {
      _id: macroUtilFolderId,
      name: 'Utilidades',
      type: 'Macro',
      folder: null,
      sorting: 'a',
      color: null,
      flags: {}
    }
  ];

  // 1. Veículos (Itens de Equipamento)
  adventure.items = [
    createItem({
      id: makeId('itmCart', 1), // itmCart000000001
      name: 'Carroça',
      img: 'icons/commodities/tech/wheel.webp',
      reference: 'cart',
      cost: '1 táler',
      folder: itemFolderId,
      description: `<p>Veículo de transporte terrestre com duas rodas, tracionado por animais de carga ou esforço humano. Utilizado em estradas e trilhas transitáveis para transportar pessoas, fardos e mantimentos.</p>
<p><strong>Regras e Custos Oficiais (Livro Básico, p. 153):</strong> Custo de 1 táler.</p>
<ul>
  <li><strong>Serviço de Transporte (Forte do Cardo, p. 50):</strong> Um homem puxando uma carroça com duas rodas cobra 6 xelins.</li>
  <li><strong>Licença de Exploração (Forte do Cardo, p. 34):</strong> Carroças pagam taxa adicional de 5 táleres por carroça para adentrar a Davokar.</li>
  <li><strong>Infortúnios em Expedições (Guia do Mestre, p. 91):</strong> Em áreas acidentadas ou de mata densa, carroças correm risco de atolar na lama, prender em fendas ou ficar sob árvores caídas, exigindo auxílio de duas pessoas para liberação.</li>
</ul>`
    }),
    createItem({
      id: makeId('itmWagon', 1), // itmWagon00000001
      name: 'Vagão',
      img: 'icons/environment/settlement/wagon.webp',
      reference: 'wagon',
      cost: '5 táleres',
      folder: itemFolderId,
      description: `<p>Grande veículo de carga pesado com quatro rodas, projetado para suportar volumosos carregamentos de provisões, mercadorias e passageiros. Requer juntas de animais de tração (cavalos, bois ou mulas) e trânsito por estradas ou terreno aberto.</p>
<p><strong>Regras e Custos Oficiais (Livro Básico, p. 59, 153):</strong> Custo de 5 táleres.</p>
<ul>
  <li>Empregado nas caravanas regulares entre fazendas de fronteira, assentamentos rurais e as cidades de Ambria.</li>
  <li>Veículo fundamental para comboios comerciais e expedições de grande porte que transportam mantimentos para acampamentos base.</li>
</ul>`
    }),
    createItem({
      id: makeId('itmSleigh', 1), // itmSleigh0000001
      name: 'Trenó',
      img: 'icons/commodities/tech/wheel.webp',
      reference: 'sleigh',
      cost: '2 táleres',
      folder: itemFolderId,
      description: `<p>Veículo provido de patins deslizantes em vez de rodas, ideal para o transporte de cargas sobre neve compactada, gelo ou lama durante os invernos rigorosos e em passagens montanhosas das Titãs.</p>
<p><strong>Regras e Custos Oficiais (Livro Básico, p. 153, Tabela 14: Transporte):</strong> Custo de 2 táleres.</p>
<p>Pode ser tracionado por animais de carga ou expedicionários munidos de correias de tração.</p>`
    }),
    createItem({
      id: makeId('itmCanoe', 1), // itmCanoe00000001
      name: 'Canoa',
      img: 'icons/svg/anchor.svg',
      reference: 'canoe',
      cost: '2 táleres',
      folder: itemFolderId,
      description: `<p>Embarcação fluvial leve e esguia, impulsionada por remos. Capaz de navegar cursos d'água rasos, lagos e afluentes estreitos da Davokar onde barcos maiores encalhariam.</p>
<p><strong>Regras e Custos Oficiais (Livro Básico, p. 153; Guia do Mestre, p. 90):</strong> Custo de 2 táleres.</p>
<ul>
  <li><strong>Viagem Fluvial:</strong> Uma jornada ao longo dos rios conta como um nível mais brando de dificuldade de terreno (por exemplo, mover-se ao longo de um rio na Davokar Iluminada equivale a uma marcha nas Planícies de Ambria).</li>
</ul>`
    }),
    createItem({
      id: makeId('itmRowboat', 1), // itmRowboat000001
      name: 'Barco a remo',
      img: 'icons/svg/anchor.svg',
      reference: 'rowingboat',
      cost: '3 táleres',
      folder: itemFolderId,
      description: `<p>Pequena embarcação estável impulsionada por remos, utilizada para transporte de passageiros, pescarias e travessias em rios e lagos de Ambria e Davokar.</p>
<p><strong>Regras e Custos Oficiais (Livro Básico, p. 153; Guia do Mestre, p. 90):</strong> Custo de 3 táleres.</p>
<ul>
  <li>Permite travessias seguras de vias fluviais largas e transporte direto de equipamentos de acampamento.</li>
</ul>`
    }),
    createItem({
      id: makeId('itmRiverboat', 1), // itmRiverboat0001
      name: 'Barco de rio',
      img: 'icons/environment/settlement/ship.webp',
      reference: 'riverboat',
      cost: '200 táleres',
      folder: itemFolderId,
      description: `<p>Embarcação fluvial de grande porte destinada ao tráfego contínuo de cargas volumosas e dezenas de viajantes pelas artérias navegáveis principais de Ambria (como os rios Doudram, Eanor, Nooma e Malgor).</p>
<p><strong>Regras e Custos Oficiais (Livro Básico, p. 153, Tabela 14: Transporte):</strong> Custo de 200 táleres.</p>
<ul>
  <li>Artéria vital de ligação entre Kurun, Yndaros, Agrella e Kastor, permitindo transporte seguro e célere de mantimentos e mercadorias valiosas.</li>
</ul>`
    }),
    createItem({
      id: makeId('itmGalley', 1), // itmGalley0000001
      name: 'Navio / Galé',
      img: 'icons/skills/trades/profession-sailing-ship.webp',
      reference: 'galley',
      cost: '1.000 táleres',
      folder: itemFolderId,
      description: `<p>Grande embarcação marítima ou fluvial pesada provida de mastros e bancadas de remadores (galé). Destinada à navegação em águas profundas, patrulha militar e grandes viagens costeiras e fluviais.</p>
<p><strong>Regras e Custos Oficiais (Livro Básico, p. 56, 153):</strong> Custo de 1.000 táleres.</p>
<ul>
  <li>No cais bem guardado do Porto de Yndaros, a própria Rainha Korinthia mantém uma imponente galé com doze pares de remos ao lado de botes e navios proeminentes.</li>
</ul>`
    }),
    createBoon({
      id: makeId('bnBushc', 1), // bnBushc000000001
      name: 'Mateiro',
      img: 'icons/environment/wilderness/tree-ash.webp',
      reference: 'bushcraft',
      level: 1,
      folder: itemFolderId,
      description: `<p>O personagem pode sobreviver com recursos escassos e está acostumado a encontrar comida e abrigo em terrenos árduos.</p>
<p>Com um Teste bem-sucedido de <strong>Vigilante</strong>, o personagem pode encontrar comida e água o suficiente (1d6 rações) para se alimentar enquanto se move em locais selvagens ou pelas ruínas da Davokar. Se o grupo permanecer parado dedicando o dia à coleta, encontra 1d10 rações.</p>
<hr />
<h3>Expedições na Floresta de Davokar (Guia do Mestre, pp. 87–103)</h3>
<p>Para guiar expedições e navegar através da mata, o nível de Mateiro determina a adaptação do guia à profundidade da floresta:</p>
<ul>
  <li><strong>Nível I (Davokar Iluminada):</strong> Eficaz nas bordas da floresta, montanhas e planícies. Testes de Orientação e Forrageamento são realizados sem penalidade na Davokar Iluminada.</li>
  <li><strong>Nível II (Davokar Selvagem):</strong> Eficaz nos vales profundos e na Davokar Selvagem. Permite guiar com segurança e forragear na floresta selvagem sem penalidade.</li>
  <li><strong>Nível III (Davokar Escura):</strong> Eficaz na Davokar Escura e no Submundo. O guia domina os caminhos tenebrosos e perigos ancestrais onde a luz solar nunca penetra.</li>
</ul>
<p><strong>Penalidade por Patamar:</strong> Se o nível de Mateiro do guia for <strong>1 nível inferior</strong> à região atual, o guia sofre <strong>–3 de penalidade</strong> em todos os testes de Orientação e Forrageamento. Se for <strong>2 níveis inferior</strong> (ou se não possuir Mateiro em regiões profundas), a penalidade é de <strong>–5</strong>.</p>`
    })
  ];

  // 2. Fichas de Animais (Actors de Monstro)
  adventure.actors = [
    // Mula
    createActor({
      id: makeId('actMule', 1), // actMule000000001
      name: 'Mula',
      img: 'icons/environment/creatures/horse-white.webp',
      race: 'Mula (Besta)',
      shadow: 'Castanho escuro terroso (corrupção: 0)',
      appearance: `<p>Híbrido de jumento e égua, a mula reúne a firmeza e cautela do burro com a força e porte do cavalo. É o animal de carga ideal para transitar com segurança por encostas íngremes, passos montanhosos e trilhas acidentadas.</p>
<p><strong>Regras de Carga (Guia do Mestre, p. 91):</strong> Animais de carga de quatro patas podem carregar o dobro de um carregador humano comum (até 80 unidades de itens cada) e sobrevivem exclusivamente pastando na vegetação das margens da rota.</p>
<p><strong>Custo Oficial (Livro Básico, p. 153, Tabela 14: Transporte):</strong> 3 táleres.</p>`,
      tactics: 'Animal desconfiado e de passo firme. Diante de perigo evidente, recua com teimosia; se acuada por predadores, desfere fortes coices para abrir caminho.',
      attributes: {
        accurate: 10,
        cunning: 7,
        discreet: 6,
        persuasive: 9,
        quick: 11,
        resolute: 13,
        strong: 14,
        vigilant: 10
      },
      toughness: { value: 14, max: 14, threshold: 7 },
      folder: actorFolderId,
      items: [
        createTrait({
          id: makeId('trtArmMule', 1), // trtArmMule000001
          name: 'Armadurado',
          img: 'systems/symbaroum/asset/image/trait.png',
          reference: 'armored',
          description: '<p>A criatura possui pele grossa, escamas ou couro que a torna especialmente difícil de ferir.</p>',
          noviceDesc: '<p>A criatura tem uma proteção natural de 2.</p>',
          noviceActive: true
        }),
        createTrait({
          id: makeId('trtRobMule', 1), // trtRobMule000001
          name: 'Robusto (M)',
          img: 'systems/symbaroum/asset/image/trait.png',
          reference: 'robust',
          description: '<p>A criatura é maior e mais resistente que o normal, e só pode usar armaduras leves modificadas.</p>',
          noviceDesc: '<p>A criatura ignora 2 pontos de dano de cada acerto.</p>',
          adeptDesc: '<p>A criatura ignora 3 pontos de dano de cada acerto, além de qualquer Armadura que esteja usando. Uma vez por turno, causa +3 pontos de dano em ataques corpo a corpo. Sua Defesa baseia-se em [Rápido-3].</p>',
          noviceActive: true,
          adeptActive: true
        }),
        createWeapon({
          id: makeId('wpnHoofMule', 1), // wpnHoofMule00001
          name: 'Cascos',
          img: 'icons/commodities/bones/hooves-cloven-brown.webp',
          damage: '1d6',
          quality: 'long',
          attribute: 'accurate'
        })
      ]
    }),

    // Burro
    createActor({
      id: makeId('actDonkey', 1), // actDonkey0000001
      name: 'Burro',
      img: 'icons/environment/creatures/horse-tan.webp',
      race: 'Burro (Besta)',
      shadow: 'Cinza terroso (corrupção: 0)',
      appearance: `<p>Animal rústico, dócil, paciente e de baixo custo de manutenção. Muito empregado por camponeses, mercadores ambulantes e pequenas expedições na Davokar.</p>
<p><strong>Regras de Carga (Guia do Mestre, p. 91):</strong> Animais de carga de quatro patas podem carregar o dobro de um carregador humano (até 80 unidades de itens cada) e têm a grande vantagem de sobreviver exclusivamente pastando.</p>
<p><strong>Custo Oficial (Livro Básico, p. 154, Tabela 16: Animais de Fazenda):</strong> 3 táleres.</p>`,
      tactics: 'Dócil e habituado à rotina, porém empaca rigidamente se farejar perigo adiante. Defende-se escoiceando caso atacado por lobos ou outros predadores.',
      attributes: {
        accurate: 10,
        cunning: 7,
        discreet: 8,
        persuasive: 8,
        quick: 10,
        resolute: 13,
        strong: 13,
        vigilant: 11
      },
      toughness: { value: 13, max: 13, threshold: 7 },
      folder: actorFolderId,
      items: [
        createTrait({
          id: makeId('trtArmDonk', 1), // trtArmDonk000001
          name: 'Armadurado',
          img: 'systems/symbaroum/asset/image/trait.png',
          reference: 'armored',
          description: '<p>A criatura possui pele grossa, escamas ou couro que a torna especialmente difícil de ferir.</p>',
          noviceDesc: '<p>A criatura tem uma proteção natural de 2.</p>',
          noviceActive: true
        }),
        createTrait({
          id: makeId('trtRobDonk', 1), // trtRobDonk000001
          name: 'Robusto (M)',
          img: 'systems/symbaroum/asset/image/trait.png',
          reference: 'robust',
          description: '<p>A criatura é maior e mais resistente que o normal, e só pode usar armaduras leves modificadas.</p>',
          noviceDesc: '<p>A criatura ignora 2 pontos de dano de cada acerto, além de qualquer Armadura que esteja usando. Uma vez por turno, causa +2 pontos de dano em ataques corpo a corpo. Sua Defesa baseia-se em [Rápido-2].</p>',
          noviceActive: true
        }),
        createWeapon({
          id: makeId('wpnHoofDonk', 1), // wpnHoofDonk00001
          name: 'Cascos',
          img: 'icons/commodities/bones/hooves-cloven-brown.webp',
          damage: '1d6',
          quality: 'long',
          attribute: 'accurate'
        })
      ]
    }),

    // Boi
    createActor({
      id: makeId('actOx', 1), // actOx00000000001
      name: 'Boi',
      img: 'icons/creatures/mammals/ox-bull-horned-glowing-orange.webp',
      race: 'Boi (Besta)',
      shadow: 'Ocre avermelhado quente (corrupção: 0)',
      appearance: `<p>Bovino de grande porte com massa muscular prodigiosa, utilizado para arar os solos mais pesados de Ambria e puxar carroções com carregamentos maciços de toras, minérios e provisões.</p>
<p><strong>Tração Pesada:</strong> Possui vigor incomparável para vencer atoleiros e estradas de barro onde montarias mais velozes perderiam tração.</p>
<p><strong>Custo Oficial (Livro Básico, p. 154, Tabela 16: Animais de Fazenda):</strong> 4 táleres.</p>`,
      tactics: 'Lento e tranquilo sob jugo. Quando assustado ou ferido, investe furiosamente com a cabeça e chifres pontiagudos contra a ameaça.',
      attributes: {
        accurate: 9,
        cunning: 5,
        discreet: 5,
        persuasive: 8,
        quick: 7,
        resolute: 11,
        strong: 16,
        vigilant: 9
      },
      toughness: { value: 16, max: 16, threshold: 8 },
      folder: actorFolderId,
      items: [
        createTrait({
          id: makeId('trtArmOx', 1), // trtArmOx00000001
          name: 'Armadurado',
          img: 'systems/symbaroum/asset/image/trait.png',
          reference: 'armored',
          description: '<p>A criatura possui pele grossa, escamas ou couro que a torna especialmente difícil de ferir.</p>',
          noviceDesc: '<p>A criatura tem uma proteção natural de 2.</p>',
          noviceActive: true
        }),
        createTrait({
          id: makeId('trtRobOx', 1), // trtRobOx00000001
          name: 'Robusto (M)',
          img: 'systems/symbaroum/asset/image/trait.png',
          reference: 'robust',
          description: '<p>A criatura é maior e mais resistente que o normal, e só pode usar armaduras leves modificadas.</p>',
          noviceDesc: '<p>A criatura ignora 2 pontos de dano de cada acerto.</p>',
          adeptDesc: '<p>A criatura ignora 3 pontos de dano de cada acerto, além de qualquer Armadura que esteja usando. Uma vez por turno, causa +3 pontos de dano em ataques corpo a corpo. Sua Defesa baseia-se em [Rápido-3].</p>',
          noviceActive: true,
          adeptActive: true
        }),
        createWeapon({
          id: makeId('wpnHornsOx', 1), // wpnHornsOx00001
          name: 'Chifres',
          img: 'icons/weapons/staves/staff-animal-skull-bull.webp',
          damage: '1d8',
          quality: 'devastador',
          attribute: 'strong'
        })
      ]
    }),

    // Cavalo
    createActor({
      id: makeId('actHorse', 1), // actHorse00000001
      name: 'Cavalo',
      img: 'icons/environment/creatures/horse-brown.webp',
      race: 'Cavalo (Besta)',
      shadow: 'Castanho claro com um tom de cobre (corrupção: 0)',
      appearance: `<p>O cavalo é de longe a montaria mais comum tanto em Ambria quanto na Davokar, além de também ser usado para trabalhar nos campos e puxar carroças e carruagens.</p>
<p><strong>Regras de Carga (Guia do Mestre, p. 91):</strong> Animais de carga de quatro patas podem carregar o dobro de um humano (80 unidades cada) e sobrevivem exclusivamente pastando.</p>
<p><strong>Custos Oficiais (Livro Básico, p. 153, Tabela 14: Transporte):</strong> Cavalo de Montaria Leve: 5 táleres; Cavalo de Montaria Pesado: 7 táleres.</p>`,
      tactics: 'Os cavalos se assustam facilmente, e muitas vezes fogem ao primeiro sinal de perigo, não importa o quanto o cavaleiro grite e ameace.',
      attributes: {
        accurate: 10,
        cunning: 7,
        discreet: 5,
        persuasive: 10,
        quick: 13,
        resolute: 11,
        strong: 15,
        vigilant: 9
      },
      toughness: { value: 15, max: 15, threshold: 8 },
      folder: actorFolderId,
      items: [
        createTrait({
          id: makeId('trtArmHorse', 1), // trtArmHorse00001
          name: 'Armadurado',
          img: 'systems/symbaroum/asset/image/trait.png',
          reference: 'armored',
          description: '<p>A criatura possui pele grossa, escamas ou couro que a torna especialmente difícil de ferir.</p>',
          noviceDesc: '<p>A criatura tem uma proteção natural de 2.</p>',
          noviceActive: true
        }),
        createTrait({
          id: makeId('trtRobHorse', 1), // trtRobHorse00001
          name: 'Robusto (M)',
          img: 'systems/symbaroum/asset/image/trait.png',
          reference: 'robust',
          description: '<p>A criatura é maior e mais resistente que o normal, e só pode usar armaduras leves modificadas.</p>',
          noviceDesc: '<p>A criatura ignora 2 pontos de dano de cada acerto.</p>',
          adeptDesc: '<p>A criatura ignora 3 pontos de dano de cada acerto.</p>',
          masterDesc: '<p>A criatura ignora 4 pontos de dano de cada acerto, além de qualquer Armadura que esteja usando. Uma vez por turno, causa +4 pontos de dano em ataques corpo a corpo. Sua Defesa baseia-se em [Rápido-4].</p>',
          noviceActive: true,
          adeptActive: true,
          masterActive: true
        }),
        createWeapon({
          id: makeId('wpnHoofHorse', 1), // wpnHoofHorse0001
          name: 'Cascos',
          img: 'icons/commodities/bones/hooves-cloven-brown.webp',
          damage: '1d8',
          quality: 'long',
          attribute: 'accurate'
        })
      ]
    })
  ];

  const originalTables = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'original-tables.json'), 'utf8'));
  const expeditionTables = getExpeditionPackTables(tableRootFolderId);
  const { CANONICAL_EXPEDITION_TABLE_IDS } = await import("../scripts/constants.mjs");
  const dailyIds = new Set(Object.entries(CANONICAL_EXPEDITION_TABLE_IDS).filter(([key]) => key !== "mishaps").map(([, id]) => id));
  const filteredOriginal = originalTables.filter(t => !dailyIds.has(t._id) && !["ruins", "encounters", "enemies", "terrain"].includes(t.flags?.["symbaroum-ind-resources"]?.tableKey) && !expeditionTables.some(exp => exp._id === t._id || exp.name === t.name || t.flags?.['symbaroum-ind-resources']?.tableKey === exp.flags['symbaroum-ind-resources'].tableKey));

  adventure.tables = [
    ...filteredOriginal,
    ...expeditionTables
  ];

  adventure._stats.modifiedTime = Date.now();

  console.log('Writing updated adventure back to LevelDB...');
  await db.put(advKey, JSON.stringify(adventure));

  console.log('Compacting LevelDB...');
  await db.compactRange('\x00', '\xff');

  console.log('Verification: reading back from DB...');
  const verifyRaw = await db.get(advKey);
  const verifyAdv = JSON.parse(verifyRaw);

  console.log('Verify Success!');
  console.log('Folders:', verifyAdv.folders.map(f => ({ id: f._id, name: f.name })));
  console.log('Items count:', verifyAdv.items.length, verifyAdv.items.map(i => ({ id: i._id, name: i.name })));
  console.log('Actors count:', verifyAdv.actors.length, verifyAdv.actors.map(a => ({ id: a._id, name: a.name, items: a.items.map(i => ({ id: i._id, name: i.name })) })));
  console.log('Tables preserved count:', verifyAdv.tables.length);

  await db.close();
  console.log('Database safely closed.');
}

run().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
