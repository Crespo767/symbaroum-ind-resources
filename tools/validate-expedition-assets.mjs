import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicPath = process.argv[2];
if (!publicPath || !fs.existsSync(path.join(publicPath, "icons"))) {
  throw new Error("Informe o diretório public do Foundry para verificar os ícones da expedição.");
}
const files = ["scripts/expedition-data.mjs", "scripts/party-actor.mjs"];
const paths = new Set(files.flatMap(file => [...fs.readFileSync(path.join(root, file), "utf8")
  .matchAll(/["'](icons\/[^"']+)["']/g)].map(match => match[1])));
const missing = [...paths].filter(icon => !fs.existsSync(path.join(publicPath, icon)));
if (missing.length) {
  console.error(missing.join("\n"));
  process.exitCode = 1;
} else console.log(`Expedition assets validated (${paths.size} unique paths).`);
