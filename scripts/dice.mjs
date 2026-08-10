import { MODULE_ID } from "./constants.mjs";
import { RollPrivacyService } from "./roll-privacy.mjs";

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

export async function createChatMessageAfterDice({ speaker, content, rolls = [], flags = {}, privateRoll = null }) {
  const foundryRolls = rolls.filter(isFoundryRoll);
  const effectivePrivateRoll = privateRoll === null
    ? RollPrivacyService.isPrivateRollActive()
    : privateRoll === true;
  const showed3d = await showDice3d(foundryRolls, { privateRoll: effectivePrivateRoll });
  const chatData = { speaker, content };
  const moduleFlags = { ...(flags?.[MODULE_ID] ?? {}) };
  const otherFlags = Object.fromEntries(
    Object.entries(flags ?? {}).filter(([scope]) => scope !== MODULE_ID)
  );

  if (foundryRolls.length && !showed3d) {
    chatData.rolls = foundryRolls;
    chatData.sound = globalThis.CONFIG?.sounds?.dice;
  }

  if (foundryRolls.length) {
    moduleFlags.privateRollCandidate = true;
  }

  if (Object.keys(otherFlags).length || Object.keys(moduleFlags).length) {
    chatData.flags = { ...otherFlags, [MODULE_ID]: moduleFlags };
  }

  if (foundryRolls.length) {
    RollPrivacyService.prepareChatData(chatData, { rollCandidate: true });
  }

  if (foundryRolls.length && effectivePrivateRoll) {
    chatData.whisper = Array.from(globalThis.game?.users ?? []).filter((user) => user.isGM).map((user) => user.id);
    chatData.blind = true;
    moduleFlags.privateRoll = true;
  }

  return ChatMessage.create(chatData);
}

export async function showDice3dRoll(roll, { privateRoll = false } = {}) {
  return showDice3d([roll].filter(Boolean), { privateRoll });
}

function isFoundryRoll(roll) {
  return Boolean(globalThis.Roll && roll instanceof Roll);
}

async function showDice3d(rolls, { privateRoll = false } = {}) {
  const dice3d = globalThis.game?.dice3d;
  if (!rolls.length || typeof dice3d?.showForRoll !== "function") return false;

  try {
    for (const roll of rolls) {
      const recipients = privateRoll
        ? Array.from(globalThis.game?.users ?? []).filter((user) => user.isGM)
        : null;
      await Promise.resolve(dice3d.showForRoll(roll, game.user, true, recipients, privateRoll));
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
