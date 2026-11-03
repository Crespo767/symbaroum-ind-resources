import assert from "node:assert/strict";
import test from "node:test";
import { syncActorCombatState } from "../scripts/weapon-readiness-visuals.mjs";

function setup(t, { generation = 13, role = "gm", enabled = true, participants = 1 } = {}) {
  const saved = Object.fromEntries(["game", "canvas", "Combat"].map((key) => [key, globalThis[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  const gm = { id: "gm", active: true, isGM: true };
  const user = role === "gm" ? gm : { id: role, active: true, isGM: role === "secondaryGM" };
  const calls = { removed: 0, ended: 0, created: 0, added: 0 };
  const combatants = new Map();
  combatants.find = (predicate) => [...combatants.values()].find(predicate);
  const combat = {
    id: "encounter", scene: { id: "scene" }, combatants,
    async delete() {
      assert.equal(combatants.size, 0, "only an empty encounter may end");
      calls.ended++;
    },
    async createEmbeddedDocuments(type, data) {
      assert.equal(type, "Combatant");
      calls.added += data.length;
    }
  };
  const token = { id: "token", name: "Hero", inCombat: participants > 0 };
  if (participants > 0) combatants.set("hero", {
    id: "hero", tokenId: token.id,
    async delete() {
      calls.removed++;
      combatants.delete(this.id);
      token.inCombat = false;
    }
  });
  for (let i = 1; i < participants; i++) {
    combatants.set(`other-${i}`, { id: `other-${i}`, tokenId: `other-token-${i}` });
  }
  const actor = {
    id: "hero", uuid: "Actor.hero", type: "player", isOwner: true,
    getActiveTokens: () => [token],
    testUserPermission: () => true
  };
  globalThis.game = {
    release: { generation }, user,
    users: Object.assign(role === "gm" ? [gm] : [gm, user], { activeGM: role === "noGM" ? null : gm }),
    settings: { get: (_scope, key) => key === "enableWeaponReadinessCombatSync" && enabled },
    combats: [combat], combat, modules: new Map()
  };
  if (role === "noGM") globalThis.game.users = [user];
  globalThis.canvas = { scene: { id: "scene" } };
  globalThis.Combat = { async create() { calls.created++; return combat; } };
  return { actor, token, combat, calls };
}

for (const generation of [13, 14]) {
  for (const started of [false, true]) {
    test(`Foundry v${generation}: sheathing ends an empty ${started ? "started" : "unstarted"} encounter`, async (t) => {
      const { actor, combat, calls } = setup(t, { generation });
      combat.started = started;
      await syncActorCombatState(actor, []);
      assert.equal(calls.removed, 1);
      assert.equal(calls.ended, 1);
    });
  }
}

test("sheathing preserves an encounter containing another participant, including NPCs", async (t) => {
  const { actor, calls } = setup(t, { participants: 2 });
  await syncActorCombatState(actor, []);
  assert.equal(calls.removed, 1);
  assert.equal(calls.ended, 0);
});

test("the encounter ends only after all tokens of the actor leave it", async (t) => {
  const { actor, combat, token, calls } = setup(t, { participants: 2 });
  const second = { id: "other-token-1", inCombat: true };
  const entry = combat.combatants.get("other-1");
  entry.delete = async () => { calls.removed++; combat.combatants.delete(entry.id); second.inCombat = false; };
  actor.getActiveTokens = () => [token, second];
  await syncActorCombatState(actor, []);
  assert.equal(calls.removed, 2);
  assert.equal(calls.ended, 1);
});

test("a participant added while removal is pending keeps the encounter open", async (t) => {
  const { actor, combat, calls } = setup(t);
  const entry = combat.combatants.get("hero");
  const remove = entry.delete.bind(entry);
  entry.delete = async () => { await remove(); combat.combatants.set("arrival", { id: "arrival" }); };
  await syncActorCombatState(actor, []);
  assert.equal(calls.ended, 0);
});

test("a cancelled removal does not end the encounter", async (t) => {
  const { actor, combat, calls } = setup(t);
  combat.combatants.get("hero").delete = async () => null;
  await syncActorCombatState(actor, []);
  assert.equal(calls.ended, 0);
});

test("unrelated empty encounters are preserved", async (t) => {
  const { actor, calls } = setup(t, { participants: 0 });
  await syncActorCombatState(actor, []);
  assert.equal(calls.ended, 0);
});

test("keeping another weapon drawn preserves combat membership", async (t) => {
  const { actor, calls } = setup(t);
  await syncActorCombatState(actor, [{ id: "other-weapon" }]);
  assert.equal(calls.removed, 0);
  assert.equal(calls.ended, 0);
});

test("disabled combat synchronization preserves membership and encounters", async (t) => {
  const { actor, calls } = setup(t, { enabled: false });
  await syncActorCombatState(actor, []);
  assert.equal(calls.removed, 0);
  assert.equal(calls.ended, 0);
});

for (const role of ["player", "trustedPlayer", "secondaryGM"]) {
  test(`${role} defers combat changes to the active GM to avoid duplicate removals`, async (t) => {
    const { actor, calls } = setup(t, { role });
    await syncActorCombatState(actor, []);
    assert.equal(calls.removed, 0);
    assert.equal(calls.ended, 0);
  });
}

test("without an active GM an owner never deletes the encounter", async (t) => {
  const { actor, calls } = setup(t, { role: "noGM" });
  await syncActorCombatState(actor, []);
  assert.equal(calls.ended, 0);
});

test("NPC weapon updates do not trigger player combat synchronization", async (t) => {
  const { actor, calls } = setup(t);
  actor.type = "monster";
  await syncActorCombatState(actor, []);
  assert.equal(calls.removed, 0);
  assert.equal(calls.ended, 0);
});

test("drawing a weapon still creates an encounter and adds the token", async (t) => {
  const { actor, calls } = setup(t, { participants: 0 });
  globalThis.game.combats = [];
  globalThis.game.combat = null;
  await syncActorCombatState(actor, [{ id: "sword" }]);
  assert.equal(calls.created, 1);
  assert.equal(calls.added, 1);
  assert.equal(calls.ended, 0);
});
