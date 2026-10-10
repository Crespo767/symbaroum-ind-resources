export function escapeHtml(value) {
  if (game.symbaroum?.htmlEscape) return game.symbaroum.htmlEscape(String(value ?? ""));
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sanitizeHtml(value) {
  const raw = String(value ?? "");
  const cleanHtml = globalThis.foundry?.utils?.cleanHTML;
  return typeof cleanHtml === "function" ? cleanHtml(raw) : escapeHtml(raw);
}

export function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function toWordText(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, " ").trim();
}

const normalizedAliasCache = new WeakMap();

/**
 * Verdadeiro se algum alias aparece no texto como palavra(s) inteira(s).
 * "Arco Longo" casa com "arco"; "Coração" não casa com "racao"; "Elbow" não casa com "bow".
 */
export function matchesAnyAlias(value, aliases) {
  const text = ` ${toWordText(value)} `;
  if (text.length <= 2) return false;
  let words = normalizedAliasCache.get(aliases);
  if (!words) {
    words = aliases.map(toWordText).filter(Boolean).map((alias) => ` ${alias} `);
    normalizedAliasCache.set(aliases, words);
  }
  return words.some((alias) => text.includes(alias));
}

export function documentSourceUuid(document, fallback = "") {
  return String(
    document?._stats?.compendiumSource
      ?? document?.flags?.core?.sourceId
      ?? fallback
      ?? ""
  );
}

export async function promptDialog({
  title = "",
  content,
  okLabel = game.i18n.localize("TENEBRE.Common.Confirm"),
  cancelLabel = game.i18n.localize("TENEBRE.Common.Cancel"),
  okIcon = "fas fa-check",
  width = 300,
  callback = () => null,
  render = null,
  contentClass = "",
  symbaroumStyle = true
}) {
  const wrappedContent = symbaroumStyle
    ? `<div class="symbaroum dialog tenebre-symbaroum-dialog ${escapeHtml(contentClass)}">${content}</div>`
    : content;

  const buttons = [];
  if (cancelLabel) {
    buttons.push({
      action: "cancel",
      icon: "fas fa-times",
      label: cancelLabel,
      callback: () => null
    });
  }

  return foundry.applications.api.DialogV2.prompt({
    window: { title },
    position: { width },
    content: wrappedContent,
    render: render ? (event, dialog) => render(dialog?.element ?? event?.target, dialog) : undefined,
    buttons,
    ok: {
      icon: okIcon,
      label: okLabel,
      callback: async (_event, _button, dialog) => callback(dialog.element)
    },
    rejectClose: false
  });
}
