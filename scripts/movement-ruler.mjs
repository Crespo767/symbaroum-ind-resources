import { MODULE_ID } from "./constants.mjs";
import { EncumbranceService } from "./encumbrance.mjs";
import { HUNGER_STATUS_ID } from "./hunger.mjs";
import { MANEUVER_EFFECTS } from "./maneuvers.mjs";
import { TenebreSettings } from "./settings.mjs";
import { CompatibilityService } from "./compatibility.mjs";

const COLORS = {
  walk: 0x24c768,
  double: 0xe6c229,
  blocked: 0xd64040,
  neutral: 0xffffff
};

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

export class MovementService {
  static register() {
    this.patchMovementValidation();
    if (CompatibilityService.shouldSkipMovementRuler()) return;
    this.patchTokenRuler();
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

    const actor = tokenDocument?.actor;
    if (!actor) return true;

    const passed = movement?.passed?.waypoints ?? [];
    const isForcedMovement = passed.length > 0
      && passed.every((waypoint) => waypoint.action === "displace" || waypoint.actionConfig?.teleport);
    if (isForcedMovement) return true;

    if (hasStatus(actor, "prone")) {
      ui.notifications.warn(game.i18n.format("TENEBRE.Movement.ProneBlocked", {
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

    if (hasStatus(actor, "prone")) {
      blocked = true;
      reasons.push(game.i18n.localize("TENEBRE.Movement.ProneReason"));
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
    const cost = Number(waypoint?.measurement?.cost ?? waypoint?.cost ?? 0);
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
    return TenebreSettings.get("enableMovementRuler") && TenebreSettings.get("enableMovementColors");
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
