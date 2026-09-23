import { MODULE_ID } from "./constants.mjs";
import { appendOriginalChatPreview } from "./chat-original-preview.mjs";

const BERSERKER_REFERENCE = "berserker";
const LAY_ON_HANDS_REFERENCE = "layonhands";
const HOLY_AURA_REFERENCE = "holyaura";
const BRIMSTONE_CASCADE_REFERENCE = "brimstonecascade";
const ALCHEMY_REFERENCE = "alchemy";

export class BerserkerChatService {
  static #registered = false;

  static register() {
    if (this.#registered) return;
    this.#registered = true;

    Hooks.on("renderChatMessageHTML", (message, html) => {
      const scope = htmlElement(html);
      if (isEnabled()) enhanceBerserkerCards(scope, message);
      else restoreBerserkerCards(scope);
    });

    Hooks.on(`${MODULE_ID}.settingsChanged`, (key, value) => {
      if (key !== "enableCompactNpcAttackChat") return;
      const scope = htmlElement(globalThis.ui?.chat?.element) ?? globalThis.document;
      restoreBerserkerCards(scope);
      if (value) globalThis.ui?.chat?.render?.({ force: true });
    });
  }
}

export function isBerserkerItem(item) {
  return item?.system?.reference === BERSERKER_REFERENCE
    || normalize(item?.name) === "berserker"
    || normalize(item?.name) === "amoque";
}

export function isLayOnHandsItem(item) {
  return item?.system?.reference === LAY_ON_HANDS_REFERENCE
    || normalize(item?.name) === "lay on hands"
    || normalize(item?.name) === "imposicao de maos";
}

export function isHolyAuraItem(item) {
  return item?.system?.reference === HOLY_AURA_REFERENCE
    || normalize(item?.name) === "holy aura"
    || normalize(item?.name) === "aura sagrada";
}

export function isBrimstoneCascadeItem(item) {
  return item?.system?.reference === BRIMSTONE_CASCADE_REFERENCE
    || normalize(item?.name) === "brimstone cascade"
    || normalize(item?.name) === "cascata de enxofre";
}

export function isAlchemyItem(item) {
  return item?.system?.reference === ALCHEMY_REFERENCE
    || normalize(item?.name) === "alchemy"
    || normalize(item?.name) === "alquimia";
}

export function enhanceBerserkerCards(scope, message = null) {
  for (const root of matchingElements(scope, ".symbaroum.chat.ability")) {
    enhanceBerserkerCard(root, resolveChatMessage(root, message));
  }
}

export function restoreBerserkerCards(scope) {
  for (const root of matchingElements(scope, ".symbaroum.chat.ability[data-tenebre-berserker='true']")) {
    const source = root.querySelector(":scope > .foreground");
    const card = root.querySelector(":scope > .tenebre-berserker-card");
    if (source) source.hidden = false;
    card?.remove();
    root.classList.remove("tenebre-berserker-compact");
    delete root.dataset.tenebreBerserker;
  }
}

function enhanceBerserkerCard(root, message = null) {
  if (root.dataset.tenebreBerserker === "true") return;

  const resolvedMessage = resolveChatMessage(root, message);
  const source = root.querySelector(":scope > .foreground");
  if (!source || !isNativeAbilityCard(source)) return;

  const abilityCaption = cleanText(source.querySelector(":scope > .subText")?.textContent);
  if (!abilityCaption) return;

  const actor = resolveSpeakerActor(resolvedMessage, source)
    ?? createFallbackActor(source, resolvedMessage);
  const itemId = source.querySelector("[data-item-id]")?.dataset?.itemId;
  const item = (itemId ? actor?.items?.get?.(itemId) : null)
    ?? findDisplayedAbility(actor, abilityCaption, source)
    ?? createFallbackAbility(source, abilityCaption);
  if (!actor || !item) return;

  const actorImage = backgroundImageUrl(source.querySelector(":scope > .introImg")?.getAttribute("style")) || actor.img;
  const abilityImage = source.querySelector(":scope > img")?.getAttribute("src") || item.img;
  const introText = cleanText(source.querySelector(":scope > .introImg > .introTxt")?.textContent);
  const actorName = stripParenthetical(actor.name);
  const targetImage = backgroundImageUrl(source.querySelector(":scope > .introImg > .introImg")?.getAttribute("style"));
  const targetName = stripTargetLabel(source.querySelector(":scope > .introImg > .targetText")?.textContent);
  const { name: abilityName, level: abilityLevel, modifiers } = splitAbilityCaption(abilityCaption || item.name);
  const attemptText = format(
    "TENEBRE.AbilityChat.Attempt",
    "{actor} tenta usar {ability}.",
    { actor: actorName, ability: item.name }
  );
  const unadaptedElements = findUnadaptedAbilityElements(source, {
    introText,
    attemptText,
    targetShown: Boolean(targetImage && targetName)
  });

  const card = document.createElement("div");
  card.className = "tenebre-berserker-card";
  card.append(
    createTextElement("p", "tenebre-berserker-intro", attemptText || introText),
    createAbilityFlow(actorImage, actorName, abilityImage, abilityName, abilityLevel, item, targetImage, targetName)
  );
  if (modifiers) {
    card.append(createTextElement("p", "tenebre-berserker-modifiers", modifiers));
  }

  const details = createAbilityDetails(source);
  if (details.childElementCount) card.append(details);
  appendOriginalChatPreview(card, source, {
    hasUnadaptedContent: unadaptedElements.length > 0,
    unadaptedElements
  });

  source.hidden = true;
  root.append(card);
  root.classList.add("tenebre-berserker-compact");
  root.dataset.tenebreBerserker = "true";
}

function findUnadaptedAbilityElements(source, { introText, attemptText, targetShown }) {
  const omitted = [];
  const intro = source.querySelector(":scope > .introImg");
  const introTextElement = intro?.querySelector(":scope > .introTxt");
  const targetPortrait = intro?.querySelector(":scope > .introImg");
  const targetLabel = intro?.querySelector(":scope > .targetText");

  if (introTextElement && !equivalentChatText(introText, attemptText)) {
    omitted.push(introTextElement);
  }
  if (!targetShown) {
    if (targetPortrait) omitted.push(targetPortrait);
    if (targetLabel) omitted.push(targetLabel);
  }

  const representedIntroChildren = new Set([
    introTextElement,
    targetPortrait,
    targetLabel
  ].filter(Boolean));
  for (const child of intro?.children ?? []) {
    if (!representedIntroChildren.has(child) && hasMeaningfulContent(child)) omitted.push(child);
  }

  const representedChildren = new Set([
    intro,
    source.querySelector(":scope > .subText"),
    source.querySelector(":scope > img"),
    ...source.querySelectorAll(":scope > .finalTxt")
  ].filter(Boolean));
  for (const child of source.children ?? []) {
    if (!representedChildren.has(child) && hasMeaningfulContent(child)) omitted.push(child);
  }
  return [...new Set(omitted)];
}

function equivalentChatText(left, right) {
  return normalize(left).replace(/[“”"'‘’.,:;!?()[\]{}]/gu, "")
    === normalize(right).replace(/[“”"'‘’.,:;!?()[\]{}]/gu, "");
}

function hasMeaningfulContent(element) {
  return Boolean(cleanText(element?.textContent) || element?.querySelector?.("img, button, input, a"));
}

function createAbilityFlow(actorImage, actorName, abilityImage, abilityName, abilityLevel, item, targetImage, targetName) {
  const participants = document.createElement("div");
  participants.className = "tenebre-berserker-participants";
  participants.append(
    createPortrait(actorImage, actorName, "tenebre-berserker-actor"),
    createFlowArrow(),
    createAbilityFigure(abilityImage, abilityName, abilityLevel, item)
  );

  if (targetImage && targetName) {
    participants.append(
      createFlowArrow(),
      createPortrait(targetImage, targetName, "tenebre-berserker-target")
    );
  }
  return participants;
}

function createFlowArrow() {
  const arrow = document.createElement("span");
  arrow.className = "tenebre-berserker-flow-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "→";
  return arrow;
}

function createPortrait(src, name, className) {
  const figure = document.createElement("figure");
  figure.className = className;
  const image = document.createElement("img");
  image.src = src || "icons/svg/mystery-man.svg";
  image.alt = name;
  image.loading = "lazy";
  const caption = document.createElement("figcaption");
  caption.textContent = name;
  figure.append(image, caption);
  return figure;
}

function createAbilityFigure(src, abilityName, abilityLevel, item) {
  const figure = createPortrait(src, abilityName, "tenebre-berserker-ability");
  const caption = figure.querySelector("figcaption");
  caption.textContent = "";

  const link = document.createElement("a");
  link.href = "#";
  link.className = "tenebre-berserker-ability-link";
  link.dataset.uuid = item.uuid;
  link.dataset.type = "Item";
  link.dataset.id = item.id;
  link.textContent = abilityName;
  link.title = item.name;
  link.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    item.sheet?.render?.({ force: true });
  });
  caption.append(link);
  if (abilityLevel) {
    caption.append(createTextElement("span", "tenebre-berserker-ability-level", abilityLevel));
  }
  return figure;
}

function createAbilityDetails(source) {
  const details = document.createElement("div");
  details.className = "tenebre-berserker-details";
  const nodes = [...source.querySelectorAll(":scope > .finalTxt")];
  const opposedTestNode = nodes.find((node) => parseAbilityTest(node.textContent));
  const singleTestNode = opposedTestNode
    ? null
    : nodes.find((node) => parseSingleAbilityTest(node.textContent));
  const testNode = opposedTestNode ?? singleTestNode;
  const rollNode = nodes.find((node) => parseAbilityRoll(node.textContent) !== null);
  const opposedTest = parseAbilityTest(opposedTestNode?.textContent);
  const singleTest = parseSingleAbilityTest(singleTestNode?.textContent);
  const test = opposedTest ?? singleTest;
  const roll = parseAbilityRoll(rollNode?.textContent);
  const succeeded = test && roll !== null ? roll <= test.objective : null;

  if (opposedTest && roll !== null) {
    details.append(createTextElement("p", "tenebre-berserker-test", opposedTest.testText));
    if (opposedTest.modifier) {
      details.append(createTextElement(
        "p",
        "tenebre-berserker-test-modifier",
        `${localize("TENEBRE.NpcAttackChat.Modifier", "Modificador")}: ${signed(opposedTest.modifier)}`
      ));
    }
    const summary = document.createElement("div");
    summary.className = "tenebre-berserker-roll-summary";
    const rollText = createTextElement(
      "p",
      "tenebre-berserker-roll",
      `${localize("TENEBRE.NpcAttackChat.Roll", "Rolagem")}: ${roll}`
    );
    applyAbilityRollOutcome(rollText, succeeded);
    summary.append(
      createTextElement(
        "p",
        "tenebre-berserker-objective",
        `${localize("TENEBRE.NpcAttackChat.Objective", "Objetivo")}: ${opposedTest.objective}`
      ),
      rollText
    );
    details.append(summary);
  }

  for (const node of nodes) {
    if (opposedTest && roll !== null && (node === testNode || node === rollNode)) continue;
    const clone = node.cloneNode(true);
    if (singleTest && node === testNode) {
      const attributeText = clone.querySelector("p");
      if (attributeText) attributeText.textContent = singleTest.testText;
    }
    if (succeeded !== null && node === rollNode) {
      applyAbilityRollOutcome(clone.querySelector("p"), succeeded);
    }
    details.append(clone);
  }
  return details;
}

function applyAbilityRollOutcome(element, succeeded) {
  if (!element) return;
  element.classList.add(
    "tenebre-berserker-roll-result",
    succeeded ? "tenebre-berserker-roll-success" : "tenebre-berserker-roll-failure"
  );
}

export function parseAbilityTest(value = "") {
  const text = cleanText(value);
  const attributes = [...text.matchAll(/([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s-]*?)\s*:?\s*\(\s*(-?\d+)\s*\)/gu)]
    .map((match) => ({ label: cleanText(match[1]), value: Number(match[2]) }))
    .slice(0, 2);
  if (attributes.length < 2) return null;
  const modifier = Number(text.match(/\bMod(?:ificador|ifier)?\s*:?\s*([+-]?\d+)/iu)?.[1] ?? 0);
  const direction = /(?:➡|→)/u.test(text) ? "→" : "←";
  return {
    attributes,
    modifier,
    objective: attributes[0].value + attributes[1].value + modifier,
    direction,
    testText: `${attributes[0].label} (${attributes[0].value}) ${direction} ${attributes[1].label} (${attributes[1].value})`
  };
}

export function parseSingleAbilityTest(value = "") {
  const text = cleanText(value);
  const match = text.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s-]*?)\s*:?\s*\(\s*(-?\d+)\s*\)\s*(?:Mod(?:ificador|ifier)?\s*:?\s*([+-]?\d+))?$/iu);
  if (!match) return null;
  const attribute = { label: cleanText(match[1]), value: Number(match[2]) };
  const modifier = Number(match[3] ?? 0);
  return {
    attribute,
    modifier,
    objective: attribute.value + modifier,
    testText: `${attribute.label}: ${attribute.value}`
  };
}

export function parseAbilityRoll(value = "") {
  const text = cleanText(value);
  const match = text.match(/(?:Resultado da rolagem de dados|Dice roll result|Tärningsslag resultat|Würfelergebnis|Resultado de la tirada|Résultat du jet|Risultato del dado|Rolagem|Roll)\s*:\s*(-?\d+)/iu);
  return match ? Number(match[1]) : null;
}

export function cleanAbilityCaption(value = "") {
  return cleanText(value)
    .replace(/^[*_~"'“‘«\s]+|[*_~"'”’»\s]+$/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractActorNameFromIntro(introText = "") {
  const text = cleanText(introText);
  if (!text) return "";
  const verbMatch = text.match(/^(.+?)\s+(?:tenta(?:r)?\s+usar|attempts?\s+to\s+use|f[oö]rs[oö]ker\s+anv[aä]nda|lan[cç]a|kastar|ativa|uses?|usa|casts?)\b/iu);
  if (verbMatch?.[1]) return cleanText(verbMatch[1]);
  const beforeQuoteMatch = text.match(/^(.+?)\s*["“'«]/u);
  if (beforeQuoteMatch?.[1]) return cleanText(beforeQuoteMatch[1]);
  return "";
}

export function extractAbilityNameFromIntro(introText = "") {
  const text = cleanText(introText);
  const match = text.match(/["“'«]\s*([^"”'»]+?)\s*["”'»]/u);
  return cleanAbilityCaption(match?.[1] ?? "");
}

export function actorByDisplayedName(name) {
  const expected = normalize(name);
  if (!expected) return null;
  const tokens = globalThis.canvas?.tokens?.placeables ?? [];
  const token = tokens.find((candidate) => {
    const candName = normalize(candidate.name);
    const candActorName = normalize(candidate.actor?.name);
    return candName === expected || candActorName === expected;
  });
  if (token?.actor) return token.actor;
  return [...(globalThis.game?.actors ?? [])].find((actor) => normalize(actor.name) === expected) ?? null;
}

export function isNativeAbilityCard(source) {
  if (!source) return false;
  if (source.querySelector("#applyEffect")) return false;
  const subText = cleanText(source.querySelector(":scope > .subText")?.textContent);
  if (!subText) return false;
  const hasIntro = Boolean(source.querySelector(":scope > .introImg"));
  const hasImage = Boolean(source.querySelector(":scope > img"));
  return hasIntro || hasImage;
}

function createFallbackActor(source, _message) {
  const introText = cleanText(source?.querySelector(":scope > .introImg > .introTxt")?.textContent);
  const name = stripParenthetical(extractActorNameFromIntro(introText));
  if (!name) return null;
  const img = backgroundImageUrl(source?.querySelector(":scope > .introImg")?.getAttribute("style")) || "icons/svg/mystery-man.svg";
  return { name, img, items: [] };
}

function createFallbackAbility(source, abilityCaption) {
  const cleaned = cleanAbilityCaption(abilityCaption);
  const { name: parsedName } = splitAbilityCaption(cleaned);
  const introText = cleanText(source?.querySelector(":scope > .introImg > .introTxt")?.textContent);
  const name = parsedName || extractAbilityNameFromIntro(introText);
  if (!name) return null;
  const img = source?.querySelector(":scope > img")?.getAttribute("src") || "icons/svg/item-bag.svg";
  const id = source?.querySelector("[data-item-id]")?.dataset?.itemId ?? "";
  return { name, img, uuid: "", id };
}

function findDisplayedAbility(actor, abilityCaption, source = null) {
  if (!actor || (!abilityCaption && !source)) return null;
  const items = Array.from(actor.items ?? []);
  if (!items.length) return null;

  const itemId = source?.querySelector("[data-item-id]")?.dataset?.itemId;
  if (itemId && actor.items?.get?.(itemId)) return actor.items.get(itemId);

  const cleanedCaption = cleanAbilityCaption(abilityCaption);
  const { name: captionName } = splitAbilityCaption(cleanedCaption);
  const displayedName = normalize(captionName || cleanedCaption);
  if (!displayedName) return null;

  return items.find((item) => displayedName.startsWith(normalize(item.name)))
    ?? items.find((item) => normalize(item.name).startsWith(displayedName))
    ?? items.find((item) => displayedName.startsWith(normalize(referenceLabel(item))))
    ?? items.find((item) => normalize(referenceLabel(item)).startsWith(displayedName))
    ?? findAbilityByReference(items, displayedName)
    ?? findAbilityByIntro(items, source);
}

function findAbilityByReference(items, displayedName) {
  if (!displayedName) return null;
  return items.find((item) => {
    const ref = normalize(item?.system?.reference ?? "");
    if (!ref) return false;
    const compactTarget = displayedName.replace(/\s+/g, "");
    return compactTarget.includes(ref) || ref.includes(compactTarget);
  }) ?? null;
}

function findAbilityByIntro(items, source) {
  const introText = cleanText(source?.querySelector(":scope > .introImg > .introTxt")?.textContent);
  const quotedName = normalize(extractAbilityNameFromIntro(introText));
  if (!quotedName) return null;
  return items.find((item) => {
    const itemName = normalize(item.name);
    return quotedName.startsWith(itemName) || itemName.startsWith(quotedName);
  }) ?? null;
}

function referenceLabel(item) {
  if (isBerserkerItem(item)) return localize("ABILITY_LABEL.BERSERKER", "Berserker");
  if (isLayOnHandsItem(item)) return localize("POWER_LABEL.LAY_ON_HANDS", "Lay on Hands");
  if (isHolyAuraItem(item)) return localize("POWER_LABEL.HOLY_AURA", "Holy Aura");
  if (isBrimstoneCascadeItem(item)) return localize("POWER_LABEL.BRIMSTONE_CASCADE", "Brimstone Cascade");
  if (isAlchemyItem(item)) return localize("ABILITY_LABEL.ALCHEMY", "Alchemy");
  return item?.name ?? "";
}

export function splitAbilityCaption(value) {
  const cleaned = cleanAbilityCaption(value);
  const [caption, ...modifierParts] = cleaned.split(",");
  const rank = cleanText(caption).match(/^(.*?)\s*\(([^()]*)\)\s*$/u);
  return {
    name: cleanAbilityCaption(rank?.[1] ?? caption),
    level: cleanAbilityCaption(rank?.[2]),
    modifiers: cleanAbilityModifiers(modifierParts)
  };
}

function cleanAbilityModifiers(parts) {
  return parts
    .map(cleanText)
    .filter(Boolean)
    .filter((part) => {
      const text = normalize(part);
      return !text.includes("armadura obstrutiva") && !text.includes("obstructive armor");
    })
    .join(", ");
}

export function stripTargetLabel(value = "") {
  return stripParenthetical(cleanText(value).replace(/^(?:Paciente|Patient|Alvo|Target|V[ií]tima|Victim)\s*:\s*/iu, ""));
}

function resolveChatMessage(root, preferredMessage = null) {
  if (preferredMessage) return preferredMessage;
  const messageId = root?.closest?.("[data-message-id]")?.dataset?.messageId;
  return messageId ? globalThis.game?.messages?.get?.(messageId) ?? null : null;
}

export function resolveSpeakerActor(message, source = null) {
  const speaker = message?.speaker ?? {};
  const scene = globalThis.game?.scenes?.get?.(speaker.scene);
  const tokenActor = scene?.tokens?.get?.(speaker.token)?.actor
    ?? globalThis.canvas?.tokens?.get?.(speaker.token)?.actor;
  if (tokenActor) return tokenActor;
  if (message?.actor) return message.actor;
  if (message?.speakerActor) return message.speakerActor;

  const speakerDocActor = globalThis.ChatMessage?.getSpeakerActor?.(speaker);
  if (speakerDocActor) return speakerDocActor;

  if (speaker.actor) {
    const directActor = globalThis.game?.actors?.get?.(speaker.actor);
    if (directActor) return directActor;
    const canvasActor = globalThis.canvas?.tokens?.placeables?.find(
      (t) => t.actor?.id === speaker.actor || t.id === speaker.actor
    )?.actor;
    if (canvasActor) return canvasActor;
  }

  const introText = cleanText(source?.querySelector(":scope > .introImg > .introTxt")?.textContent);
  const extractedName = extractActorNameFromIntro(introText);
  if (extractedName) {
    const actorByName = actorByDisplayedName(extractedName);
    if (actorByName) return actorByName;
  }

  if (speaker.alias) {
    const actorByAlias = actorByDisplayedName(speaker.alias);
    if (actorByAlias) return actorByAlias;
  }

  if (introText) {
    const normalizedIntro = normalize(introText);
    const allActors = [
      ...(globalThis.canvas?.tokens?.placeables ?? []).map((t) => t.actor).filter(Boolean),
      ...(globalThis.game?.actors ?? [])
    ];
    const matchingActor = allActors.find((candidate) => {
      const normCand = normalize(candidate.name);
      return normCand && normalizedIntro.startsWith(normCand);
    });
    if (matchingActor) return matchingActor;
  }

  return null;
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

function stripParenthetical(value = "") {
  return cleanText(String(value).replace(/\s*\([^)]*\)/gu, " "));
}

function normalize(value) {
  return cleanText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function signed(value) {
  return Number(value) > 0 ? `+${Number(value)}` : String(Number(value) || 0);
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

function isEnabled() {
  try {
    return game.settings.get(MODULE_ID, "enableCompactNpcAttackChat") !== false;
  } catch (_error) {
    return true;
  }
}
