import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const source = read("scripts/death-automation.mjs");
const init = read("scripts/init.mjs");
const movement = read("scripts/movement-ruler.mjs");
const weapons = read("scripts/weapon-wrapper.mjs");
const maneuvers = read("scripts/maneuvers.mjs");
const standUp = read("scripts/stand-up.mjs");
const settings = read("scripts/settings.mjs");
const template = read("templates/settings.hbs");
const css = read("styles/symbaroum-ind-resources.css");
const ptBr = JSON.parse(read("languages/pt-BR.json"));

globalThis.Hooks = { once() {}, on() {}, callAll() {} };
globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: class {},
      HandlebarsApplicationMixin: (Base) => class extends Base {}
    }
  }
};

const {
  buildDeathPromptHtml,
  buildDyingEffectData,
  buildDeathTurnKey,
  resolveDeathTestOutcome,
  selectDeathManager,
  shouldEnterDyingState
} = await import("../scripts/death-automation.mjs");

test("Death Test follows the four official result bands", () => {
  assert.deepEqual(resolveDeathTestOutcome(1, 2), {
    kind: "recovered", total: 1, failures: 0, critical: true
  });
  assert.deepEqual(resolveDeathTestOutcome(2, 1), {
    kind: "survives", total: 2, failures: 1, critical: false
  });
  assert.deepEqual(resolveDeathTestOutcome(10, 2), {
    kind: "survives", total: 10, failures: 2, critical: false
  });
  assert.deepEqual(resolveDeathTestOutcome(11, 0), {
    kind: "failure", total: 11, failures: 1, critical: false
  });
  assert.deepEqual(resolveDeathTestOutcome(19, 2), {
    kind: "dead", total: 19, failures: 3, critical: true
  });
  assert.deepEqual(resolveDeathTestOutcome(20, 0, 20, true), {
    kind: "dead", total: 20, failures: 3, critical: true
  });
});

test("modifiers affect normal and optional enhanced critical targets without overriding natural 20", () => {
  assert.equal(resolveDeathTestOutcome(12, 0, 2).kind, "survives");
  assert.equal(resolveDeathTestOutcome(2, 0, 2, false).kind, "survives");
  assert.equal(resolveDeathTestOutcome(2, 0, 2, true).kind, "recovered");
  assert.equal(resolveDeathTestOutcome(20, 0, 20, true).kind, "dead");
});

test("only player characters at zero enter the Dying state", () => {
  const player = { type: "player", system: { health: { toughness: { value: 0 } } } };
  assert.equal(shouldEnterDyingState(player, null), true);
  assert.equal(shouldEnterDyingState({ ...player, type: "monster" }, null), false);
  assert.equal(shouldEnterDyingState({ ...player, system: { health: { toughness: { value: 1 } } } }, null), false);
  assert.equal(shouldEnterDyingState(player, { status: "dying" }), false);
  assert.equal(shouldEnterDyingState(player, { status: "dead" }), false);
});

test("Dying is an automation-owned Active Effect, not a manually selectable core status", () => {
  globalThis.game = { i18n: { localize: (key) => ptBr[key] ?? key } };
  const effect = buildDyingEffectData();
  assert.deepEqual(effect.statuses, ["tenebre-dying"]);
  assert.equal(effect.flags["symbaroum-ind-resources"].deathAutomation, true);
  assert.match(source, /actor\.createEmbeddedDocuments\("ActiveEffect", \[buildDyingEffectData\(\)\]\)/);
  assert.doesNotMatch(init, /DeathAutomationService\.registerStatusEffect/);
});

test("one stable key identifies each combat turn", () => {
  const combatant = { id: "character" };
  const combat = { id: "combat", started: true, round: 3, turn: 2, combatant };
  assert.equal(buildDeathTurnKey(combat), "combat:3:2:character");
  assert.equal(buildDeathTurnKey({ ...combat, started: false }), null);
});

test("the active GM is authoritative, with one owner fallback when no GM is active", () => {
  const actor = {
    testUserPermission(user) { return user.id === "owner-b" || user.id === "owner-a"; }
  };
  const users = [
    { id: "owner-b", active: true, isGM: false },
    { id: "gm", active: true, isGM: true },
    { id: "owner-a", active: true, isGM: false }
  ];
  assert.equal(selectDeathManager(users, actor), "gm");
  assert.equal(selectDeathManager(users.filter((user) => !user.isGM), actor), "owner-a");
});

test("the prompt escapes character data and exposes one authenticated roll action", () => {
  globalThis.game = { i18n: { localize: (key) => ptBr[key] ?? key, format: (key, data) => (ptBr[key] ?? key).replace(/\{(\w+)\}/g, (_m, name) => data[name] ?? "") } };
  const html = buildDeathPromptHtml({ name: "A <B>", img: 'bad".webp' }, "combat:1:2:actor");
  assert.match(html, /A &lt;B&gt;/);
  assert.match(html, /bad&quot;\.webp/);
  assert.equal((html.match(/data-tenebre-death-roll/g) ?? []).length, 1);
});

test("death lifecycle is persisted and resolved by an authenticated GM socket", () => {
  assert.match(source, /SocketService\.registerHandler\(SOCKET_HANDLER, resolveDeathTestAsAuthority\)/);
  assert.match(source, /User cannot roll this character's Death Test/);
  assert.match(source, /state\.promptKey !== prompt\.rollKey/);
  assert.match(source, /"system\.nbrOfFailedDeathRoll": 3/);
  assert.match(source, /"system\.health\.toughness\.value": Math\.min\(maximum, healing\)/);
  assert.match(source, /setDeadPresentation\(actor, false\)/);
  assert.match(source, /setDeadPresentation\(actor, true\)/);
});

test("Dying blocks movement and character combat actions while forced movement remains possible", () => {
  assert.match(movement, /if \(isForcedMovement\) return true;[\s\S]*?if \(isDeathIncapacitated\(actor\)\)/);
  assert.match(movement, /TENEBRE\.Death\.MovementBlocked/);
  assert.match(weapons, /isDeathIncapacitated\(this\)[\s\S]*?TENEBRE\.Death\.ActionBlocked/);
  assert.match(maneuvers, /isDeathIncapacitated\(actor\)[\s\S]*?TENEBRE\.Death\.ActionBlocked/);
  assert.match(init, /isDeathIncapacitated\(this\)[\s\S]*?TENEBRE\.Death\.ActionBlocked/);
  assert.match(init, /isDeathIncapacitated\(actor\)[\s\S]*?TENEBRE\.Death\.ActionBlocked/);
  assert.match(standUp, /isProneActor\(actor\)[\s\S]*?!isDeathIncapacitated\(actor\)/);
});

test("death automation is configurable, localized, and module-scoped", () => {
  assert.match(settings, /register\("enableDeathAutomation", Boolean, DEFAULTS\.enableDeathAutomation/);
  assert.match(template, /name="enableDeathAutomation"/);
  assert.equal(ptBr["TENEBRE.Settings.EnableDeathAutomation"], "Automatizar morte de personagens");
  assert.match(css, /\.tenebre-death-prompt \[data-tenebre-death-roll\]/);
  assert.doesNotMatch(css, /#chat-log|\.chat-sidebar\s+\.chat-scroll/);
});

test("native Death and Recover buttons are hidden only while automation is enabled", () => {
  assert.match(source, /querySelectorAll\?\.\("\.death-roll, \.recover-death-roll"\)/);
  assert.match(source, /button\.hidden = this\.isEnabled\(\)/);
  assert.match(css, /\.tenebre-death-system-hidden/);
});

test("Dice So Nice completes before the custom result message and private rolls target GMs", () => {
  const dice = read("scripts/dice.mjs");
  assert.match(source, /await createChatMessageAfterDice\(/);
  assert.match(dice, /await showDice3d\(foundryRolls, \{ privateRoll: effectivePrivateRoll \}\)/);
  assert.match(dice, /filter\(\(user\) => user\.isGM\)/);
});
