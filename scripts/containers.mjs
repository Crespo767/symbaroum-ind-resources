import { FLAG_SCOPE, MODULE_ID } from "./constants.mjs";
import { escapeHtml, normalize, promptDialog } from "./utils.mjs";

const STORABLE_TYPES = new Set(["equipment", "weapon", "armor", "artifact"]);
const ACCESSIBLE_STATES = new Set(["equipped", "active"]);
const CAMPING_CONTENTS_SEEDED_FLAG = "campingContentsSeeded";
const CONTAINER_EXPANSION_SETTING = "containerExpansionState";
const CONTAINER_CAPACITY_FLAG = "containerCapacity";
const TRANSFER_DELETE_FLAG = "containerTransferDelete";
const TRANSFER_DELETE_TTL_MS = 60000;
const STORED_ITEM_STATE = "other";
let hooksRegistered = false;
const sessionExpansionState = new Map();
const transferDeleteAllowlist = new Set();

function actorItems(actor) {
  return Array.from(actor?.items?.values?.() ?? []);
}

function itemQuantity(item) {
  return Number(item?.system?.number ?? 0) || 0;
}

const LIGHT_CONTAINER_ALIASES = [
  "mochila",
  "backpack",
  "rucksack",
  "saco",
  "sacos",
  "sacola",
  "sacolas",
  "satchel",
  "sack",
  "cesto",
  "cesta",
  "basket",
  "bolsa",
  "bag",
  "pouch",
  "purse",
  "bolsa de moedas",
  "coin purse",
  "jarro",
  "jarra",
  "pitcher",
  "clay pitcher",
  "alforje",
  "alforjes",
  "saddlebag",
  "equipamento de acampar",
  "equipamento de acampamento",
  "equipamento de campo",
  "algibeira",
  "jarra de barro",
  "belt pouch",
  "field equipment",
  "camping equipment"
];

const BULKY_CONTAINER_ALIASES = [
  "barril",
  "barrel",
  "bau",
  "baú",
  "bau pequeno",
  "baú pequeno",
  "bau grande",
  "baú grande",
  "chest",
  "small chest",
  "large chest",
  "caixa",
  "caixa decorada",
  "box",
  "decorated box",
  "snuff box",
  "crate",
  "arca",
  "coffer"
];

const NON_CONTAINER_ALIASES = [
  "saco de dormir",
  "sleeping bag",
  "bedroll",
  "colchonete",
  "one box",
  "one sack",
  "one barrel"
];

const CAMPING_EQUIPMENT_ALIASES = [
  "equipamento de acampar",
  "equipamento de acampamento",
  "equipamento de campo",
  "field equipment",
  "camping equipment"
];

const SMALL_CONTAINER_ALIASES = [
  "bolsa",
  "bag",
  "pouch",
  "purse",
  "bolsa de moedas",
  "coin purse",
  "algibeira",
  "belt pouch"
];

const DEFAULT_CAMPING_CONTENTS = [
  "Saco de dormir",
  "Frigideira",
  "Lenha",
  "Pederneira e Isqueiro",
  "Corda",
  "Cantil"
];

export class ContainerService {
  static registerHooks() {
    if (hooksRegistered) return;
    hooksRegistered = true;

    Hooks.on("preUpdateItem", (item, changes, options, userId) => {
      if (userId !== game.user?.id) return true;
      if (!this.isContainer(item) || !this.getStoredItems(item.parent, item).length) return true;
      const quantity = changes?.system?.number ?? changes?.["system.number"];
      if (quantity === undefined || quantity === null || quantity === "" || Number(quantity) > 0) return true;
      ui.notifications.warn(game.i18n.format("TENEBRE.Containers.CannotDepleteNotEmpty", {
        container: item.name
      }));
      return false;
    });

    Hooks.on("deleteItem", (item, options, userId) => {
      if (userId !== game.user?.id) return;
      if (item.parent && this.isContainer(item)) void setContainerExpanded(item.parent, item, false);
      if (this.consumeAllowedTransferredDelete(item)) return;
      if (this.canPreserveContentsOnDelete(item, options)) return;
      this.recoverStoredItemsFromDeletedContainer(item).catch((error) => {
        console.warn("Tenebre Resources | Failed to recover stored items after container deletion.", error);
      });
    });
  }

  static isContainer(item) {
    if (!item || !STORABLE_TYPES.has(item.type)) return false;
    if (item.getFlag?.(FLAG_SCOPE, "isContainer") === true) return true;
    const name = normalize(item.name);
    if (hasAlias(name, NON_CONTAINER_ALIASES)) return false;
    return hasAlias(name, LIGHT_CONTAINER_ALIASES) || hasAlias(name, BULKY_CONTAINER_ALIASES);
  }

  static isEnabled() {
    try {
      return Boolean(game.settings.get(MODULE_ID, "enableContainers"));
    } catch {
      return true;
    }
  }

  static isStored(item) {
    return Boolean(this.getStoredIn(item));
  }

  static isAccessible(item) {
    return isAccessibleState(item);
  }

  static getStoredIn(item) {
    return item?.getFlag?.(FLAG_SCOPE, "storedIn") ?? "";
  }

  static canStoreItem(item) {
    return this.isEnabled() && this.canAttemptStoreItem(item) && isAccessibleState(item);
  }

  static canAttemptStoreItem(item) {
    return Boolean(
      this.isEnabled()
      && item
      && STORABLE_TYPES.has(item.type)
      && (item.type !== "equipment" || itemQuantity(item) > 0)
      && !this.isContainer(item)
      && !this.isStored(item)
      && item.id !== globalThis.game?.symbaroum?.config?.noArmorID
    );
  }

  static getContainers(actor, item = null) {
    if (!this.isEnabled() || !canMutateActor(actor)) return [];
    return actorItems(actor).filter((candidate) => {
      return candidate.id !== item?.id
        && this.isContainer(candidate)
        && !this.isStored(candidate)
        && itemQuantity(candidate) > 0;
    });
  }

  static getAvailableContainers(actor, item = null) {
    return this.getContainers(actor, item).filter((candidate) => {
      return isAccessibleState(candidate) && this.canStoreInContainer(actor, item, candidate);
    });
  }

  static getContainerCapacity(container) {
    const configured = normalizeCapacityConfig(container?.getFlag?.(FLAG_SCOPE, CONTAINER_CAPACITY_FLAG));
    if (configured) return configured;

    const defaultCapacity = getDefaultContainerCapacity(container);
    return defaultCapacity === null
      ? { mode: "unlimited" }
      : { mode: "slots", value: defaultCapacity };
  }

  static getContainerUsedSlots(actor, container) {
    return this.getStoredItems(actor, container).length;
  }

  static getContainerCapacityLabel(actor, container) {
    const capacity = this.getContainerCapacity(container);
    const used = this.getContainerUsedSlots(actor, container);
    return `${used}/${capacity.mode === "unlimited" ? "∞" : capacity.value}`;
  }

  static canStoreInContainer(actor, item, container) {
    if (!isValidStoreRelationship(actor, item, container)) return false;
    if (!this.isContainer(container) || this.isStored(container)) return false;
    if (!isAccessibleState(item) || !isAccessibleState(container)) return false;

    const compatibleStack = item?.type === "equipment" && findStoredStack(actor, item, container);
    if (compatibleStack) return true;

    const capacity = this.getContainerCapacity(container);
    return capacity.mode === "unlimited"
      || this.getContainerUsedSlots(actor, container) < capacity.value;
  }

  static async setContainerCapacity(actor, container, config) {
    if (!canMutateActor(actor) || !isValidOwnedActorItem(actor, container) || !this.isContainer(container)) {
      return false;
    }
    const normalized = normalizeCapacityConfig(config);
    if (!normalized) return false;

    await container.setFlag(FLAG_SCOPE, CONTAINER_CAPACITY_FLAG, normalized);
    rerenderActorSheets(actor);
    return true;
  }

  static async configureContainerPrompt(actor, container) {
    if (!game.user?.isGM || !isValidOwnedActorItem(actor, container) || !this.isContainer(container)) return false;

    const current = this.getContainerCapacity(container);
    const slotsSelected = current.mode !== "unlimited";
    const content = `
      <form class="tenebre-container-capacity-form">
        <p>${escapeHtml(game.i18n.format("TENEBRE.Containers.ConfigurePrompt", { container: container.name }))}</p>
        <div class="form-group">
          <label>${escapeHtml(game.i18n.localize("TENEBRE.Containers.CapacityMode"))}</label>
          <div class="tenebre-container-capacity-modes">
            <label><input type="radio" name="capacityMode" value="slots" ${slotsSelected ? "checked" : ""}> ${escapeHtml(game.i18n.localize("TENEBRE.Containers.CapacitySlots"))}</label>
            <label><input type="radio" name="capacityMode" value="unlimited" ${slotsSelected ? "" : "checked"}> ${escapeHtml(game.i18n.localize("TENEBRE.Containers.CapacityUnlimited"))}</label>
          </div>
        </div>
        <div class="form-group">
          <label>${escapeHtml(game.i18n.localize("TENEBRE.Containers.CapacityValue"))}</label>
          <input type="number" name="capacityValue" value="${slotsSelected ? current.value : 1}" min="1" max="999">
        </div>
      </form>
    `;

    const result = await promptDialog({
      title: game.i18n.localize("TENEBRE.Containers.ConfigureTitle"),
      content,
      okIcon: "fas fa-save",
      width: 360,
      contentClass: "tenebre-container-capacity-dialog",
      callback: (element) => ({
        mode: element.querySelector('[name="capacityMode"]:checked')?.value,
        value: Number(element.querySelector('[name="capacityValue"]')?.value)
      })
    });

    if (!result) return false;
    return this.setContainerCapacity(actor, container, result);
  }

  static getStoredItems(actor, container) {
    if (!actor || !container) return [];
    return actorItems(actor).filter((item) => this.getStoredIn(item) === container.id);
  }

  static canPreserveContentsOnDelete(item, options = {}) {
    const transferKey = itemTransferDeleteKey(item);
    if (transferKey && transferDeleteAllowlist.has(transferKey)) return true;
    if (this.isTransferredDeleteAuthorized(item)) return true;
    return Boolean(
      options?.[MODULE_ID]?.preserveContents === true
      && item
      && this.isContainer(item)
      && canMutateActor(item.parent)
    );
  }

  static allowDeleteWithTransferredContents(item) {
    const key = itemTransferDeleteKey(item);
    if (!key) return false;
    transferDeleteAllowlist.add(key);
    const cleanupTimer = setTimeout(() => transferDeleteAllowlist.delete(key), 30000);
    cleanupTimer?.unref?.();
    return true;
  }

  static isTransferredDeleteAuthorized(item, transferId = null) {
    if (!item) return false;
    const authorization = item.getFlag?.(FLAG_SCOPE, TRANSFER_DELETE_FLAG)
      ?? item.flags?.[FLAG_SCOPE]?.[TRANSFER_DELETE_FLAG];
    if (!authorization?.id || Number(authorization.expiresAt ?? 0) < Date.now()) return false;
    return !transferId || authorization.id === transferId;
  }

  static async authorizeTransferredDeletes(actor, items, transferId) {
    if (!actor || !transferId || !canMutateActor(actor)) return false;
    const updates = items
      .filter((item) => item?.id && item.parent?.id === actor.id)
      .map((item) => ({
        _id: item.id,
        [`flags.${FLAG_SCOPE}.${TRANSFER_DELETE_FLAG}`]: {
          id: transferId,
          sourceItemId: item.id,
          expiresAt: Date.now() + TRANSFER_DELETE_TTL_MS
        }
      }));
    if (!updates.length) return true;
    await actor.updateEmbeddedDocuments("Item", updates, { render: false });
    return true;
  }

  static async revokeTransferredDeletes(actor, items, transferId) {
    if (!actor || !canMutateActor(actor)) return false;
    const updates = items
      .filter((item) => this.isTransferredDeleteAuthorized(item, transferId))
      .map((item) => ({
        _id: item.id,
        [`flags.${FLAG_SCOPE}.-=${TRANSFER_DELETE_FLAG}`]: null
      }));
    if (!updates.length) return true;
    await actor.updateEmbeddedDocuments("Item", updates, { render: false });
    return true;
  }

  static consumeAllowedTransferredDelete(item) {
    const key = itemTransferDeleteKey(item);
    if (!key) return false;
    return transferDeleteAllowlist.delete(key);
  }

  static async deleteContainerPreservingContents(actor, container) {
    if (!canMutateActor(actor) || !isValidOwnedActorItem(actor, container) || !this.isContainer(container)) {
      return false;
    }

    await container.delete({ [MODULE_ID]: { preserveContents: true } });
    return true;
  }

  static async storeItemPrompt(actor, item) {
    if (!this.isEnabled() || !isValidOwnedActorItem(actor, item)) return false;
    if (!isAccessibleState(item)) {
      warnInaccessibleState("TENEBRE.Containers.CannotStoreOther");
      return false;
    }
    if (!this.canStoreItem(item)) return false;

    const containers = this.getAvailableContainers(actor, item);
    if (!containers.length) {
      const allContainers = this.getContainers(actor, item);
      const accessibleContainers = allContainers.filter((candidate) => isAccessibleState(candidate));
      if (accessibleContainers.length > 0) {
        const fullContainer = accessibleContainers.find((candidate) => !this.canStoreInContainer(actor, item, candidate));
        if (fullContainer) {
          ui.notifications.warn(game.i18n.format("TENEBRE.Containers.ContainerFull", {
            container: fullContainer.name,
            capacity: this.getContainerCapacityLabel(actor, fullContainer)
          }));
        }
        return false;
      }
      if (allContainers.length > 0) {
        warnInaccessibleState("TENEBRE.Containers.CannotStoreInOther");
        return false;
      }
      ui.notifications.warn(game.i18n.localize("TENEBRE.Containers.NoContainers"));
      return false;
    }

    const quantity = getStorableQuantity(item);
    const content = buildStoreDialogContent({ actor, item, containers, quantity });

    const result = await promptDialog({
      title: game.i18n.localize("TENEBRE.Containers.StoreTitle"),
      content,
      okIcon: "fas fa-box",
      width: 360,
      contentClass: "tenebre-container-store-dialog",
      callback: (element) => ({
        containerId: element.querySelector('[name="containerId"]')?.value,
        quantity: Number(element.querySelector('[name="quantity"]')?.value || quantity)
      })
    });

    if (!result) return false;
    const container = actor.items.get(result.containerId);
    if (!container) return false;
    return this.storeItem(actor, item, container, result.quantity);
  }

  static async storeItemInContainerPrompt(actor, item, container) {
    if (!this.isEnabled() || !isValidStoreRelationship(actor, item, container)) return false;
    if (!isAccessibleState(item)) {
      warnInaccessibleState("TENEBRE.Containers.CannotStoreOther");
      return false;
    }
    if (!this.canStoreItem(item)) return false;
    if (!this.isContainer(container) || this.isStored(container)) return false;
    if (!isAccessibleState(container)) {
      warnInaccessibleState("TENEBRE.Containers.CannotStoreInOther");
      return false;
    }

    const quantity = getStorableQuantity(item);
    if (quantity <= 1) {
      return this.storeItem(actor, item, container, 1);
    }

    const content = buildStoreDialogContent({ actor, item, containers: [container], quantity, fixedContainer: true });

    const amount = await promptDialog({
      title: game.i18n.localize("TENEBRE.Containers.StoreTitle"),
      content,
      okIcon: "fas fa-box",
      width: 360,
      contentClass: "tenebre-container-store-dialog",
      callback: (element) => Number(element.querySelector('[name="quantity"]')?.value || quantity)
    });

    if (amount === null) return false;
    return this.storeItem(actor, item, container, amount);
  }

  static async storeItem(actor, item, container, quantity = 1) {
    if (!this.isEnabled() || !isValidStoreRelationship(actor, item, container)) return false;
    if (!this.canAttemptStoreItem(item) || !this.isContainer(container) || this.isStored(container)) return false;
    if (item.id === container.id || itemQuantity(container) <= 0) return false;
    if (!isAccessibleState(item)) {
      warnInaccessibleState("TENEBRE.Containers.CannotStoreOther");
      return false;
    }
    if (!isAccessibleState(container)) {
      warnInaccessibleState("TENEBRE.Containers.CannotStoreInOther");
      return false;
    }
    if (!this.canStoreInContainer(actor, item, container)) {
      ui.notifications.warn(game.i18n.format("TENEBRE.Containers.ContainerFull", {
        container: container.name,
        capacity: this.getContainerCapacityLabel(actor, container)
      }));
      return false;
    }

    const storableQuantity = getStorableQuantity(item);
    if (storableQuantity <= 0) return false;
    const amount = Math.max(1, Math.min(storableQuantity, Math.floor(Number(quantity) || 1)));
    const preStoredState = item.system?.state ?? "";

    if (item.type === "equipment" && storableQuantity > 1 && amount < storableQuantity) {
      const storedStack = findStoredStack(actor, item, container);
      if (storedStack) {
        await actor.updateEmbeddedDocuments("Item", [
          { _id: item.id, "system.number": storableQuantity - amount },
          { _id: storedStack.id, "system.number": itemQuantity(storedStack) + amount }
        ], { render: true });
      } else {
        const itemData = createStoredItemData(item, container, amount, preStoredState);
        await createSplitStack(actor, item, itemData, storableQuantity - amount);
      }
    } else {
      const storedStack = item.type === "equipment" ? findStoredStack(actor, item, container) : null;
      if (storedStack) {
        await mergeAndDeleteStack(actor, item, storedStack, itemQuantity(item));
      } else {
        await item.update({
          "system.state": STORED_ITEM_STATE,
          [`flags.${FLAG_SCOPE}.storedIn`]: container.id,
          [`flags.${FLAG_SCOPE}.storedInName`]: container.name,
          [`flags.${FLAG_SCOPE}.preStoredState`]: preStoredState
        });
      }
    }

    return true;
  }

  static async openContainer(actor, container) {
    return this.toggleContainer(actor, container);
  }

  static async toggleContainer(actor, container) {
    if (!this.isEnabled() || !isValidOwnedActorItem(actor, container) || !this.isContainer(container) || this.isStored(container)) return false;

    const isExpanded = !this.isContainerExpanded(actor, container);
    if (isExpanded) {
      await seedContainerContents(actor, container);
    }
    await setContainerExpanded(actor, container, isExpanded);
    rerenderActorSheets(actor);
    return isExpanded;
  }

  static isContainerExpanded(actor, container) {
    if (!actor || !container) return false;
    return getContainerExpansionState().has(containerExpansionKey(actor, container));
  }

  static async collapseContainer(actor, container) {
    if (!isValidOwnedActorItem(actor, container) || !this.isContainer(container)) return false;
    await setContainerExpanded(actor, container, false);
    rerenderActorSheets(actor);
    return true;
  }

  static async recoverStoredItemsFromDeletedContainer(container) {
    const actor = container?.parent;
    if (!actor || !canMutateActor(actor)) return 0;

    const storedItems = actorItems(actor).filter((item) => this.getStoredIn(item) === container.id);
    if (!storedItems.length) return 0;

    await restoreStoredItems(actor, storedItems);
    ui.notifications.info(game.i18n.format("TENEBRE.Containers.RecoveredFromDeleted", {
      count: storedItems.length,
      container: container.name
    }));
    return storedItems.length;
  }

  static async recoverOrphanedStoredItems(actor) {
    if (!actor || !canMutateActor(actor)) return 0;
    const orphanedItems = actorItems(actor).filter((item) => {
      const containerId = this.getStoredIn(item);
      if (!containerId) return false;
      const container = actor.items.get(containerId);
      return !container || !this.isContainer(container) || this.isStored(container);
    });
    if (!orphanedItems.length) return 0;

    await restoreStoredItems(actor, orphanedItems);
    return orphanedItems.length;
  }

  static async synchronizeActorStates(actor, enabled = this.isEnabled()) {
    if (!actor || !canMutateActor(actor)) return 0;

    const updates = [];
    for (const item of actorItems(actor)) {
      if (this.isStored(item)) {
        const targetState = enabled
          ? STORED_ITEM_STATE
          : (item.getFlag?.(FLAG_SCOPE, "preStoredState") || "equipped");
        if (item.system?.state !== targetState) {
          updates.push({ _id: item.id, "system.state": targetState });
        }
      }

      if (this.isContainer(item) && itemQuantity(item) <= 0 && this.getStoredItems(actor, item).length) {
        updates.push({ _id: item.id, "system.number": 1 });
      }
    }

    if (!updates.length) return 0;
    const mergedUpdates = mergeItemUpdates(updates);
    await actor.updateEmbeddedDocuments("Item", mergedUpdates, { render: true });
    return mergedUpdates.length;
  }

  static async withdrawItemPrompt(actor, item) {
    if (!this.isEnabled() || !isValidOwnedActorItem(actor, item) || !this.isStored(item)) return false;
    const container = actor.items.get(this.getStoredIn(item));
    if (!this.isContainer(container) || this.isStored(container)) return false;
    if (!isAccessibleState(container)) {
      warnInaccessibleState("TENEBRE.Containers.CannotWithdrawOther");
      return false;
    }

    const quantity = getStorableQuantity(item);
    if (item.type !== "equipment" || quantity <= 1) {
      return this.withdrawItem(actor, item, quantity);
    }

    const content = `
      <form>
        <p>${game.i18n.format("TENEBRE.Containers.WithdrawPrompt", { item: escapeHtml(item.name) })}</p>
        <div class="form-group">
          <label>${game.i18n.format("TENEBRE.Containers.QuantityWithMax", { max: quantity })}</label>
          <input type="number" name="quantity" value="${quantity}" min="1" max="${quantity}">
        </div>
      </form>
    `;

    const amount = await promptDialog({
      title: game.i18n.localize("TENEBRE.Containers.WithdrawTitle"),
      content,
      okIcon: "fas fa-box-open",
      callback: (element) => Number(element.querySelector('[name="quantity"]')?.value || quantity)
    });

    if (amount === null) return false;
    return this.withdrawItem(actor, item, amount);
  }

  static async withdrawItem(actor, item, quantity = null) {
    if (!this.isEnabled() || !isValidOwnedActorItem(actor, item) || !this.isStored(item)) return false;
    const container = actor.items.get(this.getStoredIn(item));
    if (!this.isContainer(container) || this.isStored(container)) return false;
    if (!isAccessibleState(container)) {
      warnInaccessibleState("TENEBRE.Containers.CannotWithdrawOther");
      return false;
    }

    const currentQuantity = getStorableQuantity(item);
    if (currentQuantity <= 0) return false;
    const amount = Math.max(1, Math.min(currentQuantity, Math.floor(Number(quantity ?? currentQuantity) || currentQuantity)));
    const preStoredState = item.getFlag(FLAG_SCOPE, "preStoredState") || "equipped";
    const mergeTarget = findVisibleStack(actor, item);

    if (item.type === "equipment" && amount < currentQuantity) {
      if (mergeTarget) {
        await actor.updateEmbeddedDocuments("Item", [
          { _id: item.id, "system.number": currentQuantity - amount },
          { _id: mergeTarget.id, "system.number": itemQuantity(mergeTarget) + amount }
        ], { render: true });
      } else {
        const itemData = item.toObject();
        delete itemData._id;
        itemData.system = foundry.utils.deepClone(itemData.system ?? {});
        itemData.system.number = amount;
        itemData.system.state = preStoredState;
        itemData.flags = foundry.utils.deepClone(itemData.flags ?? {});
        delete itemData.flags[FLAG_SCOPE]?.storedIn;
        delete itemData.flags[FLAG_SCOPE]?.storedInName;
        delete itemData.flags[FLAG_SCOPE]?.preStoredState;
        await createSplitStack(actor, item, itemData, currentQuantity - amount);
      }
      return true;
    }

    if (mergeTarget && item.type === "equipment") {
      await mergeAndDeleteStack(actor, item, mergeTarget, itemQuantity(item));
      return true;
    }

    await item.update({
      "system.state": preStoredState,
      [`flags.${FLAG_SCOPE}.-=storedIn`]: null,
      [`flags.${FLAG_SCOPE}.-=storedInName`]: null,
      [`flags.${FLAG_SCOPE}.-=preStoredState`]: null
    });
    return true;
  }
}

function getStorableQuantity(item) {
  return item?.type === "equipment" ? Math.max(0, itemQuantity(item)) : 1;
}

function buildStoreDialogContent({ actor, item, containers, quantity, fixedContainer = false }) {
  const itemName = escapeHtml(item.name);
  const itemIcon = `<img class="tenebre-store-inline-icon" src="${escapeHtml(item.img || "icons/svg/item-bag.svg")}" alt="">`;
  const container = containers[0];
  const containerName = escapeHtml(container?.name ?? "");
  const containerInput = fixedContainer && container
    ? `<input type="hidden" name="containerId" value="${escapeHtml(container.id)}">`
    : buildContainerSelect(actor, containers);
  const quantityInput = quantity > 1
    ? `
      <div class="tenebre-store-field">
        <label>${game.i18n.format("TENEBRE.Containers.QuantityWithMax", { max: quantity })}</label>
        <input type="number" name="quantity" value="${quantity}" min="1" max="${quantity}">
      </div>
    `
    : "";

  return `
    <form class="tenebre-store-form">
      <p class="tenebre-store-prompt">${game.i18n.format(fixedContainer ? "TENEBRE.Containers.StorePrompt" : "TENEBRE.Containers.StorePromptGeneric", { item: itemName, icon: itemIcon, container: containerName })}</p>
      ${containerInput}
      ${quantityInput}
    </form>
  `;
}

function buildContainerSelect(actor, containers) {
  const options = containers.map((container) => {
    const capacityLabel = ContainerService.getContainerCapacityLabel(actor, container);
    return `<option value="${escapeHtml(container.id)}">${escapeHtml(container.name)} (${capacityLabel})</option>`;
  }).join("");

  return `
    <div class="tenebre-store-field">
      <label>${game.i18n.localize("TENEBRE.Containers.ChooseContainer")}</label>
      <select name="containerId">${options}</select>
    </div>
  `;
}

function normalizeCapacityConfig(config) {
  if (config?.mode === "unlimited") return { mode: "unlimited" };
  if (config?.mode !== "slots") return null;

  const value = Math.floor(Number(config.value));
  if (!Number.isFinite(value) || value < 1 || value > 999) return null;
  return { mode: "slots", value };
}

function getDefaultContainerCapacity(container) {
  const name = normalize(container?.name);
  if (hasAlias(name, SMALL_CONTAINER_ALIASES)) return 2;
  if (hasAlias(name, ["mochila", "backpack", "rucksack"]) || hasAlias(name, CAMPING_EQUIPMENT_ALIASES)) {
    return 10;
  }
  return null;
}

function isAccessibleState(item) {
  return ACCESSIBLE_STATES.has(String(item?.system?.state ?? "").toLowerCase());
}

function canMutateActor(actor) {
  return Boolean(actor && (game.user?.isGM || actor.isOwner));
}

function isValidOwnedActorItem(actor, item) {
  if (!canMutateActor(actor) || !item || item.parent?.id !== actor.id) return false;
  return actor.items?.get?.(item.id) === item;
}

function isValidStoreRelationship(actor, item, container) {
  return isValidOwnedActorItem(actor, item)
    && isValidOwnedActorItem(actor, container)
    && item.id !== container.id;
}

function warnInaccessibleState(key) {
  ui.notifications.warn(game.i18n.localize(key));
}

function findVisibleStack(actor, item) {
  if (item.type !== "equipment") return null;
  const restoredState = item.getFlag?.(FLAG_SCOPE, "preStoredState") || "equipped";
  return actorItems(actor).find((candidate) => {
    return candidate.id !== item.id
      && candidate.type === item.type
      && candidate.name === item.name
      && !ContainerService.isStored(candidate)
      && !ContainerService.isContainer(candidate)
      && areStackCompatible(candidate, item, {
        leftState: candidate.system?.state,
        rightState: restoredState
      });
  });
}

function findStoredStack(actor, item, container) {
  if (item.type !== "equipment") return null;
  return actorItems(actor).find((candidate) => {
    const candidateState = candidate.getFlag?.(FLAG_SCOPE, "preStoredState") || "equipped";
    return candidate.id !== item.id
      && candidate.type === item.type
      && candidate.name === item.name
      && ContainerService.getStoredIn(candidate) === container.id
      && !ContainerService.isContainer(candidate)
      && areStackCompatible(candidate, item, {
        leftState: candidateState,
        rightState: item.system?.state
      });
  });
}

function areStackCompatible(left, right, { leftState, rightState } = {}) {
  return stableStringify(stackComparableSource(left, leftState))
    === stableStringify(stackComparableSource(right, rightState));
}

function stackComparableSource(item, stateOverride) {
  const source = foundry.utils.deepClone(item?.toObject?.() ?? {});
  for (const key of ["_id", "sort", "folder", "ownership", "_stats"]) delete source[key];
  if (source.system) {
    delete source.system.number;
    if (stateOverride !== undefined) source.system.state = stateOverride;
  }
  const moduleFlags = source.flags?.[FLAG_SCOPE];
  if (moduleFlags) {
    delete moduleFlags.storedIn;
    delete moduleFlags.storedInName;
    delete moduleFlags.preStoredState;
    if (!Object.keys(moduleFlags).length) delete source.flags[FLAG_SCOPE];
  }
  if (source.flags && !Object.keys(source.flags).length) delete source.flags;
  return source;
}

async function createSplitStack(actor, sourceItem, itemData, remainingQuantity) {
  const created = await actor.createEmbeddedDocuments("Item", [itemData], { render: false });
  try {
    await sourceItem.update({ "system.number": remainingQuantity }, { render: true });
  } catch (error) {
    const createdIds = created.map((item) => item.id).filter(Boolean);
    if (createdIds.length) {
      try {
        await actor.deleteEmbeddedDocuments("Item", createdIds, { render: true });
      } catch (rollbackError) {
        console.error("Tenebre Resources | Failed to roll back a container stack split.", rollbackError);
      }
    }
    throw error;
  }
}

async function mergeAndDeleteStack(actor, sourceItem, targetItem, amount) {
  const targetQuantity = itemQuantity(targetItem);
  await targetItem.update({ "system.number": targetQuantity + amount }, { render: false });
  try {
    await actor.deleteEmbeddedDocuments("Item", [sourceItem.id], { render: true });
  } catch (error) {
    try {
      await targetItem.update({ "system.number": targetQuantity }, { render: true });
    } catch (rollbackError) {
      console.error("Tenebre Resources | Failed to roll back a container stack merge.", rollbackError);
    }
    throw error;
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function itemTransferDeleteKey(item) {
  if (!item?.id || !item?.parent?.uuid) return "";
  return `${item.parent.uuid}:${item.id}`;
}

function createStoredItemData(item, container, quantity, preStoredState) {
  const itemData = item.toObject();
  delete itemData._id;
  itemData.system = foundry.utils.deepClone(itemData.system ?? {});
  itemData.system.number = quantity;
  itemData.system.state = STORED_ITEM_STATE;
  itemData.flags = foundry.utils.deepClone(itemData.flags ?? {});
  itemData.flags[FLAG_SCOPE] = {
    ...(itemData.flags[FLAG_SCOPE] ?? {}),
    storedIn: container.id,
    storedInName: container.name,
    preStoredState
  };
  return itemData;
}

async function restoreStoredItems(actor, items) {
  const updates = items.map((item) => {
    const preStoredState = item.getFlag(FLAG_SCOPE, "preStoredState") || "equipped";
    return {
      _id: item.id,
      "system.state": preStoredState,
      [`flags.${FLAG_SCOPE}.-=storedIn`]: null,
      [`flags.${FLAG_SCOPE}.-=storedInName`]: null,
      [`flags.${FLAG_SCOPE}.-=preStoredState`]: null
    };
  });

  await actor.updateEmbeddedDocuments("Item", updates, { render: true });
}

async function seedContainerContents(actor, container) {
  if (!isCampingEquipment(container)) return;
  if (container.getFlag?.(FLAG_SCOPE, CAMPING_CONTENTS_SEEDED_FLAG)) return;
  if (ContainerService.getStoredItems(actor, container).length > 0) {
    await container.setFlag(FLAG_SCOPE, CAMPING_CONTENTS_SEEDED_FLAG, true);
    return;
  }

  const contentRefs = extractCampingContentRefs(container);
  if (!contentRefs.length) return;

  const itemData = [];
  for (const ref of contentRefs) {
    const document = await findReferencedItem(ref);
    itemData.push(createSeededStoredItemData(document, ref, container));
  }

  if (!itemData.length) return;
  await actor.createEmbeddedDocuments("Item", itemData, { render: true });
  await container.setFlag(FLAG_SCOPE, CAMPING_CONTENTS_SEEDED_FLAG, true);
}

function isCampingEquipment(item) {
  return hasAlias(normalize(item?.name), CAMPING_EQUIPMENT_ALIASES);
}

function extractCampingContentRefs(container) {
  const description = String(container?.system?.description ?? "");
  const refs = [];
  const seen = new Set();

  for (const match of description.matchAll(/@UUID\[([^\]]+)\]\{([^}]+)\}/g)) {
    addContentRef(refs, seen, { uuid: match[1], name: match[2] });
  }

  for (const match of description.matchAll(/data-uuid=["']([^"']+)["'][^>]*>(.*?)<\/a>/gims)) {
    addContentRef(refs, seen, { uuid: match[1], name: stripHtml(match[2]) });
  }

  if (!refs.length) {
    for (const name of DEFAULT_CAMPING_CONTENTS) addContentRef(refs, seen, { name });
  }

  return refs;
}

function addContentRef(refs, seen, ref) {
  const name = String(ref.name ?? "").trim();
  if (!name) return;
  const normalizedName = normalize(name);
  if (!DEFAULT_CAMPING_CONTENTS.some((itemName) => normalize(itemName) === normalizedName)) return;
  if (seen.has(normalizedName)) return;
  seen.add(normalizedName);
  refs.push({ ...ref, name });
}

async function findReferencedItem(ref) {
  if (ref.uuid && typeof fromUuid === "function") {
    const document = await fromUuid(ref.uuid);
    if (document?.documentName === "Item") return document;
  }

  const normalizedName = normalize(ref.name);
  return game.items?.find?.((item) => normalize(item.name) === normalizedName) ?? null;
}

function createSeededStoredItemData(document, ref, container) {
  const itemData = document?.toObject?.() ?? {
    name: ref.name,
    type: "equipment",
    img: "icons/svg/item-bag.svg",
    system: {
      number: 1,
      state: "equipped",
      description: ""
    }
  };

  delete itemData._id;
  itemData.system = foundry.utils.deepClone(itemData.system ?? {});
  itemData.system.number = 1;
  const preStoredState = itemData.system.state ?? "equipped";
  itemData.system.state = STORED_ITEM_STATE;
  itemData.flags = foundry.utils.deepClone(itemData.flags ?? {});
  itemData.flags[FLAG_SCOPE] = {
    ...(itemData.flags[FLAG_SCOPE] ?? {}),
    storedIn: container.id,
    storedInName: container.name,
    preStoredState
  };
  return itemData;
}

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function hasAlias(normalizedName, aliases) {
  const searchableName = toSearchableText(normalizedName).trim();
  return aliases.some((alias) => {
    const searchableAlias = toSearchableText(alias).trim();
    return Boolean(searchableAlias) && searchableName === searchableAlias;
  });
}

function toSearchableText(value) {
  return ` ${normalize(value).replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ")} `;
}

function containerExpansionKey(actor, container) {
  return `${actor.uuid ?? actor.id}:${container.id}`;
}

function getContainerExpansionState() {
  const expanded = new Set();
  try {
    const stored = game.settings.get(MODULE_ID, CONTAINER_EXPANSION_SETTING);
    for (const [key, value] of Object.entries(stored ?? {})) {
      if (value === true) expanded.add(key);
    }
  } catch {
    // Client storage is optional; the session override below remains functional.
  }

  for (const [key, value] of sessionExpansionState) {
    if (value) expanded.add(key);
    else expanded.delete(key);
  }
  return expanded;
}

async function setContainerExpanded(actor, container, expanded) {
  if (!actor || !container) return false;
  const key = containerExpansionKey(actor, container);
  sessionExpansionState.set(key, Boolean(expanded));

  try {
    const current = game.settings.get(MODULE_ID, CONTAINER_EXPANSION_SETTING) ?? {};
    const next = { ...current };
    if (expanded) next[key] = true;
    else delete next[key];
    await game.settings.set(MODULE_ID, CONTAINER_EXPANSION_SETTING, next);
  } catch {
    // Session state remains functional if client settings are unavailable.
  }
  return true;
}

function mergeItemUpdates(updates) {
  const merged = new Map();
  for (const update of updates) {
    merged.set(update._id, { ...(merged.get(update._id) ?? {}), ...update });
  }
  return [...merged.values()];
}

function rerenderActorSheets(actor) {
  if (!actor || !globalThis.ui?.windows) return;
  for (const app of Object.values(ui.windows)) {
    const sheetActor = app.actor ?? app.document;
    if (sheetActor?.id === actor.id && typeof app.render === "function") {
      app.render(false);
    }
  }
}
