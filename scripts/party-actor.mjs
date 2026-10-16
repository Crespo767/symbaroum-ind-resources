import { ExpeditionJourneyService } from "./expedition-journey.mjs";
import { expeditionTravel, effectiveExpeditionSearch, partyTravelReferences, resolvePartyTravelActors, partyTravelPreview, journeyContextKey, TRAVEL_MODES } from "./travel-context.mjs";
import { MODULE_ID, CANONICAL_EXPEDITION_TABLE_IDS, OFFICIAL_DAVOKAR_EVENT_TABLE_IDS } from "./constants.mjs";
import { ActorPreparation } from "./actor-preparation.mjs";
import { EncumbranceService } from "./encumbrance.mjs";
import { CompatibilityService } from "./compatibility.mjs";
import { evaluateRoll, rollTotal, createChatMessageAfterDice, getRollMode, getRollVisibility } from "./dice.mjs";
import { escapeHtml, localize, format } from "./utils.mjs";
import {
  getDavokarMishapsTableData
} from "./expedition-data.mjs";
import { RationService } from "./rations.mjs";
import { SocketService, getRequestUser, hasOwnerPermission } from "./sockets.mjs";
import { getActorExpeditionData, expeditionDayKey, expeditionOrientationKey, expeditionEventKey, expeditionDayUpdate, runExpeditionOperation } from "./expedition-state.mjs";
import { boundOrientationTarget, orientationRequirements, orientationBoon, orientationContext, rollOrientationTest } from "./expedition-orientation.mjs";
import { expeditionReadKey, sealExpeditionRead, openExpeditionRead, ensureExpeditionPrivateStorage, canReadExpeditionResult, readPrivateExpeditionResult, storePrivateExpeditionResult } from "./expedition-private.mjs";
import { actorReference, actorStateKey, actorMatchesReference, resolveActorReference, resolveActorReferenceSync } from "./actor-references.mjs";
export { getActorExpeditionData } from "./expedition-state.mjs";

/** Tipo de ator declarado em module.json (documentTypes.Actor.party); o core o registra sozinho. */
export const PARTY_ACTOR_TYPE = `${MODULE_ID}.party`;

export function isPartyActor(actor) {
  return actor?.type === PARTY_ACTOR_TYPE;
}

/** Penalidades para Mateiro insuficiente (Guia do Mestre, p.92). Elegibilidade é separada. */
export function calculateBushcraftPenalty(bushcraftLevel = 0, regionKey = "ambria") {
  const requiredLevels = {
    ambria: 0,
    bright: 1,
    wild: 2,
    dark: 3
  };
  const requiredLevel = requiredLevels[regionKey] ?? 0;
  if (requiredLevel === 0) return 0;
  const level = Number(bushcraftLevel) || 0;
  const diff = Math.max(0, requiredLevel - level);
  if (diff === 0) return 0;
  if (diff === 1) return -3;
  return -5;
}

/**
 * Detecta se um ator possui a dádiva Mateiro (Bushcraft) e seu nível (1, 2 ou 3)
 */
export function detectBushcraftTier(actor) {
  const { level, item } = orientationBoon(actor, ["bushcraft", "mateiro"]);
  return { hasBushcraft: level > 0, level, item };
}

/**
 * Calcula o alvo final do teste de Orientação com base no Vigilante do Guia, Mateiro e Região
 */
export function calculateOrientationTarget(vigilant = 10, bushcraftLevel = 0, regionKey = "ambria") {
  const penalty = calculateBushcraftPenalty(bushcraftLevel, regionKey);
  const baseVigilant = Number(vigilant) || 0;
  const target = baseVigilant + penalty;
  return {
    baseVigilant,
    penalty,
    target
  };
}

/**
 * Avalia o resultado da rolagem de 1d20 contra o alvo de Orientação
 */
export function evaluateOrientationRoll(rollTotal, target, { eventBenefits = true, hasSucceeded } = {}) {
  const rollVal = Number(rollTotal) || 0;
  const targetVal = Number(target) || 0;
  const success = hasSucceeded ?? (rollVal <= targetVal);
  const greatSuccess = success && eventBenefits && targetVal - rollVal >= 5;
  const failure = !success;

  let verdict = "failure";
  let ruinsMod = 0;
  let enemiesMod = 0;
  let terrainMod = 0;
  let neutralDetection = false;
  let mishap = true;

  if (greatSuccess) {
    verdict = "greatSuccess";
    ruinsMod = 2;
    enemiesMod = -2;
    terrainMod = -2;
    neutralDetection = true;
    mishap = false;
  } else if (success && eventBenefits) {
    verdict = "success";
    ruinsMod = 2;
    enemiesMod = -1;
    terrainMod = -1;
    neutralDetection = true;
    mishap = false;
  }

  if (success && !eventBenefits) { verdict = "avoidedMishap"; mishap = false; }

  return {
    verdict,
    success,
    greatSuccess,
    failure,
    rollTotal: rollVal,
    target: targetVal,
    margin: targetVal - rollVal,
    ruinsMod,
    enemiesMod,
    terrainMod,
    neutralDetection,
    mishap
  };
}

/**
 * Retorna o modificador regional para a rolagem na Tabela de Infortúnios
 * Regras oficiais do Guia do Mestre (Capítulo 12, p. 92):
 * - Davokar Iluminada: +0
 * - Davokar Selvagem: +5
 * - Davokar Escura: +10
 * - Ambria: +0
 */
export function getMishapsModifier(regionKey = "ambria") {
  const mishapModifiers = {
    ambria: 0,
    bright: 0,
    wild: 5,
    dark: 10
  };
  return mishapModifiers[regionKey] ?? 0;
}

/**
 * Reconhece os nomes históricos da lista de Infortúnios na Davokar,
 * e explicitamente rejeita tabelas militares como Infortúnios do Exército (Tabela 18).
 */
export function isDavokarMishapsTable(nameStr) {
  const name = (nameStr || "").toLowerCase().trim();
  if (!name) return false;

  // Rejeita explicitamente tabelas de batalha, guerra ou exército
  if (name.includes("exército") || name.includes("exercito") || name.includes("army") || name.includes("batalha") || name.includes("guias") || name.includes("guides")) {
    return false;
  }

  // Corresponde a referências explícitas à Tabela 25
  if (name.includes("tabela 25") || name.includes("tabela25") || name.includes("table 25")) {
    return true;
  }

  // Corresponde a infortúnio/mishap específico de Davokar
  if ((name.includes("infortúnio") || name.includes("infortunio") || name.includes("mishap")) && name.includes("davokar")) {
    return true;
  }

  return false;
}

/**
 * Localiza a Tabela de Infortúnios na Davokar (RollTable) no mundo ou no compêndio do módulo.
 * Caso não exista em nenhum lugar, realiza fallback criando-a automaticamente no mundo.
 */
export async function resolveMishapsTable(configuredUuidOrId) {
  const game = globalThis.game;
  if (!game) return null;

  // 1. UUID ou ID explicitamente configurado na ficha
  if (configuredUuidOrId) {
    if (configuredUuidOrId.startsWith("Compendium.") && globalThis.fromUuid) {
      try {
        const doc = await globalThis.fromUuid(configuredUuidOrId);
        if (doc) return doc;
      } catch {}
    }
    const worldTable = game.tables?.get?.(configuredUuidOrId)
      || Array.from(game.tables ?? []).find(t => t.uuid === configuredUuidOrId || t.id === configuredUuidOrId);
    if (worldTable) return worldTable;
    // Uma escolha explícita indisponível não equivale à opção Automático.
    return null;
  }

  // 2. ID canônico no mundo (tblMishapsDav001 ou flag tableKey: "mishaps")
  const canonicalId = CANONICAL_EXPEDITION_TABLE_IDS.mishaps;
  const canonicalWorldTable = game.tables?.get?.(canonicalId)
    || Array.from(game.tables ?? []).find(t => t.id === canonicalId || t.flags?.[MODULE_ID]?.tableKey === "mishaps")
    || game.tables?.get?.("tblMishDav0000001")
    || Array.from(game.tables ?? []).find(t => t.id === "tblMishDav0000001");
  if (canonicalWorldTable) return canonicalWorldTable;

  // 3. ID canônico no compêndio do módulo (symbaroum-ind-resources.expedition-tables)
  const modPack = typeof game.packs?.get === "function"
    ? game.packs.get(`${MODULE_ID}.expedition-tables`)
    : (Array.isArray(game.packs) ? game.packs.find(p => p.metadata?.id === `${MODULE_ID}.expedition-tables` || p.name === "expedition-tables") : null);
  if (modPack && canonicalId) {
    try {
      const entry = await modPack.getDocument(canonicalId);
      if (entry) return entry;
    } catch {}
  }

  // 4. Fallback: cria a lista de Infortúnios com seu ID canônico no mundo (se for GM).
  if (globalThis.RollTable?.create && (game.user?.isGM || game.user?.can?.("TABLE_CREATE"))) {
    try {
      const tableData = getDavokarMishapsTableData();
      const created = await globalThis.RollTable.create(tableData);
      if (created) return created;
    } catch (createErr) {
      console.warn("symbaroum-ind-resources | Falha ao auto-criar Infortúnios:", createErr);
    }
  }

  // Nunca busca por nome difuso em outros compêndios ou no mundo
  return null;
}

/**
 * Executa a rolagem e o saque (draw) na Tabela de Infortúnios do Foundry
 */
export async function drawMishapTable(table, roll, { rollMode, rollUser } = {}) {
  if (!table) return null;
  if (rollUser) {
    // draw preserva reposição e tabelas aninhadas; a mensagem mantém o autor remoto.
    try {
      let result;
      try { result = await table.draw({ roll, displayChat: false }); }
      catch { result = await table.roll({ roll }); }
      const visibility = getRollVisibility(false, rollMode, rollUser);
      return await table.toMessage(result.results, { roll: result.roll, messageData: { user: rollUser.id, ...visibility }, messageOptions: { rollMode: rollMode === "selfroll" ? "gmroll" : rollMode } });
    } catch (error) {
      console.error("symbaroum-ind-resources | Não foi possível rolar a tabela de infortúnios:", error);
      return null;
    }
  }
  try {
    if (table.compendium) {
      const rollResult = await table.roll({ roll });
      return await table.toMessage(rollResult.results, { roll: rollResult.roll });
    }
    return await table.draw({ roll });
  } catch (err) {
    console.warn("symbaroum-ind-resources | Falha ao executar table.draw(), tentando table.roll():", err);
    try {
      const rollResult = await table.roll({ roll });
      return await table.toMessage(rollResult.results, { roll: rollResult.roll });
    } catch (fallbackErr) {
      console.error("symbaroum-ind-resources | Não foi possível rolar a tabela de infortúnios:", fallbackErr);
      return null;
    }
  }
}

/**
 * Detecta se uma RollTable corresponde à Tabela 26 de Ruínas na Davokar
 */
export function isDavokarRuinsTable(target = "") {
  const name = typeof target === "string" ? target : (target?.name || "");
  const n = String(name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (n.includes("tesouro") || n.includes("treasure") || n.includes("explorando") || n.includes("exploring")) return false;
  if (n.includes("codice") || n.includes("codex") || n.includes("cm -") || n.includes("mc -")) return false;
  if (n.includes("tabela 26") || n.includes("tabela26") || n.includes("table 26") || n.includes("table26")) return true;
  if ((n.includes("ruina") || n.includes("ruin")) && (n.includes("davokar") || n.includes("erm"))) return true;
  return false;
}

/**
 * Detecta se uma RollTable corresponde à Tabela 27 de Encontros Neutros na Davokar
 */
export function isDavokarEncountersTable(target = "") {
  const name = typeof target === "string" ? target : (target?.name || "");
  const n = String(name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (n.includes("inimigo") || n.includes("enemy") || n.includes("predador") || n.includes("predator")) return false;
  if (n.includes("codice") || n.includes("codex") || n.includes("cm -") || n.includes("mc -")) return false;
  if (n.includes("batalha") || n.includes("battle") || n.includes("exercito") || n.includes("army")) return false;
  if (n.includes("tabela 27") || n.includes("tabela27") || n.includes("table 27") || n.includes("table27")) return true;
  if ((n.includes("encontro") || n.includes("encounter")) && (n.includes("davokar") || n.includes("neutro") || n.includes("pacifico"))) return true;
  return false;
}

/**
 * Detecta se uma RollTable corresponde à Tabela 28 de Inimigos & Predadores na Davokar
 */
export function isDavokarEnemiesTable(target = "") {
  const name = typeof target === "string" ? target : (target?.name || "");
  const n = String(name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (n.includes("exercito") || n.includes("army") || n.includes("batalha") || n.includes("battle")) return false;
  if (n.includes("codice") || n.includes("codex") || n.includes("cm -") || n.includes("mc -")) return false;
  if (n.includes("tabela 28") || n.includes("tabela28") || n.includes("table 28") || n.includes("table28")) return true;
  if ((n.includes("inimigo") && n.includes("predador")) || (n.includes("enemy") && n.includes("predator"))) return true;
  if ((n.includes("inimigo") || n.includes("enemy") || n.includes("predador") || n.includes("predator")) && n.includes("davokar")) return true;
  return false;
}

/**
 * Detecta se uma RollTable corresponde à Tabela 29 de Terreno & Perigos na Davokar
 */
export function isDavokarTerrainTable(target = "") {
  const name = typeof target === "string" ? target : (target?.name || "");
  const n = String(name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Rejeita explicitamente Códice de Monstros, Perigos na Natureza Corrupta e tabelas militares/infortúnios
  if (n.includes("codice") || n.includes("codex") || n.includes("corrupt") || n.includes("corrompid")) return false;
  if (n.startsWith("cm -") || n.startsWith("mc -") || n.includes("cm -") || n.includes("mc -")) return false;
  if (n.includes("infortunio") || n.includes("mishap") || n.includes("exercito") || n.includes("army")) return false;
  if (n.includes("tabela 29") || n.includes("tabela29") || n.includes("table 29") || n.includes("table29")) return true;
  if ((n.includes("terreno") && n.includes("perigo")) || (n.includes("terrain") && (n.includes("hazard") || n.includes("danger")))) return true;
  if ((n.includes("terreno") || n.includes("terrain")) && (n.includes("davokar") || n.includes("symbaroum"))) return true;
  return false;
}

function isLegacyEventTable(table) {
  const id = table?.id ?? table?._id;
  return Object.keys(OFFICIAL_DAVOKAR_EVENT_TABLE_IDS).some(slot =>
    id === CANONICAL_EXPEDITION_TABLE_IDS[slot] || table?.flags?.[MODULE_ID]?.tableKey === slot);
}

/**
 * Lista todas as RollTables disponíveis no mundo e nos compêndios carregados
 */
export function getAvailableRollTables() {
  const game = globalThis.game;
  if (!game) return [];
  const list = [];

  for (const table of (game.tables ?? [])) {
    if (isLegacyEventTable(table)) continue;
    list.push({
      id: table.id,
      uuid: table.uuid || `RollTable.${table.id}`,
      name: table.name,
      source: "world"
    });
  }

  for (const pack of (game.packs ?? [])) {
    if (pack.documentName !== "RollTable") continue;
    const packLabel = pack.title || pack.metadata?.label || pack.metadata?.name || pack.name;
    const index = pack.index ? (Array.isArray(pack.index) ? pack.index : Array.from(pack.index.values ? pack.index.values() : pack.index)) : [];
    for (const entry of index) {
      if (isLegacyEventTable(entry)) continue;
      list.push({
        id: entry._id,
        uuid: `Compendium.${pack.metadata?.id || pack.collection}.${entry._id}`,
        name: `${entry.name} [${packLabel}]`,
        source: "compendium"
      });
    }
  }

  return list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/**
 * Localiza a RollTable adequada para um dos 4 slots de eventos da Davokar
 */
export async function resolveDavokarEventTable(slot, configuredUuidOrId) {
  const game = globalThis.game;
  if (!game) return null;

  const legacyId = CANONICAL_EXPEDITION_TABLE_IDS[slot];
  if (configuredUuidOrId === legacyId || configuredUuidOrId === `RollTable.${legacyId}`
    || configuredUuidOrId === `Compendium.${MODULE_ID}.expedition-tables.${legacyId}`
    || configuredUuidOrId === `Compendium.${MODULE_ID}.expedition-tables.RollTable.${legacyId}`) configuredUuidOrId = "";

  // 1. UUID ou ID explicitamente configurado na ficha do grupo
  if (configuredUuidOrId) {
    if (configuredUuidOrId.startsWith("Compendium.") && globalThis.fromUuid) {
      try {
        const doc = await globalThis.fromUuid(configuredUuidOrId);
        if (doc && !isLegacyEventTable(doc)) return doc;
        if (doc && isLegacyEventTable(doc)) return resolveDavokarEventTable(slot);
      } catch {}
    }
    const worldTable = game.tables?.get?.(configuredUuidOrId)
      || Array.from(game.tables ?? []).find(t => t.uuid === configuredUuidOrId || t.id === configuredUuidOrId);
    if (worldTable && !isLegacyEventTable(worldTable)) return worldTable;
    if (worldTable && isLegacyEventTable(worldTable)) return resolveDavokarEventTable(slot);
    // Deixa o chamador avisar sobre a seleção quebrada em vez de sortear em outra tabela.
    return null;
  }

  // Existing selections pointing at IND-generated copies now use the official default.
  const officialId = OFFICIAL_DAVOKAR_EVENT_TABLE_IDS[slot];
  if (!officialId) return null;
  const worldTable = game.tables?.get?.(officialId)
    || Array.from(game.tables ?? []).find(t => t.id === officialId || t._id === officialId
      || t._stats?.compendiumSource === `RollTable.${officialId}`);
  if (worldTable) return worldTable;

  // The installed GMG ships an Adventure: its tables become world documents after import.
  // Also support editions exposing a separate RollTable pack, without copying documents.
  const packs = game.packs?.values ? Array.from(game.packs.values()) : Array.from(game.packs ?? []);
  for (const pack of packs) {
    if (pack.documentName !== "RollTable" || !(pack.collection || pack.metadata?.id || "").startsWith("symbaroum-gmg.")) continue;
    try {
      const table = await pack.getDocument(officialId);
      if (table) return table;
    } catch {}
  }
  return null;
}

/**
 * Calcula os modificadores numéricos e as fórmulas das 4 tabelas de eventos da Davokar
 */
export function calculateDavokarEventModifiers({ regionKey = "bright", orientationVerdict = "failure", activeSearch = true, alongRiver = false }) {
  const regionModifiers = {
    ambria: 0,
    bright: 0,
    wild: 2,
    dark: 5
  };
  const regionMod = regionModifiers[regionKey] ?? 0;
  const isOrientationSuccess = orientationVerdict === "success" || orientationVerdict === "greatSuccess";
  const isOrientationGreat = orientationVerdict === "greatSuccess";

  let ruinsOrientationBonus = 0;
  let ruinsSearchPenalty = 0;
  if (activeSearch) {
    if (isOrientationSuccess) ruinsOrientationBonus = 2;
  } else {
    ruinsSearchPenalty = -5;
  }
  const ruinsTotalMod = regionMod + ruinsSearchPenalty + ruinsOrientationBonus;
  const encountersTotalMod = regionMod;

  let enemiesOrientationMod = 0;
  if (isOrientationGreat) enemiesOrientationMod = -2;
  else if (isOrientationSuccess) enemiesOrientationMod = -1;
  const enemiesTotalMod = regionMod + enemiesOrientationMod;

  let terrainOrientationMod = 0;
  if (isOrientationGreat) terrainOrientationMod = -2;
  else if (isOrientationSuccess) terrainOrientationMod = -1;
  const riverMod = alongRiver && regionKey !== "ambria" ? 2 : 0;
  const terrainTotalMod = regionMod + terrainOrientationMod + riverMod;

  const formatFormula = (mod) => {
    if (mod > 0) return `1d20 + ${mod}`;
    if (mod < 0) return `1d20 - ${Math.abs(mod)}`;
    return "1d20";
  };

  return {
    regionMod,
    activeSearch,
    ruins: {
      totalMod: ruinsTotalMod,
      formula: formatFormula(ruinsTotalMod),
      regionMod,
      searchMod: ruinsSearchPenalty,
      orientationMod: ruinsOrientationBonus
    },
    encounters: {
      totalMod: encountersTotalMod,
      formula: formatFormula(encountersTotalMod),
      regionMod,
      earlyDetection: isOrientationSuccess
    },
    enemies: {
      totalMod: enemiesTotalMod,
      formula: formatFormula(enemiesTotalMod),
      regionMod,
      orientationMod: enemiesOrientationMod
    },
    terrain: {
      totalMod: terrainTotalMod,
      formula: formatFormula(terrainTotalMod),
      regionMod,
      riverMod,
      orientationMod: terrainOrientationMod
    }
  };
}

/**
 * Executa o sorteio de resultado de uma RollTable e extrai o texto e imagem
 */
export async function drawTableResult(table, roll) {
  if (!table) return { results: [], text: "Tabela não encontrada", img: "icons/svg/d20-grey.svg" };
  const total = Number(roll?.total ?? rollTotal(roll));
  let results = [];

  // 1. Prioriza getResultsForRoll(total) para garantir correspondência exata com o dado já rolado
  // (evita que table.roll() internamente force um reroll() aleatório descartando o roll avaliado)
  if (typeof table.getResultsForRoll === "function") {
    try {
      results = table.getResultsForRoll(total) || [];
      // Se a tabela tiver itens marcados como 'drawn: true', recupera sem o filtro de drawn
      if (!results.length && table.results) {
        const contents = Array.from(table.results.values ? table.results.values() : (table.results.contents || table.results || []));
        results = contents.filter(r => {
          const min = r.range?.[0] ?? 0;
          const max = r.range?.[1] ?? 0;
          return total >= min && total <= max;
        });
      }
    } catch (e) {
      console.warn("symbaroum-ind-resources | Falha em table.getResultsForRoll:", e);
    }
  }

  // 2. Se o total rolado estiver fora da faixa dos resultados (ex: modificador negativo ou muito alto),
  // ajusta para o resultado do extremo mais próximo (mínimo ou máximo)
  if (!results.length && table.results) {
    const contents = Array.from(table.results.values ? table.results.values() : (table.results.contents || table.results || []));
    if (contents.length > 0) {
      const sorted = [...contents].sort((a, b) => (a.range?.[0] ?? 0) - (b.range?.[0] ?? 0));
      const minEntry = sorted[0];
      const maxEntry = sorted[sorted.length - 1];
      if (minEntry && total < (minEntry.range?.[0] ?? 1)) {
        results = [minEntry];
      } else if (maxEntry && total > (maxEntry.range?.[1] ?? 20)) {
        results = [maxEntry];
      }
    }
  }

  // 3. Fallback: se a tabela não tiver getResultsForRoll ou não encontrou por faixa
  if (!results.length) {
    try {
      const rollResult = await table.roll?.({ roll });
      results = rollResult?.results || [];
    } catch (err) {
      try {
        const drawResult = await table.draw?.({ roll, displayChat: false });
        results = drawResult?.results || [];
      } catch (e2) {
        console.error("symbaroum-ind-resources | Falha ao rolar tabela:", e2);
        return { results: [], text: "Erro ao rolar tabela", img: "icons/svg/d20-grey.svg" };
      }
    }
  }

  const textPieces = [];
  const displayPieces = [];
  let resultImg = table.img || "icons/svg/d20-grey.svg";
  for (const r of results) {
    let txt = r.text || r.description || r.name || "";
    if (!txt && typeof r.getHTML === "function") {
      try {
        const el = await r.getHTML();
        txt = typeof el === "string" ? el : (el?.textContent || el?.innerText || "");
      } catch {}
    }
    if (!txt && typeof r.getChatText === "function") {
      try { txt = r.getChatText(); } catch {}
    }
    const displayText = String(txt || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "").replace(/[^\S\n]+/g, " ").replace(/ *\n */g, "\n").replace(/\n+/g, "\n").trim();
    if (displayText) displayPieces.push(displayText);
    txt = (txt || "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/\r?\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (txt) textPieces.push(txt);
    if (r.img && !r.img.includes("/d20") && !r.img.endsWith("mystery-man.svg")) {
      resultImg = r.img;
    }
  }

  return {
    results,
    text: textPieces.join("; ") || "Sem resultado",
    displayText: displayPieces.join("\n\n"),
    img: resultImg
  };
}

/**
 * Monta o HTML do Card de Chat dos Eventos Diários na Davokar
 */
export function buildEventsChatHtml({
  day = 1,
  regionKey = "bright",
  activeSearch = true,
  guideName = "Guia",
  results = []
}) {
  const regionNames = {
    ambria: globalThis.game?.i18n?.localize?.("TENEBRE.Party.RegionNameAmbria") || "Ambria",
    bright: globalThis.game?.i18n?.localize?.("TENEBRE.Party.RegionNameBright") || "Davokar Iluminada",
    wild: globalThis.game?.i18n?.localize?.("TENEBRE.Party.RegionNameWild") || "Davokar Selvagem",
    dark: globalThis.game?.i18n?.localize?.("TENEBRE.Party.RegionNameDark") || "Davokar Escura"
  };
  const rawRegion = regionNames[regionKey] || regionKey;
  const regionName = String(rawRegion).replace(/\s*\([±+\-]\d+\)/, "").trim();

  const title = globalThis.game?.i18n?.localize?.("TENEBRE.Party.EventsCardTitle") || "Eventos Diários na Davokar";
  const searchStatus = activeSearch
    ? (globalThis.game?.i18n?.localize?.("TENEBRE.Party.ActiveSearchActive") || "Busca Ativa de Ruínas: Sim")
    : (globalThis.game?.i18n?.localize?.("TENEBRE.Party.ActiveSearchInactive") || "Busca Ativa de Ruínas: Não (-5)");

  let itemsHtml = "";
  for (const r of results) {
    itemsHtml += `
      <div class="tenebre-event-result-item slot-${escapeHtml(r.slotKey)}">
        <div class="event-item-header">
          <i class="${escapeHtml(r.icon)}"></i>
          <span class="event-item-title">${escapeHtml(r.title)}</span>
        </div>
        <div class="event-item-body">
          <p class="event-item-text">${escapeHtml(r.displayText || r.resultText)}</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="tenebre-events-chat">
      <div class="tenebre-events-content">
        <div class="tenebre-events-card">
          <h3 class="tenebre-events-title">${escapeHtml(title)}</h3>
          <p class="tenebre-events-subtitle">${escapeHtml(format("TENEBRE.Party.EventsContext", "Dia {day} • {region} • Guia: {guide}", { day, region: regionName, guide: guideName }))}</p>
          <div class="tenebre-events-meta-badge">
            <span class="meta-tag"><i class="fas fa-search-location"></i> ${escapeHtml(searchStatus)}</span>
          </div>

          <div class="tenebre-events-results-container">
            ${itemsHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}


/**
 * Monta o HTML do Card de Chat do Teste de Orientação
 */
export function buildOrientationChatHtml({ guideActor, regionKey = "ambria", bushcraft = {}, rollVal, target, evalResult, activeSearch = true }) {
  const text = (key, fallback) => localize(`TENEBRE.Party.${key}`, fallback);
  const regionName = text({ ambria: "RegionNameAmbria", bright: "RegionNameBright", wild: "RegionNameWild", dark: "RegionNameDark" }[regionKey] ?? "RegionNameAmbria", {ambria:"Ambria",bright:"Davokar Iluminada",wild:"Davokar Selvagem",dark:"Davokar Escura"}[regionKey] ?? regionKey);
  const verdict = ["success", "greatSuccess", "avoidedMishap"].includes(evalResult.verdict) ? evalResult.verdict : "failure";
  const verdictTitle = text({ success: "OrientationSuccess", greatSuccess: "OrientationGreatSuccess", avoidedMishap: "OrientationAvoidedMishap", failure: "OrientationFailure" }[verdict], {success:"Sucesso",greatSuccess:"Grande sucesso",avoidedMishap:"Infortúnio evitado",failure:"Falha"}[verdict]);
  const bushcraftText = bushcraft.hasBushcraft ? `${text("BushcraftLabel", "Mateiro")} ${bushcraft.levelRoman}` : text("NoBushcraft", "Sem Mateiro");
  const context = bushcraft.context ?? {};
  const signed = value => Number(value) > 0 ? `+${Number(value)}` : String(Number(value) || 0);
  const row = (label, value) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
  const calculation = [row(localize("ATTRIBUTE.VIGILANT", "Vigilante"), Number(bushcraft.baseVigilant) || 0)];
  if (bushcraft.penalty) calculation.push(row(text("OrientationInsufficientRank", "Mateiro insuficiente para a região"), signed(bushcraft.penalty)));
  for (const bonus of context.bonuses ?? []) {
    calculation.push(row(bonus.name, bonus.additional ? signed(bonus.additional) : text("OrientationAlreadyIncluded", "Já incluído em Vigilante")));
  }
  if (context.circumstanceModifier) calculation.push(row(text("OrientationModifier", "Modificador circunstancial"), signed(context.circumstanceModifier)));
  const expectedTarget = (Number(bushcraft.baseVigilant) || 0) + (Number(bushcraft.penalty) || 0) + (Number(context.bonus) || 0) + (Number(context.circumstanceModifier) || 0);
  if (Number(target) !== expectedTarget) calculation.push(row(text("OrientationSystemAdjustment", "Ajuste do sistema ao alvo"), signed(Number(target) - expectedTarget)));
  const diceLabel = context.favour > 0 ? text("OrientationDiceBest", "2d20: usa o menor resultado") : context.favour < 0 ? text("OrientationDiceWorst", "2d20: usa o maior resultado") : "1d20";
  const diceReason = context.favour > 0 && context.pathfinder ? text("OrientationPathfinder", "Desbravador") : context.favour < 0 ? localize("TENEBRE.Hunger.EffectName", "Fome") : "";
  const consequences = [];
  if (evalResult.neutralDetection) {
    consequences.push(activeSearch
      ? `${text("RuinsBonus", "Ruínas")}: ${signed(evalResult.ruinsMod)}`
      : text("OrientationRuinsInactive", "Ruínas: sem bônus de orientação, pois a busca está inativa."));
    consequences.push(`${text("EnemiesBonus", "Inimigos")}: ${signed(evalResult.enemiesMod)}`);
    consequences.push(`${text("TerrainBonus", "Terreno")}: ${signed(evalResult.terrainMod)}`);
    consequences.push(text("OrientationDetectionTest", "Permite um teste para detectar encontros."));
  } else if (!evalResult.mishap) {
    consequences.push(text("OrientationAvoidedMishapDesc", "O guia evita o Infortúnio, mas o nível insuficiente de Mateiro não concede os benefícios nos eventos."));
  } else {
    consequences.push(text("OrientationNoBenefits", "Sem benefícios de orientação nos eventos."));
    const modifier = getMishapsModifier(regionKey);
    consequences.push(format("TENEBRE.Party.OrientationMishapRoll", "Infortúnio: {formula}. Consulte o resultado da tabela no chat.", { formula: modifier ? `1d20 + ${modifier}` : "1d20" }));
    consequences.push(text("OrientationNotLost", "A falha, por si só, não aplica o efeito Perdido."));
  }
  return `<div class="symbaroum chat ability tenebre-orientation-chat">
    <div class="foreground">
      <section class="tenebre-orientation-card orientation-${verdict}">
        <header class="tenebre-orientation-heading">
          <img src="${escapeHtml(guideActor?.img || "icons/svg/mystery-man.svg")}" alt="" loading="lazy">
          <div><h3>${escapeHtml(text("OrientationCardTitle", "Orientação"))}</h3><p>${escapeHtml(guideActor?.name || text("GuideBadgeLabel", "Guia"))}</p></div>
        </header>
        <p class="tenebre-orientation-location">${escapeHtml(regionName)} · ${escapeHtml(bushcraftText)}</p>
        <dl class="tenebre-orientation-calculation">${calculation.join("")}</dl>
        <div class="tenebre-orientation-numbers">
          <div><span>${escapeHtml(text("OrientationTargetLabel", "Alvo final"))}</span><strong>${escapeHtml(target)}</strong></div>
          <div><span>${escapeHtml(text("OrientationResultLabel", "Resultado"))}</span><strong>${escapeHtml(rollVal)}</strong></div>
        </div>
        <p class="tenebre-orientation-dice">${escapeHtml(diceLabel)}${diceReason ? ` · ${escapeHtml(diceReason)}` : ""}</p>
        <h4 class="tenebre-orientation-verdict">${escapeHtml(verdictTitle)}</h4>
        <div class="tenebre-orientation-consequences">
          <h5>${escapeHtml(text("OrientationConsequences", "Consequências"))}</h5>
          <ul>${consequences.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
          ${evalResult.neutralDetection ? `<p class="tenebre-orientation-note">${escapeHtml(text("OrientationEventModifiersOnly", "Estes modificadores se aplicam às tabelas de eventos, não ao teste de orientação."))}</p>` : ""}
        </div>
      </section>
    </div>
  </div>`;
}


/** Presets oficiais de locais de armazenamento (veículos, animais, recipientes) */
export const OFFICIAL_STORAGE_PRESETS = [
  { id: "cart", name: "Carroça", category: "vehicle", capacity: 200, img: "icons/environment/settlement/wagon.webp" },
  { id: "wagon", name: "Carruagem / Carreta", category: "vehicle", capacity: 500, img: "icons/environment/settlement/wagon.webp" },
  { id: "canoe", name: "Canoa", category: "vehicle", capacity: 60, img: "icons/svg/anchor.svg" },
  { id: "rowboat", name: "Barco a Remo", category: "vehicle", capacity: 120, img: "icons/svg/anchor.svg" },
  { id: "riverboat", name: "Barco de Rio", category: "vehicle", capacity: 600, img: "icons/environment/settlement/ship.webp" },
  { id: "sledge", name: "Trenó", category: "vehicle", capacity: 150, img: "icons/environment/settlement/wagon.webp" },
  { id: "mule", name: "Mula de Carga", category: "animal", capacity: 80, img: "icons/environment/creatures/horse-brown.webp" },
  { id: "horse", name: "Cavalo de Carga", category: "animal", capacity: 80, img: "icons/environment/creatures/horse-brown.webp" },
  { id: "ox", name: "Boi de Tração", category: "animal", capacity: 100, img: "icons/environment/creatures/horse-brown.webp" },
  { id: "large-chest", name: "Baú Grande", category: "container", capacity: 30, img: "icons/containers/chest/chest-reinforced-steel-brown.webp" },
  { id: "barrel", name: "Barril", category: "container", capacity: 25, img: "icons/containers/barrels/barrel-reinforced-cherry-brown.webp" },
  { id: "chest", name: "Baú de Viagem", category: "container", capacity: 20, img: "icons/containers/chest/chest-reinforced-steel-brown.webp" },
  { id: "sack", name: "Saco Grande", category: "container", capacity: 10, img: "icons/svg/item-bag.svg" }
];

export function detectStorageCategory(name = "", type = "") {
  const norm = (name || "").toLowerCase().trim();
  if (type === "monster" || norm.includes("cavalo") || norm.includes("mula") || norm.includes("burro") || norm.includes("asno") || norm.includes("boi") || norm.includes("besta") || norm.includes("animal") || norm.includes("horse") || norm.includes("mule") || norm.includes("donkey") || norm.includes("ox")) {
    return "animal";
  }
  if (norm.includes("carroça") || norm.includes("carroca") || norm.includes("carreta") || norm.includes("carruagem") || norm.includes("canoa") || norm.includes("barco") || norm.includes("navio") || norm.includes("embarcação") || norm.includes("embarcacao") || norm.includes("trenó") || norm.includes("treno") || norm.includes("cart") || norm.includes("wagon") || norm.includes("canoe") || norm.includes("boat") || norm.includes("sledge") || norm.includes("ship")) {
    return "vehicle";
  }
  if (norm.includes("baú") || norm.includes("bau") || norm.includes("barril") || norm.includes("caixa") || norm.includes("caixote") || norm.includes("saco") || norm.includes("mochila") || norm.includes("cesto") || norm.includes("chest") || norm.includes("barrel") || norm.includes("crate") || norm.includes("sack") || norm.includes("bag") || norm.includes("basket")) {
    return "container";
  }
  return "custom";
}

export function detectStorageCapacity(name = "", type = "") {
  const norm = (name || "").toLowerCase().trim();
  // Veículos de grande porte
  if (norm.includes("carruagem") || norm.includes("carreta") || norm.includes("wagon")) return 500;
  if (norm.includes("barco de rio") || norm.includes("riverboat") || norm.includes("navio") || norm.includes("ship")) return 600;
  if (norm.includes("carroça") || norm.includes("carroca") || norm.includes("cart")) return 200;
  if (norm.includes("trenó") || norm.includes("treno") || norm.includes("sledge")) return 150;
  if (norm.includes("barco a remo") || norm.includes("barco") || norm.includes("rowboat") || norm.includes("rowingboat")) return 120;
  if (norm.includes("canoa") || norm.includes("canoe")) return 60;

  // Animais
  if (norm.includes("boi") || norm.includes("búfalo") || norm.includes("bufalo") || norm.includes("ox")) return 100;
  if (norm.includes("mula") || norm.includes("burro") || norm.includes("asno") || norm.includes("cavalo") || norm.includes("horse") || norm.includes("mule") || norm.includes("donkey")) return 80;

  // Recipientes
  if (norm.includes("baú grande") || norm.includes("bau grande") || norm.includes("large chest")) return 30;
  if (norm.includes("barril") || norm.includes("barrel")) return 25;
  if (norm.includes("baú") || norm.includes("bau") || norm.includes("caixa") || norm.includes("caixote") || norm.includes("chest") || norm.includes("crate")) return 20;
  if (norm.includes("saco") || norm.includes("mochila") || norm.includes("cesto") || norm.includes("sack") || norm.includes("basket")) return 10;

  // Fallbacks por tipo
  if (type === "monster") return 80;
  if (type === "player") return 40;
  return 100;
}

/**
 * DataModel do ator de Grupo.
 */
export class PartyDataModel extends (globalThis.foundry?.abstract?.TypeDataModel ?? class {}) {
  static defineSchema() {
    const fields = globalThis.foundry?.data?.fields;
    if (!fields) return {};
    const schema = {
      motto: fields.StringField ? new fields.StringField({ initial: "" }) : "",
      description: fields.HTMLField ? new fields.HTMLField({ initial: "" }) : "",
      members: fields.ArrayField && fields.StringField ? new fields.ArrayField(new fields.StringField(), { initial: [] }) : [],
      companions: fields.ArrayField && fields.StringField ? new fields.ArrayField(new fields.StringField(), { initial: [] }) : []
    };
    if (fields.BooleanField) {
      schema.isParty = new fields.BooleanField({ initial: true });
    }
    if (fields.SchemaField && fields.NumberField) {
      schema.experience = new fields.SchemaField({
        total: new fields.NumberField({ initial: 0, integer: true, min: 0 }),
        artifactrr: new fields.NumberField({ initial: 0, integer: true, min: 0 }),
        spent: new fields.NumberField({ initial: 0, integer: true, min: 0 }),
        available: new fields.NumberField({ initial: 0, integer: true })
      });
      schema.health = new fields.SchemaField({
        toughness: new fields.SchemaField({
          value: new fields.NumberField({ initial: 0, integer: true }),
          max: new fields.NumberField({ initial: 0, integer: true })
        })
      });
      schema.storageLocation = new fields.SchemaField({
        id: fields.StringField ? new fields.StringField({ initial: "" }) : "",
        uuid: fields.StringField ? new fields.StringField({ initial: "" }) : "",
        name: fields.StringField ? new fields.StringField({ initial: "" }) : "",
        img: fields.StringField ? new fields.StringField({ initial: "" }) : "",
        type: fields.StringField ? new fields.StringField({ initial: "" }) : "",
        category: fields.StringField ? new fields.StringField({ initial: "" }) : "",
        capacity: fields.NumberField ? new fields.NumberField({ initial: 0, min: 0 }) : 0,
        draftAnimal: fields.ObjectField ? new fields.ObjectField({ initial: {} }) : {}
      });
      schema.location = new fields.SchemaField({
        region: fields.StringField ? new fields.StringField({ initial: "ambria" }) : "ambria",
        name: fields.StringField ? new fields.StringField({ initial: "" }) : ""
      });
      schema.expedition = new fields.SchemaField({
        active: fields.BooleanField ? new fields.BooleanField({ initial: false }) : false,
        day: fields.NumberField ? new fields.NumberField({ initial: 0, integer: true, min: 0 }) : 0,
        guideId: fields.StringField ? new fields.StringField({ initial: "" }) : "",
        guideUuid: fields.StringField ? new fields.StringField({ initial: "" }) : "",
        dayState: fields.ObjectField ? new fields.ObjectField({ initial: {} }) : {}
      });
    }
    return schema;
  }

  /** Chamado pelo core depois do prepareDerivedData do ator. */
  prepareDerivedData() {
    this.isParty = true;
    this.members ??= [];
    this.companions ??= [];
    this.storageLocation ??= {
      id: "",
      uuid: "",
      name: "",
      img: "",
      type: "",
      category: "",
      capacity: 0,
      draftAnimal: null
    };
    this.location ??= {
      region: "ambria",
      name: ""
    };
    if (!this.location.region) this.location.region = "ambria";
    this.expedition ??= {
      active: false,
      day: 0,
      guideId: "",
      guideUuid: "",
      dayState: {}
    };
    this.expedition.active ??= false;
    this.expedition.day ??= 0;
    this.expedition.dayState ??= {};
    this.experience ??= { total: 0, artifactrr: 0, spent: 0, available: 0 };
    const exp = this.experience;
    exp.available = (Number(exp.total) || 0) - (Number(exp.artifactrr) || 0) - (Number(exp.spent) || 0);
    this.health ??= { toughness: { value: 0, max: 0 } };
    this.health.toughness ??= { value: 0, max: 0 };
  }
}

/**
 * Ficha do Ator de Grupo (Sheet).
 * Usa o layout visual e estilos padrão do Symbaroum.
 */
const BaseActorSheet = globalThis.foundry?.appv1?.sheets?.ActorSheet ?? globalThis.ActorSheet ?? class {};

export class PartyActorSheet extends BaseActorSheet {
  static get defaultOptions() {
    const superOptions = super.defaultOptions ?? {};
    return globalThis.foundry?.utils?.mergeObject(superOptions, {
      classes: ["symbaroum", "sheet", "actor", "player", "party", "tenebre-party-sheet"],
      template: `modules/${MODULE_ID}/templates/party-sheet.hbs`,
      width: 800,
      height: 620,
      resizable: true,
      dragDrop: [{ dragSelector: ".item[data-item-id], .party-member-card[data-actor-id]", dropSelector: null }],
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "characters"
        }
      ]
    }) ?? {
      classes: ["symbaroum", "sheet", "actor", "player", "party", "tenebre-party-sheet"],
      template: `modules/${MODULE_ID}/templates/party-sheet.hbs`,
      width: 800,
      height: 620,
      resizable: true,
      dragDrop: [{ dragSelector: ".item[data-item-id], .party-member-card[data-actor-id]", dropSelector: null }],
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "characters"
        }
      ]
    };
  }

  /**
   * Retorna a modificação numérica das tabelas da Davokar para uma região.
   * @param {string} regionKey
   * @returns {number}
   */
  static getRegionModifier(regionKey) {
    switch (regionKey) {
      case "dark": return 5;
      case "wild": return 2;
      case "bright": return 0;
      case "ambria":
      default: return 0;
    }
  }

  _resolveActor(actorId) {
    return resolveActorReferenceSync(actorId) ?? this._resolvedActors?.get(actorId) ?? null;
  }

  _getExpeditionData() {
    return getActorExpeditionData(this.actor);
  }

  _prepareMemberCardData(memberActor, isCompanion = false) {
    const sys = memberActor.system ?? {};
    const bio = sys.bio ?? {};
    const exp = sys.experience ?? {};
    const totalXp = Number(exp.total) || 0;
    const availableXp = exp.available !== undefined
      ? (Number(exp.available) || 0)
      : (exp.spent !== undefined ? Math.max(0, totalXp - (Number(exp.spent) || 0) - (Number(exp.artifactrr) || 0)) : totalXp);
    const occupation = (bio.occupation && typeof bio.occupation === "string") ? bio.occupation.trim() : (typeof sys.occupation === "string" ? sys.occupation.trim() : "");
    const race = (bio.race && typeof bio.race === "string") ? bio.race.trim() : (typeof sys.race === "string" ? sys.race.trim() : "");
    const defaultLabel = globalThis.game?.i18n?.localize?.("TENEBRE.Party.CompanionsSectionTitle") || "Companheiro";
    const occupationDisplay = occupation || race || (memberActor.type === "monster" ? defaultLabel : "");
    const topAttributes = this._getMemberTopAttributes(memberActor, 4);
    const canRoll = Boolean(memberActor.isOwner || globalThis.game?.user?.isGM);
    const expData = this._getExpeditionData();
    const isGuide = actorMatchesReference(memberActor, expData.guideUuid || expData.guideId);

    // Vitalidade / Tenacidade (Toughness)
    const toughnessData = sys.health?.toughness ?? {};
    const toughnessVal = Number(toughnessData.value) || 0;
    const toughnessMax = Number(toughnessData.max) || 0;
    const toughnessThreshold = Number(toughnessData.threshold) || 0;
    const toughnessPct = toughnessMax > 0
      ? Math.max(0, Math.min(100, Math.round((toughnessVal / toughnessMax) * 100)))
      : (toughnessVal > 0 ? 100 : 0);
    const isWounded = toughnessThreshold > 0 && toughnessVal <= toughnessThreshold;

    // Corrupção (Corruption)
    const corruptionData = sys.health?.corruption ?? {};
    const permCorr = Number(corruptionData.permanent) || 0;
    const tempCorr = Number(corruptionData.temporary) || 0;
    const longCorr = Number(corruptionData.longterm) || 0;
    const corruptionVal = corruptionData.value !== undefined ? (Number(corruptionData.value) || 0) : (permCorr + tempCorr + longCorr);
    const corruptionThreshold = Number(corruptionData.threshold) || 0;
    const corruptionMax = Number(corruptionData.max) || 0;
    const corruptionCap = corruptionMax > 0 ? corruptionMax : (corruptionThreshold > 0 ? corruptionThreshold * 2 : 10);
    const corruptionPct = corruptionCap > 0
      ? Math.max(0, Math.min(100, Math.round((corruptionVal / corruptionCap) * 100)))
      : 0;
    const isCorruptionOverThreshold = corruptionThreshold > 0 && corruptionVal >= corruptionThreshold;

    return {
      id: actorReference(memberActor),
      stateKey: actorStateKey(memberActor),
      uuid: memberActor.uuid,
      name: memberActor.name,
      img: memberActor.img || "icons/svg/mystery-man.svg",
      occupation: occupationDisplay,
      totalXp: totalXp,
      availableXp: availableXp,
      hasXp: totalXp > 0 || Boolean(exp.total),
      isCompanion: isCompanion,
      isGuide: isGuide,
      isMonster: memberActor.type === "monster",
      topAttributes: topAttributes,
      health: {
        toughness: {
          value: toughnessVal,
          max: toughnessMax,
          threshold: toughnessThreshold,
          pct: toughnessPct,
          isWounded: isWounded
        },
        corruption: {
          value: corruptionVal,
          max: corruptionMax,
          threshold: corruptionThreshold,
          pct: corruptionPct,
          isOverThreshold: isCorruptionOverThreshold
        }
      },
      canRoll: canRoll,
      isOwner: canRoll,
      actor: memberActor,
      system: sys
    };
  }

  async getData(options) {
    const data = await super.getData?.(options) ?? {};
    // fromUuidSync não carrega documentos de compêndio ainda ausentes do cache.
    const expRefs = this._getExpeditionData();
    const storage = this.actor?.system?.storageLocation;
    const refs = [...(this.actor?.system?.members ?? []), ...(this.actor?.system?.companions ?? []),
      ...partyTravelReferences(this.actor), expRefs.guideUuid || expRefs.guideId, storage?.uuid, storage?.draftAnimal?.uuid].filter(Boolean);
    this._resolvedActors = new Map(await Promise.all([...new Set(refs)].map(async ref => [ref, await resolveActorReference(ref)])));
    data.id = this.actor?.id;
    data.actor = this.actor;
    data.system = this.actor?.system;
    data.cssClass = this.isEditable ? "editable" : "locked";
    data.editable = this.isEditable;

    const memberIds = Array.isArray(this.actor?.system?.members) ? this.actor.system.members : [];
    const members = [];
    for (const memberId of memberIds) {
      const memberActor = this._resolveActor(memberId);
      if (memberActor) {
        members.push(this._prepareMemberCardData(memberActor, false));
      }
    }
    data.members = members;

    const companionIds = Array.isArray(this.actor?.system?.companions) ? this.actor.system.companions : [];
    const companions = [];
    for (const companionId of companionIds) {
      const companionActor = this._resolveActor(companionId);
      if (companionActor) {
        companions.push(this._prepareMemberCardData(companionActor, true));
      }
    }
    data.companions = companions;

    const rawItems = Array.from(this.actor?.items?.values?.() ?? []);
    const items = rawItems.map(item => {
      const sys = item.system ?? {};
      const type = item.type;
      const rawQuantity = Number(sys.number ?? sys.quantity ?? 1);
      const quantity = Number.isFinite(rawQuantity) ? Math.max(0, rawQuantity) : 1;
      const detail = this._getItemDetail(item);
      const typeLabel = this._getItemTypeLabel(type);

      return {
        id: item.id,
        uuid: item.uuid,
        name: item.name,
        img: item.img || "icons/svg/item-bag.svg",
        type: type,
        typeLabel: typeLabel,
        quantity: quantity,
        detail: detail,
        system: sys,
        item: item
      };
    }).sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));

    const weapons = items.filter(i => i.type === "weapon");
    const armors = items.filter(i => i.type === "armor");
    const artifacts = items.filter(i => i.type === "artifact" || i.system?.isArtifact);
    const equipments = items.filter(i => i.type !== "weapon" && i.type !== "armor" && i.type !== "artifact" && !i.system?.isArtifact);

    const categories = [
      { key: "weapons", label: "TITLE.WEAPONS", icon: "fas fa-shield-alt", items: weapons },
      { key: "armors", label: "TITLE.ARMORS", icon: "fas fa-shield", items: armors },
      { key: "artifacts", label: "TITLE.ARTIFACTS", icon: "fas fa-ring", items: artifacts },
      { key: "equipments", label: "TITLE.EQUIPMENTS", icon: "fas fa-boxes", items: equipments }
    ].filter(cat => cat.items.length > 0);

    data.inventoryItems = items;
    data.inventoryCategories = categories;

    // Calcula a carga total dos itens do inventário do grupo
    let totalWeight = 0;
    for (const entry of items) {
      let weight;
      try {
        if (typeof EncumbranceService?.getItemStackSlots === "function") {
          weight = EncumbranceService.getItemStackSlots(entry.item);
        }
      } catch {}
      if (!Number.isFinite(weight) || weight < 0) {
        weight = entry.quantity;
      }
      totalWeight += Number(weight) || 0;
    }
    totalWeight = Math.round(totalWeight * 10) / 10;

    const rawStorage = this.actor?.system?.storageLocation ?? {};
    const storageName = (rawStorage.name || "").trim();
    const hasStorage = Boolean(storageName || rawStorage.uuid || rawStorage.id);
    const storageCapacity = Number(rawStorage.capacity) || 0;
    const isOverloaded = storageCapacity > 0 ? (totalWeight > storageCapacity) : false;
    const storagePct = storageCapacity > 0 ? Math.min(Math.round((totalWeight / storageCapacity) * 100), 100) : (totalWeight > 0 ? 100 : 0);

    const categoryLabels = {
      vehicle: globalThis.game?.i18n?.localize?.("TENEBRE.Party.StorageCategoryVehicle") || "Veículo",
      animal: globalThis.game?.i18n?.localize?.("TENEBRE.Party.StorageCategoryAnimal") || "Animal de Carga",
      container: globalThis.game?.i18n?.localize?.("TENEBRE.Party.StorageCategoryContainer") || "Recipiente",
      custom: globalThis.game?.i18n?.localize?.("TENEBRE.Party.StorageCategoryCustom") || "Armazenamento"
    };

    const categoryIcons = {
      vehicle: "fas fa-dolly-flatbed",
      animal: "fas fa-horse",
      container: "fas fa-box-open",
      custom: "fas fa-warehouse"
    };

    const storageCat = rawStorage.category || "custom";

    const rawDraft = rawStorage.draftAnimal ?? {};
    const draftName = (rawDraft.name || "").trim();
    const hasDraftAnimal = Boolean(draftName || rawDraft.uuid || rawDraft.id);
    let resolvedDraftActor = null;
    if (hasDraftAnimal && (rawDraft.uuid || rawDraft.id)) {
      resolvedDraftActor = this._resolveActor(rawDraft.uuid || rawDraft.id);
    }
    const draftAnimal = hasDraftAnimal ? {
      id: rawDraft.id || resolvedDraftActor?.id || "",
      uuid: rawDraft.uuid || resolvedDraftActor?.uuid || "",
      name: draftName || resolvedDraftActor?.name || (globalThis.game?.i18n?.localize?.("TENEBRE.Party.DraftAnimalBadge") || "Animal de Tração"),
      img: rawDraft.img || resolvedDraftActor?.img || "icons/environment/creatures/horse-brown.webp",
      type: rawDraft.type || resolvedDraftActor?.type || "actor",
      capacity: Number(rawDraft.capacity) || 0,
      canOpenSheet: Boolean(rawDraft.uuid || rawDraft.id || resolvedDraftActor)
    } : null;

    data.storage = {
      hasLocation: hasStorage,
      id: rawStorage.id || "",
      uuid: rawStorage.uuid || "",
      name: storageName || (globalThis.game?.i18n?.localize?.("TENEBRE.Party.StorageUnlinkedTitle") || "Não Vinculado"),
      img: rawStorage.img || (storageCat === "animal" ? "icons/environment/creatures/horse-brown.webp" : "icons/environment/settlement/wagon.webp"),
      type: rawStorage.type || "custom",
      category: storageCat,
      categoryLabel: categoryLabels[storageCat] || categoryLabels.custom,
      categoryIcon: categoryIcons[storageCat] || categoryIcons.custom,
      capacity: storageCapacity,
      currentLoad: totalWeight,
      pct: storagePct,
      isOverloaded: isOverloaded,
      isVehicle: storageCat === "vehicle",
      isAnimal: storageCat === "animal",
      canOpenSheet: Boolean(rawStorage.uuid || rawStorage.id),
      hasDraftAnimal: Boolean(draftAnimal),
      draftAnimal: draftAnimal
    };

    const rawLocation = this.actor?.system?.location ?? {};
    const regionKey = rawLocation.region || "ambria";
    const regionOptions = [
      {
        key: "ambria",
        label: globalThis.game?.i18n?.localize?.("TENEBRE.Party.RegionAmbria") || "Ambria (±0)",
        modifier: 0,
        selected: regionKey === "ambria"
      },
      {
        key: "bright",
        label: globalThis.game?.i18n?.localize?.("TENEBRE.Party.RegionBright") || "Davokar Iluminada (+0)",
        modifier: 0,
        selected: regionKey === "bright"
      },
      {
        key: "wild",
        label: globalThis.game?.i18n?.localize?.("TENEBRE.Party.RegionWild") || "Davokar Selvagem (+2)",
        modifier: 2,
        selected: regionKey === "wild"
      },
      {
        key: "dark",
        label: globalThis.game?.i18n?.localize?.("TENEBRE.Party.RegionDark") || "Davokar Escura (+5)",
        modifier: 5,
        selected: regionKey === "dark"
      }
    ];

    const currentRegion = regionOptions.find(r => r.key === regionKey) || regionOptions[0];

    data.partyLocation = {
      region: regionKey,
      name: rawLocation.name || "",
      regions: regionOptions,
      modifier: currentRegion.modifier,
      modifierText: currentRegion.modifier > 0 ? `+${currentRegion.modifier}` : (currentRegion.key === "ambria" ? "±0" : "+0")
    };

    const rawExpedition = await PartyActorService.visibleExpedition(this.actor);
    const journeyActors = await resolvePartyTravelActors(this.actor);
    const journeyPreview = partyTravelPreview(this.actor, journeyActors);
    const currentJourneyContext = journeyContextKey(this.actor, journeyActors);
    const guideId = rawExpedition.guideId || "";
    const guideUuid = rawExpedition.guideUuid || "";
    const guideActor = this._resolveActor(guideUuid || guideId);

    const hasGuide = Boolean(guideActor);
    let guideData = null;
    if (hasGuide) {
      const guideSys = guideActor.system ?? {};
      const guideBio = guideSys.bio ?? {};
      const guideOccupation = (guideBio.occupation && typeof guideBio.occupation === "string")
        ? guideBio.occupation.trim()
        : (typeof guideSys.occupation === "string" ? guideSys.occupation.trim() : "");
      const guideRace = (guideBio.race && typeof guideBio.race === "string")
        ? guideBio.race.trim()
        : (typeof guideSys.race === "string" ? guideSys.race.trim() : "");
      const occupationDisplay = guideOccupation || guideRace || (guideActor.type === "monster" ? (globalThis.game?.i18n?.localize?.("TENEBRE.Party.CompanionsSectionTitle") || "Companheiro") : "");

      const attrs = guideSys.attributes ?? {};
      const getAttrVal = (attrObj) => {
        if (!attrObj) return 0;
        return typeof attrObj === "object" ? Number(attrObj.total ?? attrObj.value ?? 0) : Number(attrObj);
      };
      const vigilantVal = getAttrVal(attrs.vigilant);
      const cunningVal = getAttrVal(attrs.cunning);

      const bushcraftData = detectBushcraftTier(guideActor);
      const orientationTargetData = calculateOrientationTarget(vigilantVal, bushcraftData.level, regionKey);
      orientationTargetData.target = boundOrientationTarget(orientationTargetData.target + orientationContext(guideActor).bonus);
      const romanLevels = ["—", "I", "II", "III"];
      const bushcraftView = {
        eligible: orientationRequirements(bushcraftData.level, regionKey).eligible,
        hasBushcraft: bushcraftData.hasBushcraft,
        level: bushcraftData.level,
        levelRoman: romanLevels[bushcraftData.level] || `${bushcraftData.level}`,
        penalty: orientationTargetData.penalty,
        penaltyText: orientationTargetData.penalty === 0 ? "±0" : `${orientationTargetData.penalty}`,
        target: orientationTargetData.target,
        baseVigilant: orientationTargetData.baseVigilant
      };

      guideData = {
        hasGuide: true,
        id: guideActor.id,
        uuid: guideActor.uuid,
        name: guideActor.name,
        img: guideActor.img || "icons/svg/mystery-man.svg",
        occupation: occupationDisplay,
        vigilant: vigilantVal,
        cunning: cunningVal,
        canOpenSheet: true,
        actor: guideActor,
        bushcraft: bushcraftView
      };
    } else {
      guideData = {
        hasGuide: false
      };
    }

    const dayStateRaw = rawExpedition.dayState || this.actor?.flags?.[MODULE_ID]?.expedition?.dayState || {};
    const orientationState = dayStateRaw.orientation || null;
    const orientationStale = Boolean(orientationState?.contextKey && orientationState.contextKey !== currentJourneyContext);
    let orientationDayView = { rolled: false };

    if (orientationState && orientationState.rolled) {
      const verdict = orientationState.restricted ? "restricted" : orientationStale ? "stale" : (orientationState.verdict || "failure");
      const verdictLabels = {
        stale: game.i18n.localize("TENEBRE.Journey.Stale"),
        restricted: game.i18n.localize("TENEBRE.Party.OrientationRestricted"),
        avoidedMishap: game.i18n.localize("TENEBRE.Party.OrientationAvoidedMishap"),
        greatSuccess: globalThis.game?.i18n?.localize?.("TENEBRE.Party.OrientationGreatSuccess") || "Grande Sucesso!",
        success: globalThis.game?.i18n?.localize?.("TENEBRE.Party.OrientationSuccess") || "Sucesso",
        failure: globalThis.game?.i18n?.localize?.("TENEBRE.Party.OrientationFailure") || "Falha"
      };
      const icons = {
        greatSuccess: "fas fa-star",
        success: "fas fa-check-circle",
        failure: "fas fa-exclamation-triangle"
      };
      let summaryTooltip = "";
      if (verdict === "greatSuccess" || verdict === "success") {
        const modifier = verdict === "greatSuccess" ? -2 : -1;
        summaryTooltip = [journeyPreview.activeSearch ? `+2 ${localize("TENEBRE.Party.RuinsBonus", "Ruínas")}` : localize("TENEBRE.Party.OrientationRuinsInactive", "Ruínas: sem bônus de orientação, pois a busca está inativa."),
          `${modifier} ${localize("TENEBRE.Party.EnemiesBonus", "Inimigos")}`, `${modifier} ${localize("TENEBRE.Party.TerrainBonus", "Terreno")}`,
          localize("TENEBRE.Party.OrientationDetectionTest", "Permite um teste para detectar encontros.")].join(" | ");
      } else if (verdict === "avoidedMishap" || verdict === "restricted" || verdict === "stale") {
        summaryTooltip = verdictLabels[verdict];
      } else {
        summaryTooltip = localize("TENEBRE.Party.OrientationFailureDesc", "Sem benefícios nos eventos; consulte a tabela de Infortúnios.");
      }

      orientationDayView = {
        rolled: true,
        restricted: Boolean(orientationState.restricted),
        verdict,
        verdictLabel: verdictLabels[verdict] || verdict,
        icon: icons[verdict] || "fas fa-compass",
        rollTotal: orientationState.rollTotal,
        target: orientationState.target,
        summaryTooltip
      };
    }

    const isExpeditionActive = Boolean(rawExpedition.active ?? false);
    const expeditionDay = Math.max(1, Number(rawExpedition.day) || 1);

    // Provisões do Grupo
    let groupTotalRations = 0;
    let groupItemName = "";
    try {
      groupTotalRations = RationService.getTotalUses(this.actor);
      groupItemName = RationService.getState(this.actor).name;
    } catch {}

    // Estado da Alimentação dos Membros no Dia
    const dayRationsState = dayStateRaw.rations || this.actor?.flags?.[MODULE_ID]?.expedition?.dayState?.rations || {};

    const expeditionRationMembers = [];
    // Processa membros jogadores
    for (const member of members) {
      const memberActor = member.actor;
      let personalRations = 0;
      try {
        personalRations = memberActor ? RationService.getTotalUses(memberActor) : 0;
      } catch {}
      const memberFedInfo = dayRationsState[member.stateKey] || null;
      const isFed = Boolean(memberFedInfo?.fed);
      const fedSource = memberFedInfo?.source || "";

      let fedSourceLabel = "";
      if (fedSource === "group") fedSourceLabel = globalThis.game?.i18n?.localize?.("TENEBRE.Party.FedSourceGroup") || "Alimentado com Provisões do Grupo";
      else if (fedSource === "personal") fedSourceLabel = globalThis.game?.i18n?.localize?.("TENEBRE.Party.FedSourcePersonal") || "Alimentado com a Própria Mochila";
      else if (fedSource === "manual") fedSourceLabel = globalThis.game?.i18n?.localize?.("TENEBRE.Party.FedSourceManual") || "Marcado Manualmente";

      expeditionRationMembers.push({
        id: member.id,
        name: member.name,
        img: member.img || "icons/svg/mystery-man.svg",
        isCompanion: false,
        isFed: isFed,
        fedSource: fedSource,
        fedSourceLabel: fedSourceLabel,
        personalRations: personalRations,
        canFeedFromGroup: !isFed && groupTotalRations > 0,
        canFeedFromPersonal: !isFed && personalRations > 0 && !memberActor.pack && !memberActor.compendium
      });
    }

    // Processa companheiros não monstros/animais
    for (const comp of companions) {
      if (comp.isMonster || comp.occupation === "Animal" || comp.occupation === "Animal de Carga") continue;
      const compActor = comp.actor;
      let personalRations = 0;
      try {
        personalRations = compActor ? RationService.getTotalUses(compActor) : 0;
      } catch {}
      const compFedInfo = dayRationsState[comp.stateKey] || null;
      const isFed = Boolean(compFedInfo?.fed);
      const fedSource = compFedInfo?.source || "";

      let fedSourceLabel = "";
      if (fedSource === "group") fedSourceLabel = globalThis.game?.i18n?.localize?.("TENEBRE.Party.FedSourceGroup") || "Alimentado com Provisões do Grupo";
      else if (fedSource === "personal") fedSourceLabel = globalThis.game?.i18n?.localize?.("TENEBRE.Party.FedSourcePersonal") || "Alimentado com a Própria Mochila";
      else if (fedSource === "manual") fedSourceLabel = globalThis.game?.i18n?.localize?.("TENEBRE.Party.FedSourceManual") || "Marcado Manualmente";

      expeditionRationMembers.push({
        id: comp.id,
        name: comp.name,
        img: comp.img || "icons/svg/mystery-man.svg",
        isCompanion: true,
        isFed: isFed,
        fedSource: fedSource,
        fedSourceLabel: fedSourceLabel,
        personalRations: personalRations,
        canFeedFromGroup: !isFed && groupTotalRations > 0,
        canFeedFromPersonal: !isFed && personalRations > 0 && !compActor.pack && !compActor.compendium
      });
    }

    const allMembersFed = expeditionRationMembers.length > 0 && expeditionRationMembers.every(m => m.isFed);
    const hungryCount = expeditionRationMembers.filter(m => !m.isFed).length;

    // Passo 3: Eventos Diários na Davokar
    const isActivelySearching = effectiveExpeditionSearch(this.actor);
    const configuredTables = rawExpedition.tables || {};
    const dayEventsState = rawExpedition.dayState?.events || {};

    const availableTables = getAvailableRollTables();
    const eventModifiers = calculateDavokarEventModifiers({
      regionKey,
      orientationVerdict: orientationDayView.rolled ? orientationDayView.verdict : "failure",
      activeSearch: isActivelySearching,
      alongRiver: journeyPreview.config.alongRiver && journeyPreview.config.activity === "travel"
    });

    const slotsConfig = [
      {
        key: "ruins",
        title: globalThis.game?.i18n?.localize?.("TENEBRE.Party.EventRuinsTitle") || "Ruínas na Davokar",
        icon: "fas fa-landmark",
        defaultName: "Tabela 26 - Ruínas na Davokar",
        mods: eventModifiers.ruins
      },
      {
        key: "encounters",
        title: globalThis.game?.i18n?.localize?.("TENEBRE.Party.EventEncountersTitle") || "Encontros Neutros",
        icon: "fas fa-users",
        defaultName: "Tabela 27 - Encontros Neutros na Davokar",
        mods: eventModifiers.encounters
      },
      {
        key: "enemies",
        title: globalThis.game?.i18n?.localize?.("TENEBRE.Party.EventEnemiesTitle") || "Inimigos & Predadores",
        icon: "fas fa-skull-crossbones",
        defaultName: "Tabela 28 - Inimigos na Davokar",
        mods: eventModifiers.enemies
      },
      {
        key: "terrain",
        title: globalThis.game?.i18n?.localize?.("TENEBRE.Party.EventTerrainTitle") || "Terreno & Perigos",
        icon: "fas fa-mountain",
        defaultName: "Tabela 29 - Terreno na Davokar",
        mods: eventModifiers.terrain
      }
    ];

    const eventSlotsView = [];
    for (const s of slotsConfig) {
      const configured = configuredTables[s.key] || "";
      const legacyId = CANONICAL_EXPEDITION_TABLE_IDS[s.key];
      const selectedUuid = configured === legacyId || configured.endsWith(`.${legacyId}`) ? "" : configured;
      const officialTable = availableTables.find(t => t.id === OFFICIAL_DAVOKAR_EVENT_TABLE_IDS[s.key]);
      let resolvedTableName = officialTable?.name || s.defaultName;
      if (selectedUuid) {
        const found = availableTables.find(t => t.uuid === selectedUuid || t.id === selectedUuid);
        if (found) resolvedTableName = found.name;
      }

      const slotResult = dayEventsState[s.key] || null;
      let slotResultClean = slotResult;
      if (slotResult?.resultText) {
        const cleanText = String(slotResult.resultText)
          .replace(/<br\s*\/?>/gi, " ")
          .replace(/<\/p>/gi, " ")
          .replace(/<[^>]+>/g, "")
          .replace(/\r?\n+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        slotResultClean = { ...slotResult, resultText: cleanText };
      }
      if (slotResult?.restricted) slotResultClean = { rolled: true, restricted: true, resultText: game.i18n.localize("TENEBRE.Party.OrientationRestricted") };
      const hasResult = Boolean(slotResultClean?.rolled);

      const breakdownParts = [];
      breakdownParts.push(`Região: ${eventModifiers.regionMod >= 0 ? `+${eventModifiers.regionMod}` : eventModifiers.regionMod}`);
      if (s.key === "ruins") {
        if (!isActivelySearching) breakdownParts.push("Sem Busca Ativa: -5");
        if (s.mods.orientationMod > 0) breakdownParts.push(`Orientação: +${s.mods.orientationMod}`);
      } else if (s.key === "enemies" || s.key === "terrain") {
        if (s.mods.orientationMod !== 0) breakdownParts.push(`Orientação: ${s.mods.orientationMod}`);
      }
      if (s.key === "terrain" && s.mods.riverMod) breakdownParts.push(`${game.i18n.localize("TENEBRE.Travel.AlongRiver")}: +${s.mods.riverMod}`);
      const formulaBreakdown = breakdownParts.join(" | ");

      const tableOptions = availableTables.map(tbl => ({
        ...tbl,
        selected: selectedUuid === tbl.uuid || selectedUuid === tbl.id
      }));

      eventSlotsView.push({
        key: s.key,
        unavailable: s.key === "ruins" && journeyPreview.config.activity === "stay",
        title: s.title,
        icon: s.icon,
        formula: orientationState?.restricted ? game.i18n.localize("TENEBRE.Party.OrientationRestricted") : s.mods.formula,
        formulaBreakdown: orientationState?.restricted ? "" : formulaBreakdown,
        totalMod: orientationState?.restricted ? null : s.mods.totalMod,
        selectedTableUuid: selectedUuid,
        resolvedTableName,
        tableOptions,
        hasResult,
        stale: Boolean(slotResult?.contextKey && (slotResult.contextKey !== currentJourneyContext || slotResult.orientationRevision !== orientationState?.revision)),
        result: slotResultClean
      });
    }

    const hasAnyEventRolled = eventSlotsView.some(s => s.hasResult);
    const allEventsRolled = eventSlotsView.every(s => s.hasResult);

    data.expedition = {
      active: isExpeditionActive,
      day: isExpeditionActive ? expeditionDay : 0,
      isFirstDay: expeditionDay <= 1,
      guideId: guideId,
      canAdjustOrientation: Boolean(globalThis.game?.user?.isGM),
      orientationModifier: this._getOrientationModifierDraft(),
      guide: guideData,
      activeSearch: isActivelySearching,
      availableTables,
      journey: this._journeyView(journeyPreview, journeyActors, rawExpedition, currentJourneyContext),
      eventSlots: eventSlotsView,
      hasAnyEventRolled,
      allEventsRolled,
      dayState: {
        orientation: orientationDayView,
        rations: dayRationsState,
        events: dayEventsState
      },
      rations: {
        groupTotal: groupTotalRations,
        groupItemName: groupItemName || "Pão de Viagem",
        members: expeditionRationMembers,
        allFed: allMembersFed,
        hungryCount: hungryCount,
        hasMembers: expeditionRationMembers.length > 0
      }
    };

    return data;
  }

  _getItemTypeLabel(type) {
    const i18n = globalThis.game?.i18n;
    if (typeof i18n?.localize === "function") {
      const typeKeyMap = {
        weapon: "ITEM.TypeWeapon",
        armor: "ITEM.TypeArmor",
        equipment: "ITEM.TypeEquipment",
        artifact: "ITEM.TypeArtifact",
        ability: "ITEM.TypeAbility",
        mysticalPower: "ITEM.TypeMysticalpower",
        ritual: "ITEM.TypeRitual",
        trait: "ITEM.TypeTrait",
        boon: "ITEM.TypeBoon",
        burden: "ITEM.TypeBurden"
      };
      const key = typeKeyMap[type] || `ITEM.Type${type}`;
      try {
        const translated = i18n.localize(key);
        if (translated && translated !== key) return translated;
      } catch {}
    }
    const fallbackMap = {
      weapon: "Arma",
      armor: "Armadura",
      equipment: "Equipamento",
      artifact: "Artefato",
      ability: "Habilidade",
      mysticalPower: "Poder Místico",
      ritual: "Ritual",
      trait: "Traço",
      boon: "Dádiva",
      burden: "Fardo"
    };
    return fallbackMap[type] || type;
  }

  _getItemDetail(item) {
    const sys = item.system ?? {};
    if (item.type === "weapon") {
      const dmg = sys.damage?.displayTextShort || sys.baseDamage;
      return dmg ? `${dmg}` : "";
    }
    if (item.type === "armor") {
      const prot = sys.displayTextShort || sys.baseProtection;
      return prot ? `${prot}` : "";
    }
    if (item.type === "artifact" || sys.isArtifact) {
      if (sys.power1?.name) {
        return sys.power1.name;
      }
    }
    return "";
  }

  _getMemberTopAttributes(memberActor, count = 4) {
    const sys = memberActor?.system ?? {};
    const attrs = sys.attributes ?? {};
    const list = [];

    const ATTR_ABBR_MAP = {
      accurate: "PRE",
      cunning: "AST",
      discreet: "DIS",
      persuasive: "PER",
      quick: "RAP",
      resolute: "RES",
      strong: "VGR",
      vigilant: "VGL"
    };

    for (const [key, attrData] of Object.entries(attrs)) {
      if (attrData === null || attrData === undefined) continue;
      const isObj = typeof attrData === "object";
      const total = isObj ? Number(attrData.total ?? attrData.value ?? 0) : Number(attrData);
      if (isNaN(total)) continue;
      const labelKey = (isObj && attrData.label) || `ATTRIBUTE.${key.toUpperCase()}`;
      const abbrKey = `ATTRIBUTE.${key.toUpperCase()}ABBR`;
      const label = globalThis.game?.i18n?.localize ? globalThis.game.i18n.localize(labelKey) : labelKey;
      let abbr = globalThis.game?.i18n?.localize ? globalThis.game.i18n.localize(abbrKey) : "";
      if (!abbr || abbr === abbrKey) {
        abbr = ATTR_ABBR_MAP[key] || key.substring(0, 3).toUpperCase();
      }
      list.push({
        key,
        total,
        label,
        abbr,
        modifier: isObj ? attrData.modifier : undefined
      });
    }

    list.sort((a, b) => b.total - a.total);
    return list.slice(0, count);
  }

  async _onRollMemberAttribute(actorId, attributeKey) {
    const memberActor = this._resolveActor(actorId);
    if (!memberActor) return;

    const canRoll = Boolean(memberActor.isOwner || globalThis.game?.user?.isGM);
    if (!canRoll) {
      globalThis.ui?.notifications?.warn?.(
        globalThis.game?.i18n?.localize?.("TENEBRE.Party.RollNotAllowed") ||
        "Você só pode rolar testes do seu próprio personagem."
      );
      return;
    }

    if (typeof memberActor.rollAttribute === "function") {
      return memberActor.rollAttribute(attributeKey);
    }
    if (typeof memberActor.sheet?._prepareRollAttribute === "function") {
      return memberActor.sheet._prepareRollAttribute({
        preventDefault: () => {},
        target: { dataset: { attribute: attributeKey } }
      });
    }
    if (typeof globalThis.game?.symbaroum?.api?.rollAttribute === "function") {
      return globalThis.game.symbaroum.api.rollAttribute(memberActor, attributeKey);
    }
  }

  activateListeners(html) {
    super.activateListeners?.(html);
    const root = html?.[0] ?? html;
    if (!root?.querySelectorAll) return;

    root.querySelectorAll('select[name="system.location.region"]').forEach(el => {
      el.addEventListener("change", async (ev) => {
        const val = ev.currentTarget.value;
        const travel = expeditionTravel(this.actor);
        const patch = { "system.location.region": val };
        if (travel.activity === "stay") {
          patch[`flags.${MODULE_ID}.expedition.travel.stayStartDay`] = Number(this._getExpeditionData().day);
        }
        await this.actor?.update?.(patch);
      });
    });

    root.querySelectorAll('[data-action="open-member-sheet"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const actorId = el.dataset.actorId;
        if (!actorId) return;
        const targetActor = globalThis.game?.actors?.get(actorId)
          ?? (globalThis.fromUuid ? await globalThis.fromUuid(actorId) : null);
        targetActor?.sheet?.render(true);
      });
    });

    root.querySelectorAll('[data-action="roll-member-attribute"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const actorId = el.dataset.actorId;
        const attrKey = el.dataset.attribute;
        if (!actorId || !attrKey) return;
        await this._onRollMemberAttribute(actorId, attrKey);
      });
    });

    root.querySelectorAll('[data-action="remove-member"]').forEach(el => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const actorId = el.dataset.actorId;
        this._onRemoveMember(actorId);
      });
    });

    root.querySelectorAll('[data-action="toggle-member-type"]').forEach(el => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const actorId = el.dataset.actorId;
        if (!actorId) return;
        this._onToggleMemberType(actorId);
      });
    });

    root.querySelectorAll('[data-action="open-item-sheet"]').forEach(el => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        const itemId = el.dataset.itemId || el.closest(".item")?.dataset.itemId;
        if (!itemId) return;
        this.actor?.items?.get?.(itemId)?.sheet?.render(true);
      });
    });

    root.querySelectorAll('[data-action="delete-item"]').forEach(el => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const itemId = el.dataset.itemId || el.closest(".item")?.dataset.itemId;
        if (!itemId) return;
        this._onDeleteItem(itemId);
      });
    });

    root.querySelectorAll('[data-action="increase-quantity"]').forEach(el => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const itemId = el.dataset.itemId || el.closest(".item")?.dataset.itemId;
        if (!itemId) return;
        this._onIncreaseItemQuantity(itemId);
      });
    });

    root.querySelectorAll('[data-action="decrease-quantity"]').forEach(el => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const itemId = el.dataset.itemId || el.closest(".item")?.dataset.itemId;
        if (!itemId) return;
        this._onDecreaseItemQuantity(itemId);
      });
    });

    root.querySelectorAll('[data-action="open-storage-sheet"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const uuid = el.dataset.uuid || this.actor?.system?.storageLocation?.uuid;
        const docId = el.dataset.id || this.actor?.system?.storageLocation?.id;
        const docType = this.actor?.system?.storageLocation?.type;
        let doc = null;
        if (uuid && globalThis.fromUuid) {
          try {
            const resolved = await globalThis.fromUuid(uuid);
            doc = resolved?.actor ?? resolved;
          } catch {}
        }
        if (!doc && docId) {
          if (docType === "actor" || !docType) doc = globalThis.game?.actors?.get(docId);
          if (!doc && (docType === "item" || !docType)) doc = globalThis.game?.items?.get(docId) ?? this.actor?.items?.get(docId);
        }
        const targetSheet = doc?.sheet ?? doc?.actor?.sheet;
        if (targetSheet) {
          targetSheet.render(true);
        } else {
          globalThis.ui?.notifications?.info?.(
            globalThis.game?.i18n?.localize?.("TENEBRE.Party.StorageNoSheetAvailable") ||
            "Este local de armazenamento não possui ficha de documento."
          );
        }
      });
    });

    root.querySelectorAll('[data-action="select-storage-location"]').forEach(el => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        this._onSelectStorageLocation();
      });
    });

    root.querySelectorAll('[data-action="link-draft-animal"]').forEach(el => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        this._onLinkDraftAnimal();
      });
    });

    root.querySelectorAll('[data-action="link-vehicle"]').forEach(el => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        this._onSelectStorageLocation();
      });
    });

    root.querySelectorAll('[data-action="unlink-draft-animal"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this._onUnlinkDraftAnimal();
      });
    });

    root.querySelectorAll('[data-action="edit-storage-capacity"]').forEach(el => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        this._onEditStorageCapacity();
      });
    });

    root.querySelectorAll('[data-action="unlink-storage-location"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (!this.isEditable) return;
        const title = globalThis.game?.i18n?.localize?.("TENEBRE.Party.UnlinkStorageDialogTitle") || "Desvincular Local de Armazenamento";
        const content = `<p>${globalThis.game?.i18n?.localize?.("TENEBRE.Party.UnlinkStorageDialogContent") || "Deseja remover o vínculo deste local de armazenamento?"}</p>`;
        if (globalThis.Dialog) {
          new globalThis.Dialog({
            title: title,
            content: content,
            buttons: {
              yes: {
                label: globalThis.game?.i18n?.localize?.("DIALOG.OK") || "OK",
                callback: () => this._onUnlinkStorageLocation()
              },
              no: {
                label: globalThis.game?.i18n?.localize?.("DIALOG.CANCEL") || "Cancelar"
              }
            },
            default: "no"
          }).render(true);
        } else {
          await this._onUnlinkStorageLocation();
        }
      });
    });

    root.querySelectorAll('[data-action="open-guide-sheet"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const actorId = el.dataset.actorId || this.actor?.system?.expedition?.guideId;
        if (!actorId) return;
        const targetActor = this._resolveActor(actorId);
        targetActor?.sheet?.render(true);
      });
    });

    root.querySelectorAll('[data-action="select-guide"]').forEach(el => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        this._onSelectGuide();
      });
    });

    root.querySelectorAll('[data-action="unlink-guide"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (!this.isEditable) return;
        await this._onUnsetGuide();
      });
    });

    root.querySelectorAll('[data-action="configure-journey"]').forEach(el => el.addEventListener("click", ev => { ev.preventDefault(); void this._onConfigureJourney(); }));
    root.querySelectorAll('[data-action="journey-check"]').forEach(el => el.addEventListener("click", ev => { ev.preventDefault(); void this._onResolveJourney(el.dataset.kind); }));
    root.querySelectorAll('[data-action="journey-apply"]').forEach(el => el.addEventListener("click", ev => { ev.preventDefault(); void this._onResolveJourney("effort", true); }));
    root.querySelectorAll('[data-orientation-modifier]').forEach(el => {
      el.addEventListener("input", () => {
        if (!game.user?.isGM) return;
        this._getOrientationModifierDraft();
        this._orientationModifierDraft = el.value;
        el.setCustomValidity("");
      });
      el.addEventListener("keydown", ev => { if (ev.key === "Enter") ev.preventDefault(); });
    });
    root.querySelectorAll('[data-action="roll-orientation"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        await this._onRollOrientation();
      });
    });

    root.querySelectorAll('[data-action="reset-orientation"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        await this._onResetOrientation();
      });
    });

    root.querySelectorAll('[data-action="toggle-guide"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (!this.isEditable) return;
        const actorId = el.dataset.actorId;
        if (!actorId) return;
        const currentGuideId = this.actor?.system?.expedition?.guideId || this.actor?.flags?.[MODULE_ID]?.expedition?.guideId || "";
        const currentGuideUuid = this.actor?.system?.expedition?.guideUuid || this.actor?.flags?.[MODULE_ID]?.expedition?.guideUuid || "";
        if (currentGuideId === actorId || currentGuideUuid === actorId) {
          await this._onUnsetGuide();
        } else {
          await this._onSetGuide(actorId);
        }
      });
    });

    root.querySelectorAll('[data-action="start-expedition"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        await this._onStartExpedition();
      });
    });

    root.querySelectorAll('[data-action="end-expedition"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        await this._onEndExpedition();
      });
    });

    root.querySelectorAll('[data-action="next-expedition-day"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        await this._onNextExpeditionDay();
      });
    });

    root.querySelectorAll('[data-action="prev-expedition-day"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        await this._onPrevExpeditionDay();
      });
    });

    root.querySelectorAll('[data-action="feed-member-group"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const memberId = el.dataset.memberId;
        if (!memberId) return;
        await this._onFeedMemberGroup(memberId);
      });
    });

    root.querySelectorAll('[data-action="feed-member-personal"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const memberId = el.dataset.memberId;
        if (!memberId) return;
        await this._onFeedMemberPersonal(memberId);
      });
    });

    root.querySelectorAll('[data-action="feed-all-group"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        await this._onFeedAllGroup();
      });
    });

    root.querySelectorAll('[data-action="toggle-feed-member"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const memberId = el.dataset.memberId;
        if (!memberId) return;
        await this._onToggleFeedMember(memberId);
      });
    });

    root.querySelectorAll('[data-action="toggle-active-search"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        await this._onToggleActiveSearch();
      });
    });

    root.querySelectorAll('select[data-action="change-event-table"]').forEach(el => {
      el.addEventListener("change", async (ev) => {
        ev.preventDefault();
        const slot = el.dataset.eventSlot;
        const uuid = el.value;
        await this._onChangeEventTable(slot, uuid);
      });
    });

    root.querySelectorAll('[data-action="roll-single-event"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const slot = el.dataset.eventSlot;
        await this._onRollSingleEvent(slot);
      });
    });

    root.querySelectorAll('[data-action="reset-single-event"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const slot = el.dataset.eventSlot;
        await this._onResetSingleEvent(slot);
      });
    });

    root.querySelectorAll('[data-action="roll-all-events"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        await this._onRollAllEvents();
      });
    });

    this._bindMemberContextMenu(root);
    this._bindGuideContextMenu(root);
    this._bindRationContextMenu(root);
  }

  _bindRationContextMenu(root) {
    if (!this.isEditable || this._rationMenuRoot === root) return;
    const Base = globalThis.foundry?.applications?.ux?.ContextMenu ?? globalThis.ContextMenu;
    const ContextMenuClass = Base?.implementation ?? Base;
    if (typeof ContextMenuClass !== "function") return;
    const state = target => {
      const element = target?.[0] ?? target;
      const row = element?.closest?.(".party-ration-member-row[data-member-id]") ?? element;
      const id = row?.dataset?.memberId;
      const actor = id ? this._resolveActor(id) : null;
      if (!this.isEditable || !actor) return null;
      const expedition = this._getExpeditionData();
      if (!expedition.active) return null;
      return { id, actor, fed: Boolean(expedition.dayState.rations?.[actorStateKey(actor)]?.fed) };
    };
    const canFeed = (target, source) => {
      const member = state(target);
      return Boolean(member && !member.fed && (source === "group"
        ? RationService.getTotalUses(this.actor) > 0
        : !member.actor.pack && !member.actor.compendium && RationService.getTotalUses(member.actor) > 0));
    };
    const feedEntry = (source, key, label, icon) => CompatibilityService.buildContextMenuEntry({
      label: localize(key, label), icon,
      visible: target => canFeed(target, source),
      onClick: async target => {
        if (!canFeed(target, source)) return;
        const member = state(target);
        return source === "group" ? this._onFeedMemberGroup(member.id) : this._onFeedMemberPersonal(member.id);
      }
    });
    const entries = [
      feedEntry("group", "TENEBRE.Party.FeedFromGroupMenu", "Alimentar com provisões do grupo", '<i class="fas fa-utensils"></i>'),
      feedEntry("personal", "TENEBRE.Party.FeedFromPersonalMenu", "Alimentar com pão da mochila", '<i class="fas fa-bread-slice"></i>'),
      CompatibilityService.buildContextMenuEntry({
        label: localize("TENEBRE.Party.ToggleFedTooltip", "Desmarcar alimentação (voltar para em jejum)"), icon: '<i class="fas fa-undo"></i>',
        visible: target => Boolean(state(target)?.fed),
        onClick: async target => { const member = state(target); if (member?.fed) return this._onToggleFeedMember(member.id); }
      })
    ];
    try {
      new ContextMenuClass(root, ".party-ration-member-row[data-member-id]", entries, { fixed: true, jQuery: false });
      this._rationMenuRoot = root;
    } catch (error) { console.warn("Tenebre Resources | Could not register ration ContextMenu:", error); }
  }

  _bindMemberContextMenu(root) {
    const BaseContextMenu = globalThis.foundry?.applications?.ux?.ContextMenu ?? globalThis.ContextMenu;
    const ContextMenuClass = BaseContextMenu?.implementation ?? BaseContextMenu;
    if (typeof ContextMenuClass !== "function") return;

    const _getActorId = (target) => {
      const el = target instanceof HTMLElement ? target : (target?.[0] ?? target);
      return el?.dataset?.actorId || el?.closest?.(".party-member-card[data-actor-id]")?.dataset?.actorId || "";
    };

    const openSheetEntry = CompatibilityService.buildContextMenuEntry({
      label: globalThis.game?.i18n?.localize?.("TENEBRE.Party.OpenMemberSheet") || "Abrir ficha do personagem",
      icon: '<i class="fas fa-external-link-alt"></i>',
      visible: (target) => Boolean(_getActorId(target)),
      onClick: async (target) => {
        const actorId = _getActorId(target);
        if (!actorId) return;
        const targetActor = this._resolveActor(actorId);
        targetActor?.sheet?.render(true);
      }
    });

    const setGuideEntry = CompatibilityService.buildContextMenuEntry({
      label: globalThis.game?.i18n?.localize?.("TENEBRE.Party.SetGuideContextMenu") || "Definir como guia do grupo",
      icon: '<i class="fas fa-compass"></i>',
      visible: (target) => {
        if (!this.isEditable) return false;
        const actorId = _getActorId(target);
        if (!actorId) return false;
        const currentGuideId = this.actor?.system?.expedition?.guideId || this.actor?.flags?.[MODULE_ID]?.expedition?.guideId || "";
        const currentGuideUuid = this.actor?.system?.expedition?.guideUuid || this.actor?.flags?.[MODULE_ID]?.expedition?.guideUuid || "";
        return currentGuideId !== actorId && currentGuideUuid !== actorId;
      },
      onClick: (target) => {
        const actorId = _getActorId(target);
        if (actorId) void this._onSetGuide(actorId);
      }
    });

    const unsetGuideEntry = CompatibilityService.buildContextMenuEntry({
      label: globalThis.game?.i18n?.localize?.("TENEBRE.Party.UnsetGuideContextMenu") || "Remover como guia do grupo",
      icon: '<i class="fas fa-times"></i>',
      visible: (target) => {
        if (!this.isEditable) return false;
        const actorId = _getActorId(target);
        if (!actorId) return false;
        const currentGuideId = this.actor?.system?.expedition?.guideId || this.actor?.flags?.[MODULE_ID]?.expedition?.guideId || "";
        const currentGuideUuid = this.actor?.system?.expedition?.guideUuid || this.actor?.flags?.[MODULE_ID]?.expedition?.guideUuid || "";
        return currentGuideId === actorId || currentGuideUuid === actorId;
      },
      onClick: () => {
        void this._onUnsetGuide();
      }
    });

    const moveToCompanionsEntry = CompatibilityService.buildContextMenuEntry({
      label: globalThis.game?.i18n?.localize?.("TENEBRE.Party.MoveToCompanions") || "Mover para Companheiros",
      icon: '<i class="fas fa-paw"></i>',
      visible: (target) => {
        if (!this.isEditable) return false;
        const actorId = _getActorId(target);
        if (!actorId) return false;
        const currentMembers = Array.isArray(this.actor?.system?.members) ? this.actor.system.members : [];
        return currentMembers.includes(actorId);
      },
      onClick: (target) => {
        const actorId = _getActorId(target);
        if (actorId) void this._onToggleMemberType(actorId);
      }
    });

    const moveToMembersEntry = CompatibilityService.buildContextMenuEntry({
      label: globalThis.game?.i18n?.localize?.("TENEBRE.Party.MoveToMembers") || "Mover para Jogadores",
      icon: '<i class="fas fa-user"></i>',
      visible: (target) => {
        if (!this.isEditable) return false;
        const actorId = _getActorId(target);
        if (!actorId) return false;
        const currentCompanions = Array.isArray(this.actor?.system?.companions) ? this.actor.system.companions : [];
        return currentCompanions.includes(actorId);
      },
      onClick: (target) => {
        const actorId = _getActorId(target);
        if (actorId) void this._onToggleMemberType(actorId);
      }
    });

    const removeMemberEntry = CompatibilityService.buildContextMenuEntry({
      label: globalThis.game?.i18n?.localize?.("TENEBRE.Party.RemoveMember") || "Remover do grupo",
      icon: '<i class="fas fa-trash-alt"></i>',
      visible: (target) => {
        if (!this.isEditable) return false;
        return Boolean(_getActorId(target));
      },
      onClick: (target) => {
        const actorId = _getActorId(target);
        if (actorId) void this._onRemoveMember(actorId);
      }
    });

    try {
      new ContextMenuClass(
        root,
        ".party-member-card[data-actor-id]",
        [openSheetEntry, setGuideEntry, unsetGuideEntry, moveToCompanionsEntry, moveToMembersEntry, removeMemberEntry],
        { fixed: true, jQuery: false }
      );
    } catch (err) {
      console.warn("Tenebre | Could not register member ContextMenu:", err);
    }
  }

  _bindGuideContextMenu(root) {
    const BaseContextMenu = globalThis.foundry?.applications?.ux?.ContextMenu ?? globalThis.ContextMenu;
    const ContextMenuClass = BaseContextMenu?.implementation ?? BaseContextMenu;
    if (typeof ContextMenuClass !== "function") return;

    const _getGuideActor = () => {
      const guideUuid = this.actor?.system?.expedition?.guideUuid || this.actor?.flags?.[MODULE_ID]?.expedition?.guideUuid || "";
      const guideId = this.actor?.system?.expedition?.guideId || this.actor?.flags?.[MODULE_ID]?.expedition?.guideId || "";
      const guideActor = this._resolveActor(guideUuid || guideId);
      return guideActor;
    };

    const openGuideSheetEntry = CompatibilityService.buildContextMenuEntry({
      label: globalThis.game?.i18n?.localize?.("TENEBRE.Party.OpenGuideSheet") || "Abrir ficha do guia",
      icon: '<i class="fas fa-external-link-alt"></i>',
      visible: (target) => {
        const el = target instanceof HTMLElement ? target : (target?.[0] ?? target);
        if (el?.closest?.(".btn-orientation-roll, .btn-orientation-reset")) return false;
        return Boolean(_getGuideActor());
      },
      onClick: () => {
        const guideActor = _getGuideActor();
        guideActor?.sheet?.render(true);
      }
    });

    const changeGuideEntry = CompatibilityService.buildContextMenuEntry({
      label: globalThis.game?.i18n?.localize?.("TENEBRE.Party.ChangeGuide") || "Trocar guia da expedição",
      icon: '<i class="fas fa-exchange-alt"></i>',
      visible: (target) => {
        if (!this.isEditable) return false;
        const el = target instanceof HTMLElement ? target : (target?.[0] ?? target);
        if (el?.closest?.(".btn-orientation-roll, .btn-orientation-reset")) return false;
        return true;
      },
      onClick: () => {
        void this._onSelectGuide();
      }
    });

    const unlinkGuideEntry = CompatibilityService.buildContextMenuEntry({
      label: globalThis.game?.i18n?.localize?.("TENEBRE.Party.UnlinkGuide") || "Remover guia da expedição",
      icon: '<i class="fas fa-unlink"></i>',
      visible: (target) => {
        if (!this.isEditable) return false;
        const el = target instanceof HTMLElement ? target : (target?.[0] ?? target);
        if (el?.closest?.(".btn-orientation-roll, .btn-orientation-reset")) return false;
        return Boolean(_getGuideActor());
      },
      onClick: async () => {
        await this._onUnsetGuide();
      }
    });

    try {
      new ContextMenuClass(
        root,
        ".party-guide-box.is-linked",
        [openGuideSheetEntry, changeGuideEntry, unlinkGuideEntry],
        { fixed: true, jQuery: false }
      );
    } catch (err) {
      console.warn("Tenebre | Could not register guide ContextMenu:", err);
    }
  }

  async _onSetGuide(actorId) {
    if (!this.isEditable || !actorId) return;
    const guideActor = this._resolveActor(actorId) ?? await resolveActorReference(actorId);
    if (!guideActor) return;

    await this.actor.update({
      "system.expedition.guideId": guideActor.id,
      "system.expedition.guideUuid": guideActor.uuid || "",
      [`flags.${MODULE_ID}.expedition.guideId`]: guideActor.id,
      [`flags.${MODULE_ID}.expedition.guideUuid`]: guideActor.uuid || ""
    });

    this.render(false);

    const msg = globalThis.game?.i18n?.format
      ? globalThis.game.i18n.format("TENEBRE.Party.GuideSetNotice", { name: guideActor.name })
      : `${guideActor.name} foi definido(a) como guia da expedição.`;
    globalThis.ui?.notifications?.info?.(msg);
  }

  async _onUnsetGuide() {
    if (!this.isEditable) return;
    await this.actor.update({
      "system.expedition.guideId": "",
      "system.expedition.guideUuid": "",
      [`flags.${MODULE_ID}.expedition.guideId`]: "",
      [`flags.${MODULE_ID}.expedition.guideUuid`]: ""
    });

    this.render(false);

    const msg = globalThis.game?.i18n?.localize?.("TENEBRE.Party.GuideUnsetNotice")
      || "Guia da expedição removido.";
    globalThis.ui?.notifications?.info?.(msg);
  }

  _getOrientationModifierDraft() {
    const exp = this._getExpeditionData();
    const key = JSON.stringify([expeditionDayKey(this.actor), exp.guideUuid || exp.guideId, this.actor?.system?.location?.region]);
    if (this._orientationModifierKey !== key) {
      this._orientationModifierKey = key;
      this._orientationModifierDraft = "0";
    }
    return this._orientationModifierDraft;
  }

  async _onRollOrientation() {
    if (this._rollingOrientation) return;

    const rootEl = this.element?.[0] ?? this.element;
    const modifierInput = rootEl?.querySelector?.('[data-orientation-modifier]');
    const draft = game.user?.isGM ? String(modifierInput?.value ?? this._getOrientationModifierDraft()).trim() : "0";
    const circumstanceModifier = draft === "" ? 0 : Number(draft);
    if ((draft !== "" && !/^[+-]?\d+$/.test(draft)) || !Number.isInteger(circumstanceModifier) || Math.abs(circumstanceModifier) > 20) {
      const message = localize("TENEBRE.Party.OrientationModifierInvalid", "Informe um número inteiro entre −20 e +20, como +1 ou -2.");
      modifierInput?.setCustomValidity?.(message);
      modifierInput?.reportValidity?.();
      modifierInput?.focus?.();
      globalThis.ui?.notifications?.warn?.(message);
      return;
    }
    modifierInput?.setCustomValidity?.("");
    if (game.user?.isGM) {
      this._getOrientationModifierDraft();
      this._orientationModifierDraft = draft || "0";
    }
    this._rollingOrientation = true;
    const modifierWasDisabled = modifierInput?.disabled;
    if (modifierInput) modifierInput.disabled = true;
    const rollBtn = rootEl?.querySelector?.('[data-action="roll-orientation"]');
    const resetBtn = rootEl?.querySelector?.('[data-action="reset-orientation"]');
    const resultBadge = rootEl?.querySelector?.('.orientation-result-badge');

    if (rollBtn) {
      rollBtn.disabled = true;
      rollBtn.classList.add("is-rolling");
      const rollingLabel = globalThis.game?.i18n?.localize?.("TENEBRE.Party.OrientationRolling") || "Rolando...";
      rollBtn.innerHTML = `<i class="fas fa-dice-d20 fa-spin"></i> ${rollingLabel}`;
    }
    if (resetBtn) {
      resetBtn.disabled = true;
    }
    if (resultBadge) {
      resultBadge.classList.add("is-rolling");
    }

    try {
      const result = await PartyActorService.rollOrientation(this.actor, undefined, undefined, undefined, circumstanceModifier);
      if (result?.status === "notTravelling") globalThis.ui?.notifications?.warn?.(game.i18n.localize("TENEBRE.Journey.NotTravelling"));
      if (result?.status === "ineligible") globalThis.ui?.notifications?.warn?.(game.i18n.localize("TENEBRE.Party.OrientationIneligible"));
      if (result?.status === "stale") globalThis.ui?.notifications?.warn?.(game.i18n.localize("TENEBRE.Party.ExpeditionChangedNotice"));
    } catch (error) {
      console.warn("Tenebre Resources | Orientation failed.", error);
      globalThis.ui?.notifications?.error?.(game.i18n.localize("TENEBRE.Party.OrientationFailedNotice"));
    } finally {
      this._rollingOrientation = false;
      if (modifierInput) modifierInput.disabled = modifierWasDisabled;
      this.render(false);
    }
  }

  async _onResetOrientation() {
    if (!this.isEditable && !globalThis.game?.user?.isGM) return;
    await PartyActorService.resetOrientation(this.actor);
    this.render(false);
  }

  async _onStartExpedition() {
    if (!this.isEditable) return;
    if (!await this._setExpeditionDay(1, true)) return;
    const msg = globalThis.game?.i18n?.localize?.("TENEBRE.Party.ExpeditionStartedNotice") || "Expedição iniciada! Dia 1 em Davokar.";
    globalThis.ui?.notifications?.info?.(msg);
  }

  async _onEndExpedition() {
    if (!this.isEditable) return;
    const title = globalThis.game?.i18n?.localize?.("TENEBRE.Party.EndExpeditionDialogTitle") || "Encerrar Expedição";
    const content = `<p>${globalThis.game?.i18n?.localize?.("TENEBRE.Party.EndExpeditionDialogContent") || "Deseja realmente encerrar a expedição atual? O contador de dias e o status da orientação serão reiniciados."}</p>`;

    const doEnd = async () => {
      if (!await this._setExpeditionDay(0, false)) return;
      const msg = globalThis.game?.i18n?.localize?.("TENEBRE.Party.ExpeditionEndedNotice") || "Expedição encerrada.";
      globalThis.ui?.notifications?.info?.(msg);
    };

    if (globalThis.Dialog) {
      new globalThis.Dialog({
        title,
        content,
        buttons: {
          yes: {
            icon: '<i class="fas fa-check"></i>',
            label: globalThis.game?.i18n?.localize?.("DIALOG.OK") || "Encerrar",
            callback: doEnd
          },
          no: {
            icon: '<i class="fas fa-times"></i>',
            label: globalThis.game?.i18n?.localize?.("DIALOG.CANCEL") || "Cancelar"
          }
        },
        default: "no"
      }).render(true);
    } else {
      await doEnd();
    }
  }

  async _onNextExpeditionDay() {
    if (!this.isEditable) return;
    const rawExpedition = this._getExpeditionData();
    const currentDay = Math.max(1, Number(rawExpedition.day) || 1);
    const nextDay = currentDay + 1;

    if (!await this._setExpeditionDay(nextDay, true)) return;

    const msg = globalThis.game?.i18n?.format
      ? globalThis.game.i18n.format("TENEBRE.Party.ExpeditionDayAdvancedNotice", { day: nextDay })
      : `Expedição avançou para o Dia ${nextDay}.`;
    globalThis.ui?.notifications?.info?.(msg);
  }

  async _onPrevExpeditionDay() {
    if (!this.isEditable) return;
    const rawExpedition = this._getExpeditionData();
    const currentDay = Math.max(1, Number(rawExpedition.day) || 1);
    if (currentDay <= 1) return;
    const prevDay = currentDay - 1;

    await this._setExpeditionDay(prevDay, rawExpedition.active);
  }

  async _setExpeditionDay(day, active) {
    const updated = await PartyActorService.setExpeditionDay(this.actor, day, active);
    if (!updated) globalThis.ui?.notifications?.warn?.(game.i18n.localize("TENEBRE.Party.ExpeditionChangedNotice"));
    return updated;
  }

  async _onFeedMemberGroup(memberId) {
    if (!this.isEditable || !memberId) return;
    return this._feedExpeditionMembers([memberId], "group");
  }

  async _onFeedMemberPersonal(memberId) {
    if (!this.isEditable || !memberId) return;
    return this._feedExpeditionMembers([memberId], "personal");
  }

  async _onFeedAllGroup() {
    if (!this.isEditable) return;
    const data = await this.getData();
    const memberIds = (data.expedition?.rations?.members ?? []).filter(member => !member.isFed).map(member => member.id);
    if (!memberIds.length) {
      globalThis.ui?.notifications?.info?.(game.i18n.localize("TENEBRE.Party.AllAlreadyFedNotice"));
      return;
    }
    return this._feedExpeditionMembers(memberIds, "group", true);
  }

  async _feedExpeditionMembers(memberIds, source, all = false) {
    try {
      const result = await RationService.feedExpedition(this.actor, memberIds, source);
      if (result.status === "stale") {
        globalThis.ui?.notifications?.warn?.(game.i18n.localize("TENEBRE.Party.ExpeditionChangedNotice"));
        return;
      }
      if (result.status === "alreadyFed") {
        globalThis.ui?.notifications?.info?.(game.i18n.localize("TENEBRE.Party.AllAlreadyFedNotice"));
        return;
      }
      const member = this._resolveActor(memberIds[0]);
      if (result.status === "insufficient") {
        const key = source === "group" ? "TENEBRE.Party.NoGroupRationsWarn" : "TENEBRE.Party.NoPersonalRationsWarn";
        globalThis.ui?.notifications?.warn?.(game.i18n.format(key, { name: member?.name ?? "" }));
        return;
      }
      const key = all ? "TENEBRE.Party.AllMembersFedNotice"
        : source === "group" ? "TENEBRE.Party.MemberFedGroupNotice" : "TENEBRE.Party.MemberFedPersonalNotice";
      globalThis.ui?.notifications?.info?.(game.i18n.format(key, { name: member?.name ?? "", count: result.count }));
      this.render?.(false);
    } catch (error) {
      console.warn("Tenebre Resources | Expedition feeding failed.", error);
      globalThis.ui?.notifications?.error?.(game.i18n.localize("TENEBRE.Party.FeedFailedNotice"));
    }
  }

  async _onToggleFeedMember(memberId) {
    if (!this.isEditable || !memberId) return;
    const memberActor = this._resolveActor(memberId);
    const stateKey = memberActor ? actorStateKey(memberActor) : memberId;
    const dayRations = this.actor?.system?.expedition?.dayState?.rations ??
      this.actor?.flags?.[MODULE_ID]?.expedition?.dayState?.rations ?? {};
    const isCurrentlyFed = Boolean(dayRations[stateKey]?.fed);
    const newStatus = isCurrentlyFed ? null : { fed: true, source: "manual", timestamp: Date.now() };

    await this.actor.update({
      [`system.expedition.dayState.rations.${stateKey}`]: newStatus,
      [`flags.${MODULE_ID}.expedition.dayState.rations.${stateKey}`]: newStatus
    });
    this.render?.(false);
  }

  async _onToggleActiveSearch() {
    if (!this.isEditable) return;
    const expData = this._getExpeditionData();
    const updated = !expData.activeSearch;
    await this.actor.update({
      "system.expedition.activeSearch": updated,
      [`flags.${MODULE_ID}.expedition.activeSearch`]: updated
    });
    this.render(false);
  }

  async _onChangeEventTable(slot, uuid) {
    if (!this.isEditable || !slot) return;
    const expData = this._getExpeditionData();
    const currentTables = { ...(expData.tables || {}) };
    currentTables[slot] = uuid || "";
    await this.actor.update({
      "system.expedition.tables": currentTables,
      [`flags.${MODULE_ID}.expedition.tables`]: currentTables
    });
    this.render(false);
  }

  _journeyView(preview, actors, expedition, context) {
    const t = key => globalThis.game?.i18n?.localize?.(`TENEBRE.Journey.${key}`) ?? `TENEBRE.Journey.${key}`;
    const user = globalThis.game?.user;
    const eligible = new Set([...(this.actor.system?.members ?? []), expedition.guideUuid || expedition.guideId]);
    const detector = actors.filter(a => preview.profiles.some(p => p.ref === actorReference(a)) && (eligible.has(actorReference(a)) || eligible.has(a.uuid)))
      .sort((a,b) => Number(b.system?.attributes?.vigilant?.total ?? b.system?.attributes?.vigilant?.value ?? 0) - Number(a.system?.attributes?.vigilant?.total ?? a.system?.attributes?.vigilant?.value ?? 0))[0];
    const checks = ["effort", "detection", "stay"].map(kind => {
      const result = expedition.dayState.journey?.[kind];
      const stale = Boolean(result?.context && result.context !== context);
      return { kind, label: t(kind), rolled: Boolean(result?.rolled), restricted: Boolean(result?.restricted),
        status: result?.restricted ? globalThis.game?.i18n?.localize?.("TENEBRE.Party.OrientationRestricted") ?? "Private" : stale ? t("Stale") : result?.rolled ? (kind === "effort" && result.applied?.length === result.members?.length ? t("Applied") : t("Resolved")) : t("Pending"),
        canRoll: preview.config.configured && (kind === "effort" ? Boolean(user?.isGM) && preview.config.activity === "travel" && !preview.blocked : (this.isEditable || user?.isGM || kind === "detection" && detector?.isOwner) && (kind !== "detection" || user?.isGM || !expedition.dayState.orientation?.restricted && !expedition.dayState.events?.encounters?.restricted) && (kind !== "stay" || preview.config.activity === "stay" && preview.stayDays >= 2)),
        canApply: kind === "effort" && user?.isGM && result?.rolled && !result.restricted && !stale && (result.applied?.length ?? 0) < (result.members?.length ?? 0) };
    });
    return { ...preview, modeLabel: globalThis.game?.i18n?.localize?.(`TENEBRE.Travel.Mode${preview.config.mode[0].toUpperCase()}${preview.config.mode.slice(1)}`) ?? preview.config.mode,
      activityLabel: t(preview.config.activity === "stay" ? "Staying" : "Travelling"),
      isStaying: preview.config.activity === "stay",
      searchUnavailable: preview.config.activity === "stay" || TRAVEL_MODES.indexOf(preview.config.mode) % 3 !== 0,
      searchLimited: getActorExpeditionData(this.actor).activeSearch && !preview.activeSearch,
      checks };
  }

  async _onConfigureJourney() {
    if (!this.isEditable && !game.user?.isGM) return;
    const t = key => game.i18n.localize(`TENEBRE.Journey.${key}`), config = expeditionTravel(this.actor);
    const options = (list, value) => list.map(([key,label]) => `<option value="${escapeHtml(key)}"${key === value ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
    const content = `<div class="tenebre-journey-dialog">
      <section class="tenebre-journey-options">
        <label class="tenebre-journey-field"><span>${t("Activity")}</span><select name="activity">${options([["travel",t("Travelling")],["stay",t("Staying")]], config.activity)}</select></label>
        <label class="tenebre-journey-field"><span>${t("Site")}</span><input name="site" type="text" maxlength="200" value="${escapeHtml(config.site)}"></label>
        <label class="tenebre-journey-field"><span>${game.i18n.localize("TENEBRE.Travel.Mode")}</span><select name="mode">${options(TRAVEL_MODES.map(mode => [mode,game.i18n.localize(`TENEBRE.Travel.Mode${mode[0].toUpperCase()}${mode.slice(1)}`)]),config.mode)}</select></label>
      </section>
      <section class="tenebre-journey-group">
        <p>${t("GroupHint")}</p>
        <div class="tenebre-journey-toggles">
          <label class="tenebre-journey-checkbox"><input name="alongRiver" type="checkbox"${config.alongRiver ? " checked" : ""}><span>${game.i18n.localize("TENEBRE.Travel.AlongRiver")}</span></label>
          <label class="tenebre-journey-checkbox"><input name="dailyEnemiesWhileStaying" type="checkbox"${config.dailyEnemiesWhileStaying !== false ? " checked" : ""}><span>${t("DailyStayEnemies")}</span></label>
        </div>
        <p>${t("StayPolicy")}</p>
      </section>
    </div>`;
    try {
      const value = await foundry.applications.api.DialogV2.prompt({ classes: ["tenebre-journey-config"], window: { title: t("Configure") }, position: { width: 860 }, content, rejectClose: false,
        ok: { label: game.i18n.localize("TENEBRE.Common.Save"), callback: (_e,_b,dialog) => {
          const root = dialog.element;
          return { activity: root.querySelector('[name="activity"]').value, site: root.querySelector('[name="site"]').value,
            mode: root.querySelector('[name="mode"]').value, alongRiver: root.querySelector('[name="alongRiver"]').checked,
            dailyEnemiesWhileStaying: root.querySelector('[name="dailyEnemiesWhileStaying"]').checked };
        } } });
      if (value) await PartyActorService.setTravel(this.actor, value);
    } catch (error) { console.warn("Tenebre Resources | Journey configuration failed.", error); ui.notifications.error(t("Failed")); }
    this.render(false);
  }

  async _onResolveJourney(kind, apply = false) {
    if (this._resolvingJourney) return;
    this._resolvingJourney = true;
    try {
      if (apply) {
        if (!game.user?.isGM) return;
        const visible = await PartyActorService.visibleExpedition(this.actor);
        const effort = visible.dayState.journey?.effort;
        if (!effort || effort.restricted) throw new Error("Effort result unavailable.");
        const review = `<ul>${effort.members.map(m => `<li>${escapeHtml(m.name)}: ${m.initialToughness} → ${Math.max(0,m.initialToughness-m.damage)}${m.mortalWound ? ` — ${escapeHtml(game.i18n.localize("TENEBRE.Journey.MortalWound"))}` : ""}</li>`).join("")}</ul>`;
        const choice = await foundry.applications.api.DialogV2.prompt({ window: { title: game.i18n.localize("TENEBRE.Journey.ApplyEffort") },
          content: `${review}<p>${escapeHtml(game.i18n.localize("TENEBRE.Journey.ApplyHint"))}</p><select name="wound"><option value="manual">${escapeHtml(game.i18n.localize("TENEBRE.Journey.WoundManual"))}</option><option value="zeroToughness">${escapeHtml(game.i18n.localize("TENEBRE.Journey.WoundZero"))}</option></select>`,
          rejectClose: false, ok: { label: game.i18n.localize("TENEBRE.Common.Confirm"), callback: (_e,_b,d) => d.element.querySelector('[name="wound"]').value } });
        if (choice) await ExpeditionJourneyService.applyEffort(this.actor, choice);
      } else await ExpeditionJourneyService.resolve(this.actor, kind);
    } catch (error) { console.warn("Tenebre Resources | Journey check failed.", error); ui.notifications.error(game.i18n.localize("TENEBRE.Journey.Failed")); }
    finally { this._resolvingJourney = false; this.render(false); }
  }

  async _onRollSingleEvent(slotKey) {
    if (!this.isEditable && !globalThis.game?.user?.isGM) return;
    try { await PartyActorService.rollEvents(this.actor, [slotKey]); }
    catch (error) { console.warn("Tenebre Resources | Events failed.", error); globalThis.ui?.notifications?.error?.(game.i18n.localize("TENEBRE.Party.EventFailedNotice")); }
    this.render(false);
  }

  async _onResetSingleEvent(slotKey) {
    if (!this.isEditable && !globalThis.game?.user?.isGM) return;
    if (!["ruins", "encounters", "enemies", "terrain"].includes(slotKey)) return;
    try { await PartyActorService.resetEvent(this.actor, slotKey); }
    catch (error) { console.warn("Tenebre Resources | Event reset failed.", error); globalThis.ui?.notifications?.error?.(game.i18n.localize("TENEBRE.Party.EventFailedNotice")); }
    this.render(false);
  }

  async _onRollAllEvents() {
    if (!this.isEditable && !globalThis.game?.user?.isGM) return;
    try { await PartyActorService.rollEvents(this.actor, ["ruins", "encounters", "enemies", "terrain"]); }
    catch (error) { console.warn("Tenebre Resources | Events failed.", error); globalThis.ui?.notifications?.error?.(game.i18n.localize("TENEBRE.Party.EventFailedNotice")); }
    this.render(false);
  }

  async _onSelectGuide() {
    if (!this.isEditable) return;

    const memberIds = Array.isArray(this.actor?.system?.members) ? this.actor.system.members : [];
    const companionIds = Array.isArray(this.actor?.system?.companions) ? this.actor.system.companions : [];
    const candidates = [];

    for (const mId of memberIds) {
      const a = this._resolveActor(mId);
      if (a) candidates.push({ id: actorReference(a), name: a.name, type: "member" });
    }
    for (const cId of companionIds) {
      const a = this._resolveActor(cId);
      if (a) candidates.push({ id: actorReference(a), name: a.name, type: "companion" });
    }

    if (candidates.length === 0) {
      globalThis.ui?.notifications?.warn?.(
        globalThis.game?.i18n?.localize?.("TENEBRE.Party.NoCandidatesForGuide") ||
        "Não há personagens ou companheiros no grupo para definir como guia."
      );
      return;
    }

    const currentGuide = this._getExpeditionData();
    const currentGuideId = actorReference(this._resolveActor(currentGuide.guideUuid || currentGuide.guideId)) || "";
    const memberLabel = globalThis.game?.i18n?.localize?.("TENEBRE.Party.MembersSectionTitle") || "Personagens";
    const companionLabel = globalThis.game?.i18n?.localize?.("TENEBRE.Party.CompanionsSectionTitle") || "Companheiros";

    const membersGroup = candidates.filter(c => c.type === "member");
    const companionsGroup = candidates.filter(c => c.type === "companion");

    let optionsHtml = "";
    if (membersGroup.length > 0) {
      optionsHtml += `<optgroup label="${memberLabel}">` +
        membersGroup.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === currentGuideId ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("") +
        `</optgroup>`;
    }
    if (companionsGroup.length > 0) {
      optionsHtml += `<optgroup label="${companionLabel}">` +
        companionsGroup.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === currentGuideId ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("") +
        `</optgroup>`;
    }

    const title = globalThis.game?.i18n?.localize?.("TENEBRE.Party.SelectGuideDialogTitle") || "Definir Guia do Grupo";
    const prompt = globalThis.game?.i18n?.localize?.("TENEBRE.Party.SelectGuidePrompt") || "Selecione o personagem responsável por orientar a expedição em Davokar:";

    const content = `
      <form class="guide-selection-dialog-form" style="display:flex; flex-direction:column; gap:10px;">
        <p style="margin:0 0 5px; font-size:0.9em; opacity:0.85;">${prompt}</p>
        <div class="form-group" style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-weight:bold; font-size:0.9em;">${globalThis.game?.i18n?.localize?.("TENEBRE.Party.GuideLabel") || "Guia"}:</label>
          <select id="guide-select-choice" style="width:100%; height:28px;">
            ${optionsHtml}
          </select>
        </div>
      </form>
    `;

    if (!globalThis.Dialog) return;

    new globalThis.Dialog({
      title: title,
      content: content,
      buttons: {
        confirm: {
          icon: '<i class="fas fa-compass"></i>',
          label: globalThis.game?.i18n?.localize?.("DIALOG.OK") || "Confirmar",
          callback: async (html) => {
            const root = html?.[0] ?? html;
            const chosenId = root.querySelector("#guide-select-choice")?.value;
            if (chosenId) {
              await this._onSetGuide(chosenId);
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: globalThis.game?.i18n?.localize?.("DIALOG.CANCEL") || "Cancelar"
        }
      },
      default: "confirm"
    }).render(true);
  }

  async _onDropGuide(event, data) {
    if (!this.isEditable) return false;
    let actorDoc = null;
    if (globalThis.Actor?.implementation?.fromDropData) {
      try { actorDoc = await globalThis.Actor.implementation.fromDropData(data); } catch {}
    }
    if (!actorDoc && data?.uuid && globalThis.fromUuid) {
      try { actorDoc = await globalThis.fromUuid(data.uuid); } catch {}
    }
    if (!actorDoc && data?.id) {
      actorDoc = this._resolveActor(data.id);
    }
    if (!actorDoc) return false;
    await this._onSetGuide(actorReference(actorDoc));
    return true;
  }

  _onDragStart(event) {
    const li = event.currentTarget;
    if (event.target?.classList?.contains("content-link")) return;

    if (li?.dataset?.itemId) {
      const item = this.actor?.items?.get?.(li.dataset.itemId);
      if (item) {
        const dragData = typeof item.toDragData === "function"
          ? item.toDragData()
          : { type: "Item", uuid: item.uuid, id: item.id };
        event.dataTransfer?.setData?.("text/plain", JSON.stringify(dragData));
        return;
      }
    }

    if (li?.dataset?.actorId) {
      const actorDoc = this._resolveActor(li.dataset.actorId);
      if (actorDoc) {
        const dragData = typeof actorDoc.toDragData === "function"
          ? actorDoc.toDragData()
          : { type: "Actor", uuid: actorDoc.uuid, id: actorDoc.id };
        event.dataTransfer?.setData?.("text/plain", JSON.stringify(dragData));
        return;
      }
    }

    return super._onDragStart ? super._onDragStart(event) : undefined;
  }

  async _onDrop(event, dropData = null) {
    let data = dropData;
    if (!data) {
      try {
        data = globalThis.TextEditor?.getDragEventData?.(event)
          ?? JSON.parse(event.dataTransfer?.getData("text/plain") ?? "null");
      } catch {
        data = null;
      }
    }
    if (!data) return false;

    const isGuideDrop = Boolean(event.target?.closest?.(".party-guide-box, [data-drop-zone='expedition-guide']"));
    if (isGuideDrop) {
      return this._onDropGuide(event, data);
    }

    const isStorageDrop = Boolean(event.target?.closest?.(".party-storage-location-box, [data-drop-zone='storage-location'], [data-drop-zone='draft-animal']"));
    if (isStorageDrop) {
      return this._onDropStorageLocation(event, data);
    }

    if (data.type === "Actor" || data.type === "Token") {
      return this._onDropActor(event, data);
    }
    if (data.type === "Item") {
      return this._onDropItem(event, data);
    }
    return super._onDrop ? super._onDrop(event) : false;
  }

  async _onDropItem(event, data) {
    if (!this.isEditable) return false;

    let item = null;
    if (globalThis.Item?.implementation?.fromDropData) {
      try {
        item = await globalThis.Item.implementation.fromDropData(data);
      } catch {}
    }
    if (!item && data?.uuid && globalThis.fromUuid) {
      try {
        item = await globalThis.fromUuid(data.uuid);
      } catch {}
    }
    if (!item && data?.data) {
      item = data.data;
    }
    if (!item) return false;

    const itemData = typeof item.toObject === "function"
      ? item.toObject()
      : (globalThis.foundry?.utils?.deepClone?.(item) ?? item);

    // Se o item já pertence a este ator, faz reordenação interna
    if (this.actor.uuid === item.parent?.uuid) {
      return this._onSortItem ? this._onSortItem(event, itemData) : false;
    }

    return this._onDropItemCreate(itemData);
  }

  async _onDropItemCreate(itemData) {
    const items = Array.isArray(itemData) ? itemData : [itemData];
    return this.actor.createEmbeddedDocuments("Item", items);
  }

  async _onDeleteItem(itemId) {
    if (!this.isEditable || !itemId) return;
    const item = this.actor?.items?.get?.(itemId);
    if (!item) return;

    if (globalThis.Dialog && globalThis.game?.i18n?.localize) {
      const title = globalThis.game.i18n.localize("TOOLTIP.DELETE_ITEM") || "Excluir Item";
      const confirmLabel = globalThis.game.i18n.localize("DIALOG.OK") || "OK";
      const cancelLabel = globalThis.game.i18n.localize("DIALOG.CANCEL") || "Cancelar";
      new globalThis.Dialog({
        title: title,
        content: `<p>${escapeHtml(title)}: <strong>${escapeHtml(item.name)}</strong>?</p>`,
        buttons: {
          yes: {
            label: confirmLabel,
            callback: () => this.actor.deleteEmbeddedDocuments("Item", [itemId])
          },
          no: {
            label: cancelLabel
          }
        },
        default: "no"
      }).render(true);
    } else {
      await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
    }
  }

  async _onIncreaseItemQuantity(itemId) {
    if (!this.isEditable || !itemId) return;
    const item = this.actor?.items?.get?.(itemId);
    if (!item) return;
    const quantity = Number(item.system?.number ?? item.system?.quantity ?? 1);
    const current = Number.isFinite(quantity) ? Math.max(0, quantity) : 1;
    await item.update({ "system.number": current + 1 });
  }

  async _onDecreaseItemQuantity(itemId) {
    if (!this.isEditable || !itemId) return;
    const item = this.actor?.items?.get?.(itemId);
    if (!item) return;
    const quantity = Number(item.system?.number ?? item.system?.quantity ?? 1);
    const current = Number.isFinite(quantity) ? Math.max(0, quantity) : 1;
    if (current > 1) {
      await item.update({ "system.number": current - 1 });
    }
  }

  async _onToggleMemberType(actorId) {
    if (!this.isEditable || !actorId) return;
    const currentMembers = Array.isArray(this.actor?.system?.members) ? [...this.actor.system.members] : [];
    const currentCompanions = Array.isArray(this.actor?.system?.companions) ? [...this.actor.system.companions] : [];

    const memberActor = this._resolveActor(actorId);
    const matches = ref => ref === actorId || actorMatchesReference(memberActor, ref);
    if (currentMembers.some(matches)) {
      const newMembers = currentMembers.filter(ref => !matches(ref));
      const newCompanions = [...currentCompanions.filter(ref => !matches(ref)), actorId];
      return this.actor.update({
        "system.members": newMembers,
        "system.companions": newCompanions
      });
    } else if (currentCompanions.some(matches)) {
      const newCompanions = currentCompanions.filter(ref => !matches(ref));
      const newMembers = [...currentMembers.filter(ref => !matches(ref)), actorId];
      return this.actor.update({
        "system.members": newMembers,
        "system.companions": newCompanions
      });
    }
  }

  async _onDropActor(event, data) {
    if (!this.isEditable) return false;
    let droppedActor = null;
    if (data.uuid) {
      const doc = await globalThis.fromUuid?.(data.uuid);
      droppedActor = doc?.actor ?? doc;
    } else if (data.id) {
      droppedActor = globalThis.game?.actors?.get(data.id);
    }
    if (!droppedActor || !droppedActor.id) return false;

    if (actorMatchesReference(droppedActor, actorReference(this.actor))) return false;
    if (isPartyActor(droppedActor)) return false;

    const currentMembers = Array.isArray(this.actor?.system?.members) ? [...this.actor.system.members] : [];
    const currentCompanions = Array.isArray(this.actor?.system?.companions) ? [...this.actor.system.companions] : [];

    const isCompanionTarget = Boolean(event?.target?.closest?.(".party-companions-section, [data-drop-zone='companions']"));
    const isMemberTarget = Boolean(event?.target?.closest?.(".party-members-section, [data-drop-zone='members']"));

    // Se soltou na seção de companheiros, ou se soltou um monstro/criatura/PNJ sem ter mirado na de jogadores
    const targetCompanion = isCompanionTarget || (!isMemberTarget && droppedActor.type === "monster");

    if (targetCompanion) {
      if (currentCompanions.some(ref => actorMatchesReference(droppedActor, ref))) {
        return false;
      }
      const newMembers = currentMembers.filter(ref => !actorMatchesReference(droppedActor, ref));
      const newCompanions = [...currentCompanions, actorReference(droppedActor)];
      const updates = { "system.companions": newCompanions };
      if (newMembers.length !== currentMembers.length) {
        updates["system.members"] = newMembers;
      }
      return this.actor.update(updates);
    } else {
      if (currentMembers.some(ref => actorMatchesReference(droppedActor, ref))) {
        return false;
      }
      const newCompanions = currentCompanions.filter(ref => !actorMatchesReference(droppedActor, ref));
      const newMembers = [...currentMembers, actorReference(droppedActor)];
      const updates = { "system.members": newMembers };
      if (newCompanions.length !== currentCompanions.length) {
        updates["system.companions"] = newCompanions;
      }
      return this.actor.update(updates);
    }
  }

  async _onRemoveMember(actorId) {
    if (!this.isEditable || !actorId) return;
    const currentMembers = Array.isArray(this.actor?.system?.members) ? [...this.actor.system.members] : [];
    const currentCompanions = Array.isArray(this.actor?.system?.companions) ? [...this.actor.system.companions] : [];
    const memberActor = this._resolveActor(actorId);
    const keep = ref => ref !== actorId && !actorMatchesReference(memberActor, ref);
    const filteredMembers = currentMembers.filter(keep);
    const filteredCompanions = currentCompanions.filter(keep);
    const updates = {};
    if (filteredMembers.length !== currentMembers.length) {
      updates["system.members"] = filteredMembers;
    }
    if (filteredCompanions.length !== currentCompanions.length) {
      updates["system.companions"] = filteredCompanions;
    }
    if (Object.keys(updates).length > 0) {
      return this.actor.update(updates);
    }
  }

  async _onDropStorageLocation(event, data) {
    if (!this.isEditable) return false;

    let doc = null;
    let docType = "";

    if (data.type === "Actor" || data.type === "Token") {
      docType = "actor";
      if (data.uuid && globalThis.fromUuid) {
        try {
          const resolved = await globalThis.fromUuid(data.uuid);
          doc = resolved?.actor ?? resolved;
        } catch {}
      }
      if (!doc && data.id) {
        doc = globalThis.game?.actors?.get(data.id);
      }
    } else if (data.type === "Item") {
      docType = "item";
      if (globalThis.Item?.implementation?.fromDropData) {
        try { doc = await globalThis.Item.implementation.fromDropData(data); } catch {}
      }
      if (!doc && data.uuid && globalThis.fromUuid) {
        try { doc = await globalThis.fromUuid(data.uuid); } catch {}
      }
      if (!doc && data.id) {
        doc = globalThis.game?.items?.get(data.id) ?? this.actor?.items?.get(data.id);
      }
      if (!doc && data.data) {
        doc = data.data;
      }
    }

    if (!doc) return false;

    // Se for o próprio ator de grupo, ignora
    if (doc.id === this.actor?.id || doc.uuid === this.actor?.uuid) return false;

    const name = doc.name || "Armazenamento";
    const img = doc.img || (docType === "actor" ? "icons/environment/creatures/horse-brown.webp" : "icons/environment/settlement/wagon.webp");
    const category = detectStorageCategory(name, doc.type || docType);
    const capacity = detectStorageCapacity(name, doc.type || docType);

    const isDraftSlot = Boolean(event.target?.closest?.("[data-drop-zone='draft-animal'], .draft-unit, .storage-hitch-slot"));
    const currentStorage = this.actor?.system?.storageLocation ?? {};
    const hasCurrentStorage = Boolean(currentStorage.name || currentStorage.id || currentStorage.uuid);

    // 1. Drop diretamente no slot de animal de tração OU se o armazenamento atual for veículo/custom e o drop for um animal:
    if (isDraftSlot || (hasCurrentStorage && currentStorage.category !== "animal" && category === "animal")) {
      await this.actor.update({
        "system.storageLocation.draftAnimal": {
          id: doc.id || "",
          uuid: doc.uuid || "",
          name: name,
          img: img,
          type: docType,
          capacity: capacity
        }
      });
      const msg = globalThis.game?.i18n?.format
        ? globalThis.game.i18n.format("TENEBRE.Party.DraftAnimalLinkedNotice", { name: name })
        : `Animal de tração vinculado: ${name}`;
      globalThis.ui?.notifications?.info?.(msg);
      return true;
    }

    // 2. Se o armazenamento atual era um animal e o usuário soltou um veículo:
    // Transforma o veículo no armazenamento principal e preserva o animal como draftAnimal!
    if (hasCurrentStorage && currentStorage.category === "animal" && category === "vehicle") {
      const prevAnimal = {
        id: currentStorage.id || "",
        uuid: currentStorage.uuid || "",
        name: currentStorage.name || "Animal",
        img: currentStorage.img || "icons/environment/creatures/horse-brown.webp",
        type: currentStorage.type || "actor",
        capacity: currentStorage.capacity || 80
      };
      await this.actor.update({
        "system.storageLocation": {
          id: doc.id || "",
          uuid: doc.uuid || "",
          name: name,
          img: img,
          type: docType,
          category: category,
          capacity: capacity,
          draftAnimal: prevAnimal
        }
      });
      const msg = globalThis.game?.i18n?.format
        ? globalThis.game.i18n.format("TENEBRE.Party.StorageLinkedNotice", { name: name, capacity: capacity })
        : `Local de armazenamento vinculado: ${name} (Capacidade: ${capacity} unidades)`;
      globalThis.ui?.notifications?.info?.(msg);
      return true;
    }

    // 3. Caso padrão: vincula como local principal preservando animal se for compatível
    const existingDraft = currentStorage.draftAnimal || null;
    await this.actor.update({
      "system.storageLocation": {
        id: doc.id || "",
        uuid: doc.uuid || "",
        name: name,
        img: img,
        type: docType,
        category: category,
        capacity: capacity,
        draftAnimal: category === "vehicle" ? existingDraft : null
      }
    });

    const msg = globalThis.game?.i18n?.format
      ? globalThis.game.i18n.format("TENEBRE.Party.StorageLinkedNotice", { name: name, capacity: capacity })
      : `Local de armazenamento vinculado: ${name} (Capacidade: ${capacity} unidades)`;
    globalThis.ui?.notifications?.info?.(msg);
    return true;
  }

  async _onSelectStorageLocation() {
    if (!this.isEditable) return;

    const companionIds = Array.isArray(this.actor?.system?.companions) ? this.actor.system.companions : [];
    const companions = [];
    for (const compId of companionIds) {
      const comp = this._resolveActor(compId);
      if (comp) {
        companions.push({
          id: actorReference(comp),
          uuid: comp.uuid,
          name: comp.name,
          img: comp.img || "icons/environment/creatures/horse-brown.webp",
          capacity: detectStorageCapacity(comp.name, comp.type),
          category: detectStorageCategory(comp.name, comp.type)
        });
      }
    }

    let companionOptionsHtml = "";
    if (companions.length > 0) {
      companionOptionsHtml = `<optgroup label="${globalThis.game?.i18n?.localize?.("TENEBRE.Party.StorageOptionCompanions") || "Companheiros do Grupo"}">` +
        companions.map(c => `<option value="comp:${escapeHtml(c.id)}">${escapeHtml(c.name)} (${c.category === "animal" ? "Animal" : "Companheiro"} - ${c.capacity} un.)</option>`).join("") +
        `</optgroup>`;
    }

    const presetOptionsHtml = `<optgroup label="${globalThis.game?.i18n?.localize?.("TENEBRE.Party.StorageOptionPresets") || "Locais e Veículos Oficiais"}">` +
      OFFICIAL_STORAGE_PRESETS.map(p => `<option value="preset:${p.id}">${p.name} (${p.capacity} un.)</option>`).join("") +
      `</optgroup>`;

    const customOptionHtml = `<option value="custom">${globalThis.game?.i18n?.localize?.("TENEBRE.Party.StorageOptionCustom") || "Personalizado..."}</option>`;

    const title = globalThis.game?.i18n?.localize?.("TENEBRE.Party.SelectStorageDialogTitle") || "Vincular Local de Armazenamento do Grupo";
    const prompt = globalThis.game?.i18n?.localize?.("TENEBRE.Party.SelectStoragePrompt") || "Selecione onde o inventário do grupo está armazenado:";
    const nameLabel = globalThis.game?.i18n?.localize?.("TENEBRE.Party.StorageNameLabel") || "Nome do Local";
    const capLabel = globalThis.game?.i18n?.localize?.("TENEBRE.Party.StorageCapacityLabel") || "Capacidade Máxima (unidades)";

    const content = `
      <form class="storage-selection-dialog-form" style="display:flex; flex-direction:column; gap:10px;">
        <p style="margin:0 0 5px; font-size:0.9em; opacity:0.85;">${prompt}</p>
        <div class="form-group" style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-weight:bold; font-size:0.9em;">Opção:</label>
          <select id="storage-select-choice" style="width:100%; height:28px;">
            ${companionOptionsHtml}
            ${presetOptionsHtml}
            ${customOptionHtml}
          </select>
        </div>
        <div class="form-group" id="storage-custom-name-group" style="display:none; flex-direction:column; gap:4px;">
          <label style="font-weight:bold; font-size:0.9em;">${nameLabel}:</label>
          <input type="text" id="storage-custom-name" placeholder="Ex.: Carroça Reforçada, Depósito em Kastor..." style="width:100%; height:26px;" />
        </div>
        <div class="form-group" style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-weight:bold; font-size:0.9em;">${capLabel}:</label>
          <input type="number" id="storage-custom-cap" value="200" min="0" style="width:100%; height:26px;" />
        </div>
      </form>
    `;

    if (!globalThis.Dialog) return;

    new globalThis.Dialog({
      title: title,
      content: content,
      buttons: {
        confirm: {
          icon: '<i class="fas fa-check"></i>',
          label: globalThis.game?.i18n?.localize?.("DIALOG.OK") || "Confirmar",
          callback: async (html) => {
            const root = html?.[0] ?? html;
            const choice = root.querySelector("#storage-select-choice")?.value || "";
            const customName = root.querySelector("#storage-custom-name")?.value?.trim() || "";
            const capVal = Number(root.querySelector("#storage-custom-cap")?.value) || 0;

            let finalStorage = null;

            if (choice.startsWith("comp:")) {
              const compId = choice.slice(5);
              const comp = companions.find(c => c.id === compId);
              if (comp) {
                finalStorage = {
                  id: comp.id,
                  uuid: comp.uuid,
                  name: comp.name,
                  img: comp.img,
                  type: "actor",
                  category: comp.category,
                  capacity: capVal > 0 ? capVal : comp.capacity
                };
              }
            } else if (choice.startsWith("preset:")) {
              const presetId = choice.slice(7);
              const preset = OFFICIAL_STORAGE_PRESETS.find(p => p.id === presetId);
              if (preset) {
                finalStorage = {
                  id: preset.id,
                  uuid: "",
                  name: preset.name,
                  img: preset.img,
                  type: "preset",
                  category: preset.category,
                  capacity: capVal > 0 ? capVal : preset.capacity
                };
              }
            } else {
              finalStorage = {
                id: "",
                uuid: "",
                name: customName || (globalThis.game?.i18n?.localize?.("TENEBRE.Party.StorageCategoryCustom") || "Armazenamento"),
                img: "icons/environment/settlement/wagon.webp",
                type: "custom",
                category: "custom",
                capacity: capVal > 0 ? capVal : 100
              };
            }

            if (finalStorage) {
              const existingDraft = this.actor?.system?.storageLocation?.draftAnimal;
              if (existingDraft && (existingDraft.name || existingDraft.id || existingDraft.uuid) && (finalStorage.category === "vehicle" || finalStorage.category === "custom")) {
                finalStorage.draftAnimal = existingDraft;
              }
              await this.actor.update({ "system.storageLocation": finalStorage });
              const msg = globalThis.game?.i18n?.format
                ? globalThis.game.i18n.format("TENEBRE.Party.StorageLinkedNotice", { name: finalStorage.name, capacity: finalStorage.capacity })
                : `Local de armazenamento vinculado: ${finalStorage.name}`;
              globalThis.ui?.notifications?.info?.(msg);
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: globalThis.game?.i18n?.localize?.("DIALOG.CANCEL") || "Cancelar"
        }
      },
      default: "confirm",
      render: (html) => {
        const root = html?.[0] ?? html;
        const select = root.querySelector("#storage-select-choice");
        const customNameGroup = root.querySelector("#storage-custom-name-group");
        const capInput = root.querySelector("#storage-custom-cap");

        const updateFields = () => {
          const val = select.value;
          if (val === "custom") {
            if (customNameGroup) customNameGroup.style.display = "flex";
            if (capInput) capInput.value = 100;
          } else if (val.startsWith("preset:")) {
            if (customNameGroup) customNameGroup.style.display = "none";
            const presetId = val.slice(7);
            const preset = OFFICIAL_STORAGE_PRESETS.find(p => p.id === presetId);
            if (preset && capInput) capInput.value = preset.capacity;
          } else if (val.startsWith("comp:")) {
            if (customNameGroup) customNameGroup.style.display = "none";
            const compId = val.slice(5);
            const comp = companions.find(c => c.id === compId);
            if (comp && capInput) capInput.value = comp.capacity;
          }
        };

        select?.addEventListener("change", updateFields);
        updateFields();
      }
    }).render(true);
  }

  async _onEditStorageCapacity() {
    if (!this.isEditable) return;
    const currentCap = Number(this.actor?.system?.storageLocation?.capacity) || 0;
    const title = globalThis.game?.i18n?.localize?.("TENEBRE.Party.EditCapacityDialogTitle") || "Alterar Capacidade de Carga";
    const label = globalThis.game?.i18n?.localize?.("TENEBRE.Party.StorageCapacityLabel") || "Capacidade Máxima (unidades)";

    if (globalThis.Dialog) {
      new globalThis.Dialog({
        title: title,
        content: `
          <div style="margin-bottom:10px;">
            <p style="font-size:0.9em; opacity:0.85; margin:0 0 8px;">Defina o novo limite de carga que este local suporta:</p>
            <label style="font-weight:bold; display:block; margin-bottom:4px;">${label}:</label>
            <input type="number" id="new-storage-capacity-val" value="${currentCap}" min="0" style="width:100%; height:28px;" />
          </div>
        `,
        buttons: {
          confirm: {
            label: globalThis.game?.i18n?.localize?.("DIALOG.OK") || "Salvar",
            callback: async (html) => {
              const root = html?.[0] ?? html;
              const val = Number(root.querySelector("#new-storage-capacity-val")?.value);
              if (!isNaN(val) && val >= 0) {
                await this.actor.update({ "system.storageLocation.capacity": val });
              }
            }
          },
          cancel: {
            label: globalThis.game?.i18n?.localize?.("DIALOG.CANCEL") || "Cancelar"
          }
        },
        default: "confirm"
      }).render(true);
    }
  }

  async _onUnlinkStorageLocation() {
    if (!this.isEditable) return;
    await this.actor.update({
      "system.storageLocation": {
        id: "",
        uuid: "",
        name: "",
        img: "",
        type: "",
        category: "",
        capacity: 0,
        draftAnimal: {
          id: "",
          uuid: "",
          name: "",
          img: "",
          type: "",
          capacity: 0
        }
      }
    });
    globalThis.ui?.notifications?.info?.(
      globalThis.game?.i18n?.localize?.("TENEBRE.Party.StorageUnlinkedNotice") ||
      "Local de armazenamento desvinculado."
    );
  }

  async _onLinkDraftAnimal() {
    if (!this.isEditable) return;

    const companionIds = Array.isArray(this.actor?.system?.companions) ? this.actor.system.companions : [];
    const companions = [];
    for (const compId of companionIds) {
      const comp = this._resolveActor(compId);
      if (comp) {
        companions.push({
          id: actorReference(comp),
          uuid: comp.uuid,
          name: comp.name,
          img: comp.img || "icons/environment/creatures/horse-brown.webp",
          capacity: detectStorageCapacity(comp.name, comp.type),
          category: detectStorageCategory(comp.name, comp.type)
        });
      }
    }

    const draftPresets = OFFICIAL_STORAGE_PRESETS.filter(p => p.category === "animal");

    let companionOptionsHtml = "";
    if (companions.length > 0) {
      companionOptionsHtml = `<optgroup label="${globalThis.game?.i18n?.localize?.("TENEBRE.Party.StorageOptionCompanions") || "Companheiros do Grupo"}">` +
        companions.map(c => `<option value="comp:${escapeHtml(c.id)}">${escapeHtml(c.name)} (${c.category === "animal" ? "Animal" : "Companheiro"} - ${c.capacity} un.)</option>`).join("") +
        `</optgroup>`;
    }

    const presetOptionsHtml = `<optgroup label="${globalThis.game?.i18n?.localize?.("TENEBRE.Party.StorageOptionPresets") || "Animais Oficiais"}">` +
      draftPresets.map(p => `<option value="preset:${p.id}">${p.name} (${p.capacity} un.)</option>`).join("") +
      `</optgroup>`;

    const customOptionHtml = `<option value="custom">${globalThis.game?.i18n?.localize?.("TENEBRE.Party.StorageOptionCustom") || "Personalizado..."}</option>`;

    const title = globalThis.game?.i18n?.localize?.("TENEBRE.Party.SelectDraftAnimalTitle") || "Atrelar Animal de Tração / Cavalo";
    const prompt = globalThis.game?.i18n?.localize?.("TENEBRE.Party.SelectDraftAnimalPrompt") || "Selecione o cavalo ou animal de tração para atrelar ao veículo:";
    const nameLabel = globalThis.game?.i18n?.localize?.("TENEBRE.Party.StorageNameLabel") || "Nome do Animal";
    const capLabel = globalThis.game?.i18n?.localize?.("TENEBRE.Party.StorageCapacityLabel") || "Capacidade de Carga (unidades)";

    const content = `
      <form class="storage-selection-dialog-form" style="display:flex; flex-direction:column; gap:10px;">
        <p style="margin:0 0 5px; font-size:0.9em; opacity:0.85;">${prompt}</p>
        <div class="form-group" style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-weight:bold; font-size:0.9em;">Animal de Tração:</label>
          <select id="draft-animal-choice" style="width:100%; height:28px;">
            ${companionOptionsHtml}
            ${presetOptionsHtml}
            ${customOptionHtml}
          </select>
        </div>
        <div class="form-group" id="draft-custom-name-group" style="display:none; flex-direction:column; gap:4px;">
          <label style="font-weight:bold; font-size:0.9em;">${nameLabel}:</label>
          <input type="text" id="draft-custom-name" placeholder="Ex.: Alazão, Cavalo de Carga..." style="width:100%; height:26px;" />
        </div>
        <div class="form-group" style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-weight:bold; font-size:0.9em;">${capLabel}:</label>
          <input type="number" id="draft-custom-cap" value="80" min="0" style="width:100%; height:26px;" />
        </div>
      </form>
    `;

    if (!globalThis.Dialog) return;

    new globalThis.Dialog({
      title: title,
      content: content,
      buttons: {
        confirm: {
          icon: '<i class="fas fa-check"></i>',
          label: globalThis.game?.i18n?.localize?.("DIALOG.OK") || "Atrelar",
          callback: async (html) => {
            const root = html?.[0] ?? html;
            const choice = root.querySelector("#draft-animal-choice")?.value || "";
            const customName = root.querySelector("#draft-custom-name")?.value?.trim() || "";
            const capVal = Number(root.querySelector("#draft-custom-cap")?.value) || 0;

            let finalDraft = null;

            if (choice.startsWith("comp:")) {
              const compId = choice.slice(5);
              const comp = companions.find(c => c.id === compId);
              if (comp) {
                finalDraft = {
                  id: comp.id,
                  uuid: comp.uuid,
                  name: comp.name,
                  img: comp.img,
                  type: "actor",
                  capacity: capVal > 0 ? capVal : comp.capacity
                };
              }
            } else if (choice.startsWith("preset:")) {
              const presetId = choice.slice(7);
              const preset = draftPresets.find(p => p.id === presetId);
              if (preset) {
                finalDraft = {
                  id: preset.id,
                  uuid: "",
                  name: preset.name,
                  img: preset.img,
                  type: "preset",
                  capacity: capVal > 0 ? capVal : preset.capacity
                };
              }
            } else {
              finalDraft = {
                id: "",
                uuid: "",
                name: customName || (globalThis.game?.i18n?.localize?.("TENEBRE.Party.DraftAnimalBadge") || "Cavalo"),
                img: "icons/environment/creatures/horse-brown.webp",
                type: "custom",
                capacity: capVal > 0 ? capVal : 80
              };
            }

            if (finalDraft) {
              await this.actor.update({ "system.storageLocation.draftAnimal": finalDraft });
              const msg = globalThis.game?.i18n?.format
                ? globalThis.game.i18n.format("TENEBRE.Party.DraftAnimalLinkedNotice", { name: finalDraft.name })
                : `Animal de tração vinculado: ${finalDraft.name}`;
              globalThis.ui?.notifications?.info?.(msg);
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: globalThis.game?.i18n?.localize?.("DIALOG.CANCEL") || "Cancelar"
        }
      },
      default: "confirm",
      render: (html) => {
        const root = html?.[0] ?? html;
        const select = root.querySelector("#draft-animal-choice");
        const customNameGroup = root.querySelector("#draft-custom-name-group");
        const capInput = root.querySelector("#draft-custom-cap");

        const updateFields = () => {
          const val = select.value;
          if (val === "custom") {
            if (customNameGroup) customNameGroup.style.display = "flex";
            if (capInput) capInput.value = 80;
          } else if (val.startsWith("preset:")) {
            if (customNameGroup) customNameGroup.style.display = "none";
            const presetId = val.slice(7);
            const preset = draftPresets.find(p => p.id === presetId);
            if (preset && capInput) capInput.value = preset.capacity;
          } else if (val.startsWith("comp:")) {
            if (customNameGroup) customNameGroup.style.display = "none";
            const compId = val.slice(5);
            const comp = companions.find(c => c.id === compId);
            if (comp && capInput) capInput.value = comp.capacity;
          }
        };

        select?.addEventListener("change", updateFields);
        updateFields();
      }
    }).render(true);
  }

  async _onUnlinkDraftAnimal() {
    if (!this.isEditable) return;
    await this.actor.update({
      "system.storageLocation.draftAnimal": {
        id: "",
        uuid: "",
        name: "",
        img: "",
        type: "",
        capacity: 0
      }
    });
    globalThis.ui?.notifications?.info?.(
      globalThis.game?.i18n?.localize?.("TENEBRE.Party.DraftAnimalUnlinkedNotice") ||
      "Animal de tração desatrelado."
    );
  }
}

/**
 * Registra o DataModel, o rótulo e a ficha do tipo de Grupo, e impede que os cálculos de
 * combatente do sistema Symbaroum rodem para ele.
 */
export class PartyActorService {
  static #refreshHooksRegistered = false;
  static #pendingMemberRefresh = new Set();

  static register() {
    ExpeditionJourneyService.register({ resolveTable: resolveDavokarEventTable, drawTableResult, eventModifiers: calculateDavokarEventModifiers });
    SocketService.registerHandler("setExpeditionDay", setExpeditionDayAsAuthority);
    SocketService.registerHandler("rollExpeditionOrientation", rollOrientationAsAuthority);
    SocketService.registerHandler("resetExpeditionOrientation", resetOrientationAsAuthority);
    SocketService.registerHandler("readExpeditionResults", readExpeditionResultsAsAuthority);
    SocketService.registerHandler("rollExpeditionEvents", rollEventsAsAuthority);
    SocketService.registerHandler("resetExpeditionEvent", resetEventAsAuthority);
    if (!this.#refreshHooksRegistered) {
      this.#refreshHooksRegistered = true;
      for (const hook of ["updateActor", "deleteActor"]) Hooks.on(hook, actor => this.refreshRelatedSheets(actor));
      for (const type of ["Item", "ActiveEffect"]) {
        for (const action of ["create", "update", "delete"]) Hooks.on(`${action}${type}`, doc => {
          const parent = doc.parent;
          this.refreshRelatedSheets(parent?.documentName === "Item" ? parent.parent : parent);
        });
      }
    }
    const actorConfig = globalThis.CONFIG?.Actor;
    if (!actorConfig) return;

    if (globalThis.foundry?.abstract?.TypeDataModel) {
      actorConfig.dataModels = actorConfig.dataModels ?? {};
      actorConfig.dataModels[PARTY_ACTOR_TYPE] = PartyDataModel;
    }
    actorConfig.typeLabels = actorConfig.typeLabels ?? {};
    actorConfig.typeLabels[PARTY_ACTOR_TYPE] = "TENEBRE.Party.TypeLabel";

    const actorsCollection = globalThis.foundry?.documents?.collections?.Actors;
    actorsCollection?.registerSheet?.(MODULE_ID, PartyActorSheet, {
      types: [PARTY_ACTOR_TYPE],
      makeDefault: true,
      label: "TENEBRE.Party.SheetLabel"
    });

    this._protectActorCalculations();
  }

  static refreshRelatedSheets(actor) {
    if (!actor || isPartyActor(actor)) return;
    const pending = this.#pendingMemberRefresh.size > 0;
    this.#pendingMemberRefresh.add(actor);
    if (pending) return;
    queueMicrotask(() => {
      const changed = [...this.#pendingMemberRefresh];
      this.#pendingMemberRefresh.clear();
      for (const party of globalThis.game?.actors?.values?.() ?? []) {
        if (!isPartyActor(party)) continue;
        const expedition = getActorExpeditionData(party), storage = party.system?.storageLocation;
        const refs = [...(party.system?.members ?? []), ...(party.system?.companions ?? []),
          expedition.guideUuid || expedition.guideId, storage?.uuid, storage?.draftAnimal?.uuid];
        if (!changed.some(member => refs.some(ref => actorMatchesReference(member, ref)))) continue;
        for (const app of Object.values(party.apps ?? {})) {
          if (app instanceof PartyActorSheet && app.rendered) app.render(false);
        }
      }
    });
  }

  static async setTravel(party, configuration) { return ExpeditionJourneyService.setTravel(party, configuration); }

  static async rollOrientation(party, expectedDay = expeditionDayKey(party), rollMode = getRollMode(), expectedOrientation = expeditionOrientationKey(party), circumstanceModifier = 0) {
    if (SocketService.hasActiveGM()) {
      return SocketService.executeAsPrimaryGM("rollExpeditionOrientation", party.uuid, expectedDay, rollMode, expectedOrientation, circumstanceModifier);
    }
    return rollOrientationAsAuthority.call({ socketdata: { userId: game.user?.id } }, party.uuid, expectedDay, rollMode, expectedOrientation, circumstanceModifier);
  }

  static async visibleExpedition(party) {
    const exp = getActorExpeditionData(party);
    if (![exp.dayState.orientation, ...Object.values(exp.dayState.events), ...Object.values(exp.dayState.journey ?? {})].some(r => r?.privateId)) return exp;
    try {
      const keys = await expeditionReadKey();
      const day = expeditionDayKey(party);
      const currentState = JSON.stringify(exp.dayState);
      const envelope = SocketService.hasActiveGM()
        ? await SocketService.executeAsPrimaryGM("readExpeditionResults", party.uuid, day, keys.publicKey)
        : null;
      const visible = envelope ? await openExpeditionRead(envelope, keys.privateKey, JSON.stringify([party.uuid, day, game.user.id])) : null;
      if (expeditionDayKey(party) !== day || JSON.stringify(getActorExpeditionData(party).dayState) !== currentState) return getActorExpeditionData(party);
      if (visible) return { ...exp, dayState: { ...exp.dayState, ...visible } };
    } catch (error) { console.warn("Tenebre Resources | Private expedition results unavailable.", error); }
    return exp;
  }

  static async rollEvents(party, slots, rollMode = getRollMode(), manual = {}) {
    const args = [party.uuid, expeditionDayKey(party), expeditionOrientationKey(party), slots, rollMode, expeditionEventKey(party, slots), manual];
    if (SocketService.hasActiveGM()) return SocketService.executeAsPrimaryGM("rollExpeditionEvents", ...args);
    return rollEventsAsAuthority.call({ socketdata: { userId: game.user?.id } }, ...args);
  }

  static async resetEvent(party, slot) {
    const args = [party.uuid, expeditionDayKey(party), slot, expeditionEventKey(party, [slot])];
    if (SocketService.hasActiveGM()) return SocketService.executeAsPrimaryGM("resetExpeditionEvent", ...args);
    return resetEventAsAuthority.call({ socketdata: { userId: game.user?.id } }, ...args);
  }

  static async resetOrientation(party, expectedDay = expeditionDayKey(party)) {
    if (SocketService.hasActiveGM()) {
      return SocketService.executeAsPrimaryGM("resetExpeditionOrientation", party.uuid, expectedDay);
    }
    return resetOrientationAsAuthority.call({ socketdata: { userId: game.user?.id } }, party.uuid, expectedDay);
  }

  static async setExpeditionDay(party, day, active, expectedDay = expeditionDayKey(party)) {
    if (SocketService.hasActiveGM() && !SocketService.isPrimaryGM()) {
      return SocketService.executeAsPrimaryGM("setExpeditionDay", party.uuid, day, active, expectedDay);
    }
    if (!SocketService.canModify(party)) throw new Error("Expedition party is not owned.");
    if (!Number.isSafeInteger(day) || day < 0 || typeof active !== "boolean" || typeof expectedDay !== "string" || expectedDay.length > 300) {
      throw new Error("Invalid expedition day update.");
    }
    return runExpeditionOperation(party, async () => {
      if (expeditionDayKey(party) !== expectedDay) return false;
      const update = expeditionDayUpdate(day, active);
      const expedition = getActorExpeditionData(party), travel = expeditionTravel(party);
      if (active && !expedition.active && travel.configured && travel.activity === "stay") update[`flags.${MODULE_ID}.expedition.travel.stayStartDay`] = day;
      await party.update(update);
      return true;
    });
  }

  /** O ator do sistema calcula armaduras, armas e atributos; nada disso existe num Grupo. */
  static _protectActorCalculations() {
    ActorPreparation.skipSystemPreparation(isPartyActor);
  }
}

async function setExpeditionDayAsAuthority(partyUuid, day, active, expectedDay) {
  if (!SocketService.isPrimaryGM()) throw new Error("Expedition updates must run on the designated GM.");
  const user = getRequestUser(this);
  const party = await globalThis.fromUuid?.(partyUuid);
  if (party?.documentName !== "Actor" || !isPartyActor(party) || party.pack || party.compendium) {
    throw new Error("Invalid expedition party.");
  }
  if (!user.isGM && !hasOwnerPermission(party, user)) throw new Error("Expedition party is not owned by the requester.");
  return PartyActorService.setExpeditionDay(party, day, active, expectedDay);
}

async function orientationRequest(context, partyUuid, expectedDay) {
  if (SocketService.hasActiveGM() && !SocketService.isPrimaryGM()) throw new Error("Orientation must run on the designated GM.");
  const user = getRequestUser(context);
  const party = await globalThis.fromUuid?.(partyUuid);
  if (party?.documentName !== "Actor" || !isPartyActor(party) || party.pack || party.compendium) throw new Error("Invalid expedition party.");
  if (typeof expectedDay !== "string" || expectedDay.length > 300) throw new Error("Invalid expedition day.");
  if (!SocketService.canModify(party)) throw new Error("No authorized executor can update the expedition party.");
  return { user, party };
}

async function rollOrientationAsAuthority(partyUuid, expectedDay, rollMode, expectedOrientation, circumstanceModifier = 0) {
  const { user, party } = await orientationRequest(this, partyUuid, expectedDay);
  if (!["publicroll", "gmroll", "blindroll", "selfroll"].includes(rollMode) || typeof expectedOrientation !== "string" || expectedOrientation.length > 8192) throw new Error("Invalid orientation request.");
  if (!Number.isInteger(circumstanceModifier) || Math.abs(circumstanceModifier) > 20 || (!user.isGM && circumstanceModifier !== 0)) throw new Error("Invalid orientation modifier.");
  return runExpeditionOperation(party, async () => {
    const exp = getActorExpeditionData(party);
    if (!exp.active || expeditionDayKey(party) !== expectedDay) return { status: "stale" };
    const guide = await resolveActorReference(exp.guideUuid || exp.guideId);
    if (!guide) throw new Error("Expedition guide not found.");
    if (!user.isGM && !hasOwnerPermission(party, user) && !hasOwnerPermission(guide, user)) throw new Error("Orientation is not owned by the requester.");
    if (expeditionOrientationKey(party) !== expectedOrientation) return { status: "stale" };
    return performOrientationRoll(party, guide, exp, expectedDay, rollMode, user, circumstanceModifier);
  });
}

async function resetOrientationAsAuthority(partyUuid, expectedDay) {
  const { user, party } = await orientationRequest(this, partyUuid, expectedDay);
  if (!user.isGM && !hasOwnerPermission(party, user)) throw new Error("Expedition party is not owned by the requester.");
  return runExpeditionOperation(party, async () => {
    if (expeditionDayKey(party) !== expectedDay) return false;
    await party.update({
      "system.expedition.dayState.orientation": null,
      [`flags.${MODULE_ID}.expedition.dayState.orientation`]: null
    });
    return true;
  });
}

async function performOrientationRoll(party, guideActor, expData, expectedDay, rollMode, rollUser, circumstanceModifier) {
  if (expeditionTravel(party).activity === "stay") return { status: "notTravelling" };
  const regionKey = party?.system?.location?.region || "ambria";
  const bushcraftData = detectBushcraftTier(guideActor);
  const attrs = guideActor.system?.attributes ?? {};
  const getAttrVal = (attrObj) => {
    if (!attrObj) return 0;
    return typeof attrObj === "object" ? Number(attrObj.total ?? attrObj.value ?? 0) : Number(attrObj);
  };
  const vigilantVal = getAttrVal(attrs.vigilant);
  const requirements = orientationRequirements(bushcraftData.level, regionKey);
  if (!requirements.eligible) return { status: "ineligible" };
  const requestKey = expeditionOrientationKey(party);
  const guideKey = orientationGuideKey(guideActor);
  const contextKey = journeyContextKey(party, await resolvePartyTravelActors(party));
  const isCurrent = async () => {
    const actors = await resolvePartyTravelActors(party);
    return expeditionDayKey(party) === expectedDay && expeditionOrientationKey(party) === requestKey && orientationGuideKey(guideActor) === guideKey && journeyContextKey(party, actors) === contextKey;
  };
  if (rollMode !== "publicroll") await ensureExpeditionPrivateStorage();
  if (!await isCurrent()) return { status: "stale" };
  const context = { ...orientationContext(guideActor), circumstanceModifier };
  const orientationTargetData = calculateOrientationTarget(vigilantVal, bushcraftData.level, regionKey);
  const test = await rollOrientationTest(guideActor, orientationTargetData.penalty + context.bonus + circumstanceModifier, context.favour);
  const target = test.target;
  const rollVal = test.total;
  const evalResult = evaluateOrientationRoll(rollVal, target, { eventBenefits: requirements.eventBenefits, hasSucceeded: test.success });
  if (!await isCurrent()) return { status: "stale" };

  const romanLevels = ["—", "I", "II", "III"];
  const bushcraftView = {
    hasBushcraft: bushcraftData.hasBushcraft,
    level: bushcraftData.level,
    levelRoman: romanLevels[bushcraftData.level] || `${bushcraftData.level}`,
    penalty: orientationTargetData.penalty,
    penaltyText: orientationTargetData.penalty === 0 ? "±0" : `${orientationTargetData.penalty}`,
    target: target,
    baseVigilant: orientationTargetData.baseVigilant,
    context,
    item: bushcraftData.item
  };

  const chatContent = buildOrientationChatHtml({
    guideActor,
    regionKey,
    bushcraft: bushcraftView,
    rollVal,
    target,
    evalResult,
    activeSearch: effectiveExpeditionSearch(party)
  });

  const orientationUpdate = {
    rolled: true,
    revision: globalThis.foundry?.utils?.randomID?.() ?? globalThis.crypto.randomUUID(),
    rollTotal: rollVal,
    target,
    baseVigilant: orientationTargetData.baseVigilant,
    penalty: orientationTargetData.penalty,
    verdict: evalResult.verdict,
    margin: evalResult.margin,
    ruinsMod: evalResult.ruinsMod,
    enemiesMod: evalResult.enemiesMod,
    terrainMod: evalResult.terrainMod,
    neutralDetection: evalResult.neutralDetection,
    mishap: evalResult.mishap,
    context,
    contextKey,
    timestamp: Date.now()
  };

  const speaker = globalThis.ChatMessage?.getSpeaker
    ? globalThis.ChatMessage.getSpeaker({ actor: guideActor })
    : { alias: guideActor.name };

  // Executa animação 3D com Dice So Nice e cria mensagem no chat
  await createChatMessageAfterDice({
    speaker, rollMode, rollUser,
    content: chatContent,
    rolls: test.rolls,
    flags: { [MODULE_ID]: { orientationCheck: true } }
  });

  // Persiste o resultado e atualiza a ficha apenas após o dado parar
  if (!await isCurrent()) return { status: "stale" };
  const stored = await storePrivateExpeditionResult(party, "orientation", orientationUpdate, expeditionVisibility(rollMode, rollUser));
  if (!await isCurrent() || !await resolveActorReference(expData.guideUuid || expData.guideId)) return { status: "stale" };
  await party.update({
    "system.expedition.dayState.==orientation": stored,
    [`flags.${MODULE_ID}.expedition.dayState.==orientation`]: stored
  });

  if (evalResult.verdict === "failure") {
    const mishapMod = getMishapsModifier(regionKey);
    const mishapFormula = mishapMod > 0 ? `1d20 + ${mishapMod}` : "1d20";
    const mishapRoll = await evaluateRoll(mishapFormula);
    const configuredMishapsUuid = expData.tables?.mishaps || "";
    const mishapTable = await resolveMishapsTable(configuredMishapsUuid);

    if (mishapTable) {
      await drawMishapTable(mishapTable, mishapRoll, { rollMode, rollUser });
    } else {
      const warnMsg = globalThis.game?.i18n?.localize?.("TENEBRE.Party.MishapsTableNotFound") ||
        "Aviso: Tabela de Infortúnios não encontrada por ID ou UUID. Por favor, selecione ou configure a tabela na ficha do grupo.";
      globalThis.ui?.notifications?.warn?.(warnMsg);
      await createChatMessageAfterDice({
        rollMode, rollUser,
        rolls: [mishapRoll],
        speaker: globalThis.ChatMessage?.getSpeaker?.({ actor: party }) ?? {},
        content: `<div class="symbaroum-ind-resources tenebre-events-card">
          <div class="events-card-header">
            <h4><i class="fas fa-exclamation-triangle" style="color: #c97d34;"></i> Tabela de Infortúnios Não Encontrada</h4>
          </div>
          <div class="events-card-body" style="padding: 10px; font-size: 0.9em; color: #dfddd6; line-height: 1.4;">
            <p style="margin: 0 0 6px 0;">O teste de orientação falhou, mas a <strong>Tabela de Infortúnios</strong> não pôde ser localizada por ID ou UUID configurado.</p>
            <p style="margin: 0; color: #a49f91; font-size: 0.85em;">Por favor, selecione ou importe a Tabela de Infortúnios na ficha do grupo.</p>
          </div>
        </div>`,
        flags: { [MODULE_ID]: { mishapsCheck: true, missingTable: true } }
      });
    }
  }

  return { status: "rolled" };
}


function expeditionVisibility(mode, user) {
  const { whisper = [], blind = false } = getRollVisibility(false, mode, user);
  return { mode, author: user.id, recipients: whisper, blind };
}

function orientationGuideKey(actor) {
  return JSON.stringify([actor.system?.attributes?.vigilant, Array.from(actor.items ?? [], i => [i.id, i.name, i.type, i.system?.level, i.system?.reference, i.system?.bonus?.vigilant]),
    Array.from(actor.effects ?? [], e => [e.id, e.name, e.label, e.disabled, e.isSuppressed, e.origin, e.changes, Array.from(e.statuses ?? []), e.flags]),
    ["alwaysSucceedOnOne", "optionalCrit", "optionalRareCrit"].map(k => game.settings?.get?.("symbaroum", k)), game.settings?.get?.(MODULE_ID, "enableHunger")]);
}

async function readExpeditionResultsAsAuthority(partyUuid, expectedDay, publicKey) {
  const { user, party } = await orientationRequest(this, partyUuid, expectedDay);
  if (expeditionDayKey(party) !== expectedDay) return null;
  const exp = getActorExpeditionData(party);
  const guide = await resolveActorReference(exp.guideUuid || exp.guideId);
  if (!user.isGM && !party.testUserPermission?.(user, "OBSERVER") && !hasOwnerPermission(guide, user)) throw new Error("Expedition results are not observable by the requester.");
  const visible = async (reference, slot) => {
    if (!reference?.privateId) return reference;
    const record = await readPrivateExpeditionResult(reference, party, slot);
    return canReadExpeditionResult(record, user) ? record : { rolled: true, restricted: true };
  };
  const orientation = await visible(exp.dayState.orientation, "orientation");
  const journey = {};
  for (const kind of ["effort", "detection", "stay"]) {
    if (exp.dayState.journey?.[kind]) journey[kind] = await visible(exp.dayState.journey[kind], kind);
  }
  const events = {};
  for (const slot of EVENT_SLOTS) {
    if (Object.hasOwn(exp.dayState.events, slot)) events[slot] = await visible(exp.dayState.events[slot], slot);
  }
  if (expeditionDayKey(party) !== expectedDay) return null;
  return sealExpeditionRead({ orientation, events, journey }, publicKey, JSON.stringify([party.uuid, expectedDay, user.id]));
}

const EVENT_SLOTS = ["ruins", "encounters", "enemies", "terrain"];
async function rollEventsAsAuthority(partyUuid, expectedDay, expectedOrientation, slots, rollMode, expectedEvents, manual = {}) {
  const { user, party } = await orientationRequest(this, partyUuid, expectedDay);
  if (!user.isGM && !hasOwnerPermission(party, user)) throw new Error("Expedition party is not owned by the requester.");
  if (!Array.isArray(slots) || !slots.length || slots.length > 4 || new Set(slots).size !== slots.length || slots.some(s => !EVENT_SLOTS.includes(s)) || !["publicroll", "gmroll", "blindroll", "selfroll"].includes(rollMode)) throw new Error("Invalid expedition event request.");
  if (typeof expectedOrientation !== "string" || expectedOrientation.length > 8192 || typeof expectedEvents !== "string" || expectedEvents.length > 1000) throw new Error("Invalid expedition event revision.");
  if (!manual || typeof manual !== "object" || Array.isArray(manual) || Object.keys(manual).some(k => !slots.includes(k) || !user.isGM || typeof manual[k] !== "string" || manual[k].length > 128)) throw new Error("Invalid manual event selection.");
  return runExpeditionOperation(party, async () => {
    const exp = getActorExpeditionData(party);
    if (expeditionEventKey(party, slots) !== expectedEvents || !exp.active || expeditionDayKey(party) !== expectedDay || expeditionOrientationKey(party) !== expectedOrientation) return { status: "stale" };
    const orientation = await readPrivateExpeditionResult(exp.dayState.orientation, party, "orientation");
    if (exp.dayState.orientation?.privateId && !orientation) throw new Error("Private orientation result is unavailable.");
    // Os resultados derivados de orientação privada conservam os mesmos destinatários.
    const visibility = orientation?.visibility?.mode && orientation.visibility.mode !== "publicroll"
      ? expeditionVisibility(orientation.visibility.mode, { id: orientation.visibility.author }) : expeditionVisibility(rollMode, user);
    if (visibility.mode !== "publicroll") await ensureExpeditionPrivateStorage();
        const travel = expeditionTravel(party);
    if (travel.activity === "stay") slots = slots.filter(s => (s !== "enemies" || travel.dailyEnemiesWhileStaying !== false) && (s !== "ruins" || manual.ruins));
    if (!slots.length) return { status: "skipped" };
    return performEventRoll(party, exp, slots, { orientation, visibility, expectedDay, expectedOrientation, expectedEvents: expeditionEventKey(party, slots), manual });
  });
}

async function performEventRoll(party, exp, slots, { orientation, visibility, expectedDay, expectedOrientation, expectedEvents, manual }) {
  const actors = await resolvePartyTravelActors(party);
  const contextKey = journeyContextKey(party, actors);
  const travel = expeditionTravel(party);
  const validOrientation = !orientation?.contextKey || orientation.contextKey === contextKey;
  const isCurrent = async () => expeditionDayKey(party) === expectedDay && expeditionOrientationKey(party) === expectedOrientation && expeditionEventKey(party, slots) === expectedEvents && journeyContextKey(party, await resolvePartyTravelActors(party)) === contextKey;
  const regionKey = party.system?.location?.region || "ambria";
  const mods = calculateDavokarEventModifiers({ regionKey, activeSearch: effectiveExpeditionSearch(party), orientationVerdict: validOrientation ? orientation?.verdict || "failure" : "failure", alongRiver: travel.alongRiver && travel.activity === "travel" });
  const titles = { ruins: "EventRuinsTitle", encounters: "EventEncountersTitle", enemies: "EventEnemiesTitle", terrain: "EventTerrainTitle" };
  const icons = { ruins: "fas fa-landmark", encounters: "fas fa-users", enemies: "fas fa-skull-crossbones", terrain: "fas fa-mountain" };
  const results = [], rolls = [], updates = {};
  for (const slot of slots) {
    const table = await resolveDavokarEventTable(slot, exp.tables?.[slot] || "");
    const selected = manual[slot] ? Array.from(table?.results?.values?.() ?? table?.results?.contents ?? table?.results ?? []).find(r => r.id === manual[slot] || r._id === manual[slot]) : null;
    if (manual[slot] && !selected) throw new Error("Manual event result not found in selected table.");
    const roll = selected ? { total: Number(selected.range?.[0]) || 1 } : await evaluateRoll(mods[slot].formula);
    if (!selected) rolls.push(roll);
    const drawn = selected ? await drawTableResult({ img: table.img, getResultsForRoll: () => [selected] }, roll) : table ? await drawTableResult(table, roll) : { text: game.i18n.localize("TENEBRE.Party.EventMissingTable"), img: "icons/svg/hazard.svg" };
    const result = { revision: globalThis.foundry?.utils?.randomID?.() ?? crypto.randomUUID(), rolled: Boolean(table), missingTable: !table, manual: Boolean(selected), contextKey, orientationRevision: orientation?.revision, rollTotal: rollTotal(roll), formula: selected ? game.i18n.localize("TENEBRE.Journey.Manual") : mods[slot].formula, resultText: drawn.text, displayText: drawn.displayText || drawn.text, resultImg: drawn.img, tableName: table?.name || "" };
    if (slot === "encounters") result.detectionModifier = encounterDetectionModifier(table, drawn);
    updates[slot] = result;
    results.push({ ...result, slotKey: slot, title: game.i18n.localize(`TENEBRE.Party.${titles[slot]}`), icon: icons[slot] });
  }
  if (!await isCurrent()) return { status: "stale" };
  const guide = await resolveActorReference(exp.guideUuid || exp.guideId);
  // Uma escolha manual não tem dados: o core permite ao autor ler mensagens
  // cegas sem rolagem. Use o GM como autor para preservar o segredo herdado.
  if (!rolls.length && visibility.blind) visibility = { ...visibility, author: game.user.id };
  const author = game.users?.get?.(visibility.author);
  if (!author) throw new Error("Expedition roll author is unavailable.");
  await createChatMessageAfterDice({
    speaker: globalThis.ChatMessage?.getSpeaker?.({ actor: party }) ?? {},
    rollMode: visibility.mode, rollUser: author,
    content: buildEventsChatHtml({ day: Math.max(1, Number(exp.day) || 1), regionKey, activeSearch: effectiveExpeditionSearch(party), guideName: guide?.name || "Guia", results }),
    rolls, flags: { [MODULE_ID]: { eventsCheck: true } }
  });
  if (!await isCurrent()) return { status: "stale" };
  const patch = {};
  for (const [slot, result] of Object.entries(updates)) {
    const stored = await storePrivateExpeditionResult(party, slot, result, visibility);
    patch[`system.expedition.dayState.events.==${slot}`] = stored;
    patch[`flags.${MODULE_ID}.expedition.dayState.events.==${slot}`] = stored;
  }
  if (!await isCurrent()) return { status: "stale" };
  await party.update(patch);
  return { status: "rolled" };
}


async function resetEventAsAuthority(partyUuid, expectedDay, slot, expectedEvent) {
  const { user, party } = await orientationRequest(this, partyUuid, expectedDay);
  if (!user.isGM && !hasOwnerPermission(party, user)) throw new Error("Expedition party is not owned by the requester.");
  if (!EVENT_SLOTS.includes(slot) || typeof expectedEvent !== "string" || expectedEvent.length > 1000) throw new Error("Invalid expedition event reset.");
  return runExpeditionOperation(party, async () => {
    if (expeditionDayKey(party) !== expectedDay || expeditionEventKey(party, [slot]) !== expectedEvent) return false;
    await party.update({ [`system.expedition.dayState.events.-=${slot}`]: null, [`flags.${MODULE_ID}.expedition.dayState.events.-=${slot}`]: null });
    return true;
  });
}


export function encounterDetectionModifier(table, drawn) {
  const entries = drawn?.results ?? [];
  if (entries.length !== 1) return null;
  const explicit = entries[0].flags?.[MODULE_ID]?.detectionModifier;
  if (Number.isFinite(explicit) && Math.abs(explicit) <= 20) return explicit;
  if (table?.id !== OFFICIAL_DAVOKAR_EVENT_TABLE_IDS.encounters && table?._id !== OFFICIAL_DAVOKAR_EVENT_TABLE_IDS.encounters && table?._stats?.compendiumSource !== `RollTable.${OFFICIAL_DAVOKAR_EVENT_TABLE_IDS.encounters}` && table?.id !== CANONICAL_EXPEDITION_TABLE_IDS.encounters && table?._id !== CANONICAL_EXPEDITION_TABLE_IDS.encounters && table?.flags?.[MODULE_ID]?.canonicalId !== CANONICAL_EXPEDITION_TABLE_IDS.encounters) return null;
  return ({ 1: 0, 2: 3, 3: 1, 4: 5, 5: 0, 6: -1, 7: -1, 8: -5 })[Number(entries[0].range?.[0])] ?? null;
}
