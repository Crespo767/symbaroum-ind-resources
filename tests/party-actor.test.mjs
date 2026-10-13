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

test("Party sheet template includes party-region and party-location controls in header", () => {
  assert.match(templateSource, /class="party-region"/);
  assert.match(templateSource, /name="system\.location\.region"/);
  assert.match(templateSource, /class="party-location"/);
  assert.match(templateSource, /name="system\.location\.name"/);
});

test("Stylesheet contains rules for party-region and party-location", () => {
  assert.match(cssSource, /\.sheet-header \.party-region/);
  assert.match(cssSource, /\.sheet-header \.party-location/);
  assert.match(cssSource, /\.party-region select/);
  assert.match(cssSource, /\.party-location input/);
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

