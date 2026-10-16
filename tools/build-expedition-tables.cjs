const fs = require('node:fs');
const path = require('node:path');

async function buildTablePack(packDir, LevelClass) {
  if (!packDir) throw new Error('Informe --output <diretório vazio>; os bancos instalados não são sobrescritos.');
  const output = path.resolve(packDir);
  const installedPacks = path.resolve(__dirname, '..', 'packs');
  const relative = path.relative(installedPacks, output);
  if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('Gere e valide o compêndio fora dos bancos instalados.');
  }
  if (fs.existsSync(output) && fs.readdirSync(output).length) throw new Error('O diretório de saída deve estar vazio.');
  const { getExpeditionPackTables } = await import('./expedition-pack-data.mjs');
  const tables = getExpeditionPackTables();
  const ClassicLevel = LevelClass ?? require('classic-level').ClassicLevel;
  fs.mkdirSync(output, { recursive: true });
  const db = new ClassicLevel(output, { valueEncoding: 'json' });
  await db.open();
  try {
    for (const table of tables) {
      const { results, ...data } = table;
      await db.put(`!tables!${table._id}`, { ...data, results: results.map(result => result._id) });
      for (const result of results) await db.put(`!tables.results!${table._id}.${result._id}`, result);
    }
    await db.compactRange('\x00', '\xff');
  } finally {
    await db.close();
  }
  return tables;
}

module.exports = { buildTablePack };
if (require.main === module) {
  const args = process.argv.slice(2);
  const output = args.length === 2 && args[0] === '--output' ? args[1] : null;
  buildTablePack(output).then(tables => console.log(`Compêndio gerado: ${tables.length} tabelas.`)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
