import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const restSource = fs.readFileSync(path.join(root, "scripts/rest.mjs"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "styles/symbaroum-ind-resources.css"), "utf8");

test("Rest dialog does not contain private roll checkbox or RollPrivacyService", () => {
  assert.doesNotMatch(restSource, /RollPrivacyService/);
  assert.doesNotMatch(restSource, /tenebrePrivateRoll/);
  assert.doesNotMatch(restSource, /tenebre-rest-private/);
});

test("Stylesheet does not retain unused rest private roll classes", () => {
  assert.doesNotMatch(cssSource, /\.tenebre-rest-private-control/);
  assert.doesNotMatch(cssSource, /\.tenebre-rest-private-check/);
});
