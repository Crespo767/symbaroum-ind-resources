import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  advanceCalendarDate, validateCalendarDate, createCalendarAnchor, calendarDateAtTime,
  calendarMoon, calendarSeason, calendarMonthDays, shiftCalendarMonth, calendarClock, calendarTimeDelta, calendarClockSpeed, calendarDayPeriod
} from "../scripts/calendar-date.mjs";

const hooks = new Map();
globalThis.Hooks = {
  on: (key, fn) => { hooks.set(key, [...(hooks.get(key) ?? []), fn]); },
  once: (key, fn) => { hooks.set(key, [...(hooks.get(key) ?? []), fn]); }
};
const { CalendarService, CalendarApplication, changeCalendarDateAsGM, buildCalendarPanel } = await import("../scripts/calendar.mjs");
const { buildCalendarPage, updateCalendarClock, buildCalendarAlmanac } = await import("../scripts/calendar-view.mjs");
const { SocketService } = await import("../scripts/sockets.mjs");
const settingDefinitions = new Map();
const translations = Object.fromEntries(["en", "pt-BR"].map(lang => [lang,
  JSON.parse(fs.readFileSync(new URL(`../languages/${lang}.json`, import.meta.url), "utf8"))]));

let values, writes, advances, host, nodes, registrations, language;
const primary = { id: "gm1", isGM: true, active: true };
const secondary = { id: "gm2", isGM: true, active: true };
const player = { id: "player", isGM: false, active: true, role: 1 };
const trusted = { id: "trusted", isGM: false, active: true, role: 2 };
const request = (operation, user = primary) => changeCalendarDateAsGM.call({ socketdata: { userId: user.id } }, operation);

function setup() {
  values = new Map([["enableCalendar", true], ["calendarDate", {}], ["calendarClockRunning", false], ["calendarClockSpeed", 1]]);
  writes = []; advances = []; registrations = []; language = "pt-BR";
  nodes = new Map();
  host = { firstElementChild: null, prepend(el) { nodes.set(el.id, el); el.parentElement = this; this.firstElementChild = el; } };
  globalThis.document = {
    getElementById: (id) => id === "sidebar-content" ? host : nodes.get(id),
    createElement: () => ({
      listeners: [], dataset: {}, setAttribute() {},
      addEventListener(event, fn) { this.listeners.push([event, fn]); },
      remove() { nodes.delete(this.id); if (host?.firstElementChild === this) host.firstElementChild = null; }
    })
  };
  globalThis.game = {
    user: primary, system: { id: "symbaroum" },
    users: { activeGM: primary, get: (id) => [primary, secondary, player, trusted].find(u => u.id === id) },
    settings: {
      register: (_module, key, spec) => { registrations.push([key, spec]); settingDefinitions.set(key, spec); },
      get: (_module, key) => values.get(key),
      async set(_module, key, value) {
        await new Promise(resolve => setImmediate(resolve));
        writes.push([key, value]); values.set(key, structuredClone(value));
      }
    },
    time: {
      worldTime: 23 * 3600,
      async advance(seconds) {
        await new Promise(resolve => setImmediate(resolve));
        advances.push(seconds); this.worldTime += seconds;
        for (const fn of hooks.get("updateWorldTime") ?? []) fn(this.worldTime, seconds);
      }
    },
    i18n: {
      localize: key => translations[language][key] ?? key,
      format: (key, data) => (translations[language][key] ?? key).replace(/\{(\w+)\}/g, (_, k) => data[k])
    }
  };
}

test("date boundaries: month, year, leap-year absence, negative intervals and round trips", () => {
  assert.deepEqual(advanceCalendarDate({ year: 22, month: 1, day: 30 }, 1), { year: 22, month: 2, day: 1 });
  assert.deepEqual(advanceCalendarDate({ year: 22, month: 12, day: 30 }, 1), { year: 23, month: 1, day: 1 });
  assert.deepEqual(advanceCalendarDate({ year: 23, month: 1, day: 1 }, -1), { year: 22, month: 12, day: 30 });
  for (const days of [-360, -31, -1, 0, 1, 30, 360, 1440]) {
    const date = { year: 22, month: 8, day: 5 };
    assert.deepEqual(advanceCalendarDate(advanceCalendarDate(date, days), -days), date);
  }
  assert.throws(() => advanceCalendarDate({ year: 0, month: 1, day: 1 }, -1), RangeError);
  assert.throws(() => advanceCalendarDate({ year: 9999, month: 12, day: 30 }, 1), RangeError);
  for (const invalid of [null, {}, { year: "22", month: 1, day: 1 }, { year: 22, month: 2, day: 31 },
    { year: -1, month: 1, day: 1 }, { year: 22, month: 0, day: 1 }, { year: 22.5, month: 1, day: 1 }]) {
    assert.throws(() => validateCalendarDate(invalid), RangeError);
  }
  assert.throws(() => advanceCalendarDate({ year: 22, month: 1, day: 1 }, Infinity), RangeError);
});

test("world midnight, fractional seconds and backward time control the date", () => {
  const anchor = createCalendarAnchor({ year: 22, month: 1, day: 30 }, 23 * 3600);
  assert.equal(anchor.worldTime, 0);
  assert.deepEqual(calendarDateAtTime(anchor, 86399.99), { year: 22, month: 1, day: 30 });
  assert.deepEqual(calendarDateAtTime(anchor, 86400), { year: 22, month: 2, day: 1 });
  assert.deepEqual(calendarDateAtTime(anchor, -1), { year: 22, month: 1, day: 29 });
  assert.equal(createCalendarAnchor({ year: 22, month: 1, day: 1 }, -1).worldTime, -86400);
  assert.throws(() => calendarDateAtTime({}, 0), RangeError);
  assert.throws(() => createCalendarAnchor({ year: 22, month: 1, day: 1 }, NaN), RangeError);
});

test("registration is idempotent and rendering never writes persistent data", () => {
  setup(); CalendarService.register();
  const hookCount = [...hooks.values()].reduce((sum, list) => sum + list.length, 0);
  CalendarService.register();
  assert.equal(registrations.length, 4);
  assert.equal([...hooks.values()].reduce((sum, list) => sum + list.length, 0), hookCount);
  CalendarService.refresh(); CalendarService.refresh();
  assert.equal(nodes.size, 1);
  assert.equal(nodes.get("tenebre-calendar").listeners.length, 1);
  assert.equal(writes.length, 0);
  assert.match(nodes.get("tenebre-calendar").innerHTML, /Data não definida/);
});

test("initial date preserves world time; two GMs and rapid clicks do not lose days", async () => {
  setup();
  await request({ type: "set", date: { year: 22, month: 12, day: 30 } });
  assert.equal(game.time.worldTime, 82800);
  assert.equal(writes.length, 1);
  await Promise.all([request({ type: "advance", days: 1 }), request({ type: "advance", days: 1 }, secondary)]);
  assert.deepEqual(CalendarService.getDate(), { year: 23, month: 1, day: 2 });
  assert.deepEqual(advances, [86400, 86400]);
  assert.equal(writes.length, 1, "only the anchor is persisted, date follows world time");
  await request({ type: "set", date: { year: 22, month: 12, day: 29 } });
  assert.equal(advances.at(-1), -3 * 86400);
  assert.equal(((game.time.worldTime % 86400) + 86400) % 86400, 82800);
});

test("external changes refresh all clients without advancing time again; reload retains date", async () => {
  setup(); await request({ type: "set", date: { year: 22, month: 1, day: 30 } });
  const anchor = structuredClone(values.get("calendarDate"));
  game.time.worldTime = 86400;
  for (const fn of hooks.get("updateWorldTime")) fn(86400, 3600);
  assert.match(nodes.get("tenebre-calendar").innerHTML, /1 de Olandan, 22/);
  assert.equal(advances.length, 0);
  game.user = player; CalendarService.refresh();
  assert.doesNotMatch(nodes.get("tenebre-calendar").innerHTML, /data-calendar-action="(?:previous|next)"/);
  assert.match(nodes.get("tenebre-calendar").innerHTML, /data-calendar-action="open"/);
  nodes.clear(); values.set("calendarDate", anchor); CalendarService.refresh();
  assert.deepEqual(CalendarService.getDate(), { year: 22, month: 2, day: 1 });
});

test("players, trusted players, unauthenticated senders and non-primary executors cannot write", async () => {
  setup();
  for (const sender of [player, trusted, { id: "unknown" }]) {
    assert.throws(() => request({ type: "set", date: { year: 22, month: 1, day: 1 } }, sender), /Unauthorized/);
  }
  assert.throws(() => changeCalendarDateAsGM.call({}, { type: "advance", days: 1 }), /Unauthorized/);
  game.user = secondary;
  assert.throws(() => request({ type: "advance", days: 1 }), /Unauthorized/);
  game.user = player;
  await assert.rejects(CalendarService.change({ type: "advance", days: 1 }), /GM/);
  assert.equal(writes.length, 0); assert.equal(advances.length, 0);
});

test("invalid input, rejected saves and disabled calendar leave the queue usable", async () => {
  setup();
  assert.throws(() => request({ type: "advance", days: 100 }), RangeError);
  assert.throws(() => request({ type: "set", date: { year: 22, month: 1, day: 31 } }), RangeError);
  await assert.rejects(request({ type: "advance", days: 1 }), RangeError);
  const save = game.settings.set;
  game.settings.set = async () => { throw new Error("Save failed"); };
  await assert.rejects(request({ type: "set", date: { year: 22, month: 1, day: 1 } }), /Save failed/);
  game.settings.set = save;
  await request({ type: "set", date: { year: 22, month: 1, day: 1 } });
  CalendarService.refresh();
  values.set("enableCalendar", false); CalendarService.refresh();
  assert.equal(nodes.size, 0);
  assert.throws(() => request({ type: "advance", days: 1 }), /Unauthorized/);
  values.set("enableCalendar", true); CalendarService.refresh();
  assert.equal(nodes.size, 1);
  assert.deepEqual(CalendarService.getDate(), { year: 22, month: 1, day: 1 });
});

test("secondary GM uses the primary-GM routing and missing transport rejects safely", async () => {
  setup(); game.user = secondary;
  await assert.rejects(CalendarService.change({ type: "advance", days: 1 }), /socketlib/);
  game.users.activeGM = null;
  await assert.rejects(CalendarService.change({ type: "advance", days: 1 }), /No active GM/);
  assert.equal(writes.length, 0);
  assert.equal(typeof SocketService.executeAsPrimaryGM, "function");
});

test("PT-BR and English panels show the same date; only GM gets controls", () => {
  setup(); const date = { year: 22, month: 12, day: 30 };
  for (language of ["en", "pt-BR"]) {
    const html = buildCalendarPanel(date, true);
    assert.match(html, /Leandro/); assert.doesNotMatch(html, /TENEBRE\./);
    assert.equal((html.match(/<button/g) ?? []).length, 5);
    assert.doesNotMatch(buildCalendarPanel(date, false), /data-calendar-action="(?:previous|next)"/);
    assert.match(buildCalendarPanel(date, false), /data-calendar-action="open"/);
  }
});

test("all eight lunar phases follow the preset, continuous across months and years", () => {
  const reference = { year: 0, month: 1, day: 1 };
  const boundaries = [[0,"New"],[1,"WaxingCrescent"],[6,"WaxingCrescent"],[7,"FirstQuarter"],
    [8,"WaxingGibbous"],[13,"WaxingGibbous"],[14,"Full"],[15,"WaningGibbous"],
    [20,"WaningGibbous"],[21,"LastQuarter"],[22,"WaningCrescent"],[27,"WaningCrescent"],[28,"New"]];
  for (const [offset, phase] of boundaries) assert.equal(calendarMoon(advanceCalendarDate(reference, offset)).phase, phase);
  assert.equal(calendarMoon({ year: 1, month: 1, day: 1 }).cycleDay, 25, "the lunar cycle does not reset each year");
  assert.equal(calendarMoon({ year: 0, month: 2, day: 1 }).cycleDay, 3);
});

test("seasons respect the four preset month boundaries and wrap through Ynedar", () => {
  const expected = ["Summer","Autumn","Autumn","Autumn","Winter","Winter","Winter","Spring","Spring","Spring","Summer","Summer"];
  expected.forEach((season, i) => {
    assert.equal(calendarSeason({ year: 21, month: i + 1, day: 1 }), season);
    assert.equal(calendarSeason({ year: 21, month: i + 1, day: 30 }), season);
  });
});

test("monthly grid has 30 days and continuous seven-day weeks; navigation respects year bounds", () => {
  const first = calendarMonthDays(0, 1), second = calendarMonthDays(0, 2);
  assert.equal(first.days.length, 30); assert.equal(first.offset, 0); assert.equal(second.offset, 2);
  assert.equal(first.days[0].weekday, "Earth"); assert.equal(second.days[0].weekday, "Wind");
  assert.equal(calendarMonthDays(1, 1).offset, 3);
  assert.deepEqual(shiftCalendarMonth({ year: 21, month: 12, day: 30 }, 1), { year: 22, month: 1, day: 30 });
  assert.deepEqual(shiftCalendarMonth({ year: 22, month: 1, day: 30 }, -1), { year: 21, month: 12, day: 30 });
  assert.throws(() => shiftCalendarMonth({ year: 0, month: 1, day: 1 }, -1), RangeError);
  assert.throws(() => shiftCalendarMonth({ year: 9999, month: 12, day: 1 }, 1), RangeError);
});

test("calendar page distinguishes selected and current dates and gives players only browsing actions", () => {
  setup(); const current = { year: 21, month: 8, day: 16 }, selected = { ...current, day: 17 };
  for (language of ["en", "pt-BR"]) {
    const page = buildCalendarPage({ current, selected, view: current, isGM: true });
    assert.equal((page.match(/data-action="selectDay"/g) ?? []).length, 30);
    assert.equal((page.match(/aria-current="date"/g) ?? []).length, 1);
    assert.equal((page.match(/aria-selected="true"/g) ?? []).length, 1);
    assert.doesNotMatch(page, /TENEBRE\./);
    assert.match(page, /data-action="applyDate"/);
    const playerPage = buildCalendarPage({ current, selected, view: current, isGM: false });
    assert.doesNotMatch(playerPage, /data-action="applyDate"/);
    assert.match(playerPage, /data-action="nextMonth"/);
    assert.match(playerPage, /tenebre-moon-icon/);
    assert.match(playerPage, /tenebre-season-spring/);
  }
});

test("month browsing and selection never mutate world time; explicit application does", async () => {
  setup(); await request({ type: "set", date: { year: 21, month: 8, day: 16 } });
  const app = new CalendarApplication(); app.refresh = () => {};
  app.browseMonth(1); app.selectDay(20); app.setView(22, 2);
  assert.equal(advances.length, 0);
  assert.deepEqual(CalendarService.getDate(), { year: 21, month: 8, day: 16 });
  await app.applyDate();
  assert.deepEqual(CalendarService.getDate(), { year: 22, month: 2, day: 20 });
  assert.equal(advances.length, 1);
  assert.equal(app.followCurrent, true);
  game.user = player; app.selectDay(21);
  await assert.rejects(app.applyDate(), /GM/);
  assert.equal(advances.length, 1);
});

test("open calendar updates on a new day without losing a browsed month or repainting each second", async () => {
  setup(); await request({ type: "set", date: { year: 21, month: 8, day: 16 } });
  const app = new CalendarApplication(); let paints = 0;
  app.refresh = () => { paints++; }; app.rendered = true;
  app.syncDate(); const initial = paints;
  game.time.worldTime++; app.syncDate(); assert.equal(paints, initial);
  game.time.worldTime += 86400; app.syncDate();
  assert.equal(app.selected.day, 17);
  app.browseMonth(1); const viewed = { ...app.view };
  game.time.worldTime += 86400; app.syncDate();
  assert.deepEqual(app.view, viewed);
  assert.match(await app._renderHTML(), /18 de Agani, 21/);
  app.showCurrent(); assert.equal(app.selected.day, 18); assert.equal(app.view.month, 8);
});

test("world clock formats 24-hour time, negative timestamps and analog hands", () => {
  for (const [seconds, text] of [[0,"00:00"],[43200,"12:00"],[86399.9,"23:59"],[86400,"00:00"],[-1,"23:59"],[-86400,"00:00"]]) {
    assert.equal(calendarClock(seconds).text, text);
  }
  assert.equal(calendarClock(3 * 3600 + 30 * 60).hourAngle, 105);
  assert.equal(calendarClock(3 * 3600 + 30 * 60).minuteAngle, 180);
  assert.throws(() => calendarClock(NaN), RangeError);
});

test("hour controls cross midnight and year boundaries through shared world time", async () => {
  setup(); await request({ type: "set", date: { year: 21, month: 12, day: 30 } });
  await request({ type: "time", seconds: 3600 });
  assert.deepEqual(CalendarService.getDate(), { year: 22, month: 1, day: 1 });
  assert.equal(calendarClock(game.time.worldTime).text, "00:00");
  await request({ type: "time", seconds: -600 });
  assert.deepEqual(CalendarService.getDate(), { year: 21, month: 12, day: 30 });
  assert.equal(calendarClock(game.time.worldTime).text, "23:50");
  await Promise.all([request({ type: "time", seconds: 600 }), request({ type: "time", seconds: 3600 }, secondary)]);
  assert.equal(calendarClock(game.time.worldTime).text, "01:00");
  assert.equal(writes.length, 1, "clock changes never rewrite the date anchor");
  assert.deepEqual(advances, [3600, -600, 600, 3600]);
});

test("time controls require an active GM and only accept the four supported intervals", async () => {
  setup();
  for (const sender of [player, trusted]) assert.throws(() => request({ type: "time", seconds: 3600 }, sender), /Unauthorized/);
  for (const seconds of [0, 1, 86400, "600", Infinity]) assert.throws(() => request({ type: "time", seconds }), RangeError);
  await request({ type: "time", seconds: 600 });
  assert.equal(calendarClock(game.time.worldTime).text, "23:10");
  assert.equal(CalendarService.getDate(), null, "time can move before initial date setup");
  assert.equal(writes.length, 0);
  values.set("enableCalendar", false);
  assert.throws(() => request({ type: "time", seconds: 600 }), /Unauthorized/);
});

test("window and sidebar show the clock to players, but time controls remain GM-only", () => {
  setup(); const date = { year: 21, month: 8, day: 16 };
  for (language of ["en", "pt-BR"]) {
    assert.match(buildCalendarPanel(date, false), /23:00/);
    const args = { current: date, selected: date, view: date };
    const gmPage = buildCalendarPage({ ...args, isGM: true });
    assert.equal((gmPage.match(/data-action="changeTime"/g) ?? []).length, 4);
    const playerPage = buildCalendarPage({ ...args, isGM: false });
    assert.match(playerPage, /23:00/);
    assert.doesNotMatch(playerPage, /data-action="changeTime"/);
    assert.doesNotMatch(gmPage, /TENEBRE\./);
  }
});

test("minute changes update only clock nodes, preserving calendar input and navigation state", async () => {
  setup(); await request({ type: "set", date: { year: 21, month: 8, day: 16 } });
  const app = new CalendarApplication(); let paints = 0;
  const attributes = new Map(), time = { textContent: "23:00", setAttribute: (key, value) => attributes.set(key, value) };
  const hand = { dataset: { calendarHand: "hour" }, getAttribute: () => null, setAttribute: (key, value) => attributes.set('hand-' + key, value) };
  app.element = { querySelectorAll: selector => selector === '[data-calendar-time]' ? [time] : selector === '[data-calendar-hand]' ? [hand] : [] };
  app.refresh = () => { paints++; }; app.rendered = true;
  app.syncDate(); app.browseMonth(1); const view = { ...app.view }, count = paints;
  game.time.worldTime += 600;
  app.syncDate();
  assert.equal(time.textContent, "23:10:00");
  assert.equal(attributes.get('datetime'), "23:10:00");
  assert.equal(attributes.get('hand-transform'), "rotate(335 12 12)");
  assert.equal(paints, count);
  assert.deepEqual(app.view, view);
  updateCalendarClock(app.element, 0);
  assert.equal(time.textContent, "00:00:00");
});

test("sidebar has GM-only time editor and play/pause controls without changing the date", async () => {
  setup();
  await request({ type: "set", date: { year: 21, month: 10, day: 21 } });
  const date = CalendarService.getDate();
  const page = buildCalendarPanel(date, true, game.time.worldTime, { running: true, editing: true });
  assert.match(page, /data-calendar-action="editTime"/);
  assert.match(page, /data-calendar-action="toggleClock"/);
  assert.match(page, /name="calendarSidebarTime"/);
  assert.match(page, /aria-pressed="true"/);
  const playerPage = buildCalendarPanel(date, false, game.time.worldTime, { running: true, editing: true });
  assert.doesNotMatch(playerPage, /toggleClock|editTime|applyTime|calendarSidebarTime/);
  assert.match(playerPage, /23:00:00/);
  assert.throws(() => request({ type: "setTime", hours: 24, minutes: 0 }), RangeError);
  for (const user of [player, trusted]) {
    assert.throws(() => request({ type: "toggleClock" }, user), /Unauthorized/);
    assert.throws(() => request({ type: "setTime", hours: 12, minutes: 30 }, user), /Unauthorized/);
  }
  await request({ type: "setTime", hours: 12, minutes: 30 });
  assert.deepEqual(CalendarService.getDate(), date);
  assert.equal(calendarClock(game.time.worldTime).fullText, "12:30:00");
  await request({ type: "toggleClock" });
  assert.equal(values.get("calendarClockRunning"), true);
  await request({ type: "toggleClock" }, secondary);
  assert.equal(values.get("calendarClockRunning"), false);
  assert.equal(calendarTimeDelta(-1, 12, 0), -43199);
});

test("clock speed is a world setting and only the primary GM can run its scheduler", async () => {
  setup();
  assert.equal(settingDefinitions.get("calendarClockSpeed").scope, "world");
  assert.equal(settingDefinitions.get("calendarClockSpeed").default, 1);
  for (const rate of [0.01, 0.5, 1, 60, 86400]) assert.equal(calendarClockSpeed(rate), rate);
  for (const rate of [0, -1, Infinity, NaN, "60", 86401]) assert.throws(() => calendarClockSpeed(rate), RangeError);
  for (const callback of hooks.get("ready") ?? []) callback();
  values.set("calendarClockRunning", true);
  assert.equal(CalendarService.canRunClock(), true);
  game.user = secondary; assert.equal(CalendarService.canRunClock(), false);
  game.user = player; assert.equal(CalendarService.canRunClock(), false);
  game.user = primary; game.paused = true; assert.equal(CalendarService.canRunClock(), false);
  game.paused = false; values.set("enableCalendar", false); assert.equal(CalendarService.canRunClock(), false);
  values.set("calendarClockRunning", false); CalendarService.synchronizeClock();
});

test("second-by-second sidebar updates retain the time editor and its draft", async () => {
  setup(); CalendarService.refresh();
  const panel = nodes.get("tenebre-calendar");
  const click = panel.listeners.find(([event]) => event === "click")[1];
  click({ target: { closest: () => ({ dataset: { calendarAction: "editTime" } }) } });
  assert.match(panel.innerHTML, /calendarSidebarTime/);
  const original = panel.innerHTML;
  const time = { textContent: "23:00:00", setAttribute() {} };
  panel.querySelectorAll = selector => selector === "[data-calendar-time]" ? [time] : [];
  game.time.worldTime++;
  CalendarService.refresh();
  assert.equal(panel.innerHTML, original, "a tick must not replace the editor DOM");
  assert.equal(time.textContent, "23:00:01");
  click({ target: { closest: () => ({ dataset: { calendarAction: "editTime" } }) } });
});

test("visual day periods switch at dawn, daylight, dusk and night, including reverse time", () => {
  for (const [seconds, period] of [[-1,"Night"],[0,"Night"],[5*3600-1,"Night"],
    [5*3600,"Dawn"],[6*3600,"Dawn"],[7*3600-1,"Dawn"],[7*3600,"Day"],
    [17*3600-1,"Day"],[17*3600,"Dusk"],[19*3600-1,"Dusk"],
    [19*3600,"Night"],[86400,"Night"]]) {
    assert.equal(calendarDayPeriod(seconds), period);
  }
});

test("live almanac hides lunar phases during daylight while monthly references keep them", () => {
  setup(); const date = { year: 21, month: 10, day: 22 };
  for (language of ["en", "pt-BR"]) {
    for (const [hour, key] of [[6,"Dawn"],[12,"Day"],[18,"Dusk"]]) {
      const html = buildCalendarAlmanac(date, hour * 3600);
      assert.match(html, new RegExp(translations[language][`TENEBRE.Calendar.DayPeriods.${key}`]));
      assert.doesNotMatch(html, /tenebre-moon-icon/);
      assert.doesNotMatch(html, /TENEBRE\./);
    }
    const phaseName = translations[language][`TENEBRE.Calendar.Phases.${calendarMoon(date).phase}`];
    assert.ok(buildCalendarAlmanac(date, 19*3600).includes(phaseName));
    assert.ok(buildCalendarAlmanac(date).includes(phaseName), "monthly dates have no associated time");
    assert.match(buildCalendarPanel(date, false, 6*3600), /tenebre-sky-dawn/);
    const page = buildCalendarPage({ current: date, selected: date, view: date, isGM: false, worldTime: 6*3600 });
    assert.match(page, /tenebre-sky-dawn/);
    assert.equal((page.match(/data-action="selectDay"/g) ?? []).length, 30);
  }
});

test("live sky switches on external time updates without repainting the calendar or editor", async () => {
  setup(); await request({ type: "set", date: { year: 21, month: 10, day: 22 } });
  game.time.worldTime = 7*3600-1;
  CalendarService.refresh();
  const panel = nodes.get("tenebre-calendar"), original = panel.innerHTML;
  const sky = { dataset: { calendarSky: "Dawn:" }, innerHTML: "", className: "", title: "" };
  panel.querySelectorAll = selector => selector === '[data-calendar-sky]' ? [sky] : [];
  const app = new CalendarApplication(); let paints = 0;
  app.element = panel; app.refresh = () => { paints++; }; app.rendered = true;
  app.syncDate(); app.browseMonth(1); const view = { ...app.view }, count = paints;
  for (const [hour, key] of [[7,"Day:"],[17,"Dusk:"],[19,`Night:${calendarMoon(CalendarService.getDate()).phase}`],[6,"Dawn:"]]) {
    game.time.worldTime = hour * 3600;
    for (const callback of hooks.get("updateWorldTime")) callback(game.time.worldTime, 1);
    app.syncDate();
    assert.equal(sky.dataset.calendarSky, key);
    assert.equal(panel.innerHTML, original);
    assert.deepEqual(app.view, view);
    assert.equal(paints, count);
  }
  assert.match(sky.innerHTML, /Amanhecendo/);
  assert.equal(advances.length, 0, "display changes do not write world time");
});
