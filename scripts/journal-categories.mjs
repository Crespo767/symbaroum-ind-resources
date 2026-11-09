// Symbaroum's optional wide journal is still an AppV1 sheet. Use the core
// category documents and configuration window without migrating any journals.
const SHEET_ID = "symbaroum.SymbaroumWide";
const SHEET_CLASS = "tenebre-journal-categories";

export function journalCategoryGroups(journal, pages) {
  const categories = [...(journal.categories?.contents ?? [])]
    .sort((a, b) => a.sort - b.sort);
  if (!categories.length) return [];
  const groups = categories.map(({ id, name }) => ({ id, name, pages: [] }));
  const byId = new Map(groups.map(group => [group.id, group]));
  const uncategorized = { id: "", name: game.i18n.localize("JOURNAL.Uncategorized"), pages: [] };
  for (const page of pages) (byId.get(page.category) ?? uncategorized).pages.push(page);
  // Only group pages already admitted by the native visibility checks.
  return [...groups, uncategorized].filter(group => group.pages.length);
}

export function orderedJournalPages(journal, pages) {
  const groups = journalCategoryGroups(journal, pages);
  if (!groups.length) return pages;
  return groups.flatMap(group => group.pages).map((page, number) => ({ ...page, number }));
}

export function renderJournalCategories(root, journal, pages) {
  const list = root?.querySelector?.(".pages-list .directory-list");
  if (!list) return;
  list.querySelectorAll(".tenebre-journal-category").forEach(node => node.remove());
  const nodes = new Map([...list.querySelectorAll(".directory-item[data-page-id]")]
    .map(node => [node.dataset.pageId, node]));
  for (const group of journalCategoryGroups(journal, pages)) {
    const members = group.pages.map(page => nodes.get(page._id)).filter(Boolean);
    if (!members.length) continue;
    const heading = root.ownerDocument.createElement("li");
    heading.className = "tenebre-journal-category";
    heading.textContent = group.name;
    heading.hidden = members.every(node => node.classList.contains("hidden"));
    // A category is not a directory-item: core page search, drag and context
    // menus must never try to resolve it as a JournalEntryPage.
    members[0].before(heading);
  }
}

export function withJournalCategories(BaseSheet) {
  // Retain the registered class name so existing core.sheetClass flags and
  // the world's default sheet preference continue to select the same sheet.
  return class SymbaroumWide extends BaseSheet {
    static tenebreJournalCategories = true;

    static _getInheritanceChain() {
      // AppV1 dispatches hooks by class name. Keeping the saved sheet ID
      // must not cause the two SymbaroumWide classes to emit the same hook.
      return super._getInheritanceChain().filter(cls => cls !== BaseSheet || cls.name !== this.name);
    }

    static get defaultOptions() {
      const options = super.defaultOptions;
      return { ...options, classes: [...options.classes, SHEET_CLASS] };
    }

    _getPageData() {
      return orderedJournalPages(this.object, super._getPageData());
    }

    _getHeaderButtons() {
      const buttons = super._getHeaderButtons();
      const CategoryConfig = globalThis.foundry?.applications?.sheets?.journal?.JournalEntryCategoryConfig;
      if (this.isEditable && this.object.categories && CategoryConfig) {
        buttons.unshift({
          label: "JOURNAL.ConfigureCategories",
          class: "tenebre-configure-journal-categories",
          icon: "fa-solid fa-layer-group",
          onclick: event => {
            event.preventDefault();
            if (this.isEditable) return new CategoryConfig({ document: this.object }).render({ force: true });
          }
        });
      }
      return buttons;
    }

    activateListeners(html) {
      super.activateListeners(html);
      renderJournalCategories(html[0] ?? html, this.object, this._pages ?? []);
    }

    _onSearchFilter(event, query, rgx, html) {
      super._onSearchFilter(event, query, rgx, html);
      renderJournalCategories(this.element?.[0] ?? this.element, this.object, this._pages ?? []);
    }
  };
}

export class JournalCategoryService {
  static register() {
    const registration = globalThis.CONFIG?.JournalEntry?.sheetClasses?.base?.[SHEET_ID];
    const BaseSheet = registration?.cls;
    const Journal = globalThis.foundry?.documents?.collections?.Journal;
    if (!BaseSheet || BaseSheet.tenebreJournalCategories || !Journal?.registerSheet) return false;
    // A future Symbaroum AppV2 sheet already has native category support.
    if (typeof BaseSheet.prototype._getPageData !== "function") return false;
    if (!globalThis.foundry?.applications?.sheets?.journal?.JournalEntryCategoryConfig) return false;
    Journal.registerSheet("symbaroum", withJournalCategories(BaseSheet), {
      label: registration.label,
      makeDefault: registration.default,
      canBeDefault: registration.canBeDefault,
      canConfigure: registration.canConfigure,
      themes: registration.themes
    });
    return true;
  }
}
