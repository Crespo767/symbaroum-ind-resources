import { escapeHtml } from "./utils.mjs";
import { SYMBAROUM_MONTHS, CALENDAR_WEEKDAYS, calendarMonthDays, calendarMoon, calendarSeason, calendarDayNumber, advanceCalendarDate } from "./calendar-date.mjs";
import { calendarMoonIcon, calendarSeasonIcon, formatCalendarDate } from "./calendar-view.mjs";
import { CALENDAR_UNITS, calendarDaylight, formatCalendarTime, validateCalendarClientOptions } from "./calendar-options.mjs";

const label = key => game.i18n.localize(`TENEBRE.Calendar.${key}`);
const same = (a, b) => a && b && a.year === b.year && a.month === b.month && a.day === b.day;
const button = (action, text, key, extra = "") => `<button type="button" data-action="${action}" title="${escapeHtml(label(key))}" aria-label="${escapeHtml(label(key))}" ${extra}>${text}</button>`;
const timeText = seconds => formatCalendarTime(seconds, { hour12: false, seconds: false });

export function buildExperienceMonth({ year, month, current, selected, preferences, mini = false }) {
  const grid = calendarMonthDays(year, month);
  const weekdays = CALENDAR_WEEKDAYS.map((_, i) => CALENDAR_WEEKDAYS[(i + preferences.firstWeekday) % 7]);
  const offset = (grid.offset - preferences.firstWeekday + 7) % 7;
  const headings = preferences.showWeekdays ? `<div class="tenebre-ex-week">${weekdays.map(key => `<span role="columnheader" title="${escapeHtml(label(`Weekdays.${key}`))}">${escapeHtml(label(`WeekdaysShort.${key}`))}</span>`).join("")}</div>` : "";
  const cells = Array.from({ length: offset }, () => '<span class="tenebre-ex-blank" aria-hidden="true"></span>');
  for (const date of grid.days) {
    const today = same(date, current), picked = same(date, selected);
    const moon = ["New", "FirstQuarter", "Full", "LastQuarter"].includes(date.moon.phase) || today || picked;
    const title = `${formatCalendarDate(date)} · ${label(`Weekdays.${date.weekday}`)} · ${label(`Phases.${date.moon.phase}`)}`;
    cells.push(`<button type="button" role="gridcell" class="tenebre-ex-day${today ? " is-today" : ""}${picked ? " is-selected" : ""}" data-action="selectDay" data-year="${year}" data-month="${month}" data-day="${date.day}" aria-selected="${Boolean(picked)}"${today ? ' aria-current="date"' : ""} title="${escapeHtml(title)}"><span>${date.day}</span>${!mini && moon ? calendarMoonIcon(date.moon.phase) : ""}</button>`);
  }
  while (cells.length % 7) cells.push('<span class="tenebre-ex-blank" aria-hidden="true"></span>');
  const rows = Array.from({ length: cells.length / 7 }, (_, i) => `<div class="tenebre-ex-week" role="row">${cells.slice(i * 7, i * 7 + 7).join("")}</div>`).join("");
  return `<section class="tenebre-ex-month${mini ? " is-mini" : ""}" role="grid" aria-label="${escapeHtml(`${SYMBAROUM_MONTHS[month - 1]}, ${year}`)}">${mini ? `<h4>${escapeHtml(SYMBAROUM_MONTHS[month - 1])}</h4>` : ""}${headings}${rows}</section>`;
}

export function buildExperienceControls({ canControl, preferences, unit = "minute", reverse = false, larger = false }) {
  if (!canControl || preferences.layout === "hidden") return "";
  const presets = [["sunrise", "☀↑", "Sunrise"], ["midday", "☀", "Midday"], ["sunset", "☀↓", "Sunset"], ["midnight", "☾", "Midnight"]]
    .map(([preset, icon, key]) => button("timePreset", icon, key, `data-preset="${preset}"`)).join("");
  const main = preferences.layout === "full"
    ? `${button("timeInterval", "«", "BackFive", 'data-amount="-5"')}${button("timeInterval", "‹", "BackOne", 'data-amount="-1"')}<select name="calendarUnit" aria-label="${escapeHtml(label("Unit"))}">${Object.keys(CALENDAR_UNITS).map(key => `<option value="${key}"${unit === key ? " selected" : ""}>${escapeHtml(label(`Units.${key}`))}</option>`).join("")}</select>${button("timeInterval", "›", "ForwardOne", 'data-amount="1"')}${button("timeInterval", "»", "ForwardFive", 'data-amount="5"')}`
    : `${button("reverseTime", reverse ? "−" : "+", "ReverseTime", `aria-pressed="${reverse}"`)}${button("largerSteps", "×5", "LargerSteps", `aria-pressed="${larger}"`)}${[["round", 1, "r"], ["minute", 1, "m"], ["minute", 5, "m"], ["minute", 15, "m"], ["hour", 1, "h"], ["day", 1, "d"]].map(([unit, amount, suffix]) => button("timeInterval", `${reverse ? "−" : "+"}${amount * (larger ? 5 : 1)}${suffix}`, `Units.${unit}`, `data-unit="${unit}" data-amount="${amount * (reverse ? -1 : 1) * (larger ? 5 : 1)}"`)).join("")}`;
  return `<div class="tenebre-ex-controls"><div class="tenebre-ex-stepper">${main}</div><div class="tenebre-ex-presets">${presets}${button("editDateTime", '<i class="fa-solid fa-pen" aria-hidden="true"></i>', "EditDateTime")}</div></div>`;
}

export function buildCalendarExperience({ current, selected, view, time, canControl, status = "stopped", suspended = false, preferences: input = {}, worldOptions, unit, reverse, larger }) {
  const preferences = validateCalendarClientOptions(input);
  const compact = preferences.mode === "compact", yearMode = preferences.mode === "year";
  const date = compact ? current : selected;
  const season = date ? calendarSeason(date) : null, moon = date ? calendarMoon(date) : null;
  const sky = date ? calendarDaylight(date, worldOptions?.daylight) : null;
  const toolbar = `<div class="tenebre-ex-toolbar"><strong>Symbaroum</strong><div role="group" aria-label="${escapeHtml(label("ViewMode"))}">${[["full", "fa-calendar-days", "MonthView"], ["year", "fa-table-cells", "YearView"], ["compact", "fa-window-minimize", "CompactView"]].map(([mode, icon, key]) => button("viewMode", `<i class="fa-solid ${icon}" aria-hidden="true"></i>`, key, `data-mode="${mode}" aria-pressed="${preferences.mode === mode}"`)).join("")}${button("calendarSettings", '<i class="fa-solid fa-gear" aria-hidden="true"></i>', "Configuration")}</div></div>`;
  const clock = preferences.showClock ? `<div class="tenebre-ex-clock"><span class="tenebre-ex-status is-${status}" title="${escapeHtml(label(`ClockStates.${status}`))}" role="status" aria-label="${escapeHtml(label(`ClockStates.${status}`))}"></span><time data-calendar-time data-calendar-hour12="${preferences.hour12}" data-calendar-seconds="${preferences.seconds}">${escapeHtml(formatCalendarTime(time, preferences))}</time>${canControl ? `${button("toggleClock", status === "running" ? "Ⅱ" : "▶", suspended ? "ClockSuspended" : status === "running" ? "PauseClock" : "StartClock", suspended ? "disabled" : "")}${button("stopClock", "■", "StopClock")}` : ""}</div>` : "";
  const almanac = season ? `<div class="tenebre-ex-almanac"><span>${calendarSeasonIcon(season)}${escapeHtml(label(`Seasons.${season}`))}</span><span>${calendarMoonIcon(moon.phase)}${escapeHtml(label(`Phases.${moon.phase}`))}</span></div>` : "";
  const controls = buildExperienceControls({ canControl, preferences, unit, reverse, larger });
  if (compact) return `<section class="tenebre-experience is-compact">${toolbar}<strong class="tenebre-ex-current">${escapeHtml(formatCalendarDate(current))}</strong>${almanac}${clock}${controls}</section>`;
  const nav = `<nav class="tenebre-ex-navigation">${button("previousPeriod", "‹", yearMode ? "PreviousYear" : "PreviousMonth", view.year === 0 && (yearMode || view.month === 1) ? "disabled" : "")}${yearMode ? `<span>${escapeHtml(label("YearView"))}</span>` : `<select name="calendarMonth" aria-label="${escapeHtml(label("Month"))}">${SYMBAROUM_MONTHS.map((name, i) => `<option value="${i + 1}"${view.month === i + 1 ? " selected" : ""}>${escapeHtml(name)}</option>`).join("")}</select>`}<input name="calendarYear" type="number" min="0" max="9999" value="${view.year}" required aria-label="${escapeHtml(label("Year"))}">${button("nextPeriod", "›", yearMode ? "NextYear" : "NextMonth", view.year === 9999 && (yearMode || view.month === 12) ? "disabled" : "")}</nav>`;
  const month = yearMode ? `<div class="tenebre-ex-year">${SYMBAROUM_MONTHS.map((_, i) => buildExperienceMonth({ year: view.year, month: i + 1, current, selected, preferences, mini: true })).join("")}</div>` : buildExperienceMonth({ ...view, current, selected, preferences });
  let nextMoons = "";
  if (date && calendarDayNumber(date) < 9999 * 360) {
    for (const phase of ["Full", "New"]) {
      for (let i = 1; i <= 28; i++) {
        const next = advanceCalendarDate(date, i);
        if (calendarMoon(next).phase === phase) { nextMoons += `<span>${calendarMoonIcon(phase)} ${escapeHtml(formatCalendarDate(next))}</span>`; break; }
      }
    }
  }
  return `<section class="tenebre-experience${yearMode ? " is-year" : ""}">${toolbar}<div class="tenebre-ex-current-row"><span>${escapeHtml(formatCalendarDate(current))}</span>${clock}</div>${nav}${month}<section class="tenebre-ex-details"><span class="tenebre-calendar-eyebrow">${escapeHtml(label("SelectedDate"))}</span><strong>${escapeHtml(formatCalendarDate(date))}</strong>${almanac}${sky ? `<div class="tenebre-ex-daylight"><span>☀↑ ${timeText(sky.sunrise)}</span><span>☀↓ ${timeText(sky.sunset)}</span></div>` : ""}<div class="tenebre-ex-next-moons" title="${escapeHtml(label("NextMoonPhases"))}">${nextMoons}</div></section>${controls}<footer class="tenebre-ex-footer">${button("today", escapeHtml(label("Today")), "Today")}${canControl ? button("applyDate", escapeHtml(label("ApplyDate")), "ApplyDate", same(current, selected) ? "disabled" : "") : `<span>${escapeHtml(label("ReadOnly"))}</span>`}</footer></section>`;
}
