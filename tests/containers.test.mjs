import assert from "node:assert/strict";
import test from "node:test";

const scope = "symbaroum-ind-resources";
const settings = new Map([
  [`${scope}.enableContainers`, true],
  [`${scope}.containerExpansionState`, {}]
]);
const hookHandlers = new Map();

globalThis.foundry = {
  utils: {
    deepClone: (value) => structuredClone(value)
  }
};
globalThis.game = {
  user: { id: "gm", isGM: true },
  symbaroum: { config: {} },
  settings: {
    get: (moduleId, key) => settings.get(`${moduleId}.${key}`),
    set: async (moduleId, key, value) => {
      settings.set(`${moduleId}.${key}`, value);
      return value;
    }
  },
  i18n: {
    localize: (key) => key,
    format: (key, data) => `${key}:${JSON.stringify(data)}`
  }
};
globalThis.ui = {
  notifications: { info() {}, warn() {} },
  windows: {}
};
globalThis.Hooks = {
  on: (name, callback) => hookHandlers.set(name, callback)
};

const { ContainerService } = await import("../scripts/containers.mjs");

function clone(value) {
  return structuredClone(value);
}

function applyPatch(target, patch) {
  for (const [path, value] of Object.entries(patch)) {
    if (path === "_id") continue;
    const parts = path.split(".");
    let cursor = target;
    for (let index = 0; index < parts.length - 1; index += 1) {
      cursor[parts[index]] ??= {};
      cursor = cursor[parts[index]];
    }
    const key = parts.at(-1);
    if (key.startsWith("-=")) delete cursor[key.slice(2)];
    else cursor[key] = value;
  }
}

function createActor({ id = "actor", isOwner = true } = {}) {
  const items = new Map();
  const actor = {
    id,
    uuid: `Actor.${id}`,
    type: "player",
    isOwner,
    items,
    created: [],
    deleted: [],
    async updateEmbeddedDocuments(type, updates) {
      assert.equal(type, "Item");
      for (const update of updates) {
        const item = items.get(update._id);
        assert.ok(item, `Unknown item ${update._id}`);
        applyPatch(item, update);
      }
      return updates.map((update) => items.get(update._id));
    },
    async createEmbeddedDocuments(type, data) {
      assert.equal(type, "Item");
      const created = data.map((source, index) => createItem(actor, {
        ...clone(source),
        id: source._id ?? `created-${actor.created.length + index + 1}`
      }));
      actor.created.push(...created.map((item) => item.id));
      return created;
    },
    async deleteEmbeddedDocuments(type, ids) {
      assert.equal(type, "Item");
      for (const itemId of ids) items.delete(itemId);
      actor.deleted.push(...ids);
      return ids;
    }
  };
  return actor;
}

function createItem(actor, {
  id,
  name = "Item",
  type = "equipment",
  img = "item.webp",
  system = {},
  flags = {}
}) {
  const item = {
    id,
    name,
    type,
    img,
    parent: actor,
    system: { number: 1, state: "equipped", description: "", ...clone(system) },
    flags: clone(flags),
    getFlag(flagScope, key) {
      return this.flags?.[flagScope]?.[key];
    },
    async setFlag(flagScope, key, value) {
      this.flags[flagScope] ??= {};
      this.flags[flagScope][key] = value;
      return value;
    },
    async update(patch) {
      applyPatch(this, patch);
      return this;
    },
    toObject() {
      return clone({
        _id: this.id,
        name: this.name,
        type: this.type,
        img: this.img,
        system: this.system,
        flags: this.flags
      });
    }
  };
  actor.items.set(item.id, item);
  return item;
}

function containerFlags(containerId, containerName, preStoredState = "equipped") {
  return {
    [scope]: {
      storedIn: containerId,
      storedInName: containerName,
      preStoredState
    }
  };
}

test("container recognition uses exact aliases and exclusions", () => {
  const actor = createActor();
  assert.equal(ContainerService.isContainer(createItem(actor, { id: "bag", name: "Mochila" })), true);
  assert.equal(ContainerService.isContainer(createItem(actor, { id: "sleep", name: "Saco de Dormir" })), false);
  assert.equal(ContainerService.isContainer(createItem(actor, { id: "tool", name: "Caixa de Ferramentas" })), false);
});

test("camping equipment accepts only its six dedicated contents", async () => {
  const actor = createActor();
  const camping = createItem(actor, { id: "camping-kit", name: "Equipamentos de Acampar" });
  const allowedNames = [
    "Saco de Dormir",
    "Frigideira",
    "Lenha",
    "Pederneira e Isqueiro",
    "Corda",
    "Cantil"
  ];

  assert.equal(ContainerService.isCampingEquipment(camping), true);
  assert.deepEqual(ContainerService.getContainerCapacity(camping), { mode: "slots", value: 6 });
  for (const [index, name] of allowedNames.entries()) {
    const item = createItem(actor, { id: `camping-content-${index}`, name });
    assert.equal(ContainerService.isCampingContentAllowed(item), true, name);
    assert.equal(ContainerService.canStoreInContainer(actor, item, camping), true, name);
  }

  const torch = createItem(actor, { id: "torch", name: "Tocha" });
  assert.equal(ContainerService.isCampingContentAllowed(torch), false);
  assert.equal(ContainerService.canStoreInContainer(actor, torch, camping), false);
  assert.equal(await ContainerService.storeItem(actor, torch, camping), false);
  assert.equal(ContainerService.isStored(torch), false);
});

test("container mutations require ownership and positive equipment quantity", async () => {
  const actor = createActor({ isOwner: false });
  game.user.isGM = false;
  const item = createItem(actor, { id: "item", name: "Corda", system: { number: 1 } });
  const container = createItem(actor, { id: "bag", name: "Mochila" });
  assert.equal(await ContainerService.storeItem(actor, item, container), false);
  assert.equal(ContainerService.canAttemptStoreItem(createItem(actor, {
    id: "zero",
    name: "Cantill",
    system: { number: 0 }
  })), false);
  settings.set(`${scope}.enableContainers`, false);
  game.user.isGM = true;
  assert.equal(ContainerService.canAttemptStoreItem(item), false);
  settings.set(`${scope}.enableContainers`, true);
});

test("storing and withdrawing preserve the native item state", async () => {
  const actor = createActor();
  const item = createItem(actor, { id: "rope", name: "Corda", system: { state: "active" } });
  const container = createItem(actor, { id: "bag", name: "Mochila" });

  assert.equal(await ContainerService.storeItem(actor, item, container), true);
  assert.equal(item.system.state, "other");
  assert.equal(ContainerService.getStoredIn(item), container.id);
  assert.equal(item.getFlag(scope, "preStoredState"), "active");

  assert.equal(await ContainerService.withdrawItem(actor, item), true);
  assert.equal(item.system.state, "active");
  assert.equal(ContainerService.isStored(item), false);
});

test("default withdrawal moves the full stack while an explicit split moves only the chosen amount", async () => {
  const actor = createActor();
  const container = createItem(actor, { id: "bag", name: "Mochila" });
  const fullStack = createItem(actor, {
    id: "full-stack",
    name: "Corda",
    system: { number: 5, state: "other" },
    flags: containerFlags(container.id, container.name)
  });

  assert.equal(await ContainerService.withdrawItemPrompt(actor, fullStack), true);
  assert.equal(fullStack.system.number, 5);
  assert.equal(fullStack.system.state, "equipped");
  assert.equal(ContainerService.isStored(fullStack), false);

  const splitStack = createItem(actor, {
    id: "split-stack",
    name: "Tocha",
    system: { number: 5, state: "other" },
    flags: containerFlags(container.id, container.name)
  });

  assert.equal(await ContainerService.withdrawItem(actor, splitStack, 2), true);
  assert.equal(splitStack.system.number, 3);
  assert.equal(ContainerService.isStored(splitStack), true);
  const withdrawn = actor.items.get("created-1");
  assert.equal(withdrawn.system.number, 2);
  assert.equal(withdrawn.system.state, "equipped");
  assert.equal(ContainerService.isStored(withdrawn), false);
});

test("split prompt keeps at least one unit stored and moves the selected portion", async () => {
  const actor = createActor();
  const container = createItem(actor, { id: "bag", name: "Mochila" });
  const stack = createItem(actor, {
    id: "split-prompt",
    name: "Tocha",
    system: { number: 5, state: "other" },
    flags: containerFlags(container.id, container.name)
  });
  const originalApplications = globalThis.foundry.applications;
  let dialogOptions;

  globalThis.foundry.applications = {
    api: {
      DialogV2: {
        async prompt(options) {
          dialogOptions = options;
          return options.ok.callback(null, null, {
            element: {
              querySelector: () => ({ value: "5" })
            }
          });
        }
      }
    }
  };

  try {
    assert.equal(await ContainerService.splitItemPrompt(actor, stack), true);
    assert.match(dialogOptions.content, /max="4"/);
    assert.equal(stack.system.number, 1);
    assert.equal(ContainerService.isStored(stack), true);
    const withdrawn = actor.items.get("created-1");
    assert.equal(withdrawn.system.number, 4);
    assert.equal(ContainerService.isStored(withdrawn), false);
  } finally {
    globalThis.foundry.applications = originalApplications;
  }
});

test("only equivalent stacks with the same restored state merge", async () => {
  const actor = createActor();
  const container = createItem(actor, { id: "bag", name: "Mochila" });
  const stored = createItem(actor, {
    id: "stored",
    name: "Corda",
    system: { number: 2, state: "other", description: "Corda comum" },
    flags: containerFlags(container.id, container.name, "active")
  });
  const compatible = createItem(actor, {
    id: "compatible",
    name: "Corda",
    system: { number: 3, state: "active", description: "Corda comum" }
  });

  assert.equal(await ContainerService.storeItem(actor, compatible, container, 3), true);
  assert.equal(stored.system.number, 5);
  assert.equal(actor.items.has(compatible.id), false);

  const differentState = createItem(actor, {
    id: "different-state",
    name: "Corda",
    system: { number: 1, state: "equipped", description: "Corda comum" }
  });
  assert.equal(await ContainerService.storeItem(actor, differentState, container), true);
  assert.equal(actor.items.has(differentState.id), true);
  assert.equal(ContainerService.isStored(differentState), true);

  const differentDescription = createItem(actor, {
    id: "different-description",
    name: "Corda",
    system: { number: 1, state: "active", description: "Corda especial" }
  });
  assert.equal(await ContainerService.storeItem(actor, differentDescription, container), true);
  assert.equal(actor.items.has(differentDescription.id), true);
});

test("partial split rolls back a newly created stack when source update fails", async () => {
  const actor = createActor();
  const container = createItem(actor, { id: "bag", name: "Mochila" });
  const item = createItem(actor, { id: "rope", name: "Corda", system: { number: 5 } });
  item.update = async () => { throw new Error("update failed"); };

  await assert.rejects(ContainerService.storeItem(actor, item, container, 2), /update failed/);
  assert.deepEqual(actor.created, ["created-1"]);
  assert.deepEqual(actor.deleted, ["created-1"]);
  assert.equal(actor.items.has("created-1"), false);
  assert.equal(item.system.number, 5);
});

test("full stack merge restores the target when deleting the source fails", async () => {
  const actor = createActor();
  const container = createItem(actor, { id: "bag", name: "Mochila" });
  const stored = createItem(actor, {
    id: "stored",
    name: "Corda",
    system: { number: 2, state: "other" },
    flags: containerFlags(container.id, container.name)
  });
  const source = createItem(actor, { id: "source", name: "Corda", system: { number: 3 } });
  actor.deleteEmbeddedDocuments = async () => { throw new Error("delete failed"); };

  await assert.rejects(ContainerService.storeItem(actor, source, container, 3), /delete failed/);
  assert.equal(stored.system.number, 2);
  assert.equal(actor.items.has(source.id), true);
});

test("orphan and invalid container links are recovered idempotently", async () => {
  const actor = createActor();
  const invalidTarget = createItem(actor, { id: "target", name: "Frigideira" });
  const orphan = createItem(actor, {
    id: "orphan",
    name: "Corda",
    system: { state: "other" },
    flags: containerFlags("missing", "Mochila", "active")
  });
  const invalid = createItem(actor, {
    id: "invalid",
    name: "Cantil",
    system: { state: "other" },
    flags: containerFlags(invalidTarget.id, invalidTarget.name, "equipped")
  });

  assert.equal(await ContainerService.recoverOrphanedStoredItems(actor), 2);
  assert.equal(orphan.system.state, "active");
  assert.equal(invalid.system.state, "equipped");
  assert.equal(ContainerService.isStored(orphan), false);
  assert.equal(await ContainerService.recoverOrphanedStoredItems(actor), 0);
});

test("enabling and disabling containers synchronizes states and repairs nonempty zero stacks", async () => {
  const actor = createActor();
  const container = createItem(actor, { id: "bag", name: "Mochila", system: { number: 0 } });
  const stored = createItem(actor, {
    id: "stored",
    name: "Corda",
    system: { state: "other" },
    flags: containerFlags(container.id, container.name, "active")
  });

  assert.equal(await ContainerService.synchronizeActorStates(actor, false), 2);
  assert.equal(stored.system.state, "active");
  assert.equal(container.system.number, 1);
  assert.equal(await ContainerService.synchronizeActorStates(actor, true), 1);
  assert.equal(stored.system.state, "other");
});

test("expanded state is client-scoped and a nonempty container cannot be depleted", async () => {
  const actor = createActor();
  const container = createItem(actor, { id: "bag", name: "Mochila" });
  createItem(actor, {
    id: "stored",
    name: "Corda",
    system: { state: "other" },
    flags: containerFlags(container.id, container.name)
  });

  assert.equal(await ContainerService.toggleContainer(actor, container), true);
  assert.equal(ContainerService.isContainerExpanded(actor, container), true);
  assert.equal(settings.get(`${scope}.containerExpansionState`)[`${actor.uuid}:${container.id}`], true);

  const originalSettingsSet = game.settings.set;
  game.settings.set = async () => { throw new Error("client storage unavailable"); };
  assert.equal(await ContainerService.collapseContainer(actor, container), true);
  assert.equal(ContainerService.isContainerExpanded(actor, container), false);
  game.settings.set = originalSettingsSet;

  ContainerService.registerHooks();
  assert.equal(hookHandlers.get("preUpdateItem")(container, { "system.number": 0 }, {}, game.user.id), false);
  assert.equal(hookHandlers.get("preUpdateItem")(container, { system: { number: 0 } }, {}, game.user.id), false);
  assert.equal(hookHandlers.get("preUpdateItem")(container, { "system.number": 1 }, {}, game.user.id), true);
  assert.equal(hookHandlers.has("preDeleteItem"), false);
});

test("camping equipment with existing contents is marked seeded without duplicating items", async () => {
  const actor = createActor({ id: "camping" });
  const container = createItem(actor, { id: "camp", name: "Equipamento de Acampar" });
  createItem(actor, {
    id: "bedroll",
    name: "Saco de dormir",
    system: { state: "other" },
    flags: containerFlags(container.id, container.name)
  });

  assert.equal(await ContainerService.toggleContainer(actor, container), true);
  assert.equal(container.getFlag(scope, "campingContentsSeeded"), true);
  assert.deepEqual(actor.created, []);
});

test("new camping equipment is seeded without requiring the container to be opened", async () => {
  const actor = createActor({ id: "camping-create" });
  const container = createItem(actor, { id: "camp-new", name: "Equipamento de Acampar" });
  ContainerService.registerHooks();

  hookHandlers.get("createItem")(container, {}, game.user.id);
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(ContainerService.isContainerExpanded(actor, container), false);
  assert.equal(container.getFlag(scope, "campingContentsSeeded"), true);
  assert.equal(ContainerService.getStoredItems(actor, container).length, 6);
});

test("state synchronization seeds older unopened camping equipment", async () => {
  const actor = createActor({ id: "camping-existing" });
  const container = createItem(actor, { id: "camp-existing", name: "Equipamentos de Acampar" });

  assert.equal(await ContainerService.synchronizeActorStates(actor, true), 6);
  assert.equal(ContainerService.isContainerExpanded(actor, container), false);
  assert.equal(ContainerService.getStoredItems(actor, container).length, 6);
  assert.equal(await ContainerService.synchronizeActorStates(actor, true), 0);
  assert.equal(ContainerService.getStoredItems(actor, container).length, 6);
});

test("container capacity defaults use slots while unknown containers remain unlimited", () => {
  const actor = createActor();
  const backpack = createItem(actor, { id: "backpack", name: "Mochila" });
  const pouch = createItem(actor, { id: "pouch", name: "Bolsa de moedas" });
  const chest = createItem(actor, { id: "chest", name: "Baú" });

  assert.deepEqual(ContainerService.getContainerCapacity(backpack), { mode: "slots", value: 10 });
  assert.deepEqual(ContainerService.getContainerCapacity(pouch), { mode: "slots", value: 2 });
  assert.deepEqual(ContainerService.getContainerCapacity(chest), { mode: "unlimited" });
  assert.equal(ContainerService.getContainerCapacityLabel(actor, backpack), "0/10");
});

test("capacity can be configured per container and invalid values are rejected", async () => {
  const actor = createActor();
  const backpack = createItem(actor, { id: "backpack-config", name: "Mochila" });

  assert.equal(await ContainerService.setContainerCapacity(actor, backpack, { mode: "slots", value: 4 }), true);
  assert.deepEqual(ContainerService.getContainerCapacity(backpack), { mode: "slots", value: 4 });
  assert.equal(await ContainerService.setContainerCapacity(actor, backpack, { mode: "slots", value: 0 }), false);
  assert.equal(await ContainerService.setContainerCapacity(actor, backpack, { mode: "unknown", value: 4 }), false);
  assert.equal(await ContainerService.setContainerCapacity(actor, backpack, { mode: "unlimited" }), true);
  assert.deepEqual(ContainerService.getContainerCapacity(backpack), { mode: "unlimited" });
});

test("finite capacity blocks a new slot but allows a compatible equipment merge", async () => {
  const actor = createActor();
  const backpack = createItem(actor, { id: "limited", name: "Mochila" });
  createItem(actor, {
    id: "stored-rope",
    name: "Corda",
    system: { number: 2, state: "other" },
    flags: containerFlags(backpack.id, backpack.name, "equipped")
  });
  for (let index = 1; index < 10; index += 1) {
    createItem(actor, {
      id: `stored-${index}`,
      name: `Item ${index}`,
      system: { state: "other" },
      flags: containerFlags(backpack.id, backpack.name)
    });
  }

  const newItem = createItem(actor, { id: "new-item", name: "Corda", system: { state: "equipped", number: 1 } });
  assert.equal(ContainerService.getContainerCapacityLabel(actor, backpack), "10/10");
  assert.equal(ContainerService.canStoreInContainer(actor, newItem, backpack), true);
  assert.equal(await ContainerService.storeItem(actor, newItem, backpack), true);
  assert.equal(actor.items.has(newItem.id), false);

  const blocked = createItem(actor, { id: "blocked-item", name: "Cantil", system: { state: "equipped" } });
  assert.equal(ContainerService.canStoreInContainer(actor, blocked, backpack), false);
  assert.equal(await ContainerService.storeItem(actor, blocked, backpack), false);
});

test("ordinary container deletion restores contents while transfer deletion preserves them", async () => {
  const actor = createActor();
  const backpack = createItem(actor, { id: "preserve", name: "Mochila" });
  const storedItem = createItem(actor, {
    id: "stored-preserve",
    name: "Corda",
    system: { state: "other" },
    flags: containerFlags(backpack.id, backpack.name)
  });

  ContainerService.registerHooks();
  assert.equal(hookHandlers.has("preDeleteItem"), false);
  assert.equal(ContainerService.canPreserveContentsOnDelete(backpack, { [scope]: { preserveContents: true } }), true);

  actor.items.delete(backpack.id);
  hookHandlers.get("deleteItem")(backpack, {}, game.user.id);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(ContainerService.isStored(storedItem), false);
  assert.equal(storedItem.system.state, "equipped");
});
