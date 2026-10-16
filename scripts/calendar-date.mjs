// Month order and lengths follow the Symbaroum preset studied in Simple Calendar.
export const SYMBAROUM_MONTHS = Object.freeze([
  "Ynedar", "Olandan", "Adonia", "Tomol", "Serliela", "Morangal",
  "Ofelya", "Agani", "Elisal", "Verion", "Konelia", "Leandro"
]);
export const MAX_CALENDAR_YEAR = 9999;
export const CALENDAR_DAY_SECONDS = 86400;

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
