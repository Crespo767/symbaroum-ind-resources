import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  JournalCategoryService, journalCategoryGroups, orderedJournalPages,
  renderJournalCategories, withJournalCategories
} from "../scripts/journal-categories.mjs";

const categories = [
  { id: "places", name: "Locais", sort: 200 },
  { id: "people", name: "Personagens", sort: 100 },
  { id: "secrets", name: "Segredos", sort: 300 }
];
const pages = [
  { _id: "town", category: "places", number: 0 },
  { _id: "intro", category: null, number: 1 },
  { _id: "npc2", category: "people", number: 2 },
  { _id: "npc1", category: "people", number: 3 },
  { _id: "orphan", category: "deleted", number: 4 }
];
const journal = { categories: { contents: categories } };

test.beforeEach(() => {
  globalThis.game = { i18n: { localize: key => key === "JOURNAL.Uncategorized" ? "Sem categoria" : key } };
});
test.afterEach(() => {
  delete globalThis.game;
  delete globalThis.foundry;
  delete globalThis.CONFIG;
});

test("categories follow their saved order, preserve page order and retain orphan pages", () => {
  const original = JSON.stringify({ categories, pages });
  const groups = journalCategoryGroups(journal, pages);
  assert.deepEqual(groups.map(g => [g.name, g.pages.map(p => p._id)]), [
    ["Personagens", ["npc2", "npc1"]], ["Locais", ["town"]], ["Segredos", []], ["Sem categoria", ["intro", "orphan"]]
  ]);
  assert.equal(JSON.stringify({ categories, pages }), original, "rendering must not mutate persisted documents");
});

test("categories appear immediately even in a journal without pages", () => {
  assert.deepEqual(journalCategoryGroups(journal, []).map(g => [g.name, g.pages]), [
    ["Personagens", []], ["Locais", []], ["Segredos", []]
  ]);
  const visible = pages.filter(p => p._id === "town");
  const groups = journalCategoryGroups(journal, visible);
  assert.deepEqual(groups.map(g => g.name), ["Personagens", "Locais", "Segredos"]);
  assert.deepEqual(groups.flatMap(g => g.pages).map(p => p._id), ["town"], "native page visibility is still respected");
});

test("journals without categories keep the original native page data", () => {
  for (const entry of [{}, { categories: { contents: [] } }]) {
    assert.equal(orderedJournalPages(entry, pages), pages);
    assert.deepEqual(journalCategoryGroups(entry, pages), []);
  }
});

test("grouped page data has consistent indexes for native previous/next navigation", () => {
  const ordered = orderedJournalPages(journal, pages);
  assert.deepEqual(ordered.map(p => p._id), ["npc2", "npc1", "town", "intro", "orphan"]);
  assert.deepEqual(ordered.map(p => p.number), [0, 1, 2, 3, 4]);
  assert.equal(pages[0].number, 0);
});

class LegacySheet {
  static options = { classes: ["symbaroum-mod", "journal-sheet"], width: 1268 };
  static get defaultOptions() { return this.options; }
  constructor() {
    this.object = journal;
    this.isEditable = true;
  }
  _getPageData() { return pages.filter(p => p._id !== "npc1"); }
  _getHeaderButtons() { return [{ class: "share-image" }, { class: "configure-sheet" }]; }
  activateListeners() { this.listenersActivated = true; }
  _onSearchFilter() { this.nativeSearchCalled = true; }
  createPage() { return "legacy-create-dialog"; }
}

function core() {
  const opened = [];
  globalThis.foundry = {
    applications: { sheets: { journal: { JournalEntryCategoryConfig: class {
      constructor(options) { opened.push(options); }
      render(options) { opened.push(options); return this; }
    } } } },
    documents: { collections: { Journal: { registerSheet(scope, cls, options) {
      const id = `${scope}.${cls.name}`;
      CONFIG.JournalEntry.sheetClasses.base[id] = { cls, label: options.label, default: options.makeDefault };
      opened.push({ id, cls, options });
    } } } }
  };
  return opened;
}

test("wide sheet retains native styling and only groups pages admitted by native permission checks", () => {
  const Sheet = withJournalCategories(LegacySheet);
  assert.equal(Sheet.name, "SymbaroumWide");
  assert.equal(Sheet.defaultOptions.width, 1268);
  assert.deepEqual(Sheet.defaultOptions.classes, ["symbaroum-mod", "journal-sheet", "tenebre-journal-categories"]);
  assert.deepEqual(LegacySheet.options.classes, ["symbaroum-mod", "journal-sheet"]);
  assert.deepEqual(new Sheet()._getPageData().map(p => p._id), ["npc2", "town", "intro", "orphan"]);
});

test("preserving the sheet name must not dispatch native render and header hooks twice", () => {
  const NativeSheet = class SymbaroumWide extends LegacySheet {
    static _getInheritanceChain() { return [this, NativeSheet, LegacySheet]; }
  };
  const Sheet = withJournalCategories(NativeSheet);
  assert.deepEqual(Sheet._getInheritanceChain().map(cls => cls.name), ["SymbaroumWide", "LegacySheet"]);
});

test("GM and player owners open the native category editor on the existing document", () => {
  for (const role of ["GM", "PLAYER", "TRUSTED"]) {
    const opened = core();
    game.user = { role };
    const sheet = new (withJournalCategories(LegacySheet))();
    const buttons = sheet._getHeaderButtons();
    assert.equal(buttons.length, 3);
    let prevented = false;
    buttons[0].onclick({ preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.deepEqual(opened, [{ document: journal }, { force: true }]);
    assert.deepEqual(buttons.slice(1), [{ class: "share-image" }, { class: "configure-sheet" }]);
  }
});

test("observer, non-owner, locked compendium and read-only sheet cannot configure categories", () => {
  const opened = core();
  for (const role of ["observer", "non-owner", "locked-compendium", "read-only"]) {
    const sheet = new (withJournalCategories(LegacySheet))();
    sheet.isEditable = false; // Native sheet getter combines ownership, pack lock and options.
    assert.equal(sheet._getHeaderButtons().length, 2, role);
  }
  assert.deepEqual(opened, []);
});

test("losing edit permission after render prevents opening the category configuration", () => {
  const opened = core();
  const sheet = new (withJournalCategories(LegacySheet))();
  const button = sheet._getHeaderButtons()[0];
  sheet.isEditable = false;
  button.onclick({ preventDefault() {} });
  assert.deepEqual(opened, []);
});

test("missing core category support leaves the native header intact", () => {
  assert.equal(new (withJournalCategories(LegacySheet))()._getHeaderButtons().length, 2);
});

test("create page uses the native category form and persists the selected category on creation", async () => {
  core();
  foundry.data = { fields: { StringField: class {
    constructor(options, context) { Object.assign(this, options, context); }
  } } };
  const calls = [];
  foundry.documents.JournalEntryPage = { implementation: { createDialog: async (data, options, dialog) => {
    calls.push({ data, options, dialog });
    // The native createDialog merges these submitted fields before creating.
    return { ...data, name: "Nova página", type: "text", category: "places" };
  } } };
  const sheet = new (withJournalCategories(LegacySheet))();
  sheet.object = { ...journal, pages: { contents: [{ sort: 500000 }, { sort: 100000 }] } };
  sheet.element = [{ getBoundingClientRect: () => ({ bottom: 900, left: 300 }) }];
  sheet._pages = [{ sort: 500000 }, { sort: 100000 }];
  const created = await sheet.createPage();
  assert.equal(calls.length, 1);
  const { data, options, dialog } = calls[0];
  assert.deepEqual(data, { sort: 600000 });
  assert.equal(options.parent, sheet.object);
  assert.equal(dialog.template, "templates/journal/pages/create-dialog.hbs");
  assert.equal(dialog.context.categories.show, true);
  assert.deepEqual(dialog.context.categories.options.map(c => c.value), ["", "people", "places", "secrets"]);
  assert.equal(dialog.context.fields.category.name, "category");
  assert.equal(dialog.context.fields.category.label, "JOURNALENTRYPAGE.Category");
  assert.equal(created.category, "places");
});

test("create page falls back to the original method when the native category form API is unavailable", () => {
  const sheet = new (withJournalCategories(LegacySheet))();
  assert.equal(sheet.createPage(), "legacy-create-dialog");
});

test("create page hides the category field without categories and passes cancellation through", async () => {
  core();
  foundry.data = { fields: { StringField: class {} } };
  let request;
  foundry.documents.JournalEntryPage = { implementation: { createDialog: async (...args) => {
    request = args;
    return null;
  } } };
  const sheet = new (withJournalCategories(LegacySheet))();
  sheet.object = { categories: { contents: [] }, pages: { contents: [] } };
  assert.equal(await sheet.createPage(), null);
  assert.equal(request[0].sort, 100000);
  assert.equal(request[2].context.categories.show, false);
});

test("page creation preserves the native API failure instead of retrying a second creation", async () => {
  core();
  foundry.data = { fields: { StringField: class {} } };
  let attempts = 0;
  foundry.documents.JournalEntryPage = { implementation: { createDialog: async () => {
    attempts++;
    throw new Error("Creation denied");
  } } };
  const sheet = new (withJournalCategories(LegacySheet))();
  await assert.rejects(sheet.createPage(), /Creation denied/);
  assert.equal(attempts, 1);
});

test("create page cannot bypass read-only ownership or compendium restrictions", () => {
  const sheet = new (withJournalCategories(LegacySheet))();
  sheet.isEditable = false;
  assert.equal(sheet.createPage(), undefined);
});

test("registration keeps existing sheet ID, label and default and runs only once", () => {
  const opened = core();
  const other = { cls: class OtherSheet {}, default: false };
  globalThis.CONFIG = { JournalEntry: { sheetClasses: { base: {
    "symbaroum.SymbaroumWide": { cls: LegacySheet, label: "Symbaroum", default: true },
    "other.OtherSheet": other
  } } } };
  assert.equal(JournalCategoryService.register(), true);
  assert.equal(JournalCategoryService.register(), false);
  assert.equal(opened.length, 1);
  assert.equal(opened[0].id, "symbaroum.SymbaroumWide");
  assert.equal(opened[0].options.makeDefault, true);
  assert.equal(opened[0].options.label, "Symbaroum");
  assert.equal(CONFIG.JournalEntry.sheetClasses.base["other.OtherSheet"], other);
});

test("registration leaves native AppV2 sheets, missing system and missing category API alone", () => {
  const opened = core();
  assert.equal(JournalCategoryService.register(), false);
  globalThis.CONFIG = { JournalEntry: { sheetClasses: { base: {
    "symbaroum.SymbaroumWide": { cls: class AppV2Sheet {} }
  } } } };
  assert.equal(JournalCategoryService.register(), false);
  CONFIG.JournalEntry.sheetClasses.base["symbaroum.SymbaroumWide"].cls = LegacySheet;
  delete foundry.applications.sheets.journal.JournalEntryCategoryConfig;
  assert.equal(JournalCategoryService.register(), false);
  assert.deepEqual(opened, []);
});

const initSource = readFileSync(new URL("../scripts/init.mjs", import.meta.url), "utf8");
const setupBody = initSource.match(/Hooks\.once\("setup", \(\) => \{([\s\S]*?)\n\}\);/)[1];
const runSetup = new Function("JournalCategoryService", "NativeSymbaroumWide", "game", "exposePublicApi", setupBody);

function queuedCore(defaultId) {
  core();
  game.ready = false;
  game.system = { id: "symbaroum" };
  globalThis.CONFIG = { JournalEntry: {} }; // Sheet registry is not populated during setup.
  const NativeSheet = class SymbaroumWide extends LegacySheet {};
  const OtherSheet = class OtherSheet extends LegacySheet {};
  const pending = [];
  foundry.documents.collections.Journal.registerSheet = (scope, cls, options) => {
    pending.push({ id: `${scope}.${cls.name}`, cls, ...options });
  };
  // System init precedes module setup. Core applies this queue before ready.
  foundry.documents.collections.Journal.registerSheet("core", OtherSheet, { makeDefault: true });
  foundry.documents.collections.Journal.registerSheet("symbaroum", NativeSheet, { makeDefault: false });
  return {
    NativeSheet, OtherSheet, pending,
    setup() { runSetup(JournalCategoryService, NativeSheet, game, () => {}); },
    initializeSheets() {
      const registry = CONFIG.JournalEntry.sheetClasses = { base: {} };
      for (const entry of pending) {
        const isDefault = defaultId ? defaultId === entry.id : Boolean(entry.makeDefault);
        if (isDefault) Object.values(registry.base).forEach(sheet => { sheet.default = false; });
        registry.base[entry.id] = { cls: entry.cls, default: isDefault };
      }
    }
  };
}

test("setup registers categories before the first journal sheet is constructed, including pre-ready access", () => {
  const lifecycle = queuedCore("symbaroum.SymbaroumWide");
  lifecycle.setup();
  lifecycle.initializeSheets();
  const entry = { categories: journal.categories, pages };
  const original = JSON.stringify(entry);
  const Sheet = CONFIG.JournalEntry.sheetClasses.base["symbaroum.SymbaroumWide"].cls;
  const firstSheet = new Sheet();
  firstSheet.object = entry;
  assert.equal(game.ready, false);
  assert.equal(firstSheet.constructor.tenebreJournalCategories, true);
  assert(Sheet.defaultOptions.classes.includes("tenebre-journal-categories"));
  assert.equal(firstSheet._getHeaderButtons()[0].class, "tenebre-configure-journal-categories");
  assert.equal(JSON.stringify(entry), original);
  assert.equal(entry.categories, journal.categories);
});

test("queued registration preserves saved native and other default sheets without changing their IDs", () => {
  for (const defaultId of [undefined, "symbaroum.SymbaroumWide", "core.OtherSheet"]) {
    const lifecycle = queuedCore(defaultId);
    lifecycle.setup();
    lifecycle.initializeSheets();
    const registry = CONFIG.JournalEntry.sheetClasses.base;
    assert.deepEqual(Object.keys(registry), ["core.OtherSheet", "symbaroum.SymbaroumWide"]);
    assert.equal(registry["core.OtherSheet"].cls, lifecycle.OtherSheet);
    assert.equal(registry["symbaroum.SymbaroumWide"].default, defaultId === "symbaroum.SymbaroumWide");
    assert.equal(registry["core.OtherSheet"].default, defaultId !== "symbaroum.SymbaroumWide");
  }
});

test("registration is idempotent while core has not applied pending sheet registrations", () => {
  const lifecycle = queuedCore();
  lifecycle.setup();
  lifecycle.setup();
  assert.equal(lifecycle.pending.length, 3);
  assert.equal(CONFIG.JournalEntry.sheetClasses, undefined);
});

test("setup does not register a Symbaroum sheet for another system", () => {
  const lifecycle = queuedCore();
  game.system.id = "another-system";
  lifecycle.setup();
  assert.equal(lifecycle.pending.length, 2);
});

test("startup registration never enumerates world journals or cached compendium documents", () => {
  const lifecycle = queuedCore();
  for (const key of ["journal", "packs"]) {
    Object.defineProperty(game, key, { get() { throw new Error(`Unexpected access to ${key}`); } });
  }
  lifecycle.setup();
  assert.equal(lifecycle.pending.length, 3);
});

test("native constructor is awaited before lifecycle hooks and registration has no late repair path", () => {
  const load = initSource.indexOf("await import(");
  assert(load > 0 && load < initSource.indexOf('Hooks.once("init"'));
  const moduleUrl = new URL("https://example.test/foundry/modules/symbaroum-ind-resources/scripts/init.mjs");
  const relativeUrl = initSource.match(/new URL\("([^"]+systems\/symbaroum[^\"]+)", import\.meta\.url\)/)[1];
  assert.equal(new URL(relativeUrl, moduleUrl).href, "https://example.test/foundry/systems/symbaroum/script/sheet/journal.js");
  const serviceSource = readFileSync(new URL("../scripts/journal-categories.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(initSource + serviceSource, /refreshCachedSheets|_onSheetChange/);
  assert.equal((initSource.match(/JournalCategoryService\.register\(/g) ?? []).length, 1);
});

function sidebar(visiblePages = pages) {
  const nodes = [];
  const root = {
    ownerDocument: { createElement() { return {
      dataset: {},
      remove() { nodes.splice(nodes.indexOf(this), 1); },
      before(node) { nodes.splice(nodes.indexOf(this), 0, node); }
    }; } },
    querySelector() { return list; }
  };
  const list = {
    querySelectorAll(selector) {
      return nodes.filter(n => selector === ".tenebre-journal-category"
        ? n.className === "tenebre-journal-category" : n.dataset?.pageId);
    },
    append(node) { nodes.push(node); }
  };
  for (const page of orderedJournalPages(journal, visiblePages)) {
    nodes.push({
      dataset: { pageId: page._id },
      filtered: false,
      classList: { contains() { return nodes.find(n => n.dataset?.pageId === page._id).filtered; } },
      before(heading) { nodes.splice(nodes.indexOf(this), 0, heading); }
    });
  }
  return { root, nodes };
}

test("sidebar refresh inserts safe category headings without duplicating them or treating them as pages", () => {
  const { root, nodes } = sidebar();
  const entry = { categories: { contents: categories.map(c => ({ ...c, name: `<img src=x onerror=bad()>${c.name}` })) } };
  renderJournalCategories(root, entry, pages);
  renderJournalCategories(root, entry, pages);
  const headings = nodes.filter(n => n.className === "tenebre-journal-category");
  assert.equal(headings.length, 4);
  assert.equal(headings[0].textContent, "<img src=x onerror=bad()>Personagens");
  assert.equal(headings[0].innerHTML, undefined);
  assert.deepEqual(headings[0].dataset, { categoryId: "people" });
  assert.equal(nodes[1].dataset.pageId, "npc2");
});

test("empty category headings keep their saved order before, between and after populated categories", () => {
  const { root, nodes } = sidebar(pages.filter(p => p._id === "town"));
  renderJournalCategories(root, journal, pages.filter(p => p._id === "town"));
  assert.deepEqual(nodes.map(n => n.textContent ?? n.dataset.pageId), ["Personagens", "Locais", "town", "Segredos"]);
  assert.equal(nodes.some(n => n.hidden), false);
});

test("all named category headings are rendered when the journal has no pages", () => {
  const { root, nodes } = sidebar([]);
  renderJournalCategories(root, journal, []);
  renderJournalCategories(root, journal, []);
  assert.deepEqual(nodes.map(n => n.textContent), ["Personagens", "Locais", "Segredos"]);
});

test("search hides only categories with no matching pages, restoring them when cleared", () => {
  const { root, nodes } = sidebar();
  for (const node of nodes) node.filtered = node.dataset.pageId !== "town";
  renderJournalCategories(root, journal, pages, { searching: true });
  assert.deepEqual(nodes.filter(n => n.className).map(n => [n.textContent, n.hidden]), [
    ["Personagens", true], ["Locais", false], ["Segredos", true], ["Sem categoria", true]
  ]);
  for (const node of nodes.filter(n => n.dataset)) node.filtered = false;
  renderJournalCategories(root, journal, pages);
  assert.equal(nodes.filter(n => n.className).some(n => n.hidden), false);
});

test("native listeners and native search are preserved, even without a rendered sidebar", () => {
  const sheet = new (withJournalCategories(LegacySheet))();
  sheet.activateListeners([{}]);
  sheet._onSearchFilter(null, "", null, {});
  assert.equal(sheet.listenersActivated, true);
  assert.equal(sheet.nativeSearchCalled, true);
  renderJournalCategories(null, journal, pages);
});
