import { MODULE_ID } from "./constants.mjs";
import { createChatMessageAfterDice, evaluateRoll, rollTotal } from "./dice.mjs";
import { isDeathIncapacitated, isDeadActor } from "./death-automation.mjs";
import { itemQuantity } from "./item-flags.mjs";
import { RollPrivacyService } from "./roll-privacy.mjs";
import { SocketService } from "./sockets.mjs";
import { escapeHtml } from "./utils.mjs";
import { herbalCureFormula, herbalCureMethodLevel, isHerbalCureItem, isSelfHerbalCure, medicusLevel, resolveHerbalCureTarget } from "./herbal-cure-rules.mjs";

export { herbalCureFormula, herbalCureMethodLevel, isHerbalCureItem, isSelfHerbalCure, medicusLevel, resolveHerbalCureTarget } from "./herbal-cure-rules.mjs";

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

    const method = await promptHerbalCureMethod(actor);
    if (!method) return null;

    try {
      const result = await SocketService.executeAsGM(
        SOCKET_HANDLER,
        item.uuid,
        target.actor.uuid,
        {
          privateRoll: RollPrivacyService.isPrivateRollActive(),
          useMedicus: method === "medicus"
        }
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

  const level = herbalCureMethodLevel(sourceActor, options?.useMedicus === true);
  if (level === null) throw new Error("Actor cannot use Herbal Cure with Medicus.");
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

export async function promptHerbalCureMethod(actor) {
  const hasMedicus = medicusLevel(actor) > 0;
  const title = game.i18n.localize("TENEBRE.HerbalCure.MethodTitle");
  const content = `<div class="symbaroum dialog tenebre-symbaroum-dialog tenebre-herbal-cure-method-dialog">
    <p>${escapeHtml(game.i18n.localize("TENEBRE.HerbalCure.MethodPrompt"))}</p>
    ${hasMedicus ? "" : `<p class="notes">${escapeHtml(game.i18n.localize("TENEBRE.HerbalCure.MedicusUnavailable"))}</p>`}
  </div>`;
  const buttons = [];
  if (hasMedicus) {
    buttons.push({
      action: "medicus",
      icon: "fas fa-user-doctor",
      label: game.i18n.localize("TENEBRE.HerbalCure.UseMedicus"),
      default: true,
      callback: () => "medicus"
    });
  }
  buttons.push(
    {
      action: "standard",
      icon: "fas fa-leaf",
      label: game.i18n.localize("TENEBRE.HerbalCure.UseStandard"),
      default: !hasMedicus,
      callback: () => "standard"
    },
    {
      action: "cancel",
      icon: "fas fa-times",
      label: game.i18n.localize("TENEBRE.Common.Cancel"),
      callback: () => null
    }
  );

  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (DialogV2?.wait) {
    return DialogV2.wait({
      window: { title },
      position: { width: 440 },
      content,
      buttons,
      rejectClose: false
    });
  }

  return new Promise((resolve) => {
    let completed = false;
    const complete = (value) => {
      if (completed) return;
      completed = true;
      resolve(value);
    };
    const legacyButtons = Object.fromEntries(buttons.map((button) => [button.action, {
      icon: `<i class="${button.icon}"></i>`,
      label: button.label,
      callback: () => complete(button.callback())
    }]));
    new Dialog({
      title,
      content,
      buttons: legacyButtons,
      default: hasMedicus ? "medicus" : "standard",
      close: () => complete(null)
    }).render(true);
  });
}

export function buildHerbalCureChat({ sourceActor, targetActor, item, level, cunning, testTotal, success, formula, rolledHealing, healed }) {
  const selfUse = isSelfHerbalCure(sourceActor, targetActor);
  const titleKey = selfUse
    ? "TENEBRE.HerbalCure.TitleSelf"
    : "TENEBRE.HerbalCure.Title";
  const levelLabel = level === 1
    ? game.i18n.localize("ABILITY.NOVICE")
    : level === 2
      ? game.i18n.localize("ABILITY.ADEPT")
      : level === 3
        ? game.i18n.localize("ABILITY.MASTER")
        : "";
  const test = level > 0 ? `<p class="tenebre-berserker-test">${escapeHtml(game.i18n.localize("TENEBRE.HerbalCure.MedicusTest"))}</p>
      <div class="tenebre-berserker-roll-summary">
        <p class="tenebre-berserker-objective">${escapeHtml(game.i18n.localize("TENEBRE.NpcAttackChat.Objective"))}: ${cunning}</p>
        <p class="tenebre-berserker-roll">${escapeHtml(game.i18n.localize("TENEBRE.NpcAttackChat.Roll"))}: ${testTotal}</p>
      </div>
      <p>${escapeHtml(game.i18n.localize(success ? "TENEBRE.HerbalCure.Success" : "TENEBRE.HerbalCure.Failure"))}.</p>` : "";
  const formulaText = formula ? `${formula} = ${rolledHealing}` : "—";
  const participants = [
    buildHerbalCureFigure(sourceActor.img, sourceActor.name, "tenebre-berserker-actor"),
    '<span class="tenebre-berserker-flow-arrow" aria-hidden="true">→</span>',
    buildHerbalCureFigure(item.img, item.name, "tenebre-berserker-ability")
  ];
  if (!selfUse) {
    participants.push(
      '<span class="tenebre-berserker-flow-arrow" aria-hidden="true">→</span>',
      buildHerbalCureFigure(targetActor.img, targetActor.name, "tenebre-berserker-target")
    );
  }

  return `<div class="symbaroum chat item tenebre-herbal-cure-chat"><div class="foreground">
    <div class="tenebre-berserker-card">
      <p class="tenebre-berserker-intro">${escapeHtml(game.i18n.format(titleKey, { actor: sourceActor.name, target: targetActor.name }))}</p>
      <div class="tenebre-berserker-participants">${participants.join("")}</div>
      <div class="tenebre-berserker-details">
        ${level > 0 ? `<p><strong>${escapeHtml(game.i18n.localize("ABILITY_LABEL.MEDICUS"))}:</strong> ${escapeHtml(levelLabel)}</p>` : ""}
        ${test}
        <p><strong>${escapeHtml(game.i18n.localize("TENEBRE.HerbalCure.Healing"))}:</strong> ${escapeHtml(formulaText)}</p>
        <p>${escapeHtml(game.i18n.format(healed > 0 ? "TENEBRE.HerbalCure.Healed" : "TENEBRE.HerbalCure.NotHealed", { target: targetActor.name, healing: healed }))}</p>
      </div>
    </div>
  </div></div>`;
}

function buildHerbalCureFigure(src, name, className) {
  const safeName = escapeHtml(name);
  return `<figure class="${className}">
    <img src="${escapeHtml(src || "icons/svg/mystery-man.svg")}" alt="${safeName}" loading="lazy">
    <figcaption><span class="${className === "tenebre-berserker-ability" ? "tenebre-berserker-ability-link" : ""}">${safeName}</span></figcaption>
  </figure>`;
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
