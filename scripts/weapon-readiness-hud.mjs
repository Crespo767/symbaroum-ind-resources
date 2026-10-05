import { MODULE_ID } from "./constants.mjs";
import { TenebreSettings } from "./settings.mjs";
import { WEAPON_READINESS_ICON, WeaponReadinessService } from "./weapon-readiness.mjs";

const BUTTON_ID = "tenebre-weapon-readiness-floating";
const QUICK_MENU_ID = "tenebre-weapon-readiness-quick-menu";
const POSITION_SETTING = "weaponReadinessButtonPosition";
const BUTTON_SIZE = 42;
const VIEWPORT_MARGIN = 4;
const DRAG_THRESHOLD = 2;
const POSITION_VERSION = 2;

export class WeaponReadinessHudService {
  static #registered = false;
  static #refreshTimer = null;

  static register() {
    if (this.#registered) return;
    this.#registered = true;

    Hooks.on("renderHotbar", () => this.refreshSoon());
    Hooks.on("createItem", () => this.refreshSoon());
    Hooks.on("updateItem", (i, changes) => { if (shouldRefreshHud(changes)) this.refreshSoon(); });
    Hooks.on("deleteItem", () => this.refreshSoon());
    Hooks.on("updateActor", (a, changes) => { if (shouldRefreshHud(changes)) this.refreshSoon(); });
    Hooks.on("controlToken", () => this.refreshSoon());
    Hooks.on("canvasReady", () => this.refreshSoon());
    Hooks.on(`${MODULE_ID}.settingsChanged`, () => this.refreshSoon());
    Hooks.on(`${MODULE_ID}.weaponReadinessChanged`, () => this.refreshSoon());
    window.addEventListener("resize", () => {
      closeQuickSwapMenu();
      this.refreshSoon();
    });

    this.refreshSoon();
  }

  static refreshSoon() {
    window.clearTimeout(this.#refreshTimer);
    this.#refreshTimer = window.setTimeout(() => this.refresh(), 50);
  }

  static refresh() {
    const actor = getHudActor();
    const weapons = actor ? WeaponReadinessService.getEligibleWeapons(actor) : [];
    const enabled = WeaponReadinessService.isEnabled()
      && TenebreSettings.get("showWeaponReadinessButton");

    if (!enabled || !actor || weapons.length === 0) {
      document.getElementById(BUTTON_ID)?.remove();
      closeQuickSwapMenu();
      return;
    }

    const button = getOrCreateButton();
    const drawn = weapons.filter(WeaponReadinessService.isDrawn).length;
    const label = game.i18n.format("TENEBRE.WeaponReadiness.FloatingButtonHint", {
      actor: actor.name,
      drawn,
      total: weapons.length
    });

    button.title = label;
    button.setAttribute("aria-label", label);
    button.dataset.actorUuid = actor.uuid;
    button.dataset.drawn = drawn > 0 ? "true" : "false";
    button.querySelector(".tenebre-weapon-readiness-floating-count").textContent = `${drawn}/${weapons.length}`;
    if (!button.classList.contains("is-dragging")) applyStoredPosition(button);
  }
}

export function clampWeaponReadinessButtonPosition(position, viewport, size = BUTTON_SIZE) {
  const maxLeft = Math.max(VIEWPORT_MARGIN, Number(viewport?.width ?? 0) - size - VIEWPORT_MARGIN);
  const maxTop = Math.max(VIEWPORT_MARGIN, Number(viewport?.height ?? 0) - size - VIEWPORT_MARGIN);
  return {
    left: Math.min(maxLeft, Math.max(VIEWPORT_MARGIN, Number(position?.left) || VIEWPORT_MARGIN)),
    top: Math.min(maxTop, Math.max(VIEWPORT_MARGIN, Number(position?.top) || VIEWPORT_MARGIN))
  };
}

function getHudActor() {
  const controlledActor = globalThis.canvas?.tokens?.controlled
    ?.map((token) => token.actor)
    ?.find((actor) => actor?.type === "player" && (actor.isOwner || game.user?.isGM));
  if (controlledActor) return controlledActor;

  const character = game.user?.character;
  if (character?.type === "player" && (character.isOwner || game.user?.isGM)) return character;
  return null;
}

function getOrCreateButton() {
  let button = document.getElementById(BUTTON_ID);
  if (button) return button;

  button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.className = "tenebre-weapon-readiness-floating";
  button.innerHTML = `
    <img src="${WEAPON_READINESS_ICON}" alt="" aria-hidden="true">
    <span class="tenebre-weapon-readiness-floating-count" aria-hidden="true">0/0</span>
  `;
  registerPointerControls(button);
  button.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    void openForCurrentActor();
  });
  button.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void openQuickSwapMenu(button);
  });
  document.body.appendChild(button);
  return button;
}

function registerPointerControls(button) {
  let drag = null;

  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    closeQuickSwapMenu();
    const rect = button.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      moved: false
    };
    button.setPointerCapture?.(event.pointerId);
    button.classList.add("is-dragging");
    event.preventDefault();
  });

  button.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;

    drag.moved = true;
    const position = clampWeaponReadinessButtonPosition({
      left: drag.startLeft + deltaX,
      top: drag.startTop + deltaY
    }, { width: window.innerWidth, height: window.innerHeight });
    button.style.transform = `translate3d(${Math.round(position.left - drag.startLeft)}px, ${Math.round(position.top - drag.startTop)}px, 0)`;
  });

  button.addEventListener("pointerup", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const moved = drag.moved;
    drag = null;
    button.classList.remove("is-dragging");
    button.releasePointerCapture?.(event.pointerId);
    if (moved) {
      const rect = button.getBoundingClientRect();
      button.style.transform = "";
      setButtonPosition(button, rect);
      void game.settings.set(MODULE_ID, POSITION_SETTING, {
        version: POSITION_VERSION,
        left: rect.left,
        top: rect.top
      })
        .catch((error) => console.warn(`${MODULE_ID} | Could not save the weapon button position.`, error));
    } else {
      void openForCurrentActor();
    }
  });

  button.addEventListener("pointercancel", () => {
    drag = null;
    button.style.transform = "";
    button.classList.remove("is-dragging");
  });
}

async function openForCurrentActor() {
  const actor = getHudActor();
  if (!actor) return;
  await WeaponReadinessService.open(actor);
  WeaponReadinessHudService.refreshSoon();
}

async function openQuickSwapMenu(button) {
  const actor = getHudActor();
  if (!actor) return;
  const weapons = WeaponReadinessService.getEligibleWeapons(actor);
  if (weapons.length === 0) return;

  closeQuickSwapMenu();
  const menu = document.createElement("section");
  menu.id = QUICK_MENU_ID;
  menu.className = "tenebre-weapon-readiness-quick-menu";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", game.i18n.localize("TENEBRE.WeaponReadiness.QuickSwap"));

  const title = document.createElement("header");
  title.textContent = game.i18n.localize("TENEBRE.WeaponReadiness.QuickSwap");
  menu.appendChild(title);

  for (const weapon of weapons) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "tenebre-weapon-readiness-quick-option";
    option.dataset.drawn = WeaponReadinessService.isDrawn(weapon) ? "true" : "false";
    option.setAttribute("role", "menuitem");
    option.title = game.i18n.format("TENEBRE.WeaponReadiness.QuickSwapHint", { weapon: weapon.name });

    const image = document.createElement("img");
    image.src = weapon.img;
    image.alt = "";
    const name = document.createElement("span");
    name.textContent = weapon.name;
    option.append(image, name);
    option.addEventListener("click", async () => {
      const drawnIds = WeaponReadinessService.getDrawnWeapons(actor).map((item) => item.id);
      if (drawnIds.length === 1 && drawnIds[0] === weapon.id) {
        closeQuickSwapMenu();
        return;
      }
      option.disabled = true;
      const changed = await WeaponReadinessService.setDrawnWeapons(actor, [weapon.id]);
      if (changed !== false) closeQuickSwapMenu();
      else option.disabled = false;
      WeaponReadinessHudService.refreshSoon();
    });
    menu.appendChild(option);
  }

  const sheatheAll = document.createElement("button");
  sheatheAll.type = "button";
  sheatheAll.className = "tenebre-weapon-readiness-quick-sheathe";
  sheatheAll.setAttribute("role", "menuitem");
  sheatheAll.textContent = game.i18n.localize("TENEBRE.WeaponReadiness.SheatheAll");
  sheatheAll.addEventListener("click", async () => {
    if (WeaponReadinessService.getDrawnWeapons(actor).length === 0) {
      closeQuickSwapMenu();
      return;
    }
    sheatheAll.disabled = true;
    const changed = await WeaponReadinessService.setDrawnWeapons(actor, []);
    if (changed !== false) closeQuickSwapMenu();
    else sheatheAll.disabled = false;
    WeaponReadinessHudService.refreshSoon();
  });
  menu.appendChild(sheatheAll);

  document.body.appendChild(menu);
  positionQuickSwapMenu(menu, button);
  menu.querySelector("button")?.focus();
  window.setTimeout(() => {
    if (!menu.isConnected) return;
    document.addEventListener("pointerdown", closeQuickSwapMenuOnOutsidePointer, true);
    document.addEventListener("keydown", closeQuickSwapMenuOnEscape, true);
  }, 0);
}

function positionQuickSwapMenu(menu, button) {
  const anchor = button.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const fitsRight = anchor.right + menuRect.width + VIEWPORT_MARGIN <= window.innerWidth;
  const left = fitsRight
    ? anchor.right + VIEWPORT_MARGIN
    : anchor.left - menuRect.width - VIEWPORT_MARGIN;
  const top = Math.min(
    window.innerHeight - menuRect.height - VIEWPORT_MARGIN,
    Math.max(VIEWPORT_MARGIN, anchor.top)
  );
  menu.style.left = `${Math.max(VIEWPORT_MARGIN, Math.round(left))}px`;
  menu.style.top = `${Math.max(VIEWPORT_MARGIN, Math.round(top))}px`;
}

function closeQuickSwapMenu() {
  document.getElementById(QUICK_MENU_ID)?.remove();
  document.removeEventListener("pointerdown", closeQuickSwapMenuOnOutsidePointer, true);
  document.removeEventListener("keydown", closeQuickSwapMenuOnEscape, true);
}

function closeQuickSwapMenuOnOutsidePointer(event) {
  if (event.target?.closest?.(`#${QUICK_MENU_ID}, #${BUTTON_ID}`)) return;
  closeQuickSwapMenu();
}

function closeQuickSwapMenuOnEscape(event) {
  if (event.key === "Escape") closeQuickSwapMenu();
}

function applyStoredPosition(button) {
  const stored = TenebreSettings.get(POSITION_SETTING);
  const position = hasStoredPosition(stored) ? stored : getInitialPosition();
  setButtonPosition(button, clampWeaponReadinessButtonPosition(position, {
    width: window.innerWidth,
    height: window.innerHeight
  }));
}

function hasStoredPosition(position) {
  return Number(position?.version) === POSITION_VERSION
    && Number.isFinite(Number(position?.left))
    && Number.isFinite(Number(position?.top));
}

function getInitialPosition() {
  const sidebarButtons = Array.from(document.querySelectorAll("#sidebar-tabs button, #sidebar-tabs [data-tab]"))
    .filter((element) => {
      const rect = element.getBoundingClientRect?.();
      return rect && rect.width > 0 && rect.height > 0;
    });
  const lastButton = sidebarButtons.sort((left, right) => (
    right.getBoundingClientRect().bottom - left.getBoundingClientRect().bottom
  ))[0];
  const rect = lastButton?.getBoundingClientRect?.();
  if (rect) return { left: rect.left + ((rect.width - BUTTON_SIZE) / 2), top: rect.bottom + 5 };
  return { left: window.innerWidth - BUTTON_SIZE - 8, top: window.innerHeight - BUTTON_SIZE - 8 };
}

function setButtonPosition(button, { left, top }) {
  button.style.left = `${Math.round(left)}px`;
  button.style.top = `${Math.round(top)}px`;
}

function shouldRefreshHud(changes) {
  if (!changes) return true;
  const keys = Object.keys(changes);
  if (keys.length === 0) return false;
  if (keys.every(k => ["ownership", "folder", "sort", "x", "y", "elevation", "rotation", "_id"].includes(k))) return false;
  return true;
}
