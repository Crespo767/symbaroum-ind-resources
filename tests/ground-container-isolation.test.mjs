import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const MODULE_ID = "symbaroum-ind-resources";

globalThis.Hooks = { once() {}, on() {}, callAll() {} };

const { getActorTokens, getCanvasCreatureTokens, isGroundContainerToken } = await import("../scripts/utils.mjs");
const { GroundContainerService } = await import("../scripts/ground-containers.mjs");

const heroToken = { id: "hero-token", document: { flags: {} } };
const backpackToken = { id: "bag-token", document: { flags: { [MODULE_ID]: { groundContainer: { version: 1 } } } } };

test("a dropped container token is recognised by its module flag", () => {
  assert.equal(isGroundContainerToken(backpackToken), true);
  assert.equal(isGroundContainerToken(backpackToken.document), true);
  assert.equal(isGroundContainerToken(heroToken), false);
});

test("the character's tokens never include the backpack lying on the ground", () => {
  // No core, getActiveTokens() devolve também tokens não vinculados do ator.
  const hero = { getActiveTokens: () => [backpackToken, heroToken] };
  assert.deepEqual(getActorTokens(hero), [heroToken]);
  assert.deepEqual(getActorTokens(null), []);
});

test("canvas scans only see creatures", () => {
  globalThis.canvas = { tokens: { placeables: [heroToken, backpackToken] } };
  assert.deepEqual(getCanvasCreatureTokens(), [heroToken]);
});

test("the ground token looks like an object, not like the character", () => {
  const data = GroundContainerService.buildGroundTokenData({
    actor: { id: "hero", uuid: "Actor.hero" },
    container: { id: "bag", name: "Mochila", img: "bag.webp" },
    scene: { id: "scene" },
    x: 0,
    y: 0,
    previousState: "equipped"
  });
  assert.equal(data.displayBars, 0);
  assert.equal(data.disposition, 0);
  assert.deepEqual(data.sight, { enabled: false });
  assert.equal(isGroundContainerToken({ flags: data.flags }), true);
});

test("character automations do not read raw getActiveTokens() or canvas placeables", async () => {
  const allowed = new Set(["utils.mjs", "ground-containers.mjs", "container-transfer.mjs", "pain-threshold-choice.mjs"]);
  const files = (await readdir(new URL("../scripts/", import.meta.url))).filter((name) => name.endsWith(".mjs") && !allowed.has(name));
  for (const file of files) {
    const source = await readFile(new URL(`../scripts/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /getActiveTokens\?*\.?\(\)/, `${file} must use getActorTokens()`);
    assert.doesNotMatch(source, /tokens\?*\.placeables/, `${file} must use getCanvasCreatureTokens()`);
  }
});
