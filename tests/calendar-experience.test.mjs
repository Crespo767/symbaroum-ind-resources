import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { CALENDAR_WORLD_DEFAULTS, validateCalendarWorldOptions, validateCalendarClientOptions, calendarDaylight,
  calendarPresetDelta, calendarIntervalSeconds, calendarUserCanControl, calendarPausesForCombat, formatCalendarTime } from "../scripts/calendar-options.mjs";
import { buildCalendarExperience } from "../scripts/calendar-experience-view.mjs";
import { buildCalendarConfiguration } from "../scripts/calendar-configuration.mjs";

const languages = Object.fromEntries(["pt-BR", "en"].map(lang => [lang, JSON.parse(fs.readFileSync(new URL(`../languages/${lang}.json`, import.meta.url), "utf8"))]));
function locale(lang = "pt-BR") {
  globalThis.game = { i18n: { localize: key => languages[lang][key] ?? key,
    format: (key, data) => (languages[lang][key] ?? key).replace(/\{(\w+)\}/g, (_, key) => data[key]) } };
}
const date = { year: 22, month: 8, day: 5 };

test("calendar options validate all boundaries and discard unknown privileged keys", () => {
  assert.equal(validateCalendarWorldOptions().integration, "mixed");
  assert.equal(validateCalendarWorldOptions({ arbitrarySetting: "bad" }).arbitrarySetting, undefined);
  for (const input of [{ integration: "bad" }, { combatPause: "bad" }, { playerView: "true" }, { controlRoles: [4] },
    { controlUsers: ["<script>"] }, { daylight: {} }]) assert.throws(() => validateCalendarWorldOptions(input), RangeError);
  for (const input of [{ mode: "bad" }, { theme: '<img>' }, { scale: 201 }, { firstWeekday: 7 }, { hour12: "true" },
    { position: { left: Infinity } }]) assert.throws(() => validateCalendarClientOptions(input), RangeError);
});

test("calendar permissions require an active authorized user", () => {
  const options = validateCalendarWorldOptions({ controlRoles: [2], controlUsers: ["user"] });
  assert.equal(calendarUserCanControl({ active: false, isGM: true }, options), false);
  assert.equal(calendarUserCanControl({ active: true, id: "user", role: 1 }, options), true);
  assert.equal(calendarUserCanControl({ active: true, id: "other", role: 2 }, options), true);
  assert.equal(calendarUserCanControl({ active: true, id: "other", role: 1 }, options), false);
});

test("combat rules distinguish started, off-scene and global encounters", () => {
  assert.equal(calendarPausesForCombat([{ started: false }], "scene", "any"), false);
  assert.equal(calendarPausesForCombat([{ started: true, scene: { id: "other" } }], "scene", "active"), false);
  assert.equal(calendarPausesForCombat([{ started: true, scene: { id: "other" } }], "scene", "any"), true);
  assert.equal(calendarPausesForCombat([{ started: true, scene: null }], "scene", "active"), true);
  assert.equal(calendarPausesForCombat([{ started: true }], "scene", "never"), false);
});

test("daylight interpolates season starts and wraps the year with the Symbaroum preset", () => {
  const daylight = { Autumn: [21600, 64800], Winter: [32400, 54000], Spring: [21600, 64800], Summer: [10800, 75600] };
  assert.deepEqual(calendarDaylight({ year: 22, month: 2, day: 1 }, daylight), { sunrise: 21600, sunset: 64800, season: "Autumn" });
  assert.equal(calendarDaylight({ year: 22, month: 3, day: 16 }, daylight).sunrise, 27000);
  assert.equal(calendarDaylight({ year: 22, month: 1, day: 1 }, daylight).sunrise, 18000);
  for (let month = 1; month <= 12; month++) {
    assert.equal(calendarDaylight({ year: 22, month, day: 1 }).sunrise, 21600);
    assert.equal(calendarDaylight({ year: 22, month, day: 30 }).sunset, 64800);
  }
});

test("time presets always move forward, with tomorrow's interpolated sunrise", () => {
  const options = validateCalendarWorldOptions();
  assert.equal(calendarPresetDelta(date, 5 * 3600, "sunrise", options), 3600);
  assert.equal(calendarPresetDelta(date, 6 * 3600, "sunrise", options), 86400);
  assert.equal(calendarPresetDelta(date, 23 * 3600, "midnight", options), 3600);
  assert.throws(() => calendarPresetDelta(date, 0, "unknown", options), RangeError);
});

test("intervals use native round length and fixed Symbaroum months and years", () => {
  assert.equal(calendarIntervalSeconds("round", 5, 10), 50);
  assert.equal(calendarIntervalSeconds("month", -1), -30 * 86400);
  assert.equal(calendarIntervalSeconds("year", 1), 360 * 86400);
  for (const amount of [0, Infinity, 0.5, "1", 10000]) assert.throws(() => calendarIntervalSeconds("day", amount), RangeError);
});

test("Foundry's zero round duration never blocks other calendar units", () => {
  for (const [unit, seconds] of [["second", 1], ["minute", 60], ["hour", 3600], ["day", 86400], ["month", 30 * 86400], ["year", 360 * 86400]]) {
    assert.equal(calendarIntervalSeconds(unit, 1, 0), seconds);
    assert.equal(calendarIntervalSeconds(unit, -5, 0), -5 * seconds);
  }
  assert.equal(calendarIntervalSeconds("round", 1, 0), 0, "zero native round time remains a valid no-op");
  assert.equal(calendarIntervalSeconds("day", 1, NaN), 86400, "unused round data cannot invalidate a day interval");
  for (const seconds of [-1, NaN, Infinity, "6", 86401]) assert.throws(() => calendarIntervalSeconds("round", 1, seconds), RangeError);
});

test("12-hour display supports seconds, midnight, noon and negative timestamps", () => {
  assert.equal(formatCalendarTime(0, { hour12: true, seconds: true }), "12:00:00 AM");
  assert.equal(formatCalendarTime(43200, { hour12: true, seconds: false }), "12:00 PM");
  assert.equal(formatCalendarTime(-1, { hour12: false, seconds: true }), "23:59:59");
});

test("date details are optional and applying a date appears only for a different selection", () => {
  locale();
  const args = { current: date, selected: date, view: date, time: 51300, canControl: true, worldOptions: CALENDAR_WORLD_DEFAULTS };
  const current = buildCalendarExperience(args);
  assert.doesNotMatch(current, /class="tenebre-ex-details"|data-action="applyDate"/);
  assert.match(current, /data-action="calendarDetails"[^>]*aria-expanded="false"/);
  assert.match(current, /<aside class="tenebre-ex-toolbar"/);
  const details = buildCalendarExperience({ ...args, detailsOpen: true });
  assert.match(details, /class="tenebre-ex-details"/);
  assert.match(details, /Nascer do sol 06:00/);
  assert.match(details, /Lua cheia:/);
  const picked = { ...args, selected: { ...date, day: 6 } };
  assert.equal((buildCalendarExperience(picked).match(/data-action="applyDate"/g) ?? []).length, 1);
  assert.doesNotMatch(buildCalendarExperience({ ...picked, canControl: false }), /data-action="applyDate"/);
});

for (const lang of ["pt-BR", "en"]) {
  for (const mode of ["full", "compact", "year"]) {
    test(`${lang}: ${mode} view exposes consultation separately from mutation and contains no notes`, () => {
      locale(lang);
      const args = { current: date, selected: { ...date, day: 6 }, view: date, time: 51300, status: "paused",
        preferences: { mode }, worldOptions: CALENDAR_WORLD_DEFAULTS };
      const player = buildCalendarExperience({ ...args, canControl: false });
      assert.doesNotMatch(player, /TENEBRE\.|data-action="(?:timeInterval|timePreset|toggleClock|applyDate)"|data-action="[^"]*note/i);
      const gm = buildCalendarExperience({ ...args, canControl: true });
      assert.match(gm, /data-action="timeInterval"/);
      assert.match(gm, /is-paused/);
      assert.equal((gm.match(/data-action="selectDay"/g) ?? []).length, mode === "compact" ? 0 : mode === "year" ? 360 : 30);
      if (mode !== "compact") assert.match(gm, /aria-current="date"/);
    });
  }
  test(`${lang}: configuration keeps world options and backup controls away from players`, () => {
    locale(lang);
    const args = { client: validateCalendarClientOptions(), world: validateCalendarWorldOptions(), speed: 1,
      users: [{ id: "user", name: '<script> & Player' }] };
    const player = buildCalendarConfiguration({ ...args, isGM: false });
    assert.doesNotMatch(player, /TENEBRE\.|data-calendar-world|exportCalendar|importCalendar/);
    const gm = buildCalendarConfiguration({ ...args, isGM: true });
    assert.doesNotMatch(gm, /TENEBRE\.|<script>/);
    assert.match(gm, /&lt;script&gt; &amp; Player/);
    assert.match(gm, /data-calendar-world/);
  });
}
