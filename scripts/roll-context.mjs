/**
 * Contexto de um ataque com arma enquanto o diálogo do sistema está aberto, um por ator.
 * Substitui as antigas variáveis globais (activeWeaponRoll / activeManeuverWeaponRoll),
 * que misturavam ataques simultâneos de atores diferentes.
 */
const weaponRolls = new Map();

/** O sistema monta o id do diálogo como `${actor.id}${randomID(20)}`. */
const DIALOG_RANDOM_SUFFIX_LENGTH = 20;

export function beginWeaponRoll(state) {
  const key = state?.actor?.id;
  if (!key) return () => {};
  weaponRolls.set(key, state);
  return () => endWeaponRoll(state);
}

export function endWeaponRoll(state) {
  const key = state?.actor?.id;
  if (key && weaponRolls.get(key) === state) weaponRolls.delete(key);
}

export function getWeaponRoll(actor) {
  return actor?.id ? weaponRolls.get(actor.id) ?? null : null;
}

export function actorIdFromRollDialog(root) {
  const input = root?.querySelector?.('input[id^="modifier-"]');
  const dialogId = String(input?.id ?? "").slice("modifier-".length);
  return dialogId.length > DIALOG_RANDOM_SUFFIX_LENGTH ? dialogId.slice(0, -DIALOG_RANDOM_SUFFIX_LENGTH) : null;
}

export function getWeaponRollForDialog(root) {
  const actorId = actorIdFromRollDialog(root);
  return actorId ? weaponRolls.get(actorId) ?? null : null;
}
