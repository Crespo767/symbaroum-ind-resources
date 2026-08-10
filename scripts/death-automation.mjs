import { MODULE_ID } from "./constants.mjs";
import { createChatMessageAfterDice, evaluateRoll, rollTotal } from "./dice.mjs";
import { RollPrivacyService } from "./roll-privacy.mjs";
import { SocketService } from "./sockets.mjs";
import { TenebreSettings } from "./settings.mjs";

export const DYING_STATUS_ID = "tenebre-dying";
export const DEATH_STATE_FLAG = "deathState";

const SOCKET_HANDLER = "resolveDeathTest";
const PROMPT_FLAG = "deathTestPrompt";
const OWNER_LEVEL = 3;
const processingActors = new Set();
const knownToughness = new Map();
let registered = false;

export function resolveDeathTestOutcome(total, previousFailures = 0, modifier = 0, enhancedCritical = false) {
  const roll = Math.max(1, Math.min(20, Number(total) || 20));
  const failures = Math.max(0, Math.min(3, Number(previousFailures) || 0));
  const mod = Math.max(-20, Math.min(20, Number(modifier) || 0));
  if (roll === 20) return { kind: "dead", total: roll, failures: 3, critical: true };

  const criticalTarget = enhancedCritical ? Math.max(0, Math.min(19, 1 + mod)) : 1;
  if (roll <= criticalTarget) return { kind: "recovered", total: roll, failures: 0, critical: true };
  if (roll <= Math.max(0, Math.min(19, 10 + mod))) {
    return { kind: "survives", total: roll, failures, critical: false };
  }

  const nextFailures = Math.min(3, failures + 1);
  return {
    kind: nextFailures >= 3 ? "dead" : "failure",
    total: roll,
    failures: nextFailures,
    critical: nextFailures >= 3
  };
}

export function buildDeathTurnKey(combat, combatant = combat?.combatant) {
  if (!combat?.started || !combatant) return null;
  return [combat.id ?? "combat", combat.round ?? 0, combat.turn ?? 0, combatant.id ?? "combatant"].join(":");
}

export function getDeathState(actor) {
  return actor?.getFlag?.(MODULE_ID, DEATH_STATE_FLAG)
    ?? actor?.flags?.[MODULE_ID]?.[DEATH_STATE_FLAG]
    ?? null;
}

export function isDyingActor(actor) {
  if (getDeathState(actor)?.status === "dying") return true;
  return hasStatus(actor, DYING_STATUS_ID);
}

export function isDeadActor(actor) {
  return getDeathState(actor)?.status === "dead";
}

export function isDeathIncapacitated(actor) {
  return isAutomationEnabled() && (isDyingActor(actor) || isDeadActor(actor));
}

export function shouldEnterDyingState(actor, state = getDeathState(actor)) {
  return Boolean(
    actor?.type === "player"
    && Number(actor.system?.health?.toughness?.value) <= 0
    && state?.status !== "dying"
    && state?.status !== "dead"
  );
}

export function selectDeathManager(users, actor, ownerLevel = OWNER_LEVEL) {
  const active = Array.from(users ?? []).filter((user) => user?.active);
  if (users?.activeGM?.active) return users.activeGM.id;
  const gm = active.filter((user) => user.isGM).sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
  if (gm) return gm.id;
  return active
    .filter((user) => !user.isGM && ownsActor(actor, user, ownerLevel))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0]?.id ?? null;
}

export function buildDyingEffectData() {
  return {
    name: localize("TENEBRE.Death.DyingEffect", "Morrendo"),
    img: "icons/svg/unconscious.svg",
    icon: "icons/svg/unconscious.svg",
    statuses: [DYING_STATUS_ID],
    disabled: false,
    description: localize("TENEBRE.Death.DyingEffectHint", "O personagem está inconsciente e deve realizar Testes de Morte."),
    flags: { [MODULE_ID]: { deathAutomation: true } }
  };
}

export class DeathAutomationService {
  static register() {
    if (registered) return;
    registered = true;
    SocketService.registerHandler(SOCKET_HANDLER, resolveDeathTestAsAuthority);

    Hooks.on("updateActor", (actor, changes, options, userId) => {
      const current = toughness(actor);
      const previous = Number(options?.[MODULE_ID]?.previousToughness ?? knownToughness.get(actorKey(actor)) ?? current);
      knownToughness.set(actorKey(actor), current);
      if (!hasToughnessChange(changes)) return;
      if (!this.isManager(actor, userId)) return;
      void this.reconcileActor(actor, { previousToughness: previous }).catch(logError);
    });

    Hooks.on("preUpdateActor", (actor, changes, options) => {
      if (!hasToughnessChange(changes)) return;
      options[MODULE_ID] = {
        ...(options[MODULE_ID] ?? {}),
        previousToughness: toughness(actor)
      };
    });

    Hooks.on("updateCombat", (combat) => {
      void this.promptCurrentCombatant(combat).catch(logError);
    });
    Hooks.on("deleteCombat", () => {
      for (const actor of allPlayerActors()) {
        if (this.isManager(actor)) void this.ensurePrompt(actor).catch(logError);
      }
    });
    Hooks.on("renderChatMessageHTML", (message, html) => bindDeathPrompt(message, html));
    Hooks.on("renderActorSheet", (app, html) => this.syncNativeSheetButtons(app, html));
    Hooks.on(`${MODULE_ID}.settingsChanged`, (key, enabled) => {
      if (key !== "enableDeathAutomation") return;
      if (enabled) void this.reconcileAll().catch(logError);
      else void this.suspendAll().catch(logError);
      for (const app of Object.values(globalThis.ui?.windows ?? {})) {
        if (app?.actor?.type === "player") this.syncNativeSheetButtons(app, app.element);
      }
    });
  }

  static async ready() {
    for (const actor of allPlayerActors()) knownToughness.set(actorKey(actor), toughness(actor));
    await this.reconcileAll();
  }

  static isEnabled() {
    return TenebreSettings.get("enableDeathAutomation") !== false;
  }

  static isManager(actor, updateUserId = null) {
    if (!this.isEnabled() || actor?.type !== "player") return false;
    const managerId = selectDeathManager(game.users, actor);
    return Boolean(managerId && managerId === game.user?.id);
  }

  static async reconcileAll() {
    if (!this.isEnabled()) return;
    for (const actor of allPlayerActors()) {
      if (this.isManager(actor)) await this.reconcileActor(actor);
    }
  }

  static async suspendAll() {
    for (const actor of allPlayerActors()) {
      if (selectDeathManager(game.users, actor) !== game.user?.id) continue;
      const state = getDeathState(actor);
      if (state?.status !== "dying") continue;
      await clearDeathPrompts(actor);
      await removeStatus(actor, DYING_STATUS_ID);
      await actor.unsetFlag(MODULE_ID, DEATH_STATE_FLAG);
      if (toughness(actor) <= 0) await setDeadPresentation(actor, true);
    }
  }

  static async reconcileActor(actor, { previousToughness = toughness(actor), announce = true } = {}) {
    if (!this.isEnabled() || actor?.type !== "player") return false;
    const key = actorKey(actor);
    if (processingActors.has(key)) return false;
    processingActors.add(key);
    try {
      const state = getDeathState(actor);
      const current = toughness(actor);
      if (current > 0 && state?.status === "dying") {
        await this.recoverActor(actor, { healing: Math.max(0, current - Number(previousToughness || 0)), announce });
        return true;
      }
      if (current <= 0 && state?.status === "dead") {
        await removeStatus(actor, DYING_STATUS_ID);
        await setDeadPresentation(actor, true);
        return true;
      }
      if (current <= 0 && state?.status === "dying") {
        await setDeadPresentation(actor, false);
        await applyStatus(actor, DYING_STATUS_ID);
        await applyStatus(actor, "prone", { overlay: false });
        await this.ensurePrompt(actor);
        return true;
      }
      if (current <= 0 && Number(actor.system?.nbrOfFailedDeathRoll ?? 0) >= 3) {
        await this.killActor(actor, { announce: false });
        return true;
      }
      if (shouldEnterDyingState(actor, state)) {
        await this.enterDying(actor, { announce });
        return true;
      }
      return false;
    } finally {
      processingActors.delete(key);
    }
  }

  static async enterDying(actor, { announce = true } = {}) {
    const state = {
      status: "dying",
      sequence: 0,
      lastRollKey: null,
      promptKey: null,
      resolvingKey: null,
      enteredAt: Date.now()
    };
    await clearDeathPrompts(actor);
    await actor.update({
      [`flags.${MODULE_ID}.${DEATH_STATE_FLAG}`]: state,
      "system.nbrOfFailedDeathRoll": Math.max(0, Math.min(2, Number(actor.system?.nbrOfFailedDeathRoll) || 0))
    });
    await setDeadPresentation(actor, false);
    await applyStatus(actor, DYING_STATUS_ID);
    await applyStatus(actor, "prone", { overlay: false });
    if (announce) await createDyingMessage(actor);
    await this.ensurePrompt(actor);
  }

  static async recoverActor(actor, { healing = 0, announce = true } = {}) {
    await clearDeathPrompts(actor);
    await actor.update({
      "system.nbrOfFailedDeathRoll": 0,
      [`flags.${MODULE_ID}.-=${DEATH_STATE_FLAG}`]: null
    });
    await removeStatus(actor, DYING_STATUS_ID);
    await setDeadPresentation(actor, false);
    if (announce) await createRecoveryMessage(actor, healing);
  }

  static async killActor(actor, { announce = true } = {}) {
    const previous = getDeathState(actor) ?? {};
    await clearDeathPrompts(actor);
    await actor.update({
      "system.health.toughness.value": 0,
      "system.nbrOfFailedDeathRoll": 3,
      [`flags.${MODULE_ID}.${DEATH_STATE_FLAG}`]: {
        ...previous,
        status: "dead",
        promptKey: null,
        resolvingKey: null,
        diedAt: Date.now()
      }
    });
    await removeStatus(actor, DYING_STATUS_ID);
    await setDeadPresentation(actor, true);
    if (announce) await createDeathMessage(actor);
  }

  static async promptCurrentCombatant(combat = game.combat) {
    const actor = combat?.combatant?.actor;
    if (!actor || !this.isManager(actor) || !isDyingActor(actor)) return false;
    return this.ensurePrompt(actor, buildDeathTurnKey(combat, combat.combatant));
  }

  static async ensurePrompt(actor, forcedKey = null) {
    if (!this.isEnabled() || !isDyingActor(actor) || !this.isManager(actor)) return false;
    const combatant = findCombatant(actor, game.combat);
    if (game.combat?.started && combatant && game.combat.combatant?.id !== combatant.id) return false;

    const state = getDeathState(actor);
    const rollKey = forcedKey
      ?? buildDeathTurnKey(game.combat, combatant)
      ?? `manual:${actorKey(actor)}:${Number(state?.sequence ?? 0)}`;
    if (!rollKey || state?.lastRollKey === rollKey || state?.promptKey === rollKey || state?.resolvingKey === rollKey) return false;

    await actor.setFlag(MODULE_ID, DEATH_STATE_FLAG, { ...state, promptKey: rollKey });
    try {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: buildDeathPromptHtml(actor, rollKey),
        flags: { [MODULE_ID]: { [PROMPT_FLAG]: { actorUuid: actor.uuid, rollKey } } }
      });
      return true;
    } catch (error) {
      await actor.setFlag(MODULE_ID, DEATH_STATE_FLAG, { ...state, promptKey: null });
      throw error;
    }
  }

  static syncNativeSheetButtons(app, html) {
    if (app?.actor?.type !== "player") return;
    const root = html?.[0] ?? html ?? app.element;
    const windowRoot = root?.closest?.(".window-app") ?? app.element ?? root;
    for (const button of windowRoot?.querySelectorAll?.(".death-roll, .recover-death-roll") ?? []) {
      button.hidden = this.isEnabled();
      button.classList.toggle("tenebre-death-system-hidden", this.isEnabled());
    }
  }
}

async function resolveDeathTestAsAuthority(messageId, options = {}) {
  const message = game.messages?.get?.(messageId);
  const prompt = message?.getFlag?.(MODULE_ID, PROMPT_FLAG);
  if (!message || !prompt?.actorUuid || !prompt.rollKey) throw new Error("Invalid Death Test prompt.");
  const actor = await globalThis.fromUuid?.(prompt.actorUuid);
  if (!actor || actor.type !== "player") throw new Error("Death Test actor was not found.");
  const user = requestUser(this);
  if (!user.isGM && !ownsActor(actor, user, OWNER_LEVEL)) throw new Error("User cannot roll this character's Death Test.");

  const state = getDeathState(actor);
  if (state?.status !== "dying" || state.promptKey !== prompt.rollKey || state.lastRollKey === prompt.rollKey) {
    throw new Error("This Death Test is no longer available.");
  }
  const normalized = normalizeRollOptions(options);
  await actor.setFlag(MODULE_ID, DEATH_STATE_FLAG, { ...state, promptKey: null, resolvingKey: prompt.rollKey });

  try {
    const formula = normalized.favour > 0 ? "2d20kl" : normalized.favour < 0 ? "2d20kh" : "1d20";
    const roll = await evaluateRoll(formula);
    const result = resolveDeathTestOutcome(
      rollTotal(roll),
      actor.system?.nbrOfFailedDeathRoll,
      normalized.modifier,
      Boolean(game.settings.get("symbaroum", "enhancedDeathSaveBonus"))
    );
    let healingRoll = null;
    let healing = 0;

    if (result.kind === "recovered") {
      healingRoll = await evaluateRoll("1d4");
      healing = Math.max(1, rollTotal(healingRoll));
      const maximum = Math.max(healing, Number(actor.system?.health?.toughness?.max) || healing);
      await actor.update({
        "system.health.toughness.value": Math.min(maximum, healing),
        "system.nbrOfFailedDeathRoll": 0,
        [`flags.${MODULE_ID}.-=${DEATH_STATE_FLAG}`]: null
      });
      await removeStatus(actor, DYING_STATUS_ID);
      await setDeadPresentation(actor, false);
    } else if (result.kind === "dead") {
      await DeathAutomationService.killActor(actor, { announce: false });
    } else {
      const inActiveCombat = Boolean(game.combat?.started && findCombatant(actor, game.combat));
      const nextState = {
        ...getDeathState(actor),
        status: "dying",
        sequence: Number(state.sequence ?? 0) + (inActiveCombat ? 0 : 1),
        lastRollKey: prompt.rollKey,
        promptKey: null,
        resolvingKey: null
      };
      await actor.update({
        "system.nbrOfFailedDeathRoll": result.failures,
        [`flags.${MODULE_ID}.${DEATH_STATE_FLAG}`]: nextState
      });
    }

    await createChatMessageAfterDice({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: buildDeathResultHtml(actor, result, { healing, modifier: normalized.modifier }),
      rolls: [roll, healingRoll].filter(Boolean),
      privateRoll: normalized.privateRoll,
      flags: { [MODULE_ID]: { deathTestResult: true, actorUuid: actor.uuid, rollKey: prompt.rollKey } }
    });
    await message.delete().catch(() => {});

    const remainsInActiveCombat = Boolean(game.combat?.started && findCombatant(actor, game.combat));
    if (["survives", "failure"].includes(result.kind) && !remainsInActiveCombat) {
      setTimeout(() => DeathAutomationService.ensurePrompt(actor).catch(logError), 0);
    }
    return result;
  } catch (error) {
    const current = getDeathState(actor);
    if (current?.status === "dying" && current.resolvingKey === prompt.rollKey) {
      await actor.setFlag(MODULE_ID, DEATH_STATE_FLAG, { ...current, promptKey: prompt.rollKey, resolvingKey: null });
    }
    throw error;
  }
}

function bindDeathPrompt(message, html) {
  const prompt = message?.getFlag?.(MODULE_ID, PROMPT_FLAG);
  if (!prompt) return;
  const root = html?.[0] ?? html;
  const button = root?.querySelector?.("[data-tenebre-death-roll]");
  if (!button || button.dataset.tenebreBound === "true") return;
  const actor = message.actor
    ?? globalThis.ChatMessage?.getSpeakerActor?.(message.speaker)
    ?? actorByUuidSync(prompt.actorUuid);
  const allowed = Boolean(actor && (game.user?.isGM || ownsActor(actor, game.user, OWNER_LEVEL)));
  button.disabled = !allowed;
  button.title = allowed
    ? localize("TENEBRE.Death.RollHint", "Clique para rolar. Shift+clique abre modificadores.")
    : localize("TENEBRE.Death.NoPermission", "Somente o dono do personagem ou o Mestre pode rolar.");
  button.dataset.tenebreBound = "true";
  button.addEventListener("click", async (event) => {
    if (!allowed || button.disabled) return;
    const options = event.shiftKey ? await requestDeathRollOptions() : { favour: 0, modifier: 0, privateRoll: false };
    if (!options) return;
    button.disabled = true;
    try {
      if (game.user?.isGM || SocketService.hasActiveGM()) {
        await SocketService.executeAsGM(SOCKET_HANDLER, message.id, options);
      } else {
        await resolveDeathTestAsAuthority.call({ socketdata: { userId: game.user.id } }, message.id, options);
      }
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to resolve Death Test.`, error);
      ui.notifications.error(localize("TENEBRE.Death.RollFailed", "Não foi possível realizar o Teste de Morte."));
      button.disabled = false;
    }
  });
}

function requestDeathRollOptions() {
  if (!globalThis.Dialog) return Promise.resolve({ favour: 0, modifier: 0, privateRoll: false });
  return new Promise((resolve) => {
    const privacy = RollPrivacyService.fieldHtml();
    const dialog = new Dialog({
      title: localize("TENEBRE.Death.OptionsTitle", "Teste de Morte"),
      content: `<div class="symbaroum dialog tenebre-death-options">
        <div class="bonus"><label>${escapeHtml(localize("DIALOG.MODIFIER", "Modificador"))}</label><input name="modifier" type="number" value="0"></div>
        ${privacy}
        <div class="favour"><label>${escapeHtml(localize("DIALOG.FAVOUR", "Condição"))}</label>
          <select name="favour"><option value="0">${escapeHtml(localize("DIALOG.FAVOUR_NORMAL", "Normal"))}</option><option value="1">${escapeHtml(localize("DIALOG.FAVOUR_FAVOUR", "Favor"))}</option><option value="-1">${escapeHtml(localize("DIALOG.FAVOUR_DISFAVOUR", "Desfavor"))}</option></select>
        </div></div>`,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: localize("BUTTON.ROLL", "Rolar"),
          callback: (html) => {
            const root = html?.[0] ?? html;
            resolve(normalizeRollOptions({
              modifier: root?.querySelector?.('[name="modifier"]')?.value,
              favour: root?.querySelector?.('[name="favour"]')?.value,
              privateRoll: root?.querySelector?.('[name="tenebrePrivateRoll"]')?.checked
            }));
          }
        },
        cancel: { label: localize("BUTTON.CANCEL", "Cancelar"), callback: () => resolve(null) }
      },
      default: "roll",
      close: () => resolve(null)
    });
    dialog.render(true);
  });
}

export function buildDeathPromptHtml(actor, rollKey) {
  return `<div class="symbaroum chat ability tenebre-death-prompt" data-death-roll-key="${escapeHtml(rollKey)}">
    <div class="foreground">
      <h3>${escapeHtml(format("TENEBRE.Death.PromptTitle", "Teste de Morte de {name}", { name: actor.name }))}</h3>
      ${portraitHtml(actor)}
      <p>${escapeHtml(localize("TENEBRE.Death.PromptText", "O personagem está morrendo e deve testar seu destino."))}</p>
      <button type="button" data-tenebre-death-roll><i class="fas fa-skull"></i> ${escapeHtml(localize("TENEBRE.Death.Roll", "Rolar Teste de Morte"))}</button>
      <p class="notes">${escapeHtml(localize("TENEBRE.Death.ModifierHint", "Shift+clique para configurar Favor, Desfavor, modificador ou rolagem privada."))}</p>
    </div>
  </div>`;
}

export function buildDeathResultHtml(actor, result, { healing = 0, modifier = 0 } = {}) {
  const outcomeKey = {
    recovered: "TENEBRE.Death.ResultRecovered",
    survives: "TENEBRE.Death.ResultSurvives",
    failure: "TENEBRE.Death.ResultFailure",
    dead: "TENEBRE.Death.ResultDead"
  }[result.kind];
  const fallback = {
    recovered: "{name} desperta e recupera {healing} de Vitalidade.",
    survives: "{name} permanece vivo, mas inconsciente.",
    failure: "{name} se aproxima da morte ({failures}/3 falhas).",
    dead: "{name} dá seu último suspiro."
  }[result.kind];
  return `<div class="tenebre-chat-card tenebre-death-result tenebre-death-${result.kind}">
    <h3><i class="fas fa-skull"></i> ${escapeHtml(format("TENEBRE.Death.ResultTitle", "Teste de Morte de {name}", { name: actor.name }))}</h3>
    ${portraitHtml(actor)}
    <p><strong>${escapeHtml(localize("TENEBRE.Death.RollResult", "Rolagem"))}:</strong> ${result.total}${modifier ? ` (${modifier > 0 ? "+" : ""}${modifier})` : ""}</p>
    <p>${escapeHtml(format(outcomeKey, fallback, { name: actor.name, healing, failures: result.failures }))}</p>
  </div>`;
}

async function createDyingMessage(actor) {
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="tenebre-chat-card tenebre-death-entry"><h3><i class="fas fa-heart-crack"></i> ${escapeHtml(localize("TENEBRE.Death.DyingTitle", "Fatalmente ferido"))}</h3>${portraitHtml(actor)}<p>${escapeHtml(format("TENEBRE.Death.DyingMessage", "{name} chegou a 0 de Vitalidade, caiu inconsciente e está morrendo.", { name: actor.name }))}</p></div>`
  });
}

async function createRecoveryMessage(actor, healing) {
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="tenebre-chat-card tenebre-death-recovery"><h3><i class="fas fa-heart"></i> ${escapeHtml(localize("TENEBRE.Death.RecoveryTitle", "Estabilizado"))}</h3>${portraitHtml(actor)}<p>${escapeHtml(format("TENEBRE.Death.RecoveryMessage", "{name} recuperou Vitalidade e não está mais morrendo.", { name: actor.name, healing }))}</p></div>`
  });
}

async function createDeathMessage(actor) {
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="tenebre-chat-card tenebre-death-final"><h3><i class="fas fa-skull"></i> ${escapeHtml(localize("TENEBRE.Death.DeathTitle", "Morte"))}</h3>${portraitHtml(actor)}<p>${escapeHtml(format("TENEBRE.Death.DeathMessage", "{name} morreu.", { name: actor.name }))}</p></div>`
  });
}

async function applyStatus(actor, statusId, options = {}) {
  if (hasStatus(actor, statusId)) return true;
  if (statusId === DYING_STATUS_ID && typeof actor.createEmbeddedDocuments === "function") {
    await actor.createEmbeddedDocuments("ActiveEffect", [buildDyingEffectData()]);
    return true;
  }
  if (typeof actor.toggleStatusEffect === "function") {
    await actor.toggleStatusEffect(statusId, { active: true, overlay: false, ...options });
    return true;
  }
  if (typeof actor.addCondition === "function") {
    await actor.addCondition(statusId);
    return true;
  }
  return false;
}

async function removeStatus(actor, statusId) {
  if (!hasStatus(actor, statusId)) return true;
  if (typeof actor.toggleStatusEffect === "function") {
    await actor.toggleStatusEffect(statusId, { active: false, overlay: false });
    return true;
  }
  const effects = Array.from(actor.effects ?? []).filter((effect) => statusEffectId(effect) === statusId);
  if (effects.length) await actor.deleteEmbeddedDocuments("ActiveEffect", effects.map((effect) => effect.id));
  return true;
}

async function setDeadPresentation(actor, dead) {
  if (dead) await applyStatus(actor, "dead", { overlay: true });
  else await removeStatus(actor, "dead");
  for (const combat of game.combats ?? (game.combat ? [game.combat] : [])) {
    for (const combatant of combat.combatants ?? []) {
      if (combatant.actor?.id !== actor.id && combatant.actorId !== actor.id) continue;
      if (Boolean(combatant.defeated) === dead) continue;
      try {
        await combatant.update({ defeated: dead });
      } catch (error) {
        console.warn(`${MODULE_ID} | Could not update defeated state for ${actor.name}.`, error);
      }
    }
  }
}

async function clearDeathPrompts(actor) {
  const messages = Array.from(game.messages?.contents ?? game.messages ?? []);
  for (const message of messages) {
    const prompt = message.getFlag?.(MODULE_ID, PROMPT_FLAG);
    if (prompt?.actorUuid !== actor.uuid) continue;
    try {
      await message.delete();
    } catch (error) {
      console.warn(`${MODULE_ID} | Could not remove an obsolete Death Test prompt.`, error);
    }
  }
}

function findCombatant(actor, combat) {
  return combat?.combatants?.find?.((entry) => entry.actor?.id === actor.id || entry.actorId === actor.id) ?? null;
}

function normalizeRollOptions(options = {}) {
  const favour = Math.max(-1, Math.min(1, Number(options.favour) || 0));
  const modifier = Math.max(-20, Math.min(20, Number(options.modifier) || 0));
  return { favour, modifier, privateRoll: options.privateRoll === true };
}

function requestUser(context) {
  const userId = context?.socketdata?.userId;
  const user = userId ? game.users?.get?.(userId) : null;
  if (!user?.active) throw new Error("Death Test has no authenticated active user.");
  return user;
}

function ownsActor(actor, user, level = OWNER_LEVEL) {
  if (!actor || !user) return false;
  try {
    return actor.testUserPermission?.(user, level) === true;
  } catch (_error) {
    return Number(actor.ownership?.[user.id] ?? actor.ownership?.default ?? 0) >= level;
  }
}

function hasToughnessChange(changes) {
  return changes?.system?.health?.toughness?.value !== undefined
    || changes?.["system.health.toughness.value"] !== undefined;
}

function toughness(actor) {
  return Math.max(0, Number(actor?.system?.health?.toughness?.value) || 0);
}

function actorKey(actor) {
  return actor?.uuid ?? actor?.id ?? "unknown";
}

function allPlayerActors() {
  const actors = [...(game.actors ?? [])];
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    if (token?.actor) actors.push(token.actor);
  }
  const unique = new Map();
  for (const actor of actors) {
    if (actor?.type === "player") unique.set(actorKey(actor), actor);
  }
  return [...unique.values()];
}

function isAutomationEnabled() {
  try {
    return TenebreSettings.get("enableDeathAutomation") !== false;
  } catch (_error) {
    return true;
  }
}

function actorByUuidSync(uuid) {
  if (!uuid) return null;
  return game.actors?.find?.((actor) => actor.uuid === uuid) ?? game.actors?.get?.(String(uuid).split(".").at(-1)) ?? null;
}

function hasStatus(actor, statusId) {
  if (actor?.statuses?.has?.(statusId)) return true;
  return Array.from(actor?.effects ?? []).some((effect) => statusEffectId(effect) === statusId);
}

function statusEffectId(effect) {
  if (!effect) return null;
  if (effect.statuses?.has?.(DYING_STATUS_ID) || effect.statuses?.includes?.(DYING_STATUS_ID)) return DYING_STATUS_ID;
  if (effect.statuses?.has?.("dead") || effect.statuses?.includes?.("dead")) return "dead";
  if (effect.statuses?.has?.("prone") || effect.statuses?.includes?.("prone")) return "prone";
  return effect.flags?.core?.statusId ?? effect.id ?? null;
}

function portraitHtml(actor) {
  const src = actor?.img || "icons/svg/mystery-man.svg";
  return `<figure class="tenebre-death-actor"><img src="${escapeHtml(src)}" alt="${escapeHtml(actor?.name)}" loading="lazy"><figcaption>${escapeHtml(actor?.name)}</figcaption></figure>`;
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
  const value = game.i18n?.localize?.(key);
  return value && value !== key ? value : fallback;
}

function format(key, fallback, data) {
  const value = game.i18n?.format?.(key, data);
  if (value && value !== key) return value;
  return fallback.replace(/\{(\w+)\}/g, (_match, name) => String(data[name] ?? ""));
}

function logError(error) {
  console.error(`${MODULE_ID} | Death automation failed.`, error);
}
