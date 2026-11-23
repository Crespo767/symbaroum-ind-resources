import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

const hooks = new Map(), handlers = new Map(), registeredHooks = new Map();
globalThis.Hooks = { once(name, fn) { hooks.set(name, fn); }, on(name, fn) {
  const callbacks = registeredHooks.get(name) ?? []; callbacks.push(fn); registeredHooks.set(name, callbacks);
}, callAll() {} };
globalThis.foundry = { utils: { deepClone: structuredClone, randomID: () => `revision-${++revision}` } };
globalThis.CONFIG = { Actor: {} };
let revision = 0;
const { MODULE_ID, DEFAULTS } = await import("../scripts/constants.mjs");
const { SocketService } = await import("../scripts/sockets.mjs");
const { RationService } = await import("../scripts/rations.mjs");
const { PartyActorService, PartyActorSheet } = await import("../scripts/party-actor.mjs");
RationService.register();
PartyActorService.register();
let routed, routedResult, routeFailure;
globalThis.socketlib = { registerModule: () => ({
  register(name, fn) { handlers.set(name, fn); },
  async executeAsUser(...args) {
    routed.push(args);
    if (routeFailure) throw new Error("GM connection unavailable");
    return routedResult;
  }
}) };
hooks.get("socketlib.ready")();

class Collection extends Map {
  [Symbol.iterator]() { return this.values(); }
  filter(predicate) { return [...this.values()].filter(predicate); }
}
let gm, gm2, player, other, settings, docs, party, hero, companion, chat;
const tick = () => new Promise(resolve => setImmediate(resolve));
function apply(target, changes) {
  for (const [path, value] of Object.entries(changes)) {
    const parts = path.split("."); let parent = target;
    for (const key of parts.slice(0, -1)) parent = parent[key] ??= {};
    const key = parts.at(-1);
    if (key.startsWith("==")) parent[key.slice(2)] = structuredClone(value);
    else if (key.startsWith("-=")) delete parent[key.slice(2)];
    else if (value && typeof value === "object" && !Array.isArray(value)) apply(parent[key] ??= {}, value);
    else parent[key] = structuredClone(value);
  }
}
function actor(id, owners = []) {
  const result = {
    id, uuid: `Actor.${id}`, documentName: "Actor", type: "player", name: id, img: "hero.webp",
    system: {}, flags: {}, items: new Collection(),
    testUserPermission(user) { return user.isGM || owners.includes(user.id); },
    get isOwner() { return this.testUserPermission(game.user); },
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async update(changes) { await tick(); apply(this, changes); return this; },
    async setFlag(scope, key, value) { return this.update({ [`flags.${scope}.${key}`]: value }); },
    async updateEmbeddedDocuments(_type, updates) { for (const data of updates) await this.items.get(data._id).update(data); },
    async deleteEmbeddedDocuments(_type, ids) { for (const id of ids) this.items.delete(id); }
  };
  docs.set(result.uuid, result); return result;
}
function bread(owner, id = "bread", number = 1) {
  const item = {
    id, uuid: `${owner.uuid}.Item.${id}`, parent: owner, type: "equipment", name: "Pão de Viagem", img: "bread.webp",
    system: { number, description: "same" }, getFlag() {},
    async update(data) { await tick(); apply(this, data); return this; }
  };
  owner.items.set(id, item); docs.set(item.uuid, item); return item;
}
function request(name, user, ...args) {
  return handlers.get(name).call({ socketdata: { userId: user.id } }, ...args);
}
beforeEach(() => {
  gm = { id: "gm", isGM: true, active: true };
  gm2 = { id: "gm2", isGM: true, active: true };
  player = { id: "player", isGM: false, active: true };
  other = { id: "other", isGM: false, active: true };
  const users = new Collection([gm, gm2, player, other].map(u => [u.id, u])); users.activeGM = gm;
  docs = new Map(); chat = []; routed = []; routedResult = true; routeFailure = false;
  settings = { ...DEFAULTS, enableRations: true, enableInventoryCleanup: false };
  globalThis.game = {
    user: gm, users, actors: new Collection(),
    settings: { get: (_scope, key) => settings[key] },
    i18n: { localize: key => key, format: key => key }
  };
  globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), async create(data) { await tick(); chat.push(data); return data; } };
  globalThis.fromUuid = async uuid => docs.get(uuid);
  hero = actor("hero", [player.id]); companion = actor("companion", [other.id]);
  party = actor("party", [player.id, other.id]); party.type = `${MODULE_ID}.party`;
  party.system = { members: [hero.id, companion.id], expedition: { active: true, day: 1, dayState: {} } };
  for (const doc of [party, hero, companion]) game.actors.set(doc.id, doc);
  bread(party); bread(hero); bread(companion);
});

test("players and secondary GMs route resource operations to the designated GM", async () => {
  for (const user of [player, gm2]) {
    game.user = user;
    await RationService.consumeDay(hero);
    assert.deepEqual(routed.at(-1), ["consumeRations", gm.id, hero.uuid, null, 1, false]);
    await RationService.consolidate(hero);
    assert.deepEqual(routed.at(-1), ["consolidateRations", gm.id, hero.uuid]);
  }
  assert.equal(RationService.getState(hero).totalUsesRemaining, 7, "the requesting client must not debit locally");
});

test("the primary GM executes registered handlers locally and routing rejects unknown handlers", async () => {
  assert.equal(await SocketService.executeAsPrimaryGM("consumeRations", hero.uuid, null, 1), true);
  assert.equal(routed.length, 0);
  await assert.rejects(SocketService.executeAsPrimaryGM("notRegistered"), /Unknown socket handler/);
});

test("two authenticated clients consume the shared stock in sequence", async () => {
  await Promise.all([
    request("consumeRations", player, party.uuid, null, 1),
    request("consumeRations", other, party.uuid, null, 1)
  ]);
  assert.equal(RationService.getState(party).totalUsesRemaining, 5);
});

test("consolidation and consumption use the same actor queue", async () => {
  bread(party, "duplicate");
  await Promise.all([
    request("consolidateRations", player, party.uuid),
    request("consumeRations", other, party.uuid, null, 1)
  ]);
  assert.equal(party.items.size, 1);
  assert.equal(RationService.getState(party).totalUsesRemaining, 13);
});

test("inactive or missing requesters and unowned actors cannot consume or consolidate", async () => {
  other.active = false;
  await assert.rejects(request("consumeRations", other, party.uuid, null, 1), /authenticated active user/);
  await assert.rejects(request("consumeRations", { id: "unknown" }, party.uuid, null, 1), /authenticated active user/);
  other.active = true;
  await assert.rejects(request("consumeRations", other, hero.uuid, null, 1), /not owned/);
  await assert.rejects(request("consolidateRations", other, hero.uuid), /not owned/);
  assert.equal(RationService.getState(hero).totalUsesRemaining, 7);
});

test("ration RPC rejects forged amounts, unrelated items and compendium actors", async () => {
  for (const days of [-1, 0, 1.5, Infinity, "2"]) {
    await assert.rejects(request("consumeRations", player, hero.uuid, null, days), /Invalid ration amount/);
  }
  await assert.rejects(request("consumeRations", player, hero.uuid, "foreign", 1), /Invalid ration item/);
  hero.pack = "example.pack";
  await assert.rejects(request("consumeRations", player, hero.uuid, null, 1), /Invalid ration actor/);
});

test("resource handlers reject execution on a secondary GM", async () => {
  game.user = gm2;
  await assert.rejects(request("consumeRations", player, hero.uuid, null, 1), /designated GM/);
  await assert.rejects(request("consolidateRations", player, hero.uuid), /designated GM/);
});

test("a connection failure never falls back to a second unsynchronized local debit", async () => {
  game.user = player; routeFailure = true;
  await assert.rejects(RationService.consumeDay(hero), /GM connection unavailable/);
  assert.equal(RationService.getState(hero).totalUsesRemaining, 7);
});

test("trusted players still need ownership of the provisions they consume", async () => {
  const trusted = { id: "trusted", role: 2, isGM: false, active: true };
  game.users.set(trusted.id, trusted);
  await assert.rejects(request("consumeRations", trusted, hero.uuid, null, 1), /not owned/);
  await assert.rejects(request("consumeRations", trusted, party.uuid, null, 1), /not owned/);
  hero.testUserPermission = user => user.isGM || user.id === trusted.id;
  assert.equal(await request("consumeRations", trusted, hero.uuid, null, 1), true);
  assert.equal(RationService.getState(hero).totalUsesRemaining, 6);
});

test("disabled rations cannot be consumed through the GM endpoint", async () => {
  settings.enableRations = false;
  assert.equal(await request("consumeRations", player, hero.uuid, null, 1), false);
  assert.equal(RationService.getState(hero).totalUsesRemaining, 7);
});

test("without a GM, personal inventory still works on a legacy group's member", async () => {
  game.users.activeGM = null; game.user = player;
  party.testUserPermission = user => user.isGM;
  assert.equal(await RationService.consumeDay(hero), true);
  assert.equal(RationService.getState(hero).totalUsesRemaining, 6);
  assert.equal(party.system.expedition.dayState.rations, undefined);
});

test("chat publication failure does not turn a completed consumption into a retryable failure", async () => {
  ChatMessage.create = async () => { throw new Error("chat write failed"); };
  const warn = console.warn; console.warn = () => {};
  try {
    assert.equal(await request("consumeRations", player, hero.uuid, null, 1), true);
    assert.equal(RationService.getState(hero).totalUsesRemaining, 6);
  } finally { console.warn = warn; }
});

test("related card refreshes coalesce and only render existing open party sheets", async () => {
  let rendered = 0, unrelated = 0;
  const sheet = new PartyActorSheet(); sheet.rendered = true; sheet.render = () => rendered++;
  party.apps = { open: sheet };
  const second = actor("second"); second.type = party.type; second.system.members = ["unrelated"];
  const otherSheet = new PartyActorSheet(); otherSheet.rendered = true; otherSheet.render = () => unrelated++;
  second.apps = { open: otherSheet }; game.actors.set(second.id, second);
  PartyActorService.register();
  assert.equal(registeredHooks.get("updateActor").length, 1);
  registeredHooks.get("updateActor")[0](hero);
  registeredHooks.get("updateItem")[0]({ parent: hero });
  registeredHooks.get("updateActiveEffect")[0]({ parent: { documentName: "Item", parent: companion } });
  await tick();
  assert.equal(rendered, 1); assert.equal(unrelated, 0);
  sheet.rendered = false;
  PartyActorService.refreshRelatedSheets(hero); await tick(); assert.equal(rendered, 1);
});
test("retired effort receipts and travel modes do not block configured rest healing", async () => {
  const { RestService } = await import("../scripts/rest.mjs");
  settings.enableRestHealing=true; settings.enableRestCorruption=false; settings.enableHunger=false;
  hero.system.health={toughness:{value:5,max:10},corruption:{temporary:0}};
  hero.system.attributes={strong:{total:10}}; hero.effects=[];
  party.flags[MODULE_ID]={expedition:{travel:{configured:true,mode:"mortalMarch",activity:"travel"}}};
  hero.flags[MODULE_ID]={journeyReceipt:{party:party.uuid,allowNaturalRecovery:false}};
  await RestService.applyRest(hero,1,2,{spendBread:false});
  assert.equal(hero.system.health.toughness.value,7);
  assert.equal(hero.flags[MODULE_ID].journeyReceipt.allowNaturalRecovery,false,"Old data is retained but ignored");
});

test("a member can consume rations without writing to a legacy active expedition", async () => {
  party.flags[MODULE_ID] = { expedition: { active: true, day: 1, dayState: { rations: {} } } };
  const saved = structuredClone({ system: party.system, flags: party.flags });
  party.update = async () => { assert.fail("Personal rations must never update the legacy party"); };

  assert.equal(await request("consumeRations", player, hero.uuid, null, 1), true);
  assert.equal(RationService.getState(hero).totalUsesRemaining, 6);
  assert.equal(RationService.getState(party).totalUsesRemaining, 7);
  assert.deepEqual({ system: party.system, flags: party.flags }, saved);
});

test("the former expedition endpoints are no longer registered", () => {
  assert.equal(handlers.has("consumeRations"), true);
  for (const name of [
    "setExpeditionDay", "rollExpeditionOrientation", "resetExpeditionOrientation",
    "readExpeditionResults", "rollExpeditionEvents", "resetExpeditionEvent", "feedExpeditionRations"
  ]) {
    assert.equal(handlers.has(name), false, name);
  }
  assert.equal(PartyActorService.setExpeditionDay, undefined);
  assert.equal(RationService.feedExpedition, undefined);
});
