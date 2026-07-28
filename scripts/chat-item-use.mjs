import { MODULE_ID } from "./constants.mjs";
import { TenebreSettings } from "./settings.mjs";
import { isRation } from "./item-flags.mjs";
import { RationService } from "./rations.mjs";
import { escapeHtml } from "./utils.mjs";
import { ContainerService } from "./containers.mjs";

const CHAT_ITEM_USE_PAUSED = true;
const CHAT_ITEM_TYPES = new Set([
  "ability",
  "ritual",
  "mysticalPower",
  "mystical-power",
  "trait",
  "boon",
  "burden",
  "artifact",
  "equipment",
  "weapon",
  "armor"
]);

export class ChatItemUseService {
  static isEnabled() {
    return !CHAT_ITEM_USE_PAUSED && TenebreSettings.get("enableChatItemUse");
  }

  static canSend(item) {
    return Boolean(
      this.isEnabled()
      && item?.isOwned
      && item?.parent
      && !ContainerService.isContainer(item)
      && isSupportedChatItem(item)
    );
  }

  static async send(actor, item, { preferAttack = false } = {}) {
    if (!this.isEnabled()) {
      ui.notifications.warn(game.i18n.localize("TENEBRE.ChatItemUse.Disabled"));
      return null;
    }

    if (!actor || !item) return null;

    if (TenebreSettings.get("enableRations") && isRation(item)) {
      await RationService.consumeDay(actor, item);
      return null;
    }

    if (!this.canSend(item)) {
      ui.notifications.warn(game.i18n.localize("TENEBRE.ChatItemUse.NotAvailable"));
      return null;
    }

    const token = getSpeakerToken(actor);
    const targetToken = getPrimaryTarget();
    const content = await renderSymbaroumItemCard(item, actor, { targetToken });
    const animationsEnabled = TenebreSettings.get("enableAutomatedAnimationsIntegration");
    const context = animationsEnabled
      ? buildAutomatedAnimationsContext(actor, item, { token, targetToken, preferAttack })
      : null;

    const flags = {
      [MODULE_ID]: {
        chatItemUse: true,
        itemUuid: item.uuid,
        itemName: item.name,
        itemType: item.type,
        isEquipment: item.type === "equipment" || item.system?.isEquipment === true,
        actorUuid: actor.uuid,
        tokenUuid: token?.document?.uuid ?? token?.uuid ?? null,
        targetTokenUuid: targetToken?.document?.uuid ?? targetToken?.uuid ?? null
      }
    };
    if (context) flags.world = { context };

    const chatData = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor, token }),
      rollMode: game.settings.get("core", "rollMode"),
      content,
      flags
    };

    ChatMessage.applyRollMode(chatData, chatData.rollMode);
    const message = await ChatMessage.create(chatData);
    ui.notifications.info(game.i18n.format("TENEBRE.ChatItemUse.Sent", { item: item.name }));
    return message;
  }
}

function isSupportedChatItem(item) {
  if (!item) return false;
  if (CHAT_ITEM_TYPES.has(item.type)) return true;

  const system = item.system ?? {};
  return Boolean(
    system.isPower
    || system.isTrait
    || system.isAbility
    || system.isMysticalPower
    || system.isRitual
    || system.isBurden
    || system.isBoon
    || system.isArtifact
    || system.isEquipment
    || system.isWeapon
    || system.isArmor
  );
}

async function renderSymbaroumItemCard(item, actor, { targetToken = null } = {}) {
  const itemData = {
    system: foundry.utils.deepClone(item.system ?? {}),
    img: isUnknownImage(item.img) ? null : item.img,
    name: item.name,
    enrichedName: await foundry.applications.ux.TextEditor.enrichHTML(`@UUID[${item.uuid}]{${item.name}}`, { async: true }),
    tenebreChatUse: true,
    tenebreActorName: actor.name,
    tenebreTargetName: targetToken?.name ?? targetToken?.actor?.name ?? ""
  };

  const header = buildUseHeader(item, actor, targetToken);
  try {
    const itemCard = await foundry.applications.handlebars.renderTemplate("systems/symbaroum/template/chat/item.hbs", itemData);
    return `${header}${itemCard}`;
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not render Symbaroum item chat card for "${item.name}".`, error);
    return `${header}${fallbackItemCard(item, actor, targetToken)}`;
  }
}

function buildUseHeader(item, actor, targetToken) {
  const actorImg = actor.img && !isUnknownImage(actor.img)
    ? `<img src="${escapeHtml(actor.img)}" alt="" style="width:48px;height:48px;object-fit:cover;border:0;">`
    : "";
  const type = itemTypeLabel(item);
  const target = targetToken
    ? `<p style="margin:2px 0 0;"><strong>${escapeHtml(game.i18n.localize("TENEBRE.ChatItemUse.Target"))}:</strong> ${escapeHtml(targetToken.name ?? targetToken.actor?.name ?? "")}</p>`
    : "";

  return `
    <div class="symbaroum chat item tenebre-chat-item-use">
      <div class="foreground">
        <div style="display:flex;gap:10px;align-items:center;">
          ${actorImg}
          <div>
            <h3 style="margin:0;">${escapeHtml(game.i18n.format("TENEBRE.ChatItemUse.Uses", { actor: actor.name, item: item.name }))}</h3>
            ${type ? `<p class="type" style="margin:2px 0 0;">${escapeHtml(type)}</p>` : ""}
            ${target}
          </div>
        </div>
      </div>
    </div>
  `;
}

function itemTypeLabel(item) {
  const system = item?.system ?? {};
  if (system.isRitual) return game.i18n.localize("ITEM.RITUAL");
  if (system.isMysticalPower) return game.i18n.localize("ITEM.MYSTICAL_POWER");
  if (system.isAbility) return game.i18n.localize("ITEM.ABILITY");
  if (system.isTrait) return game.i18n.localize("ITEM.TRAIT");
  if (system.isBoon) return game.i18n.localize("ITEM.BOON");
  if (system.isBurden) return game.i18n.localize("ITEM.BURDEN");
  if (system.isArtifact) return game.i18n.localize("ITEM.ARTIFACT");
  if (system.isWeapon) return game.i18n.localize("ITEM.WEAPON");
  if (system.isArmor) return game.i18n.localize("ITEM.ARMOR");
  if (system.isEquipment) return game.i18n.localize("ITEM.EQUIPMENT");
  return item?.type ?? "";
}

function buildAutomatedAnimationsContext(actor, item, { token = null, targetToken = null, preferAttack = false } = {}) {
  const context = {
    itemUuid: item.uuid,
    actorUuid: actor.uuid
  };

  const tokenUuid = token?.document?.uuid ?? token?.uuid;
  if (tokenUuid) context.tokenUuid = tokenUuid;

  const targetTokenUuid = targetToken?.document?.uuid ?? targetToken?.uuid;
  if (targetTokenUuid) context.targetTokenUuid = targetTokenUuid;

  if (preferAttack || targetTokenUuid) {
    context.criticaled = false;
    context.fumbled = false;
  }

  return context;
}

function getSpeakerToken(actor) {
  const controlled = canvas?.tokens?.controlled?.find((token) => token.actor?.id === actor.id);
  if (controlled) return controlled;

  const activeTokens = actor.getActiveTokens?.() ?? [];
  return Array.isArray(activeTokens) ? activeTokens[0] ?? null : activeTokens?.object ?? null;
}

function getPrimaryTarget() {
  return Array.from(game.user?.targets ?? [])[0] ?? null;
}

function isUnknownImage(src) {
  return !src || String(src).includes("/unknown");
}

function fallbackItemCard(item, actor, targetToken) {
  const target = targetToken
    ? `<p><strong>${escapeHtml(game.i18n.localize("TENEBRE.ChatItemUse.Target"))}:</strong> ${escapeHtml(targetToken.name ?? targetToken.actor?.name ?? "")}</p>`
    : "";

  return `
    <div class="symbaroum chat item tenebre-chat-item-use">
      <div class="foreground">
        <h3>${escapeHtml(item.name)}</h3>
        <p><strong>${escapeHtml(game.i18n.localize("TENEBRE.ChatItemUse.Actor"))}:</strong> ${escapeHtml(actor.name)}</p>
        ${target}
        ${item.img && !isUnknownImage(item.img) ? `<img src="${escapeHtml(item.img)}" data-tooltip="${escapeHtml(item.name)}">` : ""}
      </div>
    </div>
  `;
}
