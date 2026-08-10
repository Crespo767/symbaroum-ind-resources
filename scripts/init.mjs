import { MODULE_ID, AMMO_TYPES } from "./constants.mjs";
import { TenebreSettings } from "./settings.mjs";
import { patchWeaponRolls } from "./weapon-wrapper.mjs";
import { registerSheetHooks } from "./sheet-ui.mjs";
import { RationService } from "./rations.mjs";
import { AmmoService } from "./ammo.mjs";
import { RestService } from "./rest.mjs";
import { HotbarService } from "./hotbar.mjs";
import { findAmmoItems, isAmmo, isRation, sumItemQuantities } from "./item-flags.mjs";
import { VerseService } from "./verses.mjs";
import { EncumbranceService } from "./encumbrance.mjs";
import { EncumbranceVisualService } from "./encumbrance-visuals.mjs";
import { HungerService } from "./hunger.mjs";
import { ContainerService } from "./containers.mjs";
import { ManeuverService } from "./maneuvers.mjs";
import { setupBithirMod } from "./bithir-macros.mjs";
import { TokenActionHudIntegration } from "./token-action-hud.mjs";
import { MovementService } from "./movement-ruler.mjs";
import { ChatItemUseService } from "./chat-item-use.mjs";
import { CompatibilityService } from "./compatibility.mjs";
import { RollPrivacyService } from "./roll-privacy.mjs";
import { RitualBrowserService } from "./ritual-browser.mjs";
import { WeaponReadinessService } from "./weapon-readiness.mjs";
import { WeaponReadinessHudService } from "./weapon-readiness-hud.mjs";
import { WeaponReadinessVisualService } from "./weapon-readiness-visuals.mjs";
import { InventoryCleanupService } from "./inventory-cleanup.mjs";
import { InventoryDefaultStateService } from "./inventory-default-state.mjs";
import { GmLogService } from "./gm-log-service.mjs";
import { GmLogUiService } from "./gm-log-ui.mjs";
import { GroundContainerService } from "./ground-containers.mjs";
import { ContainerTransferService } from "./container-transfer.mjs";
import { NpcAttackChatService } from "./npc-attack-chat.mjs";
import { OpposedTestChatService } from "./opposed-test-chat.mjs";
import { StatusEffectPickerService } from "./status-effect-picker.mjs";
import { BerserkerChatService } from "./berserker-chat.mjs";
import { ResistanceChatService } from "./resistance-chat.mjs";
import { JournalIntegrationService } from "./journal-integration.mjs";
import { MoneyService } from "./money.mjs";
import { PainThresholdChoiceService } from "./pain-threshold-choice.mjs";
import { StandUpService } from "./stand-up.mjs";
import { DeathAutomationService, isDeathIncapacitated } from "./death-automation.mjs";

Hooks.once("init", () => {
  InventoryDefaultStateService.registerHooks();
  TenebreSettings.register();
  CompatibilityService.register();
  MovementService.register();
  RollPrivacyService.register();
  NpcAttackChatService.register();
  OpposedTestChatService.register();
  BerserkerChatService.register();
  ResistanceChatService.register();
  PainThresholdChoiceService.register();
  StandUpService.register();
  DeathAutomationService.register();
  registerKeybindings();
  TokenActionHudIntegration.register();

  HungerService.registerStatusEffect();
  ManeuverService.registerStatusEffects();
  setupBithirMod();
});

Hooks.once("setup", () => {
  exposePublicApi();
});

Hooks.on("createItem", (item) => {
  if (item.parent && item.parent.type === "player") {
    if (TenebreSettings.get("enableEncumbrance")) {
      EncumbranceService.autoAssignSlots(item);
    }

    if (TenebreSettings.get("enableRations") && isRation(item)) {
      window.setTimeout(() => {
        RationService.consolidate(item.parent).catch((error) => {
          console.warn("Tenebre Resources | Failed to consolidate rations after item creation.", error);
        });
      }, 0);
    }
  }
});

Hooks.once("ready", async () => {
  if (game.system.id !== "symbaroum") {
    console.warn(`${MODULE_ID} | This module currently supports only the Symbaroum system.`);
    return;
  }

  await EncumbranceService.loadWeightConfig(MODULE_ID);
  if (TenebreSettings.get("enableEncumbrance")) {
    EncumbranceService.startDynamicWeightFileWatcher();
  }

  patchWeaponRolls();
  registerSheetHooks();
  ContainerService.registerHooks();
  ContainerTransferService.registerHooks();
  GroundContainerService.registerHooks();
  InventoryCleanupService.registerHooks();
  await InventoryCleanupService.cleanupExisting();
  HotbarService.register();
  HungerService.registerHooks();
  ManeuverService.registerHooks();
  WeaponReadinessService.registerHooks();
  WeaponReadinessVisualService.registerHooks();
  WeaponReadinessVisualService.refreshAllIndicators();
  EncumbranceVisualService.registerHooks();
  EncumbranceVisualService.refreshAllIndicators();
  WeaponReadinessHudService.register();
  patchSymbaroumRollDialogs();
  patchSymbaroumActorUsePower();
  patchSymbaroumDerivedPenalties();
  Hooks.on("preCreateChatMessage", applyPowerChatContextToMessage);

  // Aplica desvantagem de Fome para a rota simples de atributo.
  if (game.symbaroum?.api?.rollAttribute) {
    const originalRollAttribute = game.symbaroum.api.rollAttribute;
    const wrappedRollAttribute = function(wrapped, actor, actingAttributeName, targetActor, targetAttributeName, favour, modifier, armor, weapon, advantage, damModifier) {
      if (isDeathIncapacitated(actor)) {
        ui.notifications.warn(game.i18n.format("TENEBRE.Death.ActionBlocked", { actor: actor.name }));
        return undefined;
      }
      favour = ManeuverService.applyRollFavour(actor, actingAttributeName, favour, weapon);
      favour = HungerService.applyDisfavour(favour, actor);
      return wrapped.call(this, actor, actingAttributeName, targetActor, targetAttributeName, favour, modifier, armor, weapon, advantage, damModifier);
    };

    if (CompatibilityService.canUseLibWrapper()) {
      libWrapper.register(MODULE_ID, "game.symbaroum.api.rollAttribute", wrappedRollAttribute, "WRAPPER");
    } else if (!originalRollAttribute._tenebreWrapped) {
      game.symbaroum.api.rollAttribute = function tenebreRollAttribute(...args) {
        return wrappedRollAttribute.call(this, originalRollAttribute, ...args);
      };
      game.symbaroum.api.rollAttribute._tenebreWrapped = true;
    }
  }

  GmLogService.register();
  GmLogUiService.register();

  await DeathAutomationService.ready();

  exposePublicApi();

  // Auto-atribuir slots de sobrecarga na inicialização
  if (TenebreSettings.get("enableEncumbrance")) {
    for (const actor of game.actors) {
      if (actor.type === "player" && actor.isOwner) {
        await EncumbranceService.autoAssignAll(actor);
        EncumbranceService.applyDefensePenalty(actor);
      }
    }
  }

  const activeGms = [...(game.users ?? [])].filter((user) => user.active && user.isGM);
  const isPrimaryActiveGm = game.user.isGM && (!activeGms.length || activeGms[0]?.id === game.user.id);
  if (isPrimaryActiveGm) {
    const containersEnabled = TenebreSettings.get("enableContainers");
    for (const actor of game.actors) {
      if (actor.type === "player") {
        try {
          const recovered = await ContainerService.recoverOrphanedStoredItems(actor);
          await ContainerService.synchronizeActorStates(actor, containersEnabled);
          if (recovered > 0) {
            console.warn(`${MODULE_ID} | Recovered ${recovered} orphaned stored item(s) for ${actor.name}.`);
          }
        } catch (error) {
          console.warn(`${MODULE_ID} | Could not synchronize container states for ${actor.name}.`, error);
        }
      }
    }
    const groundContainerReconciliation = await GroundContainerService.reconcileGroundContainers();
    if (!groundContainerReconciliation.skipped && (
      groundContainerReconciliation.removedTokens
      || groundContainerReconciliation.restoredItems
      || groundContainerReconciliation.repairedItems
      || groundContainerReconciliation.errors
    )) {
      console.info(`${MODULE_ID} | Reconciled ground containers.`, groundContainerReconciliation);
    }
  }

  if (TenebreSettings.get("enableRations")) {
    for (const actor of game.actors) {
      if (actor.type === "player" && actor.isOwner) {
        await RationService.consolidate(actor);
      }
    }
  }

  if (game.user?.isGM) {
    window.setTimeout(() => {
      void CompatibilityService.showStartupNotice();
    }, 500);
  }

  console.log(`${MODULE_ID} | v${game.modules.get(MODULE_ID)?.version} ready.`);
});

function exposePublicApi() {
  const api = game.tenebreResources ?? {};
  Object.assign(api, {
    rations: RationService,
    ammo: AmmoService,
    rest: RestService,
    hotbar: HotbarService,
    verses: VerseService,
    encumbrance: EncumbranceService,
    encumbranceVisuals: EncumbranceVisualService,
    hunger: HungerService,
    containers: ContainerService,
    containerTransfer: ContainerTransferService,
    groundContainers: GroundContainerService,
    maneuvers: ManeuverService,
    death: DeathAutomationService,
    movement: MovementService,
    chatItemUse: ChatItemUseService,
    rollPrivacy: RollPrivacyService,
    ritualBrowser: RitualBrowserService,
    weaponReadiness: WeaponReadinessService,
    weaponReadinessHud: WeaponReadinessHudService,
    weaponReadinessVisuals: WeaponReadinessVisualService,
    compatibility: CompatibilityService,
    gmLog: GmLogService,
    inventoryCleanup: InventoryCleanupService,
    tokenActionHud: TokenActionHudIntegration,
    statusEffects: StatusEffectPickerService,
    money: MoneyService,
    journalIntegration: JournalIntegrationService,
    bithir: game.bithirmod,
    inspectActorResources,
    diagnostics: {
      version: game.modules.get(MODULE_ID)?.version ?? null,
      compatibility: CompatibilityService.refresh()
    }
  });

  game.tenebreResources = api;
  const module = game.modules.get(MODULE_ID);
  if (module) module.api = api;
  return api;
}

function inspectActorResources(actorOrId) {
  const actor = typeof actorOrId === "string"
    ? game.actors.get(actorOrId) ?? game.actors.getName(actorOrId)
    : actorOrId;
  if (!actor) return null;

  const rations = RationService.getState(actor);
  const hits = AmmoService.getTrackedHits(actor);
  const usesAmmoResources = actor.type === "player";
  return {
    actor: actor.name,
    type: actor.type,
    rations: {
      quantity: rations.quantity,
      usesRemaining: rations.usesRemaining,
      usesPerUnit: rations.usesPerUnit
    },
    ammo: {
      quantity: usesAmmoResources ? sumItemQuantities(findAmmoItems(actor, "ammo")) : 0,
      hits
    },
    detectedItems: Array.from(actor.items.values())
      .filter((item) => isRation(item) || (usesAmmoResources && isAmmo(item)))
      .map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        quantity: Number(item.system?.number ?? 0) || 0,
        isRation: isRation(item),
        isAmmo: isAmmo(item)
      }))
  };
}

function registerKeybindings() {
  game.keybindings.register(MODULE_ID, "openRestDialog", {
    name: "TENEBRE.Keybindings.OpenRestDialog",
    hint: "TENEBRE.Keybindings.OpenRestDialogHint",
    editable: [
      { key: "KeyR", modifiers: ["CONTROL", "SHIFT"] }
    ],
    onDown: () => {
      const actors = game.user.isGM
        ? canvas.tokens.controlled.map(t => t.actor).filter(a => a?.type === "player")
        : [game.user.character].filter(Boolean);

      if (!actors.length) {
        ui.notifications.warn(game.i18n.localize("TENEBRE.Rest.NoActorsSelectedKeybinding"));
        return;
      }

      for (const actor of actors) {
        game.tenebreResources.rest.openRestDialog(actor);
      }
    }
  });
}

let rollDialogsPatched = false;
let pendingDialogActorId = null;
let pendingPowerUseContext = null;
let activePowerChatContext = null;
let activePowerChatContextTimer = null;
let activePowerChatContextToken = 0;

function patchSymbaroumRollDialogs() {
  if (rollDialogsPatched || !globalThis.Dialog?.prototype?.render) return;

  const originalRender = Dialog.prototype.render;
  const wrappedRender = function(wrapped, ...args) {
    const content = String(this.data?.content ?? this.content ?? "");
    if (content.includes("symbaroum dialog") && hasFavourRollOptions(content)) {
      if (this.data?.content !== undefined) {
        this.data.content = RollPrivacyService.injectField(content);
      } else if (this.content !== undefined) {
        this.content = RollPrivacyService.injectField(content);
      }
      const actorId = pendingDialogActorId ?? extractActorIdFromDialogContent(content);
      if (actorId) {
        this._tenebreHungerActorId = actorId;
      }
      if (pendingPowerUseContext) {
        this._tenebrePowerChatContext = foundry.utils.deepClone(pendingPowerUseContext);
      }
      wrapDialogRollButton(this);
    }

    return wrapped.apply(this, args);
  };

  if (CompatibilityService.canUseLibWrapper()) {
    libWrapper.register(MODULE_ID, "Dialog.prototype.render", wrappedRender, "WRAPPER");
  } else {
    Dialog.prototype.render = function tenebreRenderDialog(...args) {
      return wrappedRender.call(this, originalRender, ...args);
    };
    Dialog.prototype.render._tenebreWrapped = true;
  }

  rollDialogsPatched = true;
}

function hasFavourRollOptions(content) {
  return content.includes('name="favour"')
    || content.includes("name='favour'")
    || content.includes("name=favour")
    || content.includes("lblfavour");
}

function patchSymbaroumActorUsePower() {
  const ActorClass = CONFIG.Actor.documentClass;
  if (!ActorClass?.prototype?.usePower || ActorClass.prototype.usePower._tenebreWrapped) return;

  const originalUsePower = ActorClass.prototype.usePower;
  const wrappedUsePower = async function(wrapped, ...args) {
    if (isDeathIncapacitated(this)) {
      ui.notifications.warn(game.i18n.format("TENEBRE.Death.ActionBlocked", { actor: this.name }));
      return undefined;
    }
    const previousActorId = pendingDialogActorId;
    const previousPowerContext = pendingPowerUseContext;
    const powerContext = buildPowerUseChatContext(this, args[0]);
    pendingDialogActorId = this.id;
    pendingPowerUseContext = powerContext;
    setActivePowerChatContext(powerContext);
    try {
      return await wrapped.apply(this, args);
    } finally {
      pendingDialogActorId = previousActorId;
      pendingPowerUseContext = previousPowerContext;
      if (activePowerChatContext?.itemUuid === powerContext?.itemUuid) {
        setActivePowerChatContext(null);
      }
    }
  };
  if (CompatibilityService.canUseLibWrapper()) {
    libWrapper.register(MODULE_ID, "CONFIG.Actor.documentClass.prototype.usePower", wrappedUsePower, "WRAPPER");
  } else {
    ActorClass.prototype.usePower = async function tenebreUsePower(...args) {
      return wrappedUsePower.call(this, originalUsePower, ...args);
    };
    ActorClass.prototype.usePower._tenebreWrapped = true;
  }
}

function patchSymbaroumDerivedPenalties() {
  const ActorClass = CONFIG.Actor.documentClass;
  if (!ActorClass?.prototype?.prepareDerivedData || ActorClass.prototype.prepareDerivedData._tenebreWrapped) return;

  const originalPrepareDerivedData = ActorClass.prototype.prepareDerivedData;
  const wrappedPrepareDerivedData = function(wrapped, ...args) {
    const result = wrapped.apply(this, args);
    if (TenebreSettings.get("enableEncumbrance") && this.type === "player") {
      EncumbranceService.applyDefensePenalty(this);
    }
    return result;
  };
  if (CompatibilityService.canUseLibWrapper()) {
    libWrapper.register(MODULE_ID, "CONFIG.Actor.documentClass.prototype.prepareDerivedData", wrappedPrepareDerivedData, "WRAPPER");
  } else {
    ActorClass.prototype.prepareDerivedData = function tenebrePrepareDerivedData(...args) {
      return wrappedPrepareDerivedData.call(this, originalPrepareDerivedData, ...args);
    };
    ActorClass.prototype.prepareDerivedData._tenebreWrapped = true;
  }
}

function wrapDialogRollButton(dialog) {
  const rollButton = dialog.data?.buttons?.roll;
  if (!rollButton?.callback || rollButton.callback._tenebreWrapped) return;

  const originalCallback = rollButton.callback;
  rollButton.callback = async function tenebreRollDialogCallback(html, ...args) {
    const privateRoll = RollPrivacyService.isChecked(html);
    return RollPrivacyService.runPrivateRoll(privateRoll, async () => {
      setActivePowerChatContext(dialog?._tenebrePowerChatContext ?? null);
      applyStatusFavourToDialog(html, dialog);
      return originalCallback.call(this, html, ...args);
    });
  };
  rollButton.callback._tenebreWrapped = true;
}

function applyPowerChatContextToMessage(message, data) {
  if (!activePowerChatContext) return;
  if (!TenebreSettings.get("enableAutomatedAnimationsIntegration")) return;

  const content = String(message?.content ?? data?.content ?? "");
  if (!isSymbaroumAbilityChat(content)) return;

  const context = foundry.utils.deepClone(activePowerChatContext);
  const flags = foundry.utils.deepClone(message?.flags ?? data?.flags ?? {});
  if (flags.world?.context?.itemUuid) return;

  flags.world = {
    ...(flags.world ?? {}),
    context
  };
  flags[MODULE_ID] = {
    ...(flags[MODULE_ID] ?? {}),
    chatItemUse: true,
    itemUuid: context.itemUuid,
    actorUuid: context.actorUuid,
    tokenUuid: context.tokenUuid ?? null,
    targetTokenUuid: context.targetTokenUuid ?? null,
    source: "symbaroum-power-roll"
  };

  message.updateSource({ flags });
  setActivePowerChatContext(null);
}

function isSymbaroumAbilityChat(content) {
  return content.includes("symbaroum chat ability");
}

function buildPowerUseChatContext(actor, item) {
  if (!TenebreSettings.get("enableAutomatedAnimationsIntegration")) return null;
  if (!actor || !item || !ChatItemUseService.canSend(item)) return null;

  const token = getActorTokenForContext(actor);
  const targetToken = Array.from(game.user?.targets ?? [])[0] ?? null;
  const context = {
    itemUuid: item.uuid,
    actorUuid: actor.uuid
  };

  const tokenUuid = token?.document?.uuid ?? token?.uuid;
  if (tokenUuid) context.tokenUuid = tokenUuid;

  const targetTokenUuid = targetToken?.document?.uuid ?? targetToken?.uuid;
  if (targetTokenUuid) {
    context.targetTokenUuid = targetTokenUuid;
    context.criticaled = false;
    context.fumbled = false;
  }

  return context;
}

function getActorTokenForContext(actor) {
  const controlled = canvas?.tokens?.controlled?.find((token) => token.actor?.id === actor.id);
  if (controlled) return controlled;

  const activeTokens = actor?.getActiveTokens?.() ?? [];
  if (Array.isArray(activeTokens)) return activeTokens[0] ?? null;
  return activeTokens?.object ?? null;
}

function setActivePowerChatContext(context) {
  if (activePowerChatContextTimer) {
    clearTimeout(activePowerChatContextTimer);
    activePowerChatContextTimer = null;
  }

  activePowerChatContext = context ? foundry.utils.deepClone(context) : null;
  activePowerChatContextToken += 1;
  if (!activePowerChatContext) return;

  const token = activePowerChatContextToken;
  activePowerChatContextTimer = setTimeout(() => {
    if (activePowerChatContextToken === token) {
      activePowerChatContext = null;
      activePowerChatContextTimer = null;
    }
  }, 15000);
}

function extractActorIdFromDialogContent(content) {
  const match = content.match(/\bid=["']modifier-([^"']+)["']/);
  const dialogId = match?.[1];
  if (!dialogId) return null;

  const actors = Array.from(game.actors ?? []);
  return actors.find((actor) => dialogId.startsWith(actor.id))?.id ?? null;
}

function applyStatusFavourToDialog(html, dialog) {
  const root = html?.[0] ?? html;
  if (!root?.querySelectorAll) return;

  const favours = Array.from(root.querySelectorAll("input[name='favour']"));
  if (!favours.length) return;

  const actorId = dialog?._tenebreHungerActorId;
  const activeWeaponRoll = game.tenebreResources?.activeManeuverWeaponRoll;
  const actor = game.actors?.get?.(actorId) ?? activeWeaponRoll?.actor;
  const weapon = activeWeaponRoll?.actor === actor ? activeWeaponRoll.weapon : null;
  const attribute = getDialogActingAttribute(root, dialog);
  const currentFavour = Number(favours.find((input) => input.checked)?.value ?? 0) || 0;

  let nextFavour = currentFavour;
  if (actor) {
    nextFavour = ManeuverService.applyRollFavour(actor, attribute, nextFavour, weapon);
    nextFavour = HungerService.applyDisfavour(nextFavour, actor);
  }

  const targetFavour = getHungerFavourValue(actorId);
  if (targetFavour !== null) nextFavour = Number(targetFavour) || 0;

  for (const input of favours) {
    input.checked = Number(input.value) === nextFavour;
  }
}

function getDialogActingAttribute(root, dialog) {
  const selectors = [
    "select[name='actingAttribute']",
    "select[name='actingAttributeName']",
    "select[id^='actingAttribute-']",
    "input[name='actingAttribute']",
    "input[name='actingAttributeName']"
  ];

  for (const selector of selectors) {
    const element = root.querySelector(selector);
    if (element?.value) return element.value;
  }

  const title = normalizeText(dialog?.data?.title ?? dialog?.title ?? "");
  if (title.includes("defesa") || title.includes("defense")) return "defense";

  const text = normalizeText(root.textContent ?? "");
  if (text.includes("teste de defesa") || text.includes("defense test")) return "defense";

  return "";
}

function getHungerFavourValue(actorId) {
  const actor = game.actors?.get?.(actorId);
  if (HungerService.hasHunger(actor)) return "-1";

  const hungryTarget = Array.from(game.user?.targets ?? []).find((token) => HungerService.hasHunger(token.actor));
  if (actor?.type === "monster" && hungryTarget) return "1";

  return null;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
