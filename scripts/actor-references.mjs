/** IDs antigos continuam válidos; atores de token e compêndio precisam do UUID completo. */
export function actorReference(actor) {
  return actor?.uuid && actor.uuid !== `Actor.${actor.id}` ? actor.uuid : actor?.id;
}

export function actorStateKey(actor) {
  return encodeURIComponent(actorReference(actor)).replaceAll(".", "%2E");
}

export function actorMatchesReference(actor, reference) {
  return Boolean(actor && reference && (reference === actorReference(actor) || reference === actor.uuid));
}

function asActor(document) {
  const actor = document?.actor ?? document;
  return actor && (actor.documentName === "Actor" || (!actor.documentName && actor.system)) ? actor : null;
}

export function resolveActorReferenceSync(reference) {
  if (!reference || typeof reference !== "string") return null;
  if (!reference.includes(".")) return asActor(globalThis.game?.actors?.get?.(reference));
  try { return asActor(globalThis.fromUuidSync?.(reference)); } catch { return null; }
}

export async function resolveActorReference(reference) {
  const actor = resolveActorReferenceSync(reference);
  if (actor || !reference?.includes(".")) return actor;
  try { return asActor(await globalThis.fromUuid?.(reference)); } catch { return null; }
}
