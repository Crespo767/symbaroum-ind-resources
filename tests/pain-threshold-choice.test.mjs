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
  PainThresholdChoiceService,
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

test("only the affected character owners choose, with GMs as the offline fallback", () => {
  const users = [
    { id: "target-owner", active: true, isGM: false },
    { id: "attacker-owner", active: true, isGM: false },
    { id: "gm", active: true, isGM: true }
  ];
  const target = { testUserPermission: (user) => user.id === "target-owner" };
  assert.deepEqual(selectPainChoiceRecipients(users, target), ["target-owner"]);
  assert.deepEqual(selectPainChoiceRecipients(users.filter((user) => user.id !== "target-owner"), target), ["gm"]);
  assert.deepEqual(selectPainChoiceRecipients(users, null), ["gm"]);
});

test("native application keeps automatic NPC falls and offers choices only for NPC attacks on players", async (t) => {
  const saved = Object.fromEntries(["game", "foundry", "canvas", "Hooks"].map((key) => [key, globalThis[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  const hooks = new Map();
  globalThis.Hooks = { once() {}, on: (name, callback) => hooks.set(name, callback) };
  PainThresholdChoiceService.register();
  const prepare = hooks.get("preCreateChatMessage");
  assert.equal(typeof prepare, "function");

  for (const { attackerType, targetType, choice, defenderSpeaker = false, synthetic = false, introText = "Attacker attacks with Claws" } of [
    { attackerType: "player", targetType: "monster", choice: false },
    { attackerType: "character", targetType: "npc", choice: false },
    { attackerType: "monster", targetType: "monster", choice: false },
    { attackerType: "player", targetType: "player", choice: false },
    { attackerType: "monster", targetType: "player", choice: true },
    { attackerType: "npc", targetType: "character", choice: true },
    { attackerType: "monster", targetType: "player", choice: true, defenderSpeaker: true },
    { attackerType: "monster", targetType: "player", choice: true, defenderSpeaker: true, introText: "Attacker ataca com Garras" },
    { attackerType: "monster", targetType: "player", choice: true, defenderSpeaker: true, synthetic: true },
    { attackerType: "monster", targetType: "player", choice: false, defenderSpeaker: true, introText: "Unknown attacks with Claws" }
  ]) {
    await t.test(`${attackerType} attacks ${targetType}${defenderSpeaker ? ` (defender speaker: ${introText})` : ""}`, () => {
      const gm = { id: "gm", active: true, isGM: true };
      const player = { id: "owner", active: true, isGM: false };
      const target = {
        id: "target", uuid: "Actor.target", name: "Target", type: targetType,
        testUserPermission: (user) => user.id === player.id
      };
      const attacker = { id: "attacker", name: "Attacker", type: attackerType, uuid: "Actor.attacker" };
      globalThis.game = {
        user: gm, users: Object.assign([gm, player], { activeGM: gm }),
        actors: new Map([[target.id, target], [attacker.id, attacker]]),
        messages: { contents: [{ id: "roll", content: `<div class="introTxt">${introText}</div>Target is stunned by pain`, speaker: { actor: defenderSpeaker ? target.id : attacker.id } }] },
        i18n: { localize: (key) => key === "COMBAT.CHAT_DAMAGE_PAIN" ? "is stunned by pain" : key }
      };
      const tokenAttacker = synthetic ? { ...attacker, uuid: "Scene.scene.Token.npc.Actor.attacker" } : attacker;
      globalThis.canvas = { tokens: {
        get: (id) => id === "target-token" ? { actor: target } : null,
        placeables: synthetic ? [{ name: attacker.name, actor: tokenAttacker }] : []
      } };
      globalThis.foundry = { utils: {
        getProperty: (object, path) => path.split(".").reduce((value, key) => value?.[key], object),
        randomID: () => "choice-id"
      } };
      const actions = [
        { tokenId: "target-token", addEffect: { id: "prone" }, effectDuration: 1 },
        { tokenId: "target-token", toughnessChange: -7 },
        { tokenId: "target-token", corruptionChange: 1 }
      ];
      const updates = [];
      const originalActions = structuredClone(actions);
      const message = { updateSource: (update) => updates.push(update) };
      const data = { "flags.symbaroum.applyEffects": actions };
      prepare(message, data);
      assert.equal(updates.length, choice ? 1 : 0);
      assert.deepEqual(data["flags.symbaroum.applyEffects"], originalActions, "source actions remain unchanged");
      if (choice) {
        assert.deepEqual(updates[0]["flags.symbaroum.applyEffects"], actions.slice(1));
        const pending = updates[0]["flags.symbaroum-ind-resources.painThresholdChoice"];
        assert.deepEqual(pending.recipientIds, [player.id]);
        assert.deepEqual(pending.proneAction, actions[0]);
        assert.equal(pending.targetActorUuid, target.uuid);
        assert.equal(pending.attackerActorUuid, tokenAttacker.uuid);
      } else {
        assert.equal(actions[0].addEffect.id, "prone", "NPC prone stays in the native GM damage application");
      }

      game.user = player;
      prepare(message, data);
      assert.equal(updates.length, choice ? 1 : 0, "player clients never change privileged application actions");
    });
  }
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
