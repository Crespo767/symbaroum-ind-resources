import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  NEW_PLAYER_TOUGHNESS,
  hasExplicitToughness,
  initialPlayerToughnessUpdate
} from "../scripts/actor-creation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const initSource = fs.readFileSync(path.join(root, "scripts/init.mjs"), "utf8");

test("a newly created blank player starts with 10 current Toughness", () => {
  assert.equal(NEW_PLAYER_TOUGHNESS, 10);
  assert.deepEqual(
    initialPlayerToughnessUpdate({ type: "player" }, { name: "New Hero", type: "player" }),
    { "system.health.toughness.value": 10 }
  );
});

test("monster and NPC creation remains untouched", () => {
  assert.equal(initialPlayerToughnessUpdate({ type: "monster" }, { name: "Enemy", type: "monster" }), null);
});

test("imports, duplicates, and explicit creation data preserve their Toughness", () => {
  const zero = { system: { health: { toughness: { value: 0 } } } };
  const wounded = { system: { health: { toughness: { value: 4 } } } };
  const flattened = { "system.health.toughness.value": 7 };

  assert.equal(hasExplicitToughness(zero), true);
  assert.equal(hasExplicitToughness(wounded), true);
  assert.equal(hasExplicitToughness(flattened), true);
  assert.equal(initialPlayerToughnessUpdate({ type: "player" }, zero), null);
  assert.equal(initialPlayerToughnessUpdate({ type: "player" }, wounded), null);
  assert.equal(initialPlayerToughnessUpdate({ type: "player" }, flattened), null);
});

test("the creation hook is registered during init and changes only document source", () => {
  assert.match(initSource, /ActorCreationService\.register\(\)/);
  const source = fs.readFileSync(path.join(root, "scripts/actor-creation.mjs"), "utf8");
  assert.match(source, /Hooks\.on\("preCreateActor"/);
  assert.match(source, /actor\.updateSource\(update\)/);
  assert.doesNotMatch(source, /actor\.update\(/);
});
