import { FLAG_SCOPE, MODULE_ID } from "./constants.mjs";
import { AmmoService } from "./ammo.mjs";
import { RestService } from "./rest.mjs";
import { RationService } from "./rations.mjs";
import { TenebreSettings } from "./settings.mjs";
import { getAmmoModifiers, getSpecialAmmo } from "./special-ammo.mjs";
import { EncumbranceService } from "./encumbrance.mjs";
import { ContainerService } from "./containers.mjs";
import { matchesSymbaroumLabel, symbaroumLabelVariants } from "./symbaroum-i18n.mjs";
import { documentSourceUuid, normalize, promptDialog } from "./utils.mjs";
import { ManeuverService } from "./maneuvers.mjs";
import { SocketService } from "./sockets.mjs";
import { ChatItemUseService } from "./chat-item-use.mjs";
import { CompatibilityService } from "./compatibility.mjs";
import { isWeaponReadinessIndicatorEffect } from "./weapon-readiness-visuals.mjs";
import { RollPrivacyService } from "./roll-privacy.mjs";
import { RitualBrowserService, isRitualDocument } from "./ritual-browser.mjs";
import { WeaponReadinessService } from "./weapon-readiness.mjs";
import { GroundContainerService } from "./ground-containers.mjs";
import { ContainerTransferService } from "./container-transfer.mjs";
import { MoneyService } from "./money.mjs";
import {
  actorItems,
  findLoadedQuiverItems,
  getAmmoType,
  getWeaponAmmoType,
  isAmmo,
  isRation,
  itemQuantity,
  isQuiver,
  getQuiverCapacity,
  getQuiverLoadedAmmo,
  getQuiverLoadedTotal,
  localizeAmmoType
} from "./item-flags.mjs";

const CONTAINER_DRAG_DATA_TYPE = "application/x-tenebre-container-item";
const RITUALIST_EXPANDED_FLAG = "ritualistExpanded";
let activeContainerDrag = null;
const expandedRitualists = new Set();
const knownRitualsByActor = new Map();
const ritualActorsByItem = new Map();
const deletingRitualIdsByActor = new Map();
const ritualistInjectionRetries = new WeakMap();
const storedItemContextMenuRoots = new WeakSet();

const selectedManeuversByActor = new Map();

// Registro de hooks

export function registerSheetHooks() {
  patchSymbaroumSheetListeners();
  patchRitualistInlineDeletion();
  patchRitualistDropCreation();
  patchSymbaroumItemChatSender();
  Hooks.on("renderApplicationV2", onRenderApplicationV2);
  Hooks.on("renderDialog", onRenderDialog);
  Hooks.on("renderTemplate", onRenderTemplate);
  Hooks.on("closeDialog", onCloseDialog);
  Hooks.on(`${MODULE_ID}.settingsChanged`, onTenebreSettingChanged);
  Hooks.on("createActiveEffect", onActiveEffectChanged);
  Hooks.on("updateActiveEffect", onActiveEffectChanged);
  Hooks.on("deleteActiveEffect", onActiveEffectChanged);
  Hooks.on("updateItem", onEncumbranceItemUpdated);
  Hooks.on("preDeleteItem", onOwnedRitualWillDelete);
  Hooks.on("createItem", (item) => onOwnedRitualCollectionChanged(item, true));
  Hooks.on("deleteItem", (item) => onOwnedRitualCollectionChanged(item, false));
  patchContextMenu();
}

function patchRitualistDropCreation() {
  for (const SheetClass of getSymbaroumSheetClasses("Actor", "player")) {
    const original = SheetClass?.prototype?._onDropItem;
    if (!original || original._tenebreRitualistDropWrapped) continue;

    SheetClass.prototype._onDropItem = async function tenebreRitualistDrop(event, data) {
      const ItemClass = globalThis.Item?.implementation ?? CONFIG.Item?.documentClass;
      if (!ItemClass?.fromDropData) return original.call(this, event, data);

      const droppedItem = data?.documentName === "Item"
        ? data
        : await ItemClass.fromDropData(data);
      const containerTransfer = await ContainerTransferService.handleActorItemDrop(this.actor, droppedItem);
      if (containerTransfer.handled) return containerTransfer.result;
      if (!isRitualDocument(droppedItem)) return original.call(this, event, data);
      if (!this.actor?.isOwner) return null;
      if (this.actor.uuid === droppedItem.parent?.uuid) return original.call(this, event, data);

      return this.actor.createEmbeddedDocuments("Item", [droppedItem.toObject()], {
        render: false
      });
    };
    SheetClass.prototype._onDropItem._tenebreRitualistDropWrapped = true;
  }
}

function patchRitualistInlineDeletion() {
  for (const SheetClass of getSymbaroumSheetClasses("Actor", "player")) {
    const original = SheetClass?.prototype?._itemDelete;
    if (!original || original._tenebreRitualistDeleteWrapped) continue;

    SheetClass.prototype._itemDelete = async function tenebreRitualistItemDelete(element) {
      const isInlineRitual = element?.classList?.contains("tenebre-ritualist-item");
      const item = isInlineRitual ? this.actor?.items?.get(element.dataset.itemId) : null;
      if (!item || !isRitualDocument(item)) return original.call(this, element);

      const confirmed = await promptDialog({
        title: game.i18n.localize("TOOLTIP.DELETE_ITEM"),
        content: `<p>${escapeHtml(game.i18n.localize("TOOLTIP.DELETE_ITEM"))} <strong>${escapeHtml(item.name)}</strong>?</p>`,
        okLabel: game.i18n.localize("DIALOG.OK"),
        cancelLabel: game.i18n.localize("DIALOG.CANCEL"),
        callback: () => true
      });
      if (!confirmed) return null;

      return this.actor.deleteEmbeddedDocuments("Item", [item.id], { render: false });
    };
    SheetClass.prototype._itemDelete._tenebreRitualistDeleteWrapped = true;
  }
}

function onOwnedRitualWillDelete(item) {
  if (!isRitualDocument(item)) return;
  const actor = item?.parent;
  if (!isManagedActor(actor) || !isPlayerActor(actor)) return;

  const actorKey = actor.uuid ?? actor.id;
  const itemKey = item.uuid ?? item.id;
  ritualActorsByItem.set(itemKey, actor);
  const deletingIds = deletingRitualIdsByActor.get(actorKey) ?? new Set();
  deletingIds.add(item.id);
  deletingRitualIdsByActor.set(actorKey, deletingIds);

  const cached = knownRitualsByActor.get(actorKey)
    ?? new Map(actorItems(actor).filter(isRitualDocument).map((ritual) => [ritual.id, ritual]));
  cached.delete(item.id);
  knownRitualsByActor.set(actorKey, cached);

  setTimeout(() => refreshOpenRitualistLists(actor), 0);
}

function onOwnedRitualCollectionChanged(item, created) {
  if (!isRitualDocument(item)) return;
  const itemKey = item.uuid ?? item.id;
  const actor = item?.parent ?? ritualActorsByItem.get(itemKey);
  if (!isManagedActor(actor) || !isPlayerActor(actor)) return;

  const actorKey = actor.uuid ?? actor.id;
  if (created && item?.parent) {
    const cached = knownRitualsByActor.get(actorKey) ?? new Map();
    cached.set(item.id, item);
    knownRitualsByActor.set(actorKey, cached);
    ritualActorsByItem.set(itemKey, actor);
  } else if (!created) {
    knownRitualsByActor.get(actorKey)?.delete(item.id);
  }

  setTimeout(() => refreshOpenRitualistLists(actor), 0);

  setTimeout(() => {
    ritualActorsByItem.delete(itemKey);
    deletingRitualIdsByActor.get(actorKey)?.delete(item.id);
  }, 500);
}

function forEachOpenActorSheet(actor, callback) {
  for (const app of Object.values(ui.windows ?? {})) {
    const sheetActor = app.actor ?? app.document;
    if (sheetActor?.uuid !== actor.uuid) continue;
    const root = getRoot(app.element);
    if (root) callback(root, app);
  }
}

function refreshOpenRitualistLists(actor) {
  forEachOpenActorSheet(actor, (root, app) => {
    injectRitualistInlineList(app, root, actor);
  });
}

function patchSymbaroumItemChatSender() {
  for (const type of ["ability", "ritual", "mysticalPower", "mystical-power", "trait", "boon", "burden", "artifact", "equipment", "weapon", "armor"]) {
    for (const SheetClass of getSymbaroumSheetClasses("Item", type)) {
      if (!SheetClass?.prototype?.sendToChat || SheetClass.prototype.sendToChat._tenebreWrapped) continue;

      const original = SheetClass.prototype.sendToChat;
      SheetClass.prototype.sendToChat = async function tenebreSendToChat(...args) {
        const item = this.item ?? this.document ?? this.object;
        const actor = item?.parent;
        if (TenebreSettings.get("enableChatItemUse") && actor && ChatItemUseService.canSend(item)) {
          return ChatItemUseService.send(actor, item);
        }
        return original.apply(this, args);
      };
      SheetClass.prototype.sendToChat._tenebreWrapped = true;
    }
  }
}

/**
 * O Symbaroum 6.1.6 ainda usa fichas V1. A injeção ocorre uma vez por render,
 * depois do activateListeners original, sem repetir o trabalho pelos hooks de herança.
 */
function patchSymbaroumSheetListeners() {
  for (const type of ["player", "monster"]) {
    for (const SheetClass of getSymbaroumSheetClasses("Actor", type)) {
      patchSheetActivateListeners(SheetClass, (app, html) => onRenderActorSheet(app, html));
    }
  }

  for (const type of ["equipment", "weapon", "armor"]) {
    for (const SheetClass of getSymbaroumSheetClasses("Item", type)) {
      patchSheetActivateListeners(SheetClass, (app, html) => onRenderItemSheet(app, html));
    }
  }
}

function getSymbaroumSheetClasses(documentName, subType) {
  const entries = CONFIG[documentName]?.sheetClasses?.[subType] ?? {};
  return Object.values(entries)
    .filter((entry) => entry.id?.startsWith("symbaroum."))
    .map((entry) => entry.cls)
    .filter(Boolean);
}

function patchSheetActivateListeners(SheetClass, callback) {
  if (!SheetClass?.prototype || SheetClass.prototype._tenebreActivatePatched) return;
  SheetClass.prototype._tenebreActivatePatched = true;

  const original = SheetClass.prototype.activateListeners;
  SheetClass.prototype.activateListeners = function tenebreActivateListeners(html) {
    const result = original?.call(this, html);
    try {
      callback(this, html);
    } catch (err) {
      console.error(`${MODULE_ID} | Sheet UI injection failed (${SheetClass.name}):`, err);
    }
    return result;
  };
}

function onRenderApplicationV2(app, element) {
  removeTenebreActorHeaderButtons(app, element);
  if (isSymbaroumActorSheetApplication(app)) onRenderActorSheet(app, element);
  else if (isSymbaroumItemSheetApplication(app)) onRenderItemSheet(app, element);
}

function getActorFromDom(elem) {
  if (!elem) return null;
  for (const app of Object.values(ui.windows)) {
    const el = app.element instanceof HTMLElement ? app.element : app.element?.[0];
    if (el && el.contains(elem)) {
      return app.actor ?? app.document;
    }
  }
  return game.canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character;
}

function patchContextMenu() {
  const ContextMenuClass = foundry.applications?.ux?.ContextMenu;
  if (!ContextMenuClass?.prototype?.render) return;
  if (ContextMenuClass.prototype.render._tenebreContextMenuWrapped && !CompatibilityService.canUseLibWrapper()) return;

  const handler = function(wrapped, html) {
    if (this.constructor.name === "CMPowerMenu") {
      if (!this._tenebrePatched) {
        this._tenebrePatched = true;

        this.originalMenuItems.push({
          name: "TENEBRE.Containers.StoreContextMenu",
          icon: `<i class="fas fa-box-open" style="color: currentColor;"></i>`,
          isVisible: (item) => {
            const actor = this.myParent?.actor;
            return TenebreSettings.get("enableContainers")
              && ContainerService.canAttemptStoreItem(item)
              && ContainerService.getContainers(actor, item).length > 0;
          },
          callback: function(elem) {
            const actor = getActorFromDom(elem);
            const itemId = elem.dataset.itemId;
            const item = actor?.items?.get(itemId);
            if (actor && item) {
              void ContainerService.storeItemPrompt(actor, item);
            }
          }
        });

        this.originalMenuItems.push({
          name: "TENEBRE.Containers.OpenContextMenu",
          icon: `<i class="fas fa-box" style="color: currentColor;"></i>`,
          isVisible: (item) => {
            return TenebreSettings.get("enableContainers") && ContainerService.isContainer(item);
          },
          callback: function(elem) {
            const actor = getActorFromDom(elem);
            const itemId = elem.dataset.itemId;
            const item = actor?.items?.get(itemId);
            if (actor && item) {
              ContainerService.openContainer(actor, item);
            }
          }
        });

        this.originalMenuItems.push({
          name: "TENEBRE.Rations.ConsumeRationContextMenu",
          icon: `<i class="fas fa-bread-slice" style="color: currentColor;"></i>`,
          isVisible: (item) => {
            return TenebreSettings.get("enableRations") && isRation(item) && itemQuantity(item) > 0;
          },
          callback: function(elem) {
            const actor = getActorFromDom(elem);
            const itemId = elem.dataset.itemId;
            const item = actor?.items?.get(itemId);
            if (actor) {
              RationService.consumeDay(actor, item);
            }
          }
        });

        this.originalMenuItems.push({
          name: "TENEBRE.Containers.ConfigureContextMenu",
          icon: `<i class="fas fa-sliders-h" style="color: currentColor;"></i>`,
          isVisible: (item) => game.user?.isGM
            && TenebreSettings.get("enableContainers")
            && ContainerService.isContainer(item),
          callback: function(elem) {
            const actor = getActorFromDom(elem);
            const itemId = elem.dataset.itemId;
            const item = actor?.items?.get(itemId);
            if (actor && item) void ContainerService.configureContainerPrompt(actor, item);
          }
        });

        this.originalMenuItems.push({
          name: "TENEBRE.Ammo.RecoverAmmoContextMenu",
          icon: `<i class="fas fa-arrows-rotate" style="color: currentColor;"></i>`,
          isVisible: (item) => {
            if (!TenebreSettings.get("enableAmmoRecovery")) return false;
            if (!isPlayerActor(item?.parent)) return false;
            if (item?.type !== "weapon") return false;
            const ammoType = getWeaponAmmoType(item);
            return Boolean(ammoType);
          },
          callback: function(elem) {
            const actor = getActorFromDom(elem);
            if (actor) {
              AmmoService.recover(actor);
            }
          }
        });

        this.originalMenuItems.push({
          name: "TENEBRE.ChatItemUse.ContextMenu",
          icon: `<i class="fas fa-comment-dots" style="color: currentColor;"></i>`,
          isVisible: (item) => {
            return TenebreSettings.get("enableChatItemUse") && ChatItemUseService.canSend(item);
          },
          callback: function(elem) {
            const actor = getActorFromDom(elem);
            const itemId = elem.dataset.itemId;
            const item = actor?.items?.get(itemId);
            if (actor && item) {
              ChatItemUseService.send(actor, item);
            }
          }
        });

        this.originalMenuItems.push({
          name: "TENEBRE.RitualBrowser.ContextMenu",
          icon: `<i class="fas fa-book-open" style="color: currentColor;"></i>`,
          isVisible: (item) => TenebreSettings.get("enableRitualCatalog")
            && RitualBrowserService.isRitualistAbility(item),
          callback: function(elem) {
            const actor = getActorFromDom(elem);
            if (actor) void RitualBrowserService.open(actor);
          }
        });

        this.originalMenuItems.push({
          name: "TENEBRE.WeaponReadiness.Draw",
          icon: `<i class="fas fa-hand-fist" style="color: currentColor;"></i>`,
          isVisible: (item) => WeaponReadinessService.isEnabled()
            && WeaponReadinessService.isEligibleWeapon(item)
            && !WeaponReadinessService.isDrawn(item),
          callback: function(elem) {
            const actor = getActorFromDom(elem);
            const item = actor?.items?.get(elem.dataset.itemId);
            if (item) void WeaponReadinessService.setDrawn(item, true);
          }
        });

        this.originalMenuItems.push({
          name: "TENEBRE.WeaponReadiness.Sheathe",
          icon: `<i class="fas fa-shield-halved" style="color: currentColor;"></i>`,
          isVisible: (item) => WeaponReadinessService.isEnabled()
            && WeaponReadinessService.isEligibleWeapon(item)
            && WeaponReadinessService.isDrawn(item),
          callback: function(elem) {
            const actor = getActorFromDom(elem);
            const item = actor?.items?.get(elem.dataset.itemId);
            if (item) void WeaponReadinessService.setDrawn(item, false);
          }
        });

        this.originalMenuItems.push({
          name: "TENEBRE.Ammo.ReloadQuiverContextMenu",
          icon: `<i class="fas fa-redo" style="color: currentColor;"></i>`,
          isVisible: (item) => {
            return TenebreSettings.get("enableAmmoConsumption")
              && TenebreSettings.get("enableQuiverAmmoContainers")
              && isPlayerActor(item?.parent)
              && isQuiver(item)
              && itemQuantity(item) > 0;
          },
          callback: function(elem) {
            const actor = getActorFromDom(elem);
            const itemId = elem.dataset.itemId;
            const item = actor?.items?.get(itemId);
            if (actor && item) {
              AmmoService.reloadQuiverPrompt(actor, item);
            }
          }
        });

        this.originalMenuItems.push({
          name: "TENEBRE.Ammo.UnloadQuiverContextMenu",
          icon: `<i class="fas fa-upload" style="color: currentColor;"></i>`,
          isVisible: (item) => {
            return TenebreSettings.get("enableAmmoConsumption")
              && TenebreSettings.get("enableQuiverAmmoContainers")
              && isPlayerActor(item?.parent)
              && isQuiver(item)
              && itemQuantity(item) > 0
              && getQuiverLoadedTotal(item) > 0;
          },
          callback: function(elem) {
            const actor = getActorFromDom(elem);
            const itemId = elem.dataset.itemId;
            const item = actor?.items?.get(itemId);
            if (actor && item) {
              AmmoService.unloadQuiver(actor, item).then(() => rerenderActorSheets(actor));
            }
          }
        });

        // Re-filter this.menuItems immediately so the newly added options are rendered on the first click
        let item = null;
        if (html.dataset.itemId == game.symbaroum.config.noArmorID) {
          item = game.symbaroum.config.noArmorID;
        } else {
          item = this.myParent?.actor.items.get(html.dataset.itemId);
        }
        if (item) {
          this.menuItems = this.originalMenuItems.filter((elem) => {
            return elem.isVisible(item);
          });
        } else {
          this.menuItems = this.originalMenuItems;
        }
      }
    }
    return wrapped.call(this, html);
  };

  if (CompatibilityService.canUseLibWrapper()) {
    libWrapper.register(MODULE_ID, "foundry.applications.ux.ContextMenu.prototype.render", function(wrapped, html) {
      return handler.call(this, wrapped, html);
    }, "WRAPPER");
  } else {
    const originalRender = ContextMenuClass.prototype.render;
    ContextMenuClass.prototype.render = function tenebreContextMenuRender(html) {
      const wrapped = (h) => originalRender.call(this, h);
      return handler.call(this, wrapped, html);
    };
    ContextMenuClass.prototype.render._tenebreContextMenuWrapped = true;
  }
}


// Renderização da ficha de ator
function onRenderActorSheet(app, html) {
  const actor = app.actor ?? app.document;
  if (!isManagedActor(actor)) return;
  if (skipDuplicateSheetRender(html, app, "actor")) return;

  const canControlSheetResources = actor.isOwner || game.user.isGM;
  if (canControlSheetResources) syncActorSheetHeaderButtons(app);

  if (!isPlayerActor(actor)) return;

  if (!canControlSheetResources) {
    updateRationQuantityDisplay(app, html, actor, { readOnly: true });
    injectEncumbrancePanel(app, html, actor);
    return;
  }

  if (TenebreSettings.get("enableContainers")) {
    hideStoredItemRows(app, html, actor);
    injectContainerInlineLists(app, html, actor);
    wireContainerLeftClickToggle(html, actor);
    wireContainerDragDrop(app, html, actor);
  }
  injectRitualistInlineList(app, html, actor);
  updateRationQuantityDisplay(app, html, actor);
  updateQuiverQuantityDisplay(app, html, actor);
  injectWeaponReadinessControls(app, html, actor);
  injectMoneyControls(app, html, actor);
  injectEncumbrancePanel(app, html, actor);
  injectManeuverPanel(app, html, actor);
  wireChatItemUseIconFallback(app, html, actor);
  wireInventoryItemIconUse(html, actor);
}

function injectMoneyControls(_app, html, actor) {
  const el = getRoot(html);
  if (!el) return;

  const header = el.querySelector(".gear .wrapper-right .money h1");
  if (!header) return;

  header.querySelectorAll(".tenebre-money-button").forEach((button) => button.remove());
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tenebre-money-button";
  button.title = game.i18n.localize("TENEBRE.Money.ButtonHint");
  button.dataset.tooltip = game.i18n.localize("TENEBRE.Money.ButtonHint");
  button.setAttribute("aria-label", button.title);
  button.innerHTML = `<i class="fas fa-coins"></i>`;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void MoneyService.open(actor);
  });
  header.append(button);
}

function injectWeaponReadinessControls(_app, html, actor) {
  const el = getRoot(html);
  if (!el) return;

  el.querySelectorAll(".tenebre-weapon-readiness-button").forEach((button) => button.remove());
  el.querySelectorAll(".tenebre-weapon-drawn").forEach((row) => row.classList.remove("tenebre-weapon-drawn"));
  el.querySelectorAll(".tenebre-weapon-drawn-icon").forEach((icon) => icon.remove());
  if (!WeaponReadinessService.isEnabled()) return;

  const weapons = WeaponReadinessService.getEligibleWeapons(actor);
  const section = el.querySelector(".combat .weapons");
  const header = section?.querySelector(".item-header");
  if (!section || !header || weapons.length === 0) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "tenebre-weapon-readiness-button";
  button.title = game.i18n.localize("TENEBRE.WeaponReadiness.ButtonHint");
  button.innerHTML = `<i class="fas fa-hand-fist"></i><span>${escapeHtml(game.i18n.localize("TENEBRE.WeaponReadiness.Button"))}</span>`;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void WeaponReadinessService.open(actor);
  });
  header.append(button);

}

function injectRitualistInlineList(app, html, actor) {
  const el = getRoot(html);
  if (!el) return;

  const items = actorItems(actor);
  const ritualist = items.find((item) => RitualBrowserService.isRitualistAbility(item));
  const getRituals = () => getKnownRituals(actor);

  const revealRitualRows = () => {
    for (const ritual of getRituals()) {
      const row = findAbilityItemRow(el, ritual.id);
      if (!row) continue;
      row.hidden = false;
      row.style.removeProperty("display");
      row.classList.remove("tenebre-hidden-owned-ritual");
    }
  };

  if (!ritualist) {
    el.querySelectorAll(".tenebre-ritualist-inline-row").forEach((row) => row.remove());
    revealRitualRows();
    return;
  }

  const ritualistRow = findAbilityItemRow(el, ritualist.id);
  if (!ritualistRow) {
    scheduleRitualistInjectionRetry(app, el, actor);
    return;
  }

  cancelRitualistInjectionRetry(el);
  el.querySelectorAll(".tenebre-ritualist-inline-row").forEach((row) => row.remove());

  moveAbilityRowToEnd(ritualistRow);

  if (!TenebreSettings.get("enableRitualistGrouping")) {
    revealRitualRows();
    const previousToggleHandler = ritualistRow._tenebreRitualistToggleHandler;
    if (previousToggleHandler) ritualistRow.removeEventListener("click", previousToggleHandler, true);
    delete ritualistRow._tenebreRitualistToggleHandler;
    delete ritualistRow.dataset.tenebreRitualistToggle;
    ritualistRow.classList.remove("tenebre-ritualist-anchor", "tenebre-ritualist-expanded");
    ritualistRow.removeAttribute("aria-expanded");
    ritualistRow.removeAttribute("title");
    return;
  }

  const hideRitualRows = () => {
    for (const ritual of getRituals()) {
      const row = findAbilityItemRow(el, ritual.id);
      if (!row || row === ritualistRow) continue;
      row.hidden = true;
      row.style.display = "none";
      row.classList.add("tenebre-hidden-owned-ritual");
    }
  };

  hideRitualRows();
  setTimeout(hideRitualRows, 0);
  setTimeout(hideRitualRows, 100);

  const stateKey = actor.uuid ?? actor.id;
  if (ritualist.getFlag?.(FLAG_SCOPE, RITUALIST_EXPANDED_FLAG) === true) {
    expandedRitualists.add(stateKey);
  }
  ritualistRow.classList.add("tenebre-ritualist-anchor");
  ritualistRow.title = game.i18n.localize("TENEBRE.RitualBrowser.ToggleOwned");

  const renderExpandedState = () => {
    el.querySelectorAll(".tenebre-ritualist-inline-row").forEach((row) => row.remove());
    const expanded = expandedRitualists.has(stateKey);
    ritualistRow.classList.toggle("tenebre-ritualist-expanded", expanded);
    ritualistRow.setAttribute("aria-expanded", expanded ? "true" : "false");
    if (expanded) {
      const rituals = getRituals();
      const inlineRow = buildRitualistInlineRow(el, actor, rituals, ritualistRow);
      inlineRow.classList.toggle(
        "tenebre-ritualist-inline-row-right",
        isAbilityRowInRightColumn(ritualistRow)
      );
      ritualistRow.insertAdjacentElement("afterend", inlineRow);
    }
  };

  const previousToggleHandler = ritualistRow._tenebreRitualistToggleHandler;
  if (previousToggleHandler) ritualistRow.removeEventListener("click", previousToggleHandler, true);

  const toggleHandler = async (event) => {
    if (event.button !== 0) return;
    if (event.target.closest("#context-menu, nav.context-menu, .context-menu")) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const expanded = !expandedRitualists.has(stateKey);
    if (expanded) expandedRitualists.add(stateKey);
    else expandedRitualists.delete(stateKey);
    renderExpandedState();
    try {
      await ritualist.update({
        [`flags.${FLAG_SCOPE}.${RITUALIST_EXPANDED_FLAG}`]: expanded
      }, { render: false });
    } catch (error) {
      console.warn(`${MODULE_ID} | Failed to persist Ritualist expansion state.`, error);
    }
  };

  ritualistRow._tenebreRitualistToggleHandler = toggleHandler;
  ritualistRow.dataset.tenebreRitualistToggle = "true";
  ritualistRow.addEventListener("click", toggleHandler, true);

  renderExpandedState();
}

function getKnownRituals(actor) {
  const actorKey = actor.uuid ?? actor.id;
  const deletingIds = deletingRitualIdsByActor.get(actorKey) ?? new Set();
  const rituals = actorItems(actor)
    .filter((item) => isRitualDocument(item) && !deletingIds.has(item.id));

  knownRitualsByActor.set(actorKey, new Map(rituals.map((ritual) => [ritual.id, ritual])));
  for (const ritual of rituals) ritualActorsByItem.set(ritual.uuid ?? ritual.id, actor);
  return rituals;
}

function scheduleRitualistInjectionRetry(app, root, actor) {
  if (!root) return;

  const current = ritualistInjectionRetries.get(root);
  if (current?.timeoutId) return;
  const attempts = current?.attempts ?? 0;
  if (attempts >= 3) {
    ritualistInjectionRetries.delete(root);
    return;
  }

  const state = { attempts: attempts + 1, timeoutId: null };
  state.timeoutId = window.setTimeout(() => {
    state.timeoutId = null;
    const currentRoot = getRoot(app?.element) ?? root;
    if (currentRoot !== root) ritualistInjectionRetries.delete(root);
    injectRitualistInlineList(app, currentRoot, actor);
  }, 50 * state.attempts);
  ritualistInjectionRetries.set(root, state);
}

function cancelRitualistInjectionRetry(root) {
  const state = ritualistInjectionRetries.get(root);
  if (!state) return;
  if (state.timeoutId) window.clearTimeout(state.timeoutId);
  ritualistInjectionRetries.delete(root);
}

function findAbilityItemRow(root, itemId) {
  return root.querySelector(`.abilities-powers [data-item-id="${itemId}"]`)
    ?? root.querySelector(`[data-item-id="${itemId}"]`);
}

function moveAbilityRowToEnd(row) {
  const list = row?.parentElement;
  if (!list || list.lastElementChild === row) return;
  list.append(row);
}

function isAbilityRowInRightColumn(row) {
  const list = row?.parentElement;
  if (!list?.getBoundingClientRect || !row?.getBoundingClientRect) return false;
  const listRect = list.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  return rowRect.left + (rowRect.width / 2) > listRect.left + (listRect.width / 2);
}

function buildRitualistInlineRow(root, actor, rituals, anchorRow) {
  const row = document.createElement(anchorRow?.tagName === "LI" ? "li" : "div");
  row.className = "tenebre-ritualist-inline-row";

  const content = document.createElement("div");
  content.className = "tenebre-ritualist-inline";

  if (!rituals.length) {
    const empty = document.createElement("p");
    empty.className = "tenebre-ritualist-empty";
    empty.textContent = game.i18n.localize("TENEBRE.RitualBrowser.NoKnownRituals");
    content.appendChild(empty);
  } else {
    const list = document.createElement("ol");
    list.className = "tenebre-ritualist-list";
    for (const ritual of rituals) list.appendChild(buildRitualistItem(root, actor, ritual));
    content.appendChild(list);
  }

  row.appendChild(content);
  return row;
}

function buildRitualistItem(root, actor, ritual) {
  const row = document.createElement("li");
  row.className = "tenebre-ritualist-item symbaroum-contextmenu";
  row.dataset.itemId = ritual.id;

  const use = document.createElement("button");
  use.type = "button";
  use.className = "tenebre-ritualist-use";
  use.style.backgroundImage = `url("${String(ritual.img || "icons/svg/book.svg").replaceAll('"', '%22')}")`;
  use.title = game.i18n.localize("TENEBRE.RitualBrowser.Use");
  use.setAttribute("aria-label", use.title);
  use.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const original = findAbilityItemRow(root, ritual.id)?.querySelector(".activate-ability");
    if (original) original.click();
    else if (ChatItemUseService.canSend(ritual)) await ChatItemUseService.send(actor, ritual);
  });
  row.appendChild(use);

  const open = document.createElement("button");
  open.type = "button";
  open.className = "tenebre-ritualist-name";
  open.textContent = ritual.name;
  open.title = game.i18n.localize("TENEBRE.RitualBrowser.OpenRitual");
  open.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    ritual.sheet?.render(true);
  });
  row.appendChild(open);

  const action = document.createElement("span");
  action.className = "tenebre-ritualist-action";
  action.textContent = ritual.system?.actions || game.i18n.localize("TENEBRE.RitualBrowser.Ritual");
  row.appendChild(action);

  return row;
}

function wireChatItemUseIconFallback(app, html, actor) {
  if (!TenebreSettings.get("enableChatItemUse")) return;

  const el = getRoot(html);
  if (!el) return;

  for (const button of el.querySelectorAll(".activate-ability")) {
    if (button.dataset.tenebreChatItemUse === "true") continue;
    const row = button.closest("[data-item-id]");
    const item = row ? actor.items.get(row.dataset.itemId) : null;
    if (!shouldUseChatItemFromIcon(item)) continue;

    button.dataset.tenebreChatItemUse = "true";
    button.classList.add("tenebre-chat-use-available");
    button.title = game.i18n.localize("TENEBRE.ChatItemUse.ContextMenu");
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      await ChatItemUseService.send(actor, item);
      app.render?.(false);
    }, { capture: true });
  }
}

function shouldUseChatItemFromIcon(item) {
  if (!ChatItemUseService.canSend(item)) return false;
  if (item?.system?.isRitual) return true;
  return item?.system?.isPower === true && item?.system?.hasScript !== true;
}

function wireInventoryItemIconUse(html, actor) {
  const el = getRoot(html);
  if (!el) return;

  const canUseItems = TenebreSettings.get("enableChatItemUse");
  if (!canUseItems) return;

  const controls = el.querySelectorAll(
    ".gear .item-row.item[data-item-id] .image-container > .image"
  );

  for (const control of controls) {
    if (control.dataset.tenebreItemIconUse === "true") continue;

    const row = control.closest(".item-row.item[data-item-id]");
    const item = row ? actor.items.get(row.dataset.itemId) : null;
    const usesItem = canUseItems
      && !ContainerService.isContainer(item)
      && ChatItemUseService.canSend(item);
    if (!usesItem) continue;

    control.dataset.tenebreItemIconUse = "true";
    control.classList.add("tenebre-item-icon-use");
    const isNativeButton = control.matches("button, input, select, textarea, a[href]");
    if (!isNativeButton) {
      control.tabIndex = 0;
      control.setAttribute("role", "button");
    }
    control.title = game.i18n.localize("TENEBRE.ChatItemUse.ContextMenu");

    const activate = async (event) => {
      if (event.type === "click" && event.button !== 0) return;
      if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      await ChatItemUseService.send(actor, item);
    };

    control.addEventListener("click", activate, { capture: true });
    if (!isNativeButton) control.addEventListener("keydown", activate, { capture: true });
  }
}

function wireContainerLeftClickToggle(html, actor) {
  const el = getRoot(html);
  if (!el) return;

  for (const row of el.querySelectorAll(".gear .item-row.item[data-item-id]")) {
    const item = actor.items.get(row.dataset.itemId);
    if (!ContainerService.isContainer(item) || ContainerService.isStored(item)) continue;

    const controls = row.querySelectorAll(".item-edit, .image-container > .image");
    for (const control of controls) {
      if (control.dataset.tenebreContainerToggle === "true") continue;

      control.dataset.tenebreContainerToggle = "true";
      control.classList.remove("tenebre-item-icon-use");
      control.classList.add("tenebre-container-toggle");
      control.title = game.i18n.localize("TENEBRE.Containers.OpenContextMenu");

      const isNativeButton = control.matches("button, input, select, textarea, a[href]");
      if (!isNativeButton) {
        control.tabIndex = 0;
        control.setAttribute("role", "button");
      }

      const activate = async (event) => {
        if (event.type === "click" && event.button !== 0) return;
        if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        await ContainerService.toggleContainer(actor, item);
      };

      control.addEventListener("click", activate, { capture: true });
      if (!isNativeButton) control.addEventListener("keydown", activate, { capture: true });
    }
  }
}

function wireContainerDragDrop(app, html, actor) {
  const el = getRoot(html);
  if (!el || el.dataset.tenebreContainerDragDrop === "true") return;

  el.dataset.tenebreContainerDragDrop = "true";
  prepareContainerDraggables(el, actor);

  el.addEventListener("dragstart", (event) => {
    const dragData = getContainerDragStartData(event, el, actor);
    if (!dragData) return;

    activeContainerDrag = dragData;
    const serialized = JSON.stringify(dragData);
    event.dataTransfer?.setData(CONTAINER_DRAG_DATA_TYPE, serialized);
    event.dataTransfer?.setData("text/plain", serialized);
    event.dataTransfer?.setData("application/json", serialized);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }, { capture: true });

  el.addEventListener("dragend", () => {
    activeContainerDrag = null;
    clearContainerDropMarkers(el);
  }, { capture: true });

  el.addEventListener("dragover", (event) => {
    const dragData = activeContainerDrag;
    if (!dragData) return;

    clearContainerDropMarkers(el);
    const container = getContainerDropTarget(event.target, actor);
    if (dragData.source === "inventory" && container) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      markContainerDropTarget(el, container);
      return;
    }

    if (dragData.source === "stored" && isStoredItemWithdrawDrop(event.target)) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      el.classList.add("tenebre-container-withdraw-drop");
    }
  }, { capture: true });

  el.addEventListener("dragleave", (event) => {
    if (!el.contains(event.relatedTarget)) clearContainerDropMarkers(el);
  }, { capture: true });

  el.addEventListener("drop", async (event) => {
    const dragData = activeContainerDrag ?? getContainerDropData(event);
    if (!dragData || dragData.actorId !== actor.id) return;

    const item = actor.items.get(dragData.itemId);
    if (!item) return;

    const container = getContainerDropTarget(event.target, actor);
    if (dragData.source === "inventory" && container) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      await ContainerService.storeItemInContainerPrompt(actor, item, container);
    } else if (dragData.source === "stored" && isStoredItemWithdrawDrop(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      await ContainerService.withdrawItem(actor, item);
    }

    activeContainerDrag = null;
    clearContainerDropMarkers(el);
  }, { capture: true });
}

function prepareContainerDraggables(el, actor) {
  for (const row of el.querySelectorAll(".item[data-item-id]")) {
    const item = actor.items.get(row.dataset.itemId);
    const isContainer = ContainerService.isContainer(item);
    const canDragContainer = isContainer
      && !ContainerService.isStored(item)
      && ContainerService.isAccessible(item)
      && !GroundContainerService.hasGroundToken(item);
    if (isContainer && !canDragContainer) {
      row.draggable = false;
      row.classList.remove("tenebre-container-draggable");
      continue;
    }
    if (!canDragContainer && !ContainerService.canAttemptStoreItem(item)) continue;
    row.draggable = true;
    row.classList.add("tenebre-container-draggable");
  }
}

function getContainerDragStartData(event, root, actor) {
  const storedRow = event.target?.closest?.(".tenebre-container-item[data-stored-item-id]");
  if (storedRow && root.contains(storedRow)) {
    const item = actor.items.get(storedRow.dataset.storedItemId);
    if (!ContainerService.isStored(item)) return null;
    return { actorId: actor.id, itemId: item.id, source: "stored" };
  }

  const itemRow = event.target?.closest?.(".item[data-item-id]");
  if (!itemRow || !root.contains(itemRow)) return null;
  const item = actor.items.get(itemRow.dataset.itemId);
  if (ContainerService.isContainer(item) && !ContainerService.isStored(item)
    && ContainerService.isAccessible(item) && !GroundContainerService.hasGroundToken(item)) {
    return GroundContainerService.buildDragData(actor, item);
  }
  if (ContainerService.isContainer(item)) return null;
  if (!ContainerService.canAttemptStoreItem(item)) return null;
  return { actorId: actor.id, actorUuid: actor.uuid, itemId: item.id, source: "inventory" };
}

function getContainerDropData(event) {
  const raw = event.dataTransfer?.getData(CONTAINER_DRAG_DATA_TYPE);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data?.actorId && data?.itemId && data?.source) return data;
  } catch (_error) {
    // Ignore non-Tenebre drag payloads.
  }
  return null;
}

function getContainerDropTarget(target, actor) {
  const inlineRow = target?.closest?.(".tenebre-container-inline-row[data-container-id]");
  if (inlineRow) return actor.items.get(inlineRow.dataset.containerId) ?? null;

  const itemRow = target?.closest?.(".item[data-item-id]");
  const item = itemRow ? actor.items.get(itemRow.dataset.itemId) : null;
  if (ContainerService.isContainer(item) && !ContainerService.isStored(item)) return item;
  return null;
}

function isStoredItemWithdrawDrop(target) {
  return !target?.closest?.(".tenebre-container-inline-row, .tenebre-container-inline, .tenebre-container-item");
}

function markContainerDropTarget(root, container) {
  const row = root.querySelector(`.item[data-item-id="${container.id}"]`);
  row?.classList.add("tenebre-container-drop-target");
  root.querySelector(`.tenebre-container-inline-row[data-container-id="${container.id}"]`)
    ?.classList.add("tenebre-container-drop-target");
}

function clearContainerDropMarkers(root) {
  root.classList.remove("tenebre-container-withdraw-drop");
  root.querySelectorAll(".tenebre-container-drop-target").forEach((element) => {
    element.classList.remove("tenebre-container-drop-target");
  });
}

function onTenebreSettingChanged(key) {
  if (!["enableRestButton", "enableClearEffectsButton"].includes(key)) return;
  window.setTimeout(syncOpenActorSheetHeaders, 50);
  window.setTimeout(syncOpenActorSheetHeaders, 800);
}

function onActiveEffectChanged(effect) {
  const actor = effect?.parent;
  if (!isManagedActor(actor)) return;
  if (!TenebreSettings.get("enableClearEffectsButton")) return;

  syncActorSheetHeaders(actor);
  window.setTimeout(() => syncActorSheetHeaders(actor), 0);
  window.setTimeout(() => syncActorSheetHeaders(actor), 100);
  window.setTimeout(() => syncActorSheetHeaders(actor), 500);
}

function syncOpenActorSheetHeaders() {
  for (const app of Object.values(ui.windows ?? {})) {
    syncActorSheetHeaderButtons(app);
  }

  const instances = foundry.applications?.instances;
  if (instances && typeof instances[Symbol.iterator] === "function") {
    for (const app of instances) syncActorSheetHeaderButtons(app);
  }
}

function syncActorSheetHeaders(actor) {
  if (!actor) return;

  for (const app of Object.values(ui.windows ?? {})) {
    const sheetActor = app.actor ?? app.document;
    if (sheetActor?.id === actor.id) syncActorSheetHeaderButtons(app);
  }

  const instances = foundry.applications?.instances;
  if (instances && typeof instances[Symbol.iterator] === "function") {
    for (const app of instances) {
      const sheetActor = app.actor ?? app.document;
      if (sheetActor?.id === actor.id) syncActorSheetHeaderButtons(app);
    }
  }
}

function syncActorSheetHeaderButtons(app) {
  removeTenebreActorHeaderButtons(app);
  if (!isSymbaroumActorSheetApplication(app)) return;

  const actor = app?.actor ?? app?.document;
  if (!isManagedActor(actor)) return;
  if (!actor.isOwner && !game.user.isGM) return;

  const root = getRoot(app.element);
  const header = root?.querySelector(".window-header, header");
  if (!header) return;

  const insertBefore = header.querySelector(".death-roll, .recover-death-roll, .configure-sheet, .close");

  if (TenebreSettings.get("enableClearEffectsButton") && hasActorEffects(actor)) {
    insertHeaderButton(header, insertBefore, {
      className: "tenebre-clear-effects",
      icon: "fas fa-eraser",
      label: game.i18n.localize("TENEBRE.Maneuvers.ClearEffects"),
      onClick: async (ev) => {
        ev.preventDefault();
        const count = await clearActorEffects(actor);
        ui.notifications.info(game.i18n.format("TENEBRE.Maneuvers.ClearEffectsDone", { count }));
        syncActorSheetHeaderButtons(app);
        window.setTimeout(() => syncActorSheetHeaderButtons(app), 0);
        window.setTimeout(() => syncActorSheetHeaderButtons(app), 100);
        app.render?.(false);
      }
    });
  }

  if (isPlayerActor(actor) && TenebreSettings.get("enableRestButton")) {
    insertHeaderButton(header, insertBefore, {
      className: "tenebre-rest",
      icon: "fas fa-bed",
      label: game.i18n.localize("TENEBRE.Rest.DialogTitle") || "Descanso",
      onClick: async (ev) => {
        ev.preventDefault();
        await RestService.openRestDialog(actor);
      }
    });
  }
}

function removeTenebreActorHeaderButtons(app, element = app?.element) {
  const root = getRoot(element);
  root?.querySelectorAll?.(".window-header .tenebre-rest, .window-header .tenebre-clear-effects")
    .forEach((button) => button.remove());
}

function isSymbaroumActorSheetApplication(app) {
  return isRegisteredSymbaroumSheetApplication(app, "Actor", ["player", "monster"]);
}

function isSymbaroumItemSheetApplication(app) {
  return isRegisteredSymbaroumSheetApplication(app, "Item", ["equipment", "weapon", "armor"]);
}

function isRegisteredSymbaroumSheetApplication(app, documentName, types) {
  if (!app) return false;
  const document = documentName === "Actor"
    ? (app.actor ?? app.document)
    : (app.item ?? app.document);
  if (document?.documentName !== documentName || !types.includes(document.type)) return false;

  return getSymbaroumSheetClasses(documentName, document.type)
    .some((SheetClass) => typeof SheetClass === "function" && app instanceof SheetClass);
}

function insertHeaderButton(header, before, { className, icon, label, onClick }) {
  const button = document.createElement("a");
  button.className = `header-button control ${className}`;
  button.innerHTML = `<i class="${icon}"></i>${escapeHtml(label)}`;
  button.addEventListener("click", onClick);
  header.insertBefore(button, before ?? null);
}

function hideStoredItemRows(app, html, actor) {
  const el = getRoot(html);
  if (!el) return;

  const hideRows = () => {
    for (const item of actorItems(actor)) {
      if (!ContainerService.isStored(item)) continue;
      const row = el.querySelector(`[data-item-id="${item.id}"]`);
      if (!row) continue;
      row.hidden = true;
      row.style.display = "none";
      row.classList.add("tenebre-hidden-stored-item");
    }
  };

  hideRows();
  setTimeout(hideRows, 0);
  setTimeout(hideRows, 100);
}

function injectContainerInlineLists(app, html, actor) {
  if (!TenebreSettings.get("enableContainers")) return;

  const el = getRoot(html);
  if (!el) return;

  el.querySelectorAll(".tenebre-container-inline-row").forEach((row) => row.remove());

  for (const container of actorItems(actor)) {
    if (!ContainerService.isContainer(container) || ContainerService.isStored(container)) continue;

    const row = el.querySelector(`[data-item-id="${container.id}"]`);
    if (!row || row.classList.contains("tenebre-hidden-stored-item")) continue;

    decorateContainerCapacity(row, actor, container);

    const expanded = ContainerService.isContainerExpanded(actor, container);
    row.classList.toggle("tenebre-container-expanded", expanded);
    row.setAttribute("aria-expanded", expanded ? "true" : "false");
    if (!expanded) continue;

    row.insertAdjacentElement("afterend", buildContainerInlineRow(actor, container, row));
  }

  bindStoredItemContextMenu(el, actor);
}

function decorateContainerCapacity(row, actor, container) {
  row.querySelectorAll(".tenebre-container-capacity").forEach((badge) => badge.remove());

  const badge = document.createElement("span");
  badge.className = "tenebre-container-capacity";
  badge.textContent = `(${ContainerService.getContainerCapacityLabel(actor, container)})`;
  badge.title = game.i18n.localize("TENEBRE.Containers.CapacityDisplay");

  const quantity = row.querySelector(".quantity");
  if (quantity) {
    quantity.append(" ", badge);
    return;
  }

  const name = row.querySelector(".item-name, .name");
  (name ?? row).append(" ", badge);
}

function buildContainerInlineRow(actor, container, anchorRow) {
  const isTableRow = anchorRow?.tagName === "TR";
  const tagName = isTableRow
    ? "tr"
    : anchorRow?.tagName === "LI"
      ? "li"
      : "div";

  const row = document.createElement(tagName);
  row.className = "tenebre-container-inline-row";
  row.dataset.containerId = container.id;

  const content = document.createElement("div");
  content.className = "tenebre-container-inline";

  const storedItems = ContainerService.getStoredItems(actor, container);
  if (!storedItems.length) {
    const empty = document.createElement("p");
    empty.className = "tenebre-container-empty";
    empty.textContent = game.i18n.localize("TENEBRE.Containers.Empty");
    content.appendChild(empty);
  } else {
    const list = document.createElement("ol");
    list.className = "tenebre-container-list";
    for (const item of storedItems) {
      list.appendChild(buildContainerInlineItem(actor, item));
    }
    content.appendChild(list);
  }

  if (isTableRow) {
    const cell = document.createElement("td");
    cell.colSpan = Math.max(1, anchorRow.children.length || 1);
    cell.appendChild(content);
    row.appendChild(cell);
  } else {
    row.appendChild(content);
  }

  return row;
}

function buildContainerInlineItem(actor, item) {
  const row = document.createElement("li");
  row.className = "tenebre-container-item";
  row.dataset.storedItemId = item.id;
  row.draggable = true;

  const openItem = (event) => {
    if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    item.sheet?.render(true);
  };

  const img = document.createElement("img");
  img.src = item.img || "icons/svg/item-bag.svg";
  img.alt = "";
  img.draggable = false;
  if (TenebreSettings.get("enableChatItemUse") && ChatItemUseService.canSend(item)) {
    img.classList.add("tenebre-container-item-use");
    img.tabIndex = 0;
    img.setAttribute("role", "button");
    img.title = game.i18n.localize("TENEBRE.ChatItemUse.ContextMenu");

    const useItem = async (event) => {
      if (event.type === "click" && event.button !== 0) return;
      if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      await ChatItemUseService.send(actor, item);
    };

    img.addEventListener("click", useItem, { capture: true });
    img.addEventListener("keydown", useItem, { capture: true });
  }
  row.appendChild(img);

  const name = document.createElement("span");
  name.className = "tenebre-container-name tenebre-container-name-open";
  name.textContent = item.name;
  name.tabIndex = 0;
  name.setAttribute("role", "button");
  name.title = game.i18n.localize("TENEBRE.Containers.Edit");
  name.addEventListener("click", openItem);
  name.addEventListener("keydown", openItem);
  row.appendChild(name);

  const quantity = document.createElement("span");
  quantity.className = "tenebre-container-qty";
  quantity.textContent = String(item.type === "equipment" ? itemQuantity(item) : 1);
  row.appendChild(quantity);

  const withdraw = document.createElement("button");
  withdraw.type = "button";
  withdraw.draggable = false;
  withdraw.textContent = game.i18n.localize("TENEBRE.Containers.Withdraw");
  withdraw.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await ContainerService.withdrawItem(actor, item);
  });
  row.appendChild(withdraw);

  const edit = document.createElement("button");
  edit.type = "button";
  edit.draggable = false;
  edit.textContent = game.i18n.localize("TENEBRE.Containers.Edit");
  edit.addEventListener("click", openItem);
  row.appendChild(edit);

  return row;
}

function bindStoredItemContextMenu(root, actor) {
  if (storedItemContextMenuRoots.has(root)) return;

  const BaseContextMenu = foundry.applications?.ux?.ContextMenu;
  const ContextMenuClass = BaseContextMenu?.implementation ?? BaseContextMenu;
  if (typeof ContextMenuClass !== "function") return;

  const splitEntry = CompatibilityService.buildContextMenuEntry({
    label: game.i18n.localize("TENEBRE.Containers.Split"),
    icon: '<i class="fas fa-code-branch"></i>',
    visible: (target) => {
      const item = actor.items.get(target?.dataset?.storedItemId);
      return ContainerService.isStored(item)
        && item.type === "equipment"
        && itemQuantity(item) > 1;
    },
    onClick: (target) => {
      const item = actor.items.get(target?.dataset?.storedItemId);
      if (item) void ContainerService.splitItemPrompt(actor, item);
    }
  });

  new ContextMenuClass(
    root,
    ".tenebre-container-item[data-stored-item-id]",
    [splitEntry],
    { fixed: true, jQuery: false }
  );
  storedItemContextMenuRoots.add(root);
}

function rerenderActorSheets(actor) {
  if (!actor) return;
  for (const app of Object.values(ui.windows ?? {})) {
    const sheetActor = app.actor ?? app.document;
    if (sheetActor?.id === actor.id && typeof app.render === "function") {
      app.render(false);
    }
  }
}

// Injeta quantidade e usos de aljavas na ficha
function updateQuiverQuantityDisplay(app, html, actor) {
  if (!isPlayerActor(actor)) return;
  if (!TenebreSettings.get("enableAmmoConsumption")) return;
  if (!TenebreSettings.get("enableQuiverAmmoContainers")) return;

  const el = getRoot(html);
  if (!el) return;

  const quivers = actor.items.filter(isQuiver);
  for (const quiver of quivers) {
    const row = el.querySelector(`.item[data-item-id="${quiver.id}"]`);
    if (!row) continue;

    const qtyDiv = row.querySelector(".quantity");
    if (!qtyDiv) continue;

      const qty = itemQuantity(quiver);
      if (qty > 0) {
        const loaded = getQuiverLoadedTotal(quiver);
        qtyDiv.textContent = `${qty} (${loaded}/${getQuiverCapacity()})`;
      }
  }
}

// Injeta quantidade e usos de rações na ficha
function updateRationQuantityDisplay(app, html, actor, { readOnly = false } = {}) {
  if (!TenebreSettings.get("enableRations")) return;

  const el = getRoot(html);
  if (!el) return;

  if (!readOnly && RationService.needsConsolidation(actor)) {
    RationService.consolidate(actor).then((changed) => {
      if (changed) rerenderActorSheets(actor);
    }).catch((error) => {
      console.warn("Tenebre Resources | Failed to consolidate rations while rendering actor sheet.", error);
    });
  }

  for (const rationState of RationService.getStates(actor)) {
    if (rationState.quantity <= 0) continue;

    const displayItem = rationState.items.find((item) => itemQuantity(item) > 0);

    for (const item of rationState.items) {
      const row = el.querySelector(`.item[data-item-id="${item.id}"]`);
      if (!row) continue;

      if (displayItem && item.id !== displayItem.id) {
        row.style.display = "none";
        continue;
      }

      const qtyDiv = row.querySelector(".quantity");
      if (!qtyDiv) continue;

      const qty = itemQuantity(item);
      if (qty > 0) {
        qtyDiv.textContent = `${rationState.quantity} (${rationState.totalUsesRemaining}/${rationState.totalUsesCapacity})`;
      }
    }
  }
}

function hasActorEffects(actor) {
  return Array.from(actor?.effects ?? []).some((effect) => !isWeaponReadinessIndicatorEffect(effect));
}

async function clearActorEffects(actor) {
  const effects = Array.from(actor?.effects ?? []).filter((effect) => effect?.id && !isWeaponReadinessIndicatorEffect(effect));
  if (!actor || !effects.length) return 0;
  await ManeuverService.prepareEffectsForRemoval(actor, effects);
  await SocketService.deleteEmbeddedDocuments(actor, "ActiveEffect", effects.map((effect) => effect.id), { render: true });
  return effects.length;
}

function onRenderItemSheet(app, html) {
  const item = app.item ?? app.document ?? app.object;
  if (!item) return;
  if (!item.isOwner && !game.user.isGM) return;
  if (skipDuplicateSheetRender(html, app, "item")) return;

  if (TenebreSettings.get("enableEncumbrance")) {
    injectItemWeightField(app, html, item);
  }
}

function skipDuplicateSheetRender(html, app, type) {
  const root = getRoot(html) ?? getRoot(app?.element);
  if (!root?.dataset) return false;

  const key = type === "item" ? "tenebreItemRenderQueued" : "tenebreActorRenderQueued";
  if (root.dataset[key] === "true") return true;

  root.dataset[key] = "true";
  const clearQueuedFlag = () => {
    if (root.dataset) delete root.dataset[key];
  };
  if (typeof queueMicrotask === "function") queueMicrotask(clearQueuedFlag);
  else Promise.resolve().then(clearQueuedFlag);
  return false;
}

// Campo "Peso" na aba Descrição/Estatísticas (estilo Custo / Número)
async function injectItemWeightField(app, html, item) {
  if (!["equipment", "weapon", "armor"].includes(item.type)) return;

  const root = getRoot(html);
  if (!root) return;

  const existingRows = Array.from(root.querySelectorAll(".tenebre-weight-row"));
  if (existingRows.length === 1) {
    const input = existingRows[0].querySelector(".tenebre-weight-input");
    if (input) {
      input.value = String(getDisplayedItemWeight(item));
      input.disabled = !Boolean(app.isEditable && item.isOwner && !EncumbranceService.hasComputedStackWeight(item));
    }
    return;
  }
  if (existingRows.length > 1) {
    existingRows.slice(1).forEach((row) => row.remove());
    return;
  }

  if (root.dataset?.tenebreWeightInjecting === "true") return;
  if (root.dataset) root.dataset.tenebreWeightInjecting = "true";

  try {
    await EncumbranceService.autoAssignSlots(item);
  } catch (err) {
    if (root.dataset) delete root.dataset.tenebreWeightInjecting;
    throw err;
  }

  const numberRow = findItemWeightAnchor(root, item);
  if (!numberRow) {
    if (root.dataset) delete root.dataset.tenebreWeightInjecting;
    return;
  }

  root.querySelectorAll(".tenebre-weight-row").forEach((row) => row.remove());

  const slots = getDisplayedItemWeight(item);
  const editable = Boolean(app.isEditable && item.isOwner && !EncumbranceService.hasComputedStackWeight(item));
  const row = createWeightRow(slots, editable, numberRow.style);

  numberRow.element.insertAdjacentElement(numberRow.insert, row);
  if (root.dataset) root.dataset.tenebreWeightInjected = "true";

  const input = row.querySelector(".tenebre-weight-input");
  input?.addEventListener("change", async (event) => {
    const value = Math.max(0, Math.min(10, Number(event.currentTarget.value) || 0));
    event.currentTarget.value = value;
    await item.setFlag(FLAG_SCOPE, "encumbranceSlots", value);
    await item.setFlag(FLAG_SCOPE, "encumbranceManual", true);
    await EncumbranceService.rememberItemWeight(item, value);
    refreshActorEncumbrance(item.parent);
  });
}

function findItemWeightAnchor(root, item) {
  const numberKeys = item.type === "weapon"
    ? ["WEAPON.NUMBER", "EQUIPMENT.NUMBER"]
    : ["EQUIPMENT.NUMBER", "WEAPON.NUMBER"];

  const numberInput = root.querySelector('input[name="system.number"]');
  if (numberInput) {
    const row = numberInput.closest(".gridrow, .number");
    if (row) {
      return {
        element: row,
        insert: "afterend",
        style: row.classList.contains("gridrow") ? "gridrow" : "symbaroum"
      };
    }
  }

  for (const row of root.querySelectorAll(".gridrow")) {
    const label = row.querySelector(".gridcolumn:first-child");
    if (matchesSymbaroumLabel(label?.textContent, ...numberKeys)) {
      return { element: row, insert: "afterend", style: "gridrow" };
    }
  }

  for (const row of root.querySelectorAll(".number")) {
    const label = row.querySelector("label");
    if (matchesSymbaroumLabel(label?.textContent, ...numberKeys)) {
      return { element: row, insert: "afterend", style: "symbaroum" };
    }
  }

  if (item.type === "armor") {
    const costInput = root.querySelector('input[name="system.cost"]');
    if (costInput) {
      const costDiv = costInput.closest(".cost");
      if (costDiv) return { element: costDiv, insert: "afterend", style: "symbaroum" };
    }
  }

  return null;
}

function createWeightRow(slots, editable, style) {
  const label = game.i18n.localize("TENEBRE.Encumbrance.Weight");
  const disabled = editable ? "" : "disabled";
  const inputHtml = `
    <input
      type="number"
      class="tenebre-weight-input"
      value="${slots}"
      min="0"
      max="10"
      step="1"
      ${disabled}
    >
  `;

  const row = document.createElement("div");
  if (style === "gridrow") {
    row.className = "gridrow tenebre-weight-row";
    row.innerHTML = `
      <div class="gridcolumn">${label}</div>
      <div class="gridcolumn data">${inputHtml}</div>
    `;
  } else {
    row.className = "number tenebre-weight-row";
    row.innerHTML = `<label>${label}</label>${inputHtml}`;
  }
  return row;
}

function refreshActorEncumbrance(actor) {
  if (!actor) return;
  for (const app of Object.values(ui.windows)) {
    const sheetActor = app.actor ?? app.document;
    if (sheetActor?.id === actor.id && typeof app.render === "function") {
      const root = getRoot(app.element);
      if (root) injectEncumbrancePanel(app, root, actor);
      else app.render(false);
    }
  }
}

function onEncumbranceItemUpdated(item, changes) {
  if (!TenebreSettings.get("enableEncumbrance") || !item?.parent) return;

  const changedKeys = Object.keys(changes ?? {});
  const moduleFlags = `flags.${MODULE_ID}.`;
  const affectsLoad = changedKeys.some((key) => key === "system.state"
    || key === "system.number"
    || key.startsWith(`${moduleFlags}storedIn`)
    || key.startsWith(`${moduleFlags}preStoredState`)
    || key.startsWith(`${moduleFlags}encumbranceSlots`)
    || key.startsWith(`${moduleFlags}encumbranceManual`)
    || key.startsWith(`${moduleFlags}-=storedIn`)
    || key.startsWith(`${moduleFlags}-=preStoredState`));
  if (!affectsLoad) return;

  refreshActorEncumbrance(item.parent);
}

// Indicador de carga ao lado do título "Equipamento" na aba Gear
function injectEncumbrancePanel(app, html, actor) {
  if (!TenebreSettings.get("enableEncumbrance")) return;

  const el = getRoot(html);
  if (!el) return;

  const load = EncumbranceService.calculateLoad(actor);
  const title = findEquipmentSectionTitle(el, actor);
  if (!title) return;

  let indicator = title.querySelector(".tenebre-enc-indicator");
  if (!indicator) {
    indicator = document.createElement("span");
    indicator.className = "tenebre-enc-indicator";
    title.appendChild(indicator);
  }

  indicator.innerHTML = buildEncumbranceIndicatorHtml(load);
  indicator.title = game.i18n.format("TENEBRE.Encumbrance.BarTooltip", {
    current: load.currentLoad,
    capacity: load.capacity,
    max: load.maxCapacity,
    strong: load.strong
  });
}

function findEquipmentSectionTitle(root, actor) {
  const equipmentsSection = root.querySelector(".equipments");
  if (equipmentsSection) {
    const h1 = equipmentsSection.querySelector(":scope > h1") ?? equipmentsSection.querySelector("h1");
    if (h1) return h1;
  }

  const titleVariants = symbaroumLabelVariants("TITLE.EQUIPMENTS");
  for (const h1 of root.querySelectorAll("h1")) {
    if (matchesEquipmentTitle(h1, titleVariants)) return h1;
  }

  for (const header of root.querySelectorAll("li.equipment.item-header")) {
    const qty = header.querySelector(".quantity");
    if (matchesSymbaroumLabel(qty?.textContent, "EQUIPMENT.QUANTITY_SHORT")) {
      return header.closest(".equipments")?.querySelector("h1") ?? null;
    }
  }

  if (actor) {
    for (const row of root.querySelectorAll(".equipments [data-item-id]")) {
      const item = actor.items.get(row.dataset.itemId);
      if (item?.type === "equipment") {
        return row.closest(".equipments")?.querySelector("h1") ?? null;
      }
    }
  }

  return null;
}

function matchesEquipmentTitle(h1, titleVariants) {
  const clone = h1.cloneNode(true);
  clone.querySelector(".tenebre-enc-indicator")?.remove();
  clone.querySelector("a")?.remove();
  return titleVariants.has(normalize(clone.textContent || ""));
}

function buildEncumbranceIndicatorHtml(load) {
  let statusClass = "";
  let statusText = "";

  if (load.isImmobilized) {
    statusClass = "tenebre-enc-immobilized";
    statusText = game.i18n.localize("TENEBRE.Encumbrance.Immobilized");
  } else if (load.isOverloaded) {
    statusClass = "tenebre-enc-overloaded";
    statusText = game.i18n.format("TENEBRE.Encumbrance.DefensePenalty", { penalty: load.defensePenalty });
  }

  const loadText = game.i18n.format("TENEBRE.Encumbrance.Indicator", {
    current: load.currentLoad,
    capacity: load.capacity
  });

  const porterBadge = load.hasPorter
    ? ` <span class="tenebre-enc-porter" title="${game.i18n.localize("TENEBRE.Encumbrance.Porter")}"><i class="fas fa-dolly"></i></span>`
    : "";

  const statusHtml = statusText
    ? ` <span class="tenebre-enc-status ${statusClass}">(${statusText})</span>`
    : "";

  return `${loadText}${porterBadge}${statusHtml}`;
}

function injectManeuverPanel(app, html, actor) {
  if (!isPlayerActor(actor)) return;

  const el = getRoot(html);
  if (!el) return;

  const selectionKey = getManeuverSelectionKey(actor);
  const previousSelection = el.querySelector(".tenebre-maneuver-panel .tenebre-maneuver-select")?.value;
  if (previousSelection) selectedManeuversByActor.set(selectionKey, previousSelection);

  el.querySelectorAll(".tenebre-maneuver-panel").forEach((panel) => panel.remove());

  if (!TenebreSettings.get("enableManeuvers")) {
    el.querySelectorAll(".tenebre-has-maneuvers").forEach((node) => node.classList.remove("tenebre-has-maneuvers"));
    return;
  }

  const anchor = el.querySelector(".combat .weapons");
  if (!anchor) return;

  const selectedManeuverId = selectedManeuversByActor.get(selectionKey) ?? ManeuverService.list()[0]?.id;
  const panel = document.createElement("div");
  panel.className = "tenebre-maneuver-panel";
  panel.innerHTML = buildManeuverPanelHtml(selectedManeuverId);
  anchor.classList.add("tenebre-has-maneuvers");
  updateManeuverInformation(panel, selectedManeuverId);

  const maneuverSelect = panel.querySelector(".tenebre-maneuver-select");
  maneuverSelect?.addEventListener("change", () => {
    selectedManeuversByActor.set(selectionKey, maneuverSelect.value);
    updateManeuverInformation(panel, maneuverSelect.value);
  });

  for (const button of panel.querySelectorAll(".tenebre-maneuver-roll")) {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const select = panel.querySelector(".tenebre-maneuver-select");
      const maneuverId = select?.value;
      if (maneuverId) selectedManeuversByActor.set(selectionKey, maneuverId);
      const privateRoll = Boolean(panel.querySelector(".tenebre-maneuver-private-roll")?.checked);
      await RollPrivacyService.runPrivateRoll(privateRoll, () => (
        ManeuverService.execute(actor, maneuverId, {
          modifier: 0,
          damageValue: 0
        })
      ));
    });
  }

  anchor.insertAdjacentElement("afterend", panel);
}

function getManeuverSelectionKey(actor) {
  return actor?.uuid ?? actor?.id ?? actor?.name ?? "unknown";
}

function buildManeuverPanelHtml(selectedManeuverId) {
  const options = ManeuverService.list().map((maneuver) => {
    const label = game.i18n.localize(maneuver.labelKey);
    const selected = maneuver.id === selectedManeuverId ? " selected" : "";
    return `<option value="${maneuver.id}"${selected}>${escapeHtml(label)}</option>`;
  }).join("");

  return `
    <div class="item-list">
      <div class="item-header">
        <b class="name">${game.i18n.localize("TENEBRE.Maneuvers.Title")}</b>
      </div>
      <div class="items">
        <div class="item tenebre-maneuver-row">
          <select class="tenebre-maneuver-select" aria-label="${game.i18n.localize("TENEBRE.Maneuvers.Select")}">
            ${options}
          </select>
          <button type="button" class="tenebre-maneuver-info">
            <i class="fas fa-info-circle" aria-hidden="true"></i>
            <span class="tenebre-maneuver-tooltip" role="tooltip"></span>
          </button>
          <label class="tenebre-maneuver-private-label" title="${escapeHtml(game.i18n.localize("TENEBRE.RollPrivacy.Hint"))}">
            <input type="checkbox" class="tenebre-maneuver-private-roll">
            <span>${game.i18n.localize("TENEBRE.RollPrivacy.ShortLabel")}</span>
          </label>
          <button type="button" class="tenebre-maneuver-roll">
            <i class="fas fa-dice-d20"></i> ${game.i18n.localize("TENEBRE.Maneuvers.Roll")}
          </button>
        </div>
      </div>
    </div>
  `;
}

function updateManeuverInformation(panel, maneuverId) {
  const maneuver = ManeuverService.get(maneuverId);
  const button = panel?.querySelector(".tenebre-maneuver-info");
  const tooltip = button?.querySelector(".tenebre-maneuver-tooltip");
  if (!maneuver || !button || !tooltip) return;

  const label = game.i18n.localize(maneuver.labelKey);
  const notes = (maneuver.noteKeys ?? [])
    .map((key) => game.i18n.localize(key))
    .filter(Boolean);

  button.setAttribute("aria-label", game.i18n.format("TENEBRE.Maneuvers.DescriptionFor", { maneuver: label }));
  tooltip.innerHTML = `
    <strong>${escapeHtml(label)}</strong>
    ${notes.map((note) => `<span>${escapeHtml(note)}</span>`).join("")}
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
// Funções auxiliares

function getRoot(html) {
  if (!html) return null;
  if (html instanceof HTMLElement) return html;
  if (typeof jQuery !== "undefined" && html instanceof jQuery) return html[0] ?? null;
  if (html?.jquery && html?.[0] instanceof HTMLElement) return html[0];
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (html?.element instanceof HTMLElement) return html.element;
  return null;
}

function isPlayerActor(actor) {
  return actor?.type === "player";
}

function isManagedActor(actor) {
  return ["player", "monster"].includes(actor?.type);
}

// Hooks do diálogo de rolagem

function onRenderTemplate(path, data, html) {
  if (path && path.includes("systems/symbaroum/template/chat/dialog.hbs")) {
    if (isPlayerActor(game.tenebreResources?.activeWeaponRoll?.actor)) {
      game.tenebreResources.activeWeaponModifiers = data.weaponModifiers;
    }
  }
}

function onRenderDialog(dialog, html, data) {
  const el = getRoot(html);
  if (!el) return;

  const isSymbaroumDialog = el.matches?.(".symbaroum.dialog")
    || Boolean(el.querySelector?.(".symbaroum.dialog"));
  if (isSymbaroumDialog) {
    const dialogElement = getRoot(dialog?.element) ?? el.closest?.(".window-app, .application");
    dialogElement?.classList?.add("tenebre-symbaroum-roll-dialog");
  }

  const isWeaponRoll = Boolean(el.querySelector("input[id^='weapondamage-']"));
  if (isWeaponRoll) {
    // Altera atributo alvo para defesa por padrão
    const targetAttrSelect = el.querySelector("select[id^='targetAttribute-']");
    if (targetAttrSelect && targetAttrSelect.value === "custom") {
      const hasDefense = Array.from(targetAttrSelect.options).some(opt => opt.value === "defense");
      if (hasDefense) {
        targetAttrSelect.value = "defense";
      }
    }

    // Envolve callback de rolagem
    if (dialog.data?.buttons?.roll) {
      const originalCallback = dialog.data.buttons.roll.callback;
      if (originalCallback && !originalCallback._tenebreWrapped) {
        dialog.data.buttons.roll.callback = async function(htmlElement, event) {
          const htmlParam = (htmlElement && !(0 in htmlElement)) ? [htmlElement] : htmlElement;
          const activeRoll = dialog._tenebreWeaponRoll ?? game.tenebreResources?.activeWeaponRoll;
          let chosenAmmo = null;

          if (activeRoll && isPlayerActor(activeRoll.actor)) {
            try {
              chosenAmmo = prepareSelectedAmmoForRoll(el, activeRoll);
            } catch (err) {
              console.error("Tenebre Resources | Error preparing ammo modifiers:", err);
              ui.notifications.error(game.i18n.format("TENEBRE.Ammo.PrepareModifiersError", {
                error: err.message
              }));
            }

            if (!chosenAmmo) {
              ui.notifications.warn(getAmmoUnavailableMessage(activeRoll));
              throw "Cancelled";
            }
          }

          let result;
          try {
            result = await originalCallback.call(this, htmlParam, event);
          } catch (err) {
            console.error("Tenebre Resources | Error in original roll callback:", err);
            throw err;
          }

          if (activeRoll && isPlayerActor(activeRoll.actor) && chosenAmmo && !activeRoll.consumed) {
            activeRoll.consumed = true;
            activeRoll.shot = await AmmoService.consumeAmmo(activeRoll.actor, chosenAmmo, activeRoll.weapon, activeRoll.ammoType);
          }

          return result;
        };
        dialog.data.buttons.roll.callback._tenebreWrapped = true;
      }
    }
  }

  // Injeta seletor de munição para ataques à distância
  const activeRoll = game.tenebreResources?.activeWeaponRoll;
  if (!activeRoll) return;
  if (!isPlayerActor(activeRoll.actor)) return;
  dialog._tenebreWeaponRoll = activeRoll;

  const damModInput = el.querySelector("input[id^='dammodifier-']");
  if (!damModInput) return;

  const damModDiv = damModInput.closest(".damagemodifier");
  if (!damModDiv) return;

  if (el.querySelector("#tenebre-ammo-select")) return;

  const { actor, ammoType } = activeRoll;
  const useQuiverContainers = TenebreSettings.get("enableQuiverAmmoContainers");

  const selectDiv = document.createElement("div");
  selectDiv.className = "bonus";
  
  const label = document.createElement("label");
  label.setAttribute("for", "tenebre-ammo-select");
  label.innerText = game.i18n.localize("TENEBRE.Ammo.Ammo");

  const select = document.createElement("select");
  select.id = "tenebre-ammo-select";

  const options = useQuiverContainers
    ? getLoadedQuiverAmmoOptions(actor, ammoType)
    : getLooseAmmoOptions(actor, ammoType);

  if (!options.length) {
    const option = document.createElement("option");
    option.value = "";
    option.innerText = getAmmoUnavailableMessage(activeRoll);
    option.disabled = true;
    option.selected = true;
    select.appendChild(option);
  } else {
    for (const ammoOption of options) {
      const option = document.createElement("option");
      option.value = ammoOption.value;
      option.innerText = ammoOption.label;
      select.appendChild(option);
    }
  }

  selectDiv.appendChild(label);
  selectDiv.appendChild(select);

  damModDiv.after(selectDiv);
  updateSelectedAmmoForRoll(el, activeRoll);
  select.addEventListener("change", () => updateSelectedAmmoForRoll(el, activeRoll));

  el.style.overflow = "visible";
  el.style.height = "auto";
  const form = el.closest("form");
  if (form) {
    form.style.overflow = "visible";
    form.style.height = "auto";
  }
  const win = el.closest(".window-content");
  if (win) {
    win.style.overflow = "visible";
    win.style.height = "auto";
  }
  dialog.setPosition({ height: "auto" });
  attachAmmoRollButtonCapture(dialog, el, activeRoll);
}

function getDisplayedItemWeight(item) {
  return EncumbranceService.getItemStackSlots(item);
}

function attachAmmoRollButtonCapture(dialog, contentEl, activeRoll) {
  if (!dialog || dialog._tenebreAmmoRollCapturePatched) return;

  const dialogRoot = getRoot(dialog.element) ?? contentEl.closest(".app, .window-app") ?? contentEl;
  const rollButtons = dialogRoot.querySelectorAll(
    'button[data-button="roll"], .dialog-button[data-button="roll"], button.dialog-button'
  );

  for (const button of rollButtons) {
    const buttonKey = button.dataset?.button ?? "";
    const text = normalize(button.textContent || "");
    if (buttonKey !== "roll" && !text.includes("rolar") && !text.includes("roll")) continue;

    button.addEventListener("click", (event) => {
      try {
        prepareSelectedAmmoForRoll(contentEl, activeRoll);
        if (!activeRoll.chosenAmmo) {
          ui.notifications.warn(getAmmoUnavailableMessage(activeRoll));
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          return false;
        }
      } catch (err) {
        console.error("Tenebre Resources | Error capturing selected ammo:", err);
      }
    }, { capture: true });
    dialog._tenebreAmmoRollCapturePatched = true;
  }

  if (!dialog._tenebreAmmoRollCapturePatched && (dialog._tenebreAmmoRollCaptureAttempts ?? 0) < 5) {
    dialog._tenebreAmmoRollCaptureAttempts = (dialog._tenebreAmmoRollCaptureAttempts ?? 0) + 1;
    setTimeout(() => attachAmmoRollButtonCapture(dialog, contentEl, activeRoll), 0);
  }
}

function getLoadedQuiverAmmoOptions(actor, ammoType) {
  const options = [];
  for (const q of findLoadedQuiverItems(actor, ammoType)) {
    const loaded = getQuiverLoadedAmmo(q);
    for (const entry of loaded) {
      if (entry.quantity <= 0) continue;
      options.push({
        value: `quiver|${q.id}|${entry.name}`,
        label: `${q.name}: ${entry.name} (${entry.quantity}/${getQuiverCapacity()})`
      });
    }
  }
  return options;
}

function getLooseAmmoOptions(actor, ammoType) {
  return actorItems(actor)
    .filter((item) => isAmmo(item)
      && !isQuiver(item)
      && getAmmoType(item) === ammoType
      && itemQuantity(item) > 0)
    .map((item) => ({
      value: item.id,
      label: `${item.name} (${itemQuantity(item)})`
    }));
}

function getAmmoUnavailableMessage(activeRoll) {
  if (TenebreSettings.get("enableQuiverAmmoContainers")) {
    return game.i18n.localize("TENEBRE.Hud.NoEquippedQuiver");
  }

  return game.i18n.format("TENEBRE.Ammo.NoLooseAmmo", {
    type: localizeAmmoType(activeRoll?.ammoType)
  });
}

function prepareSelectedAmmoForRoll(el, activeRoll) {
  if (!activeRoll) return null;

  const chosenAmmo = getSelectedAmmoFromDialog(el, activeRoll);
  if (!chosenAmmo) return null;

  activeRoll.chosenAmmo = chosenAmmo;
  applyAmmoModifiers(chosenAmmo);
  return chosenAmmo;
}

function updateSelectedAmmoForRoll(el, activeRoll) {
  if (!activeRoll) return null;
  const chosenAmmo = getSelectedAmmoFromDialog(el, activeRoll);
  if (chosenAmmo) activeRoll.chosenAmmo = chosenAmmo;
  return chosenAmmo;
}

function getSelectedAmmoFromDialog(el, activeRoll) {
  const selectedValue = el.querySelector("#tenebre-ammo-select")?.value;
  if (!selectedValue) return null;

  if (selectedValue.startsWith("quiver|")) {
    const [, quiverId, entryName] = selectedValue.split("|");
    const quiver = activeRoll.actor.items.get(quiverId);
    if (!quiver) return null;

    const loaded = getQuiverLoadedAmmo(quiver);
    const entry = loaded.find(e => e.name === entryName || e.id === entryName);
    if (!entry) return null;

    const originalItem = activeRoll.actor.items.find(i => i.name === entry.name && isAmmo(i) && !isQuiver(i));
    return {
      isVirtual: true,
      id: entry.id || (originalItem ? originalItem.id : entryName),
      recoveryKey: originalItem?.id ?? entry.id ?? entryName,
      recoveryItemId: originalItem?.id ?? entry.id ?? entryName,
      recoveryName: entry.name,
      name: entry.name,
      img: entry.img || "icons/weapons/ammunition/arrows-bodkin-yellow-red.webp",
      sourceUuid: entry.sourceUuid || documentSourceUuid(originalItem) || originalItem?.uuid || "",
      itemUuid: entry.sourceUuid || originalItem?.uuid || "",
      description: entry.description || originalItem?.system?.description || "",
      recoveryClass: entry.recoveryClass,
      recoveryThreshold: entry.recoveryThreshold,
      quiverId: quiver.id,
      loadedEntryId: entry.id || entryName,
      type: "equipment",
      system: originalItem
        ? foundry.utils.deepClone(originalItem.system)
        : { description: entry.description || "" },
      getFlag: (scope, key) => {
        if (originalItem) return originalItem.getFlag(scope, key);
        return undefined;
      }
    };
  }

  return activeRoll.actor.items.get(selectedValue) ?? null;
}

function applyAmmoModifiers(chosenAmmo) {
  const ammoMods = getAmmoModifiers(chosenAmmo);
  const weaponModifiers = game.tenebreResources.activeWeaponModifiers;
  if (!weaponModifiers || ammoMods.length <= 0) return;

  if (!weaponModifiers.package) {
    weaponModifiers.package = [{
      label: "Default",
      type: "default",
      member: []
    }];
  }

  let defaultPackage = weaponModifiers.package.find(
    p => p.type === "default" || p.type === game.symbaroum.config.PACK_DEFAULT
  );
  if (!defaultPackage) {
    defaultPackage = {
      label: "Default",
      type: "default",
      member: []
    };
    weaponModifiers.package.push(defaultPackage);
  }

  for (const mod of ammoMods) {
    if (!defaultPackage.member.some(m => m.id === mod.id && m.type === mod.type)) {
      defaultPackage.member.push(mod);
    }
  }
}

function onCloseDialog(dialog, html) {
  if (game.tenebreResources?.activeWeaponRoll) {
    setTimeout(() => {
      clearActiveWeaponRoll(dialog._tenebreWeaponRoll);
    }, 100);
  }
}

function clearActiveWeaponRoll(activeRoll) {
  if (!game.tenebreResources) return;
  if (!activeRoll || game.tenebreResources.activeWeaponRoll === activeRoll) {
    game.tenebreResources.activeWeaponRoll = null;
    game.tenebreResources.activeWeaponModifiers = null;
  }
}
