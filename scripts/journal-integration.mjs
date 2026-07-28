import { FLAG_SCOPE, MODULE_ID } from "./constants.mjs";

const TEXT_FORMAT_HTML = 1;
const OWNERSHIP = {
  NONE: 0,
  OBSERVER: 2,
  OWNER: 3
};

const DEFAULT_FOLDER_ROOT = "Tenebre Journals";
const DEFAULT_MANIFEST_PATH = `modules/${MODULE_ID}/data/journal-import-manifest.json`;
const SYMBAROUM_JOURNAL_SHEET = "symbaroum.SymbaroumWide";
const JOURNAL_FORMAT_VERSION = 2;
const LEGACY_SOURCE_FOLDERS = new Set(["Symbaroumlore", "Tenebre Chronicle"]);

export class JournalIntegrationService {
  static async loadManifest(path = DEFAULT_MANIFEST_PATH) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Could not load journal manifest from ${path}: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  static validateManifest(manifest) {
    return validateJournalManifest(manifest);
  }

  static async dryRun(manifestOrOptions = {}) {
    const manifest = isManifest(manifestOrOptions)
      ? manifestOrOptions
      : await this.loadManifest(manifestOrOptions.path);
    return planJournalImport(manifest);
  }

  static async importManifest(manifestOrOptions = {}) {
    if (!game.user?.isGM) {
      throw new Error("Only a GM can import Journals.");
    }

    const options = isManifest(manifestOrOptions) ? {} : manifestOrOptions;
    const manifest = isManifest(manifestOrOptions)
      ? manifestOrOptions
      : await this.loadManifest(options.path);
    return importJournalManifest(manifest, options);
  }

  static async cleanupLegacyFolders(rootFolderName = DEFAULT_FOLDER_ROOT) {
    if (!game.user?.isGM) {
      throw new Error("Only a GM can clean up Journal folders.");
    }
    return cleanupLegacyJournalFolders(rootFolderName);
  }
}

export function validateJournalManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object") {
    return { ok: false, errors: ["Manifest must be an object."] };
  }
  if (manifest.schema !== 1) errors.push("Manifest schema must be 1.");
  if (!Array.isArray(manifest.sources)) errors.push("Manifest sources must be an array.");

  const seen = new Set();
  for (const source of manifest.sources ?? []) {
    if (!source?.id) errors.push("Every source needs an id.");
    if (!Array.isArray(source?.entries)) {
      errors.push(`Source ${source?.id ?? "<unknown>"} entries must be an array.`);
      continue;
    }
    for (const entry of source.entries) {
      const key = `${source.id}:${entry?.sourceId ?? ""}`;
      if (!entry?.sourceId) errors.push(`Source ${source.id} has an entry without sourceId.`);
      else if (seen.has(key)) errors.push(`Duplicate sourceId: ${key}.`);
      else seen.add(key);

      if (!entry?.name) errors.push(`Entry ${key} has no name.`);
      if (!Array.isArray(entry?.pages) || entry.pages.length === 0) {
        errors.push(`Entry ${key} must have at least one page.`);
      }
      for (const page of entry?.pages ?? []) {
        if (!page?.name) errors.push(`Entry ${key} has a page without name.`);
        if (page?.type === "image" && !page.src) errors.push(`Image page ${key}/${page?.name ?? "<unknown>"} has no src.`);
        if ((page?.type ?? "text") === "text" && typeof page.content !== "string") {
          errors.push(`Text page ${key}/${page?.name ?? "<unknown>"} has no string content.`);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function planJournalImport(manifest) {
  const validation = validateJournalManifest(manifest);
  const entries = [];
  if (!validation.ok) return { ok: false, errors: validation.errors, entries };

  for (const source of manifest.sources) {
    for (const entry of source.entries) {
      const existing = findJournalBySource(source.id, entry.sourceId);
      const sourceHash = String(entry.sourceHash ?? "");
      const existingIntegration = existing?.getFlag?.(FLAG_SCOPE, "journalIntegration");
      const existingHash = String(existingIntegration?.sourceHash ?? "");
      const currentFormat = Number(existingIntegration?.formatVersion ?? 0) === JOURNAL_FORMAT_VERSION;
      entries.push({
        source: source.id,
        sourceId: entry.sourceId,
        name: entry.name,
        action: existing ? (sourceHash && existingHash === sourceHash && currentFormat ? "unchanged" : "update-available") : "create",
        existingUuid: existing?.uuid ?? null,
        pageCount: entry.pages.length,
        visibility: entry.visibility ?? "public"
      });
    }
  }

  return {
    ok: true,
    errors: [],
    totals: summarizePlan(entries),
    entries
  };
}

export async function importJournalManifest(manifest, options = {}) {
  const validation = validateJournalManifest(manifest);
  if (!validation.ok) return { ok: false, errors: validation.errors, created: [], updated: [], skipped: [] };

  const rootFolderName = String(options.rootFolderName ?? manifest.folderRoot ?? DEFAULT_FOLDER_ROOT).trim() || DEFAULT_FOLDER_ROOT;
  const updateExisting = Boolean(options.updateExisting);
  const forceUpdate = Boolean(options.forceUpdate);
  const created = [];
  const updated = [];
  const skipped = [];
  const folders = new Map();

  for (const source of manifest.sources) {
    for (const entry of source.entries) {
      const existing = findJournalBySource(source.id, entry.sourceId);
      const existingIntegration = existing?.getFlag?.(FLAG_SCOPE, "journalIntegration");
      const existingHash = String(existingIntegration?.sourceHash ?? "");
      const sourceHash = String(entry.sourceHash ?? "");
      const currentFormat = Number(existingIntegration?.formatVersion ?? 0) === JOURNAL_FORMAT_VERSION;

      if (!existing) {
        const data = await buildJournalData(source, entry, rootFolderName, folders);
        const journal = await JournalEntry.implementation.create(data, { renderSheet: false });
        created.push({ source: source.id, sourceId: entry.sourceId, uuid: journal.uuid, name: journal.name });
        continue;
      }

      if (!updateExisting || (!forceUpdate && sourceHash && existingHash === sourceHash && currentFormat)) {
        skipped.push({
          source: source.id,
          sourceId: entry.sourceId,
          uuid: existing.uuid,
          name: existing.name,
          reason: sourceHash && existingHash === sourceHash ? "unchanged" : "exists"
        });
        continue;
      }

      const data = await buildJournalData(source, entry, rootFolderName, folders);
      const existingPageIds = Array.from(existing.pages ?? []).map((page) => page.id);
      if (existingPageIds.length) {
        await existing.deleteEmbeddedDocuments("JournalEntryPage", existingPageIds, { render: false });
      }
      const { pages, ...journalPatch } = data;
      await existing.update(journalPatch, { render: false });
      await existing.createEmbeddedDocuments("JournalEntryPage", pages, { render: false });
      updated.push({ source: source.id, sourceId: entry.sourceId, uuid: existing.uuid, name: existing.name });
    }
  }

  const folderCleanup = options.cleanupLegacyFolders
    ? await cleanupLegacyJournalFolders(rootFolderName)
    : { removed: [], preserved: [] };

  return {
    ok: true,
    errors: [],
    created,
    updated,
    skipped,
    removedFolders: folderCleanup.removed,
    preservedLegacyFolders: folderCleanup.preserved
  };
}

async function buildJournalData(source, entry, rootFolderName, folders) {
  const folder = await getOrCreateFolderForEntry(source, entry, rootFolderName, folders);
  return {
    name: entry.name,
    folder: folder?.id ?? null,
    ownership: ownershipForVisibility(entry.visibility),
    pages: entry.pages.map((page, index) => buildPageData(page, index, source, entry)),
    flags: {
      core: {
        sheetClass: SYMBAROUM_JOURNAL_SHEET
      },
      [FLAG_SCOPE]: {
        journalIntegration: {
          source: source.id,
          sourceId: entry.sourceId,
          kind: entry.kind ?? "journal",
          sourceHash: entry.sourceHash ?? "",
          formatVersion: JOURNAL_FORMAT_VERSION,
          importedAt: new Date().toISOString()
        }
      }
    }
  };
}

function buildPageData(page, index, source, entry) {
  const base = {
    name: page.name,
    sort: Number(page.sort ?? ((index + 1) * 100000)) || ((index + 1) * 100000),
    ownership: ownershipForVisibility(page.visibility ?? entry.visibility),
    flags: {
      [FLAG_SCOPE]: {
        journalIntegrationPage: {
          source: source.id,
          sourceId: entry.sourceId,
          pageSourceId: page.sourceId ?? slugify(page.name)
        }
      }
    }
  };

  if (page.type === "image") {
    return {
      ...base,
      type: "image",
      src: page.src,
      image: {
        caption: page.caption ?? ""
      }
    };
  }

  return {
    ...base,
    type: "text",
    text: {
      format: globalThis.CONST?.JOURNAL_ENTRY_PAGE_FORMATS?.HTML ?? TEXT_FORMAT_HTML,
      content: formatSymbaroumJournalHtml(page.content, page.name)
    }
  };
}

async function getOrCreateFolderForEntry(source, entry, rootFolderName, cache) {
  const path = [
    rootFolderName,
    ...(Array.isArray(entry.folderPath) ? entry.folderPath : [entry.kind ?? "Journals"])
  ].map((part) => String(part ?? "").trim()).filter(Boolean);

  let parent = null;
  for (const name of path) {
    const key = `${parent?.id ?? "root"}:${name}`;
    if (cache.has(key)) {
      parent = cache.get(key);
      continue;
    }
    const existing = game.folders?.find?.((folder) => (
      folder.type === "JournalEntry"
      && folder.name === name
      && (folder.folder?.id ?? folder.folder ?? null) === (parent?.id ?? null)
    ));
    if (existing) {
      parent = existing;
    } else {
      const folderClass = Folder.implementation ?? Folder;
      parent = await folderClass.create({
        name,
        type: "JournalEntry",
        folder: parent?.id ?? null,
        sorting: "a",
        flags: {
          [FLAG_SCOPE]: {
            journalIntegrationFolder: {
              managed: true,
              path: path.slice(0, path.indexOf(name) + 1).join("/")
            }
          }
        }
      }, { renderSheet: false });
    }
    cache.set(key, parent);
  }
  return parent;
}

export async function cleanupLegacyJournalFolders(rootFolderName = DEFAULT_FOLDER_ROOT) {
  const root = findJournalFolder(rootFolderName, null);
  if (!root) return { removed: [], preserved: [] };

  const removed = [];
  const preserved = [];
  for (const legacyName of LEGACY_SOURCE_FOLDERS) {
    const legacyRoot = findJournalFolder(legacyName, root.id);
    if (!legacyRoot) continue;

    const subtree = collectFolderSubtree(legacyRoot);
    const subtreeIds = new Set(subtree.map((folder) => folder.id));
    const journals = Array.from(game.journal ?? []).filter((journal) => subtreeIds.has(folderIdOf(journal.folder)));
    if (journals.length) {
      preserved.push({
        name: legacyName,
        reason: "contains-journals",
        journalCount: journals.length
      });
      continue;
    }

    const depths = new Map([[legacyRoot.id, 0]]);
    for (const folder of subtree) {
      if (folder.id === legacyRoot.id) continue;
      depths.set(folder.id, folderDepthWithin(folder, subtreeIds, legacyRoot.id));
    }
    const leafFirst = [...subtree].sort((a, b) => (depths.get(b.id) ?? 0) - (depths.get(a.id) ?? 0));
    for (const folder of leafFirst) {
      await folder.delete({ render: false });
      removed.push({ id: folder.id, name: folder.name });
    }
  }

  return { removed, preserved };
}

export function formatSymbaroumJournalHtml(content, pageName = "") {
  let html = sanitizeJournalHtml(content);
  html = addClassToTags(html, "p", "pblock");
  html = addClassToTags(html, "h2", "heading2");

  const title = String(pageName ?? "").trim();
  const pageTitle = title ? `<h2 class="h1mod">${escapeHtml(title)}</h2>` : "";
  return `<div class="symbaroum-mod tenebre-journal-page">${pageTitle}${html}</div>`;
}

function addClassToTags(html, tagName, className) {
  const pattern = new RegExp(`<${tagName}(\\s[^>]*)?>`, "gi");
  return String(html ?? "").replace(pattern, (match, attributes = "") => {
    const classPattern = /\bclass\s*=\s*(["'])(.*?)\1/i;
    if (classPattern.test(attributes)) {
      return match.replace(classPattern, (_classMatch, quote, classes) => {
        const values = new Set(String(classes).split(/\s+/).filter(Boolean));
        values.add(className);
        return `class=${quote}${Array.from(values).join(" ")}${quote}`;
      });
    }
    return `<${tagName}${attributes} class="${className}">`;
  });
}

function findJournalFolder(name, parentId) {
  return game.folders?.find?.((folder) => (
    folder.type === "JournalEntry"
    && folder.name === name
    && folderIdOf(folder.folder) === parentId
  )) ?? null;
}

function collectFolderSubtree(root) {
  const folders = Array.from(game.folders ?? []).filter((folder) => folder.type === "JournalEntry");
  const subtree = [root];
  const ids = new Set([root.id]);
  let added = true;
  while (added) {
    added = false;
    for (const folder of folders) {
      if (ids.has(folder.id) || !ids.has(folderIdOf(folder.folder))) continue;
      ids.add(folder.id);
      subtree.push(folder);
      added = true;
    }
  }
  return subtree;
}

function folderDepthWithin(folder, subtreeIds, rootId) {
  let depth = 0;
  let parentId = folderIdOf(folder.folder);
  while (parentId && subtreeIds.has(parentId)) {
    depth += 1;
    if (parentId === rootId) break;
    const parent = game.folders?.get?.(parentId)
      ?? game.folders?.find?.((candidate) => candidate.id === parentId);
    parentId = folderIdOf(parent?.folder);
  }
  return depth;
}

function folderIdOf(folder) {
  return folder?.id ?? folder ?? null;
}

function findJournalBySource(source, sourceId) {
  return game.journal?.find?.((journal) => {
    const data = journal.getFlag?.(FLAG_SCOPE, "journalIntegration");
    return data?.source === source && data?.sourceId === sourceId;
  }) ?? null;
}

function ownershipForVisibility(visibility = "public") {
  const levels = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS ?? OWNERSHIP;
  const none = levels.NONE ?? OWNERSHIP.NONE;
  const observer = levels.OBSERVER ?? OWNERSHIP.OBSERVER;
  const owner = levels.OWNER ?? OWNERSHIP.OWNER;
  if (visibility === "gm-secret") return { default: none };
  if (visibility === "shared-edit") return { default: owner };
  return { default: observer };
}

function sanitizeJournalHtml(content) {
  const html = String(content ?? "");
  const parser = globalThis.DOMParser ? new DOMParser() : null;
  if (!parser) return stripDangerousHtml(html);

  const doc = parser.parseFromString(html, "text/html");
  for (const element of doc.body.querySelectorAll("script, iframe, object, embed, link, meta")) {
    element.remove();
  }
  for (const element of doc.body.querySelectorAll("*")) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = String(attribute.value ?? "").trim().toLowerCase();
      if (name.startsWith("on") || value.startsWith("javascript:")) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  return doc.body.innerHTML;
}

function stripDangerousHtml(html) {
  return String(html ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\s(?:href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function summarizePlan(entries) {
  return entries.reduce((totals, entry) => {
    totals[entry.action] = (totals[entry.action] ?? 0) + 1;
    return totals;
  }, {});
}

function isManifest(value) {
  return value?.schema === 1 && Array.isArray(value?.sources);
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "page";
}
