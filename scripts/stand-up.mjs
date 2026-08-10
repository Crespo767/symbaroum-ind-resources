import { MODULE_ID } from "./constants.mjs";
import { createChatMessageAfterDice, evaluateRoll, rollTotal } from "./dice.mjs";
import { isProneActor } from "./prone-advantage.mjs";
import { SocketService } from "./sockets.mjs";

export const STAND_UP_ACTION_FLAG = "standUpAction";

let registered = false;
const pendingActors = new Set();
const floatingButtons = new WeakMap();
const FLOATING_BUTTON_NAME = `${MODULE_ID}.stand-up-button`;
const FLOATING_BUTTON_RADIUS = 21;

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

export function shouldShowStandUpButton(actor, user = globalThis.game?.user) {
  return actor?.type === "player"
    && isProneActor(actor)
    && (user?.isGM === true || actor.isOwner === true);
}

export function getStandUpButtonPosition(token) {
  const tokenX = Number(token?.document?.x ?? token?.x) || 0;
  const tokenY = Number(token?.document?.y ?? token?.y) || 0;
  return {
    x: tokenX + (Number(token?.w) || 0) + FLOATING_BUTTON_RADIUS + 5,
    y: tokenY + (Number(token?.h) || 0) / 2
  };
}

export class StandUpService {
  static register() {
    if (registered) return;
    registered = true;
    Hooks.on("canvasReady", () => this.queueRefreshAllButtons());
    Hooks.on("drawToken", (token) => this.syncTokenButton(token));
    Hooks.on("refreshToken", (token) => this.syncTokenButton(token));
    Hooks.on("destroyToken", (token) => this.removeTokenButton(token));
    Hooks.on("updateToken", (tokenDocument) => this.syncTokenButton(tokenDocument?.object));
    Hooks.on("createActiveEffect", (effect) => this.queueRefreshActorButtons(effect?.parent));
    Hooks.on("updateActiveEffect", (effect) => this.queueRefreshActorButtons(effect?.parent));
    Hooks.on("deleteActiveEffect", (effect) => this.queueRefreshActorButtons(effect?.parent));
  }

  static queueRefreshAllButtons() {
    setTimeout(() => this.refreshAllButtons(), 0);
  }

  static queueRefreshActorButtons(actor) {
    if (!actor || !["player", "npc"].includes(actor.type)) return;
    setTimeout(() => this.refreshActorButtons(actor), 0);
  }

  static refreshAllButtons() {
    for (const token of globalThis.canvas?.tokens?.placeables ?? []) this.syncTokenButton(token);
  }

  static refreshActorButtons(actor) {
    for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
      const tokenActor = token?.actor ?? token?.document?.actor;
      if (tokenActor === actor || tokenActor?.uuid === actor.uuid || tokenActor?.id === actor.id) {
        this.syncTokenButton(token);
      }
    }
  }

  static syncTokenButton(token) {
    if (!token) return false;
    const actor = token.actor ?? token.document?.actor;
    let button = this.findTokenButton(token);
    if (!shouldShowStandUpButton(actor)) {
      if (button) this.removeTokenButton(token);
      return false;
    }

    if (!button) button = this.createTokenButton(token, actor);
    if (!button) return false;
    const position = getStandUpButtonPosition(token);
    button.position?.set?.(position.x, position.y);
    return true;
  }

  static findTokenButton(token) {
    const button = floatingButtons.get(token) ?? null;
    if (button?.destroyed) {
      floatingButtons.delete(token);
      return null;
    }
    return button;
  }

  static createTokenButton(token, actor) {
    const PIXI = globalThis.PIXI;
    const layer = token?.layer ?? globalThis.canvas?.tokens;
    if (!PIXI?.Container || !PIXI?.Graphics || typeof layer?.addChild !== "function") return null;

    const button = new PIXI.Container();
    button.name = FLOATING_BUTTON_NAME;
    button.zIndex = 10000;
    button.eventMode = "static";
    button.interactive = true;
    button.cursor = "pointer";
    button.buttonMode = true;
    if (PIXI.Circle) button.hitArea = new PIXI.Circle(0, 0, FLOATING_BUTTON_RADIUS + 3);

    const background = createStandUpButtonBackground(PIXI);
    const icon = createStandUpButtonIcon(PIXI);
    background.eventMode = "none";
    background.interactive = false;
    icon.eventMode = "none";
    icon.interactive = false;
    button.addChild(background, icon);
    button.on?.("pointerover", () => setStandUpButtonHover(button, background, true));
    button.on?.("pointerout", () => setStandUpButtonHover(button, background, false));
    button.on?.("pointerdown", (event) => event?.stopPropagation?.());
    button.on?.("pointerup", (event) => event?.stopPropagation?.());
    button.on?.("pointertap", (event) => {
      event?.stopPropagation?.();
      if (pendingActors.has(actor.uuid ?? actor.id)) return;
      button.eventMode = "none";
      button.interactive = false;
      button.alpha = 0.55;
      void this.attempt(actor, { tokenDocument: token.document }).finally(() => {
        if (!button.destroyed) {
          button.eventMode = "static";
          button.interactive = true;
          setStandUpButtonHover(button, background, false);
        }
        this.syncTokenButton(token);
      });
    });
    button.alpha = 0.9;
    layer.addChild(button);
    floatingButtons.set(token, button);
    return button;
  }

  static removeTokenButton(token) {
    const button = this.findTokenButton(token);
    if (!button) return false;
    button.parent?.removeChild?.(button);
    floatingButtons.delete(token);
    button.destroy?.({ children: true });
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

export function createStandUpButtonBackground(PIXI) {
  const background = new PIXI.Container();
  const shadow = new PIXI.Graphics();
  const glow = new PIXI.Graphics();
  const face = new PIXI.Graphics();
  const details = new PIXI.Graphics();

  drawCircle(shadow, 1.5, 2, FLOATING_BUTTON_RADIUS + 2, 0x000000, 0.62);
  drawCircle(glow, 0, 0, FLOATING_BUTTON_RADIUS + 4, 0xd89324, 0.38);
  drawCircle(face, 0, 0, FLOATING_BUTTON_RADIUS, 0x15100b, 0.98, 0xe0a02b, 2.5);
  drawCircle(face, 0, 0, FLOATING_BUTTON_RADIUS - 4, 0x2a2118, 1, 0x74501e, 1.25);
  for (const [x, y] of [[0, -17.5], [17.5, 0], [0, 17.5], [-17.5, 0]]) {
    drawCircle(details, x, y, 1.15, 0xf2c15a, 0.95);
  }

  glow.alpha = 0.28;
  background.addChild(shadow, glow, face, details);
  background.tenebreGlow = glow;
  return background;
}

export function createStandUpButtonIcon(PIXI) {
  const icon = new PIXI.Graphics();
  const points = [
    0, -13,
    9, -3.5,
    4.25, -3.5,
    4.25, 10.5,
    -4.25, 10.5,
    -4.25, -3.5,
    -9, -3.5
  ];
  if (typeof icon.poly === "function" && typeof icon.fill === "function") {
    icon.poly(points).fill({ color: 0xf7f0dd, alpha: 1 }).stroke({ color: 0x1a1209, width: 1.4 });
  } else {
    icon.lineStyle?.(1.4, 0x1a1209, 1);
    icon.beginFill?.(0xf7f0dd, 1);
    icon.drawPolygon?.(points);
    icon.endFill?.();
  }
  return icon;
}

function drawCircle(graphics, x, y, radius, fillColor, fillAlpha, strokeColor = null, strokeWidth = 0) {
  if (typeof graphics.circle === "function" && typeof graphics.fill === "function") {
    graphics.circle(x, y, radius).fill({ color: fillColor, alpha: fillAlpha });
    if (strokeColor !== null && strokeWidth > 0) {
      graphics.stroke({ color: strokeColor, width: strokeWidth, alpha: 1 });
    }
    return;
  }
  if (strokeColor !== null && strokeWidth > 0) graphics.lineStyle?.(strokeWidth, strokeColor, 1);
  else graphics.lineStyle?.(0, 0x000000, 0);
  graphics.beginFill?.(fillColor, fillAlpha);
  graphics.drawCircle?.(x, y, radius);
  graphics.endFill?.();
}

function setStandUpButtonHover(button, background, active) {
  button.alpha = 1;
  button.scale?.set?.(active ? 1.08 : 1);
  if (background?.tenebreGlow) background.tenebreGlow.alpha = active ? 0.72 : 0.28;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
