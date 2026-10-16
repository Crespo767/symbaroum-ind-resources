import { MODULE_ID } from "./constants.mjs";
import { RollPrivacyService } from "./roll-privacy.mjs";

let diceHooksRegistered = false;
export function registerDiceHooks() {
  if (diceHooksRegistered) return;
  diceHooksRegistered = true;
  Hooks.on("diceSoNiceMessageProcessed", (messageId, processing) => {
    const message = globalThis.game?.messages?.get?.(messageId);
    if (message?.flags?.[MODULE_ID]?.diceAnimationShown) processing.willTrigger3DRoll = false;
  });
}

export async function evaluateRoll(formula) {
  if (globalThis.Roll) {
    const roll = new Roll(formula);
    await roll.evaluate();
    return roll;
  }

  return createFallbackRoll(formula);
}

export function rollTotal(roll) {
  return Number(roll?.total ?? 0) || 0;
}

export async function createChatMessageAfterDice({ speaker, content, rolls = [], flags = {}, privateRoll = null, rollMode = null, rollUser = globalThis.game?.user }) {
  const foundryRolls = rolls.filter(isFoundryRoll);
  const visibility = getRollVisibility(privateRoll, rollMode, rollUser);
  const showed3d = await showDice3d(foundryRolls, visibility, rollUser);
  const chatData = { speaker, content };
  if (rollUser?.id) chatData.user = rollUser.id;
  const moduleFlags = { ...(flags?.[MODULE_ID] ?? {}) };
  const otherFlags = Object.fromEntries(
    Object.entries(flags ?? {}).filter(([scope]) => scope !== MODULE_ID)
  );

  if (foundryRolls.length) {
    chatData.rolls = foundryRolls;
    if (!showed3d) chatData.sound = globalThis.CONFIG?.sounds?.dice;
    else moduleFlags.diceAnimationShown = true;
  }

  if (foundryRolls.length || rollMode !== null) {
    moduleFlags.privateRollCandidate = true;
    if (visibility.blind) moduleFlags.privateRoll = true;
    Object.assign(chatData, visibility);
  }

  if (Object.keys(otherFlags).length || Object.keys(moduleFlags).length) {
    chatData.flags = { ...otherFlags, [MODULE_ID]: moduleFlags };
  }

  return ChatMessage.create(chatData);
}

export async function showDice3dRoll(roll, { privateRoll = null } = {}) {
  return showDice3d([roll].filter(Boolean), getRollVisibility(privateRoll));
}

function isFoundryRoll(roll) {
  return Boolean(globalThis.Roll && roll instanceof Roll);
}

export function getRollMode(privateRoll = null) {
  const explicitPrivate = privateRoll === true
    || (privateRoll === null && RollPrivacyService.isPrivateRollActive());
  let rollMode = "publicroll";
  try {
    const configured = globalThis.game?.settings?.get?.("core", "rollMode");
    if (["publicroll", "gmroll", "blindroll", "selfroll"].includes(configured)) rollMode = configured;
  } catch (_error) {
    // Sem setting do core disponível, mantém o padrão público.
  }
  if (explicitPrivate) rollMode = "blindroll";

  return rollMode;
}

export function getRollVisibility(privateRoll = null, requestedMode = null, rollUser = globalThis.game?.user) {
  const rollMode = requestedMode ?? getRollMode(privateRoll);
  const visibility = {};
  if (typeof globalThis.ChatMessage?.applyRollMode === "function") {
    ChatMessage.applyRollMode(visibility, rollMode);
  } else {
    // Fallback para ambientes sem a classe de documento do core.
    visibility.whisper = rollMode === "publicroll" ? []
      : rollMode === "selfroll" ? [rollUser.id]
        : Array.from(globalThis.game?.users ?? []).filter(user => user.isGM).map(user => user.id);
    visibility.blind = rollMode === "blindroll";
  }
  // applyRollMode usa o usuário do executor; uma requisição remota mantém seu autor.
  if (rollMode === "selfroll") visibility.whisper = [rollUser.id];
  return visibility;
}

async function showDice3d(rolls, { whisper = [], blind = false } = {}, rollUser = globalThis.game?.user) {
  const dice3d = globalThis.game?.dice3d;
  if (!rolls.length || typeof dice3d?.showForRoll !== "function") return false;

  try {
    for (const roll of rolls) {
      const recipients = whisper.length ? whisper : null;
      await Promise.resolve(dice3d.showForRoll(roll, rollUser, true, recipients, blind));
    }
    return true;
  } catch (error) {
    console.warn("symbaroum-ind-resources | Dice 3D animation failed. Falling back to chat roll.", error);
    return false;
  }
}

function createFallbackRoll(formula) {
  const match = String(formula).trim().match(/^1d(\d+)$/i);
  if (!match) {
    return { total: 0, formula };
  }

  const sides = Number(match[1]) || 20;
  return {
    total: Math.floor(Math.random() * sides) + 1,
    formula
  };
}
