import { MODULE_ID } from "./constants.mjs";
import {
  deduplicateGmLogEvents,
  GM_LOG_EVENT_TYPES,
  gmLogEventKey,
  normalizeGmLogEvent
} from "./gm-log-events.mjs";
import {
  gmLogEventFromMessage
} from "./gm-log-message-adapter.mjs";

const DEFAULT_LIMIT = 500;
const RAW_VARIANT_FACTOR = 2;
const ENABLE_SETTING = "enableGmLog";

export function isGmLogEnabled() {
  try {
    return Boolean(game.settings.get(MODULE_ID, ENABLE_SETTING));
  } catch {
    return true;
  }
}

export class GmLogStore {
  #limit;
  #variants = new Map();
  #sequence = 0;

  constructor({ limit = DEFAULT_LIMIT } = {}) {
    this.#limit = Math.max(1, Number(limit) || DEFAULT_LIMIT);
  }

  add(input) {
    const event = normalizeGmLogEvent(input);
    if (!event) return false;
    const stableKey = gmLogEventKey(event);
    if (!stableKey) return false;
    const variantKey = event.source.messageId
      ? `message:${event.source.messageId}`
      : `${stableKey}:${event.source.variant}`;
    const current = this.#variants.get(variantKey);
    this.#variants.set(variantKey, {
      event,
      sequence: current?.sequence ?? this.#sequence++
    });
    this.#trimVariants();
    return true;
  }

  removeMessage(messageId) {
    const id = String(messageId ?? "");
    if (!id) return false;
    let changed = false;
    for (const [key, entry] of this.#variants) {
      if (entry.event.source.messageId !== id) continue;
      this.#variants.delete(key);
      changed = true;
    }
    return changed;
  }

  clear() {
    const changed = this.#variants.size > 0;
    this.#variants.clear();
    this.#sequence = 0;
    return changed;
  }

  snapshot() {
    const ordered = [...this.#variants.values()]
      .sort((left, right) => left.sequence - right.sequence)
      .map((entry) => entry.event);
    return Object.freeze(deduplicateGmLogEvents(ordered).slice(-this.#limit));
  }

  #trimVariants() {
    const maximum = this.#limit * RAW_VARIANT_FACTOR;
    if (this.#variants.size <= maximum) return;
    const excess = this.#variants.size - maximum;
    const oldest = [...this.#variants.entries()]
      .sort((left, right) => left[1].sequence - right[1].sequence)
      .slice(0, excess);
    for (const [key] of oldest) this.#variants.delete(key);
  }
}

export class GmLogService {
  static #registered = false;
  static #store = new GmLogStore();

  static register() {
    if (this.#registered || !game.user?.isGM) return;
    this.#registered = true;

    Hooks.on("createChatMessage", (message) => this.#ingest(message));
    Hooks.on("updateChatMessage", (message) => this.#ingest(message));
    Hooks.on("deleteChatMessage", (message) => this.#remove(message));
    Hooks.on(`${MODULE_ID}.settingsChanged`, (key, value) => {
      if (key === ENABLE_SETTING) this.syncEnabledState(Boolean(value));
    });

    this.syncEnabledState(isGmLogEnabled());
  }

  static get events() {
    return game.user?.isGM && isGmLogEnabled() ? this.#store.snapshot() : Object.freeze([]);
  }

  static clear() {
    if (!game.user?.isGM || !isGmLogEnabled() || !this.#store.clear()) return false;
    this.#notify();
    return true;
  }

  /** Create a GM-only inventory audit entry after an item quantity was changed. */
  static async recordItemQuantityChange({ actor, item, previousQuantity, quantity } = {}) {
    const ChatMessageClass = globalThis.ChatMessage;
    if (!isGmLogEnabled() || !actor || !item || typeof ChatMessageClass?.create !== "function") return null;
    if (!game.user?.isGM && !actor.isOwner) return null;

    const previous = normalizeQuantity(previousQuantity);
    const next = normalizeQuantity(quantity);
    if (previous === next) return null;

    const actorUuid = String(actor.uuid ?? "");
    const itemUuid = String(item.uuid ?? "");
    if (!actorUuid || !itemUuid || (item.parent?.uuid && item.parent.uuid !== actorUuid)) return null;

    const whisper = Array.from(game.users ?? [])
      .filter((user) => user?.isGM)
      .map((user) => user.id)
      .filter(Boolean);
    if (!whisper.length) return null;

    const data = {
      actor: actor.name ?? "",
      item: item.name ?? "",
      previous,
      quantity: next
    };
    const content = game.i18n?.format?.("TENEBRE.GmLog.Inventory.QuantityChanged", data)
      ?? `${data.actor}: ${data.item} ${previous} -> ${next}`;

    return ChatMessageClass.create({
      speaker: ChatMessageClass.getSpeaker?.({ actor }) ?? { actor: actor.id, alias: actor.name },
      content: `<p>${escapeHtml(content)}</p>`,
      whisper,
      flags: {
        [MODULE_ID]: {
          gmLogOnly: true,
          gmLogAction: {
            type: GM_LOG_EVENT_TYPES.ITEM_QUANTITY_CHANGED,
            actorUuid,
            subjectUuid: itemUuid,
            values: {
              previous,
              quantity: next,
              delta: next - previous
            }
          }
        }
      }
    });
  }

  static syncEnabledState(enabled = isGmLogEnabled()) {
    if (!game.user?.isGM) return;
    if (enabled) {
      this.#hydrate();
      return;
    }
    this.#store.clear();
    this.#notify();
  }

  static #hydrate() {
    this.#store.clear();
    for (const message of game.messages ?? []) {
      const event = gmLogEventFromMessage(message);
      if (event) this.#store.add(event);
    }
    this.#notify();
  }

  static #ingest(message) {
    if (!game.user?.isGM || !isGmLogEnabled()) return;
    const event = gmLogEventFromMessage(message);
    if (!event || !this.#store.add(event)) return;
    this.#notify();
  }

  static #remove(message) {
    if (!game.user?.isGM || !isGmLogEnabled() || !this.#store.removeMessage(message?.id)) return;
    this.#notify();
  }

  static #notify() {
    Hooks.callAll(`${MODULE_ID}.gmLogUpdated`, this.#store.snapshot());
  }
}

function normalizeQuantity(value) {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? Math.max(0, Math.trunc(quantity)) : 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
