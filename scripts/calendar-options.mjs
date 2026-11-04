import { MODULE_ID } from "./constants.mjs";
import { advanceCalendarDate, calendarClock, calendarSeason, validateCalendarDate } from "./calendar-date.mjs";

export const CALENDAR_WORLD_DEFAULTS = Object.freeze({ integration: "mixed", combatPause: "never", playerView: true,
  controlRoles: [], controlUsers: [], daylight: { Autumn: [21600, 64800], Winter: [21600, 64800], Spring: [21600, 64800], Summer: [21600, 64800] } });
export const CALENDAR_CLIENT_DEFAULTS = Object.freeze({ mode: "full", theme: "dark", layout: "full", scale: 100,
  openOnLoad: false, rememberPosition: true, showClock: true, hour12: false, seconds: true, firstWeekday: 0,
  showWeekdays: true, chatTimestamp: false, position: {}, compactPosition: {} });
export const CALENDAR_UNITS = Object.freeze({ second: 1, round: null, minute: 60, hour: 3600, day: 86400, month: 2592000, year: 31104000 });

export function validateCalendarWorldOptions(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new RangeError("Invalid calendar options.");
  const v = { ...CALENDAR_WORLD_DEFAULTS, ...input };
  if (!["mixed", "self", "none", "third-party"].includes(v.integration) || !["never", "active", "any"].includes(v.combatPause)
    || typeof v.playerView !== "boolean") throw new RangeError("Invalid calendar integration.");
  if (!Array.isArray(v.controlRoles) || v.controlRoles.length > 3 || v.controlRoles.some(role => ![1, 2, 3].includes(role))
    || !Array.isArray(v.controlUsers) || v.controlUsers.length > 100
    || v.controlUsers.some(id => typeof id !== "string" || !/^[\w-]{1,64}$/.test(id))) throw new RangeError("Invalid calendar permissions.");
  const daylight = {};
  for (const season of ["Autumn", "Winter", "Spring", "Summer"]) {
    const times = v.daylight?.[season];
    if (!Array.isArray(times) || times.length !== 2 || times.some(time => !Number.isInteger(time) || time < 0 || time >= 86400)
      || times[0] >= times[1]) throw new RangeError("Invalid seasonal daylight.");
    daylight[season] = [...times];
  }
  return { integration: v.integration, combatPause: v.combatPause, playerView: v.playerView,
    controlRoles: [...new Set(v.controlRoles)], controlUsers: [...new Set(v.controlUsers)], daylight };
}

export function validateCalendarClientOptions(input = {}) {
  const v = { ...CALENDAR_CLIENT_DEFAULTS, ...input };
  if (!["full", "compact", "year"].includes(v.mode) || !["dark", "light", "classic"].includes(v.theme)
    || !["full", "quick", "hidden"].includes(v.layout) || !Number.isInteger(v.scale) || v.scale < 70 || v.scale > 200
    || !Number.isInteger(v.firstWeekday) || v.firstWeekday < 0 || v.firstWeekday > 6) throw new RangeError("Invalid calendar display.");
  const result = { mode: v.mode, theme: v.theme, layout: v.layout, scale: v.scale, firstWeekday: v.firstWeekday };
  for (const key of ["openOnLoad", "rememberPosition", "showClock", "hour12", "seconds", "showWeekdays", "chatTimestamp"]) {
    if (typeof v[key] !== "boolean") throw new RangeError("Invalid calendar preference.");
    result[key] = v[key];
  }
  for (const key of ["position", "compactPosition"]) {
    result[key] = {};
    for (const axis of ["left", "top"]) {
      const n = v[key]?.[axis];
      if (n !== undefined) {
        if (!Number.isFinite(n) || Math.abs(n) > 100000) throw new RangeError("Invalid calendar position.");
        result[key][axis] = n;
      }
    }
  }
  return result;
}

export function readCalendarWorldOptions(settings = globalThis.game?.settings) {
  try { return validateCalendarWorldOptions(settings?.get(MODULE_ID, "calendarWorldOptions") ?? {}); }
  catch { return validateCalendarWorldOptions(); }
}
export function readCalendarClientOptions(settings = globalThis.game?.settings) {
  try { return validateCalendarClientOptions(settings?.get(MODULE_ID, "calendarClientOptions") ?? {}); }
  catch { return validateCalendarClientOptions(); }
}
export function calendarUserCanControl(user, options = readCalendarWorldOptions()) {
  return Boolean(user?.active && (user.isGM || options.controlRoles.includes(user.role) || options.controlUsers.includes(user.id)));
}
export function calendarPausesForCombat(combats, sceneId, rule) {
  return rule !== "never" && Array.from(combats ?? []).some(combat => combat.started
    && (rule === "any" || combat.scene?.id === sceneId || !combat.scene));
}

/** Same linear interpolation between season boundaries used by the reference calendar. */
export function calendarDaylight(date, daylight = CALENDAR_WORLD_DEFAULTS.daylight) {
  validateCalendarDate(date);
  const index = (date.month - 1) * 30 + date.day - 1;
  const season = calendarSeason(date);
  const entries = [[30, "Autumn"], [120, "Winter"], [210, "Spring"], [300, "Summer"]];
  const position = entries.findIndex(([, name]) => name === season);
  const start = entries[position][0], next = entries[(position + 1) % 4][1];
  const fraction = ((index - start + 360) % 360) / 90;
  const [sunrise, sunset] = daylight[season].map((value, i) => Math.round(value + (daylight[next][i] - value) * fraction));
  return { sunrise, sunset, season };
}
export function calendarPresetDelta(date, time, preset, options = readCalendarWorldOptions()) {
  if (!["sunrise", "midday", "sunset", "midnight"].includes(preset)) throw new RangeError("Invalid time preset.");
  const withinDay = ((time % 86400) + 86400) % 86400;
  const desired = day => preset === "midday" ? 43200 : preset === "midnight" ? 0 : calendarDaylight(day, options.daylight)[preset];
  let next = desired(date);
  if (next <= withinDay) next = 86400 + desired(advanceCalendarDate(date, 1));
  return next - withinDay;
}
export function calendarIntervalSeconds(unit, amount, roundTime = 6) {
  if (!Object.hasOwn(CALENDAR_UNITS, unit) || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 9999
    || (unit === "round" && (!Number.isFinite(roundTime) || roundTime < 0 || roundTime > 86400))) throw new RangeError("Invalid calendar interval.");
  return amount * (unit === "round" ? roundTime : CALENDAR_UNITS[unit]);
}
export function formatCalendarTime(time, preferences = CALENDAR_CLIENT_DEFAULTS) {
  const clock = calendarClock(time);
  const hours = preferences.hour12 ? (clock.hours % 12 || 12) : clock.hours;
  return `${String(hours).padStart(2, "0")}:${String(clock.minutes).padStart(2, "0")}${preferences.seconds ? `:${String(clock.seconds).padStart(2, "0")}` : ""}${preferences.hour12 ? (clock.hours < 12 ? " AM" : " PM") : ""}`;
}
export function validateCalendarBackup(input) {
  if (!input || input.format !== "symbaroum-ind-resources-calendar" || input.version !== 1) throw new RangeError("Invalid calendar backup.");
  if (!Number.isFinite(input.time) || Math.abs(input.time) > Number.MAX_SAFE_INTEGER / 2) throw new RangeError("Invalid backup time.");
  return { date: input.date ? validateCalendarDate(input.date) : null, time: input.time,
    options: validateCalendarWorldOptions(input.options), speed: input.speed };
}
