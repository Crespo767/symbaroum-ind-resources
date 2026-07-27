import assert from "node:assert/strict";
import test from "node:test";

globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: class {},
      HandlebarsApplicationMixin: (base) => base
    }
  },
  utils: {
    deepClone: (value) => structuredClone(value),
    expandObject: (value) => value,
    randomID: () => "test-id"
  }
};
globalThis.game = { settings: { get: () => true } };

const {
  actorUpdateAffectsEncumbrance,
  ENCUMBRANCE_INDICATOR_FLAG,
  ENCUMBRANCE_INDICATOR_ICON,
  ENCUMBRANCE_STATUS_ID,
  EncumbranceVisualService,
  isEncumbranceIndicatorEffect
} = await import("../scripts/encumbrance-visuals.mjs");

const scope = "symbaroum-ind-resources";

function carriedItem(id, slots) {
  return {
    id,
    name: `Item ${id}`,
    type: "equipment",
    system: { isGear: true, state: "equipped", number: 1 },
    flags: { [scope]: { encumbranceSlots: slots, encumbranceManual: true } },
    getFlag(flagScope, key) {
      return this.flags?.[flagScope]?.[key];
    }
  };
}

function actorWithLoad({ strong = 1, slots = 2, effects = [] } = {}) {
  const item = carriedItem("load", slots);
  const actor = {
    id: "actor",
    uuid: "Actor.actor",
    type: "player",
    system: { attributes: { strong: { total: strong } } },
    items: new Map([[item.id, item]]),
    effects,
    async createEmbeddedDocuments(type, data) {
      assert.equal(type, "ActiveEffect");
      for (const effect of data) {
        this.effects.push({ id: `effect-${this.effects.length + 1}`, ...effect });
      }
    },
    async updateEmbeddedDocuments(type, data) {
      assert.equal(type, "ActiveEffect");
      for (const patch of data) {
        const effect = this.effects.find((entry) => entry.id === patch._id);
        Object.assign(effect, patch);
      }
    },
    async deleteEmbeddedDocuments(type, ids) {
      assert.equal(type, "ActiveEffect");
      this.effects = this.effects.filter((effect) => !ids.includes(effect.id));
    }
  };
  item.parent = actor;
  return actor;
}

function withGame(callback, { enabled = true, generation = 13 } = {}) {
  const originalGame = globalThis.game;
  const gm = { id: "gm", active: true, isGM: true };
  globalThis.game = {
    release: { generation },
    user: gm,
    users: [gm],
    settings: { get: (_moduleId, key) => key === "enableEncumbrance" && enabled },
    i18n: { localize: () => "Sobrecarregado!" }
  };
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      globalThis.game = originalGame;
    });
}

test("encumbrance indicator is namespaced, visible, and mechanically empty", async () => {
  await withGame(async () => {
    const actor = actorWithLoad();

    assert.equal(await EncumbranceVisualService.syncActorIndicator(actor), true);
    assert.equal(actor.effects.length, 1);
    const effect = actor.effects[0];
    assert.equal(effect.img, ENCUMBRANCE_INDICATOR_ICON);
    assert.deepEqual(effect.statuses, [ENCUMBRANCE_STATUS_ID]);
    assert.deepEqual(effect.changes, []);
    assert.equal(effect.transfer, false);
    assert.equal(effect.flags[scope][ENCUMBRANCE_INDICATOR_FLAG], true);
    assert.equal(isEncumbranceIndicatorEffect(effect), true);
  });
});

test("Foundry v14 encumbrance indicator explicitly requests a token icon", async () => {
  await withGame(async () => {
    const actor = actorWithLoad();
    await EncumbranceVisualService.syncActorIndicator(actor);
    assert.equal(actor.effects[0].showIcon, 2);
  }, { generation: 14 });
});

test("encumbrance indicator is removed when the actor is no longer overloaded", async () => {
  await withGame(async () => {
    const actor = actorWithLoad();
    await EncumbranceVisualService.syncActorIndicator(actor);

    actor.system.attributes.strong.total = 3;
    assert.equal(await EncumbranceVisualService.syncActorIndicator(actor), true);
    assert.deepEqual(actor.effects, []);
  });
});

test("disabling encumbrance removes a stale visual indicator", async () => {
  const stale = {
    id: "stale",
    flags: { [scope]: { [ENCUMBRANCE_INDICATOR_FLAG]: true } }
  };
  await withGame(async () => {
    const actor = actorWithLoad({ effects: [stale] });
    assert.equal(await EncumbranceVisualService.syncActorIndicator(actor), true);
    assert.deepEqual(actor.effects, []);
  }, { enabled: false });
});

test("duplicate encumbrance indicators collapse to one effect", async () => {
  const indicators = ["first", "duplicate"].map((id) => ({
    id,
    name: "Sobrecarregado!",
    img: ENCUMBRANCE_INDICATOR_ICON,
    statuses: new Set([ENCUMBRANCE_STATUS_ID]),
    flags: { [scope]: { [ENCUMBRANCE_INDICATOR_FLAG]: true } }
  }));

  await withGame(async () => {
    const actor = actorWithLoad({ effects: indicators });
    assert.equal(await EncumbranceVisualService.syncActorIndicator(actor), true);
    assert.equal(actor.effects.length, 1);
    assert.equal(actor.effects[0].id, "first");
  });
});

test("only Strong attribute updates require an actor-level encumbrance refresh", () => {
  assert.equal(actorUpdateAffectsEncumbrance({ "system.attributes.strong.total": 12 }), true);
  assert.equal(actorUpdateAffectsEncumbrance({ system: { attributes: { strong: { total: 12 } } } }), true);
  assert.equal(actorUpdateAffectsEncumbrance({ "system.health.value": 5 }), false);
  assert.equal(actorUpdateAffectsEncumbrance({ name: "Novo nome" }), false);
});
