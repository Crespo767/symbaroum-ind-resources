// Month order and lengths follow the Symbaroum preset studied in Simple Calendar.
export const SYMBAROUM_MONTHS = Object.freeze([
  "Ynedar", "Olandan", "Adonia", "Tomol", "Serliela", "Morangal",
  "Ofelya", "Agani", "Elisal", "Verion", "Konelia", "Leandro"
]);
export const MAX_CALENDAR_YEAR = 9999;
export const CALENDAR_DAY_SECONDS = 86400;

export function calendarClockSpeed(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0.01 || value > 86400) {
    throw new RangeError("Clock speed must be between 0.01 and 86400.");
  }
  return value;
}

export function calendarClock(worldTime) {
  if (!Number.isFinite(worldTime)) throw new RangeError("Invalid world time.");
  const seconds = ((Math.floor(worldTime) % CALENDAR_DAY_SECONDS) + CALENDAR_DAY_SECONDS) % CALENDAR_DAY_SECONDS;
  const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds / 60) % 60, second = seconds % 60;
  const text = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return {
    hours, minutes, seconds: second, text,
    fullText: `${text}:${String(second).padStart(2, "0")}`,
    hourAngle: (hours % 12) * 30 + minutes / 2 + second / 120,
    minuteAngle: minutes * 6 + second / 10
  };
}

export function calendarTimeDelta(worldTime, hours, minutes) {
  calendarClock(worldTime);
  if (!Number.isInteger(hours) || hours < 0 || hours > 23
    || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) throw new RangeError("Invalid clock time.");
  return Math.floor(worldTime / CALENDAR_DAY_SECONDS) * CALENDAR_DAY_SECONDS + hours * 3600 + minutes * 60 - worldTime;
}

/** Public dates use one-based months and days. Year zero is supported. */
export function validateCalendarDate(date) {
  if (!date || !Number.isInteger(date.year) || date.year < 0 || date.year > MAX_CALENDAR_YEAR
    || !Number.isInteger(date.month) || date.month < 1 || date.month > 12
    || !Number.isInteger(date.day) || date.day < 1 || date.day > 30) {
    throw new RangeError("Invalid Symbaroum calendar date.");
  }
  return { year: date.year, month: date.month, day: date.day };
}

export function advanceCalendarDate(date, days) {
  const { year, month, day } = validateCalendarDate(date);
  if (!Number.isSafeInteger(days)) throw new RangeError("Invalid day interval.");
  const total = year * 360 + (month - 1) * 30 + day - 1 + days;
  if (!Number.isSafeInteger(total) || total < 0 || total >= (MAX_CALENDAR_YEAR + 1) * 360) {
    throw new RangeError("Calendar date out of range.");
  }
  return { year: Math.floor(total / 360), month: Math.floor((total % 360) / 30) + 1, day: total % 30 + 1 };
}

export function calendarDayNumber(date) {
  const { year, month, day } = validateCalendarDate(date);
  return year * 360 + (month - 1) * 30 + day - 1;
}

/** Anchor at the world's current midnight; elapsed hours retain their meaning. */
export function createCalendarAnchor(date, worldTime) {
  if (!Number.isFinite(worldTime)) throw new RangeError("Invalid world time.");
  return { ...validateCalendarDate(date), worldTime: Math.floor(worldTime / CALENDAR_DAY_SECONDS) * CALENDAR_DAY_SECONDS };
}

export function calendarDateAtTime(anchor, worldTime) {
  if (!Number.isFinite(anchor?.worldTime) || !Number.isFinite(worldTime)) throw new RangeError("Invalid calendar anchor.");
  return advanceCalendarDate(anchor, Math.floor((worldTime - anchor.worldTime) / CALENDAR_DAY_SECONDS));
}

export const CALENDAR_WEEKDAYS = Object.freeze(["Earth", "Water", "Wind", "Forest", "Mountain", "People", "Feast"]);
const MOON_PHASES = Object.freeze([
  [0, "New"], [1, "WaxingCrescent"], [7, "FirstQuarter"], [8, "WaxingGibbous"],
  [14, "Full"], [15, "WaningGibbous"], [21, "LastQuarter"], [22, "WaningCrescent"]
]);

/** Symbaroum preset: continuous 28-day cycle, new moon on 1 Ynedar, year zero. */
export function calendarMoon(date) {
  const cycleDay = calendarDayNumber(date) % 28;
  const phase = MOON_PHASES.findLast(([start]) => cycleDay >= start)[1];
  return { phase, cycleDay: cycleDay + 1 };
}

/** Preset season boundaries: Olandan, Serliela, Agani and Konelia, day one. */
export function calendarSeason(date) {
  const { month } = validateCalendarDate(date);
  if (month >= 2 && month <= 4) return "Autumn";
  if (month >= 5 && month <= 7) return "Winter";
  if (month >= 8 && month <= 10) return "Spring";
  return "Summer";
}

export function calendarMonthDays(year, month) {
  const first = validateCalendarDate({ year, month, day: 1 });
  return {
    offset: calendarDayNumber(first) % 7,
    days: Array.from({ length: 30 }, (_, i) => {
      const date = { year, month, day: i + 1 };
      return { ...date, weekday: CALENDAR_WEEKDAYS[calendarDayNumber(date) % 7], moon: calendarMoon(date), season: calendarSeason(date) };
    })
  };
}

export function shiftCalendarMonth(date, months) {
  validateCalendarDate(date);
  if (!Number.isInteger(months)) throw new RangeError("Invalid month interval.");
  const index = date.year * 12 + date.month - 1 + months;
  return validateCalendarDate({ year: Math.floor(index / 12), month: index % 12 + 1, day: date.day });
}
