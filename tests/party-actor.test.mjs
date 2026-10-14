import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateSource = fs.readFileSync(path.join(root, "templates/party-sheet.hbs"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "styles/symbaroum-ind-resources.css"), "utf8");

test("Party sheet template includes health and corruption bars in member identity", () => {
  assert.match(templateSource, /class="member-bars"/);
  assert.match(templateSource, /class="member-bar-row toughness-row"/);
  assert.match(templateSource, /class="member-bar-row corruption-row"/);
  assert.match(templateSource, /class="bar-track"/);
  assert.match(templateSource, /class="bar-fill toughness-fill/);
  assert.match(templateSource, /class="bar-fill corruption-fill/);
});

test("Party sheet template relocates occupation and XP to member-meta", () => {
  assert.match(templateSource, /class="member-meta"/);
  assert.match(templateSource, /class="member-occupation"/);
  assert.match(templateSource, /class="member-xp"/);
});

test("Stylesheet contains rules for member bars and member-meta", () => {
  assert.match(cssSource, /\.tenebre-party-sheet \.member-bars/);
  assert.match(cssSource, /\.tenebre-party-sheet \.member-bar-row/);
  assert.match(cssSource, /\.tenebre-party-sheet \.member-bar-row \.bar-track/);
  assert.match(cssSource, /\.tenebre-party-sheet \.member-bar-row \.toughness-fill/);
  assert.match(cssSource, /\.tenebre-party-sheet \.member-bar-row \.corruption-fill/);
  assert.match(cssSource, /\.tenebre-party-sheet \.member-meta/);
});

test("PartyActorSheet._prepareMemberCardData formats toughness and corruption correctly", async () => {
  globalThis.Hooks = globalThis.Hooks ?? { once() {}, on() {}, callAll() {} };
  globalThis.foundry = globalThis.foundry ?? { utils: { deepClone: (x) => JSON.parse(JSON.stringify(x)) } };
  globalThis.ActorSheet = class {
    constructor(actor) { this.actor = actor; }
    get isEditable() { return true; }
  };

  const { PartyActorSheet } = await import("../scripts/party-actor.mjs");
  const sheet = new PartyActorSheet({ system: {} });

  const mockActor = {
    id: "act1",
    uuid: "Actor.act1",
    name: "Arokh",
    img: "icons/svg/mystery-man.svg",
    type: "player",
    isOwner: true,
    system: {
      bio: { occupation: "Guerreiro" },
      experience: { total: 50, spent: 30 },
      health: {
        toughness: { value: 6, max: 12, threshold: 6 },
        corruption: { permanent: 2, temporary: 4, longterm: 0, threshold: 5, max: 10 }
      },
      attributes: {
        strong: { total: 15 },
        accurate: { total: 13 },
        quick: { total: 11 },
        resolute: { total: 10 },
        cunning: { total: 9 }
      }
    }
  };

  const cardData = sheet._prepareMemberCardData(mockActor, false);

  assert.equal(cardData.name, "Arokh");
  assert.equal(cardData.occupation, "Guerreiro");
  assert.equal(cardData.totalXp, 50);
  assert.equal(cardData.availableXp, 20);

  // Toughness
  assert.equal(cardData.health.toughness.value, 6);
  assert.equal(cardData.health.toughness.max, 12);
  assert.equal(cardData.health.toughness.pct, 50);
  assert.equal(cardData.health.toughness.isWounded, true);

  // Corruption
  assert.equal(cardData.health.corruption.value, 6);
  assert.equal(cardData.health.corruption.threshold, 5);
  assert.equal(cardData.health.corruption.max, 10);
  assert.equal(cardData.health.corruption.pct, 60);
  assert.equal(cardData.health.corruption.isOverThreshold, true);
});

test("Party sheet template includes dual storage entity and draft animal hitching support", () => {
  assert.match(templateSource, /class="storage-entities-group"/);
  assert.match(templateSource, /class="storage-entity-card primary-unit/);
  assert.match(templateSource, /class="storage-hitch-connector"/);
  assert.match(templateSource, /class="storage-entity-card draft-unit/);
  assert.match(templateSource, /data-action="unlink-draft-animal"/);
  assert.match(templateSource, /class="storage-hitch-slot empty"/);
  assert.match(templateSource, /data-action="link-draft-animal"/);
});

test("Stylesheet contains rules for dual storage entity cards and hitch connectors", () => {
  assert.match(cssSource, /\.tenebre-party-sheet \.storage-entities-group/);
  assert.match(cssSource, /\.tenebre-party-sheet \.storage-entity-card/);
  assert.match(cssSource, /\.tenebre-party-sheet \.storage-hitch-connector/);
  assert.match(cssSource, /\.tenebre-party-sheet \.storage-unlink-draft-btn/);
  assert.match(cssSource, /\.tenebre-party-sheet \.storage-hitch-slot\.empty/);
});

test("PartyActorSheet.getData formats vehicle and hitched draft animal correctly", async () => {
  globalThis.Hooks = globalThis.Hooks ?? { once() {}, on() {}, callAll() {} };
  globalThis.foundry = globalThis.foundry ?? { utils: { deepClone: (x) => JSON.parse(JSON.stringify(x)) } };
  globalThis.ActorSheet = class {
    constructor(actor) { this.actor = actor; }
  };

  const { PartyActorSheet } = await import("../scripts/party-actor.mjs");
  const partyActor = {
    id: "party1",
    system: {
      storageLocation: {
        id: "cart-1",
        name: "Carroça de Viagem",
        category: "vehicle",
        capacity: 200,
        img: "icons/environment/settlement/wagon.webp",
        draftAnimal: {
          id: "horse-1",
          name: "Cavalo Alazão",
          capacity: 80,
          img: "icons/environment/creatures/horse-brown.webp"
        }
      }
    },
    items: new Map()
  };

  const sheet = new PartyActorSheet(partyActor);
  const data = await sheet.getData();

  assert.equal(data.storage.hasLocation, true);
  assert.equal(data.storage.name, "Carroça de Viagem");
  assert.equal(data.storage.isVehicle, true);
  assert.equal(data.storage.hasDraftAnimal, true);
  assert.equal(data.storage.draftAnimal.name, "Cavalo Alazão");
  assert.equal(data.storage.draftAnimal.capacity, 80);
});

test("Party sheet template includes party-region control in header", () => {
  assert.match(templateSource, /class="party-region"/);
  assert.match(templateSource, /name="system\.location\.region"/);
  assert.doesNotMatch(templateSource, /class="party-location"/);
});

test("Stylesheet contains rules for party-region", () => {
  assert.match(cssSource, /\.sheet-header \.party-region/);
  assert.match(cssSource, /\.party-region select/);
});

test("PartyActorSheet formats location regions and modifiers correctly in getData", async () => {
  globalThis.Hooks = globalThis.Hooks ?? { once() {}, on() {}, callAll() {} };
  globalThis.foundry = globalThis.foundry ?? { utils: { deepClone: (x) => JSON.parse(JSON.stringify(x)) } };
  globalThis.ActorSheet = class {
    constructor(actor) { this.actor = actor; }
  };

  const { PartyActorSheet } = await import("../scripts/party-actor.mjs");

  // Caso 1: padrão (ambria)
  const defaultParty = {
    id: "party-default",
    system: {},
    items: new Map()
  };
  const sheet1 = new PartyActorSheet(defaultParty);
  const data1 = await sheet1.getData();
  assert.equal(data1.partyLocation.region, "ambria");
  assert.equal(data1.partyLocation.modifier, 0);
  assert.equal(data1.partyLocation.name, "");
  assert.equal(data1.partyLocation.regions.length, 4);

  // Caso 2: Davokar Selvagem (+2) com local específico
  const wildParty = {
    id: "party-wild",
    system: {
      location: {
        region: "wild",
        name: "Ruínas de Odaban"
      }
    },
    items: new Map()
  };
  const sheet2 = new PartyActorSheet(wildParty);
  const data2 = await sheet2.getData();
  assert.equal(data2.partyLocation.region, "wild");
  assert.equal(data2.partyLocation.modifier, 2);
  assert.equal(data2.partyLocation.modifierText, "+2");
  assert.equal(data2.partyLocation.name, "Ruínas de Odaban");

  // Caso 3: Davokar Escura (+5)
  const darkParty = {
    id: "party-dark",
    system: {
      location: {
        region: "dark",
        name: "Coração de Symbar"
      }
    },
    items: new Map()
  };
  const sheet3 = new PartyActorSheet(darkParty);
  const data3 = await sheet3.getData();
  assert.equal(data3.partyLocation.region, "dark");
  assert.equal(data3.partyLocation.modifier, 5);
  assert.equal(data3.partyLocation.modifierText, "+5");

  // getRegionModifier estático
  assert.equal(PartyActorSheet.getRegionModifier("ambria"), 0);
  assert.equal(PartyActorSheet.getRegionModifier("bright"), 0);
  assert.equal(PartyActorSheet.getRegionModifier("wild"), 2);
  assert.equal(PartyActorSheet.getRegionModifier("dark"), 5);
});

test("Party sheet template includes expedition tab with guide card and actions", () => {
  assert.match(templateSource, /data-tab="expedition"/);
  assert.match(templateSource, /class="party-expedition-tab-content"/);
  assert.match(templateSource, /class="party-guide-box/);
  assert.match(templateSource, /data-drop-zone="expedition-guide"/);
  assert.match(templateSource, /data-action="open-guide-sheet"/);
  assert.match(templateSource, /data-action="select-guide"/);
  assert.match(templateSource, /data-action="unlink-guide"/);
  assert.match(templateSource, /TENEBRE\.Party\.ExpeditionGuideBadge/);
  assert.match(templateSource, /class="member-guide-tag"/);
  assert.match(templateSource, /is-expedition-guide/);
  assert.match(templateSource, /class="portrait-guide-badge"/);
  assert.match(templateSource, /data-action="toggle-guide"/);
  assert.match(templateSource, /class="item-control member-guide-toggle/);
  assert.match(templateSource, /class="guide-card-layout"/);
  assert.match(templateSource, /class="guide-portrait/);
  assert.match(templateSource, /class="guide-info-column"/);
  assert.match(cssSource, /\.party-member-card\.is-expedition-guide/);
  assert.match(cssSource, /\.portrait-guide-badge/);
  assert.match(cssSource, /\.member-guide-toggle/);
  assert.match(cssSource, /\.member-guide-toggle\.is-active/);
  assert.match(cssSource, /\.guide-card-layout/);
  assert.match(cssSource, /\.guide-portrait/);
  assert.match(cssSource, /\.guide-info-column/);
  assert.match(templateSource, /class="expedition-step-header"/);
  assert.match(templateSource, /class="expedition-step-label"/);
  assert.match(templateSource, /TENEBRE\.Party\.ExpeditionStep1Title/);
  assert.match(cssSource, /\.tenebre-party-sheet \.expedition-step-header/);
  assert.match(cssSource, /\.tenebre-party-sheet \.expedition-step-label/);
  assert.match(cssSource, /\.tenebre-party-sheet \.expedition-step-line/);
  assert.match(cssSource, /\.tenebre-party-sheet \.tab\[data-tab="expedition"\]\.active/);
  assert.match(cssSource, /\.tenebre-party-sheet \.party-expedition-tab-content/);
  assert.match(cssSource, /overflow-y:\s*auto;/);
  assert.match(cssSource, /\.tenebre-party-sheet \.party-guide-box/);
  assert.match(cssSource, /\.tenebre-party-sheet \.party-guide-box\.is-linked/);
  assert.match(cssSource, /\.tenebre-party-sheet \.party-guide-box\.is-unlinked/);
});

test("PartyActorSheet formats expedition guide and members isGuide correctly", async () => {
  globalThis.Hooks = globalThis.Hooks ?? { once() {}, on() {}, callAll() {} };
  globalThis.foundry = globalThis.foundry ?? { utils: { deepClone: (x) => JSON.parse(JSON.stringify(x)) } };
  globalThis.ActorSheet = class {
    constructor(actor) { this.actor = actor; }
    get isEditable() { return true; }
  };

  const { PartyActorSheet } = await import("../scripts/party-actor.mjs");

  const guideMember = {
    id: "guide-1",
    uuid: "Actor.guide-1",
    name: "Arokh o Mateiro",
    img: "icons/svg/mystery-man.svg",
    type: "player",
    isOwner: true,
    system: {
      bio: { occupation: "Mateiro" },
      attributes: {
        vigilant: { total: 15 },
        cunning: { total: 13 }
      }
    }
  };

  const partyWithGuide = {
    id: "party-guide-test",
    isOwner: true,
    system: {
      members: ["guide-1"],
      expedition: {
        guideId: "guide-1"
      }
    },
    items: new Map()
  };

  const sheet = new PartyActorSheet(partyWithGuide);
  sheet._resolveActor = (id) => (id === "guide-1" ? guideMember : null);

  const cardData = sheet._prepareMemberCardData(guideMember, false);
  assert.equal(cardData.isGuide, true);

  const data = await sheet.getData();
  assert.equal(data.expedition.guideId, "guide-1");
  assert.equal(data.expedition.guide.hasGuide, true);
  assert.equal(data.expedition.guide.name, "Arokh o Mateiro");
  assert.equal(data.expedition.guide.occupation, "Mateiro");
  assert.equal(data.expedition.guide.vigilant, 15);
  assert.equal(data.expedition.guide.cunning, 13);
  assert.equal(data.expedition.guide.canOpenSheet, true);

  // Sem guia definido
  const partyNoGuide = {
    id: "party-no-guide",
    system: { expedition: {} },
    items: new Map()
  };
  const sheet2 = new PartyActorSheet(partyNoGuide);
  const data2 = await sheet2.getData();
  assert.equal(data2.expedition.guide.hasGuide, false);
});

test("PartyActorSheet._onSetGuide and _onUnsetGuide update party actor", async () => {
  const { PartyActorSheet } = await import("../scripts/party-actor.mjs");
  const updates = [];
  const mockPartyActor = {
    id: "party-doc",
    system: { expedition: {} },
    update: async (data) => updates.push(data)
  };

  const sheet = new PartyActorSheet(mockPartyActor);
  sheet.render = () => {};
  Object.defineProperty(sheet, "isEditable", { value: true, configurable: true });
  sheet._resolveActor = (id) => ({ id, uuid: `Actor.${id}`, name: "Guia Teste" });

  await sheet._onSetGuide("guide-1");
  assert.equal(updates[0]["system.expedition.guideId"], "guide-1");
  assert.equal(updates[0]["flags.symbaroum-ind-resources.expedition.guideId"], "guide-1");

  await sheet._onUnsetGuide();
  assert.equal(updates[1]["system.expedition.guideId"], "");
  assert.equal(updates[1]["flags.symbaroum-ind-resources.expedition.guideId"], "");
});

test("PartyDataModel defines expedition in schema and prepareDerivedData", async () => {
  const { PartyDataModel } = await import("../scripts/party-actor.mjs");
  globalThis.foundry = globalThis.foundry ?? {};
  globalThis.foundry.data = globalThis.foundry.data ?? {
    fields: {
      StringField: class { constructor(opt) { this.opt = opt; } },
      BooleanField: class { constructor(opt) { this.opt = opt; } },
      NumberField: class { constructor(opt) { this.opt = opt; } },
      ArrayField: class { constructor(el, opt) { this.el = el; this.opt = opt; } },
      SchemaField: class { constructor(fields) { this.fields = fields; } },
      ObjectField: class { constructor(opt) { this.opt = opt; } },
      HTMLField: class { constructor(opt) { this.opt = opt; } }
    }
  };

  const schema = PartyDataModel.defineSchema();
  assert.ok(schema.expedition, "PartyDataModel.schema must declare expedition");

  const model = new PartyDataModel();
  model.prepareDerivedData();
  assert.ok(model.expedition, "PartyDataModel must initialize expedition in prepareDerivedData");
  assert.equal(model.expedition.guideId, "");
});

test("PartyActorSheet._bindMemberContextMenu registers ContextMenu with fixed: true and jQuery: false", async () => {
  const { PartyActorSheet } = await import("../scripts/party-actor.mjs");
  let capturedArgs = null;
  class MockContextMenu {
    constructor(container, selector, entries, options) {
      capturedArgs = { container, selector, entries, options };
    }
  }

  globalThis.foundry = globalThis.foundry ?? {};
  globalThis.foundry.applications = globalThis.foundry.applications ?? {};
  globalThis.foundry.applications.ux = globalThis.foundry.applications.ux ?? {};
  globalThis.foundry.applications.ux.ContextMenu = MockContextMenu;

  const mockActor = { id: "p1", system: { expedition: { guideId: "" } } };
  const sheet = new PartyActorSheet(mockActor);
  const mockRoot = { querySelectorAll: () => [] };
  sheet._bindMemberContextMenu(mockRoot);

  assert.ok(capturedArgs, "ContextMenu should be instantiated");
  assert.equal(capturedArgs.selector, ".party-member-card[data-actor-id]");
  assert.equal(capturedArgs.options?.fixed, true, "ContextMenu must have fixed: true to prevent container clipping");
  assert.equal(capturedArgs.options?.jQuery, false, "ContextMenu must have jQuery: false to avoid deprecation warnings");
  assert.equal(capturedArgs.entries.length, 2, "Must register Set and Unset guide entries");
});

test("calculateBushcraftPenalty respects official rules per region and tier", async () => {
  const { calculateBushcraftPenalty } = await import("../scripts/party-actor.mjs");

  // Ambria: no penalty regardless of Bushcraft level
  assert.equal(calculateBushcraftPenalty(0, "ambria"), 0);
  assert.equal(calculateBushcraftPenalty(1, "ambria"), 0);
  assert.equal(calculateBushcraftPenalty(3, "ambria"), 0);

  // Bright Davokar (requires tier 1)
  assert.equal(calculateBushcraftPenalty(1, "bright"), 0);
  assert.equal(calculateBushcraftPenalty(2, "bright"), 0);
  assert.equal(calculateBushcraftPenalty(0, "bright"), -3); // 1 tier below

  // Wild Davokar (requires tier 2)
  assert.equal(calculateBushcraftPenalty(2, "wild"), 0);
  assert.equal(calculateBushcraftPenalty(3, "wild"), 0);
  assert.equal(calculateBushcraftPenalty(1, "wild"), -3); // 1 tier below
  assert.equal(calculateBushcraftPenalty(0, "wild"), -5); // 2 tiers below

  // Dark Davokar (requires tier 3)
  assert.equal(calculateBushcraftPenalty(3, "dark"), 0);
  assert.equal(calculateBushcraftPenalty(2, "dark"), -3); // 1 tier below
  assert.equal(calculateBushcraftPenalty(1, "dark"), -5); // 2 tiers below
  assert.equal(calculateBushcraftPenalty(0, "dark"), -5); // 3 tiers below
});

test("detectBushcraftTier extracts level from system.level or name", async () => {
  const { detectBushcraftTier } = await import("../scripts/party-actor.mjs");

  // Actor without bushcraft
  const noBoonActor = { items: [] };
  assert.deepEqual(detectBushcraftTier(noBoonActor), { hasBushcraft: false, level: 0, item: null });

  // Actor with standard system.level = 2
  const boonLevel2 = {
    items: [
      { type: "boon", name: "Mateiro", system: { reference: "bushcraft", level: 2 } }
    ]
  };
  const res2 = detectBushcraftTier(boonLevel2);
  assert.equal(res2.hasBushcraft, true);
  assert.equal(res2.level, 2);

  // Actor with Mateiro III in name
  const boonNamed3 = {
    items: [
      { type: "boon", name: "Mateiro (Mestre III)", system: { reference: "bushcraft" } }
    ]
  };
  const res3 = detectBushcraftTier(boonNamed3);
  assert.equal(res3.hasBushcraft, true);
  assert.equal(res3.level, 3);

  // Actor with English name Bushcraft
  const boonEnglish = {
    items: [
      { type: "boon", name: "Bushcraft", system: { reference: "bushcraft", level: 1 } }
    ]
  };
  const resEng = detectBushcraftTier(boonEnglish);
  assert.equal(resEng.hasBushcraft, true);
  assert.equal(resEng.level, 1);
});

test("calculateOrientationTarget calculates target and bounds to minimum 1", async () => {
  const { calculateOrientationTarget } = await import("../scripts/party-actor.mjs");

  // Vigilant 15 in Bright Davokar with Mateiro 1 -> target 15
  assert.deepEqual(calculateOrientationTarget(15, 1, "bright"), {
    baseVigilant: 15,
    penalty: 0,
    target: 15
  });

  // Vigilant 13 in Wild Davokar without Mateiro (penalty -5) -> target 8
  assert.deepEqual(calculateOrientationTarget(13, 0, "wild"), {
    baseVigilant: 13,
    penalty: -5,
    target: 8
  });

  // Vigilant 5 in Dark Davokar without Mateiro (penalty -5) -> target 1
  assert.deepEqual(calculateOrientationTarget(5, 0, "dark"), {
    baseVigilant: 5,
    penalty: -5,
    target: 1
  });
});

test("evaluateOrientationRoll classifies Great Success, Normal Success and Failure correctly", async () => {
  const { evaluateOrientationRoll } = await import("../scripts/party-actor.mjs");

  // Great Success by margin >= 5 (target 15, roll 10 -> margin 5)
  const great = evaluateOrientationRoll(10, 15);
  assert.equal(great.verdict, "greatSuccess");
  assert.equal(great.success, true);
  assert.equal(great.greatSuccess, true);
  assert.equal(great.ruinsMod, 2);
  assert.equal(great.enemiesMod, -2);
  assert.equal(great.terrainMod, -2);
  assert.equal(great.neutralDetection, true);
  assert.equal(great.mishap, false);

  // Great Success on natural 1 (target 4, roll 1 -> margin 3, but roll 1)
  const nat1 = evaluateOrientationRoll(1, 4);
  assert.equal(nat1.verdict, "greatSuccess");
  assert.equal(nat1.greatSuccess, true);

  // Normal Success (target 15, roll 13 -> margin 2)
  const normal = evaluateOrientationRoll(13, 15);
  assert.equal(normal.verdict, "success");
  assert.equal(normal.success, true);
  assert.equal(normal.greatSuccess, false);
  assert.equal(normal.ruinsMod, 2);
  assert.equal(normal.enemiesMod, -1);
  assert.equal(normal.terrainMod, -1);
  assert.equal(normal.neutralDetection, true);
  assert.equal(normal.mishap, false);

  // Failure (target 12, roll 13)
  const fail = evaluateOrientationRoll(13, 12);
  assert.equal(fail.verdict, "failure");
  assert.equal(fail.success, false);
  assert.equal(fail.failure, true);
  assert.equal(fail.ruinsMod, 0);
  assert.equal(fail.enemiesMod, 0);
  assert.equal(fail.terrainMod, 0);
  assert.equal(fail.neutralDetection, false);
  assert.equal(fail.mishap, true);
});

test("Template and Stylesheet include orientation panel, buttons and chat card styles", () => {
  assert.match(templateSource, /class="guide-orientation-panel"/);
  assert.match(templateSource, /class="guide-bushcraft-badge/);
  assert.match(templateSource, /data-action="roll-orientation"/);
  assert.match(templateSource, /data-action="reset-orientation"/);

  assert.match(cssSource, /\.tenebre-party-sheet \.guide-orientation-panel/);
  assert.match(cssSource, /\.tenebre-party-sheet \.guide-bushcraft-badge/);
  assert.match(cssSource, /\.tenebre-party-sheet \.btn-orientation-roll\.is-rolling/);
  assert.match(cssSource, /\.tenebre-party-sheet \.orientation-result-badge\.is-rolling/);
});

test("PartyActorSheet._onRollOrientation updates dayState after dice roll and posts chat card", async () => {
  globalThis.game = globalThis.game ?? {};
  globalThis.game.user = globalThis.game.user ?? { isGM: true, id: "u1" };
  globalThis.game.settings = globalThis.game.settings ?? { get: () => false };
  globalThis.game.i18n = globalThis.game.i18n ?? { localize: (k) => k, format: (k, d) => k };
  let sentMessage = null;
  const callSequence = [];
  globalThis.ChatMessage = {
    getSpeaker: () => ({ alias: "Guia" }),
    create: async (d) => {
      sentMessage = d;
      callSequence.push("chatMessage");
      return d;
    }
  };

  const { PartyActorSheet } = await import("../scripts/party-actor.mjs");
  const updates = [];
  const mockPartyActor = {
    id: "p1",
    uuid: "Actor.p1",
    system: {
      location: { region: "bright" },
      expedition: { guideId: "guide-1" }
    },
    update: async (data) => {
      updates.push(data);
      callSequence.push("actorUpdate");
      return data;
    }
  };

  const sheet = new PartyActorSheet(mockPartyActor);
  sheet.render = () => {};
  Object.defineProperty(sheet, "isEditable", { value: true, configurable: true });

  const mockGuide = {
    id: "guide-1",
    name: "Guia Bardo",
    img: "icons/svg/mystery-man.svg",
    system: {
      attributes: {
        vigilant: { total: 15 }
      }
    },
    items: [
      { type: "boon", name: "Mateiro", system: { reference: "bushcraft", level: 1 } }
    ]
  };
  sheet._resolveActor = (id) => (id === "guide-1" ? mockGuide : null);

  await sheet._onRollOrientation();

  assert.equal(callSequence[0], "chatMessage");
  assert.equal(callSequence[1], "actorUpdate");
  assert.equal(updates.length, 1);
  const orientData = updates[0]["system.expedition.dayState.orientation"];
  assert.ok(orientData);
  assert.equal(orientData.rolled, true);
  assert.equal(orientData.target, 15);
  assert.equal(orientData.baseVigilant, 15);
  assert.equal(orientData.penalty, 0);
  assert.ok(["greatSuccess", "success", "failure"].includes(orientData.verdict));
  assert.ok(sentMessage);
  assert.match(sentMessage.content, /class="symbaroum chat ability tenebre-orientation-chat"/);
  assert.match(sentMessage.content, /class="tenebre-berserker-participants"/);
  assert.match(sentMessage.content, /class="tenebre-attribute-test-title"/);
  assert.match(sentMessage.content, /orienta a expedição em/);
  assert.doesNotMatch(sentMessage.content, /\[Davokar.*\((\+|-|±)\d+\)/);
  assert.match(sentMessage.content, /icons\/environment\/wilderness\/tree-ash\.webp/);

  await sheet._onResetOrientation();
  assert.equal(updates.length, 2);
  assert.equal(updates[1]["system.expedition.dayState.orientation"], null);
});

test("getMishapsModifier returns official modifiers per region", async () => {
  const { getMishapsModifier } = await import("../scripts/party-actor.mjs");
  assert.equal(getMishapsModifier("ambria"), 0);
  assert.equal(getMishapsModifier("bright"), 0);
  assert.equal(getMishapsModifier("wild"), 5);
  assert.equal(getMishapsModifier("dark"), 10);
});

test("resolveMishapsTable finds table in world or compendium", async () => {
  const { resolveMishapsTable } = await import("../scripts/party-actor.mjs");

  // World table priority
  globalThis.game = {
    tables: [
      { name: "Tabela 25 - Infortúnios na Davokar", id: "tbl-world" }
    ],
    packs: []
  };

  const worldTable = await resolveMishapsTable();
  assert.equal(worldTable?.id, "tbl-world");

  // Compendium table fallback
  const mockPack = {
    documentName: "RollTable",
    indexed: true,
    index: [{ _id: "tbl-pack", name: "Infortúnios na Davokar" }],
    getDocument: async (id) => ({ id, name: "Infortúnios na Davokar", compendium: true })
  };
  globalThis.game = {
    tables: [],
    packs: new Map([["symbaroum-ind-resources.expedition-tables", mockPack]])
  };

  const packTable = await resolveMishapsTable();
  assert.equal(packTable?.id, "tbl-pack");
});

test("drawMishapTable calls draw for world table and roll/toMessage for compendium table", async () => {
  const { drawMishapTable } = await import("../scripts/party-actor.mjs");

  let drawnWorld = false;
  const worldTable = {
    compendium: null,
    draw: async ({ roll }) => { drawnWorld = true; return { roll }; }
  };
  await drawMishapTable(worldTable, { total: 12 });
  assert.equal(drawnWorld, true);

  let rolledCompendium = false;
  let messagedCompendium = false;
  const compendiumTable = {
    compendium: true,
    roll: async ({ roll }) => { rolledCompendium = true; return { roll, results: [{ text: "Mishap" }] }; },
    toMessage: async (results, { roll }) => { messagedCompendium = true; return {}; }
  };
  await drawMishapTable(compendiumTable, { total: 18 });
  assert.equal(rolledCompendium, true);
  assert.equal(messagedCompendium, true);
});

test("isDavokarMishapsTable strictly rejects military tables and accepts Davokar tables", async () => {
  const { isDavokarMishapsTable } = await import("../scripts/party-actor.mjs");

  // Rejeições obrigatórias
  assert.equal(isDavokarMishapsTable("Tabela 18 - Infortúnios do Exército"), false);
  assert.equal(isDavokarMishapsTable("Infortúnios do Exército"), false);
  assert.equal(isDavokarMishapsTable("Infortúnios do Exercito"), false);
  assert.equal(isDavokarMishapsTable("Army Mishaps"), false);
  assert.equal(isDavokarMishapsTable("Tabela de Infortúnios de Batalha"), false);
  assert.equal(isDavokarMishapsTable("Infortúnios"), false); // Genérico demais sem citar Davokar ou Tabela 25

  // Aceitações obrigatórias
  assert.equal(isDavokarMishapsTable("Tabela 25 - Infortúnios na Davokar"), true);
  assert.equal(isDavokarMishapsTable("Tabela 25"), true);
  assert.equal(isDavokarMishapsTable("Infortúnios na Davokar"), true);
  assert.equal(isDavokarMishapsTable("Table 25 - Mishaps in Davokar"), true);
});

test("resolveMishapsTable ignores Tabela 18 do Exército and auto-creates Tabela 25 if needed", async () => {
  const { resolveMishapsTable } = await import("../scripts/party-actor.mjs");

  let createdTableData = null;
  globalThis.RollTable = {
    create: async (data) => {
      createdTableData = data;
      return { id: "tbl-auto-created", name: data.name };
    }
  };

  // Simula mundo contendo APENAS a Tabela 18 (do Exército)
  globalThis.game = {
    tables: [
      { id: "tbl-exercito", name: "Tabela 18 - Infortúnios do Exército" }
    ],
    packs: [],
    user: { isGM: true }
  };

  const resolved = await resolveMishapsTable();
  // Não pode ter pego a Tabela 18!
  assert.notEqual(resolved?.id, "tbl-exercito");
  // Deve ter auto-criado a Tabela 25 oficial
  assert.equal(resolved?.id, "tbl-auto-created");
  assert.equal(createdTableData?.name, "Tabela 25 - Infortúnios na Davokar");
  assert.equal(createdTableData?.results?.length, 30);
});

test("OFFICIAL_DAVOKAR_MISHAPS contains all 30 entries with valid webp images", async () => {
  const { OFFICIAL_DAVOKAR_MISHAPS, getDavokarMishapsTableData } = await import("../scripts/expedition-data.mjs");
  assert.equal(OFFICIAL_DAVOKAR_MISHAPS.length, 30);
  for (const m of OFFICIAL_DAVOKAR_MISHAPS) {
    assert.ok(m.img, `Mishap ${m.num} must have an img`);
    assert.match(m.img, /^icons\/.+\.webp$/, `Mishap ${m.num} img must be a webp core icon`);
    assert.ok(m.name, `Mishap ${m.num} must have a name`);
  }
  const tableData = getDavokarMishapsTableData();
  assert.equal(tableData.results.length, 30);
  assert.match(tableData.img, /^icons\/.+\.webp$/);
});

test("Party sheet template includes expedition control block and day counter", () => {
  const tpl = fs.readFileSync(path.join(root, "templates/party-sheet.hbs"), "utf8");
  assert.match(tpl, /class="party-storage-location-box party-expedition-control-box/);
  assert.match(tpl, /data-action="start-expedition"/);
  assert.match(tpl, /data-action="end-expedition"/);
  assert.match(tpl, /data-action="next-expedition-day"/);
  assert.match(tpl, /data-action="prev-expedition-day"/);
  assert.match(tpl, /class="day-counter-display"/);
  assert.match(tpl, /{{expedition\.day}}/);
});

test("Party stylesheet contains styles for expedition control block and day counter", () => {
  const css = fs.readFileSync(path.join(root, "styles/symbaroum-ind-resources.css"), "utf8");
  assert.match(css, /\.tenebre-party-sheet \.party-expedition-control-box/);
  assert.match(css, /\.tenebre-party-sheet \.party-expedition-control-box\.is-active/);
  assert.match(css, /\.tenebre-party-sheet \.party-expedition-control-box\.is-inactive/);
  assert.match(css, /\.tenebre-party-sheet \.expedition-day-counter/);
  assert.match(css, /\.tenebre-party-sheet \.btn-expedition-action\.is-start/);
});

test("PartyDataModel defines active and day in expedition schema", async () => {
  const { PartyDataModel } = await import("../scripts/party-actor.mjs");
  const model = new PartyDataModel();
  model.prepareDerivedData();
  assert.equal(model.expedition.active, false);
  assert.equal(model.expedition.day, 0);
});

test("PartyActorSheet getData formats expedition active, day, and isFirstDay", async () => {
  const { PartyActorSheet } = await import("../scripts/party-actor.mjs");

  // Inactive expedition
  const inactiveSheet = new PartyActorSheet({
    system: { expedition: { active: false, day: 0 } },
    flags: {}
  });
  const data1 = await inactiveSheet.getData();
  assert.equal(data1.expedition.active, false);
  assert.equal(data1.expedition.day, 0);

  // Active expedition at day 1
  const activeSheet1 = new PartyActorSheet({
    system: { expedition: { active: true, day: 1 } },
    flags: {}
  });
  const data2 = await activeSheet1.getData();
  assert.equal(data2.expedition.active, true);
  assert.equal(data2.expedition.day, 1);
  assert.equal(data2.expedition.isFirstDay, true);

  // Active expedition at day 3
  const activeSheet3 = new PartyActorSheet({
    system: { expedition: { active: true, day: 3 } },
    flags: {}
  });
  const data3 = await activeSheet3.getData();
  assert.equal(data3.expedition.active, true);
  assert.equal(data3.expedition.day, 3);
  assert.equal(data3.expedition.isFirstDay, false);
});

test("PartyActorSheet._onStartExpedition starts expedition and initializes day 1", async () => {
  const { PartyActorSheet } = await import("../scripts/party-actor.mjs");
  let updatedData = null;
  const mockActor = {
    system: { expedition: { active: false, day: 0 } },
    flags: {},
    update: async (data) => {
      updatedData = data;
    }
  };
  const sheet = new PartyActorSheet(mockActor);
  await sheet._onStartExpedition();

  assert.equal(updatedData["system.expedition.active"], true);
  assert.equal(updatedData["system.expedition.day"], 1);
  assert.equal(updatedData["system.expedition.dayState.orientation"], null);
});

test("PartyActorSheet._onNextExpeditionDay increments day and resets orientation", async () => {
  const { PartyActorSheet } = await import("../scripts/party-actor.mjs");
  let updatedData = null;
  const mockActor = {
    system: { expedition: { active: true, day: 2, dayState: { orientation: { rolled: true } } } },
    flags: {},
    update: async (data) => {
      updatedData = data;
    }
  };
  const sheet = new PartyActorSheet(mockActor);
  await sheet._onNextExpeditionDay();

  assert.equal(updatedData["system.expedition.active"], true);
  assert.equal(updatedData["system.expedition.day"], 3);
  assert.equal(updatedData["system.expedition.dayState.orientation"], null);
});

test("PartyActorSheet._onPrevExpeditionDay decrements day down to 1", async () => {
  const { PartyActorSheet } = await import("../scripts/party-actor.mjs");
  let updatedData = null;
  const mockActor = {
    system: { expedition: { active: true, day: 3 } },
    flags: {},
    update: async (data) => {
      updatedData = data;
    }
  };
  const sheet = new PartyActorSheet(mockActor);
  await sheet._onPrevExpeditionDay();

  assert.equal(updatedData["system.expedition.day"], 2);

  // When at day 1, should not decrement below 1
  mockActor.system.expedition.day = 1;
  updatedData = null;
  await sheet._onPrevExpeditionDay();
  assert.equal(updatedData, null);
});

test("Party sheet template includes Step 2 daily sustenance box and roster", () => {
  const tpl = fs.readFileSync(path.join(root, "templates/party-sheet.hbs"), "utf8");
  assert.match(tpl, /class="party-rations-box/);
  assert.match(tpl, /data-action="feed-member-group"/);
  assert.match(tpl, /data-action="feed-member-personal"/);
  assert.match(tpl, /data-action="feed-all-group"/);
  assert.match(tpl, /data-action="toggle-feed-member"/);
  assert.match(tpl, /class="party-rations-roster"/);
  assert.match(tpl, /class="group-provisions-badge"/);
});

test("Party stylesheet contains styles for party-rations-box and sustenance roster", () => {
  const css = fs.readFileSync(path.join(root, "styles/symbaroum-ind-resources.css"), "utf8");
  assert.match(css, /\.tenebre-party-sheet \.party-rations-box/);
  assert.match(css, /\.tenebre-party-sheet \.party-ration-member-row/);
  assert.match(css, /\.tenebre-party-sheet \.btn-feed-action\.is-group/);
  assert.match(css, /\.tenebre-party-sheet \.btn-feed-action\.is-personal/);
  assert.match(css, /\.tenebre-party-sheet \.btn-feed-all-group/);
  assert.match(css, /\.tenebre-party-sheet \.ration-status-badge\.is-fed/);
});

test("PartyActorSheet getData formats expedition.rations correctly", async () => {
  const { PartyActorSheet } = await import("../scripts/party-actor.mjs");
  const mockActor = {
    system: {
      members: ["m1", "m2"],
      expedition: {
        active: true,
        day: 1,
        dayState: {
          rations: {
            m1: { fed: true, source: "group" }
          }
        }
      }
    },
    flags: {},
    items: new Map([
      ["item-ration", {
        type: "equipment",
        name: "Pão de Viagem",
        system: { number: 5 }
      }]
    ])
  };

  const sheet = new PartyActorSheet(mockActor);
  sheet._resolveActor = (id) => {
    if (id === "m1") {
      return {
        id: "m1",
        name: "Arokh",
        img: "icons/svg/mystery-man.svg",
        items: new Map()
      };
    }
    if (id === "m2") {
      return {
        id: "m2",
        name: "Karan",
        img: "icons/svg/mystery-man.svg",
        items: new Map([
          ["karan-bread", {
            type: "equipment",
            name: "Pão de Viagem",
            system: { number: 2 }
          }]
        ])
      };
    }
    return null;
  };

  const data = await sheet.getData();
  assert.ok(data.expedition.rations);
  assert.equal(data.expedition.rations.hasMembers, true);
  assert.equal(data.expedition.rations.members.length, 2);

  const m1 = data.expedition.rations.members.find(m => m.id === "m1");
  assert.equal(m1.isFed, true);
  assert.equal(m1.fedSource, "group");

  const m2 = data.expedition.rations.members.find(m => m.id === "m2");
  assert.equal(m2.isFed, false);
});

test("PartyActorSheet feeding methods update dayState.rations", async () => {
  const { PartyActorSheet } = await import("../scripts/party-actor.mjs");
  const { RationService } = await import("../scripts/rations.mjs");

  // Stub RationService.consumeDay
  const originalConsumeDay = RationService.consumeDay;
  const originalGetState = RationService.getState;
  RationService.consumeDay = async () => true;
  RationService.getState = () => ({ totalUsesRemaining: 10, name: "Pão de Viagem" });

  try {
    let updatedData = null;
    const mockActor = {
      system: {
        members: ["m1"],
        expedition: { active: true, day: 1, dayState: { rations: {} } }
      },
      flags: {},
      update: async (data) => {
        updatedData = data;
      }
    };

    const sheet = new PartyActorSheet(mockActor);
    sheet._resolveActor = () => ({ id: "m1", name: "Arokh" });

    // Feed member from group
    await sheet._onFeedMemberGroup("m1");
    assert.equal(updatedData["system.expedition.dayState.rations.m1"].fed, true);
    assert.equal(updatedData["system.expedition.dayState.rations.m1"].source, "group");

    // Feed member personal
    updatedData = null;
    await sheet._onFeedMemberPersonal("m1");
    assert.equal(updatedData["system.expedition.dayState.rations.m1"].fed, true);
    assert.equal(updatedData["system.expedition.dayState.rations.m1"].source, "personal");

    // Toggle feed member
    updatedData = null;
    mockActor.system.expedition.dayState.rations.m1 = { fed: true, source: "group" };
    await sheet._onToggleFeedMember("m1");
    assert.equal(updatedData["system.expedition.dayState.rations.m1"], null);
  } finally {
    RationService.consumeDay = originalConsumeDay;
    RationService.getState = originalGetState;
  }
});

test("RationService.consumeDay marks character as fed in active party expedition", async () => {
  const { RationService } = await import("../scripts/rations.mjs");
  const { TenebreSettings } = await import("../scripts/settings.mjs");

  let partyUpdated = null;
  const mockParty = {
    type: "symbaroum-ind-resources.party",
    system: {
      members: ["char-1"],
      expedition: { active: true, day: 1, dayState: { rations: {} } }
    },
    getFlag: () => ({ active: true }),
    update: async (data) => {
      partyUpdated = data;
    },
    sheet: { render: () => {} }
  };

  const mockItem = {
    id: "item-1",
    type: "equipment",
    name: "Pão de Viagem",
    system: { number: 3 },
    getFlag: () => false,
    update: async () => {}
  };

  const mockActor = {
    id: "char-1",
    uuid: "Actor.char-1",
    name: "Arokh",
    items: new Map([["item-1", mockItem]]),
    getFlag: () => ({}),
    setFlag: async () => {}
  };

  globalThis.game = {
    actors: [mockParty, mockActor],
    i18n: {
      localize: (k) => k,
      format: (k) => k
    }
  };
  globalThis.ui = { notifications: { info() {}, warn() {} } };
  globalThis.ChatMessage = {
    getSpeaker: () => ({}),
    create: async () => {}
  };

  const origGet = TenebreSettings.get;
  TenebreSettings.get = (key) => key === "enableRations" ? true : origGet?.(key);

  try {
    const res = await RationService.consumeDay(mockActor, mockItem);
    assert.equal(res, true);
    assert.ok(partyUpdated);
    assert.equal(partyUpdated["system.expedition.dayState.rations.char-1"].fed, true);
    assert.equal(partyUpdated["system.expedition.dayState.rations.char-1"].source, "personal");
  } finally {
    TenebreSettings.get = origGet;
  }
});
