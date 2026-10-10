import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const MODULE_ID = "symbaroum-ind-resources";
const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

globalThis.Hooks = { once() {}, on() {}, callAll() {} };
globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: class {},
      HandlebarsApplicationMixin: (Base) => class extends Base {}
    }
  }
};
globalThis.CONFIG = { statusEffects: [] };
globalThis.game = {
  settings: { settings: new Map(), get: () => true },
  i18n: { localize: (key) => key },
  symbaroum: { config: { TYPE_ROLL_MOD: "attackrollmod", DAM_MOD: "damagemodifier", STATUS_DOT: "statusDoT" } }
};

const { matchesAnyAlias } = await import("../scripts/utils.mjs");
const { getAmmoType, getWeaponAmmoType, isQuiver, isRation } = await import("../scripts/item-flags.mjs");
const { getSpecialAmmo } = await import("../scripts/special-ammo.mjs");
const {
  AMMO_PACKAGE_PREFIX,
  attachAmmoModifierPackages,
  buildAmmoModifierPackages,
  syncAmmoPackageSelection
} = await import("../scripts/ammo-roll.mjs");
const { MANEUVER_EFFECTS, ManeuverService, shouldExpireEffect } = await import("../scripts/maneuvers.mjs");
const { HungerService } = await import("../scripts/hunger.mjs");

const equipment = (name) => ({ name, type: "equipment", getFlag: () => undefined });

test("names match aliases only as whole words", () => {
  assert.equal(isRation(equipment("Ração de Viagem")), true);
  assert.equal(isRation(equipment("Coração de Troll")), false);
  assert.equal(getWeaponAmmoType({ name: "Arco Longo", getFlag: () => undefined }), "ammo");
  assert.equal(getWeaponAmmoType({ name: "Elbow Blade", getFlag: () => undefined }), "");
  assert.equal(getWeaponAmmoType({ name: "Espada de Marco", getFlag: () => undefined }), "");
  assert.equal(isQuiver(equipment("Aljava de Couro")), true);
  assert.equal(getAmmoType(equipment("Flechas/Virotes - Regulares")), "ammo");
  assert.equal(getAmmoType(equipment("Narrow Rope")), "");
  assert.equal(Boolean(getSpecialAmmo(equipment("Arrow - Swallow’s Tail"))), true);
  assert.equal(matchesAnyAlias("", ["arco"]), false);
});

test("special ammunition becomes an optional Symbaroum modifier package", () => {
  const options = [
    { value: "plain", ammo: { id: "a", name: "Flechas/Virotes - Regulares", system: {} } },
    { value: "precise", ammo: { id: "b", name: "Flecha - Precisão", system: {} } }
  ];
  const packages = buildAmmoModifierPackages(options);

  assert.equal(packages.length, 1);
  assert.equal(options[0].packageId, undefined);
  assert.equal(options[1].packageId, `${AMMO_PACKAGE_PREFIX}1`);
  assert.equal(packages[0].type, "checkbox");
  assert.equal(packages[0].member[0].type, "attackrollmod");
  assert.equal(packages[0].member[0].modifier, 1);
});

test("ammo packages are added before the dialog copies the weapon modifiers and removed afterwards", () => {
  const nativePackage = { id: "native", type: "default", member: [] };
  const actor = { system: { combat: { combatMods: { weapons: { bow: { package: [nativePackage] } } } } } };
  const options = [{ value: "precise", ammo: { id: "b", name: "Flecha - Precisão", system: {} } }];

  const detach = attachAmmoModifierPackages(actor, { id: "bow" }, options);
  assert.deepEqual(actor.system.combat.combatMods.weapons.bow.package.map((pack) => pack.id), ["native", `${AMMO_PACKAGE_PREFIX}0`]);
  detach();
  assert.deepEqual(actor.system.combat.combatMods.weapons.bow.package, [nativePackage]);
});

test("the ammo selector ticks only the chosen ammunition package and hides the checkboxes", () => {
  const rows = [];
  const checkboxes = new Map(["tenebre-ammo-0", "tenebre-ammo-1"].map((id) => {
    const row = { hidden: false, classList: { add() {} } };
    rows.push(row);
    return [id, { checked: false, closest: () => row }];
  }));
  const root = {
    querySelector(selector) {
      const id = selector.match(/\$="-([^"]+)"/)?.[1];
      return checkboxes.get(id) ?? null;
    }
  };
  const options = [{ value: "a", packageId: "tenebre-ammo-0" }, { value: "b", packageId: "tenebre-ammo-1" }];

  syncAmmoPackageSelection(root, options, "b");
  assert.equal(checkboxes.get("tenebre-ammo-0").checked, false);
  assert.equal(checkboxes.get("tenebre-ammo-1").checked, true);
  assert.ok(rows.every((row) => row.hidden));
});

test("the weapon wrapper attaches ammo packages before calling the system roll", async () => {
  const wrapper = await read("scripts/weapon-wrapper.mjs");
  const attachIndex = wrapper.indexOf("attachAmmoModifierPackages(this, weapon");
  const rollIndex = wrapper.indexOf("const result = await wrapped.call(this, weapon, ...args);\n      const chosenAmmo");
  assert.ok(attachIndex > 0 && rollIndex > attachIndex);
  assert.match(wrapper, /detachAmmoPackages\(\);/);
  const sheet = await read("scripts/sheet-ui.mjs");
  assert.doesNotMatch(sheet, /renderTemplate|activeWeaponModifiers/);
});

function maneuverEffect(effectId, parent, startRound = 1, startTurn = 0) {
  const flags = { [MODULE_ID]: { effectId, maneuverEffect: true, expiration: "turnEnd", startRound, startTurn, combatId: "c" } };
  return { parent, flags, statuses: new Set([effectId]), getFlag: (scope, key) => flags[scope]?.[key] };
}

test("Total Defense lasts until the character's next turn", () => {
  const hero = { uuid: "Actor.hero" };
  const goblin = { uuid: "Actor.goblin" };
  const effect = maneuverEffect(MANEUVER_EFFECTS.TOTAL_DEFENSE, hero);
  const combat = (round, turn, actor) => ({ id: "c", round, turn, combatant: { actor } });

  assert.equal(shouldExpireEffect(effect, combat(1, 0, hero)), false, "declaration turn");
  assert.equal(shouldExpireEffect(effect, combat(1, 1, goblin)), false, "enemy turn: still defending");
  assert.equal(shouldExpireEffect(effect, combat(2, 0, hero)), true, "own next turn");
  assert.equal(shouldExpireEffect(effect, combat(3, 1, goblin)), true, "turn skipped: expires anyway");
  assert.equal(shouldExpireEffect(maneuverEffect(MANEUVER_EFFECTS.TOTAL_OFFENSE, hero), combat(1, 1, goblin)), false);
  assert.equal(shouldExpireEffect(maneuverEffect(MANEUVER_EFFECTS.CAREFUL_AIM, hero), combat(1, 1, goblin)), true);
});

test("Hunger always wins over maneuver favour", () => {
  const hungry = {
    effects: [{ flags: { [MODULE_ID]: { hunger: true } }, getFlag: (scope, key) => (key === "hunger" ? true : undefined) }]
  };
  const totalDefense = maneuverEffect(MANEUVER_EFFECTS.TOTAL_DEFENSE, hungry);
  hungry.effects.push(totalDefense);

  const withManeuver = ManeuverService.applyRollFavour(hungry, "defense", 0);
  assert.equal(withManeuver, 1);
  assert.equal(HungerService.applyDisfavour(withManeuver, hungry), -1);
});

test("ApplicationV2 instances are iterated by value", async () => {
  for (const file of ["settings", "sheet-ui", "encumbrance", "bithir-macros"]) {
    const source = await read(`scripts/${file}.mjs`);
    assert.doesNotMatch(source, /of instances\)/, file);
  }
});

test("roll modes are passed as ChatMessage options, where the core reads them", async () => {
  const bithir = await read("scripts/bithir-macros.mjs");
  assert.doesNotMatch(bithir, /^\s*rollMode:/m);
  assert.match(bithir, /\{ rollMode: CONST\.DICE_ROLL_MODES\.PRIVATE \}/);
});
