#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaultOutput = path.join(root, "data", "journal-import-manifest.json");
const symbaroumloreRoot = process.env.SYMBAROUMLORE_ROOT ?? "C:\\Projetos\\Symbaroumlore";
const tenebreRoot = process.env.TENEBRE_CHRONICLE_ROOT ?? "C:\\Projetos\\tenebre-chronicle-main";
const requireFromSymbaroumlore = createRequire(path.join(symbaroumloreRoot, "package.json"));
const ts = requireFromSymbaroumlore("typescript");

const output = getArgValue("--out") ?? defaultOutput;

const manifest = {
  schema: 1,
  generatedAt: new Date().toISOString(),
  folderRoot: "Tenebre Journals",
  sources: [
    buildSymbaroumloreSource(),
    await buildTenebreChronicleSource()
  ]
};

copyManifestAssets(manifest);
stripLocalSourceMetadata(manifest);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const counts = Object.fromEntries(manifest.sources.map((source) => [source.id, source.entries.length]));
console.log(`Journal manifest written to ${path.relative(root, output)}.`);
console.log(JSON.stringify(counts, null, 2));

function buildSymbaroumloreSource() {
  const componentRoot = path.join(symbaroumloreRoot, "client", "src", "components");
  const sections = [
    { file: "TimelineSection.tsx", kind: "history", name: "Historia", folderPath: ["Conhecimento de Symbaroum", "Historia"] },
    { file: "DavokarSection.tsx", kind: "davokar", name: "Davokar", folderPath: ["Conhecimento de Symbaroum", "Davokar"] },
    { file: "LocationsSection.tsx", kind: "location", name: "Locais", folderPath: ["Conhecimento de Symbaroum", "Locais"] },
    { file: "FactionsSection.tsx", kind: "faction", name: "Faccoes", folderPath: ["Conhecimento de Symbaroum", "Faccoes"] },
    { file: "SpiritualitySection.tsx", kind: "belief", name: "Crencas", folderPath: ["Conhecimento de Symbaroum", "Crencas"] },
    { file: "RacesSection.tsx", kind: "race", name: "Povos e Racas", folderPath: ["Conhecimento de Symbaroum", "Povos e Racas"] },
    { file: "GameSystemSection.tsx", kind: "reference", name: "Sistema de Jogo", folderPath: ["Conhecimento de Symbaroum", "Regras de Referencia"] },
    { file: "CorruptionSection.tsx", kind: "reference", name: "Corrupcao", folderPath: ["Conhecimento de Symbaroum", "Regras de Referencia"] },
    { file: "CharacterCreationSection.tsx", kind: "reference", name: "Criacao de Personagem", folderPath: ["Conhecimento de Symbaroum", "Regras de Referencia"] },
    { file: "EquipmentSection.tsx", kind: "reference", name: "Equipamentos", folderPath: ["Conhecimento de Symbaroum", "Regras de Referencia"] },
    { file: "AbilitiesSection.tsx", kind: "reference", name: "Habilidades", folderPath: ["Conhecimento de Symbaroum", "Regras de Referencia"] },
    { file: "PowersSection.tsx", kind: "reference", name: "Poderes", folderPath: ["Conhecimento de Symbaroum", "Regras de Referencia"] },
    { file: "CreaturesSection.tsx", kind: "creature-lore", name: "Criaturas", folderPath: ["Conhecimento de Symbaroum", "Criaturas"] },
    { file: "ImageGallerySection.tsx", kind: "gallery", name: "Galeria", folderPath: ["Conhecimento de Symbaroum", "Galeria e Mapas"] }
  ];

  const entries = sections
    .map((section, index) => {
      const filePath = path.join(componentRoot, section.file);
      if (!fs.existsSync(filePath)) return null;
      const source = fs.readFileSync(filePath, "utf8");
      const parsed = parseTsx(source, filePath);
      const structuredPages = parsed.topLevelData.map((data) => ({
        sourceId: slugify(data.name),
        name: titleFromIdentifier(data.name),
        type: "text",
        content: renderValueAsHtml(data.value)
      }));
      const narrative = parsed.jsxText.length
        ? [{
            sourceId: "texto-da-secao",
            name: section.name,
            type: "text",
            content: renderParagraphs(parsed.jsxText)
          }]
        : [];
      const pages = [...narrative, ...structuredPages];
      if (!pages.length) return null;
      return withHash({
        sourceId: `symbaroumlore-${slugify(section.name)}`,
        kind: section.kind,
        name: section.name,
        visibility: "public",
        sort: (index + 1) * 100000,
        folderPath: section.folderPath,
        pages,
        relationships: [],
        assets: collectAssets(source, filePath),
        sourceFile: path.relative(symbaroumloreRoot, filePath).replaceAll("\\", "/")
      });
    })
    .filter(Boolean);

  entries.push(withHash(buildSymbaroumloreImageEntry()));

  return {
    id: "symbaroumlore",
    label: "Symbaroumlore",
    entries
  };
}

function buildSymbaroumloreImageEntry() {
  const publicRoot = path.join(symbaroumloreRoot, "client", "public");
  const images = fs.existsSync(publicRoot)
    ? listFiles(publicRoot).filter((file) => /\.(?:png|jpe?g|webp|gif)$/i.test(file))
    : [];
  const pages = images.map((file, index) => {
    const relative = path.relative(publicRoot, file).replaceAll("\\", "/");
    return {
      sourceId: slugify(relative),
      name: path.basename(file, path.extname(file)),
      type: "image",
      src: `modules/symbaroum-ind-resources/assets/imported/symbaroumlore/${relative}`,
      caption: relative,
      sort: (index + 1) * 100000
    };
  });
  return {
    sourceId: "symbaroumlore-galeria-assets",
    kind: "gallery",
    name: "Assets do Symbaroumlore",
    visibility: "public",
    folderPath: ["Conhecimento de Symbaroum", "Galeria e Mapas"],
    pages: pages.length ? pages : [{
      sourceId: "sem-assets",
      name: "Sem assets",
      type: "text",
      content: "<p>Nenhum asset local foi encontrado.</p>"
    }],
    relationships: [],
    assets: images.map((file) => ({
      sourcePath: file,
      targetPath: `assets/imported/symbaroumlore/${path.relative(publicRoot, file).replaceAll("\\", "/")}`
    }))
  };
}

async function buildTenebreChronicleSource() {
  const data = await loadTenebreContent();
  const entries = [
    ...data.sessions.flatMap((session, index) => buildSessionEntries(session, index)),
    ...data.characters.map((character, index) => withHash(buildCharacterEntry(character, index))),
    ...data.npcs.map((npc, index) => withHash(buildNpcEntry(npc, index))),
    ...data.archive.map((item, index) => withHash(buildArchiveEntry(item, index))),
    ...data.masterNotes.map((note, index) => withHash(buildMasterNoteEntry(note, index)))
  ];

  return {
    id: "tenebre-chronicle",
    label: "Tenebre Chronicle",
    entries
  };
}

async function loadTenebreContent() {
  const files = {
    sessions: path.join(tenebreRoot, "src", "data", "sessions.ts"),
    characters: path.join(tenebreRoot, "src", "data", "characters.ts"),
    npcs: path.join(tenebreRoot, "src", "data", "npcs.ts"),
    archive: path.join(tenebreRoot, "src", "data", "archive.ts"),
    masterNotes: path.join(tenebreRoot, "src", "data", "masterNotes.ts")
  };
  return Object.fromEntries(Object.entries(files).map(([key, file]) => {
    const source = fs.readFileSync(file, "utf8");
    const exported = parseTsx(source, file).topLevelData.find((data) => data.name === key);
    return [key, exported?.value ?? []];
  }));
}

function buildSessionEntries(session, index) {
  const publicEntry = withHash({
    sourceId: `tenebre-session-${session.slug || session.number}`,
    kind: "session",
    name: `Sessao ${String(session.number).padStart(2, "0")} - ${session.title}`,
    visibility: "public",
    sort: (index + 1) * 100000,
    folderPath: ["Cronica Tenebre", "Sessoes", "Publicadas"],
    pages: [
      page("Resumo", renderFields([
        ["Data", session.date],
        ["Presentes", session.present]
      ], session.summary)),
      listPage("Eventos", session.events),
      listPage("Participantes e Lugares", [
        sectionList("NPCs", session.npcs),
        sectionList("Locais", session.locations)
      ]),
      listPage("Consequencias e Ganchos", [
        sectionList("Consequencias", session.consequences),
        sectionList("Ganchos", session.hooks)
      ])
    ],
    relationships: [
      ...toRelationship("character-name", session.present),
      ...toRelationship("npc-name", session.npcs),
      ...toRelationship("location-name", session.locations)
    ],
    assets: []
  });

  if (!String(session.masterNotes ?? "").trim()) return [publicEntry];

  return [
    publicEntry,
    withHash({
      sourceId: `tenebre-session-${session.slug || session.number}-gm`,
      kind: "session-prep",
      name: `Preparacao - Sessao ${String(session.number).padStart(2, "0")} - ${session.title}`,
      visibility: "gm-secret",
      sort: (index + 1) * 100000,
      folderPath: ["Cronica Tenebre", "Sessoes", "Preparacao do Mestre"],
      pages: [page("Notas do Mestre", renderParagraphs([session.masterNotes]))],
      relationships: [{ type: "public-session-source-id", sourceId: publicEntry.sourceId }],
      assets: []
    })
  ];
}

function buildCharacterEntry(character, index) {
  return {
    sourceId: `tenebre-character-${character.slug}`,
    kind: "character-dossier",
    name: character.name,
    visibility: "public",
    sort: (index + 1) * 100000,
    folderPath: ["Cronica Tenebre", "Personagens"],
    pages: [
      page("Dossie", renderFields([
        ["Papel", character.role],
        ["Povo", character.people],
        ["Sombra", character.shadow],
        ["Jogador", character.player],
        ["Status", character.status],
        ["Citacao", character.quote]
      ], character.summary ?? character.history)),
      page("Historia e Objetivo", renderFields([
        ["Objetivo", character.goal],
        ["Aparencia", character.appearance]
      ], character.history)),
      listPage("Companheiros", (character.companions ?? []).map((companion) => renderFields([
        ["Nome", companion.name],
        ["Papel", companion.role],
        ["Status", companion.status]
      ], companion.description)))
    ],
    relationships: [],
    assets: collectTenebreAsset(character.image, "characters"),
    sourceData: pickKnown(character, ["imageFraming"])
  };
}

function buildNpcEntry(npc, index) {
  const secret = String(npc.visibility ?? npc.status ?? "").toLowerCase().includes("secreto");
  return {
    sourceId: `tenebre-npc-${npc.slug}`,
    kind: "npc-dossier",
    name: npc.name,
    visibility: secret ? "gm-secret" : "public",
    sort: (index + 1) * 100000,
    folderPath: ["Cronica Tenebre", "NPCs", secret ? "Segredos do Mestre" : "Conhecidos"],
    pages: [
      page("Dossie", renderFields([
        ["Papel", npc.role],
        ["Local", npc.location],
        ["Relacao", npc.relationship],
        ["Status", npc.status]
      ], npc.summary ?? npc.description)),
      listPage("Companheiros", (npc.companions ?? []).map((companion) => renderFields([
        ["Nome", companion.name],
        ["Papel", companion.role],
        ["Status", companion.status]
      ], companion.description)))
    ],
    relationships: toRelationship("location-name", [npc.location]),
    assets: collectTenebreAsset(npc.image, "npcs"),
    sourceData: pickKnown(npc, ["imageFraming"])
  };
}

function buildArchiveEntry(item, index) {
  const discovered = item.discovered !== false && item.status !== "Oculto";
  return {
    sourceId: `tenebre-archive-${item.slug}`,
    kind: "archive-item",
    name: item.title,
    visibility: discovered ? "public" : "gm-secret",
    sort: (index + 1) * 100000,
    folderPath: ["Cronica Tenebre", "Arquivo da Campanha"],
    pages: [page("Documento", renderFields([
      ["Tipo", item.type],
      ["Estado", discovered ? "Descoberto" : "Nao descoberto"],
      ["Link", item.link]
    ], item.description))],
    relationships: [],
    assets: collectTenebreAsset(item.image, "archive")
  };
}

function buildMasterNoteEntry(note, index) {
  return {
    sourceId: `tenebre-master-note-${note.slug ?? slugify(note.title ?? `nota-${index + 1}`)}`,
    kind: "master-note",
    name: note.title ?? `Nota ${index + 1}`,
    visibility: note.visibility ?? "public",
    sort: (index + 1) * 100000,
    folderPath: ["Cronica Tenebre", note.visibility === "gm-secret" ? "Notas do Mestre" : "Notas Compartilhadas"],
    pages: [page("Nota", renderFields([
      ["Data", note.date],
      ["Categoria", note.category]
    ], note.content ?? note.description))],
    relationships: [],
    assets: []
  };
}

function parseTsx(source, fileName) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const topLevelData = [];
  const jsxText = [];

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        const value = evaluateLiteral(declaration.initializer);
        if (value !== undefined && (Array.isArray(value) || isPlainObject(value))) {
          topLevelData.push({ name: declaration.name.text, value });
        }
      }
    }
  }

  visit(sourceFile);
  return { topLevelData, jsxText: dedupeAdjacentText(jsxText) };

  function visit(node) {
    if (ts.isJsxText(node)) {
      const text = cleanText(node.getText(sourceFile));
      if (text) jsxText.push(text);
      return;
    }
    if (ts.isJsxExpression(node) && node.expression) {
      const value = evaluateLiteral(node.expression);
      if (typeof value === "string") {
        const text = cleanText(value);
        if (text) jsxText.push(text);
      }
    }
    ts.forEachChild(node, visit);
  }
}

function evaluateLiteral(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) {
    return node.operator === ts.SyntaxKind.MinusToken ? -Number(node.operand.text) : Number(node.operand.text);
  }
  if (ts.isArrayLiteralExpression(node)) {
    const values = [];
    for (const element of node.elements) {
      const value = evaluateLiteral(element);
      if (value !== undefined) values.push(value);
    }
    return values;
  }
  if (ts.isObjectLiteralExpression(node)) {
    const object = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const key = propertyName(property.name);
      if (!key) continue;
      const value = evaluateLiteral(property.initializer);
      if (value !== undefined) object[key] = value;
    }
    return object;
  }
  return undefined;
}

function propertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return String(name.text);
  return null;
}

function page(name, content) {
  return {
    sourceId: slugify(name),
    name,
    type: "text",
    content: content || "<p></p>"
  };
}

function listPage(name, items) {
  const flat = items.flat().filter(Boolean);
  return page(name, flat.every((item) => String(item).trim().startsWith("<"))
    ? flat.join("\n")
    : renderList(flat));
}

function sectionList(title, items) {
  if (!Array.isArray(items) || !items.length) return "";
  return `<h2>${escapeHtml(title)}</h2>${renderList(items)}`;
}

function renderFields(fields, body = "") {
  const rows = fields
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${renderInlineValue(value)}</li>`)
    .join("");
  const intro = String(body ?? "").trim() ? renderParagraphs([body]) : "";
  return `${rows ? `<div class="statblockcenter"><ul>${rows}</ul></div>` : ""}${intro}`;
}

function renderValueAsHtml(value) {
  if (Array.isArray(value)) {
    if (value.every(isPlainObject)) {
      return value.map((item) => renderObjectSection(item)).join("\n");
    }
    return renderList(value);
  }
  if (isPlainObject(value)) return renderObjectSection(value);
  return renderParagraphs([value]);
}

function renderObjectSection(object) {
  const title = object.name ?? object.title ?? object.year ?? "";
  const rows = Object.entries(object)
    .filter(([key]) => !["name", "title"].includes(key))
    .map(([key, value]) => `<li><strong>${escapeHtml(titleFromIdentifier(key))}:</strong> ${renderInlineValue(value)}</li>`)
    .join("");
  return `${title ? `<h2>${escapeHtml(title)}</h2>` : ""}${rows ? `<div class="statblockcenter"><ul>${rows}</ul></div>` : ""}`;
}

function renderInlineValue(value) {
  if (Array.isArray(value)) return renderList(value);
  if (isPlainObject(value)) return renderObjectSection(value);
  return escapeHtml(value);
}

function renderList(items) {
  return `<ul>${items.map((item) => `<li>${renderInlineValue(item)}</li>`).join("")}</ul>`;
}

function renderParagraphs(values) {
  return values
    .flatMap((value) => String(value ?? "").split(/\n{2,}/))
    .map((value) => cleanText(value))
    .filter(Boolean)
    .map((value) => `<p>${escapeHtml(value)}</p>`)
    .join("\n");
}

function collectAssets(source, filePath) {
  const matches = Array.from(source.matchAll(/["']([^"']+\.(?:png|jpe?g|webp|gif))["']/gi), (match) => match[1]);
  return matches
    .filter((asset) => !/^https?:\/\//i.test(asset))
    .map((asset) => ({
      sourcePath: asset.startsWith("/")
        ? path.join(symbaroumloreRoot, "client", "public", asset)
        : path.resolve(path.dirname(filePath), asset),
      targetPath: `assets/imported/symbaroumlore/${asset.replace(/^\/+/, "")}`
    }));
}

function collectTenebreAsset(image, category) {
  if (!image) return [];
  const relative = String(image).replace(/^\/+/, "");
  return [{
    sourcePath: path.join(tenebreRoot, "public", relative),
    targetPath: `assets/imported/tenebre-chronicle/${category}/${path.basename(relative)}`
  }];
}

function copyManifestAssets(manifest) {
  for (const source of manifest.sources) {
    for (const entry of source.entries) {
      for (const asset of entry.assets ?? []) {
        if (!asset.sourcePath || !asset.targetPath || !fs.existsSync(asset.sourcePath)) continue;
        const target = path.join(root, asset.targetPath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(asset.sourcePath, target);
      }
    }
  }
}

function stripLocalSourceMetadata(manifest) {
  for (const source of manifest.sources) {
    for (const entry of source.entries) {
      delete entry.sourceFile;
      for (const asset of entry.assets ?? []) {
        delete asset.sourcePath;
      }
    }
  }
}

function toRelationship(type, values) {
  return (values ?? []).filter(Boolean).map((name) => ({ type, name }));
}

function pickKnown(object, keys) {
  return Object.fromEntries(keys.filter((key) => object?.[key] !== undefined).map((key) => [key, object[key]]));
}

function withHash(entry) {
  const stable = { ...entry };
  delete stable.sourceHash;
  return {
    ...entry,
    sourceHash: crypto.createHash("sha256").update(JSON.stringify(stable)).digest("hex")
  };
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

function titleFromIdentifier(value) {
  return String(value ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[{}]/g, "")
    .trim();
}

function dedupeAdjacentText(values) {
  const result = [];
  for (const value of values) {
    if (result[result.length - 1] !== value) result.push(value);
  }
  return result;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
