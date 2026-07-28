#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tests = fs.readdirSync(path.join(root, "tests"))
  .filter((name) => name.endsWith(".test.mjs"))
  .sort()
  .map((name) => path.join(root, "tests", name));

if (!tests.length) {
  console.error("No test files were found.");
  process.exitCode = 1;
} else {
  const result = spawnSync(process.execPath, ["--test", ...tests], {
    cwd: root,
    stdio: "inherit"
  });
  process.exitCode = result.status ?? 1;
}
