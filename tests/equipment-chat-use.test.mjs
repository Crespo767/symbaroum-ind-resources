import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const itemUse = fs.readFileSync(path.join(root, "scripts", "chat-item-use.mjs"), "utf8");
const settingsTemplate = fs.readFileSync(path.join(root, "templates", "settings.hbs"), "utf8");

assert.match(itemUse, /isEquipment:\s*item\.type === "equipment" \|\| item\.system\?\.isEquipment === true/, "Equipment use messages must carry stable type metadata");
assert.match(itemUse, /!ContainerService\.isContainer\(item\)/, "Containers must not be sent as used equipment");
assert.match(itemUse, /const CHAT_ITEM_USE_PAUSED = true;/, "Extended item chat use must remain paused");
assert.match(itemUse, /this\.isEnabled\(\)[\s\S]*item\?\.isOwned/, "Paused item chat use must be rejected before an item can be sent");
assert.doesNotMatch(settingsTemplate, /name="enableChatItemUse"/, "The paused feature must not expose a misleading settings control");
