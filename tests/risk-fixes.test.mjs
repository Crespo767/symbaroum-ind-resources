import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const MODULE_ID = "symbaroum-ind-resources";
globalThis.Hooks = { once() {}, on() {}, callAll() {} };
globalThis.foundry = { applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: (Base) => class extends Base {} } }, dice: { terms: { Die: class { constructor() { this.results = []; } } } } };

const { findPendingShoveEffect } = await import("../scripts/sockets.mjs");
const { changeItemQuantity } = await import("../scripts/item-flags.mjs");
const { RationService } = await import("../scripts/rations.mjs");
const { isModuleUtilityDocument } = await import("../scripts/bithir-macros.mjs");
const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("a player may damage a targeted actor only through an unused Shove from their own character", () => {
  const player = { id: "p" };
  const hero = { id: "hero", testUserPermission: (user) => user === player };
  const villain = { id: "villain", testUserPermission: () => false };
  globalThis.game = { actors: new Map([["hero", hero], ["villain", villain]]) };
  globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 } };
  const shove = (sourceActorId, extra = {}) => ({ flags: { [MODULE_ID]: { effectId: "tenebre-maneuver-shoved", sourceActorId, ...extra } } });

  assert.ok(findPendingShoveEffect({ effects: [shove("hero")] }, player));
  assert.equal(findPendingShoveEffect({ effects: [] }, player), null, "no shove, no damage");
  assert.equal(findPendingShoveEffect({ effects: [shove("villain")] }, player), null, "someone else's shove");
  assert.equal(findPendingShoveEffect({ effects: [shove("hero", { shoveDamageApplied: true })] }, player), null, "already used");
});

test("depleted equipment is deleted only when the cleanup option is on", async () => {
  const calls = [];
  const item = () => ({ type: "equipment", parent: { documentName: "Actor" }, uuid: `Item.${calls.length}`, system: { number: 1 },
    update: async (data) => calls.push(["update", data]), delete: async () => { calls.push(["delete"]); return true; } });
  globalThis.game = { settings: { get: () => false } };
  await changeItemQuantity(item(), -1);
  globalThis.game = { settings: { get: () => true } };
  await changeItemQuantity(item(), -1);
  assert.deepEqual(calls, [["update", { "system.number": 0 }], ["delete"]]);
});

test("ration stacks with different descriptions are not merged", () => {
  globalThis.game = { settings: { settings: new Map(), get: () => true } };
  const bread = (id, description) => ({ id, name: "Pão de Viagem", type: "equipment", img: "bread.webp", system: { number: 1, description }, getFlag: () => undefined });
  const actor = (items) => ({ items: new Map(items.map((i) => [i.id, i])) });
  assert.equal(RationService.needsConsolidation(actor([bread("a", ""), bread("b", "")])), true);
  assert.equal(RationService.needsConsolidation(actor([bread("a", ""), bread("b", "<p>Envenenado</p>")])), false);
});

test("utility migration only touches documents that came from the module", () => {
  assert.equal(isModuleUtilityDocument({ id: "imQ9P3r4J2Shdmsp" }), true);
  assert.equal(isModuleUtilityDocument({ id: "x", _stats: { compendiumSource: `Compendium.${MODULE_ID}.symbaroum-ind-resources.RollTable.y` } }), true);
  assert.equal(isModuleUtilityDocument({ id: "x", name: "Forest Events" }), false, "same name, user's own table");
});

test("shove movement needs the target rendered for wall checks; Generate Shadow only on character sheets", async () => {
  const sockets = await read("scripts/sockets.mjs");
  assert.match(sockets, /if \(!targetToken\.object\?\.checkCollision\) return \{ moved: false \};/);
  const bithir = await read("scripts/bithir-macros.mjs");
  assert.match(bithir, /\["player", "monster"\]\.includes\(app\.object\?\.type\)/);
});
