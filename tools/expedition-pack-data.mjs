import {
  getDavokarMishapsTableData, getDavokarRuinsTableData, getDavokarEncountersTableData,
  getDavokarEnemiesTableData, getDavokarTerrainTableData
} from "../scripts/expedition-data.mjs";

/** Os dois geradores usam os mesmos IDs, flags, imagens e intervalos do runtime. */
export function getExpeditionPackTables(folder = null) {
  const getters = [getDavokarMishapsTableData, getDavokarRuinsTableData, getDavokarEncountersTableData,
    getDavokarEnemiesTableData, getDavokarTerrainTableData];
  return getters.map(getData => {
    const table = getData();
    const key = table.flags["symbaroum-ind-resources"].tableKey;
    const prefix = key === "mishaps" ? "resMish" : `res${key}`;
    return {
      ...table, folder, sort: 0, ownership: { default: 0 },
      results: table.results.map((result, index) => ({
        ...result, _id: `${prefix}${String(index + 1).padStart(16 - prefix.length, "0")}`
      }))
    };
  });
}
