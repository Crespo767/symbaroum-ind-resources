import { MODULE_ID } from "./constants.mjs";
import { appendOriginalChatPreview } from "./chat-original-preview.mjs";

const ATTACK_PATTERN = /^(.+?)\s+(?:ataca com|attacks? with)\s+(.+?)[.!]?$/i;

export class NpcAttackChatService {
  static #registered = false;

  static register() {
    if (this.#registered) return;
    this.#registered = true;

    Hooks.on("renderChatMessageHTML", (_message, html) => {
      const scope = htmlElement(html);
      if (isEnabled()) enhanceNpcAttackCards(scope);
      else restoreNpcAttackCards(scope);
    });

    Hooks.on(`${MODULE_ID}.settingsChanged`, (key, value) => {
      if (!["enableCompactNpcAttackChat", "hideNpcDetailsInChat"].includes(key)) return;
      const scope = htmlElement(globalThis.ui?.chat?.element) ?? globalThis.document;
      restoreNpcAttackCards(scope);
      if (key === "enableCompactNpcAttackChat" ? value : isEnabled()) enhanceNpcAttackCards(scope);
    });
  }
}

export function enhanceNpcAttackCards(scope) {
  for (const root of matchingElements(scope, ".symbaroum.chat.combat")) {
    enhanceNpcAttackCard(root);
  }
}

export function restoreNpcAttackCards(scope) {
  for (const root of matchingElements(scope, ".symbaroum.chat.combat[data-tenebre-npc-attack='true']")) {
    const source = root.querySelector(":scope > .foreground");
    const card = root.querySelector(":scope > .tenebre-npc-attack-card");
    if (source) source.hidden = false;
    card?.remove();
    root.classList.remove("tenebre-npc-attack-compact");
    delete root.dataset.tenebreNpcAttack;
  }
}

export function parseOpposedTest(value = "") {
  const text = cleanText(value);
  const attributes = [...text.matchAll(/([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s-]*?)\s*:?\s*\(\s*(-?\d+)\s*\)/g)]
    .map((match) => ({ label: cleanText(match[1]), value: Number(match[2]) }))
    .slice(0, 2);
  const modifierMatch = text.match(/\bMod(?:ificador|ifier)?\s*:?\s*([+-]?\d+)/i);
  const modifier = Number(modifierMatch?.[1] ?? 0);
  const objective = attributes.length >= 2
    ? attributes[0].value + attributes[1].value + modifier
    : null;
  const direction = /(?:➡|→)/u.test(text) ? "→" : "←";
  return { text, attributes, modifier, objective, direction };
}

export function parseRollValue(value = "") {
  const matches = cleanText(value).match(/-?\d+/g);
  return matches?.length ? Number(matches.at(-1)) : null;
}

export function compactActorName(value = "") {
  const name = cleanText(value);
  return name.split(" ", 1)[0]?.replace(/[,:;]+$/u, "") || name;
}

export function stripNpcParenthetical(value = "") {
  return cleanText(String(value).replace(/\s*\([^)]*\)/gu, " "));
}

export function extractMissOutcomeSuffix(outcome, attackerName, failureText) {
  const text = cleanText(outcome);
  const prefix = cleanText(`${attackerName}${failureText}`);
  if (!normalize(text).startsWith(normalize(prefix))) return null;
  return cleanText(text.slice(prefix.length)).replace(/^[-–—]\s*/u, "");
}

export function canViewNpcDamageDetails({ playerAgainstNpc, hideNpcDetails, isGM }) {
  return !playerAgainstNpc || !hideNpcDetails || isGM;
}

export function isPainStunText(value, painText = localize("COMBAT.CHAT_DAMAGE_PAIN", "está atordoado pela dor.")) {
  const text = normalize(value).replace(/[.!?]+$/u, "");
  const suffix = normalize(painText).replace(/[.!?]+$/u, "");
  return Boolean(text && suffix && text.endsWith(suffix));
}

export function isArmorProtectionText(
  value,
  template = localize("TENEBRE.NpcAttackChat.ProtectedByArmor", "{name} está protegido pela armadura.")
) {
  const text = normalize(value).replace(/[.!?]+$/u, "");
  const suffix = normalize(String(template).replace(/\{name\}/giu, " ")).replace(/[.!?]+$/u, "");
  return Boolean(text && suffix && text.endsWith(suffix));
}

export function parseDamageResult(formulaText = "", resultText = "", damageDie = "", rollTotal = null, rawDamage = null) {
  const nativeFormula = cleanText(formulaText).replace(/^(?:Dano|Damage)\s*:\s*/i, "");
  const rolledDamageMatch = nativeFormula.match(/^\s*(\d+(?:[.,]\d+)?)\s*(?=-|$)/);
  const armorMatch = nativeFormula.match(/-\s*(\d+(?:[.,]\d+)?)\s*$/);
  const matches = cleanText(resultText).match(/-?\d+/g);
  const damage = matches?.length ? Math.max(0, Number(matches.at(-1))) : null;
  let rolledDamage = rolledDamageMatch
    ? Number(rolledDamageMatch[1].replace(",", "."))
    : null;
  if (rolledDamage === null && damage !== null && armorMatch) {
    rolledDamage = damage + Number(armorMatch[1].replace(",", "."));
  }
  if (rolledDamage === null && Number.isFinite(rollTotal)) {
    const armor = armorMatch ? Number(armorMatch[1].replace(",", ".")) : 0;
    rolledDamage = rollTotal + armor;
  }
  if (rolledDamage === null && Number.isFinite(rawDamage)) rolledDamage = rawDamage;
  if (rolledDamage === null && damage !== null) {
    const armor = armorMatch ? Number(armorMatch[1].replace(",", ".")) : 0;
    rolledDamage = damage + armor;
  }
  return {
    formula: extractDamageFormula(nativeFormula, damageDie),
    rolledDamage,
    damage,
    protection: rolledDamage !== null && damage !== null
      ? Math.max(0, rolledDamage - damage)
      : null
  };
}

export function extractDamageFormula(formulaText = "", damageDie = "") {
  const nativeFormula = cleanText(formulaText).replace(/^(?:Dano|Damage)\s*:\s*/i, "");
  if (/^\d+d\d+/i.test(nativeFormula)) {
    return cleanText(nativeFormula.replace(/\s*-\s*\d+(?:[.,]\d+)?\s*$/, ""));
  }
  return cleanText(damageDie)
    || nativeFormula.match(/\b\d+d\d+(?:k[hl]\d*)?\b/i)?.[0]
    || nativeFormula;
}

function enhanceNpcAttackCard(root) {
  if (root.dataset.tenebreNpcAttack === "true") return;
  const source = root.querySelector(":scope > .foreground");
  const model = buildNpcAttackModel(source);
  if (!source || !model || !isPlayerNpcAttack(model)) return;

  const card = document.createElement("section");
  card.className = "tenebre-npc-attack-card";
  card.append(
    createTextElement("h3", "tenebre-npc-attack-title", model.action),
    createAttackFlow(model)
  );
  if (model.resistedDescription) {
    card.append(createTextElement("p", "tenebre-npc-attack-description", model.resistedDescription));
  }
  card.append(createResolution(model));
  appendOriginalChatPreview(card, source, {
    hasUnadaptedContent: model.hasUnadaptedContent,
    unadaptedElements: model.unadaptedElements
  });

  source.hidden = true;
  root.classList.add("tenebre-npc-attack-compact");
  root.dataset.tenebreNpcAttack = "true";
  root.append(card);
}

function buildNpcAttackModel(source) {
  if (!source) return null;
  const action = cleanText(source.querySelector(".introTxt")?.textContent);
  const attack = action.match(ATTACK_PATTERN);
  const targetName = cleanText(source.querySelector(".targetText")?.textContent)
    .replace(/^(?:V[ií]tima|Victim)\s*:\s*/i, "");
  const formulaElement = source.querySelector("[data-item-id]");
  const formulaContainer = formulaElement?.closest(".finalTxt");
  const formula = parseOpposedTest(formulaElement?.textContent);
  const resistedDescription = directTextWithout(formulaContainer, formulaElement);

  if (!attack || !targetName || formula.attributes.length < 2) return null;

  const attackerName = cleanText(attack[1]);
  const weaponName = cleanText(attack[2]);
  const attackerActor = actorByDisplayedName(attackerName);
  const targetActor = actorByDisplayedName(targetName);
  const attackerDisplayName = isNpcParticipant(attackerActor, Boolean(resistedDescription))
    ? stripNpcParenthetical(attackerName)
    : attackerName;
  const targetDisplayName = isNpcParticipant(targetActor, !resistedDescription)
    ? stripNpcParenthetical(targetName)
    : targetName;
  const damageDie = weaponDamageDie(attackerActor, formulaElement?.dataset?.itemId);
  const resolution = extractResolution(source, formulaContainer, damageDie);
  if (!resolution.rollText || !resolution.outcome) return null;
  const weaponDetailsElement = source.querySelector(":scope > .subText");
  const unadaptedElements = [
    ...resolution.unadaptedElements,
    ...(hasUnrepresentedWeaponDetails(weaponDetailsElement?.textContent, weaponName, resolution.damageFormula)
      ? [weaponDetailsElement]
      : [])
  ];

  const model = {
    action,
    attacker: {
      name: attackerDisplayName,
      sourceName: attackerName,
      caption: compactActorName(attackerDisplayName),
      img: backgroundImageUrl(source.querySelector(":scope > .introImg")?.getAttribute("style")),
      actor: attackerActor
    },
    weapon: {
      name: weaponName,
      img: source.querySelector(":scope > img")?.getAttribute("src") ?? ""
    },
    target: {
      name: targetDisplayName,
      sourceName: targetName,
      caption: compactActorName(targetDisplayName),
      img: backgroundImageUrl(source.querySelector(":scope > .introImg .introImg")?.getAttribute("style")),
      actor: targetActor
    },
    resistedDescription,
    formula,
    ...resolution,
    hasUnadaptedContent: unadaptedElements.length > 0,
    unadaptedElements
  };
  model.action = replaceNpcNames(model.action, model);
  return model;
}

function extractResolution(source, formulaContainer, damageDie) {
  const children = [...source.children];
  const formulaIndex = children.indexOf(formulaContainer);
  let rollNode = null;
  let outcomeNode = null;
  let damageFormulaNode = null;
  let damageResultNode = null;

  for (let index = formulaIndex + 1; index < children.length; index += 1) {
    const child = children[index];
    const tooltipText = cleanText(child.querySelector?.(":scope > .tooltip > p")?.textContent);
    if (!rollNode && child.classList?.contains("finalTxt") && tooltipText && parseRollValue(tooltipText) !== null) {
      rollNode = child;
      continue;
    }
    if (rollNode && !outcomeNode && child.matches?.("h4")) {
      outcomeNode = child;
      continue;
    }
    if (outcomeNode && !damageFormulaNode && child.classList?.contains("finalTxt") && !child.querySelector(":scope > .tooltip")) {
      const text = cleanText(child.textContent);
      if (/^(?:Dano|Damage)\s*:/i.test(text)) damageFormulaNode = child;
      continue;
    }
    if (damageFormulaNode && !damageResultNode && child.classList?.contains("finalTxt") && child.querySelector(":scope > .tooltip > p")) {
      damageResultNode = child;
      break;
    }
  }

  const rollText = cleanText(rollNode?.querySelector(":scope > .tooltip > p")?.textContent);
  const outcome = cleanText(outcomeNode?.textContent);
  const damageFormulaText = cleanText(damageFormulaNode?.textContent);
  const damageResultText = cleanText(damageResultNode?.querySelector(":scope > .tooltip > p")?.textContent);
  const rawDamage = parseRollValue(damageResultNode?.querySelector(".tooltip-part .part-total")?.textContent);
  const damageRollTotal = parseRollValue(damageResultNode?.querySelector(".dice-total")?.textContent);
  const damageResult = parseDamageResult(damageFormulaText, damageResultText, damageDie, damageRollTotal, rawDamage);
  const damageResultIndex = children.indexOf(damageResultNode);
  const trailingChildren = children.slice(Math.max(0, damageResultIndex + 1));
  const armorProtectionNode = damageResult.damage === 0
    ? trailingChildren.find((child) => (
      child.classList?.contains("finalTxt") && isArmorProtectionText(child.textContent)
    )) ?? null
    : null;
  const painStunNode = damageResult.damage !== null
    ? trailingChildren.find((child) => (
      child.classList?.contains("finalTxt") && isPainStunText(child.textContent)
    )) ?? null
    : null;
  const consumedNodes = new Set([
    rollNode,
    outcomeNode,
    damageFormulaNode,
    damageResultNode,
    armorProtectionNode,
    painStunNode
  ].filter(Boolean));
  const unadaptedElements = children
    .slice(Math.max(0, formulaIndex + 1))
    .filter((child) => !consumedNodes.has(child) && cleanText(child.textContent));
  return {
    rollText,
    rollValue: parseRollValue(rollText),
    outcome,
    damageFormula: damageResult.formula,
    damageRoll: damageResult.rolledDamage,
    damage: damageResult.damage,
    protection: damageResult.protection,
    painStunned: Boolean(painStunNode),
    hasUnadaptedContent: unadaptedElements.length > 0,
    unadaptedElements
  };
}

function hasUnrepresentedWeaponDetails(subText, weaponName, damageFormula) {
  const text = cleanText(subText);
  if (!text || !normalize(text).startsWith(normalize(weaponName))) return false;

  const afterName = text.slice(weaponName.length)
    .replace(/^\s*\([^)]*\)/u, "")
    .replace(/^\s*,+\s*/u, "");
  const details = afterName.split(",").map(cleanText).filter(Boolean);
  const represented = normalize(damageFormula);
  return details.some((detail) => !represented.includes(normalize(detail)));
}

export function isPlayerNpcAttack(model) {
  const attackerType = model.attacker.actor?.type;
  const targetType = model.target.actor?.type;
  if (attackerType && targetType) {
    return (attackerType === "monster" && targetType === "player")
      || (attackerType === "player" && targetType === "monster");
  }

  const defenseLabel = normalize(localize("ARMOR.DEFENSE", "Defense"));
  const firstAttribute = normalize(model.formula.attributes[0]?.label);
  const secondAttribute = normalize(model.formula.attributes[1]?.label);
  return (Boolean(model.resistedDescription) && firstAttribute === defenseLabel)
    || secondAttribute === defenseLabel;
}

function createAttackFlow(model) {
  const flow = document.createElement("div");
  flow.className = "tenebre-npc-attack-flow";
  flow.append(
    createParticipant(model.attacker),
    createArrow(),
    createParticipant(model.weapon),
    createArrow(),
    createParticipant(model.target)
  );
  return flow;
}

function createParticipant(participant) {
  const figure = document.createElement("figure");
  figure.className = "tenebre-npc-attack-participant";
  const image = document.createElement("img");
  image.src = participant.img || "icons/svg/mystery-man.svg";
  image.alt = participant.name;
  image.loading = "lazy";
  const caption = document.createElement("figcaption");
  caption.textContent = participant.caption || participant.name;
  caption.title = participant.name;
  figure.append(image, caption);
  return figure;
}

function createArrow() {
  const arrow = createTextElement("span", "tenebre-npc-attack-arrow", "→");
  arrow.setAttribute("aria-hidden", "true");
  return arrow;
}

function createResolution(model) {
  const resolution = document.createElement("div");
  resolution.className = "tenebre-npc-attack-resolution";
  const [defense, attack] = model.formula.attributes;
  const formulaText = `${defense.label} (${defense.value}) ${model.formula.direction} ${attack.label} (${signed(attack.value)})`;
  resolution.append(createTextElement("p", "tenebre-npc-attack-test", formulaText));

  if (model.formula.modifier) {
    resolution.append(createTextElement(
      "p",
      "tenebre-npc-attack-modifier",
      `${localize("TENEBRE.NpcAttackChat.Modifier", "Modificador")}: ${signed(model.formula.modifier)}`
    ));
  }
  const rollSummary = document.createElement("div");
  rollSummary.className = "tenebre-npc-attack-roll-summary";
  rollSummary.append(
    createTextElement(
      "p",
      "tenebre-npc-attack-objective",
      `${localize("TENEBRE.NpcAttackChat.Objective", "Objetivo")}: ${model.formula.objective}`
    ),
    createTextElement(
      "p",
      "tenebre-npc-attack-roll",
      `${localize("TENEBRE.NpcAttackChat.Roll", "Rolagem")}: ${model.rollValue}`
    )
  );
  resolution.append(rollSummary);
  resolution.append(createTextElement("p", "tenebre-npc-attack-outcome", displayedOutcome(model)));

  if (model.damageFormula && model.damageRoll !== null && model.damage !== null) {
    const showNpcDetails = canViewNpcDamageDetails({
      playerAgainstNpc: isPlayerAgainstNpc(model),
      hideNpcDetails: areNpcDetailsHidden(),
      isGM: Boolean(globalThis.game?.user?.isGM)
    });
    resolution.append(createTextElement(
      "p",
      "tenebre-npc-attack-damage",
      `${localize("TENEBRE.NpcAttackChat.Damage", "Dano")}: ${model.damageFormula} = ${model.damageRoll}`
    ));
    if (isPlayerAgainstNpc(model) && showNpcDetails && model.protection !== null) {
      resolution.append(createTextElement(
        "p",
        "tenebre-npc-attack-protection",
        `${localize("TENEBRE.NpcAttackChat.Protection", "Proteção")}: ${model.protection}`
      ));
    }
    if (showNpcDetails) {
      const receivedText = isPlayerAgainstNpc(model) && model.damage === 0
        ? format("TENEBRE.NpcAttackChat.ProtectedByArmor", "{name} está protegido pela armadura.", {
          name: model.target.name
        })
        : model.painStunned
          ? format(
            "TENEBRE.NpcAttackChat.ReceivesDamageAndPainStun",
            "{name} recebe {damage} de dano e está atordoado pela dor.",
            { name: model.target.name, damage: model.damage }
          )
        : format("TENEBRE.NpcAttackChat.ReceivesDamage", "{name} recebe {damage} de dano.", {
          name: model.target.name,
          damage: model.damage
        });
      resolution.append(createTextElement(
        "p",
        "tenebre-npc-attack-received",
        receivedText
      ));
    }
  }
  return resolution;
}

function directTextWithout(container, excluded) {
  if (!container) return "";
  return [...container.childNodes]
    .filter((node) => node !== excluded)
    .map((node) => cleanText(node.textContent))
    .filter(Boolean)
    .join(" ");
}

function actorByDisplayedName(name) {
  const expected = normalize(name);
  const tokens = globalThis.canvas?.tokens?.placeables ?? [];
  const token = tokens.find((candidate) => normalize(candidate.name) === expected);
  if (token?.actor) return token.actor;
  return [...(globalThis.game?.actors ?? [])].find((actor) => normalize(actor.name) === expected) ?? null;
}

function weaponDamageDie(actor, itemId) {
  if (!actor || !itemId) return "";
  const preparedWeapon = actor.system?.weapons?.find?.((weapon) => weapon.id === itemId);
  if (preparedWeapon?.damage?.base) return cleanText(preparedWeapon.damage.base);
  return cleanText(actor.items?.get?.(itemId)?.system?.baseDamage);
}

function displayedOutcome(model) {
  if (!isNpcAgainstPlayer(model)) return replaceNpcNames(model.outcome, model);
  const failureText = localize("COMBAT.CHAT_FAILURE", " erra.");
  const suffix = extractMissOutcomeSuffix(model.outcome, model.attacker.sourceName || model.attacker.name, failureText);
  if (suffix === null) return replaceNpcNames(model.outcome, model);

  const defended = format(
    "TENEBRE.NpcAttackChat.DefendedMiss",
    "{target} consegue se defender; {attacker} erra o ataque.",
    {
      target: model.target.caption || model.target.name,
      attacker: model.attacker.caption || model.attacker.name
    }
  );
  return suffix ? `${defended} — ${replaceNpcNames(suffix, model)}` : defended;
}

function isNpcAgainstPlayer(model) {
  const attackerType = model.attacker.actor?.type;
  const targetType = model.target.actor?.type;
  if (attackerType && targetType) return attackerType === "monster" && targetType === "player";
  const defenseLabel = normalize(localize("ARMOR.DEFENSE", "Defense"));
  return Boolean(model.resistedDescription)
    && normalize(model.formula.attributes[0]?.label) === defenseLabel;
}

function isPlayerAgainstNpc(model) {
  const attackerType = model.attacker.actor?.type;
  const targetType = model.target.actor?.type;
  if (attackerType && targetType) return attackerType === "player" && targetType === "monster";
  const defenseLabel = normalize(localize("ARMOR.DEFENSE", "Defense"));
  return !model.resistedDescription
    && normalize(model.formula.attributes[1]?.label) === defenseLabel;
}

function isNpcParticipant(actor, inferredNpc) {
  return actor?.type ? actor.type === "monster" : inferredNpc;
}

function replaceNpcNames(value, model) {
  let text = cleanText(value);
  for (const participant of [model.attacker, model.target]) {
    if (!participant.sourceName || participant.sourceName === participant.name) continue;
    text = text.split(participant.sourceName).join(participant.name);
  }
  return text;
}

function matchingElements(scope, selector) {
  const root = htmlElement(scope);
  if (!root) return [];
  const matches = root.matches?.(selector) ? [root] : [];
  return [...matches, ...(root.querySelectorAll?.(selector) ?? [])];
}

function htmlElement(value) {
  return value?.[0] ?? value ?? null;
}

function backgroundImageUrl(style = "") {
  const match = String(style).match(/background-image\s*:\s*url\((['"]?)(.*?)\1\)/i);
  return match?.[2] ?? "";
}

function createTextElement(tag, className, value) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = value;
  return element;
}

function isEnabled() {
  try {
    return game.settings.get(MODULE_ID, "enableCompactNpcAttackChat") !== false;
  } catch (_error) {
    return true;
  }
}

function areNpcDetailsHidden() {
  try {
    return game.settings.get(MODULE_ID, "hideNpcDetailsInChat") === true;
  } catch (_error) {
    return false;
  }
}

function normalize(value) {
  return cleanText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function localize(key, fallback) {
  const value = globalThis.game?.i18n?.localize?.(key);
  return value && value !== key ? value : fallback;
}

function format(key, fallback, data) {
  const value = globalThis.game?.i18n?.format?.(key, data);
  if (value && value !== key) return value;
  return fallback.replace(/\{(\w+)\}/g, (_match, field) => String(data[field] ?? ""));
}
