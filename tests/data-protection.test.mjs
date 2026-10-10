import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const MODULE_ID = "symbaroum-ind-resources";
const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

const hookHandlers = new Map();
globalThis.Hooks = {
  once() {},
  callAll() {},
  on(name, handler) {
    if (!hookHandlers.has(name)) hookHandlers.set(name, []);
    hookHandlers.get(name).push(handler);
  }
};
globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: class {},
      HandlebarsApplicationMixin: (Base) => class extends Base {}
    }
  }
};

const { HungerService } = await import("../scripts/hunger.mjs");
const { InventoryCleanupService } = await import("../scripts/inventory-cleanup.mjs");
const { removeStatus, shouldRecoverAfterStatusRemoval } = await import("../scripts/death-automation.mjs");

function hungerEffect(parent) {
  return { parent, flags: { [MODULE_ID]: { hunger: true } }, statuses: new Set(["hunger"]) };
}

test("removing Hunger posts a single chat message, from the client that removed it", async () => {
  const created = [];
  globalThis.ChatMessage = {
    create: async (data) => created.push(data),
    getSpeaker: () => ({})
  };
  globalThis.game = {
    user: { id: "me", isGM: false },
    settings: { get: () => true },
    i18n: { format: (key) => key, localize: (key) => key }
  };
  const actor = {
    documentName: "Actor",
    name: "Hero",
    getFlag: (scope, key) => (scope === MODULE_ID && key === "hungerStrongPenalty" ? -1 : undefined)
  };

  HungerService.registerHooks();
  const [onDelete] = hookHandlers.get("deleteActiveEffect");

  await onDelete(hungerEffect(actor), {}, "someone-else");
  assert.equal(created.length, 0, "other clients must not publish");

  await onDelete(hungerEffect(actor), {}, "me");
  assert.equal(created.length, 1);
});

test("existing-item cleanup only touches player characters", async () => {
  const deleted = [];
  const depleted = (parent, id) => ({
    id, uuid: `Actor.${parent.id}.Item.${id}`, type: "equipment", parent, system: { number: 0 },
    async delete() { deleted.push(id); return true; }
  });
  const player = { id: "p", type: "player", documentName: "Actor" };
  const monster = { id: "m", type: "monster", documentName: "Actor" };
  player.items = [depleted(player, "arrows")];
  monster.items = [depleted(monster, "trophy")];

  globalThis.game = {
    user: { id: "gm", isGM: true },
    users: { activeGM: { id: "gm" } },
    settings: { get: () => true },
    actors: [player, monster]
  };

  assert.equal(await InventoryCleanupService.cleanupExisting(), 1);
  assert.deepEqual(deleted, ["arrows"]);
});

test("inventory cleanup is opt-in and never runs automatically when the world loads", async () => {
  const [settings, init] = await Promise.all([read("scripts/settings.mjs"), read("scripts/init.mjs")]);
  assert.match(settings, /register\("enableInventoryCleanup", Boolean, false,/);
  assert.doesNotMatch(init, /cleanupExisting/);
});

test("item creation side effects run only on the client that created the item", async () => {
  const init = await read("scripts/init.mjs");
  const createHook = init.match(/Hooks\.on\("createItem",[\s\S]*?\n}\);/)?.[0] ?? "";
  assert.match(createHook, /\(item, _options, userId\)/);
  assert.match(createHook, /if \(userId !== game\.user\?\.id\) return;/);
});

test("rendering sheets never writes documents", async () => {
  const sheet = await read("scripts/sheet-ui.mjs");
  const rationDisplay = sheet.match(/function updateRationQuantityDisplay[\s\S]*?\n}\n/)?.[0] ?? "";
  const weightField = sheet.match(/function injectItemWeightField[\s\S]*?\n}\n/)?.[0] ?? "";
  assert.ok(rationDisplay && weightField);
  assert.doesNotMatch(rationDisplay, /consolidate/);
  assert.doesNotMatch(weightField, /autoAssignSlots/);
});

test("removing Dying or Dead by hand stabilizes the character", () => {
  globalThis.game = { settings: { get: () => true } };
  const actor = {
    documentName: "Actor",
    type: "player",
    uuid: "Actor.hero",
    flags: { [MODULE_ID]: { deathState: { status: "dying" } } }
  };
  assert.equal(shouldRecoverAfterStatusRemoval({ parent: actor, statuses: new Set(["tenebre-dying"]) }), true);
  assert.equal(shouldRecoverAfterStatusRemoval({ parent: actor, statuses: new Set(["prone"]) }), false);
  assert.equal(shouldRecoverAfterStatusRemoval({ parent: { ...actor, type: "monster" }, statuses: new Set(["dead"]) }), false);
});

test("the automation removing Dying while killing a character does not revive it", async () => {
  globalThis.game = { settings: { get: () => true } };
  const actor = {
    documentName: "Actor",
    type: "player",
    uuid: "Actor.hero",
    flags: { [MODULE_ID]: { deathState: { status: "dead" } } },
    statuses: new Set(["tenebre-dying"]),
    effects: [],
    recoveredDuringRemoval: null,
    async toggleStatusEffect(statusId) {
      // No Foundry, o hook deleteActiveEffect deste cliente roda antes do await terminar.
      this.recoveredDuringRemoval = shouldRecoverAfterStatusRemoval({ parent: this, statuses: new Set([statusId]) });
      this.statuses.delete(statusId);
    }
  };

  await removeStatus(actor, "tenebre-dying");
  assert.equal(actor.recoveredDuringRemoval, false);
  assert.equal(
    shouldRecoverAfterStatusRemoval({ parent: actor, statuses: new Set(["dead"]) }),
    true,
    "a later manual removal must still stabilize"
  );
});
