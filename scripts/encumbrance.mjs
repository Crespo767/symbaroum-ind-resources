import { FLAG_SCOPE, MODULE_ID } from "./constants.mjs";
import { actorItems, getAmmoShots, isQuiver, itemQuantity } from "./item-flags.mjs";
import {
  applyDynamicEncumbranceWeights,
  calculateStackBundleSlots,
  detectEncumbranceSlots,
  getDynamicEncumbranceWeights,
  getStackBundleRule,
  getWeightConfigVersion,
  hasConfiguredEncumbranceRule,
  hasExactEncumbranceItem,
  hasMassiveQuality,
  loadEncumbranceWeights,
  upsertDynamicSlotRule,
  ENC_SLOTS
} from "./encumbrance-db.mjs";
import { ContainerService } from "./containers.mjs";
import { normalize } from "./utils.mjs";

// Espaços por item só mudam quando o item é atualizado (modifiedTime) ou a tabela de pesos muda.
const itemSlotsCache = new WeakMap();

function itemSlotsCacheKey(item) {
  const modifiedTime = item?._stats?.modifiedTime;
  if (!item || typeof item !== "object" || !Number.isFinite(modifiedTime)) return null;
  return `${getWeightConfigVersion()}|${modifiedTime}`;
}

const GEAR_ITEM_TYPES = new Set(["equipment", "weapon", "armor", "artifact"]);

const HEAVY_WEAPON_TERMS = [
  "arma pesada",
  "heavy weapon",
  "duas maos",
  "duas mãos",
  "two handed",
  "two-handed",
  "montante",
  "greatsword",
  "great sword",
  "espada bastarda",
  "bastard sword",
  "espada do executor",
  "executioner sword",
  "executioner's sword",
  "machado do executor",
  "executioner axe",
  "executioner's axe",
  "machado duplo",
  "double axe",
  "machado com gancho",
  "hook axe",
  "machado de batalha",
  "battleaxe",
  "battle axe",
  "greataxe",
  "great axe",
  "acha-de-armas",
  "acha de armas",
  "pole axe",
  "poleaxe",
  "mangual de batalha",
  "battle flail",
  "mangual pesado",
  "heavy flail",
  "martelo de guerra",
  "warhammer",
  "war hammer",
  "martelo longo",
  "long hammer",
  "martelo de duas maos",
  "martelo de duas mãos",
  "maul"
];

const LIGHT_ARMOR_TERMS = [
  "leve",
  "light armor",
  "couro",
  "leather",
  "manto da ordem",
  "order cloak",
  "robe abencoado",
  "robe abençoado",
  "blessed robe",
  "seda tecida",
  "woven silk",
  "toga de bruxa",
  "witch gown",
  "pele de lobo",
  "wolf skin",
  "armadura ocultada",
  "concealed armor",
  "couraca de escaldo",
  "couraça de escaldo",
  "scaldo cuirass"
];

const MEDIUM_ARMOR_TERMS = [
  "media",
  "média",
  "medium armor",
  "brunea",
  "chainmail",
  "chain mail",
  "cota de malha",
  "cota de malha dupla",
  "armadura laminada",
  "laminated armor",
  "couraca de seda envernizada",
  "couraça de seda envernizada",
  "lacquered silk armor",
  "armadura de corvo",
  "crow armor"
];

const HEAVY_ARMOR_TERMS = [
  "pesada",
  "heavy armor",
  "armadura completa",
  "full plate",
  "armadura da ira",
  "armor of wrath",
  "armadura de campo",
  "field armor",
  "pansares",
  "placas completa",
  "placas completas",
  "templarios",
  "templários",
  "plate armor",
  "armadura de placas"
];

export class EncumbranceService {
  /** Pesos base do módulo + pesos aprendidos, salvos na configuração do mundo. */
  static async loadWeightConfig(moduleId) {
    await loadEncumbranceWeights(moduleId);
    this.applyDynamicWeightConfig(readDynamicWeightSetting());
  }

  static applyDynamicWeightConfig(config) {
    applyDynamicEncumbranceWeights(config);
  }

  /**
   * Aprende pesos de itens de mundo, atores e compendios.
   * O arquivo JSON do modulo continua sendo a base; as descobertas ficam salvas no mundo.
   */
  static async discoverKnownItems() {
    if (!canPersistDynamicWeights()) return { learned: 0, scanned: 0 };

    let learned = 0;
    let scanned = 0;

    for (const item of game.items ?? []) {
      scanned += 1;
      if (this.learnItem(item, { persist: false })) learned += 1;
    }

    for (const actor of game.actors ?? []) {
      for (const item of actorItems(actor)) {
        scanned += 1;
        if (this.learnItem(item, { persist: false })) learned += 1;
      }
    }

    for (const item of await loadCompendiumItems()) {
      scanned += 1;
      if (this.learnItem(item, { persist: false })) learned += 1;
    }

    if (learned > 0) await persistDynamicWeightConfig();
    return { learned, scanned };
  }

  static learnItem(item, { force = false, persist = true } = {}) {
    if (!isTrackedGear(item)) return false;
    if (!force && hasConfiguredEncumbranceRule(item.name)) return false;

    const slots = this.getItemSlots(item);
    const changed = upsertDynamicSlotRule(item.name, slots);
    if (changed && persist) {
      persistDynamicWeightConfig().catch((err) => {
        console.warn(`Tenebre Resources | Could not persist learned encumbrance weight for "${item.name}".`, err);
      });
    }
    return changed;
  }

  static async rememberItemWeight(item, slots) {
    if (!isTrackedGear(item)) return false;
    const changed = upsertDynamicSlotRule(item.name, sanitizeSlots(slots));
    if (changed) await persistDynamicWeightConfig();
    return changed;
  }

  /**
   * Retorna os espaços de carga de um único item (por unidade).
   * Prioridade: flag manual > detecção automática.
   */
  static getItemSlots(item) {
    const key = itemSlotsCacheKey(item);
    const cached = key ? itemSlotsCache.get(item) : null;
    if (cached?.key === key) return cached.slots;
    const slots = this.computeItemSlots(item);
    if (key) itemSlotsCache.set(item, { key, slots });
    return slots;
  }

  static computeItemSlots(item) {
    if (!item) return ENC_SLOTS.ONE;

    if (ContainerService.isCampingEquipment(item)) return ENC_SLOTS.TWO;

    const manual = item.getFlag?.(FLAG_SCOPE, "encumbranceSlots");
    const isManual = item.getFlag?.(FLAG_SCOPE, "encumbranceManual") === true;
    const manualSlots = sanitizeSlots(manual, null);

    if (isManual && manualSlots !== null) return manualSlots;
    if (hasExactEncumbranceItem(item.name)) return detectEncumbranceSlots(item.name);

    if (item.type === "weapon") return weaponCarriedSlots(item);
    if (item.type === "armor") return armorCarriedSlots(item);
    if (getStackBundleRule(item.name)) return ENC_SLOTS.ZERO;

    return detectEncumbranceSlots(item.name);
  }

  /**
   * Retorna a carga da pilha sem considerar se o item esta equipado ou guardado.
   * Usado pela ficha do item para exibir o peso derivado da quantidade.
   */
  static getItemStackSlots(item) {
    if (!item) return 0;
    const slotsPerUnit = this.getItemSlots(item);

    if (isQuiver(item)) {
      const shots = getAmmoShots(item);
      const bundleRule = getStackBundleRule("flechas");
      return bundleRule ? calculateStackBundleSlots(shots, bundleRule) : Math.floor(shots / 10);
    }

    return calculateStackedSlots(item, slotsPerUnit, encumbranceQuantity(item));
  }

  static hasComputedStackWeight(item) {
    return Boolean(getStackBundleRule(item?.name));
  }

  /**
   * Retorna a carga efetiva do item no ator, respeitando estado ativo/equipado/guardado.
   */
  static getItemLoad(item) {
    const slotsPerUnit = this.getItemSlots(item);
    const state = item?.system?.state;
    const bundleRule = getStackBundleRule(item?.name);

    if (!isTrackedGear(item)) {
      return {
        slotsPerUnit,
        quantity: 0,
        totalSlots: 0,
        state,
        counted: false
      };
    }

    if (ContainerService.isStoredInCampingEquipment(item)) {
      return {
        slotsPerUnit,
        quantity: encumbranceQuantity(item),
        totalSlots: 0,
        state,
        counted: false
      };
    }

    const stored = ContainerService.isEnabled() && ContainerService.isStored(item);
    if (stored && !isStoredInCarriedContainer(item)) {
      return {
        slotsPerUnit,
        quantity: 0,
        totalSlots: 0,
        state,
        counted: false
      };
    }

    // Armas em active estao nas maos e armaduras em active estao vestidas:
    // nenhuma delas ocupa carga. Equipado representa o item apenas carregado;
    // other representa equipamento fora do personagem.
    const normalizedState = String(state ?? "").toLowerCase();
    const activeInUse = item?.system?.isActive === true || normalizedState === "active";
    if (!stored && (item.type === "weapon" || item.type === "armor") && activeInUse) {
      return {
        slotsPerUnit,
        quantity: 1,
        totalSlots: 0,
        state,
        counted: false
      };
    }

    if (!stored && hasGearState(item) && !isEquippedGearState(item)) {
      return {
        slotsPerUnit,
        quantity: 0,
        totalSlots: 0,
        state,
        counted: false
      };
    }

    if (isQuiver(item)) {
      const shots = getAmmoShots(item);
      const quiverBundleRule = getStackBundleRule("flechas");
      const totalSlots = quiverBundleRule
        ? calculateStackBundleSlots(shots, quiverBundleRule)
        : Math.floor(shots / 10);
      return {
        slotsPerUnit,
        quantity: shots,
        totalSlots,
        state,
        counted: totalSlots > 0
      };
    }

    const quantity = encumbranceQuantity(item);
    if (isProjectileBundleRule(bundleRule)) {
      const totalSlots = calculateStackBundleSlots(quantity, bundleRule);
      return {
        slotsPerUnit,
        quantity,
        totalSlots,
        state,
        counted: totalSlots > 0
      };
    }

    const totalSlots = calculateStackedSlots(item, slotsPerUnit, quantity);

    return {
      slotsPerUnit,
      quantity,
      totalSlots,
      state,
      counted: totalSlots > 0
    };
  }

  /**
   * Calcula a carga total de um ator.
   * Retorna um objeto com todas as informações de sobrecarga.
   */
  static calculateLoad(actor) {
    if (!actor) return defaultLoadResult();

    const totalStrong = getStrongValue(actor);

    const hasPorter = actorHasAbility(actor, ["transportador", "porter", "pack mule"]);
    const capacity = hasPorter ? Math.floor(totalStrong * 1.5) : totalStrong;
    const maxCapacity = capacity * 2;

    let currentLoad = 0;
    const itemBreakdown = [];

    for (const item of actorItems(actor)) {
      const load = this.getItemLoad(item);
      if (!isTrackedGear(item)) continue;

      itemBreakdown.push({
        id: item.id,
        name: item.name,
        img: item.img,
        type: item.type,
        state: load.state,
        slotsPerUnit: load.slotsPerUnit,
        quantity: load.quantity,
        totalSlots: load.totalSlots,
        counted: load.counted
      });

      currentLoad += load.totalSlots;
    }

    const overload = Math.max(0, currentLoad - capacity);
    const defensePenalty = overload;
    const isOverloaded = currentLoad > capacity;
    const isImmobilized = currentLoad > maxCapacity;

    return {
      currentLoad,
      capacity,
      maxCapacity,
      overload,
      defensePenalty,
      isOverloaded,
      isImmobilized,
      strong: totalStrong,
      hasPorter,
      items: itemBreakdown
    };
  }

  /**
   * Aplica a penalidade de Defesa nos dados derivados em memoria.
   * O valor nao e salvo no ator; ele e recalculado pelo prepareDerivedData.
   */
  static applyDefensePenalty(actor) {
    const load = this.calculateLoad(actor);
    const penalty = Number(load.defensePenalty) || 0;
    if (!actor || actor.type !== "player") return load;

    const combat = actor.system?.combat;
    if (!combat) return load;

    applyPenaltyToArmorData(combat, penalty);
    const activeArmor = actor.system?.armors?.find?.((armor) => armor.id === combat.id);
    if (activeArmor && activeArmor !== combat) {
      applyPenaltyToArmorData(activeArmor, penalty);
    }

    return load;
  }

  static clearDefensePenalty(actor) {
    if (!actor || actor.type !== "player") return;

    const combat = actor.system?.combat;
    if (combat) applyPenaltyToArmorData(combat, 0);

    const activeArmor = actor.system?.armors?.find?.((armor) => armor.id === combat?.id);
    if (activeArmor && activeArmor !== combat) {
      applyPenaltyToArmorData(activeArmor, 0);
    }
  }

}

function getStrongValue(actor) {
  const strong = actor?.system?.attributes?.strong ?? {};
  const total = Number(strong.total);
  if (Number.isFinite(total) && total > 0) return total;

  const value = Number(strong.value ?? 10);
  const bonus = Number(strong.bonus ?? 0);
  const tempMod = Number(strong.temporaryMod ?? 0);
  return value + bonus + tempMod;
}

function sanitizeSlots(value, fallback = ENC_SLOTS.ONE) {
  const slots = Number(value);
  if (!Number.isFinite(slots)) return fallback;
  return Math.max(0, slots);
}

function isTrackedGear(item) {
  return Boolean(item && (item.system?.isGear || GEAR_ITEM_TYPES.has(item.type)));
}

function hasGearState(item) {
  return item?.system?.state !== undefined && item?.system?.state !== null && item?.system?.state !== "";
}

function isEquippedGearState(item) {
  const state = String(item?.system?.state ?? "").toLowerCase();
  return item?.system?.isEquipped === true || state === "equipped" || state === "active";
}

function isStoredInCarriedContainer(item) {
  const actor = item?.parent;
  const containerId = ContainerService.getStoredIn(item);
  const container = actor?.items?.get?.(containerId);
  return isEquippedGearState(container);
}

function encumbranceQuantity(item) {
  if (item?.type === "equipment") return itemQuantity(item);
  return 1;
}

function calculateStackedSlots(item, slotsPerUnit, quantity) {
  const bundleRule = getStackBundleRule(item?.name);
  if (bundleRule) return calculateStackBundleSlots(quantity, bundleRule);
  return slotsPerUnit * quantity;
}

function isProjectileBundleRule(rule) {
  return Boolean(rule && Number(rule.bundleSize) === 10);
}

function armorCarriedSlots(item) {
  const system = item?.system ?? {};
  const name = normalize(item?.name ?? "");
  const baseProtection = normalize(system.baseProtection ?? system.protection ?? "");

  if (isNoArmorName(name) || baseProtection === "0" || baseProtection === "1d0") return ENC_SLOTS.ZERO;
  if (isHeavyArmorName(name) || baseProtection.includes("1d8") || baseProtection.includes("1d10") || baseProtection.includes("1d12")) return 4;
  if (isMediumArmorName(name) || baseProtection.includes("1d6")) return 3;
  if (isLightArmorName(name) || baseProtection.includes("1d4")) return 2;

  const derived = Number(item?.impeding);
  if (Number.isFinite(derived) && derived > 0) return Math.max(0, derived);

  const direct = Number(system.impeding);
  if (Number.isFinite(direct) && direct > 0) return Math.max(0, direct);

  return ENC_SLOTS.ONE;
}

function weaponCarriedSlots(item) {
  return isHeavyWeapon(item) ? ENC_SLOTS.TWO : ENC_SLOTS.ONE;
}

function isHeavyWeapon(item) {
  if (hasMassiveQuality(item)) return true;

  const name = normalize(item?.name ?? "");
  const reference = normalize(item?.system?.reference ?? "");
  const quality = normalize(item?.system?.quality ?? "");
  const qualities = normalize(typeof item?.system?.qualities === "string" ? item.system.qualities : "");

  if (["heavy", "heavyweapon", "heavy weapon", "pesada", "arma pesada"].some((term) => reference.includes(normalize(term)))) {
    return true;
  }

  const combined = `${name} ${reference} ${quality} ${qualities}`;
  return HEAVY_WEAPON_TERMS.some((term) => combined.includes(normalize(term)));
}

function isNoArmorName(name) {
  return ["sem armadura", "no armor", "unarmored"].some((term) => name.includes(normalize(term)));
}

function isLightArmorName(name) {
  return LIGHT_ARMOR_TERMS.some((term) => name.includes(normalize(term)));
}

function isMediumArmorName(name) {
  return MEDIUM_ARMOR_TERMS.some((term) => name.includes(normalize(term)));
}

function isHeavyArmorName(name) {
  return HEAVY_ARMOR_TERMS.some((term) => name.includes(normalize(term)));
}

function defaultLoadResult() {
  return {
    currentLoad: 0,
    capacity: 10,
    maxCapacity: 20,
    overload: 0,
    defensePenalty: 0,
    isOverloaded: false,
    isImmobilized: false,
    strong: 10,
    hasPorter: false,
    items: []
  };
}

function applyPenaltyToArmorData(armorData, penalty) {
  const originalDefense = Number(armorData._tenebreBaseDefense ?? armorData.defense ?? 0);
  const nextDefense = Math.max(0, originalDefense - penalty);
  armorData._tenebreBaseDefense = originalDefense;
  armorData.defense = nextDefense;
  armorData.defmod = 10 - nextDefense;

  const msg = String(armorData.msg ?? "").replace(/Sobrecarga \(\d+\)<br\/>/g, "");
  armorData.msg = penalty > 0 ? `${msg}Sobrecarga (${penalty})<br/>` : msg;
}

function actorHasAbility(actor, aliases) {
  if (!actor?.items) return false;
  for (const item of actor.items) {
    if (item.type === "ability" || item.type === "trait" || item.type === "boon") {
      const name = (item.name || "").toLowerCase();
      for (const alias of aliases) {
        if (name.includes(alias.toLowerCase())) return true;
      }
    }
  }
  return false;
}

function readDynamicWeightSetting() {
  if (!globalThis.game?.settings?.settings?.has(`${MODULE_ID}.encumbranceDiscoveredWeights`)) {
    return null;
  }
  return game.settings.get(MODULE_ID, "encumbranceDiscoveredWeights");
}

function canPersistDynamicWeights() {
  return Boolean(
    globalThis.game?.user?.isGM
    && game.settings?.settings?.has(`${MODULE_ID}.encumbranceDiscoveredWeights`)
  );
}

async function persistDynamicWeightConfig() {
  if (!canPersistDynamicWeights()) return false;
  await game.settings.set(MODULE_ID, "encumbranceDiscoveredWeights", getDynamicEncumbranceWeights());
  return true;
}

async function loadCompendiumItems() {
  const items = [];
  for (const pack of game.packs ?? []) {
    if (pack.documentName !== "Item") continue;
    try {
      const index = await pack.getIndex({
        fields: [
          "name",
          "type",
          "system.isGear",
          "system.description",
          "system.reference",
          "system.quality",
          "system.qualities",
          "system.impeding",
          "system.baseProtection"
        ]
      });
      items.push(...Array.from(index).map(compendiumIndexEntryToItem));
    } catch (err) {
      console.warn(`Tenebre Resources | Could not scan item compendium "${pack.collection}".`, err);
    }
  }
  return items;
}

function compendiumIndexEntryToItem(entry) {
  return {
    id: entry._id,
    name: entry.name,
    type: entry.type,
    system: entry.system ?? {},
    getFlag: () => undefined
  };
}
