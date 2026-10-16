import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  advanceCalendarDate, validateCalendarDate, createCalendarAnchor, calendarDateAtTime
} from "../scripts/calendar-date.mjs";

const hooks = new Map();
globalThis.Hooks = {
  on: (key, fn) => { hooks.set(key, [...(hooks.get(key) ?? []), fn]); },
  once: (key, fn) => { hooks.set(key, [...(hooks.get(key) ?? []), fn]); }
};
const { CalendarService, changeCalendarDateAsGM, buildCalendarPanel } = await import("../scripts/calendar.mjs");
const { SocketService } = await import("../scripts/sockets.mjs");
const translations = Object.fromEntries(["en", "pt-BR"].map(lang => [lang,
  JSON.parse(fs.readFileSync(new URL(`../languages/${lang}.json`, import.meta.url), "utf8"))]));

let values, writes, advances, host, nodes, registrations, language;
const primary = { id: "gm1", isGM: true, active: true };
const secondary = { id: "gm2", isGM: true, active: true };
const player = { id: "player", isGM: false, active: true, role: 1 };
const trusted = { id: "trusted", isGM: false, active: true, role: 2 };
const request = (operation, user = primary) => changeCalendarDateAsGM.call({ socketdata: { userId: user.id } }, operation);

function setup() {
  values = new Map([["enableCalendar", true], ["calendarDate", {}]]);
  writes = []; advances = []; registrations = []; language = "pt-BR";
  nodes = new Map();
  host = { firstElementChild: null, prepend(el) { nodes.set(el.id, el); el.parentElement = this; this.firstElementChild = el; } };
  globalThis.document = {
    getElementById: (id) => id === "sidebar-content" ? host : nodes.get(id),
    createElement: () => ({
      listeners: [], setAttribute() {},
      addEventListener(event, fn) { this.listeners.push([event, fn]); },
      remove() { nodes.delete(this.id); if (host?.firstElementChild === this) host.firstElementChild = null; }
    })
  };
  globalThis.game = {
    user: primary, system: { id: "symbaroum" },
    users: { activeGM: primary, get: (id) => [primary, secondary, player, trusted].find(u => u.id === id) },
    settings: {
      register: (_module, key, spec) => registrations.push([key, spec]),
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
  assert.equal(registrations.length, 2);
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
  assert.doesNotMatch(nodes.get("tenebre-calendar").innerHTML, /<button/);
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
    assert.equal((html.match(/<button/g) ?? []).length, 3);
    assert.doesNotMatch(buildCalendarPanel(date, false), /<button/);
  }
});
