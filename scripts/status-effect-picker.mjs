import { MODULE_ID } from "./constants.mjs";
import { escapeHtml, normalize } from "./utils.mjs";

const MACRO_FLAG = "statusEffectPickerMacro";
const MACRO_COMMAND = "await game.tenebreResources?.statusEffects?.open?.();";
const MACRO_ICON = "icons/svg/aura.svg";
const CHAT_SETTING = "showAppliedStatusEffectChatMessages";

export const StatusEffectPickerService = {
  async open() {
    const token = getSelectedToken();
    if (!token) {
      notify("warn", "TENEBRE.StatusEffects.SelectOneToken");
      return null;
    }

    const actor = token.actor;
    if (!canModifyActor(actor)) {
      notify("warn", "TENEBRE.StatusEffects.NoPermission");
      return null;
    }

    const effects = collectAvailableStatusEffects(actor);
    const content = buildPickerContent(token, effects);
    const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    const position = pickerDialogPosition();

    if (DialogV2) {
      const dialog = new DialogV2({
        classes: ["tenebre-effect-picker-window"],
        window: {
          title: game.i18n.localize("TENEBRE.StatusEffects.Title"),
          resizable: true
        },
        position,
        content,
        render: (_event, app) => activatePicker(app?.element, token, effects),
        buttons: [{
          action: "close",
          icon: "fas fa-times",
          label: game.i18n.localize("TENEBRE.Common.Close"),
          default: true
        }]
      });
      await dialog.render({ force: true });
      activatePicker(dialog.element, token, effects);
      return dialog;
    }

    const dialog = new Dialog(
      {
        title: game.i18n.localize("TENEBRE.StatusEffects.Title"),
        content,
        buttons: {
          close: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("TENEBRE.Common.Close")
          }
        },
        render: (html) => activatePicker(html?.[0] ?? html, token, effects)
      },
      {
        classes: ["tenebre-effect-picker-window"],
        width: position.width,
        height: position.height,
        resizable: true
      }
    );
    dialog.render(true);
    return dialog;
  },

  async installMacro() {
    try {
      let macro = findUsablePickerMacro();
      if (!macro) macro = await createPickerMacro();
      if (!macro) throw new Error("Macro creation returned no document.");

      const slot = findFirstEmptyHotbarSlot(game.user?.hotbar, globalThis.ui?.hotbar?.page);
      if (slot === null) {
        notify("info", "TENEBRE.StatusEffects.MacroCreatedNoSlot");
        return { macro, slot: null };
      }

      await game.user.assignHotbarMacro(macro, slot);
      notify("info", "TENEBRE.StatusEffects.MacroInstalled", { slot });
      return { macro, slot };
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to install the status effect picker macro.`, error);
      notify("error", "TENEBRE.StatusEffects.MacroInstallFailed");
      return null;
    }
  },

  async toggle(actor, statusId) {
    if (!actor || !statusId || !canModifyActor(actor)) return false;
    const active = isEffectActive(actor, statusId);
    await actor.toggleStatusEffect(statusId, { active: !active, overlay: false });
    return !active;
  }
};

export function collectAvailableStatusEffects(actor, statusEffects = globalThis.CONFIG?.statusEffects ?? []) {
  const byId = new Map();
  for (const effect of statusEffectValues(statusEffects)) {
    const id = statusEffectId(effect);
    if (!id || byId.has(id)) continue;
    const name = localizeValue(effect.name ?? effect.label ?? id);
    const active = isEffectActive(actor, id);
    byId.set(id, {
      id,
      name,
      img: effect.img ?? effect.icon ?? "icons/svg/aura.svg",
      active,
      description: effectDescription(effect, name, active),
      chatDescription: localizeValue(effect.description ?? "")
    });
  }

  return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name, game.i18n?.lang));
}

export function statusEffectValues(statusEffects) {
  if (!statusEffects) return [];
  if (statusEffects instanceof Map) return [...statusEffects.values()];
  if (Array.isArray(statusEffects)) return statusEffects;
  if (typeof statusEffects[Symbol.iterator] === "function") return Array.from(statusEffects);
  if (typeof statusEffects === "object") return Object.values(statusEffects);
  return [];
}

export function isEffectActive(actor, statusId) {
  if (!actor || !statusId) return false;
  if (actor.statuses?.has?.(statusId)) return true;
  return Array.from(actor.effects ?? []).some((effect) => {
    if (effect.statuses?.has?.(statusId) || effect.statuses?.includes?.(statusId)) return true;
    if (effect.getFlag?.("core", "statusId") === statusId) return true;
    return effect.flags?.core?.statusId === statusId;
  });
}

export function findFirstEmptyHotbarSlot(hotbar = {}, currentPage = 1) {
  const page = Math.min(5, Math.max(1, Number(currentPage) || 1));
  const orderedSlots = [];
  const firstSlot = (page - 1) * 10 + 1;
  for (let slot = firstSlot; slot < firstSlot + 10; slot += 1) orderedSlots.push(slot);
  for (let slot = 1; slot <= 50; slot += 1) {
    if (!orderedSlots.includes(slot)) orderedSlots.push(slot);
  }
  return orderedSlots.find((slot) => !hotbar?.[slot] && !hotbar?.[String(slot)]) ?? null;
}

function getSelectedToken() {
  const selected = (globalThis.canvas?.tokens?.controlled ?? []).filter((token) => token?.actor);
  return selected.length === 1 ? selected[0] : null;
}

function canModifyActor(actor) {
  return Boolean(actor && (globalThis.game?.user?.isGM || actor.isOwner));
}

function statusEffectId(effect) {
  return String(effect?.id ?? effect?._id ?? "").trim();
}

function effectDescription(effect, name, active) {
  const provided = localizeValue(effect.description ?? "");
  if (provided) return provided;
  return game.i18n.format(
    active ? "TENEBRE.StatusEffects.RemoveHint" : "TENEBRE.StatusEffects.ApplyHint",
    { effect: name }
  );
}

function localizeValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const localized = globalThis.game?.i18n?.localize?.(text);
  return localized && localized !== text ? localized : text;
}

function buildPickerContent(token, effects) {
  const actor = token.actor;
  const image = token.document?.actorLink
    ? actor.img
    : token.document?.texture?.src ?? token.texture?.src ?? actor.img ?? "icons/svg/mystery-man.svg";
  const cards = effects.map((effect) => `
    <button type="button" class="tenebre-effect-picker-card${effect.active ? " is-active" : ""}"
      data-effect-id="${escapeHtml(effect.id)}" data-effect-search="${escapeHtml(normalize(effect.name))}"
      aria-pressed="${effect.active ? "true" : "false"}">
      <img src="${escapeHtml(effect.img)}" alt="">
      <span class="tenebre-effect-picker-card-copy">
        <strong>${escapeHtml(effect.name)}</strong>
        <small data-effect-description>${escapeHtml(effect.description)}</small>
      </span>
      <i class="fas ${effect.active ? "fa-check" : "fa-plus"}" aria-hidden="true"></i>
    </button>`).join("");

  return `
    <section class="symbaroum dialog tenebre-symbaroum-dialog tenebre-effect-picker">
      <header class="tenebre-effect-picker-target">
        <img src="${escapeHtml(image)}" alt="">
        <span>
          <small>${escapeHtml(game.i18n.localize("TENEBRE.StatusEffects.SelectedToken"))}</small>
          <strong>${escapeHtml(token.name ?? actor.name ?? "")}</strong>
        </span>
      </header>
      <label class="tenebre-effect-picker-search">
        <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
        <input type="search" placeholder="${escapeHtml(game.i18n.localize("TENEBRE.StatusEffects.Search"))}" autocomplete="off">
      </label>
      <div class="tenebre-effect-picker-grid" role="list" tabindex="0"
        aria-label="${escapeHtml(game.i18n.localize("TENEBRE.StatusEffects.Title"))}">${cards}</div>
      <p class="tenebre-effect-picker-empty"${effects.length ? " hidden" : ""}>${escapeHtml(game.i18n.localize("TENEBRE.StatusEffects.Empty"))}</p>
    </section>`;
}

function activatePicker(root, token, effects) {
  const actor = token?.actor;
  const picker = root?.querySelector?.(".tenebre-effect-picker");
  if (!picker || picker.dataset.activated === "true") return;
  picker.dataset.activated = "true";

  const search = picker.querySelector("input[type='search']");
  const empty = picker.querySelector(".tenebre-effect-picker-empty");
  const grid = picker.querySelector(".tenebre-effect-picker-grid");
  const cards = [...picker.querySelectorAll(".tenebre-effect-picker-card")];
  search?.addEventListener("input", () => {
    const term = normalize(search.value);
    let visible = 0;
    for (const card of cards) {
      const matches = !term || card.dataset.effectSearch?.includes(term);
      card.hidden = !matches;
      if (matches) visible += 1;
    }
    if (empty) empty.hidden = visible > 0;
    if (grid) grid.scrollTop = 0;
  });

  grid?.addEventListener("click", async (event) => {
    const button = event.target.closest?.(".tenebre-effect-picker-card");
    if (!button || button.dataset.busy === "true") return;
    const statusId = button.dataset.effectId;
    const effect = effects.find((entry) => entry.id === statusId);
    if (!effect) return;

    button.dataset.busy = "true";
    button.disabled = true;
    try {
      const active = await StatusEffectPickerService.toggle(actor, statusId);
      effect.active = active;
      effect.description = game.i18n.format(
        active ? "TENEBRE.StatusEffects.RemoveHint" : "TENEBRE.StatusEffects.ApplyHint",
        { effect: effect.name }
      );
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      const icon = button.querySelector(":scope > i");
      icon?.classList.toggle("fa-check", active);
      icon?.classList.toggle("fa-plus", !active);
      const description = button.querySelector("[data-effect-description]");
      if (description) description.textContent = effect.description;
      if (active) {
        try {
          await publishAppliedEffectChatMessage({ actor, token, effect });
        } catch (error) {
          console.warn(`${MODULE_ID} | Failed to publish the applied status effect to chat.`, error);
        }
      }
      notify("info", active ? "TENEBRE.StatusEffects.Applied" : "TENEBRE.StatusEffects.Removed", {
        effect: effect.name,
        actor: actor.name
      });
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to toggle status ${statusId}.`, error);
      notify("error", "TENEBRE.StatusEffects.ToggleFailed", { effect: effect.name });
    } finally {
      delete button.dataset.busy;
      button.disabled = false;
    }
  });
}

export function buildAppliedEffectChatContent(actor, effect) {
  const actorName = String(actor?.name ?? "").trim();
  const effectName = String(effect?.name ?? effect?.id ?? "").trim();
  const image = effect?.img ?? "icons/svg/aura.svg";
  const appliedText = game.i18n.format("TENEBRE.StatusEffects.ChatApplied", {
    actor: actorName,
    effect: effectName
  });
  const extraDescription = String(effect?.chatDescription ?? "").trim();

  return `
    <section class="symbaroum chat tenebre-status-effect-chat">
      <header class="tenebre-status-effect-chat-header">
        <img src="${escapeHtml(image)}" alt="">
        <span>
          <small>${escapeHtml(game.i18n.localize("TENEBRE.StatusEffects.ChatTitle"))}</small>
          <strong>${escapeHtml(effectName)}</strong>
        </span>
      </header>
      <p class="tenebre-status-effect-chat-applied">${escapeHtml(appliedText)}</p>
      ${extraDescription ? `<p class="tenebre-status-effect-chat-description">${escapeHtml(extraDescription)}</p>` : ""}
    </section>`;
}

export async function publishAppliedEffectChatMessage({ actor, token, effect } = {}) {
  if (!actor || !effect || !isAppliedEffectChatEnabled()) return null;
  const ChatMessageClass = globalThis.ChatMessage?.implementation ?? globalThis.ChatMessage;
  if (!ChatMessageClass?.create) return null;

  const speaker = globalThis.ChatMessage?.getSpeaker?.({
    actor,
    token: token?.document ?? token
  }) ?? { actor: actor.id ?? null, token: token?.id ?? null };
  return ChatMessageClass.create({
    user: globalThis.game?.user?.id,
    speaker,
    content: buildAppliedEffectChatContent(actor, effect)
  });
}

export function isAppliedEffectChatEnabled() {
  try {
    return game.settings.get(MODULE_ID, CHAT_SETTING) !== false;
  } catch (_error) {
    return true;
  }
}

function pickerDialogPosition() {
  const viewportWidth = Number(globalThis.window?.innerWidth) || 740;
  const viewportHeight = Number(globalThis.window?.innerHeight) || 800;
  return {
    width: Math.max(360, Math.min(660, viewportWidth - 60)),
    height: Math.max(360, Math.min(720, viewportHeight - 80))
  };
}

function findUsablePickerMacro() {
  return Array.from(globalThis.game?.macros ?? []).find((macro) => {
    const flagged = macro.getFlag?.(MODULE_ID, MACRO_FLAG) === true
      || macro.flags?.[MODULE_ID]?.[MACRO_FLAG] === true;
    return flagged && (typeof macro.canUserExecute !== "function" || macro.canUserExecute(game.user));
  }) ?? null;
}

async function createPickerMacro() {
  const MacroClass = globalThis.Macro?.implementation
    ?? globalThis.CONFIG?.Macro?.documentClass
    ?? globalThis.Macro;
  if (!MacroClass?.create) throw new Error("Configured Macro document class is unavailable.");

  const observer = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2;
  return MacroClass.create({
    name: game.i18n.localize("TENEBRE.StatusEffects.MacroName"),
    type: "script",
    img: MACRO_ICON,
    command: MACRO_COMMAND,
    ownership: { default: observer },
    flags: {
      [MODULE_ID]: {
        [MACRO_FLAG]: true
      }
    }
  });
}

function notify(level, key, data = null) {
  const message = data ? game.i18n.format(key, data) : game.i18n.localize(key);
  globalThis.ui?.notifications?.[level]?.(message);
}
