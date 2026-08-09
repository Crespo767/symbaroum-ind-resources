import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  MAX_MONEY_ORTEGS,
  applyMoneyOperation,
  buildMoneyDialogContent,
  formatMoney,
  moneyToOrtegs,
  normalizeMoney,
  parseMoneyFormData
} from "../scripts/money.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "scripts/money.mjs"), "utf8");

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

test("form parsing and dialog content expose only the three Symbaroum coin inputs", () => {
  const formData = new FormData();
  formData.set("thaler", "1");
  formData.set("shilling", "12");
  formData.set("orteg", "31");

  assert.deepEqual(parseMoneyFormData(formData), { thaler: 2, shilling: 5, orteg: 1 });
  assert.equal(formatMoney({ thaler: 2, shilling: 5, orteg: 1 }), "2 Taler, 5 Xelim, 1 Ortega");

  const html = buildMoneyDialogContent({ system: { money: { thaler: 2, shilling: 5, orteg: 1 } } });
  assert.doesNotMatch(html, /name="mode"/);
  assert.doesNotMatch(html, /tenebre-money-operation|tenebre-money-mode-option/);
  assert.match(html, /name="thaler"/);
  assert.match(html, /name="shilling"/);
  assert.match(html, /name="orteg"/);
  assert.match(html, /tenebre-money-balance-values/);
});

test("dialog footer selects add or spend directly and keeps cancel", () => {
  assert.match(source, /DialogV2\.wait\(\{/);
  assert.match(source, /action: "add"[\s\S]*?resultFor\(dialog, "add"\)/);
  assert.match(source, /action: "spend"[\s\S]*?resultFor\(dialog, "spend"\)/);
  assert.match(source, /action: "cancel"[\s\S]*?callback: \(\) => null/);
});
