import { AmmoService } from "./ammo.mjs";
import { actorItems, getQuiverCapacity, getQuiverLoadedTotal, getWeaponAmmoType, isActiveOrEquipped, isQuiver, itemQuantity } from "./item-flags.mjs";
import { TenebreSettings } from "./settings.mjs";

const BREAD_BTN_ID = "tenebre-bread-btn";
const LEFT_HUD_ID = "tenebre-ammo-hud-left";
const RIGHT_HUD_ID = "tenebre-ammo-hud-right";

export class HotbarService {
  static #registered = false;
  static #refreshTimer = null;

  static register() {
    if (this.#registered) return;
    this.#registered = true;

    Hooks.on("renderHotbar", () => this.refreshSoon());
    Hooks.on("renderChatLog", () => this.refreshSoon());
    Hooks.on("createItem", () => this.refreshSoon());
    Hooks.on("updateItem", (i, changes) => { if (shouldRefreshHud(changes)) this.refreshSoon(); });
    Hooks.on("deleteItem", () => this.refreshSoon());
    Hooks.on("updateActor", (a, changes) => { if (shouldRefreshHud(changes)) this.refreshSoon(); });
    Hooks.on("controlToken", () => this.refreshSoon());
    Hooks.on("canvasReady", () => this.refreshSoon());
    window.addEventListener("resize", () => this.refreshSoon());

    this.refreshSoon();
  }

  static refreshSoon() {
    window.clearTimeout(this.#refreshTimer);
    this.#refreshTimer = window.setTimeout(() => this.refresh(), 50);
  }

  static refresh() {
    document.getElementById(BREAD_BTN_ID)?.remove();

    const actor = getHudActor();
    if (!actor) {
      removeHud();
      return;
    }

    const left = getOrCreateHud(LEFT_HUD_ID, "tenebre-ammo-hud tenebre-ammo-hud-left");
    const right = getOrCreateHud(RIGHT_HUD_ID, "tenebre-ammo-hud tenebre-ammo-hud-right");

    renderRecoveryHud(left, actor);
    renderQuiverHud(right, actor);
    positionHud(left, right);
  }
}

function renderRecoveryHud(panel, actor) {
  if (!TenebreSettings.get("enableAmmoRecovery") || !TenebreSettings.get("enableHitTracking") || !TenebreSettings.get("showAmmoRecoveryHud")) {
    panel.dataset.empty = "true";
    panel.innerHTML = "";
    panel.hidden = true;
    return;
  }

  const count = actor ? Math.max(0, Number(AmmoService.getTrackedHits(actor).ammoHit ?? 0) || 0) : 0;
  const visible = count > 0;

  panel.dataset.empty = visible ? "false" : "true";
  panel.innerHTML = "";
  panel.hidden = !visible;
  if (!visible) {
    return;
  }

  const item = document.createElement("div");
  item.className = "tenebre-ammo-hud-item tenebre-ammo-hud-recover";
  item.setAttribute("role", "button");
  item.setAttribute("tabindex", "0");
  item.title = game.i18n.format("TENEBRE.Hud.RecoverableTooltip", { count });

  const icon = document.createElement("i");
  icon.className = "fas fa-arrows-rotate";
  item.appendChild(icon);

  const value = document.createElement("strong");
  value.textContent = String(count);
  item.appendChild(value);

  item.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await AmmoService.recover(actor);
    HotbarService.refreshSoon();
  });

  item.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    item.click();
  });

  panel.appendChild(item);
}

function renderQuiverHud(panel, actor) {
  panel.innerHTML = "";
  if (!TenebreSettings.get("enableAmmoConsumption")
    || !TenebreSettings.get("enableQuiverAmmoContainers")
    || !TenebreSettings.get("showQuiverHud")) {
    panel.dataset.empty = "true";
    panel.hidden = true;
    return;
  }

  const hasRangedWeapon = actorItems(actor).some((item) => item?.type === "weapon" && Boolean(getWeaponAmmoType(item)));
  const quivers = actorItems(actor).filter((item) => {
    return isQuiver(item)
      && itemQuantity(item) > 0
      && isActiveOrEquipped(item);
  }).map((item) => ({
    name: item.name,
    loaded: getQuiverLoadedTotal(item),
    img: item.img || "icons/weapons/ammunition/arrows-bodkin-yellow-red.webp"
  }));

  const visible = hasRangedWeapon && quivers.length > 0;
  panel.dataset.empty = visible ? "false" : "true";
  panel.hidden = !visible;

  if (!visible) return;

  for (const quiver of quivers) {
    const loaded = quiver.loaded;
    const capacity = getQuiverCapacity();
    const item = document.createElement("div");
    item.className = "tenebre-ammo-hud-item tenebre-ammo-hud-quiver";
    item.title = game.i18n.format("TENEBRE.Hud.QuiverTooltip", {
      name: quiver.name,
      loaded,
      capacity
    });

    const img = document.createElement("img");
    img.src = quiver.img;
    img.alt = "";
    item.appendChild(img);

    const value = document.createElement("strong");
    value.textContent = `${loaded}/${capacity}`;
    item.appendChild(value);

    panel.appendChild(item);
  }
}

function getHudActor() {
  const controlledActor = globalThis.canvas?.tokens?.controlled
    ?.map((token) => token.actor)
    ?.find((actor) => actor?.type === "player" && (actor.isOwner || game.user.isGM));
  if (controlledActor) return controlledActor;

  const character = game.user?.character;
  if (character?.type === "player" && (character.isOwner || game.user.isGM)) return character;

  return null;
}

function getOrCreateHud(id, className) {
  let element = document.getElementById(id);
  if (!element) {
    element = document.createElement("section");
    element.id = id;
    element.className = className;
    document.body.appendChild(element);
  }
  return element;
}

function removeHud() {
  document.getElementById(LEFT_HUD_ID)?.remove();
  document.getElementById(RIGHT_HUD_ID)?.remove();
}

function positionHud(left, right) {
  const bottom = 12;
  const playersRect = getPlayersBoundaryRect();
  const hotbarRect = document.getElementById("hotbar")?.getBoundingClientRect();
  const recoveryWidth = left.dataset.empty === "true" ? 0 : 56;
  const recoveryGap = recoveryWidth > 0 ? 6 : 0;
  let anchorLeft = 212;
  let availableRight = hotbarRect?.left ?? Math.min(window.innerWidth - 24, 620);

  if (playersRect && hotbarRect) {
    const playersRight = Math.max(playersRect.right, 212);
    anchorLeft = playersRight + 8;
    availableRight = hotbarRect.left;
  } else if (playersRect) {
    anchorLeft = Math.max(playersRect.right, 212) + 8;
  }

  applyHudPosition(left, anchorLeft, 56, bottom, { hideWhenEmpty: true, minVisibleWidth: 40 });

  const quiverLeft = anchorLeft + recoveryWidth + recoveryGap;
  const quiverWidth = availableRight - quiverLeft - 8;
  applyHudPosition(right, quiverLeft, quiverWidth, bottom);
}

function applyHudPosition(element, left, width, bottom, { hideWhenEmpty = false, minVisibleWidth = 70 } = {}) {
  if (hideWhenEmpty && element.dataset.empty === "true") {
    element.hidden = true;
    return;
  }

  const safeWidth = Math.floor(Math.max(0, width));
  element.style.left = `${Math.floor(left)}px`;
  element.style.width = `${safeWidth}px`;
  element.style.bottom = `${bottom}px`;
  element.hidden = safeWidth < minVisibleWidth;
}

function getPlayersBoundaryRect() {
  const players = document.getElementById("players");
  if (!players) return null;

  let boundary = null;
  const includeElement = (element) => {
    const rect = element.getBoundingClientRect?.();
    if (
      !rect
      || rect.width <= 0
      || rect.height <= 0
      || rect.left >= window.innerWidth * 0.45
      || rect.top <= window.innerHeight - 180
    ) {
      return;
    }

    if (!boundary) {
      boundary = {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: 0,
        height: 0
      };
      return;
    }

    boundary.left = Math.min(boundary.left, rect.left);
    boundary.right = Math.max(boundary.right, rect.right);
    boundary.top = Math.min(boundary.top, rect.top);
    boundary.bottom = Math.max(boundary.bottom, rect.bottom);
  };

  includeElement(players);
  for (const element of players.querySelectorAll("*")) {
    includeElement(element);
  }

  return boundary ?? players.getBoundingClientRect();
}

function shouldRefreshHud(changes) {
  if (!changes) return true;
  const keys = Object.keys(changes);
  if (keys.length === 0) return false;
  if (keys.every(k => ["ownership", "folder", "sort", "x", "y", "elevation", "rotation", "_id"].includes(k))) return false;
  return true;
}
