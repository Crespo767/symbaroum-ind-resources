import { FLAG_SCOPE, MODULE_ID } from "./constants.mjs";
import { ContainerService } from "./containers.mjs";
import { ContainerTransferService } from "./container-transfer.mjs";

const GROUND_CONTAINER_FLAG = "groundContainer";
const GROUND_CONTAINER_DRAG_TYPE = `${MODULE_ID}.ground-container`;
const GROUND_CONTAINER_STATE = "other";
const GROUND_CONTAINER_VERSION = 1;
let hooksRegistered = false;
const pendingDrops = new Set();
const pendingRestores = new Set();
const pendingPickups = new Set();

export class GroundContainerService {
  static registerHooks() {
    if (hooksRegistered) return;
    hooksRegistered = true;

    Hooks.on("dropCanvasData", (canvas, data) => {
      if (!this.isGroundContainerDragData(data)) return;
      void this.dropToCanvas(canvas, data).catch((error) => {
        console.warn(`${MODULE_ID} | Failed to place a container on the canvas.`, error);
        notifyGroundContainer("TENEBRE.Containers.GroundDropFailed");
      });
    });

    Hooks.on("renderTokenHUD", (hud, html, token) => {
      this.addPickupButton(hud, html, token);
      this.addTransferDragControl(hud, html, token);
    });

    Hooks.on("deleteToken", (token) => {
      if (!this.getGroundReference(token)) return;
      void this.restoreFromToken(token).catch((error) => {
        console.warn(`${MODULE_ID} | Failed to restore a ground container.`, error);
        notifyGroundContainer("TENEBRE.Containers.GroundRestoreFailed");
      });
    });

    Hooks.on("deleteItem", (item) => {
      const reference = this.getItemGroundReference(item);
      if (!reference) return;
      void this.removeTokenForDeletedItem(reference).catch((error) => {
        console.warn(`${MODULE_ID} | Failed to remove a ground container token after item deletion.`, error);
      });
    });
  }

  static buildDragData(actor, container) {
    return {
      type: GROUND_CONTAINER_DRAG_TYPE,
      source: "container",
      actorId: actor?.id ?? "",
      actorUuid: actor?.uuid ?? "",
      itemId: container?.id ?? ""
    };
  }

  static isGroundContainerDragData(data) {
    return Boolean(
      data?.type === GROUND_CONTAINER_DRAG_TYPE
      && data.source === "container"
      && typeof data.actorUuid === "string"
      && data.actorUuid.length > 0
      && typeof data.itemId === "string"
      && data.itemId.length > 0
      && hasCanvasCoordinate(data.x)
      && hasCanvasCoordinate(data.y)
    );
  }

  static buildGroundTokenData({ actor, container, scene, x, y, previousState }) {
    const reference = {
      version: GROUND_CONTAINER_VERSION,
      actorId: actor.id,
      actorUuid: actor.uuid,
      containerId: container.id,
      previousState,
      sceneId: scene.id
    };

    return {
      name: container.name,
      actorId: actor.id,
      actorLink: false,
      x: Number(x),
      y: Number(y),
      width: 1,
      height: 1,
      texture: { src: container.img || "icons/svg/item-bag.svg" },
      flags: {
        [MODULE_ID]: {
          [GROUND_CONTAINER_FLAG]: reference
        }
      }
    };
  }

  static getGroundReference(token) {
    const reference = token?.getFlag?.(MODULE_ID, GROUND_CONTAINER_FLAG)
      ?? token?.flags?.[MODULE_ID]?.[GROUND_CONTAINER_FLAG];
    if (!reference || reference.version !== GROUND_CONTAINER_VERSION) return null;
    if (typeof reference.actorUuid !== "string" || !reference.actorUuid) return null;
    if (typeof reference.containerId !== "string" || !reference.containerId) return null;
    return reference;
  }

  static getItemGroundReference(item) {
    const reference = item?.getFlag?.(FLAG_SCOPE, GROUND_CONTAINER_FLAG)
      ?? item?.flags?.[FLAG_SCOPE]?.[GROUND_CONTAINER_FLAG];
    if (!reference || reference.version !== GROUND_CONTAINER_VERSION) return null;
    if (typeof reference.tokenId !== "string" || !reference.tokenId) return null;
    return reference;
  }

  static hasGroundToken(item) {
    return Boolean(this.getItemGroundReference(item));
  }

  static buildItemDragData(item) {
    return {
      type: "Item",
      uuid: item?.uuid ?? ""
    };
  }

  static findGroundContainerForToken(tokenDocument) {
    if (!tokenDocument?.id) return null;

    const tokenReference = this.getGroundReference(tokenDocument);
    if (tokenReference) {
      const actor = resolveActor(tokenReference);
      const item = actor?.items?.get?.(tokenReference.containerId);
      if (item && ContainerService.isContainer(item)) {
        return { actor, item, reference: tokenReference, fallback: true };
      }
    }

    const actor = tokenDocument.actor;
    const sceneId = tokenDocument.parent?.id ?? tokenDocument.scene?.id ?? "";
    const item = Array.from(actor?.items ?? []).find((candidate) => {
      const reference = this.getItemGroundReference(candidate);
      return reference?.tokenId === tokenDocument.id
        && reference.sceneId === sceneId
        && reference.containerId === candidate.id
        && reference.actorUuid === actor?.uuid;
    });
    if (!item || !ContainerService.isContainer(item)) return null;
    return { actor, item, reference: this.getItemGroundReference(item), fallback: false };
  }

  static addPickupButton(hud, html, token) {
    const tokenDocument = token?.document ?? hud?.object?.document ?? hud?.object;
    const reference = this.getGroundReference(tokenDocument);
    if (!reference) return;

    const actor = resolveActor(reference);
    const scene = tokenDocument?.parent ?? hud?.object?.parent;
    if (actor?.type !== "player" || !this.canMutateGroundContainer(actor, scene)) return;

    const column = getHtmlRoot(html)?.querySelector?.(".col.right, div.right");
    if (!column || column.querySelector("[data-tenebre-ground-pickup]")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "control-icon tenebre-ground-container-pickup";
    button.dataset.tenebreGroundPickup = "true";
    button.title = game.i18n.localize("TENEBRE.Containers.GroundPickup");
    button.setAttribute("aria-label", button.title);
    button.innerHTML = '<i class="fa-solid fa-box-open"></i>';
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.pickupToken(tokenDocument).catch((error) => {
        console.warn(`${MODULE_ID} | Failed to pick up a ground container.`, error);
        notifyGroundContainer("TENEBRE.Containers.GroundPickupFailed");
      });
    });
    column.append(button);
  }

  static addTransferDragControl(hud, html, token) {
    const tokenDocument = token?.document ?? hud?.object?.document ?? hud?.object;
    const context = this.findGroundContainerForToken(tokenDocument);
    if (!context || !this.canDragGroundContainer(context.actor, tokenDocument)) return;

    const root = getHtmlRoot(html);
    const column = root?.querySelector?.(".col.right, div.right");
    if (!column || column.querySelector("[data-tenebre-ground-transfer]")) return;

    const control = document.createElement("div");
    control.className = "control-icon tenebre-ground-container-transfer";
    control.dataset.tenebreGroundTransfer = "true";
    control.draggable = true;
    control.title = game.i18n.localize("TENEBRE.Containers.GroundTransferDrag");
    control.setAttribute("aria-label", control.title);

    const image = document.createElement("img");
    image.src = context.item.img || "icons/svg/item-bag.svg";
    image.alt = context.item.name ?? "";
    image.draggable = false;
    control.append(image);

    control.addEventListener("dragstart", (event) => {
      const data = this.buildItemDragData(context.item);
      if (!data.uuid || !event.dataTransfer) {
        event.preventDefault();
        return;
      }
      event.stopPropagation();
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", JSON.stringify(data));
    });
    column.append(control);
  }

  static async dropToCanvas(canvas, data) {
    if (!this.isGroundContainerDragData(data)) return false;
    if (!ContainerService.isEnabled() || !canvas?.scene) return false;

    const scene = canvas.scene;
    const actor = resolveActor(data);
    const container = actor?.items?.get?.(data.itemId);
    if (!actor || !container || !this.canMutateGroundContainer(actor, scene)) {
      notifyGroundContainer("TENEBRE.Containers.GroundDropPermission");
      return false;
    }
    if (!ContainerService.isContainer(container) || ContainerService.isStored(container)) return false;
    if (!ContainerService.isAccessible(container)) {
      notifyGroundContainer("TENEBRE.Containers.GroundDropOther");
      return false;
    }
    if (Number(container.system?.number ?? 0) <= 0) return false;

    const itemPilesResult = await ContainerTransferService.dropToItemPile(canvas, data);
    if (itemPilesResult.handled) return itemPilesResult.success;

    if (this.hasGroundToken(container)) return false;

    const existing = Array.from(scene.tokens ?? []).find((token) => {
      const reference = this.getGroundReference(token);
      return reference?.actorUuid === actor.uuid && reference.containerId === container.id;
    });
    if (existing) return false;

    const operationKey = `${scene.id}:${actor.uuid}:${container.id}`;
    if (pendingDrops.has(operationKey)) return false;
    pendingDrops.add(operationKey);

    try {
      const x = Number(data.x);
      const y = Number(data.y);
      const previousState = String(container.system?.state ?? "");
      const tokenData = this.buildGroundTokenData({
        actor,
        container,
        scene,
        x,
        y,
        previousState
      });
      const created = await scene.createEmbeddedDocuments("Token", [tokenData], { render: true });
      const token = created?.[0];
      if (!token?.id) return false;

      try {
        await container.update({
          "system.state": GROUND_CONTAINER_STATE,
          [`flags.${FLAG_SCOPE}.${GROUND_CONTAINER_FLAG}`]: {
            version: GROUND_CONTAINER_VERSION,
            tokenId: token.id,
            sceneId: scene.id,
            actorId: actor.id,
            actorUuid: actor.uuid,
            containerId: container.id,
            previousState
          }
        }, { render: true });
      } catch (error) {
        await scene.deleteEmbeddedDocuments("Token", [token.id], { render: true }).catch((rollbackError) => {
          console.warn(`${MODULE_ID} | Failed to roll back the ground container token.`, rollbackError);
        });
        throw error;
      }
    } finally {
      pendingDrops.delete(operationKey);
    }

    return true;
  }

  static async restoreFromToken(token) {
    const reference = this.getGroundReference(token);
    if (!reference) return false;

    const actor = resolveActor(reference);
    const container = actor?.items?.get?.(reference.containerId);
    const scene = token?.parent ?? game.scenes?.get?.(reference.sceneId);
    if (!actor || !container || !this.canMutateGroundContainer(actor, scene)) return false;

    const itemReference = this.getItemGroundReference(container);
    if (itemReference?.tokenId && itemReference.tokenId !== token.id) return false;

    const operationKey = `${reference.sceneId}:${reference.actorUuid}:${reference.containerId}:${token.id}`;
    if (pendingPickups.has(operationKey)) return false;
    if (pendingRestores.has(operationKey)) return false;
    pendingRestores.add(operationKey);

    const previousState = itemReference?.previousState ?? reference.previousState ?? "equipped";
    try {
      await container.update({
        "system.state": previousState,
        [`flags.${FLAG_SCOPE}.-=${GROUND_CONTAINER_FLAG}`]: null
      }, { render: true });
      return true;
    } finally {
      pendingRestores.delete(operationKey);
    }
  }

  static async pickupToken(token) {
    const reference = this.getGroundReference(token);
    if (!reference) return false;

    const actor = resolveActor(reference);
    const container = actor?.items?.get?.(reference.containerId);
    const scene = token?.parent ?? game.scenes?.get?.(reference.sceneId);
    if (!actor || !container || !this.canMutateGroundContainer(actor, scene)) return false;

    const itemReference = this.getItemGroundReference(container);
    if (itemReference?.tokenId && itemReference.tokenId !== token.id) return false;

    const operationKey = this.getOperationKey(reference, token.id);
    if (pendingPickups.has(operationKey)) return false;
    pendingPickups.add(operationKey);

    const previousState = itemReference?.previousState ?? reference.previousState ?? "equipped";
    const restoredItemReference = this.buildItemGroundReference(reference, token.id, previousState);
    try {
      await container.update({
        "system.state": previousState,
        [`flags.${FLAG_SCOPE}.-=${GROUND_CONTAINER_FLAG}`]: null
      }, { render: true });
      try {
        await scene.deleteEmbeddedDocuments("Token", [token.id], { render: true });
      } catch (error) {
        await container.update({
          "system.state": GROUND_CONTAINER_STATE,
          [`flags.${FLAG_SCOPE}.${GROUND_CONTAINER_FLAG}`]: restoredItemReference
        }, { render: true }).catch((rollbackError) => {
          console.warn(`${MODULE_ID} | Failed to roll back a picked-up ground container.`, rollbackError);
        });
        throw error;
      }
      return true;
    } finally {
      pendingPickups.delete(operationKey);
    }
  }

  static async reconcileGroundContainers() {
    if (!this.isPrimaryActiveGm()) return {
      skipped: true,
      removedTokens: 0,
      restoredItems: 0,
      repairedItems: 0,
      errors: 0
    };

    const result = {
      skipped: false,
      removedTokens: 0,
      restoredItems: 0,
      repairedItems: 0,
      errors: 0
    };
    const tokenReferences = [];
    const removedTokenKeys = new Set();

    for (const scene of game.scenes ?? []) {
      for (const token of scene.tokens ?? []) {
        const reference = this.getGroundReference(token);
        if (!reference) continue;
        tokenReferences.push({ scene, token, reference });

        const actor = resolveActor(reference);
        const container = actor?.items?.get?.(reference.containerId);
        if (!actor || !container) {
          if (this.canMutateScene(scene)) {
            try {
              await scene.deleteEmbeddedDocuments("Token", [token.id], { render: true });
              removedTokenKeys.add(`${scene.id}:${token.id}`);
              result.removedTokens += 1;
            } catch (error) {
              result.errors += 1;
              console.warn(`${MODULE_ID} | Could not remove an orphaned ground container token.`, error);
            }
          }
          continue;
        }

        const itemReference = this.getItemGroundReference(container);
        if (itemReference?.tokenId && itemReference.tokenId !== token.id) {
          if (this.canMutateScene(scene)) {
            try {
              await scene.deleteEmbeddedDocuments("Token", [token.id], { render: true });
              removedTokenKeys.add(`${scene.id}:${token.id}`);
              result.removedTokens += 1;
            } catch (error) {
              result.errors += 1;
              console.warn(`${MODULE_ID} | Could not remove a stale ground container token.`, error);
            }
          }
          continue;
        }

        const expectedItemReference = this.buildItemGroundReference(
          reference,
          token.id,
          itemReference?.previousState ?? reference.previousState ?? "equipped"
        );
        if (!itemReference || !referencesMatch(itemReference, expectedItemReference)
          || container.system?.state !== GROUND_CONTAINER_STATE) {
          try {
            await container.update({
              "system.state": GROUND_CONTAINER_STATE,
              [`flags.${FLAG_SCOPE}.${GROUND_CONTAINER_FLAG}`]: expectedItemReference
            }, { render: true });
            result.repairedItems += 1;
          } catch (error) {
            result.errors += 1;
            console.warn(`${MODULE_ID} | Could not repair a ground container item reference.`, error);
          }
        }
      }
    }

    for (const actor of game.actors ?? []) {
      for (const item of actor.items ?? []) {
        const reference = this.getItemGroundReference(item);
        if (!reference) continue;
        const exactToken = tokenReferences.find(({ scene, token, reference: tokenReference }) =>
          !removedTokenKeys.has(`${scene.id}:${token.id}`)
          && scene.id === reference.sceneId
          && token.id === reference.tokenId
          && tokenReference.actorUuid === actor.uuid
          && tokenReference.containerId === item.id
        );
        if (exactToken) continue;

        const previousState = reference.previousState ?? "equipped";
        try {
          await item.update({
            "system.state": previousState,
            [`flags.${FLAG_SCOPE}.-=${GROUND_CONTAINER_FLAG}`]: null
          }, { render: true });
          result.restoredItems += 1;
        } catch (error) {
          result.errors += 1;
          console.warn(`${MODULE_ID} | Could not restore an item with a missing ground container token.`, error);
        }
      }
    }

    return result;
  }

  static getOperationKey(reference, tokenId) {
    return `${reference?.sceneId ?? ""}:${reference?.actorUuid ?? ""}:${reference?.containerId ?? ""}:${tokenId ?? ""}`;
  }

  static buildItemGroundReference(reference, tokenId, previousState) {
    return {
      version: GROUND_CONTAINER_VERSION,
      tokenId,
      sceneId: reference.sceneId,
      actorId: reference.actorId,
      actorUuid: reference.actorUuid,
      containerId: reference.containerId,
      previousState
    };
  }

  static isPrimaryActiveGm() {
    if (!game.user?.isGM) return false;
    const activeGms = [...(game.users ?? [])]
      .filter((user) => user.active && user.isGM)
      .sort((left, right) => String(left.id).localeCompare(String(right.id)));
    return !activeGms.length || activeGms[0]?.id === game.user.id;
  }

  static canMutateScene(scene) {
    if (!game.user?.isGM) return false;
    if (typeof scene?.canUserModify === "function") {
      return scene.canUserModify(game.user, "TOKEN");
    }
    return true;
  }

  static async removeTokenForDeletedItem(reference) {
    const scene = game.scenes?.get?.(reference.sceneId);
    const actor = resolveActor(reference);
    if (!scene || !actor || !this.canMutateGroundContainer(actor, scene)) return false;

    const token = scene.tokens?.get?.(reference.tokenId)
      ?? Array.from(scene.tokens ?? []).find((candidate) => {
        const tokenReference = this.getGroundReference(candidate);
        return tokenReference?.actorUuid === actor.uuid
          && tokenReference?.containerId === reference.containerId;
      });
    if (!token?.id) return false;
    await scene.deleteEmbeddedDocuments("Token", [token.id], { render: true });
    return true;
  }

  static canMutateGroundContainer(actor, scene) {
    if (!actor || (!game.user?.isGM && !actor.isOwner)) return false;
    if (typeof scene?.canUserModify === "function") {
      return scene.canUserModify(game.user, "TOKEN");
    }
    return Boolean(game.user?.isGM);
  }

  static canDragGroundContainer(actor, tokenDocument) {
    if (!actor || !tokenDocument) return false;
    return Boolean(game.user?.isGM || actor.isOwner || tokenDocument.isOwner);
  }
}

function getHtmlRoot(html) {
  return html?.querySelector ? html : html?.[0] ?? null;
}

function referencesMatch(left, right) {
  return left?.version === right?.version
    && left?.tokenId === right?.tokenId
    && left?.sceneId === right?.sceneId
    && left?.actorId === right?.actorId
    && left?.actorUuid === right?.actorUuid
    && left?.containerId === right?.containerId
    && left?.previousState === right?.previousState;
}

function hasCanvasCoordinate(value) {
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value));
}

function resolveActor(reference) {
  const actors = Array.from(game.actors ?? []);
  const byUuid = actors.find((actor) => actor.uuid === reference?.actorUuid);
  if (reference?.actorUuid && !byUuid) return null;
  return byUuid ?? game.actors?.get?.(reference?.actorId) ?? null;
}

function notifyGroundContainer(key) {
  ui.notifications?.warn?.(game.i18n.localize(key));
}

export const groundContainerConstants = Object.freeze({
  flag: GROUND_CONTAINER_FLAG,
  dragType: GROUND_CONTAINER_DRAG_TYPE,
  state: GROUND_CONTAINER_STATE,
  version: GROUND_CONTAINER_VERSION
});
