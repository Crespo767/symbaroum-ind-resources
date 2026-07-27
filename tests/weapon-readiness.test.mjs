import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildWeaponReadinessDialogContent,
  buildWeaponReadinessChatContent,
  buildWeaponReadinessPatches,
  canAttackWithWeapon,
  getWeaponHandCost,
  getWeaponHandUsage,
  isWeaponReadinessChatEnabled,
  isDrawn,
  isEligibleWeapon,
  resolveWeaponItem,
  shouldBlockDrawnWeaponDeletion,
  WEAPON_READINESS_ICON,
  WEAPON_READINESS_FLAG,
  WEAPON_READINESS_LONG_MODE_FLAG,
  WEAPON_READINESS_ORIGINAL_LONG_QUALITY_FLAG,
  WEAPON_SHEATHED_STATE
} from "../scripts/weapon-readiness.mjs";
import {
  getWeaponReadinessStatusId,
  isWeaponReadinessIndicatorEffect,
  WEAPON_READINESS_INDICATOR_FLAG,
  WEAPON_READINESS_INDICATOR_WEAPON_FLAG,
  WeaponReadinessVisualService
} from "../scripts/weapon-readiness-visuals.mjs";
import { buildVisualActiveEffectData } from "../scripts/compatibility.mjs";

const scope = "symbaroum-ind-resources";
globalThis.game = { symbaroum: {} };

test("HUD and token readiness indicators use the Symbaroum weapon icon", () => {
  assert.equal(WEAPON_READINESS_ICON, "/systems/symbaroum/asset/image/weapon.png");
});

test("actor sheets do not add a redundant drawn-weapon icon to weapon rows", () => {
  const sheetUiSource = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts/sheet-ui.mjs"), "utf8");
  assert.doesNotMatch(sheetUiSource, /rollButton\.prepend\(icon\)/);
  assert.doesNotMatch(sheetUiSource, /icon\.src\s*=\s*WEAPON_READINESS_ICON/);
});

test("weapon readiness chat messages are controlled by an independent setting", () => {
  const enabled = { get: (_moduleId, key) => key === "showWeaponReadinessChatMessages" };
  const disabled = { get: () => false };
  assert.equal(isWeaponReadinessChatEnabled(enabled), true);
  assert.equal(isWeaponReadinessChatEnabled(disabled), false);
  assert.equal(isWeaponReadinessChatEnabled({ get: () => { throw new Error("unavailable"); } }), false);
});

test("weapon readiness messages use the native layout and escape content", () => {
  const html = buildWeaponReadinessChatContent({
    title: "Armas",
    text: "Crespo sacou <Arco>.",
    image: "weapon.png"
  });

  assert.match(html, /tenebre-weapon-readiness-chat/);
  assert.match(html, /weapon\.png/);
  assert.match(html, /Crespo sacou &lt;Arco&gt;\./);
});

test("weapon readiness dialog exposes immediate weapon actions without confirmation inputs", () => {
  const sword = {
    id: "sword",
    name: "Espada <Longa>",
    img: "sword.webp",
    system: { state: "active" }
  };
  const dagger = {
    id: "dagger",
    name: "Adaga",
    img: "dagger.webp",
    system: { state: WEAPON_SHEATHED_STATE }
  };
  const html = buildWeaponReadinessDialogContent([sword, dagger], {
    draw: "Sacar arma",
    sheathe: "Guardar arma",
    sheatheAll: "Guardar todas as armas"
  });

  assert.match(html, /button[\s\S]*data-weapon-id="sword"/);
  assert.match(html, /data-weapon-id="dagger"/);
  assert.match(html, /data-drawn="true"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /Guardar arma: Espada &lt;Longa&gt;/);
  assert.match(html, /data-action="sheathe-all"/);
  assert.doesNotMatch(html, /type="checkbox"/);
  assert.doesNotMatch(html, /drawnWeaponIds/);
});

function weapon(id, {
  state = "active",
  reference = "1handed",
  readiness,
  qualities = {},
  storedIn = "",
  longMode = false,
  originalLongQuality
} = {}) {
  const readinessFlags = {
    ...(readiness ? { [WEAPON_READINESS_FLAG]: readiness } : {}),
    ...(longMode ? { [WEAPON_READINESS_LONG_MODE_FLAG]: true } : {}),
    ...(originalLongQuality !== undefined
      ? { [WEAPON_READINESS_ORIGINAL_LONG_QUALITY_FLAG]: originalLongQuality }
      : {})
  };
  return {
    id,
    type: "weapon",
    system: { state, reference, qualities },
    flags: Object.keys(readinessFlags).length > 0 || storedIn
      ? { [scope]: {
        ...readinessFlags,
        ...(storedIn ? { storedIn } : {})
      } }
      : {},
    getFlag(flagScope, key) {
      return this.flags?.[flagScope]?.[key];
    }
  };
}

test("all accessible non-natural weapons participate in readiness", () => {
  assert.equal(isEligibleWeapon(weapon("active")), true);
  assert.equal(isEligibleWeapon(weapon("stored", { state: WEAPON_SHEATHED_STATE })), true);
  assert.equal(isEligibleWeapon(weapon("in-backpack", {
    state: WEAPON_SHEATHED_STATE,
    storedIn: "backpack"
  })), false);
  assert.equal(isEligibleWeapon(weapon("natural", { reference: "unarmed" })), false);
  assert.equal(isEligibleWeapon({ id: "armor", type: "armor", system: { state: "active" } }), false);
});

test("drawn state follows the native Symbaroum weapon state", () => {
  const drawn = weapon("sword", { state: "active", readiness: "drawn" });
  const sheathed = weapon("stored", { state: WEAPON_SHEATHED_STATE, readiness: "drawn" });
  assert.equal(isEligibleWeapon(drawn), true);
  assert.equal(isDrawn(drawn), true);
  assert.equal(drawn.system.state, "active");
  assert.equal(isDrawn(sheathed), false);
});

test("drawn weapons cannot be deleted until they are sheathed", () => {
  const enabled = { get: () => true };
  const disabled = { get: () => false };
  const drawn = weapon("drawn", { state: "active", readiness: "drawn" });
  const sheathed = weapon("sheathed", { state: WEAPON_SHEATHED_STATE, readiness: "sheathed" });
  drawn.parent = { type: "player" };
  sheathed.parent = { type: "player" };

  assert.equal(shouldBlockDrawnWeaponDeletion(drawn, enabled), true);
  assert.equal(shouldBlockDrawnWeaponDeletion(sheathed, enabled), false);
  assert.equal(shouldBlockDrawnWeaponDeletion(drawn, disabled), false);
  assert.equal(shouldBlockDrawnWeaponDeletion(weapon("natural", { reference: "unarmed" }), enabled), false);
  assert.equal(shouldBlockDrawnWeaponDeletion(weapon("world-item"), enabled), false);
});

test("readiness patches move weapons between native active and equipment states", () => {
  const bow = weapon("bow", { state: WEAPON_SHEATHED_STATE });
  assert.deepEqual(buildWeaponReadinessPatches([bow], ["bow"]), [{
    _id: "bow",
    "system.state": "active",
    [`flags.${scope}.${WEAPON_READINESS_FLAG}`]: "drawn"
  }]);

  bow.system.state = "active";
  bow.flags[scope] = { [WEAPON_READINESS_FLAG]: "drawn" };
  assert.deepEqual(buildWeaponReadinessPatches([bow], []), [{
    _id: "bow",
    "system.state": WEAPON_SHEATHED_STATE,
    [`flags.${scope}.${WEAPON_READINESS_FLAG}`]: "sheathed"
  }]);
});

test("swapping weapons produces one atomic embedded-document patch set", () => {
  const bow = weapon("bow", { readiness: "drawn" });
  const dagger = weapon("dagger", { state: WEAPON_SHEATHED_STATE });
  assert.deepEqual(buildWeaponReadinessPatches([bow, dagger], ["dagger"]), [
    {
      _id: "bow",
      "system.state": WEAPON_SHEATHED_STATE,
      [`flags.${scope}.${WEAPON_READINESS_FLAG}`]: "sheathed"
    },
    {
      _id: "dagger",
      "system.state": "active",
      [`flags.${scope}.${WEAPON_READINESS_FLAG}`]: "drawn"
    }
  ]);
});

test("multiple drawn weapons and sheathe-all are supported", () => {
  const sword = weapon("sword");
  const dagger = weapon("dagger");
  assert.equal(buildWeaponReadinessPatches([sword, dagger], ["sword", "dagger"]).length, 2);

  sword.flags[scope] = { [WEAPON_READINESS_FLAG]: "drawn" };
  dagger.flags[scope] = { [WEAPON_READINESS_FLAG]: "drawn" };
  assert.equal(buildWeaponReadinessPatches([sword, dagger], []).every((patch) => (
    patch["system.state"] === WEAPON_SHEATHED_STATE
    &&
    patch[`flags.${scope}.${WEAPON_READINESS_FLAG}`] === "sheathed"
  )), true);
});

test("weapon hand costs follow the physical Symbaroum limits represented by the system", () => {
  assert.equal(getWeaponHandCost(weapon("sword")), 1);
  assert.equal(getWeaponHandCost(weapon("spear", { reference: "long" })), 2);
  assert.equal(getWeaponHandCost(weapon("spear", { reference: "long" }), { oneHanded: true }), 1);
  assert.equal(getWeaponHandCost(weapon("greatsword", { reference: "heavy" })), 2);
  assert.equal(getWeaponHandCost(weapon("bastard", { reference: "heavy", qualities: { bastard: true } })), 2);
  assert.equal(getWeaponHandCost(weapon("bow", { reference: "ranged" })), 2);
  assert.equal(getWeaponHandCost(weapon("shield", { reference: "shield" })), 1);
  assert.equal(getWeaponHandCost(weapon("buckler", { reference: "shield", qualities: { flexible: true } })), 0);
  assert.equal(getWeaponHandUsage([
    weapon("sword"),
    weapon("dagger", { reference: "short" })
  ], ["sword", "dagger"]), 2);
});

test("a long weapon can be used one-handed with a shield and temporarily loses Long", () => {
  const pike = weapon("pike", {
    state: WEAPON_SHEATHED_STATE,
    reference: "long",
    qualities: { long: true, precise: true }
  });
  const shield = weapon("shield", {
    state: WEAPON_SHEATHED_STATE,
    reference: "shield"
  });

  assert.equal(getWeaponHandUsage([pike, shield], ["pike", "shield"]), 2);
  assert.equal(getWeaponHandUsage([
    pike,
    weapon("sword", { reference: "1handed" })
  ], ["pike", "sword"]), 3);

  const drawPatches = buildWeaponReadinessPatches([pike, shield], ["pike", "shield"]);
  const pikeDraw = drawPatches.find((patch) => patch._id === "pike");
  assert.equal(pikeDraw["system.state"], "active");
  assert.equal(pikeDraw["system.qualities.long"], false);
  assert.equal(pikeDraw[`flags.${scope}.${WEAPON_READINESS_LONG_MODE_FLAG}`], true);
  assert.equal(pikeDraw[`flags.${scope}.${WEAPON_READINESS_ORIGINAL_LONG_QUALITY_FLAG}`], true);

  pike.system.state = "active";
  pike.system.qualities.long = false;
  pike.flags[scope] = {
    [WEAPON_READINESS_FLAG]: "drawn",
    [WEAPON_READINESS_LONG_MODE_FLAG]: true,
    [WEAPON_READINESS_ORIGINAL_LONG_QUALITY_FLAG]: true
  };
  const restorePatches = buildWeaponReadinessPatches([pike, shield], ["shield"]);
  const pikeRestore = restorePatches.find((patch) => patch._id === "pike");
  assert.equal(pikeRestore["system.state"], WEAPON_SHEATHED_STATE);
  assert.equal(pikeRestore["system.qualities.long"], true);
  assert.equal(pikeRestore[`flags.${scope}.-=${WEAPON_READINESS_LONG_MODE_FLAG}`], null);
  assert.equal(pikeRestore[`flags.${scope}.-=${WEAPON_READINESS_ORIGINAL_LONG_QUALITY_FLAG}`], null);
});

test("sheathed eligible weapons cannot attack while drawn and natural weapons remain usable", () => {
  assert.equal(canAttackWithWeapon(weapon("sheathed", { state: WEAPON_SHEATHED_STATE })), false);
  assert.equal(canAttackWithWeapon(weapon("drawn", { state: "active", readiness: "drawn" })), true);
  assert.equal(canAttackWithWeapon(weapon("inactive", { state: "equipped" })), false);
  assert.equal(canAttackWithWeapon(weapon("natural", { reference: "unarmed" })), true);
});

test("prepared system weapons resolve to their embedded Item before attack validation", () => {
  const item = weapon("sword", { readiness: "drawn" });
  const actor = {
    items: {
      get(id) {
        return id === item.id ? item : null;
      },
      *[Symbol.iterator]() {
        yield item;
      }
    }
  };
  assert.equal(resolveWeaponItem(actor, { id: "sword" }), item);
  assert.equal(resolveWeaponItem(actor, { id: "missing" }), null);
});

test("the token indicator is namespaced and mechanically empty", () => {
  const data = buildVisualActiveEffectData({
    name: "Drawn weapon: Sword",
    img: "sword.webp",
    statuses: [`${scope}.weapon-readiness`],
    flags: { [scope]: { [WEAPON_READINESS_INDICATOR_FLAG]: true } }
  }, 13);

  assert.deepEqual(data.changes, []);
  assert.equal(data.transfer, false);
  assert.equal("showIcon" in data, false);
  assert.equal(isWeaponReadinessIndicatorEffect({ flags: data.flags }), true);
});

test("Foundry v14 visual effects explicitly request a token icon", () => {
  const data = buildVisualActiveEffectData({ name: "Indicator", img: "weapon.webp" }, 14);
  assert.equal(data.showIcon, 2);
  assert.equal(data.img, "weapon.webp");
});

test("each drawn armament receives an independent token indicator", async () => {
  const originalGame = globalThis.game;
  const gm = { id: "gm", active: true, isGM: true };
  const created = [];
  globalThis.game = {
    release: { generation: 13 },
    user: gm,
    users: [gm],
    settings: { get: () => true },
    i18n: { format: (_key, { weapons }) => `Drawn weapon: ${weapons}` }
  };

  try {
    const sword = Object.assign(weapon("sword", { readiness: "drawn" }), {
      name: "Sword",
      img: "sword.webp"
    });
    const shield = Object.assign(weapon("shield", { readiness: "drawn" }), {
      name: "Shield",
      img: "shield.webp"
    });
    const actor = {
      id: "actor",
      uuid: "Actor.actor",
      type: "player",
      items: [sword, shield],
      effects: [],
      async createEmbeddedDocuments(type, data) {
        assert.equal(type, "ActiveEffect");
        created.push(...data);
      },
      async updateEmbeddedDocuments() {
        assert.fail("new indicators must not require an update");
      },
      async deleteEmbeddedDocuments() {
        assert.fail("new indicators must not require deletion");
      }
    };

    assert.equal(await WeaponReadinessVisualService.syncActorIndicator(actor), true);
    assert.equal(created.length, 2);
    assert.deepEqual(created.map((effect) => effect.img), ["sword.webp", "shield.webp"]);
    assert.deepEqual(created.map((effect) => effect.statuses[0]), [
      getWeaponReadinessStatusId("sword"),
      getWeaponReadinessStatusId("shield")
    ]);
    assert.deepEqual(created.map((effect) => effect.flags[scope][WEAPON_READINESS_INDICATOR_WEAPON_FLAG]), [
      "sword",
      "shield"
    ]);
  } finally {
    globalThis.game = originalGame;
  }
});
test("legacy aggregated token indicators migrate to one effect per drawn armament", async () => {
  const originalGame = globalThis.game;
  const gm = { id: "gm", active: true, isGM: true };
  const created = [];
  const deleted = [];
  globalThis.game = {
    release: { generation: 14 },
    user: gm,
    users: [gm],
    settings: { get: () => true },
    i18n: { format: (_key, { weapons }) => `Drawn weapon: ${weapons}` }
  };

  try {
    const sword = Object.assign(weapon("sword", { readiness: "drawn" }), {
      name: "Sword",
      img: "sword.webp"
    });
    const shield = Object.assign(weapon("shield", { readiness: "drawn" }), {
      name: "Shield",
      img: "shield.webp"
    });
    const actor = {
      id: "legacy-actor",
      uuid: "Actor.legacy-actor",
      type: "player",
      items: [sword, shield],
      effects: [{
        id: "legacy-effect",
        flags: {
          [scope]: {
            [WEAPON_READINESS_INDICATOR_FLAG]: true,
            weaponIds: ["sword", "shield"]
          }
        }
      }],
      async createEmbeddedDocuments(_type, data) {
        created.push(...data);
      },
      async updateEmbeddedDocuments() {
        assert.fail("the aggregate legacy effect must be replaced, not reused");
      },
      async deleteEmbeddedDocuments(_type, ids) {
        deleted.push(...ids);
      }
    };

    assert.equal(await WeaponReadinessVisualService.syncActorIndicator(actor), true);
    assert.deepEqual(deleted, ["legacy-effect"]);
    assert.equal(created.length, 2);
    assert.deepEqual(created.map((effect) => effect.showIcon), [2, 2]);
  } finally {
    globalThis.game = originalGame;
  }
});

test("indicator synchronization reruns after concurrent weapon state updates", async () => {
  const originalGame = globalThis.game;
  const gm = { id: "gm", active: true, isGM: true };
  globalThis.game = {
    release: { generation: 13 },
    user: gm,
    users: [gm],
    settings: { get: () => true },
    i18n: { format: (_key, { weapons }) => `Drawn weapon: ${weapons}` }
  };

  let releaseFirstCreate;
  const firstCreate = new Promise((resolve) => { releaseFirstCreate = resolve; });

  try {
    const sword = Object.assign(weapon("sword", { readiness: "drawn" }), {
      name: "Sword",
      img: "sword.webp"
    });
    const shield = Object.assign(weapon("shield", { state: WEAPON_SHEATHED_STATE }), {
      name: "Shield",
      img: "shield.webp"
    });
    let createCalls = 0;
    const actor = {
      id: "concurrent-actor",
      uuid: "Actor.concurrent-actor",
      type: "player",
      items: [sword, shield],
      effects: [],
      async createEmbeddedDocuments(_type, data) {
        createCalls += 1;
        if (createCalls === 1) await firstCreate;
        for (const effect of data) {
          this.effects.push({ id: `effect-${this.effects.length + 1}`, ...effect });
        }
      },
      async updateEmbeddedDocuments() {},
      async deleteEmbeddedDocuments() {}
    };

    const initialSync = WeaponReadinessVisualService.syncActorIndicator(actor);
    shield.system.state = "active";
    shield.flags[scope] = { [WEAPON_READINESS_FLAG]: "drawn" };
    const queuedSync = WeaponReadinessVisualService.syncActorIndicator(actor);
    releaseFirstCreate();

    assert.equal(await initialSync, true);
    assert.equal(await queuedSync, true);
    assert.equal(createCalls, 2);
    assert.deepEqual(actor.effects.map((effect) => effect.img), ["sword.webp", "shield.webp"]);
  } finally {
    globalThis.game = originalGame;
  }
});
