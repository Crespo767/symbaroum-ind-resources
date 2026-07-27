import { FLAG_SCOPE, MODULE_ID } from "./constants.mjs";
import { CompatibilityService } from "./compatibility.mjs";
import { EncumbranceService } from "./encumbrance.mjs";

export const ENCUMBRANCE_INDICATOR_FLAG = "encumbranceIndicator";
export const ENCUMBRANCE_STATUS_ID = `${MODULE_ID}.encumbrance-overloaded`;
export const ENCUMBRANCE_INDICATOR_ICON = "icons/svg/hazard.svg";

const indicatorSyncs = new Map();

export const EncumbranceVisualService = {
  registerHooks() {
    Hooks.on("createItem", (item) => queueIndicatorSync(item?.parent));
    Hooks.on("updateItem", (item) => queueIndicatorSync(item?.parent));
    Hooks.on("deleteItem", (item) => queueIndicatorSync(item?.parent));
    Hooks.on("updateActor", (actor, changes) => {
      if (actorUpdateAffectsEncumbrance(changes)) queueIndicatorSync(actor);
    });
    Hooks.on("deleteActiveEffect", (effect) => {
      if (isEncumbranceIndicatorEffect(effect)) queueIndicatorSync(effect?.parent);
    });
    Hooks.on(`${MODULE_ID}.settingsChanged`, (key) => {
      if (key === "enableEncumbrance" || key === "encumbranceDiscoveredWeights") {
        this.refreshAllIndicators();
      }
    });
    Hooks.on(`${MODULE_ID}.encumbranceWeightsChanged`, () => this.refreshAllIndicators());
    Hooks.on("canvasReady", () => this.refreshAllIndicators());
  },

  refreshAllIndicators() {
    for (const actor of getRelevantActors()) queueIndicatorSync(actor);
  },

  async syncActorIndicator(actor) {
    if (!isIndicatorExecutor(actor)) return false;
    const actorKey = actor.uuid ?? actor.id;
    const current = indicatorSyncs.get(actorKey);
    if (current) {
      current.pending = true;
      return current.promise;
    }

    const state = { pending: false, promise: null };
    indicatorSyncs.set(actorKey, state);
    state.promise = runQueuedIndicatorSync(actor, state)
      .finally(() => indicatorSyncs.delete(actorKey));
    return state.promise;
  }
};

async function runQueuedIndicatorSync(actor, state) {
  let changed = false;
  do {
    state.pending = false;
    changed = await syncActorIndicator(actor) || changed;
  } while (state.pending);
  return changed;
}

export function isEncumbranceIndicatorEffect(effect) {
  return effect?.getFlag?.(FLAG_SCOPE, ENCUMBRANCE_INDICATOR_FLAG) === true
    || effect?.flags?.[FLAG_SCOPE]?.[ENCUMBRANCE_INDICATOR_FLAG] === true;
}

export function actorUpdateAffectsEncumbrance(changes) {
  if (!changes || typeof changes !== "object") return false;
  if (changes.system?.attributes?.strong !== undefined) return true;
  return Object.keys(changes).some((key) => (
    key === "system.attributes.strong"
    || key.startsWith("system.attributes.strong.")
  ));
}

async function syncActorIndicator(actor) {
  const existing = Array.from(actor.effects ?? []).filter(isEncumbranceIndicatorEffect);
  const enabled = game.settings.get(MODULE_ID, "enableEncumbrance");
  const overloaded = enabled && EncumbranceService.calculateLoad(actor).isOverloaded;

  if (!overloaded) {
    if (existing.length > 0) {
      await actor.deleteEmbeddedDocuments("ActiveEffect", existing.map((effect) => effect.id));
    }
    return existing.length > 0;
  }

  const effectData = buildIndicatorData();
  const current = existing[0];
  const removeIds = existing.slice(1).map((effect) => effect.id);
  if (removeIds.length > 0) {
    await actor.deleteEmbeddedDocuments("ActiveEffect", removeIds);
  }

  if (!current) {
    await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
    return true;
  }

  if (!indicatorMatches(current, effectData)) {
    await actor.updateEmbeddedDocuments("ActiveEffect", [{ _id: current.id, ...effectData }]);
    return true;
  }

  return removeIds.length > 0;
}

function buildIndicatorData() {
  return CompatibilityService.buildVisualActiveEffectData({
    name: game.i18n.localize("TENEBRE.Encumbrance.Overloaded"),
    img: ENCUMBRANCE_INDICATOR_ICON,
    statuses: [ENCUMBRANCE_STATUS_ID],
    flags: {
      [FLAG_SCOPE]: {
        [ENCUMBRANCE_INDICATOR_FLAG]: true
      }
    }
  });
}

function indicatorMatches(effect, data) {
  const currentStatuses = Array.from(effect.statuses ?? []);
  const nextStatuses = Array.from(data.statuses ?? []);
  const currentImage = effect.img ?? effect.icon;
  return effect.name === data.name
    && currentImage === data.img
    && currentStatuses.length === nextStatuses.length
    && currentStatuses.every((id, index) => id === nextStatuses[index])
    && (!("showIcon" in data) || effect.showIcon === data.showIcon);
}

function queueIndicatorSync(actor) {
  if (!actor || actor.type !== "player") return;
  void EncumbranceVisualService.syncActorIndicator(actor)
    .catch((error) => console.warn(`${MODULE_ID} | Could not synchronize the encumbrance token indicator.`, error));
}

function getRelevantActors() {
  const actors = new Map();
  for (const actor of game.actors ?? []) actors.set(actor.uuid ?? actor.id, actor);
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    if (token.actor) actors.set(token.actor.uuid ?? token.actor.id, token.actor);
  }
  return actors.values();
}

function isIndicatorExecutor(actor) {
  if (!actor || !game.user?.active) return false;
  const users = Array.from(game.users ?? []).filter((user) => user.active);
  const activeGms = users.filter((user) => user.isGM).sort(compareUserIds);
  if (activeGms.length > 0) return activeGms[0].id === game.user.id;

  const owners = users
    .filter((user) => actor.testUserPermission?.(user, "OWNER"))
    .sort(compareUserIds);
  return owners[0]?.id === game.user.id;
}

function compareUserIds(left, right) {
  return String(left.id).localeCompare(String(right.id));
}
