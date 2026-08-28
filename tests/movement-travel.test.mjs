import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: class {},
      HandlebarsApplicationMixin: (Base) => class extends Base {}
    }
  }
};
globalThis.Hooks = { once() {}, on() {} };

const {
  MovementService,
  TRAVEL_RATES_KM_PER_DAY,
  getTravelRate,
  isKilometerUnit,
  normalizeTravelConfiguration
} = await import("../scripts/movement-ruler.mjs");

test("travel rates reproduce every entry in the Symbaroum travel table", () => {
  assert.deepEqual(TRAVEL_RATES_KM_PER_DAY.plains, {
    dayMarch: 20, forcedMarch: 40, mortalMarch: 60,
    dayRide: 40, forcedRide: 60, mortalRide: 70
  });
  assert.deepEqual(TRAVEL_RATES_KM_PER_DAY.brightDavokar, {
    dayMarch: 20, forcedMarch: 30, mortalMarch: 40,
    dayRide: 30, forcedRide: 45, mortalRide: 50
  });
  assert.deepEqual(TRAVEL_RATES_KM_PER_DAY.darkDavokar, {
    dayMarch: 10, forcedMarch: 15, mortalMarch: 20,
    dayRide: 10, forcedRide: 15, mortalRide: 20
  });
});

test("journeys along rivers use terrain one step easier", () => {
  assert.equal(getTravelRate({ terrain: "darkDavokar", mode: "forcedMarch", alongRiver: true }), 30);
  assert.equal(getTravelRate({ terrain: "brightDavokar", mode: "dayRide", alongRiver: true }), 40);
  assert.equal(getTravelRate({ terrain: "plains", mode: "mortalRide", alongRiver: true }), 70);
});

test("kilometer scenes are detected without depending on language or accents", () => {
  for (const unit of ["km", "KM", "kilometers", "kilometres", "quilômetros", "quilometros"]) {
    assert.equal(isKilometerUnit(unit), true, unit);
  }
  for (const unit of ["m", "meters", "ft", "milhas", ""]) {
    assert.equal(isKilometerUnit(unit), false, unit);
  }
});

test("the ruler converts scene distance into travel days", () => {
  const scene = { grid: { units: "km" } };
  const token = {
    parent: scene,
    flags: {
      "symbaroum-ind-resources": {
        travel: {
          terrain: "brightDavokar",
          mode: "forcedRide",
          alongRiver: false
        }
      }
    }
  };

  assert.equal(MovementService.isTravelScene(scene), true);
  assert.deepEqual(MovementService.getTravelEstimate(90, token), {
    terrain: "brightDavokar",
    mode: "forcedRide",
    alongRiver: false,
    distance: 90,
    rate: 45,
    days: 2
  });
});

test("travel profiles belong to tokens instead of actors or scenes", () => {
  const first = { flags: { "symbaroum-ind-resources": { travel: { terrain: "plains", mode: "dayMarch" } } } };
  const second = { flags: { "symbaroum-ind-resources": { travel: { terrain: "darkDavokar", mode: "dayMarch" } } } };

  assert.equal(MovementService.getTravelEstimate(40, first).days, 2);
  assert.equal(MovementService.getTravelEstimate(40, second).days, 4);
});

test("invalid token travel flags fall back to the safe default profile", () => {
  assert.deepEqual(normalizeTravelConfiguration({ terrain: "void", mode: "fly", alongRiver: "false" }), {
    terrain: "plains",
    mode: "dayMarch",
    alongRiver: false
  });
});

test("travel configuration is exposed in the token HUD and persisted on the token", async () => {
  const source = await readFile(new URL("../scripts/movement-ruler.mjs", import.meta.url), "utf8");

  assert.match(source, /Hooks\.on\("renderTokenHUD"/);
  assert.match(source, /data-tenebre-travel-control/);
  assert.match(source, /tokenDocument\.update\(\{[\s\S]*?flags\.\$\{MODULE_ID\}\.travel/);
  assert.doesNotMatch(source, /Hooks\.on\("renderSceneConfig"/);
});

test("world-map markers are not blocked by tactical actor conditions", () => {
  const scene = { grid: { units: "km" } };
  const token = {
    parent: scene,
    actor: { name: "Travel marker", statuses: new Set(["prone"]), effects: [] }
  };

  assert.equal(MovementService.validateMovement(token, {}), true);
});
