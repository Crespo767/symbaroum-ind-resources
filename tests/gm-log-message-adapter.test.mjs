import assert from "node:assert/strict";
import test from "node:test";
import { MODULE_ID } from "../scripts/constants.mjs";
import { GM_LOG_EVENT_TYPES } from "../scripts/gm-log-events.mjs";
import { gmLogEventFromMessage } from "../scripts/gm-log-message-adapter.mjs";

function combatMessage({ id, variant, correlationId }) {
  const payload = {
    attackerName: "Crespo",
    weaponName: "Arco",
    targetName: "Elfo da Primavera",
    testFormula: "Preciso ← Defesa",
    rollValue: "8",
    outcomeText: "Crespo acertou Elfo da Primavera",
    damageFormula: "1d8",
    damageTotal: 5
  };
  const moduleFlags = variant === "public"
    ? { publicCombat: payload, combatSplitSourceId: correlationId }
    : { fullCombatForGm: true, publicCombatPayload: payload, combatSplitId: correlationId };
  return {
    id,
    timestamp: 1_234,
    flags: { [MODULE_ID]: moduleFlags }
  };
}

test("converts correlated public and GM combat messages without exposing absent fields", () => {
  const publicEvent = gmLogEventFromMessage(combatMessage({
    id: "message-public",
    variant: "public",
    correlationId: "attack-split"
  }));
  const fullEvent = gmLogEventFromMessage(combatMessage({
    id: "message-full",
    variant: "full",
    correlationId: "attack-split"
  }));

  assert.equal(publicEvent.type, GM_LOG_EVENT_TYPES.ATTACK);
  assert.equal(publicEvent.source.variant, "public");
  assert.equal(fullEvent.source.variant, "full");
  assert.equal(fullEvent.source.correlationId, "attack-split");
  assert.equal(fullEvent.actor.name, "Crespo");
  assert.equal(fullEvent.target.name, "Elfo da Primavera");
  assert.equal(fullEvent.values.roll, 8);
  assert.equal("protection" in publicEvent.values, false);
  assert.equal("applied" in publicEvent.values, false);
});

test("converts weapon readiness flags using actor and item references", () => {
  const bow = { id: "bow", uuid: "Actor.hero.Item.bow", name: "Arco", img: "bow.webp" };
  const dagger = { id: "dagger", uuid: "Actor.hero.Item.dagger", name: "Adaga", img: "dagger.webp" };
  const items = new Map([[bow.id, bow], [dagger.id, dagger]]);
  const actor = { uuid: "Actor.hero", name: "Crespo", img: "hero.webp", items };
  const originalResolver = globalThis.fromUuidSync;
  globalThis.fromUuidSync = (uuid) => uuid === actor.uuid ? actor : null;

  try {
    const event = gmLogEventFromMessage({
      id: "message-weapons",
      flags: {
        [MODULE_ID]: {
          type: "weaponReadiness",
          actorUuid: actor.uuid,
          drawnWeaponIds: [dagger.id],
          sheathedWeaponIds: [bow.id]
        }
      }
    });

    assert.equal(event.type, GM_LOG_EVENT_TYPES.WEAPON_READINESS);
    assert.equal(event.actor.uuid, actor.uuid);
    assert.equal(event.values.action, "swap");
    assert.deepEqual(event.values.drawn, ["Adaga"]);
    assert.deepEqual(event.values.sheathed, ["Arco"]);
  } finally {
    globalThis.fromUuidSync = originalResolver;
  }
});

test("converts item-use flags and rejects unrelated messages", () => {
  const item = { uuid: "Actor.hero.Item.ration", name: "Pão de Viagem", img: "ration.webp" };
  const actor = {
    uuid: "Actor.hero",
    name: "Crespo",
    items: { get: () => item }
  };
  const originalResolver = globalThis.fromUuidSync;
  globalThis.fromUuidSync = (uuid) => ({ [actor.uuid]: actor, [item.uuid]: item })[uuid] ?? null;

  try {
    const event = gmLogEventFromMessage({
      id: "message-item",
      flags: {
        [MODULE_ID]: {
          chatItemUse: true,
          actorUuid: actor.uuid,
          itemUuid: item.uuid
        }
      }
    });
    assert.equal(event.type, GM_LOG_EVENT_TYPES.ITEM_USED);
    assert.equal(event.actor.name, "Crespo");
    assert.equal(event.subject.name, "Pão de Viagem");
    assert.equal(gmLogEventFromMessage({ id: "message-other", flags: {} }), null);
    assert.equal(gmLogEventFromMessage({
      id: "message-untrusted",
      flags: {
        [MODULE_ID]: {
          gmLogEvent: {
            type: GM_LOG_EVENT_TYPES.ATTACK,
            actor: { name: "Forjado" }
          }
        }
      }
    }), null);
  } finally {
    globalThis.fromUuidSync = originalResolver;
  }
});

test("converts allowlisted structured module actions without trusting free-form event payloads", () => {
  const actor = { uuid: "Actor.hero", name: "Crespo", img: "hero.webp" };
  const target = { uuid: "Actor.target", name: "Etterherd", img: "target.webp" };
  const item = { uuid: "Actor.hero.Item.arrow", name: "Flecha Certeira", img: "arrow.webp", parent: actor };
  const originalResolver = globalThis.fromUuidSync;
  globalThis.fromUuidSync = (uuid) => ({
    [actor.uuid]: actor,
    [target.uuid]: target,
    [item.uuid]: item
  })[uuid] ?? null;

  try {
    const event = gmLogEventFromMessage({
      id: "message-recovery",
      speaker: {},
      flags: {
        [MODULE_ID]: {
          gmLogAction: {
            type: GM_LOG_EVENT_TYPES.AMMO_RECOVERY,
            outcome: "success",
            actorUuid: actor.uuid,
            targetUuid: target.uuid,
            subjectUuid: item.uuid,
            values: { formula: "1d20", roll: 7, maximum: 15, ignored: "no" }
          }
        }
      }
    });

    assert.equal(event.type, GM_LOG_EVENT_TYPES.AMMO_RECOVERY);
    assert.equal(event.actor.name, "Crespo");
    assert.equal(event.target.name, "Etterherd");
    assert.equal(event.subject.name, "Flecha Certeira");
    assert.deepEqual(event.values, { formula: "1d20", roll: 7, maximum: 15 });

    const quantityEvent = gmLogEventFromMessage({
      id: "message-quantity",
      speaker: {},
      flags: {
        [MODULE_ID]: {
          gmLogAction: {
            type: GM_LOG_EVENT_TYPES.ITEM_QUANTITY_CHANGED,
            actorUuid: actor.uuid,
            subjectUuid: item.uuid,
            values: { previous: 7, quantity: 4, delta: -3, ignored: "no" }
          }
        }
      }
    });
    assert.equal(quantityEvent.type, GM_LOG_EVENT_TYPES.ITEM_QUANTITY_CHANGED);
    assert.equal(quantityEvent.category, "inventory");
    assert.deepEqual(quantityEvent.values, { previous: 7, quantity: 4, delta: -3 });
    assert.equal(gmLogEventFromMessage({
      id: "message-forged-type",
      flags: { [MODULE_ID]: { gmLogAction: { type: GM_LOG_EVENT_TYPES.ATTACK } } }
    }), null);
  } finally {
    globalThis.fromUuidSync = originalResolver;
  }
});

test("rejects a structured module action when its actor conflicts with the message speaker", () => {
  const speakerActor = { uuid: "Actor.speaker", name: "Speaker" };
  const flaggedActor = { uuid: "Actor.flagged", name: "Flagged" };
  const originalResolver = globalThis.fromUuidSync;
  const originalGame = globalThis.game;
  globalThis.fromUuidSync = (uuid) => uuid === flaggedActor.uuid ? flaggedActor : null;
  globalThis.game = { actors: new Map([["speaker", speakerActor]]) };

  try {
    assert.equal(gmLogEventFromMessage({
      id: "message-mismatch",
      speaker: { actor: "speaker" },
      flags: {
        [MODULE_ID]: {
          gmLogAction: {
            type: GM_LOG_EVENT_TYPES.REST_COMPLETED,
            actorUuid: flaggedActor.uuid,
            values: { days: 1 }
          }
        }
      }
    }), null);
  } finally {
    globalThis.fromUuidSync = originalResolver;
    globalThis.game = originalGame;
  }
});
