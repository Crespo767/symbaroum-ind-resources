import { normalize } from "./utils.mjs";

/**
 * Categorias de itens para sobrecarga.
 * ZERO = não conta (roupas, containers leves)
 * ONE  = 1 espaço (equipamento padrão)
 * TWO  = 2 espaços (armas Maciças)
 */
export const ENC_SLOTS = { ZERO: 0, ONE: 1, TWO: 2 };

const DEFAULT_WEIGHT_CONFIG = { version: 2, items: {}, bundles: {} };

let baseWeightConfig = DEFAULT_WEIGHT_CONFIG;
let dynamicWeightConfig = emptyWeightConfig();
let weightConfig = DEFAULT_WEIGHT_CONFIG;
let baseWeightConfigFingerprint = JSON.stringify(DEFAULT_WEIGHT_CONFIG);

export async function loadEncumbranceWeights(moduleId) {
  const url = `modules/${moduleId}/data/encumbrance-weights.json`;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const nextConfig = sanitizeWeightConfig(await response.json());
    const nextFingerprint = JSON.stringify(nextConfig);
    if (nextFingerprint === baseWeightConfigFingerprint) return false;
    baseWeightConfig = nextConfig;
    baseWeightConfigFingerprint = nextFingerprint;
  } catch (err) {
    const nextFingerprint = JSON.stringify(DEFAULT_WEIGHT_CONFIG);
    const changed = baseWeightConfigFingerprint !== nextFingerprint;
    baseWeightConfig = DEFAULT_WEIGHT_CONFIG;
    baseWeightConfigFingerprint = nextFingerprint;
    console.warn(`Tenebre Resources | Could not load ${url}; using built-in encumbrance weights.`, err);
    if (!changed) return false;
  }
  rebuildWeightConfig();
  return true;
}

export function applyDynamicEncumbranceWeights(config) {
  dynamicWeightConfig = sanitizeWeightConfig(config, emptyWeightConfig());
  rebuildWeightConfig();
}

export function getDynamicEncumbranceWeights() {
  return {
    version: 2,
    items: { ...dynamicWeightConfig.items },
    bundles: cloneBundles(dynamicWeightConfig.bundles)
  };
}

export function hasConfiguredEncumbranceRule(itemName) {
  return Boolean(findExactItemEntry(itemName, weightConfig.items) || findExactItemEntry(itemName, weightConfig.bundles));
}

export function upsertDynamicSlotRule(itemName, slots) {
  const itemNameText = String(itemName ?? "").trim();
  const sanitizedSlots = Number(slots);
  if (!itemNameText || !Number.isFinite(sanitizedSlots) || sanitizedSlots < 0) return false;

  dynamicWeightConfig.items[itemNameText] = sanitizedSlots;
  rebuildWeightConfig();
  return true;
}

/**
 * Retorna o valor base de encumbrance para um item baseado em seu nome.
 * Prioridade: flag manual > JSON de pesos > fallback (1).
 */
export function detectEncumbranceSlots(itemName) {
  const entry = findExactItemEntry(itemName, weightConfig.items);
  return entry ? entry.value : ENC_SLOTS.ONE;
}

export function hasExactEncumbranceItem(itemName) {
  return Boolean(findExactItemEntry(itemName, weightConfig.items));
}

/**
 * Verifica se um item tem a qualidade Maciça (Massive) na descrição.
 */
export function hasMassiveQuality(item) {
  const desc = normalize(item?.system?.description || "");
  const ref = normalize(item?.system?.reference || "");
  const name = normalize(item?.name || "");
  const quality = normalize(item?.system?.quality || "");

  const massiveTerms = ["macica", "maciça", "massive"];
  for (const term of massiveTerms) {
    if (desc.includes(term) || ref.includes(term) || name.includes(term) || quality.includes(term)) return true;
  }

  const qualities = item?.system?.qualities;
  if (qualities) {
    if (qualities.massive === true) return true;
    const qualStr = typeof qualities === "string" ? normalize(qualities) : "";
    for (const term of massiveTerms) {
      if (qualStr.includes(term)) return true;
    }
  }
  return false;
}

/**
 * Regra de pacote para itens empilhados.
 */
export function getStackBundleRule(itemName) {
  return findExactItemEntry(itemName, weightConfig.bundles)?.value ?? null;
}

/**
 * Calcula a carga de uma pilha usando uma regra de pacote validada.
 */
export function calculateStackBundleSlots(quantity, rule) {
  const amount = Math.max(0, Math.floor(Number(quantity) || 0));
  const bundleSize = Math.floor(Number(rule?.bundleSize));
  const slots = Number(rule?.slots);
  if (!Number.isFinite(bundleSize) || bundleSize <= 1 || !Number.isFinite(slots) || slots < 0) return 0;
  return Math.floor(amount / bundleSize) * slots;
}

function rebuildWeightConfig() {
  weightConfig = {
    version: 2,
    items: { ...baseWeightConfig.items, ...dynamicWeightConfig.items },
    bundles: { ...baseWeightConfig.bundles, ...dynamicWeightConfig.bundles }
  };
}

function sanitizeWeightConfig(config, fallback = DEFAULT_WEIGHT_CONFIG) {
  const fallbackItems = fallback.items ?? {};
  const fallbackBundles = fallback.bundles ?? {};

  const items = {
    ...fallbackItems,
    ...sanitizeItems(config?.items),
    ...legacySlotsToItems(config?.slots)
  };
  const bundles = {
    ...fallbackBundles,
    ...sanitizeBundles(config?.bundles)
  };

  return {
    version: 2,
    items,
    bundles
  };
}

function sanitizeItems(items) {
  if (!items || typeof items !== "object" || Array.isArray(items)) return {};
  return Object.fromEntries(Object.entries(items)
    .map(([name, slots]) => [String(name ?? "").trim(), Number(slots)])
    .filter(([name, slots]) => name && Number.isFinite(slots) && slots >= 0));
}

function sanitizeBundles(bundles) {
  if (!bundles) return {};

  if (Array.isArray(bundles)) {
    const entries = {};
    for (const rule of bundles) {
      const bundle = sanitizeBundleValue(rule);
      if (!bundle) continue;
      for (const alias of sanitizeAliases(rule?.aliases)) {
        entries[alias] = bundle;
      }
    }
    return entries;
  }

  if (typeof bundles !== "object") return {};
  return Object.fromEntries(Object.entries(bundles)
    .map(([name, value]) => [String(name ?? "").trim(), sanitizeBundleValue(value)])
    .filter(([name, value]) => name && value));
}

function sanitizeBundleValue(value) {
  const source = typeof value === "number" ? { bundleSize: value, slots: ENC_SLOTS.ONE } : value;
  const bundleSize = Math.floor(Number(source?.bundleSize));
  if (!Number.isFinite(bundleSize) || bundleSize <= 1) return null;

  const slots = Number(source?.slots ?? ENC_SLOTS.ONE);
  if (!Number.isFinite(slots) || slots < 0) return null;
  return { bundleSize, slots };
}

function legacySlotsToItems(slots) {
  if (!Array.isArray(slots)) return {};
  const items = {};
  for (const rule of slots) {
    const value = Number(rule?.slots);
    if (!Number.isFinite(value) || value < 0) continue;
    for (const alias of sanitizeAliases(rule?.aliases)) {
      items[alias] = value;
    }
  }
  return items;
}

function sanitizeAliases(aliases) {
  if (!Array.isArray(aliases)) return [];
  return aliases.map((alias) => String(alias ?? "").trim()).filter(Boolean);
}

function cloneBundles(bundles) {
  return Object.fromEntries(Object.entries(bundles ?? {}).map(([name, rule]) => [
    name,
    { bundleSize: rule.bundleSize, slots: rule.slots }
  ]));
}

function emptyWeightConfig() {
  return { version: 2, items: {}, bundles: {} };
}

function findExactItemEntry(itemName, entries) {
  const normalizedName = normalize(itemName || "");
  if (!normalizedName || !entries) return null;

  for (const [name, value] of Object.entries(entries)) {
    if (normalize(name) === normalizedName) return { name, value };
  }
  return null;
}
