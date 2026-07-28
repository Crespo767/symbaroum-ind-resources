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
  contentClass = "",
  symbaroumStyle = true
}) {
  const wrappedContent = symbaroumStyle
    ? `<div class="symbaroum dialog tenebre-symbaroum-dialog ${escapeHtml(contentClass)}">${content}</div>`
    : content;

  return foundry.applications.api.DialogV2.prompt({
    window: { title },
    position: { width },
    content: wrappedContent,
    buttons: [{
      action: "cancel",
      icon: "fas fa-times",
      label: cancelLabel,
      callback: () => null
    }],
    ok: {
      icon: okIcon,
      label: okLabel,
      callback: async (_event, _button, dialog) => callback(dialog.element)
    },
    rejectClose: false
  });
}
