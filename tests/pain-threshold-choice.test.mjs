import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

globalThis.Hooks = { once() {} };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const source = read("scripts/pain-threshold-choice.mjs");
const socketSource = read("scripts/sockets.mjs");
const maneuverSource = read("scripts/maneuvers.mjs");
const css = read("styles/symbaroum-ind-resources.css");
const ptBr = JSON.parse(read("languages/pt-BR.json"));
const en = JSON.parse(read("languages/en.json"));

const {
  buildPainThresholdPromptHtml,
  extractPainThresholdActions,
  selectPainChoiceRecipients,
  waitForPainThresholdReveal
} = await import("../scripts/pain-threshold-choice.mjs");

test("native prone action is held while damage remains available to the GM", () => {
  const actions = [
    { tokenId: "target", addEffect: { id: "prone", name: "Prostrado" }, effectDuration: 1 },
    { tokenId: "target", toughnessChange: -7 },
    { tokenId: "target", corruptionChange: 1 }
  ];
  const result = extractPainThresholdActions(actions);

  assert.deepEqual(result.proneAction, actions[0]);
  assert.deepEqual(result.remainingActions, actions.slice(1));
  assert.equal(result.targetTokenId, "target");
  assert.equal(actions[0].addEffect.id, "prone", "source actions must not be mutated");
});

test("a combined native action retains damage after prone is removed", () => {
  const result = extractPainThresholdActions([{
    tokenId: "target",
    addEffect: { id: "prone" },
    effectDuration: 1,
    toughnessChange: -6
  }]);

  assert.deepEqual(result.remainingActions, [{ tokenId: "target", toughnessChange: -6 }]);
});

test("unrelated status effects and prone without damage are ignored", () => {
  assert.equal(extractPainThresholdActions([
    { tokenId: "target", addEffect: { id: "poison" } },
    { tokenId: "target", toughnessChange: -3 }
  ]), null);
  assert.equal(extractPainThresholdActions([
    { tokenId: "target", addEffect: { id: "prone" } }
  ]), null);
});

test("the affected character owner chooses before attacker owners or GMs", () => {
  const users = [
    { id: "target-owner", active: true, isGM: false },
    { id: "attacker-owner", active: true, isGM: false },
    { id: "gm", active: true, isGM: true }
  ];
  const target = { testUserPermission: (user) => user.id === "target-owner" };
  const attacker = { testUserPermission: (user) => user.id === "attacker-owner" };

  assert.deepEqual(selectPainChoiceRecipients(users, target, attacker), ["target-owner"]);
  assert.deepEqual(selectPainChoiceRecipients(users, null, attacker), ["attacker-owner"]);
  assert.deepEqual(selectPainChoiceRecipients(users, null, null), ["gm"]);
});

test("the prompt offers exactly fall or a Free Attack and escapes actor names", () => {
  globalThis.game = {
    i18n: {
      localize: (key) => ptBr[key] ?? key,
      format: (key, data) => (ptBr[key] ?? key).replace(/\{(\w+)\}/g, (_match, name) => data[name] ?? "")
    }
  };
  const html = buildPainThresholdPromptHtml({ targetName: "A <B>", attackerName: "C & D" });

  assert.match(html, /A &lt;B&gt; ultrapassou o Limiar de Dor/);
  assert.match(html, /data-tenebre-pain-choice="fall"/);
  assert.match(html, /data-tenebre-pain-choice="freeAttack"/);
  assert.match(html, /Conceder Ataque Livre a C &amp; D/);
  assert.doesNotMatch(html, /A <B>|C & D/);
});

test("the Pain Threshold prompt waits for its Dice So Nice animation", async () => {
  const requestedIds = [];
  const completed = await waitForPainThresholdReveal("roll-message", {
    dice3d: {
      async waitFor3DAnimationByMessageID(messageId) {
        requestedIds.push(messageId);
      }
    },
    minimumDelayMs: 0,
    fallbackDelayMs: 0,
    maximumWaitMs: 100
  });
  assert.equal(completed, true);
  assert.deepEqual(requestedIds, ["roll-message"]);

  const fallback = await waitForPainThresholdReveal("roll-message", {
    dice3d: null,
    minimumDelayMs: 0,
    fallbackDelayMs: 0
  });
  assert.equal(fallback, false);
  assert.match(source, /diceMessageId: attackContext\?\.messageId/);
  assert.match(source, /await waitForPainThresholdReveal\(pending\.diceMessageId\)/);
});

test("choice resolution is authenticated and preserves the native GM apply control", () => {
  assert.match(source, /SocketService\.registerHandler\(SOCKET_HANDLER, resolvePainThresholdChoiceAsGm\)/);
  assert.match(source, /pending\.recipientIds\?\.includes\?\.\(requester\.id\)/);
  assert.match(source, /button\.disabled = true/);
  assert.match(source, /await applyMessage\.unsetFlag\(MODULE_ID, MODULE_CHOICE_FLAG\)/);
  assert.match(source, /await applyProne\(targetActor\)/);
  assert.match(source, /ManeuverService\.grantFreeAttack\(attackerActor, targetActor\)/);
  assert.match(source, /recordPainThresholdOutcome\(pending, choice\)/);
  assert.match(source, /attackMessage\.setFlag\(MODULE_ID, PAIN_THRESHOLD_OUTCOME_FLAG/);
  assert.match(source, /restoreDefaultFallChoice/);
  assert.match(socketSource, /static registerHandler\(name, handler\)/);
  assert.match(maneuverSource, /static grantFreeAttack\(actor, sourceActor = null\)/);
});

test("Pain Threshold UI is localized and CSS remains module-scoped", () => {
  for (const key of [
    "TENEBRE.PainThreshold.Prompt",
    "TENEBRE.PainThreshold.Question",
    "TENEBRE.PainThreshold.Fall",
    "TENEBRE.PainThreshold.FreeAttack",
    "TENEBRE.PainThreshold.FellAfterDamage",
    "TENEBRE.PainThreshold.FreeAttackAfterDamage",
    "TENEBRE.PainThreshold.Waiting"
  ]) {
    assert.ok(ptBr[key]);
    assert.ok(en[key]);
  }
  assert.match(css, /\.tenebre-pain-threshold-actions\s*\{/);
  assert.match(css, /\.tenebre-pain-threshold-prompt \.foreground/);
  assert.doesNotMatch(css, /(^|\n)button\s*\{/);
});
