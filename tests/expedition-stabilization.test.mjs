import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

globalThis.Hooks = { once() {}, on() {}, callAll() {} };
globalThis.ActorSheet = class {
  constructor(actor) { this.actor = actor; this.isEditable = true; }
  async getData() { return {}; }
  render() {}
};
globalThis.foundry = { utils: { deepClone: structuredClone } };

const { MODULE_ID, DEFAULTS, CANONICAL_EXPEDITION_TABLE_IDS } = await import("../scripts/constants.mjs");
const { PartyActorSheet, PARTY_ACTOR_TYPE, getActorExpeditionData, resolveMishapsTable, resolveDavokarEventTable } = await import("../scripts/party-actor.mjs");
const { RationService } = await import("../scripts/rations.mjs");
const { createChatMessageAfterDice, showDice3dRoll, registerDiceHooks } = await import("../scripts/dice.mjs");
const { actorReference, actorStateKey, resolveActorReference } = await import("../scripts/actor-references.mjs");

let settings, messages;
beforeEach(() => {
  settings = { ...DEFAULTS, enableRations: true, enableInventoryCleanup: false, enableRollPrivacy: true };
  messages = [];
  const users = [{ id: "gm", isGM: true }, { id: "player", isGM: false }];
  globalThis.game = {
    user: users[1], users, actors: new Map(), packs: [], tables: [],
    settings: { get: (scope, key) => scope === "core" ? settings.rollMode : settings[key] },
    i18n: { localize: key => key, format: key => key }
  };
  globalThis.ui = { notifications: { info() {}, warn() {} } };
  globalThis.CONFIG = { sounds: { dice: "dice.ogg" } };
  globalThis.ChatMessage = {
    getSpeaker: () => ({}),
    create: async data => { messages.push(data); return data; }
  };
  globalThis.Roll = class {
    constructor(formula = "1d20") { this.formula = formula; this.total = 10; }
    async evaluate() { return this; }
  };
  delete globalThis.Dialog;
  delete globalThis.fromUuid;
});

// Protocolo de atualização do Foundry: mescla recursiva, caminhos pontuados, -= e ==.
// Um Object.assign simples esconderia justamente a regressão que estes testes protegem.
function updateDocument(target, changes) {
  for (const [path, value] of Object.entries(changes)) {
    const parts = path.split(".");
    let parent = target;
    for (const part of parts.slice(0, -1)) parent = parent[part] ??= {};
    const key = parts.at(-1);
    if (key.startsWith("-=")) delete parent[key.slice(2)];
    else if (key.startsWith("==")) parent[key.slice(2)] = structuredClone(value);
    else if (value && typeof value === "object" && !Array.isArray(value)) {
      updateDocument(parent[key] ??= {}, value);
    } else parent[key] = structuredClone(value);
  }
}

function actor(id = "hero", type = "player") {
  return {
    id, uuid: `Actor.${id}`, name: id, img: "hero.webp", documentName: "Actor", type, isOwner: true,
    items: new Map(), system: {}, flags: {},
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async setFlag(scope, key, value) {
      await new Promise(resolve => setImmediate(resolve));
      updateDocument(this, { [`flags.${scope}.${key}`]: value });
    },
    async update(data) { updateDocument(this, data); return this; }
  };
}

function bread(owner, id, { number = 1, description = id, storedIn = "" } = {}) {
  const item = {
    id, uuid: `${owner.uuid}.Item.${id}`, parent: owner, type: "equipment", name: "Pão de Viagem", img: "bread.webp",
    system: { number, description },
    getFlag(_scope, key) { return key === "storedIn" ? storedIn : undefined; },
    async update(data) { updateDocument(this, data); return this; },
    async delete() { owner.items.delete(id); return this; }
  };
  owner.items.set(id, item);
  return item;
}

function expedition() {
  const party = actor("party", PARTY_ACTOR_TYPE);
  const state = {
    active: true, day: 2, guideId: "guide", activeSearch: false, tables: { ruins: "RollTable.custom" },
    dayState: { orientation: { rolled: true }, rations: { hero: { fed: true } }, events: { ruins: { rolled: true }, terrain: { rolled: true } } }
  };
  party.system.expedition = structuredClone(state);
  party.flags[MODULE_ID] = { expedition: structuredClone(state), unrelated: "keep" };
  return party;
}

function mixedFood(owner) {
  bread(owner, "bread");
  settings.enableOtherRations = true;
  game.settings.settings = new Map(["enableOtherRations", "extraRationFoods"].map(key => [`${MODULE_ID}.${key}`, {}]));
  settings.extraRationFoods = { foods: { copo_de_vesa: { name: "Meal", enabled: true, uses: 2, aliases: [] } } };
  const meal = bread(owner, "meal"); meal.name = "Meal";
  return meal;
}

test("mixed foods contribute to the group total and fund a complete request across rules", async () => {
  const party = expedition(); mixedFood(party);
  assert.equal(RationService.getTotalUses(party), 9);
  const view = await new PartyActorSheet(party).getData();
  assert.equal(view.expedition.rations.groupTotal, 9);
  assert.equal(await RationService.consumeDay(party, null, { days: 8, requireFull: true }), true);
  assert.equal(RationService.getTotalUses(party), 1);
  assert.equal(party.items.get("bread").system.number, 0);
  assert.equal(party.items.get("meal").system.number, 1);
});

test("insufficient full-period requests leave all food types untouched", async () => {
  const hero = actor(); mixedFood(hero);
  assert.equal(await RationService.consumeDay(hero, null, { days: 10, requireFull: true }), false);
  assert.equal(RationService.getTotalUses(hero), 9);
  assert.equal(messages.length, 0);
});

test("partial consumption cannot report that the entire requested period was covered", async () => {
  const hero = actor(); bread(hero, "bread");
  assert.equal(await RationService.consumeDay(hero, null, { days: 10 }), false);
  assert.equal(RationService.getTotalUses(hero), 0);
});

test("selecting a ration item never silently spends another food type", async () => {
  const hero = actor(), meal = mixedFood(hero);
  assert.equal(await RationService.consumeDay(hero, meal, { days: 3, requireFull: true }), false);
  assert.equal(RationService.getTotalUses(hero), 9);
});

test("compendium references survive drop, card rendering and removal without colliding with world IDs", async () => {
  const party = expedition(), world = actor("same"), compendium = actor("same");
  compendium.uuid = "Compendium.example.actors.same"; compendium.pack = "example.actors";
  game.actors.set(world.id, world);
  globalThis.fromUuid = async ref => ref === compendium.uuid ? compendium : null;
  const sheet = new PartyActorSheet(party);
  await sheet._onDropActor({}, { uuid: compendium.uuid });
  assert.deepEqual(party.system.members, [compendium.uuid]);
  let view = await sheet.getData();
  assert.equal(view.members[0].actor, compendium);
  assert.equal(view.members[0].id, compendium.uuid);
  await sheet._onSetGuide(compendium.uuid);
  view = await sheet.getData(); assert.equal(view.members[0].isGuide, true);
  assert.equal(view.expedition.guide.actor, compendium);
  await sheet._onRemoveMember(view.members[0].id);
  assert.deepEqual(party.system.members, []);
});

test("synthetic actor cards preserve UUIDs through toggle and manual feeding", async () => {
  const party = expedition(), tokenActor = actor("base");
  tokenActor.uuid = "Scene.scene.Token.token.Actor.base";
  globalThis.fromUuid = async uuid => uuid === tokenActor.uuid ? tokenActor : null;
  const sheet = new PartyActorSheet(party);
  await sheet._onDropActor({}, { uuid: tokenActor.uuid });
  const view = await sheet.getData();
  assert.equal(view.members[0].id, actorReference(tokenActor));
  await sheet._onToggleMemberType(tokenActor.uuid);
  assert.deepEqual(party.system.companions, [tokenActor.uuid]);
  await sheet._onToggleFeedMember(tokenActor.uuid);
  assert.equal(party.system.expedition.dayState.rations[actorStateKey(tokenActor)].fed, true);
});

test("missing explicit actor UUIDs and non-actor documents never resolve to a world namesake", async () => {
  game.actors.set("same", actor("same"));
  globalThis.fromUuid = async () => ({ documentName: "Item", system: {} });
  assert.equal(await resolveActorReference("Compendium.removed.actors.same"), null);
  const party = expedition(); party.system.expedition.guideId = "same";
  party.system.expedition.guideUuid = "Compendium.removed.actors.same";
  const view = await new PartyActorSheet(party).getData();
  assert.equal(view.expedition.guide.hasGuide, false);
});

test("automatic mishaps lookup recognizes the historical adventure ID without replacing it", async () => {
  const table = { id: "tblMishDav0000001", uuid: "RollTable.tblMishDav0000001" };
  game.tables = [table];
  assert.equal(await resolveMishapsTable(), table);
  assert.equal(await resolveMishapsTable("RollTable.removed"), null);
});

for (const [action, day, active] of [
  ["_onStartExpedition", 1, true], ["_onNextExpeditionDay", 3, true],
  ["_onPrevExpeditionDay", 1, true], ["_onEndExpedition", 0, false]
]) {
  test(`${action} replaces daily state in system and flags without removing expedition settings`, async () => {
    const party = expedition();
    await new PartyActorSheet(party)[action]();
    for (const exp of [party.system.expedition, party.flags[MODULE_ID].expedition]) {
      assert.equal(exp.day, day);
      assert.equal(exp.active, active);
      const { revision, ...dayState } = exp.dayState;
      assert.equal(typeof revision, "string");
      assert.deepEqual(dayState, { orientation: null, rations: {}, events: {} });
      assert.equal(exp.guideId, "guide");
      assert.equal(exp.activeSearch, false);
      assert.equal(exp.tables.ruins, "RollTable.custom");
    }
    assert.equal(party.flags[MODULE_ID].unrelated, "keep");
    // Simula reabertura/releitura depois da atualização persistida.
    assert.deepEqual(getActorExpeditionData(structuredClone({ system: party.system, flags: party.flags })).dayState,
      party.system.expedition.dayState);
  });
}

test("resetting one event actually deletes it and preserves other slots", async () => {
  const party = expedition();
  game.user.active = true;
  game.users.get = id => game.users.find(user => user.id === id);
  party.testUserPermission = user => user.id === game.user.id;
  globalThis.fromUuid = async uuid => uuid === party.uuid ? party : null;
  await new PartyActorSheet(party)._onResetSingleEvent("ruins");
  for (const exp of [party.system.expedition, party.flags[MODULE_ID].expedition]) {
    assert.equal(exp.dayState.events.ruins, undefined);
    assert.equal(exp.dayState.events.terrain.rolled, true);
    assert.equal(exp.dayState.rations.hero.fed, true);
  }
});

test("read-only sheets cannot reset days or events", async () => {
  const party = expedition(), before = structuredClone(party.system);
  const sheet = new PartyActorSheet(party); sheet.isEditable = false;
  await sheet._onNextExpeditionDay();
  await sheet._onResetSingleEvent("ruins");
  assert.deepEqual(party.system, before);
});

for (const [slot, resolve] of [
  ["mishaps", reference => resolveMishapsTable(reference)],
  ["ruins", reference => resolveDavokarEventTable("ruins", reference)]
]) {
  test(`a missing configured ${slot} table does not silently use the available default`, async () => {
    const fallback = { id: CANONICAL_EXPEDITION_TABLE_IDS[slot], name: "Default" };
    game.tables = [fallback];
    globalThis.fromUuid = async () => { throw new Error("pack removed"); };
    assert.equal(await resolve("Compendium.removed.tables.custom"), null);
    assert.equal(await resolve("RollTable.removed"), null);
    assert.equal(await resolve(), fallback, "automatic selection keeps its default lookup");
  });
}

test("group inventory preserves legitimate zero weight and zero quantity", async () => {
  const party = expedition();
  const zeroWeight = bread(party, "light", { number: 5 });
  zeroWeight.getFlag = (_scope, key) => key === "encumbranceManual" ? true : key === "encumbranceSlots" ? 0 : undefined;
  bread(party, "empty", { number: 0 });
  const data = await new PartyActorSheet(party).getData();
  assert.equal(data.storage.currentLoad, 0);
  assert.equal(data.inventoryItems.find(i => i.id === "empty").quantity, 0);
  const sheet = new PartyActorSheet(party);
  await sheet._onDecreaseItemQuantity("empty");
  assert.equal(party.items.get("empty").system.number, 0);
  await sheet._onIncreaseItemQuantity("empty");
  assert.equal(party.items.get("empty").system.number, 1);
});

test("consuming distinct ration stacks decreases total uses without duplicating either stack", async () => {
  const hero = actor(); bread(hero, "normal"); bread(hero, "other");
  assert.equal(RationService.needsConsolidation(hero), false);
  assert.equal(RationService.getState(hero).totalUsesRemaining, 14);
  assert.equal(await RationService.consumeDay(hero), true);
  assert.equal(RationService.getState(hero).totalUsesRemaining, 13);
  assert.deepEqual([...hero.items.values()].map(i => i.system.number), [1, 1]);
});

test("the selected stack is debited and its container and the other stack remain intact", async () => {
  const hero = actor();
  const first = bread(hero, "a", { description: "same", storedIn: "bag-a" });
  const selected = bread(hero, "b", { description: "same", storedIn: "bag-b" });
  await RationService.consumeDay(hero, selected, { days: 7 });
  assert.equal(first.system.number, 1);
  assert.equal(selected.system.number, 0);
  assert.equal(selected.getFlag(MODULE_ID, "storedIn"), "bag-b");
  assert.equal(RationService.getState(hero).totalUsesRemaining, 7);
});

test("multi-day consumption spans stacks without increasing stock", async () => {
  const hero = actor(); bread(hero, "a"); bread(hero, "b", { number: 2 });
  await RationService.consumeDay(hero, null, { days: 15 });
  assert.equal(RationService.getState(hero).totalUsesRemaining, 6);
  assert.deepEqual([...hero.items.values()].map(i => i.system.number), [0, 1]);
});

test("simultaneous local consumptions reread the balance after asynchronous persistence", async () => {
  const hero = actor(); bread(hero, "a", { number: 3 });
  await Promise.all([RationService.consumeDay(hero), RationService.consumeDay(hero)]);
  assert.equal(RationService.getState(hero).totalUsesRemaining, 19);
});

test("one rejected consumption does not block the next operation", async () => {
  const hero = actor(); const item = bread(hero, "a", { number: 2 });
  const originalUpdate = item.update; let fail = true;
  item.update = async function (data) { if (fail) { fail = false; throw new Error("write failed"); } return originalUpdate.call(this, data); };
  const first = RationService.consumeDay(hero, null, { days: 7 });
  const second = RationService.consumeDay(hero);
  await assert.rejects(first, /write failed/);
  assert.equal(await second, true);
  assert.equal(RationService.getState(hero).totalUsesRemaining, 13);
});

test("cleanup can remove an exhausted stack without damaging remaining distinct rations", async () => {
  settings.enableInventoryCleanup = true;
  const hero = actor(); bread(hero, "a"); bread(hero, "b");
  await RationService.consumeDay(hero, null, { days: 7 });
  assert.equal(hero.items.has("a"), false);
  assert.equal(hero.items.get("b").system.number, 1);
  assert.equal(RationService.getState(hero).totalUsesRemaining, 7);
});

test("disabled rations do not change inventory or publish a message", async () => {
  settings.enableRations = false;
  const hero = actor(); bread(hero, "a");
  assert.equal(await RationService.consumeDay(hero), false);
  assert.equal(RationService.getState(hero).totalUsesRemaining, 7);
  assert.equal(messages.length, 0);
});

for (const rollMode of ["publicroll", "gmroll", "blindroll", "selfroll"]) {
  for (const dice3d of [false, true]) {
    test(`${rollMode} recipients match chat and ${dice3d ? "3D dice" : "chat roll fallback"}`, async () => {
      settings.rollMode = rollMode;
      const animations = [];
      if (dice3d) game.dice3d = { showForRoll: async (...args) => { animations.push(args); } };
      const roll = new Roll();
      const message = await createChatMessageAfterDice({ speaker: {}, content: "event", rolls: [roll], flags: { other: { keep: true } } });
      const recipients = rollMode === "publicroll" ? [] : rollMode === "selfroll" ? ["player"] : ["gm"];
      assert.deepEqual(message.whisper, recipients);
      assert.equal(message.blind, rollMode === "blindroll");
      assert.equal(message.flags.other.keep, true);
      assert.deepEqual(message.rolls, [roll], "core must retain roll identity to protect blind results");
      if (dice3d) {
        assert.deepEqual(animations[0][3], recipients.length ? recipients : null);
        assert.equal(animations[0][4], message.blind);
        assert.equal(message.flags[MODULE_ID].diceAnimationShown, true);
      }
    });
  }
}

test("the public Dice So Nice hook suppresses only animations already shown by this module", () => {
  const registrations = [];
  Hooks.on = (name, fn) => registrations.push([name, fn]);
  registerDiceHooks(); registerDiceHooks();
  assert.equal(registrations.length, 1);
  const [name, hook] = registrations[0];
  assert.equal(name, "diceSoNiceMessageProcessed");
  game.messages = new Map([["animated", { flags: { [MODULE_ID]: { diceAnimationShown: true } } }], ["normal", { flags: {} }]]);
  const processed = { willTrigger3DRoll: true }; hook("animated", processed);
  assert.equal(processed.willTrigger3DRoll, false);
  for (const id of ["normal", "missing"]) {
    const data = { willTrigger3DRoll: true }; hook(id, data); assert.equal(data.willTrigger3DRoll, true);
  }
});

test("explicit module privacy overrides public mode before showing dice", async () => {
  settings.rollMode = "publicroll";
  let visibility;
  game.dice3d = { showForRoll: async (_roll, _user, _sync, recipients, blind) => { visibility = { recipients, blind }; } };
  const data = await createChatMessageAfterDice({ content: "hidden", rolls: [new Roll()], privateRoll: true });
  assert.deepEqual(visibility, { recipients: ["gm"], blind: true });
  assert.equal(data.flags[MODULE_ID].privateRoll, true);
  assert.equal(data.blind, true);
});

test("native core privacy still applies when module privacy is disabled", async () => {
  settings.enableRollPrivacy = false; settings.rollMode = "blindroll";
  const data = await createChatMessageAfterDice({ content: "event", rolls: [new Roll()] });
  assert.deepEqual(data.whisper, ["gm"]); assert.equal(data.blind, true);
});

test("standalone dice use the selected core mode and narrative messages keep their existing visibility", async () => {
  settings.rollMode = "selfroll";
  const animations = [];
  game.dice3d = { showForRoll: async (...args) => { animations.push(args); } };
  await showDice3dRoll(new Roll());
  assert.deepEqual(animations[0][3], ["player"]);
  const narrative = await createChatMessageAfterDice({ content: "no dice" });
  assert.equal(narrative.whisper, undefined);
});

test("the helper uses the core public API for applying roll modes when available", async () => {
  settings.rollMode = "gmroll"; const modes = [];
  ChatMessage.applyRollMode = (data, mode) => { modes.push(mode); data.whisper = ["gm"]; data.blind = false; };
  const result = await createChatMessageAfterDice({ content: "event", rolls: [new Roll()] });
  assert.deepEqual(modes, ["gmroll"]); assert.deepEqual(result.whisper, ["gm"]);
});

test("chat publication waits for the actual completion of the 3D animation", async () => {
  let finish;
  game.dice3d = { showForRoll: () => new Promise(resolve => { finish = resolve; }) };
  const creation = createChatMessageAfterDice({ content: "event", rolls: [new Roll()] });
  assert.equal(messages.length, 0);
  finish();
  await creation;
  assert.equal(messages.length, 1);
});

test("animation failure preserves blind visibility in the chat roll fallback", async () => {
  settings.rollMode = "blindroll";
  game.dice3d = { showForRoll: async () => { throw new Error("animation failed"); } };
  const warn = console.warn; console.warn = () => {};
  try {
    const roll = new Roll();
    const data = await createChatMessageAfterDice({ content: "event", rolls: [roll] });
    assert.deepEqual(data.rolls, [roll]);
    assert.deepEqual(data.whisper, ["gm"]);
    assert.equal(data.blind, true);
  } finally { console.warn = warn; }
});

test("delete and guide dialogs treat user-controlled names as text", async () => {
  const party = expedition(), captured = [];
  const name = '<img src=x onerror="alert(1)">';
  const item = bread(party, "a"); item.name = name;
  globalThis.Dialog = class { constructor(data) { captured.push(data); } render() { return this; } };
  const sheet = new PartyActorSheet(party);
  await sheet._onDeleteItem(item.id);
  party.system.members = ["guide"];
  sheet._resolveActor = id => ({ id, name });
  await sheet._onSelectGuide();
  for (const dialog of captured) {
    assert.ok(!dialog.content.includes(name));
    assert.ok(dialog.content.includes("&lt;img"));
  }
});
