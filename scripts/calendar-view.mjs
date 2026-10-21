import { escapeHtml } from "./utils.mjs";
import {
  SYMBAROUM_MONTHS, CALENDAR_WEEKDAYS, MAX_CALENDAR_YEAR,
  calendarMonthDays, calendarMoon, calendarSeason, calendarClock, calendarDayPeriod
} from "./calendar-date.mjs";

const label = key => game.i18n.localize(`TENEBRE.Calendar.${key}`);
const sameDate = (a, b) => a && b && a.year === b.year && a.month === b.month && a.day === b.day;

export function buildCalendarClockToggle(running, paused, sidebar = false) {
  const action = running ? "PauseClock" : "StartClock";
  const hint = running && paused ? "ClockGamePaused" : action;
  return `<button type="button" ${sidebar ? 'data-calendar-action="toggleClock"' : 'data-action="toggleClock"'} class="tenebre-clock-toggle${running && !paused ? " is-running" : ""}" aria-pressed="${running}" aria-label="${escapeHtml(label(action))}" title="${escapeHtml(label(hint))}">${running ? "Ⅱ" : "▶"}</button>`;
}

export function buildCalendarClock(worldTime, isGM, running = false, paused = false) {
  const clock = calendarClock(worldTime);
  const control = (seconds, text, key) => `<button type="button" data-action="changeTime" data-seconds="${seconds}" title="${escapeHtml(label(key))}" aria-label="${escapeHtml(label(key))}">${text}</button>`;
  return `<div class="tenebre-calendar-clock" aria-label="${escapeHtml(label("WorldTime"))}">
    ${isGM ? `<div class="tenebre-clock-controls">${control(-3600, "−1h", "RewindHour")}${control(-600, "−10m", "RewindMinutes")}</div>` : ""}
    <div class="tenebre-clock-display"><svg class="tenebre-clock-face" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 3v1m0 16v1M3 12h1m16 0h1"/><path data-calendar-hand="hour" d="M12 12V7" transform="rotate(${clock.hourAngle} 12 12)"/><path data-calendar-hand="minute" d="M12 12V5" transform="rotate(${clock.minuteAngle} 12 12)"/><circle cx="12" cy="12" r=".7" fill="currentColor"/></svg><time data-calendar-time datetime="${clock.fullText}">${clock.fullText}</time></div>
    ${isGM ? `<div class="tenebre-clock-controls">${control(600, "+10m", "AdvanceMinutes")}${control(3600, "+1h", "AdvanceHour")}${buildCalendarClockToggle(running, paused)}</div>` : ""}
  </div>`;
}

/** Update live time indicators without replacing calendar controls or their focus. */
export function updateCalendarClock(element, worldTime, currentDate = null) {
  const clock = calendarClock(worldTime);
  for (const time of element?.querySelectorAll?.("[data-calendar-time]") ?? []) {
    if (time.textContent !== clock.fullText) {
      time.textContent = clock.fullText;
      time.setAttribute("datetime", clock.fullText);
    }
  }
  for (const hand of element?.querySelectorAll?.("[data-calendar-hand]") ?? []) {
    const angle = hand.dataset.calendarHand === "hour" ? clock.hourAngle : clock.minuteAngle;
    const transform = `rotate(${angle} 12 12)`;
    if (hand.getAttribute("transform") !== transform) hand.setAttribute("transform", transform);
  }
  if (currentDate) {
    const sky = calendarSkyContent(currentDate, worldTime);
    for (const indicator of element?.querySelectorAll?.("[data-calendar-sky]") ?? []) {
      if (indicator.dataset.calendarSky === sky.key) continue;
      indicator.dataset.calendarSky = sky.key;
      indicator.className = `tenebre-sky tenebre-sky-${sky.period.toLowerCase()}`;
      indicator.title = sky.title;
      indicator.innerHTML = sky.html;
    }
  }
}

export function formatCalendarDate(date) {
  return date ? game.i18n.format("TENEBRE.Calendar.Date", {
    day: date.day, month: SYMBAROUM_MONTHS[date.month - 1], year: date.year
  }) : label("Undefined");
}

/** Original vector drawings; no external icon assets or fonts required. */
export function calendarMoonIcon(phase) {
  const paths = {
    WaxingCrescent: "M12 3A9 9 0 0 1 12 21A6 9 0 0 0 12 3Z",
    FirstQuarter: "M12 3A9 9 0 0 1 12 21Z",
    WaxingGibbous: "M12 3A9 9 0 0 1 12 21A6 9 0 0 1 12 3Z",
    WaningGibbous: "M12 3A9 9 0 0 0 12 21A6 9 0 0 0 12 3Z",
    LastQuarter: "M12 3A9 9 0 0 0 12 21Z",
    WaningCrescent: "M12 3A9 9 0 0 0 12 21A6 9 0 0 1 12 3Z"
  };
  const light = phase === "Full" ? '<circle cx="12" cy="12" r="9" fill="currentColor"/>'
    : paths[phase] ? `<path d="${paths[phase]}" fill="currentColor"/>` : "";
  return `<svg class="tenebre-moon-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#161922" stroke="currentColor" stroke-width="1.2"/>${light}</svg>`;
}

export function calendarSeasonIcon(season) {
  const shapes = {
    Summer: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
    Autumn: '<path d="M20 3C9 2 3 6 4 13c1 6 11 10 15 1 2-4 0-7 1-11ZM4 21 16 8M9 16v-5m0 5h5"/>',
    Winter: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1-1-4M20 14l-4 1 1 4M7 19l1-4-4-1M17 5l-1 4 4 1"/>',
    Spring: '<path d="M12 22V11M12 15C4 15 2 10 3 5c7-1 10 3 9 10ZM12 11c0-7 4-9 9-9 1 6-3 10-9 9Z"/>'
  };
  return `<svg class="tenebre-season-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[season] ?? ""}</svg>`;
}

function calendarDaylightIcon(period) {
  const shape = period === "Day"
    ? '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>'
    : `<path d="M2 17h20M5 17a7 7 0 0 1 14 0M3 10l2 1m14 0 2-1M5 5l2 2m10 0 2-2M12 2v7${period === "Dawn" ? "m-3-4 3-3 3 3" : "m-3-3 3 3 3-3"}"/>`;
  return `<svg class="tenebre-sky-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shape}</svg>`;
}

function calendarSkyContent(date, worldTime) {
  const period = calendarDayPeriod(worldTime);
  const phase = period === "Night" ? calendarMoon(date).phase : null;
  const text = phase ? label(`Phases.${phase}`) : label(`DayPeriods.${period}`);
  return {
    period, key: `${period}:${phase ?? ""}`,
    title: phase ? label("Moon") : label("DayPeriod"),
    html: `${phase ? calendarMoonIcon(phase) : calendarDaylightIcon(period)}<span>${escapeHtml(text)}</span>`
  };
}

export function buildCalendarSky(date, worldTime) {
  const sky = calendarSkyContent(date, worldTime);
  return `<span class="tenebre-sky tenebre-sky-${sky.period.toLowerCase()}" data-calendar-sky="${sky.key}" title="${escapeHtml(sky.title)}">${sky.html}</span>`;
}

export function buildCalendarAlmanac(date, worldTime = null) {
  if (!date) return "";
  const season = calendarSeason(date), moon = calendarMoon(date);
  return `<span class="tenebre-season tenebre-season-${season.toLowerCase()}" title="${escapeHtml(label("Season"))}">${calendarSeasonIcon(season)}<span>${escapeHtml(label(`Seasons.${season}`))}</span></span>
    ${worldTime === null ? `<span class="tenebre-moon" title="${escapeHtml(label("Moon"))}">${calendarMoonIcon(moon.phase)}<span>${escapeHtml(label(`Phases.${moon.phase}`))}</span></span>` : buildCalendarSky(date, worldTime)}`;
}

export function buildCalendarPage({ current, selected, view, isGM, worldTime = game.time.worldTime, running = false, paused = false }) {
  const grid = calendarMonthDays(view.year, view.month);
  const options = SYMBAROUM_MONTHS.map((name, i) => `<option value="${i + 1}"${view.month === i + 1 ? " selected" : ""}>${escapeHtml(name)}</option>`).join("");
  const headings = CALENDAR_WEEKDAYS.map(key => `<span class="tenebre-weekday" role="columnheader" title="${escapeHtml(label(`Weekdays.${key}`))}">${escapeHtml(label(`WeekdaysShort.${key}`))}</span>`).join("");
  const cells = grid.days.map(date => {
    const today = sameDate(date, current), picked = sameDate(date, selected);
    const tooltip = `${formatCalendarDate(date)} · ${label(`Weekdays.${date.weekday}`)} · ${label(`Phases.${date.moon.phase}`)}`;
    return `<button type="button" role="gridcell" class="tenebre-month-day${today ? " is-today" : ""}${picked ? " is-selected" : ""}" data-action="selectDay" data-day="${date.day}" aria-selected="${Boolean(picked)}"${today ? ' aria-current="date"' : ""} title="${escapeHtml(tooltip)}" aria-label="${escapeHtml(tooltip)}"><span class="tenebre-day-number">${date.day}</span>${calendarMoonIcon(date.moon.phase)}${today ? `<span class="tenebre-today-mark" aria-hidden="true"></span>` : ""}</button>`;
  });
  const blanks = Array.from({ length: grid.offset }, () => '<span class="tenebre-month-blank" role="gridcell" aria-disabled="true"></span>');
  const allCells = [...blanks, ...cells];
  while (allCells.length % 7) allCells.push('<span class="tenebre-month-blank" role="gridcell" aria-disabled="true"></span>');
  const rows = Array.from({ length: allCells.length / 7 }, (_, i) => `<div class="tenebre-week-row" role="row">${allCells.slice(i * 7, i * 7 + 7).join("")}</div>`).join("");
  const atStart = view.year === 0 && view.month === 1, atEnd = view.year === MAX_CALENDAR_YEAR && view.month === 12;
  return `<section class="tenebre-calendar-page">
    <header class="tenebre-calendar-world"><span class="tenebre-calendar-eyebrow">${escapeHtml(label("WorldDate"))}</span><strong>${escapeHtml(formatCalendarDate(current))}</strong><div class="tenebre-calendar-almanac">${buildCalendarAlmanac(current, worldTime)}</div>${buildCalendarClock(worldTime, isGM, running, paused)}</header>
    <nav class="tenebre-calendar-navigation" aria-label="${escapeHtml(label("Browse"))}">
      <button type="button" data-action="previousMonth" aria-label="${escapeHtml(label("PreviousMonth"))}" title="${escapeHtml(label("PreviousMonth"))}"${atStart ? " disabled" : ""}>‹</button>
      <select name="calendarMonth" aria-label="${escapeHtml(label("Month"))}">${options}</select>
      <input name="calendarYear" aria-label="${escapeHtml(label("Year"))}" type="number" min="0" max="${MAX_CALENDAR_YEAR}" step="1" required value="${view.year}">
      <button type="button" data-action="nextMonth" aria-label="${escapeHtml(label("NextMonth"))}" title="${escapeHtml(label("NextMonth"))}"${atEnd ? " disabled" : ""}>›</button>
    </nav>
    <div class="tenebre-calendar-grid" role="grid" aria-label="${escapeHtml(`${SYMBAROUM_MONTHS[view.month - 1]}, ${view.year}`)}"><div class="tenebre-week-row tenebre-week-headings" role="row">${headings}</div>${rows}</div>
    <section class="tenebre-calendar-selection" aria-label="${escapeHtml(label("SelectedDate"))}"><span class="tenebre-calendar-eyebrow">${escapeHtml(label("SelectedDate"))}</span><strong>${escapeHtml(formatCalendarDate(selected))}</strong><div class="tenebre-calendar-almanac">${buildCalendarAlmanac(selected)}</div></section>
    <footer class="tenebre-calendar-footer"><button type="button" data-action="today">${escapeHtml(label("Today"))}</button>${isGM ? `<button type="button" class="tenebre-calendar-apply" data-action="applyDate"${sameDate(selected, current) ? " disabled" : ""}>${escapeHtml(label("ApplyDate"))}</button>` : `<span class="tenebre-calendar-readonly">${escapeHtml(label("ReadOnly"))}</span>`}</footer>
    ${isGM ? `<p class="tenebre-calendar-time-hint">${escapeHtml(label("ApplyHint"))}</p>` : ""}
  </section>`;
}
