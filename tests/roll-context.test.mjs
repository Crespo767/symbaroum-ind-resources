import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  actorIdFromRollDialog,
  beginWeaponRoll,
  endWeaponRoll,
  getWeaponRoll,
  getWeaponRollForDialog
} from "../scripts/roll-context.mjs";

const RANDOM_20 = "abcdefghijklmnopqrst";
const dialogFor = (actorId) => ({
  querySelector: (selector) => (selector.includes("modifier-") ? { id: `modifier-${actorId}${RANDOM_20}` } : null)
});

test("the Symbaroum dialog id identifies the attacking actor", () => {
  assert.equal(actorIdFromRollDialog(dialogFor("hero0000000000ab")), "hero0000000000ab");
  assert.equal(actorIdFromRollDialog({ querySelector: () => null }), null);
});

test("simultaneous attacks by different actors keep separate contexts", () => {
  const hero = { id: "hero0000000000ab" };
  const archer = { id: "archer00000000ab" };
  const heroRoll = { actor: hero, weapon: { id: "sword" }, isRanged: false };
  const archerRoll = { actor: archer, weapon: { id: "bow" }, isRanged: true };

  const endHero = beginWeaponRoll(heroRoll);
  const endArcher = beginWeaponRoll(archerRoll);
  assert.equal(getWeaponRollForDialog(dialogFor(hero.id)), heroRoll);
  assert.equal(getWeaponRollForDialog(dialogFor(archer.id)), archerRoll);

  endHero();
  assert.equal(getWeaponRoll(hero), null);
  assert.equal(getWeaponRoll(archer), archerRoll);
  endArcher();
});

test("ending an old context never removes a newer one for the same actor", () => {
  const hero = { id: "hero0000000000ab" };
  const first = { actor: hero };
  const second = { actor: hero };
  beginWeaponRoll(first);
  const endSecond = beginWeaponRoll(second);
  endWeaponRoll(first);
  assert.equal(getWeaponRoll(hero), second);
  endSecond();
  assert.equal(getWeaponRoll(hero), null);
});

test("roll flow no longer relies on global roll state", async () => {
  for (const file of ["weapon-wrapper", "sheet-ui", "maneuvers", "init"]) {
    const source = await readFile(new URL(`../scripts/${file}.mjs`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /activeWeaponRoll|activeManeuverWeaponRoll/, file);
  }
  const sheet = await readFile(new URL("../scripts/sheet-ui.mjs", import.meta.url), "utf8");
  assert.match(sheet, /if \(dialog\?\._tenebreWeaponRoll && !dialog\._tenebreRollSubmitted\)/, "closing without rolling ends the context");
  const wrapper = await readFile(new URL("../scripts/weapon-wrapper.mjs", import.meta.url), "utf8");
  assert.match(wrapper, /finally \{\s*detachAmmoPackages\(\);\s*endWeaponRoll\(\);/);
});

test("power chat context is kept per actor and consumed by that actor's message", async () => {
  const init = await readFile(new URL("../scripts/init.mjs", import.meta.url), "utf8");
  assert.match(init, /const activePowerChatContexts = new Map\(\);/);
  assert.match(init, /let context = takeActivePowerChatContext\(speaker\.actor\);/);
  assert.doesNotMatch(init, /let activePowerChatContext\b/);
});
