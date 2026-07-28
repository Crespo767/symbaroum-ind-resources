#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = ["scripts", "tests", "tools"]
  .flatMap((directory) => collectModules(path.join(root, directory)))
  .sort();

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: root,
    encoding: "utf8"
  });
  if (result.status === 0) continue;
  process.stderr.write(result.stderr || result.stdout || `Syntax check failed: ${file}\n`);
  process.exit(1);
}

console.log(`Syntax validation passed (${files.length} ES modules).`);

function collectModules(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectModules(absolutePath));
    else if (entry.isFile() && entry.name.endsWith(".mjs")) files.push(absolutePath);
  }
  return files;
}
