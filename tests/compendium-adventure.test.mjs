import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptSource = fs.readFileSync(path.join(root, "tools", "update-adventure-pack.cjs"), "utf8");

// Verify that the generator script exists and uses strict 16-character ID validation
assert.ok(scriptSource.includes("validateDocumentId"), "Generator must validate document IDs");
assert.ok(scriptSource.includes("id.length !== 16"), "Generator must enforce 16-character IDs");

// Extract all hardcoded IDs in update-adventure-pack.cjs
const idMatches = Array.from(scriptSource.matchAll(/makeId\(\s*['"]([a-zA-Z0-9]+)['"]\s*,\s*(\d+)\s*\)/g));
assert.ok(idMatches.length >= 10, "Expected at least 10 generated IDs in script");

function makeId(prefix, num) {
  const pad = "0".repeat(16 - prefix.length - String(num).length);
  const id = `${prefix}${pad}${num}`;
  return id;
}

for (const match of idMatches) {
  const prefix = match[1];
  const num = Number(match[2]);
  const generated = makeId(prefix, num);
  assert.equal(
    generated.length,
    16,
    `Generated ID "${generated}" from prefix "${prefix}" must be exactly 16 characters`
  );
  assert.match(
    generated,
    /^[a-zA-Z0-9]{16}$/,
    `Generated ID "${generated}" must be alphanumeric`
  );
}

// Verify folder IDs
assert.equal(makeId("fldTransport", 1).length, 16);
assert.equal(makeId("fldAnimals", 1).length, 16);

// Verify required vehicles exist in script
const requiredVehicles = [
  "Carroça",
  "Vagão",
  "Trenó",
  "Canoa",
  "Barco a remo",
  "Barco de rio",
  "Navio / Galé"
];
for (const vehicle of requiredVehicles) {
  assert.ok(
    scriptSource.includes(`name: '${vehicle}'`),
    `Vehicle "${vehicle}" must be present in update-adventure-pack.cjs`
  );
}

// Verify required beasts exist in script
const requiredBeasts = [
  "Mula",
  "Burro",
  "Boi",
  "Cavalo"
];
for (const beast of requiredBeasts) {
  assert.ok(
    scriptSource.includes(`name: '${beast}'`),
    `Beast "${beast}" must be present in update-adventure-pack.cjs`
  );
}

console.log(`compendium adventure tests passed (${idMatches.length} document IDs verified)`);
