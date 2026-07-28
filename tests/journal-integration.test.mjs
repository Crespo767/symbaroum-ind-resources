import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  cleanupLegacyJournalFolders,
  formatSymbaroumJournalHtml,
  importJournalManifest,
  planJournalImport,
  validateJournalManifest
} from "../scripts/journal-integration.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "data", "journal-import-manifest.json");

test("generated journal manifest is valid and portable", () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const result = validateJournalManifest(manifest);
  assert.deepEqual(result, { ok: true, errors: [] });
  assert.equal(manifest.sources.length, 2);
  assert.equal(manifest.sources.every((source) => source.entries.length > 0), true);

  const serialized = JSON.stringify(manifest);
  assert.equal(serialized.includes("C:\\Projetos"), false);
  assert.equal(serialized.includes("sourcePath"), false);
  assert.equal(serialized.includes("sourceFile"), false);
});

test("generated journal manifest folder paths fit Foundry folder depth", () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const rootDepth = 1;
  const tooDeep = [];
  for (const source of manifest.sources) {
    for (const entry of source.entries) {
      const depth = rootDepth + (entry.folderPath?.length ?? 1);
      if (depth > 4) tooDeep.push(`${source.id}:${entry.sourceId}:${depth}`);
    }
  }
  assert.deepEqual(tooDeep, []);
});

test("journal import plan detects existing entries by namespaced source flags", () => {
  const manifest = {
    schema: 1,
    sources: [{
      id: "test-source",
      entries: [{
        sourceId: "one",
        name: "One",
        sourceHash: "abc",
        pages: [{ name: "Page", type: "text", content: "<p>One</p>" }]
      }, {
        sourceId: "two",
        name: "Two",
        sourceHash: "def",
        pages: [{ name: "Page", type: "text", content: "<p>Two</p>" }]
      }]
    }]
  };

  globalThis.game = {
    journal: [{
      uuid: "JournalEntry.existing",
      getFlag: () => ({ source: "test-source", sourceId: "one", sourceHash: "abc", formatVersion: 2 })
    }]
  };

  const plan = planJournalImport(manifest);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.entries.map((entry) => entry.action), ["unchanged", "create"]);
  assert.deepEqual(plan.totals, { unchanged: 1, create: 1 });

  delete globalThis.game;
});

test("journal import plan marks the legacy visual format for update", () => {
  const manifest = {
    schema: 1,
    sources: [{
      id: "test-source",
      entries: [{
        sourceId: "one",
        name: "One",
        sourceHash: "abc",
        pages: [{ name: "Page", type: "text", content: "<p>One</p>" }]
      }]
    }]
  };

  globalThis.game = {
    journal: [{
      uuid: "JournalEntry.existing",
      getFlag: () => ({ source: "test-source", sourceId: "one", sourceHash: "abc" })
    }]
  };

  const plan = planJournalImport(manifest);
  assert.equal(plan.entries[0].action, "update-available");

  delete globalThis.game;
});

test("Symbaroum journal formatting applies the native editorial classes", () => {
  const html = formatSymbaroumJournalHtml(
    '<script>alert("x")</script><h2>Secao</h2><p>Texto</p>',
    "Pagina"
  );

  assert.match(html, /^<div class="symbaroum-mod tenebre-journal-page">/);
  assert.match(html, /<h2 class="h1mod">Pagina<\/h2>/);
  assert.match(html, /<h2 class="heading2">Secao<\/h2>/);
  assert.match(html, /<p class="pblock">Texto<\/p>/);
  assert.equal(html.includes("<script>"), false);
});

test("skipped Journals do not create replacement folder trees", async () => {
  const manifest = {
    schema: 1,
    folderRoot: "Tenebre Journals",
    sources: [{
      id: "test-source",
      entries: [{
        sourceId: "one",
        name: "One",
        sourceHash: "abc",
        folderPath: ["Knowledge"],
        pages: [{ name: "Page", type: "text", content: "<p>One</p>" }]
      }]
    }]
  };
  let folderCreates = 0;

  globalThis.game = {
    journal: [{
      uuid: "JournalEntry.existing",
      name: "One",
      getFlag: () => ({ source: "test-source", sourceId: "one", sourceHash: "abc" })
    }]
  };
  globalThis.Folder = {
    implementation: {
      create: async () => {
        folderCreates += 1;
        return { id: "folder" };
      }
    }
  };

  const result = await importJournalManifest(manifest);
  assert.equal(result.skipped.length, 1);
  assert.equal(folderCreates, 0);

  delete globalThis.Folder;
  delete globalThis.game;
});

test("legacy folder cleanup removes only empty managed-era trees, leaf first", async () => {
  const deleted = [];
  const folders = [
    folderDocument("root", "Tenebre Journals", null, deleted),
    folderDocument("legacy", "Symbaroumlore", "root", deleted),
    folderDocument("leaf", "Conhecimento de Symbaroum", "legacy", deleted),
    folderDocument("preserved", "Tenebre Chronicle", "root", deleted)
  ];

  globalThis.game = {
    folders,
    journal: [{ folder: "preserved" }]
  };

  const result = await cleanupLegacyJournalFolders();
  assert.deepEqual(deleted, ["leaf", "legacy"]);
  assert.deepEqual(result.removed.map((folder) => folder.id), ["leaf", "legacy"]);
  assert.deepEqual(result.preserved, [{
    name: "Tenebre Chronicle",
    reason: "contains-journals",
    journalCount: 1
  }]);

  delete globalThis.game;
});

function folderDocument(id, name, folder, deleted) {
  return {
    id,
    name,
    folder,
    type: "JournalEntry",
    delete: async () => {
      deleted.push(id);
    }
  };
}
