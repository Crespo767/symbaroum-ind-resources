import { MODULE_ID } from "./constants.mjs";
import { escapeHtml } from "./utils.mjs";
import { calendarClock, calendarClockSpeed } from "./calendar-date.mjs";
import { readCalendarClientOptions, readCalendarWorldOptions, validateCalendarClientOptions, validateCalendarWorldOptions, validateCalendarBackup } from "./calendar-options.mjs";

const ApplicationBase = globalThis.foundry?.applications?.api?.ApplicationV2 ?? class {};
const label = key => game.i18n.localize(`TENEBRE.Calendar.${key}`);
const check = (name, text, checked, value = "on") => `<label class="tenebre-cal-check"><input type="checkbox" name="${name}" value="${escapeHtml(value)}"${checked ? " checked" : ""}>${escapeHtml(text)}</label>`;
const select = (name, key, entries, value) => `<label>${escapeHtml(label(key))}<select name="${name}" aria-label="${escapeHtml(label(key))}">${entries.map(([id, text]) => `<option value="${id}"${id === value ? " selected" : ""}>${escapeHtml(text)}</option>`).join("")}</select></label>`;

export function buildCalendarConfiguration({ client, world, speed, isGM, users = [] }) {
  const clients = `${select("mode", "ViewMode", ["full", "compact", "year"].map(mode => [mode, label({ full: "MonthView", compact: "CompactView", year: "YearView" }[mode])]), client.mode)}
    ${select("theme", "Theme", ["dark", "light", "classic"].map(value => [value, label(`Themes.${value}`)]), client.theme)}
    ${select("layout", "ControlLayout", ["full", "quick", "hidden"].map(value => [value, label(`Layouts.${value}`)]), client.layout)}
    <label>${escapeHtml(label("Scale"))}<input name="scale" type="number" min="70" max="200" step="10" value="${client.scale}"></label>
    ${select("firstWeekday", "FirstWeekday", ["Earth", "Water", "Wind", "Forest", "Mountain", "People", "Feast"].map((day, index) => [String(index), label(`Weekdays.${day}`)]), String(client.firstWeekday))}
    ${["showClock", "hour12", "seconds", "showWeekdays", "openOnLoad", "rememberPosition", "chatTimestamp"].map(key => check(key, label(`Preferences.${key}`), client[key])).join("")}`;
  const worlds = !isGM ? "" : `<fieldset data-calendar-world><legend>${escapeHtml(label("WorldConfiguration"))}</legend>
    ${select("integration", "Integration", ["mixed", "self", "none", "third-party"].map(mode => [mode, label(`IntegrationModes.${mode}`)]), world.integration)}
    <p class="tenebre-calendar-time-hint">${escapeHtml(label("IntegrationHint"))}</p>
    ${select("combatPause", "CombatPause", ["never", "active", "any"].map(mode => [mode, label(`CombatRules.${mode}`)]), world.combatPause)}
    <label>${escapeHtml(label("ClockSpeed"))}<input name="speed" type="number" min="0.01" max="86400" step="0.01" value="${speed}"></label>
    ${check("playerView", label("PlayerView"), world.playerView)}
    <h4>${escapeHtml(label("ControlPermission"))}</h4><p>${escapeHtml(label("ControlPermissionHint"))}</p>
    ${[1, 2, 3].map(role => check("controlRoles", label(`Roles.${role}`), world.controlRoles.includes(role), String(role))).join("")}
    <div class="tenebre-cal-users">${Array.from(users).filter(user => !user.isGM).map(user => check("controlUsers", user.name ?? user.id, world.controlUsers.includes(user.id), user.id)).join("")}</div>
    <h4>${escapeHtml(label("SeasonDaylight"))}</h4><p>${escapeHtml(label("SeasonDaylightHint"))}</p>
    ${["Autumn", "Winter", "Spring", "Summer"].map(season => `<div class="tenebre-cal-season"><span>${escapeHtml(label(`Seasons.${season}`))}</span>${["sunrise", "sunset"].map((key, i) => `<label>${escapeHtml(label(i === 0 ? "Sunrise" : "Sunset"))}<input type="time" name="${season}-${key}" value="${calendarClock(world.daylight[season][i]).text}"></label>`).join("")}</div>`).join("")}
    <h4>${escapeHtml(label("Backup"))}</h4><button type="button" data-action="exportCalendar">${escapeHtml(label("Export"))}</button>
    <label>${escapeHtml(label("ImportFile"))}<input type="file" name="calendarImportFile" accept="application/json,.json"></label>
    <textarea name="calendarImport" rows="4" aria-label="${escapeHtml(label("Import"))}" placeholder="${escapeHtml(label("ImportHint"))}"></textarea>
    <button type="button" data-action="importCalendar">${escapeHtml(label("Import"))}</button>
  </fieldset>`;
  return `<div class="tenebre-calendar-configuration"><p>${escapeHtml(label("SymbaroumPreset"))}</p><fieldset data-calendar-client><legend>${escapeHtml(label("ClientConfiguration"))}</legend>${clients}</fieldset>${worlds}<footer><button type="button" data-action="saveCalendarConfiguration">${escapeHtml(game.i18n.localize("TENEBRE.Common.Confirm"))}</button><button type="button" data-action="cancelCalendarConfiguration">${escapeHtml(game.i18n.localize("TENEBRE.Common.Cancel"))}</button></footer></div>`;
}

export class CalendarConfigurationApplication extends ApplicationBase {
  static DEFAULT_OPTIONS = {
    id: "tenebre-calendar-configuration", classes: ["tenebre-calendar-configuration-window"],
    window: { title: "TENEBRE.Calendar.Configuration", icon: "fa-solid fa-calendar-days", resizable: true },
    position: { width: 530, height: 680 },
    actions: {
      saveCalendarConfiguration() { return this.save().catch(error => this.service.reportError(error)); },
      cancelCalendarConfiguration() { return this.close(); },
      exportCalendar() { this.export(); },
      importCalendar() { return this.import().catch(error => this.service.reportError(error)); }
    }
  };
  constructor(service, options = {}) { super(options); this.service = service; }
  async _renderHTML() {
    return buildCalendarConfiguration({ client: readCalendarClientOptions(), world: readCalendarWorldOptions(),
      speed: game.settings.get(MODULE_ID, "calendarClockSpeed") ?? 1, isGM: Boolean(game.user?.isGM), users: game.users?.contents ?? game.users?.values?.() ?? [] });
  }
  _replaceHTML(result, content) { content.innerHTML = result; }
  _onRender() {
    this.element.querySelector('[name="calendarImportFile"]')?.addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 262144) { this.service.reportError(new RangeError("Calendar backup too large.")); return; }
      this.element.querySelector('[name="calendarImport"]').value = await file.text();
    });
  }
  async save() {
    const value = name => this.element.querySelector(`[name="${name}"]`)?.value;
    const checked = name => Boolean(this.element.querySelector(`[name="${name}"]`)?.checked);
    const client = { ...readCalendarClientOptions(), mode: value("mode"), theme: value("theme"), layout: value("layout"),
      scale: Number(value("scale")), firstWeekday: Number(value("firstWeekday")) };
    for (const key of ["openOnLoad", "rememberPosition", "showClock", "hour12", "seconds", "showWeekdays", "chatTimestamp"]) client[key] = checked(key);
    const preferences = validateCalendarClientOptions(client);
    if (game.user?.isGM) {
      const time = name => {
        const match = /^(\d{2}):(\d{2})$/.exec(value(name) ?? "");
        if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) throw new RangeError("Invalid daylight time.");
        return Number(match[1]) * 3600 + Number(match[2]) * 60;
      };
      const options = validateCalendarWorldOptions({ ...readCalendarWorldOptions(), integration: value("integration"),
        combatPause: value("combatPause"), playerView: checked("playerView"),
        controlRoles: Array.from(this.element.querySelectorAll('[name="controlRoles"]:checked'), input => Number(input.value)),
        controlUsers: Array.from(this.element.querySelectorAll('[name="controlUsers"]:checked'), input => input.value),
        daylight: Object.fromEntries(["Autumn", "Winter", "Spring", "Summer"].map(season => [season, [time(`${season}-sunrise`), time(`${season}-sunset`)]])) });
      await this.service.change({ type: "configure", options, speed: calendarClockSpeed(Number(value("speed"))) });
    }
    await game.settings.set(MODULE_ID, "calendarClientOptions", preferences);
    await this.close();
  }
  export() {
    if (!game.user?.isGM) return;
    const blob = new Blob([JSON.stringify(this.service.exportConfiguration(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = "symbaroum-calendar.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async import() {
    if (!game.user?.isGM) return;
    const text = this.element.querySelector('[name="calendarImport"]')?.value ?? "";
    if (text.length > 262144) throw new RangeError("Calendar backup too large.");
    const input = JSON.parse(text);
    const data = validateCalendarBackup(input);
    calendarClockSpeed(data.speed);
    const confirmed = await foundry.applications.api.DialogV2.confirm({ window: { title: label("Import") },
      content: `<p>${escapeHtml(label("ImportConfirmation"))}</p>`, rejectClose: false });
    if (confirmed !== true) return;
    await this.service.change({ type: "import", backup: { ...data, format: input.format, version: input.version } });
    await this.close();
  }
}
