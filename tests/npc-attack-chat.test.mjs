import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const source = read("scripts/npc-attack-chat.mjs");
const settings = read("scripts/settings.mjs");
const template = read("templates/settings.hbs");
const css = read("styles/symbaroum-ind-resources.css");
const ptBr = JSON.parse(read("languages/pt-BR.json"));

const {
  compactActorName,
  buildPainThresholdOutcomeText,
  canViewNpcDamageDetails,
  extractDamageFormula,
  extractMissOutcomeSuffix,
  isArmorProtectionText,
  isPainStunText,
  isPlayerNpcAttack,
  parseDamageResult,
  parseOpposedTest,
  parseRollValue,
  resolveAttackFlow,
  resolveActiveArmor,
  stripNpcParenthetical
} = await import("../scripts/npc-attack-chat.mjs");

test("portrait captions use only the first actor name", () => {
  assert.equal(compactActorName("Bartolom, Mago da Ordo Mágica"), "Bartolom");
  assert.equal(compactActorName("Sebastian Valerius"), "Sebastian");
  assert.equal(compactActorName("Ludo"), "Ludo");
});

test("NPC parenthetical name details are omitted only from chat presentation", () => {
  assert.equal(stripNpcParenthetical("Ladrões (tanto quanto os PJs)"), "Ladrões");
  assert.equal(stripNpcParenthetical("Ludo (Ferido) (Furioso)"), "Ludo");
  assert.equal(stripNpcParenthetical("Bartolom"), "Bartolom");
  assert.match(source, /sourceName: attackerName/);
  assert.match(source, /sourceName: targetName/);
  assert.match(source, /model\.action = replaceNpcNames\(model\.action, model\)/);
  assert.match(source, /return replaceNpcNames\(model\.outcome, model\)/);
});

test("NPC defense test objective uses the values already published by Symbaroum", () => {
  const parsed = parseOpposedTest("Defesa : (16) ⬅ Persuasivo : (-5)");
  assert.deepEqual(parsed.attributes, [
    { label: "Defesa", value: 16 },
    { label: "Persuasivo", value: -5 }
  ]);
  assert.equal(parsed.modifier, 0);
  assert.equal(parsed.objective, 11);
  assert.equal(parsed.direction, "←");

  const modified = parseOpposedTest("Defense (12) ← Accurate (-3) Modifier: +1");
  assert.equal(modified.objective, 10);
});

test("player attacks against NPCs preserve their opposed-test direction", () => {
  const parsed = parseOpposedTest("Preciso : (10) ➡ Defesa : (-1)");
  assert.equal(parsed.objective, 9);
  assert.equal(parsed.direction, "→");
  assert.equal(isPlayerNpcAttack({
    attacker: { actor: { type: "player" } },
    target: { actor: { type: "monster" } },
    formula: parsed,
    resistedDescription: ""
  }), true);
});

test("attack portraits follow the player's perspective", () => {
  const player = { name: "Bartolom", actor: { type: "player" } };
  const npc = { name: "Humano", actor: { type: "monster" } };
  const weapon = { name: "Garras" };

  assert.deepEqual(resolveAttackFlow({
    attacker: player,
    weapon,
    target: npc,
    formula: { attributes: [] },
    resistedDescription: ""
  }), {
    participants: [player, weapon, npc],
    direction: "→"
  });

  assert.deepEqual(resolveAttackFlow({
    attacker: npc,
    weapon,
    target: player,
    formula: { attributes: [] },
    resistedDescription: "defesa"
  }), {
    participants: [player, weapon, npc],
    direction: "←"
  });
});

test("positive NPC modifiers are displayed with an explicit plus sign", () => {
  assert.match(source, /\$\{attack\.label} \(\$\{signed\(attack\.value\)}\)/);
  assert.match(source, /return value > 0 \? `\+\$\{value}` : String\(value\)/);
});

test("objective and roll share one two-column row", () => {
  assert.match(source, /rollSummary\.className = "tenebre-npc-attack-roll-summary"/);
  assert.match(source, /rollSummary\.append\([\s\S]*?tenebre-npc-attack-objective[\s\S]*?tenebre-npc-attack-roll/);
  assert.match(css, /\.tenebre-npc-attack-roll-summary\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
});

test("critical-failure outcome remains complete in the compact card", () => {
  assert.match(source, /outcome = cleanText\(outcomeNode\?\.textContent\)/);
  assert.match(source, /tenebre-npc-attack-outcome", displayedOutcome\(model\)/);
});

test("NPC miss explains the successful defense and preserves special suffixes", () => {
  assert.equal(extractMissOutcomeSuffix("Ludo erra.", "Ludo", " erra."), "");
  assert.equal(
    extractMissOutcomeSuffix("Ludo erra. - Sucesso Crítico : Ataque Livre do Oponente", "Ludo", " erra."),
    "Sucesso Crítico : Ataque Livre do Oponente"
  );
  assert.equal(extractMissOutcomeSuffix("Ludo acerta Bartolom", "Ludo", " erra."), null);
  assert.match(source, /TENEBRE\.NpcAttackChat\.DefendedMiss/);
});

test("NPC attack roll and effective damage are extracted from native result text", () => {
  assert.equal(parseRollValue("Rolagem: 17"), 17);
  assert.equal(parseRollValue("Roll: 6"), 6);
  assert.deepEqual(
    parseDamageResult("Dano: 4 - (1d4)", "Sebastian Valerius suporta dano: 1", "1d6"),
    { formula: "1d6", rolledDamage: 4, damage: 1, protection: 3 }
  );
  assert.deepEqual(
    parseDamageResult("Dano: 1d8 - 2", "Ludo suporta dano: 5", "1d8", 5),
    { formula: "1d8", rolledDamage: 7, damage: 5, protection: 2 }
  );
  assert.deepEqual(
    parseDamageResult("Dano: 1d8 - 2", "Ludo suporta dano: 5"),
    { formula: "1d8", rolledDamage: 7, damage: 5, protection: 2 }
  );
  assert.deepEqual(
    parseDamageResult("Dano: 1d8 - 2", "Ludo suporta dano: 5", "1d8", 5, 7),
    { formula: "1d8", rolledDamage: 7, damage: 5, protection: 2 }
  );
  assert.deepEqual(
    parseDamageResult(
      "Dano: 1d8 + 1d6[Amoque] + 1d4[Robusto] - 0",
      "Keler suporta dano: 10",
      "1d8",
      10,
      4
    ),
    {
      formula: "1d8 + 1d6[Amoque] + 1d4[Robusto]",
      rolledDamage: 10,
      damage: 10,
      protection: 0
    }
  );
});

test("all additional damage dice remain visible with their Symbaroum labels", () => {
  assert.equal(
    extractDamageFormula("Dano: 1d8 + 1d6[Amoque] + 1d4[Robusto] - 2", "1d8"),
    "1d8 + 1d6[Amoque] + 1d4[Robusto]"
  );
  assert.equal(extractDamageFormula("Dano: 4 - (1d4)", "1d8"), "1d8");
  assert.match(source, /damage !== null && armorMatch/);
});

test("player attacks show NPC protection between rolled and received damage", () => {
  const damageLine = source.indexOf("tenebre-npc-attack-damage");
  const protectionLine = source.indexOf("tenebre-npc-attack-protection", damageLine);
  const receivedLine = source.indexOf("tenebre-npc-attack-received", protectionLine);
  assert.ok(damageLine >= 0 && protectionLine > damageLine && receivedLine > protectionLine);
  assert.match(source, /isPlayerAgainstNpc\(model\) && showNpcDetails && model\.protection !== null/);
  assert.match(source, /TENEBRE\.NpcAttackChat\.Protection/);
});

test("NPC attacks show the player's native armor roll below damage", () => {
  assert.deepEqual(resolveActiveArmor({
    system: {
      combat: {
        name: "Couro Endurecido",
        protectionPc: "1d4+1[Qualidade]",
        base: "1d4",
        isNoArmor: false
      }
    }
  }), {
    name: "Couro Endurecido",
    formula: "1d4+1[Qualidade]"
  });
  assert.equal(resolveActiveArmor({
    system: { combat: { name: "Sem armadura", protectionPc: "0", isNoArmor: true } }
  }), null);

  const damageLine = source.indexOf("tenebre-npc-attack-damage");
  const armorLine = source.indexOf("tenebre-npc-attack-player-armor", damageLine);
  const receivedLine = source.indexOf("tenebre-npc-attack-received", armorLine);
  assert.ok(damageLine >= 0 && armorLine > damageLine && receivedLine > armorLine);
  assert.match(source, /isNpcAgainstPlayer\(model\) && model\.target\.armor && model\.protection !== null/);
  assert.equal(
    ptBr["TENEBRE.NpcAttackChat.PlayerArmorProtection"],
    "{name} protege ({formula} = {protection}) com {armor}."
  );
});

test("zero effective damage reports that the NPC was protected by armor", () => {
  assert.match(source, /isPlayerAgainstNpc\(model\) && model\.damage === 0/);
  assert.match(source, /TENEBRE\.NpcAttackChat\.ProtectedByArmor/);
  assert.match(source, /\{name} está protegido pela armadura\./);
  assert.equal(isArmorProtectionText("Humano Nascido da Mácula está protegido pela armadura."), true);
  assert.equal(isArmorProtectionText("Humano Nascido da Mácula recebe 1 de dano."), false);
  assert.match(source, /armorProtectionNode[\s\S]*?consumedNodes = new Set\([\s\S]*?armorProtectionNode/);
});

test("pain threshold stun is combined with the received damage message", () => {
  assert.equal(
    isPainStunText("TesteMan está atordoado pela dor.", "está atordoado pela dor."),
    true
  );
  assert.equal(
    isPainStunText("TesteMan is stunned by pain.", "is stunned by pain."),
    true
  );
  assert.equal(
    isPainStunText("TesteMan recebe 7 de dano.", "está atordoado pela dor."),
    false
  );
  assert.match(source, /painStunNode[\s\S]*?consumedNodes = new Set\([\s\S]*?painStunNode/);
  assert.match(source, /painStunned: Boolean\(painStunNode\)/);
  assert.match(source, /TENEBRE\.NpcAttackChat\.ReceivesDamageAndPainStun/);
  assert.equal(
    JSON.parse(read("languages/pt-BR.json"))["TENEBRE.NpcAttackChat.ReceivesDamageAndPainStun"],
    "{name} recebe {damage} de dano e está atordoado pela dor."
  );
});

test("the selected Pain Threshold consequence replaces the attack damage summary", () => {
  globalThis.game = {
    i18n: {
      localize: (key) => ptBr[key] ?? key,
      format: (key, data) => (ptBr[key] ?? key).replace(/\{(\w+)\}/g, (_match, name) => data[name] ?? "")
    }
  };
  assert.equal(
    buildPainThresholdOutcomeText({ choice: "fall", targetName: "Bartolom", attackerName: "Humano", damage: 6 }),
    "Bartolom recebe 6 de dano, está atordoado pela dor e caiu."
  );
  assert.equal(
    buildPainThresholdOutcomeText({ choice: "freeAttack", targetName: "Bartolom", attackerName: "Humano", damage: 6 }),
    "Bartolom recebe 6 de dano, está atordoado pela dor e Humano pode atacar novamente."
  );
  assert.equal(buildPainThresholdOutcomeText({ choice: "invalid" }), null);
  assert.match(source, /message\?\.getFlag\?\.\(MODULE_ID, PAIN_THRESHOLD_OUTCOME_FLAG\)/);
  assert.match(source, /const receivedText = painChoiceText/);
  assert.match(source, /refreshPainThresholdOutcome\(root, message\)/);
});

test("NPC protection and effective damage can be hidden from players", () => {
  assert.equal(canViewNpcDamageDetails({ playerAgainstNpc: true, hideNpcDetails: true, isGM: false }), false);
  assert.equal(canViewNpcDamageDetails({ playerAgainstNpc: true, hideNpcDetails: true, isGM: true }), true);
  assert.equal(canViewNpcDamageDetails({ playerAgainstNpc: true, hideNpcDetails: false, isGM: false }), true);
  assert.equal(canViewNpcDamageDetails({ playerAgainstNpc: false, hideNpcDetails: true, isGM: false }), true);
  assert.match(settings, /register\("hideNpcDetailsInChat", Boolean, false/);
  assert.match(template, /name="hideNpcDetailsInChat"/);
  assert.match(source, /hideNpcDetailsInChat/);
  assert.match(source, /if \(showNpcDetails\)/);
});

test("compact NPC damage shows the weapon die separately from effective damage", () => {
  assert.match(source, /weaponDamageDie\(attackerActor, formulaElement\?\.dataset\?\.itemId\)/);
  assert.match(source, /\.tooltip-part \.part-total/);
  assert.match(source, /model\.damageFormula} = \$\{model\.damageRoll}/);
  assert.match(source, /damage:\s*model\.damage/);
});

test("compact NPC attacks transform only rendered native combat cards", () => {
  assert.match(source, /Hooks\.on\("renderChatMessageHTML"/);
  assert.match(source, /\.symbaroum\.chat\.combat/);
  assert.match(source, /isPlayerNpcAttack\(model\)/);
  assert.doesNotMatch(source, /ChatMessage(?:\.implementation)?\.create|ChatMessage\.create/);
});

test("the original native card stays hidden internally and can be restored", () => {
  assert.match(source, /tenebre-npc-attack-description", model\.resistedDescription/);
  assert.match(source, /source\.hidden = true/);
  assert.match(source, /source\.hidden = false/);
  assert.doesNotMatch(source, /OriginalDetails|createElement\("details"\)/);
});

test("GM receives a red information control when native attack content is not fully adapted", () => {
  const preview = read("scripts/chat-original-preview.mjs");
  assert.match(source, /hasUnadaptedContent/);
  assert.match(source, /appendOriginalChatPreview\(card, source/);
  assert.match(preview, /globalThis\.game\?\.user\?\.isGM/);
  assert.match(preview, /source\.cloneNode\(true\)/);
  assert.match(preview, /TENEBRE\.ChatOriginal\.Show/);
  assert.match(source, /unadaptedElements: model\.unadaptedElements/);
  assert.match(css, /\.tenebre-original-chat-info\s*\{[\s\S]*?background:\s*#b52323;/);
});

test("compact NPC attack setting defaults on and CSS stays namespaced", () => {
  assert.match(settings, /register\("enableCompactNpcAttackChat", Boolean, true/);
  assert.match(settings, /settingCategory = "chatMessages"/);
  assert.match(settings, /settingsChatMessagesMenu/);
  assert.match(template, /showChatMessages/);
  assert.match(template, /<select name="enableCompactNpcAttackChat">/);
  assert.match(template, /value="original"/);
  assert.match(template, /value="indResources"/);
  assert.match(css, /\.symbaroum\.chat\.combat\.tenebre-npc-attack-compact/);
  assert.match(css, /\.tenebre-npc-attack-card\s*\{[\s\S]*?gap:\s*6px;/);
  assert.match(css, /\.tenebre-npc-attack-participant\s*\{[\s\S]*?gap:\s*0;/);
  assert.match(css, /\.tenebre-npc-attack-participant figcaption\s*\{[\s\S]*?min-height:\s*1\.1em;[\s\S]*?max-height:\s*2\.2em;/);
  assert.doesNotMatch(css, /#chat-log|\.chat-sidebar\s+\.chat-scroll/);
});
