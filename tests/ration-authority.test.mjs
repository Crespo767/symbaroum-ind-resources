import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { nativeRollTableFixture } from "./native-roll-table-fixture.mjs";

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
const { PartyActorService, PartyActorSheet, drawMishapTable } = await import("../scripts/party-actor.mjs");
const { expeditionDayKey, expeditionOrientationKey, expeditionEventKey } = await import("../scripts/expedition-state.mjs");
const { actorReference, actorStateKey } = await import("../scripts/actor-references.mjs");
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
function feed(user, ids = [hero.id], source = "group", key = expeditionDayKey(party)) {
  return request("feedExpeditionRations", user, party.uuid, ids, source, key);
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
  game.packs = new Map();
  globalThis.CompendiumCollection = {
    async createCompendium(metadata) {
      assert.equal(game.user.isGM, true);
      const contents = new Map();
      const pack = {
        collection: `world.${metadata.name}`, metadata: { ...metadata, packageType: "world" }, ownership: metadata.ownership,
        async configure(data) { Object.assign(this, data); },
        async getDocument(id) { assert.equal(game.user.isGM, true); return contents.get(id); },
        documentClass: { async create(data, options) {
          assert.equal(game.user.isGM, true);
          assert.equal(options.pack, pack.collection);
          const doc = { ...structuredClone(data), id: `result${contents.size + 1}` };
          contents.set(doc.id, doc); return doc;
        } }
      };
      game.packs.set(pack.collection, pack); return pack;
    }
  };
  globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), async create(data) { await tick(); chat.push(data); return data; } };
  globalThis.fromUuid = async uuid => docs.get(uuid);
  hero = actor("hero", [player.id]); companion = actor("companion", [other.id]);
  party = actor("party", [player.id, other.id]); party.type = `${MODULE_ID}.party`;
  party.system = { members: [hero.id, companion.id], expedition: { active: true, day: 1, dayState: {} } };
  for (const doc of [party, hero, companion]) game.actors.set(doc.id, doc);
  const ids = { ruins:"WHGv7lMW9JjOic9b", encounters:"3JXvQNXAGx48h0dA", enemies:"dBCs4ljcMtcc8PCq", terrain:"2QLKnXBZdvEcRNI1" };
  game.tables = new Collection(Object.entries(ids).map(([slot,id]) => [id,nativeRollTableFixture({id,name:slot})]));
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
  await assert.rejects(feed(player), /designated GM/);
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
  await assert.rejects(feed(trusted), /party is not owned/);
  hero.testUserPermission = user => user.isGM || user.id === trusted.id;
  assert.equal((await feed(trusted, [hero.id], "personal")).status, "fed");
});

test("two feeding requests for the same member debit exactly one ration", async () => {
  const result = await Promise.all([feed(player), feed(other)]);
  assert.deepEqual(result.map(r => r.status), ["fed", "alreadyFed"]);
  assert.equal(RationService.getState(party).totalUsesRemaining, 6);
  assert.equal(party.system.expedition.dayState.rations.hero.source, "group");
  assert.deepEqual(party.flags[MODULE_ID].expedition.dayState.rations, party.system.expedition.dayState.rations);
});

test("overlapping single-member and feed-all requests debit only members still unfed", async () => {
  const results = await Promise.all([feed(player), feed(gm2, [hero.id, companion.id])]);
  assert.deepEqual(results.map(r => r.count), [1, 1]);
  assert.equal(RationService.getState(party).totalUsesRemaining, 5);
  assert.equal(party.system.expedition.dayState.rations.companion.fed, true);
});

test("duplicate member IDs are counted once and unknown members cannot be fed", async () => {
  assert.equal((await feed(player, [hero.id, hero.id])).count, 1);
  await assert.rejects(feed(player, ["outsider"]), /not an expedition member/);
  assert.equal(RationService.getState(party).totalUsesRemaining, 6);
});

test("feeding RPC rejects invalid sources, member payloads and forged personal inventory access", async () => {
  await assert.rejects(feed(player, [hero.id], "arbitrary"), /Invalid expedition feeding request/);
  await assert.rejects(feed(player, ["hero.evil"]), /not an expedition member/);
  await assert.rejects(feed(player, ["hero[evil]"]), /Invalid expedition feeding request/);
  await assert.rejects(feed(player, [hero.id, companion.id], "personal"), /Invalid expedition feeding request/);
  await assert.rejects(feed(player, [companion.id], "personal"), /Personal provisions are not owned/);
  assert.equal(RationService.getState(companion).totalUsesRemaining, 7);
});

test("owning a character permits personal feeding without ownership of the party", async () => {
  party.testUserPermission = user => user.isGM;
  const result = await feed(player, [hero.id], "personal");
  assert.equal(result.status, "fed");
  assert.equal(RationService.getState(hero).totalUsesRemaining, 6);
  assert.equal(party.system.expedition.dayState.rations.hero.source, "personal");
  await assert.rejects(feed(player, [companion.id], "group"), /party is not owned/);
});

test("normal personal consumption is synchronized by the GM without party ownership", async () => {
  party.testUserPermission = user => user.isGM;
  assert.equal(await request("consumeRations", player, hero.uuid, null, 1), true);
  assert.equal(party.system.expedition.dayState.rations.hero.source, "personal");
});

test("insufficient shared stock never marks the entire group as fed", async () => {
  party.flags[MODULE_ID] = { rations: { usesRemaining: 1 } };
  const result = await feed(player, [hero.id, companion.id]);
  assert.equal(result.status, "insufficient");
  assert.equal(RationService.getState(party).totalUsesRemaining, 1);
  assert.equal(party.system.expedition.dayState.rations, undefined);
});

test("disabled rations cannot be consumed through the GM endpoint", async () => {
  settings.enableRations = false;
  assert.equal(await request("consumeRations", player, hero.uuid, null, 1), false);
  assert.equal((await feed(player)).status, "insufficient");
  assert.equal(RationService.getState(party).totalUsesRemaining, 7);
});

test("stale requests are rejected, including a restarted expedition with the same day number", async () => {
  const oldKey = expeditionDayKey(party);
  assert.equal(await PartyActorService.setExpeditionDay(party, 1, true), true);
  assert.notEqual(expeditionDayKey(party), oldKey);
  assert.equal((await feed(player, [hero.id], "group", oldKey)).status, "stale");
  assert.equal(RationService.getState(party).totalUsesRemaining, 7);
});

test("day changes wait for an in-progress group feed and old queued requests do not affect the new day", async () => {
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const originalSetFlag = party.setFlag;
  party.setFlag = async function (...args) {
    entered(); await new Promise(resolve => { release = resolve; });
    return originalSetFlag.apply(this, args);
  };
  const oldKey = expeditionDayKey(party);
  const feeding = feed(player);
  await started;
  const nextDay = PartyActorService.setExpeditionDay(party, 2, true, oldKey);
  const lateFeed = feed(other, [companion.id], "group", oldKey);
  release();
  assert.equal((await feeding).status, "fed");
  assert.equal(await nextDay, true);
  assert.equal((await lateFeed).status, "stale");
  assert.equal(party.system.expedition.day, 2);
  assert.deepEqual(party.system.expedition.dayState.rations, {});
  assert.equal(RationService.getState(party).totalUsesRemaining, 6);
});

test("a direct personal consumption started on an old day is not recorded on the new day", async () => {
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  ChatMessage.create = () => { entered(); return new Promise(resolve => { release = resolve; }); };
  const consumption = request("consumeRations", player, hero.uuid, null, 1);
  await started;
  await PartyActorService.setExpeditionDay(party, 2, true);
  release({});
  assert.equal(await consumption, true);
  assert.deepEqual(party.system.expedition.dayState.rations, {});
});

test("day update RPC enforces ownership and rejects stale or invalid updates", async () => {
  const key = expeditionDayKey(party);
  party.testUserPermission = user => user.isGM;
  await assert.rejects(request("setExpeditionDay", player, party.uuid, 2, true, key), /not owned/);
  await assert.rejects(request("setExpeditionDay", gm2, party.uuid, -1, true, key), /Invalid expedition day/);
  assert.equal(await request("setExpeditionDay", gm2, party.uuid, 2, true, key), true);
  assert.equal(await request("setExpeditionDay", gm2, party.uuid, 3, true, key), false);
});

test("without a GM, personal inventory still works and unauthorized party writes are skipped", async () => {
  game.users.activeGM = null; game.user = player;
  party.testUserPermission = user => user.isGM;
  assert.equal(await RationService.consumeDay(hero), true);
  assert.equal(RationService.getState(hero).totalUsesRemaining, 6);
  assert.equal(party.system.expedition.dayState.rations, undefined);
  await assert.rejects(RationService.feedExpedition(party, [hero.id], "personal"), /No authorized executor/);
  assert.equal(RationService.getState(hero).totalUsesRemaining, 6);
});

test("without a GM, an owner can feed from the group with local serialization", async () => {
  game.users.activeGM = null; game.user = player;
  const results = await Promise.all([
    RationService.feedExpedition(party, [hero.id]), RationService.feedExpedition(party, [hero.id])
  ]);
  assert.deepEqual(results.map(result => result.status), ["fed", "alreadyFed"]);
  assert.equal(RationService.getState(party).totalUsesRemaining, 6);
});

test("one failed party synchronization does not prevent synchronization of another party", async () => {
  const second = actor("party2"); second.type = party.type;
  second.system = structuredClone(party.system); game.actors.set(second.id, second);
  party.update = async () => { throw new Error("party write failed"); };
  const warn = console.warn; console.warn = () => {};
  try {
    assert.equal(await request("consumeRations", player, hero.uuid, null, 1), true);
    assert.equal(second.system.expedition.dayState.rations.hero.fed, true);
  } finally { console.warn = warn; }
});

test("chat publication failure does not turn a completed consumption into a retryable failure", async () => {
  ChatMessage.create = async () => { throw new Error("chat write failed"); };
  const warn = console.warn; console.warn = () => {};
  try {
    assert.equal((await feed(player)).status, "fed");
    assert.equal((await feed(player)).status, "alreadyFed");
    assert.equal(RationService.getState(party).totalUsesRemaining, 6);
  } finally { console.warn = warn; }
});

function orientation(user = player, mode = "publicroll", expected = expeditionOrientationKey(party), dayKey = expeditionDayKey(party)) {
  return request("rollExpeditionOrientation", user, party.uuid, dayKey, mode, expected);
}
function prepareGuide() {
  party.system.expedition.guideId = hero.id;
  hero.system.attributes = { vigilant: { total: 15 } };
  globalThis.Roll = class {
    constructor(formula) { this.formula = formula; this.total = 10; }
    async evaluate() { return this; }
  };
}

test("orientation cannot use an old guide when private storage creation changes the party guide", async () => {
  prepareForestGuide(2,"wild");
  const create=CompendiumCollection.createCompendium;
  CompendiumCollection.createCompendium=async metadata => {
    const pack=await create(metadata);
    party.system.expedition.guideId=companion.id;
    return pack;
  };
  assert.equal((await orientation(player,"blindroll")).status,"stale");
  assert.equal(chat.length,0);
  assert.equal(party.system.expedition.dayState.orientation,undefined);
});

test("orientation prepared under an old group composition is rejected before publication", async () => {
  prepareForestGuide(2,"wild");
  game.symbaroum={api:{async baseRoll() {
    party.system.companions=["removed-companion"];
    const roll=new Roll("1d20");roll.total=10;
    return {diceResult:10,diceTarget:15,hasSucceed:true,rolls:[roll]};
  }}};
  assert.equal((await orientation()).status,"stale");
  assert.equal(chat.length,0);
  assert.equal(party.system.expedition.dayState.orientation,undefined);
});

test("guide owner rolls through the GM without ownership of the party", async () => {
  prepareGuide(); party.testUserPermission = user => user.isGM;
  assert.equal((await orientation()).status, "rolled");
  assert.equal(party.system.expedition.dayState.orientation.target, 15);
  assert.equal(party.system.expedition.dayState.orientation.rollTotal, 10);
  assert.equal(chat[0].user, player.id);
  assert.deepEqual(chat[0].whisper, []);
  await assert.rejects(request("resetExpeditionOrientation", player, party.uuid, expeditionDayKey(party)), /not owned/);
});

test("orientation validates sender, executor, permissions and roll mode before rolling", async () => {
  prepareGuide(); party.testUserPermission = user => user.isGM;
  await assert.rejects(orientation(other), /not owned/);
  await assert.rejects(orientation(player, "invalid"), /Invalid orientation request/);
  player.active = false;
  await assert.rejects(orientation(), /authenticated active user/);
  player.active = true; game.user = gm2;
  await assert.rejects(orientation(), /designated GM/);
  assert.equal(chat.length, 0);
});

test("orientation does not fall back to a world actor when the configured guide UUID is missing", async () => {
  prepareGuide(); party.system.expedition.guideUuid = "Compendium.removed.actors.hero";
  await assert.rejects(orientation(), /guide not found/);
  assert.equal(chat.length, 0);
});

test("overlapping orientation requests produce one roll while deliberate rerolls remain available", async () => {
  prepareGuide();
  const results = await Promise.all([orientation(), orientation(other)]);
  assert.deepEqual(results.map(r => r.status), ["rolled", "stale"]);
  assert.equal(chat.length, 1);
  const first = party.system.expedition.dayState.orientation.revision;
  assert.equal((await orientation()).status, "rolled");
  assert.equal(chat.length, 2);
  assert.notEqual(party.system.expedition.dayState.orientation.revision, first);
});

test("day changes wait for orientation, then clear its result", async () => {
  prepareGuide();
  let release, started;
  const start = new Promise(resolve => { started = resolve; });
  ChatMessage.create = async data => { started(); await new Promise(resolve => { release = resolve; }); return data; };
  const pending = orientation(); await start;
  const next = PartyActorService.setExpeditionDay(party, 2, true);
  await tick(); assert.equal(party.system.expedition.day, 1);
  release(); await pending; await next;
  assert.equal(party.system.expedition.dayState.orientation, null);
});

test("a guide changed during animation cannot write orientation for the new guide", async () => {
  prepareGuide();
  ChatMessage.create = async data => { party.system.expedition.guideId = companion.id; return data; };
  assert.equal((await orientation()).status, "stale");
  assert.equal(party.system.expedition.dayState.orientation, undefined);
});

for (const mode of ["publicroll", "gmroll", "blindroll", "selfroll"]) {
  test(`remote orientation preserves ${mode} author and 3D dice recipients`, async () => {
    prepareGuide(); const animations = [];
    game.dice3d = { showForRoll: async (...args) => animations.push(args) };
    await orientation(player, mode);
    const expected = mode === "publicroll" ? [] : mode === "selfroll" ? [player.id] : [gm.id, gm2.id];
    assert.deepEqual(chat[0].whisper, expected);
    assert.equal(chat[0].user, player.id);
    assert.equal(chat[0].blind, mode === "blindroll");
    assert.equal(chat[0].rolls.length, 1);
    assert.equal(animations[0][1], player);
    assert.deepEqual(animations[0][3], expected.length ? expected : null);
  });
}

test("remote mishaps retain the requester in self rolls and fall back without publishing a public draw", async () => {
  let fallback = 0, published;
  const roll = { total: 12 };
  const table = {
    async draw(options) { assert.equal(options.displayChat, false); throw new Error("draw unavailable"); },
    async roll() { fallback++; return { roll, results: [{ text: "Mishap" }] }; },
    async toMessage(results, options) { published = { results, options }; return published; }
  };
  await drawMishapTable(table, roll, { rollMode: "selfroll", rollUser: player });
  assert.equal(fallback, 1);
  assert.equal(published.options.messageData.user, player.id);
  assert.deepEqual(published.options.messageData.whisper, [player.id]);
  assert.equal(published.options.messageOptions.rollMode, "gmroll", "core preserves explicit recipients in gmroll");
  await drawMishapTable(table, roll, { rollMode: "blindroll", rollUser: player });
  assert.equal(published.options.messageData.blind, true);
  assert.deepEqual(published.options.messageData.whisper, [gm.id, gm2.id]);
});

test("without a GM, guide ownership cannot elevate party writes", async () => {
  prepareGuide(); game.users.activeGM = null; game.user = player;
  party.testUserPermission = user => user.isGM;
  await assert.rejects(PartyActorService.rollOrientation(party), /No authorized executor/);
  assert.equal(chat.length, 0);
});

test("two synthetic actors sharing a base ID retain distinct feeding states", async () => {
  const synthetic = [];
  for (const token of ["one", "two"]) {
    const member = actor(hero.id, [player.id]);
    member.uuid = `Scene.scene.Token.${token}.Actor.${hero.id}`;
    docs.set(member.uuid, member); synthetic.push(member);
  }
  party.system.members = synthetic.map(actorReference);
  assert.equal((await feed(player, party.system.members)).count, 2);
  const state = party.system.expedition.dayState.rations;
  assert.equal(state[actorStateKey(synthetic[0])].fed, true);
  assert.equal(state[actorStateKey(synthetic[1])].fed, true);
  assert.equal(state.Scene, undefined, "UUID dots must not become nested update paths");
  await assert.rejects(feed(player, [hero.id]), /not an expedition member/);
});

test("an ID and UUID alias of the same world member consume only one ration", async () => {
  assert.equal((await feed(player, [hero.id, hero.uuid])).count, 1);
  assert.equal(RationService.getTotalUses(party), 6);
});

test("compendium members can use group stock without modifying their inventory", async () => {
  const member = actor("archer", [player.id]); member.pack = "example.actors";
  member.uuid = "Compendium.example.actors.archer"; docs.set(member.uuid, member);
  party.system.members = [member.uuid]; bread(member);
  assert.equal((await feed(player, [member.uuid])).count, 1);
  await assert.rejects(feed(player, [member.uuid], "personal"), /Compendium provisions/);
  assert.equal(RationService.getTotalUses(member), 7);
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


async function readExpeditionFor(user) {
  const { expeditionReadKey, openExpeditionRead } = await import("../scripts/expedition-private.mjs");
  const keys = await expeditionReadKey();
  const day = expeditionDayKey(party);
  const envelope = await request("readExpeditionResults", user, party.uuid, day, keys.publicKey);
  return { envelope, data: await openExpeditionRead(envelope, keys.privateKey, JSON.stringify([party.uuid, day, user.id])) };
}
function prepareForestGuide(level = 1, region = "bright") {
  prepareGuide();
  party.system.location = { region };
  if (level) hero.items.set("mateiro", { type: "boon", name: "Mateiro", system: { level } });
}

test("no Bushcraft in Davokar is rejected before dice, chat or storage writes", async () => {
  prepareForestGuide(0);
  assert.equal((await orientation()).status, "ineligible");
  assert.equal(chat.length, 0);
  assert.equal(game.packs.size, 0);
  assert.equal(party.system.expedition.dayState.orientation, undefined);
});

test("wild orientation failure rolls the separate +5 mishap through the selected table exactly once", async () => {
  prepareForestGuide(2,"wild");
  let draws=0;
  const table={id:"mishaps",async draw({roll,displayChat}) {
    draws++;assert.equal(roll.formula,"1d20 + 5");assert.equal(displayChat,false);
    return {roll,results:[{text:"An incident"}]};
  },async toMessage(results,options) { return {results,...options}; }};
  game.tables=new Collection([[table.id,table]]);
  party.system.expedition.tables={mishaps:table.id};
  game.symbaroum={api:{async baseRoll(_actor,attribute,_a,_b,favour,modifier) {
    assert.equal(attribute,"vigilant");assert.equal(favour,0);assert.equal(modifier,0);
    const roll=new Roll("1d20");roll.total=17;
    return {diceResult:17,diceTarget:15,hasSucceed:false,rolls:[roll]};
  }}};
  assert.equal((await orientation()).status,"rolled");
  assert.equal(draws,1);
  assert.equal(party.system.expedition.dayState.orientation.rollTotal,17);
  assert.equal(party.system.expedition.dayState.orientation.target,15);
  assert.equal(party.system.expedition.dayState.orientation.mishap,true);
  assert.equal(party.system.expedition.dayState.orientation.ruinsMod,0);
});

test("underqualified guide avoids mishap without event benefits", async () => {
  prepareForestGuide(1, "wild");
  assert.equal((await orientation()).status, "rolled");
  const state = party.system.expedition.dayState.orientation;
  assert.equal(state.target, 12);
  assert.equal(state.verdict, "avoidedMishap");
  assert.equal(state.ruinsMod, 0);
  assert.equal(state.enemiesMod, 0);
  assert.equal(state.neutralDetection, false);
  assert.match(chat[0].content, /Infortúnio evitado/);
  assert.doesNotMatch(chat[0].content, /bonus-tag/);
});

for (const mode of ["gmroll", "blindroll", "selfroll"]) {
  test(`private ${mode} storage replaces legacy fields and filters every reader`, async () => {
    prepareForestGuide();
    const legacy = { rolled: true, rollTotal: 7, target: 16, verdict: "success", ruinsMod: 2, margin: 9 };
    party.system.expedition.dayState.orientation = structuredClone(legacy);
    party.flags[MODULE_ID] = { expedition: { dayState: { orientation: structuredClone(legacy) } } };
    await orientation(player, mode);
    for (const state of [party.system.expedition.dayState.orientation, party.flags[MODULE_ID].expedition.dayState.orientation]) {
      assert.equal(state.restricted, true);
      for (const key of ["rollTotal", "target", "verdict", "ruinsMod", "margin", "context", "visibility"]) assert.equal(key in state, false);
    }
    const pack = [...game.packs.values()][0];
    assert.equal(pack.ownership.PLAYER, "NONE");
    assert.equal(pack.ownership.TRUSTED, "NONE");
    const gmRead = await readExpeditionFor(gm);
    assert.equal(gmRead.data.orientation.rollTotal, 10);
    const authorRead = await readExpeditionFor(player);
    assert.equal(authorRead.data.orientation.rollTotal, mode === "blindroll" ? undefined : 10);
    assert.deepEqual((await readExpeditionFor(other)).data.orientation, { rolled: true, restricted: true });
    assert.doesNotMatch(JSON.stringify(gmRead.envelope), /rollTotal|verdict|greatSuccess|target/);
  });
}

test("private snapshots survive a sheet reopen and cannot be substituted across groups or days", async () => {
  prepareForestGuide();
  await orientation(player, "blindroll");
  assert.equal((await PartyActorService.visibleExpedition(party)).dayState.orientation.rollTotal, 10);
  const reference = party.system.expedition.dayState.orientation;
  const { readPrivateExpeditionResult } = await import("../scripts/expedition-private.mjs");
  assert.equal(await readPrivateExpeditionResult(reference, { ...party, uuid: "Actor.different" }, "orientation"), null);
  assert.equal(await readPrivateExpeditionResult(reference, party, "ruins"), null);
  party.system.expedition.day++;
  assert.equal(await readPrivateExpeditionResult(reference, party, "orientation"), null);
});

test("private results fail closed without a GM, missing storage, or changed pack permissions", async () => {
  prepareForestGuide();
  game.users.activeGM = null; game.user = player;
  await assert.rejects(PartyActorService.rollOrientation(party, undefined, "selfroll"), /requires a GM/);
  assert.equal(chat.length, 0);
  game.user = gm; game.users.activeGM = gm;
  await orientation(player, "blindroll");
  const pack = [...game.packs.values()][0];
  pack.ownership = { ...pack.ownership, TRUSTED: "OBSERVER" };
  await assert.rejects(readExpeditionFor(player), /permissions have changed/);
  game.packs.clear();
  assert.deepEqual((await readExpeditionFor(player)).data.orientation, { rolled: true, restricted: true });
});

test("private event results inherit orientation recipients and never persist text or formulas on party", async () => {
  prepareForestGuide();
  await orientation(player, "blindroll");
  await request("rollExpeditionEvents", other, party.uuid, expeditionDayKey(party), expeditionOrientationKey(party), ["enemies"], "publicroll", expeditionEventKey(party, ["enemies"]));
  const marker = party.system.expedition.dayState.events.enemies;
  assert.equal(marker.restricted, true);
  assert.equal(marker.formula, undefined);
  assert.equal(marker.resultText, undefined);
  const message = chat.at(-1);
  assert.equal(message.blind, true);
  assert.deepEqual(message.whisper, [gm.id, gm2.id]);
  const result = await readExpeditionFor(gm);
  assert.equal(result.data.events.enemies.formula, "(1d20) - 2");
  assert.equal((await readExpeditionFor(player)).data.events.enemies.formula, undefined);
  assert.equal((await readExpeditionFor(other)).data.events.enemies.formula, undefined);
});

for (const mutation of [
  () => { party.system.location.region = "dark"; },
  () => { party.system.expedition.tables = { mishaps: "RollTable.changed" }; },
  () => { hero.system.attributes.vigilant.total = 20; },
  () => { settings.alwaysSucceedOnOne = true; }
]) {
  test("orientation discards a result when region, configuration, attribute or native option changes during animation", async () => {
    prepareForestGuide();
    ChatMessage.create = async data => { mutation(); return data; };
    assert.equal((await orientation()).status, "stale");
    assert.equal(party.system.expedition.dayState.orientation, undefined);
  });
}

test("private reads reject unrelated observers and event sockets reject arbitrary slots", async () => {
  prepareForestGuide(); await orientation(player, "selfroll");
  party.testUserPermission = user => user.isGM;
  await assert.rejects(readExpeditionFor(other), /not observable/);
  await assert.rejects(request("rollExpeditionEvents", player, party.uuid, expeditionDayKey(party), expeditionOrientationKey(party), ["__proto__"], "publicroll"), /not owned/);
  await assert.rejects(request("rollExpeditionEvents", gm, party.uuid, expeditionDayKey(party), expeditionOrientationKey(party), ["__proto__"], "publicroll"), /Invalid expedition event request/);
});


for (const generation of [13,14]) test(`ration menu v${generation} reuses feeding and undo with live stock, permissions and fed-state checks`, async () => {
  game.release={generation};
  const previous=foundry.applications;
  let registrations=0,entries,options,selector;
  foundry.applications={ux:{ContextMenu:class {constructor(_root,s,e,o){registrations++;selector=s;entries=e;options=o;}}}};
  const sheet=Object.create(PartyActorSheet.prototype);sheet.actor=party;sheet.render=()=>{};
  Object.defineProperty(sheet,"isEditable",{value:true,configurable:true});
  sheet._resolveActor=ref=>game.actors.get(ref);
  const calls=[];
  sheet._onFeedMemberGroup=async id=>calls.push(["group",id]);
  sheet._onFeedMemberPersonal=async id=>calls.push(["personal",id]);
  sheet._onToggleFeedMember=async id=>calls.push(["undo",id]);
  const row={dataset:{memberId:hero.id}},root={};
  const visible=entry=>generation>=14?entry.visible(row):entry.condition(row);
  const click=entry=>generation>=14?entry.onClick(null,row):entry.callback([row]);
  try {
    sheet._bindRationContextMenu(root);sheet._bindRationContextMenu(root);
    assert.equal(registrations,1);assert.equal(selector,".party-ration-member-row[data-member-id]");
    assert.equal(options.fixed,true);assert.equal(options.jQuery,false);
    assert.equal(visible(entries[0]),true);assert.equal(visible(entries[1]),true);assert.equal(visible(entries[2]),false);
    await click(entries[0]);await click(entries[1]);assert.deepEqual(calls,[["group",hero.id],["personal",hero.id]]);
    party.items.clear();hero.items.clear();
    assert.equal(visible(entries[0]),false);assert.equal(visible(entries[1]),false);
    await click(entries[0]);await click(entries[1]);assert.equal(calls.length,2,"stock disappearing after opening must not invoke feeding");
    party.system.expedition.dayState.rations={hero:{fed:true,source:"group"}};
    assert.equal(visible(entries[2]),true);await click(entries[2]);assert.deepEqual(calls.at(-1),["undo",hero.id]);
    Object.defineProperty(sheet,"isEditable",{value:false,configurable:true});
    assert.equal(visible(entries[2]),false);await click(entries[2]);assert.equal(calls.length,3);
    sheet._bindRationContextMenu({});assert.equal(registrations,1,"read-only sheets do not register feeding menus");
  } finally { foundry.applications=previous; }
});

test("ration menu hides personal consumption for compendium templates and when the expedition is inactive", () => {
  const previous=foundry.applications;let entries;
  foundry.applications={ux:{ContextMenu:class {constructor(_root,_selector,e){entries=e;}}}};
  game.release={generation:13};
  const sheet=Object.create(PartyActorSheet.prototype);sheet.actor=party;
  Object.defineProperty(sheet,"isEditable",{value:true});sheet._resolveActor=()=>hero;
  const row={dataset:{memberId:hero.id}};
  try {
    sheet._bindRationContextMenu({});hero.pack="world.templates";
    assert.equal(entries[1].condition(row),false);
    party.system.expedition.active=false;
    assert.equal(entries.some(e=>e.condition(row)),false);
  } finally { foundry.applications=previous; }
});

test("ration menu feeds through the authoritative service once and retains the existing undo behavior", async () => {
  const previous=foundry.applications;let entries;
  foundry.applications={ux:{ContextMenu:class {constructor(_root,_selector,e){entries=e;}}}};
  game.release={generation:13};
  const sheet=Object.create(PartyActorSheet.prototype);sheet.actor=party;sheet.render=()=>{};
  Object.defineProperty(sheet,"isEditable",{value:true});sheet._resolveActor=ref=>game.actors.get(ref);
  const row={dataset:{memberId:hero.id}};
  try {
    sheet._bindRationContextMenu({});
    await entries[0].callback(row);await entries[0].callback(row);
    assert.equal(RationService.getTotalUses(party),6);
    assert.equal(RationService.getTotalUses(hero),7);
    assert.equal(party.system.expedition.dayState.rations.hero.source,"group");
    assert.equal(entries[0].condition(row),false);assert.equal(entries[1].condition(row),false);
    await entries[2].callback(row);
    assert.equal(RationService.getTotalUses(party),6,"undo does not refund food, matching the existing action");
    await entries[1].callback(row);
    assert.equal(RationService.getTotalUses(hero),6);
    assert.equal(party.system.expedition.dayState.rations.hero.source,"personal");
  } finally { foundry.applications=previous; }
});

function modifierSheet(value) {
  const input={value,disabled:false,setCustomValidity(){},reportValidity(){},focus(){}};
  const sheet=Object.create(PartyActorSheet.prototype);sheet.actor=party;sheet.render=()=>{};
  Object.defineProperty(sheet,"element",{value:{querySelector:selector=>selector==='[data-orientation-modifier]'?input:null}});
  return {sheet,input};
}

test("the standard orientation button reads signed modifiers from the inline field without a dialog", async () => {
  prepareForestGuide(2,"wild");
  const {sheet,input}=modifierSheet("+1");
  for (const [value,target] of [["+1",16],["-2",13],["",15]]) {
    input.value=value;
    await sheet._onRollOrientation();
    const result=party.system.expedition.dayState.orientation;
    assert.equal(result.target,target);
    assert.equal(result.context.circumstanceModifier,target-15);
    assert.equal(input.disabled,false);
    assert.equal(sheet._getOrientationModifierDraft(),value||"0");
  }
});

test("inline orientation modifiers reject invalid text before rolling or persisting", async () => {
  prepareForestGuide(2,"wild");
  const {sheet,input}=modifierSheet("");
  for(const value of ["+","-","1.5","1e1","21","-21","1+2","texto"]) {
    input.value=value;await sheet._onRollOrientation();
    assert.equal(party.system.expedition.dayState.orientation,undefined);
    assert.equal(chat.length,0);assert.equal(input.disabled,false);
  }
});

test("a player's forged inline modifier is ignored before the orientation request is routed", async () => {
  prepareForestGuide(2,"wild");game.user=player;
  const {sheet}=modifierSheet("+10");
  await sheet._onRollOrientation();
  assert.equal(routed.at(-1)[0],"rollExpeditionOrientation");
  assert.equal(routed.at(-1).at(-1),0);
});

test("the inline modifier draft survives renders but resets when the day, guide or region changes", () => {
  prepareForestGuide(2,"wild");
  const {sheet}=modifierSheet("+2");
  assert.equal(sheet._getOrientationModifierDraft(),"0");
  sheet._orientationModifierDraft="+2";
  assert.equal(sheet._getOrientationModifierDraft(),"+2");
  party.system.expedition.day++;
  assert.equal(sheet._getOrientationModifierDraft(),"0");
  sheet._orientationModifierDraft="-2";party.system.expedition.guideId=companion.id;
  assert.equal(sheet._getOrientationModifierDraft(),"0");
  sheet._orientationModifierDraft="+1";party.system.location.region="dark";
  assert.equal(sheet._getOrientationModifierDraft(),"0");
});

test("circumstance modifiers are bounded, GM-only, recorded and applied once", async () => {
  prepareForestGuide();
  const args = [party.uuid, expeditionDayKey(party), "publicroll", expeditionOrientationKey(party)];
  await assert.rejects(request("rollExpeditionOrientation", player, ...args, 1), /Invalid orientation modifier/);
  await assert.rejects(request("rollExpeditionOrientation", gm, ...args, 1.5), /Invalid orientation modifier/);
  await assert.rejects(request("rollExpeditionOrientation", gm, ...args, 21), /Invalid orientation modifier/);
  assert.equal((await request("rollExpeditionOrientation", gm, ...args, 2)).status, "rolled");
  assert.equal(party.system.expedition.dayState.orientation.target, 17);
  assert.equal(party.system.expedition.dayState.orientation.context.circumstanceModifier, 2);
});

test("overlapping event requests roll once and stale resets cannot erase the new result", async () => {
  prepareForestGuide();
  const slots = ["enemies"];
  const day = expeditionDayKey(party), expected = expeditionEventKey(party, slots);
  const args = [party.uuid, day, expeditionOrientationKey(party), slots, "publicroll", expected];
  const results = await Promise.all([request("rollExpeditionEvents", player, ...args), request("rollExpeditionEvents", other, ...args)]);
  assert.deepEqual(results.map(r => r.status), ["rolled", "stale"]);
  assert.equal(chat.length, 1);
  assert.equal(await request("resetExpeditionEvent", player, party.uuid, day, "enemies", expected), false);
  assert.equal(await request("resetExpeditionEvent", player, party.uuid, day, "enemies", expeditionEventKey(party, slots)), true);
  assert.equal(party.system.expedition.dayState.events.enemies, undefined);
});


test("a guide deleted during animation cannot leave an orientation result", async () => {
  prepareForestGuide();
  ChatMessage.create = async data => { game.actors.delete(hero.id); return data; };
  assert.equal((await orientation()).status, "stale");
  assert.equal(party.system.expedition.dayState.orientation, undefined);
});

test("blind missing-mishap warning retains a Roll so the core also hides it from the author", async () => {
  prepareForestGuide(); hero.system.attributes.vigilant.total = 5;
  game.tables = [];
  await orientation(player, "blindroll");
  const warning = chat.find(m => m.flags?.[MODULE_ID]?.missingTable);
  assert.ok(warning);
  assert.equal(warning.blind, true);
  assert.equal(warning.user, player.id);
  assert.equal(warning.rolls.length, 1);
});

test("private storage never changes existing pack permissions or falls back to shared results on failure", async () => {
  prepareForestGuide();
  const { ensureExpeditionPrivateStorage } = await import("../scripts/expedition-private.mjs");
  await ensureExpeditionPrivateStorage();
  const pack = [...game.packs.values()][0];
  pack.ownership = { ...pack.ownership, PLAYER: "OBSERVER" };
  await assert.rejects(orientation(player, "blindroll"), /permissions have changed/);
  assert.equal(pack.ownership.PLAYER, "OBSERVER");
  assert.equal(chat.length, 0);
  pack.ownership.PLAYER = "NONE";
  pack.documentClass.create = async () => { throw new Error("storage unavailable"); };
  await assert.rejects(orientation(player, "blindroll"), /storage unavailable/);
  assert.equal(party.system.expedition.dayState.orientation, undefined);
  assert.equal(party.flags[MODULE_ID]?.expedition?.dayState?.orientation, undefined);
});

test("public events remain available to the party owner without an active GM", async () => {
  prepareForestGuide(); game.user = player; game.users.activeGM = null;
  assert.equal((await PartyActorService.rollEvents(party, ["terrain"], "publicroll")).status, "rolled");
  assert.equal(chat[0].author, player.id);
  assert.equal(game.packs.size, 0);
  assert.equal(party.system.expedition.dayState.events.terrain.formula, "1d20");
});

for (const mode of ["publicroll", "gmroll", "blindroll", "selfroll"]) {
  test(`native table messages preserve ${mode} author and recipients through the GM executor`, async () => {
    prepareForestGuide();
    const slots = ["ruins", "enemies"];
    await request("rollExpeditionEvents", player, party.uuid, expeditionDayKey(party), expeditionOrientationKey(party), slots, mode, expeditionEventKey(party, slots));
    assert.equal(chat.length,2);
    const recipients = mode === "publicroll" ? [] : mode === "selfroll" ? [player.id] : [gm.id,gm2.id];
    for (const message of chat) {
      assert.equal(message.author,player.id);
      assert.deepEqual(message.whisper,recipients);
      assert.equal(message.blind,mode === "blindroll");
      assert.ok(message.flags["core.RollTable"]);
      assert.doesNotMatch(message.content,/tenebre-events/);
    }
    for (const slot of slots) {
      const table=game.tables.get(OFFICIAL_DAVOKAR_EVENT_TABLE_IDS[slot]);
      assert.equal(table.calls.roll.length,1);
      assert.equal(table.calls.draw.length,1);
      assert.equal(table.calls.draw[0].displayChat,false);
      assert.equal(table.calls.draw[0].roll,table.calls.toMessage[0].options.roll);
      assert.equal(table.calls.toMessage[0].options.messageOptions.rollMode,mode === "selfroll" ? "gmroll" : mode);
      assert.equal(Boolean(party.system.expedition.dayState.events[slot].restricted),mode !== "publicroll");
    }
  });
}

test("the native draw uses the explicitly selected table formula and preserves its result documents", async () => {
  prepareForestGuide(2,"wild");
  const table=installEventTable({_id:"custom",name:"Minha tabela",formula:"1d100",replacement:false,
    results:[{range:[1,100],description:'<strong>Evento:</strong> @UUID[Item.example]{Objeto} [[1d6]]'}]});
  party.system.expedition.tables={enemies:table.id};
  await PartyActorService.rollEvents(party,["enemies"],"publicroll");
  assert.equal(table.calls.roll[0].roll.formula,"min(max((1d100) + 2, 1), 100)");
  assert.equal(table.calls.toMessage[0].results[0],table.results.get("0"));
  assert.match(table.calls.toMessage[0].results[0].description,/@UUID.*\[\[1d6\]\]/);
  assert.equal(table.results.get("0").drawn,true);
  assert.equal(party.system.expedition.dayState.events.enemies.tableName,table.name);
  assert.equal(chat[0].flags["core.RollTable"],table.id);
});

test("missing configured tables abort before any native rolls or replacement messages", async () => {
  prepareForestGuide();
  party.system.expedition.tables={enemies:"removed"};
  await assert.rejects(PartyActorService.rollEvents(party,["ruins","enemies"],"publicroll"),/EventMissingTable/);
  assert.equal(chat.length,0);
  assert.equal(game.tables.get(OFFICIAL_DAVOKAR_EVENT_TABLE_IDS.ruins).calls.roll.length,0);
  assert.equal(party.system.expedition.dayState.events,undefined);
});

test("a changed day during native table rolling prevents draw, publication and day-state writes", async () => {
  prepareForestGuide();
  const table=game.tables.get(OFFICIAL_DAVOKAR_EVENT_TABLE_IDS.enemies), roll=table.roll;
  table.roll=async options=>{const result=await roll.call(table,options);party.system.expedition.day++;return result;};
  assert.equal((await PartyActorService.rollEvents(party,["enemies"],"publicroll")).status,"stale");
  assert.equal(table.calls.draw.length,0);
  assert.equal(chat.length,0);
  assert.equal(party.system.expedition.dayState.events,undefined);
});

test("a later native publication failure keeps earlier results recorded and blocks replay of the same request", async () => {
  prepareForestGuide();
  const slots=["ruins","enemies"];
  const args=[party.uuid,expeditionDayKey(party),expeditionOrientationKey(party),slots,"publicroll",expeditionEventKey(party,slots)];
  game.tables.get(OFFICIAL_DAVOKAR_EVENT_TABLE_IDS.enemies).toMessage=async()=>{throw new Error("native publication failed");};
  await assert.rejects(request("rollExpeditionEvents",player,...args),/native publication failed/);
  assert.equal(chat.length,1);
  assert.equal(party.system.expedition.dayState.events.ruins.rolled,true);
  assert.equal(party.system.expedition.dayState.events.enemies,undefined);
  assert.equal((await request("rollExpeditionEvents",player,...args)).status,"stale");
  assert.equal(chat.length,1);
});

test("private storage failures abort native table publication instead of leaking a public result", async () => {
  prepareForestGuide();
  const {ensureExpeditionPrivateStorage}=await import("../scripts/expedition-private.mjs");
  await ensureExpeditionPrivateStorage();
  const pack=[...game.packs.values()][0];
  pack.documentClass.create=async()=>{throw new Error("protected storage failed");};
  await assert.rejects(PartyActorService.rollEvents(party,["enemies"],"blindroll"),/protected storage failed/);
  const table=game.tables.get(OFFICIAL_DAVOKAR_EVENT_TABLE_IDS.enemies);
  assert.equal(table.calls.draw.length,0);
  assert.equal(table.calls.toMessage.length,0);
  assert.equal(chat.length,0);
});


test("a day changed during native evaluation is rejected before publishing an obsolete card", async () => {
  prepareForestGuide();
  game.symbaroum = { api: { async baseRoll() {
    party.system.expedition.day++;
    return { diceTarget: 15, diceResult: 10, hasSucceed: true, rolls: [new Roll("1d20")] };
  } } };
  assert.equal((await orientation()).status, "stale");
  assert.equal(chat.length, 0);
  assert.equal(party.system.expedition.dayState.orientation, undefined);
});


const { OFFICIAL_DAVOKAR_EVENT_TABLE_IDS } = await import("../scripts/constants.mjs");
// Minimal fixtures model imported official tables, not module-generated copies.
function encounterTableFixture() {
  return { _id: OFFICIAL_DAVOKAR_EVENT_TABLE_IDS.encounters, name: "Tabela 27", results: [
    { range:[1,1], description:"Encontro de teste A" },
    { range:[2,2], description:"Encontro de teste B" },
    { range:[3,3], description:"Encontro de teste C" },
    { range:[4,20], description:"Outro encontro de teste" }
  ] };
}

function installEventTable(data) {
  const table=nativeRollTableFixture(data);
  game.tables ??= new Collection(); if (!game.tables.set) game.tables=new Collection(); game.tables.set(table.id,table); return table;
}

test("GM event choice uses an existing result and players cannot inject text or choose results", async () => {
  prepareForestGuide(); installEventTable(encounterTableFixture());
  await assert.rejects(request("rollExpeditionEvents",player,party.uuid,expeditionDayKey(party),expeditionOrientationKey(party),["encounters"],"publicroll",expeditionEventKey(party,["encounters"]),{encounters:"2"}),/Invalid manual event/);
  await PartyActorService.rollEvents(party,["encounters"],"publicroll",{encounters:"2"});
  const result=party.system.expedition.dayState.events.encounters;
  assert.equal(result.manual,true); assert.equal(result.detectionModifier,1);
  assert.equal(result.resultText,"Encontro de teste C");
  assert.equal(chat.at(-1).rolls,undefined,"manual selection must not fabricate random dice");
});

test("retired journey socket endpoints and public configuration API are absent", () => {
  for (const name of ["setExpeditionTravel", "resolveExpeditionJourney", "applyExpeditionEffort"]) assert.equal(handlers.has(name), false);
  assert.equal(PartyActorService.setTravel, undefined);
});

test("legacy staying and pace flags cannot block orientation or suppress daily event slots", async () => {
  prepareForestGuide();
  const legacy = { configured:true, activity:"stay", mode:"mortalMarch", alongRiver:true, dailyEnemiesWhileStaying:false, site:"Ruína" };
  party.flags[MODULE_ID] = { expedition:{travel:legacy} };
  assert.equal((await orientation(player,"publicroll")).status, "rolled");
  installEventTable(encounterTableFixture());
  const { journeyContextKey } = await import("../scripts/travel-context.mjs");
  const context = journeyContextKey(party), orientationKey = expeditionOrientationKey(party);
  legacy.mode="forcedRide"; legacy.alongRiver=false; legacy.site="Outro lugar";
  assert.equal(journeyContextKey(party), context);
  assert.equal(expeditionOrientationKey(party), orientationKey);
  legacy.alongRiver=true;
  assert.equal((await PartyActorService.rollEvents(party,["ruins","encounters","enemies","terrain"],"publicroll")).status,"rolled");
  assert.deepEqual(Object.keys(party.system.expedition.dayState.events).sort(),["encounters","enemies","ruins","terrain"]);
  assert.equal(party.system.expedition.dayState.events.terrain.formula,"(1d20) - 2", "Only the great orientation success applies; retired river flags add nothing");
  assert.equal(party.flags[MODULE_ID].expedition.travel, legacy, "Historical configuration is preserved, not migrated or deleted");
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
