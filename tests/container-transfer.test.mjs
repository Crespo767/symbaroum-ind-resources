import assert from "node:assert/strict";
import test from "node:test";

globalThis.game = { user: { isGM: true }, modules: new Map() };
globalThis.Hooks = { on() {} };

const { ContainerTransferService } = await import("../scripts/container-transfer.mjs");

const scope = "symbaroum-ind-resources";

function createCollection(items = []) {
  const collection = new Map(items.map((item) => [item.id, item]));
  collection[Symbol.iterator] = function* iterator() {
    yield* this.values();
  };
  return collection;
}

function createItem({ id, name, storedIn = "", type = "equipment", state = "equipped" }) {
  const item = {
    id,
    _id: id,
    name,
    type,
    parent: null,
    system: { number: 1, state },
    flags: {
      [scope]: storedIn ? { storedIn, storedInName: "Mochila" } : {}
    },
    getFlag(flagScope, key) {
      return this.flags?.[flagScope]?.[key];
    },
    toObject() {
      return {
        _id: this.id,
        name: this.name,
        type: this.type,
        system: { ...this.system },
        flags: structuredClone(this.flags)
      };
    }
  };
  return item;
}

function createTransferTarget(item, targetId, transferId = "transfer-1") {
  const data = item.toObject();
  data._id = targetId;
  data.flags[scope] ??= {};
  data.flags[scope].containerTransferDelete = {
    id: transferId,
    sourceItemId: item.id,
    expiresAt: Date.now() + 60000
  };
  return data;
}

function createActor(items) {
  const actor = {
    id: "actor-1",
    uuid: "Actor.actor-1",
    type: "player",
    isOwner: true,
    items: createCollection(items),
    async createEmbeddedDocuments(type, data) {
      assert.equal(type, "Item");
      return data.map((source) => {
        const created = {
          ...structuredClone(source),
          id: source._id,
          _id: source._id,
          parent: this,
          getFlag(flagScope, key) {
            return this.flags?.[flagScope]?.[key];
          },
          toObject() {
            return {
              _id: this.id,
              name: this.name,
              type: this.type,
              system: structuredClone(this.system),
              flags: structuredClone(this.flags)
            };
          },
          async update(patch) {
            if (patch["system.state"] !== undefined) this.system.state = patch["system.state"];
            return this;
          }
        };
        this.items.set(created.id, created);
        return created;
      });
    },
    async updateEmbeddedDocuments(type, updates) {
      assert.equal(type, "Item");
      for (const update of updates) {
        const item = this.items.get(update._id);
        if (!item) continue;
        const authorizationPath = `flags.${scope}.containerTransferDelete`;
        const removalPath = `flags.${scope}.-=containerTransferDelete`;
        if (update[authorizationPath] !== undefined) {
          item.flags[scope] ??= {};
          item.flags[scope].containerTransferDelete = structuredClone(update[authorizationPath]);
        }
        if (update[removalPath] === null) delete item.flags[scope]?.containerTransferDelete;
      }
      return updates;
    },
    async deleteEmbeddedDocuments(type, ids) {
      assert.equal(type, "Item");
      for (const id of ids) this.items.delete(id);
      return ids;
    }
  };
  for (const item of items) item.parent = actor;
  return actor;
}

test("dropping a ground container onto an actor transfers its complete tree and restores its state", async () => {
  const root = createItem({ id: "root-1", name: "Mochila", state: "other" });
  const child = createItem({ id: "child-1", name: "Corda", storedIn: root.id, state: "other" });
  const sourceActor = createActor([root, child]);
  sourceActor.id = "pile-actor";
  sourceActor.uuid = "Actor.pile-actor";
  root.flags[scope].containerType = "backpack";
  root.flags[scope].groundContainer = {
    version: 1,
    tokenId: "pile-token",
    sceneId: "scene-1",
    actorId: sourceActor.id,
    actorUuid: sourceActor.uuid,
    containerId: root.id,
    previousState: "equipped"
  };
  const targetActor = createActor([]);
  targetActor.id = "target-actor";
  targetActor.uuid = "Actor.target-actor";

  assert.equal(await ContainerTransferService.transferBetweenActors(sourceActor, targetActor, root), true);
  assert.equal(sourceActor.items.size, 0);
  assert.equal(targetActor.items.size, 2);

  const transferred = [...targetActor.items.values()];
  const targetRoot = transferred.find((item) => item.name === "Mochila");
  const targetChild = transferred.find((item) => item.name === "Corda");
  assert.equal(targetRoot.system.state, "equipped");
  assert.equal(targetRoot.flags[scope].groundContainer, undefined);
  assert.equal(targetChild.flags[scope].storedIn, targetRoot.id);
});

test("dropping an Item Piles ground container uses the provider transaction", async () => {
  const root = createItem({ id: "root-1", name: "Mochila", state: "other" });
  const child = createItem({ id: "child-1", name: "Corda", storedIn: root.id, state: "other" });
  const sourceActor = createActor([root, child]);
  sourceActor.id = "pile-actor";
  sourceActor.uuid = "Actor.pile-actor";
  sourceActor.isOwner = false;
  root.flags[scope].containerType = "backpack";
  root.flags[scope].groundContainer = {
    version: 1,
    tokenId: "pile-token",
    sceneId: "scene-1",
    actorId: sourceActor.id,
    actorUuid: sourceActor.uuid,
    containerId: root.id,
    previousState: "equipped"
  };
  const targetActor = createActor([]);
  targetActor.id = "target-actor";
  targetActor.uuid = "Actor.target-actor";
  const previousGame = globalThis.game;
  const transferredIds = [];

  globalThis.game = {
    user: { isGM: false },
    modules: new Map([["item-piles-symbaroum", { active: true }]]),
    itempiles: {
      CONSTANTS: { MODULE_NAME: "item-piles-symbaroum", HOOKS: { ITEM: { PRE_TRANSFER: "item-piles-symbaroum-preTransferItems" } } },
      API: {
        async transferItems(source, target, ids, options) {
          transferredIds.push(...ids);
          const itemsToCreate = ids.map((id) => {
            const data = source.items.get(id).toObject();
            data._id = `${id}-target`;
            return data;
          });
          const sourceUpdates = {
            itemsToDelete: [...ids],
            itemDeltas: ids.map((id) => ({ item: { _id: id }, quantity: -1 }))
          };
          assert.equal(ContainerTransferService.handleItemPilePreTransfer(
            source,
            sourceUpdates,
            target,
            { itemsToCreate },
            options.interactionId
          ), true);
          await target.createEmbeddedDocuments("Item", itemsToCreate);
          await source.deleteEmbeddedDocuments("Item", ids);
          return true;
        }
      }
    }
  };

  try {
    const result = await ContainerTransferService.handleActorItemDrop(targetActor, root);
    assert.deepEqual(result, { handled: true, result: true });
    assert.deepEqual(transferredIds.sort(), [child.id, root.id].sort());
    assert.equal(sourceActor.items.size, 0);
    assert.equal(targetActor.items.size, 2);
    const targetRoot = [...targetActor.items.values()].find((item) => item.name === "Mochila");
    const targetChild = [...targetActor.items.values()].find((item) => item.name === "Corda");
    assert.equal(targetRoot.system.state, "equipped");
    assert.equal(targetRoot.flags[scope].groundContainer, undefined);
    assert.equal(targetChild.flags[scope].storedIn, targetRoot.id);
  } finally {
    globalThis.game = previousGame;
  }
});

test("dropping a regular container in Other state onto an actor remains blocked", async () => {
  const root = createItem({ id: "root-1", name: "Mochila", state: "other" });
  const sourceActor = createActor([root]);
  const targetActor = createActor([]);
  root.flags[scope].containerType = "backpack";

  const result = await ContainerTransferService.handleActorItemDrop(targetActor, root);

  assert.deepEqual(result, { handled: true, result: false });
  assert.equal(sourceActor.items.size, 1);
  assert.equal(targetActor.items.size, 0);
});

test("Item Piles transfer hook moves the complete container tree", () => {
  const root = createItem({ id: "root-1", name: "Mochila" });
  const child = createItem({ id: "child-1", name: "Corda", storedIn: root.id });
  const sourceActor = createActor([root, child]);
  const targetActor = createActor([]);
  const targetCreates = [
    createTransferTarget(root, "root-target"),
    createTransferTarget(child, "child-target")
  ];
  const sourceUpdates = {
    itemsToDelete: [root.id, child.id],
    itemDeltas: [root, child].map((item) => ({ item: { _id: item.id }, quantity: -1 }))
  };

  assert.equal(ContainerTransferService.handleItemPilePreTransfer(
    sourceActor,
    sourceUpdates,
    targetActor,
    { itemsToCreate: targetCreates },
    "transfer-1"
  ), true);

  assert.equal(targetCreates[0]._id, "root-target");
  assert.equal(targetCreates[0].flags[scope].containerTransferDelete, undefined);
  assert.equal(targetCreates[1]._id, "child-target");
  assert.equal(targetCreates[1].flags[scope].containerTransferDelete, undefined);
  assert.equal(targetCreates[1].flags[scope].storedIn, "root-target");
  assert.deepEqual(sourceUpdates.itemsToDelete.sort(), ["child-1", "root-1"]);
});

test("Item Piles transfer hook preserves nested container relationships", () => {
  const root = createItem({ id: "root-1", name: "Mochila" });
  const nested = createItem({ id: "nested-1", name: "Bolsa de Moedas", storedIn: root.id });
  const child = createItem({ id: "child-1", name: "Moedas", storedIn: nested.id });
  const sourceActor = createActor([root, nested, child]);
  const targetCreates = [
    createTransferTarget(root, "root-target"),
    createTransferTarget(nested, "nested-target"),
    createTransferTarget(child, "child-target")
  ];
  const sourceUpdates = {
    itemsToDelete: [root.id, nested.id, child.id],
    itemDeltas: [root, nested, child].map((item) => ({ item: { _id: item.id }, quantity: -1 }))
  };

  assert.equal(ContainerTransferService.handleItemPilePreTransfer(
    sourceActor,
    sourceUpdates,
    createActor([]),
    { itemsToCreate: targetCreates },
    "transfer-1"
  ), true);

  assert.equal(targetCreates.length, 3);
  const transferredNested = targetCreates.find((item) => item.name === nested.name);
  const transferredChild = targetCreates.find((item) => item.name === child.name);
  assert.equal(transferredNested.flags[scope].storedIn, "root-target");
  assert.equal(transferredChild.flags[scope].storedIn, transferredNested._id);
  assert.deepEqual(sourceUpdates.itemsToDelete.sort(), ["child-1", "nested-1", "root-1"]);
});

test("Item Piles hook registration uses the public namespaced hook without requiring a ready API", async () => {
  const registeredHooks = [];
  const previousHooks = globalThis.Hooks;
  const previousItemPiles = globalThis.game.itempiles;
  const previousModules = globalThis.game.modules;
  globalThis.Hooks = {
    on(name) {
      registeredHooks.push(name);
    }
  };
  globalThis.game.modules = new Map([["item-piles-symbaroum", { active: true }]]);
  delete globalThis.game.itempiles;

  try {
    const module = await import(`../scripts/container-transfer.mjs?register=${Date.now()}`);
    assert.equal(module.ContainerTransferService.registerHooks(), true);
    assert.deepEqual(registeredHooks, ["item-piles-symbaroum-preTransferItems"]);
  } finally {
    globalThis.Hooks = previousHooks;
    globalThis.game.modules = previousModules;
    if (previousItemPiles === undefined) delete globalThis.game.itempiles;
    else globalThis.game.itempiles = previousItemPiles;
  }
});

test("Item Piles hook registration rejects the generic provider and provider conflicts", async () => {
  const registeredHooks = [];
  const previousHooks = globalThis.Hooks;
  const previousModules = globalThis.game.modules;
  globalThis.Hooks = { on(name) { registeredHooks.push(name); } };

  try {
    globalThis.game.modules = new Map([["item-piles", { active: true }]]);
    let module = await import(`../scripts/container-transfer.mjs?generic=${Date.now()}`);
    assert.equal(module.ContainerTransferService.registerHooks(), false);

    globalThis.game.modules = new Map([
      ["item-piles", { active: true }],
      ["item-piles-symbaroum", { active: true }]
    ]);
    module = await import(`../scripts/container-transfer.mjs?conflict=${Date.now()}`);
    assert.equal(module.ContainerTransferService.registerHooks(), false);
    assert.deepEqual(registeredHooks, []);
  } finally {
    globalThis.Hooks = previousHooks;
    globalThis.game.modules = previousModules;
  }
});

test("Item Piles Symbaroum creates a native container pile before transferring the full tree", async () => {
  const root = createItem({ id: "root-1", name: "Mochila" });
  root.img = "icons/containers/bags/pack-leather-brown.webp";
  const child = createItem({ id: "child-1", name: "Corda", storedIn: root.id });
  const sourceActor = createActor([root, child]);
  const pileActor = createActor([]);
  pileActor.id = "pile-actor";
  pileActor.uuid = "Actor.pile-actor";
  const pileToken = {
    id: "pile-token",
    uuid: "Scene.scene-1.Token.pile-token",
    documentName: "Token",
    actor: pileActor
  };
  const calls = { create: null, transfer: null };
  const previousGame = globalThis.game;
  const previousHooks = globalThis.Hooks;
  const previousFromUuid = globalThis.fromUuid;
  globalThis.Hooks = { on() {} };
  globalThis.fromUuid = async (uuid) => uuid === pileToken.uuid ? pileToken : null;
  globalThis.game = {
    user: { isGM: true },
    modules: new Map([["item-piles-symbaroum", { active: true }]]),
    actors: createCollection([sourceActor]),
    itempiles: {
      CONSTANTS: {
        MODULE_NAME: "item-piles-symbaroum",
        PILE_TYPES: { CONTAINER: "container" },
        HOOKS: { ITEM: { PRE_TRANSFER: "item-piles-symbaroum-preTransferItems" } }
      },
      API: {
        async createItemPile(options) {
          calls.create = options;
          return { tokenUuid: pileToken.uuid };
        },
        async transferItems(source, target, ids, options) {
          calls.transfer = { source, target, ids, options };
          return true;
        },
        isValidItemPile() {
          return false;
        }
      }
    }
  };

  try {
    const result = await ContainerTransferService.dropToItemPile({
      scene: { id: "scene-1", tokens: [] },
      tokens: { placeables: [] },
      grid: { size: 100 }
    }, {
      actorId: sourceActor.id,
      actorUuid: sourceActor.uuid,
      itemId: root.id,
      x: 200,
      y: 300
    });

    assert.deepEqual(result, { handled: true, success: true });
    assert.equal(calls.create.actorOverrides.type, "monster");
    assert.equal(calls.create.actorOverrides.name, root.name);
    assert.equal(calls.create.itemPileFlags.type, "container");
    assert.equal(calls.create.itemPileFlags.deleteWhenEmpty, true);
    assert.equal(calls.create.itemPileFlags.closedImage, root.img);
    assert.equal(calls.create.itemPileFlags.openedImage, root.img);
    assert.equal(calls.create.itemPileFlags.emptyImage, root.img);
    assert.equal(calls.create.itemPileFlags.lockedImage, root.img);
    assert.equal(calls.create.tokenOverrides.texture.src, root.img);
    assert.deepEqual(calls.transfer.ids, [root.id, child.id]);
    assert.equal(calls.transfer.source, sourceActor);
    assert.equal(calls.transfer.target, pileActor);
    assert.equal(typeof calls.transfer.options.interactionId, "string");
    assert.equal(sourceActor.items.has(root.id), false);
    assert.equal(sourceActor.items.has(child.id), false);
  } finally {
    globalThis.game = previousGame;
    globalThis.Hooks = previousHooks;
    globalThis.fromUuid = previousFromUuid;
  }
});

test("Item Piles Symbaroum rejects dropping a container in Other state", async () => {
  const root = createItem({ id: "root-1", name: "Mochila", state: "other" });
  const sourceActor = createActor([root]);
  let createCalls = 0;
  const warnings = [];
  const previousGame = globalThis.game;
  const previousUi = globalThis.ui;
  globalThis.game = {
    user: { isGM: true },
    modules: new Map([["item-piles-symbaroum", { active: true }]]),
    actors: createCollection([sourceActor]),
    i18n: { localize: (key) => key },
    itempiles: {
      CONSTANTS: {
        MODULE_NAME: "item-piles-symbaroum",
        HOOKS: { ITEM: { PRE_TRANSFER: "item-piles-symbaroum-preTransferItems" } }
      },
      API: {
        async createItemPile() {
          createCalls += 1;
          return false;
        },
        async transferItems() {
          throw new Error("An inaccessible container must not reach Item Piles");
        },
        isValidItemPile() {
          return false;
        }
      }
    }
  };
  globalThis.ui = { notifications: { warn: (message) => warnings.push(message) } };

  try {
    const result = await ContainerTransferService.dropToItemPile({
      scene: { id: "scene-1", tokens: [] },
      tokens: { placeables: [] },
      grid: { size: 100 }
    }, {
      actorId: sourceActor.id,
      actorUuid: sourceActor.uuid,
      itemId: root.id,
      x: 200,
      y: 300
    });

    assert.deepEqual(result, { handled: true, success: false });
    assert.equal(createCalls, 0);
    assert.deepEqual(warnings, ["TENEBRE.Containers.GroundDropOther"]);
    assert.equal(sourceActor.items.has(root.id), true);
  } finally {
    globalThis.game = previousGame;
    globalThis.ui = previousUi;
  }
});

test("Item Piles hook trusts Item Piles authorization for a GM-owned target pile", () => {
  const root = createItem({ id: "root-1", name: "Mochila" });
  const child = createItem({ id: "child-1", name: "Corda", storedIn: root.id });
  const sourceActor = createActor([root, child]);
  const targetActor = createActor([]);
  targetActor.isOwner = false;
  const previousIsGM = globalThis.game.user.isGM;
  globalThis.game.user.isGM = false;

  try {
    assert.equal(ContainerTransferService.handleItemPilePreTransfer(
      sourceActor,
      {
        itemsToDelete: [root.id, child.id],
        itemDeltas: [root, child].map((item) => ({ item: { _id: item.id }, quantity: -1 }))
      },
      targetActor,
      { itemsToCreate: [
        createTransferTarget(root, "root-target"),
        createTransferTarget(child, "child-target")
      ] },
      "transfer-1"
    ), true);
  } finally {
    globalThis.game.user.isGM = previousIsGM;
  }
});

test("Item Piles hook rejects changed target ids without a module transfer interaction", () => {
  const root = createItem({ id: "root-1", name: "Mochila" });
  const child = createItem({ id: "child-1", name: "Corda", storedIn: root.id });
  const sourceActor = createActor([root, child]);

  assert.equal(ContainerTransferService.handleItemPilePreTransfer(
    sourceActor,
    {
      itemsToDelete: [root.id, child.id],
      itemDeltas: [root, child].map((item) => ({ item: { _id: item.id }, quantity: -1 }))
    },
    createActor([]),
    { itemsToCreate: [
      { ...root.toObject(), _id: "root-target" },
      { ...child.toObject(), _id: "child-target" }
    ] },
    "unrelated-transfer"
  ), false);
});

test("Item Piles transfer hook rejects a partial container transfer", () => {
  const root = createItem({ id: "root-1", name: "Mochila" });
  const child = createItem({ id: "child-1", name: "Corda", storedIn: root.id });
  const sourceActor = createActor([root, child]);

  assert.equal(ContainerTransferService.handleItemPilePreTransfer(
    sourceActor,
    { itemsToDelete: [], itemDeltas: [{ item: { _id: root.id }, quantity: -1 }] },
    createActor([]),
    { itemsToCreate: [] }
  ), false);
});

test("Item Piles transfer hook rejects a container in Other state", () => {
  const root = createItem({ id: "root-1", name: "Mochila", state: "other" });
  const sourceActor = createActor([root]);

  assert.equal(ContainerTransferService.handleItemPilePreTransfer(
    sourceActor,
    { itemsToDelete: [root.id], itemDeltas: [{ item: { _id: root.id }, quantity: -1 }] },
    createActor([]),
    { itemsToCreate: [{ _id: "root-target", name: root.name, type: root.type }] }
  ), false);
});

test("Item Piles transfer hook rejects moving a stored child by itself", () => {
  const root = createItem({ id: "root-1", name: "Mochila" });
  const child = createItem({ id: "child-1", name: "Corda", storedIn: root.id });
  const sourceActor = createActor([root, child]);

  assert.equal(ContainerTransferService.handleItemPilePreTransfer(
    sourceActor,
    { itemsToDelete: [child.id], itemDeltas: [{ item: { _id: child.id }, quantity: -1 }] },
    createActor([]),
    { itemsToCreate: [] }
  ), false);
});
