const PRONE_STATUS_ID = "prone";
const CONTEXT_TTL_MS = 5000;

export function isProneActor(actor) {
  if (!actor) return false;
  if (actor.statuses?.has?.(PRONE_STATUS_ID)) return true;

  return Array.from(actor.effects ?? []).some((effect) => {
    if (effect.statuses?.has?.(PRONE_STATUS_ID)) return true;
    if (effect.statuses?.includes?.(PRONE_STATUS_ID)) return true;
    return effect.getFlag?.("core", "statusId") === PRONE_STATUS_ID
      || effect.flags?.core?.statusId === PRONE_STATUS_ID;
  });
}

export function isMeleeWeapon(weapon) {
  if (!weapon) return false;
  if (weapon.isMelee === true || weapon.system?.isMelee === true) return true;
  if (weapon.isDistance === true || weapon.system?.isDistance === true) return false;

  const reference = String(weapon.reference ?? weapon.system?.reference ?? "");
  return ["1handed", "short", "long", "unarmed", "heavy", "shield"].includes(reference);
}

export function buildProneAdvantageContext(attacker, weapon, targets, now = Date.now()) {
  if (!isMeleeWeapon(weapon)) return null;

  const selectedTargets = Array.from(targets ?? []);
  if (selectedTargets.length !== 1) return null;

  const targetToken = selectedTargets[0];
  const targetActor = targetToken?.actor ?? targetToken?.document?.actor ?? null;
  if (!isProneActor(targetActor)) return null;

  return {
    attackerActorId: attacker?.id ?? null,
    targetActor,
    targetActorId: targetActor.id ?? null,
    targetTokenId: targetToken.id ?? targetToken.document?.id ?? null,
    targetName: targetToken.name ?? targetToken.document?.name ?? targetActor.name ?? "",
    expiresAt: now + CONTEXT_TTL_MS
  };
}

export class ProneAdvantageService {
  static captureWeaponAttack(attacker, weapon) {
    const context = buildProneAdvantageContext(attacker, weapon, game.user?.targets);
    if (!game.tenebreResources) game.tenebreResources = {};
    game.tenebreResources.proneAdvantageContext = context;
    return context;
  }

  static applyToDialog(root) {
    const context = game.tenebreResources?.proneAdvantageContext ?? null;
    if (!context) return false;

    if (context.expiresAt < Date.now() || !isProneActor(context.targetActor)) {
      game.tenebreResources.proneAdvantageContext = null;
      return false;
    }

    const advantage = findWeaponAdvantageInput(root);
    if (!advantage) return false;

    game.tenebreResources.proneAdvantageContext = null;
    advantage.checked = true;
    insertProneNotice(root, advantage, context.targetName);
    return true;
  }
}

function findWeaponAdvantageInput(root) {
  if (!root?.querySelector) return null;

  const legacyWeaponDamage = root.querySelector("input[id^='weapondamage-']");
  if (legacyWeaponDamage) {
    return root.querySelector("input[id^='advantage-']");
  }

  const enhancedWeaponDamage = root.querySelector("#weapondamage");
  if (enhancedWeaponDamage) {
    return root.querySelector("input#advantage");
  }

  return null;
}

function insertProneNotice(root, advantage, targetName) {
  if (root.querySelector?.(".tenebre-prone-advantage-notice")) return;

  const documentRef = root.ownerDocument ?? globalThis.document;
  if (!documentRef?.createElement) return;

  const notice = documentRef.createElement("div");
  notice.className = "tenebre-prone-advantage-notice";
  notice.textContent = game.i18n.format("TENEBRE.ProneAdvantage.Notice", {
    target: targetName
  });

  const advantageRow = advantage.closest?.(".advantage, .simplebox") ?? advantage.parentElement;
  advantageRow?.parentElement?.insertBefore(notice, advantageRow);
}
