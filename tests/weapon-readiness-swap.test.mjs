import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { WeaponReadinessService } from "../scripts/weapon-readiness.mjs";
import { syncActorCombatState } from "../scripts/weapon-readiness-visuals.mjs";

const scope = "symbaroum-ind-resources";
const translations = JSON.parse(fs.readFileSync(new URL("../languages/pt-BR.json", import.meta.url), "utf8"));

function setup(t, { answer = true, enabled = true, owner = true, reference = "ranged" } = {}) {
  const saved = Object.fromEntries(["game", "ui", "foundry", "Hooks", "canvas"].map((key) => [key, globalThis[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  const oldWeapon = {
    id: "old", name: "Arco <antigo>", type: "weapon",
    system: { state: "active", reference, qualities: {} },
    flags: { [scope]: { weaponReadiness: "drawn" } }
  };
  const target = {
    id: "new", name: "Adaga <nova>", type: "weapon",
    system: { state: "equipped", reference: "short", qualities: {} }, flags: {}
  };
  const calls = { dialogs: [], updates: [], warnings: [], events: [] };
  const actor = {
    id: "hero", uuid: "Actor.hero", type: "player", isOwner: owner,
    items: [oldWeapon, target],
    async updateEmbeddedDocuments(type, patches) {
      assert.equal(type, "Item");
      calls.updates.push(patches);
      for (const patch of patches) {
        const item = this.items.find((entry) => entry.id === patch._id);
        for (const [path, value] of Object.entries(patch)) {
          if (path === "_id") continue;
          const keys = path.split(".");
          let parent = item;
          for (const key of keys.slice(0, -1)) parent = parent[key] ??= {};
          parent[keys.at(-1)] = value;
        }
      }
      return patches;
    }
  };
  actor.items.get = (id) => actor.items.find((item) => item.id === id);
  oldWeapon.parent = target.parent = actor;
  const gm = { id: "gm", isGM: true, active: true };
  globalThis.game = {
    user: gm, users: Object.assign([gm], { activeGM: gm }), modules: new Map(),
    settings: { get: (_scope, key) => key === "enableWeaponReadiness" ? enabled : key === "enableWeaponReadinessCombatSync" },
    i18n: {
      lang: "pt-BR", localize: (key) => translations[key] ?? key,
      format: (key, data) => (translations[key] ?? key).replace(/\{(\w+)\}/g, (_match, field) => data[field] ?? "")
    }
  };
  globalThis.ui = { notifications: { warn: (text) => calls.warnings.push(text) } };
  globalThis.foundry = { applications: { api: { DialogV2: {
    async confirm(config) { calls.dialogs.push(config); return typeof answer === "function" ? answer() : answer; }
  } } } };
  globalThis.Hooks = { callAll: (name, data) => calls.events.push({ name, data }) };
  return { actor, oldWeapon, target, calls };
}

test("confirming the hand-limit dialog swaps weapons in one document update", async (t) => {
  const { actor, oldWeapon, target, calls } = setup(t);
  assert.equal(await WeaponReadinessService.setDrawn(target, true), true);
  assert.equal(calls.dialogs.length, 1);
  assert.equal(calls.updates.length, 1);
  assert.deepEqual(calls.updates[0].map((patch) => [patch._id, patch["system.state"]]), [["old", "equipped"], ["new", "active"]]);
  assert.equal(oldWeapon.system.state, "equipped");
  assert.deepEqual(WeaponReadinessService.getDrawnWeapons(actor), [target]);
  assert.deepEqual(calls.events.map(({ data }) => data.current.map((item) => item.id)), [["new"]]);
  assert.deepEqual(calls.warnings, []);
});

for (const answer of [false, null]) {
  test(`${answer === false ? "cancelling" : "closing"} the dialog preserves the original weapon and emits no changes`, async (t) => {
    const { actor, oldWeapon, target, calls } = setup(t, { answer });
    assert.equal(await WeaponReadinessService.setDrawn(target, true), false);
    assert.deepEqual(WeaponReadinessService.getDrawnWeapons(actor), [oldWeapon]);
    assert.equal(target.system.state, "equipped");
    assert.deepEqual(calls.updates, []);
    assert.deepEqual(calls.events, []);
  });
}

test("confirmation names both weapons, escapes HTML and defaults to Cancel", async (t) => {
  const { target, calls } = setup(t, { answer: false });
  await WeaponReadinessService.setDrawn(target, true);
  const dialog = calls.dialogs[0];
  assert.match(dialog.content, /Arco &lt;antigo&gt;/);
  assert.match(dialog.content, /Adaga &lt;nova&gt;/);
  assert.doesNotMatch(dialog.content, /<antigo>|<nova>/);
  assert.equal(dialog.yes.label, "Trocar arma");
  assert.equal(dialog.no.label, "Cancelar");
  assert.equal(dialog.no.default, true);
  assert.equal(dialog.rejectClose, false);
});

test("two one-handed weapons remain usable together without a swap dialog", async (t) => {
  const { actor, target, calls } = setup(t, { reference: "1handed" });
  assert.equal(await WeaponReadinessService.setDrawn(target, true), true);
  assert.equal(WeaponReadinessService.getDrawnWeapons(actor).length, 2);
  assert.equal(calls.dialogs.length, 0);
});

test("drawing the first weapon needs no confirmation", async (t) => {
  const { target, oldWeapon, calls } = setup(t);
  oldWeapon.system.state = "equipped";
  assert.equal(await WeaponReadinessService.setDrawn(target, true), true);
  assert.equal(calls.dialogs.length, 0);
});

test("sheathing remains immediate", async (t) => {
  const { oldWeapon, calls } = setup(t);
  assert.equal(await WeaponReadinessService.setDrawn(oldWeapon, false), true);
  assert.equal(oldWeapon.system.state, "equipped");
  assert.equal(calls.dialogs.length, 0);
});

test("double clicking while confirmation is pending shows only one dialog and updates once", async (t) => {
  let resolve;
  const answer = new Promise((done) => { resolve = done; });
  const { target, calls } = setup(t, { answer: () => answer });
  const first = WeaponReadinessService.setDrawn(target, true);
  const second = WeaponReadinessService.setDrawn(target, true);
  assert.equal(calls.dialogs.length, 1);
  resolve(true);
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(calls.updates.length, 1);
});

test("a target moved to a container while the dialog is open is not drawn", async (t) => {
  const { actor, oldWeapon, target, calls } = setup(t, { answer: () => {
    target.flags[scope] = { storedIn: "backpack" };
    return true;
  } });
  assert.equal(await WeaponReadinessService.setDrawn(target, true), false);
  assert.deepEqual(WeaponReadinessService.getDrawnWeapons(actor), [oldWeapon]);
  assert.equal(calls.updates.length, 0);
});

test("a target removed while the dialog is open never sheathes the current weapon", async (t) => {
  const { actor, target, calls } = setup(t, { answer: () => {
    actor.items.splice(actor.items.indexOf(target), 1);
    return true;
  } });
  assert.equal(await WeaponReadinessService.setDrawn(target, true), false);
  assert.equal(calls.updates.length, 0);
});

test("changed readiness while confirmation is open invalidates the pending swap", async (t) => {
  const { oldWeapon, target, calls } = setup(t, { answer: () => {
    oldWeapon.system.state = "equipped";
    return true;
  } });
  assert.equal(await WeaponReadinessService.setDrawn(target, true), false);
  assert.equal(calls.updates.length, 0);
});

test("disabling readiness prevents the dialog and any update", async (t) => {
  const { target, calls } = setup(t, { enabled: false });
  assert.equal(await WeaponReadinessService.setDrawn(target, true), false);
  assert.equal(calls.dialogs.length, 0);
  assert.equal(calls.updates.length, 0);
});

test("a player without ownership cannot prompt or swap another actor's weapon", async (t) => {
  const { target, calls } = setup(t, { owner: false });
  globalThis.game.user = { id: "player", isGM: false };
  assert.equal(await WeaponReadinessService.setDrawn(target, true), false);
  assert.equal(calls.dialogs.length, 0);
  assert.equal(calls.updates.length, 0);
});

test("an invalid low-level multiweapon selection still respects the hand limit", async (t) => {
  const { actor, calls } = setup(t);
  assert.equal(await WeaponReadinessService.setDrawnWeapons(actor, ["old", "new"]), false);
  assert.equal(calls.dialogs.length, 0);
  assert.equal(calls.warnings.length, 1);
  assert.equal(calls.updates.length, 0);
});

test("confirmed swaps retain combatant identity, initiative, round and turn", async (t) => {
  const { actor, target, calls } = setup(t);
  const token = { id: "hero-token", inCombat: true };
  actor.getActiveTokens = () => [token];
  const combatant = { id: "hero-combatant", tokenId: token.id, initiative: 17, async delete() { assert.fail("swap must not remove combatant"); } };
  const combatants = new Map([[combatant.id, combatant]]);
  combatants.find = (predicate) => [...combatants.values()].find(predicate);
  const combat = { id: "encounter", scene: { id: "scene" }, round: 3, turn: 0, combatants, async delete() { assert.fail("swap must not end encounter"); } };
  globalThis.game.combats = [combat];
  globalThis.game.combat = combat;
  globalThis.canvas = { scene: { id: "scene" } };
  assert.equal(await WeaponReadinessService.setDrawn(target, true), true);
  for (const { data } of calls.events) await syncActorCombatState(actor, data.current);
  assert.equal(combat.combatants.get(combatant.id), combatant);
  assert.equal(combatant.initiative, 17);
  assert.equal(combat.round, 3);
  assert.equal(combat.turn, 0);
});
