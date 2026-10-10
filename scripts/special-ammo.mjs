import { AMMO_TYPES, FLAG_SCOPE } from "./constants.mjs";
import { matchesAnyAlias, normalize } from "./utils.mjs";

const SPECIAL_AMMO = [
  {
    names: ["flecha de precisao", "flecha - precisao", "precision arrow", "arrow - precision", "precision bolt", "precise arrow", "precise bolt"],
    ammoType: AMMO_TYPES.ARROW,
    recoveryClass: "quality",
    description: "<p><strong>Qualidade:</strong> Precisa.</p><p>Projétil especialmente equilibrado, feito para acertar seus alvos com mais facilidade.</p>"
  },
  {
    names: ["ponta perfurante de armadura", "flecha - ponta perfurante de armadura", "arrow - armor-piercing head", "armor piercing tip", "armor-piercing tip", "armor piercing arrow", "armor piercing bolt", "bodkin arrow", "bodkin bolt"],
    ammoType: AMMO_TYPES.ARROW,
    recoveryClass: "quality",
    description: "<p><strong>Qualidade:</strong> Impacto Profundo contra alvos com Armadura maior que 1.</p><p>A ponta facilita perfurar armaduras.</p>"
  },
  {
    names: ["sibilante", "flecha - sibilante", "arrow - whistler", "whistler", "whistling arrow", "whistling bolt", "whistle arrow", "whistle bolt"],
    ammoType: AMMO_TYPES.ARROW,
    recoveryClass: "quality",
    description: "<p>A flecha assobia enquanto voa, funcionando como sinal para aliados.</p>"
  },
  {
    names: ["arpeu", "flecha - arpeu", "arrow - grappling hook", "grappling arrow", "grappling bolt", "grapple arrow", "grapple bolt"],
    ammoType: AMMO_TYPES.ARROW,
    recoveryClass: "quality",
    description: "<p>Envia um gancho até 10 metros na vertical ou 30 metros na horizontal. Um fio de seda permite içar uma corda mais resistente até o gancho.</p>"
  },
  {
    names: ["cabeca de martelo", "flecha - cabeca de martelo", "arrow - hammer head", "hammer head", "hammerhead arrow", "hammerhead bolt", "blunt arrow", "blunt bolt"],
    ammoType: AMMO_TYPES.ARROW,
    recoveryClass: "quality",
    description: "<p>Após um acerto, role o dano normalmente, mas use o resultado para testar se o alvo fica atordoado: <strong>[Vigoroso - Dano]</strong>. Teste de Resistência do alvo: [[/r 1d20]] contra seu Vigoroso modificado pelo dano. Se falhar, o alvo não executa ações no próximo turno.</p>"
  },
  {
    names: ["cauda de andorinha", "flecha - cauda de andorinha", "arrow - swallow's tail", "arrow - swallow’s tail", "swallowtail arrow", "swallowtail bolt", "swallow-tail arrow", "swallow-tail bolt"],
    ammoType: AMMO_TYPES.ARROW,
    recoveryClass: "quality",
    description: "<p>O alvo recebe +1D4 de bônus de Armadura contra este projétil, mas se sofrer dano sangra como descrito na qualidade Sangrenta.</p>"
  },
  {
    names: ["cortador de corda", "flecha - cortador de corda", "arrow - rope cutter", "rope cutter", "rope-cutter arrow", "rope-cutter bolt", "rope cutting arrow", "rope cutting bolt"],
    ammoType: AMMO_TYPES.ARROW,
    recoveryClass: "quality",
    description: "<p>Ponta em forma de Y usada para cortar cordas. Acertar a corda é difícil: -5 no Teste de ataque; sucesso corta a corda.</p>"
  },
  {
    names: ["flecha flamejante", "flecha - flamejante", "arrow - flame", "flaming arrow", "flaming bolt"],
    ammoType: AMMO_TYPES.ARROW,
    recoveryClass: "quality",
    description: "<p><strong>Qualidade:</strong> Flamejante.</p><p>Projétil incendiário usado para atear fogo em criaturas, edifícios ou outros alvos inflamáveis.</p>"
  },
  {
    names: ["flecha de laco", "flecha - de laco", "flecha - laco", "arrow - snaring", "laço", "laco", "ensnaring arrow", "ensnaring bolt", "snare arrow", "snare bolt"],
    ammoType: AMMO_TYPES.ARROW,
    recoveryClass: "quality",
    description: "<p>Uma ponta farpada e um fio de seda prendem o alvo. Retirar exige uma Ação de Movimento e Teste de <strong>[Vigoroso - Dano]</strong>: [[/r 1d20]] contra seu Vigoroso modificado pelo dano. Se for bem-sucedido, sofre [[/r 1d4[Dano]]] de dano e a remove. Mover-se com a flecha presa causa 1 ponto de dano por turno, ignorando Armadura.</p>"
  },
  {
    names: ["flecha certeira", "true arrow"],
    ammoType: AMMO_TYPES.ARROW,
    recoveryClass: "mystical",
    description: "<p>Flecha alquímica que passa por outros combatentes, não exigindo linha de visão clara. O arqueiro ainda precisa ver alguma parte do alvo e fazer o Teste de ataque normalmente.</p>"
  },
  {
    names: ["raio atordoante", "stun bolt", "stunning bolt"],
    ammoType: AMMO_TYPES.BOLT,
    recoveryClass: "mystical",
    description: "<p>Virote coberto com relaxante muscular. A criatura atingida deve passar em <strong>[Vigoroso - Dano]</strong>: [[/r 1d20]] contra seu Vigoroso modificado pelo dano, ou cai no chão (ficando caida). Robusto concede +2 em Vigoroso por nível neste Teste.</p>"
  }
];

export function getSpecialAmmo(item) {
  const name = typeof item === "string" ? item : item?.name;
  if (!name) return null;
  return SPECIAL_AMMO.find((entry) => matchesAnyAlias(name, entry.names)) ?? null;
}

export function getAmmoDescription(item) {
  const itemDescription = String(item?.system?.description ?? "").trim();
  if (itemDescription && itemDescription !== "<p></p>") return itemDescription;
  return getSpecialAmmo(item)?.description ?? "";
}

export function getSpecialAmmoType(item) {
  return getSpecialAmmo(item)?.ammoType ?? "";
}

/**
 * Parses special properties of ammunition to generate standard combat modifier structures.
 * @param {Item} ammo
 * @returns {Array<object>}
 */
export function getAmmoModifiers(ammo) {
  if (!ammo) return [];
  const name = normalize(ammo.name);
  const members = [];

  // 1. Precise Arrow / Bolt: +1 to hit
  const preciseNames = ["precisao", "precision", "precise"];
  if (preciseNames.some(p => name.includes(normalize(p)))) {
    members.push({
      id: ammo.id,
      label: ammo.name,
      reference: ammo.system?.reference ?? "",
      type: game.symbaroum.config.TYPE_ROLL_MOD, // "attackrollmod"
      modifier: 1,
      value: "1"
    });
  }

  // 2. Armor Piercing / Bodkin Arrow / Bolt: +1 damage (Deep Impact)
  const piercingNames = ["perfurante", "piercing", "bodkin"];
  if (piercingNames.some(p => name.includes(normalize(p)))) {
    members.push({
      id: ammo.id,
      label: `${ammo.name} (${game.i18n.localize("QUALITY.DEEPIMPACT")})`,
      reference: ammo.system?.reference ?? "",
      type: game.symbaroum.config.DAM_MOD, // "damagemodifier"
      value: "+1",
      alternatives: [
        {
          damageMod: "+1d1",
          damageModNPC: 1,
        }
      ]
    });
  }

  // 3. Flaming Arrow / Bolt: 1d4 burning damage per round
  const flamingNames = ["flamejante", "flaming", "burning"];
  if (flamingNames.some(p => name.includes(normalize(p)))) {
    members.push({
      id: ammo.id,
      label: `${ammo.name} (${game.i18n.localize("QUALITY.FLAMING")})`,
      reference: ammo.system?.reference ?? "",
      type: game.symbaroum.config.STATUS_DOT, // "status_dot"
      value: game.i18n.localize("QUALITY.FLAMING"),
      damagePerRound: "1d4",
      damagePerRoundNPC: 2,
      duration: "1d4",
      durationNPC: 2,
      effectIcon: CONFIG.statusEffects?.find((e) => e.id === "burning") ?? {
        id: "burning",
        name: "Burning",
        icon: "icons/svg/fire.svg"
      }
    });
  }

  return members;
}

/**
 * Determines the d20 break threshold for a given ammunition name.
 * - Common: <= 10 (breaks on > 10)
 * - Quality: <= 15 (breaks on > 15)
 * - Mystical/Alchemical: <= 17 (breaks on > 17)
 * @param {string|object} itemOrName
 * @returns {number} threshold
 */
export function getAmmoRecoveryThreshold(itemOrName) {
  const explicit = Number(
    typeof itemOrName === "object"
      ? itemOrName?.recoveryThreshold
        ?? itemOrName?.ammoRecoveryThreshold
        ?? itemOrName?.getFlag?.(FLAG_SCOPE, "ammoRecoveryThreshold")
      : NaN
  );
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const recoveryClass = getAmmoRecoveryClass(itemOrName);
  if (recoveryClass === "mystical") return 17;
  if (recoveryClass === "quality") return 15;
  return 10;
}

export function getAmmoRecoveryClass(itemOrName) {
  const explicit = typeof itemOrName === "object"
    ? itemOrName?.recoveryClass
      ?? itemOrName?.ammoRecoveryClass
      ?? itemOrName?.getFlag?.(FLAG_SCOPE, "ammoRecoveryClass")
    : "";
  if (["common", "quality", "mystical"].includes(explicit)) return explicit;

  const special = getSpecialAmmo(itemOrName);
  if (special?.recoveryClass) return special.recoveryClass;

  const name = typeof itemOrName === "string" ? itemOrName : itemOrName?.name;
  if (!name) return "common";

  const norm = normalize(name);

  // Mystical/Alchemical: True Arrow, Stun Bolt
  const mysticalNames = ["certeira", "true arrow", "atordoante", "stun bolt", "stunning bolt"];
  if (mysticalNames.some(m => norm.includes(normalize(m)))) {
    return "mystical";
  }

  // Quality: Precision, Armor Piercing/Bodkin, Whistler, Grappling, Hammerhead, Swallowtail, Rope Cutter, Flaming, Ensnaring
  const qualityNames = [
    "precisao", "precision", "precise",
    "perfurante", "piercing", "bodkin",
    "sibilante", "whistler", "whistling",
    "arpeu", "grappling", "grapple",
    "martelo", "hammerhead", "hammer head", "blunt",
    "andorinha", "swallowtail", "swallow-tail",
    "cortador", "rope cutter", "rope-cutter",
    "flamejante", "flaming", "burning",
    "laco", "ensnaring", "snare"
  ];
  if (qualityNames.some(q => norm.includes(normalize(q)))) {
    return "quality";
  }

  return "common";
}

