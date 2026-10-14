const { ClassicLevel } = require('classic-level');
const fs = require('fs');
const path = require('path');

function make16Id(prefix, num) {
  const pad = '0'.repeat(16 - prefix.length - String(num).length);
  return `${prefix}${pad}${num}`;
}

async function buildTablePack() {
  const { OFFICIAL_DAVOKAR_MISHAPS } = await import('../scripts/expedition-data.mjs');

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

  for (const m of OFFICIAL_DAVOKAR_MISHAPS) {
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
  await db.compactRange('\x00', '\xff');
  await db.close();
  console.log(`Pack expedition-tables created successfully with ${OFFICIAL_DAVOKAR_MISHAPS.length} results!`);

  return { tableDoc, fullResults };
}

buildTablePack().catch(err => {
  console.error('Error building table pack:', err);
  process.exit(1);
});
