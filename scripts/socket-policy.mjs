import { MANEUVER_EFFECTS } from "./constants.mjs";

const MAX_BATCH_SIZE = 50;
const MAX_PAYLOAD_BYTES = 100_000;
const MANEUVER_EFFECT_IDS = new Set(Object.values(MANEUVER_EFFECTS));
const TURN_END_EFFECT_IDS = new Set([
  MANEUVER_EFFECTS.SHOVED,
  MANEUVER_EFFECTS.CHARGING,
  MANEUVER_EFFECTS.CAREFUL_AIM,
  MANEUVER_EFFECTS.KNOCKOUT_READY,
  MANEUVER_EFFECTS.TAKING_INITIATIVE,
  MANEUVER_EFFECTS.INITIATIVE_BONUS,
  MANEUVER_EFFECTS.TOTAL_DEFENSE,
  MANEUVER_EFFECTS.TOTAL_OFFENSE,
  MANEUVER_EFFECTS.FREE_ATTACK_OPENING
]);
const MOVEMENT_BLOCKING_EFFECT_IDS = new Set([
  MANEUVER_EFFECTS.GRAPPLED,
  MANEUVER_EFFECTS.MAINTAINING_GRAPPLE,
  MANEUVER_EFFECTS.KNOCKED_DOWN,
  MANEUVER_EFFECTS.KNOCKED_OUT
]);
const MANEUVER_EFFECT_SOURCE_KEYS = new Set([
  "name",
  "label",
  "img",
  "icon",
  "statuses",
  "duration",
  "flags"
]);
const MANEUVER_EFFECT_UPDATE_KEYS = new Set(["_id", "duration", "flags"]);
const MANEUVER_FLAG_KEYS = new Set([
  "maneuverEffect",
  "effectId",
  "sourceActorId",
  "sourceActorName",
  "expiration",
  "rounds",
  "startRound",
  "startTurn",
  "combatId",
  "movementBlocked",
  "movementActions"
]);
const DURATION_KEYS = new Set(["rounds", "startRound", "startTurn"]);

export function assertSafeBatch(values, label) {
  if (!Array.isArray(values) || values.length === 0 || values.length > MAX_BATCH_SIZE) {
    throw new Error(`${label} must contain between 1 and ${MAX_BATCH_SIZE} entries.`);
  }
  assertSafePayload(values, label);
}

export function assertSafePayload(value, label) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch (_error) {
    throw new Error(`${label} must be serializable.`);
  }
  if (typeof serialized !== "string" || serialized.length > MAX_PAYLOAD_BYTES) {
    throw new Error(`${label} exceeds the allowed payload size.`);
  }
}

export function isModuleManeuverEffect(source, moduleId) {
  const flags = source?.flags?.[moduleId];
  return flags?.maneuverEffect === true
    && MANEUVER_EFFECT_IDS.has(String(flags.effectId ?? ""));
}

export function isAllowedManeuverEffectCreate(source, moduleId) {
  if (!isPlainObject(source) || !hasOnlyKeys(source, MANEUVER_EFFECT_SOURCE_KEYS)) return false;
  if (!isModuleManeuverEffect(source, moduleId)) return false;
  if (!isSafeEffectLabel(source.name) || !isSafeEffectLabel(source.label)) return false;
  if (!isSafeEffectIcon(source.img) || source.icon !== source.img) return false;

  const effectId = String(source.flags[moduleId].effectId);
  const statuses = Array.isArray(source.statuses) ? source.statuses.map(String) : [];
  if (statuses.length !== 1 || statuses[0] !== effectId) return false;
  if (!isAllowedDuration(source.duration)) return false;
  return isAllowedManeuverFlags(source.flags, moduleId, effectId);
}

export function isAllowedManeuverEffectUpdate(update, existing, moduleId) {
  if (!isPlainObject(update) || !hasOnlyKeys(update, MANEUVER_EFFECT_UPDATE_KEYS)) return false;
  if (String(update._id ?? "") !== String(existing?.id ?? existing?._id ?? "")) return false;

  const existingFlags = existing?.flags?.[moduleId] ?? existing?._source?.flags?.[moduleId];
  const effectId = String(existingFlags?.effectId ?? "");
  if (!MANEUVER_EFFECT_IDS.has(effectId) || !isAllowedDuration(update.duration)) return false;
  return isAllowedManeuverFlags(update.flags, moduleId, effectId);
}

export function isAllowedToughnessUpdate(updates, currentValue) {
  if (!isPlainObject(updates)) return false;
  const keys = Object.keys(updates);
  if (keys.length !== 1 || keys[0] !== "system.health.toughness.value") return false;

  const current = Number(currentValue);
  const next = Number(updates[keys[0]]);
  return Number.isFinite(current) && Number.isFinite(next) && next >= 0 && next <= current;
}

export function isAllowedCombatantUpdate(updates) {
  if (!isPlainObject(updates)) return false;
  const keys = Object.keys(updates);
  if (!keys.length || keys.some((key) => !["initiative", "defeated"].includes(key))) return false;
  if ("initiative" in updates && !Number.isFinite(Number(updates.initiative))) return false;
  if ("defeated" in updates && updates.defeated !== true) return false;
  return true;
}

export function sanitizeSocketOptions(options) {
  return { render: options?.render !== false };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, allowedKeys) {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isAllowedDuration(duration) {
  if (!isPlainObject(duration) || !hasOnlyKeys(duration, DURATION_KEYS)) return false;
  return Object.values(duration).every((value) => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 10_000;
  });
}

function isAllowedManeuverFlags(flags, moduleId, effectId) {
  if (!isPlainObject(flags) || !isPlainObject(flags[moduleId])) return false;
  if (Object.keys(flags).some((scope) => scope !== moduleId && scope !== "core")) return false;
  if (flags.core !== undefined) {
    if (!isPlainObject(flags.core)
      || Object.keys(flags.core).some((key) => key !== "statusId")
      || String(flags.core.statusId ?? "") !== effectId) {
      return false;
    }
  }

  const moduleFlags = flags[moduleId];
  if (!hasOnlyKeys(moduleFlags, MANEUVER_FLAG_KEYS)) return false;
  if (moduleFlags.maneuverEffect !== true || String(moduleFlags.effectId ?? "") !== effectId) return false;
  if (!Object.entries(moduleFlags).every(([key, value]) => isAllowedManeuverFlagValue(key, value))) return false;
  return hasCanonicalManeuverTiming(moduleFlags, effectId)
    && hasCanonicalManeuverMovement(moduleFlags, effectId);
}

function isAllowedManeuverFlagValue(key, value) {
  if (["maneuverEffect", "movementBlocked"].includes(key)) return typeof value === "boolean";
  if (key === "effectId") return typeof value === "string" && MANEUVER_EFFECT_IDS.has(value);
  if (["sourceActorId", "combatId"].includes(key)) {
    return value === null || (typeof value === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(value));
  }
  if (key === "sourceActorName") return value === null || isSafeEffectLabel(value);
  if (key === "expiration") return value === null || ["turnEnd", "rounds"].includes(value);
  if (["rounds", "startRound", "startTurn", "movementActions"].includes(key)) {
    if (value === null) return true;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 10_000;
  }
  return false;
}

function hasCanonicalManeuverTiming(flags, effectId) {
  if (TURN_END_EFFECT_IDS.has(effectId)) {
    return flags.expiration === "turnEnd" && Number(flags.rounds) === 1;
  }
  if (effectId === MANEUVER_EFFECTS.DELAYED_INITIATIVE) {
    return flags.expiration === "rounds" && Number(flags.rounds) === 1;
  }
  if (effectId === MANEUVER_EFFECTS.POISONED) {
    return flags.expiration === "rounds" && Number(flags.rounds) === 3;
  }
  return flags.expiration === null && flags.rounds === null;
}

function hasCanonicalManeuverMovement(flags, effectId) {
  if (MOVEMENT_BLOCKING_EFFECT_IDS.has(effectId)) {
    return flags.movementBlocked === true && Number(flags.movementActions) === 0;
  }
  if (effectId === MANEUVER_EFFECTS.CAREFUL_AIM) {
    return !("movementBlocked" in flags) && Number(flags.movementActions) === 0;
  }
  return !("movementBlocked" in flags) && !("movementActions" in flags);
}

function isSafeEffectLabel(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 200
    && !/[<>\u0000-\u001F\u007F]/.test(value);
}

function isSafeEffectIcon(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 500
    && !value.includes("..")
    && /^(?:icons|systems\/symbaroum)\/[A-Za-z0-9_./-]+$/.test(value);
}
