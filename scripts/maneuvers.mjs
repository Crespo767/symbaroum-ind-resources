import { MANEUVER_EFFECTS, MODULE_ID } from "./constants.mjs";
import { evaluateRoll, rollTotal, createChatMessageAfterDice } from "./dice.mjs";
import { SocketService } from "./sockets.mjs";
import { TenebreSettings } from "./settings.mjs";

export { MANEUVER_EFFECTS };

const MANEUVER_EFFECT_IDS = new Set(Object.values(MANEUVER_EFFECTS));
const TURN_END_EFFECTS = new Set([
  MANEUVER_EFFECTS.DELAYED_INITIATIVE,
  MANEUVER_EFFECTS.SHOVED,
  MANEUVER_EFFECTS.CHARGING,
  MANEUVER_EFFECTS.CAREFUL_AIM,
  MANEUVER_EFFECTS.TAKING_INITIATIVE,
  MANEUVER_EFFECTS.INITIATIVE_BONUS,
  MANEUVER_EFFECTS.TOTAL_DEFENSE,
  MANEUVER_EFFECTS.TOTAL_OFFENSE,
  MANEUVER_EFFECTS.FREE_ATTACK_OPENING
]);

const MANEUVER_STATUS_EFFECTS = [
  {
    id: MANEUVER_EFFECTS.DELAYED_INITIATIVE,
    labelKey: "TENEBRE.Maneuvers.EffectDelayedInitiative",
    icon: "icons/svg/clockwork.svg"
  },
  {
    id: MANEUVER_EFFECTS.GRAPPLED,
    labelKey: "TENEBRE.Maneuvers.EffectGrappled",
    icon: "systems/symbaroum/asset/image/lasso.png"
  },
  {
    id: MANEUVER_EFFECTS.MAINTAINING_GRAPPLE,
    labelKey: "TENEBRE.Maneuvers.EffectMaintainingGrapple",
    icon: "systems/symbaroum/asset/image/lasso.png"
  },
  {
    id: MANEUVER_EFFECTS.DISARMED,
    labelKey: "TENEBRE.Maneuvers.EffectDisarmed",
    icon: "icons/svg/combat.svg"
  },
  {
    id: MANEUVER_EFFECTS.SHOVED,
    labelKey: "TENEBRE.Maneuvers.EffectShoved",
    icon: "icons/svg/wingfoot.svg"
  },
  {
    id: MANEUVER_EFFECTS.KNOCKED_DOWN,
    labelKey: "TENEBRE.Maneuvers.EffectKnockedDown",
    icon: "icons/svg/falling.svg"
  },
  {
    id: MANEUVER_EFFECTS.CHARGING,
    labelKey: "TENEBRE.Maneuvers.EffectCharging",
    icon: "icons/svg/thrust.svg"
  },
  {
    id: MANEUVER_EFFECTS.CAREFUL_AIM,
    labelKey: "TENEBRE.Maneuvers.EffectCarefulAim",
    icon: "icons/svg/target.svg"
  },
  {
    id: MANEUVER_EFFECTS.POISONED_WEAPON,
    labelKey: "TENEBRE.Maneuvers.EffectPoisonedWeapon",
    icon: "icons/svg/poison.svg"
  },
  {
    id: MANEUVER_EFFECTS.POISONED,
    labelKey: "TENEBRE.Maneuvers.EffectPoisoned",
    icon: "icons/svg/poison.svg"
  },
  {
    id: MANEUVER_EFFECTS.TAKING_INITIATIVE,
    labelKey: "TENEBRE.Maneuvers.EffectTakingInitiative",
    icon: "icons/svg/daze.svg"
  },
  {
    id: MANEUVER_EFFECTS.INITIATIVE_BONUS,
    labelKey: "TENEBRE.Maneuvers.EffectInitiativeBonus",
    icon: "icons/svg/upgrade.svg"
  },
  {
    id: MANEUVER_EFFECTS.KNOCKED_OUT,
    labelKey: "TENEBRE.Maneuvers.EffectKnockedOut",
    icon: "icons/svg/unconscious.svg"
  },
  {
    id: MANEUVER_EFFECTS.TOTAL_DEFENSE,
    labelKey: "TENEBRE.Maneuvers.EffectTotalDefense",
    icon: "icons/svg/shield.svg"
  },
  {
    id: MANEUVER_EFFECTS.TOTAL_OFFENSE,
    labelKey: "TENEBRE.Maneuvers.EffectTotalOffense",
    icon: "icons/svg/sword.svg"
  },
  {
    id: MANEUVER_EFFECTS.FREE_ATTACK_OPENING,
    labelKey: "TENEBRE.Maneuvers.EffectFreeAttackOpening",
    icon: "icons/svg/combat.svg"
  }
];

const ATTRIBUTE_LABELS = {
  accurate: "Preciso",
  cunning: "Astuto",
  discreet: "Discreto",
  persuasive: "Persuasivo",
  quick: "Rapido",
  resolute: "Resoluto",
  strong: "Vigoroso",
  vigilant: "Vigilante",
  defense: "Defesa"
};

const MANEUVERS = [
  {
    id: "delayInitiative",
    labelKey: "TENEBRE.Maneuvers.DelayInitiative",
    action: "statement",
    icon: "fa-hourglass-half",
    noteKeys: ["TENEBRE.Maneuvers.DelayInitiativeNote"]
  },
  {
    id: "grapple",
    labelKey: "TENEBRE.Maneuvers.Grapple",
    action: "opposed",
    actingAttribute: "strong",
    targetAttribute: "strong",
    icon: "fa-fist-raised",
    noteKeys: [
      "TENEBRE.Maneuvers.GrappleNote",
      "TENEBRE.Maneuvers.FreeAttackOnFailure"
    ]
  },
  {
    id: "disarm",
    labelKey: "TENEBRE.Maneuvers.Disarm",
    action: "opposed",
    actingAttribute: "accurate",
    targetAttribute: "strong",
    icon: "fa-ban",
    noteKeys: [
      "TENEBRE.Maneuvers.DisarmNote",
      "TENEBRE.Maneuvers.FreeAttackOnFailure"
    ]
  },
  {
    id: "knockdown",
    labelKey: "TENEBRE.Maneuvers.Knockdown",
    action: "knockdown",
    actingAttribute: "strong",
    targetAttribute: "strong",
    icon: "fa-level-down-alt",
    noteKeys: ["TENEBRE.Maneuvers.KnockdownNote"]
  },
  {
    id: "charge",
    labelKey: "TENEBRE.Maneuvers.Charge",
    action: "attack",
    actingAttribute: "accurate",
    targetAttribute: "defense",
    icon: "fa-running",
    noteKeys: [
      "TENEBRE.Maneuvers.ChargeNote",
      "TENEBRE.Maneuvers.FreeAttackOnFailure"
    ]
  },
  {
    id: "carefulAim",
    labelKey: "TENEBRE.Maneuvers.CarefulAim",
    action: "statement",
    icon: "fa-bullseye",
    noteKeys: ["TENEBRE.Maneuvers.CarefulAimNote"]
  },
  {
    id: "knockout",
    labelKey: "TENEBRE.Maneuvers.Knockout",
    action: "damageCheck",
    formula: "1d12",
    icon: "fa-user-slash",
    noteKeys: [
      "TENEBRE.Maneuvers.KnockoutNote",
      "TENEBRE.Maneuvers.KnockoutAttackFirst"
    ]
  },
  {
    id: "totalDefense",
    labelKey: "TENEBRE.Maneuvers.TotalDefense",
    action: "statement",
    icon: "fa-shield-alt",
    noteKeys: ["TENEBRE.Maneuvers.TotalDefenseNote"]
  },
  {
    id: "totalOffense",
    labelKey: "TENEBRE.Maneuvers.TotalOffense",
    action: "statement",
    icon: "fa-crosshairs",
    noteKeys: ["TENEBRE.Maneuvers.TotalOffenseNote"]
  },
  {
    id: "shove",
    labelKey: "TENEBRE.Maneuvers.Shove",
    action: "attack",
    actingAttribute: "accurate",
    targetAttribute: "defense",
    icon: "fa-arrows-alt-h",
    noteKeys: [
      "TENEBRE.Maneuvers.ShoveNote",
      "TENEBRE.Maneuvers.FreeAttackOnFailure"
    ]
  },
  {
    id: "poisonWeapon",
    labelKey: "TENEBRE.Maneuvers.PoisonWeapon",
    action: "attributeCheck",
    actingAttribute: "cunning",
    icon: "fa-vial",
    noteKeys: ["TENEBRE.Maneuvers.PoisonWeaponNote"]
  },
  {
    id: "takeInitiative",
    labelKey: "TENEBRE.Maneuvers.TakeInitiative",
    action: "attributeCheck",
    actingAttribute: "resolute",
    icon: "fa-forward",
    noteKeys: ["TENEBRE.Maneuvers.TakeInitiativeNote"]
  }
];

export class ManeuverService {
  static grantFreeAttack(actor, sourceActor = null) {
    return grantFreeAttack(actor, sourceActor);
  }

  static registerStatusEffects() {
    if (!globalThis.CONFIG?.statusEffects) return;

    // Maneuver effects are applied by the maneuver automation itself.
    // Keep them out of the token HUD status picker so they do not look like
    // generic manual statuses.
    for (const effect of MANEUVER_STATUS_EFFECTS) {
      let index = CONFIG.statusEffects.findIndex((statusEffect) => statusEffect.id === effect.id || statusEffect._id === effect.id);
      while (index >= 0) {
        CONFIG.statusEffects.splice(index, 1);
        index = CONFIG.statusEffects.findIndex((statusEffect) => statusEffect.id === effect.id || statusEffect._id === effect.id);
      }
    }
  }

  static list() {
    return MANEUVERS;
  }

  static isEnabled() {
    return TenebreSettings.get("enableManeuvers");
  }

  static registerHooks() {
    Hooks.on("updateCombat", () => {
      if (!SocketService.isPrimaryGM()) return;
      ManeuverService.cleanupExpiredEffects().catch((error) => {
        console.error(`${MODULE_ID} | Failed to clean expired maneuver effects.`, error);
      });
    });

    Hooks.on("deleteCombat", () => {
      if (!SocketService.isPrimaryGM()) return;
      ManeuverService.cleanupExpiredEffects({ forceTurnEffects: true }).catch((error) => {
        console.error(`${MODULE_ID} | Failed to clean maneuver effects after combat ended.`, error);
      });
    });

    Hooks.on("deleteActiveEffect", async (effect) => {
      try {
        if (!SocketService.isPrimaryGM()) return;
        if (getManeuverEffectId(effect) === MANEUVER_EFFECTS.INITIATIVE_BONUS) {
          await revertTemporaryInitiativeBonus(effect.parent);
        }
      } catch (error) {
        console.error(`${MODULE_ID} | Failed to revert maneuver initiative bonus.`, error);
      }
    });
  }

  static get(id) {
    return MANEUVERS.find((maneuver) => maneuver.id === id) ?? MANEUVERS[0];
  }

  static async execute(actor, maneuverId, options = {}) {
    if (!ManeuverService.isEnabled()) {
      ui.notifications.warn(game.i18n.localize("TENEBRE.Maneuvers.Disabled"));
      return null;
    }

    if (actor?.type !== "player") {
      ui.notifications.warn(game.i18n.localize("TENEBRE.Maneuvers.PlayerOnly"));
      return null;
    }

    const maneuver = this.get(maneuverId);
    if (!maneuver) return null;

    await removeManeuverEffect(actor, MANEUVER_EFFECTS.FREE_ATTACK_OPENING);

    if (maneuver.action === "opposed") {
      return rollOpposedManeuver(actor, maneuver, Number(options.modifier) || 0);
    }

    if (maneuver.action === "damageCheck") {
      return rollDamageCheck(actor, maneuver, Number(options.damageValue) || 0);
    }

    if (maneuver.action === "attack") {
      return rollAttackManeuver(actor, maneuver, Number(options.modifier) || 0);
    }

    if (maneuver.action === "knockdown") {
      return rollKnockdownManeuver(actor, maneuver, Number(options.modifier) || 0);
    }

    if (maneuver.action === "attributeCheck") {
      return rollAttributeManeuver(actor, maneuver, Number(options.modifier) || 0);
    }

    return postStatement(actor, maneuver);
  }

  static hasEffect(actor, effectId) {
    return Boolean(findActorEffect(actor, effectId));
  }

  static getActiveEffects(actor) {
    return Array.from(actor?.effects ?? []).filter(isManeuverEffect);
  }

  static hasActiveEffects(actor) {
    return ManeuverService.getActiveEffects(actor).length > 0;
  }

  static async clearEffects(actor) {
    const effects = ManeuverService.getActiveEffects(actor);
    if (!effects.length) return 0;
    await prepareManeuverEffectsForRemoval(actor, effects);
    await SocketService.deleteEmbeddedDocuments(actor, "ActiveEffect", effects.map((effect) => effect.id), { render: true });
    return effects.length;
  }

  static async prepareEffectsForRemoval(actor, effects) {
    await prepareManeuverEffectsForRemoval(actor, effects);
  }

  static async cleanupExpiredEffects({ forceTurnEffects = false } = {}) {
    const combat = game.combat;
    const actors = getActorsWithManeuverEffects();

    for (const actor of actors) {
      const effects = ManeuverService.getActiveEffects(actor);
      const expired = effects.filter((effect) => shouldExpireEffect(effect, combat, { forceTurnEffects }));
      if (!expired.length) continue;

      await prepareManeuverEffectsForRemoval(actor, expired);
      await SocketService.deleteEmbeddedDocuments(actor, "ActiveEffect", expired.map((effect) => effect.id), { render: true });
    }
  }

  static blocksAttacks(actor) {
    if (!ManeuverService.isEnabled()) return false;
    return ManeuverService.hasEffect(actor, MANEUVER_EFFECTS.TOTAL_DEFENSE)
      || ManeuverService.hasEffect(actor, MANEUVER_EFFECTS.MAINTAINING_GRAPPLE);
  }

  static applyRollFavour(actor, actingAttributeName, favour, weapon = null) {
    if (!ManeuverService.isEnabled()) return Number(favour) || 0;

    let nextFavour = Number(favour) || 0;

    if (actingAttributeName === "defense") {
      if (ManeuverService.hasEffect(actor, MANEUVER_EFFECTS.TOTAL_DEFENSE)) nextFavour = Math.max(nextFavour, 1);
      if (ManeuverService.hasEffect(actor, MANEUVER_EFFECTS.TOTAL_OFFENSE)) nextFavour = Math.min(nextFavour, -1);
    }

    if (weapon && ManeuverService.hasEffect(actor, MANEUVER_EFFECTS.TOTAL_OFFENSE) && isCurrentMeleeWeaponRoll(actor)) {
      nextFavour = Math.max(nextFavour, 1);
    }

    if (weapon && ManeuverService.hasEffect(actor, MANEUVER_EFFECTS.CAREFUL_AIM) && isCurrentRangedWeaponRoll(actor)) {
      nextFavour = Math.max(nextFavour, 1);
    }

    if (ManeuverService.hasEffect(actor, MANEUVER_EFFECTS.TAKING_INITIATIVE)) {
      nextFavour = Math.min(nextFavour, -1);
    }

    return nextFavour;
  }

  static async afterWeaponRoll(actor, result) {
    if (!ManeuverService.isEnabled()) return;
    if (!actor || actor.type !== "player") return;

    if (ManeuverService.hasEffect(actor, MANEUVER_EFFECTS.CAREFUL_AIM) && isCurrentRangedWeaponRoll(actor)) {
      await removeManeuverEffect(actor, MANEUVER_EFFECTS.CAREFUL_AIM);
    }

    if (ManeuverService.hasEffect(actor, MANEUVER_EFFECTS.POISONED_WEAPON) && isSuccessfulWeaponResult(result)) {
      const targetActor = getSingleTargetActor({ warn: false });
      if (targetActor) {
        await applyManeuverEffect(targetActor, MANEUVER_EFFECTS.POISONED, { sourceActor: actor, rounds: 3, expiration: "rounds" });
      }
      await removeManeuverEffect(actor, MANEUVER_EFFECTS.POISONED_WEAPON);
    }
  }
}

async function rollOpposedManeuver(actor, maneuver, modifier) {
  const targetActor = getSingleTargetActor();
  if (!targetActor) return null;

  const actorValue = getAttributeValue(actor, maneuver.actingAttribute);
  const targetValue = getAttributeValue(targetActor, maneuver.targetAttribute);
  const actorRobustModifier = maneuver.id === "grapple" ? getRobustGrappleBonus(actor) : 0;
  const targetRobustModifier = maneuver.id === "grapple" ? getRobustGrappleBonus(targetActor) : 0;
  const finalModifier = modifier + actorRobustModifier - targetRobustModifier;
  const baseTarget = actorValue + (10 - targetValue);
  const diceTarget = clampDiceTarget(baseTarget + finalModifier);
  const roll = await evaluateRoll("1d20");
  const result = rollTotal(roll);
  const success = result <= diceTarget;
  const buildContent = (effectMessages = []) => buildChatCard({
    actor,
    targetActor,
    maneuver,
    rows: [
      [game.i18n.localize("TENEBRE.Maneuvers.Test"), `${attributeLabel(maneuver.actingAttribute)} (${actorValue}) <= ${attributeLabel(maneuver.targetAttribute)} (${targetValue})`],
      [game.i18n.localize("TENEBRE.Maneuvers.Modifier"), signedNumber(finalModifier)],
      ...(actorRobustModifier ? [[game.i18n.localize("TENEBRE.Maneuvers.ActorRobust"), signedNumber(actorRobustModifier)]] : []),
      ...(targetRobustModifier ? [[game.i18n.localize("TENEBRE.Maneuvers.TargetRobust"), signedNumber(-targetRobustModifier)]] : []),
      [game.i18n.localize("TENEBRE.Maneuvers.Roll"), `${result}/${diceTarget}`],
      [game.i18n.localize("TENEBRE.Maneuvers.Result"), success
        ? game.i18n.localize("TENEBRE.Maneuvers.Success")
        : game.i18n.localize("TENEBRE.Maneuvers.Failure")],
      ...effectRows(effectMessages)
    ],
    success,
    notes: maneuver.noteKeys.map(localize)
  });

  await createManeuverMessageAfterDice({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: buildContent(),
    rolls: [roll],
    flags: maneuverLogFlags({ actor, targetActor, maneuver, success, result, formula: `${attributeLabel(maneuver.actingAttribute)} ← ${attributeLabel(maneuver.targetAttribute)}` }),
    finalize: async () => buildContent(await applyOpposedManeuverEffects(actor, targetActor, maneuver, success))
  });

  return { success, result, diceTarget };
}

async function rollAttackManeuver(actor, maneuver, modifier) {
  const targetActor = getSingleTargetActor();
  if (!targetActor) return null;

  const actorValue = getAttributeValue(actor, maneuver.actingAttribute);
  const defenseValue = getAttributeValue(targetActor, "defense");
  const diceTarget = clampDiceTarget(actorValue + (10 - defenseValue) + modifier);
  const roll = await evaluateRoll("1d20");
  const result = rollTotal(roll);
  const success = result <= diceTarget;
  const buildContent = (effectMessages = [], extraRows = []) => buildChatCard({
    actor,
    targetActor,
    maneuver,
    rows: [
      [game.i18n.localize("TENEBRE.Maneuvers.Test"), `${attributeLabel(maneuver.actingAttribute)} (${actorValue}) <= ${attributeLabel("defense")} (${defenseValue})`],
      [game.i18n.localize("TENEBRE.Maneuvers.Modifier"), signedNumber(modifier)],
      [game.i18n.localize("TENEBRE.Maneuvers.Roll"), `${result}/${diceTarget}`],
      [game.i18n.localize("TENEBRE.Maneuvers.Result"), success
        ? game.i18n.localize("TENEBRE.Maneuvers.Success")
        : game.i18n.localize("TENEBRE.Maneuvers.Failure")],
      ...extraRows,
      ...effectRows(effectMessages)
    ],
    success,
    notes: maneuver.noteKeys.map(localize)
  });

  await createManeuverMessageAfterDice({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: buildContent(),
    rolls: [roll],
    flags: maneuverLogFlags({ actor, targetActor, maneuver, success, result, formula: `${attributeLabel(maneuver.actingAttribute)} ← ${attributeLabel("defense")}` }),
    finalize: async () => {
      const effectMessages = await applyAttackManeuverEffects(actor, targetActor, maneuver, success);
      const extraRows = [];
      if (maneuver.id === "shove" && success) {
        const damageResult = await resolveShoveDamage(targetActor, maneuver);
        if (damageResult) {
          extraRows.push(
            [game.i18n.localize("TENEBRE.Maneuvers.NormalDamageValue"), String(damageResult.normalDamage)],
            [game.i18n.localize("TENEBRE.Maneuvers.HalfDamageValue"), String(damageResult.appliedDamage)]
          );
          effectMessages.push(damageResult.message);
        }
      }
      return buildContent(effectMessages, extraRows);
    }
  });

  return { success, result, diceTarget };
}

async function rollKnockdownManeuver(actor, maneuver, modifier) {
  const targetActor = getSingleTargetActor();
  if (!targetActor) return null;

  const actorValue = getAttributeValue(actor, maneuver.actingAttribute);
  const targetValue = getAttributeValue(targetActor, maneuver.targetAttribute);
  const robustModifier = getRobustGrappleBonus(actor);
  const finalModifier = modifier + robustModifier;
  const diceTarget = clampDiceTarget(actorValue + (10 - targetValue) + finalModifier);
  const attackRoll = await evaluateRoll("1d20");
  const attackResult = rollTotal(attackRoll);
  const success = attackResult <= diceTarget;
  const quickValue = getAttributeValue(actor, "quick");
  const quickTarget = clampDiceTarget(quickValue);
  const quickRoll = await evaluateRoll("1d20");
  const quickResult = rollTotal(quickRoll);
  const staysStanding = quickResult <= quickTarget;
  const buildContent = (effectMessages = []) => buildChatCard({
    actor,
    targetActor,
    maneuver,
    rows: [
      [game.i18n.localize("TENEBRE.Maneuvers.Test"), `${attributeLabel(maneuver.actingAttribute)} (${actorValue}) <= ${attributeLabel(maneuver.targetAttribute)} (${targetValue})`],
      [game.i18n.localize("TENEBRE.Maneuvers.Modifier"), signedNumber(finalModifier)],
      ...(robustModifier ? [[game.i18n.localize("TENEBRE.Maneuvers.ActorRobust"), signedNumber(robustModifier)]] : []),
      [game.i18n.localize("TENEBRE.Maneuvers.Roll"), `${attackResult}/${diceTarget}`],
      [game.i18n.localize("TENEBRE.Maneuvers.Result"), success
        ? game.i18n.localize("TENEBRE.Maneuvers.Success")
        : game.i18n.localize("TENEBRE.Maneuvers.Failure")],
      [game.i18n.localize("TENEBRE.Maneuvers.QuickStayStanding"), `${quickResult}/${quickTarget}`],
      [game.i18n.localize("TENEBRE.Maneuvers.StandingResult"), staysStanding
        ? game.i18n.localize("TENEBRE.Maneuvers.StaysStanding")
        : game.i18n.localize("TENEBRE.Maneuvers.FallsDown")],
      ...effectRows(effectMessages)
    ],
    success,
    notes: maneuver.noteKeys.map(localize)
  });

  await createManeuverMessageAfterDice({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: buildContent(),
    rolls: [attackRoll, quickRoll],
    flags: maneuverLogFlags({ actor, targetActor, maneuver, success, result: attackResult, formula: `${attributeLabel(maneuver.actingAttribute)} ← ${attributeLabel(maneuver.targetAttribute)}` }),
    finalize: async () => buildContent(await applyKnockdownManeuverEffects(actor, targetActor, success, staysStanding))
  });

  return { success, result: attackResult, diceTarget, staysStanding };
}

async function rollAttributeManeuver(actor, maneuver, modifier) {
  const actorValue = getAttributeValue(actor, maneuver.actingAttribute);
  const diceTarget = clampDiceTarget(actorValue + modifier);
  const roll = await evaluateRoll("1d20");
  const result = rollTotal(roll);
  const criticalFailure = maneuver.id === "poisonWeapon" && result === 20;
  const success = !criticalFailure && result <= diceTarget;
  const buildContent = (effectMessages = []) => buildChatCard({
    actor,
    maneuver,
    rows: [
      [game.i18n.localize("TENEBRE.Maneuvers.Test"), `${attributeLabel(maneuver.actingAttribute)} (${actorValue})`],
      [game.i18n.localize("TENEBRE.Maneuvers.Modifier"), signedNumber(modifier)],
      [game.i18n.localize("TENEBRE.Maneuvers.Roll"), `${result}/${diceTarget}`],
      [game.i18n.localize("TENEBRE.Maneuvers.Result"), success
        ? game.i18n.localize("TENEBRE.Maneuvers.Success")
        : game.i18n.localize("TENEBRE.Maneuvers.Failure")],
      ...effectRows(effectMessages)
    ],
    success,
    notes: maneuver.noteKeys.map(localize)
  });

  await createManeuverMessageAfterDice({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: buildContent(),
    rolls: [roll],
    flags: maneuverLogFlags({ actor, maneuver, success, result, formula: attributeLabel(maneuver.actingAttribute) }),
    finalize: async () => buildContent(await applyAttributeManeuverEffects(actor, maneuver, success, result))
  });

  return { success, result, diceTarget };
}

async function rollDamageCheck(actor, maneuver, damageValue) {
  const targetActor = getSingleTargetActor();
  if (!targetActor) return null;

  if (!Number.isFinite(damageValue) || damageValue <= 0) {
    damageValue = await promptDamageValue(maneuver);
    if (!damageValue) return null;
  }

  const roll = await evaluateRoll(maneuver.formula);
  const result = rollTotal(roll);
  const success = result < damageValue;
  const buildContent = (effectMessages = []) => buildChatCard({
    actor,
    targetActor,
    maneuver,
    rows: [
      [game.i18n.localize("TENEBRE.Maneuvers.DamageValue"), String(damageValue)],
      [game.i18n.localize("TENEBRE.Maneuvers.Roll"), `${result} < ${damageValue}`],
      [game.i18n.localize("TENEBRE.Maneuvers.Result"), success
        ? game.i18n.localize("TENEBRE.Maneuvers.KnockedOut")
        : game.i18n.localize("TENEBRE.Maneuvers.NotKnockedOut")],
      ...effectRows(effectMessages)
    ],
    success,
    notes: maneuver.noteKeys.map(localize)
  });

  await createManeuverMessageAfterDice({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: buildContent(),
    rolls: [roll],
    flags: maneuverLogFlags({ actor, targetActor, maneuver, success, result, formula: maneuver.formula }),
    finalize: async () => buildContent(await applyDamageCheckEffects(actor, targetActor, maneuver, success))
  });

  return { success, result, damageValue };
}

async function promptDamageValue(maneuver) {
  return promptNumericValue(maneuver, "TENEBRE.Maneuvers.DamageValue");
}

async function promptNumericValue(maneuver, labelKey) {
  const content = `
    <div class="symbaroum dialog tenebre-maneuver-damage-dialog">
      <div class="damagemodifier">
        <label for="tenebre-maneuver-damage-value">${escapeHtml(game.i18n.localize(labelKey))}</label>
        <input type="number" id="tenebre-maneuver-damage-value" value="1" min="1" step="1">
      </div>
    </div>
  `;

  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: localize(maneuver.labelKey) },
    content,
    ok: {
      icon: "fas fa-dice-d20",
      label: game.i18n.localize("TENEBRE.Maneuvers.Roll"),
      callback: (_event, _button, dialog) => {
        return Number(dialog.element.querySelector("#tenebre-maneuver-damage-value")?.value) || 0;
      }
    },
    rejectClose: false
  });

  if (!Number.isFinite(result) || result <= 0) {
    ui.notifications.warn(game.i18n.localize("TENEBRE.Maneuvers.InvalidDamage"));
    return null;
  }

  return result;
}

async function resolveShoveDamage(targetActor, maneuver) {
  const normalDamage = await promptNumericValue(maneuver, "TENEBRE.Maneuvers.NormalDamageValue");
  if (!normalDamage) return null;

  const appliedDamage = Math.ceil(normalDamage / 2);
  const currentToughness = Number(targetActor.system?.health?.toughness?.value ?? 0) || 0;
  const nextToughness = Math.max(0, currentToughness - appliedDamage);

  await SocketService.updateDocument(targetActor, { "system.health.toughness.value": nextToughness });

  return {
    normalDamage,
    appliedDamage,
    message: game.i18n.format("TENEBRE.Maneuvers.ToughnessDamageApplied", {
      actor: targetActor.name,
      damage: appliedDamage,
      before: currentToughness,
      after: nextToughness
    })
  };
}

async function postStatement(actor, maneuver) {
  const effectMessages = await applyStatementEffects(actor, maneuver);
  const content = buildChatCard({
    actor,
    maneuver,
    rows: [
      [game.i18n.localize("TENEBRE.Maneuvers.Action"), game.i18n.localize("TENEBRE.Maneuvers.Declared")],
      ...effectRows(effectMessages)
    ],
    notes: maneuver.noteKeys.map(localize)
  });

  await createChatMessageAfterDice({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    flags: maneuverLogFlags({ actor, maneuver })
  });

  return { success: true };
}

async function createManeuverMessageAfterDice({ speaker, content, rolls = [], flags = {}, finalize = null }) {
  const message = await createChatMessageAfterDice({ speaker, content, rolls, flags });
  if (typeof finalize !== "function") return message;

  await yieldToManeuverChat();
  const finalContent = await finalize();
  if (message && typeof finalContent === "string" && finalContent !== content) {
    await message.update({ content: finalContent });
  }
  return message;
}

async function yieldToManeuverChat() {
  if (typeof globalThis.requestAnimationFrame === "function") {
    await new Promise((resolve) => globalThis.requestAnimationFrame(resolve));
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function maneuverLogFlags({ actor, targetActor = null, maneuver, success = null, result = "", formula = "" }) {
  const outcome = success === true ? "success" : success === false ? "failure" : "info";
  return {
    [MODULE_ID]: {
      gmLogAction: {
        type: "combat.maneuver",
        outcome,
        actorUuid: actor?.uuid ?? "",
        targetUuid: targetActor?.uuid ?? "",
        targetName: targetActor?.name ?? "",
        subjectName: localize(maneuver?.labelKey),
        values: { formula, roll: result }
      }
    }
  };
}

function getSingleTargetActor({ warn = true } = {}) {
  const targets = Array.from(game.user?.targets ?? []);
  if (targets.length !== 1) {
    if (warn) ui.notifications.warn(game.i18n.localize("TENEBRE.Maneuvers.OneTarget"));
    return null;
  }

  const actor = targets[0]?.actor;
  if (!actor) {
    if (warn) ui.notifications.warn(game.i18n.localize("TENEBRE.Maneuvers.OneTarget"));
    return null;
  }

  return actor;
}

function getAttributeValue(actor, attributeName) {
  if (!actor) return 10;
  if (attributeName === "defense") return Number(actor.system?.combat?.defense ?? 10) || 10;
  return Number(actor.system?.attributes?.[attributeName]?.total ?? 10) || 10;
}

async function applyOpposedManeuverEffects(actor, targetActor, maneuver, success) {
  if (maneuver.id === "grapple" && success) {
    return [
      await applyManeuverEffect(targetActor, MANEUVER_EFFECTS.GRAPPLED, { sourceActor: actor }),
      await applyManeuverEffect(actor, MANEUVER_EFFECTS.MAINTAINING_GRAPPLE, { sourceActor: targetActor })
    ].filter(Boolean);
  }

  if (maneuver.id === "grapple" && !success) {
    return [
      await grantFreeAttack(targetActor, actor)
    ].filter(Boolean);
  }

  if (maneuver.id === "disarm" && success) {
    return [
      await applyManeuverEffect(targetActor, MANEUVER_EFFECTS.DISARMED, { sourceActor: actor })
    ].filter(Boolean);
  }

  if (maneuver.id === "disarm" && !success) {
    return [
      await grantFreeAttack(targetActor, actor)
    ].filter(Boolean);
  }

  return [];
}

async function applyDamageCheckEffects(actor, targetActor, maneuver, success) {
  if (maneuver.id === "knockout" && success) {
    return [
      await applyManeuverEffect(targetActor, MANEUVER_EFFECTS.KNOCKED_OUT, { sourceActor: actor })
    ].filter(Boolean);
  }

  return [];
}

async function applyAttackManeuverEffects(actor, targetActor, maneuver, success) {
  if (maneuver.id === "shove" && success) {
    return [
      await applyManeuverEffect(targetActor, MANEUVER_EFFECTS.SHOVED, { sourceActor: actor, rounds: 1 })
    ].filter(Boolean);
  }

  if (maneuver.id === "shove" && !success) {
    return [
      await grantFreeAttack(targetActor, actor)
    ].filter(Boolean);
  }

  if (maneuver.id === "charge") {
    const messages = [
      await applyManeuverEffect(actor, MANEUVER_EFFECTS.CHARGING, { sourceActor: targetActor, rounds: 1 })
    ];
    if (!success) {
      messages.push(await grantFreeAttack(targetActor, actor));
    }
    return messages.filter(Boolean);
  }

  return [];
}

async function applyKnockdownManeuverEffects(actor, targetActor, success, staysStanding) {
  const messages = [];

  if (success) {
    messages.push(await applyManeuverEffect(targetActor, MANEUVER_EFFECTS.KNOCKED_DOWN, { sourceActor: actor }));
  }

  if (!staysStanding) {
    messages.push(await applyManeuverEffect(actor, MANEUVER_EFFECTS.KNOCKED_DOWN, { sourceActor: targetActor }));
  }

  return messages.filter(Boolean);
}

async function applyAttributeManeuverEffects(actor, maneuver, success, result) {
  if (maneuver.id === "poisonWeapon" && result === 20) {
    return [
      await applyManeuverEffect(actor, MANEUVER_EFFECTS.POISONED, { rounds: 3, expiration: "rounds" })
    ].filter(Boolean);
  }

  if (maneuver.id === "poisonWeapon" && success) {
    return [
      await applyManeuverEffect(actor, MANEUVER_EFFECTS.POISONED_WEAPON)
    ].filter(Boolean);
  }

  if (maneuver.id === "takeInitiative") {
    const messages = [
      await applyManeuverEffect(actor, MANEUVER_EFFECTS.TAKING_INITIATIVE, { rounds: 1 })
    ];
    if (success) {
      messages.push(await applyManeuverEffect(actor, MANEUVER_EFFECTS.INITIATIVE_BONUS, { rounds: 1 }));
      messages.push(await applyCombatInitiativeBonus(actor, 5));
    }
    return messages.filter(Boolean);
  }

  return [];
}

async function applyStatementEffects(actor, maneuver) {
  if (maneuver.id === "delayInitiative") {
    return [
      await applyManeuverEffect(actor, MANEUVER_EFFECTS.DELAYED_INITIATIVE, { rounds: 1 })
    ].filter(Boolean);
  }

  if (maneuver.id === "totalDefense") {
    return [
      await applyManeuverEffect(actor, MANEUVER_EFFECTS.TOTAL_DEFENSE, { rounds: 1 })
    ].filter(Boolean);
  }

  if (maneuver.id === "totalOffense") {
    return [
      await applyManeuverEffect(actor, MANEUVER_EFFECTS.TOTAL_OFFENSE, { rounds: 1 })
    ].filter(Boolean);
  }

  if (maneuver.id === "carefulAim") {
    return [
      await applyManeuverEffect(actor, MANEUVER_EFFECTS.CAREFUL_AIM, { rounds: 1 })
    ].filter(Boolean);
  }

  return [];
}

async function grantFreeAttack(targetActor, sourceActor) {
  return applyManeuverEffect(targetActor, MANEUVER_EFFECTS.FREE_ATTACK_OPENING, { sourceActor, rounds: 1 });
}

async function applyManeuverEffect(actor, effectId, { sourceActor = null, rounds = null, expiration = null } = {}) {
  if (!actor) return null;

  const existing = findActorEffect(actor, effectId);
  const effectLabel = effectLabelFor(effectId);
  const effectExpiration = expiration ?? (TURN_END_EFFECTS.has(effectId) ? "turnEnd" : null);

  if (existing) {
    if (rounds && typeof existing.update === "function") {
      await SocketService.updateEmbeddedDocuments(actor, "ActiveEffect", [{
        _id: existing.id,
        duration: getEffectDuration(rounds),
        flags: {
          [MODULE_ID]: getEffectAutomationFlags(effectId, sourceActor, rounds, effectExpiration)
        }
      }], { render: true });
    }
    return game.i18n.format("TENEBRE.Maneuvers.EffectAlreadyActive", { effect: effectLabel, actor: actor.name });
  }

  const base = getStatusEffectData(effectId);
  const effectData = {
    name: effectLabel,
    label: effectLabel,
    img: base.img ?? base.icon,
    icon: base.icon ?? base.img,
    statuses: [effectId],
    duration: getEffectDuration(rounds),
    flags: {
      core: { statusId: effectId },
      [MODULE_ID]: {
        ...getEffectAutomationFlags(effectId, sourceActor, rounds, effectExpiration)
      }
    }
  };

  try {
    await SocketService.createEmbeddedDocuments(actor, "ActiveEffect", [effectData], { render: true });
    return game.i18n.format("TENEBRE.Maneuvers.EffectApplied", { effect: effectLabel, actor: actor.name });
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to apply maneuver effect ${effectId}.`, error);
    return game.i18n.format("TENEBRE.Maneuvers.EffectApplyFailed", { effect: effectLabel, actor: actor.name });
  }
}

async function removeManeuverEffect(actor, effectId) {
  const existing = findActorEffect(actor, effectId);
  if (!existing) return false;
  await prepareManeuverEffectsForRemoval(actor, [existing]);
  await SocketService.deleteEmbeddedDocuments(actor, "ActiveEffect", [existing.id], { render: true });
  return true;
}

async function applyCombatInitiativeBonus(actor, bonus) {
  const combatant = findCombatantForActor(actor);
  if (!combatant || !Number.isFinite(Number(combatant.initiative))) {
    return game.i18n.format("TENEBRE.Maneuvers.InitiativeBonusPending", { bonus: signedNumber(bonus) });
  }

  const previous = Number(combatant.initiative) || 0;
  const next = previous + bonus;
  await SocketService.updateCombatant(combatant, { initiative: next });
  await SocketService.setFlag(actor, MODULE_ID, "maneuverInitiativeBonus", {
    combatId: game.combat.id,
    combatantId: combatant.id,
    previous,
    next,
    bonus
  });
  return game.i18n.format("TENEBRE.Maneuvers.InitiativeBonusApplied", {
    actor: actor.name,
    bonus: signedNumber(bonus),
    before: previous,
    after: next
  });
}

async function prepareManeuverEffectsForRemoval(actor, effects) {
  if (!actor || !effects?.length) return;
  if (effects.some((effect) => getManeuverEffectId(effect) === MANEUVER_EFFECTS.INITIATIVE_BONUS)) {
    await revertTemporaryInitiativeBonus(actor);
  }
}

function getActorsWithManeuverEffects() {
  const actors = [];
  const seen = new Set();

  const addActor = (actor) => {
    if (!actor) return;
    const key = actor.uuid ?? actor.id ?? actor.name;
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    actors.push(actor);
  };

  for (const actor of game.actors ?? []) addActor(actor);
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) addActor(token.actor);
  for (const combatant of game.combat?.combatants ?? []) addActor(combatant.actor);

  return actors.filter((actor) => ManeuverService.hasActiveEffects(actor));
}

async function revertTemporaryInitiativeBonus(actor) {
  if (!actor) return false;
  const data = actor.getFlag?.(MODULE_ID, "maneuverInitiativeBonus");
  if (!data) return false;

  const combat = game.combats?.get?.(data.combatId) ?? game.combat;
  const combatant = combat?.combatants?.get?.(data.combatantId) ?? findCombatantForActor(actor);
  if (combatant && Number.isFinite(Number(combatant.initiative))) {
    const current = Number(combatant.initiative);
    const next = current === Number(data.next)
      ? Number(data.previous)
      : current - (Number(data.bonus) || 0);
    await SocketService.updateCombatant(combatant, { initiative: next });
  }

  await SocketService.unsetFlag(actor, MODULE_ID, "maneuverInitiativeBonus");
  return true;
}

function findCombatantForActor(actor) {
  return game.combat?.combatants?.find?.((combatant) => {
    if (combatant.actor?.id === actor?.id) return true;
    if (combatant.actorId === actor?.id) return true;
    return false;
  }) ?? null;
}

function findActorEffect(actor, effectId) {
  return Array.from(actor?.effects ?? []).find((effect) => {
    if (effect.getFlag?.(MODULE_ID, "effectId") === effectId) return true;
    if (effect.getFlag?.("core", "statusId") === effectId) return true;
    if (effect.flags?.core?.statusId === effectId) return true;
    if (effect.statuses?.has?.(effectId)) return true;
    if (effect.statuses?.includes?.(effectId)) return true;
    return String(effect.id ?? "") === effectId;
  });
}

function isManeuverEffect(effect) {
  if (!effect) return false;
  const effectId = effect.getFlag?.(MODULE_ID, "effectId") ?? effect.flags?.[MODULE_ID]?.effectId;
  if (MANEUVER_EFFECT_IDS.has(effectId)) return true;
  if (effect.getFlag?.(MODULE_ID, "maneuverEffect") === true) return true;
  if (effect.flags?.[MODULE_ID]?.maneuverEffect === true) return true;
  if (effect.statuses) {
    for (const status of effect.statuses) {
      if (MANEUVER_EFFECT_IDS.has(status)) return true;
    }
  }
  return false;
}

function getManeuverEffectId(effect) {
  if (!effect) return null;
  const effectId = effect.getFlag?.(MODULE_ID, "effectId") ?? effect.flags?.[MODULE_ID]?.effectId;
  if (MANEUVER_EFFECT_IDS.has(effectId)) return effectId;
  if (effect.statuses) {
    for (const status of effect.statuses) {
      if (MANEUVER_EFFECT_IDS.has(status)) return status;
    }
  }
  if (MANEUVER_EFFECT_IDS.has(effect.getFlag?.("core", "statusId"))) return effect.getFlag("core", "statusId");
  if (MANEUVER_EFFECT_IDS.has(effect.flags?.core?.statusId)) return effect.flags.core.statusId;
  return null;
}

function getEffectAutomationFlags(effectId, sourceActor, rounds, expiration) {
  const combat = game.combat;
  return {
    maneuverEffect: true,
    effectId,
    sourceActorId: sourceActor?.id ?? null,
    sourceActorName: sourceActor?.name ?? null,
    expiration,
    rounds: rounds ?? null,
    startRound: combat?.round ?? null,
    startTurn: combat?.turn ?? null,
    combatId: combat?.id ?? null,
    ...getMovementAutomationFlags(effectId)
  };
}

function getMovementAutomationFlags(effectId) {
  if ([
    MANEUVER_EFFECTS.GRAPPLED,
    MANEUVER_EFFECTS.MAINTAINING_GRAPPLE,
    MANEUVER_EFFECTS.KNOCKED_DOWN,
    MANEUVER_EFFECTS.KNOCKED_OUT
  ].includes(effectId)) {
    return {
      movementBlocked: true,
      movementActions: 0
    };
  }

  if (effectId === MANEUVER_EFFECTS.CAREFUL_AIM) {
    return {
      movementActions: 0
    };
  }

  return {};
}

function shouldExpireEffect(effect, combat, { forceTurnEffects = false } = {}) {
  const effectId = getManeuverEffectId(effect);
  if (!effectId) return false;

  const configuredExpiration = effect.getFlag?.(MODULE_ID, "expiration") ?? effect.flags?.[MODULE_ID]?.expiration;
  const expiration = configuredExpiration
    ?? (TURN_END_EFFECTS.has(effectId) ? "turnEnd" : null)
    ?? (Number(effect.duration?.rounds) > 0 ? "rounds" : null);
  if (forceTurnEffects && expiration === "turnEnd") return true;
  if (!combat) return false;

  const combatId = effect.getFlag?.(MODULE_ID, "combatId") ?? effect.flags?.[MODULE_ID]?.combatId;
  if (combatId && combat.id !== combatId) return false;

  const startRound = Number(effect.getFlag?.(MODULE_ID, "startRound") ?? effect.flags?.[MODULE_ID]?.startRound ?? effect.duration?.startRound);
  const startTurn = Number(effect.getFlag?.(MODULE_ID, "startTurn") ?? effect.flags?.[MODULE_ID]?.startTurn ?? effect.duration?.startTurn);
  if (!Number.isFinite(startRound) || !Number.isFinite(startTurn)) return false;

  if (expiration === "turnEnd") {
    return combat.round > startRound || combat.turn !== startTurn;
  }

  if (expiration === "rounds") {
    const rounds = Number(effect.getFlag?.(MODULE_ID, "rounds") ?? effect.flags?.[MODULE_ID]?.rounds ?? effect.duration?.rounds);
    return Number.isFinite(rounds) && rounds > 0 && combat.round - startRound >= rounds;
  }

  return false;
}

function getStatusEffectData(effectId) {
  const config = MANEUVER_STATUS_EFFECTS.find((effect) => effect.id === effectId);
  const label = config ? localize(config.labelKey) : effectId;
  const icon = config?.icon ?? "icons/svg/combat.svg";
  return {
    id: effectId,
    _id: effectId,
    name: label,
    label,
    img: icon,
    icon,
    statuses: [effectId],
    flags: {
      [MODULE_ID]: {
        maneuverStatus: true,
        effectId
      }
    }
  };
}

function effectLabelFor(effectId) {
  return getStatusEffectData(effectId).label;
}

function getEffectDuration(rounds) {
  if (!rounds) return {};
  const duration = { rounds };
  if (game.combat) {
    duration.startRound = game.combat.round;
    duration.startTurn = game.combat.turn;
  }
  return duration;
}

function effectRows(messages) {
  return messages?.length
    ? [[game.i18n.localize("TENEBRE.Maneuvers.Effects"), messages.join("; ")]]
    : [];
}

function getRobustGrappleBonus(actor) {
  const robust = Array.from(actor?.items ?? []).find((item) => {
    const reference = String(item.system?.reference ?? "").toLowerCase();
    const name = normalizeText(item.name);
    return reference === "robust" || name === "robust" || name === "robusto";
  });

  if (!robust) return 0;
  if (robust.system?.master?.isActive) return 8;
  if (robust.system?.adept?.isActive) return 4;
  if (robust.system?.novice?.isActive) return 2;
  return 2;
}

function isCurrentMeleeWeaponRoll(actor) {
  const state = game.tenebreResources?.activeManeuverWeaponRoll;
  if (!state || state.actor !== actor) return true;
  return !state.isRanged;
}

function isCurrentRangedWeaponRoll(actor) {
  const state = game.tenebreResources?.activeManeuverWeaponRoll;
  return Boolean(state && state.actor === actor && state.isRanged);
}

function isSuccessfulWeaponResult(result) {
  if (!result) return false;
  if (result.hasSucceed === true || result.hasDamage === true) return true;
  if (Array.isArray(result.rollData)) {
    return result.rollData.some((roll) => roll?.trueActorSucceeded === true || roll?.hasDamage === true);
  }
  return false;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function clampDiceTarget(value) {
  if (getSymbaroumSetting("alwaysSucceedOnOne") || getSymbaroumSetting("optionalCrit") || getSymbaroumSetting("optionalRareCrit")) {
    return Math.min(Math.max(1, value), 19);
  }
  return value;
}

function getSymbaroumSetting(key) {
  try {
    return Boolean(game.settings.get("symbaroum", key));
  } catch (_err) {
    return false;
  }
}

function buildChatCard({ actor, targetActor = null, maneuver, rows, success = null, notes = [] }) {
  const title = localize(maneuver.labelKey);
  const icon = maneuver.icon ?? "fa-dice-d20";
  const resultClass = success === null ? "" : success ? " tenebre-maneuver-success" : " tenebre-maneuver-failure";
  const targetLine = targetActor
    ? `<p><strong>${escapeHtml(game.i18n.localize("TENEBRE.Maneuvers.Target"))}:</strong> ${escapeHtml(targetActor.name)}</p>`
    : "";
  const rowHtml = rows.map(([label, value]) => `
    <li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>
  `).join("");
  const notesHtml = notes.length
    ? `<ul class="tenebre-maneuver-notes">${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>`
    : "";

  return `
    <div class="tenebre-chat-card tenebre-maneuver-card${resultClass}">
      <h3><i class="fas ${icon}"></i> ${escapeHtml(title)}</h3>
      <p><strong>${escapeHtml(game.i18n.localize("TENEBRE.Maneuvers.Actor"))}:</strong> ${escapeHtml(actor.name)}</p>
      ${targetLine}
      <ul>${rowHtml}</ul>
      ${notesHtml}
    </div>
  `;
}

function attributeLabel(attributeName) {
  return ATTRIBUTE_LABELS[attributeName] ?? attributeName;
}

function localize(key) {
  return game.i18n.localize(key);
}

function signedNumber(value) {
  if (!value) return "0";
  return value > 0 ? `+${value}` : String(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
