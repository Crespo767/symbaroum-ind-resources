import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

globalThis.Hooks = { once() {}, on() {}, callAll() {} };

const { escapeHtml, format, isActiveGM, isActorExecutor, localize, rerenderActorSheets } = await import("../scripts/utils.mjs");
const { findActorTokenCombatants } = await import("../scripts/sockets.mjs");

test("escapeHtml covers text and quoted attributes, including backticks", () => {
  assert.equal(escapeHtml(`<a title="x" data-y='z'>\`&`), "&lt;a title=&quot;x&quot; data-y=&#39;z&#39;&gt;&#96;&amp;");
  assert.equal(escapeHtml(null), "");
});

test("localize and format fall back when a key is missing", () => {
  globalThis.game = { i18n: { localize: (key) => key, format: (key) => key } };
  assert.equal(localize("MISSING.KEY", "Fallback"), "Fallback");
  assert.equal(localize("MISSING.KEY"), "MISSING.KEY");
  assert.equal(format("MISSING.KEY", "{name} morreu.", { name: "Ana" }), "Ana morreu.");
});

test("one active GM, chosen by the core, runs world automation", () => {
  const gm = { id: "b", isGM: true, active: true };
  const assistant = { id: "a", isGM: true, active: true };
  globalThis.game = { user: assistant, users: Object.assign([assistant, gm], { activeGM: gm }) };
  assert.equal(isActiveGM(), false, "the core's designated GM wins, not the lowest id");
  globalThis.game.user = gm;
  assert.equal(isActiveGM(), true);
});

test("without a GM online, the lowest-id active owner executes actor automation", () => {
  const ana = { id: "ana", active: true, isGM: false };
  const bia = { id: "bia", active: true, isGM: false };
  const actor = { testUserPermission: (user) => user === ana || user === bia };
  globalThis.game = { user: bia, users: Object.assign([bia, ana], { activeGM: null }) };
  assert.equal(isActorExecutor(actor), false);
  globalThis.game.user = ana;
  assert.equal(isActorExecutor(actor), true);
});

test("unlinked tokens of the same actor resolve to their own combatant", () => {
  const goblinB = { isToken: true, id: "goblin" };
  const combatants = [
    { id: "c1", tokenId: "tokA", actorId: "goblin" },
    { id: "c2", tokenId: "tokB", actorId: "goblin" }
  ];
  assert.deepEqual(findActorTokenCombatants(goblinB, [{ id: "tokB" }], combatants).map((c) => c.id), ["c2"]);
  assert.deepEqual(findActorTokenCombatants(goblinB, [{ id: "tokZ" }], combatants), [], "no actor-id guess for unlinked tokens");

  const hero = { isToken: false, id: "hero" };
  assert.deepEqual(findActorTokenCombatants(hero, [{ id: "tokZ" }], [{ id: "c3", tokenId: "tokH", actorId: "hero" }]).map((c) => c.id), ["c3"]);
});

test("rerenderActorSheets reaches V1 windows and ApplicationV2 instances", () => {
  const rendered = [];
  const actor = { documentName: "Actor", id: "hero", uuid: "Actor.hero" };
  const other = { documentName: "Actor", id: "other", uuid: "Actor.other" };
  const sheet = (document, name) => ({ document, render: () => rendered.push(name) });
  globalThis.ui = { windows: { 1: sheet(actor, "v1-hero") } };
  globalThis.foundry = { applications: { instances: new Map([["x", sheet(actor, "v2-hero")], ["y", sheet(other, "v2-other")]]) } };

  rerenderActorSheets(actor);
  assert.deepEqual(rendered.sort(), ["v1-hero", "v2-hero"]);
});

test("helpers live in utils.mjs instead of per-file copies", async () => {
  const files = (await readdir(new URL("../scripts/", import.meta.url))).filter((name) => name.endsWith(".mjs") && name !== "utils.mjs");
  for (const file of files) {
    const source = await readFile(new URL(`../scripts/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /^function (escapeHtml|escapeAttribute|localize|format|normalizeText|isIndicatorExecutor|isPrimaryActiveGm)\(/m, file);
    assert.equal(source.charCodeAt(0) === 0xfeff, false, `${file} starts with a BOM`);
  }
});
