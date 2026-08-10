import { MODULE_ID } from "./constants.mjs";
import { SocketService } from "./sockets.mjs";

const SYSTEM_ID = "symbaroum";
const SYSTEM_ACTIONS_FLAG = "applyEffects";
const MODULE_CHOICE_FLAG = "painThresholdChoice";
const SOCKET_HANDLER = "resolvePainThresholdChoice";
const CHOICE_FALL = "fall";
const CHOICE_FREE_ATTACK = "freeAttack";
const REVEAL_MINIMUM_DELAY_MS = 500;
const REVEAL_FALLBACK_DELAY_MS = 900;
const REVEAL_MAXIMUM_WAIT_MS = 12000;

export class PainThresholdChoiceService {
  static #registered = false;

  static register() {
    if (this.#registered) return;
    this.#registered = true;

    SocketService.registerHandler(SOCKET_HANDLER, resolvePainThresholdChoiceAsGm);

    Hooks.on("preCreateChatMessage", (message, data) => {
      preparePainThresholdChoice(message, data);
    });

    Hooks.on("createChatMessage", (message) => {
      if (!SocketService.isPrimaryGM()) return;
      if (!message.getFlag?.(MODULE_ID, MODULE_CHOICE_FLAG)) return;
      void createPainThresholdPrompt(message).catch(async (error) => {
        console.error(`${MODULE_ID} | Failed to create the Pain Threshold choice prompt.`, error);
        await restoreDefaultFallChoice(message);
      });
    });

    Hooks.on("renderChatMessageHTML", (message, html) => {
      bindPainThresholdUi(message, html);
    });

    Hooks.on("deleteChatMessage", (message) => {
      if (!SocketService.isPrimaryGM()) return;
      const promptChoice = message.getFlag?.(MODULE_ID, MODULE_CHOICE_FLAG);
      if (promptChoice?.kind !== "prompt" || promptChoice.state !== "pending") return;
      const applyMessage = game.messages?.get?.(promptChoice.applyMessageId);
      if (applyMessage) void restoreDefaultFallChoice(applyMessage);
    });
  }
}

export function extractPainThresholdActions(actions) {
  if (!Array.isArray(actions)) return null;
  let proneAction = null;
  const remainingActions = [];

  for (const action of actions) {
    if (!proneAction && statusEffectId(action?.addEffect) === "prone") {
      proneAction = foundryClone(action);
      const remaining = foundryClone(action);
      delete remaining.addEffect;
      delete remaining.effectDuration;
      delete remaining.overlay;
      if (hasActionOperation(remaining)) remainingActions.push(remaining);
      continue;
    }
    remainingActions.push(foundryClone(action));
  }

  if (!proneAction) return null;
  const targetTokenId = proneAction.tokenId ?? null;
  const targetActorId = proneAction.actorId ?? null;
  const hasDamage = remainingActions.some((action) => {
    const sameTarget = targetTokenId
      ? action?.tokenId === targetTokenId
      : targetActorId && action?.actorId === targetActorId;
    return sameTarget && (Number(action?.toughnessChange) < 0 || Number(action?.attributeChange) < 0);
  });
  if (!hasDamage) return null;

  return { proneAction, remainingActions, targetTokenId, targetActorId };
}

export function selectPainChoiceRecipients(users, targetActor, attackerActor, ownerLevel = 3) {
  const activeUsers = Array.from(users ?? []).filter((user) => user?.active);
  const targetOwners = activeUsers.filter((user) => !user.isGM && ownsActor(targetActor, user, ownerLevel));
  if (targetOwners.length) return targetOwners.map((user) => user.id);

  const attackerOwners = activeUsers.filter((user) => !user.isGM && ownsActor(attackerActor, user, ownerLevel));
  if (attackerOwners.length) return attackerOwners.map((user) => user.id);

  return activeUsers.filter((user) => user.isGM).map((user) => user.id);
}

export function buildPainThresholdPromptHtml({ targetName, attackerName }) {
  const intro = format("TENEBRE.PainThreshold.Prompt", "{target} ultrapassou o Limiar de Dor.", { target: targetName });
  const question = localize("TENEBRE.PainThreshold.Question", "Escolha a consequência:");
  const fall = localize("TENEBRE.PainThreshold.Fall", "Cair");
  const freeAttack = format(
    "TENEBRE.PainThreshold.FreeAttack",
    "Conceder Ataque Livre a {attacker}",
    { attacker: attackerName || localize("TENEBRE.PainThreshold.Attacker", "o atacante") }
  );
  return `<div class="symbaroum chat ability tenebre-pain-threshold-prompt">
    <div class="foreground">
      <h4>${escapeHtml(intro)}</h4>
      <p>${escapeHtml(question)}</p>
      <div class="tenebre-pain-threshold-actions">
        <button type="button" data-tenebre-pain-choice="${CHOICE_FALL}">${escapeHtml(fall)}</button>
        <button type="button" data-tenebre-pain-choice="${CHOICE_FREE_ATTACK}">${escapeHtml(freeAttack)}</button>
      </div>
    </div>
  </div>`;
}

export async function waitForPainThresholdReveal(messageId, {
  dice3d = globalThis.game?.dice3d,
  minimumDelayMs = REVEAL_MINIMUM_DELAY_MS,
  fallbackDelayMs = REVEAL_FALLBACK_DELAY_MS,
  maximumWaitMs = REVEAL_MAXIMUM_WAIT_MS
} = {}) {
  const minimumDelay = Math.max(0, Number(minimumDelayMs) || 0);
  const fallbackDelay = Math.max(minimumDelay, Number(fallbackDelayMs) || 0);
  const waitForAnimation = dice3d?.waitFor3DAnimationByMessageID;
  if (!messageId || typeof waitForAnimation !== "function") {
    await delay(fallbackDelay);
    return false;
  }

  const animation = settleAnimationWait(
    () => waitForAnimation.call(dice3d, messageId),
    Math.max(fallbackDelay, Number(maximumWaitMs) || 0)
  );
  await delay(minimumDelay);
  const completed = await animation;
  if (!completed && fallbackDelay > minimumDelay) {
    await delay(fallbackDelay - minimumDelay);
  }
  return completed;
}

function preparePainThresholdChoice(message, data) {
  if (!SocketService.isPrimaryGM()) return false;
  const flagPath = `flags.${SYSTEM_ID}.${SYSTEM_ACTIONS_FLAG}`;
  const actions = data?.[flagPath]
    ?? foundry.utils.getProperty(data, flagPath)
    ?? message.getFlag?.(SYSTEM_ID, SYSTEM_ACTIONS_FLAG);
  const extracted = extractPainThresholdActions(actions);
  if (!extracted) return false;

  const targetActor = actorFromAction(extracted.proneAction);
  if (!targetActor) return false;
  const attackContext = findLatestPainAttackContext(targetActor, extracted.targetTokenId);
  const attackerActor = attackContext?.actor ?? null;
  if (!attackerActor) return false;
  const recipientIds = selectPainChoiceRecipients(
    game.users,
    targetActor,
    attackerActor,
    globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3
  );
  if (!recipientIds.length) return false;

  const choiceId = foundry.utils.randomID();
  message.updateSource({
    [`flags.${SYSTEM_ID}.${SYSTEM_ACTIONS_FLAG}`]: extracted.remainingActions,
    [`flags.${MODULE_ID}.${MODULE_CHOICE_FLAG}`]: {
      kind: "apply",
      state: "pending",
      choiceId,
      promptMessageId: null,
      proneAction: extracted.proneAction,
      targetActorUuid: targetActor.uuid,
      targetName: targetActor.name,
      attackerActorUuid: attackerActor?.uuid ?? null,
      attackerName: attackerActor?.name ?? attackContext?.name ?? null,
      diceMessageId: attackContext?.messageId ?? null,
      recipientIds
    }
  });
  return true;
}

async function createPainThresholdPrompt(applyMessage) {
  let pending = applyMessage.getFlag(MODULE_ID, MODULE_CHOICE_FLAG);
  if (!pending || pending.kind !== "apply" || pending.state !== "pending") return null;

  await waitForPainThresholdReveal(pending.diceMessageId);
  if (game.messages?.get && !game.messages.get(applyMessage.id)) return null;
  pending = applyMessage.getFlag(MODULE_ID, MODULE_CHOICE_FLAG);
  if (!pending || pending.kind !== "apply" || pending.state !== "pending") return null;

  const prompt = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ alias: localize("DIALOG.SYSTEM_MESSAGE", "Symbaroum") }),
    whisper: pending.recipientIds,
    content: buildPainThresholdPromptHtml({
      targetName: pending.targetName,
      attackerName: pending.attackerName
    }),
    flags: {
      [MODULE_ID]: {
        [MODULE_CHOICE_FLAG]: {
          kind: "prompt",
          state: "pending",
          choiceId: pending.choiceId,
          applyMessageId: applyMessage.id,
          recipientIds: pending.recipientIds
        }
      }
    }
  });

  await applyMessage.setFlag(MODULE_ID, MODULE_CHOICE_FLAG, {
    ...pending,
    promptMessageId: prompt.id
  });
  return prompt;
}

function bindPainThresholdUi(message, html) {
  const choice = message.getFlag?.(MODULE_ID, MODULE_CHOICE_FLAG);
  if (!choice || choice.state !== "pending") return false;
  const scope = html?.querySelectorAll ? html : html?.[0];
  if (!scope?.querySelectorAll) return false;

  if (choice.kind === "apply") {
    for (const button of scope.querySelectorAll("#applyEffect")) {
      button.disabled = true;
      button.title = localize("TENEBRE.PainThreshold.Waiting", "Aguardando a escolha do Limiar de Dor.");
    }
    return true;
  }

  if (choice.kind !== "prompt") return false;
  for (const button of scope.querySelectorAll("[data-tenebre-pain-choice]")) {
    if (button.dataset.tenebrePainBound === "true") continue;
    button.dataset.tenebrePainBound = "true";
    button.addEventListener("click", async () => {
      const buttons = scope.querySelectorAll("[data-tenebre-pain-choice]");
      for (const candidate of buttons) candidate.disabled = true;
      try {
        await SocketService.executeAsGM(SOCKET_HANDLER, message.id, button.dataset.tenebrePainChoice);
        ui.notifications.info(localize("TENEBRE.PainThreshold.ChoiceRecorded", "Escolha do Limiar de Dor registrada."));
      } catch (error) {
        console.error(`${MODULE_ID} | Failed to resolve the Pain Threshold choice.`, error);
        ui.notifications.error(localize("TENEBRE.PainThreshold.ChoiceFailed", "Não foi possível registrar a escolha do Limiar de Dor."));
        for (const candidate of buttons) candidate.disabled = false;
      }
    });
  }
  return true;
}

async function resolvePainThresholdChoiceAsGm(promptMessageId, choice) {
  if (![CHOICE_FALL, CHOICE_FREE_ATTACK].includes(choice)) throw new Error("Invalid Pain Threshold choice.");
  const requester = requestUser(this);
  const prompt = game.messages?.get?.(promptMessageId);
  const promptChoice = prompt?.getFlag?.(MODULE_ID, MODULE_CHOICE_FLAG);
  if (!prompt || promptChoice?.kind !== "prompt" || promptChoice.state !== "pending") {
    throw new Error("Pain Threshold prompt is no longer pending.");
  }

  const applyMessage = game.messages?.get?.(promptChoice.applyMessageId);
  const pending = applyMessage?.getFlag?.(MODULE_ID, MODULE_CHOICE_FLAG);
  if (!applyMessage || pending?.kind !== "apply" || pending.state !== "pending") {
    throw new Error("Pain Threshold application message is no longer pending.");
  }
  if (pending.choiceId !== promptChoice.choiceId) throw new Error("Pain Threshold choice correlation failed.");
  if (!requester.isGM && !pending.recipientIds?.includes?.(requester.id)) {
    throw new Error("User is not allowed to resolve this Pain Threshold choice.");
  }

  const targetActor = await globalThis.fromUuid?.(pending.targetActorUuid);
  const attackerActor = pending.attackerActorUuid ? await globalThis.fromUuid?.(pending.attackerActorUuid) : null;
  if (!targetActor) throw new Error("Pain Threshold target actor was not found.");

  if (choice === CHOICE_FALL) {
    await applyProne(targetActor);
  } else {
    if (!attackerActor) throw new Error("Pain Threshold attacker actor was not found.");
    const { ManeuverService } = await import("./maneuvers.mjs");
    await ManeuverService.grantFreeAttack(attackerActor, targetActor);
  }

  await applyMessage.unsetFlag(MODULE_ID, MODULE_CHOICE_FLAG);
  await prompt.setFlag(MODULE_ID, MODULE_CHOICE_FLAG, { ...promptChoice, state: "resolved", choice });
  await prompt.delete();
  return true;
}

async function restoreDefaultFallChoice(applyMessage) {
  const pending = applyMessage?.getFlag?.(MODULE_ID, MODULE_CHOICE_FLAG);
  if (!pending || pending.kind !== "apply" || pending.state !== "pending") return false;
  const actions = applyMessage.getFlag(SYSTEM_ID, SYSTEM_ACTIONS_FLAG) ?? [];
  await applyMessage.update({
    [`flags.${SYSTEM_ID}.${SYSTEM_ACTIONS_FLAG}`]: [...actions, pending.proneAction]
  });
  await applyMessage.unsetFlag(MODULE_ID, MODULE_CHOICE_FLAG);
  return true;
}

async function applyProne(actor) {
  if (hasStatus(actor, "prone")) return true;
  if (typeof actor.toggleStatusEffect === "function") {
    await actor.toggleStatusEffect("prone", { active: true, overlay: false });
    return true;
  }
  if (typeof actor.addCondition === "function") {
    await actor.addCondition("prone");
    return true;
  }
  const base = CONFIG.statusEffects?.find?.((effect) => statusEffectId(effect) === "prone");
  if (!base) throw new Error("The prone status effect is unavailable.");
  await actor.createEmbeddedDocuments("ActiveEffect", [foundryClone(base)]);
  return true;
}

function findLatestPainAttackContext(targetActor, targetTokenId) {
  const targetToken = tokenById(targetTokenId);
  const targetNames = [targetToken?.name, targetActor?.name].filter(Boolean).map(normalize);
  const painText = normalize(localize("COMBAT.CHAT_DAMAGE_PAIN", "is stunned by pain"));
  const messages = Array.from(game.messages?.contents ?? game.messages ?? []).reverse();

  for (const message of messages) {
    const text = normalize(stripHtml(message.content ?? ""));
    if (!text || !painText || !text.includes(painText)) continue;
    if (targetNames.length && !targetNames.some((name) => text.includes(name))) continue;
    const actor = actorFromSpeaker(message.speaker);
    return {
      actor,
      name: actor?.name ?? message.speaker?.alias ?? null,
      messageId: message.id ?? null
    };
  }
  return null;
}

function actorFromAction(action) {
  return tokenById(action?.tokenId)?.actor ?? game.actors?.get?.(action?.actorId) ?? null;
}

function actorFromSpeaker(speaker) {
  const token = tokenById(speaker?.token);
  return token?.actor ?? game.actors?.get?.(speaker?.actor) ?? null;
}

function tokenById(tokenId) {
  if (!tokenId) return null;
  return globalThis.canvas?.tokens?.get?.(tokenId)
    ?? globalThis.canvas?.tokens?.placeables?.find?.((token) => token.id === tokenId)
    ?? globalThis.canvas?.tokens?.objects?.children?.find?.((token) => token.id === tokenId)
    ?? null;
}

function requestUser(context) {
  const senderId = context?.socketdata?.userId;
  const user = senderId ? game.users?.get?.(senderId) : null;
  if (!user?.active) throw new Error("Pain Threshold choice has no authenticated active user.");
  return user;
}

function ownsActor(actor, user, ownerLevel) {
  if (!actor || !user) return false;
  try {
    return actor.testUserPermission?.(user, ownerLevel) === true;
  } catch (_error) {
    return Number(actor.ownership?.[user.id] ?? actor.ownership?.default ?? 0) >= ownerLevel;
  }
}

function hasStatus(actor, statusId) {
  if (actor?.statuses?.has?.(statusId)) return true;
  return Array.from(actor?.effects ?? []).some((effect) => statusEffectId(effect) === statusId);
}

function statusEffectId(effect) {
  if (!effect) return null;
  if (effect.statuses?.has?.("prone")) return "prone";
  if (effect.statuses?.includes?.("prone")) return "prone";
  if (effect.flags?.core?.statusId) return effect.flags.core.statusId;
  return typeof effect.id === "string" && !effect._id ? effect.id : null;
}

function hasActionOperation(action) {
  return ["toughnessChange", "attributeChange", "corruptionChange", "addObject", "defeated", "removeEffect"]
    .some((key) => action?.[key] !== undefined);
}

function foundryClone(value) {
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (globalThis.structuredClone) return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function stripHtml(value) {
  return String(value ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(milliseconds) || 0)));
}

function settleAnimationWait(waitForAnimation, maximumWaitMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(false), Math.max(0, Number(maximumWaitMs) || 0));
    try {
      Promise.resolve(waitForAnimation()).then(() => finish(true), () => finish(false));
    } catch (_error) {
      finish(false);
    }
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function localize(key, fallback) {
  const translated = globalThis.game?.i18n?.localize?.(key);
  return translated && translated !== key ? translated : fallback;
}

function format(key, fallback, data) {
  const translated = globalThis.game?.i18n?.format?.(key, data);
  if (translated && translated !== key) return translated;
  return fallback.replace(/\{(\w+)\}/g, (_match, name) => data[name] ?? "");
}
