import assert from "node:assert/strict";
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

const { MovementService } = await import("../scripts/movement-ruler.mjs");

function actor({ prone = false } = {}) {
  return {
    id: "actor-1",
    name: "TesteMan",
    statuses: new Set(prone ? ["prone"] : []),
    effects: []
  };
}

function voluntaryMovement() {
  return {
    passed: {
      waypoints: [{ action: "move", actionConfig: {} }],
      cost: 1
    },
    history: { cost: 0 }
  };
}

function prepareGame() {
  const warnings = [];
  globalThis.game = {
    modules: new Map(),
    combat: null,
    i18n: {
      format(key, data) {
        return `${key}:${data.actor}`;
      },
      localize(key) {
        return key;
      }
    },
    settings: {
      get() {
        return false;
      }
    }
  };
  globalThis.ui = {
    notifications: {
      warn(message) {
        warnings.push(message);
      }
    }
  };
  return warnings;
}

test("a prone actor cannot move even outside combat or with ruler blocking disabled", () => {
  const warnings = prepareGame();
  const token = { id: "token-1", actor: actor({ prone: true }) };

  assert.equal(MovementService.validateMovement(token, voluntaryMovement()), false);
  assert.deepEqual(warnings, ["TENEBRE.Movement.ProneBlocked:TesteMan"]);
});

test("standing actors remain untouched when regular movement blocking is disabled", () => {
  const warnings = prepareGame();
  const token = { id: "token-1", actor: actor() };

  assert.equal(MovementService.validateMovement(token, voluntaryMovement()), true);
  assert.deepEqual(warnings, []);
});

test("undo, paste, teleport and forced displacement can reposition a prone token", () => {
  const warnings = prepareGame();
  const token = { id: "token-1", actor: actor({ prone: true }) };
  const displacement = {
    passed: {
      waypoints: [{ action: "displace", actionConfig: {} }]
    }
  };
  const teleport = {
    passed: {
      waypoints: [{ action: "move", actionConfig: { teleport: true } }]
    }
  };

  assert.equal(MovementService.validateMovement(token, voluntaryMovement(), { isUndo: true }), true);
  assert.equal(MovementService.validateMovement(token, voluntaryMovement(), { isPaste: true }), true);
  assert.equal(MovementService.validateMovement(token, displacement), true);
  assert.equal(MovementService.validateMovement(token, teleport), true);
  assert.deepEqual(warnings, []);
});

test("the movement profile marks prone as fully blocked", () => {
  prepareGame();
  const profile = MovementService.getProfile(actor({ prone: true }));

  assert.equal(profile.blocked, true);
  assert.equal(profile.movementActions, 0);
  assert.equal(profile.actionDistance, 0);
  assert.equal(profile.doubleDistance, 0);
  assert.deepEqual(profile.reasons, ["TENEBRE.Movement.ProneReason"]);
});
