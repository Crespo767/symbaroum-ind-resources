import {
  getDavokarMishapsTableData
} from "../scripts/expedition-data.mjs";

/** Only mishaps remain in IND; daily event tables come from the official GMG. */
export function getExpeditionPackTables(folder = null) {
  const getters = [getDavokarMishapsTableData];
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
