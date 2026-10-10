import { localize } from "./utils.mjs";
export function appendOriginalChatPreview(card, source, { hasUnadaptedContent = false, unadaptedElements = [] } = {}) {
  const elements = [...new Set(unadaptedElements.filter(Boolean))];
  if (!card || !source || (!hasUnadaptedContent && !elements.length) || !globalThis.game?.user?.isGM) return false;

  const preview = source.cloneNode(true);
  preview.hidden = true;
  preview.classList.add("tenebre-original-chat-preview");
  highlightUnadaptedContent(source, preview, elements);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "tenebre-original-chat-info";
  button.title = localize("TENEBRE.ChatOriginal.Show", "Show original message");
  button.setAttribute("aria-label", button.title);
  button.setAttribute("aria-expanded", "false");

  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "i";
  button.append(icon);

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    preview.hidden = !preview.hidden;
    const expanded = !preview.hidden;
    button.classList.toggle("is-open", expanded);
    button.setAttribute("aria-expanded", String(expanded));
    button.title = localize(
      expanded ? "TENEBRE.ChatOriginal.Hide" : "TENEBRE.ChatOriginal.Show",
      expanded ? "Hide original message" : "Show original message"
    );
    button.setAttribute("aria-label", button.title);
  });

  card.append(button, preview);
  return true;
}

export function highlightUnadaptedContent(source, preview, elements = []) {
  let highlighted = 0;
  for (const element of new Set(elements.filter(Boolean))) {
    const clonedElement = findMatchingClone(source, preview, element);
    if (!clonedElement?.classList || clonedElement.classList.contains("tenebre-original-chat-omitted")) continue;
    clonedElement.classList.add("tenebre-original-chat-omitted");
    highlighted += 1;
  }

  if (!highlighted) return 0;
  const legend = document.createElement("p");
  legend.className = "tenebre-original-chat-highlight-legend";
  legend.textContent = localize(
    "TENEBRE.ChatOriginal.NotShown",
    "Highlighted: information not shown in the Ind Resources card."
  );
  preview.prepend(legend);
  return highlighted;
}

export function findMatchingClone(source, preview, element) {
  if (!source || !preview || !element) return null;
  if (source === element) return preview;

  const path = [];
  let current = element;
  while (current && current !== source) {
    const parent = current.parentElement;
    if (!parent) return null;
    const index = Array.prototype.indexOf.call(parent.children, current);
    if (index < 0) return null;
    path.unshift(index);
    current = parent;
  }
  if (current !== source) return null;

  let clone = preview;
  for (const index of path) {
    clone = clone?.children?.[index];
    if (!clone) return null;
  }
  return clone;
}

