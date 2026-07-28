import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const moduleManifest = readJson("module.json");
const packageManifest = readJson("package.json");
const pt = readJson("languages/pt-BR.json");
const en = readJson("languages/en.json");

assert.equal(moduleManifest.id, "symbaroum-ind-resources");
assert.equal(packageManifest.name, moduleManifest.id);
assert.equal(packageManifest.version, moduleManifest.version);
assert.equal(moduleManifest.authors.length, 2);
assert.equal(moduleManifest.authors.every((author) => author.name && author.discord), true);
assert.equal(moduleManifest.url, "https://github.com/Crespo767/symbaroum-ind-resources");
assert.equal(moduleManifest.readme, "https://github.com/Crespo767/symbaroum-ind-resources#readme");
assert.equal(moduleManifest.bugs, "https://github.com/Crespo767/symbaroum-ind-resources/issues");
assert.equal(moduleManifest.changelog, "https://github.com/Crespo767/symbaroum-ind-resources/releases");
assert.match(moduleManifest.manifest, /^https:\/\/raw\.githubusercontent\.com\/Crespo767\/symbaroum-ind-resources\/main\/module\.json$/);
assert.match(moduleManifest.download, /^https:\/\/github\.com\/Crespo767\/symbaroum-ind-resources\/releases\/latest\/download\/symbaroum-ind-resources\.zip$/);

for (const relativePath of [
  ...(moduleManifest.esmodules ?? []),
  ...(moduleManifest.styles ?? []),
  ...(moduleManifest.languages ?? []).map((language) => language.path)
]) {
  assert.equal(fs.existsSync(path.join(root, relativePath)), true, `Missing manifest file: ${relativePath}`);
}

for (const fileName of fs.readdirSync(path.join(root, "data")).filter((name) => name.endsWith(".json"))) {
  readJson(path.join("data", fileName));
}

assert.deepEqual(
  Object.keys(pt).filter((key) => !(key in en)),
  [],
  "Translation keys missing from English"
);
assert.deepEqual(
  Object.keys(en).filter((key) => !(key in pt)),
  [],
  "Translation keys missing from Portuguese"
);

const scriptDirectory = path.join(root, "scripts");
const scriptFiles = fs.readdirSync(scriptDirectory).filter((name) => name.endsWith(".mjs"));
const missingImports = [];
const missingTranslations = new Set();

for (const fileName of scriptFiles) {
  const source = fs.readFileSync(path.join(scriptDirectory, fileName), "utf8");
  for (const match of source.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g)) {
    let target = path.resolve(scriptDirectory, match[1]);
    if (!path.extname(target)) target += ".mjs";
    if (!fs.existsSync(target)) missingImports.push(`${fileName}: ${match[1]}`);
  }
  for (const match of source.matchAll(/game\.i18n\.(?:localize|format)\(\s*["'](TENEBRE\.[^"']+)["']/g)) {
    if (!(match[1] in pt) || !(match[1] in en)) missingTranslations.add(match[1]);
  }
}

assert.deepEqual(missingImports, [], "Broken local module imports");
assert.deepEqual(Array.from(missingTranslations).sort(), [], "Missing TENEBRE translations");

const maneuverSource = fs.readFileSync(path.join(scriptDirectory, "maneuvers.mjs"), "utf8").replace(/\r\n/g, "\n");
const maneuverDefinitions = maneuverSource.match(/const MANEUVERS = \[([\s\S]*?)\n\];\n\nexport class ManeuverService/)?.[1] ?? "";
const maneuverLabels = Array.from(maneuverDefinitions.matchAll(/labelKey:\s*"(TENEBRE\.Maneuvers\.[^"]+)"/g), (match) => match[1]);
const maneuverNoteGroups = Array.from(maneuverDefinitions.matchAll(/noteKeys:\s*\[([\s\S]*?)\]/g), (match) => match[1]);
const maneuverNoteKeys = maneuverNoteGroups.flatMap((group) => (
  Array.from(group.matchAll(/"(TENEBRE\.Maneuvers\.[^"]+)"/g), (match) => match[1])
));

assert.equal(maneuverLabels.length > 0, true, "Maneuver definitions were not found");
assert.equal(maneuverNoteGroups.length, maneuverLabels.length, "Every maneuver must provide tooltip notes");
assert.deepEqual(
  maneuverNoteKeys.filter((key) => !(key in pt) || !(key in en)),
  [],
  "Maneuver tooltip notes must be translated in Portuguese and English"
);

console.log(`module structure tests passed (${scriptFiles.length} scripts, ${Object.keys(pt).length} translations)`);
