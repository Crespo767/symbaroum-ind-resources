import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  PartyActor,
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
        ArrayField: class { constructor(type, opts) { this.type = type; this.options = opts; } }
      }
    }
  };

  const schema = PartyDataModel.defineSchema();
  assert.ok(schema.motto, "motto field exists");
  assert.ok(schema.description, "description field exists");
  assert.ok(schema.members, "members field exists");
  assert.ok(schema.isParty, "isParty field exists");
});

test("PartyActor prepares derived data safely with isParty flag", () => {
  const actor = new PartyActor();
  actor.system = {};
  actor.prepareBaseData();
  actor.prepareDerivedData();
  assert.equal(actor.system.isParty, true);
});

test("PartyActorService registers party type in game and CONFIG without mutating frozen arrays", () => {
  const registeredSheets = [];
  globalThis.game = {
    system: {
      documentTypes: {
        Actor: Object.freeze(["player", "monster"])
      }
    },
    documentTypes: {
      Actor: Object.freeze(["player", "monster"])
    },
    model: {
      Actor: Object.freeze({ player: {}, monster: {} })
    }
  };

  let playerDerivedDataCalled = false;
  class MockSymbaroumActor {
    static get TYPES() {
      return Object.keys(globalThis.game.model.Actor);
    }
    prepareBaseData() {}
    prepareDerivedData() {
      if (this.type === "player") playerDerivedDataCalled = true;
    }
  }

  globalThis.CONFIG = {
    Actor: {
      dataModels: {},
      documentClasses: {},
      typeLabels: {},
      documentClass: MockSymbaroumActor
    }
  };

  globalThis.foundry = {
    abstract: {
      TypeDataModel: class {}
    },
    documents: {
      collections: {
        Actors: {
          registerSheet: (moduleId, sheetClass, options) => {
            registeredSheets.push({ moduleId, sheetClass, options });
          }
        }
      }
    },
    utils: {
      mergeObject: (a, b) => ({ ...a, ...b })
    }
  };

  PartyActorService.register();

  assert.ok(globalThis.CONFIG.Actor.documentClass.TYPES.includes("party"), "party included in CONFIG.Actor.documentClass.TYPES");
  assert.ok(globalThis.game.system.documentTypes.Actor.includes("party"), "party added to game.system.documentTypes.Actor");
  assert.equal(globalThis.CONFIG.Actor.documentClasses.party, PartyActor, "documentClass party registered");
  assert.equal(globalThis.CONFIG.Actor.typeLabels.party, "TENEBRE.Party.TypeLabel", "typeLabel registered");
  assert.equal(registeredSheets.length, 1, "sheet was registered");
  assert.ok(registeredSheets[0].options.types.includes("party"), "sheet registered for party type");

  // Verify prepareDerivedData protection
  const partyActor = new MockSymbaroumActor();
  partyActor.type = "party";
  partyActor.system = {};
  partyActor.prepareDerivedData();
  assert.equal(partyActor.system.isParty, true, "party actor marked as isParty without error");
  assert.equal(playerDerivedDataCalled, false, "player logic not called for party");

  const playerActor = new MockSymbaroumActor();
  playerActor.type = "player";
  playerActor.system = {};
  playerActor.prepareDerivedData();
  assert.equal(playerDerivedDataCalled, true, "player logic preserved for player");

  PartyActorService.registerSetup();
  assert.ok(globalThis.game.documentTypes.Actor.includes("party"), "party added to game.documentTypes.Actor in setup");
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
});

test("PartyActorService is hooked into init and setup in scripts/init.mjs", () => {
  assert.match(initSource, /PartyActorService\.register\(\)/, "called in init");
  assert.match(initSource, /PartyActorService\.registerSetup\(\)/, "called in setup");
  assert.match(initSource, /party:\s*PartyActorService/, "exposed in api");
});

test("PartyActorService._injectCreateOption injects party option when missing in actor create dialog", () => {
  const options = [
    { value: "player", textContent: "Jogador" },
    { value: "monster", textContent: "Monstro" }
  ];
  const select = {
    name: "type",
    querySelector: (sel) => {
      if (sel.includes("player")) return options.find(o => o.value === "player");
      if (sel.includes("party")) return options.find(o => o.value === "party");
      return null;
    },
    appendChild: (opt) => options.push(opt)
  };
  const mockHtml = {
    querySelector: (sel) => (sel === 'select[name="type"]' ? select : null)
  };

  globalThis.document = {
    createElement: () => ({ value: "", textContent: "" })
  };

  PartyActorService._injectCreateOption(mockHtml);

  assert.ok(options.some(o => o.value === "party"), "party option injected into select");
});
