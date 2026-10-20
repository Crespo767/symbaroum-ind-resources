import assert from "node:assert/strict";
import test from "node:test";
import { CalendarClockRunner } from "../scripts/calendar-runner.mjs";

function harness() {
  let now = 0, enabled = true, rate = 1, schedules = 0;
  const callbacks = new Map(), deltas = [], errors = [];
  const runner = new CalendarClockRunner({
    canRun: () => enabled, getRate: () => rate, now: () => now,
    schedule: callback => { const id = ++schedules; callbacks.set(id, callback); return id; },
    cancel: id => callbacks.delete(id),
    advance: async (seconds, valid) => { if (valid()) deltas.push(seconds); },
    onError: async error => errors.push(error)
  });
  return { runner, callbacks, deltas, errors, get schedules() { return schedules; },
    set now(value) { now = value; }, set enabled(value) { enabled = value; }, set rate(value) { rate = value; } };
}

test("only one interval runs, accounting for delayed callbacks and fractional elapsed time", async () => {
  const h = harness(); h.runner.synchronize(); h.runner.synchronize();
  assert.equal(h.schedules, 1); assert.equal(h.callbacks.size, 1);
  h.now = 900; await h.runner.tick(); assert.deepEqual(h.deltas, []);
  h.now = 1500; await h.runner.tick();
  h.now = 4100; await h.runner.tick();
  assert.deepEqual(h.deltas, [1, 3]);
});

test("pause, reload and authority transfer never catch up stopped or offline time", async () => {
  const h = harness(); h.runner.synchronize(); h.now = 1000; await h.runner.tick();
  h.enabled = false; h.runner.synchronize(); assert.equal(h.callbacks.size, 0);
  h.now = 100000; h.enabled = true; h.runner.synchronize(); await h.runner.tick();
  assert.deepEqual(h.deltas, [1]);
  h.now = 101000; await h.runner.tick(); assert.deepEqual(h.deltas, [1, 1]);
  h.runner.stop(); h.now = 999000; h.runner.synchronize(); await h.runner.tick();
  assert.deepEqual(h.deltas, [1, 1]);
});

test("scaling supports accelerated and slower time and changes rate without duplicate intervals", async () => {
  const h = harness(); h.rate = 60; h.runner.synchronize();
  h.now = 1000; await h.runner.tick(); assert.deepEqual(h.deltas, [60]);
  h.rate = 0.1; h.runner.synchronize(); assert.equal(h.callbacks.size, 1);
  for (let i = 2; i <= 11; i++) { h.now = i * 1000; await h.runner.tick(); }
  assert.deepEqual(h.deltas, [60, 1]);
  h.rate = 3600; h.runner.synchronize(); h.now = 12000; await h.runner.tick();
  assert.deepEqual(h.deltas, [60, 1, 3600]);
});

test("overlapping writes are serialized and queued ticks are invalidated on pause", async () => {
  const h = harness(); let release;
  h.runner.advance = async (seconds, valid) => { await new Promise(resolve => { release = resolve; }); if (valid()) h.deltas.push(seconds); };
  h.runner.synchronize(); h.now = 1000; const pending = h.runner.tick();
  h.now = 2000; await h.runner.tick();
  h.enabled = false; h.runner.synchronize(); release(); await pending;
  assert.deepEqual(h.deltas, []);
  assert.equal(h.callbacks.size, 0);
});

test("write failure stops the clock and reports one error instead of retrying every tick", async () => {
  const h = harness(); h.runner.advance = async () => { throw new Error("Connection failed"); };
  h.runner.synchronize(); h.now = 1000; await h.runner.tick();
  h.now = 2000; await h.runner.tick();
  assert.equal(h.errors.length, 1); assert.equal(h.callbacks.size, 0);
});
