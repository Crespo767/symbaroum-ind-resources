import { FLAG_SCOPE, MODULE_ID } from "./constants.mjs";

export const DEFAULT_INVENTORY_STATE = "equipped";
export const UNCARRIED_INVENTORY_STATE = "other";

const GEAR_ITEM_TYPES = new Set(["weapon", "armor", "equipment", "artifact"]);

let hooksRegistered = false;

export class InventoryDefaultStateService {
  static registerHooks() {
    if (hooksRegistered || typeof globalThis.Hooks?.on !== "function") return false;

    globalThis.Hooks.on("preCreateItem", (item, _data, options) => {
      applyDefaultInventoryState(item, options);
    });
    globalThis.Hooks.on("preImportAdventure", (adventure, _formData, toCreate, toUpdate) => {
      normalizeAdventureInventory(adventure, toCreate, toUpdate);
    });
    hooksRegistered = true;
    return true;
  }
}

export function applyDefaultInventoryState(item, options = {}) {
  if (!shouldDefaultToEquipped(item, options)) return false;
  item.updateSource({ "system.state": DEFAULT_INVENTORY_STATE });
  return true;
}

export function shouldDefaultToEquipped(item, options = {}) {
  if (item?.parent?.documentName !== "Actor") return false;
  if (!shouldDefaultInventorySource(item, options)) return false;
  return typeof item.updateSource === "function";
}

export function normalizeAdventureInventory(adventure, toCreate = {}, toUpdate = {}) {
  if (!isModuleAdventure(adventure)) return 0;

  let normalized = 0;
  for (const actorSource of [...(toCreate.Actor ?? []), ...(toUpdate.Actor ?? [])]) {
    normalized += normalizeEmbeddedInventoryItems(actorSource?.items);
  }
  return normalized;
}

export function normalizeEmbeddedInventoryItems(items) {
  if (!Array.isArray(items)) return 0;

  let normalized = 0;
  for (const itemSource of items) {
    if (!shouldDefaultInventorySource(itemSource)) continue;
    itemSource.system.state = DEFAULT_INVENTORY_STATE;
    normalized += 1;
  }
  return normalized;
}

export function isModuleAdventure(adventure) {
  return String(adventure?.uuid ?? "").startsWith(`Compendium.${MODULE_ID}.`);
}

function shouldDefaultInventorySource(item, options = {}) {
  if (!GEAR_ITEM_TYPES.has(item.type)) return false;
  if (item.system?.state !== UNCARRIED_INVENTORY_STATE) return false;
  if (options?.[FLAG_SCOPE]?.preserveItemState === true) return false;
  if (item.flags?.[FLAG_SCOPE]?.storedIn) return false;
  if (item.flags?.[FLAG_SCOPE]?.groundContainer) return false;
  return true;
}
