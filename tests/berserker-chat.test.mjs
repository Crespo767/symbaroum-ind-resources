import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const source = read("scripts/berserker-chat.mjs");
const init = read("scripts/init.mjs");
const css = read("styles/symbaroum-ind-resources.css");

const {
  isBerserkerItem,
  isBrimstoneCascadeItem,
  isHolyAuraItem,
  isLayOnHandsItem,
  splitAbilityCaption,
  stripTargetLabel
} = await import("../scripts/berserker-chat.mjs");

test("native ability cards resolve the displayed owned item", () => {
  assert.equal(isBerserkerItem({ system: { reference: "berserker" } }), true);
  assert.equal(isBerserkerItem({ system: { reference: "dominate" } }), false);
  assert.equal(isBerserkerItem(null), false);
  assert.match(source, /\.symbaroum\.chat\.ability/);
  assert.match(source, /const items = Array\.from\(actor\.items \?\? \[\]\)/);
  assert.match(source, /displayedName\.startsWith\(normalize\(item\.name\)\)/);
});

test("ability card shows the attempt before the actor to ability flow", () => {
  assert.match(source, /TENEBRE\.AbilityChat\.Attempt/);
  assert.match(source, /createTextElement\("p", "tenebre-berserker-intro", attemptText \|\| introText\)/);
  assert.match(source, /createAbilityFlow\(actorImage, actorName, abilityImage, caption, item, targetImage, targetName\)/);
  assert.match(source, /createPortrait\(actorImage, actorName, "tenebre-berserker-actor"\),\s*createFlowArrow\(\),\s*createAbilityFigure\(abilityImage, abilityCaption, item\)/);
  assert.match(source, /figure\.append\(image, caption\)/);
  assert.match(css, /\.tenebre-berserker-actor,[\s\S]*?flex-direction:\s*column;[\s\S]*?align-items:\s*center;/);
});

test("ability cards preserve the GM original-message warning contract", () => {
  assert.match(source, /import \{ appendOriginalChatPreview \} from "\.\/chat-original-preview\.mjs"/);
  assert.match(source, /const unadaptedElements = findUnadaptedAbilityElements/);
  assert.match(source, /appendOriginalChatPreview\(card, source, \{/);
  assert.match(source, /hasUnadaptedContent: unadaptedElements\.length > 0/);
  assert.match(source, /!equivalentChatText\(introText, attemptText\)/);
  assert.match(source, /!representedChildren\.has\(child\) && hasMeaningfulContent\(child\)/);
});

test("Imposição de Mãos uses the same ability card and preserves its target and details", () => {
  assert.equal(isLayOnHandsItem({ system: { reference: "layonhands" } }), true);
  assert.equal(isLayOnHandsItem({ system: { reference: "inheritwound" } }), false);
  assert.match(source, /isBerserkerItem\(item\)/);
  assert.match(source, /isLayOnHandsItem\(item\)/);
  assert.match(source, /targetImage = backgroundImageUrl/);
  assert.match(source, /targetName = stripTargetLabel/);
  assert.match(source, /createFlowArrow\(\),\s*createPortrait\(targetImage, targetName, "tenebre-berserker-target"\)/);
  assert.match(source, /source\.querySelectorAll\(":scope > \.finalTxt"\)/);
  assert.match(css, /\.tenebre-berserker-participants\s*\{[\s\S]*?justify-content:\s*center;/);
  assert.equal(stripTargetLabel("Paciente: Argasto"), "Argasto");
});

test("ability roll modifiers remain visible outside the linked ability name", () => {
  assert.deepEqual(splitAbilityCaption("Imposição de Mãos (Novato), armadura obstrutiva"), {
    caption: "Imposição de Mãos (Novato)",
    modifiers: "armadura obstrutiva"
  });
  assert.match(source, /const \{ caption, modifiers \} = splitAbilityCaption/);
  assert.match(source, /tenebre-berserker-modifiers/);
});

test("Aura Sagrada uses the same ability card and keeps damage and corruption details", () => {
  assert.equal(isHolyAuraItem({ system: { reference: "holyaura" } }), true);
  assert.equal(isHolyAuraItem({ system: { reference: "unholyaura" } }), false);
  assert.match(source, /isHolyAuraItem\(item\)/);
  assert.match(source, /POWER_LABEL\.HOLY_AURA/);
  assert.match(source, /source\.querySelectorAll\(":scope > \.finalTxt"\)/);
});

test("Cascata de Enxofre uses the same targeted ability card", () => {
  assert.equal(isBrimstoneCascadeItem({ system: { reference: "brimstonecascade" } }), true);
  assert.equal(isBrimstoneCascadeItem({ system: { reference: "flamewall" } }), false);
  assert.match(source, /isBrimstoneCascadeItem\(item\)/);
  assert.match(source, /POWER_LABEL\.BRIMSTONE_CASCADE/);
  assert.match(source, /targetImage = backgroundImageUrl/);
  assert.match(source, /source\.querySelectorAll\(":scope > \.finalTxt"\)/);
});

test("the displayed ability name opens the owned ability sheet", () => {
  assert.match(source, /className = "content-link tenebre-berserker-ability-link"/);
  assert.match(source, /link\.dataset\.uuid = item\.uuid/);
  assert.match(source, /item\.sheet\?\.render\?\.\(\{ force: true \}\)/);
});

test("Amoque presentation follows the shared Original or Ind Resources setting", () => {
  assert.match(source, /enableCompactNpcAttackChat/);
  assert.match(source, /source\.hidden = true/);
  assert.match(source, /source\.hidden = false/);
  assert.match(init, /import \{ BerserkerChatService \} from "\.\/berserker-chat\.mjs"/);
  assert.match(init, /BerserkerChatService\.register\(\)/);
  assert.match(css, /\.symbaroum\.chat\.ability\.tenebre-berserker-compact/);
});
