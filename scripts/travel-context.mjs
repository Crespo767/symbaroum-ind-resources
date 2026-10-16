import { isDeathIncapacitated } from "./death-automation.mjs";
import { MODULE_ID } from "./constants.mjs";
import { EncumbranceService } from "./encumbrance.mjs";
import { HungerService } from "./hunger.mjs";
import { orientationBoon, orientationContext } from "./expedition-orientation.mjs";
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
export function expeditionTravel(party) {
  // Ignore os controles antigos: busca pertence ao passo 3 e jornada ao Grupo.
  const { searchRule: _legacySearchRule, participantRefs: _legacyParticipants, mounts: _legacyMounts, ...raw } = getActorExpeditionData(party).travel ?? {};
  const region = party?.system?.location?.region || "ambria";
  return { ...raw, ...normalizeTravelConfiguration({ ...raw, terrain: { ambria: "plains", bright: "brightDavokar", wild: "brightDavokar", dark: "darkDavokar" }[region] }),
    region, activity: raw.activity === "stay" ? "stay" : "travel", site: String(raw.site ?? ""),
    configured: Boolean(raw.configured) };
}
export function effectiveExpeditionSearch(party) {
  const travel = expeditionTravel(party);
  return Boolean(getActorExpeditionData(party).activeSearch) && TRAVEL_MODES.indexOf(travel.mode) % 3 === 0 && travel.activity === "travel";
}
export function partyTravelReferences(party) {
  const exp = getActorExpeditionData(party);
  return [...new Set([...(party.system?.members ?? []), ...(party.system?.companions ?? []), exp.guideUuid || exp.guideId,
    party.system?.storageLocation?.draftAnimal?.uuid].filter(Boolean))];
}
export async function resolvePartyTravelActors(party) {
  return (await Promise.all(partyTravelReferences(party).map(resolveActorReference))).filter(Boolean);
}
export function hasEnduringMarch(actor) { return orientationBoon(actor, ["enduring march", "enduringmarch", "marcha duradoura"]).level > 0; }
export function actorTravelProfile(actor, config, mount = null, { collective = false } = {}) {
  const riding = config.mode.endsWith("Ride");
  // Na cavalgada coletiva, o modo presume montarias disponíveis ao grupo.
  // Sem vínculos individuais, não atribua ao cavalo a carga ou Fome do cavaleiro.
  const collectiveRide = collective && riding;
  const carrier = riding ? mount : actor;
  const load = carrier && travelSetting("enableEncumbrance") && travelSetting("enableMovementEncumbranceModifier") ? EncumbranceService.calculateLoad(carrier) : {};
  const hungry = Boolean(carrier && travelSetting("enableMovementHungerModifier") && globalThis.game?.settings && HungerService.hasHunger(carrier));
  const pace = TRAVEL_MODES.indexOf(config.mode) % 3;
  const incapacitated = Boolean(carrier && isDeathIncapacitated(carrier));
  const blocked = incapacitated || (!carrier && !collectiveRide) || Boolean(load.isImmobilized) || (Boolean(load.isOverloaded) && pace === 2);
  const effort = Math.min(2, pace + (load.isOverloaded ? 1 : 0));
  return { ref: actorReference(actor), name: actor?.name ?? "", mountRef: actorReference(mount) ?? "",
    hungry, incapacitated, overload: Number(load.overload) || 0, blocked, missingMount: riding && !mount && !collectiveRide,
    effort, enduring: hasEnduringMarch(actor), rate: blocked ? 0 : getTravelRate(config) * (hungry ? 0.5 : 1) };
}
export function partyTravelPreview(party, actors = partyTravelReferences(party).map(resolveActorReferenceSync).filter(Boolean)) {
  const config = expeditionTravel(party);
  const byRef = new Map(actors.map(a => [actorReference(a), a]));
  const profiles = [...byRef.values()].map(actor => actorTravelProfile(actor, config, null, { collective: true }));
  for (const ref of partyTravelReferences(party)) {
    if (!actors.some(a => actorReference(a) === ref || a.uuid === ref)) profiles.push({ ref, name: ref, blocked: true, rate: 0, missingActor: true });
  }
  const rate = config.activity === "stay" || !profiles.length ? 0 : Math.min(...profiles.map(p => p.rate));
  return { config, profiles, rate, activeSearch: effectiveExpeditionSearch(party),
    blocked: config.activity === "travel" && (!profiles.length || profiles.some(p => p.blocked)),
    hasEnduring: profiles.some(p => p.enduring), stayDays: Math.max(1, Number(getActorExpeditionData(party).day) - Number(config.stayStartDay ?? getActorExpeditionData(party).day) + 1) };
}
export function findTravelParties(actor) {
  if (!actor) return [];
  return [...(globalThis.game?.actors?.values?.() ?? [])].filter(p => p.type === `${MODULE_ID}.party` && getActorExpeditionData(p).active && expeditionTravel(p).configured
    && partyTravelPreview(p).profiles.some(profile => profile.ref === actorReference(actor)));
}
export function findTravelParty(actor) {
  const matches = findTravelParties(actor);
  return matches.length === 1 ? matches[0] : null;
}
export function journeyContextKey(party, actors) {
  const resolved = actors ?? partyTravelReferences(party).map(resolveActorReferenceSync).filter(Boolean);
  const preview = partyTravelPreview(party, resolved), exp = getActorExpeditionData(party);
  const { revision: _revision, ...configuration } = preview.config;
  const basis = JSON.stringify([expeditionDayKey(party), configuration, preview.profiles.map(({name,...p}) => p), exp.activeSearch, exp.tables, exp.guideUuid || exp.guideId,
    ["enableHunger","enableEncumbrance","enableMovementHungerModifier","enableMovementEncumbranceModifier"].map(k => travelSetting(k)),
    ["alwaysSucceedOnOne","optionalCrit","optionalRareCrit"].map(k => { try { return globalThis.game?.settings?.get?.("symbaroum",k) ?? false; } catch { return false; } }),
    resolved.map(a => { const context = orientationContext(a); return [actorReference(a), Object.fromEntries(Object.entries(a.system?.attributes ?? {}).map(([k,v]) => [k,Number(typeof v === "object" ? v?.total ?? v?.value : v) || 0])), context.bonus, context.favour, context.pathfinder]; })]);
  // Impressão de estado para detectar alterações; nunca publica os atributos usados.
  let left = 2166136261, right = 2246822519;
  for (let i=0;i<basis.length;i++) { left = Math.imul(left ^ basis.charCodeAt(i),16777619); right = Math.imul(right ^ basis.charCodeAt(i),3266489917); }
  return `${(left>>>0).toString(16).padStart(8,"0")}${(right>>>0).toString(16).padStart(8,"0")}`;
}

export function naturalRecoveryDuringJourney(actor) {
  return findTravelParties(actor).every(party => recoveryInParty(actor, party));
}
function recoveryInParty(actor, party) {
  const preview = partyTravelPreview(party), profile = preview.profiles.find(p => p.ref === actorReference(actor));
  if (preview.config.activity === "stay" || profile?.effort === 0) return true;
  if (profile?.effort === 2 || profile?.blocked) return false;
  if (profile?.enduring) return true;
  const receipt = actor.flags?.[MODULE_ID]?.journeyReceipt;
  return Boolean(receipt?.day === expeditionDayKey(party) && receipt?.party === party.uuid && receipt?.context === journeyContextKey(party) && receipt?.allowNaturalRecovery);
}
