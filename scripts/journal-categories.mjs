// Symbaroum's optional wide journal is still an AppV1 sheet. Use the core
// category documents and configuration window without migrating any journals.
const SHEET_ID = "symbaroum.SymbaroumWide";
const SHEET_CLASS = "tenebre-journal-categories";
const registeredCollections = new WeakSet();

export function journalCategoryGroups(journal, pages) {
  const categories = [...(journal.categories?.contents ?? [])]
    .sort((a, b) => a.sort - b.sort);
  if (!categories.length) return [];
  const groups = categories.map(({ id, name }) => ({ id, name, pages: [] }));
  const byId = new Map(groups.map(group => [group.id, group]));
  const uncategorized = { id: "", name: game.i18n.localize("JOURNAL.Uncategorized"), pages: [] };
  for (const page of pages) (byId.get(page.category) ?? uncategorized).pages.push(page);
  // Native journals show named categories even before their first page.
  // Pages still come exclusively from the native visibility checks.
  return [...groups, ...(uncategorized.pages.length ? [uncategorized] : [])];
}

export function orderedJournalPages(journal, pages) {
  const groups = journalCategoryGroups(journal, pages);
  if (!groups.length) return pages;
  return groups.flatMap(group => group.pages).map((page, number) => ({ ...page, number }));
}

export function renderJournalCategories(root, journal, pages, { searching = false } = {}) {
  const list = root?.querySelector?.(".pages-list .directory-list");
  if (!list) return;
  list.querySelectorAll(".tenebre-journal-category").forEach(node => node.remove());
  const nodes = new Map([...list.querySelectorAll(".directory-item[data-page-id]")]
    .map(node => [node.dataset.pageId, node]));
  let anchor = null;
  for (const group of journalCategoryGroups(journal, pages).reverse()) {
    const members = group.pages.map(page => nodes.get(page._id)).filter(Boolean);
    if (members.length) anchor = members[0];
    const heading = root.ownerDocument.createElement("li");
    heading.className = "tenebre-journal-category";
    heading.dataset.categoryId = group.id;
    heading.textContent = group.name;
    heading.hidden = searching && members.every(node => node.classList.contains("hidden"));
    // A category is not a directory-item: core page search, drag and context
    // menus must never try to resolve it as a JournalEntryPage.
    if (anchor) anchor.before(heading);
    else list.append(heading);
    anchor = heading;
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

    createPage() {
      if (!this.isEditable) return;
      const Page = globalThis.foundry?.documents?.JournalEntryPage?.implementation;
      const StringField = globalThis.foundry?.data?.fields?.StringField;
      if (!Page?.createDialog || !StringField) return super.createPage();
      const { bottom = 200, left = 0 } = (this.element?.[0] ?? this.element)?.getBoundingClientRect?.() ?? {};
      const density = globalThis.CONST?.SORT_INTEGER_DENSITY ?? 100000;
      const sort = Math.max(0, ...Array.from(this.object.pages?.contents ?? [], page => Number(page.sort) || 0)) + density;
      const categories = [...(this.object.categories?.contents ?? [])].sort((a, b) => a.sort - b.sort);
      // Use the same public createDialog API, template and category field as
      // the core AppV2 journal. Core submits the category with the new page.
      return Page.createDialog({ sort }, { parent: this.object }, {
        template: "templates/journal/pages/create-dialog.hbs",
        context: {
          categories: {
            show: categories.length > 0,
            options: [{ value: "", label: "JOURNAL.Uncategorized", rule: true },
              ...categories.map(category => ({ value: category.id, label: category.name }))]
          },
          fields: {
            category: new StringField({ label: "JOURNALENTRYPAGE.Category" }, { name: "category" }),
            name: new StringField({ required: true, blank: false, label: "Name" }, { name: "name" }),
            type: new StringField({ required: true, blank: false, label: "Type" }, { name: "type" })
          }
        },
        position: { width: 320, top: bottom - 200, left: left + 10 }
      });
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
      renderJournalCategories(html[0] ?? html, this.object, this._pages ?? [], {
        searching: Boolean(this._searchFilters?.[0]?.query)
      });
    }

    _onSearchFilter(event, query, rgx, html) {
      super._onSearchFilter(event, query, rgx, html);
      renderJournalCategories(this.element?.[0] ?? this.element, this.object, this._pages ?? [], { searching: Boolean(query) });
    }
  };
}

export class JournalCategoryService {
  static register(NativeSheet) {
    const registration = globalThis.CONFIG?.JournalEntry?.sheetClasses?.base?.[SHEET_ID];
    const BaseSheet = NativeSheet ?? registration?.cls;
    const Journal = globalThis.foundry?.documents?.collections?.Journal;
    if (!BaseSheet || BaseSheet.tenebreJournalCategories || registration?.cls?.tenebreJournalCategories
      || !Journal?.registerSheet || registeredCollections.has(Journal)) return false;
    // A future Symbaroum AppV2 sheet already has native category support.
    if (typeof BaseSheet.prototype._getPageData !== "function") return false;
    if (!globalThis.foundry?.applications?.sheets?.journal?.JournalEntryCategoryConfig) return false;
    Journal.registerSheet("symbaroum", withJournalCategories(BaseSheet), {
      label: registration?.label ?? game.i18n.localize("SYMBAROUM.OPTIONAL_CUSTOMSHEETJOURNAL"),
      // During setup the public API queues this registration after the native
      // system's init registration. Core applies the saved default by sheet ID.
      makeDefault: registration?.default ?? false,
      canBeDefault: registration?.canBeDefault,
      canConfigure: registration?.canConfigure,
      themes: registration?.themes
    });
    registeredCollections.add(Journal);
    return true;
  }
}
