import { MODULE_ID } from "./constants.mjs";
import { createChatMessageAfterDice, evaluateRoll, rollTotal } from "./dice.mjs";
import { isProneActor } from "./prone-advantage.mjs";
import { SocketService } from "./sockets.mjs";

export const STAND_UP_ACTION_FLAG = "standUpAction";

let registered = false;
const pendingActors = new Set();

export function resolveStandUpTest(quickValue, rollResult, previousRemaining = 2) {
  const target = Number(quickValue) || 0;
  const result = Number(rollResult) || 0;
  const success = result > 0 && result <= target;
  return {
    success,
    quickValue: target,
    rollResult: result,
    remainingMovementActions: Math.min(
      Math.max(0, Number(previousRemaining) || 0),
      success ? 1 : 0
    )
  };
}

export function buildStandUpActionState(remainingMovementActions, combat = globalThis.game?.combat) {
  if (!combat?.started) return null;
  return {
    combatId: combat.id ?? null,
    round: combat.round ?? null,
    turn: combat.turn ?? null,
    remainingMovementActions: Math.min(1, Math.max(0, Number(remainingMovementActions) || 0))
  };
}

export function getStandUpRemainingMovementActions(actor, combat = globalThis.game?.combat) {
  if (!actor || !combat?.started) return null;
  const state = actor.getFlag?.(MODULE_ID, STAND_UP_ACTION_FLAG)
    ?? actor.flags?.[MODULE_ID]?.[STAND_UP_ACTION_FLAG]
    ?? null;
  if (!state) return null;
  if (state.combatId && state.combatId !== combat.id) return null;
  if (Number(state.round) !== Number(combat.round) || Number(state.turn) !== Number(combat.turn)) return null;
  const remaining = Number(state.remainingMovementActions);
  return Number.isFinite(remaining) ? Math.min(1, Math.max(0, remaining)) : null;
}

export function resolveStandUpPortrait(actor, tokenDocument = null) {
  const document = tokenDocument?.document ?? tokenDocument;
  if (document?.actorLink) return actor?.img || "icons/svg/mystery-man.svg";
  return document?.texture?.src
    ?? tokenDocument?.texture?.src
    ?? actor?.img
    ?? "icons/svg/mystery-man.svg";
}

export class StandUpService {
  static register() {
    if (registered) return;
    registered = true;
    Hooks.on("renderTokenHUD", (hud, html, token) => this.addHudButton(hud, html, token));
  }

  static addHudButton(hud, html, token) {
    const tokenDocument = token?.document ?? hud?.object?.document ?? hud?.object;
    const actor = tokenDocument?.actor;
    if (actor?.type !== "player" || !isProneActor(actor)) return false;
    if (!game.user?.isGM && actor.isOwner !== true) return false;

    const root = htmlRoot(html);
    const column = root?.querySelector?.(".col.right, div.right");
    if (!column || column.querySelector("[data-tenebre-stand-up]")) return false;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "control-icon tenebre-stand-up-control";
    button.dataset.tenebreStandUp = "true";
    button.title = game.i18n.localize("TENEBRE.StandUp.HudHint");
    button.setAttribute("aria-label", button.title);
    button.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      void this.attempt(actor, { tokenDocument }).finally(() => {
        button.disabled = false;
        if (!isProneActor(actor)) button.remove();
      });
    });
    column.append(button);
    return true;
  }

  static async attempt(actor, { tokenDocument = null } = {}) {
    if (!actor || !isProneActor(actor)) return null;
    if (!game.user?.isGM && actor.isOwner !== true) {
      ui.notifications.warn(game.i18n.localize("TENEBRE.StandUp.NoPermission"));
      return null;
    }

    const actorKey = actor.uuid ?? actor.id;
    if (pendingActors.has(actorKey)) return null;
    if (!isActorsTurn(actor)) {
      ui.notifications.warn(game.i18n.format("TENEBRE.StandUp.NotYourTurn", { actor: actor.name }));
      return null;
    }

    pendingActors.add(actorKey);
    try {
      const quickValue = Number(actor.system?.attributes?.quick?.total) || 0;
      const roll = await evaluateRoll("1d20");
      const previousRemaining = getStandUpRemainingMovementActions(actor) ?? 2;
      const result = resolveStandUpTest(quickValue, rollTotal(roll), previousRemaining);
      const actionState = buildStandUpActionState(result.remainingMovementActions);

      if (actionState) {
        await SocketService.setFlag(actor, MODULE_ID, STAND_UP_ACTION_FLAG, actionState);
      }

      try {
        await removeProne(actor);
      } catch (error) {
        if (actionState) {
          await SocketService.unsetFlag(actor, MODULE_ID, STAND_UP_ACTION_FLAG).catch(() => {});
        }
        throw error;
      }

      await createChatMessageAfterDice({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: buildStandUpChat(actor, result, resolveStandUpPortrait(actor, tokenDocument)),
        rolls: [roll]
      }).catch((error) => {
        console.warn(`${MODULE_ID} | Failed to publish the stand-up result.`, error);
      });

      ui.notifications.info(game.i18n.format(
        result.success ? "TENEBRE.StandUp.SuccessNotice" : "TENEBRE.StandUp.FailureNotice",
        { actor: actor.name }
      ));
      return result;
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to stand up.`, error);
      ui.notifications.error(game.i18n.localize("TENEBRE.StandUp.Failed"));
      return null;
    } finally {
      pendingActors.delete(actorKey);
    }
  }
}

function isActorsTurn(actor) {
  const combat = game.combat;
  if (!combat?.started) return true;
  const combatant = combat.combatants?.find?.((entry) => entry.actor?.id === actor.id || entry.actorId === actor.id);
  if (!combatant) return true;
  const current = combat.combatant
    ?? (combat.current?.combatantId ? combat.combatants?.get?.(combat.current.combatantId) : null);
  return Boolean(current && current.id === combatant.id);
}

async function removeProne(actor) {
  if (typeof actor.toggleStatusEffect === "function") {
    await actor.toggleStatusEffect("prone", { active: false, overlay: false });
    return true;
  }

  const effect = Array.from(actor.effects ?? []).find((candidate) => {
    if (candidate.statuses?.has?.("prone") || candidate.statuses?.includes?.("prone")) return true;
    return candidate.getFlag?.("core", "statusId") === "prone"
      || candidate.flags?.core?.statusId === "prone";
  });
  if (!effect?.id) throw new Error("The prone status effect was not found.");
  await SocketService.deleteEmbeddedDocuments(actor, "ActiveEffect", [effect.id], { render: true });
  return true;
}

export function buildStandUpChat(actor, result, portrait = resolveStandUpPortrait(actor)) {
  const outcome = result.success
    ? game.i18n.localize("TENEBRE.StandUp.Success")
    : game.i18n.localize("TENEBRE.StandUp.Failure");
  const cost = result.success
    ? game.i18n.localize("TENEBRE.StandUp.OneMovementAction")
    : game.i18n.localize("TENEBRE.StandUp.FullTurn");

  return `
    <div class="tenebre-chat-card tenebre-stand-up-card ${result.success ? "tenebre-stand-up-success" : "tenebre-stand-up-failure"}">
      <h3><i class="fas fa-arrow-up"></i> ${escapeHtml(game.i18n.localize("TENEBRE.StandUp.Title"))}</h3>
      <figure class="tenebre-stand-up-actor">
        <img src="${escapeHtml(portrait)}" alt="${escapeHtml(actor.name)}" title="${escapeHtml(actor.name)}" loading="lazy">
        <figcaption>${escapeHtml(actor.name)}</figcaption>
      </figure>
      <ul>
        <li><strong>${escapeHtml(game.i18n.localize("TENEBRE.StandUp.QuickTest"))}:</strong> ${result.rollResult}/${result.quickValue}</li>
        <li><strong>${escapeHtml(game.i18n.localize("TENEBRE.StandUp.Result"))}:</strong> ${escapeHtml(outcome)}</li>
        <li><strong>${escapeHtml(game.i18n.localize("TENEBRE.StandUp.Cost"))}:</strong> ${escapeHtml(cost)}</li>
      </ul>
    </div>
  `;
}

function htmlRoot(html) {
  if (!html) return null;
  if (html.querySelector) return html;
  return html[0] ?? html.element ?? null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
