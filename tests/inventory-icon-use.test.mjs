import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "scripts", "sheet-ui.mjs"), "utf8");

assert.match(
  source,
  /\.gear \.item-row\.item\[data-item-id\] \.image-container > \.image/,
  "Item use must include inventory icons"
);
const inventoryWire = source.slice(
  source.indexOf("function wireInventoryItemIconUse"),
  source.indexOf("function wireContainerLeftClickToggle")
);
assert.doesNotMatch(
  inventoryWire,
  /\.item-edit/,
  "Inventory names must retain the native View/Edit behavior"
);
assert.match(
  inventoryWire,
  /!ContainerService\.isContainer\(item\)/,
  "Container icons must never enter the generic item-use flow"
);
assert.match(source, /ChatItemUseService\.send\(actor, item\)/, "Item icons must use the existing item service");
assert.match(source, /control\.addEventListener\("keydown"/, "Non-native inventory controls must remain keyboard accessible");

const containerWire = source.slice(
  source.indexOf("function wireContainerLeftClickToggle"),
  source.indexOf("function wireContainerDragDrop")
);
assert.match(containerWire, /\.item-edit, \.image-container > \.image/, "Container names and icons must share the toggle behavior");
assert.match(containerWire, /ContainerService\.toggleContainer\(actor, item\)/, "Container clicks must expand or collapse the container");
assert.match(containerWire, /event\.stopImmediatePropagation\(\)/, "Container clicks must not reach the native View/Edit or item-use handlers");

const ritualItem = source.slice(
  source.indexOf("function buildRitualistItem"),
  source.indexOf("function wireChatItemUseIconFallback")
);
assert.match(ritualItem, /tenebre-ritualist-use/, "Grouped rituals must expose a use icon");
assert.match(ritualItem, /ChatItemUseService\.send\(actor, ritual\)/, "Grouped ritual icons must use the ritual");
assert.match(ritualItem, /tenebre-ritualist-name/, "Grouped rituals must expose a separate name control");
assert.match(ritualItem, /ritual\.sheet\?\.render\(true\)/, "Grouped ritual names must open View/Edit");

const storedItem = source.slice(
  source.indexOf("function buildContainerInlineItem"),
  source.indexOf("function rerenderActorSheets")
);
assert.match(storedItem, /tenebre-container-item-use/, "Stored item images must expose the item-use interaction");
assert.match(storedItem, /ChatItemUseService\.send\(actor, item\)/, "Stored item images must use the existing item service");
assert.match(storedItem, /ChatItemUseService\.canSend\(item\)/, "Stored containers must remain protected by the item service guard");
assert.match(storedItem, /tenebre-container-name-open/, "Stored item names must expose View/Edit");
assert.match(storedItem, /item\.sheet\?\.render\(true\)/, "Stored item names must open View/Edit");
assert.match(storedItem, /img\.addEventListener\("keydown"/, "Stored item images must remain keyboard accessible");
assert.match(storedItem, /name\.addEventListener\("keydown"/, "Stored item names must remain keyboard accessible");
assert.match(storedItem, /ContainerService\.withdrawItem\(actor, item\)/, "Withdraw must move the full stored stack without a prompt");

const storedContextMenu = source.slice(
  source.indexOf("function bindStoredItemContextMenu"),
  source.indexOf("function rerenderActorSheets")
);
assert.match(storedContextMenu, /TENEBRE\.Containers\.Split/, "Stored stacks must expose the Split context action");
assert.match(storedContextMenu, /itemQuantity\(item\) > 1/, "Split must only be offered for divisible stacks");
assert.match(storedContextMenu, /ContainerService\.splitItemPrompt\(actor, item\)/, "Split must use the quantity prompt");

console.log("inventory icon use tests passed");
