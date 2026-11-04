import { MODULE_ID } from "./constants.mjs";
import { SocketService } from "./sockets.mjs";
import { escapeHtml } from "./utils.mjs";
import {
  CALENDAR_DAY_SECONDS, validateCalendarDate,
  advanceCalendarDate, calendarDayNumber, createCalendarAnchor, calendarDateAtTime, shiftCalendarMonth, calendarClock, calendarTimeDelta, calendarClockSpeed
} from "./calendar-date.mjs";
import { formatCalendarDate, buildCalendarAlmanac, buildCalendarPage, updateCalendarClock, buildCalendarClockToggle } from "./calendar-view.mjs";
import { CalendarClockRunner } from "./calendar-runner.mjs";
import { readCalendarWorldOptions, readCalendarClientOptions, validateCalendarWorldOptions, validateCalendarClientOptions,
  calendarUserCanControl, calendarPausesForCombat, calendarIntervalSeconds, calendarPresetDelta, validateCalendarBackup, formatCalendarTime } from "./calendar-options.mjs";
import { buildCalendarExperience } from "./calendar-experience-view.mjs";
import { CalendarConfigurationApplication } from "./calendar-configuration.mjs";
import { registerCalendarChat } from "./calendar-chat.mjs";

const ApplicationBase = globalThis.foundry?.applications?.api?.ApplicationV2 ?? class {};

const PANEL_ID = "tenebre-calendar";
const HANDLER = "changeCalendarDate";
let pendingChange = Promise.resolve();
const CLOCK_SETTING = "calendarClockRunning";

export function queueCalendarChange(operation) {
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
  static #configuration = null;

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
    for (const [key, scope] of [["calendarWorldOptions", "world"], ["calendarIndependentTime", "world"], ["calendarClientOptions", "client"]]) {
      game.settings.register(MODULE_ID, key, { scope, config: false, type: Object, default: {},
        onChange: () => {
          this.synchronizeClock(); this.refresh();
          if (key === "calendarClientOptions") globalThis.ui?.chat?.render?.({ force: true });
        } });
    }
    game.settings.register(MODULE_ID, "calendarClockManualPause", { scope: "world", config: false, type: Boolean, default: false,
      onChange: () => { this.synchronizeClock(); this.refresh(); } });
    this.#runner = new CalendarClockRunner({
      canRun: () => this.canRunClock(),
      getRate: () => calendarClockSpeed(game.settings.get(MODULE_ID, "calendarClockSpeed") ?? 1),
      advance: (seconds, stillValid) => queueCalendarChange(async () => {
        if (!stillValid()) return;
        await advanceCalendarTime(seconds);
      }),
      onError: async error => {
        this.reportError(error);
        if (game.user?.isGM && game.users.activeGM?.id === game.user.id) {
          await this.change({ type: "clock", running: false }).catch(error => console.error(`${MODULE_ID} | Failed to stop clock.`, error));
        }
      }
    });
    SocketService.registerHandler(HANDLER, changeCalendarDateAsGM);
    registerCalendarChat(this);
    Hooks.on("getSceneControlButtons", controls => {
      if (!this.canView() || !game.settings.get(MODULE_ID, "enableCalendar")) return;
      const notes = Object.values(controls).find(control => control.name === "notes");
      if (!notes?.tools || Array.isArray(notes.tools)) return;
      notes.tools.tenebreCalendar = { name: "tenebreCalendar", title: "TENEBRE.Calendar.Title", icon: "fa-solid fa-calendar-days",
        button: true, onChange: () => { void this.toggle(); } };
    });
    // Keep one panel beside the tabs; scoped CSS limits it to Actors and Items.
    Hooks.on("renderSidebar", () => this.refresh());
    Hooks.on("renderChatLog", () => this.refresh());
    for (const event of ["updateUser", "userConnected", "pauseGame"]) {
      Hooks.on(event, () => { this.synchronizeClock(); this.refresh(); });
    }
    Hooks.on("updateWorldTime", () => this.refresh());
    for (const event of ["createCombat", "deleteCombat", "canvasReady"]) {
      Hooks.on(event, () => { this.synchronizeClock(); this.refresh(); });
    }
    Hooks.on("updateCombat", (_combat, _changes, options = {}) => {
      this.synchronizeClock(); this.refresh();
      const delta = options.worldTime?.delta;
      if (SocketService.isPrimaryGM() && readCalendarWorldOptions().integration === "self" && Number.isFinite(delta) && delta) {
        void queueCalendarChange(async () => {
          if (!SocketService.isPrimaryGM() || readCalendarWorldOptions().integration !== "self") return;
          const seconds = this.getTime() + delta;
          if (this.getDate()) calendarDateAtTime(game.settings.get(MODULE_ID, "calendarDate"), seconds);
          await game.settings.set(MODULE_ID, "calendarIndependentTime", { seconds });
        }).catch(error => this.reportError(error));
      }
    });
    game.keybindings?.register(MODULE_ID, "toggleCalendar", {
      name: "TENEBRE.Calendar.Toggle", editable: [], onDown: () => { void this.toggle(); return true; }
    });
    Hooks.once("ready", () => {
      this.#ready = true; this.synchronizeClock(); this.refresh();
      if (readCalendarClientOptions().openOnLoad) void this.openDateDialog();
    });
    globalThis.addEventListener?.("beforeunload", () => this.#runner?.stop(), { once: true });
  }

  static canRunClock() {
    const options = readCalendarWorldOptions();
    return this.#ready && game.system.id === "symbaroum" && Boolean(game.user?.active && game.user.isGM)
      && game.users.activeGM?.id === game.user.id && !game.paused
      && !game.settings.get(MODULE_ID, "calendarClockManualPause")
      && options.integration !== "third-party" && !calendarPausesForCombat(game.combats, globalThis.canvas?.scene?.id, options.combatPause)
      && Boolean(game.settings.get(MODULE_ID, "enableCalendar") && game.settings.get(MODULE_ID, CLOCK_SETTING));
  }

  static synchronizeClock() {
    try { this.#runner?.synchronize(); }
    catch (error) { this.#runner?.stop(); this.reportError(error); }
  }

  static getDate() {
    try { return calendarDateAtTime(game.settings.get(MODULE_ID, "calendarDate"), this.getTime()); }
    catch { return null; }
  }

  static getTime() {
    const { integration } = readCalendarWorldOptions();
    const seconds = game.settings.get(MODULE_ID, "calendarIndependentTime")?.seconds;
    return (integration === "none" || integration === "self") && Number.isFinite(seconds) ? seconds : game.time.worldTime;
  }
  static canView() {
    const options = readCalendarWorldOptions();
    return Boolean(game.user?.isGM || options.playerView || calendarUserCanControl(game.user, options));
  }
  static canControl() {
    return readCalendarWorldOptions().integration !== "third-party" && calendarUserCanControl(game.user);
  }
  static getClockStatus() {
    if (!game.settings.get(MODULE_ID, CLOCK_SETTING)) return "stopped";
    const options = readCalendarWorldOptions();
    return game.paused || !game.users?.activeGM || game.settings.get(MODULE_ID, "calendarClockManualPause") || options.integration === "third-party"
      || calendarPausesForCombat(game.combats, globalThis.canvas?.scene?.id, options.combatPause) ? "paused" : "running";
  }
  static async toggle() {
    if (this.#application?.rendered) return this.#application.close();
    return this.openDateDialog();
  }
  static openConfiguration() {
    this.#configuration ??= new CalendarConfigurationApplication(this);
    return this.#configuration.render({ force: true });
  }
  static exportConfiguration() {
    return { format: "symbaroum-ind-resources-calendar", version: 1, date: this.getDate(), time: this.getTime(),
      options: readCalendarWorldOptions(), speed: game.settings.get(MODULE_ID, "calendarClockSpeed") ?? 1 };
  }

  static refresh() {
    const existing = document.getElementById(PANEL_ID);
    const host = document.getElementById("sidebar-content");
    if (game.system.id !== "symbaroum" || !game.settings.get(MODULE_ID, "enableCalendar") || !this.canView() || !host) {
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
        if (!action || (action !== "open" && !this.canControl())) return;
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
    const date = this.getDate(), isGM = this.canControl();
    const running = Boolean(game.settings.get(MODULE_ID, CLOCK_SETTING)), paused = Boolean(game.paused);
    const preferences = readCalendarClientOptions();
    const snapshot = JSON.stringify([date, isGM, running, paused, this.#editingTime, this.getClockStatus(), preferences.showClock, preferences.hour12, preferences.seconds]);
    if (!existing || panel.dataset.calendarSnapshot !== snapshot) {
      panel.innerHTML = buildCalendarPanel(date, isGM, this.getTime(), { running, paused: this.getClockStatus() === "paused", editing: this.#editingTime });
      panel.dataset.calendarSnapshot = snapshot;
    }
    updateCalendarClock(panel, this.getTime(), date);
    this.#application?.syncDate();
  }

  static async change(operation) {
    if (operation?.type === "configure" || operation?.type === "import") {
      if (!game.user?.isGM) throw new Error("Calendar configuration requires a GM.");
    } else if (!this.canControl()) throw new Error("Calendar changes require a GM or delegated permission.");
    return SocketService.executeAsPrimaryGM(HANDLER, operation);
  }

  static async openDateDialog() {
    if (!game.settings.get(MODULE_ID, "enableCalendar") || !this.canView()) return;
    this.#application ??= new CalendarApplication();
    if (!this.#application.rendered) this.#application.showCurrent(false);
    return this.#application.render({ force: true });
  }

  static reportError(error) {
    console.error(`${MODULE_ID} | Calendar operation failed.`, error);
    ui.notifications?.warn(label(error instanceof RangeError ? "InvalidDate" : "ChangeFailed"));
  }
}

/** Only this queue writes time; permissions are checked again when each request runs. */
export function changeCalendarDateAsGM(operation) {
  const sender = game.users.get(this?.socketdata?.userId);
  const administrative = operation?.type === "configure" || operation?.type === "import";
  const authorize = () => {
    if (!sender?.active || !(administrative ? sender.isGM : calendarUserCanControl(sender)) || !game.user?.isGM
      || game.users.activeGM?.id !== game.user.id || !game.settings.get(MODULE_ID, "enableCalendar")) {
      throw new Error("Unauthorized calendar operation.");
    }
    if (!administrative && readCalendarWorldOptions().integration === "third-party") throw new Error("Calendar is read-only.");
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
    const seconds = operation.seconds ?? 0;
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59) throw new RangeError("Invalid seconds.");
    request = { type: "setTime", hours: operation.hours, minutes: operation.minutes, seconds };
  } else if (operation?.type === "interval") {
    calendarIntervalSeconds(operation.unit, operation.amount);
    request = { type: "interval", unit: operation.unit, amount: operation.amount };
  } else if (operation?.type === "preset" && ["sunrise", "midday", "sunset", "midnight"].includes(operation.preset)) {
    request = { type: "preset", preset: operation.preset };
  } else if (operation?.type === "configure") {
    request = { type: "configure", options: validateCalendarWorldOptions(operation.options), speed: calendarClockSpeed(operation.speed) };
  } else if (operation?.type === "import") {
    const backup = validateCalendarBackup(operation.backup);
    calendarClockSpeed(backup.speed);
    request = { type: "import", backup };
  } else if (operation?.type === "toggleClock") {
    request = { type: "toggleClock" };
  } else if (operation?.type === "pauseResume") {
    request = { type: "pauseResume" };
  } else if (operation?.type === "clock" && typeof operation.running === "boolean") {
    request = { type: "clock", running: operation.running };
  } else throw new RangeError("Invalid calendar operation.");
  return queueCalendarChange(async () => {
    authorize();
    if (request.type === "configure" || request.type === "import") return configureCalendar(request);
    if (request.type === "pauseResume") {
      const running = Boolean(game.settings.get(MODULE_ID, CLOCK_SETTING));
      await game.settings.set(MODULE_ID, "calendarClockManualPause", running && !game.settings.get(MODULE_ID, "calendarClockManualPause"));
      if (!running) await game.settings.set(MODULE_ID, CLOCK_SETTING, true);
      return CalendarService.getClockStatus();
    }
    if (request.type === "clock" || request.type === "toggleClock") {
      const running = request.type === "clock" ? request.running : !game.settings.get(MODULE_ID, CLOCK_SETTING);
      await game.settings.set(MODULE_ID, CLOCK_SETTING, running);
      if (game.settings.get(MODULE_ID, "calendarClockManualPause")) await game.settings.set(MODULE_ID, "calendarClockManualPause", false);
      return running;
    }
    const current = CalendarService.getDate();
    const anchor = game.settings.get(MODULE_ID, "calendarDate");
    if (["time", "setTime", "interval", "preset"].includes(request.type)) {
      const time = CalendarService.getTime();
      const seconds = request.type === "time" ? request.seconds
        : request.type === "setTime" ? calendarTimeDelta(time, request.hours, request.minutes) + request.seconds
        : request.type === "interval" ? calendarIntervalSeconds(request.unit, request.amount, globalThis.CONFIG?.time?.roundTime ?? 6)
        : calendarPresetDelta(current, time, request.preset);
      if (seconds) await advanceCalendarTime(seconds);
      return CalendarService.getDate();
    }
    const date = request.type === "set" ? request.date : advanceCalendarDate(current, request.days);
    if (!current) {
      // First configuration gives the shared time a Symbaroum date without resetting it.
      await game.settings.set(MODULE_ID, "calendarDate", createCalendarAnchor(date, CalendarService.getTime()));
    } else {
      // Preserve hours/minutes. Other modules receive the standard updateWorldTime hook.
      const delta = calendarDayNumber(date) - calendarDayNumber(calendarDateAtTime(anchor, CalendarService.getTime()));
      if (delta) await advanceCalendarTime(delta * CALENDAR_DAY_SECONDS);
    }
    return date;
  });
}

async function advanceCalendarTime(seconds) {
  if (!Number.isFinite(seconds)) throw new RangeError("Invalid time interval.");
  const next = CalendarService.getTime() + seconds;
  calendarClock(next);
  if (CalendarService.getDate()) calendarDateAtTime(game.settings.get(MODULE_ID, "calendarDate"), next);
  const { integration } = readCalendarWorldOptions();
  if (integration === "third-party") throw new Error("Calendar is read-only.");
  if (integration === "mixed") await game.time.advance(seconds);
  else {
    if (integration === "self") await game.time.advance(next - game.time.worldTime);
    await game.settings.set(MODULE_ID, "calendarIndependentTime", { seconds: next });
  }
  return next;
}

async function configureCalendar(request) {
  const imported = request.type === "import" ? request.backup : null;
  const options = imported?.options ?? request.options;
  const oldOptions = readCalendarWorldOptions();
  const oldTime = CalendarService.getTime(), oldDate = CalendarService.getDate();
  if (imported) {
    await game.settings.set(MODULE_ID, CLOCK_SETTING, false);
    if (options.integration !== "none" && options.integration !== "third-party") await game.time.advance(imported.time - game.time.worldTime);
    const time = options.integration === "third-party" ? game.time.worldTime : imported.time;
    await game.settings.set(MODULE_ID, "calendarIndependentTime", { seconds: time });
    await game.settings.set(MODULE_ID, "calendarDate", imported.date ? createCalendarAnchor(imported.date, time) : {});
  } else if (options.integration !== oldOptions.integration) {
    await game.settings.set(MODULE_ID, "calendarIndependentTime", { seconds: oldTime });
    if (["mixed", "third-party"].includes(options.integration) && oldDate) {
      await game.settings.set(MODULE_ID, "calendarDate", createCalendarAnchor(oldDate, game.time.worldTime));
    }
  }
  await game.settings.set(MODULE_ID, "calendarClockSpeed", imported?.speed ?? request.speed);
  await game.settings.set(MODULE_ID, "calendarWorldOptions", options);
  CalendarService.synchronizeClock();
  CalendarService.refresh();
  return options;
}

export function buildCalendarPanel(date, isGM, worldTime = game.time.worldTime, { running = false, paused = false, editing = false } = {}) {
  const clock = calendarClock(worldTime);
  const preferences = readCalendarClientOptions();
  const button = (action, icon, title, disabled = false) => `<button type="button" data-calendar-action="${action}" title="${escapeHtml(label(title))}" aria-label="${escapeHtml(label(title))}"${disabled ? " disabled" : ""}><i class="fa-solid ${icon}" aria-hidden="true"></i></button>`;
  return `<div class="tenebre-calendar-heading">${isGM ? button("previous", "fa-chevron-left", "Previous", !date) : ""}
    <span class="tenebre-calendar-date"><span role="status">${escapeHtml(formatCalendarDate(date))}</span>${preferences.showClock ? `<span class="tenebre-sidebar-time-row"><time data-calendar-time data-calendar-hour12="${preferences.hour12}" data-calendar-seconds="${preferences.seconds}" class="tenebre-sidebar-time" datetime="${clock.fullText}" aria-label="${escapeHtml(label("WorldTime"))}">${escapeHtml(formatCalendarTime(worldTime, preferences))}</time>${isGM ? button("editTime", "fa-clock", "EditTime") + buildCalendarClockToggle(running, paused, true) : ""}</span>` : ""}</span>
    ${isGM ? button("next", "fa-chevron-right", "Next", !date) : ""}${button("open", "fa-calendar-days", "Title")}</div>
    ${isGM && editing && preferences.showClock ? `<div class="tenebre-sidebar-time-editor"><input name="calendarSidebarTime" type="time" step="60" value="${clock.text}" required aria-label="${escapeHtml(label("EditTime"))}">${button("applyTime", "fa-check", "ApplyTime")}</div>` : ""}
    ${date ? `<div class="tenebre-calendar-almanac">${buildCalendarAlmanac(date, worldTime)}</div>` : ""}`;
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
      selectDay(_event, target) {
        if (target.dataset.month) this.setView(Number(target.dataset.year), Number(target.dataset.month), false);
        this.selectDay(Number(target.dataset.day));
      },
      previousPeriod() { this.browseMonth(readCalendarClientOptions().mode === "year" ? -12 : -1); },
      nextPeriod() { this.browseMonth(readCalendarClientOptions().mode === "year" ? 12 : 1); },
      viewMode(_event, target) { return this.changeMode(target.dataset.mode); },
      calendarSettings() { return CalendarService.openConfiguration(); },
      calendarDetails() { this.detailsOpen = !this.detailsOpen; this.refresh(); },
      timeInterval(_event, target) { return CalendarService.change({ type: "interval", unit: target.dataset.unit ?? this.unit, amount: Number(target.dataset.amount) }).catch(error => CalendarService.reportError(error)); },
      timePreset(_event, target) { return CalendarService.change({ type: "preset", preset: target.dataset.preset }).catch(error => CalendarService.reportError(error)); },
      reverseTime() { this.reverse = !this.reverse; this.refresh(); },
      largerSteps() { this.larger = !this.larger; this.refresh(); },
      stopClock() { return CalendarService.change({ type: "clock", running: false }).catch(error => CalendarService.reportError(error)); },
      editDateTime() { return this.editDateTime().catch(error => CalendarService.reportError(error)); },
      changeTime(_event, target) { CalendarService.change({ type: "time", seconds: Number(target.dataset.seconds) }).catch(error => CalendarService.reportError(error)); },
      toggleClock() { CalendarService.change({ type: "pauseResume" }).catch(error => CalendarService.reportError(error)); },
      applyDate() { this.applyDate().catch(error => CalendarService.reportError(error)); }
    }
  };

  #snapshot = "";
  #renderMode = null;
  followCurrent = true;
  unit = "minute";
  reverse = false;
  larger = false;
  detailsOpen = false;

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

  setView(year, month, render = true) {
    this.view = validateCalendarDate({ year, month, day: this.selected.day });
    this.selected = { ...this.view };
    this.followCurrent = false;
    if (render) this.refresh();
  }

  async changeMode(mode) {
    try {
      const preferences = validateCalendarClientOptions({ ...readCalendarClientOptions(), mode });
      await this.savePosition();
      await game.settings.set(MODULE_ID, "calendarClientOptions", { ...readCalendarClientOptions(), mode: preferences.mode });
      this.refresh();
    } catch (error) { CalendarService.reportError(error); }
  }

  async savePosition() {
    const preferences = readCalendarClientOptions();
    if (!preferences.rememberPosition || !Number.isFinite(this.position?.left) || !Number.isFinite(this.position?.top)) return;
    const key = preferences.mode === "compact" ? "compactPosition" : "position";
    const position = { left: this.position.left, top: this.position.top };
    if (JSON.stringify(position) === JSON.stringify(preferences[key])) return;
    await game.settings.set(MODULE_ID, "calendarClientOptions", { ...preferences, [key]: position });
  }

  async close(options) {
    await this.savePosition();
    return super.close?.(options);
  }

  async editDateTime() {
    if (!CalendarService.canControl()) return;
    const date = CalendarService.getDate() ?? this.selected;
    const clock = calendarClock(CalendarService.getTime());
    return foundry.applications.api.DialogV2.wait({ window: { title: label("EditDateTime") },
      content: `<div class="tenebre-calendar-datetime"><label>${escapeHtml(label("Year"))}<input name="year" type="number" min="0" max="9999" value="${date.year}" required></label><label>${escapeHtml(label("Month"))}<input name="month" type="number" min="1" max="12" value="${date.month}" required></label><label>${escapeHtml(label("Day"))}<input name="day" type="number" min="1" max="30" value="${date.day}" required></label><label>${escapeHtml(label("WorldTime"))}<input name="time" type="time" step="1" value="${clock.fullText}" required></label></div>`,
      buttons: [{ action: "apply", label: label("ApplyDate"), callback: async (_event, _button, dialog) => {
        const value = name => dialog.element.querySelector(`[name="${name}"]`).value;
        const chosen = validateCalendarDate({ year: Number(value("year")), month: Number(value("month")), day: Number(value("day")) });
        const time = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value("time"));
        if (!time) throw new RangeError("Invalid clock time.");
        calendarTimeDelta(0, Number(time[1]), Number(time[2]));
        await CalendarService.change({ type: "set", date: chosen });
        await CalendarService.change({ type: "setTime", hours: Number(time[1]), minutes: Number(time[2]), seconds: Number(time[3] ?? 0) });
        this.showCurrent();
      } }, { action: "cancel", label: game.i18n.localize("TENEBRE.Common.Cancel") }], rejectClose: false });
  }

  async applyDate() {
    // Browsing is public; mutation still uses the authenticated GM executor.
    await CalendarService.change({ type: "set", date: { ...this.selected } });
    this.showCurrent();
  }

  syncDate() {
    if (!this.rendered) return;
    updateCalendarClock(this.element, CalendarService.getTime(), CalendarService.getDate());
    const { position: _position, compactPosition: _compactPosition, ...display } = readCalendarClientOptions();
    const snapshot = JSON.stringify([CalendarService.getDate(), CalendarService.canControl(), CalendarService.getClockStatus(), display, readCalendarWorldOptions()]);
    if (snapshot === this.#snapshot) return;
    this.#snapshot = snapshot;
    if (this.followCurrent) this.showCurrent(false);
    this.refresh();
  }

  refresh() { this.render({ force: true }).catch(error => CalendarService.reportError(error)); }

  async _renderHTML() {
    return buildCalendarExperience({ current: CalendarService.getDate(), selected: this.selected, view: this.view,
      time: CalendarService.getTime(), canControl: CalendarService.canControl(), status: CalendarService.getClockStatus(),
      suspended: CalendarService.getClockStatus() === "paused" && !game.settings.get(MODULE_ID, "calendarClockManualPause"),
      preferences: readCalendarClientOptions(), worldOptions: readCalendarWorldOptions(), unit: this.unit, reverse: this.reverse, larger: this.larger, detailsOpen: this.detailsOpen });
  }

  _replaceHTML(result, content) { content.innerHTML = result; }

  _onRender() {
    const preferences = readCalendarClientOptions();
    this.element.dataset.calendarTheme = preferences.theme;
    this.element.style?.setProperty("--tenebre-calendar-scale", String(preferences.scale / 100));
    const dimensionsKey = `${preferences.mode}:${preferences.scale}`;
    if (this.#renderMode !== dimensionsKey) {
      this.#renderMode = dimensionsKey;
      const saved = preferences.mode === "compact" ? preferences.compactPosition : preferences.position;
      const viewportWidth = globalThis.innerWidth ?? 1400, viewportHeight = globalThis.innerHeight ?? 900;
      const width = Math.min(viewportWidth - 24, (preferences.mode === "compact" ? 350 : preferences.mode === "year" ? 780 : 440) * preferences.scale / 100);
      this.setPosition?.({ width, height: "auto", ...(preferences.rememberPosition && Number.isFinite(saved.left) ? {
        left: Math.max(0, Math.min(saved.left, viewportWidth - width)), top: Math.max(0, Math.min(saved.top, viewportHeight - 100))
      } : {}) });
    }
    const title = this.element.querySelector(".window-header");
    if (title && title.dataset.calendarBound !== "true") {
      title.dataset.calendarBound = "true";
      title.addEventListener("dblclick", event => {
        if (event.target.closest("button")) return;
        event.preventDefault(); event.stopPropagation();
        void this.changeMode(readCalendarClientOptions().mode === "compact" ? "full" : "compact");
      }, { capture: true });
    }
    this.element.querySelector('[name="calendarUnit"]')?.addEventListener("change", event => { this.unit = event.target.value; });
    for (const day of this.element.querySelectorAll('[data-action="selectDay"]')) {
      day.addEventListener("contextmenu", event => {
        event.preventDefault();
        this.setView(Number(day.dataset.year), Number(day.dataset.month), false);
        this.selectDay(Number(day.dataset.day));
        const selected = { ...this.selected };
        void foundry.applications.api.DialogV2.wait({ window: { title: formatCalendarDate(selected) },
          content: `<p>${escapeHtml(label("SelectedDate"))}: ${escapeHtml(formatCalendarDate(selected))}</p>`,
          buttons: [{ action: "close", label: game.i18n.localize("TENEBRE.Common.Close") },
            ...(CalendarService.canControl() ? [{ action: "apply", label: label("ApplyDate"), callback: () => CalendarService.change({ type: "set", date: selected }) }] : [])], rejectClose: false });
      });
    }
    // Inputs belong to the newly replaced content, never to the persistent frame.
    for (const name of ["calendarMonth", "calendarYear"]) {
      this.element.querySelector(`[name="${name}"]`)?.addEventListener("change", () => {
        const month = this.element.querySelector('[name="calendarMonth"]');
        const year = this.element.querySelector('[name="calendarYear"]');
        try {
          if (!year.value.trim()) throw new RangeError("Missing calendar year.");
          this.setView(Number(year.value), Number(month?.value ?? this.view.month));
        } catch (error) { CalendarService.reportError(error); this.refresh(); }
      });
    }
  }
}
