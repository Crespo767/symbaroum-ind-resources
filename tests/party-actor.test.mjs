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

test("PartyDataModel keeps legacy expedition fields in its schema", async () => {
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
  assert.ok(schema.expedition.fields.dayState);
  assert.ok(schema.location.fields.region);

  const model = new PartyDataModel();
  const saved = { active: true, day: 4, guideId: "guide", dayState: { orientation: { rolled: true } } };
  model.expedition = structuredClone(saved);
  model.prepareDerivedData();
  assert.deepEqual(model.expedition, saved);
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

  const mockActor = { id: "p1", system: {} };
  const sheet = new PartyActorSheet(mockActor);
  const mockRoot = { querySelectorAll: () => [] };
  sheet._bindMemberContextMenu(mockRoot);

  assert.ok(capturedArgs, "ContextMenu should be instantiated");
  assert.equal(capturedArgs.selector, ".party-member-card[data-actor-id]");
  assert.equal(capturedArgs.options?.fixed, true, "ContextMenu must have fixed: true to prevent container clipping");
  assert.equal(capturedArgs.options?.jQuery, false, "ContextMenu must have jQuery: false to avoid deprecation warnings");
  assert.deepEqual(capturedArgs.entries.map(entry => entry.name), [
    "Abrir ficha do personagem", "Mover para Companheiros", "Mover para Jogadores", "Remover do grupo"
  ]);
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

test("PartyDataModel defines active and day in expedition schema", async () => {
  const { PartyDataModel } = await import("../scripts/party-actor.mjs");
  const model = new PartyDataModel();
  model.prepareDerivedData();
  assert.equal(model.expedition.active, false);
  assert.equal(model.expedition.day, 0);
});
