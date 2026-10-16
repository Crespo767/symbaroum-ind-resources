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
  assert.equal(result.data.events.enemies.formula, "1d20 - 2");
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
  assert.equal(chat[0].user, player.id);
  assert.equal(game.packs.size, 0);
  assert.equal(party.system.expedition.dayState.events.terrain.formula, "1d20");
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


const { ExpeditionJourneyService } = await import("../scripts/expedition-journey.mjs");
const { partyTravelPreview, journeyContextKey, naturalRecoveryDuringJourney } = await import("../scripts/travel-context.mjs");
const { getDavokarEncountersTableData, getDavokarEnemiesTableData } = await import("../scripts/expedition-data.mjs");
function journeySetup() {
  prepareForestGuide();
  settings.enableHunger = true; settings.enableEncumbrance = true; settings.enableContainers = false;
  for (const actor of [hero,companion]) {
    actor.system.health = { toughness: { value:20,max:20 } };
    actor.system.attributes = { ...actor.system.attributes, strong:{total:10}, discreet:{total:12} };
    actor.effects=[];
  }
}
async function configureJourney(extra = {}, user = gm) {
  return request("setExpeditionTravel", user, party.uuid, expeditionDayKey(party), {
    mode:"dayMarch", activity:"travel", site:"", alongRiver:false,
    ...extra
  });
}
function nativeJourneyTest(total, callback) {
  const calls=[];
  game.symbaroum={api:{async baseRoll(actor,attribute,_target,_targetAttribute,favour,modifier) {
    calls.push({actor:actor.id,attribute,favour,modifier});
    if (callback) callback();
    const value = typeof total === "function" ? total(actor,attribute) : total;
    const target = (Number(actor.system.attributes[attribute]?.total)||0) + modifier;
    const roll=new Roll("1d20"); roll.total=value;
    return {diceTarget:target,diceResult:value,hasSucceed:value<=target,rolls:[roll]};
  }}};
  return calls;
}
async function journeyData(user = gm) { return (await readExpeditionFor(user)).data.journey; }
function installEventTable(data) {
  const table={...data,id:data._id,results:new Map(data.results.map((r,i)=>[String(i),{...r,id:String(i)}])), getResultsForRoll(total) { return [...this.results.values()].filter(r=>total>=r.range[0]&&total<=r.range[1]); }};
  game.tables ??= new Collection(); if (!game.tables.set) game.tables=new Collection(); game.tables.set(table.id,table); return table;
}

test("collective journey configuration validates ownership and stale days without trusting individual participant overrides", async () => {
  journeySetup(); party.testUserPermission=user=>user.isGM;
  await assert.rejects(configureJourney({},player),/not owned/);
  assert.equal((await configureJourney({participantRefs:["unrelated"],mounts:{hero:"unrelated"}})).status,"configured");
  assert.equal(Object.hasOwn(party.flags[MODULE_ID].expedition.travel,"participantRefs"),false);
  assert.equal(Object.hasOwn(party.flags[MODULE_ID].expedition.travel,"mounts"),false);
  assert.deepEqual(partyTravelPreview(party).profiles.map(p=>p.ref),[hero.id,companion.id]);
  assert.equal((await configureJourney()).status,"configured");
  assert.equal(party.flags[MODULE_ID].expedition.travel.configured,true);
  assert.equal(partyTravelPreview(party).rate,20);
  assert.equal(await request("setExpeditionTravel",gm,party.uuid,"old-day",{mode:"dayMarch",activity:"travel",site:"",alongRiver:false,searchRule:true,participantRefs:[hero.id]}).then(r=>r.status),"stale");
});

test("mortal effort is reviewed before damage and repeated application cannot debit twice", async () => {
  journeySetup(); await configureJourney({mode:"mortalMarch"}); nativeJourneyTest(10);
  assert.equal((await ExpeditionJourneyService.resolve(party,"effort","publicroll")).status,"rolled");
  assert.equal(hero.system.health.toughness.value,20);
  assert.equal(party.system.expedition.dayState.journey.effort.members,undefined,"even public effort keeps its authoritative calculation off the editable Actor");
  assert.equal((await journeyData()).effort.members[0].damage,1);
  assert.equal((await ExpeditionJourneyService.applyEffort(party)).status,"applied");
  assert.equal(hero.system.health.toughness.value,19);
  assert.equal(companion.system.health.toughness.value,19);
  assert.equal((await ExpeditionJourneyService.applyEffort(party)).status,"alreadyApplied");
  assert.equal(hero.system.health.toughness.value,19);
});

test("a natural 20 stays pending until the GM explicitly selects the zero-Toughness interpretation", async () => {
  journeySetup(); await configureJourney({mode:"mortalMarch"}); nativeJourneyTest(20);
  await ExpeditionJourneyService.resolve(party,"effort","blindroll");
  const before=await journeyData(); assert.equal(before.effort.members[0].mortalWound,true);
  assert.equal((await ExpeditionJourneyService.applyEffort(party)).status,"pendingWound");
  assert.equal(hero.system.health.toughness.value,20);
  assert.equal((await ExpeditionJourneyService.applyEffort(party,"zeroToughness")).status,"applied");
  assert.equal(hero.system.health.toughness.value,0);
  assert.equal(hero.system.nbrOfFailedDeathRoll,undefined);
});

test("Enduring March waives its owner's mortal test, grants a companion chance, but keeps base damage", async () => {
  journeySetup(); hero.items.set("enduring",{type:"boon",name:"Marcha Duradoura",system:{}});
  await configureJourney({mode:"mortalMarch"}); const calls=nativeJourneyTest(5);
  await ExpeditionJourneyService.resolve(party,"effort","gmroll");
  assert.equal(calls.length,1); assert.equal(calls[0].actor,companion.id); assert.equal(calls[0].favour,1);
  assert.deepEqual((await journeyData()).effort.members.map(m=>m.damage),[1,1]);
});

test("forced-march recovery permissions reach the shared rest guard only after review", async () => {
  journeySetup(); hero.items.set("enduring",{type:"boon",name:"Marcha Duradoura",system:{}});
  await configureJourney({mode:"forcedMarch"}); nativeJourneyTest(5);
  assert.equal(naturalRecoveryDuringJourney(companion),false);
  await ExpeditionJourneyService.resolve(party,"effort","publicroll");
  assert.equal(naturalRecoveryDuringJourney(companion),false);
  await ExpeditionJourneyService.applyEffort(party);
  assert.equal(naturalRecoveryDuringJourney(companion),true);
  assert.equal(naturalRecoveryDuringJourney(hero),true);
});

test("effort rejects stale health, settings changes, arbitrary public calculations and player application", async () => {
  journeySetup(); await configureJourney({mode:"mortalMarch"}); nativeJourneyTest(5);
  await ExpeditionJourneyService.resolve(party,"effort","gmroll");
  const revision=party.system.expedition.dayState.journey.effort.revision;
  await assert.rejects(request("applyExpeditionEffort",player,party.uuid,expeditionDayKey(party),revision,"manual"),/Only a GM/);
  hero.system.health.toughness.value=18;
  await assert.rejects(ExpeditionJourneyService.applyEffort(party),/health changed/);
  assert.equal(companion.system.health.toughness.value,20);
  hero.system.health.toughness.value=20; settings.alwaysSucceedOnOne=true;
  assert.equal((await ExpeditionJourneyService.applyEffort(party)).status,"stale");
  settings.alwaysSucceedOnOne=false;
  party.system.expedition.dayState.journey.effort={revision:"forged",members:[{ref:hero.id,damage:100}],context:journeyContextKey(party)};
  await assert.rejects(ExpeditionJourneyService.applyEffort(party),/Untrusted effort/);
});

test("duplicate effort requests resolve once and configuration changed during evaluation cannot persist", async () => {
  journeySetup(); await configureJourney({mode:"mortalMarch"}); nativeJourneyTest(5);
  const results=await Promise.all([ExpeditionJourneyService.resolve(party,"effort","gmroll"),ExpeditionJourneyService.resolve(party,"effort","gmroll")]);
  assert.deepEqual(results.map(r=>r.status),["rolled","stale"]);
  await configureJourney({mode:"forcedMarch"}); nativeJourneyTest(5,()=>{party.flags[MODULE_ID].expedition.travel.mode="dayMarch";});
  hero.items.set("enduring",{type:"boon",name:"Marcha Duradoura",system:{}});
  assert.equal((await ExpeditionJourneyService.resolve(party,"effort","gmroll")).status,"stale");
});

test("private effort remains hidden from other players while public authoritative effort remains readable", async () => {
  journeySetup(); await configureJourney({mode:"mortalMarch"}); nativeJourneyTest(5);
  await ExpeditionJourneyService.resolve(party,"effort","blindroll");
  assert.deepEqual((await journeyData(player)).effort,{rolled:true,restricted:true});
  assert.equal(JSON.stringify(party.system.expedition.dayState.journey.effort).includes("members"),false);
});

test("the second day at a site resolves the best Discreet and a failed test draws enemies without orientation discount", async () => {
  journeySetup(); companion.system.attributes.discreet.total=16;
  installEventTable(getDavokarEnemiesTableData());
  await configureJourney({activity:"stay",site:"Ruína"}); nativeJourneyTest(20);
  await assert.rejects(ExpeditionJourneyService.resolve(party,"stay","publicroll"),/second day/);
  party.system.expedition.day=2;
  const calls=nativeJourneyTest(20);
  await ExpeditionJourneyService.resolve(party,"stay","publicroll");
  assert.equal(calls[0].actor,companion.id); assert.equal(calls[0].attribute,"discreet");
  const state=party.system.expedition.dayState.journey.stay;
  assert.equal(state.enemy.formula,"1d20");
  assert.equal(party.system.expedition.dayState.events?.enemies,undefined,"the stay consultation must not replace an independent daily enemy result");
});

test("staying policy may skip general daily enemies while preserving the daily encounter and terrain consultations", async () => {
  journeySetup(); await configureJourney({activity:"stay",site:"Ruína",dailyEnemiesWhileStaying:false});
  assert.equal((await PartyActorService.rollEvents(party,["ruins","encounters","enemies","terrain"],"publicroll")).status,"rolled");
  assert.equal(party.system.expedition.dayState.events.enemies,undefined);
  assert.deepEqual(Object.keys(party.system.expedition.dayState.events).sort(),["encounters","terrain"]);
});

test("GM event choice uses an existing result and players cannot inject text or choose results", async () => {
  journeySetup(); const table=installEventTable(getDavokarEncountersTableData()); await configureJourney();
  await assert.rejects(request("rollExpeditionEvents",player,party.uuid,expeditionDayKey(party),expeditionOrientationKey(party),["encounters"],"publicroll",expeditionEventKey(party,["encounters"]),{encounters:"2"}),/Invalid manual event/);
  await PartyActorService.rollEvents(party,["encounters"],"publicroll",{encounters:"2"});
  const result=party.system.expedition.dayState.events.encounters;
  assert.equal(result.manual,true); assert.equal(result.detectionModifier,1);
  assert.match(result.resultText,/tesouros rivais/);
  assert.equal(chat.at(-1).rolls,undefined,"manual selection must not fabricate random dice");
});

test("detection tests the best eligible Vigilant with the table modifier and preserves blind parents", async () => {
  journeySetup(); companion.system.attributes.vigilant={total:19};
  await configureJourney(); installEventTable(getDavokarEncountersTableData());
  await orientation(player,"blindroll");
  await PartyActorService.rollEvents(party,["encounters"],"publicroll",{encounters:"2"});
  assert.equal(chat.at(-1).user,gm.id,"a blind message without dice must not use the player as its author");
  assert.equal(chat.at(-1).blind,true);
  assert.equal(chat.at(-1).rolls,undefined);
  const calls=nativeJourneyTest(10);
  assert.equal((await ExpeditionJourneyService.resolve(party,"detection","publicroll")).status,"rolled");
  assert.equal(calls[0].actor,companion.id); assert.equal(calls[0].attribute,"vigilant"); assert.equal(calls[0].modifier,1);
  assert.equal(chat.at(-1).blind,true);
  assert.deepEqual((await journeyData(player)).detection,{rolled:true,restricted:true});
  assert.equal((await journeyData()).detection.success,true);
});

test("a new encounter permits a fresh detection but a stale orientation never grants detection", async () => {
  journeySetup(); await configureJourney(); installEventTable(getDavokarEncountersTableData());
  await orientation(player,"publicroll"); await PartyActorService.rollEvents(party,["encounters"],"publicroll",{encounters:"0"});
  nativeJourneyTest(5); await ExpeditionJourneyService.resolve(party,"detection","publicroll");
  await PartyActorService.rollEvents(party,["encounters"],"publicroll",{encounters:"1"});
  assert.equal((await ExpeditionJourneyService.resolve(party,"detection","publicroll")).status,"rolled");
  await configureJourney({alongRiver:true});
  await assert.rejects(ExpeditionJourneyService.resolve(party,"detection","publicroll"),/No eligible encounter/);
});

test("daily travel configuration persists through day replacement without preserving daily checks", async () => {
  journeySetup(); await configureJourney({alongRiver:true,activity:"stay",site:"Ruína"});
  const stored=structuredClone(party.flags[MODULE_ID].expedition.travel);
  await PartyActorService.setExpeditionDay(party,2,true);
  assert.deepEqual(party.flags[MODULE_ID].expedition.travel,stored);
  assert.equal(party.system.expedition.dayState.journey,undefined);
  assert.equal(partyTravelPreview(party).stayDays,2);
});


test("failed mortal effort adds a genuine 1d6 and overload penalizes Strong without changing pace", async () => {
  journeySetup();
  const load=bread(hero,"load"); load.system.state="equipped";
  load.getFlag=(_s,k)=>k==="encumbranceManual"?true:k==="encumbranceSlots"?12:undefined;
  await configureJourney({mode:"forcedMarch",participantRefs:[hero.id]});
  const calls=nativeJourneyTest(15);
  const OriginalRoll=Roll;
  globalThis.Roll=class extends OriginalRoll { async evaluate() { this.total=this.formula==="1d6"?6:15; return this; } };
  await ExpeditionJourneyService.resolve(party,"effort","gmroll");
  const result=(await journeyData()).effort.members[0];
  assert.equal(partyTravelPreview(party).rate,30);
  assert.equal(calls[0].modifier,-3,"12 manual slots plus one bread, capacity 10");
  assert.equal(result.damage,7);
});

test("effort retry after a party persistence failure uses per-actor receipts without charging damage again", async () => {
  journeySetup(); await configureJourney({mode:"mortalMarch"}); nativeJourneyTest(5);
  await ExpeditionJourneyService.resolve(party,"effort","gmroll");
  const update=party.update;
  party.update=async()=>{throw new Error("party unavailable");};
  await assert.rejects(ExpeditionJourneyService.applyEffort(party),/party unavailable/);
  assert.equal(hero.system.health.toughness.value,19);
  party.update=update;
  assert.equal((await ExpeditionJourneyService.applyEffort(party)).status,"applied");
  assert.equal(hero.system.health.toughness.value,19);
  assert.equal(companion.system.health.toughness.value,19);
});

test("effort cannot be rerolled after a partially applied operation even if the final party write failed", async () => {
  journeySetup(); await configureJourney({mode:"mortalMarch"}); nativeJourneyTest(5);
  await ExpeditionJourneyService.resolve(party,"effort","gmroll");
  const update=party.update; party.update=async()=>{throw new Error("write failed");};
  await assert.rejects(ExpeditionJourneyService.applyEffort(party),/write failed/);
  party.update=update;
  await configureJourney({mode:"forcedMarch"});
  await assert.rejects(ExpeditionJourneyService.resolve(party,"effort","gmroll"),/Applied effort cannot be rerolled/);
});

test("ruler and sheet read the same newly configured group pace without copying token flags", async () => {
  journeySetup(); await configureJourney({alongRiver:true});
  const {MovementService}=await import("../scripts/movement-ruler.mjs");
  const token={actor:hero,flags:{[MODULE_ID]:{travel:{terrain:"darkDavokar",mode:"mortalMarch"}}}};
  assert.equal(MovementService.getTravelEstimate(20,token).days,1);
  assert.equal(MovementService.getTravelConfiguration(token).linkedParty,party.uuid);
  await configureJourney({mode:"forcedMarch",alongRiver:true});
  assert.equal(MovementService.getTravelEstimate(40,token).days,1);
  assert.equal(token.flags[MODULE_ID].travel.mode,"mortalMarch");
});

test("manual choices and prepared events are invalidated by a change of journey context", async () => {
  journeySetup(); await configureJourney(); installEventTable(getDavokarEncountersTableData());
  await orientation(player,"publicroll"); await PartyActorService.rollEvents(party,["encounters"],"publicroll",{encounters:"0"});
  const before=party.system.expedition.dayState.events.encounters.contextKey;
  await configureJourney({alongRiver:true});
  assert.notEqual(journeyContextKey(party),before);
  await assert.rejects(ExpeditionJourneyService.resolve(party,"detection","publicroll"),/No eligible encounter/);
});

test("collective riding resolves group effort without requiring per-person mount configuration", async () => {
  journeySetup(); await configureJourney({mode:"dayRide"}); nativeJourneyTest(5);
  assert.equal((await ExpeditionJourneyService.resolve(party,"effort","publicroll")).status,"rolled");
  const result=(await journeyData()).effort;
  assert.deepEqual(result.members.map(m=>m.ref),[hero.id,companion.id]);
  assert.equal(result.members.every(m=>m.damage===0 && m.effort===0),true);
});

test("an active trusted player can configure an owned party but cannot apply another actor's effort", async () => {
  journeySetup(); player.role=3;
  assert.equal((await configureJourney({},player)).status,"configured");
  await assert.rejects(request("applyExpeditionEffort",player,party.uuid,expeditionDayKey(party),"missing","manual"),/Only a GM/);
});


test("health conflicts on a later participant are detected before any traveller is changed", async () => {
  journeySetup(); await configureJourney({mode:"mortalMarch"}); nativeJourneyTest(5);
  await ExpeditionJourneyService.resolve(party,"effort","gmroll");
  companion.system.health.toughness.value=18;
  await assert.rejects(ExpeditionJourneyService.applyEffort(party),/health changed/);
  assert.equal(hero.system.health.toughness.value,20);
});

test("overlapping active party membership cannot resolve two daily efforts for the same actor", async () => {
  journeySetup(); await configureJourney({mode:"mortalMarch"}); nativeJourneyTest(5);
  const second=actor("party2",[player.id]); second.type=`${MODULE_ID}.party`;
  second.system=structuredClone(party.system); second.flags=structuredClone(party.flags); game.actors.set(second.id,second);
  await assert.rejects(ExpeditionJourneyService.resolve(party,"effort","gmroll"),/multiple active journeys/);
});


test("staying is a separate activity: orientation and discovery of new ruins are not rolled as travel", async () => {
  journeySetup(); await configureJourney({activity:"stay",site:"Ruína"});
  assert.equal((await orientation(player,"publicroll")).status,"notTravelling");
  assert.equal((await PartyActorService.rollEvents(party,["ruins"],"publicroll")).status,"skipped");
  assert.equal(chat.length,0);
});


test("players cannot probe a blind orientation through eligibility for encounter detection", async () => {
  journeySetup(); await configureJourney(); installEventTable(getDavokarEncountersTableData());
  await orientation(player,"blindroll"); await PartyActorService.rollEvents(party,["encounters"],"publicroll",{encounters:"0"});
  const args=[party.uuid,expeditionDayKey(party),journeyContextKey(party),"detection","publicroll",""];
  await assert.rejects(request("resolveExpeditionJourney",player,...args),/Private detection must be handled by a GM/);
  assert.equal(party.system.expedition.dayState.journey,undefined);
});

test("preparing a stay before departure and restarting an expedition both start the site counter at day one", async () => {
  journeySetup(); party.system.expedition.active=false; party.system.expedition.day=0;
  await configureJourney({activity:"stay",site:"Ruína"});
  await PartyActorService.setExpeditionDay(party,1,true);
  assert.equal(partyTravelPreview(party).stayDays,1);
  await PartyActorService.setExpeditionDay(party,10,true);
  await PartyActorService.setExpeditionDay(party,0,false);
  await PartyActorService.setExpeditionDay(party,1,true);
  assert.equal(partyTravelPreview(party).stayDays,1);
});

test("a configuration change during protected storage cannot attach an obsolete journey result", async () => {
  journeySetup(); await configureJourney({mode:"mortalMarch"}); nativeJourneyTest(5);
  await globalThis.CompendiumCollection.createCompendium({name:`${MODULE_ID}-expeditions`,type:"JournalEntry",ownership:{GAMEMASTER:"OWNER",ASSISTANT:"OWNER",TRUSTED:"NONE",PLAYER:"NONE"}});
  const pack=[...game.packs.values()][0], create=pack.documentClass.create;
  pack.documentClass.create=async (...args) => {
    const result=await create(...args);
    party.flags[MODULE_ID].expedition.travel.alongRiver=true;
    return result;
  };
  assert.equal((await ExpeditionJourneyService.resolve(party,"effort","gmroll")).status,"stale");
  assert.equal(party.system.expedition.dayState.journey,undefined);
});

test("journey dialog saves collective options without individual controls or changing ruin search", async () => {
  journeySetup();
  party.system.expedition.activeSearch=false;
  const previous = foundry.applications;
  const sheet = Object.create(PartyActorSheet.prototype);
  Object.defineProperty(sheet,"isEditable",{value:true});
  sheet.actor=party; sheet.render=()=>{};
  const fields={activity:{value:"stay"},site:{value:"Ruína"},mode:{value:"dayRide"},alongRiver:{checked:true},dailyEnemiesWhileStaying:{checked:false}};
  foundry.applications={api:{DialogV2:{async prompt(config) {
    assert.doesNotMatch(config.content,/name="searchRule"|data-journey-mount|data-journey-participant/);
    const root={
      querySelector(selector) { return fields[selector.match(/name="([^"]+)"/)[1]]; }
    };
    return config.ok.callback(null,null,{element:root});
  }}}};
  try {
    await sheet._onConfigureJourney();
    const config=partyTravelPreview(party).config;
    assert.equal(config.activity,"stay"); assert.equal(config.site,"Ruína");
    assert.equal(config.mode,"dayRide"); assert.equal(config.alongRiver,true);
    assert.equal(Object.hasOwn(config,"searchRule"),false); assert.equal(config.dailyEnemiesWhileStaying,false);
    assert.equal(Object.hasOwn(config,"participantRefs"),false);
    assert.equal(Object.hasOwn(config,"mounts"),false);
    assert.equal(party.system.expedition.activeSearch,false);
    assert.equal(partyTravelPreview(party).profiles.length,2);
  } finally { foundry.applications=previous; }
});
