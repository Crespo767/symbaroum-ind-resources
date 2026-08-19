import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const { herbalCureFormula, isHerbalCureItem, isSelfHerbalCure, medicusLevel, resolveHerbalCureTarget } = await import("../scripts/herbal-cure-rules.mjs");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("recognizes only the Herbal Cure equipment", () => {
  assert.equal(isHerbalCureItem({ type: "equipment", name: "Cura Herbal", system: {} }), true);
  assert.equal(isHerbalCureItem({ type: "equipment", name: "Herbal Cure", system: {} }), true);
  assert.equal(isHerbalCureItem({ type: "equipment", name: "Remédio", system: { reference: "herbal-cure" } }), true);
  assert.equal(isHerbalCureItem({ type: "ability", name: "Cura Herbal", system: {} }), false);
  assert.equal(isHerbalCureItem({ type: "equipment", name: "Cura", system: {} }), false);
});

test("uses the native Medicus level flags", () => {
  const actor = { items: new Map([["medicus", { name: "Médico", system: { reference: "medicus", novice: { isActive: true }, adept: { isActive: true }, master: { isActive: false } } }]]) };
  assert.equal(medicusLevel(actor), 2);
  assert.equal(medicusLevel({ items: new Map() }), 0);
});

test("matches the Symbaroum Herbal Cure formulas for every Medicus level", () => {
  assert.equal(herbalCureFormula(0, true), "1");
  assert.equal(herbalCureFormula(1, true), "1d6");
  assert.equal(herbalCureFormula(2, true), "1d8");
  assert.equal(herbalCureFormula(3, true), "1d10");
  assert.equal(herbalCureFormula(1, false), null);
  assert.equal(herbalCureFormula(2, false), null);
  assert.equal(herbalCureFormula(3, false), "1d6");
});

test("targets one selected actor or falls back to the sheet actor", () => {
  const self = { id: "self" };
  const ally = { id: "ally" };
  assert.equal(resolveHerbalCureTarget(self, []).actor, self);
  assert.equal(resolveHerbalCureTarget(self, [{ actor: ally }]).actor, ally);
  assert.equal(resolveHerbalCureTarget(self, [{ actor: ally }, { actor: self }]).error, "multiple");
});

test("self healing is distinguished without repeating the actor name", () => {
  const actor = { id: "actor", uuid: "Actor.actor" };
  assert.equal(isSelfHerbalCure(actor, actor), true);
  assert.equal(isSelfHerbalCure(actor, { id: "actor", uuid: "Actor.actor" }), true);
  assert.equal(isSelfHerbalCure(actor, { id: "ally", uuid: "Actor.ally" }), false);

  const service = fs.readFileSync(path.join(root, "scripts", "herbal-cure.mjs"), "utf8");
  assert.match(service, /isSelfHerbalCure\(sourceActor, targetActor\)/);
  assert.match(service, /TENEBRE\.HerbalCure\.TitleSelf/);
});

test("Herbal Cure chat follows the compact ability and power card structure", () => {
  const service = fs.readFileSync(path.join(root, "scripts", "herbal-cure.mjs"), "utf8");
  assert.match(service, /tenebre-berserker-card/);
  assert.match(service, /tenebre-berserker-participants/);
  assert.match(service, /tenebre-berserker-details/);
  assert.match(service, /tenebre-berserker-roll-summary/);
  assert.match(service, /if \(!selfUse\)/);
  assert.doesNotMatch(service, /style="display:flex;align-items:center/);
});

test("the sheet binds Herbal Cure only to its image and resolves it through an authenticated GM socket", () => {
  const sheet = fs.readFileSync(path.join(root, "scripts", "sheet-ui.mjs"), "utf8");
  const service = fs.readFileSync(path.join(root, "scripts", "herbal-cure.mjs"), "utf8");
  const wire = sheet.slice(sheet.indexOf("function wireHerbalCureIconUse"), sheet.indexOf("function injectMoneyControls"));
  assert.match(wire, /\.image-container > \.image/);
  assert.doesNotMatch(wire, /\.item-edit/);
  assert.match(wire, /HerbalCureService\.use\(actor, item\)/);
  assert.match(service, /SocketService\.executeAsGM\(/);
  assert.match(service, /ownsActor\(sourceActor, user\)/);
  assert.match(service, /isTargetedByUser\(targetActor, user\)/);
  assert.match(service, /await item\.update\(\{ "system\.number"/);
});
