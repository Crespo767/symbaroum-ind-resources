import assert from "node:assert/strict";
import test from "node:test";
globalThis.Hooks = { once() {} };
const { stampCalendarMessage, renderCalendarTimestamp } = await import("../scripts/calendar-chat.mjs");

function setup(t, show = true) {
  const game = globalThis.game, document = globalThis.document;
  t.after(() => { globalThis.game = game; globalThis.document = document; });
  globalThis.game = { settings: { get: (_scope, key) => key === "enableCalendar" ? true : key === "calendarClientOptions" ? { chatTimestamp: show } : undefined },
    i18n: { format: (_key, data) => `${data.day} ${data.month} ${data.year}` } };
  globalThis.document = { createElement: () => ({}) };
}

test("message timestamps snapshot the game date at creation without a wall-clock conversion", t => {
  setup(t);
  const updates = [];
  const service = { getDate: () => ({ year: 22, month: 8, day: 5 }), getTime: () => 51300 };
  assert.equal(stampCalendarMessage({ updateSource: update => updates.push(update) }, service), true);
  assert.deepEqual(updates, [{ "flags.symbaroum-ind-resources.calendarTimestamp": { date: service.getDate(), time: 51300 } }]);
});

test("unconfigured calendars never stamp messages", t => {
  setup(t);
  assert.equal(stampCalendarMessage({ updateSource() { assert.fail("no date may be invented"); } }, { getDate: () => null }), false);
});

test("rendering a saved timestamp only appends localized text and never persists data", t => {
  setup(t);
  const appended = [];
  const root = { querySelector: selector => selector === ".message-metadata" ? { append: element => appended.push(element) } : null };
  const message = { getFlag: () => ({ date: { year: 22, month: 8, day: 5 }, time: 51300 }),
    update() { assert.fail("rendering must never write a document"); } };
  assert.equal(renderCalendarTimestamp(message, root), true);
  assert.equal(appended[0].textContent, "5 Agani 22 · 14:15:00");
  assert.equal(appended[0].className, "tenebre-calendar-chat-time");
});

test("hidden or invalid timestamps leave native chat metadata intact", t => {
  setup(t, false);
  const root = { querySelector: () => null };
  assert.equal(renderCalendarTimestamp({ getFlag() { assert.fail("preference is disabled"); } }, root), false);
  game.settings.get = (_scope, key) => key === "enableCalendar" ? true : { chatTimestamp: true };
  assert.equal(renderCalendarTimestamp({ getFlag: () => ({ date: { year: "<script>", month: 1, day: 1 }, time: 0 }) }, root), false);
});
