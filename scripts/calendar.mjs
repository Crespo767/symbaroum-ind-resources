import { MODULE_ID } from "./constants.mjs";
import { SocketService } from "./sockets.mjs";
import { escapeHtml } from "./utils.mjs";
import {
  SYMBAROUM_MONTHS, MAX_CALENDAR_YEAR, CALENDAR_DAY_SECONDS, validateCalendarDate,
  advanceCalendarDate, calendarDayNumber, createCalendarAnchor, calendarDateAtTime
} from "./calendar-date.mjs";

const PANEL_ID = "tenebre-calendar";
const HANDLER = "changeCalendarDate";
let pendingChange = Promise.resolve();

const label = (key) => game.i18n.localize(`TENEBRE.Calendar.${key}`);

export class CalendarService {
  static #registered = false;
  static #dialogOpen = false;

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
      return;
    }
    const panel = existing ?? document.createElement("section");
    if (!existing) {
      panel.id = PANEL_ID;
      panel.setAttribute("aria-label", label("Title"));
      panel.addEventListener("click", (event) => {
        const action = event.target.closest?.("button[data-calendar-action]")?.dataset.calendarAction;
        if (!game.user?.isGM || !action) return;
        const operation = action === "set" ? this.openDateDialog()
          : this.change({ type: "advance", days: action === "previous" ? -1 : 1 });
        operation.catch((error) => this.reportError(error));
      });
    }
    if (panel.parentElement !== host || host.firstElementChild !== panel) host.prepend(panel);
    const html = buildCalendarPanel(this.getDate(), Boolean(game.user?.isGM));
    // Time modules may tick every second; keep focus and live text until the day changes.
    if (panel.innerHTML !== html) panel.innerHTML = html;
  }

  static async change(operation) {
    if (!game.user?.isGM) throw new Error("Calendar changes require a GM.");
    return SocketService.executeAsPrimaryGM(HANDLER, operation);
  }

  static async openDateDialog() {
    if (!game.user?.isGM || this.#dialogOpen || !game.settings.get(MODULE_ID, "enableCalendar")) return;
    this.#dialogOpen = true;
    try {
      const date = this.getDate() ?? { year: 1, month: 1, day: 1 };
      const result = await foundry.applications.api.DialogV2.prompt({
        window: { title: label("SetDate") },
        content: buildCalendarDateForm(date),
        rejectClose: false,
        ok: {
          label: "TENEBRE.Common.Save",
          callback: (_event, button) => {
            const form = new FormData(button.form);
            return validateCalendarDate({ year: Number(form.get("year")), month: Number(form.get("month")), day: Number(form.get("day")) });
          }
        }
      });
      if (result) await this.change({ type: "set", date: result });
    } finally {
      this.#dialogOpen = false;
    }
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
  } else throw new RangeError("Invalid calendar operation.");
  const next = pendingChange.catch(() => {}).then(async () => {
    authorize();
    const current = CalendarService.getDate();
    const date = request.type === "set" ? request.date : advanceCalendarDate(current, request.days);
    const anchor = game.settings.get(MODULE_ID, "calendarDate");
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

export function buildCalendarPanel(date, isGM) {
  const text = date ? game.i18n.format("TENEBRE.Calendar.Date", {
    day: date.day, month: SYMBAROUM_MONTHS[date.month - 1], year: date.year
  }) : label("Undefined");
  const button = (action, icon, title, disabled = false) => `<button type="button" data-calendar-action="${action}" title="${escapeHtml(label(title))}" aria-label="${escapeHtml(label(title))}"${disabled ? " disabled" : ""}><i class="fa-solid ${icon}" aria-hidden="true"></i></button>`;
  return `${isGM ? button("previous", "fa-chevron-left", "Previous", !date) : ""}
    <span class="tenebre-calendar-date" role="status" aria-live="polite">${escapeHtml(text)}</span>
    ${isGM ? button("next", "fa-chevron-right", "Next", !date) + button("set", "fa-calendar-days", "SetDate") : ""}`;
}

export function buildCalendarDateForm(date) {
  const options = SYMBAROUM_MONTHS.map((month, i) => `<option value="${i + 1}"${date.month === i + 1 ? " selected" : ""}>${escapeHtml(month)}</option>`).join("");
  return `<div class="standard-form tenebre-calendar-form"><p class="hint">${escapeHtml(label("TimeHint"))}</p>
    <div class="form-group"><label>${escapeHtml(label("Day"))}</label><div class="form-fields"><input aria-label="${escapeHtml(label("Day"))}" name="day" type="number" required min="1" max="30" step="1" value="${date.day}"></div></div>
    <div class="form-group"><label>${escapeHtml(label("Month"))}</label><div class="form-fields"><select aria-label="${escapeHtml(label("Month"))}" name="month">${options}</select></div></div>
    <div class="form-group"><label>${escapeHtml(label("Year"))}</label><div class="form-fields"><input aria-label="${escapeHtml(label("Year"))}" name="year" type="number" required min="0" max="${MAX_CALENDAR_YEAR}" step="1" value="${date.year}"></div></div>
  </div>`;
}
