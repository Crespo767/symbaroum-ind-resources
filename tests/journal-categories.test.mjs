import assert from "node:assert/strict";
import test from "node:test";
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
    ["Personagens", ["npc2", "npc1"]], ["Locais", ["town"]], ["Sem categoria", ["intro", "orphan"]]
  ]);
  assert.equal(JSON.stringify({ categories, pages }), original, "rendering must not mutate persisted documents");
});

test("empty journals and categories without visible pages expose no headings", () => {
  assert.deepEqual(journalCategoryGroups(journal, []), []);
  const visible = pages.filter(p => p._id === "town");
  assert.deepEqual(journalCategoryGroups(journal, visible).map(g => g.name), ["Locais"]);
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

function sidebar() {
  const nodes = [];
  const root = {
    ownerDocument: { createElement() { return {
      remove() { nodes.splice(nodes.indexOf(this), 1); }
    }; } },
    querySelector() { return list; }
  };
  const list = { querySelectorAll(selector) {
    return nodes.filter(n => selector === ".tenebre-journal-category"
      ? n.className === "tenebre-journal-category" : n.dataset?.pageId);
  } };
  for (const page of orderedJournalPages(journal, pages)) {
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
  assert.equal(headings.length, 3);
  assert.equal(headings[0].textContent, "<img src=x onerror=bad()>Personagens");
  assert.equal(headings[0].innerHTML, undefined);
  assert.equal(headings[0].dataset, undefined);
  assert.equal(nodes[1].dataset.pageId, "npc2");
});

test("search hides only categories with no matching pages, restoring them when cleared", () => {
  const { root, nodes } = sidebar();
  for (const node of nodes) node.filtered = node.dataset.pageId !== "town";
  renderJournalCategories(root, journal, pages);
  assert.deepEqual(nodes.filter(n => n.className).map(n => [n.textContent, n.hidden]), [
    ["Personagens", true], ["Locais", false], ["Sem categoria", true]
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
