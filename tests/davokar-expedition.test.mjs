import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";

const hooks = new Map();
const handlers = new Map();
globalThis.Hooks = { once: (name, handler) => hooks.set(name, handler), on: (name, handler) => hooks.set(name, handler) };
globalThis.socketlib = { registerModule: () => ({ register: (name, handler) => handlers.set(name, handler) }) };

const { MODULE_ID, OFFICIAL_DAVOKAR_EVENT_TABLE_IDS: IDS } = await import("../scripts/constants.mjs");
const { DavokarExpedition, defaultDavokarConfig, remainingFollowUps } = await import("../scripts/davokar-expedition.mjs");
const { bindDavokarPanel, davokarView } = await import("../scripts/davokar-sheet.mjs");
const { getDavokarKey, readDavokarJournal, restoreDavokarKey } = await import("../scripts/davokar-storage.mjs");
const { resolveDavokarTable, tableRollFormula } = await import("../scripts/davokar-tables.mjs");
DavokarExpedition.register();
hooks.get("socketlib.ready")();
const handler = handlers.get("dispatchDavokarExpedition");

let gm, player, bystander, guide, party, documents, messages, dice, tests;
let failChat, failStorage, clock, nativeCalls;

class MockRoll {
  constructor(formula) { this.formula = formula; }
  static validate(formula) { return typeof formula === "string" && formula.includes("d"); }
  async evaluate() { this.total = dice.shift(); return this; }
}
globalThis.Roll = MockRoll;

function actor(id, type = "player", owner = player.id) {
  return {
    id, uuid: "Actor." + id, name: id, documentName: "Actor", type, pack: null,
    items: new Map(), flags: {}, system: { attributes: { vigilant: { total: 12 }, discreet: { total: 10 } } },
    testUserPermission(user, level) {
      if (user.isGM) return true;
      return user.id === owner && [3, "OWNER", "OBSERVER"].includes(level);
    }
  };
}

function table(id, formula = "1d25", max = 25, replacement = true) {
  const rows = Array.from({ length: max }, (_, index) => ({
    id: "r" + (index + 1), name: "Row " + (index + 1), range: [index + 1, index + 1], description: "<p>Result " + (index + 1) + "</p>"
  }));
  const rolltable = {
    id, name: id, uuid: "RollTable." + id, documentName: "RollTable", formula, replacement, results: rows,
    async roll({ roll }) {
      await roll.evaluate();
      return { roll, results: rows.filter(row => row.range[0] === roll.total) };
    }
  };
  game.tables.set(id, rolltable);
  documents.set(rolltable.uuid, rolltable);
  return rolltable;
}

async function record() { return (await readDavokarJournal(party.uuid)).state; }
async function run(action, payload = {}, expected, user = gm, group = party) {
  return handler.call({ socketdata: { userId: user.id } }, group.uuid, action, payload, expected === undefined ? (await record())?.revision ?? null : expected);
}
async function config(overrides) {
  assert.equal((await run("start")).ok, true);
  assert.equal((await run("configure", { ...defaultDavokarConfig(), guide: guide.id, ...overrides })).ok, true);
}

beforeEach(() => {
  const keys = new Map();
  globalThis.localStorage = { getItem: key => keys.get(key), setItem: (key, value) => keys.set(key, value) };
  gm = { id: "gm", isGM: true, active: true };
  player = { id: "owner", isGM: false, active: true };
  bystander = { id: "observer", isGM: false, active: true };
  guide = actor("guide");
  guide.items.set("bushcraft", { name: "Mateiro III", type: "boon", system: {} });
  party = actor("party", MODULE_ID + ".party");
  party.flags[MODULE_ID] = { expedition: { active: true, day: 9 } };
  party.system.members = [guide.id];
  dice = []; tests = []; nativeCalls = []; messages = [];
  failChat = false; failStorage = false; clock = 37;
  documents = new Map([[party.uuid, party], [guide.uuid, guide]]);
  const users = new Map([gm, player, bystander].map(user => [user.id, user]));
  users.filter = filter => [...users.values()].filter(filter);
  users.activeGM = gm;
  globalThis.fromUuid = async uuid => documents.get(uuid);
  globalThis.ChatMessage = {
    getSpeaker: ({ actor: speaker }) => ({ alias: speaker.name }),
    applyRollMode(data, mode) { data.whisper = mode === "publicroll" ? [] : [gm.id]; data.blind = mode === "blindroll"; },
    async create(data) {
      if (failChat) throw Error("chat unavailable");
      assert.ok((await record())?.revision, "publish after persistence");
      messages.push(data);
    }
  };
  globalThis.JournalEntry = {
    async create(source) {
      assert.deepEqual(source.ownership, { default: 0 });
      const doc = {
        ...source, getFlag(scope, key) { return this.flags[scope][key]; },
        async setFlag(scope, key, value) {
          if (failStorage) throw Error("write failed");
          this.flags[scope][key] = value;
        }
      };
      game.journal.set("exp" + game.journal.size, doc);
      return doc;
    }
  };
  globalThis.game = {
    world: { id: "test-world" }, user: gm, users, actors: new Map([[party.id, party], [guide.id, guide]]),
    journal: new Map(), tables: new Map(), packs: new Map(),
    settings: { get: () => false },
    i18n: { localize: key => key, format: (_, data) => data.group },
    time: { get worldTime() { return clock; }, advance() { assert.fail("The world clock is independent"); } },
    symbaroum: { api: { async baseRoll(character, attribute, target, targetAttribute, favour, mod) {
      nativeCalls.push([character.uuid, attribute, favour, mod]);
      const diceTarget = character.system.attributes[attribute].total + mod;
      const diceResult = tests.shift();
      const roll = new MockRoll(favour ? "2d20kl" : "1d20"); roll.total = diceResult;
      return { diceTarget, diceResult, hasSucceed: diceResult <= diceTarget, rolls: [roll] };
    } } }
  };
});

test("the GM workflow persists independent table results, history and acknowledgments without touching actor or clock", async () => {
  const saved = structuredClone({ system: party.system, flags: party.flags });
  await config({ region: "bright", river: true, search: "off" });
  for (const id of Object.values(IDS)) table(id);
  tests.push(5, 6);
  assert.equal((await run("orient")).ok, true);
  dice.push(13, 6, 12, 21);
  for (const slot of ["ruins", "encounters", "enemies", "terrain"]) assert.equal((await run("event", { key: slot })).ok, true);
  const current = (await record()).current;
  assert.equal(current.results.orientation.verdict, "great");
  assert.equal(current.results.ruins.modifiers.orientation, 2);
  assert.equal(current.results.terrain.modifiers.river, 2);
  assert.equal(current.results.terrain.modifiers.orientation, -2);
  assert.equal((await run("detect")).ok, true);
  assert.deepEqual(nativeCalls.map(call => call.slice(1)), [["vigilant", 0, 0], ["vigilant", 0, 3]]);
  assert.equal(remainingFollowUps((await record()).current).nature, 1);
  dice.push(7);
  assert.equal((await run("finds")).ok, true);
  assert.equal((await record()).current.results.finds.total, 7);
  assert.equal((await run("resolve", { key: "terrain", note: "O grupo contornou." })).ok, true);
  assert.equal((await run("next")).ok, true);
  assert.equal((await record()).history[0].resolutions[0].note, "O grupo contornou.");
  assert.equal((await record()).current.number, 2);
  assert.equal((await record()).current.results.orientation, undefined);
  assert.deepEqual({ system: party.system, flags: party.flags }, saved);
  assert.equal(game.time.worldTime, 37);
  assert.ok(messages.every(message => message.whisper.join() === gm.id));
  assert.equal((await davokarView(party)).history.length, 1);
});

test("Wild failure gates events until +5 mishap, then allows recorded secondary mishaps and enemies", async () => {
  await config({ region: "wild" });
  const mishap = table("tblMishapsDav001", "1d30", 30);
  table(IDS.enemies);
  tests.push(19);
  assert.equal((await run("orient")).ok, true);
  assert.equal((await run("event", { key: "enemies" })).code, "NotReady");
  dice.push(18, 25, 16, 3);
  assert.equal((await run("mishap")).ok, true);
  assert.equal((await record()).current.results.mishap.modifiers.region, 5);
  assert.equal(remainingFollowUps((await record()).current).mishaps, 2);
  assert.equal((await run("mishapExtra")).ok, true);
  assert.equal((await run("mishapExtra")).ok, true);
  assert.equal((await run("mishapExtra")).code, "NotReady");
  assert.equal((await run("mishapEnemies")).ok, true);
  assert.equal((await record()).current.results.mishapEnemies1.modifiers.orientation, 0);
  assert.match(tableRollFormula("mishaps", mishap, 10), /min\(30, max\(1, \(1d20\) \+ \(10\)\)\)/);
});

test("short-qualified guides avoid mishaps without bonuses and Pathfinder routes the native second chance", async () => {
  guide.items.get("bushcraft").name = "Mateiro I";
  guide.items.set("path", { type: "boon", name: "Desbravador", system: {} });
  await config({ region: "dark" });
  tests.push(2);
  assert.equal((await run("orient")).ok, true);
  assert.deepEqual(nativeCalls[0].slice(1), ["vigilant", 1, -5]);
  assert.equal((await record()).current.results.orientation.verdict, "avoid");
  assert.equal((await run("detect")).code, "NotReady");
  assert.equal((await run("mishap")).code, "NotReady");
});

test("missing guides and tables are safe, and custom tables keep their native formulas", async () => {
  await config({});
  party.system.members = [];
  assert.equal((await run("orient")).code, "GuideUnavailable");
  assert.equal((await run("skip")).ok, true);
  assert.equal((await run("event", { key: "terrain" })).code, "MissingTable");
  const custom = table("custom", "1d8", 8);
  assert.equal((await run("table", { key: "terrain", reference: custom.uuid })).ok, true);
  dice.push(8);
  assert.equal((await run("event", { key: "terrain" })).ok, true);
  assert.equal((await record()).current.results.terrain.formula, "min(8, max(1, 1d8))");
  assert.equal((await record()).current.results.terrain.official, false);
  const nonreplacement = table("unique", "1d8", 8, false);
  assert.equal((await run("table", { key: "ruins", reference: nonreplacement.uuid })).ok, true);
  assert.equal((await run("event", { key: "ruins" })).code, "InvalidTable");
});

test("a native date-independent revision stops double rolls, and explicit retry archives the old attempt", async () => {
  await config({});
  tests.push(3);
  const revision = (await record()).revision;
  const results = await Promise.all([run("orient", {}, revision), run("orient", {}, revision)]);
  assert.deepEqual(results.map(result => result.code ?? "ok"), ["ok", "Stale"]);
  assert.equal(nativeCalls.length, 1);
  assert.equal((await run("retry")).ok, true);
  assert.equal((await record()).current.attempts[0].results.orientation.die, 3);
  assert.equal((await record()).current.results.orientation, undefined);
});

test("a player needs an active GM grant, party access and guide ownership without reading the private journal", async () => {
  await config({ allowPlayer: true, mode: "blindroll" });
  assert.equal((await run("next", {}, null, player)).code, "Forbidden");
  assert.equal((await run("grant", {}, null, bystander)).code, "Forbidden");
  assert.equal((await run("orient", {}, null, player)).code, "Forbidden");
  const first = await run("grant", {}, null, player);
  assert.ok(first.grant);
  await run("next");
  assert.equal((await run("orient", { grant: first.grant }, null, player)).code, "Forbidden");
  const second = await run("grant", {}, null, player);
  tests.push(4);
  assert.deepEqual(await run("orient", { grant: second.grant }, null, player), { ok: true });
  assert.equal(messages[0].user, player.id);
  assert.equal(messages[0].blind, true);
  assert.deepEqual(messages[0].whisper, [gm.id]);
  assert.equal((await run("orient", { grant: second.grant }, null, player)).code, "Forbidden");
  game.user = player;
  assert.deepEqual(await readDavokarJournal(party.uuid), { journal: null, state: null });
});

test("storage failure publishes nothing and chat failure never converts a saved result into a retry", async () => {
  await config({});
  failStorage = true;
  tests.push(2, 3);
  assert.equal((await run("orient")).ok, false);
  assert.equal(messages.length, 0);
  assert.equal((await record()).current.results.orientation, undefined);
  failStorage = false; failChat = true;
  const warn = console.warn;
  console.warn = () => {};
  try {
    const result = await run("orient");
    assert.equal(result.ok, true);
    assert.equal(result.chatError, true);
    assert.equal((await record()).current.results.orientation.die, 3);
    assert.equal((await run("orient")).code, "AlreadyRolled");
  } finally { console.warn = warn; }
});

test("journals scoped by group reject modified sharing and never merge legacy actor data", async () => {
  await config({});
  const second = actor("othergroup", MODULE_ID + ".party");
  documents.set(second.uuid, second);
  assert.equal((await run("start", {}, null, gm, second)).ok, true);
  assert.equal((await readDavokarJournal(second.uuid)).state.current.config.guide, "");
  assert.equal((await record()).current.config.guide, guide.id);
  (await readDavokarJournal(party.uuid)).journal.ownership[player.id] = 2;
  await assert.rejects(readDavokarJournal(party.uuid), /StorageError/);
  assert.equal((await davokarView(party)).error, "TENEBRE.Davokar.Error.StorageError");
});

test("tables resolve exact licensed sources and all static interface labels exist in both languages", async () => {
  const gmg = table(IDS.terrain);
  game.tables.delete(IDS.terrain);
  game.packs.set("symbaroum-gmg.tables", {
    documentName: "RollTable", collection: "symbaroum-gmg.tables", async getIndex() { return new Map([[gmg.id, {}]]); },
    async getDocument(id) { assert.equal(id, gmg.id); return gmg; }
  });
  assert.equal(await resolveDavokarTable("terrain"), gmg);
  assert.equal(await resolveDavokarTable("terrain", "RollTable.missing"), null);
  const template = await readFile(new URL("../templates/davokar-expedition.hbs", import.meta.url), "utf8");
  for (const locale of ["en", "pt-BR"]) {
    const language = JSON.parse(await readFile(new URL("../languages/" + locale + ".json", import.meta.url), "utf8"));
    for (const [, label] of template.matchAll(/localize "(TENEBRE\.Davokar\.[^"]+)"/g)) assert.ok(language[label], locale + ": " + label);
  }
});

test("Foundry's shared data only contains encrypted private rolls and history; a new GM browser can restore the key", async () => {
  await config({ mode: "blindroll" });
  tests.push(3);
  assert.equal((await run("orient")).ok, true);
  const { journal, state } = await readDavokarJournal(party.uuid);
  assert.equal(state.current.results.orientation.die, 3);
  assert.ok(getDavokarKey());
  assert.equal(JSON.stringify(journal.flags).includes("verdict"), false);
  assert.equal(JSON.stringify(journal.flags).includes(guide.uuid), false);
  assert.equal(messages[0].rolls, undefined);
  assert.doesNotMatch(messages[0].content, /verdict|3 \/ 12/i);
  assert.ok(messages[0].flags[MODULE_ID].davokarPrivateChat.value);

  const key = getDavokarKey();
  game.user = { ...gm, id: "othergm" };
  await assert.rejects(readDavokarJournal(party.uuid), /KeyRequired/);
  await assert.rejects(restoreDavokarKey("a".repeat(64)), /KeyRequired/);
  await restoreDavokarKey(key);
  assert.equal((await readDavokarJournal(party.uuid)).state.current.results.orientation.die, 3);
  game.user = player;
  assert.equal(getDavokarKey(), "");
  await assert.rejects(restoreDavokarKey(key), /Forbidden/);
});

test("public chat carries the native roll and private GM self-rolls disable player delegation", async () => {
  await config({ mode: "selfroll", allowPlayer: true });
  assert.equal((await run("grant", {}, null, player)).code, "Forbidden");
  assert.equal((await run("configure", { ...defaultDavokarConfig(), guide: guide.id, mode: "publicroll" })).ok, true);
  tests.push(4);
  assert.equal((await run("orient")).ok, true);
  assert.equal(messages[0].whisper.length, 0);
  assert.equal(messages[0].rolls[0].total, 4);
});

test("the Group observer can click the delegated button in a read-only Foundry form", () => {
  const button = { disabled: true };
  const panel = {
    addEventListener() {},
    querySelector(selector) {
      assert.match(selector, /data-grant/);
      return button;
    }
  };
  bindDavokarPanel({}, { querySelector: () => panel });
  assert.equal(button.disabled, false);
});
