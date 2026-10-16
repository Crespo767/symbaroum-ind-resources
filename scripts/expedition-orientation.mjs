import { HungerService } from "./hunger.mjs";
import { normalizeText } from "./utils.mjs";
import { evaluateRoll, rollTotal } from "./dice.mjs";

export function orientationRequirements(level, region) {
  const required = { ambria: 0, bright: 1, wild: 2, dark: 3 }[region] ?? 0;
  return { eligible: required === 0 || level >= 1, eventBenefits: level >= required, required };
}

export function orientationBoon(actor, aliases) {
  let selected = { level: 0, item: null };
  for (const item of actor?.items ?? []) {
    if (!["boon", "trait", "ability"].includes(item.type)) continue;
    const ref = normalizeText(item.system?.reference ?? "");
    const name = normalizeText(item.name ?? "");
    if (!aliases.some(alias => ref === alias || name === alias || name.startsWith(`${alias} `) || name.startsWith(`${alias} (`))) continue;
    const suffix = /\b(iii|3|mestre|master)\b/.test(name) ? 3 : /\b(ii|2|adepto|adept)\b/.test(name) ? 2 : 1;
    const level = Math.max(1, Math.min(3, Math.trunc(Number(item.system?.level) || suffix)));
    if (level > selected.level) selected = { level, item };
  }
  return selected;
}

export function orientationContext(actor) {
  let bonus = 0;
  const bonuses = [];
  for (const aliases of [["cartographer", "cartografo"], ["green thumb", "greenthumb", "dedo verde"]]) {
    const { level, item } = orientationBoon(actor, aliases);
    if (!item) continue;
    // O sistema já soma system.bonus.vigilant das dádivas ao atributo preparado.
    let prepared = Number(item.system?.bonus?.vigilant) || 0;
    for (const effect of actor.effects ?? []) {
      if (effect.disabled || effect.isSuppressed || !item.uuid || effect.origin !== item.uuid) continue;
      for (const change of effect.changes ?? []) {
        if (Number(change.mode) === 2 && /^system\.attributes\.vigilant\.(value|bonus|total)$/.test(change.key)) prepared += Number(change.value) || 0;
      }
    }
    const additional = Math.max(0, level - Math.max(0, prepared));
    bonus += additional;
    bonuses.push({ name: item.name, level, additional });
  }
  const pathfinder = orientationBoon(actor, ["pathfinder", "desbravador"]).level > 0;
  // Fome mantém duas chances de falhar, como nos testes nativos do módulo.
  const favour = globalThis.game?.settings ? HungerService.applyDisfavour(pathfinder ? 1 : 0, actor) : (pathfinder ? 1 : 0);
  return { bonus, favour, bonuses, pathfinder };
}

export function boundOrientationTarget(target) {
  return ["alwaysSucceedOnOne", "optionalCrit", "optionalRareCrit"].some(key => globalThis.game?.settings?.get?.("symbaroum", key))
    ? Math.min(19, Math.max(1, target)) : target;
}

/** A API nativa avalia dados/opções sem criar chat. O fallback cobre ambientes sem API. */
export async function rollOrientationTest(actor, modifier, favour) {
  const api = globalThis.game?.symbaroum?.api;
  if (typeof api?.baseRoll === "function") {
    const result = await api.baseRoll(actor, "vigilant", null, null, favour, modifier, false);
    if (!Number.isFinite(result?.diceResult) || !Number.isFinite(result?.diceTarget) || typeof result?.hasSucceed !== "boolean" || !Array.isArray(result?.rolls) || !result.rolls.length) throw new Error("Invalid native orientation test result.");
    return { total: result.diceResult, target: result.diceTarget, success: result.hasSucceed, rolls: result.rolls };
  }
  const value = actor?.system?.attributes?.vigilant;
  let target = (Number(typeof value === "object" ? value?.total ?? value?.value : value) || 0) + modifier;
  target = boundOrientationTarget(target);
  const roll = await evaluateRoll(favour > 0 ? "2d20kl" : favour < 0 ? "2d20kh" : "1d20");
  const rolls = [roll];
  if (globalThis.game?.settings?.get?.("symbaroum", "optionalRareCrit") && [1, 20].includes(rollTotal(roll))) rolls.push(await evaluateRoll("1d20"));
  return { total: rollTotal(roll), target, success: rollTotal(roll) <= target, rolls };
}
