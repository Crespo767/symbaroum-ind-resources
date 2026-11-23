import { normalize } from "./utils.mjs";

export const REGIONS = Object.freeze({
  bright: { tier: 1, events: 0, mishaps: 0 },
  wild: { tier: 2, events: 2, mishaps: 5 },
  dark: { tier: 3, events: 5, mishaps: 10 }
});

export const EVENT_KEYS = ["ruins", "encounters", "enemies", "terrain"];
export const PREPARATIONS = {
  none: { orientation: 0, hazards: 0 },
  reliable: { orientation: 1, hazards: -1 },
  misleading: { orientation: -1, hazards: 1 },
  research: { orientation: 1, hazards: -1 },
  deepResearch: { orientation: 1, hazards: -2 }
};

const BOONS = {
  bushcraft: ["bushcraft", "mateiro"],
  cartographer: ["cartographer", "cartografo"],
  pathfinder: ["pathfinder", "desbravador", "explorador"]
};

function boonDetails(actor, key) {
  const names = BOONS[key];
  const canonical = "BOON_LABEL." + key.toUpperCase();
  const localized = normalize(globalThis.game?.i18n?.localize?.(canonical) ?? "");
  let found = { level: 0, item: null };
  for (const item of actor?.items?.values?.() ?? []) {
    if (!["boon", "trait", "ability"].includes(item.type)) continue;
    const id = normalize(item.system?.reference ?? item.system?.referenceKey ?? "").trim();
    const match = normalize(item.name ?? "").trim().match(/^(.+?)(?:[ (]+(iii|ii|iv|i|[1-4]|mestre|master|adepto|adept|novato|novice)\)?)?$/);
    if (!match || (id !== canonical.toLowerCase() && !names.includes(id) && !names.includes(match[1]) && match[1] !== localized)) continue;
    const tiers = { i: 1, ii: 2, iii: 3, iv: 4, master: 3, mestre: 3, adept: 2, adepto: 2, novice: 1, novato: 1 };
    const value = item.system?.level?.value ?? item.system?.level;
    const rank = Number(value) || tiers[normalize(value ?? "")] || (item.system?.master?.isActive ? 3 : item.system?.adept?.isActive ? 2 : 0);
    const level = Math.min(3, Math.max(rank, tiers[match[2]] ?? (Number(match[2]) || 1)));
    if (level > found.level) found = { level, item };
  }
  return found;
}

export function actorAttribute(actor, key) {
  const value = actor?.system?.attributes?.[key]?.total;
  return Number.isFinite(value) ? value : null;
}

export function guideProfile(actor) {
  const cartographer = boonDetails(actor, "cartographer").item;
  const native = Number(cartographer?.system?.bonus?.vigilant) || 0;
  const adjustments = [];
  for (const effect of actor?.effects ?? []) {
    if (effect.disabled || effect.isSuppressed || !cartographer?.uuid || effect.origin !== cartographer.uuid) continue;
    adjustments.push(...(effect.changes ?? []).filter(change => Number(change.mode) === 2
      && /^system\.attributes\.vigilant\.(value|bonus|total)$/.test(change.key)));
  }
  return {
    vigilant: actorAttribute(actor, "vigilant"),
    bushcraft: boonDetails(actor, "bushcraft").level,
    cartographer: Boolean(cartographer),
    cartographerIncluded: Math.max(0, native + adjustments.reduce((sum, change) => sum + (Number(change.value) || 0), 0)),
    pathfinder: boonDetails(actor, "pathfinder").level > 0
  };
}

export function orientationPlan(profile, config, clampTarget = false) {
  const tier = REGIONS[config.region].tier;
  const gap = tier - profile.bushcraft;
  const eligible = profile.vigilant !== null && profile.bushcraft > 0;
  const modifiers = {
    bushcraft: eligible && gap > 0 ? (gap === 1 ? -3 : -5) : 0,
    cartographer: profile.cartographer ? Math.max(0, config.cartographer - (profile.cartographerIncluded ?? 0)) : 0,
    preparation: PREPARATIONS[config.preparation].orientation,
    circumstance: config.circumstance
  };
  const modifier = Object.values(modifiers).reduce((total, item) => total + item, 0);
  const rawTarget = profile.vigilant === null ? null : profile.vigilant + modifier;
  const target = rawTarget !== null && clampTarget ? Math.min(19, Math.max(1, rawTarget)) : rawTarget;
  return { tier, eligible, fullBenefits: eligible && gap <= 0, modifiers, modifier, target };
}

export function orientationOutcome(plan, roll) {
  const margin = roll.diceTarget - roll.diceResult;
  const benefits = Boolean(roll.hasSucceed && plan.fullBenefits);
  const verdict = !roll.hasSucceed ? "failure" : !benefits ? "avoid" : margin >= 5 ? "great" : "success";
  return {
    verdict, margin, benefits, needsMishap: !roll.hasSucceed, target: roll.diceTarget, die: roll.diceResult,
    critical: roll.critSuccess ? "success" : roll.critFail ? "failure" : null
  };
}

export function eventPlan(key, config, orientation, { withoutOrientation = false } = {}) {
  const hazard = key === "enemies" || key === "terrain";
  const searching = ["off", "search"].includes(config.search);
  const eligible = orientation?.benefits && !withoutOrientation;
  const modifiers = {
    region: REGIONS[config.region].events,
    orientation: eligible ? (key === "ruins" && searching ? 2 : hazard ? (orientation.margin >= 5 ? -2 : -1) : 0) : 0,
    preparation: hazard ? (config.region === "dark" && config.preparation === "deepResearch" ? -1 : PREPARATIONS[config.preparation].hazards) : 0,
    river: key === "terrain" && config.river ? 2 : 0,
    search: key === "ruins" && !searching ? -5 : 0
  };
  return { modifiers, modifier: Object.values(modifiers).reduce((total, value) => total + value, 0) };
}

// Guia do Mestre PT-BR, pp. 98–99. The last row of each table includes its upper tail.
const DETECTION = [0, 3, 1, 5, 0, 3, -1, -5];
export function detectionModifier(total) {
  return Number.isInteger(total) && total >= 1 && total <= 8 ? DETECTION[total - 1] : null;
}

export function ruinFindsFormula(total) {
  if (total >= 23) return "3d12 + 2";
  if (total === 22) return "3d10 + 2";
  if (total === 21) return "3d8 + 2";
  if (total === 20) return "2d10 + 2";
  if (total === 19) return "2d8 + 2";
  if (total >= 17) return "2d6 + 2";
  if (total >= 13) return "1d6 + 2";
  return total >= 11 ? "1d4 + 2" : null;
}

export function corruptedNatureCount(total) {
  return total >= 23 ? 5 : total === 22 ? 3 : total === 21 ? 1 : 0;
}
