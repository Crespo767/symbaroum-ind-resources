import { normalize } from "./utils.mjs";

const HERBAL_CURE_NAMES = new Set(["cura herbal", "herbal cure"]);

export function isHerbalCureItem(item) {
  if (!item || item.type !== "equipment") return false;
  const reference = normalize(item.system?.reference).replace(/[\s_-]+/g, "");
  return reference === "herbalcure" || HERBAL_CURE_NAMES.has(normalize(item.name).trim());
}

export function medicusLevel(actor) {
  const ability = Array.from(actor?.items?.values?.() ?? []).find((item) => {
    return normalize(item?.system?.reference).trim() === "medicus"
      || normalize(item?.name).trim() === "medico";
  });
  if (!ability) return 0;

  const nativeLevel = Number(ability.getLevel?.().level);
  if (Number.isFinite(nativeLevel)) return Math.max(0, Math.min(3, nativeLevel));
  if (ability.system?.master?.isActive) return 3;
  if (ability.system?.adept?.isActive) return 2;
  if (ability.system?.novice?.isActive) return 1;
  return 0;
}

export function herbalCureFormula(level, success) {
  const normalizedLevel = Math.max(0, Math.min(3, Number(level) || 0));
  if (normalizedLevel === 0) return success ? "1" : null;
  if (!success) return normalizedLevel === 3 ? "1d6" : null;
  return normalizedLevel === 1 ? "1d6" : normalizedLevel === 2 ? "1d8" : "1d10";
}

export function resolveHerbalCureTarget(actor, targets = globalThis.game?.user?.targets) {
  const selected = Array.from(targets ?? []);
  if (selected.length > 1) return { error: "multiple", actor: null };
  return { error: null, actor: selected[0]?.actor ?? actor ?? null };
}

export function isSelfHerbalCure(sourceActor, targetActor) {
  if (!sourceActor || !targetActor) return false;
  if (sourceActor === targetActor) return true;
  const sourceUuid = String(sourceActor.uuid ?? "");
  const targetUuid = String(targetActor.uuid ?? "");
  if (sourceUuid && targetUuid) return sourceUuid === targetUuid;
  const sourceId = String(sourceActor.id ?? "");
  const targetId = String(targetActor.id ?? "");
  return Boolean(sourceId && targetId && sourceId === targetId);
}
