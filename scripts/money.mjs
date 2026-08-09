import { escapeHtml } from "./utils.mjs";

export const MONEY_VALUES = Object.freeze({
  thaler: 100,
  shilling: 10,
  orteg: 1
});
export const MAX_MONEY_ORTEGS = Number.MAX_SAFE_INTEGER;

const MONEY_PATHS = Object.freeze({
  thaler: "system.money.thaler",
  shilling: "system.money.shilling",
  orteg: "system.money.orteg"
});

export class MoneyService {
  static getMoney(actor) {
    return normalizeMoney(actor?.system?.money ?? {});
  }

  static getTotalOrtegs(actor) {
    return moneyToOrtegs(actor?.system?.money ?? {});
  }

  static async open(actor) {
    if (!actor?.isOwner && !game.user?.isGM) {
      ui.notifications?.warn(game.i18n.localize("TENEBRE.Money.NoPermission"));
      return null;
    }

    const request = await promptMoneyOperation(actor);

    if (!request) return null;
    const result = applyMoneyOperation({
      current: actor.system?.money ?? {},
      delta: request.delta,
      mode: request.mode
    });
    if (!result.ok) {
      const key = result.reason === "overflow"
        ? "TENEBRE.Money.InvalidAmount"
        : "TENEBRE.Money.Insufficient";
      ui.notifications?.warn(game.i18n.localize(key));
      return null;
    }

    await actor.update(toActorMoneyUpdate(result.money));
    ui.notifications?.info(game.i18n.format("TENEBRE.Money.Updated", {
      actor: actor.name,
      money: formatMoney(result.money)
    }));
    return result.money;
  }
}

export function normalizeMoney(money) {
  const total = Math.max(0, moneyToOrtegs(money));
  const thaler = Math.floor(total / MONEY_VALUES.thaler);
  const shilling = Math.floor((total % MONEY_VALUES.thaler) / MONEY_VALUES.shilling);
  const orteg = total % MONEY_VALUES.shilling;
  return { thaler, shilling, orteg };
}

export function moneyToOrtegs(money) {
  const total = toNonNegativeInteger(money?.thaler) * MONEY_VALUES.thaler
    + toNonNegativeInteger(money?.shilling) * MONEY_VALUES.shilling
    + toNonNegativeInteger(money?.orteg) * MONEY_VALUES.orteg;
  return Number.isSafeInteger(total) ? total : MAX_MONEY_ORTEGS;
}

export function parseMoneyFormData(formData) {
  return normalizeMoney({
    thaler: formData.get("thaler"),
    shilling: formData.get("shilling"),
    orteg: formData.get("orteg")
  });
}

export function applyMoneyOperation({ current, delta, mode }) {
  const currentTotal = moneyToOrtegs(current);
  const deltaTotal = moneyToOrtegs(delta);
  const operation = mode === "spend" ? "spend" : "add";
  if (operation === "add" && deltaTotal > MAX_MONEY_ORTEGS - currentTotal) {
    return {
      ok: false,
      reason: "overflow",
      currentTotal,
      deltaTotal,
      total: currentTotal,
      money: normalizeMoney(current)
    };
  }

  const nextTotal = operation === "spend"
    ? currentTotal - deltaTotal
    : currentTotal + deltaTotal;

  if (nextTotal < 0) {
    return {
      ok: false,
      reason: "insufficient",
      currentTotal,
      deltaTotal,
      total: currentTotal,
      money: normalizeMoney(current)
    };
  }

  return {
    ok: true,
    reason: null,
    currentTotal,
    deltaTotal,
    total: nextTotal,
    money: normalizeMoney({ orteg: nextTotal })
  };
}

export function buildMoneyDialogContent(actor, labels = defaultLabels()) {
  const money = MoneyService.getMoney(actor);
  return `
    <div class="tenebre-money-dialog-content">
      <section class="tenebre-money-balance" aria-label="${escapeHtml(labels.current)}">
        <div class="tenebre-money-balance-title">
          <i class="fas fa-coins" aria-hidden="true"></i>
          <strong>${escapeHtml(labels.current)}</strong>
        </div>
        <div class="tenebre-money-balance-values">
          ${moneyBalanceItem(money.thaler, labels.thaler)}
          ${moneyBalanceItem(money.shilling, labels.shilling)}
          ${moneyBalanceItem(money.orteg, labels.orteg)}
        </div>
      </section>
      <div class="tenebre-money-fields">
        ${moneyInput("thaler", labels.thaler)}
        ${moneyInput("shilling", labels.shilling)}
        ${moneyInput("orteg", labels.orteg)}
      </div>
      <p class="tenebre-money-rate">
        <i class="fas fa-exchange-alt" aria-hidden="true"></i>
        <span>${escapeHtml(labels.rate)}</span>
      </p>
    </div>
  `;
}

export function formatMoney(money, labels = defaultLabels()) {
  const normalized = normalizeMoney(money);
  return `${normalized.thaler} ${labels.thaler}, ${normalized.shilling} ${labels.shilling}, ${normalized.orteg} ${labels.orteg}`;
}

function moneyInput(name, label) {
  return `
    <label class="tenebre-money-field">
      <span><i class="fas fa-coins" aria-hidden="true"></i>${escapeHtml(label)}</span>
      <input type="number" name="${name}" value="0" min="0" step="1" inputmode="numeric" aria-label="${escapeHtml(label)}">
    </label>
  `;
}

function moneyBalanceItem(value, label) {
  return `
    <span class="tenebre-money-balance-item">
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(label)}</small>
    </span>
  `;
}

function parseMoneyFormElement(element) {
  return normalizeMoney({
    thaler: element?.querySelector?.("input[name='thaler']")?.value,
    shilling: element?.querySelector?.("input[name='shilling']")?.value,
    orteg: element?.querySelector?.("input[name='orteg']")?.value
  });
}

async function promptMoneyOperation(actor) {
  const labels = defaultLabels();
  const content = `
    <div class="symbaroum dialog tenebre-symbaroum-dialog tenebre-money-dialog">
      ${buildMoneyDialogContent(actor, labels)}
    </div>
  `;
  const resultFor = (dialog, mode) => ({
    delta: parseMoneyFormElement(dialog?.element?.querySelector?.(".tenebre-money-dialog-content")),
    mode
  });

  return foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("TENEBRE.Money.DialogTitle") },
    position: { width: 420 },
    content,
    buttons: [
      {
        action: "add",
        icon: "fas fa-plus",
        label: labels.add,
        callback: (_event, _button, dialog) => resultFor(dialog, "add")
      },
      {
        action: "spend",
        icon: "fas fa-minus",
        label: labels.spend,
        callback: (_event, _button, dialog) => resultFor(dialog, "spend")
      },
      {
        action: "cancel",
        icon: "fas fa-times",
        label: game.i18n.localize("TENEBRE.Common.Cancel"),
        callback: () => null
      }
    ],
    rejectClose: false
  });
}

function toActorMoneyUpdate(money) {
  const normalized = normalizeMoney(money);
  return {
    [MONEY_PATHS.thaler]: normalized.thaler,
    [MONEY_PATHS.shilling]: normalized.shilling,
    [MONEY_PATHS.orteg]: normalized.orteg
  };
}

function toNonNegativeInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(MAX_MONEY_ORTEGS, Math.floor(number));
}

function defaultLabels() {
  return {
    current: game.i18n.localize("TENEBRE.Money.Current"),
    add: game.i18n.localize("TENEBRE.Money.Add"),
    spend: game.i18n.localize("TENEBRE.Money.Spend"),
    thaler: game.i18n.localize("TENEBRE.Money.Thaler"),
    shilling: game.i18n.localize("TENEBRE.Money.Shilling"),
    orteg: game.i18n.localize("TENEBRE.Money.Orteg"),
    rate: game.i18n.localize("TENEBRE.Money.Rate")
  };
}
