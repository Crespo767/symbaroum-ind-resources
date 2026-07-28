import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_MONEY_ORTEGS,
  applyMoneyOperation,
  buildMoneyDialogContent,
  formatMoney,
  moneyToOrtegs,
  normalizeMoney,
  parseMoneyFormData
} from "../scripts/money.mjs";

globalThis.game = {
  i18n: {
    localize: (key) => ({
      "TENEBRE.Money.Current": "Dinheiro atual",
      "TENEBRE.Money.Operation": "Operacao",
      "TENEBRE.Money.Add": "Adicionar",
      "TENEBRE.Money.Spend": "Gastar",
      "TENEBRE.Money.Thaler": "Taler",
      "TENEBRE.Money.Shilling": "Xelim",
      "TENEBRE.Money.Orteg": "Ortega",
      "TENEBRE.Money.Rate": "1 Taler = 10 Xelins = 100 Ortegas",
    })[key] ?? key
  }
};

test("money values convert through Ortegs and normalize to canonical coins", () => {
  assert.equal(moneyToOrtegs({ thaler: 3, shilling: 9, orteg: 14 }), 404);
  assert.deepEqual(normalizeMoney({ thaler: 3, shilling: 9, orteg: 14 }), {
    thaler: 4,
    shilling: 0,
    orteg: 4
  });
});

test("spending money borrows across coin tiers through the total value", () => {
  const result = applyMoneyOperation({
    current: { thaler: 3, shilling: 0, orteg: 0 },
    delta: { thaler: 0, shilling: 1, orteg: 5 },
    mode: "spend"
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.money, { thaler: 2, shilling: 8, orteg: 5 });
});

test("spending more than the actor owns is rejected without changing the total", () => {
  const result = applyMoneyOperation({
    current: { thaler: 0, shilling: 1, orteg: 0 },
    delta: { thaler: 0, shilling: 1, orteg: 1 },
    mode: "spend"
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.money, { thaler: 0, shilling: 1, orteg: 0 });
});

test("adding money normalizes the final actor fields", () => {
  const result = applyMoneyOperation({
    current: { thaler: 0, shilling: 9, orteg: 9 },
    delta: { thaler: 0, shilling: 0, orteg: 1 },
    mode: "add"
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.money, { thaler: 1, shilling: 0, orteg: 0 });
});

test("money operations reject values above the safe integer limit", () => {
  const result = applyMoneyOperation({
    current: { orteg: MAX_MONEY_ORTEGS },
    delta: { orteg: 1 },
    mode: "add"
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "overflow");
  assert.equal(result.total, MAX_MONEY_ORTEGS);
});

test("form parsing and dialog content expose the three Symbaroum coins", () => {
  const formData = new FormData();
  formData.set("thaler", "1");
  formData.set("shilling", "12");
  formData.set("orteg", "31");

  assert.deepEqual(parseMoneyFormData(formData), { thaler: 2, shilling: 5, orteg: 1 });
  assert.equal(formatMoney({ thaler: 2, shilling: 5, orteg: 1 }), "2 Taler, 5 Xelim, 1 Ortega");

  const html = buildMoneyDialogContent({ system: { money: { thaler: 2, shilling: 5, orteg: 1 } } });
  assert.match(html, /name="mode" value="add"/);
  assert.match(html, /name="mode" value="spend"/);
  assert.match(html, /name="thaler"/);
  assert.match(html, /name="shilling"/);
  assert.match(html, /name="orteg"/);
  assert.match(html, /tenebre-money-balance-values/);
  assert.match(html, /tenebre-money-operation/);
  assert.match(html, /tenebre-money-mode-option/);
});
