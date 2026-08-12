import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  extractWeaponQualityId,
  injectWeaponQualityTooltips,
  weaponQualityTooltipKey
} from "../scripts/weapon-quality-tooltips.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const ptBr = JSON.parse(read("languages/pt-BR.json"));
const en = JSON.parse(read("languages/en.json"));
const sheetUi = read("scripts/sheet-ui.mjs");
const css = read("styles/symbaroum-ind-resources.css");

const systemWeaponQualities = [
  "flexible", "bastard", "returning", "blunt", "short", "unwieldy", "wrecking", "concealed",
  "balanced", "deepImpact", "jointed", "ensnaring", "long", "massive", "precise", "bloodLetting",
  "areaMeleeRadius", "areaShortRadius", "areaCone", "acidcoated", "bane", "deathrune", "desecrated",
  "flaming", "hallowed", "poison", "thundering", "mystical", "staffFightingCompatibility",
  "swordSaintCompatibility", "knifePlayCompatibility", "staffMagicCompatibility"
];

test("every Symbaroum weapon quality and compatibility has Portuguese and English help", () => {
  for (const quality of systemWeaponQualities) {
    const key = weaponQualityTooltipKey(quality);
    assert.ok(key, `missing tooltip key for ${quality}`);
    assert.ok(ptBr[key]?.length > 20, `missing Portuguese description for ${quality}`);
    assert.ok(en[key]?.length > 20, `missing English description for ${quality}`);
  }
});

test("quality ids are extracted from the native Symbaroum label target", () => {
  const label = { getAttribute: () => "weapon-id-system.qualities.deepImpact" };
  assert.equal(extractWeaponQualityId(label), "deepImpact");
  assert.equal(extractWeaponQualityId({ getAttribute: () => "weapon-name" }), null);
});

test("the injector adds Foundry tooltips to native labels without replacing their content", () => {
  const attributes = new Map([["for", "weapon-id-system.qualities.long"]]);
  const label = {
    textContent: "Longa",
    dataset: {},
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, value)
  };
  const domRoot = { querySelectorAll: () => [label] };
  const count = injectWeaponQualityTooltips(domRoot, { localize: (key) => ptBr[key] ?? key });

  assert.equal(count, 1);
  assert.equal(label.textContent, "Longa");
  assert.equal(label.dataset.tooltip, ptBr["TENEBRE.WeaponQualityTooltip.long"]);
  assert.equal(label.dataset.tooltipDirection, "UP");
  assert.equal(label.dataset.tenebreQualityTooltip, "true");
  assert.equal(attributes.get("aria-description"), ptBr["TENEBRE.WeaponQualityTooltip.long"]);
});

test("weapon sheets receive tooltips before edit-permission-only injections", () => {
  const tooltipCall = sheetUi.indexOf('if (item.type === "weapon")');
  const ownerGuard = sheetUi.indexOf("if (!item.isOwner && !game.user.isGM) return", tooltipCall);
  assert.ok(tooltipCall >= 0 && ownerGuard > tooltipCall);
  assert.match(css, /\[data-tenebre-quality-tooltip="true"\][\s\S]*?cursor:\s*help/);
});
