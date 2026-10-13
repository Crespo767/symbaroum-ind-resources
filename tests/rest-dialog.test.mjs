import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const restSource = fs.readFileSync(path.join(root, "scripts/rest.mjs"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "styles/symbaroum-ind-resources.css"), "utf8");

test("Rest dialog does not contain private roll checkbox or RollPrivacyService", () => {
  assert.doesNotMatch(restSource, /RollPrivacyService/);
  assert.doesNotMatch(restSource, /tenebrePrivateRoll/);
  assert.doesNotMatch(restSource, /tenebre-rest-private/);
});

test("Stylesheet does not retain unused rest private roll classes", () => {
  assert.doesNotMatch(cssSource, /\.tenebre-rest-private-control/);
  assert.doesNotMatch(cssSource, /\.tenebre-rest-private-check/);
});

test("Rest dialog includes Spend Travel Bread option with checkbox styling", () => {
  assert.match(restSource, /tenebre-spend-bread/);
  assert.match(restSource, /TENEBRE\.Rest\.SpendTravelBread/);
  assert.match(restSource, /RationService\.consumeDay/);
  assert.match(cssSource, /\.tenebre-rest-checkbox-control/);
  assert.match(cssSource, /\.tenebre-rest-checkbox-check/);
  assert.match(cssSource, /\.tenebre-rest-bread-row/);
});

test("RestService.applyRest consumes travel bread when spendBread is true", async () => {
  globalThis.Hooks = globalThis.Hooks ?? { once() {}, on() {}, callAll() {} };
  globalThis.foundry = globalThis.foundry ?? { utils: { deepClone: (x) => JSON.parse(JSON.stringify(x)) } };
  globalThis.ChatMessage = globalThis.ChatMessage ?? { getSpeaker: () => ({}), create: async () => ({}) };

  const { RestService } = await import("../scripts/rest.mjs");
  const { RationService } = await import("../scripts/rations.mjs");

  let consumedArgs = null;
  const originalConsumeDay = RationService.consumeDay;
  RationService.consumeDay = async (actor, item, options) => {
    consumedArgs = { actor, item, options };
    return true;
  };

  const actor = {
    name: "KacTtest",
    uuid: "Actor.test1",
    isOwner: true,
    update: async () => {},
    effects: [],
    system: {
      health: {
        toughness: { value: 10, max: 10 },
        corruption: { temporary: 0 }
      },
      attributes: { strong: { total: 10, temporaryMod: 0 } }
    },
    getFlag: () => undefined
  };

  globalThis.game = {
    i18n: {
      localize: (k) => k,
      format: (k, data) => JSON.stringify(data)
    },
    settings: {
      settings: new Map(),
      get: (_scope, key) => {
        if (key === "enableRations") return true;
        if (key === "enableRestHealing") return true;
        if (key === "restHealing") return 1;
        return false;
      }
    }
  };

  try {
    // spendBread: true -> calls consumeDay with days
    await RestService.applyRest(actor, 2, 1, { spendBread: true });
    assert.ok(consumedArgs, "consumeDay should be called");
    assert.equal(consumedArgs.actor, actor);
    assert.deepEqual(consumedArgs.options, { days: 2 });

    // spendBread: false -> does not call consumeDay
    consumedArgs = null;
    await RestService.applyRest(actor, 1, 1, { spendBread: false });
    assert.equal(consumedArgs, null, "consumeDay should not be called when spendBread is false");
  } finally {
    RationService.consumeDay = originalConsumeDay;
  }
});
