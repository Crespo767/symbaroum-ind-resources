import { MODULE_ID } from "./constants.mjs";
import { parseOpposedTest, stripNpcParenthetical } from "./npc-attack-chat.mjs";
import { appendOriginalChatPreview } from "./chat-original-preview.mjs";

const TARGET_FLAG = "opposedTestTarget";

export class OpposedTestChatService {
  static #registered = false;

  static register() {
    if (this.#registered) return;
    this.#registered = true;

    Hooks.on("preCreateChatMessage", (message, data) => {
      captureOpposedTestTarget(message, data);
    });

    Hooks.on("renderChatMessageHTML", (message, html) => {
      const scope = htmlElement(html);
      if (isEnabled()) enhanceOpposedTestCards(scope, message);
      else restoreOpposedTestCards(scope);
    });

    Hooks.on(`${MODULE_ID}.settingsChanged`, (key) => {
      if (key !== "enableCompactNpcAttackChat") return;
      const scope = htmlElement(globalThis.ui?.chat?.element) ?? globalThis.document;
      restoreOpposedTestCards(scope);
      globalThis.ui?.chat?.render?.({ force: true });
    });
  }
}

export function formatOpposedTestResult(name, succeeded, criticalText = "") {
  const result = succeeded
    ? localize("TENEBRE.OpposedTestChat.Success", "sucesso")
    : localize("TENEBRE.OpposedTestChat.Failure", "falha");
  const outcome = format(
    "TENEBRE.OpposedTestChat.Result",
    "{name} obtém {result}.",
    { name: stripNpcParenthetical(name), result }
  );
  const critical = cleanText(criticalText);
  return critical ? `${outcome} — ${critical}` : outcome;
}

export function formatAttributeTestTitle(name, attribute) {
  return format(
    "TENEBRE.AttributeTestChat.Title",
    "{name} realiza um teste de {attribute}",
    { name: stripNpcParenthetical(name), attribute: cleanText(attribute) }
  );
}

export function formatAttributeTestResult(name, attribute, succeeded, criticalText = "") {
  const key = succeeded
    ? "TENEBRE.AttributeTestChat.Success"
    : "TENEBRE.AttributeTestChat.Failure";
  const fallback = succeeded
    ? "{name} passa no teste de {attribute}."
    : "{name} falha no teste de {attribute}.";
  const outcome = format(key, fallback, {
    name: stripNpcParenthetical(name),
    attribute: cleanText(attribute)
  });
  const critical = cleanText(criticalText);
  return critical ? `${outcome} — ${critical}` : outcome;
}

export function enhanceOpposedTestCards(scope, message) {
  for (const root of matchingElements(scope, ".symbaroum.chat.roll")) {
    enhanceOpposedTestCard(root, message);
  }
}

export function restoreOpposedTestCards(scope) {
  for (const root of matchingElements(scope, ".symbaroum.chat.roll[data-tenebre-opposed-test='true']")) {
    const source = root.querySelector(":scope > .foreground");
    const card = root.querySelector(":scope > .tenebre-opposed-test-card");
    if (source) source.hidden = false;
    card?.remove();
    root.classList.remove("tenebre-opposed-test-compact");
    delete root.dataset.tenebreOpposedTest;
  }
}

function captureOpposedTestTarget(message, data) {
  const content = String(message?.content ?? data?.content ?? "");
  if (!isNativeOpposedAttributeTest(content)) return;

  const target = Array.from(globalThis.game?.user?.targets ?? [])[0];
  const actor = target?.actor;
  if (!actor) return;

  const flags = globalThis.foundry?.utils?.deepClone
    ? foundry.utils.deepClone(message?.flags ?? data?.flags ?? {})
    : structuredClone(message?.flags ?? data?.flags ?? {});
  flags[MODULE_ID] = {
    ...(flags[MODULE_ID] ?? {}),
    [TARGET_FLAG]: {
      actorUuid: actor.uuid ?? null,
      name: target.name ?? actor.name ?? "",
      img: target.document?.actorLink
        ? actor.img
        : target.document?.texture?.src ?? target.texture?.src ?? actor.img ?? ""
    }
  };
  message.updateSource({ flags });
}

function isNativeOpposedAttributeTest(content) {
  if (!content.includes("symbaroum") || !content.includes("chat") || !content.includes("roll")) return false;
  const template = document.createElement("template");
  template.innerHTML = content;
  const root = template.content.querySelector(".symbaroum.chat.roll");
  const source = root?.querySelector(":scope > .foreground");
  if (!source || source.querySelector("[data-item-id]")) return false;
  return parseOpposedTest(source.querySelector(":scope > h3")?.textContent).attributes.length === 2;
}

function enhanceOpposedTestCard(root, message) {
  if (root.dataset.tenebreOpposedTest === "true") return;
  const source = root.querySelector(":scope > .foreground");
  const model = buildOpposedTestModel(source, message);
  if (!source || !model) return;

  const card = document.createElement("section");
  card.className = "tenebre-opposed-test-card";
  if (model.kind === "attribute") {
    card.classList.add("tenebre-attribute-test-card");
    card.append(createTextElement("h3", "tenebre-attribute-test-title", model.title));
  }
  card.append(
    createPortraits(model),
    createTextElement("p", "tenebre-opposed-test-formula", model.formulaText),
    createRollSummary(model),
    createTextElement("p", "tenebre-opposed-test-outcome", model.outcome)
  );
  if (model.marginText) {
    card.append(createTextElement("p", "tenebre-attribute-test-margin", model.marginText));
  }
  appendOriginalChatPreview(card, source, {
    hasUnadaptedContent: model.hasUnadaptedContent,
    unadaptedElements: model.unadaptedElements
  });

  source.hidden = true;
  root.classList.add("tenebre-opposed-test-compact");
  root.dataset.tenebreOpposedTest = "true";
  root.append(card);
}

function buildOpposedTestModel(source, message) {
  if (!source || source.querySelector("[data-item-id]")) return null;

  const formula = parseOpposedTest(source.querySelector(":scope > h3")?.textContent);
  const rollElement = source.querySelector(".symba-rolls.roll.d20.success, .symba-rolls.roll.d20.failure");
  const target = messageFlag(message, TARGET_FLAG);
  const actorImage = source.querySelector(":scope > img.portrait")?.getAttribute("src") ?? "";
  const actorName = cleanText(message?.speaker?.alias);
  if (formula.attributes.length < 2 || !rollElement || !actorImage || !actorName) return null;

  const succeeded = rollElement.classList.contains("success");
  const criticalText = [...source.querySelectorAll(":scope > h4")]
    .map((element) => cleanText(element.textContent))
    .filter(Boolean)
    .join(" — ");
  const [actingAttribute, targetAttribute] = formula.attributes;
  const marginElement = source.querySelector(".dice-roll h4:nth-child(2)");
  const tooltipElement = source.querySelector(".dice-tooltip");
  const marginText = cleanText(marginElement?.textContent);
  const isOpposed = Boolean(target?.img);
  const unadaptedElements = [isOpposed && marginText ? marginElement : null, tooltipElement].filter(Boolean);
  if (!isOpposed) {
    return {
      kind: "attribute",
      actor: { name: stripNpcParenthetical(actorName), img: actorImage },
      title: formatAttributeTestTitle(actorName, actingAttribute.label),
      formulaText: `${actingAttribute.label} (${actingAttribute.value}) ← ${targetAttribute.label} (${signed(targetAttribute.value)})`,
      objective: formula.objective,
      roll: Number(cleanText(rollElement.textContent)),
      outcome: formatAttributeTestResult(actorName, actingAttribute.label, succeeded, criticalText),
      marginText,
      hasUnadaptedContent: unadaptedElements.length > 0,
      unadaptedElements
    };
  }
  return {
    kind: "opposed",
    actor: { name: stripNpcParenthetical(actorName), img: actorImage },
    target: { name: stripNpcParenthetical(target.name), img: target.img },
    formulaText: `${actingAttribute.label} (${actingAttribute.value}) ← ${targetAttribute.label} (${signed(targetAttribute.value)})`,
    objective: formula.objective,
    roll: Number(cleanText(rollElement.textContent)),
    outcome: formatOpposedTestResult(actorName, succeeded, criticalText),
    hasUnadaptedContent: unadaptedElements.length > 0,
    unadaptedElements
  };
}

function createPortraits(model) {
  const portraits = document.createElement("div");
  portraits.className = "tenebre-opposed-test-portraits";
  if (model.kind === "attribute") {
    portraits.classList.add("tenebre-attribute-test-portrait");
    portraits.append(createPortrait(model.actor, true));
  } else {
    portraits.append(createPortrait(model.actor), createPortrait(model.target));
  }
  return portraits;
}

function createPortrait(participant, withCaption = false) {
  if (withCaption) {
    const figure = document.createElement("figure");
    figure.className = "tenebre-attribute-test-character";
    figure.append(createPortrait(participant), createTextElement("figcaption", "", participant.name));
    return figure;
  }
  const image = document.createElement("img");
  image.src = participant.img || "icons/svg/mystery-man.svg";
  image.alt = participant.name;
  image.title = participant.name;
  image.loading = "lazy";
  return image;
}

function createRollSummary(model) {
  const summary = document.createElement("div");
  summary.className = "tenebre-opposed-test-roll-summary";
  summary.append(
    createTextElement(
      "p",
      "tenebre-opposed-test-objective",
      `${localize("TENEBRE.OpposedTestChat.Objective", "Objetivo")}: ${model.objective}`
    ),
    createTextElement(
      "p",
      "tenebre-opposed-test-roll",
      `${localize("TENEBRE.OpposedTestChat.Roll", "Rolagem")}: ${model.roll}`
    )
  );
  return summary;
}

function messageFlag(message, key) {
  return message?.getFlag?.(MODULE_ID, key) ?? message?.flags?.[MODULE_ID]?.[key] ?? null;
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
