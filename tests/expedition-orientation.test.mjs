import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

globalThis.Hooks = { once() {}, on() {} };
const { orientationRequirements, orientationBoon, orientationContext, rollOrientationTest } = await import("../scripts/expedition-orientation.mjs");
const { evaluateOrientationRoll, calculateDavokarEventModifiers } = await import("../scripts/party-actor.mjs");
const { expeditionReadKey, sealExpeditionRead, openExpeditionRead } = await import("../scripts/expedition-private.mjs");

let settings;
beforeEach(() => {
  settings = {};
  globalThis.game = { settings: { get: (_scope, key) => settings[key] } };
  globalThis.Roll = class {
    constructor(formula) { this.formula = formula; this.total = 1; }
    async evaluate() { return this; }
  };
});

test("GM p92: eligibility and event benefits across every Bushcraft level/region", () => {
  for (const [region, required] of [["bright", 1], ["wild", 2], ["dark", 3]]) {
    for (let level = 0; level <= 3; level++) {
      const requirements = orientationRequirements(level, region);
      assert.equal(requirements.eligible, level > 0);
      assert.equal(requirements.eventBenefits, level >= required);
      if (!level) continue;
      const result = evaluateOrientationRoll(1, 15, requirements);
      assert.equal(result.mishap, false);
      assert.equal(result.ruinsMod, level >= required ? 2 : 0);
      assert.equal(result.neutralDetection, level >= required);
      const events = calculateDavokarEventModifiers({ regionKey: region, orientationVerdict: result.verdict });
      assert.equal(events.enemies.orientationMod, level >= required ? -2 : 0);
    }
  }
  assert.equal(orientationRequirements(0, "ambria").eligible, true);
});

test("GM pp98–99: margin four/five and natural one are independent", () => {
  assert.equal(evaluateOrientationRoll(1, 5).enemiesMod, -1);
  assert.equal(evaluateOrientationRoll(1, 6).enemiesMod, -2);
  assert.equal(evaluateOrientationRoll(10, 14).terrainMod, -1);
  assert.equal(evaluateOrientationRoll(10, 15).terrainMod, -2);
  assert.equal(evaluateOrientationRoll(1, 19, { eventBenefits: false }).verdict, "avoidedMishap");
  assert.equal(evaluateOrientationRoll(2, 19, { hasSucceeded: false }).verdict, "failure");
});

test("boons use the highest rank and reject unrelated item types and partial names", () => {
  const actor = { items: [
    { type: "equipment", name: "Mateiro III" }, { type: "boon", name: "Mateiro II", system: { level: 2 } },
    { type: "boon", name: "Mateiro III", system: { level: 3 } }, { type: "boon", name: "Mateiro impostor", system: { level: 1 } },
    { type: "boon", name: "Bushcrafting III" }
  ] };
  assert.equal(orientationBoon(actor, ["mateiro", "bushcraft"]).level, 3);
});

test("Cartographer/Green Thumb add their contextual ranks without repeating prepared bonuses", () => {
  const actor = { items: [
    { uuid: "Actor.a.Item.c", type: "boon", name: "Cartógrafo", system: { level: 3, bonus: { vigilant: 2 } } },
    { uuid: "Actor.a.Item.g", type: "boon", name: "Dedo Verde", system: { level: 2 } }
  ], effects: [] };
  assert.equal(orientationContext(actor).bonus, 3);
  actor.effects.push({ origin: "Actor.a.Item.c", changes: [{ mode: 2, key: "system.attributes.vigilant.total", value: "1" }] });
  assert.equal(orientationContext(actor).bonus, 2);
  actor.effects[0].disabled = true;
  assert.equal(orientationContext(actor).bonus, 3);
});

test("Pathfinder and the existing Hunger rule compose with the native test", async () => {
  const actor = { items: [{ type: "boon", name: "Desbravador" }], effects: [{ statuses: new Set(["hunger"]) }] };
  settings.enableHunger = false;
  assert.equal(orientationContext(actor).favour, 1);
  settings.enableHunger = true;
  assert.equal(orientationContext(actor).favour, -1);
  let calls = 0;
  game.symbaroum = { api: { async baseRoll(...args) {
    calls++;
    assert.deepEqual(args, [actor, "vigilant", null, null, -1, 3, false]);
    return { diceTarget: 19, diceResult: 1, hasSucceed: true, rolls: [{ total: 1 }, { total: 7 }] };
  } } };
  const result = await rollOrientationTest(actor, 3, orientationContext(actor).favour);
  assert.equal(result.target, 19);
  assert.equal(result.rolls.length, 2);
  assert.equal(calls, 1);
});

for (const option of ["alwaysSucceedOnOne", "optionalCrit", "optionalRareCrit"]) {
  test(`fallback respects native ${option} target bounds only when enabled`, async () => {
    const actor = { system: { attributes: { vigilant: { total: 0 } } } };
    assert.equal((await rollOrientationTest(actor, 0, 0)).success, false);
    settings[option] = true;
    assert.equal((await rollOrientationTest(actor, 0, 0)).success, true);
    actor.system.attributes.vigilant.total = 30;
    assert.equal((await rollOrientationTest(actor, 0, 0)).target, 19);
    settings[option] = false;
    assert.equal((await rollOrientationTest(actor, 0, 0)).target, 30);
  });
}

test("private RPC returns ciphertext bound to the client, party and day", async () => {
  const alice = await expeditionReadKey(), bob = await expeditionReadKey();
  const data = { target: 15, secret: "unpublished wilderness result" };
  const envelope = await sealExpeditionRead(data, alice.publicKey, "party/day/alice");
  assert.doesNotMatch(JSON.stringify(envelope), /unpublished|target|secret/);
  assert.deepEqual(await openExpeditionRead(envelope, alice.privateKey, "party/day/alice"), data);
  await assert.rejects(openExpeditionRead(envelope, bob.privateKey, "party/day/alice"));
  await assert.rejects(openExpeditionRead(envelope, alice.privateKey, "other-day"));
  await assert.rejects(sealExpeditionRead(data, [], "party/day/alice"), /Invalid expedition read key/);
});


test("disabled or suppressed Hunger has no effect on orientation or the shared Hunger service", async () => {
  const { HungerService } = await import("../scripts/hunger.mjs");
  settings.enableHunger = true;
  const effect = { statuses: new Set(["hunger"]), disabled: true };
  const actor = { items: [], effects: [effect] };
  assert.equal(HungerService.hasHunger(actor), false);
  assert.equal(orientationContext(actor).favour, 0);
  effect.disabled = false; effect.isSuppressed = true;
  assert.equal(HungerService.hasHunger(actor), false);
  effect.isSuppressed = false;
  assert.equal(HungerService.hasHunger(actor), true);
  assert.equal(orientationContext(actor).favour, -1);
});

test("an incompatible native API result is rejected instead of persisting an invalid target", async () => {
  game.symbaroum = { api: { baseRoll: async () => ({ hasSucceed: true }) } };
  await assert.rejects(rollOrientationTest({}, 0, 0), /Invalid native orientation test result/);
});
