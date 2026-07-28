import { MODULE_ID } from "./constants.mjs";
import {
  assertSafeBatch,
  assertSafePayload,
  isAllowedCombatantUpdate,
  isAllowedManeuverEffectCreate,
  isAllowedManeuverEffectUpdate,
  isAllowedToughnessUpdate,
  isModuleManeuverEffect,
  sanitizeSocketOptions
} from "./socket-policy.mjs";

let moduleSocket = null;

const HANDLERS = {
  createEmbeddedDocuments: createEmbeddedDocumentsAsGM,
  deleteEmbeddedDocuments: deleteEmbeddedDocumentsAsGM,
  markActorDead: markActorDeadAsGM,
  setFlag: setFlagAsGM,
  unsetFlag: unsetFlagAsGM,
  updateCombatant: updateCombatantAsGM,
  updateDocument: updateDocumentAsGM,
  updateEmbeddedDocuments: updateEmbeddedDocumentsAsGM
};

Hooks.once("socketlib.ready", () => {
  try {
    moduleSocket = globalThis.socketlib?.registerModule?.(MODULE_ID) ?? null;
    if (!moduleSocket) return;

    for (const [name, handler] of Object.entries(HANDLERS)) {
      moduleSocket.register(name, handler);
    }
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to register socketlib handlers.`, error);
    moduleSocket = null;
  }
});

export class SocketService {
  static get active() {
    return Boolean(moduleSocket);
  }

  static hasActiveGM() {
    return Boolean(globalThis.game?.users?.activeGM);
  }

  static isPrimaryGM() {
    const user = globalThis.game?.user;
    if (!user?.isGM) return false;
    const activeGM = game.users?.activeGM;
    return !activeGM || activeGM.id === user.id;
  }

  static canModify(document, action = "update") {
    if (!document) return false;
    if (globalThis.game?.user?.isGM) return true;

    try {
      if (typeof document.canUserModify === "function") {
        return document.canUserModify(game.user, action);
      }
    } catch (_error) {
      // Fall through to ownership checks.
    }

    if (document.isOwner === true) return true;
    if (document.parent?.isOwner === true) return true;
    return false;
  }

  static async createEmbeddedDocuments(parent, embeddedName, data, options = {}) {
    if (!parent) return null;
    if (this.canModify(parent, "update")) {
      return parent.createEmbeddedDocuments(embeddedName, data, options);
    }
    return this.executeAsGM("createEmbeddedDocuments", parent.uuid, embeddedName, data, options);
  }

  static async deleteEmbeddedDocuments(parent, embeddedName, ids, options = {}) {
    if (!parent || !ids?.length) return null;
    if (this.canModify(parent, "update")) {
      return parent.deleteEmbeddedDocuments(embeddedName, ids, options);
    }
    return this.executeAsGM("deleteEmbeddedDocuments", parent.uuid, embeddedName, ids, options);
  }

  static async markActorDead(actor) {
    if (!actor) return false;
    if (globalThis.game?.user?.isGM) return markActorDeadLocal(actor);
    return this.executeAsGM("markActorDead", actor.uuid);
  }

  static async setFlag(document, scope, key, value) {
    if (!document) return null;
    if (this.canModify(document, "update")) {
      return document.setFlag(scope, key, value);
    }
    return this.executeAsGM("setFlag", document.uuid, scope, key, value);
  }

  static async unsetFlag(document, scope, key) {
    if (!document) return null;
    if (this.canModify(document, "update")) {
      return document.unsetFlag(scope, key);
    }
    return this.executeAsGM("unsetFlag", document.uuid, scope, key);
  }

  static async updateCombatant(combatant, updates, options = {}) {
    if (!combatant) return null;
    if (this.canModify(combatant, "update")) {
      return combatant.update(updates, options);
    }

    const combat = combatant.parent ?? globalThis.game?.combat;
    return this.executeAsGM("updateCombatant", combat?.uuid ?? combat?.id ?? null, combatant.id, updates, options);
  }

  static async updateDocument(document, updates, options = {}) {
    if (!document) return null;
    if (this.canModify(document, "update")) {
      return document.update(updates, options);
    }
    return this.executeAsGM("updateDocument", document.uuid, updates, options);
  }

  static async updateEmbeddedDocuments(parent, embeddedName, updates, options = {}) {
    if (!parent || !updates?.length) return null;
    if (this.canModify(parent, "update")) {
      return parent.updateEmbeddedDocuments(embeddedName, updates, options);
    }
    return this.executeAsGM("updateEmbeddedDocuments", parent.uuid, embeddedName, updates, options);
  }

  static async executeAsGM(handlerName, ...args) {
    const localHandler = HANDLERS[handlerName];
    if (!localHandler) throw new Error(`Unknown socket handler: ${handlerName}`);

    if (globalThis.game?.user?.isGM) return localHandler(...args);

    if (!moduleSocket) {
      throw new Error(`${MODULE_ID} | socketlib is not active for this module.`);
    }

    if (!this.hasActiveGM()) {
      throw new Error(`${MODULE_ID} | No active GM is available for socketlib execution.`);
    }

    return moduleSocket.executeAsGM(handlerName, ...args);
  }
}

async function createEmbeddedDocumentsAsGM(parentUuid, embeddedName, data, options = {}) {
  const parent = await getDocument(parentUuid);
  const user = getRequestUser(this);
  assertSafeBatch(data, "Embedded document data");
  authorizeEmbeddedOperation({ user, parent, embeddedName, operation: "create", sources: data });
  await parent.createEmbeddedDocuments(embeddedName, data, sanitizeSocketOptions(options));
  return true;
}

async function deleteEmbeddedDocumentsAsGM(parentUuid, embeddedName, ids, options = {}) {
  const parent = await getDocument(parentUuid);
  const user = getRequestUser(this);
  assertSafeBatch(ids, "Embedded document ids");
  const sources = ids.map((id) => parent.getEmbeddedDocument?.(embeddedName, id)).filter(Boolean);
  if (sources.length !== ids.length) throw new Error("One or more embedded documents were not found.");
  authorizeEmbeddedOperation({ user, parent, embeddedName, operation: "delete", sources });
  await parent.deleteEmbeddedDocuments(embeddedName, ids, sanitizeSocketOptions(options));
  return true;
}

async function markActorDeadAsGM(actorUuid) {
  const actor = await getDocument(actorUuid);
  authorizeOwnedDocument(getRequestUser(this), actor, "mark actor dead");
  return markActorDeadLocal(actor);
}

async function setFlagAsGM(documentUuid, scope, key, value) {
  const document = await getDocument(documentUuid);
  const user = getRequestUser(this);
  authorizeOwnedDocument(user, document, "set flag");
  if (scope !== MODULE_ID || typeof key !== "string" || !key) throw new Error("Invalid module flag operation.");
  assertSafePayload(value, "Flag value");
  await document.setFlag(scope, key, value);
  return true;
}

async function unsetFlagAsGM(documentUuid, scope, key) {
  const document = await getDocument(documentUuid);
  authorizeOwnedDocument(getRequestUser(this), document, "unset flag");
  if (scope !== MODULE_ID || typeof key !== "string" || !key) throw new Error("Invalid module flag operation.");
  await document.unsetFlag(scope, key);
  return true;
}

async function updateCombatantAsGM(combatUuidOrId, combatantId, updates, options = {}) {
  const combat = await getCombat(combatUuidOrId);
  const combatant = combat?.combatants?.get?.(combatantId);
  if (!combatant) throw new Error(`Combatant not found: ${combatantId}`);
  const user = getRequestUser(this);
  authorizeOwnedDocument(user, combatant.actor, "update combatant");
  if (!isAllowedCombatantUpdate(updates)) throw new Error("Invalid combatant update payload.");
  await combatant.update(updates, sanitizeSocketOptions(options));
  return true;
}

async function updateDocumentAsGM(documentUuid, updates, options = {}) {
  const document = await getDocument(documentUuid);
  const user = getRequestUser(this);
  assertSafePayload(updates, "Document update");
  if (!user.isGM && !hasOwnerPermission(document, user)) {
    if (!isTargetedActor(document, user)
      || !isAllowedToughnessUpdate(updates, document.system?.health?.toughness?.value)) {
      throw new Error("Unauthorized document update.");
    }
  }
  await document.update(updates, sanitizeSocketOptions(options));
  return true;
}

async function updateEmbeddedDocumentsAsGM(parentUuid, embeddedName, updates, options = {}) {
  const parent = await getDocument(parentUuid);
  const user = getRequestUser(this);
  assertSafeBatch(updates, "Embedded document updates");
  const sources = updates.map((update) => {
    const existing = parent.getEmbeddedDocument?.(embeddedName, update?._id);
    if (!existing) throw new Error(`Embedded document not found: ${update?._id ?? "unknown"}`);
    return existing;
  });
  authorizeEmbeddedOperation({ user, parent, embeddedName, operation: "update", sources, updates });
  await parent.updateEmbeddedDocuments(embeddedName, updates, sanitizeSocketOptions(options));
  return true;
}

function getRequestUser(context) {
  const senderId = context?.socketdata?.userId;
  const user = senderId ? game.users?.get?.(senderId) : (game.user?.isGM ? game.user : null);
  if (!user?.active) throw new Error("Socket request has no authenticated active user.");
  return user;
}

function authorizeEmbeddedOperation({ user, parent, embeddedName, operation, sources, updates = [] }) {
  if (user.isGM || hasOwnerPermission(parent, user)) return;
  if (parent.documentName !== "Actor" || embeddedName !== "ActiveEffect" || !isTargetedActor(parent, user)) {
    throw new Error("Unauthorized embedded document operation.");
  }
  const allowed = operation === "create"
    ? sources.every((source) => isAllowedManeuverEffectCreate(source, MODULE_ID))
    : operation === "update"
      ? sources.every((source, index) => isAllowedManeuverEffectUpdate(updates[index], source, MODULE_ID))
      : operation === "delete"
        ? sources.every((source) => isModuleManeuverEffect(source, MODULE_ID))
        : false;
  if (!allowed) {
    throw new Error("Only module maneuver effects may be changed on a targeted actor.");
  }
}

function authorizeOwnedDocument(user, document, action) {
  if (user.isGM || hasOwnerPermission(document, user)) return;
  throw new Error(`Unauthorized socket operation: ${action}.`);
}

function hasOwnerPermission(document, user) {
  if (!document || !user) return false;
  try {
    return document.testUserPermission?.(user, globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3) === true;
  } catch (_error) {
    return false;
  }
}

function isTargetedActor(actor, user) {
  if (!actor || actor.documentName !== "Actor") return false;
  return Array.from(user.targets ?? []).some((token) => {
    return token.actor?.uuid === actor.uuid || token.actor?.id === actor.id;
  });
}

async function getDocument(uuid) {
  const document = await globalThis.fromUuid?.(uuid);
  if (!document) throw new Error(`Document not found: ${uuid}`);
  return document;
}

async function getCombat(uuidOrId) {
  if (!uuidOrId) return globalThis.game?.combat ?? null;
  const byId = globalThis.game?.combats?.get?.(uuidOrId);
  if (byId) return byId;

  try {
    const byUuid = await globalThis.fromUuid?.(uuidOrId);
    if (byUuid) return byUuid;
  } catch (_error) {
    // Fall back to the active combat below.
  }

  const active = globalThis.game?.combat;
  return active?.id === uuidOrId || active?.uuid === uuidOrId ? active : null;
}

async function markActorDeadLocal(actor) {
  if (!actor) return false;

  if (!hasDeadCondition(actor)) {
    let applied = false;

    if (typeof actor.toggleStatusEffect === "function") {
      try {
        await actor.toggleStatusEffect("dead", { active: true });
        applied = true;
      } catch (error) {
        console.warn(`${MODULE_ID} | Failed to apply dead status through toggleStatusEffect. Falling back to ActiveEffect.`, error);
      }
    }

    if (!applied && typeof actor.addCondition === "function") {
      await actor.addCondition("dead");
      applied = true;
    }

    const deadEffect = globalThis.CONFIG?.statusEffects?.find?.((effect) => effect.id === "dead");
    if (!applied && deadEffect && typeof actor.createEmbeddedDocuments === "function") {
      await actor.createEmbeddedDocuments("ActiveEffect", [foundry.utils.duplicate(deadEffect)]);
    }
  }

  await markActiveTokensDead(actor);
  return true;
}

function hasDeadCondition(actor) {
  return Array.from(actor?.effects ?? []).some((effect) => {
    if (effect.statuses?.has?.("dead")) return true;
    if (effect.statuses?.includes?.("dead")) return true;
    if (effect.flags?.core?.statusId === "dead") return true;
    return String(effect.id ?? "").toLowerCase() === "dead";
  });
}

async function markActiveTokensDead(actor) {
  const deadEffect = globalThis.CONFIG?.statusEffects?.find?.((effect) => effect.id === "dead");
  const tokens = actor?.getActiveTokens?.() ?? [];

  for (const token of tokens) {
    if (deadEffect && typeof token.toggleEffect === "function") {
      try {
        await token.toggleEffect(foundry.utils.duplicate(deadEffect), { overlay: true, active: true });
      } catch (error) {
        console.warn(`${MODULE_ID} | Failed to mark token dead overlay.`, error);
      }
    }

    const combatant = globalThis.game?.combat?.combatants?.find?.((candidate) => {
      return candidate.tokenId === token.id
        || candidate.token?.id === token.id
        || candidate.actor?.id === actor.id;
    });
    if (combatant && !combatant.defeated && typeof combatant.update === "function") {
      await combatant.update({ defeated: true });
    }
  }
}
