export const GM_LOG_EVENT_VERSION = 1;

export const GM_LOG_EVENT_TYPES = Object.freeze({
  ATTACK: "combat.attack",
  MANEUVER: "combat.maneuver",
  ROLL: "roll.test",
  AMMO_RELOAD: "ammo.reload",
  AMMO_RECOVERY: "ammo.recovery",
  RATION_CONSUMED: "resource.ration",
  REST_COMPLETED: "status.rest",
  EFFECT_CHANGED: "status.effect",
  WEAPON_READINESS: "inventory.weaponReadiness",
  ITEM_QUANTITY_CHANGED: "inventory.itemQuantityChanged",
  ITEM_USED: "inventory.itemUse",
  SYSTEM_ACTION: "system.action"
});

export const GM_LOG_EVENT_CATEGORIES = Object.freeze({
  COMBAT: "combat",
  ROLLS: "rolls",
  RESOURCES: "resources",
  STATUS: "status",
  INVENTORY: "inventory",
  SYSTEM: "system"
});

const OUTCOMES = new Set(["success", "failure", "pending", "info"]);
const SOURCE_VARIANTS = new Set(["full", "public", "single"]);
const SOURCE_PRIORITY = Object.freeze({ public: 0, single: 1, full: 2 });
const MAX_TEXT_LENGTH = 500;

const TYPE_DEFINITIONS = Object.freeze({
  [GM_LOG_EVENT_TYPES.ATTACK]: {
    category: GM_LOG_EVENT_CATEGORIES.COMBAT,
    presentation: {
      success: "TENEBRE.GmLog.Attack.Success",
      failure: "TENEBRE.GmLog.Attack.Failure",
      pending: "TENEBRE.GmLog.Attack.Pending",
      info: "TENEBRE.GmLog.Attack.Info"
    }
  },
  [GM_LOG_EVENT_TYPES.MANEUVER]: {
    category: GM_LOG_EVENT_CATEGORIES.COMBAT,
    presentation: "TENEBRE.GmLog.Maneuver"
  },
  [GM_LOG_EVENT_TYPES.ROLL]: {
    category: GM_LOG_EVENT_CATEGORIES.ROLLS,
    presentation: {
      success: "TENEBRE.GmLog.Roll.Success",
      failure: "TENEBRE.GmLog.Roll.Failure",
      pending: "TENEBRE.GmLog.Roll.Pending",
      info: "TENEBRE.GmLog.Roll.Info"
    }
  },
  [GM_LOG_EVENT_TYPES.AMMO_RELOAD]: {
    category: GM_LOG_EVENT_CATEGORIES.RESOURCES,
    presentation: "TENEBRE.GmLog.Ammo.Reload"
  },
  [GM_LOG_EVENT_TYPES.AMMO_RECOVERY]: {
    category: GM_LOG_EVENT_CATEGORIES.RESOURCES,
    presentation: {
      success: "TENEBRE.GmLog.Ammo.RecoverySuccess",
      failure: "TENEBRE.GmLog.Ammo.RecoveryFailure",
      pending: "TENEBRE.GmLog.Ammo.RecoveryPending",
      info: "TENEBRE.GmLog.Ammo.RecoveryInfo"
    }
  },
  [GM_LOG_EVENT_TYPES.RATION_CONSUMED]: {
    category: GM_LOG_EVENT_CATEGORIES.RESOURCES,
    presentation: "TENEBRE.GmLog.Ration"
  },
  [GM_LOG_EVENT_TYPES.REST_COMPLETED]: {
    category: GM_LOG_EVENT_CATEGORIES.STATUS,
    presentation: "TENEBRE.GmLog.Rest"
  },
  [GM_LOG_EVENT_TYPES.EFFECT_CHANGED]: {
    category: GM_LOG_EVENT_CATEGORIES.STATUS,
    presentation: "TENEBRE.GmLog.Effect"
  },
  [GM_LOG_EVENT_TYPES.WEAPON_READINESS]: {
    category: GM_LOG_EVENT_CATEGORIES.INVENTORY,
    presentation: {
      draw: "TENEBRE.GmLog.Weapon.Draw",
      sheathe: "TENEBRE.GmLog.Weapon.Sheathe",
      swap: "TENEBRE.GmLog.Weapon.Swap",
      info: "TENEBRE.GmLog.Weapon.Info"
    }
  },
  [GM_LOG_EVENT_TYPES.ITEM_QUANTITY_CHANGED]: {
    category: GM_LOG_EVENT_CATEGORIES.INVENTORY,
    presentation: "TENEBRE.GmLog.Inventory.QuantityChanged"
  },
  [GM_LOG_EVENT_TYPES.ITEM_USED]: {
    category: GM_LOG_EVENT_CATEGORIES.INVENTORY,
    presentation: "TENEBRE.GmLog.ItemUse"
  },
  [GM_LOG_EVENT_TYPES.SYSTEM_ACTION]: {
    category: GM_LOG_EVENT_CATEGORIES.SYSTEM,
    presentation: "TENEBRE.GmLog.System"
  }
});

/**
 * Normalize an event before it is placed in the GM-only in-memory cache.
 * Invalid events return null and must not be rendered.
 */
export function normalizeGmLogEvent(input) {
  if (!isPlainObject(input)) return null;

  const type = cleanText(input.type, 80);
  const definition = TYPE_DEFINITIONS[type];
  if (!definition) return null;

  const eventId = cleanIdentifier(input.eventId);
  const source = normalizeSource(input.source);
  if (!eventId && !source.messageId && !source.correlationId) return null;

  return Object.freeze({
    version: GM_LOG_EVENT_VERSION,
    audience: "gm",
    eventId,
    type,
    category: definition.category,
    occurredAt: normalizeTimestamp(input.occurredAt),
    outcome: normalizeOutcome(input.outcome),
    actor: normalizeReference(input.actor),
    target: normalizeReference(input.target),
    subject: normalizeReference(input.subject),
    source,
    values: Object.freeze(normalizeValues(input.values))
  });
}

/** Return the stable key used to collapse public/full variants of one action. */
export function gmLogEventKey(input) {
  const event = normalizeGmLogEvent(input);
  if (!event) return "";
  if (event.source.correlationId) return `correlation:${event.source.correlationId}`;
  if (event.eventId) return `event:${event.eventId}`;
  return event.source.messageId ? `message:${event.source.messageId}` : "";
}

/**
 * Remove duplicate variants while preferring the GM-only full event.
 * The original chronological position is retained when a fuller variant arrives.
 */
export function deduplicateGmLogEvents(inputs = []) {
  const orderedKeys = [];
  const eventsByKey = new Map();

  for (const input of inputs) {
    const event = normalizeGmLogEvent(input);
    if (!event) continue;
    const key = gmLogEventKey(event);
    if (!key) continue;

    const current = eventsByKey.get(key);
    if (!current) {
      orderedKeys.push(key);
      eventsByKey.set(key, event);
      continue;
    }

    if (sourcePriority(event) > sourcePriority(current)) {
      eventsByKey.set(key, event);
    }
  }

  return orderedKeys.map((key) => eventsByKey.get(key));
}

/** Return a localized presentation key and escaped-at-render-time interpolation data. */
export function gmLogEventPresentation(input) {
  const event = normalizeGmLogEvent(input);
  if (!event) return null;

  const definition = TYPE_DEFINITIONS[event.type];
  const selector = event.type === GM_LOG_EVENT_TYPES.WEAPON_READINESS
    ? cleanText(event.values.action, 20) || "info"
    : event.outcome;
  const key = typeof definition.presentation === "string"
    ? definition.presentation
    : definition.presentation[selector] ?? definition.presentation.info;

  return Object.freeze({
    key,
    data: Object.freeze({
      actor: event.actor?.name ?? "",
      target: event.target?.name ?? "",
      subject: event.subject?.name ?? "",
      item: event.subject?.name ?? "",
      formula: cleanText(event.values.formula),
      roll: scalarText(event.values.roll),
      amount: scalarText(event.values.amount),
      maximum: scalarText(event.values.maximum),
      days: scalarText(event.values.days),
      damage: scalarText(event.values.damage),
      protection: scalarText(event.values.protection),
      applied: scalarText(event.values.applied),
      drawn: scalarText(event.values.drawn),
      sheathed: scalarText(event.values.sheathed),
      previous: scalarText(event.values.previous),
      quantity: scalarText(event.values.quantity),
      delta: scalarText(event.values.delta),
      effect: scalarText(event.values.effect),
      message: scalarText(event.values.message)
    })
  });
}

function normalizeSource(input) {
  const source = isPlainObject(input) ? input : {};
  const variant = cleanText(source.variant, 20);
  return Object.freeze({
    messageId: cleanIdentifier(source.messageId),
    correlationId: cleanIdentifier(source.correlationId),
    variant: SOURCE_VARIANTS.has(variant) ? variant : "single"
  });
}

function normalizeReference(input) {
  if (!isPlainObject(input)) return null;
  const uuid = cleanIdentifier(input.uuid);
  const name = cleanText(input.name);
  const img = cleanText(input.img, 1_000);
  if (!uuid && !name) return null;
  return Object.freeze({ uuid, name, img });
}

function normalizeValues(input) {
  if (!isPlainObject(input)) return {};
  const output = {};
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = cleanIdentifier(rawKey);
    if (!key) continue;
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      output[key] = rawValue;
    } else if (typeof rawValue === "boolean") {
      output[key] = rawValue;
    } else if (typeof rawValue === "string") {
      output[key] = cleanText(rawValue);
    } else if (Array.isArray(rawValue)) {
      output[key] = Object.freeze(rawValue.slice(0, 20).map((value) => cleanText(value)).filter(Boolean));
    }
  }
  return output;
}

function normalizeOutcome(value) {
  const outcome = cleanText(value, 20);
  return OUTCOMES.has(outcome) ? outcome : "info";
}

function normalizeTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : 0;
}

function sourcePriority(event) {
  return SOURCE_PRIORITY[event.source.variant] ?? SOURCE_PRIORITY.single;
}

function scalarText(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return value.join(", ");
  return cleanText(value);
}

function cleanIdentifier(value) {
  return cleanText(value, 200).replace(/[^A-Za-z0-9._:/-]/g, "");
}

function cleanText(value, maxLength = MAX_TEXT_LENGTH) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
