import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import test from "node:test";

const settingsSource = await readFile(new URL("../scripts/settings.mjs", import.meta.url), "utf8");
const templateSource = await readFile(new URL("../templates/settings.hbs", import.meta.url), "utf8");
const rollPrivacySource = await readFile(new URL("../scripts/roll-privacy.mjs", import.meta.url), "utf8");
const ritualBrowserSource = await readFile(new URL("../scripts/ritual-browser.mjs", import.meta.url), "utf8");
const sheetSource = await readFile(new URL("../scripts/sheet-ui.mjs", import.meta.url), "utf8");
const gmLogServiceSource = await readFile(new URL("../scripts/gm-log-service.mjs", import.meta.url), "utf8");
const gmLogUiSource = await readFile(new URL("../scripts/gm-log-ui.mjs", import.meta.url), "utf8");
const inventoryCleanupSource = await readFile(new URL("../scripts/inventory-cleanup.mjs", import.meta.url), "utf8");

const registered = new Set(Array.from(settingsSource.matchAll(/\bregister\("([^"]+)"/g), (match) => match[1]));
const registeredTypes = new Map(Array.from(settingsSource.matchAll(/\bregister\("([^"]+)",\s*(Boolean|Number|String|Object)/g), (match) => [match[1], match[2]]));
const formFields = new Set(Array.from(templateSource.matchAll(/\bname="([^"]+)"/g), (match) => match[1].split(".")[0])
  .filter((name) => !name.includes("{{")));
const internalSettings = new Set([
  "hideCompatibilityNotice",
  "compatibilityNoticeAcknowledged",
  "encumbranceDiscoveredWeights",
  "weaponReadinessButtonPosition",
  "gmLogWindowPosition",
  "containerExpansionState",
  "enableChatItemUse"
]);

test("every settings form field has a registered setting", () => {
  for (const field of formFields) {
    assert.equal(registered.has(field), true, `Unregistered settings form field: ${field}`);
  }
});

test("every user-facing setting is represented in a category form", () => {
  for (const setting of registered) {
    if (internalSettings.has(setting)) continue;
    assert.equal(formFields.has(setting), true, `Registered setting missing from forms: ${setting}`);
  }
});

test("every form field is normalized according to its registered type", () => {
  const normalizationLists = {
    Boolean: new Set(Array.from(settingsSource.matchAll(/const booleans = \[([\s\S]*?)\];/g), (match) => match[1].match(/"([^"]+)"/g) ?? [])
      .flat().map((value) => value.slice(1, -1))),
    Number: new Set(Array.from(settingsSource.matchAll(/const numbers = \[([\s\S]*?)\];/g), (match) => match[1].match(/"([^"]+)"/g) ?? [])
      .flat().map((value) => value.slice(1, -1))),
    String: new Set(Array.from(settingsSource.matchAll(/const strings = \[([\s\S]*?)\];/g), (match) => match[1].match(/"([^"]+)"/g) ?? [])
      .flat().map((value) => value.slice(1, -1)))
  };

  for (const field of formFields) {
    const type = registeredTypes.get(field);
    if (!normalizationLists[type]) continue;
    assert.equal(normalizationLists[type].has(field), true, `${field} is not normalized as ${type}`);
  }
});

test("every TenebreSettings consumer references a registered setting", async () => {
  const scriptDirectory = new URL("../scripts/", import.meta.url);
  const scriptFiles = (await readdir(scriptDirectory)).filter((name) => name.endsWith(".mjs"));
  const consumed = new Set();
  for (const fileName of scriptFiles) {
    const source = await readFile(new URL(fileName, scriptDirectory), "utf8");
    for (const match of source.matchAll(/TenebreSettings\.get\("([^"]+)"\)/g)) consumed.add(match[1]);
  }
  for (const setting of consumed) {
    assert.equal(registered.has(setting), true, `Consumer references unregistered setting: ${setting}`);
  }
});

test("every user-facing setting has a runtime consumer", async () => {
  const scriptDirectory = new URL("../scripts/", import.meta.url);
  const scriptFiles = (await readdir(scriptDirectory)).filter((name) => name.endsWith(".mjs") && name !== "settings.mjs");
  const sources = await Promise.all(scriptFiles.map((fileName) => readFile(new URL(fileName, scriptDirectory), "utf8")));

  for (const setting of registered) {
    if (internalSettings.has(setting)) continue;
    assert.equal(sources.some((source) => source.includes(setting)), true, `Setting has no runtime consumer: ${setting}`);
  }
});

test("recent roll and Ritualist features consume their settings", () => {
  assert.match(rollPrivacySource, /enableRollPrivacy/);
  assert.match(ritualBrowserSource, /enableRitualCatalog/);
  assert.match(sheetSource, /enableRitualCatalog/);
  assert.match(sheetSource, /enableRitualistGrouping/);
});

test("GM log and inventory cleanup settings control their complete lifecycle", () => {
  assert.match(gmLogServiceSource, /enableGmLog/);
  assert.match(gmLogServiceSource, /syncEnabledState/);
  assert.match(gmLogUiSource, /enableGmLog/);
  assert.match(gmLogUiSource, /await this\.#application\.close\(\)/);
  assert.match(inventoryCleanupSource, /enableInventoryCleanup/);
  assert.match(inventoryCleanupSource, /if \(!isInventoryCleanupEnabled\(\)\) return 0/);
});

test("settings changes notify consumers and batch forced sheet renders", () => {
  assert.match(settingsSource, /Hooks\.callAll\(MODULE_ID \+ "\.settingsChanged", key, value\)/);
  assert.match(settingsSource, /"enableRitualistGrouping"[\s\S]*\.includes\(key\)/);
  assert.match(settingsSource, /scheduleOpenSheetRerender\(\{ force: true \}\)/);
  assert.match(settingsSource, /clearTimeout\(pendingSheetRerender\)/);
});
