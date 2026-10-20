import { MODULE_ID } from "./constants.mjs";
import { SocketService } from "./sockets.mjs";
import { escapeHtml } from "./utils.mjs";
import {
  CALENDAR_DAY_SECONDS, validateCalendarDate,
  advanceCalendarDate, calendarDayNumber, createCalendarAnchor, calendarDateAtTime, shiftCalendarMonth, calendarClock, calendarTimeDelta, calendarClockSpeed
} from "./calendar-date.mjs";
import { formatCalendarDate, buildCalendarAlmanac, buildCalendarPage, updateCalendarClock, buildCalendarClockToggle } from "./calendar-view.mjs";
import { CalendarClockRunner } from "./calendar-runner.mjs";

const ApplicationBase = globalThis.foundry?.applications?.api?.ApplicationV2 ?? class {};

const PANEL_ID = "tenebre-calendar";
const HANDLER = "changeCalendarDate";
let pendingChange = Promise.resolve();
const CLOCK_SETTING = "calendarClockRunning";

function queueCalendarChange(operation) {
  const next = pendingChange.catch(() => {}).then(operation);
  pendingChange = next;
  return next;
}

const label = (key) => game.i18n.localize(`TENEBRE.Calendar.${key}`);

export class CalendarService {
  static #registered = false;
  static #application = null;
  static #runner = null;
  static #ready = false;
  static #editingTime = false;

  static register() {
    if (this.#registered) return;
    this.#registered = true;
    game.settings.register(MODULE_ID, "enableCalendar", {
      name: "TENEBRE.Calendar.Enable", hint: "TENEBRE.Calendar.EnableHint",
      scope: "world", config: true, type: Boolean, default: true,
      onChange: () => { this.synchronizeClock(); this.refresh(); }
    });
    game.settings.register(MODULE_ID, "calendarDate", {
      scope: "world", config: false, type: Object, default: {},
      onChange: () => this.refresh()
    });
    game.settings.register(MODULE_ID, CLOCK_SETTING, {
      scope: "world", config: false, type: Boolean, default: false,
      onChange: () => { this.synchronizeClock(); this.refresh(); }
    });
    const NumberField = globalThis.foundry?.data?.fields?.NumberField;
    game.settings.register(MODULE_ID, "calendarClockSpeed", {
      name: "TENEBRE.Calendar.ClockSpeed", hint: "TENEBRE.Calendar.ClockSpeedHint",
      scope: "world", config: true, default: 1,
      type: NumberField ? new NumberField({ required: true, nullable: false, initial: 1, min: 0.01, max: 86400, step: 0.01 }) : Number,
      onChange: () => this.synchronizeClock()
    });
    this.#runner = new CalendarClockRunner({
      canRun: () => this.canRunClock(),
      getRate: () => calendarClockSpeed(game.settings.get(MODULE_ID, "calendarClockSpeed") ?? 1),
      advance: (seconds, stillValid) => queueCalendarChange(async () => {
        if (!stillValid()) return;
        const anchor = game.settings.get(MODULE_ID, "calendarDate");
        if (this.getDate()) calendarDateAtTime(anchor, game.time.worldTime + seconds);
        await game.time.advance(seconds);
      }),
      onError: async error => {
        this.reportError(error);
        if (game.user?.isGM && game.users.activeGM?.id === game.user.id) {
          await this.change({ type: "clock", running: false }).catch(error => console.error(`${MODULE_ID} | Failed to stop clock.`, error));
        }
      }
    });
    SocketService.registerHandler(HANDLER, changeCalendarDateAsGM);
    // The panel is a sibling of the tabs, so switching tabs does not hide it.
    Hooks.on("renderSidebar", () => this.refresh());
    Hooks.on("renderChatLog", () => this.refresh());
    for (const event of ["updateUser", "userConnected", "pauseGame"]) {
      Hooks.on(event, () => { this.synchronizeClock(); this.refresh(); });
    }
    Hooks.on("updateWorldTime", () => this.refresh());
    Hooks.once("ready", () => { this.#ready = true; this.synchronizeClock(); this.refresh(); });
    globalThis.addEventListener?.("beforeunload", () => this.#runner?.stop(), { once: true });
  }

  static canRunClock() {
    return this.#ready && game.system.id === "symbaroum" && Boolean(game.user?.active && game.user.isGM)
      && game.users.activeGM?.id === game.user.id && !game.paused
      && Boolean(game.settings.get(MODULE_ID, "enableCalendar") && game.settings.get(MODULE_ID, CLOCK_SETTING));
  }

  static synchronizeClock() {
    try { this.#runner?.synchronize(); }
    catch (error) { this.#runner?.stop(); this.reportError(error); }
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
        const target = event.target.closest?.("button[data-calendar-action]");
        const action = target?.dataset.calendarAction;
        if (!action || (action !== "open" && !game.user?.isGM)) return;
        if (action === "editTime") { this.#editingTime = !this.#editingTime; this.refresh(); return; }
        let operation;
        if (action === "open") operation = this.openDateDialog();
        else if (action === "toggleClock") operation = this.change({ type: "toggleClock" });
        else if (action === "applyTime") {
          const value = panel.querySelector('[name="calendarSidebarTime"]')?.value ?? "";
          const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
          if (!match) { this.reportError(new RangeError("Invalid time.")); return; }
          operation = this.change({ type: "setTime", hours: Number(match[1]), minutes: Number(match[2]) })
            .then(() => { this.#editingTime = false; this.refresh(); });
        } else if (action === "previous" || action === "next") operation = this.change({ type: "advance", days: action === "previous" ? -1 : 1 });
        else return;
        operation.catch((error) => this.reportError(error));
      });
    }
    if (panel.parentElement !== host || host.firstElementChild !== panel) host.prepend(panel);
    const date = this.getDate(), isGM = Boolean(game.user?.isGM);
    const running = Boolean(game.settings.get(MODULE_ID, CLOCK_SETTING)), paused = Boolean(game.paused);
    const snapshot = JSON.stringify([date, isGM, running, paused, this.#editingTime]);
    if (!existing || panel.dataset.calendarSnapshot !== snapshot) {
      panel.innerHTML = buildCalendarPanel(date, isGM, game.time.worldTime, { running, paused, editing: this.#editingTime });
      panel.dataset.calendarSnapshot = snapshot;
    }
    updateCalendarClock(panel, game.time.worldTime);
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
  } else if (operation?.type === "setTime") {
    calendarTimeDelta(0, operation.hours, operation.minutes);
    request = { type: "setTime", hours: operation.hours, minutes: operation.minutes };
  } else if (operation?.type === "toggleClock") {
    request = { type: "toggleClock" };
  } else if (operation?.type === "clock" && typeof operation.running === "boolean") {
    request = { type: "clock", running: operation.running };
  } else throw new RangeError("Invalid calendar operation.");
  return queueCalendarChange(async () => {
    authorize();
    if (request.type === "clock" || request.type === "toggleClock") {
      const running = request.type === "clock" ? request.running : !game.settings.get(MODULE_ID, CLOCK_SETTING);
      await game.settings.set(MODULE_ID, CLOCK_SETTING, running);
      return running;
    }
    const current = CalendarService.getDate();
    const anchor = game.settings.get(MODULE_ID, "calendarDate");
    if (request.type === "time" || request.type === "setTime") {
      calendarClock(game.time.worldTime);
      const seconds = request.type === "time" ? request.seconds : calendarTimeDelta(game.time.worldTime, request.hours, request.minutes);
      if (current) calendarDateAtTime(anchor, game.time.worldTime + seconds);
      if (seconds) await game.time.advance(seconds);
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
}

export function buildCalendarPanel(date, isGM, worldTime = game.time.worldTime, { running = false, paused = false, editing = false } = {}) {
  const clock = calendarClock(worldTime);
  const button = (action, icon, title, disabled = false) => `<button type="button" data-calendar-action="${action}" title="${escapeHtml(label(title))}" aria-label="${escapeHtml(label(title))}"${disabled ? " disabled" : ""}><i class="fa-solid ${icon}" aria-hidden="true"></i></button>`;
  return `<div class="tenebre-calendar-heading">${isGM ? button("previous", "fa-chevron-left", "Previous", !date) : ""}
    <span class="tenebre-calendar-date"><span role="status">${escapeHtml(formatCalendarDate(date))}</span><span class="tenebre-sidebar-time-row"><time data-calendar-time class="tenebre-sidebar-time" datetime="${clock.fullText}" aria-label="${escapeHtml(label("WorldTime"))}">${clock.fullText}</time>${isGM ? button("editTime", "fa-clock", "EditTime") + buildCalendarClockToggle(running, paused, true) : ""}</span></span>
    ${isGM ? button("next", "fa-chevron-right", "Next", !date) : ""}${button("open", "fa-calendar-days", "Title")}</div>
    ${isGM && editing ? `<div class="tenebre-sidebar-time-editor"><input name="calendarSidebarTime" type="time" step="60" value="${clock.text}" required aria-label="${escapeHtml(label("EditTime"))}">${button("applyTime", "fa-check", "ApplyTime")}</div>` : ""}
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
      toggleClock() { CalendarService.change({ type: "toggleClock" }).catch(error => CalendarService.reportError(error)); },
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
    const snapshot = JSON.stringify([CalendarService.getDate(), Boolean(game.user?.isGM), Boolean(game.settings.get(MODULE_ID, CLOCK_SETTING)), Boolean(game.paused)]);
    if (snapshot === this.#snapshot) return;
    this.#snapshot = snapshot;
    if (this.followCurrent) this.showCurrent(false);
    this.refresh();
  }

  refresh() { this.render({ force: true }).catch(error => CalendarService.reportError(error)); }

  async _renderHTML() {
    return buildCalendarPage({ current: CalendarService.getDate(), selected: this.selected, view: this.view, isGM: Boolean(game.user?.isGM), running: Boolean(game.settings.get(MODULE_ID, CLOCK_SETTING)), paused: Boolean(game.paused) });
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
