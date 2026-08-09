import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProneAdvantageContext,
  isMeleeWeapon,
  isProneActor,
  ProneAdvantageService
} from "../scripts/prone-advantage.mjs";

function proneActor(overrides = {}) {
  return {
    id: "target-actor",
    name: "Alvo",
    statuses: new Set(["prone"]),
    effects: [],
    ...overrides
  };
}

test("prone detection supports current statuses and the legacy core status flag", () => {
  assert.equal(isProneActor(proneActor()), true);
  assert.equal(isProneActor({
    effects: [{ flags: { core: { statusId: "prone" } } }]
  }), true);
  assert.equal(isProneActor({ statuses: new Set(), effects: [] }), false);
});

test("only melee weapons receive Advantage against a prone target", () => {
  assert.equal(isMeleeWeapon({ isMelee: true, reference: "1handed" }), true);
  assert.equal(isMeleeWeapon({ isDistance: true, reference: "ranged" }), false);

  const target = { id: "target-token", name: "Inimigo", actor: proneActor() };
  assert.ok(buildProneAdvantageContext(
    { id: "attacker" },
    { isMelee: true, reference: "1handed" },
    new Set([target]),
    100
  ));
  assert.equal(buildProneAdvantageContext(
    { id: "attacker" },
    { isDistance: true, reference: "ranged" },
    new Set([target]),
    100
  ), null);
});

test("the automation requires exactly one selected prone target", () => {
  const weapon = { isMelee: true };
  const standing = { id: "standing", actor: { statuses: new Set(), effects: [] } };
  const prone = { id: "prone", actor: proneActor() };

  assert.equal(buildProneAdvantageContext({}, weapon, [], 100), null);
  assert.equal(buildProneAdvantageContext({}, weapon, [standing], 100), null);
  assert.equal(buildProneAdvantageContext({}, weapon, [prone, standing], 100), null);
});

test("a weapon dialog is marked and receives a safe prone notice", () => {
  const actor = proneActor();
  const inserted = [];
  const row = {
    parentElement: {
      insertBefore(node, before) {
        inserted.push({ node, before });
      }
    }
  };
  const advantage = {
    checked: false,
    closest() {
      return row;
    }
  };
  const root = {
    ownerDocument: {
      createElement() {
        return { className: "", textContent: "" };
      }
    },
    querySelector(selector) {
      if (selector === ".tenebre-prone-advantage-notice") return null;
      if (selector === "input[id^='weapondamage-']") return {};
      if (selector === "input[id^='advantage-']") return advantage;
      return null;
    }
  };

  globalThis.game = {
    tenebreResources: {
      proneAdvantageContext: {
        targetActor: actor,
        targetName: "Inimigo <Caído>",
        expiresAt: Date.now() + 1000
      }
    },
    i18n: {
      format(_key, { target }) {
        return `${target} está caído. Você recebe Vantagem.`;
      }
    }
  };

  assert.equal(ProneAdvantageService.applyToDialog(root), true);
  assert.equal(advantage.checked, true);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].node.textContent, "Inimigo <Caído> está caído. Você recebe Vantagem.");
  assert.equal(game.tenebreResources.proneAdvantageContext, null);
});

test("an unrelated dialog does not consume the pending weapon context", () => {
  const context = {
    targetActor: proneActor(),
    targetName: "Alvo",
    expiresAt: Date.now() + 1000
  };
  globalThis.game = {
    tenebreResources: { proneAdvantageContext: context }
  };

  assert.equal(ProneAdvantageService.applyToDialog({ querySelector: () => null }), false);
  assert.equal(game.tenebreResources.proneAdvantageContext, context);
});
