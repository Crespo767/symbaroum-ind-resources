const QUALITY_TOOLTIP_KEYS = Object.freeze({
  flexible: "TENEBRE.WeaponQualityTooltip.flexible",
  bastard: "TENEBRE.WeaponQualityTooltip.bastard",
  returning: "TENEBRE.WeaponQualityTooltip.returning",
  blunt: "TENEBRE.WeaponQualityTooltip.blunt",
  short: "TENEBRE.WeaponQualityTooltip.short",
  unwieldy: "TENEBRE.WeaponQualityTooltip.unwieldy",
  wrecking: "TENEBRE.WeaponQualityTooltip.wrecking",
  concealed: "TENEBRE.WeaponQualityTooltip.concealed",
  balanced: "TENEBRE.WeaponQualityTooltip.balanced",
  deepImpact: "TENEBRE.WeaponQualityTooltip.deepImpact",
  jointed: "TENEBRE.WeaponQualityTooltip.jointed",
  ensnaring: "TENEBRE.WeaponQualityTooltip.ensnaring",
  long: "TENEBRE.WeaponQualityTooltip.long",
  massive: "TENEBRE.WeaponQualityTooltip.massive",
  precise: "TENEBRE.WeaponQualityTooltip.precise",
  bloodLetting: "TENEBRE.WeaponQualityTooltip.bloodLetting",
  areaMeleeRadius: "TENEBRE.WeaponQualityTooltip.areaMeleeRadius",
  areaShortRadius: "TENEBRE.WeaponQualityTooltip.areaShortRadius",
  areaCone: "TENEBRE.WeaponQualityTooltip.areaCone",
  acidcoated: "TENEBRE.WeaponQualityTooltip.acidcoated",
  bane: "TENEBRE.WeaponQualityTooltip.bane",
  deathrune: "TENEBRE.WeaponQualityTooltip.deathrune",
  desecrated: "TENEBRE.WeaponQualityTooltip.desecrated",
  flaming: "TENEBRE.WeaponQualityTooltip.flaming",
  hallowed: "TENEBRE.WeaponQualityTooltip.hallowed",
  poison: "TENEBRE.WeaponQualityTooltip.poison",
  thundering: "TENEBRE.WeaponQualityTooltip.thundering",
  mystical: "TENEBRE.WeaponQualityTooltip.mystical",
  staffFightingCompatibility: "TENEBRE.WeaponQualityTooltip.staffFightingCompatibility",
  swordSaintCompatibility: "TENEBRE.WeaponQualityTooltip.swordSaintCompatibility",
  knifePlayCompatibility: "TENEBRE.WeaponQualityTooltip.knifePlayCompatibility",
  staffMagicCompatibility: "TENEBRE.WeaponQualityTooltip.staffMagicCompatibility"
});

export function weaponQualityTooltipKey(qualityId) {
  return QUALITY_TOOLTIP_KEYS[String(qualityId ?? "")] ?? null;
}

export function extractWeaponQualityId(label) {
  const target = String(label?.getAttribute?.("for") ?? "");
  const marker = "system.qualities.";
  const start = target.lastIndexOf(marker);
  return start >= 0 ? target.slice(start + marker.length) : null;
}

export function injectWeaponQualityTooltips(root, i18n = globalThis.game?.i18n) {
  if (!root?.querySelectorAll || !i18n?.localize) return 0;
  let applied = 0;
  const selector = '.tab[data-tab="qualities"] label[for*="system.qualities."]';
  for (const label of root.querySelectorAll(selector)) {
    const key = weaponQualityTooltipKey(extractWeaponQualityId(label));
    if (!key) continue;
    const description = i18n.localize(key);
    if (!description || description === key) continue;
    label.dataset.tooltip = description;
    label.dataset.tooltipDirection = "UP";
    label.dataset.tenebreQualityTooltip = "true";
    label.setAttribute("aria-description", description);
    applied += 1;
  }
  return applied;
}
