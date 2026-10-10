import { MODULE_ID } from "./constants.mjs";
import { TenebreSettings } from "./settings.mjs";
import { escapeHtml } from "./utils.mjs";
import { evaluateRoll, rollTotal } from "./dice.mjs";
import { SocketService } from "./sockets.mjs";

export const HUNGER_STATUS_ID = "hunger";
export const HUNGER_EFFECT_ID = "tenebreHunger001";
export const HUNGER_STATUS_ALIASES = new Set(["hunger", "fome"]);
export const HUNGER_ICON = `modules/${MODULE_ID}/assets/icons/hunger.svg`;
const STRONG_PENALTY_FLAG = "hungerStrongPenalty";

export class HungerService {
  static registerStatusEffect() {
    if (!TenebreSettings.get("enableHunger")) return;

    const effect = {
      _id: HUNGER_EFFECT_ID,
      id: HUNGER_STATUS_ID,
      name: game.i18n.localize("TENEBRE.Hunger.EffectName") || "Fome",
      label: game.i18n.localize("TENEBRE.Hunger.EffectName") || "Fome",
      img: HUNGER_ICON,
      statuses: [HUNGER_STATUS_ID, "fome"],
      description: game.i18n.localize("TENEBRE.Hunger.EffectDescription"),
      flags: {
        [MODULE_ID]: {
          hunger: true,
          naturalHealing: false,
          successTestsDisfavour: true,
          movementMultiplier: 0.5
        }
      }
    };

    const existingIndex = CONFIG.statusEffects.findIndex((statusEffect) => {
      return statusEffect.id === HUNGER_STATUS_ID
        || statusEffect._id === HUNGER_STATUS_ID
        || statusEffect._id === HUNGER_EFFECT_ID
        || statusEffect.statuses?.includes?.(HUNGER_STATUS_ID)
        || statusEffect.statuses?.has?.(HUNGER_STATUS_ID);
    });

    if (existingIndex >= 0) {
      CONFIG.statusEffects[existingIndex] = effect;
    } else {
      CONFIG.statusEffects.push(effect);
    }
  }

  static unregisterStatusEffect() {
    const existingIndex = CONFIG.statusEffects.findIndex((statusEffect) => {
      return statusEffect.id === HUNGER_STATUS_ID
        || statusEffect._id === HUNGER_EFFECT_ID
        || statusEffect.statuses?.includes?.(HUNGER_STATUS_ID)
        || statusEffect.statuses?.has?.(HUNGER_STATUS_ID);
    });

    if (existingIndex >= 0) {
      CONFIG.statusEffects.splice(existingIndex, 1);
    }
  }

  static hasHunger(actor) {
    if (!TenebreSettings.get("enableHunger")) return false;
    return Array.from(actor?.effects ?? []).some((effect) => HungerService.isHungerEffect(effect));
  }

  static registerHooks() {
    Hooks.on("createActiveEffect", async (effect) => {
      if (!TenebreSettings.get("enableHunger")) return;
      if (!HungerService.isHungerEffect(effect)) return;
      if (!HungerService.#isChatAuthor()) return;

      const actor = effect.parent;
      if (!actor || actor.documentName !== "Actor") return;
      await HungerService.postAppliedMessage(actor);
    });

    Hooks.on("deleteActiveEffect", async (effect, _options, userId) => {
      // deleteActiveEffect dispara em todos os clientes; só quem removeu publica no chat.
      if (userId !== game.user?.id) return;
      if (!TenebreSettings.get("enableHunger")) return;
      if (!HungerService.isHungerEffect(effect)) return;
      const actor = effect.parent;
      if (!actor || actor.documentName !== "Actor") return;
      await HungerService.postRemovedMessage(actor);
    });
  }

  static isHungerEffect(effect) {
    if (!effect) return false;
    if (effect.getFlag?.(MODULE_ID, "hunger") === true) return true;
    if (effect.flags?.[MODULE_ID]?.hunger === true) return true;
    if (HUNGER_STATUS_ALIASES.has(String(effect.id ?? "").toLowerCase())) return true;
    if (HUNGER_STATUS_ALIASES.has(String(effect.name ?? "").toLowerCase())) return true;
    if (HUNGER_STATUS_ALIASES.has(String(effect.label ?? "").toLowerCase())) return true;
    if (HUNGER_STATUS_ALIASES.has(String(effect.statuses ?? "").toLowerCase())) return true;
    if (effect.statuses) {
      for (const status of effect.statuses) {
        if (HUNGER_STATUS_ALIASES.has(String(status).toLowerCase())) return true;
      }
    }
    return false;
  }

  static applyDisfavour(favour, actor) {
    if (!HungerService.hasHunger(actor)) return favour;
    return Math.min(Number(favour) || 0, -1);
  }

  static naturalHealingAllowed(actor) {
    return !HungerService.hasHunger(actor);
  }

  static getMovementMultiplier(actor) {
    return HungerService.hasHunger(actor) ? 0.5 : 1;
  }

  static getStrongPenalty(actor) {
    return Number(actor?.getFlag?.(MODULE_ID, STRONG_PENALTY_FLAG) ?? 0) || 0;
  }

  static getStrongTotal(actor) {
    return Number(actor?.system?.attributes?.strong?.total ?? 0) || 0;
  }

  static async applyStrongPenalty(actor, amount = -1) {
    if (!actor || amount === 0) return HungerService.getStrongPenalty(actor);

    const currentPenalty = HungerService.getStrongPenalty(actor);
    const nextPenalty = currentPenalty + amount;
    const currentTemporaryMod = Number(actor.system?.attributes?.strong?.temporaryMod ?? 0) || 0;

    await SocketService.updateDocument(actor, {
      "system.attributes.strong.temporaryMod": currentTemporaryMod + amount,
      [`flags.${MODULE_ID}.${STRONG_PENALTY_FLAG}`]: nextPenalty
    });

    return nextPenalty;
  }

  static async clearStrongPenalty(actor) {
    const penalty = HungerService.getStrongPenalty(actor);
    if (!actor || penalty === 0) return;

    const currentTemporaryMod = Number(actor.system?.attributes?.strong?.temporaryMod ?? 0) || 0;
    await SocketService.updateDocument(actor, {
      "system.attributes.strong.temporaryMod": currentTemporaryMod - penalty,
      [`flags.${MODULE_ID}.-=${STRONG_PENALTY_FLAG}`]: null
    });
  }

  static async recoverStrongPenalty(actor, amount = 1, { source = "" } = {}) {
    if (!actor || amount <= 0) return 0;
    if (HungerService.hasHunger(actor)) {
      ui.notifications.warn(game.i18n.localize("TENEBRE.Hunger.RecoveryBlocked"));
      return 0;
    }

    const penalty = HungerService.getStrongPenalty(actor);
    if (penalty >= 0) return 0;

    const recovered = Math.min(Math.floor(Number(amount) || 0), Math.abs(penalty));
    if (recovered <= 0) return 0;

    const currentTemporaryMod = Number(actor.system?.attributes?.strong?.temporaryMod ?? 0) || 0;
    const nextPenalty = penalty + recovered;
    const updates = {
      "system.attributes.strong.temporaryMod": currentTemporaryMod + recovered
    };

    if (nextPenalty < 0) {
      updates[`flags.${MODULE_ID}.${STRONG_PENALTY_FLAG}`] = nextPenalty;
    } else {
      updates[`flags.${MODULE_ID}.-=${STRONG_PENALTY_FLAG}`] = null;
    }

    await SocketService.updateDocument(actor, updates);
    await HungerService.postRecoveryMessage(actor, recovered, source);
    return recovered;
  }

  static async postAppliedMessage(actor) {
    const actorName = escapeHtml(actor?.name ?? game.i18n.localize("TOKEN.Actor"));
    const actorImg = escapeHtml(actor?.img ?? "icons/svg/mystery-man.svg");
    const effectName = escapeHtml(game.i18n.localize("TENEBRE.Hunger.EffectName") || "Fome");
    const effectImg = HUNGER_ICON;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="tenebre-chat-card tenebre-hunger-card">
          <div style="display:flex; gap:10px; align-items:center;">
            <img src="${actorImg}" alt="${actorName}" style="width:48px; height:48px; object-fit:cover; border:1px solid #6b4d2e;">
            <div>
              <h3 style="margin:0 0 4px;">${game.i18n.format("TENEBRE.Hunger.AppliedTitle", { actor: actorName })}</h3>
              <div style="display:flex; gap:6px; align-items:center;">
                <img src="${effectImg}" alt="${effectName}" style="width:24px; height:24px; object-fit:cover; border:0;">
                <span>${game.i18n.localize("TENEBRE.Hunger.AppliedBody")}</span>
              </div>
            </div>
          </div>
        </div>
      `
    });
  }

  static async postRemovedMessage(actor) {
    const penalty = HungerService.getStrongPenalty(actor);
    if (!penalty) return;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="tenebre-chat-card tenebre-hunger-card">
          <h3>${game.i18n.format("TENEBRE.Hunger.RemovedTitle", { actor: escapeHtml(actor.name) })}</h3>
          <p>${game.i18n.format("TENEBRE.Hunger.RemovedBody", { penalty: Math.abs(penalty) })}</p>
        </div>
      `
    });
  }

  static async postRecoveryMessage(actor, amount, source = "") {
    const sourceText = String(source || "").trim();
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="tenebre-chat-card tenebre-hunger-card">
          <h3>${game.i18n.format("TENEBRE.Hunger.RecoveryTitle", { actor: escapeHtml(actor.name) })}</h3>
          <p>${game.i18n.format("TENEBRE.Hunger.RecoveryBody", {
            amount,
            source: escapeHtml(sourceText || game.i18n.localize("TENEBRE.Hunger.RecoverySourceGeneric"))
          })}</p>
        </div>
      `
    });
  }

  static async markDead(actor) {
    if (!actor) return;
    if (!game.user?.isGM && SocketService.active && SocketService.hasActiveGM()) {
      try {
        await SocketService.markActorDead(actor);
        return;
      } catch (error) {
        console.warn(`${MODULE_ID} | Failed to mark actor dead through socketlib; falling back to local handling.`, error);
      }
    }

    if (HungerService.#hasDeadCondition(actor)) {
      await HungerService.#markActiveTokensDead(actor);
      return;
    }

    let applied = false;

    if (typeof actor.toggleStatusEffect === "function") {
      try {
        await actor.toggleStatusEffect("dead", { active: true });
        applied = true;
      } catch (error) {
        console.warn(`${MODULE_ID} | Failed to apply dead status through toggleStatusEffect. Falling back to addCondition.`, error);
      }
    }

    if (!applied && typeof actor.addCondition === "function") {
      await actor.addCondition("dead");
      applied = true;
    }

    const deadEffect = CONFIG.statusEffects.find((effect) => effect.id === "dead");
    if (!applied && deadEffect && typeof actor.createEmbeddedDocuments === "function") {
      const effectData = foundry.utils.duplicate(deadEffect);
      await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
    }

    await HungerService.#markActiveTokensDead(actor);
  }

  static async rollStarvationDay(strongTotal) {
    const target = Number(strongTotal) || 0;
    const rollObject1 = await evaluateRoll("1d20");
    const rollObject2 = await evaluateRoll("1d20");
    const roll1 = rollTotal(rollObject1);
    const roll2 = rollTotal(rollObject2);
    const selectedRoll = Math.max(roll1, roll2);
    const success = selectedRoll <= target;
    const nextStrong = success ? target : target - 1;

    return {
      rolls: [roll1, roll2],
      rollObjects: [rollObject1, rollObject2],
      selectedRoll,
      target,
      success,
      nextStrong,
      dead: nextStrong <= 0
    };
  }

  static #isChatAuthor() {
    if (!game.user?.isGM) return false;
    const activeGm = game.users?.activeGM;
    return !activeGm || activeGm.id === game.user.id;
  }

  static #hasDeadCondition(actor) {
    return Array.from(actor?.effects ?? []).some((effect) => {
      if (effect.statuses?.has?.("dead")) return true;
      if (effect.statuses?.includes?.("dead")) return true;
      if (effect.flags?.core?.statusId === "dead") return true;
      return String(effect.id ?? "").toLowerCase() === "dead";
    });
  }

  static async #markActiveTokensDead(actor) {
    const deadEffect = CONFIG.statusEffects.find((effect) => effect.id === "dead");
    const tokens = actor?.getActiveTokens?.() ?? [];

    for (const token of tokens) {
      if (deadEffect && typeof token.toggleEffect === "function") {
        try {
          await token.toggleEffect(foundry.utils.duplicate(deadEffect), { overlay: true, active: true });
        } catch (error) {
          console.warn(`${MODULE_ID} | Failed to mark token dead overlay.`, error);
        }
      }

      const combatant = game.combat?.combatants?.find?.((candidate) => {
        return candidate.tokenId === token.id
          || candidate.token?.id === token.id
          || candidate.actor?.id === actor.id;
      });
      if (combatant && !combatant.defeated && typeof combatant.update === "function") {
        await SocketService.updateCombatant(combatant, { defeated: true });
      }
    }
  }
}
