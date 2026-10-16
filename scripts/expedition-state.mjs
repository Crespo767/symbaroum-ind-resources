import { MODULE_ID } from "./constants.mjs";

const pendingExpeditionOperations = new Map();

/** Leitura compatível com expedições existentes em system e em flags. */
export function getActorExpeditionData(actor) {
  const sysExp = actor?.system?.expedition || {};
  const flagExp = actor?.flags?.[MODULE_ID]?.expedition || {};
  const merged = { ...flagExp, ...sysExp };
  if (flagExp.activeSearch !== undefined) merged.activeSearch = Boolean(flagExp.activeSearch);
  else if (sysExp.activeSearch !== undefined) merged.activeSearch = Boolean(sysExp.activeSearch);
  else merged.activeSearch = true;
  merged.guideId = sysExp.guideId || flagExp.guideId || "";
  merged.guideUuid = sysExp.guideUuid || flagExp.guideUuid || "";
  merged.tables = { ...(flagExp.tables || {}), ...(sysExp.tables || {}) };
  merged.day = sysExp.day !== undefined ? sysExp.day : (flagExp.day !== undefined ? flagExp.day : 1);
  merged.active = sysExp.active !== undefined ? sysExp.active : (flagExp.active !== undefined ? flagExp.active : false);
  const sysDay = sysExp.dayState || {};
  const flagDay = flagExp.dayState || {};
  merged.dayState = {
    ...flagDay, ...sysDay,
    orientation: sysDay.orientation || flagDay.orientation || null,
    rations: { ...(flagDay.rations || {}), ...(sysDay.rations || {}) },
    events: { ...(flagDay.events || {}), ...(sysDay.events || {}) }
  };
  return merged;
}

/** A revisão distingue inclusive reinícios diferentes com o mesmo número de dia. */
export function expeditionDayKey(actor) {
  const exp = getActorExpeditionData(actor);
  return JSON.stringify([Boolean(exp.active), Number(exp.day), exp.dayState.revision ?? ""]);
}

export function expeditionOrientationKey(actor) {
  const exp = getActorExpeditionData(actor);
  const state = exp.dayState.orientation;
  return JSON.stringify([state?.timestamp ?? null, state?.revision ?? null, Boolean(state?.rolled),
    actor?.system?.location?.region ?? "ambria", exp.guideUuid || exp.guideId, exp.activeSearch, exp.tables]);
}

export function expeditionEventKey(actor, slots) {
  const events = getActorExpeditionData(actor).dayState.events;
  return JSON.stringify(slots.map(slot => [slot, events[slot]?.revision ?? null, Boolean(events[slot]?.rolled)]));
}

export function expeditionDayUpdate(day, active) {
  const revision = globalThis.foundry?.utils?.randomID?.()
    ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const dayState = { revision, orientation: null, rations: {}, events: {} };
  return {
    "system.expedition.active": active,
    "system.expedition.day": day,
    "system.expedition.==dayState": dayState,
    [`flags.${MODULE_ID}.expedition.active`]: active,
    [`flags.${MODULE_ID}.expedition.day`]: day,
    [`flags.${MODULE_ID}.expedition.==dayState`]: dayState
  };
}

/** Alimentação e mudança de dia compartilham a mesma fila no executor. */
export async function runExpeditionOperation(party, operation) {
  const key = party.uuid ?? party.id ?? party;
  const previous = pendingExpeditionOperations.get(key) ?? Promise.resolve();
  const pending = previous.catch(() => {}).then(operation);
  pendingExpeditionOperations.set(key, pending);
  try {
    return await pending;
  } finally {
    if (pendingExpeditionOperations.get(key) === pending) pendingExpeditionOperations.delete(key);
  }
}
