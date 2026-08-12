export const NEW_PLAYER_TOUGHNESS = 10;

export function hasExplicitToughness(createData) {
  if (!createData || typeof createData !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(createData, "system.health.toughness.value")) return true;

  let current = createData;
  for (const key of ["system", "health", "toughness", "value"]) {
    if (!current || typeof current !== "object" || !Object.prototype.hasOwnProperty.call(current, key)) return false;
    current = current[key];
  }
  return true;
}

export function initialPlayerToughnessUpdate(actor, createData) {
  if (actor?.type !== "player" || hasExplicitToughness(createData)) return null;
  return { "system.health.toughness.value": NEW_PLAYER_TOUGHNESS };
}

export class ActorCreationService {
  static register() {
    Hooks.on("preCreateActor", (actor, createData) => {
      const update = initialPlayerToughnessUpdate(actor, createData);
      if (update) actor.updateSource(update);
    });
  }
}
