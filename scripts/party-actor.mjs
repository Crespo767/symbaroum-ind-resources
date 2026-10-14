import { MODULE_ID } from "./constants.mjs";
import { ActorPreparation } from "./actor-preparation.mjs";
import { EncumbranceService } from "./encumbrance.mjs";
import { CompatibilityService } from "./compatibility.mjs";
import { evaluateRoll, rollTotal, createChatMessageAfterDice } from "./dice.mjs";
import { escapeHtml } from "./utils.mjs";
import { getDavokarMishapsTableData } from "./expedition-data.mjs";
import { RationService } from "./rations.mjs";

/** Tipo de ator declarado em module.json (documentTypes.Actor.party); o core o registra sozinho. */
export const PARTY_ACTOR_TYPE = `${MODULE_ID}.party`;

export function isPartyActor(actor) {
  return actor?.type === PARTY_ACTOR_TYPE;
}

/**
 * Calcula a penalidade de orientação de acordo com o nível da dádiva Mateiro e a região atual
 * Regras oficiais do Guia do Mestre (Capítulo 12, p. 115):
 * - Ambria: Penalidade 0 (sem exigência de Mateiro).
 * - Davokar Iluminada: Exige Mateiro I. 1 nível abaixo (sem Mateiro) -> penalidade -3.
 * - Davokar Selvagem: Exige Mateiro II. 1 nível abaixo -> penalidade -3; 2 níveis abaixo (sem Mateiro) -> penalidade -5.
 * - Davokar Escura: Exige Mateiro III. 1 nível abaixo -> penalidade -3; 2+ níveis abaixo -> penalidade -5.
 */
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
  if (!actor) return { hasBushcraft: false, level: 0, item: null };
  const items = actor.items ? Array.from(actor.items) : [];
  let bushcraftItem = null;

  for (const item of items) {
    if (item.type !== "boon" && item.type !== "trait" && item.type !== "ability") continue;
    const nameLower = (item.name || "").toLowerCase().trim();
    const ref = (item.system?.reference || "").toLowerCase().trim();
    if (ref === "bushcraft" || ref === "mateiro" || nameLower.includes("mateiro") || nameLower.includes("bushcraft")) {
      bushcraftItem = item;
      break;
    }
  }

  if (!bushcraftItem) {
    return { hasBushcraft: false, level: 0, item: null };
  }

  let level = Number(bushcraftItem.system?.level);
  if (!level || isNaN(level) || level < 1) {
    const nameLower = (bushcraftItem.name || "").toLowerCase();
    if (nameLower.includes("iii") || nameLower.includes(" 3") || nameLower.includes("mestre") || nameLower.includes("master")) {
      level = 3;
    } else if (nameLower.includes("ii") || nameLower.includes(" 2") || nameLower.includes("adepto") || nameLower.includes("adept")) {
      level = 2;
    } else {
      level = 1;
    }
  }

  return {
    hasBushcraft: true,
    level: Math.max(1, Math.min(3, level)),
    item: bushcraftItem
  };
}

/**
 * Calcula o alvo final do teste de Orientação com base no Vigilante do Guia, Mateiro e Região
 */
export function calculateOrientationTarget(vigilant = 10, bushcraftLevel = 0, regionKey = "ambria") {
  const penalty = calculateBushcraftPenalty(bushcraftLevel, regionKey);
  const baseVigilant = Number(vigilant) || 0;
  const target = Math.max(1, baseVigilant + penalty);
  return {
    baseVigilant,
    penalty,
    target
  };
}

/**
 * Avalia o resultado da rolagem de 1d20 contra o alvo de Orientação
 */
export function evaluateOrientationRoll(rollTotal, target) {
  const rollVal = Number(rollTotal) || 0;
  const targetVal = Number(target) || 0;
  const success = rollVal <= targetVal;
  const greatSuccess = success && ((targetVal - rollVal >= 5) || rollVal === 1);
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
  } else if (success) {
    verdict = "success";
    ruinsMod = 2;
    enemiesMod = -1;
    terrainMod = -1;
    neutralDetection = true;
    mishap = false;
  }

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
 * Regras oficiais do Guia do Mestre (Capítulo 12, p. 115):
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
 * Valida se um nome pertence à Tabela 25 (Infortúnios na Davokar),
 * e explicitamente rejeita tabelas militares como Infortúnios do Exército (Tabela 18).
 */
export function isDavokarMishapsTable(nameStr) {
  const name = (nameStr || "").toLowerCase().trim();
  if (!name) return false;

  // Rejeita explicitamente tabelas de batalha, guerra ou exército
  if (name.includes("exército") || name.includes("exercito") || name.includes("army") || name.includes("batalha")) {
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
export async function resolveMishapsTable() {
  const game = globalThis.game;
  if (!game) return null;

  // 1. Procura primeiro nas tabelas do próprio mundo (se o usuário já importou ou customizou)
  const worldTables = Array.from(game.tables ?? []);
  const worldTable = worldTables.find(t => isDavokarMishapsTable(t.name));
  if (worldTable) return worldTable;

  // 2. Procura no compêndio de tabelas de expedição do módulo
  const modPack = typeof game.packs?.get === "function"
    ? game.packs.get(`${MODULE_ID}.expedition-tables`)
    : (Array.isArray(game.packs) ? game.packs.find(p => p.metadata?.id === `${MODULE_ID}.expedition-tables` || p.name === "expedition-tables") : null);
  if (modPack) {
    try {
      if (!modPack.indexed) await modPack.getIndex();
      const entry = modPack.index.find(e => isDavokarMishapsTable(e.name));
      if (entry) {
        return await modPack.getDocument(entry._id);
      }
    } catch (errPack) {
      console.warn("symbaroum-ind-resources | Falha ao consultar pack expedition-tables:", errPack);
    }
  }

  // 3. Procura no compêndio de aventura ou em outros compêndios de RollTable carregados
  for (const pack of (game.packs ?? [])) {
    if (pack.documentName !== "RollTable") continue;
    try {
      if (!pack.indexed) await pack.getIndex();
      const entry = pack.index.find(e => isDavokarMishapsTable(e.name));
      if (entry) {
        return await pack.getDocument(entry._id);
      }
    } catch (_) {}
  }

  // 4. Fallback: se não estiver em nenhum compêndio nem no mundo, cria automaticamente a Tabela 25 oficial no mundo
  if (globalThis.RollTable?.create && (game.user?.isGM || game.user?.can?.("TABLE_CREATE"))) {
    try {
      const tableData = getDavokarMishapsTableData();
      const created = await globalThis.RollTable.create(tableData);
      if (created) return created;
    } catch (createErr) {
      console.warn("symbaroum-ind-resources | Falha ao auto-criar Tabela 25:", createErr);
    }
  }

  return null;
}

/**
 * Executa a rolagem e o saque (draw) na Tabela de Infortúnios do Foundry
 */
export async function drawMishapTable(table, roll) {
  if (!table) return null;
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
 * Monta o HTML do Card de Chat do Teste de Orientação
 */
export function buildOrientationChatHtml({
  guideActor,
  regionKey = "ambria",
  bushcraft,
  rollVal,
  target,
  evalResult
}) {
  const regionNames = {
    ambria: globalThis.game?.i18n?.localize?.("TENEBRE.Party.RegionNameAmbria") || "Ambria",
    bright: globalThis.game?.i18n?.localize?.("TENEBRE.Party.RegionNameBright") || "Davokar Iluminada",
    wild: globalThis.game?.i18n?.localize?.("TENEBRE.Party.RegionNameWild") || "Davokar Selvagem",
    dark: globalThis.game?.i18n?.localize?.("TENEBRE.Party.RegionNameDark") || "Davokar Escura"
  };
  const rawRegion = regionNames[regionKey] || regionKey;
  const regionName = String(rawRegion).replace(/\s*\([±+\-]\d+\)/, "").trim();

  const title = globalThis.game?.i18n?.localize?.("TENEBRE.Party.OrientationCardTitle")
    || "Teste de Orientação em Davokar";

  let verdictTitle = "";
  let verdictDesc = "";
  if (evalResult.verdict === "greatSuccess") {
    verdictTitle = globalThis.game?.i18n?.localize?.("TENEBRE.Party.OrientationGreatSuccess") || "Grande Sucesso!";
    verdictDesc = globalThis.game?.i18n?.localize?.("TENEBRE.Party.OrientationGreatSuccessDesc")
      || "O guia encontra o caminho com maestria. Concede +2 Ruínas, -2 Inimigos, -2 Terreno e Detecção Antecipada.";
  } else if (evalResult.verdict === "success") {
    verdictTitle = globalThis.game?.i18n?.localize?.("TENEBRE.Party.OrientationSuccess") || "Sucesso";
    verdictDesc = globalThis.game?.i18n?.localize?.("TENEBRE.Party.OrientationSuccessDesc")
      || "O guia mantém o rumo correto. Concede +2 Ruínas, -1 Inimigos, -1 Terreno e Detecção Antecipada.";
  } else {
    verdictTitle = globalThis.game?.i18n?.localize?.("TENEBRE.Party.OrientationFailure") || "Desorientado (Falha)";
    verdictDesc = globalThis.game?.i18n?.localize?.("TENEBRE.Party.OrientationFailureDesc")
      || "O grupo se desorienta nos ermos! Nenhum bônus é concedido e ocorre um Infortúnio na floresta.";
  }

  const bushcraftText = bushcraft.hasBushcraft
    ? `${globalThis.game?.i18n?.localize?.("TENEBRE.Party.BushcraftLabel") || "Mateiro"} ${bushcraft.levelRoman}`
    : (globalThis.game?.i18n?.localize?.("TENEBRE.Party.NoBushcraft") || "Sem Mateiro");

  const guideImg = guideActor?.img || "icons/svg/mystery-man.svg";
  const guideName = guideActor?.name || "Guia";
  const abilityImg = (bushcraft.item?.img && !bushcraft.item.img.includes("/unknown") && !bushcraft.item.img.endsWith("boon.png"))
    ? bushcraft.item.img
    : (bushcraft.hasBushcraft ? "icons/environment/wilderness/tree-ash.webp" : "icons/svg/compass.svg");

  let bonusesList = "";
  if (evalResult.success) {
    bonusesList = `
      <div class="tenebre-orientation-bonuses">
        <span class="bonus-tag is-positive"><i class="fas fa-monument"></i> ${globalThis.game?.i18n?.localize?.("TENEBRE.Party.RuinsBonus") || "Ruínas"}: +${evalResult.ruinsMod}</span>
        <span class="bonus-tag is-positive"><i class="fas fa-skull"></i> ${globalThis.game?.i18n?.localize?.("TENEBRE.Party.EnemiesBonus") || "Inimigos"}: ${evalResult.enemiesMod}</span>
        <span class="bonus-tag is-positive"><i class="fas fa-mountain"></i> ${globalThis.game?.i18n?.localize?.("TENEBRE.Party.TerrainBonus") || "Terreno"}: ${evalResult.terrainMod}</span>
        <span class="bonus-tag is-info"><i class="fas fa-binoculars"></i> ${globalThis.game?.i18n?.localize?.("TENEBRE.Party.EarlyDetection") || "Detecção Antecipada"}</span>
      </div>
    `;
  } else {
    bonusesList = `
      <div class="tenebre-orientation-bonuses is-mishap">
        <span class="bonus-tag is-negative"><i class="fas fa-exclamation-triangle"></i> Infortúnio na Davokar (Tabela de Infortúnios)</span>
      </div>
    `;
  }

  const modText = bushcraft.penalty !== 0 ? `${bushcraft.penaltyText}` : "±0";
  const vigilantLabel = globalThis.game?.i18n?.localize?.("ATTRIBUTE.VIGILANT") || "Vigilante";
  const formulaText = `${vigilantLabel} (${bushcraft.baseVigilant}) ${modText} [${regionName} • ${bushcraftText}]`;
  const outcomeClass = evalResult.success ? "tenebre-attribute-test-success" : "tenebre-attribute-test-failure";

  return `
    <div class="symbaroum chat ability tenebre-orientation-chat">
      <div class="foreground">
        <div class="tenebre-berserker-card tenebre-chat-card tenebre-orientation-card orientation-${evalResult.verdict}">
          <h3 class="tenebre-attribute-test-title">${escapeHtml(title)}</h3>
          <p class="tenebre-berserker-intro">${escapeHtml(guideName)} orienta a expedição em ${escapeHtml(regionName)}</p>

          <div class="tenebre-berserker-participants">
            <figure class="tenebre-berserker-actor">
              <img src="${escapeHtml(guideImg)}" alt="${escapeHtml(guideName)}" loading="lazy">
              <figcaption>${escapeHtml(guideName)}</figcaption>
            </figure>
            <span class="tenebre-berserker-flow-arrow" aria-hidden="true">→</span>
            <figure class="tenebre-berserker-ability">
              <img src="${escapeHtml(abilityImg)}" alt="${escapeHtml(bushcraftText)}" loading="lazy">
              <figcaption><span class="tenebre-berserker-ability-link">${escapeHtml(bushcraftText)}</span></figcaption>
            </figure>
          </div>

          <p class="tenebre-opposed-test-formula">${escapeHtml(formulaText)}</p>

          <div class="tenebre-opposed-test-roll-summary">
            <p class="tenebre-opposed-test-objective">Alvo: <strong>${target}</strong></p>
            <p class="tenebre-opposed-test-roll">Rolagem: <strong>${rollVal}</strong></p>
          </div>

          <p class="tenebre-opposed-test-outcome ${outcomeClass}">
            ${escapeHtml(verdictTitle)}
          </p>

          <div class="tenebre-orientation-details">
            <p class="tenebre-orientation-desc">${escapeHtml(verdictDesc)}</p>
            ${bonusesList}
          </div>
        </div>
      </div>
    </div>
  `;
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
  { id: "large-chest", name: "Baú Grande", category: "container", capacity: 30, img: "icons/containers/boxes/chest-wooden-sturdy.webp" },
  { id: "barrel", name: "Barril", category: "container", capacity: 25, img: "icons/containers/boxes/barrel-reinforced-wood.webp" },
  { id: "chest", name: "Baú de Viagem", category: "container", capacity: 20, img: "icons/containers/boxes/chest-wooden-sturdy.webp" },
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
    if (!actorId) return null;
    let memberActor = globalThis.game?.actors?.get(actorId);
    if (!memberActor && globalThis.fromUuidSync) {
      try {
        const doc = globalThis.fromUuidSync(actorId) ?? globalThis.fromUuidSync(`Actor.${actorId}`);
        memberActor = doc?.actor ?? doc;
      } catch {}
    }
    return memberActor;
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
    const currentGuideId = this.actor?.system?.expedition?.guideId || this.actor?.flags?.[MODULE_ID]?.expedition?.guideId || "";
    const isGuide = Boolean(currentGuideId && (currentGuideId === memberActor.id || (memberActor.uuid && currentGuideId === memberActor.uuid)));

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
      id: memberActor.id,
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
      const quantity = Number(sys.number ?? sys.quantity ?? 1) || 1;
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
      let weight = 0;
      try {
        if (typeof EncumbranceService?.getItemStackSlots === "function") {
          weight = EncumbranceService.getItemStackSlots(entry.item);
        }
      } catch {}
      if (!weight || isNaN(weight) || weight <= 0) {
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

    const rawExpedition = this.actor?.system?.expedition ?? this.actor?.flags?.[MODULE_ID]?.expedition ?? {};
    const guideId = rawExpedition.guideId || this.actor?.flags?.[MODULE_ID]?.expedition?.guideId || "";
    const guideUuid = rawExpedition.guideUuid || this.actor?.flags?.[MODULE_ID]?.expedition?.guideUuid || "";
    let guideActor = null;
    if (guideUuid) {
      guideActor = this._resolveActor(guideUuid);
    }
    if (!guideActor && guideId) {
      guideActor = this._resolveActor(guideId);
    }

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
      const romanLevels = ["—", "I", "II", "III"];
      const bushcraftView = {
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
    let orientationDayView = { rolled: false };

    if (orientationState && orientationState.rolled) {
      const verdict = orientationState.verdict || "success";
      const verdictLabels = {
        greatSuccess: globalThis.game?.i18n?.localize?.("TENEBRE.Party.OrientationGreatSuccess") || "Grande Sucesso!",
        success: globalThis.game?.i18n?.localize?.("TENEBRE.Party.OrientationSuccess") || "Sucesso",
        failure: globalThis.game?.i18n?.localize?.("TENEBRE.Party.OrientationFailure") || "Desorientado"
      };
      const icons = {
        greatSuccess: "fas fa-star",
        success: "fas fa-check-circle",
        failure: "fas fa-exclamation-triangle"
      };
      let summaryTooltip = "";
      if (verdict === "greatSuccess") {
        summaryTooltip = "+2 Ruínas | -2 Inimigos | -2 Terreno | Detecção Antecipada";
      } else if (verdict === "success") {
        summaryTooltip = "+2 Ruínas | -1 Inimigos | -1 Terreno | Detecção Antecipada";
      } else {
        summaryTooltip = "Infortúnio na Davokar! Sem bônus nas tabelas.";
      }

      orientationDayView = {
        rolled: true,
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
    let groupRationState = null;
    try {
      groupRationState = RationService?.getState?.(this.actor);
    } catch {}
    const groupTotalRations = groupRationState?.totalUsesRemaining ?? 0;

    // Estado da Alimentação dos Membros no Dia
    const dayRationsState = dayStateRaw.rations || this.actor?.flags?.[MODULE_ID]?.expedition?.dayState?.rations || {};

    const expeditionRationMembers = [];
    // Processa membros jogadores
    for (const member of members) {
      const memberActor = this._resolveActor(member.id);
      let personalRationState = null;
      try {
        personalRationState = memberActor ? RationService?.getState?.(memberActor) : null;
      } catch {}
      const personalRations = personalRationState?.totalUsesRemaining ?? 0;
      const memberFedInfo = dayRationsState[member.id] || null;
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
        canFeedFromPersonal: !isFed && personalRations > 0
      });
    }

    // Processa companheiros não monstros/animais
    for (const comp of companions) {
      if (comp.isMonster || comp.occupation === "Animal" || comp.occupation === "Animal de Carga") continue;
      const compActor = this._resolveActor(comp.id);
      let personalRationState = null;
      try {
        personalRationState = compActor ? RationService?.getState?.(compActor) : null;
      } catch {}
      const personalRations = personalRationState?.totalUsesRemaining ?? 0;
      const compFedInfo = dayRationsState[comp.id] || null;
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
        canFeedFromPersonal: !isFed && personalRations > 0
      });
    }

    const allMembersFed = expeditionRationMembers.length > 0 && expeditionRationMembers.every(m => m.isFed);
    const hungryCount = expeditionRationMembers.filter(m => !m.isFed).length;

    data.expedition = {
      active: isExpeditionActive,
      day: isExpeditionActive ? expeditionDay : 0,
      isFirstDay: expeditionDay <= 1,
      guideId: guideId,
      guide: guideData,
      dayState: {
        orientation: orientationDayView,
        rations: dayRationsState
      },
      rations: {
        groupTotal: groupTotalRations,
        groupItemName: groupRationState?.name || "Pão de Viagem",
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
        await this.actor?.update?.({ "system.location.region": val });
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

    this._bindMemberContextMenu(root);
  }

  _bindMemberContextMenu(root) {
    const BaseContextMenu = globalThis.foundry?.applications?.ux?.ContextMenu ?? globalThis.ContextMenu;
    const ContextMenuClass = BaseContextMenu?.implementation ?? BaseContextMenu;
    if (typeof ContextMenuClass !== "function") return;

    const setGuideEntry = CompatibilityService.buildContextMenuEntry({
      label: globalThis.game?.i18n?.localize?.("TENEBRE.Party.SetGuideContextMenu") || "Definir como guia do grupo",
      icon: '<i class="fas fa-compass"></i>',
      visible: (target) => {
        if (!this.isEditable) return false;
        const el = target instanceof HTMLElement ? target : (target?.[0] ?? target);
        const card = el?.closest?.(".party-member-card") ?? el;
        const actorId = card?.dataset?.actorId;
        if (!actorId) return false;
        const currentGuideId = this.actor?.system?.expedition?.guideId || this.actor?.flags?.[MODULE_ID]?.expedition?.guideId || "";
        const currentGuideUuid = this.actor?.system?.expedition?.guideUuid || this.actor?.flags?.[MODULE_ID]?.expedition?.guideUuid || "";
        return currentGuideId !== actorId && currentGuideUuid !== actorId;
      },
      onClick: (target) => {
        const el = target instanceof HTMLElement ? target : (target?.[0] ?? target);
        const card = el?.closest?.(".party-member-card") ?? el;
        const actorId = card?.dataset?.actorId;
        if (actorId) void this._onSetGuide(actorId);
      }
    });

    const unsetGuideEntry = CompatibilityService.buildContextMenuEntry({
      label: globalThis.game?.i18n?.localize?.("TENEBRE.Party.UnsetGuideContextMenu") || "Remover como guia do grupo",
      icon: '<i class="fas fa-times"></i>',
      visible: (target) => {
        if (!this.isEditable) return false;
        const el = target instanceof HTMLElement ? target : (target?.[0] ?? target);
        const card = el?.closest?.(".party-member-card") ?? el;
        const actorId = card?.dataset?.actorId;
        if (!actorId) return false;
        const currentGuideId = this.actor?.system?.expedition?.guideId || this.actor?.flags?.[MODULE_ID]?.expedition?.guideId || "";
        const currentGuideUuid = this.actor?.system?.expedition?.guideUuid || this.actor?.flags?.[MODULE_ID]?.expedition?.guideUuid || "";
        return currentGuideId === actorId || currentGuideUuid === actorId;
      },
      onClick: () => {
        void this._onUnsetGuide();
      }
    });

    try {
      new ContextMenuClass(
        root,
        ".party-member-card[data-actor-id]",
        [setGuideEntry, unsetGuideEntry],
        { fixed: true, jQuery: false }
      );
    } catch (err) {
      console.warn("Tenebre | Could not register member ContextMenu:", err);
    }
  }

  async _onSetGuide(actorId) {
    if (!this.isEditable || !actorId) return;
    const guideActor = this._resolveActor(actorId);
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

  async _onRollOrientation() {
    if (this._rollingOrientation) return;
    this._rollingOrientation = true;

    const rootEl = this.element?.[0] ?? this.element;
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
      const rawExpedition = this.actor?.system?.expedition ?? this.actor?.flags?.[MODULE_ID]?.expedition ?? {};
      const guideId = rawExpedition.guideId || this.actor?.flags?.[MODULE_ID]?.expedition?.guideId || "";
      const guideUuid = rawExpedition.guideUuid || this.actor?.flags?.[MODULE_ID]?.expedition?.guideUuid || "";
      let guideActor = null;
      if (guideUuid) guideActor = this._resolveActor(guideUuid);
      if (!guideActor && guideId) guideActor = this._resolveActor(guideId);

      if (!guideActor) {
        globalThis.ui?.notifications?.warn?.(
          globalThis.game?.i18n?.localize?.("TENEBRE.Party.ExpeditionNoGuideTitle") ||
          "Nenhum guia definido para a expedição."
        );
        return;
      }

      const canRoll = Boolean(this.isEditable || guideActor.isOwner || globalThis.game?.user?.isGM);
      if (!canRoll) {
        globalThis.ui?.notifications?.warn?.(
          globalThis.game?.i18n?.localize?.("TENEBRE.Party.RollNotAllowed") ||
          "Você só pode rolar testes do seu próprio personagem."
        );
        return;
      }

      const regionKey = this.actor?.system?.location?.region || "ambria";
      const bushcraftData = detectBushcraftTier(guideActor);
      const attrs = guideActor.system?.attributes ?? {};
      const getAttrVal = (attrObj) => {
        if (!attrObj) return 0;
        return typeof attrObj === "object" ? Number(attrObj.total ?? attrObj.value ?? 0) : Number(attrObj);
      };
      const vigilantVal = getAttrVal(attrs.vigilant);
      const orientationTargetData = calculateOrientationTarget(vigilantVal, bushcraftData.level, regionKey);
      const target = orientationTargetData.target;

      const roll = await evaluateRoll("1d20");
      const rollVal = rollTotal(roll);
      const evalResult = evaluateOrientationRoll(rollVal, target);

      const romanLevels = ["—", "I", "II", "III"];
      const bushcraftView = {
        hasBushcraft: bushcraftData.hasBushcraft,
        level: bushcraftData.level,
        levelRoman: romanLevels[bushcraftData.level] || `${bushcraftData.level}`,
        penalty: orientationTargetData.penalty,
        penaltyText: orientationTargetData.penalty === 0 ? "±0" : `${orientationTargetData.penalty}`,
        target: target,
        baseVigilant: orientationTargetData.baseVigilant,
        item: bushcraftData.item
      };

      const chatContent = buildOrientationChatHtml({
        guideActor,
        regionKey,
        bushcraft: bushcraftView,
        rollVal,
        target,
        evalResult
      });

      const orientationUpdate = {
        rolled: true,
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
        timestamp: Date.now()
      };

      const speaker = globalThis.ChatMessage?.getSpeaker
        ? globalThis.ChatMessage.getSpeaker({ actor: guideActor })
        : { alias: guideActor.name };

      // Executa animação 3D com Dice So Nice e cria mensagem no chat
      await createChatMessageAfterDice({
        speaker,
        content: chatContent,
        rolls: [roll],
        flags: { [MODULE_ID]: { orientationCheck: true } }
      });

      // Aguarda a sincronização visual com o dado (DSN ou fallback com suspensa)
      const isTest = Boolean(globalThis.process?.env?.NODE_TEST_CONTEXT || globalThis.process?.env?.ANTIGRAVITY_TEST);
      if (!isTest) {
        if (!globalThis.game?.dice3d) {
          await new Promise((resolve) => setTimeout(resolve, 800));
        } else {
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      }

      // Persiste o resultado e atualiza a ficha apenas após o dado parar
      await this.actor.update({
        "system.expedition.dayState.orientation": orientationUpdate,
        [`flags.${MODULE_ID}.expedition.dayState.orientation`]: orientationUpdate
      });

      if (evalResult.verdict === "failure") {
        const mishapMod = getMishapsModifier(regionKey);
        const mishapFormula = mishapMod > 0 ? `1d20 + ${mishapMod}` : "1d20";
        const mishapRoll = await evaluateRoll(mishapFormula);
        const mishapTable = await resolveMishapsTable();

        if (mishapTable) {
          await drawMishapTable(mishapTable, mishapRoll);
        } else {
          globalThis.ui?.notifications?.warn?.(
            globalThis.game?.i18n?.localize?.("TENEBRE.Party.MishapsTableNotFound") ||
            "Tabela de Infortúnios não encontrada no compêndio ou no mundo."
          );
        }
      }

      this.render(false);
    } finally {
      this._rollingOrientation = false;
    }
  }

  async _onResetOrientation() {
    if (!this.isEditable && !globalThis.game?.user?.isGM) return;
    await this.actor.update({
      "system.expedition.dayState.orientation": null,
      [`flags.${MODULE_ID}.expedition.dayState.orientation`]: null
    });
    this.render(false);
  }

  async _onStartExpedition() {
    if (!this.isEditable) return;
    await this.actor.update({
      "system.expedition.active": true,
      "system.expedition.day": 1,
      "system.expedition.dayState.orientation": null,
      "system.expedition.dayState.rations": {},
      [`flags.${MODULE_ID}.expedition.active`]: true,
      [`flags.${MODULE_ID}.expedition.day`]: 1,
      [`flags.${MODULE_ID}.expedition.dayState.orientation`]: null,
      [`flags.${MODULE_ID}.expedition.dayState.rations`]: {}
    });
    const msg = globalThis.game?.i18n?.localize?.("TENEBRE.Party.ExpeditionStartedNotice") || "Expedição iniciada! Dia 1 em Davokar.";
    globalThis.ui?.notifications?.info?.(msg);
  }

  async _onEndExpedition() {
    if (!this.isEditable) return;
    const title = globalThis.game?.i18n?.localize?.("TENEBRE.Party.EndExpeditionDialogTitle") || "Encerrar Expedição";
    const content = `<p>${globalThis.game?.i18n?.localize?.("TENEBRE.Party.EndExpeditionDialogContent") || "Deseja realmente encerrar a expedição atual? O contador de dias e o status da orientação serão reiniciados."}</p>`;

    const doEnd = async () => {
      await this.actor.update({
        "system.expedition.active": false,
        "system.expedition.day": 0,
        "system.expedition.dayState.orientation": null,
        "system.expedition.dayState.rations": {},
        [`flags.${MODULE_ID}.expedition.active`]: false,
        [`flags.${MODULE_ID}.expedition.day`]: 0,
        [`flags.${MODULE_ID}.expedition.dayState.orientation`]: null,
        [`flags.${MODULE_ID}.expedition.dayState.rations`]: {}
      });
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
    const rawExpedition = this.actor?.system?.expedition ?? this.actor?.flags?.[MODULE_ID]?.expedition ?? {};
    const currentDay = Math.max(1, Number(rawExpedition.day) || 1);
    const nextDay = currentDay + 1;

    await this.actor.update({
      "system.expedition.active": true,
      "system.expedition.day": nextDay,
      "system.expedition.dayState.orientation": null,
      "system.expedition.dayState.rations": {},
      [`flags.${MODULE_ID}.expedition.active`]: true,
      [`flags.${MODULE_ID}.expedition.day`]: nextDay,
      [`flags.${MODULE_ID}.expedition.dayState.orientation`]: null,
      [`flags.${MODULE_ID}.expedition.dayState.rations`]: {}
    });

    const msg = globalThis.game?.i18n?.format
      ? globalThis.game.i18n.format("TENEBRE.Party.ExpeditionDayAdvancedNotice", { day: nextDay })
      : `Expedição avançou para o Dia ${nextDay}.`;
    globalThis.ui?.notifications?.info?.(msg);
  }

  async _onPrevExpeditionDay() {
    if (!this.isEditable) return;
    const rawExpedition = this.actor?.system?.expedition ?? this.actor?.flags?.[MODULE_ID]?.expedition ?? {};
    const currentDay = Math.max(1, Number(rawExpedition.day) || 1);
    if (currentDay <= 1) return;
    const prevDay = currentDay - 1;

    await this.actor.update({
      "system.expedition.day": prevDay,
      [`flags.${MODULE_ID}.expedition.day`]: prevDay
    });
  }

  async _onFeedMemberGroup(memberId) {
    if (!this.isEditable || !memberId) return;
    const memberActor = this._resolveActor(memberId);
    if (!memberActor) return;

    const groupRationState = RationService?.getState?.(this.actor);
    if (!groupRationState || groupRationState.totalUsesRemaining <= 0) {
      const warnMsg = globalThis.game?.i18n?.localize?.("TENEBRE.Party.NoGroupRationsWarn") ||
        "Não há rações ou pão de viagem no inventário do grupo.";
      globalThis.ui?.notifications?.warn?.(warnMsg);
      return;
    }

    const consumed = await RationService.consumeDay(this.actor, null, { days: 1 });
    if (consumed) {
      const rationUpdate = {
        fed: true,
        source: "group",
        timestamp: Date.now()
      };
      await this.actor.update({
        [`system.expedition.dayState.rations.${memberId}`]: rationUpdate,
        [`flags.${MODULE_ID}.expedition.dayState.rations.${memberId}`]: rationUpdate
      });

      const notice = globalThis.game?.i18n?.format
        ? globalThis.game.i18n.format("TENEBRE.Party.MemberFedGroupNotice", { name: memberActor.name })
        : `${memberActor.name} se alimentou usando provisões do grupo.`;
      globalThis.ui?.notifications?.info?.(notice);
      this.render?.(false);
    }
  }

  async _onFeedMemberPersonal(memberId) {
    if (!this.isEditable || !memberId) return;
    const memberActor = this._resolveActor(memberId);
    if (!memberActor) return;

    const personalState = RationService?.getState?.(memberActor);
    if (!personalState || personalState.totalUsesRemaining <= 0) {
      const warnMsg = globalThis.game?.i18n?.format
        ? globalThis.game.i18n.format("TENEBRE.Party.NoPersonalRationsWarn", { name: memberActor.name })
        : `${memberActor.name} não possui rações ou pão de viagem na mochila.`;
      globalThis.ui?.notifications?.warn?.(warnMsg);
      return;
    }

    const consumed = await RationService.consumeDay(memberActor, null, { days: 1 });
    if (consumed) {
      const rationUpdate = {
        fed: true,
        source: "personal",
        timestamp: Date.now()
      };
      await this.actor.update({
        [`system.expedition.dayState.rations.${memberId}`]: rationUpdate,
        [`flags.${MODULE_ID}.expedition.dayState.rations.${memberId}`]: rationUpdate
      });

      const notice = globalThis.game?.i18n?.format
        ? globalThis.game.i18n.format("TENEBRE.Party.MemberFedPersonalNotice", { name: memberActor.name })
        : `${memberActor.name} se alimentou usando pão de viagem de sua mochila.`;
      globalThis.ui?.notifications?.info?.(notice);
      this.render?.(false);
    }
  }

  async _onFeedAllGroup() {
    if (!this.isEditable) return;
    const data = await this.getData();
    const unfed = (data.expedition?.rations?.members ?? []).filter(m => !m.isFed);
    if (unfed.length === 0) {
      const infoMsg = globalThis.game?.i18n?.localize?.("TENEBRE.Party.AllAlreadyFedNotice") ||
        "Todos os membros já se alimentaram hoje.";
      globalThis.ui?.notifications?.info?.(infoMsg);
      return;
    }

    const groupRationState = RationService?.getState?.(this.actor);
    const available = groupRationState?.totalUsesRemaining ?? 0;
    if (available < unfed.length) {
      const warnMsg = globalThis.game?.i18n?.localize?.("TENEBRE.Party.NoGroupRationsWarn") ||
        `Provisões insuficientes no grupo (necessário: ${unfed.length}, disponível: ${available}).`;
      globalThis.ui?.notifications?.warn?.(warnMsg);
      return;
    }

    const consumed = await RationService.consumeDay(this.actor, null, { days: unfed.length });
    if (consumed) {
      const updates = {};
      const now = Date.now();
      for (const m of unfed) {
        updates[`system.expedition.dayState.rations.${m.id}`] = {
          fed: true,
          source: "group",
          timestamp: now
        };
        updates[`flags.${MODULE_ID}.expedition.dayState.rations.${m.id}`] = {
          fed: true,
          source: "group",
          timestamp: now
        };
      }
      await this.actor.update(updates);

      const notice = globalThis.game?.i18n?.format
        ? globalThis.game.i18n.format("TENEBRE.Party.AllMembersFedNotice", { count: unfed.length })
        : `${unfed.length} membro(s) foram alimentados com provisões do grupo.`;
      globalThis.ui?.notifications?.info?.(notice);
      this.render?.(false);
    }
  }

  async _onToggleFeedMember(memberId) {
    if (!this.isEditable || !memberId) return;
    const dayRations = this.actor?.system?.expedition?.dayState?.rations ??
      this.actor?.flags?.[MODULE_ID]?.expedition?.dayState?.rations ?? {};
    const isCurrentlyFed = Boolean(dayRations[memberId]?.fed);
    const newStatus = isCurrentlyFed ? null : { fed: true, source: "manual", timestamp: Date.now() };

    await this.actor.update({
      [`system.expedition.dayState.rations.${memberId}`]: newStatus,
      [`flags.${MODULE_ID}.expedition.dayState.rations.${memberId}`]: newStatus
    });
    this.render?.(false);
  }

  async _onSelectGuide() {
    if (!this.isEditable) return;

    const memberIds = Array.isArray(this.actor?.system?.members) ? this.actor.system.members : [];
    const companionIds = Array.isArray(this.actor?.system?.companions) ? this.actor.system.companions : [];
    const candidates = [];

    for (const mId of memberIds) {
      const a = this._resolveActor(mId);
      if (a) candidates.push({ id: a.id, name: a.name, type: "member" });
    }
    for (const cId of companionIds) {
      const a = this._resolveActor(cId);
      if (a) candidates.push({ id: a.id, name: a.name, type: "companion" });
    }

    if (candidates.length === 0) {
      globalThis.ui?.notifications?.warn?.(
        globalThis.game?.i18n?.localize?.("TENEBRE.Party.NoCandidatesForGuide") ||
        "Não há personagens ou companheiros no grupo para definir como guia."
      );
      return;
    }

    const currentGuideId = this.actor?.system?.expedition?.guideId || "";
    const memberLabel = globalThis.game?.i18n?.localize?.("TENEBRE.Party.MembersSectionTitle") || "Personagens";
    const companionLabel = globalThis.game?.i18n?.localize?.("TENEBRE.Party.CompanionsSectionTitle") || "Companheiros";

    const membersGroup = candidates.filter(c => c.type === "member");
    const companionsGroup = candidates.filter(c => c.type === "companion");

    let optionsHtml = "";
    if (membersGroup.length > 0) {
      optionsHtml += `<optgroup label="${memberLabel}">` +
        membersGroup.map(c => `<option value="${c.id}" ${c.id === currentGuideId ? "selected" : ""}>${c.name}</option>`).join("") +
        `</optgroup>`;
    }
    if (companionsGroup.length > 0) {
      optionsHtml += `<optgroup label="${companionLabel}">` +
        companionsGroup.map(c => `<option value="${c.id}" ${c.id === currentGuideId ? "selected" : ""}>${c.name}</option>`).join("") +
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
    await this._onSetGuide(actorDoc.id);
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
        content: `<p>${title}: <strong>${item.name}</strong>?</p>`,
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
    const current = Number(item.system?.number ?? item.system?.quantity ?? 1) || 1;
    await item.update({ "system.number": current + 1 });
  }

  async _onDecreaseItemQuantity(itemId) {
    if (!this.isEditable || !itemId) return;
    const item = this.actor?.items?.get?.(itemId);
    if (!item) return;
    const current = Number(item.system?.number ?? item.system?.quantity ?? 1) || 1;
    if (current > 1) {
      await item.update({ "system.number": current - 1 });
    }
  }

  async _onToggleMemberType(actorId) {
    if (!this.isEditable || !actorId) return;
    const currentMembers = Array.isArray(this.actor?.system?.members) ? [...this.actor.system.members] : [];
    const currentCompanions = Array.isArray(this.actor?.system?.companions) ? [...this.actor.system.companions] : [];

    if (currentMembers.includes(actorId)) {
      const newMembers = currentMembers.filter(id => id !== actorId);
      const newCompanions = [...currentCompanions.filter(id => id !== actorId), actorId];
      return this.actor.update({
        "system.members": newMembers,
        "system.companions": newCompanions
      });
    } else if (currentCompanions.includes(actorId)) {
      const newCompanions = currentCompanions.filter(id => id !== actorId);
      const newMembers = [...currentMembers.filter(id => id !== actorId), actorId];
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

    if (droppedActor.id === this.actor?.id || droppedActor.uuid === this.actor?.uuid) return false;
    if (isPartyActor(droppedActor)) return false;

    const currentMembers = Array.isArray(this.actor?.system?.members) ? [...this.actor.system.members] : [];
    const currentCompanions = Array.isArray(this.actor?.system?.companions) ? [...this.actor.system.companions] : [];

    const isCompanionTarget = Boolean(event?.target?.closest?.(".party-companions-section, [data-drop-zone='companions']"));
    const isMemberTarget = Boolean(event?.target?.closest?.(".party-members-section, [data-drop-zone='members']"));

    // Se soltou na seção de companheiros, ou se soltou um monstro/criatura/PNJ sem ter mirado na de jogadores
    const targetCompanion = isCompanionTarget || (!isMemberTarget && droppedActor.type === "monster");

    if (targetCompanion) {
      if (currentCompanions.includes(droppedActor.id) || (droppedActor.uuid && currentCompanions.includes(droppedActor.uuid))) {
        return false;
      }
      const newMembers = currentMembers.filter(id => id !== droppedActor.id && id !== droppedActor.uuid);
      const newCompanions = [...currentCompanions, droppedActor.id];
      const updates = { "system.companions": newCompanions };
      if (newMembers.length !== currentMembers.length) {
        updates["system.members"] = newMembers;
      }
      return this.actor.update(updates);
    } else {
      if (currentMembers.includes(droppedActor.id) || (droppedActor.uuid && currentMembers.includes(droppedActor.uuid))) {
        return false;
      }
      const newCompanions = currentCompanions.filter(id => id !== droppedActor.id && id !== droppedActor.uuid);
      const newMembers = [...currentMembers, droppedActor.id];
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
    const filteredMembers = currentMembers.filter(id => id !== actorId);
    const filteredCompanions = currentCompanions.filter(id => id !== actorId);
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
          id: comp.id,
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
        companions.map(c => `<option value="comp:${c.id}">${c.name} (${c.category === "animal" ? "Animal" : "Companheiro"} - ${c.capacity} un.)</option>`).join("") +
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
          id: comp.id,
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
        companions.map(c => `<option value="comp:${c.id}">${c.name} (${c.category === "animal" ? "Animal" : "Companheiro"} - ${c.capacity} un.)</option>`).join("") +
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
  static register() {
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

  /** O ator do sistema calcula armaduras, armas e atributos; nada disso existe num Grupo. */
  static _protectActorCalculations() {
    ActorPreparation.skipSystemPreparation(isPartyActor);
  }
}
