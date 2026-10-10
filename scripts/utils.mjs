/** Escapa texto para HTML e atributos entre aspas. Única implementação do módulo. */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/`/g, "&#96;");
}

/** Tradução com valor alternativo quando a chave não existe. */
export function localize(key, fallback = key) {
  const value = globalThis.game?.i18n?.localize?.(key);
  return value && value !== key ? value : fallback;
}

/** Tradução com placeholders; usa `fallback` (com {campos}) quando a chave não existe. */
export function format(key, fallback, data = {}) {
  const value = globalThis.game?.i18n?.format?.(key, data);
  if (value && value !== key) return value;
  return String(fallback ?? key).replace(/\{(\w+)\}/g, (_match, field) => String(data[field] ?? ""));
}

/**
 * Verdadeiro só no cliente do GM ativo designado pelo core (game.users.activeGM).
 * Use para tarefas automáticas que devem rodar uma única vez no mundo.
 */
export function isActiveGM() {
  const user = globalThis.game?.user;
  if (!user?.isGM) return false;
  const activeGM = globalThis.game?.users?.activeGM;
  return !activeGM || activeGM.id === user.id;
}

/**
 * Executor único de automações de um ator: o GM ativo; sem GM online, o dono ativo de menor id.
 */
export function isActorExecutor(actor) {
  if (!actor || !globalThis.game?.user?.active) return false;
  if (globalThis.game.users?.activeGM) return isActiveGM();
  const owner = Array.from(globalThis.game.users ?? [])
    .filter((user) => user.active && actor.testUserPermission?.(user, "OWNER"))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))[0];
  return owner?.id === globalThis.game.user.id;
}

/** Re-renderiza as fichas abertas de um ator (V1 e ApplicationV2), ou de todos os atores se nenhum for dado. */
export function rerenderActorSheets(actor = null) {
  const apps = new Set(Object.values(globalThis.ui?.windows ?? {}));
  const instances = globalThis.foundry?.applications?.instances;
  if (typeof instances?.values === "function") {
    for (const app of instances.values()) apps.add(app);
  }
  for (const app of apps) {
    const sheetActor = app?.actor ?? app?.document;
    if (sheetActor?.documentName !== "Actor" || typeof app.render !== "function") continue;
    if (actor && sheetActor.uuid !== actor.uuid && sheetActor.id !== actor.id) continue;
    app.render(false);
  }
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

export function normalizeText(value) {
  return normalize(value).trim();
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
