import { isDeathIncapacitated } from "./death-automation.mjs";
import { MODULE_ID } from "./constants.mjs";
import { EncumbranceService } from "./encumbrance.mjs";
import { HungerService } from "./hunger.mjs";
import { orientationContext } from "./expedition-orientation.mjs";
import { actorReference, resolveActorReference, resolveActorReferenceSync } from "./actor-references.mjs";
import { getActorExpeditionData, expeditionDayKey } from "./expedition-state.mjs";

export const TRAVEL_RATES_KM_PER_DAY = Object.freeze({
  plains: Object.freeze({ dayMarch: 20, forcedMarch: 40, mortalMarch: 60, dayRide: 40, forcedRide: 60, mortalRide: 70 }),
  brightDavokar: Object.freeze({ dayMarch: 20, forcedMarch: 30, mortalMarch: 40, dayRide: 30, forcedRide: 45, mortalRide: 50 }),
  darkDavokar: Object.freeze({ dayMarch: 10, forcedMarch: 15, mortalMarch: 20, dayRide: 10, forcedRide: 15, mortalRide: 20 })
});
export const TRAVEL_MODES = ["dayMarch", "forcedMarch", "mortalMarch", "dayRide", "forcedRide", "mortalRide"];
const TERRAINS = ["plains", "brightDavokar", "darkDavokar"];
export function travelSetting(key, fallback = true) {
  try { return globalThis.game?.settings?.get?.(MODULE_ID, key) ?? fallback; } catch { return fallback; }
}
export function normalizeTravelConfiguration(value = {}) {
  return { terrain: TERRAINS.includes(value?.terrain) ? value.terrain : "plains",
    mode: TRAVEL_MODES.includes(value?.mode) ? value.mode : "dayMarch",
    alongRiver: value?.alongRiver === true || value?.alongRiver === "true" };
}
export function getTravelRate({ terrain = "plains", mode = "dayMarch", alongRiver = false } = {}) {
  const index = Math.max(0, TERRAINS.indexOf(terrain) - (alongRiver ? 1 : 0));
  return TRAVEL_RATES_KM_PER_DAY[TERRAINS[index]]?.[mode] ?? 20;
}
// Journey/stay configuration was retired. Only the explicit step 3 toggle applies.
export function effectiveExpeditionSearch(party) {
  return Boolean(getActorExpeditionData(party).activeSearch);
}
export function partyTravelReferences(party) {
  const exp = getActorExpeditionData(party);
  return [...new Set([...(party.system?.members ?? []), ...(party.system?.companions ?? []), exp.guideUuid || exp.guideId,
    party.system?.storageLocation?.draftAnimal?.uuid].filter(Boolean))];
}
export async function resolvePartyTravelActors(party) {
  return (await Promise.all(partyTravelReferences(party).map(resolveActorReference))).filter(Boolean);
}
export function actorTravelProfile(actor, config, mount = null) {
  const riding = config.mode.endsWith("Ride");
  const carrier = riding ? mount : actor;
  const load = carrier && travelSetting("enableEncumbrance") && travelSetting("enableMovementEncumbranceModifier") ? EncumbranceService.calculateLoad(carrier) : {};
  const hungry = Boolean(carrier && travelSetting("enableMovementHungerModifier") && globalThis.game?.settings && HungerService.hasHunger(carrier));
  const pace = TRAVEL_MODES.indexOf(config.mode) % 3;
  const incapacitated = Boolean(carrier && isDeathIncapacitated(carrier));
  const blocked = incapacitated || !carrier || Boolean(load.isImmobilized) || (Boolean(load.isOverloaded) && pace === 2);
  return { ref: actorReference(actor), name: actor?.name ?? "", mountRef: actorReference(mount) ?? "",
    hungry, incapacitated, overload: Number(load.overload) || 0, blocked, missingMount: riding && !mount,
    rate: blocked ? 0 : getTravelRate(config) * (hungry ? 0.5 : 1) };
}
export function journeyContextKey(party, actors) {
  const resolved = actors ?? partyTravelReferences(party).map(resolveActorReferenceSync).filter(Boolean);
  const exp = getActorExpeditionData(party);
  const basis = JSON.stringify([expeditionDayKey(party), party?.system?.location?.region ?? "ambria", partyTravelReferences(party), exp.activeSearch, exp.tables, exp.guideUuid || exp.guideId,
    ["enableHunger","enableEncumbrance","enableMovementHungerModifier","enableMovementEncumbranceModifier"].map(k => travelSetting(k)),
    ["alwaysSucceedOnOne","optionalCrit","optionalRareCrit"].map(k => { try { return globalThis.game?.settings?.get?.("symbaroum",k) ?? false; } catch { return false; } }),
    resolved.map(a => { const context = orientationContext(a); return [actorReference(a), Object.fromEntries(Object.entries(a.system?.attributes ?? {}).map(([k,v]) => [k,Number(typeof v === "object" ? v?.total ?? v?.value : v) || 0])), context.bonus, context.favour, context.pathfinder]; })]);
  // Impressão de estado para detectar alterações; nunca publica os atributos usados.
  let left = 2166136261, right = 2246822519;
  for (let i=0;i<basis.length;i++) { left = Math.imul(left ^ basis.charCodeAt(i),16777619); right = Math.imul(right ^ basis.charCodeAt(i),3266489917); }
  return `${(left>>>0).toString(16).padStart(8,"0")}${(right>>>0).toString(16).padStart(8,"0")}`;
}
