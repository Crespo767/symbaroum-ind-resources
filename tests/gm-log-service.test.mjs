import assert from "node:assert/strict";
import test from "node:test";
import { MODULE_ID } from "../scripts/constants.mjs";
import { GM_LOG_EVENT_TYPES } from "../scripts/gm-log-events.mjs";
import { GmLogService, GmLogStore } from "../scripts/gm-log-service.mjs";

function attackEvent({ messageId, correlationId = "", variant = "single", roll = 10 } = {}) {
  return {
    eventId: messageId,
    type: GM_LOG_EVENT_TYPES.ATTACK,
    occurredAt: 1_000,
    outcome: "success",
    actor: { name: "Crespo" },
    target: { name: "Elfo" },
    subject: { name: "Arco" },
    source: { messageId, correlationId, variant },
    values: { formula: "Preciso ← Defesa", roll }
  };
}

test("stores only valid normalized events", () => {
  const store = new GmLogStore();
  assert.equal(store.add({ type: "unknown" }), false);
  assert.equal(store.snapshot().length, 0);
  assert.equal(store.add(attackEvent({ messageId: "message-a" })), true);
  assert.equal(store.snapshot().length, 1);
  assert.equal(Object.isFrozen(store.snapshot()), true);
});

test("deduplicates correlated combat variants and prefers the full GM event", () => {
  const store = new GmLogStore();
  store.add(attackEvent({ messageId: "public", correlationId: "split-a", variant: "public", roll: 8 }));
  store.add(attackEvent({ messageId: "full", correlationId: "split-a", variant: "full", roll: 8 }));

  const events = store.snapshot();
  assert.equal(events.length, 1);
  assert.equal(events[0].source.variant, "full");
  assert.equal(events[0].source.messageId, "full");
});

test("removing the full message reveals the remaining public variant", () => {
  const store = new GmLogStore();
  store.add(attackEvent({ messageId: "public", correlationId: "split-a", variant: "public" }));
  store.add(attackEvent({ messageId: "full", correlationId: "split-a", variant: "full" }));

  assert.equal(store.removeMessage("full"), true);
  assert.equal(store.snapshot().length, 1);
  assert.equal(store.snapshot()[0].source.variant, "public");
  assert.equal(store.removeMessage("missing"), false);
});

test("keeps the configured number of most recent distinct events", () => {
  const store = new GmLogStore({ limit: 2 });
  store.add(attackEvent({ messageId: "first", roll: 1 }));
  store.add(attackEvent({ messageId: "second", roll: 2 }));
  store.add(attackEvent({ messageId: "third", roll: 3 }));

  assert.deepEqual(store.snapshot().map((event) => event.source.messageId), ["second", "third"]);
});

test("registers capture only for the GM client and keeps updates local", () => {
  const originalGame = globalThis.game;
  const originalHooks = globalThis.Hooks;
  const listeners = new Map();
  const notifications = [];
  let enabled = true;

  globalThis.game = {
    user: { id: "player", isGM: false },
    messages: [],
    settings: {
      get: (scope, key) => scope === MODULE_ID && key === "enableGmLog" && enabled
    }
  };
  globalThis.Hooks = {
    on: (name, callback) => {
      listeners.set(name, callback);
      return listeners.size;
    },
    callAll: (name, events) => notifications.push({ name, events })
  };

  try {
    GmLogService.register();
    assert.equal(listeners.size, 0);

    globalThis.game.user = { id: "gm", isGM: true };
    GmLogService.register();
    assert.deepEqual([...listeners.keys()], [
      "createChatMessage",
      "updateChatMessage",
      "deleteChatMessage",
      `${MODULE_ID}.settingsChanged`
    ]);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].name, `${MODULE_ID}.gmLogUpdated`);

    listeners.get("createChatMessage")({
      id: "combat-message",
      timestamp: 2_000,
      flags: {
        [MODULE_ID]: {
          publicCombat: {
            attackerName: "Crespo",
            weaponName: "Arco",
            targetName: "Elfo",
            testFormula: "Preciso ← Defesa",
            rollValue: "7",
            outcomeText: "Crespo acertou Elfo"
          },
          combatSplitSourceId: "split-runtime"
        }
      }
    });
    assert.equal(GmLogService.events.length, 1);
    assert.equal(notifications.length, 2);

    enabled = false;
    listeners.get(`${MODULE_ID}.settingsChanged`)("enableGmLog", false);
    assert.equal(GmLogService.events.length, 0);

    listeners.get("createChatMessage")({
      id: "ignored-while-disabled",
      flags: { [MODULE_ID]: { gmLogEvent: attackEvent({ messageId: "ignored-while-disabled" }) } }
    });
    assert.equal(GmLogService.events.length, 0);

    enabled = true;
    globalThis.game.messages = [{
      id: "combat-message",
      timestamp: 2_000,
      flags: {
        [MODULE_ID]: {
          publicCombat: {
            attackerName: "Crespo",
            weaponName: "Arco",
            targetName: "Elfo",
            testFormula: "Preciso ← Defesa",
            rollValue: "7",
            outcomeText: "Crespo acertou Elfo"
          },
          combatSplitSourceId: "split-runtime"
        }
      }
    }];
    listeners.get(`${MODULE_ID}.settingsChanged`)("enableGmLog", true);
    assert.equal(GmLogService.events.length, 1);

    globalThis.game.user = { id: "player", isGM: false };
    assert.equal(GmLogService.events.length, 0);
    assert.equal(GmLogService.clear(), false);
  } finally {
    globalThis.game = originalGame;
    globalThis.Hooks = originalHooks;
  }
});

test("creates a GM-only structured message for an inventory quantity change", async () => {
  const originalGame = globalThis.game;
  const originalChatMessage = globalThis.ChatMessage;
  const created = [];
  const actor = { id: "hero", uuid: "Actor.hero", name: "Crespo", isOwner: true };
  const item = {
    uuid: "Actor.hero.Item.oil",
    name: "Óleo de Lâmpada",
    parent: actor
  };

  globalThis.game = {
    user: { id: "player", isGM: false },
    users: [
      { id: "player", isGM: false },
      { id: "gm-a", isGM: true },
      { id: "gm-b", isGM: true }
    ],
    settings: { get: (scope, key) => scope === MODULE_ID && key === "enableGmLog" },
    i18n: {
      format: (_key, data) => `${data.actor}: ${data.item} ${data.previous} -> ${data.quantity}`
    }
  };
  globalThis.ChatMessage = {
    getSpeaker: ({ actor: speakerActor }) => ({ actor: speakerActor.id, alias: speakerActor.name }),
    create: async (data) => {
      created.push(data);
      return data;
    }
  };

  try {
    await GmLogService.recordItemQuantityChange({
      actor,
      item,
      previousQuantity: 2,
      quantity: 5
    });

    assert.equal(created.length, 1);
    assert.deepEqual(created[0].whisper, ["gm-a", "gm-b"]);
    assert.equal(created[0].flags[MODULE_ID].gmLogOnly, true);
    assert.equal(created[0].flags[MODULE_ID].gmLogAction.type, GM_LOG_EVENT_TYPES.ITEM_QUANTITY_CHANGED);
    assert.deepEqual(created[0].flags[MODULE_ID].gmLogAction.values, {
      previous: 2,
      quantity: 5,
      delta: 3
    });

    await GmLogService.recordItemQuantityChange({
      actor,
      item,
      previousQuantity: 5,
      quantity: 5
    });
    assert.equal(created.length, 1);
  } finally {
    globalThis.game = originalGame;
    globalThis.ChatMessage = originalChatMessage;
  }
});
