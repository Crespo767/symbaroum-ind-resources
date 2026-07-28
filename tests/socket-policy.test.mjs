import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSafeBatch,
  isAllowedCombatantUpdate,
  isAllowedManeuverEffectCreate,
  isAllowedManeuverEffectUpdate,
  isAllowedToughnessUpdate,
  isModuleManeuverEffect,
  sanitizeSocketOptions
} from "../scripts/socket-policy.mjs";

test("socket policy only accepts namespaced maneuver effects", () => {
  const valid = {
    flags: {
      "symbaroum-ind-resources": {
        maneuverEffect: true,
        effectId: "tenebre-maneuver-grappled"
      }
    }
  };
  assert.equal(isModuleManeuverEffect(valid, "symbaroum-ind-resources"), true);
  assert.equal(isModuleManeuverEffect({
    flags: {
      "symbaroum-ind-resources": {
        maneuverEffect: true,
        effectId: "tenebre-maneuver-forged"
      }
    }
  }, "symbaroum-ind-resources"), false);
  assert.equal(isModuleManeuverEffect({ flags: { core: { statusId: "dead" } } }, "symbaroum-ind-resources"), false);
});

test("socket policy rejects arbitrary fields in remote maneuver effects", () => {
  const moduleId = "symbaroum-ind-resources";
  const effectId = "tenebre-maneuver-grappled";
  const valid = {
    name: "Grappled",
    label: "Grappled",
    img: "icons/svg/net.svg",
    icon: "icons/svg/net.svg",
    statuses: [effectId],
    duration: {},
    flags: {
      core: { statusId: effectId },
      [moduleId]: {
        maneuverEffect: true,
        effectId,
        sourceActorId: "source",
        sourceActorName: "Source",
        expiration: null,
        rounds: null,
        startRound: null,
        startTurn: null,
        combatId: null,
        movementBlocked: true,
        movementActions: 0
      }
    }
  };

  assert.equal(isAllowedManeuverEffectCreate(valid, moduleId), true);
  assert.equal(isAllowedManeuverEffectCreate({ ...valid, changes: [{ key: "system.health.toughness.value", value: 0 }] }, moduleId), false);
  assert.equal(isAllowedManeuverEffectCreate({
    ...valid,
    flags: {
      ...valid.flags,
      [moduleId]: { ...valid.flags[moduleId], injected: true }
    }
  }, moduleId), false);
  assert.equal(isAllowedManeuverEffectCreate({
    ...valid,
    name: "<img src=x onerror=alert(1)>"
  }, moduleId), false);
  assert.equal(isAllowedManeuverEffectCreate({
    ...valid,
    img: "javascript:alert(1)",
    icon: "javascript:alert(1)"
  }, moduleId), false);
  assert.equal(isAllowedManeuverEffectCreate({
    ...valid,
    flags: {
      ...valid.flags,
      [moduleId]: {
        ...valid.flags[moduleId],
        movementBlocked: false
      }
    }
  }, moduleId), false);
  assert.equal(isAllowedManeuverEffectCreate({
    ...valid,
    flags: {
      ...valid.flags,
      [moduleId]: {
        ...valid.flags[moduleId],
        expiration: "rounds",
        rounds: 100
      }
    }
  }, moduleId), false);
});

test("socket policy limits remote maneuver updates to duration and canonical flags", () => {
  const moduleId = "symbaroum-ind-resources";
  const effectId = "tenebre-maneuver-poisoned";
  const existing = {
    id: "effect-1",
    flags: {
      [moduleId]: {
        maneuverEffect: true,
        effectId
      }
    }
  };
  const valid = {
    _id: "effect-1",
    duration: { rounds: 3, startRound: 1, startTurn: 0 },
    flags: {
      [moduleId]: {
        maneuverEffect: true,
        effectId,
        sourceActorId: "source",
        sourceActorName: "Source",
        expiration: "rounds",
        rounds: 3,
        startRound: 1,
        startTurn: 0,
        combatId: "combat-1"
      }
    }
  };

  assert.equal(isAllowedManeuverEffectUpdate(valid, existing, moduleId), true);
  assert.equal(isAllowedManeuverEffectUpdate({ ...valid, name: "Forged" }, existing, moduleId), false);
  assert.equal(isAllowedManeuverEffectUpdate({ ...valid, _id: "other" }, existing, moduleId), false);
});

test("socket policy limits non-owner actor updates to toughness reduction", () => {
  assert.equal(isAllowedToughnessUpdate({ "system.health.toughness.value": 7 }, 10), true);
  assert.equal(isAllowedToughnessUpdate({ "system.health.toughness.value": 11 }, 10), false);
  assert.equal(isAllowedToughnessUpdate({ "system.health.toughness.value": 7, name: "Changed" }, 10), false);
});

test("socket policy only accepts supported combatant fields", () => {
  assert.equal(isAllowedCombatantUpdate({ initiative: 14 }), true);
  assert.equal(isAllowedCombatantUpdate({ defeated: true }), true);
  assert.equal(isAllowedCombatantUpdate({ defeated: false }), false);
  assert.equal(isAllowedCombatantUpdate({ name: "Changed" }), false);
});

test("socket policy limits batches and normalizes operation options", () => {
  assert.doesNotThrow(() => assertSafeBatch(["one"], "test"));
  assert.throws(() => assertSafeBatch([], "test"));
  assert.throws(() => assertSafeBatch(Array.from({ length: 51 }, (_, index) => index), "test"));
  assert.deepEqual(sanitizeSocketOptions({ render: false, diff: false }), { render: false });
});
