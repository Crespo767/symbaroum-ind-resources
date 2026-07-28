import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoots = ["scripts", "tools"];

test("runtime and maintenance scripts do not use dynamic code execution", () => {
  const offenders = [];
  for (const relativePath of listFiles(sourceRoots, (name) => name.endsWith(".mjs"))) {
    const source = fs.readFileSync(path.join(root, relativePath), "utf8");
    if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(source)) offenders.push(relativePath);
  }
  assert.deepEqual(offenders, []);
});

test("tracked public text and scripts contain no personal Windows paths", () => {
  const offenders = [];
  const roots = ["README.md", "SECURITY.md", "THIRD_PARTY_NOTICES.md", "docs", "scripts", "tools"];
  for (const relativePath of listFiles(roots, (name) => /\.(?:md|mjs|json|hbs|css)$/i.test(name))) {
    const source = fs.readFileSync(path.join(root, relativePath), "utf8");
    if (/[A-Za-z]:\\(?:Users|Projetos)\\/i.test(source)) offenders.push(relativePath);
  }
  assert.deepEqual(offenders, []);
});

test("public source files contain no high-confidence credential patterns", () => {
  const offenders = [];
  const roots = [
    ".github",
    "data",
    "docs",
    "languages",
    "scripts",
    "styles",
    "templates",
    "tools",
    "module.json",
    "package.json",
    "README.md",
    "SECURITY.md",
    "THIRD_PARTY_NOTICES.md"
  ];
  const credentialPattern = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{36}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}/;
  for (const relativePath of listFiles(roots, (name) => /\.(?:md|mjs|json|hbs|css|ya?ml)$/i.test(name))) {
    const source = fs.readFileSync(path.join(root, relativePath), "utf8");
    if (credentialPattern.test(source)) offenders.push(relativePath);
  }
  assert.deepEqual(offenders, []);
});

test("GitHub Actions dependencies are pinned to immutable commits", () => {
  const workflowRoot = path.join(root, ".github", "workflows");
  const offenders = [];
  for (const relativePath of listFiles([".github/workflows"], (name) => /\.ya?ml$/i.test(name))) {
    const source = fs.readFileSync(path.join(root, relativePath), "utf8");
    const actionReferences = Array.from(source.matchAll(/^\s*uses:\s*([^/\s]+\/[^@\s]+)@([^\s#]+)/gm));
    for (const [, action, reference] of actionReferences) {
      if (!/^[0-9a-f]{40}$/i.test(reference)) offenders.push(`${relativePath}: ${action}@${reference}`);
    }
  }
  assert.ok(fs.existsSync(workflowRoot), "Expected a GitHub Actions workflow directory.");
  assert.deepEqual(offenders, []);
});

function listFiles(relativeRoots, accept) {
  const files = [];
  for (const relativeRoot of relativeRoots) {
    const absoluteRoot = path.join(root, relativeRoot);
    if (!fs.existsSync(absoluteRoot)) continue;
    const stat = fs.statSync(absoluteRoot);
    if (stat.isFile()) {
      if (accept(relativeRoot)) files.push(relativeRoot);
      continue;
    }
    walk(absoluteRoot, relativeRoot, files, accept);
  }
  return files;
}

function walk(directory, relativeDirectory, files, accept) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      walk(absolutePath, relativePath, files, accept);
    } else if (entry.isFile() && accept(entry.name)) {
      files.push(relativePath);
    }
  }
}
