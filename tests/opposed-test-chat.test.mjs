import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const source = read("scripts/opposed-test-chat.mjs");
const init = read("scripts/init.mjs");
const css = read("styles/symbaroum-ind-resources.css");

const {
  formatAttributeTestResult,
  formatAttributeTestTitle,
  formatOpposedTestResult
} = await import("../scripts/opposed-test-chat.mjs");

test("opposed-test outcome reports success or failure and keeps critical text", () => {
  assert.equal(formatOpposedTestResult("Kvarek, bárbaro mercenário", true), "Kvarek, bárbaro mercenário obtém sucesso.");
  assert.equal(formatOpposedTestResult("Kvarek", false), "Kvarek obtém falha.");
  assert.equal(
    formatOpposedTestResult("Kvarek", false, "Falha Crítica : Ataque Livre do Oponente"),
    "Kvarek obtém falha. — Falha Crítica : Ataque Livre do Oponente"
  );
});

test("single Attribute tests use a character-focused title and outcome", () => {
  assert.equal(
    formatAttributeTestTitle("Bartolom, Mago da Ordo Mágica", "Persuasivo"),
    "Bartolom, Mago da Ordo Mágica realiza um teste de Persuasivo"
  );
  assert.equal(
    formatAttributeTestResult(true),
    "Sucesso"
  );
  assert.equal(
    formatAttributeTestResult(false),
    "Falha"
  );
});

test("the target portrait is captured synchronously in the native ChatMessage", () => {
  assert.match(source, /Hooks\.on\("preCreateChatMessage"/);
  assert.match(source, /opposedTestTarget/);
  assert.match(source, /message\.updateSource\(\{ flags \}\)/);
  assert.doesNotMatch(source, /ChatMessage(?:\.implementation)?\.create|ChatMessage\.create/);
});

test("only pure native opposed Attribute rolls receive the compact presentation", () => {
  assert.match(source, /\.symbaroum\.chat\.roll/);
  assert.match(source, /source\.querySelector\("\[data-item-id\]"\)/);
  assert.match(source, /parseOpposedTest\(source\.querySelector\(":scope > h3"\)/);
  assert.match(source, /\.symba-rolls\.roll\.d20\.success, \.symba-rolls\.roll\.d20\.failure/);
});

test("compact opposed tests show two portraits and a two-column roll summary", () => {
  assert.match(source, /portraits\.append\(createPortrait\(model\.actor\), createPortrait\(model\.target\)\)/);
  assert.match(source, /tenebre-opposed-test-formula/);
  assert.match(source, /TENEBRE\.OpposedTestChat\.Objective/);
  assert.match(source, /TENEBRE\.OpposedTestChat\.Roll/);
  assert.match(css, /\.tenebre-opposed-test-portraits\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, 62px\);/);
  assert.match(css, /\.tenebre-opposed-test-roll-summary\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
});

test("compact single Attribute tests show one portrait and a colored compact outcome", () => {
  assert.match(source, /kind: "attribute"/);
  assert.match(source, /tenebre-attribute-test-title/);
  assert.match(source, /createPortrait\(model\.actor, true\)/);
  assert.match(source, /tenebre-attribute-test-success/);
  assert.match(source, /tenebre-attribute-test-failure/);
  assert.match(source, /const unadaptedElements = \[marginText \? marginElement : null, tooltipElement\]\.filter\(Boolean\)/);
  assert.doesNotMatch(source, /tenebre-attribute-test-margin/);
  assert.match(css, /\.tenebre-opposed-test-portraits\.tenebre-attribute-test-portrait\s*\{[\s\S]*?display:\s*flex;/);
  assert.match(css, /\.tenebre-attribute-test-character\s*\{[\s\S]*?grid-template-rows:\s*62px auto;/);
  assert.match(css, /\.tenebre-attribute-test-success\s*\{[\s\S]*?color:\s*#18520b;/);
  assert.match(css, /\.tenebre-attribute-test-failure\s*\{[\s\S]*?color:\s*#aa0200;/);
});

test("opposed tests follow the existing Original or Ind Resources chat setting", () => {
  assert.match(source, /enableCompactNpcAttackChat/);
  assert.match(source, /source\.hidden = true/);
  assert.match(source, /source\.hidden = false/);
  assert.match(init, /import \{ OpposedTestChatService \} from "\.\/opposed-test-chat\.mjs"/);
  assert.match(init, /OpposedTestChatService\.register\(\)/);
});

test("unadapted opposed-test details remain available to the GM through the original preview", () => {
  assert.match(source, /const unadaptedElements = \[marginText \? marginElement : null, tooltipElement\]\.filter\(Boolean\)/);
  assert.match(source, /unadaptedElements: model\.unadaptedElements/);
  assert.match(source, /appendOriginalChatPreview\(card, source/);
});
