import { MODULE_ID } from "./constants.mjs";

const pendingDeletions = new Set();
let hooksRegistered = false;

export function isInventoryCleanupEnabled() {
  try {
    return Boolean(game.settings.get(MODULE_ID, "enableInventoryCleanup"));
  } catch {
    return true;
  }
}

export function isDepletableInventoryItem(item) {
  return Boolean(item?.type === "equipment" && item?.parent?.documentName === "Actor");
}

export function isDepletedInventoryItem(item) {
  if (!isDepletableInventoryItem(item)) return false;
  return isDepletedQuantity(item.system?.number);
}

export function updateDepletesInventoryItem(changes) {
  const value = changes?.system?.number ?? changes?.["system.number"];
  if (value === undefined || value === null || value === "") return false;
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity <= 0;
}

export async function deleteDepletedInventoryItem(item, quantity = item?.system?.number) {
  if (!isDepletableInventoryItem(item) || !isDepletedQuantity(quantity)) return false;

  const key = item.uuid ?? item.id;
  if (!key || pendingDeletions.has(key)) return false;

  pendingDeletions.add(key);
  try {
    const result = await item.delete({ render: true });
    return result !== false;
  } finally {
    pendingDeletions.delete(key);
  }
}

function isDepletedQuantity(value) {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity <= 0;
}

export class InventoryCleanupService {
  static registerHooks() {
    if (hooksRegistered) return;
    hooksRegistered = true;

    Hooks.on("createItem", (item, options, userId) => {
      if (!isInventoryCleanupEnabled()) return;
      if (userId && userId !== game.user?.id) return;
      if (!isDepletedInventoryItem(item)) return;
      this.deleteFromHook(item);
    });

    Hooks.on("updateItem", (item, changes, options, userId) => {
      if (!isInventoryCleanupEnabled()) return;
      if (userId && userId !== game.user?.id) return;
      if (!updateDepletesInventoryItem(changes)) return;
      this.deleteFromHook(item);
    });
  }

  static deleteFromHook(item) {
    deleteDepletedInventoryItem(item).catch((error) => {
      console.warn("Tenebre Resources | Failed to delete a depleted inventory item.", error);
    });
  }

  static async cleanupExisting() {
    if (!isInventoryCleanupEnabled()) return 0;
    const activeGM = game.users?.activeGM;
    if (!game.user?.isGM || (activeGM && activeGM.id !== game.user.id)) return 0;

    let deleted = 0;
    for (const actor of game.actors ?? []) {
      // Só personagens: PNJs e monstros podem ter equipamentos com quantidade 0 de propósito.
      if (actor.type !== "player") continue;
      const depletedItems = Array.from(actor.items ?? []).filter(isDepletedInventoryItem);
      for (const item of depletedItems) {
        try {
          if (await deleteDepletedInventoryItem(item)) deleted += 1;
        } catch (error) {
          console.warn("Tenebre Resources | Failed to clean up an existing depleted inventory item.", error);
        }
      }
    }
    return deleted;
  }
}
