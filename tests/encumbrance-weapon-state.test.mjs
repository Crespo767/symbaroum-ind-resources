import assert from "node:assert/strict";
import test from "node:test";

const scope = "symbaroum-ind-resources";

globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: class {},
      HandlebarsApplicationMixin: (base) => base
    }
  },
  utils: {
    deepClone: (value) => structuredClone(value),
    expandObject: (value) => value,
    randomID: () => "test-id"
  }
};

globalThis.game = { settings: { get: () => true } };

const { canModifyEncumbranceItem, EncumbranceService } = await import("../scripts/encumbrance.mjs");
const { applyDynamicEncumbranceWeights } = await import("../scripts/encumbrance-db.mjs");

function item(id, { type = "weapon", name = "Arco", state = "other", storedIn = "" } = {}) {
  return {
    id,
    type,
    name,
    parent: null,
    system: { state, isGear: true, reference: "ranged", qualities: {} },
    flags: storedIn ? { [scope]: { storedIn } } : {},
    getFlag(flagScope, key) {
      return this.flags?.[flagScope]?.[key];
    }
  };
}

function projectile(id, state) {
  const entry = item(id, { type: "equipment", name: "Flecha - Arpéu", state });
  entry.system.number = 49;
  return entry;
}

function actorWith(items) {
  const actor = { id: "actor", items: new Map() };
  for (const entry of items) {
    entry.parent = actor;
    actor.items.set(entry.id, entry);
  }
  return actor;
}

test("automatic slot persistence skips items the current player cannot update", async () => {
  const originalUser = globalThis.game.user;
  globalThis.game.user = { id: "player", isGM: false };
  let writes = 0;
  const restricted = item("restricted", { type: "equipment", name: "Corda", state: "active" });
  restricted.system.number = 1;
  restricted.canUserModify = (user, action) => {
    assert.equal(user, globalThis.game.user);
    assert.equal(action, "update");
    return false;
  };
  restricted.setFlag = async () => {
    writes += 1;
    throw new Error("setFlag must not be called");
  };

  try {
    assert.equal(canModifyEncumbranceItem(restricted), false);
    assert.equal(await EncumbranceService.autoAssignSlots(restricted), false);
    assert.equal(writes, 0);
  } finally {
    globalThis.game.user = originalUser;
  }
});

test("automatic slot persistence remains available to owners and GMs", async () => {
  const originalUser = globalThis.game.user;
  const owner = { id: "owner", isGM: false };
  globalThis.game.user = owner;
  const flags = {};
  const owned = item("owned", { type: "equipment", name: "Corda", state: "active" });
  owned.system.number = 1;
  owned.canUserModify = (user, action) => user === owner && action === "update";
  owned.setFlag = async (_scope, key, value) => {
    flags[key] = value;
  };

  try {
    assert.equal(canModifyEncumbranceItem(owned), true);
    assert.equal(await EncumbranceService.autoAssignSlots(owned), true);
    assert.equal(Number.isFinite(flags.encumbranceSlots), true);
    assert.equal(flags.encumbranceAutoAssigned, true);

    globalThis.game.user = { id: "gm", isGM: true };
    assert.equal(canModifyEncumbranceItem({ canUserModify: () => false }), true);
  } finally {
    globalThis.game.user = originalUser;
  }
});

test("weapon load follows native state and carried-container location", () => {
  const active = item("active", { state: "active" });
  const equipment = item("equipment", { state: "equipped" });
  const other = item("other", { state: "other" });
  const carriedContainer = item("backpack", { type: "equipment", name: "Mochila", state: "active" });
  carriedContainer.flags[scope] = { isContainer: true };
  const stored = item("stored", { state: "other", storedIn: carriedContainer.id });
  const warehouse = item("warehouse", { type: "equipment", name: "Mochila 2", state: "other" });
  warehouse.flags[scope] = { isContainer: true };
  const archived = item("archived", { state: "other", storedIn: warehouse.id });
  actorWith([active, equipment, other, carriedContainer, stored, warehouse, archived]);

  assert.equal(EncumbranceService.getItemLoad(active).totalSlots, 0);
  assert.equal(EncumbranceService.getItemLoad(equipment).totalSlots, 1);
  assert.equal(EncumbranceService.getItemLoad(other).totalSlots, 0);
  assert.equal(EncumbranceService.getItemLoad(stored).totalSlots, 1);
  assert.equal(EncumbranceService.getItemLoad(archived).totalSlots, 0);
});

test("weapon state transitions change only the weapon load contribution", () => {
  const weapon = item("weapon", { state: "active" });
  const actor = actorWith([weapon]);

  assert.equal(EncumbranceService.calculateLoad(actor).currentLoad, 0);
  weapon.system.state = "equipped";
  assert.equal(EncumbranceService.calculateLoad(actor).currentLoad, 1);
  weapon.system.state = "other";
  assert.equal(EncumbranceService.calculateLoad(actor).currentLoad, 0);
});

test("worn armor weighs zero while carried armor keeps its normal load", () => {
  const armor = item("armor", { type: "armor", name: "Armadura Pesada", state: "active" });
  armor.system.baseProtection = "1d8";
  const actor = actorWith([armor]);

  assert.equal(EncumbranceService.getItemSlots(armor), 4);
  assert.equal(EncumbranceService.getItemLoad(armor).totalSlots, 0);
  assert.equal(EncumbranceService.calculateLoad(actor).currentLoad, 0);

  armor.system.state = "equipped";
  assert.equal(EncumbranceService.getItemLoad(armor).totalSlots, 4);
  assert.equal(EncumbranceService.calculateLoad(actor).currentLoad, 4);

  armor.system.state = "other";
  assert.equal(EncumbranceService.getItemLoad(armor).totalSlots, 0);
});

test("armor stored in a carried container still weighs normally", () => {
  const backpack = item("backpack", { type: "equipment", name: "Mochila", state: "equipped" });
  backpack.flags[scope] = { isContainer: true };
  const armor = item("stored-armor", { type: "armor", name: "Armadura Média", state: "other", storedIn: backpack.id });
  armor.system.baseProtection = "1d6";
  actorWith([backpack, armor]);

  assert.equal(EncumbranceService.getItemLoad(armor).totalSlots, 3);
});

test("equipment projectiles count only while active or equipped", () => {
  applyDynamicEncumbranceWeights({
    bundles: { "Flecha - Arpéu": { bundleSize: 10, slots: 1 } }
  });
  const active = projectile("active-projectile", "active");
  const equipped = projectile("equipped-projectile", "equipped");
  const other = projectile("other-projectile", "other");

  assert.equal(EncumbranceService.getItemLoad(active).totalSlots, 4);
  assert.equal(EncumbranceService.getItemLoad(equipped).totalSlots, 4);
  assert.equal(EncumbranceService.getItemLoad(other).totalSlots, 0);
});

test("camping equipment weighs two while its dedicated contents weigh zero only inside it", () => {
  const camping = item("camping", { type: "equipment", name: "Equipamento de Acampar", state: "equipped" });
  camping.system.number = 1;
  const rope = item("rope", { type: "equipment", name: "Corda", state: "other", storedIn: camping.id });
  rope.system.number = 1;
  const torch = item("torch", { type: "equipment", name: "Tocha", state: "other", storedIn: camping.id });
  torch.system.number = 1;
  actorWith([camping, rope, torch]);

  assert.equal(EncumbranceService.getItemSlots(camping), 2);
  assert.equal(EncumbranceService.getItemLoad(camping).totalSlots, 2);
  assert.equal(EncumbranceService.getItemLoad(rope).totalSlots, 0);
  assert.equal(EncumbranceService.getItemLoad(torch).totalSlots, 1);

  delete rope.flags[scope].storedIn;
  rope.system.state = "equipped";
  assert.equal(EncumbranceService.getItemLoad(rope).totalSlots, 1);
});
