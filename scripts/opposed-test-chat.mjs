import { ChatController } from "./chat-controller.mjs";
import { MODULE_ID } from "./constants.mjs";
import { parseOpposedTest, parseRollValue, stripNpcParenthetical } from "./npc-attack-chat.mjs";
import { appendOriginalChatPreview } from "./chat-original-preview.mjs";
import { format, localize } from "./utils.mjs";

const TARGET_FLAG = "opposedTestTarget";

export class OpposedTestChatService {
  static #registered = false;

  static register() {
    if (this.#registered) return;
    this.#registered = true;

    Hooks.on("preCreateChatMessage", (message, data) => {
      captureOpposedTestTarget(message, data);
    });

    ChatController.registerRenderHook( (message, html) => {
      const scope = htmlElement(html);
      if (isEnabled()) enhanceOpposedTestCards(scope, message);
      else restoreOpposedTestCards(scope);
    });

    Hooks.on(`${MODULE_ID}.settingsChanged`, (key) => {
      if (key !== "enableCompactNpcAttackChat") return;
      _enabledCache = null;
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

export function formatAttributeTestResult(succeeded, criticalText = "") {
  const base = succeeded
    ? localize("TENEBRE.AttributeTestChat.Success", "Sucesso")
    : localize("TENEBRE.AttributeTestChat.Failure", "Falha");
  const critical = cleanText(criticalText);
  return critical ? `${base} — ${critical}` : base;
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

export function isDefenseRoll(formula, source = null) {
  const firstAttr = normalize(formula?.attributes?.[0]?.label);
  const defenseLabel = normalize(localize("ARMOR.DEFENSE", "Defense"));
  if (firstAttr === "defesa" || firstAttr === "defense" || firstAttr === "defensa" || firstAttr === defenseLabel) {
    return true;
  }
  if (source) {
    const baseInfo = source.querySelector?.(".baseinfo")?.textContent ?? "";
    const normBase = normalize(baseInfo);
    const protectionLabel = normalize(localize("ARMOR.PROTECTION", "Proteção"));
    if (normBase.includes(protectionLabel) || normBase.includes("protecao") || normBase.includes("protection")) {
      return true;
    }
  }
  return false;
}

export function extractArmorData(source) {
  const itemElement = source?.querySelector?.("[data-item-id]");
  if (!itemElement) return null;

  const id = itemElement.dataset?.itemId ?? "";
  const name = cleanText(itemElement.textContent);

  let img = "";
  const prev = itemElement.previousElementSibling;
  if (prev && prev.tagName?.toLowerCase() === "img") {
    img = prev.getAttribute("src") || "";
  } else {
    const portraits = source.querySelectorAll?.(":scope > img.portrait") ?? [];
    if (portraits.length > 1) {
      img = portraits[1].getAttribute("src") || "";
    }
  }

  const baseInfoEl = source.querySelector?.(".baseinfo strong") ?? source.querySelector?.(".baseinfo");
  const valueText = cleanText(baseInfoEl?.textContent ?? "");
  const protection = parseRollValue(valueText);

  const tooltipEl = source.querySelector?.("[data-item-id] ~ .dice-roll .dice-tooltip")
    ?? source.querySelectorAll?.(".dice-tooltip")?.[1]
    ?? null;

  return {
    id,
    name,
    img: img || "icons/svg/shield.svg",
    valueText,
    protection,
    tooltipEl
  };
}

export function createArmorSummary(armor) {
  const container = document.createElement("div");
  container.className = "tenebre-defense-armor";

  if (armor.img) {
    const img = document.createElement("img");
    img.className = "tenebre-defense-armor-img";
    img.src = armor.img;
    img.alt = armor.name;
    img.loading = "lazy";
    container.append(img);
  }

  const details = document.createElement("div");
  details.className = "tenebre-defense-armor-details";

  const nameEl = createTextElement("span", "tenebre-defense-armor-name", armor.name);
  nameEl.title = armor.name;

  const protectionLabel = localize("ARMOR.PROTECTION", "Proteção");
  const protectionText = armor.protection !== null
    ? format(
        "TENEBRE.OpposedTestChat.ArmorProtection",
        "{label}: {protection}",
        {
          label: protectionLabel,
          protection: armor.protection
        }
      )
    : (armor.valueText || `${protectionLabel}: 0`);

  const protectionEl = createTextElement("span", "tenebre-defense-armor-protection", protectionText);

  details.append(nameEl, protectionEl);
  container.append(details);
  return container;
}

function isNativeOpposedAttributeTest(content) {
  if (!content.includes("symbaroum") || !content.includes("chat") || !content.includes("roll")) return false;
  const template = document.createElement("template");
  template.innerHTML = content;
  const root = template.content.querySelector(".symbaroum.chat.roll");
  const source = root?.querySelector(":scope > .foreground");
  if (!source) return false;
  const formula = parseOpposedTest(source.querySelector(":scope > h3")?.textContent);
  if (formula.attributes.length !== 2) return false;
  if (source.querySelector("[data-item-id]") && !isDefenseRoll(formula, source)) return false;
  return true;
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
  const outcome = createTextElement("p", "tenebre-opposed-test-outcome", model.outcome);
  if (model.kind === "attribute") {
    outcome.classList.add(model.succeeded
      ? "tenebre-attribute-test-success"
      : "tenebre-attribute-test-failure");
  }
  card.append(
    createPortraits(model),
    createTextElement("p", "tenebre-opposed-test-formula", model.formulaText),
    createRollSummary(model),
    outcome
  );
  if (model.armor) {
    card.append(createArmorSummary(model.armor));
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
  if (!source) return null;

  const formula = parseOpposedTest(source.querySelector(":scope > h3")?.textContent);
  if (formula.attributes.length < 2) return null;
  if (source.querySelector("[data-item-id]") && !isDefenseRoll(formula, source)) return null;

  const rollElement = source.querySelector(".symba-rolls.roll.d20.success, .symba-rolls.roll.d20.failure");
  const target = messageFlag(message, TARGET_FLAG);
  const actorImage = source.querySelector(":scope > img.portrait")?.getAttribute("src") ?? "";
  const actorName = cleanText(message?.speaker?.alias);
  if (!rollElement || !actorImage || !actorName) return null;

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
  const armor = extractArmorData(source);
  const unadaptedElements = [marginText ? marginElement : null, tooltipElement].filter(Boolean);
  if (armor?.tooltipEl) unadaptedElements.push(armor.tooltipEl);
  if (!isOpposed) {
    return {
      kind: "attribute",
      actor: { name: stripNpcParenthetical(actorName), img: actorImage },
      title: formatAttributeTestTitle(actorName, actingAttribute.label),
      formulaText: `${actingAttribute.label} (${actingAttribute.value}) ← ${targetAttribute.label} (${signed(targetAttribute.value)})`,
      objective: formula.objective,
      roll: Number(cleanText(rollElement.textContent)),
      outcome: formatAttributeTestResult(succeeded, criticalText),
      succeeded,
      hasUnadaptedContent: unadaptedElements.length > 0,
      unadaptedElements,
      armor
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
    unadaptedElements,
    armor
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

let _enabledCache = null;
function isEnabled() {
  if (_enabledCache !== null) return _enabledCache;
  try {
    _enabledCache = game.settings.get(MODULE_ID, "enableCompactNpcAttackChat") !== false; return _enabledCache;
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

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
