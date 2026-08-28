import { MODULE_ID } from "./constants.mjs";
import { EncumbranceService } from "./encumbrance.mjs";
import { HUNGER_STATUS_ID } from "./hunger.mjs";
import { MANEUVER_EFFECTS } from "./maneuvers.mjs";
import { TenebreSettings } from "./settings.mjs";
import { CompatibilityService } from "./compatibility.mjs";
import { getStandUpRemainingMovementActions } from "./stand-up.mjs";
import { isDeathIncapacitated } from "./death-automation.mjs";

const COLORS = {
  walk: 0x24c768,
  double: 0xe6c229,
  blocked: 0xd64040,
  neutral: 0xffffff
};

export const TRAVEL_RATES_KM_PER_DAY = Object.freeze({
  plains: Object.freeze({ dayMarch: 20, forcedMarch: 40, mortalMarch: 60, dayRide: 40, forcedRide: 60, mortalRide: 70 }),
  brightDavokar: Object.freeze({ dayMarch: 20, forcedMarch: 30, mortalMarch: 40, dayRide: 30, forcedRide: 45, mortalRide: 50 }),
  darkDavokar: Object.freeze({ dayMarch: 10, forcedMarch: 15, mortalMarch: 20, dayRide: 10, forcedRide: 15, mortalRide: 20 })
});

const TRAVEL_TERRAINS = ["plains", "brightDavokar", "darkDavokar"];
const TRAVEL_MODES = ["dayMarch", "forcedMarch", "mortalMarch", "dayRide", "forcedRide", "mortalRide"];

const IMMOBILIZING_EFFECTS = new Set([
  MANEUVER_EFFECTS.GRAPPLED,
  MANEUVER_EFFECTS.MAINTAINING_GRAPPLE,
  MANEUVER_EFFECTS.KNOCKED_DOWN,
  MANEUVER_EFFECTS.KNOCKED_OUT
]);

const MOVEMENT_SPENT_EFFECTS = new Set([
  MANEUVER_EFFECTS.CAREFUL_AIM
]);

let originalTokenRulerClass = null;
let movementValidationPatched = false;
let tokenHudHookRegistered = false;

export class MovementService {
  static register() {
    this.patchMovementValidation();
    this.registerTokenHud();
    if (CompatibilityService.shouldSkipMovementRuler()) return;
    this.patchTokenRuler();
  }

  static registerTokenHud() {
    if (tokenHudHookRegistered) return true;
    Hooks.on("renderTokenHUD", (hud, html, token) => {
      MovementService.addTravelHudControl(hud, html, token);
    });
    tokenHudHookRegistered = true;
    return true;
  }

  static patchTokenRuler() {
    if (!globalThis.CONFIG?.Token?.rulerClass) return false;
    if (CompatibilityService.shouldSkipMovementRuler()) return false;
    if (CONFIG.Token.rulerClass._tenebreMovementRuler) return true;

    originalTokenRulerClass = CONFIG.Token.rulerClass;

    class TenebreTokenRuler extends originalTokenRulerClass {
      _getSegmentStyle(waypoint) {
        const style = super._getSegmentStyle(waypoint);
        if (!MovementService.shouldColorMovement()) return style;
        const token = this.token;
        const profile = MovementService.getProfile(token?.actor);
        const state = MovementService.getWaypointState(waypoint, profile);
        return {
          ...style,
          color: COLORS[state] ?? style.color,
          alpha: state === "blocked" ? 0.9 : style.alpha
        };
      }

      _getGridHighlightStyle(waypoint, offset) {
        const style = super._getGridHighlightStyle(waypoint, offset);
        if (!MovementService.shouldColorMovement()) return style;
        if (!(style.alpha > 0)) return style;

        const profile = MovementService.getProfile(this.token?.actor);
        const state = MovementService.getWaypointState(waypoint, profile);
        return {
          ...style,
          color: COLORS[state] ?? style.color,
          alpha: state === "blocked" ? 0.55 : 0.45
        };
      }

      _getWaypointStyle(waypoint) {
        const style = super._getWaypointStyle(waypoint);
        if (!MovementService.shouldColorMovement()) return style;
        const profile = MovementService.getProfile(this.token?.actor);
        const state = MovementService.getWaypointState(waypoint, profile);
        return {
          ...style,
          color: COLORS[state] ?? style.color
        };
      }

      _getWaypointLabelContext(waypoint, state) {
        const context = super._getWaypointLabelContext(waypoint, state);
        if (!context) return context;
        if (!TenebreSettings.get("enableMovementRuler")) return context;
        if (!TenebreSettings.get("enableMovementLimitLabels")) return context;

        const scene = MovementService.getScene(this.token);
        if (MovementService.isTravelScene(scene)) {
          const distance = MovementService.getWaypointDistance(waypoint);
          const travel = MovementService.getTravelEstimate(distance, this.token);
          context.cssClass = [context.cssClass, "tenebre-movement-travel"].filter(Boolean).join(" ");
          context.cost ??= {};
          context.cost.total = `${formatDistance(distance)} ${game.i18n.localize("TENEBRE.Movement.UnitKilometers")} · ${formatDistance(travel.days)} ${game.i18n.localize("TENEBRE.Travel.Days")}`;
          context.cost.units = "";
          return context;
        }

        const profile = MovementService.getProfile(this.token?.actor);
        const movementState = MovementService.getWaypointState(waypoint, profile);
        context.cssClass = [
          context.cssClass,
          `tenebre-movement-${movementState}`
        ].filter(Boolean).join(" ");

        const limit = movementState === "walk" ? profile.actionDistance : profile.doubleDistance;
        context.cost ??= {};
        context.cost.units = MovementService.getUnits();
        context.cost.total = `${context.cost.total}/${formatDistance(limit)}`;
        return context;
      }
    }

    TenebreTokenRuler._tenebreMovementRuler = true;
    CONFIG.Token.rulerClass = TenebreTokenRuler;
    return true;
  }

  static patchMovementValidation() {
    if (movementValidationPatched) return true;
    Hooks.on("preMoveToken", (tokenDocument, movement, operation) => {
      return MovementService.validateMovement(tokenDocument, movement, operation);
    });
    movementValidationPatched = true;
    return true;
  }

  static validateMovement(tokenDocument, movement, operation = {}) {
    if (operation?.isUndo || operation?.isPaste) return true;
    if (this.isTravelScene(tokenDocument?.parent ?? globalThis.canvas?.scene)) return true;

    const actor = tokenDocument?.actor;
    if (!actor) return true;

    const passed = movement?.passed?.waypoints ?? [];
    const isForcedMovement = passed.length > 0
      && passed.every((waypoint) => waypoint.action === "displace" || waypoint.actionConfig?.teleport);
    if (isForcedMovement) return true;

    if (isDeathIncapacitated(actor)) {
      ui.notifications.warn(game.i18n.format("TENEBRE.Death.MovementBlocked", { actor: actor.name }));
      return false;
    }

    if (hasStatus(actor, "prone")) {
      ui.notifications.warn(game.i18n.format("TENEBRE.Movement.ProneBlocked", {
        actor: actor.name
      }));
      return false;
    }

    if (getStandUpRemainingMovementActions(actor) === 0) {
      ui.notifications.warn(game.i18n.format("TENEBRE.StandUp.NoActionsRemaining", {
        actor: actor.name
      }));
      return false;
    }

    if (CompatibilityService.shouldSkipMovementValidation()) return true;
    if (!TenebreSettings.get("enableMovementRuler")) return true;
    if (!TenebreSettings.get("enableMovementBlocking")) return true;
    if (!game.combat?.started) return true;

    const combatant = game.combat.combatants?.find?.((entry) => {
      if (entry.token?.id === tokenDocument.id) return true;
      if (entry.tokenId === tokenDocument.id) return true;
      return entry.actor?.id === actor.id || entry.actorId === actor.id;
    });
    if (!combatant) return true;

    const profile = this.getProfile(actor);
    const totalCost = Number(movement?.history?.cost ?? 0) + Number(movement?.passed?.cost ?? 0);
    if (totalCost <= profile.doubleDistance + 0.001) return true;

    ui.notifications.warn(game.i18n.format("TENEBRE.Movement.Blocked", {
      actor: actor.name,
      distance: formatDistance(totalCost),
      limit: formatDistance(profile.doubleDistance),
      units: this.getUnits()
    }));
    return false;
  }

  static getProfile(actor) {
    const effects = Array.from(actor?.effects ?? []);
    const reasons = [];
    let multiplier = 1;
    let actionDistance = this.getBaseActionDistance();
    let movementActions = 2;
    let blocked = false;
    let hungerMultiplierApplied = false;
    const applyHunger = TenebreSettings.get("enableMovementHungerModifier");
    const applyEncumbrance = TenebreSettings.get("enableMovementEncumbranceModifier");
    const applyEffects = TenebreSettings.get("enableMovementEffectModifiers");

    if (isDeathIncapacitated(actor)) {
      blocked = true;
      movementActions = 0;
      actionDistance = 0;
      reasons.push(game.i18n.localize("TENEBRE.Death.DyingEffect"));
    }

    if (hasStatus(actor, "prone")) {
      blocked = true;
      reasons.push(game.i18n.localize("TENEBRE.Movement.ProneReason"));
    }

    const standUpMovementActions = getStandUpRemainingMovementActions(actor);
    if (standUpMovementActions !== null) {
      movementActions = Math.min(movementActions, standUpMovementActions);
      reasons.push(game.i18n.localize("TENEBRE.StandUp.MovementReason"));
    }

    if (applyHunger && (hasStatus(actor, HUNGER_STATUS_ID) || hasStatus(actor, "fome"))) {
      multiplier *= 0.5;
      hungerMultiplierApplied = true;
      reasons.push(game.i18n.localize("TENEBRE.Hunger.EffectName") || "Fome");
    }

    if (applyEncumbrance && TenebreSettings.get("enableEncumbrance")) {
      const load = EncumbranceService.calculateLoad(actor);
      if (load.isImmobilized) {
        blocked = true;
        reasons.push(game.i18n.localize("TENEBRE.Encumbrance.Immobilized") || "Imobilizado");
      }
    }

    for (const effect of effects) {
      const effectId = getEffectId(effect);
      const flags = effect.flags?.[MODULE_ID] ?? {};
      const flagMultiplier = Number(flags.movementMultiplier);
      const isHungerEffect = effectId === HUNGER_STATUS_ID || effectId === "fome" || flags.hunger === true;
      const canApplyEffectMovement = applyEffects || (applyHunger && isHungerEffect);
      if (canApplyEffectMovement && Number.isFinite(flagMultiplier) && flagMultiplier >= 0 && !(isHungerEffect && hungerMultiplierApplied)) {
        multiplier *= flagMultiplier;
      }

      if (applyEffects && Number.isFinite(Number(flags.movementActionDistance))) {
        actionDistance = Number(flags.movementActionDistance);
      }

      if (applyEffects && Number.isFinite(Number(flags.movementActions))) {
        movementActions = Math.min(movementActions, Math.max(0, Number(flags.movementActions)));
      }

      if (applyEffects && (flags.movementBlocked === true || IMMOBILIZING_EFFECTS.has(effectId))) {
        blocked = true;
        reasons.push(effect.name ?? effect.label ?? effectId);
      }

      if (applyEffects && MOVEMENT_SPENT_EFFECTS.has(effectId)) {
        movementActions = 0;
        reasons.push(effect.name ?? effect.label ?? effectId);
      }
    }

    actionDistance = Math.max(0, actionDistance * multiplier);
    if (blocked) movementActions = 0;

    return {
      actionDistance: movementActions >= 1 ? actionDistance : 0,
      doubleDistance: movementActions >= 2 ? actionDistance * 2 : (movementActions >= 1 ? actionDistance : 0),
      baseActionDistance: this.getBaseActionDistance(),
      multiplier,
      movementActions,
      blocked,
      reasons
    };
  }

  static getWaypointState(waypoint, profile) {
    const cost = this.getWaypointDistance(waypoint);
    if (!Number.isFinite(cost)) return "blocked";
    if (cost <= profile.actionDistance + 0.001) return "walk";
    if (cost <= profile.doubleDistance + 0.001) return "double";
    return "blocked";
  }

  static getColorForActorDistance(actor, distance) {
    const profile = this.getProfile(actor);
    if (distance <= profile.actionDistance + 0.001) return COLORS.walk;
    if (distance <= profile.doubleDistance + 0.001) return COLORS.double;
    return COLORS.blocked;
  }

  static getMovementSummary(actor) {
    const profile = this.getProfile(actor);
    return {
      actor: actor?.name ?? null,
      actionDistance: profile.actionDistance,
      doubleDistance: profile.doubleDistance,
      multiplier: profile.multiplier,
      movementActions: profile.movementActions,
      blocked: profile.blocked,
      reasons: profile.reasons
    };
  }

  static shouldColorMovement() {
    return !this.isTravelScene()
      && TenebreSettings.get("enableMovementRuler")
      && TenebreSettings.get("enableMovementColors");
  }

  static getScene(token = null) {
    return token?.document?.parent ?? token?.scene ?? globalThis.canvas?.scene ?? null;
  }

  static isTravelScene(scene = globalThis.canvas?.scene) {
    return isKilometerUnit(scene?.grid?.units ?? scene?.gridUnits);
  }

  static getWaypointDistance(waypoint) {
    const distance = Number(waypoint?.measurement?.cost ?? waypoint?.cost ?? 0);
    return Number.isFinite(distance) ? distance : Number.NaN;
  }

  static getTravelConfiguration(token = null) {
    const tokenDocument = token?.document ?? token;
    const flags = tokenDocument?.getFlag?.(MODULE_ID, "travel")
      ?? tokenDocument?.flags?.[MODULE_ID]?.travel;
    return normalizeTravelConfiguration(flags);
  }

  static getTravelEstimate(distance, token = null) {
    const configuration = this.getTravelConfiguration(token);
    const rate = getTravelRate(configuration);
    const numericDistance = Number(distance);
    return {
      ...configuration,
      distance: Number.isFinite(numericDistance) ? Math.max(0, numericDistance) : 0,
      rate,
      days: Number.isFinite(numericDistance) && rate > 0 ? Math.max(0, numericDistance) / rate : 0
    };
  }

  static addTravelHudControl(hud, html, token) {
    const tokenDocument = token?.document ?? hud?.object?.document ?? hud?.object ?? token;
    const scene = tokenDocument?.parent ?? globalThis.canvas?.scene;
    if (!tokenDocument || !this.isTravelScene(scene) || !this.canConfigureTravel(tokenDocument)) return false;

    const root = html?.querySelector ? html : html?.[0];
    const column = root?.querySelector?.(".col.right, div.right");
    if (!column || column.querySelector("[data-tenebre-travel-control]")) return false;

    const control = document.createElement("button");
    control.type = "button";
    control.className = "control-icon tenebre-travel-control";
    control.dataset.tenebreTravelControl = "true";
    control.title = game.i18n.localize("TENEBRE.Travel.Configure");
    control.setAttribute("aria-label", control.title);
    control.innerHTML = '<i class="fa-solid fa-route"></i>';
    control.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.configureTokenTravel(tokenDocument).catch((error) => {
        console.warn(`${MODULE_ID} | Failed to configure token travel.`, error);
        ui.notifications.error(game.i18n.localize("TENEBRE.Travel.ConfigureFailed"));
      });
    });
    column.append(control);
    return true;
  }

  static canConfigureTravel(tokenDocument) {
    if (globalThis.game?.user?.isGM) return true;
    if (typeof tokenDocument?.canUserModify === "function") {
      return tokenDocument.canUserModify(game.user, "update");
    }
    return tokenDocument?.isOwner === true;
  }

  static async configureTokenTravel(tokenDocument) {
    if (!this.canConfigureTravel(tokenDocument)) return false;
    const configuration = await promptTravelConfiguration(this.getTravelConfiguration(tokenDocument));
    if (!configuration) return false;
    await tokenDocument.update({
      [`flags.${MODULE_ID}.travel`]: configuration
    }, { render: true });
    return true;
  }

  static getUnitSystem() {
    const value = TenebreSettings.get("movementUnitSystem");
    return value === "feet" ? "feet" : "meters";
  }

  static getBaseActionDistance() {
    const key = this.getUnitSystem() === "feet" ? "movementBaseFeet" : "movementBaseMeters";
    const value = Number(TenebreSettings.get(key));
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  static getUnits() {
    return this.getUnitSystem() === "feet"
      ? game.i18n.localize("TENEBRE.Movement.UnitFeet")
      : game.i18n.localize("TENEBRE.Movement.UnitMeters");
  }
}

export function isKilometerUnit(unit) {
  const normalized = String(unit ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  return ["km", "kms", "kilometer", "kilometers", "kilometre", "kilometres", "quilometro", "quilometros"].includes(normalized);
}

export function getTravelRate({ terrain = "plains", mode = "dayMarch", alongRiver = false } = {}) {
  let terrainIndex = Math.max(0, TRAVEL_TERRAINS.indexOf(terrain));
  if (alongRiver) terrainIndex = Math.max(0, terrainIndex - 1);
  const effectiveTerrain = TRAVEL_TERRAINS[terrainIndex];
  return TRAVEL_RATES_KM_PER_DAY[effectiveTerrain]?.[mode] ?? TRAVEL_RATES_KM_PER_DAY.plains.dayMarch;
}

export function normalizeTravelConfiguration(value = {}) {
  return {
    terrain: TRAVEL_TERRAINS.includes(value?.terrain) ? value.terrain : "plains",
    mode: TRAVEL_MODES.includes(value?.mode) ? value.mode : "dayMarch",
    alongRiver: value?.alongRiver === true || value?.alongRiver === "true"
  };
}

function buildTravelDialogContent(configuration) {
  const localize = (key) => game.i18n.localize(key);
  const option = (value, labelKey, selected) => `<option value="${value}"${selected === value ? " selected" : ""}>${localize(labelKey)}</option>`;
  return `
    <div class="tenebre-travel-dialog">
    <p class="hint">${localize("TENEBRE.Travel.TokenConfigurationHint")}</p>
    <div class="form-group">
      <label>${localize("TENEBRE.Travel.Terrain")}</label>
      <div class="form-fields"><select name="terrain">
        ${option("plains", "TENEBRE.Travel.TerrainPlains", configuration.terrain)}
        ${option("brightDavokar", "TENEBRE.Travel.TerrainBrightDavokar", configuration.terrain)}
        ${option("darkDavokar", "TENEBRE.Travel.TerrainDarkDavokar", configuration.terrain)}
      </select></div>
    </div>
    <div class="form-group">
      <label>${localize("TENEBRE.Travel.Mode")}</label>
      <div class="form-fields"><select name="mode">
        ${option("dayMarch", "TENEBRE.Travel.ModeDayMarch", configuration.mode)}
        ${option("forcedMarch", "TENEBRE.Travel.ModeForcedMarch", configuration.mode)}
        ${option("mortalMarch", "TENEBRE.Travel.ModeMortalMarch", configuration.mode)}
        ${option("dayRide", "TENEBRE.Travel.ModeDayRide", configuration.mode)}
        ${option("forcedRide", "TENEBRE.Travel.ModeForcedRide", configuration.mode)}
        ${option("mortalRide", "TENEBRE.Travel.ModeMortalRide", configuration.mode)}
      </select></div>
    </div>
    <div class="form-group">
      <label>${localize("TENEBRE.Travel.AlongRiver")}</label>
      <div class="form-fields"><select name="alongRiver">
        <option value="false"${configuration.alongRiver ? "" : " selected"}>${localize("TENEBRE.Common.No")}</option>
        <option value="true"${configuration.alongRiver ? " selected" : ""}>${localize("TENEBRE.Common.Yes")}</option>
      </select></div>
      <p class="hint">${localize("TENEBRE.Travel.AlongRiverHint")}</p>
    </div>
    </div>`;
}

function readTravelDialog(element) {
  const root = element?.querySelector ? element : element?.[0];
  const form = root?.querySelector?.(".tenebre-travel-dialog");
  return normalizeTravelConfiguration({
    terrain: form?.querySelector?.('[name="terrain"]')?.value,
    mode: form?.querySelector?.('[name="mode"]')?.value,
    alongRiver: form?.querySelector?.('[name="alongRiver"]')?.value
  });
}

async function promptTravelConfiguration(configuration) {
  const content = buildTravelDialogContent(configuration);
  const title = game.i18n.localize("TENEBRE.Travel.TokenConfiguration");
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (DialogV2?.wait) {
    return DialogV2.wait({
      window: { title },
      position: { width: 430 },
      content,
      buttons: [
        {
          action: "save",
          icon: "fas fa-save",
          label: game.i18n.localize("TENEBRE.Common.Save"),
          default: true,
          callback: (_event, _button, dialog) => readTravelDialog(dialog?.element)
        },
        {
          action: "cancel",
          icon: "fas fa-times",
          label: game.i18n.localize("TENEBRE.Common.Cancel"),
          callback: () => null
        }
      ],
      rejectClose: false
    });
  }

  return new Promise((resolve) => {
    let completed = false;
    const complete = (value) => {
      if (completed) return;
      completed = true;
      resolve(value);
    };
    new Dialog({
      title,
      content,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: game.i18n.localize("TENEBRE.Common.Save"),
          callback: (html) => complete(readTravelDialog(html))
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize("TENEBRE.Common.Cancel"),
          callback: () => complete(null)
        }
      },
      default: "save",
      close: () => complete(null)
    }).render(true);
  });
}

function getEffectId(effect) {
  const flags = effect?.flags ?? {};
  const moduleId = flags[MODULE_ID]?.effectId;
  if (moduleId) return moduleId;
  if (flags.core?.statusId) return flags.core.statusId;
  if (effect?.statuses) {
    for (const status of effect.statuses) return status;
  }
  return effect?.id ?? null;
}

function hasStatus(actor, statusId) {
  if (!actor || !statusId) return false;
  if (actor.statuses?.has?.(statusId)) return true;
  return Array.from(actor.effects ?? []).some((effect) => {
    if (effect.statuses?.has?.(statusId)) return true;
    if (effect.statuses?.includes?.(statusId)) return true;
    if (effect.flags?.core?.statusId === statusId) return true;
    if (effect.flags?.[MODULE_ID]?.effectId === statusId) return true;
    return false;
  });
}

function formatDistance(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "infinito";
  const rounded = typeof number.toNearest === "function"
    ? number.toNearest(0.01)
    : Math.round(number * 100) / 100;
  return rounded.toLocaleString?.(game.i18n.lang) ?? String(rounded);
}
