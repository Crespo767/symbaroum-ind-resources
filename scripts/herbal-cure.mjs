import { MODULE_ID } from "./constants.mjs";
import { createChatMessageAfterDice, evaluateRoll, rollTotal } from "./dice.mjs";
import { isDeathIncapacitated, isDeadActor } from "./death-automation.mjs";
import { itemQuantity } from "./item-flags.mjs";
import { RollPrivacyService } from "./roll-privacy.mjs";
import { SocketService } from "./sockets.mjs";
import { escapeHtml } from "./utils.mjs";
import { herbalCureFormula, isHerbalCureItem, isSelfHerbalCure, medicusLevel, resolveHerbalCureTarget } from "./herbal-cure-rules.mjs";

export { herbalCureFormula, isHerbalCureItem, isSelfHerbalCure, medicusLevel, resolveHerbalCureTarget } from "./herbal-cure-rules.mjs";

const SOCKET_HANDLER = "useHerbalCure";
const OWNER_LEVEL = 3;
export class HerbalCureService {
  static register() {
    SocketService.registerHandler(SOCKET_HANDLER, useHerbalCureAsAuthority);
  }

  static async use(actor, item) {
    if (!actor || !item || !isHerbalCureItem(item)) return null;
    if (isDeathIncapacitated(actor)) {
      ui.notifications.warn(game.i18n.format("TENEBRE.Death.ActionBlocked", { actor: actor.name }));
      return null;
    }
    if (itemQuantity(item) <= 0) {
      ui.notifications.warn(game.i18n.localize("TENEBRE.HerbalCure.NoUses"));
      return null;
    }

    const target = resolveHerbalCureTarget(actor);
    if (target.error === "multiple") {
      ui.notifications.warn(game.i18n.localize("TENEBRE.HerbalCure.OneTarget"));
      return null;
    }
    if (!target.actor) return null;

    try {
      const result = await SocketService.executeAsGM(
        SOCKET_HANDLER,
        item.uuid,
        target.actor.uuid,
        { privateRoll: RollPrivacyService.isPrivateRollActive() }
      );
      if (result?.status === "full") ui.notifications.warn(game.i18n.format("TENEBRE.HerbalCure.Full", { target: target.actor.name }));
      if (result?.status === "dead") ui.notifications.warn(game.i18n.format("TENEBRE.HerbalCure.Dead", { target: target.actor.name }));
      return result;
    } catch (error) {
      console.error(`${MODULE_ID} | Herbal Cure failed.`, error);
      ui.notifications.error(game.i18n.localize("TENEBRE.HerbalCure.Failed"));
      return null;
    }
  }
}

async function useHerbalCureAsAuthority(itemUuid, targetActorUuid, options = {}) {
  const item = await globalThis.fromUuid?.(itemUuid);
  const sourceActor = item?.parent;
  const targetActor = await globalThis.fromUuid?.(targetActorUuid);
  const user = requestUser(this);
  if (!isHerbalCureItem(item) || !sourceActor || sourceActor.documentName !== "Actor") throw new Error("Invalid Herbal Cure item.");
  if (!user.isGM && !ownsActor(sourceActor, user)) throw new Error("User cannot use this Herbal Cure.");
  if (!targetActor || targetActor.documentName !== "Actor") throw new Error("Invalid Herbal Cure target.");
  if (!user.isGM && targetActor.uuid !== sourceActor.uuid && !isTargetedByUser(targetActor, user)) {
    throw new Error("Herbal Cure target is no longer selected.");
  }
  if (itemQuantity(item) <= 0) throw new Error("No Herbal Cure uses remain.");
  if (isDeathIncapacitated(sourceActor)) throw new Error("Incapacitated actors cannot use Herbal Cure.");
  if (isDeadActor(targetActor)) return { status: "dead" };

  const current = Math.max(0, Number(targetActor.system?.health?.toughness?.value) || 0);
  const maximum = Math.max(0, Number(targetActor.system?.health?.toughness?.max) || 0);
  if (maximum > 0 && current >= maximum) return { status: "full" };

  const level = medicusLevel(sourceActor);
  const cunning = Math.max(0, Number(sourceActor.system?.attributes?.cunning?.total) || 0);
  const testRoll = level > 0 ? await evaluateRoll("1d20") : null;
  const testTotal = testRoll ? rollTotal(testRoll) : null;
  const success = level === 0 || testTotal <= cunning;
  const formula = herbalCureFormula(level, success);
  const healingRoll = formula && formula !== "1" ? await evaluateRoll(formula) : null;
  const rolledHealing = formula === "1" ? 1 : healingRoll ? Math.max(0, rollTotal(healingRoll)) : 0;
  const healed = Math.max(0, Math.min(rolledHealing, Math.max(0, maximum - current)));

  await item.update({ "system.number": Math.max(0, itemQuantity(item) - 1) });
  if (healed > 0) await targetActor.update({ "system.health.toughness.value": current + healed });

  await createChatMessageAfterDice({
    speaker: ChatMessage.getSpeaker({ actor: sourceActor }),
    content: buildHerbalCureChat({ sourceActor, targetActor, item, level, cunning, testTotal, success, formula, rolledHealing, healed }),
    rolls: [testRoll, healingRoll].filter(Boolean),
    privateRoll: options?.privateRoll === true,
    flags: { [MODULE_ID]: { herbalCure: true, sourceActorUuid: sourceActor.uuid, targetActorUuid: targetActor.uuid, itemUuid: item.uuid } }
  });

  return { status: "used", level, success, formula, rolledHealing, healed };
}

export function buildHerbalCureChat({ sourceActor, targetActor, item, level, cunning, testTotal, success, formula, rolledHealing, healed }) {
  const titleKey = isSelfHerbalCure(sourceActor, targetActor)
    ? "TENEBRE.HerbalCure.TitleSelf"
    : "TENEBRE.HerbalCure.Title";
  const levelLabel = level === 1
    ? game.i18n.localize("ABILITY.NOVICE")
    : level === 2
      ? game.i18n.localize("ABILITY.ADEPT")
      : level === 3
        ? game.i18n.localize("ABILITY.MASTER")
        : "";
  const test = level > 0
    ? `<p><strong>${escapeHtml(game.i18n.localize("TENEBRE.HerbalCure.MedicusTest"))}:</strong> ${testTotal}/${cunning} — ${escapeHtml(game.i18n.localize(success ? "TENEBRE.HerbalCure.Success" : "TENEBRE.HerbalCure.Failure"))}</p>`
    : "";
  const formulaText = formula ? `${formula} = ${rolledHealing}` : "—";

  return `<div class="symbaroum chat item tenebre-herbal-cure-chat"><div class="foreground">
    <h3>${escapeHtml(game.i18n.format(titleKey, { actor: sourceActor.name, target: targetActor.name }))}</h3>
    <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin:8px 0;">
      <img src="${escapeHtml(sourceActor.img)}" alt="${escapeHtml(sourceActor.name)}" style="width:56px;height:56px;object-fit:cover;">
      <span>→</span>
      <div style="text-align:center;"><img src="${escapeHtml(item.img)}" alt="${escapeHtml(item.name)}" style="width:56px;height:56px;object-fit:cover;"><div><em>${escapeHtml(item.name)}</em></div></div>
      <span>→</span>
      <img src="${escapeHtml(targetActor.img)}" alt="${escapeHtml(targetActor.name)}" style="width:56px;height:56px;object-fit:cover;">
    </div>
    ${level > 0 ? `<p><strong>${escapeHtml(game.i18n.localize("ABILITY_LABEL.MEDICUS"))}:</strong> ${escapeHtml(levelLabel)}</p>` : ""}
    ${test}
    <p><strong>${escapeHtml(game.i18n.localize("TENEBRE.HerbalCure.Healing"))}:</strong> ${escapeHtml(formulaText)}</p>
    <p>${escapeHtml(game.i18n.format(healed > 0 ? "TENEBRE.HerbalCure.Healed" : "TENEBRE.HerbalCure.NotHealed", { target: targetActor.name, healing: healed }))}</p>
  </div></div>`;
}

function requestUser(context) {
  const senderId = context?.socketdata?.userId;
  const user = senderId ? game.users?.get?.(senderId) : (game.user?.isGM ? game.user : null);
  if (!user?.active) throw new Error("Socket request has no authenticated active user.");
  return user;
}

function ownsActor(actor, user) {
  return actor.testUserPermission?.(user, globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? OWNER_LEVEL) === true;
}

function isTargetedByUser(actor, user) {
  return Array.from(user.targets ?? []).some((token) => token.actor?.uuid === actor.uuid || token.actor?.id === actor.id);
}
