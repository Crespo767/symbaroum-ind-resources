import { isDeathIncapacitated } from "./death-automation.mjs";
import { MODULE_ID } from "./constants.mjs";
import { EncumbranceService } from "./encumbrance.mjs";
import { HungerService } from "./hunger.mjs";
import { actorReference } from "./actor-references.mjs";

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
