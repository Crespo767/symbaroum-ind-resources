import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const source = read("scripts/status-effect-picker.mjs");
const settings = read("scripts/settings.mjs");
const template = read("templates/settings.hbs");
const init = read("scripts/init.mjs");
const css = read("styles/symbaroum-ind-resources.css");

globalThis.game = {
  user: { isGM: false },
  i18n: {
    lang: "pt-BR",
    localize: (key) => key,
    format: (key, data) => `${key}:${data.effect ?? data.slot ?? ""}`
  }
};

const {
  StatusEffectPickerService,
  buildAppliedEffectChatContent,
  collectAvailableStatusEffects,
  findFirstEmptyHotbarSlot,
  isEffectActive,
  isAppliedEffectChatEnabled,
  statusEffectValues
} = await import("../scripts/status-effect-picker.mjs");

test("hotbar installation prefers the current page and then any empty slot", () => {
  assert.equal(findFirstEmptyHotbarSlot({}, 3), 21);
  const currentPageFull = Object.fromEntries(Array.from({ length: 10 }, (_value, index) => [String(index + 21), `macro-${index}`]));
  assert.equal(findFirstEmptyHotbarSlot(currentPageFull, 3), 1);
  const full = Object.fromEntries(Array.from({ length: 50 }, (_value, index) => [String(index + 1), `macro-${index}`]));
  assert.equal(findFirstEmptyHotbarSlot(full, 1), null);
});

test("active effects are detected through actor statuses and legacy core flags", () => {
  assert.equal(isEffectActive({ statuses: new Set(["burning"]), effects: [] }, "burning"), true);
  assert.equal(isEffectActive({ statuses: new Set(), effects: [{ flags: { core: { statusId: "blind" } } }] }, "blind"), true);
  assert.equal(isEffectActive({ statuses: new Set(), effects: [] }, "poison"), false);
});

test("the picker consumes the live configured effect list without duplicate IDs", () => {
  const actor = { statuses: new Set(["blind"]), effects: [] };
  const effects = collectAvailableStatusEffects(actor, [
    { id: "blind", name: "Cego", img: "blind.svg" },
    { id: "blind", name: "Duplicado", img: "duplicate.svg" },
    { id: "burning", name: "Em chamas", img: "fire.svg" }
  ]);
  assert.deepEqual(effects.map((effect) => effect.id).sort(), ["blind", "burning"]);
  assert.equal(effects.find((effect) => effect.id === "blind")?.active, true);
});

test("configured effects are normalized from Arrays, Maps and keyed objects", () => {
  const blind = { id: "blind" };
  const burning = { id: "burning" };
  assert.deepEqual(statusEffectValues([blind, burning]), [blind, burning]);
  assert.deepEqual(statusEffectValues(new Map([["blind", blind], ["burning", burning]])), [blind, burning]);
  assert.deepEqual(statusEffectValues({ blind, burning }), [blind, burning]);
});

test("toggling delegates to the public Actor status API with an explicit state", async () => {
  const calls = [];
  const actor = {
    isOwner: true,
    statuses: new Set(),
    effects: [],
    async toggleStatusEffect(...args) { calls.push(args); }
  };
  assert.equal(await StatusEffectPickerService.toggle(actor, "burning"), true);
  assert.deepEqual(calls, [["burning", { active: true, overlay: false }]]);
  actor.statuses.add("burning");
  assert.equal(await StatusEffectPickerService.toggle(actor, "burning"), false);
  assert.deepEqual(calls[1], ["burning", { active: false, overlay: false }]);
});

test("macro installation persists one configured Macro and assigns the first free slot", async () => {
  const created = [];
  const assigned = [];
  globalThis.CONFIG = {
    Macro: {
      documentClass: {
        async create(data) {
          created.push(data);
          return { id: "effect-macro", ...data };
        }
      }
    }
  };
  globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OBSERVER: 2 } };
  globalThis.ui = {
    hotbar: { page: 2 },
    notifications: { info() {}, error() {}, warn() {} }
  };
  globalThis.game.user = {
    isGM: true,
    hotbar: { 11: "occupied" },
    async assignHotbarMacro(macro, slot) { assigned.push([macro.id, slot]); }
  };
  globalThis.game.macros = [];

  const result = await StatusEffectPickerService.installMacro();
  assert.equal(created.length, 1);
  assert.equal(created[0].command, "await game.tenebreResources?.statusEffects?.open?.();");
  assert.equal(created[0].flags["symbaroum-ind-resources"].statusEffectPickerMacro, true);
  assert.deepEqual(assigned, [["effect-macro", 12]]);
  assert.equal(result.slot, 12);
});

test("settings can create the macro and expose the picker through the module API", () => {
  assert.match(template, /tenebre-install-status-effect-macro/);
  assert.match(settings, /StatusEffectPickerService\.installMacro\(\)/);
  assert.match(source, /game\.user\.assignHotbarMacro\(macro, slot\)/);
  assert.match(source, /await game\.tenebreResources\?\.statusEffects\?\.open\?\.\(\);/);
  assert.match(init, /statusEffects: StatusEffectPickerService/);
  assert.match(settings, /register\("showAppliedStatusEffectChatMessages", Boolean, true/);
  assert.match(template, /name="showAppliedStatusEffectChatMessages"/);
});

test("applying a condition can publish a safe descriptive chat card", () => {
  const originalFormat = globalThis.game.i18n.format;
  const originalLocalize = globalThis.game.i18n.localize;
  globalThis.game.i18n.format = (_key, data) => `${data.actor} está sob a condição ${data.effect}.`;
  globalThis.game.i18n.localize = (key) => key === "TENEBRE.StatusEffects.ChatTitle" ? "Condição aplicada" : key;
  try {
    const content = buildAppliedEffectChatContent(
      { name: "Edvard <script>" },
      { id: "blind", name: "Cego", img: "blind.svg", chatDescription: "Sem visão <b>normal</b>." }
    );
    assert.match(content, /tenebre-status-effect-chat/);
    assert.match(content, /Condição aplicada/);
    assert.match(content, /Edvard &lt;script&gt; está sob a condição Cego\./);
    assert.match(content, /Sem visão &lt;b&gt;normal&lt;\/b&gt;\./);
    assert.doesNotMatch(content, /<script>|<b>normal<\/b>/);
  } finally {
    globalThis.game.i18n.format = originalFormat;
    globalThis.game.i18n.localize = originalLocalize;
  }
});

test("the world setting controls condition messages and removals do not publish", () => {
  const originalSettings = globalThis.game.settings;
  globalThis.game.settings = { get: () => false };
  try {
    assert.equal(isAppliedEffectChatEnabled(), false);
  } finally {
    globalThis.game.settings = originalSettings;
  }
  assert.match(source, /if \(active\) \{[\s\S]*?publishAppliedEffectChatMessage/);
  assert.doesNotMatch(source, /if \(!active\) \{[\s\S]*?publishAppliedEffectChatMessage/);
});

test("the visual picker is searchable, namespaced and shows active state", () => {
  const pickerCssStart = css.indexOf("/* Searchable status effect picker opened from the module macro. */");
  const pickerCssEnd = css.indexOf("/* Compact presentation for selected native ability", pickerCssStart);
  const pickerCss = css.slice(pickerCssStart, pickerCssEnd);
  assert.match(source, /CONFIG\?\.statusEffects/);
  assert.match(source, /input type="search"/);
  assert.match(source, /tenebre-effect-picker-card\$\{effect\.active \? " is-active"/);
  assert.match(pickerCss, /\.tenebre-effect-picker-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(pickerCss, /\.tenebre-effect-picker-card\.is-active/);
  assert.doesNotMatch(pickerCss, /#token-hud|\.token-hud/);
});

test("the picker window is resizable while its searchable grid owns vertical scrolling", () => {
  assert.match(source, /classes: \["tenebre-effect-picker-window"\]/);
  assert.match(source, /window:\s*\{[\s\S]*?resizable: true/);
  assert.match(source, /height: position\.height,[\s\S]*?resizable: true/);
  assert.match(source, /class="tenebre-effect-picker-grid" role="list" tabindex="0"/);
  assert.match(source, /grid\.scrollTop = 0/);
  assert.match(css, /\.tenebre-effect-picker-window \.window-content[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*hidden !important;/);
  assert.match(css, /\.tenebre-effect-picker-window \.dialog-form[\s\S]*?flex:\s*1 1 auto;[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;/);
  assert.match(css, /label\.tenebre-effect-picker-search\s*\{[\s\S]*?width:\s*100%;/);
  assert.match(css, /\.tenebre-effect-picker-grid\s*\{[\s\S]*?flex:\s*1 1 0;[\s\S]*?min-height:\s*120px;[\s\S]*?overflow-y:\s*auto;/);
  assert.match(source, /effects\.length \? " hidden" : ""/);
});
