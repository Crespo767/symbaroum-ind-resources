import { AMMO_TYPES, DEFAULTS, FLAG_SCOPE, WEAPON_AMMO_TYPES } from "./constants.mjs";
import { TenebreSettings } from "./settings.mjs";
import { getSpecialAmmoType } from "./special-ammo.mjs";
import { deleteDepletedInventoryItem, isDepletableInventoryItem } from "./inventory-cleanup.mjs";
import { matchesAnyAlias, normalize } from "./utils.mjs";

const RATION_ALIASES = ["pao de viagem", "waybread", "travel bread", "racao de viagem", "racao", "ration", "rations"];
const ARROW_ALIASES = [
  "flecha",
  "flechas",
  "arrow",
  "Arrows/Bolts - Regular",
  "Flechas/Virotes - Regulares",
  "arrows",
  "arrow - armor-piercing head",
  "arrow - flame",
  "arrow - grappling hook",
  "arrow - hammer head",
  "arrow - precision",
  "arrow - rope cutter",
  "arrow - snaring",
  "arrow - swallow's tail",
  "arrow - swallow’s tail",
  "arrow - whistler",
  "flecha - arpeu",
  "flecha - cabeca de martelo",
  "flecha - cauda de andorinha",
  "flecha - cortador de corda",
  "flecha - de laco",
  "flecha - flamejante",
  "flecha - ponta perfurante de armadura",
  "flecha - precisao",
  "flecha - sibilante",
  "flecha certeira",
  "precision arrow",
  "flaming arrow",
  "grappling arrow",
  "ensnaring arrow",
  "whistling arrow"
];
const BOLT_ALIASES = [
  "virote",
  "virotes",
  "bolt",
  "bolts",
  "quarrel",
  "quarrels",
  "raio atordoante",
  "stun bolt",
  "stunning bolt"
];
const CROSSBOW_ALIASES = ["crossbow", "besta", "arbalest", "arbalesta", "repeating crossbow", "besta de repeticao"];
const BOW_ALIASES = ["longbow", "shortbow", "bow", "arco longo", "arco curto", "arco"];
const QUIVER_ALIASES = ["aljava", "aljavas", "quiver", "quivers"];
const GENERIC_AMMO_ALIASES = ["municao", "municoes", "ammunition", "projectile", "projectiles", "projetil", "projeteis"];

export function getFlag(doc, key, fallback = undefined) {
  return doc?.getFlag?.(FLAG_SCOPE, key) ?? fallback;
}

export function isRation(item) {
  return Boolean(getRationRule(item));
}

export function getRationRule(item) {
  if (!item || item.type !== "equipment") return null;
  if (getFlag(item, "isRation", false) || hasAlias(item.name, RATION_ALIASES)) {
    return {
      key: "travelBread",
      name: item.name || "Pão de Viagem",
      usesPerUnit: Math.max(1, Number(safeSetting("rationUses", DEFAULTS.rationUses)) || DEFAULTS.rationUses),
      official: true
    };
  }

  if (!safeSetting("enableOtherRations", false)) return null;
  const configuredFoods = mergeExtraRationFoods(safeSetting("extraRationFoods", DEFAULTS.extraRationFoods));
  const itemName = normalize(item.name);
  for (const [key, food] of Object.entries(configuredFoods.foods ?? {})) {
    if (!food?.enabled) continue;
    const names = [food.name, ...(food.aliases ?? [])].map(normalize).filter(Boolean);
    if (!names.includes(itemName)) continue;
    return {
      key: `food:${key}`,
      name: food.name || item.name,
      usesPerUnit: Math.max(1, Number(food.uses) || 1),
      official: false
    };
  }
  return null;
}

export function isAmmo(item) {
  if (item?.type !== "equipment") return false;
  if (getFlag(item, "isAmmo", false)) return true;
  return Boolean(getAmmoType(item));
}

export function getAmmoType(item) {
  const type = getFlag(item, "ammoType", "");
  if (type === "ammo") return "ammo";
  if (getFlag(item, "isAmmo", false)) return "ammo";
  const specialType = getSpecialAmmoType(item);
  if (specialType) return "ammo";
  
  const name = normalize(item?.name);

  if (hasAlias(name, QUIVER_ALIASES)
    || hasAlias(name, BOLT_ALIASES)
    || hasAlias(name, ARROW_ALIASES)
    || hasAlias(name, GENERIC_AMMO_ALIASES)) {
    return "ammo";
  }
  return "";
}

export function getWeaponAmmoType(weapon) {
  const weaponType = getFlag(weapon, "weaponAmmoType", WEAPON_AMMO_TYPES.NONE);
  if (weaponType === WEAPON_AMMO_TYPES.BOW || weaponType === WEAPON_AMMO_TYPES.CROSSBOW) return "ammo";
  const name = normalize(weapon?.name);
  if (hasAlias(name, CROSSBOW_ALIASES) || hasAlias(name, BOW_ALIASES)) return "ammo";
  return "";
}

export function itemQuantity(item) {
  return Number(item?.system?.number ?? 0) || 0;
}

export async function changeItemQuantity(item, delta) {
  const current = itemQuantity(item);
  const next = Math.max(0, current + delta);
  if (next <= 0 && isDepletableInventoryItem(item)) {
    return deleteDepletedInventoryItem(item, next);
  }
  return item.update({ "system.number": next });
}

export function actorItems(actor) {
  return Array.from(actor?.items?.values?.() ?? []);
}

export function findRationItems(actor) {
  return actorItems(actor).filter(isRation);
}

export function mergeExtraRationFoods(value) {
  const source = value && typeof value === "object" ? value : {};
  const sourceFoods = source.foods && typeof source.foods === "object" ? source.foods : {};
  const foods = {};
  for (const [key, defaultFood] of Object.entries(DEFAULTS.extraRationFoods.foods)) {
    foods[key] = normalizeExtraRationFood(defaultFood, sourceFoods[key]);
  }
  for (const [key, customFood] of Object.entries(sourceFoods)) {
    if (foods[key]) continue;
    if (!customFood?.custom) continue;
    if (!customRationFoodExists(customFood)) continue;
    const normalized = normalizeExtraRationFood({
      name: customFood?.name,
      aliases: [],
      category: "Custom",
      uses: 1,
      enabled: false,
      custom: true
    }, customFood);
    if (normalized.name) foods[key] = normalized;
  }
  return {
    version: DEFAULTS.extraRationFoods.version,
    foods
  };
}

function normalizeExtraRationFood(defaultFood, sourceFood) {
  const customFood = sourceFood && typeof sourceFood === "object" ? sourceFood : {};
  const name = String(customFood.name ?? defaultFood.name ?? "").trim();
  return {
    ...defaultFood,
    ...customFood,
    name,
    aliases: Array.isArray(customFood.aliases) ? customFood.aliases : (Array.isArray(defaultFood.aliases) ? defaultFood.aliases : []),
    category: String(customFood.category ?? defaultFood.category ?? "Custom").trim() || "Custom",
    itemId: String(customFood.itemId ?? defaultFood.itemId ?? "").trim(),
    uses: Math.max(1, Number(customFood.uses ?? defaultFood.uses) || 1),
    enabled: Boolean(customFood.enabled ?? defaultFood.enabled),
    custom: Boolean(customFood.custom ?? defaultFood.custom)
  };
}

function customRationFoodExists(food) {
  const itemId = String(food?.itemId ?? "").trim();
  if (itemId && game.items?.get?.(itemId)) return true;
  const name = normalize(food?.name);
  if (!name) return false;
  return Boolean(game.items?.some?.((item) => normalize(item.name) === name));
}

export function findAmmoItems(actor, ammoType) {
  return actorItems(actor).filter((item) => isAmmo(item) && getAmmoType(item) === ammoType && itemQuantity(item) > 0);
}

export function findLoadedQuiverItems(actor, ammoType) {
  return actorItems(actor).filter((item) => {
    return isQuiver(item)
      && getAmmoType(item) === ammoType
      && itemQuantity(item) > 0
      && isActiveOrEquipped(item)
      && getQuiverLoadedTotal(item) > 0;
  });
}

export function sumItemQuantities(items) {
  return items.reduce((total, item) => total + itemQuantity(item), 0);
}

export function isQuiver(item) {
  if (!item || item.type !== "equipment") return false;
  return hasAlias(item.name, QUIVER_ALIASES);
}

export function isActiveOrEquipped(item) {
  const state = String(item?.system?.state ?? "").toLowerCase();
  return state === "active" || state === "equipped";
}

export function getQuiverLoadedAmmo(quiverItem) {
  if (!quiverItem) return [];
  let loadedAmmo = quiverItem.getFlag(FLAG_SCOPE, "loadedAmmo");
  if (!loadedAmmo || !loadedAmmo.length) {
    const legacyUses = quiverItem.getFlag(FLAG_SCOPE, "usesRemaining");
    if (legacyUses !== undefined && legacyUses !== null) {
      loadedAmmo = [{
        name: "Flechas/Virotes - Regulares",
        quantity: legacyUses,
        img: "icons/weapons/ammunition/arrows-bodkin-yellow-red.webp",
        id: "legacy"
      }];
    } else {
      loadedAmmo = [];
    }
  }
  return loadedAmmo;
}

export function getQuiverLoadedTotal(quiverItem) {
  const loadedAmmo = getQuiverLoadedAmmo(quiverItem);
  return loadedAmmo.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
}

export function getQuiverCapacity() {
  return Math.max(1, Number(safeSetting("quiverCapacity", 12)) || 12);
}

export function getAmmoShots(item) {
  const qty = itemQuantity(item);
  if (isQuiver(item)) {
    const loaded = getQuiverLoadedTotal(item);
    return qty > 0 ? (qty - 1) * getQuiverCapacity() + loaded : 0;
  }
  return qty;
}

export function sumAmmoShots(items) {
  return items.reduce((total, item) => total + getAmmoShots(item), 0);
}

export function sumLoadedQuiverShots(items) {
  return items.reduce((total, item) => total + (isQuiver(item) ? getQuiverLoadedTotal(item) : 0), 0);
}

export function localizeAmmoType(ammoType) {
  return game.i18n.localize("TENEBRE.Ammo.Ammo");
}

// Comparação por palavra inteira: substring confundia "Coração" com "ração" e "Elbow" com "bow".
function hasAlias(value, aliases) {
  return matchesAnyAlias(value, aliases);
}

function safeSetting(key, fallback) {
  try {
    if (!globalThis.game?.settings?.settings?.has?.(`${FLAG_SCOPE}.${key}`)) return fallback;
    return TenebreSettings.get(key);
  } catch (_error) {
    return fallback;
  }
}
