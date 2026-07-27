import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const movementSource = await readFile(new URL("../scripts/movement-ruler.mjs", import.meta.url), "utf8");
const initSource = await readFile(new URL("../scripts/init.mjs", import.meta.url), "utf8");
const sheetSource = await readFile(new URL("../scripts/sheet-ui.mjs", import.meta.url), "utf8");
const encumbranceSource = await readFile(new URL("../scripts/encumbrance.mjs", import.meta.url), "utf8");
const ammoSource = await readFile(new URL("../scripts/ammo.mjs", import.meta.url), "utf8");

test("movement validation uses the public synchronous preMoveToken hook", () => {
  assert.match(movementSource, /Hooks\.on\("preMoveToken"/);
  assert.doesNotMatch(movementSource, /_preUpdateMovement/);
  assert.doesNotMatch(movementSource, /Hooks\.on\("preMoveToken",\s*async/);
});

test("movement ruler is installed during init before tokens are drawn", () => {
  const initHook = initSource.match(/Hooks\.once\("init",[\s\S]*?\n}\);/)?.[0] ?? "";
  const readyHook = initSource.match(/Hooks\.once\("ready",[\s\S]*?\n}\);/)?.[0] ?? "";

  assert.match(initHook, /CompatibilityService\.register\(\);[\s\S]*MovementService\.register\(\);/);
  assert.doesNotMatch(readyHook, /MovementService\.register\(\);/);
  assert.doesNotMatch(movementSource, /static register\(\) \{\s*if \(!TenebreSettings\.get\("enableMovementRuler"\)\) return;/);
});

test("sheet UI does not register redundant V1 inheritance render hooks", () => {
  assert.doesNotMatch(sheetSource, /ACTOR_SHEET_HOOKS|ITEM_SHEET_HOOKS/);
  assert.doesNotMatch(sheetSource, /Hooks\.on\("renderApplication"/);
  assert.match(sheetSource, /Hooks\.on\("renderApplicationV2"/);
});

test("actor header controls are restricted to registered Symbaroum actor sheets", () => {
  const renderHandler = sheetSource.match(/function onRenderApplicationV2[\s\S]*?\n}/)?.[0] ?? "";
  const headerSync = sheetSource.match(/function syncActorSheetHeaderButtons[\s\S]*?\n}/)?.[0] ?? "";

  assert.match(renderHandler, /isSymbaroumActorSheetApplication\(app\)/);
  assert.doesNotMatch(renderHandler, /app\.actor \?\? app\.item \?\? app\.document/);
  assert.match(headerSync, /if \(!isSymbaroumActorSheetApplication\(app\)\) return/);
  assert.match(sheetSource, /app instanceof SheetClass/);
});

test("actor header controls use a single DOM injection path", () => {
  assert.doesNotMatch(sheetSource, /_getHeaderButtons/);
  assert.doesNotMatch(sheetSource, /patchPlayerSheetHeaderButtons/);
  assert.equal((sheetSource.match(/RestService\.openRestDialog\(actor\)/g) ?? []).length, 1);
});

test("encumbrance indicator renders for non-owner player sheets", () => {
  const actorRenderHandler = sheetSource.match(/function onRenderActorSheet[\s\S]*?[\r\n]}[\r\n]+function injectWeaponReadinessControls/)?.[0] ?? "";
  const nonOwnerBranch = actorRenderHandler.match(/if \(!canControlSheetResources\) \{[\s\S]*?[\r\n]  \}/)?.[0] ?? "";

  assert.match(actorRenderHandler, /const canControlSheetResources = actor\.isOwner \|\| game\.user\.isGM;/);
  assert.doesNotMatch(actorRenderHandler, /if \(!actor\.isOwner && !game\.user\.isGM\) return;/);
  assert.match(nonOwnerBranch, /injectEncumbrancePanel\(app, html, actor\);/);
  assert.doesNotMatch(nonOwnerBranch, /hideStoredItemRows|wireContainerDragDrop|injectWeaponReadinessControls|wireInventoryItemIconUse/);
});

test("ration display renders in read-only player sheets without consolidation writes", () => {
  const actorRenderHandler = sheetSource.match(/function onRenderActorSheet[\s\S]*?[\r\n]}[\r\n]+function injectWeaponReadinessControls/)?.[0] ?? "";
  const nonOwnerBranch = actorRenderHandler.match(/if \(!canControlSheetResources\) \{[\s\S]*?[\r\n]  \}/)?.[0] ?? "";
  const rationDisplay = sheetSource.match(/function updateRationQuantityDisplay[\s\S]*?[\r\n]}[\r\n]+[\r\n]function hasActorEffects/)?.[0] ?? "";

  assert.match(nonOwnerBranch, /updateRationQuantityDisplay\(app, html, actor, \{ readOnly: true \}\);/);
  assert.match(rationDisplay, /\{ readOnly = false \} = \{\}/);
  assert.match(rationDisplay, /if \(!readOnly && RationService\.needsConsolidation\(actor\)\) \{/);
});

test("encumbrance weight watcher is stoppable and overlap guarded", () => {
  assert.match(encumbranceSource, /dynamicWeightFileWatcherBusy/);
  assert.match(encumbranceSource, /stopDynamicWeightFileWatcher/);
  assert.match(encumbranceSource, /clearInterval\(dynamicWeightFileWatcher\)/);
});


test("ammunition provenance uses compendiumSource instead of deprecated core.sourceId APIs", () => {
  const sources = [sheetSource, ammoSource].join("\n");
  assert.doesNotMatch(sources, /getFlag\?\.\("core", "sourceId"\)/);
  assert.doesNotMatch(sources, /flags\.core\s*=\s*\{\s*sourceId:/);
  assert.match(ammoSource, /_stats\s*=\s*\{\s*compendiumSource:/);
});
