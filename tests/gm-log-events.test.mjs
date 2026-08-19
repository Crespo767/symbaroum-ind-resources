import assert from "node:assert/strict";
import test from "node:test";
import {
  GM_LOG_EVENT_TYPES,
  deduplicateGmLogEvents,
  gmLogEventKey,
  gmLogEventPresentation,
  normalizeGmLogEvent
} from "../scripts/gm-log-events.mjs";

function attackEvent(overrides = {}) {
  return {
    eventId: "attack-a",
    type: GM_LOG_EVENT_TYPES.ATTACK,
    occurredAt: 1234,
    outcome: "success",
    actor: { uuid: "Actor.hero", name: "Crespo" },
    target: { uuid: "Actor.enemy", name: "Elfo" },
    subject: { uuid: "Actor.hero.Item.bow", name: "Arco" },
    source: { messageId: "message-a", correlationId: "split-a", variant: "public" },
    values: { formula: "Preciso ← Defesa", roll: 8, damage: 5 },
    ...overrides
  };
}

test("normalizes supported GM log events without retaining arbitrary nested data", () => {
  const event = normalizeGmLogEvent({
    ...attackEvent(),
    audience: "player",
    category: "forged",
    values: {
      roll: 8,
      formula: "  Preciso   ←   Defesa  ",
      critical: false,
      ignored: { secret: true }
    }
  });

  assert.equal(event.version, 1);
  assert.equal(event.audience, "gm");
  assert.equal(event.category, "combat");
  assert.equal(event.values.formula, "Preciso ← Defesa");
  assert.equal(event.values.roll, 8);
  assert.equal(event.values.critical, false);
  assert.equal("ignored" in event.values, false);
  assert.equal(Object.isFrozen(event), true);
  assert.equal(Object.isFrozen(event.values), true);
});

test("rejects unknown types and events without a stable identity", () => {
  assert.equal(normalizeGmLogEvent({ type: "unknown" }), null);
  assert.equal(normalizeGmLogEvent({ type: GM_LOG_EVENT_TYPES.ROLL }), null);
});

test("does not trust a frozen object that bypassed the normalizer", () => {
  const forged = Object.freeze({
    version: 1,
    audience: "gm",
    type: GM_LOG_EVENT_TYPES.ATTACK,
    source: Object.freeze({ correlationId: "split-forged", variant: "full" }),
    values: Object.freeze({ nested: Object.freeze({ secret: true }) })
  });

  const presentation = gmLogEventPresentation(forged);
  assert.equal(presentation.key, "TENEBRE.GmLog.Attack.Info");
  assert.equal(presentation.data.actor, "");
  assert.equal("nested" in normalizeGmLogEvent(forged).values, false);
});

test("uses correlation identifiers before event and message identifiers", () => {
  assert.equal(gmLogEventKey(attackEvent()), "correlation:split-a");
  assert.equal(gmLogEventKey(attackEvent({ source: { messageId: "message-a" } })), "event:attack-a");
  assert.equal(gmLogEventKey(attackEvent({ eventId: "", source: { messageId: "message-a" } })), "message:message-a");
});

test("deduplicates public/full combat variants and keeps the GM-only full event", () => {
  const publicEvent = attackEvent();
  const fullEvent = attackEvent({
    eventId: "attack-full",
    source: { messageId: "message-full", correlationId: "split-a", variant: "full" },
    values: { formula: "Preciso ← Defesa", roll: 8, damage: 5, protection: 2, applied: 3 }
  });
  const unrelated = attackEvent({
    eventId: "attack-b",
    source: { messageId: "message-b", correlationId: "split-b", variant: "single" }
  });

  const result = deduplicateGmLogEvents([publicEvent, fullEvent, unrelated]);
  assert.equal(result.length, 2);
  assert.equal(result[0].source.variant, "full");
  assert.equal(result[0].values.protection, 2);
  assert.equal(result[1].source.correlationId, "split-b");
});

test("selects localized presentation keys without formatting HTML", () => {
  const attack = gmLogEventPresentation(attackEvent());
  assert.equal(attack.key, "TENEBRE.GmLog.Attack.Success");
  assert.deepEqual(
    { actor: attack.data.actor, target: attack.data.target, item: attack.data.item, roll: attack.data.roll },
    { actor: "Crespo", target: "Elfo", item: "Arco", roll: "8" }
  );

  const swap = gmLogEventPresentation({
    eventId: "weapons-a",
    type: GM_LOG_EVENT_TYPES.WEAPON_READINESS,
    actor: { name: "Crespo" },
    values: { action: "swap", drawn: ["Adaga"], sheathed: ["Arco Longo"] }
  });
  assert.equal(swap.key, "TENEBRE.GmLog.Weapon.Swap");
  assert.equal(swap.data.drawn, "Adaga");
  assert.equal(swap.data.sheathed, "Arco Longo");

  const quantity = gmLogEventPresentation({
    eventId: "quantity-a",
    type: GM_LOG_EVENT_TYPES.ITEM_QUANTITY_CHANGED,
    actor: { name: "Crespo" },
    subject: { name: "Óleo de Lâmpada" },
    values: { previous: 2, quantity: 5, delta: 3 }
  });
  assert.equal(quantity.key, "TENEBRE.GmLog.Inventory.QuantityChanged");
  assert.deepEqual(
    { previous: quantity.data.previous, quantity: quantity.data.quantity, delta: quantity.data.delta },
    { previous: "2", quantity: "5", delta: "3" }
  );
});
