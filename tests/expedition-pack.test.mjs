import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { getExpeditionPackTables } from "../tools/expedition-pack-data.mjs";
import { CANONICAL_EXPEDITION_TABLE_IDS, MODULE_ID } from "../scripts/constants.mjs";
import { buildTablePack } from "../tools/build-expedition-tables.cjs";

test("pack data includes all five canonical tables with stable result IDs and intact intervals", () => {
  const tables = getExpeditionPackTables("folder");
  assert.equal(tables.length, 5);
  assert.deepEqual(tables.map(table => table._id), Object.values(CANONICAL_EXPEDITION_TABLE_IDS));
  assert.deepEqual(getExpeditionPackTables("folder"), tables);
  for (const table of tables) {
    const key = table.flags[MODULE_ID].tableKey;
    assert.equal(table._id, CANONICAL_EXPEDITION_TABLE_IDS[key]);
    assert.equal(table.flags[MODULE_ID].canonicalId, table._id);
    assert.equal(table.folder, "folder");
    assert.equal(table.replacement, true);
    assert.equal(new Set(table.results.map(r => r._id)).size, table.results.length);
    for (const result of table.results) {
      assert.match(result._id, /^[a-zA-Z0-9]{16}$/);
      assert.ok(result.range[0] <= result.range[1]);
      assert.ok(result.img.startsWith("icons/"));
    }
    for (let total = 1; total <= 30; total++) {
      const matches = table.results.filter(r => r.range[0] <= total && r.range[1] >= total);
      assert.equal(matches.length, 1, `${key} must cover ${total} exactly once`);
    }
  }
});

test("standalone pack writes every result as a subdocument and closes its database", async () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "ind-pack-test-"));
  const records = new Map(); let closed = false;
  class Level {
    async open() {}
    async put(key, data) { records.set(key, data); }
    async compactRange() {}
    async close() { closed = true; }
  }
  try {
    const tables = await buildTablePack(output, Level);
    assert.equal(closed, true);
    for (const table of tables) {
      const parent = records.get(`!tables!${table._id}`);
      assert.deepEqual(parent.results, table.results.map(r => r._id));
      for (const id of parent.results) assert.equal(records.get(`!tables.results!${table._id}.${id}`)._id, id);
    }
  } finally { fs.rmdirSync(output); }
});

test("pack builder refuses missing output, installed banks and nonempty destinations", async () => {
  await assert.rejects(buildTablePack(), /--output/);
  await assert.rejects(buildTablePack(fileURLToPath(new URL("../packs/expedition-tables", import.meta.url))), /fora dos bancos/);
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "ind-pack-protected-"));
  const sentinel = path.join(output, "sentinel"); fs.writeFileSync(sentinel, "preserve");
  try {
    await assert.rejects(buildTablePack(output), /deve estar vazio/);
    assert.equal(fs.readFileSync(sentinel, "utf8"), "preserve");
  } finally { fs.unlinkSync(sentinel); fs.rmdirSync(output); }
});

test("pack builder closes the database when a write fails", async () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "ind-pack-error-")); let closed = false;
  class Level {
    async open() {}
    async put() { throw new Error("disk failure"); }
    async close() { closed = true; }
  }
  try {
    await assert.rejects(buildTablePack(output, Level), /disk failure/);
    assert.equal(closed, true);
  } finally { fs.rmdirSync(output); }
});
