import { CANONICAL_EXPEDITION_TABLE_IDS, MODULE_ID, OFFICIAL_DAVOKAR_EVENT_TABLE_IDS } from "./constants.mjs";

const MISHAPS_ID = CANONICAL_EXPEDITION_TABLE_IDS.mishaps;
const MISHAPS_PACK = MODULE_ID + ".expedition-tables";
const LEGACY_MISHAPS_ID = "tblMishDav0000001";

function validTable(table) {
  return table?.documentName === "RollTable" && typeof table.roll === "function";
}

async function indexedTable(pack, id) {
  if (pack?.documentName !== "RollTable") return null;
  const index = await pack.getIndex();
  return index?.get(id) ? pack.getDocument(id) : null;
}

export async function resolveDavokarTable(key, reference) {
  if (reference) {
    try {
      const table = await globalThis.fromUuid(reference);
      return validTable(table) ? table : null;
    } catch {
      return null;
    }
  }
  if (key === "mishaps") {
    const table = game.tables.get(MISHAPS_ID) ?? game.tables.get(LEGACY_MISHAPS_ID);
    if (validTable(table)) return table;
    const native = await indexedTable(game.packs.get(MISHAPS_PACK), MISHAPS_ID);
    return validTable(native) ? native : null;
  }

  const id = OFFICIAL_DAVOKAR_EVENT_TABLE_IDS[key];
  if (!id) return null;
  const table = game.tables.get(id);
  if (validTable(table)) return table;
  for (const pack of game.packs.values()) {
    if (pack.metadata?.packageName !== "symbaroum-gmg" && !pack.collection?.startsWith("symbaroum-gmg.")) continue;
    const candidate = await indexedTable(pack, id);
    if (validTable(candidate)) return candidate;
  }
  return null;
}

export function isOfficialDavokarTable(key, table) {
  return key === "mishaps" ? [MISHAPS_ID, LEGACY_MISHAPS_ID].includes(table?.id)
    : Boolean(OFFICIAL_DAVOKAR_EVENT_TABLE_IDS[key] && table?.id === OFFICIAL_DAVOKAR_EVENT_TABLE_IDS[key]);
}

function rangesFor(table) {
  return Array.from(table.results?.values?.() ?? []).filter(result => !result.drawn).map(result => result.range)
    .filter(range => Number.isInteger(range?.[0]) && Number.isInteger(range?.[1]) && range[0] <= range[1]);
}

export function tableRollFormula(key, table, modifier) {
  const ranges = rangesFor(table);
  if (!ranges.length || !Number.isSafeInteger(modifier)) return null;
  const base = isOfficialDavokarTable(key, table) ? "1d20" : table.formula;
  if (!base || !globalThis.Roll.validate(base)) return null;
  const ordered = ranges.sort((a, b) => a[0] - b[0]);
  const [min] = ordered[0];
  let max = min;
  for (const [start, end] of ordered) {
    if (start > max + 1) return null;
    max = Math.max(max, end);
  }
  const dice = modifier ? "(" + base + ") + (" + modifier + ")" : base;
  return "min(" + max + ", max(" + min + ", " + dice + "))";
}

function resultText(html, includeSecret) {
  if (typeof DOMParser !== "function") {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 3500);
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,iframe,object,template").forEach(node => node.remove());
  if (!includeSecret) doc.querySelectorAll(".secret,[data-secret]").forEach(node => node.remove());
  doc.querySelectorAll("br,p,li,div,section,h1,h2,h3,h4,td").forEach(node => node.append(" "));
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 3500);
}

export async function rollDavokarTable(key, table, plan) {
  const formula = tableRollFormula(key, table, plan.modifier);
  // A nonreplacement table updates shared document state. Keep that action under native GM control.
  if (!formula || !table.replacement) return null;
  const { roll, results } = await table.roll({ roll: new Roll(formula), recursive: false });
  if (!Number.isFinite(roll?.total) || !results?.length) return null;
  const rows = results.map(result => {
    const html = String(result.description || result.text || "");
    return {
      id: result.id,
      name: String(result.name ?? ""),
      uuid: String(result.documentUuid ?? ""),
      text: resultText(html, true),
      publicText: typeof DOMParser === "function" ? resultText(html, false) : ""
    };
  });
  return {
    roll,
    record: {
      formula, total: roll.total, modifiers: plan.modifiers, table: table.name, tableUuid: table.uuid,
      official: isOfficialDavokarTable(key, table), rows
    }
  };
}
