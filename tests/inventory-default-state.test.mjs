import assert from "node:assert/strict";
import {
  applyDefaultInventoryState,
  InventoryDefaultStateService,
  isModuleAdventure,
  normalizeAdventureInventory,
  normalizeEmbeddedInventoryItems,
  shouldDefaultToEquipped
} from "../scripts/inventory-default-state.mjs";

function item({
  type = "equipment",
  state = "other",
  parent = { documentName: "Actor" },
  flags = {}
} = {}) {
  return {
    type,
    parent,
    system: { state },
    flags,
    updates: [],
    updateSource(changes) {
      this.updates.push(changes);
      if (changes["system.state"]) this.system.state = changes["system.state"];
    }
  };
}

for (const type of ["weapon", "armor", "equipment", "artifact"]) {
  const pendingItem = item({ type });
  assert.equal(applyDefaultInventoryState(pendingItem), true);
  assert.equal(pendingItem.system.state, "equipped");
  assert.deepEqual(pendingItem.updates, [{ "system.state": "equipped" }]);
}

assert.equal(shouldDefaultToEquipped(item({ state: "active" })), false);
assert.equal(shouldDefaultToEquipped(item({ state: "equipped" })), false);
assert.equal(shouldDefaultToEquipped(item({ type: "ability" })), false);
assert.equal(shouldDefaultToEquipped(item({ parent: null })), false);

const storedItem = item({
  flags: {
    "symbaroum-ind-resources": {
      storedIn: "container-id"
    }
  }
});
assert.equal(shouldDefaultToEquipped(storedItem), false);

const groundContainer = item({
  flags: {
    "symbaroum-ind-resources": {
      groundContainer: { tokenId: "token-id" }
    }
  }
});
assert.equal(shouldDefaultToEquipped(groundContainer), false);

const transferredItem = item();
assert.equal(shouldDefaultToEquipped(transferredItem, {
  "symbaroum-ind-resources": {
    preserveItemState: true
  }
}), false);

const embeddedItems = [
  { type: "weapon", system: { state: "other" }, flags: {} },
  { type: "armor", system: { state: "active" }, flags: {} },
  { type: "ability", system: { state: "other" }, flags: {} },
  {
    type: "equipment",
    system: { state: "other" },
    flags: {
      "symbaroum-ind-resources": {
        storedIn: "container-id"
      }
    }
  }
];
assert.equal(normalizeEmbeddedInventoryItems(embeddedItems), 1);
assert.equal(embeddedItems[0].system.state, "equipped");
assert.equal(embeddedItems[1].system.state, "active");
assert.equal(embeddedItems[2].system.state, "other");
assert.equal(embeddedItems[3].system.state, "other");

const moduleAdventure = {
  uuid: "Compendium.symbaroum-ind-resources.symbaroum-ind-resources.Adventure.adventure-id"
};
const foreignAdventure = {
  uuid: "Compendium.symbaroum-corerules.adventure.Adventure.adventure-id"
};
assert.equal(isModuleAdventure(moduleAdventure), true);
assert.equal(isModuleAdventure(foreignAdventure), false);

const toCreate = {
  Actor: [{
    name: "Imported Actor",
    items: [{ type: "weapon", system: { state: "other" }, flags: {} }]
  }]
};
const toUpdate = {
  Actor: [{
    name: "Updated Actor",
    items: [{ type: "artifact", system: { state: "other" }, flags: {} }]
  }]
};
assert.equal(normalizeAdventureInventory(moduleAdventure, toCreate, toUpdate), 2);
assert.equal(toCreate.Actor[0].items[0].system.state, "equipped");
assert.equal(toUpdate.Actor[0].items[0].system.state, "equipped");

const foreignCreate = {
  Actor: [{
    items: [{ type: "weapon", system: { state: "other" }, flags: {} }]
  }]
};
assert.equal(normalizeAdventureInventory(foreignAdventure, foreignCreate, {}), 0);
assert.equal(foreignCreate.Actor[0].items[0].system.state, "other");

const originalHooks = globalThis.Hooks;
const handlers = new Map();
try {
  globalThis.Hooks = {
    on(name, callback) {
      handlers.set(name, callback);
    }
  };
  assert.equal(InventoryDefaultStateService.registerHooks(), true);
  assert.equal(handlers.has("preCreateItem"), true);
  assert.equal(handlers.has("preImportAdventure"), true);
} finally {
  globalThis.Hooks = originalHooks;
}

console.log("inventory default state tests passed");
