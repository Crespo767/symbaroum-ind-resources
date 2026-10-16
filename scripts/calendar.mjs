import { MODULE_ID } from "./constants.mjs";
import { SocketService } from "./sockets.mjs";
import { escapeHtml } from "./utils.mjs";
import {
  CALENDAR_DAY_SECONDS, validateCalendarDate,
  advanceCalendarDate, calendarDayNumber, createCalendarAnchor, calendarDateAtTime, shiftCalendarMonth, calendarClock
} from "./calendar-date.mjs";
import { formatCalendarDate, buildCalendarAlmanac, buildCalendarPage, updateCalendarClock } from "./calendar-view.mjs";

const ApplicationBase = globalThis.foundry?.applications?.api?.ApplicationV2 ?? class {};

const PANEL_ID = "tenebre-calendar";
const HANDLER = "changeCalendarDate";
let pendingChange = Promise.resolve();

const label = (key) => game.i18n.localize(`TENEBRE.Calendar.${key}`);

export class CalendarService {
  static #registered = false;
  static #application = null;

  static register() {
    if (this.#registered) return;
    this.#registered = true;
    game.settings.register(MODULE_ID, "enableCalendar", {
      name: "TENEBRE.Calendar.Enable", hint: "TENEBRE.Calendar.EnableHint",
      scope: "world", config: true, type: Boolean, default: true,
      onChange: () => this.refresh()
    });
    game.settings.register(MODULE_ID, "calendarDate", {
      scope: "world", config: false, type: Object, default: {},
      onChange: () => this.refresh()
    });
    SocketService.registerHandler(HANDLER, changeCalendarDateAsGM);
    // The panel is a sibling of the tabs, so switching tabs does not hide it.
    Hooks.on("renderSidebar", () => this.refresh());
    Hooks.on("renderChatLog", () => this.refresh());
    Hooks.on("updateUser", () => this.refresh());
    Hooks.on("updateWorldTime", () => this.refresh());
    Hooks.once("ready", () => this.refresh());
  }

  static getDate() {
    try { return calendarDateAtTime(game.settings.get(MODULE_ID, "calendarDate"), game.time.worldTime); }
    catch { return null; }
  }

  static refresh() {
    const existing = document.getElementById(PANEL_ID);
    const host = document.getElementById("sidebar-content");
    if (game.system.id !== "symbaroum" || !game.settings.get(MODULE_ID, "enableCalendar") || !host) {
      existing?.remove();
      if (this.#application?.rendered) this.#application.close().catch(error => this.reportError(error));
      return;
    }
    const panel = existing ?? document.createElement("section");
    if (!existing) {
      panel.id = PANEL_ID;
      panel.setAttribute("aria-label", label("Title"));
      panel.addEventListener("click", (event) => {
        const action = event.target.closest?.("button[data-calendar-action]")?.dataset.calendarAction;
        if (!action || (action !== "open" && !game.user?.isGM)) return;
        const operation = action === "open" ? this.openDateDialog()
          : this.change({ type: "advance", days: action === "previous" ? -1 : 1 });
        operation.catch((error) => this.reportError(error));
      });
    }
    if (panel.parentElement !== host || host.firstElementChild !== panel) host.prepend(panel);
    const html = buildCalendarPanel(this.getDate(), Boolean(game.user?.isGM));
    // Time modules may tick every second; replace the sidebar only when its displayed values change.
    if (panel.innerHTML !== html) panel.innerHTML = html;
    this.#application?.syncDate();
  }

  static async change(operation) {
    if (!game.user?.isGM) throw new Error("Calendar changes require a GM.");
    return SocketService.executeAsPrimaryGM(HANDLER, operation);
  }

  static async openDateDialog() {
    if (!game.settings.get(MODULE_ID, "enableCalendar")) return;
    this.#application ??= new CalendarApplication();
    if (!this.#application.rendered) this.#application.showCurrent(false);
    return this.#application.render({ force: true });
  }

  static reportError(error) {
    console.error(`${MODULE_ID} | Calendar operation failed.`, error);
    ui.notifications?.warn(label(error instanceof RangeError ? "InvalidDate" : "ChangeFailed"));
  }
}

/** All GMs route through one executor; re-read shared world time inside its queue. */
export function changeCalendarDateAsGM(operation) {
  const sender = game.users.get(this?.socketdata?.userId);
  const authorize = () => {
    if (!sender?.active || !sender.isGM || !game.user?.isGM
      || game.users.activeGM?.id !== game.user.id || !game.settings.get(MODULE_ID, "enableCalendar")) {
      throw new Error("Unauthorized calendar operation.");
    }
  };
  authorize();
  // Copy and validate before queuing, never trust a caller-supplied user or setting key.
  let request;
  if (operation?.type === "set") request = { type: "set", date: validateCalendarDate(operation.date) };
  else if (operation?.type === "advance" && (operation.days === 1 || operation.days === -1)) {
    request = { type: "advance", days: operation.days };
  } else if (operation?.type === "time" && [-3600, -600, 600, 3600].includes(operation.seconds)) {
    request = { type: "time", seconds: operation.seconds };
  } else throw new RangeError("Invalid calendar operation.");
  const next = pendingChange.catch(() => {}).then(async () => {
    authorize();
    const current = CalendarService.getDate();
    const anchor = game.settings.get(MODULE_ID, "calendarDate");
    if (request.type === "time") {
      calendarClock(game.time.worldTime);
      if (current) calendarDateAtTime(anchor, game.time.worldTime + request.seconds);
      await game.time.advance(request.seconds);
      return CalendarService.getDate();
    }
    const date = request.type === "set" ? request.date : advanceCalendarDate(current, request.days);
    if (!current) {
      // First configuration gives the shared time a Symbaroum date without resetting it.
      await game.settings.set(MODULE_ID, "calendarDate", createCalendarAnchor(date, game.time.worldTime));
    } else {
      // Preserve hours/minutes. Other modules receive the standard updateWorldTime hook.
      const delta = calendarDayNumber(date) - calendarDayNumber(calendarDateAtTime(anchor, game.time.worldTime));
      if (delta) await game.time.advance(delta * CALENDAR_DAY_SECONDS);
    }
    return date;
  });
  pendingChange = next;
  return next;
}

export function buildCalendarPanel(date, isGM, worldTime = game.time.worldTime) {
  const clock = calendarClock(worldTime);
  const button = (action, icon, title, disabled = false) => `<button type="button" data-calendar-action="${action}" title="${escapeHtml(label(title))}" aria-label="${escapeHtml(label(title))}"${disabled ? " disabled" : ""}><i class="fa-solid ${icon}" aria-hidden="true"></i></button>`;
  return `<div class="tenebre-calendar-heading">${isGM ? button("previous", "fa-chevron-left", "Previous", !date) : ""}
    <span class="tenebre-calendar-date" role="status" aria-live="polite"><span>${escapeHtml(formatCalendarDate(date))}</span><time class="tenebre-sidebar-time" datetime="${clock.text}" aria-label="${escapeHtml(label("WorldTime"))}">${clock.text}</time></span>
    ${isGM ? button("next", "fa-chevron-right", "Next", !date) : ""}${button("open", "fa-calendar-days", "Title")}</div>
    ${date ? `<div class="tenebre-calendar-almanac">${buildCalendarAlmanac(date)}</div>` : ""}`;
}

export class CalendarApplication extends ApplicationBase {
  static DEFAULT_OPTIONS = {
    id: "tenebre-calendar-window",
    classes: ["tenebre-calendar-window"],
    window: { title: "TENEBRE.Calendar.Title", icon: "fa-solid fa-calendar-days", resizable: false },
    position: { width: 490, height: "auto" },
    actions: {
      previousMonth() { this.browseMonth(-1); },
      nextMonth() { this.browseMonth(1); },
      today() { this.showCurrent(); },
      selectDay(_event, target) { this.selectDay(Number(target.dataset.day)); },
      changeTime(_event, target) { CalendarService.change({ type: "time", seconds: Number(target.dataset.seconds) }).catch(error => CalendarService.reportError(error)); },
      applyDate() { this.applyDate().catch(error => CalendarService.reportError(error)); }
    }
  };

  #snapshot = "";
  followCurrent = true;

  constructor(options = {}) {
    super(options);
    this.showCurrent(false);
  }

  showCurrent(render = true) {
    const date = CalendarService.getDate() ?? { year: 1, month: 1, day: 1 };
    this.view = { ...date };
    this.selected = { ...date };
    this.followCurrent = true;
    if (render) this.refresh();
  }

  browseMonth(months) {
    try {
      this.view = shiftCalendarMonth(this.view, months);
      this.selected = { ...this.view };
      this.followCurrent = false;
      this.refresh();
    } catch (error) { CalendarService.reportError(error); }
  }

  selectDay(day) {
    this.selected = validateCalendarDate({ ...this.view, day });
    this.view = { ...this.selected };
    this.followCurrent = false;
    this.refresh();
  }

  setView(year, month) {
    this.view = validateCalendarDate({ year, month, day: this.selected.day });
    this.selected = { ...this.view };
    this.followCurrent = false;
    this.refresh();
  }

  async applyDate() {
    // Browsing is public; mutation still uses the authenticated GM executor.
    await CalendarService.change({ type: "set", date: { ...this.selected } });
    this.showCurrent();
  }

  syncDate() {
    if (!this.rendered) return;
    updateCalendarClock(this.element, game.time.worldTime);
    const snapshot = JSON.stringify([CalendarService.getDate(), Boolean(game.user?.isGM)]);
    if (snapshot === this.#snapshot) return;
    this.#snapshot = snapshot;
    if (this.followCurrent) this.showCurrent(false);
    this.refresh();
  }

  refresh() { this.render({ force: true }).catch(error => CalendarService.reportError(error)); }

  async _renderHTML() {
    return buildCalendarPage({ current: CalendarService.getDate(), selected: this.selected, view: this.view, isGM: Boolean(game.user?.isGM) });
  }

  _replaceHTML(result, content) { content.innerHTML = result; }

  _onRender() {
    // Inputs belong to the newly replaced content, never to the persistent frame.
    for (const name of ["calendarMonth", "calendarYear"]) {
      this.element.querySelector(`[name="${name}"]`)?.addEventListener("change", () => {
        const month = this.element.querySelector('[name="calendarMonth"]');
        const year = this.element.querySelector('[name="calendarYear"]');
        try {
          if (!year.value.trim()) throw new RangeError("Missing calendar year.");
          this.setView(Number(year.value), Number(month.value));
        } catch (error) { CalendarService.reportError(error); this.refresh(); }
      });
    }
  }
}
