import { MODULE_ID } from "./constants.mjs";
import { GM_LOG_EVENT_CATEGORIES, gmLogEventPresentation } from "./gm-log-events.mjs";
import { GmLogService, isGmLogEnabled } from "./gm-log-service.mjs";

const TEMPLATE_PATH = `modules/${MODULE_ID}/templates/gm-log.hbs`;
const CHAT_ROOT_ID = "chat";
const NAVIGATION_ID = "tenebre-gm-log-pages";
const LOG_PAGE_ID = "tenebre-gm-log-page";
const CHAT_PAGE = "chat";
const GM_LOG_PAGE = "gm-log";
const ACTIVE_PAGE_CLASS = "tenebre-gm-log-page-active";
const NATIVE_PAGE_CLASS = "tenebre-gm-log-native-page";
const UPDATE_HOOK = `${MODULE_ID}.gmLogUpdated`;
const ENABLE_SETTING = "enableGmLog";
const ALL_CATEGORIES = "all";
const VALID_CATEGORIES = new Set(Object.values(GM_LOG_EVENT_CATEGORIES));

export function filterGmLogEvents(events = [], category = ALL_CATEGORIES) {
  const normalizedCategory = VALID_CATEGORIES.has(category) ? category : ALL_CATEGORIES;
  const source = Array.isArray(events) ? events : [];
  return normalizedCategory === ALL_CATEGORIES
    ? source.slice()
    : source.filter((event) => event?.category === normalizedCategory);
}

export function formatGmLogEvent(event, { localize, formatTime } = {}) {
  const presentation = gmLogEventPresentation(event);
  if (!presentation || typeof localize !== "function") return null;
  return Object.freeze({
    id: event.eventId || event.source?.messageId || "",
    category: event.category,
    outcome: event.outcome,
    time: typeof formatTime === "function" ? String(formatTime(event.occurredAt) ?? "") : "",
    text: String(localize(presentation.key, presentation.data) ?? "")
  });
}

/** Keep transport messages out of the native chat while retaining their GM log event. */
export function hideGmLogOnlyMessage(message, element) {
  if (message?.flags?.[MODULE_ID]?.gmLogOnly !== true) return false;
  const root = element?.[0] ?? element;
  if (!root || typeof root !== "object") return false;

  root.hidden = true;
  root.classList?.add?.("tenebre-gm-log-only-message");
  root.setAttribute?.("aria-hidden", "true");
  root.style?.setProperty?.("display", "none", "important");
  return true;
}

export class GmLogUiService {
  static #registered = false;
  static #page = CHAT_PAGE;
  static #category = ALL_CATEGORIES;
  static #dirty = true;
  static #renderVersion = 0;

  static register() {
    if (this.#registered || !game.user?.isGM) return;
    this.#registered = true;

    Hooks.on("renderChatLog", (application, element) => {
      if (application?.isPopout) return;
      this.#mount(resolveChatRoot(element));
    });
    Hooks.on("renderChatMessageHTML", (message, element) => {
      hideGmLogOnlyMessage(message, element);
    });
    Hooks.on(UPDATE_HOOK, () => {
      this.#dirty = true;
      if (isGmLogEnabled() && this.#page === GM_LOG_PAGE) void this.#renderLogPage();
    });
    Hooks.on(`${MODULE_ID}.settingsChanged`, (key, value) => {
      if (key === ENABLE_SETTING) this.syncEnabledState(Boolean(value));
    });

    this.syncEnabledState(isGmLogEnabled());
  }

  static syncEnabledState(enabled = isGmLogEnabled()) {
    if (!game.user?.isGM) return;
    if (enabled) {
      this.#mount(document.getElementById(CHAT_ROOT_ID));
      return;
    }
    this.#unmount();
  }

  static #mount(root) {
    if (!game.user?.isGM || !isGmLogEnabled() || !(root instanceof HTMLElement)) return;

    let navigation = document.getElementById(NAVIGATION_ID);
    if (!(navigation instanceof HTMLElement)) navigation = this.#createNavigation();
    if (navigation.parentElement !== root) root.prepend(navigation);

    let logPage = document.getElementById(LOG_PAGE_ID);
    if (!(logPage instanceof HTMLElement)) {
      logPage = document.createElement("section");
      logPage.id = LOG_PAGE_ID;
      logPage.className = "tenebre-gm-log-page";
      logPage.setAttribute("role", "tabpanel");
      logPage.setAttribute("aria-labelledby", "tenebre-gm-log-page-tab");
    }
    if (logPage.parentElement !== root) root.append(logPage);

    for (const child of root.children) {
      if (child !== navigation && child !== logPage) child.classList.add(NATIVE_PAGE_CLASS);
    }

    root.classList.add("tenebre-gm-log-chat");
    this.#applyPageState(root);
    if (this.#page === GM_LOG_PAGE) void this.#renderLogPage();
  }

  static #createNavigation() {
    const navigation = document.createElement("nav");
    navigation.id = NAVIGATION_ID;
    navigation.className = "tenebre-gm-log-pages";
    navigation.setAttribute("role", "tablist");
    navigation.setAttribute("aria-label", localize("TENEBRE.GmLog.Ui.Pages"));
    navigation.append(
      this.#createPageButton(CHAT_PAGE, "tenebre-gm-log-chat-tab", "TENEBRE.GmLog.Ui.ChatPage", "fa-solid fa-comments"),
      this.#createPageButton(GM_LOG_PAGE, "tenebre-gm-log-page-tab", "TENEBRE.GmLog.Ui.LogPage", "fa-solid fa-list-ul")
    );
    return navigation;
  }

  static #createPageButton(page, id, labelKey, iconClass) {
    const button = document.createElement("button");
    button.id = id;
    button.type = "button";
    button.className = "tenebre-gm-log-page-button";
    button.dataset.tenebreGmLogPage = page;
    button.setAttribute("role", "tab");
    button.append(createIcon(iconClass), document.createTextNode(localize(labelKey)));
    button.addEventListener("click", (event) => {
      const root = button.closest(`#${CHAT_ROOT_ID}`);
      if (!(root instanceof HTMLElement)) return;
      event.preventDefault();
      event.stopPropagation();
      this.#showPage(page, root);
    });
    return button;
  }

  static #showPage(page, root) {
    if (page !== CHAT_PAGE && page !== GM_LOG_PAGE) return;
    this.#page = page;
    if (!(root instanceof HTMLElement)) return;
    this.#applyPageState(root);
    if (page === GM_LOG_PAGE) void this.#renderLogPage();
  }

  static #applyPageState(root) {
    const logOpen = this.#page === GM_LOG_PAGE;
    root.classList.toggle(ACTIVE_PAGE_CLASS, logOpen);
    const logPage = root.querySelector(`:scope > #${LOG_PAGE_ID}`);
    if (logPage instanceof HTMLElement) logPage.hidden = !logOpen;

    for (const button of root.querySelectorAll(`#${NAVIGATION_ID} [data-tenebre-gm-log-page]`)) {
      const active = button.dataset.tenebreGmLogPage === this.#page;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    }
  }

  static async #renderLogPage() {
    const panel = document.getElementById(LOG_PAGE_ID);
    if (!(panel instanceof HTMLElement) || this.#page !== GM_LOG_PAGE) return;
    if (!this.#dirty && panel.querySelector(".tenebre-gm-log-shell")) return;
    const renderTemplate = globalThis.foundry?.applications?.handlebars?.renderTemplate;
    if (typeof renderTemplate !== "function") return;

    const renderVersion = ++this.#renderVersion;
    panel.setAttribute("aria-busy", "true");
    const events = filterGmLogEvents(GmLogService.events, this.#category)
      .map((event) => formatGmLogEvent(event, {
        localize: (key, data) => game.i18n.format(key, data),
        formatTime
      }))
      .filter(Boolean);
    const context = {
      events,
      hasEvents: events.length > 0,
      categories: categoryOptions().map(([value, key]) => ({
        value,
        label: localize(key),
        selected: value === this.#category
      }))
    };

    try {
      const content = await renderTemplate(TEMPLATE_PATH, context);
      if (renderVersion !== this.#renderVersion || !panel.isConnected) return;
      panel.innerHTML = content;
      this.#bindLogControls(panel);
      panel.querySelector(".tenebre-gm-log-list")?.scrollTo?.({ top: Number.MAX_SAFE_INTEGER });
      this.#dirty = false;
    } catch (error) {
      console.warn(`${MODULE_ID} | Failed to render the embedded GM log page.`, error);
    } finally {
      if (renderVersion === this.#renderVersion) panel.removeAttribute("aria-busy");
    }
  }

  static #bindLogControls(panel) {
    panel.querySelector(".tenebre-gm-log-filter")?.addEventListener("change", (event) => {
      const value = event.currentTarget?.value;
      this.#category = VALID_CATEGORIES.has(value) ? value : ALL_CATEGORIES;
      this.#dirty = true;
      void this.#renderLogPage();
    });
    panel.querySelector("[data-action='clear-log']")?.addEventListener("click", (event) => {
      event.preventDefault();
      GmLogService.clear();
    });
  }

  static #unmount() {
    this.#page = CHAT_PAGE;
    this.#category = ALL_CATEGORIES;
    this.#dirty = true;
    this.#renderVersion += 1;
    document.getElementById(NAVIGATION_ID)?.remove();
    document.getElementById(LOG_PAGE_ID)?.remove();
    const root = document.getElementById(CHAT_ROOT_ID);
    root?.classList.remove("tenebre-gm-log-chat", ACTIVE_PAGE_CLASS);
    for (const child of root?.querySelectorAll?.(`:scope > .${NATIVE_PAGE_CLASS}`) ?? []) {
      child.classList.remove(NATIVE_PAGE_CLASS);
    }
  }
}

function createIcon(className) {
  const icon = document.createElement("i");
  icon.className = className;
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function categoryOptions() {
  return [
    [ALL_CATEGORIES, "TENEBRE.GmLog.Ui.Category.All"],
    [GM_LOG_EVENT_CATEGORIES.COMBAT, "TENEBRE.GmLog.Ui.Category.Combat"],
    [GM_LOG_EVENT_CATEGORIES.ROLLS, "TENEBRE.GmLog.Ui.Category.Rolls"],
    [GM_LOG_EVENT_CATEGORIES.RESOURCES, "TENEBRE.GmLog.Ui.Category.Resources"],
    [GM_LOG_EVENT_CATEGORIES.STATUS, "TENEBRE.GmLog.Ui.Category.Status"],
    [GM_LOG_EVENT_CATEGORIES.INVENTORY, "TENEBRE.GmLog.Ui.Category.Inventory"],
    [GM_LOG_EVENT_CATEGORIES.SYSTEM, "TENEBRE.GmLog.Ui.Category.System"]
  ];
}

function resolveChatRoot(element) {
  const candidate = element instanceof HTMLElement
    ? element
    : element?.[0] instanceof HTMLElement
      ? element[0]
      : null;
  if (candidate?.id === CHAT_ROOT_ID) return candidate;
  return candidate?.closest?.(`#${CHAT_ROOT_ID}`)
    ?? candidate?.querySelector?.(`#${CHAT_ROOT_ID}`)
    ?? document.getElementById(CHAT_ROOT_ID);
}

function formatTime(timestamp) {
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return "--:--";
  try {
    return new Intl.DateTimeFormat(game.i18n.lang || undefined, {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return "--:--";
  }
}

function localize(key) {
  return game.i18n.localize(key);
}
