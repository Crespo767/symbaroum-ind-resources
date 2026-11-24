import assert from "node:assert/strict";
import test from "node:test";

import {
  corruptedNatureCount, detectionModifier, eventPlan, guideProfile, orientationOutcome, orientationPlan, REGIONS, ruinFindsFormula
} from "../scripts/davokar-rules.mjs";

const profile = { vigilant: 12, bushcraft: 3, cartographer: false, pathfinder: false };
const base = { region: "bright", preparation: "none", circumstance: 0, cartographer: 0, river: false, search: "off" };

test("GM p.92: Mateiro requirements, penalties and benefits across the three regions", () => {
  const matrix = [[0, -3, -5], [0, 0, -3], [0, 0, 0]];
  Object.keys(REGIONS).forEach((region, column) => {
    assert.equal(orientationPlan({ ...profile, bushcraft: 0 }, { ...base, region }).eligible, false);
    matrix.forEach((row, index) => {
      const plan = orientationPlan({ ...profile, bushcraft: index + 1 }, { ...base, region });
      assert.equal(plan.modifiers.bushcraft, row[column], region + " tier " + (index + 1));
      assert.equal(plan.fullBenefits, index >= column);
    });
  });
  assert.equal(orientationPlan({ ...profile, vigilant: null }, base).eligible, false);
});

test("GM pp.92,95: preparation, Cartógrafo and circumstance add to the actual Vigilante total", () => {
  const config = { ...base, region: "dark", cartographer: 3, preparation: "reliable", circumstance: -2 };
  const plan = orientationPlan({ ...profile, bushcraft: 1, cartographer: true }, config);
  assert.deepEqual(plan.modifiers, { bushcraft: -5, cartographer: 3, preparation: 1, circumstance: -2 });
  assert.equal(plan.target, 9);
  assert.equal(orientationPlan({ ...profile, bushcraft: 1 }, config).modifiers.cartographer, 0);
  assert.equal(orientationPlan({ ...profile, cartographer: true, cartographerIncluded: 2 }, config).modifiers.cartographer, 1);
  assert.equal(orientationPlan({ ...profile, vigilant: 22 }, base, true).target, 19);
  assert.equal(orientationPlan({ ...profile, vigilant: -1 }, base, true).target, 1);
  assert.equal(orientationPlan({ ...profile, vigilant: 22 }, base).target, 22);
});

test("embedded localized and canonical boons are recognized, unrelated items are ignored", () => {
  const actor = {
    system: { attributes: { vigilant: { total: 13 } } },
    items: new Map([
      [1, { name: "Mateiro II", type: "boon", system: {} }],
      [2, { name: "Cartógrafo", type: "boon", system: {} }],
      [3, { name: "Explorador", type: "boon", system: {} }],
      [4, { name: "Mateiro III", type: "equipment", system: {} }]
    ])
  };
  assert.deepEqual(guideProfile(actor), { vigilant: 13, bushcraft: 2, cartographer: true, cartographerIncluded: 0, pathfinder: true });
  assert.deepEqual(guideProfile(), { vigilant: null, bushcraft: 0, cartographer: false, cartographerIncluded: 0, pathfinder: false });
});

test("GM pp.92,98–99: the native verdict and a margin of five have distinct effects", () => {
  const plan = orientationPlan(profile, base);
  const roll = (diceResult, hasSucceed, diceTarget = 12, critSuccess = false) => ({ diceTarget, diceResult, hasSucceed, critSuccess });
  assert.equal(orientationOutcome(plan, roll(8, true)).verdict, "success");
  assert.equal(orientationOutcome(plan, roll(7, true)).verdict, "great");
  assert.equal(orientationOutcome(plan, roll(1, true, 1, true)).verdict, "success");
  assert.equal(orientationOutcome(plan, roll(20, false)).needsMishap, true);
  assert.equal(orientationOutcome(plan, roll(20, true, 20)).needsMishap, false);
  const avoided = orientationOutcome({ ...plan, fullBenefits: false }, roll(1, true));
  assert.equal(avoided.verdict, "avoid");
  assert.equal(avoided.benefits, false);
  assert.equal(avoided.needsMishap, false);
});

test("GM pp.97–99: separate modifiers for all four event tables, including river and optional search", () => {
  const config = { ...base, region: "wild", river: true };
  const great = { benefits: true, margin: 5 };
  const slots = ["ruins", "encounters", "enemies", "terrain"];
  assert.deepEqual(slots.map(key => eventPlan(key, config, great).modifier), [4, 2, 0, 2]);
  assert.deepEqual(slots.map(key => eventPlan(key, config, { benefits: true, margin: 4 }).modifier), [4, 2, 1, 3]);
  assert.deepEqual(slots.map(key => eventPlan(key, { ...config, search: "fast" }, great).modifier), [-3, 2, 0, 2]);
  assert.deepEqual(slots.map(key => eventPlan(key, { ...config, search: "noSearch" }, great).modifier), [-3, 2, 0, 2]);
  assert.deepEqual(slots.map(key => eventPlan(key, { ...config, preparation: "misleading" }, { benefits: false }).modifier), [2, 2, 3, 5]);
  assert.equal(eventPlan("enemies", { ...config, region: "dark", preparation: "deepResearch" }, null).modifier, 4);
  assert.equal(eventPlan("enemies", config, great, { withoutOrientation: true }).modifier, 2);
});

test("the printed Table 27 line 6 uses +3, and Tables 26 and 29 route to their individual follow-ups", () => {
  assert.deepEqual(Array.from({ length: 9 }, (_, index) => detectionModifier(index + 1)), [0, 3, 1, 5, 0, 3, -1, -5, null]);
  assert.deepEqual([10, 11, 13, 15, 17, 19, 20, 21, 22, 25].map(ruinFindsFormula), [
    null, "1d4 + 2", "1d6 + 2", "1d6 + 2", "2d6 + 2", "2d8 + 2", "2d10 + 2", "3d8 + 2", "3d10 + 2", "3d12 + 2"
  ]);
  assert.deepEqual([20, 21, 22, 23, 25].map(corruptedNatureCount), [0, 1, 3, 5, 5]);
});
