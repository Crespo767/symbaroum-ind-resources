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
  createStandUpButtonBackground,
  createStandUpButtonIcon,
  getStandUpRemainingMovementActions,
  getStandUpButtonPosition,
  resolveStandUpPortrait,
  resolveStandUpTest,
  shouldShowStandUpButton,
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

test("the floating canvas control appears only for an owned prone player or the GM", () => {
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

  assert.equal(shouldShowStandUpButton(actor), true);
  assert.deepEqual(
    getStandUpButtonPosition({ document: { x: 300, y: 200 }, w: 100, h: 80 }),
    { x: 426, y: 240 }
  );

  actor.isOwner = false;
  assert.equal(shouldShowStandUpButton(actor), false);
  assert.equal(shouldShowStandUpButton(actor, { isGM: true }), true);

  actor.statuses.clear();
  assert.equal(shouldShowStandUpButton(actor, { isGM: true }), false);
});

test("the ornate floating control uses vector artwork in PIXI 7 and PIXI 8", () => {
  class ContainerMock {
    constructor() { this.children = []; }
    addChild(...children) { this.children.push(...children); }
  }
  class GraphicsV7 {
    constructor() { this.calls = []; }
    lineStyle(...args) { this.calls.push(["lineStyle", ...args]); }
    beginFill(...args) { this.calls.push(["beginFill", ...args]); }
    drawCircle(...args) { this.calls.push(["drawCircle", ...args]); }
    drawPolygon(...args) { this.calls.push(["drawPolygon", ...args]); }
    endFill() {}
  }
  class GraphicsV8 {
    constructor() { this.calls = []; }
    circle(...args) { this.calls.push(["circle", ...args]); return this; }
    poly(...args) { this.calls.push(["poly", ...args]); return this; }
    fill(...args) { this.calls.push(["fill", ...args]); return this; }
    stroke(...args) { this.calls.push(["stroke", ...args]); return this; }
  }

  const iconV7 = createStandUpButtonIcon({ Graphics: GraphicsV7 });
  assert.equal(iconV7.calls.some(([name]) => name === "drawPolygon"), true);
  const iconV8 = createStandUpButtonIcon({ Graphics: GraphicsV8 });
  assert.equal(iconV8.calls.some(([name]) => name === "poly"), true);

  const background = createStandUpButtonBackground({ Container: ContainerMock, Graphics: GraphicsV7 });
  assert.equal(background.children.length, 4);
  assert.equal(background.children.some((child) => child.calls.some(([name]) => name === "drawCircle")), true);
});

test("the stand-up control is attached to the token layer and receives pointer clicks", async () => {
  class ContainerMock {
    constructor() {
      this.children = [];
      this.handlers = new Map();
      this.position = { set: (x, y) => { this.x = x; this.y = y; } };
      this.scale = { set: () => {} };
    }
    addChild(...children) {
      this.children.push(...children);
      for (const child of children) child.parent = this;
    }
    on(event, handler) {
      this.handlers.set(event, handler);
      return this;
    }
    destroy() {
      this.destroyed = true;
    }
  }
  class GraphicsMock {
    lineStyle() {}
    beginFill() {}
    drawCircle() {}
    drawPolygon() {}
    endFill() {}
  }
  globalThis.PIXI = {
    VERSION: "7.4.2",
    Container: ContainerMock,
    Graphics: GraphicsMock,
    Circle: class {}
  };
  const layer = new ContainerMock();
  layer.removeChild = (child) => {
    layer.children = layer.children.filter((candidate) => candidate !== child);
  };
  const actor = {
    id: "actor-click",
    type: "player",
    isOwner: true,
    statuses: new Set(["prone"]),
    effects: []
  };
  const token = {
    actor,
    document: { actor, x: 100, y: 50 },
    layer,
    w: 100,
    h: 100
  };
  let attempted = false;
  const originalAttempt = StandUpService.attempt;
  StandUpService.attempt = async () => { attempted = true; };
  try {
    assert.equal(StandUpService.syncTokenButton(token), true);
    assert.equal(layer.children.length, 1);
    assert.equal(typeof layer.children[0].handlers.get("pointertap"), "function");
    layer.children[0].handlers.get("pointertap")({ stopPropagation() {} });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(attempted, true);
  } finally {
    StandUpService.attempt = originalAttempt;
    StandUpService.removeTokenButton(token);
  }
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

  assert.match(source, /Hooks\.on\("drawToken"/);
  assert.match(source, /Hooks\.on\("createActiveEffect"/);
  assert.match(source, /new PIXI\.Container\(\)/);
  assert.match(source, /layer\.addChild\(button\)/);
  assert.match(source, /button\.on\?\.\("pointerdown"/);
  assert.match(source, /button\.on\?\.\("pointertap"/);
  assert.doesNotMatch(source, /token\.addChild\(button\)/);
  assert.doesNotMatch(source, /Hooks\.on\("renderTokenHUD"/);
  assert.match(source, /await removeProne\(actor\)/);
  assert.match(source, /SocketService\.setFlag\(actor, MODULE_ID, STAND_UP_ACTION_FLAG/);
  assert.match(movement, /getStandUpRemainingMovementActions\(actor\)/);
  assert.match(weapon, /TENEBRE\.StandUp\.NoActionsRemaining/);
  assert.doesNotMatch(css, /#token-hud \.tenebre-stand-up-control/);
  assert.match(css, /\.tenebre-stand-up-actor img\s*\{[\s\S]*?width:\s*64px;[\s\S]*?height:\s*64px;/);
  assert.doesNotMatch(css, /(^|\n)\.control-icon\s*\{/);
});
