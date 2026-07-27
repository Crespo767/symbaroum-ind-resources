import { MODULE_ID } from "./constants.mjs";

export const COMPAT_MODULES = {
  activeTokenEffects: "ATL",
  automatedAnimations: "autoanimations",
  calendaria: "calendaria",
  calendariaSdm: "calendaria-sdm",
  cleanerSheetTitleBar: "cleaner-sheet-title-bar",
  dragRuler: "drag-ruler",
  libWrapper: "lib-wrapper",
  metamorph: "metamorph",
  sequencer: "sequencer",
  socketlib: "socketlib",
  symbaroumBithir: "symbaroum-bithir-mod",
  tokenActionHudCore: "token-action-hud-core",
  tokenActionHudSymbaroum: "token-action-hud-symbaroum",
  tokenizer: "vtta-tokenizer",
  tokenizer2: "tokenizer-2",
  tokenMagic: "tokenmagic",
  tokenSounds: "token-sounds",
  tokenVariants: "token-variants",
  tabletopRpgMusic: "tabletop-rpg-music"
};

const DECISION_LEVELS = {
  ok: "ok",
  ceded: "ceded",
  riskExternal: "risk-external",
  warningExternal: "warning-external"
};

const ACKNOWLEDGED_NOTICE_SETTING = "compatibilityNoticeAcknowledged";
const NOTICE_CHECKBOX_NAME = "tenebre-hide-compatibility-notice";

let compatibilityLogged = false;
let compatibilityNoticeShown = false;
let noticeLanguage = null;
let noticeTranslations = {};

export class CompatibilityService {
  static decisions = [];

  static register() {
    this.applySheetTitleBarCompatibility();
    this.refresh();
    this.logSummary();
  }

  static applySheetTitleBarCompatibility() {
    const active = this.isModuleActive(COMPAT_MODULES.cleanerSheetTitleBar);
    globalThis.document?.documentElement?.classList?.toggle(
      "tenebre-cleaner-sheet-title-bar-active",
      active
    );
    return active;
  }

  static refresh() {
    this.decisions = this.buildDecisions();
    return this.getReport();
  }

  static isModuleActive(moduleId) {
    return Boolean(game.modules.get(moduleId)?.active);
  }

  static isModuleInstalled(moduleId) {
    return game.modules.has(moduleId);
  }

  static getModule(moduleId) {
    return game.modules.get(moduleId) ?? null;
  }

  static canUseLibWrapper() {
    return this.isModuleActive(COMPAT_MODULES.libWrapper)
      && typeof globalThis.libWrapper?.register === "function";
  }

  static buildVisualActiveEffectData(data) {
    return buildVisualActiveEffectData(data);
  }

  static buildContextMenuEntry(data) {
    return buildContextMenuEntry(data);
  }

  static shouldSkipBundledBithir() {
    return this.isModuleActive(COMPAT_MODULES.symbaroumBithir);
  }

  static shouldSkipMovementRuler() {
    return this.isModuleActive(COMPAT_MODULES.dragRuler);
  }

  static shouldSkipMovementValidation() {
    return this.isModuleActive(COMPAT_MODULES.dragRuler);
  }

  static getNoticeDecisions() {
    return this.decisions
      .filter((entry) => entry.level !== DECISION_LEVELS.ok)
      .map((entry) => ({
        ...entry,
        modules: getDecisionModules(entry.moduleId),
        levelLabel: localize(`TENEBRE.Compatibility.Level.${entry.level}`, entry.level),
        feature: localize(`TENEBRE.Compatibility.${entry.noticeKey}.Feature`, entry.area),
        effect: localize(`TENEBRE.Compatibility.${entry.noticeKey}.Effect`, entry.action)
      }));
  }

  static async showStartupNotice() {
    if (!game.user?.isGM) return false;
    if (compatibilityNoticeShown) return false;

    await this.loadNoticeTranslations();
    this.refresh();
    const decisions = this.getNoticeDecisions();
    if (!decisions.length) return false;

    const noticeKeys = getNoticeDecisionKeys(decisions);
    if (isNoticeSuppressed(noticeKeys)) return false;

    compatibilityNoticeShown = true;
    const content = buildCompatibilityNoticeContent(decisions);
    const DialogV2 = foundry.applications?.api?.DialogV2;
    if (DialogV2) {
      const dialog = new DialogV2({
        window: {
          title: localize("TENEBRE.Compatibility.Title", "Tenebre Resources: Compatibility notice"),
          resizable: true
        },
        position: {
          width: 640
        },
        content,
        render: (_event, app) => activateNoticeControls(app?.element, noticeKeys),
        buttons: [
          {
            action: "ok",
            label: localize("TENEBRE.Common.Confirm", "Confirm"),
            icon: "fas fa-check",
            default: true,
            callback: async (_event, _button, app) => {
              await persistNoticeSuppression(resolveDialogElement(app), noticeKeys);
              return true;
            }
          }
        ]
      });
      await dialog.render({ force: true });
      return true;
    }

    new Dialog({
      title: localize("TENEBRE.Compatibility.Title", "Tenebre Resources: Compatibility notice"),
      content,
      buttons: {
        ok: {
          icon: '<i class="fas fa-check"></i>',
          label: localize("TENEBRE.Common.Confirm", "Confirm"),
          callback: async (html) => persistNoticeSuppression(html?.[0] ?? html, noticeKeys)
        }
      },
      default: "ok",
      render: (html) => activateNoticeControls(html?.[0] ?? html, noticeKeys)
    }).render(true);
    return true;
  }

  static async loadNoticeTranslations() {
    const lang = String(game.i18n?.lang ?? "en");
    if (noticeLanguage === lang) return;

    noticeLanguage = lang;
    noticeTranslations = {};

    const path = getNoticeLanguagePath(lang);
    if (!path) return;

    try {
      const response = await fetch(path);
      if (!response.ok) return;
      noticeTranslations = await response.json();
    } catch (error) {
      console.warn(`${MODULE_ID} | Failed to load compatibility notice translations for ${lang}.`, error);
    }
  }

  static getReport() {
    return {
      module: MODULE_ID,
      generatedAt: new Date().toISOString(),
      foundryGeneration: getFoundryGeneration(),
      activeModules: this.getKnownModuleStates(),
      decisions: this.decisions.map((entry) => ({ ...entry }))
    };
  }

  static getKnownModuleStates() {
    return Object.fromEntries(
      Object.entries(COMPAT_MODULES).map(([key, moduleId]) => {
        const module = this.getModule(moduleId);
        return [key, {
          id: moduleId,
          installed: Boolean(module),
          active: Boolean(module?.active),
          title: module?.title ?? null,
          version: module?.version ?? null,
          minimum: module?.compatibility?.minimum ?? null,
          verified: module?.compatibility?.verified ?? null
        }];
      })
    );
  }

  static buildDecisions() {
    const decisions = [];
    const foundryGeneration = getFoundryGeneration();

    if (this.shouldSkipBundledBithir()) {
      decisions.push(decision({
        level: DECISION_LEVELS.ceded,
        moduleId: COMPAT_MODULES.symbaroumBithir,
        noticeKey: "Bithir",
        area: "game.bithirmod",
        action: "Bundled Bithir utilities disabled.",
        reason: "The official Bithir module owns game.bithirmod and its own settings namespace."
      }));
    }

    if (this.shouldSkipMovementRuler()) {
      decisions.push(decision({
        level: DECISION_LEVELS.ceded,
        moduleId: COMPAT_MODULES.dragRuler,
        noticeKey: "DragRuler",
        area: "Token ruler and movement validation",
        action: "Tenebre movement ruler patches disabled.",
        reason: "Drag Ruler owns ruler rendering and token movement measurement; avoiding double patches prevents movement/ruler conflicts."
      }));
    }

    if (this.isModuleActive(COMPAT_MODULES.cleanerSheetTitleBar)) {
      decisions.push(decision({
        level: DECISION_LEVELS.ok,
        moduleId: COMPAT_MODULES.cleanerSheetTitleBar,
        area: "Document sheet title bars",
        action: "Keeping title-bar labels visually compact during Tenebre-triggered sheet renders.",
        reason: "Cleaner Sheet Title Bar removes labels after a delay; the compatibility class prevents labels from flashing before its cleanup runs."
      }));
    }

    if (this.isModuleActive(COMPAT_MODULES.tokenSounds) && foundryGeneration < 14) {
      decisions.push(decision({
        level: DECISION_LEVELS.riskExternal,
        moduleId: COMPAT_MODULES.tokenSounds,
        noticeKey: "TokenSounds",
        area: "Token audio",
        action: "Diagnostic only; no Tenebre patch is applied.",
        reason: "Token Audio FX declares Foundry minimum 14 while this world is running an older core generation."
      }));
    }

    if (this.isModuleActive(COMPAT_MODULES.calendariaSdm) && !this.isModuleActive(COMPAT_MODULES.calendaria)) {
      decisions.push(decision({
        level: DECISION_LEVELS.warningExternal,
        moduleId: COMPAT_MODULES.calendariaSdm,
        noticeKey: "CalendariaSdm",
        area: "Calendar integration",
        action: "Diagnostic only; no Tenebre patch is applied.",
        reason: "Calendaria: SDM expects the base Calendaria module to be installed and active."
      }));
    }

    if (this.isModuleActive(COMPAT_MODULES.tokenizer) && this.isModuleActive(COMPAT_MODULES.tokenizer2)) {
      decisions.push(decision({
        level: DECISION_LEVELS.warningExternal,
        moduleId: `${COMPAT_MODULES.tokenizer}, ${COMPAT_MODULES.tokenizer2}`,
        noticeKey: "Tokenizers",
        area: "Token image editing",
        action: "Diagnostic only; no Tenebre patch is applied.",
        reason: "Both Tokenizer generations are active. They can overlap in UI and file workflows."
      }));
    }

    if (this.isModuleActive(COMPAT_MODULES.tabletopRpgMusic)) {
      decisions.push(decision({
        level: DECISION_LEVELS.riskExternal,
        moduleId: COMPAT_MODULES.tabletopRpgMusic,
        noticeKey: "TabletopRpgMusic",
        area: "Audio playlists",
        action: "Diagnostic only; no Tenebre patch is applied.",
        reason: "This module is outside Tenebre's owned surfaces and has an older compatibility target than the current Foundry generation."
      }));
    }

    if (this.canUseLibWrapper()) {
      decisions.push(decision({
        level: DECISION_LEVELS.ok,
        moduleId: COMPAT_MODULES.libWrapper,
        area: "Global method patches",
        action: "Using libWrapper where patch chaining is supported.",
        reason: "This reduces conflicts with modules that also wrap Foundry or Symbaroum methods."
      }));
    }

    return decisions;
  }

  static logSummary() {
    if (compatibilityLogged) return;
    compatibilityLogged = true;

    if (!this.decisions.length) {
      console.info(`${MODULE_ID} | Compatibility guard active. No compatibility risks detected.`);
      return;
    }

    console.info(`${MODULE_ID} | Compatibility guard active.`, this.getReport());
  }
}

export function buildVisualActiveEffectData(data, generation = getFoundryGeneration()) {
  const effect = {
    name: data.name,
    img: data.img,
    changes: data.changes ?? [],
    disabled: false,
    transfer: false,
    statuses: data.statuses ?? [],
    flags: data.flags ?? {}
  };

  if (generation >= 14) {
    effect.showIcon = globalThis.CONST?.ACTIVE_EFFECT_SHOW_ICON?.ALWAYS ?? 2;
  }
  return effect;
}

export function buildContextMenuEntry(data, generation = getFoundryGeneration()) {
  const resolveTarget = (target) => target?.[0] ?? target;
  const visible = typeof data.visible === "function"
    ? (target) => data.visible(resolveTarget(target))
    : data.visible;

  if (generation >= 14) {
    return {
      label: data.label,
      icon: data.icon,
      visible,
      onClick: (event, target) => data.onClick?.(resolveTarget(target), event)
    };
  }

  return {
    name: data.label,
    icon: data.icon,
    condition: visible,
    callback: (target) => data.onClick?.(resolveTarget(target))
  };
}

function resolveDialogElement(value) {
  if (value instanceof HTMLElement) return value;
  if (value?.element instanceof HTMLElement) return value.element;
  if (value?.[0] instanceof HTMLElement) return value[0];
  return null;
}

function decision({ level, moduleId, noticeKey, area, action, reason }) {
  return {
    level,
    moduleId,
    noticeKey,
    area,
    action,
    reason
  };
}

function getFoundryGeneration() {
  const generation = Number(game.release?.generation);
  if (Number.isFinite(generation)) return generation;

  const major = Number(String(game.version ?? "").split(".")[0]);
  return Number.isFinite(major) ? major : 0;
}

function getDecisionModules(moduleId) {
  return String(moduleId ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => {
      const module = game.modules.get(id);
      return {
        id,
        title: module?.title ?? id,
        version: module?.version ?? null
      };
    });
}

function buildCompatibilityNoticeContent(decisions) {
  const items = decisions.map((entry) => {
    const moduleNames = entry.modules
      .map((module) => `${escapeHtml(module.title)} <code>${escapeHtml(module.id)}</code>${module.version ? ` <span>v${escapeHtml(module.version)}</span>` : ""}`)
      .join(", ");

    return `
      <li class="tenebre-compatibility-entry tenebre-compatibility-${escapeHtml(entry.level)}">
        <header>
          <strong>${escapeHtml(entry.levelLabel)}</strong>
          <span>${moduleNames}</span>
        </header>
        <dl>
          <dt>${escapeHtml(localize("TENEBRE.Compatibility.AffectedFeature", "Affected feature"))}</dt>
          <dd>${escapeHtml(entry.feature)}</dd>
          <dt>${escapeHtml(localize("TENEBRE.Compatibility.Effect", "What changed"))}</dt>
          <dd>${escapeHtml(entry.effect)}</dd>
        </dl>
      </li>
    `;
  }).join("");

  return `
    <div class="tenebre-compatibility-notice">
      <p>${escapeHtml(localize("TENEBRE.Compatibility.Intro", "Tenebre Resources detected active modules that touch the same Foundry areas or have external compatibility risks. To avoid blocking the world, Tenebre changed or disabled some of its own integrations."))}</p>
      <ol>${items}</ol>
      <p class="tenebre-compatibility-note">${escapeHtml(localize("TENEBRE.Compatibility.Footer", "This is not a fatal error. It explains which functionality may behave differently while these modules remain active."))}</p>
      <label class="tenebre-compatibility-hide">
        <input type="checkbox" name="${NOTICE_CHECKBOX_NAME}">
        <span>${escapeHtml(localize("TENEBRE.Compatibility.DoNotShowAgain", "Do not show this message again"))}</span>
      </label>
    </div>
  `;
}

function activateNoticeControls(root, noticeKeys) {
  const element = resolveRoot(root);
  const checkbox = element?.querySelector?.(`input[name="${NOTICE_CHECKBOX_NAME}"]`);
  checkbox?.addEventListener("change", () => {
    if (checkbox.checked) {
      void acknowledgeNoticeKeys(noticeKeys);
    }
  });
}

async function persistNoticeSuppression(root, noticeKeys) {
  const element = resolveRoot(root);
  const checkbox = element?.querySelector?.(`input[name="${NOTICE_CHECKBOX_NAME}"]`);
  if (checkbox?.checked) {
    await acknowledgeNoticeKeys(noticeKeys);
  }
}

function isNoticeSuppressed(noticeKeys) {
  if (!noticeKeys.length) return true;

  const acknowledged = getAcknowledgedNoticeKeys();
  return noticeKeys.every((key) => acknowledged.has(key));
}

function getNoticeDecisionKeys(decisions) {
  return decisions
    .map((entry) => getNoticeDecisionKey(entry))
    .filter(Boolean)
    .sort();
}

function getNoticeDecisionKey(entry) {
  const moduleIds = String(entry.moduleId ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .sort()
    .join("+");

  return [entry.level, entry.noticeKey, moduleIds].filter(Boolean).join("|");
}

function getAcknowledgedNoticeKeys() {
  if (!game.settings.settings.has(`${MODULE_ID}.${ACKNOWLEDGED_NOTICE_SETTING}`)) return new Set();

  const value = game.settings.get(MODULE_ID, ACKNOWLEDGED_NOTICE_SETTING);
  const signatures = Array.isArray(value?.signatures) ? value.signatures : [];
  return new Set(signatures.map((signature) => String(signature)).filter(Boolean));
}

async function acknowledgeNoticeKeys(noticeKeys) {
  if (!game.settings.settings.has(`${MODULE_ID}.${ACKNOWLEDGED_NOTICE_SETTING}`)) return;

  const acknowledged = getAcknowledgedNoticeKeys();
  for (const key of noticeKeys) {
    acknowledged.add(String(key));
  }

  await game.settings.set(MODULE_ID, ACKNOWLEDGED_NOTICE_SETTING, {
    version: 1,
    signatures: [...acknowledged].sort()
  });
}

function resolveRoot(root) {
  if (!root) return null;
  if (root instanceof HTMLElement) return root;
  if (root[0] instanceof HTMLElement) return root[0];
  return root.element instanceof HTMLElement ? root.element : null;
}

function localize(key, fallback) {
  const activeTranslation = noticeTranslations?.[key];
  if (activeTranslation) return activeTranslation;

  const value = game.i18n?.localize?.(key);
  return value && value !== key ? value : fallback;
}

function getNoticeLanguagePath(lang) {
  const normalized = String(lang ?? "").toLowerCase();
  if (normalized.startsWith("pt")) return `modules/${MODULE_ID}/languages/pt-BR.json`;
  if (normalized.startsWith("en")) return `modules/${MODULE_ID}/languages/en.json`;
  return null;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}
