import { FLAG_SCOPE, MODULE_ID } from "./constants.mjs";
import { ContainerService } from "./containers.mjs";

const GROUND_CONTAINER_FLAG = "groundContainer";
const GROUND_CONTAINER_STATE = "other";
const GROUND_CONTAINER_VERSION = 1;
const TRANSFER_DELETE_FLAG = "containerTransferDelete";
const ITEM_PILES_SYMBAROUM_ID = "item-piles-symbaroum";
const ITEM_PILES_GENERIC_ID = "item-piles";
const ITEM_PILES_PRE_TRANSFER_HOOK = `${ITEM_PILES_SYMBAROUM_ID}-preTransferItems`;
const CONTAINER_TRANSFER_INTERACTION_PREFIX = `${MODULE_ID}:container:`;

const registeredTransferHooks = new Set();
const providerWarnings = new Set();
const pendingGroundTargets = new Map();

export class ContainerTransferService {
  static registerHooks() {
    const provider = getItemPilesProvider({ requireApi: false });
    if (provider.status !== "compatible") return false;

    const hookName = provider.hookName;
    if (!hookName || typeof globalThis.Hooks?.on !== "function") return false;
    if (registeredTransferHooks.has(hookName)) return true;

    globalThis.Hooks.on(hookName, (sourceActor, sourceUpdates, targetActor, targetUpdates, interactionId) => {
      return this.handleItemPilePreTransfer(sourceActor, sourceUpdates, targetActor, targetUpdates, interactionId);
    });
    registeredTransferHooks.add(hookName);
    return true;
  }

  static async handleActorItemDrop(targetActor, droppedItem) {
    const resolvedItem = droppedItem?.parent ? droppedItem : await resolveUuid(droppedItem?.uuid);
    const sourceActor = resolvedItem?.parent;
    if (!sourceActor?.items || !targetActor?.items || !ContainerService.isContainer(resolvedItem)) {
      return { handled: false, result: undefined };
    }

    if (sourceActor.uuid === targetActor.uuid) {
      return { handled: true, result: false };
    }
    if (ContainerService.isStored(resolvedItem)) {
      return { handled: true, result: false };
    }
    if (!isTransferableContainerRoot(resolvedItem)) {
      notifyInaccessibleGroundDrop();
      return { handled: true, result: false };
    }

    if (isGroundContainerRoot(resolvedItem)) {
      if (!canReceiveTransferredContainer(targetActor)) {
        return { handled: true, result: false };
      }

      const provider = getItemPilesProvider();
      if (provider.status === "compatible" && typeof provider.api?.transferItems === "function") {
        if (!this.registerHooks()) return { handled: true, result: false };
        return {
          handled: true,
          result: await transferContainerWithItemPiles(provider.api, sourceActor, targetActor, resolvedItem)
        };
      }
    }

    if (!canTransferActors(sourceActor, targetActor)) {
      return { handled: true, result: false };
    }

    return {
      handled: true,
      result: await this.transferBetweenActors(sourceActor, targetActor, resolvedItem)
    };
  }

  static async transferBetweenActors(sourceActor, targetActor, rootContainer, { targetGroundReference = null } = {}) {
    if (!isTopLevelContainer(rootContainer) || !isTransferableContainerRoot(rootContainer)
      || !canTransferActors(sourceActor, targetActor)) return false;

    const tree = collectContainerTree(sourceActor, rootContainer);
    const created = [];
    const idMap = new Map();

    try {
      for (const item of tree) {
        const data = buildTransferredItemData(item, idMap, item.id === rootContainer.id);
        const parentId = getStoredIn(item);
        if (parentId && !idMap.has(parentId)) throw new Error(`Missing parent mapping for item ${item.id}`);

        const [createdItem] = await targetActor.createEmbeddedDocuments("Item", [data], { render: false });
        if (!createdItem?.id) throw new Error(`Target actor did not create item ${item.name}`);
        idMap.set(item.id, createdItem.id);
        created.push(createdItem);
      }

      const targetRoot = created[0];
      if (targetGroundReference) {
        await targetRoot.update({
          "system.state": GROUND_CONTAINER_STATE,
          [`flags.${FLAG_SCOPE}.${GROUND_CONTAINER_FLAG}`]: {
            ...targetGroundReference,
            containerId: targetRoot.id,
            previousState: rootPreviousState(rootContainer)
          }
        }, { render: false });
      }

      for (const item of tree) {
        if (ContainerService.isContainer(item)) ContainerService.allowDeleteWithTransferredContents(item);
      }
      await sourceActor.deleteEmbeddedDocuments("Item", tree.map((item) => item.id), {
        render: false,
        [MODULE_ID]: { preserveContents: true }
      });
    } catch (error) {
      await deleteCreatedItems(targetActor, created);
      throw error;
    }

    rerenderActor(targetActor);
    rerenderActor(sourceActor);
    return true;
  }

  static handleItemPilePreTransfer(sourceActor, sourceUpdates, targetActor, targetUpdates, interactionId = null) {
    // Item Piles has already authorized the transfer before this public hook.
    // Do not require targetActor.isOwner here: a player may transfer to a pile
    // whose actor is intentionally controlled by the GM.
    if (!sourceActor || !targetActor) return false;

    const deletedIds = new Set(normalizeUpdateIds(sourceUpdates?.itemsToDelete));
    const changedIds = new Set((sourceUpdates?.itemDeltas ?? [])
      .map((delta) => delta?.item?._id ?? delta?.item?.id)
      .filter(Boolean));
    const movedIds = new Set([...deletedIds, ...changedIds]);
    const sourceItems = Array.from(sourceActor?.items?.values?.() ?? sourceActor?.items ?? []);

    // Item Piles transfers quantities, while a container transfer must move its
    // complete hierarchy. Reject partial containers and stored children instead
    // of risking duplicated or orphaned contents.
    const roots = findTransferredContainerRoots(sourceActor, sourceUpdates);
    if (!roots.length) {
      const movedStoredItems = sourceItems.filter((item) => movedIds.has(item.id) && ContainerService.isStored(item));
      return movedStoredItems.length === 0;
    }

    if (roots.some((root) => !isTransferableContainerRoot(root))) return false;

    if (roots.some((root) => !deletedIds.has(root.id))) return false;

    const affectedContainerIds = new Set(roots.map((root) => root.id));
    const changedRoots = new Set([...deletedIds, ...changedIds]
      .filter((id) => affectedContainerIds.has(id)));
    if (changedRoots.size !== roots.length) return false;

    const targetCreates = targetUpdates?.itemsToCreate;
    if (!Array.isArray(targetCreates) || !Array.isArray(sourceUpdates?.itemsToDelete)) return false;

    const trees = roots.map((root) => ({ root, tree: collectContainerTree(sourceActor, root) }));
    const treeIds = new Set(trees.flatMap(({ tree }) => tree.map((item) => item.id)));
    if ([...treeIds].some((id) => !deletedIds.has(id))) return false;
    if (sourceItems.some((item) => movedIds.has(item.id) && ContainerService.isStored(item) && !treeIds.has(item.id))) {
      return false;
    }

    const targetEntries = new Map();
    const usedTargetIndexes = new Set();
    for (let index = 0; index < targetCreates.length; index += 1) {
      const data = targetCreates[index];
      const authorization = getTransferDeleteAuthorization(data);
      if (!authorization?.sourceItemId) continue;
      if (interactionId && authorization.id !== interactionId) continue;
      if (!treeIds.has(authorization.sourceItemId) || targetEntries.has(authorization.sourceItemId)) return false;
      targetEntries.set(authorization.sourceItemId, { index, data });
      usedTargetIndexes.add(index);
    }

    // Older Item Piles builds may preserve the source id but omit unknown flags
    // while preparing the transaction. Keep that public-data fallback without
    // correlating items only by name.
    for (const sourceId of treeIds) {
      if (targetEntries.has(sourceId)) continue;
      const index = targetCreates.findIndex((data, candidateIndex) => (
        !usedTargetIndexes.has(candidateIndex) && data?._id === sourceId
      ));
      if (index < 0) continue;
      targetEntries.set(sourceId, { index, data: targetCreates[index] });
      usedTargetIndexes.add(index);
    }

    // Item Piles executes transfers through its GM socket. A player who owns
    // the destination sheet does not necessarily own the temporary pile Actor,
    // so source authorization flags cannot always be persisted beforehand.
    // For transfers initiated by this service, correlate the provider's ordered
    // source deltas with its ordered create payload instead. This preserves the
    // complete hierarchy even when Item Piles assigns fresh target IDs.
    if ([...treeIds].some((sourceId) => !targetEntries.has(sourceId))) {
      if (!isContainerTransferInteraction(interactionId)) return false;
      const orderedSourceIds = orderedDeltaSourceIds(sourceUpdates);
      if (orderedSourceIds.length !== targetCreates.length) return false;
      for (let index = 0; index < orderedSourceIds.length; index += 1) {
        const sourceId = orderedSourceIds[index];
        if (!treeIds.has(sourceId)) return false;
        if (targetEntries.has(sourceId)) continue;
        if (usedTargetIndexes.has(index) || !targetCreates[index]?._id) return false;
        targetEntries.set(sourceId, { index, data: targetCreates[index] });
        usedTargetIndexes.add(index);
      }
    }

    if ([...treeIds].some((sourceId) => !targetEntries.has(sourceId))) return false;

    const replacements = [];
    for (const { root, tree } of trees) {
      const rootEntry = targetEntries.get(root.id);
      if (!rootEntry?.data?._id) return false;
      replacements.push({ root, tree, rootEntry });
    }

    for (const { root, tree } of replacements) {
      const idMap = new Map(tree.map((item) => [item.id, targetEntries.get(item.id).data._id]));
      for (const item of tree) {
        const entry = targetEntries.get(item.id);
        const data = buildTransferredItemData(item, idMap, item.id === root.id, entry.data._id);
        if (item.id === root.id) {
          const groundTarget = pendingGroundTargets.get(targetActor?.uuid);
          if (groundTarget) {
            data.system.state = GROUND_CONTAINER_STATE;
            data.flags ??= {};
            data.flags[FLAG_SCOPE] ??= {};
            data.flags[FLAG_SCOPE][GROUND_CONTAINER_FLAG] = {
              ...groundTarget,
              actorId: targetActor.id,
              actorUuid: targetActor.uuid,
              containerId: entry.data._id,
              previousState: rootPreviousState(root)
            };
          }
        }
        targetCreates[entry.index] = data;
      }

      for (const item of tree) {
        if (ContainerService.isContainer(item)) ContainerService.allowDeleteWithTransferredContents(item);
      }
    }

    return true;
  }

  static async dropToItemPile(canvas, data) {
    const provider = getItemPilesProvider();
    if (provider.status === "absent") return { handled: false, success: false };
    if (provider.status !== "compatible") {
      notifyProviderIssue(provider.status);
      return { handled: true, success: false };
    }

    const api = provider.api;
    if (typeof api?.transferItems !== "function" || !canvas?.scene
      || !hasCanvasCoordinate(data?.x) || !hasCanvasCoordinate(data?.y)) {
      return { handled: false, success: false };
    }

    // Item Piles initializes after Foundry's ready hook. Register again at the
    // operation boundary so a container is never transferred without its tree.
    if (!this.registerHooks()) return { handled: true, success: false };

    const actor = resolveActor(data);
    const container = actor?.items?.get?.(data.itemId);
    if (!actor || !container || !isTopLevelContainer(container) || !canTransferActors(actor, actor)) {
      return { handled: false, success: false };
    }
    if (!ContainerService.isAccessible(container)) {
      notifyInaccessibleGroundDrop();
      return { handled: true, success: false };
    }

    const targetToken = findItemPileAt(canvas, Number(data.x), Number(data.y), api);
    if (targetToken && targetToken.actor?.uuid !== actor.uuid) {
      const success = await transferContainerWithItemPiles(api, actor, targetToken.actor ?? targetToken, container);
      return { handled: true, success };
    }
    if (targetToken) return { handled: true, success: false };

    if (typeof api.createItemPile !== "function") {
      return { handled: false, success: false };
    }

    const containerImage = container.img || "icons/svg/item-bag.svg";
    const containerPileType = globalThis.game?.itempiles?.CONSTANTS?.PILE_TYPES?.CONTAINER ?? "container";
    const created = await api.createItemPile({
      position: { x: Number(data.x), y: Number(data.y) },
      sceneId: canvas.scene.id,
      createActor: true,
      actorOverrides: { name: container.name, type: "monster" },
      itemPileFlags: {
        type: containerPileType,
        deleteWhenEmpty: true,
        closed: false,
        locked: false,
        closedImage: containerImage,
        openedImage: containerImage,
        emptyImage: containerImage,
        lockedImage: containerImage
      },
      tokenOverrides: {
        name: container.name,
        texture: { src: containerImage }
      },
      items: false
    });
    const pile = await resolveCreatedPile(created, canvas.scene, Number(data.x), Number(data.y), container.name, api);
    if (!pile?.token || !pile.actor) {
      await deleteCreatedPile(api, created, pile?.token);
      return { handled: true, success: false };
    }

    pendingGroundTargets.set(pile.actor.uuid, {
      version: GROUND_CONTAINER_VERSION,
      tokenId: pile.token.id,
      sceneId: canvas.scene.id,
      actorId: pile.actor.id,
      actorUuid: pile.actor.uuid
    });
    try {
      const success = await transferContainerWithItemPiles(api, actor, pile.actor, container);
      if (!success) {
        await deleteCreatedPile(api, created, pile.token);
        return { handled: true, success: false };
      }
      return { handled: true, success: true };
    } finally {
      pendingGroundTargets.delete(pile.actor.uuid);
    }
  }
}

export function collectContainerTree(actor, rootContainer) {
  const items = Array.from(actor?.items?.values?.() ?? actor?.items ?? []);
  const tree = [];
  const visited = new Set();
  const walk = (item) => {
    if (!item?.id || visited.has(item.id)) throw new Error("Container hierarchy contains a cycle or duplicate item id");
    visited.add(item.id);
    tree.push(item);
    for (const child of items) {
      if (getStoredIn(child) === item.id) walk(child);
    }
  };
  walk(rootContainer);
  return tree;
}

function findTransferredContainerRoots(sourceActor, sourceUpdates) {
  const deleted = new Set(normalizeUpdateIds(sourceUpdates?.itemsToDelete));
  const changed = new Set((sourceUpdates?.itemDeltas ?? [])
    .map((delta) => delta?.item?._id ?? delta?.item?.id)
    .filter(Boolean));
  return Array.from(sourceActor?.items?.values?.() ?? sourceActor?.items ?? [])
    .filter((item) => ContainerService.isContainer(item) && !ContainerService.isStored(item))
    .filter((item) => deleted.has(item.id) || changed.has(item.id));
}

function normalizeUpdateIds(updates) {
  return (Array.isArray(updates) ? updates : [])
    .map((entry) => typeof entry === "string" ? entry : entry?._id ?? entry?.id)
    .filter(Boolean);
}

function buildTransferredItemData(item, idMap, isRoot, forcedId = null) {
  const data = clone(item.toObject?.() ?? item);
  data._id = forcedId ?? newItemId();
  data.flags ??= {};
  data.flags[FLAG_SCOPE] = clone(data.flags[FLAG_SCOPE] ?? {});
  delete data.flags[FLAG_SCOPE][TRANSFER_DELETE_FLAG];
  if (isRoot) {
    delete data.flags[FLAG_SCOPE].storedIn;
    delete data.flags[FLAG_SCOPE].storedInName;
    delete data.flags[FLAG_SCOPE].preStoredState;
    delete data.flags[FLAG_SCOPE][GROUND_CONTAINER_FLAG];
    data.system ??= {};
    data.system.state = rootPreviousState(item);
  } else {
    const parentId = getStoredIn(item);
    data.flags[FLAG_SCOPE].storedIn = idMap.get(parentId);
    data.flags[FLAG_SCOPE].storedInName = item.parent?.items?.get?.(parentId)?.name ?? "";
  }
  return data;
}

function getTransferDeleteAuthorization(itemData) {
  return itemData?.flags?.[FLAG_SCOPE]?.[TRANSFER_DELETE_FLAG] ?? null;
}

function findItemPileAt(canvas, x, y, api) {
  return Array.from(canvas.tokens?.placeables ?? canvas.tokens ?? [])
    .map((token) => token?.document ?? token)
    .find((token) => {
      if (!api.isValidItemPile?.(token)) return false;
      const width = Number(token.width ?? 1) * Number(canvas.grid?.size ?? 100);
      const height = Number(token.height ?? 1) * Number(canvas.grid?.size ?? 100);
      return x >= Number(token.x) && x <= Number(token.x) + width
        && y >= Number(token.y) && y <= Number(token.y) + height;
    }) ?? null;
}

async function resolveCreatedPile(result, scene, x, y, name, api) {
  const uuids = typeof result === "string" ? [result] : [result?.tokenUuid, result?.actorUuid].filter(Boolean);
  let token = null;
  let actor = null;
  for (const uuid of uuids) {
    const document = await resolveUuid(uuid);
    if (document?.documentName === "Token") token = document;
    if (document?.documentName === "Actor") actor = document;
  }
  token ??= Array.from(scene.tokens ?? []).find((candidate) => {
    const dx = Math.abs(Number(candidate.x) - x);
    const dy = Math.abs(Number(candidate.y) - y);
    return dx < 1 && dy < 1 && (candidate.name === name || api.isValidItemPile?.(candidate));
  }) ?? null;
  actor ??= token?.actor ?? (uuids.length ? await resolveUuid(result?.actorUuid) : null);
  return { token, actor };
}

async function deleteCreatedPile(api, result, token) {
  const target = token ?? (typeof result === "string" ? await resolveUuid(result) : null);
  if (target && api.deleteItemPile) await api.deleteItemPile(target).catch(() => {});
}

async function transferContainerWithItemPiles(api, sourceActor, target, rootContainer) {
  const tree = collectContainerTree(sourceActor, rootContainer);
  const transferId = `${CONTAINER_TRANSFER_INTERACTION_PREFIX}${newItemId()}`;
  await ContainerService.authorizeTransferredDeletes(sourceActor, tree, transferId);

  try {
    const result = await api.transferItems(sourceActor, target, tree.map((item) => item.id), { interactionId: transferId });
    if (result === false) {
      await ContainerService.revokeTransferredDeletes(sourceActor, tree, transferId);
      return false;
    }

    const remaining = tree.filter((item) => sourceActor.items?.get?.(item.id));
    if (remaining.length) {
      for (const item of remaining) {
        if (ContainerService.isContainer(item)) ContainerService.allowDeleteWithTransferredContents(item);
      }
      await sourceActor.deleteEmbeddedDocuments("Item", remaining.map((item) => item.id), {
        render: false,
        [MODULE_ID]: { preserveContents: true }
      });
    }

    const stillPresent = tree.some((item) => sourceActor.items?.get?.(item.id));
    if (stillPresent) {
      await ContainerService.revokeTransferredDeletes(sourceActor, tree, transferId);
      return false;
    }
    rerenderActor(sourceActor);
    return true;
  } catch (error) {
    await ContainerService.revokeTransferredDeletes(sourceActor, tree, transferId).catch(() => {});
    throw error;
  }
}

function orderedDeltaSourceIds(sourceUpdates) {
  return (Array.isArray(sourceUpdates?.itemDeltas) ? sourceUpdates.itemDeltas : [])
    .map((delta) => delta?.item?._id ?? delta?.item?.id)
    .filter(Boolean);
}

function isContainerTransferInteraction(interactionId) {
  return typeof interactionId === "string"
    && interactionId.startsWith(CONTAINER_TRANSFER_INTERACTION_PREFIX)
    && interactionId.length > CONTAINER_TRANSFER_INTERACTION_PREFIX.length;
}

function getItemPilesProvider({ requireApi = true } = {}) {
  const symbaroumActive = isModuleActive(ITEM_PILES_SYMBAROUM_ID);
  const genericActive = isModuleActive(ITEM_PILES_GENERIC_ID);
  if (symbaroumActive && genericActive) return { status: "conflict", api: null, hookName: null };
  if (genericActive) return { status: "generic", api: null, hookName: null };
  if (!symbaroumActive) return { status: "absent", api: null, hookName: null };

  const itemPiles = globalThis.game?.itempiles;
  const providerId = itemPiles?.CONSTANTS?.MODULE_NAME;
  const hookName = itemPiles?.CONSTANTS?.HOOKS?.ITEM?.PRE_TRANSFER ?? ITEM_PILES_PRE_TRANSFER_HOOK;
  if (requireApi && (providerId !== ITEM_PILES_SYMBAROUM_ID || !itemPiles?.API)) {
    return { status: "unavailable", api: null, hookName };
  }
  return {
    status: "compatible",
    api: providerId === ITEM_PILES_SYMBAROUM_ID ? itemPiles?.API ?? null : null,
    hookName
  };
}

function isModuleActive(id) {
  return Boolean(globalThis.game?.modules?.get?.(id)?.active);
}

function notifyProviderIssue(status) {
  const key = status === "conflict"
    ? "TENEBRE.Containers.ItemPilesConflict"
    : status === "generic"
      ? "TENEBRE.Containers.ItemPilesSymbaroumRequired"
      : "TENEBRE.Containers.ItemPilesUnavailable";
  if (providerWarnings.has(key)) return;
  providerWarnings.add(key);
  const message = globalThis.game?.i18n?.localize?.(key) ?? key;
  globalThis.ui?.notifications?.warn?.(message);
  console.warn(`${MODULE_ID} | ${message}`);
}

function notifyInaccessibleGroundDrop() {
  const key = "TENEBRE.Containers.GroundDropOther";
  const message = globalThis.game?.i18n?.localize?.(key) ?? key;
  globalThis.ui?.notifications?.warn?.(message);
}

function canTransferActors(sourceActor, targetActor) {
  if (!globalThis.game?.user || globalThis.game.user.isGM) return true;
  return Boolean(sourceActor?.isOwner && targetActor?.isOwner);
}

function canReceiveTransferredContainer(targetActor) {
  if (!globalThis.game?.user || globalThis.game.user.isGM) return true;
  return Boolean(targetActor?.isOwner);
}

function isTopLevelContainer(item) {
  return ContainerService.isContainer(item) && !ContainerService.isStored(item);
}

function isTransferableContainerRoot(item) {
  return ContainerService.isAccessible(item) || isGroundContainerRoot(item);
}

function isGroundContainerRoot(item) {
  const reference = item?.getFlag?.(FLAG_SCOPE, GROUND_CONTAINER_FLAG)
    ?? item?.flags?.[FLAG_SCOPE]?.[GROUND_CONTAINER_FLAG];
  return Boolean(
    reference?.version === GROUND_CONTAINER_VERSION
    && reference.tokenId
    && reference.sceneId
    && reference.containerId === item?.id
    && reference.actorUuid === item?.parent?.uuid
    && reference.actorId === item?.parent?.id
  );
}

function getStoredIn(item) {
  return item?.getFlag?.(FLAG_SCOPE, "storedIn") ?? item?.flags?.[FLAG_SCOPE]?.storedIn ?? "";
}

function rootPreviousState(item) {
  return item?.getFlag?.(FLAG_SCOPE, GROUND_CONTAINER_FLAG)?.previousState
    ?? item?.flags?.[FLAG_SCOPE]?.[GROUND_CONTAINER_FLAG]?.previousState
    ?? item?.system?.state
    ?? "equipped";
}

function newItemId() {
  return globalThis.foundry?.utils?.randomID?.() ?? globalThis.randomID?.()
    ?? globalThis.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 16);
}

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return globalThis.foundry.utils.deepClone(value);
  return structuredClone(value);
}

async function resolveUuid(uuid) {
  if (!uuid) return null;
  if (typeof globalThis.fromUuid === "function") return globalThis.fromUuid(uuid);
  return globalThis.foundry?.utils?.fromUuid?.(uuid) ?? null;
}

async function deleteCreatedItems(actor, items) {
  const ids = items.map((item) => item.id).filter(Boolean).reverse();
  if (!ids.length) return;
  await actor.deleteEmbeddedDocuments("Item", ids, {
    render: false,
    [MODULE_ID]: { preserveContents: true }
  }).catch(() => {});
}

function rerenderActor(actor) {
  for (const app of Object.values(globalThis.ui?.windows ?? {})) {
    const document = app.actor ?? app.document;
    if (document?.uuid === actor?.uuid && typeof app.render === "function") app.render(false);
  }
}

function resolveActor(reference) {
  const actors = Array.from(globalThis.game?.actors ?? []);
  return actors.find((actor) => actor.uuid === reference?.actorUuid)
    ?? globalThis.game?.actors?.get?.(reference?.actorId)
    ?? null;
}

function hasCanvasCoordinate(value) {
  return typeof value === "number" ? Number.isFinite(value)
    : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value));
}

export const containerTransferConstants = Object.freeze({
  groundFlag: GROUND_CONTAINER_FLAG,
  groundState: GROUND_CONTAINER_STATE,
  groundVersion: GROUND_CONTAINER_VERSION,
  preTransferHook: ITEM_PILES_PRE_TRANSFER_HOOK,
  itemPilesSymbaroumId: ITEM_PILES_SYMBAROUM_ID,
  genericItemPilesId: ITEM_PILES_GENERIC_ID
});
