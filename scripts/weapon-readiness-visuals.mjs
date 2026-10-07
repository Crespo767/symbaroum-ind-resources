import { FLAG_SCOPE, MODULE_ID } from "./constants.mjs";
import { COMPAT_MODULES, CompatibilityService } from "./compatibility.mjs";
import { TenebreSettings } from "./settings.mjs";
import { isDrawn, isEligibleWeapon } from "./weapon-readiness.mjs";

export const WEAPON_READINESS_INDICATOR_FLAG = "weaponReadinessIndicator";
export const WEAPON_READINESS_INDICATOR_WEAPON_FLAG = "weaponReadinessIndicatorWeaponId";
export const WEAPON_READINESS_STATUS_ID = `${MODULE_ID}.weapon-readiness`;

const DRAW_ANIMATION = "jb2a.impact.006.yellow";
const SHEATHE_ANIMATION = "jb2a.impact.003.blue";
const indicatorSyncs = new Map();
const combatSyncTimers = new Map();

export const WeaponReadinessVisualService = {
  registerHooks() {
    Hooks.on("updateItem", (item, changes) => {
      if (item?.type === "weapon") {
        queueIndicatorSync(item.parent);
        if (changes?.system?.state !== undefined || changes?.flags?.[FLAG_SCOPE]?.[WEAPON_READINESS_INDICATOR_WEAPON_FLAG] !== undefined) {
          queueCombatSync(item.parent);
        }
      }
    });
    Hooks.on("deleteItem", (item) => {
      if (item?.type === "weapon") queueIndicatorSync(item.parent);
    });
    Hooks.on(`${MODULE_ID}.weaponReadinessChanged`, ({ actor, drawn, sheathed, current }) => {
      queueIndicatorSync(actor);
      void playReadinessAnimation(actor, drawn, sheathed);
      queueCombatSync(actor, current);
    });
    Hooks.on(`${MODULE_ID}.settingsChanged`, (key) => {
      if (key === "enableWeaponReadiness" || key === "showWeaponReadinessTokenIndicator") {
        this.refreshAllIndicators();
      }
    });
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

function isPlayerActor(actor) {
  const type = String(actor?.type ?? "").toLowerCase();
  return type === "player" || type === "character";
}

function queueCombatSync(actor, currentWeapons = null) {
  if (!actor || !isPlayerActor(actor) || !TenebreSettings.get("enableWeaponReadinessCombatSync")) return;
  const actorKey = actor.uuid ?? actor.id;
  if (combatSyncTimers.has(actorKey)) {
    window.clearTimeout(combatSyncTimers.get(actorKey));
  }
  const timer = window.setTimeout(() => {
    combatSyncTimers.delete(actorKey);
    const weapons = currentWeapons !== null
      ? currentWeapons
      : Array.from(actor.items ?? []).filter((i) => isEligibleWeapon(i) && isDrawn(i));
    void syncActorCombatState(actor, weapons);
  }, 100);
  combatSyncTimers.set(actorKey, timer);
}

async function runQueuedIndicatorSync(actor, state) {
  let changed = false;
  do {
    state.pending = false;
    changed = await syncActorIndicator(actor) || changed;
  } while (state.pending);
  return changed;
}

export function isWeaponReadinessIndicatorEffect(effect) {
  return effect?.getFlag?.(FLAG_SCOPE, WEAPON_READINESS_INDICATOR_FLAG) === true
    || effect?.flags?.[FLAG_SCOPE]?.[WEAPON_READINESS_INDICATOR_FLAG] === true;
}

async function syncActorIndicator(actor) {
  const existing = Array.from(actor.effects ?? []).filter(isWeaponReadinessIndicatorEffect);
  const enabled = game.settings.get(MODULE_ID, "enableWeaponReadiness")
    && game.settings.get(MODULE_ID, "showWeaponReadinessTokenIndicator");
  const drawn = enabled ? Array.from(actor.items ?? []).filter((item) => isEligibleWeapon(item) && isDrawn(item)) : [];

  if (drawn.length === 0) {
    if (existing.length > 0) {
      await actor.deleteEmbeddedDocuments("ActiveEffect", existing.map((effect) => effect.id));
    }
    return existing.length > 0;
  }

  const drawnById = new Map(drawn.map((weapon) => [weapon.id, weapon]));
  const effectsByWeaponId = new Map();
  const removeIds = [];

  for (const effect of existing) {
    const weaponId = getIndicatorWeaponId(effect);
    if (!weaponId || !drawnById.has(weaponId) || effectsByWeaponId.has(weaponId)) {
      removeIds.push(effect.id);
      continue;
    }
    effectsByWeaponId.set(weaponId, effect);
  }

  const createData = [];
  const updateData = [];
  for (const weapon of drawn) {
    const effectData = buildIndicatorData(weapon);
    const current = effectsByWeaponId.get(weapon.id);
    if (!current) {
      createData.push(effectData);
    } else if (!indicatorMatches(current, effectData)) {
      updateData.push({ _id: current.id, ...effectData });
    }
  }

  if (removeIds.length > 0) await actor.deleteEmbeddedDocuments("ActiveEffect", removeIds);
  if (updateData.length > 0) await actor.updateEmbeddedDocuments("ActiveEffect", updateData);
  if (createData.length > 0) await actor.createEmbeddedDocuments("ActiveEffect", createData);
  return removeIds.length > 0 || updateData.length > 0 || createData.length > 0;
}

function buildIndicatorData(weapon) {
  return CompatibilityService.buildVisualActiveEffectData({
    name: game.i18n.format("TENEBRE.WeaponReadiness.IndicatorName", { weapons: weapon.name }),
    img: weapon.img,
    statuses: [getWeaponReadinessStatusId(weapon.id)],
    flags: {
      [FLAG_SCOPE]: {
        [WEAPON_READINESS_INDICATOR_FLAG]: true,
        [WEAPON_READINESS_INDICATOR_WEAPON_FLAG]: weapon.id,
        weaponIds: [weapon.id]
      }
    }
  });
}

function indicatorMatches(effect, data) {
  const currentWeaponId = getIndicatorWeaponId(effect);
  const nextWeaponId = data.flags?.[FLAG_SCOPE]?.[WEAPON_READINESS_INDICATOR_WEAPON_FLAG];
  const currentIds = effect.flags?.[FLAG_SCOPE]?.weaponIds ?? [];
  const nextIds = data.flags?.[FLAG_SCOPE]?.weaponIds ?? [];
  const currentStatuses = Array.from(effect.statuses ?? []);
  const nextStatuses = Array.from(data.statuses ?? []);
  const currentImage = effect.img ?? effect.icon;
  return effect.name === data.name
    && currentImage === data.img
    && currentWeaponId === nextWeaponId
    && currentIds.length === nextIds.length
    && currentIds.every((id, index) => id === nextIds[index])
    && currentStatuses.length === nextStatuses.length
    && currentStatuses.every((id, index) => id === nextStatuses[index])
    && (!("showIcon" in data) || effect.showIcon === data.showIcon);
}

function getIndicatorWeaponId(effect) {
  const flags = effect?.flags?.[FLAG_SCOPE] ?? {};
  const directId = flags[WEAPON_READINESS_INDICATOR_WEAPON_FLAG];
  if (directId) return directId;

  const legacyIds = flags.weaponIds;
  return Array.isArray(legacyIds) && legacyIds.length === 1 ? legacyIds[0] : null;
}

export function getWeaponReadinessStatusId(weaponId) {
  return `${WEAPON_READINESS_STATUS_ID}.${String(weaponId)}`;
}

function queueIndicatorSync(actor) {
  if (!actor || (actor.type !== "player" && actor.type !== "character")) return;
  void WeaponReadinessVisualService.syncActorIndicator(actor)
    .catch((error) => console.warn(`${MODULE_ID} | Could not synchronize the drawn-weapon token indicator.`, error));
}

function getRelevantActors() {
  const actors = new Map();
  for (const actor of game.actors ?? []) actors.set(actor.uuid ?? actor.id, actor);
  for (const token of canvas?.tokens?.placeables ?? []) {
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

async function playReadinessAnimation(actor, drawn, sheathed) {
  if (!game.settings.get(MODULE_ID, "enableWeaponReadinessAnimation")) return false;
  if (!canvas?.ready || !CompatibilityService.isModuleActive(COMPAT_MODULES.sequencer)) return false;
  if (typeof globalThis.Sequence !== "function" || !globalThis.Sequencer?.Database?.entryExists) return false;

  const token = getActorToken(actor);
  if (!token) return false;
  const animation = drawn?.length > 0 ? DRAW_ANIMATION : sheathed?.length > 0 ? SHEATHE_ANIMATION : null;
  if (!animation || !globalThis.Sequencer.Database.entryExists(animation)) return false;

  try {
    await new globalThis.Sequence({ inModuleName: MODULE_ID, softFail: true })
      .effect(animation)
      .atLocation(token)
      .scaleToObject(1.05)
      .fadeIn(100)
      .fadeOut(200)
      .play();
    return true;
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not play the weapon-readiness animation.`, error);
    return false;
  }
}

function getActorToken(actor) {
  const tokens = actor?.getActiveTokens?.(true, true) ?? [];
  return tokens.find((token) => token.document?.parent?.id === canvas.scene?.id) ?? tokens[0] ?? null;
}

async function syncActorCombatState(actor, currentWeapons = []) {
  if (!actor || !isPlayerActor(actor) || !TenebreSettings.get("enableWeaponReadinessCombatSync")) return;

  const isExecutor = isIndicatorExecutor(actor) || actor?.isOwner || game.user?.isGM;
  if (!isExecutor) return;

  const tokens = actor?.getActiveTokens?.(true, true) ?? [];
  if (tokens.length === 0) return;

  const isArmed = Array.isArray(currentWeapons) && currentWeapons.length > 0;

  for (const token of tokens) {
    const tokenDoc = token?.document ?? token;
    if (!tokenDoc) continue;

    if (isArmed) {
      if (!tokenDoc.inCombat) {
        try {
          let combat = game.combats?.find((c) => c.scene?.id === canvas.scene?.id) ?? game.combat;
          if (!combat && game.user.isGM) {
            combat = await Combat.create({ scene: canvas.scene?.id });
          }
          if (combat) {
            if (typeof tokenDoc.toggleCombatant === "function") {
              await tokenDoc.toggleCombatant({ combat });
            } else if (typeof token.toggleCombatant === "function") {
              await token.toggleCombatant({ combat });
            } else {
              await combat.createEmbeddedDocuments("Combatant", [{
                tokenId: tokenDoc.id,
                sceneId: canvas.scene?.id,
                actorId: actor?.id
              }]);
            }
          }
        } catch (error) {
          console.warn(`${MODULE_ID} | Não foi possível colocar token em combate: ${tokenDoc.name}`, error);
        }
      }
    } else {
      if (tokenDoc.inCombat) {
        try {
          const combat = game.combats?.find((c) => c.scene?.id === canvas.scene?.id) ?? game.combat;
          const combatant = combat?.combatants?.find((c) => c.tokenId === tokenDoc.id);
          if (combatant && combat.combatants.has(combatant.id)) {
            await combatant.delete();
          }
        } catch (error) {
          // Ignora silenciosamente se o combatente já foi removido por outro evento
        }
      }
    }

    // Dispara a reavaliação de imagem no Token Variant Art se o módulo estiver presente
    try {
      const tva = game.modules.get("token-variants");
      if (tva?.active) {
        if (typeof globalThis.tokenVariants?.updateTokenImage === "function") {
          void globalThis.tokenVariants.updateTokenImage(token);
        } else if (typeof globalThis.TokenVariants?.evaluateEffects === "function") {
          void globalThis.TokenVariants.evaluateEffects(token);
        } else if (typeof tva.api?.evaluateEffects === "function") {
          void tva.api.evaluateEffects(token);
        }
      }
    } catch (_tvaErr) {
      // Ignora silenciosamente caso não possua a API exposta
    }
  }
}
