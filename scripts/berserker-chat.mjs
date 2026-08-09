import { MODULE_ID } from "./constants.mjs";
import { appendOriginalChatPreview } from "./chat-original-preview.mjs";

const BERSERKER_REFERENCE = "berserker";
const LAY_ON_HANDS_REFERENCE = "layonhands";
const HOLY_AURA_REFERENCE = "holyaura";
const BRIMSTONE_CASCADE_REFERENCE = "brimstonecascade";

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
  return item?.system?.reference === BERSERKER_REFERENCE;
}

export function isLayOnHandsItem(item) {
  return item?.system?.reference === LAY_ON_HANDS_REFERENCE;
}

export function isHolyAuraItem(item) {
  return item?.system?.reference === HOLY_AURA_REFERENCE;
}

export function isBrimstoneCascadeItem(item) {
  return item?.system?.reference === BRIMSTONE_CASCADE_REFERENCE;
}

export function enhanceBerserkerCards(scope, message) {
  for (const root of matchingElements(scope, ".symbaroum.chat.ability")) {
    enhanceBerserkerCard(root, message);
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

function enhanceBerserkerCard(root, message) {
  if (root.dataset.tenebreBerserker === "true") return;

  const source = root.querySelector(":scope > .foreground");
  const abilityCaption = cleanText(source?.querySelector(":scope > .subText")?.textContent);
  const actor = resolveSpeakerActor(message);
  const item = findDisplayedAbility(actor, abilityCaption);
  if (!source || !actor || !item) return;

  const actorImage = backgroundImageUrl(source.querySelector(":scope > .introImg")?.getAttribute("style")) || actor.img;
  const abilityImage = source.querySelector(":scope > img")?.getAttribute("src") || item.img;
  const introText = cleanText(source.querySelector(":scope > .introImg > .introTxt")?.textContent);
  const actorName = stripParenthetical(actor.name);
  const targetImage = backgroundImageUrl(source.querySelector(":scope > .introImg > .introImg")?.getAttribute("style"));
  const targetName = stripTargetLabel(source.querySelector(":scope > .introImg > .targetText")?.textContent);
  const { caption, modifiers } = splitAbilityCaption(abilityCaption || item.name);
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
    createAbilityFlow(actorImage, actorName, abilityImage, caption, item, targetImage, targetName)
  );
  if (modifiers) {
    card.append(createTextElement("p", "tenebre-berserker-modifiers", modifiers));
  }

  const details = document.createElement("div");
  details.className = "tenebre-berserker-details";
  for (const node of source.querySelectorAll(":scope > .finalTxt")) {
    details.append(node.cloneNode(true));
  }
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

function createAbilityFlow(actorImage, actorName, abilityImage, abilityCaption, item, targetImage, targetName) {
  const participants = document.createElement("div");
  participants.className = "tenebre-berserker-participants";
  participants.append(
    createPortrait(actorImage, actorName, "tenebre-berserker-actor"),
    createFlowArrow(),
    createAbilityFigure(abilityImage, abilityCaption, item)
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

function createAbilityFigure(src, captionText, item) {
  const figure = createPortrait(src, captionText, "tenebre-berserker-ability");
  const caption = figure.querySelector("figcaption");
  caption.textContent = "";

  const link = document.createElement("a");
  link.href = "#";
  link.className = "content-link tenebre-berserker-ability-link";
  link.dataset.uuid = item.uuid;
  link.dataset.type = "Item";
  link.dataset.id = item.id;
  link.textContent = captionText;
  link.title = item.name;
  link.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    item.sheet?.render?.({ force: true });
  });
  caption.append(link);
  return figure;
}

function findDisplayedAbility(actor, abilityCaption) {
  if (!actor || !abilityCaption) return null;
  const items = Array.from(actor.items ?? []);
  if (!items.length) return null;

  const displayedName = normalize(abilityCaption);
  return items.find((item) => displayedName.startsWith(normalize(item.name)))
    ?? items.find((item) => displayedName.startsWith(normalize(referenceLabel(item))));
}

function referenceLabel(item) {
  if (isBerserkerItem(item)) return localize("ABILITY_LABEL.BERSERKER", "Berserker");
  if (isLayOnHandsItem(item)) return localize("POWER_LABEL.LAY_ON_HANDS", "Lay on Hands");
  if (isHolyAuraItem(item)) return localize("POWER_LABEL.HOLY_AURA", "Holy Aura");
  if (isBrimstoneCascadeItem(item)) return localize("POWER_LABEL.BRIMSTONE_CASCADE", "Brimstone Cascade");
  return item?.name ?? "";
}

export function splitAbilityCaption(value) {
  const [caption, ...modifiers] = cleanText(value).split(",");
  return {
    caption: cleanText(caption),
    modifiers: cleanText(modifiers.join(", "))
  };
}

export function stripTargetLabel(value = "") {
  return stripParenthetical(cleanText(value).replace(/^(?:Paciente|Patient|Alvo|Target|V[ií]tima|Victim)\s*:\s*/iu, ""));
}

function resolveSpeakerActor(message) {
  const speaker = message?.speaker ?? {};
  const scene = globalThis.game?.scenes?.get?.(speaker.scene);
  const tokenActor = scene?.tokens?.get?.(speaker.token)?.actor
    ?? globalThis.canvas?.tokens?.get?.(speaker.token)?.actor;
  return tokenActor ?? message?.speakerActor ?? globalThis.game?.actors?.get?.(speaker.actor) ?? null;
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
