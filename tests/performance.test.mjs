import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

globalThis.Hooks = { once() {}, on() {}, callAll() {} };
globalThis.foundry = { applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: (Base) => class extends Base {} } } };
globalThis.game = { settings: { settings: new Map(), get: () => true } };

const { EncumbranceService } = await import("../scripts/encumbrance.mjs");
const read = (file) => readFile(new URL(`../scripts/${file}`, import.meta.url), "utf8");

test("item slots are cached until the item changes", () => {
  let computed = 0;
  const original = EncumbranceService.computeItemSlots;
  EncumbranceService.computeItemSlots = function(item) { computed += 1; return original.call(this, item); };
  try {
    const item = { name: "Corda", type: "equipment", system: {}, getFlag: () => undefined, _stats: { modifiedTime: 1 } };
    EncumbranceService.getItemSlots(item);
    EncumbranceService.getItemSlots(item);
    assert.equal(computed, 1, "second call served from cache");
    item._stats.modifiedTime = 2;
    EncumbranceService.getItemSlots(item);
    assert.equal(computed, 2, "item update invalidates the cache");
    const unsaved = { name: "Corda", type: "equipment", system: {}, getFlag: () => undefined };
    EncumbranceService.getItemSlots(unsaved);
    EncumbranceService.getItemSlots(unsaved);
    assert.equal(computed, 4, "documents without modifiedTime are never cached");
  } finally {
    EncumbranceService.computeItemSlots = original;
  }
});

test("combat hooks react only to round or turn changes; token refresh only repositions", async () => {
  for (const file of ["maneuvers.mjs", "death-automation.mjs"]) {
    const source = await read(file);
    assert.match(source, /Hooks\.on\("updateCombat", (?:async )?\(_?combat, changes\) => \{\s+if \(!\("round" in \(changes \?\? \{\}\)\) && !\("turn" in \(changes \?\? \{\}\)\)\) return;/, file);
  }
  const standUp = await read("stand-up.mjs");
  assert.match(standUp, /Hooks\.on\("refreshToken", \(token\) => this\.repositionTokenButton\(token\)\)/);
});
