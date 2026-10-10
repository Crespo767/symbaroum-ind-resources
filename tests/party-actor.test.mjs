import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  PARTY_ACTOR_TYPE,
  PartyDataModel,
  PartyActorSheet,
  PartyActorService
} from "../scripts/party-actor.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const initSource = fs.readFileSync(path.join(root, "scripts/init.mjs"), "utf8");

test("PartyDataModel defines expected party schema", () => {
  globalThis.foundry = {
    abstract: {
      TypeDataModel: class {}
    },
    data: {
      fields: {
        BooleanField: class { constructor(opts) { this.options = opts; } },
        StringField: class { constructor(opts) { this.options = opts; } },
        HTMLField: class { constructor(opts) { this.options = opts; } },
        ArrayField: class { constructor(type, opts) { this.type = type; this.options = opts; } },
        SchemaField: class { constructor(fields) { this.fields = fields; } },
        NumberField: class { constructor(opts) { this.options = opts; } }
      }
    }
  };

  const schema = PartyDataModel.defineSchema();
  assert.ok(schema.motto, "motto field exists");
  assert.ok(schema.description, "description field exists");
  assert.ok(schema.members, "members field exists");
  assert.ok(schema.isParty, "isParty field exists");
  assert.ok(schema.experience, "experience field exists");
});

test("PartyDataModel derives isParty and available experience", () => {
  const model = new PartyDataModel();
  model.experience = { total: 100, artifactrr: 10, spent: 25, available: 0 };
  model.prepareDerivedData();
  assert.equal(model.isParty, true);
  assert.equal(model.experience.available, 65);
});

test("PartyActorService uses the module sub-type declared in module.json and never rewrites core type lists", () => {
  const registeredSheets = [];
  const coreTypes = Object.freeze(["player", "monster", PARTY_ACTOR_TYPE]);
  globalThis.game = { documentTypes: { Actor: coreTypes }, modules: new Map() };

  let systemDerivedCalls = 0;
  class MockSymbaroumActor {
    prepareBaseData() {}
    prepareDerivedData() { systemDerivedCalls += 1; }
  }
  globalThis.CONFIG = { Actor: { dataModels: {}, typeLabels: {}, documentClass: MockSymbaroumActor } };
  globalThis.foundry = {
    abstract: { TypeDataModel: class {} },
    documents: { collections: { Actors: { registerSheet: (moduleId, sheetClass, options) => registeredSheets.push({ moduleId, sheetClass, options }) } } }
  };

  PartyActorService.register();

  assert.equal(PARTY_ACTOR_TYPE, "symbaroum-ind-resources.party");
  assert.equal(CONFIG.Actor.dataModels[PARTY_ACTOR_TYPE], PartyDataModel);
  assert.equal(CONFIG.Actor.typeLabels[PARTY_ACTOR_TYPE], "TENEBRE.Party.TypeLabel");
  assert.deepEqual(registeredSheets[0].options.types, [PARTY_ACTOR_TYPE]);
  assert.equal(game.documentTypes.Actor, coreTypes, "core type list untouched");

  const party = Object.assign(new MockSymbaroumActor(), { type: PARTY_ACTOR_TYPE });
  party.prepareDerivedData();
  assert.equal(systemDerivedCalls, 0, "system combat calculations skipped for the party");
  Object.assign(new MockSymbaroumActor(), { type: "player" }).prepareDerivedData();
  assert.equal(systemDerivedCalls, 1, "player calculations preserved");

  const manifest = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8"));
  assert.deepEqual(manifest.documentTypes.Actor, { party: {} });
  const source = fs.readFileSync(path.join(root, "scripts/party-actor.mjs"), "utf8");
  assert.doesNotMatch(source, /defineProperty|documentClasses|_injectCreateOption/);
});

test("PartyActorSheet has symbaroum classes and valid template path", () => {
  globalThis.foundry = {
    appv1: {
      sheets: {
        ActorSheet: class {
          static get defaultOptions() {
            return { classes: ["sheet"] };
          }
        }
      }
    },
    utils: {
      mergeObject: (a, b) => ({ ...a, ...b, classes: [...(a.classes || []), ...(b.classes || [])] })
    }
  };

  const options = PartyActorSheet.defaultOptions;
  assert.ok(options.classes.includes("symbaroum"), "has symbaroum class");
  assert.ok(options.classes.includes("party"), "has party class");
  assert.match(options.template, /templates\/party-sheet\.hbs$/, "template matches party-sheet.hbs");
  assert.ok(Array.isArray(options.tabs), "has tabs configured");
  assert.equal(options.tabs[0].initial, "characters", "initial tab is characters");
});

test("PartyActorService is registered during init and exposed in the API", () => {
  assert.match(initSource, /PartyActorService\.register\(\)/, "called in init");
  assert.doesNotMatch(initSource, /registerSetup/);
  assert.match(initSource, /party:\s*PartyActorService/, "exposed in api");
});

test("PartyActorSheet manages members via _onDropActor, _onRemoveMember, and getData", async () => {
  const updates = [];
  const mockPartyActor = {
    id: "party123",
    uuid: "Actor.party123",
    type: PARTY_ACTOR_TYPE,
    system: {
      members: ["hero1"]
    },
    update: async (data) => {
      updates.push(data);
      if (data["system.members"]) {
        mockPartyActor.system.members = data["system.members"];
      }
      return mockPartyActor;
    }
  };

  const hero1 = {
    id: "hero1",
    uuid: "Actor.hero1",
    name: "Hero 1",
    img: "hero1.png",
    type: "player",
    system: {
      bio: { occupation: "Médico", race: "Ambriano" },
      experience: { total: 30, available: 12 }
    }
  };
  const hero2 = { id: "hero2", uuid: "Actor.hero2", name: "Hero 2", img: "hero2.png", type: "player", system: { bio: { race: "Bárbaro" } } };
  const anotherParty = { id: "party999", uuid: "Actor.party999", type: PARTY_ACTOR_TYPE };

  const actorsMap = new Map([
    ["hero1", hero1],
    ["hero2", hero2],
    ["party999", anotherParty]
  ]);
  globalThis.game = {
    actors: actorsMap
  };

  const sheet = new PartyActorSheet();
  sheet.actor = mockPartyActor;
  sheet.isEditable = true;

  // 1. getData resolves members with occupation and XP
  const data = await sheet.getData();
  assert.equal(data.members.length, 1);
  assert.equal(data.members[0].name, "Hero 1");
  assert.equal(data.members[0].occupation, "Médico");
  assert.equal(data.members[0].totalXp, 30);
  assert.equal(data.members[0].availableXp, 12);

  // 2. _onDropActor rejects self
  const dropSelf = await sheet._onDropActor({}, { id: "party123" });
  assert.equal(dropSelf, false, "cannot drop self onto party");

  // 3. _onDropActor rejects another party actor
  const dropParty = await sheet._onDropActor({}, { id: "party999" });
  assert.equal(dropParty, false, "cannot drop party actor onto party");

  // 4. _onDropActor rejects already existing member
  const dropDuplicate = await sheet._onDropActor({}, { id: "hero1" });
  assert.equal(dropDuplicate, false, "cannot drop duplicate member");

  // 5. _onDropActor successfully adds a new character
  const dropSuccess = await sheet._onDropActor({}, { id: "hero2" });
  assert.ok(dropSuccess, "adds new member successfully");
  assert.deepEqual(mockPartyActor.system.members, ["hero1", "hero2"]);

  // 6. _onRemoveMember removes a member
  await sheet._onRemoveMember("hero1");
  assert.deepEqual(mockPartyActor.system.members, ["hero2"]);
});

test("PartyActorSheet template contains only total and artifactrr experience fields with correct tooltips", () => {
  const templatePath = path.join(root, "templates/party-sheet.hbs");
  const templateContent = fs.readFileSync(templatePath, "utf8");

  assert.match(templateContent, /name="system\.experience\.total"/, "has experience.total field");
  assert.match(templateContent, /name="system\.experience\.artifactrr"/, "has experience.artifactrr field");
  assert.ok(!templateContent.includes('name="system.experience.spent"'), "does not contain experience.spent field");
  assert.ok(!templateContent.includes('name="system.experience.available"'), "does not contain experience.available field");

  assert.match(templateContent, /data-tooltip="\{\{localize ["']TENEBRE\.Party\.ExperienceTotalTooltip["']\}\}"/);
  assert.match(templateContent, /data-tooltip="\{\{localize ["']TENEBRE\.Party\.ExperienceArtifactrrTooltip["']\}\}"/);

  const ptBr = JSON.parse(fs.readFileSync(path.join(root, "languages/pt-BR.json"), "utf8"));
  const en = JSON.parse(fs.readFileSync(path.join(root, "languages/en.json"), "utf8"));

  assert.ok(ptBr["TENEBRE.Party.ExperienceTotalTooltip"], "pt-BR has ExperienceTotalTooltip");
  assert.ok(ptBr["TENEBRE.Party.ExperienceArtifactrrTooltip"], "pt-BR has ExperienceArtifactrrTooltip");
  assert.ok(en["TENEBRE.Party.ExperienceTotalTooltip"], "en has ExperienceTotalTooltip");
  assert.ok(en["TENEBRE.Party.ExperienceArtifactrrTooltip"], "en has ExperienceArtifactrrTooltip");
});

test("PartyActorSheet member cards have parchment background and foreground class", () => {
  const templatePath = path.join(root, "templates/party-sheet.hbs");
  const templateContent = fs.readFileSync(templatePath, "utf8");
  assert.match(
    templateContent,
    /class="[^"]*party-member-card\s+foreground[^"]*"/,
    "party-member-card has foreground class"
  );

  const cssPath = path.join(root, "styles/symbaroum-ind-resources.css");
  const cssContent = fs.readFileSync(cssPath, "utf8");
  assert.match(
    cssContent,
    /\.tenebre-party-sheet\s+\.party-member-card\s*\{[^}]*background-image:\s*url\(["']?\/systems\/symbaroum\/asset\/image\/foreground\.webp["']?\)/,
    "party-member-card has foreground.webp background-image"
  );
  assert.match(
    cssContent,
    /\.tenebre-party-sheet\s+\.party-member-card\s*\{[^}]*background-color:\s*#e2ddcf/,
    "party-member-card has solid fallback background-color"
  );
});

test("PartyActorSheet resolves top 4 attributes and delegates attribute rolls", async () => {
  let rolledAttribute = null;
  const mockHero = {
    id: "heroX",
    name: "Hero X",
    system: {
      attributes: {
        accurate: { total: 13, label: "ATTRIBUTE.ACCURATE" },
        cunning: { total: 15, label: "ATTRIBUTE.CUNNING" },
        discreet: { total: 10, label: "ATTRIBUTE.DISCREET" },
        persuasive: { total: 9, label: "ATTRIBUTE.PERSUASIVE" },
        quick: { total: 11, label: "ATTRIBUTE.QUICK" },
        resolute: { total: 7, label: "ATTRIBUTE.RESOLUTE" },
        strong: { total: 10, label: "ATTRIBUTE.STRONG" },
        vigilant: { total: 5, label: "ATTRIBUTE.VIGILANT" }
      }
    },
    rollAttribute: async (attr) => {
      rolledAttribute = attr;
      return true;
    }
  };

  const sheet = new PartyActorSheet();
  sheet.actor = { system: { members: ["heroX"] } };
  globalThis.game = {
    actors: new Map([["heroX", mockHero]]),
    i18n: {
      localize: (key) => {
        const dict = {
          "ATTRIBUTE.CUNNING": "Astuto",
          "ATTRIBUTE.CUNNINGABBR": "AST",
          "ATTRIBUTE.ACCURATE": "Preciso",
          "ATTRIBUTE.ACCURATEABBR": "PRE",
          "ATTRIBUTE.QUICK": "Rápido",
          "ATTRIBUTE.QUICKABBR": "RAP",
          "ATTRIBUTE.STRONG": "Vigoroso",
          "ATTRIBUTE.STRONGABBR": "VGR"
        };
        return dict[key] || key;
      }
    }
  };

  const top = sheet._getMemberTopAttributes(mockHero, 4);
  assert.equal(top.length, 4, "returns exactly 4 attributes");
  assert.equal(top[0].key, "cunning");
  assert.equal(top[0].total, 15);
  assert.equal(top[0].abbr, "AST");
  assert.equal(top[1].key, "accurate");
  assert.equal(top[1].total, 13);
  assert.equal(top[1].abbr, "PRE");
  assert.equal(top[2].key, "quick");
  assert.equal(top[2].total, 11);
  assert.equal(top[2].abbr, "RAP");
  assert.equal(top[3].total, 10);

  // Test roll delegation
  await sheet._onRollMemberAttribute("heroX", "cunning");
  assert.equal(rolledAttribute, "cunning", "delegates roll to memberActor.rollAttribute");

  // Test template includes attributes badges
  const templatePath = path.join(root, "templates/party-sheet.hbs");
  const templateContent = fs.readFileSync(templatePath, "utf8");
  assert.match(templateContent, /class="member-top-attributes"/);
  assert.match(templateContent, /data-action="roll-member-attribute"/);
  assert.match(templateContent, /class="member-attr-badge"/);

  // Test css styles
  const cssPath = path.join(root, "styles/symbaroum-ind-resources.css");
  const cssContent = fs.readFileSync(cssPath, "utf8");
  assert.match(cssContent, /\.tenebre-party-sheet\s+\.member-top-attributes/);
  assert.match(cssContent, /\.tenebre-party-sheet\s+\.member-attr-badge/);

  // Test localization
  const ptBr = JSON.parse(fs.readFileSync(path.join(root, "languages/pt-BR.json"), "utf8"));
  const en = JSON.parse(fs.readFileSync(path.join(root, "languages/en.json"), "utf8"));
  assert.ok(ptBr["TENEBRE.Party.TopAttributesTooltip"], "pt-BR has TopAttributesTooltip");
  assert.ok(en["TENEBRE.Party.TopAttributesTooltip"], "en has TopAttributesTooltip");
});

test("PartyActorSheet defines Inventory tab next to Characters tab", () => {
  const templatePath = path.join(root, "templates/party-sheet.hbs");
  const templateContent = fs.readFileSync(templatePath, "utf8");

  assert.match(templateContent, /data-tab="characters"/, "has characters tab item");
  assert.match(templateContent, /data-tab="inventory"/, "has inventory tab item");
  assert.match(templateContent, /class="[^"]*tab[^"]*"\s+data-group="primary"\s+data-tab="inventory"/, "has inventory tab content container");

  const ptBr = JSON.parse(fs.readFileSync(path.join(root, "languages/pt-BR.json"), "utf8"));
  const en = JSON.parse(fs.readFileSync(path.join(root, "languages/en.json"), "utf8"));
  assert.equal(ptBr["TENEBRE.Party.TabInventory"], "INVENTÁRIO");
  assert.equal(en["TENEBRE.Party.TabInventory"], "INVENTORY");
  assert.ok(ptBr["TENEBRE.Party.InventoryEmptyTitle"], "pt-BR has InventoryEmptyTitle");
  assert.ok(en["TENEBRE.Party.InventoryEmptyTitle"], "en has InventoryEmptyTitle");

  const cssPath = path.join(root, "styles/symbaroum-ind-resources.css");
  const cssContent = fs.readFileSync(cssPath, "utf8");
  assert.match(cssContent, /\.tenebre-party-sheet\s+\.party-inventory/);
});




