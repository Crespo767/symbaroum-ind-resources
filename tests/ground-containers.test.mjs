import assert from "node:assert/strict";
import test from "node:test";

globalThis.Hooks = { on() {} };
globalThis.game = { user: { isGM: true } };
globalThis.ui = { notifications: { warn() {} } };

const scope = "symbaroum-ind-resources";
const { GroundContainerService, groundContainerConstants } = await import("../scripts/ground-containers.mjs");

test("ground container drag data is namespaced and references the source container", () => {
  const actor = { id: "actor-1", uuid: "Actor.actor-1" };
  const container = { id: "bag-1" };
  const data = GroundContainerService.buildDragData(actor, container);

  assert.deepEqual(data, {
    type: groundContainerConstants.dragType,
    source: "container",
    actorId: "actor-1",
    actorUuid: "Actor.actor-1",
    itemId: "bag-1"
  });
  assert.equal(GroundContainerService.isGroundContainerDragData({ ...data, x: 12, y: 34 }), true);
  assert.equal(GroundContainerService.isGroundContainerDragData({ ...data, x: "bad", y: 34 }), false);
  assert.equal(GroundContainerService.isGroundContainerDragData({ ...data, x: null, y: 34 }), false);
});

test("ground token data persists only a reference and preserves the container image", () => {
  const data = GroundContainerService.buildGroundTokenData({
    actor: { id: "actor-1", uuid: "Actor.actor-1" },
    container: { id: "bag-1", name: "Mochila", img: "bag.webp" },
    scene: { id: "scene-1" },
    x: 120,
    y: 240,
    previousState: "equipped"
  });

  assert.equal(data.actorId, "actor-1");
  assert.equal(data.actorLink, false);
  assert.deepEqual(data.texture, { src: "bag.webp" });
  assert.deepEqual(data.flags["symbaroum-ind-resources"].groundContainer, {
    version: groundContainerConstants.version,
    actorId: "actor-1",
    actorUuid: "Actor.actor-1",
    containerId: "bag-1",
    previousState: "equipped",
    sceneId: "scene-1"
  });
});

test("ground token data uses the fallback image when a container has no image", () => {
  const data = GroundContainerService.buildGroundTokenData({
    actor: { id: "actor-1", uuid: "Actor.actor-1" },
    container: { id: "bag-1", name: "Mochila" },
    scene: { id: "scene-1" },
    x: 0,
    y: 0,
    previousState: "active"
  });

  assert.deepEqual(data.texture, { src: "icons/svg/item-bag.svg" });
});

test("an item flag identifies a container already represented on the canvas", () => {
  const item = {
    flags: {
      "symbaroum-ind-resources": {
        groundContainer: {
          version: groundContainerConstants.version,
          tokenId: "token-1",
          sceneId: "scene-1"
        }
      }
    }
  };

  assert.equal(GroundContainerService.hasGroundToken(item), true);
  assert.equal(GroundContainerService.hasGroundToken({ flags: {} }), false);
});

test("ground container HUD drag data is a standard Item payload", () => {
  assert.deepEqual(GroundContainerService.buildItemDragData({ uuid: "Actor.pile.Item.bag-1" }), {
    type: "Item",
    uuid: "Actor.pile.Item.bag-1"
  });
});

test("an Item Piles token resolves the container item stored in its actor", () => {
  const reference = {
    version: groundContainerConstants.version,
    tokenId: "token-1",
    sceneId: "scene-1",
    actorId: "pile-actor",
    actorUuid: "Actor.pile-actor",
    containerId: "bag-1",
    previousState: "equipped"
  };
  const actor = {
    id: "pile-actor",
    uuid: "Actor.pile-actor",
    items: createCollection()
  };
  const item = {
    id: "bag-1",
    uuid: "Actor.pile-actor.Item.bag-1",
    name: "Mochila",
    type: "equipment",
    parent: actor,
    system: { state: "other" },
    flags: { [scope]: { containerType: "backpack", groundContainer: reference } },
    getFlag(flagScope, key) {
      return this.flags?.[flagScope]?.[key];
    }
  };
  actor.items.set(item.id, item);

  const result = GroundContainerService.findGroundContainerForToken({
    id: "token-1",
    actor,
    parent: { id: "scene-1" }
  });

  assert.equal(result?.item, item);
  assert.equal(result?.actor, actor);
  assert.equal(result?.fallback, false);
});

function createGroundReference(overrides = {}) {
  return {
    version: groundContainerConstants.version,
    actorId: "actor-1",
    actorUuid: "Actor.actor-1",
    containerId: "bag-1",
    sceneId: "scene-1",
    previousState: "equipped",
    ...overrides
  };
}

function createCollection() {
  const collection = new Map();
  collection[Symbol.iterator] = function* iterator() {
    yield* this.values();
  };
  return collection;
}

function createGroundFixture({ itemReference = true, itemState = "other", includeToken = true } = {}) {
  const reference = createGroundReference();
  const actor = {
    id: "actor-1",
    uuid: "Actor.actor-1",
    type: "player",
    isOwner: true,
    items: createCollection()
  };
  const item = {
    id: "bag-1",
    name: "Mochila",
    parent: actor,
    system: { state: itemState, number: 1 },
    flags: itemReference
      ? { [scope]: { groundContainer: { ...reference, tokenId: "token-1" } } }
      : {},
    getFlag(flagScope, key) {
      return this.flags?.[flagScope]?.[key];
    },
    async update(patch) {
      if (patch["system.state"] !== undefined) this.system.state = patch["system.state"];
      if (patch[`flags.${scope}.-=${groundContainerConstants.flag}`] === null) {
        delete this.flags[scope]?.[groundContainerConstants.flag];
      }
      const setPath = `flags.${scope}.${groundContainerConstants.flag}`;
      if (patch[setPath] !== undefined) {
        this.flags[scope] ??= {};
        this.flags[scope][groundContainerConstants.flag] = patch[setPath];
      }
      return this;
    }
  };
  actor.items.set(item.id, item);

  const tokens = createCollection();
  const scene = {
    id: "scene-1",
    tokens,
    canUserModify() { return true; },
    deleted: [],
    async deleteEmbeddedDocuments(type, ids) {
      assert.equal(type, "Token");
      this.deleted.push(...ids);
      for (const id of ids) tokens.delete(id);
      return ids;
    }
  };
  if (includeToken) {
    const token = {
      id: "token-1",
      parent: scene,
      flags: { [scope]: { groundContainer: reference } },
      getFlag(flagScope, key) {
        return this.flags?.[flagScope]?.[key];
      }
    };
    tokens.set(token.id, token);
  }

  game.user = { id: "gm", isGM: true };
  game.users = new Map([["gm", { id: "gm", active: true, isGM: true }]]);
  game.actors = [actor];
  game.scenes = [scene];
  return { actor, item, scene, reference };
}

test("picking up a ground container restores the item and removes the token", async () => {
  const { item, scene } = createGroundFixture();
  const token = scene.tokens.get("token-1");

  assert.equal(await GroundContainerService.pickupToken(token), true);
  assert.equal(item.system.state, "equipped");
  assert.equal(GroundContainerService.getItemGroundReference(item), null);
  assert.deepEqual(scene.deleted, ["token-1"]);
});

test("reconciliation restores an item when its ground token is missing", async () => {
  const { item } = createGroundFixture({ includeToken: false });

  const result = await GroundContainerService.reconcileGroundContainers();

  assert.equal(result.restoredItems, 1);
  assert.equal(result.errors, 0);
  assert.equal(item.system.state, "equipped");
  assert.equal(GroundContainerService.getItemGroundReference(item), null);
});

test("reconciliation removes a ground token when its source item is missing", async () => {
  const { actor, scene } = createGroundFixture();
  actor.items.clear();

  const result = await GroundContainerService.reconcileGroundContainers();

  assert.equal(result.removedTokens, 1);
  assert.equal(result.errors, 0);
  assert.deepEqual(scene.deleted, ["token-1"]);
});

test("reconciliation repairs a source item that lost its ground flag", async () => {
  const { item } = createGroundFixture({ itemReference: false, itemState: "equipped" });

  const result = await GroundContainerService.reconcileGroundContainers();

  assert.equal(result.repairedItems, 1);
  assert.equal(item.system.state, "other");
  assert.equal(GroundContainerService.getItemGroundReference(item)?.tokenId, "token-1");
});
