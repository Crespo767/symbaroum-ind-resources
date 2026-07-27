import { FLAG_SCOPE, MODULE_ID } from "./constants.mjs";
import { escapeHtml } from "./utils.mjs";

export const WEAPON_READINESS_FLAG = "weaponReadiness";
export const WEAPON_READY_STATE = "drawn";
export const WEAPON_SHEATHED_STATE = "equipped";
export const WEAPON_HAND_LIMIT = 2;
export const WEAPON_READINESS_ICON = "/systems/symbaroum/asset/image/weapon.png";
export const WEAPON_READINESS_LONG_MODE_FLAG = "weaponReadinessLongOneHanded";
export const WEAPON_READINESS_ORIGINAL_LONG_QUALITY_FLAG = "weaponReadinessOriginalLongQuality";

const actorUpdates = new Map();

export const WeaponReadinessService = {
  registerHooks() {
    Hooks.on("preUpdateItem", clearReadinessWhenWeaponBecomesInactive);
    Hooks.on("preDeleteItem", preventDrawnWeaponDeletion);
  },

  isEnabled() {
    return game.settings.get(MODULE_ID, "enableWeaponReadiness");
  },

  isEligibleWeapon,
  isDrawn,

  getEligibleWeapons(actor) {
    return Array.from(actor?.items ?? []).filter(isEligibleWeapon);
  },

  getDrawnWeapons(actor) {
    return this.getEligibleWeapons(actor).filter(isDrawn);
  },

  async open(actor) {
    if (!this.isEnabled() || !canManageActor(actor)) return null;
    const weapons = this.getEligibleWeapons(actor);
    if (weapons.length === 0) {
      ui.notifications.info(game.i18n.localize("TENEBRE.WeaponReadiness.NoWeapons"));
      return null;
    }

    const content = buildWeaponReadinessDialogContent(weapons);
    return foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("TENEBRE.WeaponReadiness.DialogTitle") },
      position: { width: 260 },
      content: `<div class="symbaroum dialog tenebre-symbaroum-dialog tenebre-weapon-readiness-dialog">${content}</div>`,
      buttons: [{
        action: "close",
        label: game.i18n.localize("TENEBRE.Common.Close")
      }],
      rejectClose: false,
      render: (_event, dialog) => {
        bindWeaponReadinessDialog(dialog.element, actor);
      }
    });
  },

  async setDrawn(weapon, drawn) {
    const actor = weapon?.parent;
    if (!isEligibleWeapon(weapon) || !canManageActor(actor)) return false;
    const desiredIds = new Set(this.getDrawnWeapons(actor).map((item) => item.id));
    if (drawn) desiredIds.add(weapon.id);
    else desiredIds.delete(weapon.id);
    return this.setDrawnWeapons(actor, desiredIds);
  },

  async setDrawnWeapons(actor, desiredIds = []) {
    if (!this.isEnabled() || !canManageActor(actor)) return false;
    const weapons = this.getEligibleWeapons(actor);
    const handUsage = getWeaponHandUsage(weapons, desiredIds);
    if (handUsage > WEAPON_HAND_LIMIT) {
      ui.notifications.warn(game.i18n.format("TENEBRE.WeaponReadiness.HandLimitExceeded", {
        used: handUsage,
        limit: WEAPON_HAND_LIMIT
      }));
      return false;
    }

    const actorKey = actor.uuid ?? actor.id;
    if (actorUpdates.has(actorKey)) return actorUpdates.get(actorKey);

    const operation = updateWeaponReadiness(actor, desiredIds)
      .finally(() => actorUpdates.delete(actorKey));
    actorUpdates.set(actorKey, operation);
    return operation;
  }
};

export function isEligibleWeapon(item) {
  if (item?.type !== "weapon") return false;
  const storedIn = item?.getFlag?.(FLAG_SCOPE, "storedIn")
    ?? item?.flags?.[FLAG_SCOPE]?.storedIn;
  if (String(storedIn ?? "").trim()) return false;
  return String(item.system?.reference ?? "").toLowerCase() !== "unarmed";
}

export function isDrawn(item) {
  return String(item?.system?.state ?? "").toLowerCase() === "active";
}

export function buildWeaponReadinessDialogContent(weapons, labels = {}) {
  const drawLabel = labels.draw ?? game.i18n.localize("TENEBRE.WeaponReadiness.Draw");
  const sheatheLabel = labels.sheathe ?? game.i18n.localize("TENEBRE.WeaponReadiness.Sheathe");
  const sheatheAllLabel = labels.sheatheAll ?? game.i18n.localize("TENEBRE.WeaponReadiness.SheatheAll");
  const options = Array.from(weapons ?? []).map((weapon) => {
    const drawn = isDrawn(weapon);
    const actionLabel = drawn ? sheatheLabel : drawLabel;
    return `
      <button
        type="button"
        class="tenebre-weapon-readiness-option"
        data-weapon-id="${escapeHtml(weapon.id)}"
        data-drawn="${drawn ? "true" : "false"}"
        aria-pressed="${drawn ? "true" : "false"}"
        title="${escapeHtml(`${actionLabel}: ${weapon.name}`)}"
      >
        <span class="tenebre-weapon-readiness-check" aria-hidden="true"></span>
        <img src="${escapeHtml(weapon.img)}" alt="">
        <span>${escapeHtml(weapon.name)}</span>
      </button>
    `;
  }).join("");

  return `
    <div class="tenebre-weapon-readiness-list">${options}</div>
    <button type="button" class="tenebre-weapon-readiness-sheathe-all" data-action="sheathe-all">
      ${escapeHtml(sheatheAllLabel)}
    </button>
  `;
}

export function canAttackWithWeapon(item) {
  if (item?.type !== "weapon") return true;
  if (String(item.system?.reference ?? "").toLowerCase() === "unarmed") return true;
  return isEligibleWeapon(item) && isDrawn(item);
}

export function shouldBlockDrawnWeaponDeletion(item, settings = game.settings) {
  let enabled = false;
  try {
    enabled = Boolean(settings?.get?.(MODULE_ID, "enableWeaponReadiness"));
  } catch {
    return false;
  }
  const actorType = String(item?.parent?.type ?? "").toLowerCase();
  const belongsToPlayerActor = actorType === "player" || actorType === "character";
  return enabled && belongsToPlayerActor && isEligibleWeapon(item) && isDrawn(item);
}

/** Return the number of hands represented by the system weapon mode. */
export function getWeaponHandCost(item, { oneHanded = false } = {}) {
  const reference = String(item?.system?.reference ?? "").toLowerCase();
  const qualities = item?.system?.qualities ?? {};
  if (reference === "unarmed") return 0;
  if (reference === "shield" && qualities.flexible) return 0;
  if (reference === "heavy") return 2;
  if (reference === "long") return oneHanded ? 1 : 2;
  if (reference === "ranged") return 2;
  return 1;
}

export function getWeaponHandUsage(weapons, desiredIds = []) {
  const desired = new Set(desiredIds ?? []);
  const oneHandedLongIds = getOneHandedLongWeaponIds(weapons, desired);
  return Array.from(weapons ?? [])
    .filter((weapon) => desired.has(weapon.id))
    .reduce((total, weapon) => total + getWeaponHandCost(weapon, {
      oneHanded: oneHandedLongIds.has(weapon.id)
    }), 0);
}

export function getOneHandedLongWeaponIds(weapons, desiredIds = []) {
  // A weapon in the long class may be drawn one-handed only while a shield is drawn;
  // the temporary mode is represented by disabling Long on the weapon itself.
  const desired = new Set(desiredIds ?? []);
  const shieldSelected = Array.from(weapons ?? []).some((weapon) => (
    desired.has(weapon.id) && isShieldWeapon(weapon)
  ));
  if (!shieldSelected) return new Set();
  return new Set(Array.from(weapons ?? [])
    .filter((weapon) => desired.has(weapon.id) && isLongWeapon(weapon))
    .map((weapon) => weapon.id));
}

export function resolveWeaponItem(actor, weapon) {
  if (weapon?.type === "weapon" && weapon?.parent === actor) return weapon;
  const id = weapon?.id ?? weapon?._id;
  if (!id) return null;
  return actor?.items?.get?.(id)
    ?? Array.from(actor?.items ?? []).find((item) => item?.id === id)
    ?? null;
}

export function buildWeaponReadinessPatches(weapons, desiredIds = []) {
  const desired = new Set(desiredIds);
  const oneHandedLongIds = getOneHandedLongWeaponIds(weapons, desired);
  return weapons.flatMap((weapon) => {
    const shouldBeDrawn = desired.has(weapon.id);
    const nextState = shouldBeDrawn ? "active" : WEAPON_SHEATHED_STATE;
    const nextReadinessState = shouldBeDrawn ? WEAPON_READY_STATE : "sheathed";
    const currentState = String(weapon.system?.state ?? "").toLowerCase();
    const currentReadinessState = weapon.getFlag?.(FLAG_SCOPE, WEAPON_READINESS_FLAG)
      ?? weapon.flags?.[FLAG_SCOPE]?.[WEAPON_READINESS_FLAG];
    const currentLongMode = getReadinessFlag(weapon, WEAPON_READINESS_LONG_MODE_FLAG) === true;
    const shouldUseLongOneHanded = shouldBeDrawn && oneHandedLongIds.has(weapon.id);
    const patch = { _id: weapon.id };

    if (currentState !== nextState || currentReadinessState !== nextReadinessState) {
      patch["system.state"] = nextState;
      patch[`flags.${FLAG_SCOPE}.${WEAPON_READINESS_FLAG}`] = nextReadinessState;
    }

    if (shouldUseLongOneHanded && !currentLongMode) {
      patch["system.qualities.long"] = false;
      patch[`flags.${FLAG_SCOPE}.${WEAPON_READINESS_LONG_MODE_FLAG}`] = true;
      patch[`flags.${FLAG_SCOPE}.${WEAPON_READINESS_ORIGINAL_LONG_QUALITY_FLAG}`] = Boolean(
        weapon.system?.qualities?.long
      );
    } else if (!shouldUseLongOneHanded && currentLongMode) {
      patch["system.qualities.long"] = Boolean(
        getReadinessFlag(weapon, WEAPON_READINESS_ORIGINAL_LONG_QUALITY_FLAG)
      );
      patch[`flags.${FLAG_SCOPE}.-=${WEAPON_READINESS_LONG_MODE_FLAG}`] = null;
      patch[`flags.${FLAG_SCOPE}.-=${WEAPON_READINESS_ORIGINAL_LONG_QUALITY_FLAG}`] = null;
    }

    return Object.keys(patch).length > 1 ? [patch] : [];
  });
}

async function updateWeaponReadiness(actor, desiredIds) {
  const weapons = WeaponReadinessService.getEligibleWeapons(actor);
  const allowedIds = new Set(weapons.map((weapon) => weapon.id));
  const desired = new Set(Array.from(desiredIds ?? []).filter((id) => allowedIds.has(id)));
  const previous = weapons.filter(isDrawn);
  const patches = buildWeaponReadinessPatches(weapons, desired);
  if (patches.length === 0) return false;

  await actor.updateEmbeddedDocuments("Item", patches);

  const next = weapons.filter((weapon) => desired.has(weapon.id));
  const drawn = next.filter((weapon) => !previous.some((entry) => entry.id === weapon.id));
  const sheathed = previous.filter((weapon) => !desired.has(weapon.id));
  if ((drawn.length > 0 || sheathed.length > 0) && isWeaponReadinessChatEnabled()) {
    await createReadinessChatMessage(actor, drawn, sheathed);
  }
  Hooks.callAll(`${MODULE_ID}.weaponReadinessChanged`, { actor, drawn, sheathed, previous, current: next });
  return true;
}

export function isWeaponReadinessChatEnabled(settings = game.settings) {
  try {
    return Boolean(settings?.get?.(MODULE_ID, "showWeaponReadinessChatMessages"));
  } catch {
    return false;
  }
}

async function createReadinessChatMessage(actor, drawn, sheathed) {
  const key = drawn.length > 0 && sheathed.length > 0
    ? "TENEBRE.WeaponReadiness.ChatSwapped"
    : drawn.length > 0
      ? "TENEBRE.WeaponReadiness.ChatDrawn"
      : "TENEBRE.WeaponReadiness.ChatSheathed";
  const text = game.i18n.format(key, {
    actor: actor.name,
    drawn: formatWeaponNames(drawn),
    sheathed: formatWeaponNames(sheathed),
    weapons: formatWeaponNames(drawn.length > 0 ? drawn : sheathed)
  });
  const image = drawn[0]?.img ?? sheathed[0]?.img ?? actor.img;
  const content = buildWeaponReadinessChatContent({
    title: game.i18n.localize("TENEBRE.WeaponReadiness.ChatTitle"),
    text,
    image
  });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    flags: {
      [MODULE_ID]: {
        type: "weaponReadiness",
        actorUuid: actor.uuid,
        drawnWeaponIds: drawn.map((weapon) => weapon.id),
        sheathedWeaponIds: sheathed.map((weapon) => weapon.id)
      }
    }
  });
}

export function buildWeaponReadinessChatContent({ title = "", text = "", image = "" } = {}) {
  return `
    <article class="tenebre-weapon-readiness-chat">
      <img src="${escapeHtml(image)}" alt="">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(text)}</p>
      </div>
    </article>
  `;
}

function formatWeaponNames(weapons) {
  const names = weapons.map((weapon) => weapon.name);
  if (names.length <= 1) return names[0] ?? "";
  return new Intl.ListFormat(game.i18n.lang, { style: "long", type: "conjunction" }).format(names);
}

function canManageActor(actor) {
  if (!actor || (actor.type !== "player" && actor.type !== "character")) return false;
  if (actor.isOwner || game.user?.isGM) return true;
  ui.notifications.warn(game.i18n.localize("TENEBRE.WeaponReadiness.NoPermission"));
  return false;
}

function bindWeaponReadinessDialog(element, actor) {
  const content = element?.querySelector?.(".tenebre-weapon-readiness-dialog");
  if (!content || content.dataset.bound === "true") return;
  content.dataset.bound = "true";
  syncWeaponReadinessDialog(content, actor);

  content.addEventListener("click", async (event) => {
    const button = event.target?.closest?.(
      ".tenebre-weapon-readiness-option, .tenebre-weapon-readiness-sheathe-all"
    );
    if (!button || button.disabled) return;

    setWeaponReadinessDialogBusy(content, true);
    try {
      if (button.matches(".tenebre-weapon-readiness-sheathe-all")) {
        await WeaponReadinessService.setDrawnWeapons(actor, []);
      } else {
        const weapon = resolveWeaponItem(actor, { id: button.dataset.weaponId });
        if (weapon) await WeaponReadinessService.setDrawn(weapon, !isDrawn(weapon));
      }
    } finally {
      setWeaponReadinessDialogBusy(content, false);
      syncWeaponReadinessDialog(content, actor);
    }
  });
}

function syncWeaponReadinessDialog(content, actor) {
  for (const button of content.querySelectorAll(".tenebre-weapon-readiness-option")) {
    const weapon = resolveWeaponItem(actor, { id: button.dataset.weaponId });
    const drawn = Boolean(weapon && isDrawn(weapon));
    const actionKey = drawn
      ? "TENEBRE.WeaponReadiness.Sheathe"
      : "TENEBRE.WeaponReadiness.Draw";
    button.dataset.drawn = drawn ? "true" : "false";
    button.setAttribute("aria-pressed", drawn ? "true" : "false");
    button.title = `${game.i18n.localize(actionKey)}: ${weapon?.name ?? ""}`;
  }
  const sheatheAll = content.querySelector(".tenebre-weapon-readiness-sheathe-all");
  if (sheatheAll) sheatheAll.disabled = WeaponReadinessService.getDrawnWeapons(actor).length === 0;
}

function setWeaponReadinessDialogBusy(content, busy) {
  content.dataset.busy = busy ? "true" : "false";
  for (const button of content.querySelectorAll("button")) button.disabled = busy;
}

function clearReadinessWhenWeaponBecomesInactive(item, changes) {
  if (item?.type !== "weapon") return;
  const nextState = foundry.utils.getProperty(changes, "system.state");
  const nextStoredIn = foundry.utils.getProperty(changes, `flags.${FLAG_SCOPE}.storedIn`);
  const leavingDrawn = nextState !== undefined && nextState !== "active";
  const storedInChanged = nextStoredIn !== undefined;
  const inLongOneHandedMode = getReadinessFlag(item, WEAPON_READINESS_LONG_MODE_FLAG) === true;

  if (inLongOneHandedMode && (leavingDrawn || storedInChanged)) {
    foundry.utils.setProperty(
      changes,
      "system.qualities.long",
      Boolean(getReadinessFlag(item, WEAPON_READINESS_ORIGINAL_LONG_QUALITY_FLAG))
    );
    foundry.utils.setProperty(changes, `flags.${FLAG_SCOPE}.${WEAPON_READINESS_FLAG}`, "sheathed");
    changes[`flags.${FLAG_SCOPE}.-=${WEAPON_READINESS_LONG_MODE_FLAG}`] = null;
    changes[`flags.${FLAG_SCOPE}.-=${WEAPON_READINESS_ORIGINAL_LONG_QUALITY_FLAG}`] = null;
    return;
  }

  if (!isDrawn(item) || !leavingDrawn) return;
  foundry.utils.setProperty(changes, `flags.${FLAG_SCOPE}.${WEAPON_READINESS_FLAG}`, "sheathed");
}

function preventDrawnWeaponDeletion(item) {
  if (!shouldBlockDrawnWeaponDeletion(item)) return true;
  ui.notifications.warn(game.i18n.format("TENEBRE.WeaponReadiness.DeleteBlocked", {
    weapon: item.name
  }));
  return false;
}

function isLongWeapon(item) {
  return String(item?.system?.reference ?? "").toLowerCase() === "long";
}

function isShieldWeapon(item) {
  return String(item?.system?.reference ?? "").toLowerCase() === "shield";
}

function getReadinessFlag(item, key) {
  return item?.getFlag?.(FLAG_SCOPE, key)
    ?? item?.flags?.[FLAG_SCOPE]?.[key];
}
