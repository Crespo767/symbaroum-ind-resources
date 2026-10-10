import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

// O libWrapper aceita um só wrapper por método e por módulo; um segundo registro lança erro
// e interrompe o hook que o chamou (aconteceu no ready com prepareDerivedData).
test("each libWrapper target is registered once by the module", async () => {
  const files = (await readdir(new URL("../scripts/", import.meta.url))).filter((name) => name.endsWith(".mjs"));
  const targets = new Map();
  for (const file of files) {
    const source = await readFile(new URL(`../scripts/${file}`, import.meta.url), "utf8");
    for (const match of source.matchAll(/libWrapper\.register\(\s*MODULE_ID,\s*["'`]([^"'`]+)["'`]/g)) {
      const list = targets.get(match[1]) ?? [];
      list.push(file);
      targets.set(match[1], list);
    }
  }
  for (const [target, owners] of targets) {
    assert.equal(owners.length, 1, `${target} registered by ${owners.join(", ")}`);
  }
});

test("actor preparation methods are wrapped only by actor-preparation.mjs", async () => {
  const files = (await readdir(new URL("../scripts/", import.meta.url))).filter((name) => name.endsWith(".mjs") && name !== "actor-preparation.mjs");
  for (const file of files) {
    const source = await readFile(new URL(`../scripts/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /prototype\.(prepareBaseData|prepareDerivedData)\s*=|documentClass\.prototype\.prepare(Base|Derived)Data/, file);
  }
});
