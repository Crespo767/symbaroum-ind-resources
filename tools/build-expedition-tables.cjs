const { ClassicLevel } = require('classic-level');
const fs = require('fs');
const path = require('path');

const MISHAPS = [
  {
    num: 1,
    name: 'O Local do Acampamento',
    desc: 'O grupo encontra um acampamento abandonado. Está realmente vazio? Há itens valiosos ou algo perigoso deixado para trás?',
    img: 'icons/environment/wilderness/camp-makeshift-tan.webp'
  },
  {
    num: 2,
    name: 'O Cadáver',
    desc: 'Restos mortais de um caçador de fortunas despreparado. O que o matou? Há pertences recuperáveis?',
    img: 'icons/commodities/bones/bones-skull-decayed.webp'
  },
  {
    num: 3,
    name: 'Um Uivo Distante',
    desc: 'Uivo inumano na mata. Pouco depois, soa novamente, muito mais próximo.',
    img: 'icons/creatures/abilities/wolf-howl-moon.webp'
  },
  {
    num: 4,
    name: 'Um Mau Presságio',
    desc: 'Sinais claros de perigo iminente (pegadas frescas, muco corrosivo, sangue, carcaças).',
    img: 'icons/skills/sensory/eyeball-red-glowing.webp'
  },
  {
    num: 5,
    name: 'Silêncio Súbito',
    desc: 'A floresta prende a respiração; um silêncio absoluto e aterrador cai sobre o grupo.',
    img: 'icons/magic/perception/silence-quiet-shadow.webp'
  },
  {
    num: 6,
    name: 'Preso',
    desc: 'Carroça ou carga emperra na lama, fenda ou tronco caído. Duas pessoas devem testar Vigoroso. Se 1 falhar: –10 km no dia. Se ambas falharem: perde-se 1 dia inteiro.',
    img: 'icons/commodities/tech/wheel.webp'
  },
  {
    num: 7,
    name: 'Seguidos',
    desc: 'A expedição está sendo seguida (percebido com Vigilante). Quem são e qual a intenção?',
    img: 'icons/skills/movement/feet-stealth-footprints-green.webp'
  },
  {
    num: 8,
    name: 'Espinhos',
    desc: 'Campo de arbustos espinhosos densos. Contornar: metade da velocidade no dia. Forçar passagem: 2 testes de Discreto por pessoa; cada falha causa 1d4 de dano (ignora armadura).',
    img: 'icons/magic/nature/root-vine-thorns-brown.webp'
  },
  {
    num: 9,
    name: 'A Patrulha',
    desc: 'Patrulheiros da Rainha exigem ver a Licença de Explorador e revistam a bagagem. São legítimos ou desertores/corruptos?',
    img: 'icons/skills/targeting/crosshair-arrow-gold.webp'
  },
  {
    num: 10,
    name: 'Enxame de Mosquitos',
    desc: 'Nuvem voraz de insetos transmissores de doença (Códice de Monstros, p. 169). Role 1d6: 1–3 Fraca, 4–5 Moderada, 6 Forte.',
    img: 'icons/creatures/invertebrates/wasp-swarm-yellow.webp'
  },
  {
    num: 11,
    name: 'Chuvarada',
    desc: 'Chuva gélida ensopa o grupo. Teste de Vigoroso ou Resoluto: falha causa resfriado (–3 em todos os testes até aquecer-se ao lado do fogo).',
    img: 'icons/magic/water/rain-clouds-dark.webp'
  },
  {
    num: 12,
    name: 'Perdido',
    desc: 'O grupo perde o rumo. O guia faz testes de Orientação com –5. Falha = anda em círculos (0 km). Sucesso = metade da velocidade. Necessita de 3 sucessos com –5 para reencontrar o caminho.',
    img: 'icons/tools/navigation/compass-brass.webp'
  },
  {
    num: 13,
    name: 'Animais Doentes',
    desc: 'Montarias/cargas adoecem e vomitam. Teste diário de Astuto (Saber de Bestas) por animal. Se viajarem doentes: apenas 1/4 da velocidade normal.',
    img: 'icons/environment/creatures/horse-brown.webp'
  },
  {
    num: 14,
    name: 'Charco',
    desc: 'Pântano traiçoeiro (leva meio dia para contornar). Atravessar exige teste de Vigilante do guia. Falha: membro afunda. Outro membro precisa de 2 sucessos em Vigoroso antes de 3 falhas, ou a vítima afunda na lama e morre.',
    img: 'icons/magic/water/bubbles-air-water-pink.webp'
  },
  {
    num: 15,
    name: 'Emboscada',
    desc: 'Inimigos preparam emboscada. Notar a tempo exige teste de [Vigilante –5].',
    img: 'icons/skills/targeting/crosshair-pointed-red.webp'
  },
  {
    num: 16,
    name: 'Comida Estragada',
    desc: 'Vermes, micróbios ou animais devoram provisões. O grupo perde 1d20 rações.',
    img: 'icons/consumables/food/bowl-stew-bone-soup-red.webp'
  },
  {
    num: 17,
    name: 'Incêndio Florestal',
    desc: 'Fogo avança rapidamente. Cada membro faz dois testes de Rápido. Cada falha causa 1d4 de dano (ignora armadura) por 1d4 turnos. O que acontece com animais e carroças?',
    img: 'icons/magic/fire/barrier-wall-flame-ring-yellow.webp'
  },
  {
    num: 18,
    name: 'De Mal a Pior',
    desc: 'Role duas vezes nesta tabela e aplique ambos os efeitos.',
    img: 'icons/skills/melee/strike-blade-skull-red.webp'
  },
  {
    num: 19,
    name: 'Discórdia nas Fileiras',
    desc: 'A exaustão causa atritos severos. Dois NPCs ou membros da expedição entram em conflito violento.',
    img: 'icons/skills/social/intimidation-impressing.webp'
  },
  {
    num: 20,
    name: 'Solo Sagrado',
    desc: 'Território tabu dos bárbaros ou de guardiões antigos. Os invasores são caçados à morte.',
    img: 'icons/environment/settlement/totem-wood-antlers.webp'
  },
  {
    num: 21,
    name: 'Solo Corrompido',
    desc: 'Vegetação com veios negros doentes. Voltar e contornar perde 1 dia. Avançar exige teste de Vigoroso: falha causa 1d6 de corrupção temporária contínua até sair da área.',
    img: 'icons/magic/unholy/strike-body-explode-disintegrate.webp'
  },
  {
    num: 22,
    name: 'Colina do Enforcado',
    desc: 'Cadáveres mutilados pendurados nas árvores de uma grande expedição anterior. Aliados devem ser acalmados com [Persuasivo ← Resoluto] para não desertarem em pânico.',
    img: 'icons/environment/wilderness/gallows-hanged.webp'
  },
  {
    num: 23,
    name: 'Sabotagem',
    desc: 'Um sabotador solitário ataca suprimentos, animais ou membros à noite.',
    img: 'icons/skills/melee/dagger-stab-heart-red.webp'
  },
  {
    num: 24,
    name: 'O Ultimato do Jurado do Ferro',
    desc: 'Bando de guerra élfico surge com flechas apontadas. Ultimato: voltar e dar uma volta de 2 dias ou enfrentar extermínio.',
    img: 'icons/weapons/bows/shortbow-recurve-leather.webp'
  },
  {
    num: 25,
    name: 'Covil do Mal',
    desc: 'A área atrai abominações. Role imediatamente mais uma vez na Tabela 28 (Inimigos).',
    img: 'icons/creatures/magical/demon-gargoyle-stone-spiked.webp'
  },
  {
    num: 26,
    name: 'Delírio',
    desc: 'Alucinações visuais e auditivas traumáticas. Questionar a realidade exige teste de [Resoluto –3] para dissipar. O grupo perde horas preciosas.',
    img: 'icons/magic/control/silhouette-hold-beam-blue.webp'
  },
  {
    num: 27,
    name: 'O Contágio Eterno',
    desc: 'Área mortalmente corrompida. Contornar (perde 1 dia) exige teste de Vigoroso ou sofre 1 ponto de corrupção permanente. Cruzar exige Vigoroso: falha causa 1d4 de corrupção permanente; sucesso causa 1d6 de corrupção temporária. Todas as rações na área são contaminadas (+1 corrupção temporária por ração consumida).',
    img: 'icons/magic/unholy/energy-smoke-tendrils-purple.webp'
  },
  {
    num: 28,
    name: 'Desaparecimento',
    desc: 'Um membro, animal ou condutor de carroça evapora misteriosamente sem deixar vestígios.',
    img: 'icons/magic/movement/trail-streak-zigzag-yellow.webp'
  },
  {
    num: 29,
    name: 'Coração da Escuridão',
    desc: 'Um membro aleatório é enlouquecido por esporos/miasma. Teste de Resoluto: sucesso sofre 1d4 corrupção permanente; falha sofre 1d10 corrupção permanente. O afetado entra em fúria homicida e ataca o aliado mais próximo até o fim da cena.',
    img: 'icons/magic/unholy/orb-glowing-yellow-purple.webp'
  },
  {
    num: 30,
    name: 'O Olho da Floresta',
    desc: 'A floresta observa e esmaga o espírito do grupo. Todos que falharem em [Resoluto –5] entram em pânico cego e fogem em direções aleatórias por 1d4 horas, espalhando-se sozinhos pela Davokar.',
    img: 'icons/magic/perception/eye-tendrils-web-purple.webp'
  }
];

function make16Id(prefix, num) {
  const pad = '0'.repeat(16 - prefix.length - String(num).length);
  return `${prefix}${pad}${num}`;
}

async function buildTablePack() {
  const packDir = path.resolve(__dirname, '..', 'packs', 'expedition-tables');
  if (fs.existsSync(packDir)) {
    fs.rmSync(packDir, { recursive: true, force: true });
  }
  fs.mkdirSync(packDir, { recursive: true });

  const db = new ClassicLevel(packDir, { valueEncoding: 'json' });
  await db.open();

  const tableId = 'tblMishapsDav001'; // 16 chars
  const resultIds = [];
  const fullResults = [];

  for (const m of MISHAPS) {
    const resId = make16Id('resMish', m.num); // resMish000000001 to 30
    resultIds.push(resId);

    const resObj = {
      _id: resId,
      type: 'text',
      name: m.name,
      text: `<strong>${m.num}. ${m.name}:</strong> ${m.desc}`,
      description: `<p><strong>${m.name}</strong></p><p>${m.desc}</p>`,
      img: m.img || 'icons/svg/d20-black.svg',
      weight: 1,
      range: [m.num, m.num],
      drawn: false,
      flags: {},
      _stats: {
        coreVersion: '13.350',
        systemId: 'symbaroum',
        systemVersion: '6.1.6',
        createdTime: Date.now(),
        modifiedTime: Date.now()
      }
    };
    fullResults.push(resObj);

    // Salva o subdocumento no LevelDB
    await db.put(`!tables.results!${tableId}.${resId}`, resObj);
  }

  const tableDoc = {
    _id: tableId,
    name: 'Tabela 25 - Infortúnios na Davokar',
    img: 'icons/environment/wilderness/tree-twisted.webp',
    description: '<p>Tabela oficial de Infortúnios em expedições pela floresta de Davokar (Guia do Mestre, p. 91, 115).</p><p><strong>Rolagem:</strong> 1d20 + Modificador de Região (+0 Iluminada, +5 Selvagem, +10 Escura).</p>',
    results: resultIds,
    formula: '1d20',
    replacement: true,
    displayRoll: true,
    folder: null,
    sort: 0,
    flags: {},
    _stats: {
      coreVersion: '13.350',
      systemId: 'symbaroum',
      systemVersion: '6.1.6',
      createdTime: Date.now(),
      modifiedTime: Date.now()
    },
    ownership: {
      default: 0
    }
  };

  await db.put(`!tables!${tableId}`, tableDoc);
  await db.close();
  console.log(`Pack expedition-tables created successfully with ${MISHAPS.length} results!`);

  return { tableDoc, fullResults };
}

buildTablePack().catch(err => {
  console.error('Error building table pack:', err);
  process.exit(1);
});
