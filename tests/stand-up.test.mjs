import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: class {},
      HandlebarsApplicationMixin: (Base) => class extends Base {}
    }
  }
};
globalThis.Hooks = {
  once() {},
  on() {}
};

const {
  buildStandUpChat,
  buildStandUpActionState,
  getStandUpRemainingMovementActions,
  resolveStandUpPortrait,
  resolveStandUpTest,
  StandUpService,
  STAND_UP_ACTION_FLAG
} = await import("../scripts/stand-up.mjs");

test("a successful Quick Test spends one action and a failure spends the whole turn", () => {
  assert.deepEqual(resolveStandUpTest(12, 12), {
    success: true,
    quickValue: 12,
    rollResult: 12,
    remainingMovementActions: 1
  });
  assert.deepEqual(resolveStandUpTest(12, 13), {
    success: false,
    quickValue: 12,
    rollResult: 13,
    remainingMovementActions: 0
  });
});

test("standing up never restores actions already spent in the current turn", () => {
  assert.equal(resolveStandUpTest(15, 5, 0).remainingMovementActions, 0);
  assert.equal(resolveStandUpTest(15, 5, 1).remainingMovementActions, 1);
});

test("stand-up action state applies only to the combat turn where it was recorded", () => {
  const combat = { id: "combat-1", started: true, round: 3, turn: 2 };
  const state = buildStandUpActionState(1, combat);
  const actor = {
    flags: {
      "symbaroum-ind-resources": {
        [STAND_UP_ACTION_FLAG]: state
      }
    }
  };

  assert.equal(getStandUpRemainingMovementActions(actor, combat), 1);
  assert.equal(getStandUpRemainingMovementActions(actor, { ...combat, turn: 3 }), null);
  assert.equal(getStandUpRemainingMovementActions(actor, { ...combat, round: 4 }), null);
  assert.equal(buildStandUpActionState(1, { started: false }), null);
});

test("the floating Token HUD control appears only for an owned prone player", () => {
  const appended = [];
  const column = {
    querySelector() {
      return null;
    },
    append(node) {
      appended.push(node);
    }
  };
  const root = {
    querySelector(selector) {
      return selector === ".col.right, div.right" ? column : null;
    }
  };
  const actor = {
    id: "actor-1",
    type: "player",
    isOwner: true,
    statuses: new Set(["prone"]),
    effects: []
  };
  globalThis.game = {
    user: { isGM: false },
    i18n: { localize: () => "Levantar-se" }
  };
  globalThis.document = {
    createElement() {
      return {
        dataset: {},
        setAttribute() {},
        addEventListener() {}
      };
    }
  };

  assert.equal(StandUpService.addHudButton({}, root, { document: { actor } }), true);
  assert.equal(appended.length, 1);
  assert.equal(appended[0].dataset.tenebreStandUp, "true");

  actor.statuses.clear();
  assert.equal(StandUpService.addHudButton({}, root, { document: { actor } }), false);
});

test("the stand-up card uses the clicked token portrait and escapes its caption", () => {
  globalThis.game = {
    i18n: {
      localize(key) {
        return key;
      }
    }
  };
  const actor = { name: "Teste <Man>", img: "actor.webp" };
  const syntheticToken = { actorLink: false, texture: { src: "token.webp" } };
  const linkedToken = { actorLink: true, texture: { src: "ignored.webp" } };
  const result = {
    success: true,
    rollResult: 1,
    quickValue: 10
  };

  assert.equal(resolveStandUpPortrait(actor, syntheticToken), "token.webp");
  assert.equal(resolveStandUpPortrait(actor, linkedToken), "actor.webp");

  const card = buildStandUpChat(actor, result, "token.webp");
  assert.match(card, /class="tenebre-stand-up-actor"/);
  assert.match(card, /src="token\.webp"/);
  assert.match(card, /<figcaption>Teste &lt;Man&gt;<\/figcaption>/);
  assert.doesNotMatch(card, /<figcaption>Teste <Man><\/figcaption>/);
});

test("stand-up integration removes prone, records the action cost and is module-scoped", async () => {
  const source = await readFile(new URL("../scripts/stand-up.mjs", import.meta.url), "utf8");
  const movement = await readFile(new URL("../scripts/movement-ruler.mjs", import.meta.url), "utf8");
  const weapon = await readFile(new URL("../scripts/weapon-wrapper.mjs", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles/symbaroum-ind-resources.css", import.meta.url), "utf8");

  assert.match(source, /Hooks\.on\("renderTokenHUD"/);
  assert.match(source, /await removeProne\(actor\)/);
  assert.match(source, /SocketService\.setFlag\(actor, MODULE_ID, STAND_UP_ACTION_FLAG/);
  assert.match(movement, /getStandUpRemainingMovementActions\(actor\)/);
  assert.match(weapon, /TENEBRE\.StandUp\.NoActionsRemaining/);
  assert.match(css, /#token-hud \.tenebre-stand-up-control/);
  assert.match(css, /\.tenebre-stand-up-actor img\s*\{[\s\S]*?width:\s*64px;[\s\S]*?height:\s*64px;/);
  assert.doesNotMatch(css, /(^|\n)\.control-icon\s*\{/);
});
