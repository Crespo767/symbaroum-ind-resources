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
