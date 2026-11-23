import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

globalThis.Hooks = { on() {}, once() {} };
globalThis.ActorSheet = class { constructor(actor) { this.actor = actor; } get isEditable() { return true; } };
globalThis.foundry = { utils: { deepClone: structuredClone } };
const { PartyActorSheet } = await import("../scripts/party-actor.mjs");

function setup(user) {
  globalThis.game = {
    user, actors: new Map(), settings: { get: () => false }, i18n: { localize: key => key },
    get packs() { assert.fail("The sheet must not read old expedition results"); }
  };
  const expedition = { active: true, day: 2, guideUuid: "Actor.guide", dayState: { orientation: { privateId: "old-result" } } };
  return new PartyActorSheet({
    id: "party", system: { members: [], companions: [], expedition },
    flags: { "symbaroum-ind-resources": { expedition: structuredClone(expedition) } }, items: new Map(),
    async update() { assert.fail("Opening an existing group must not update the actor"); }
  });
}

for (const user of [{ role: 1, isGM: false }, { role: 2, isGM: false }, { role: 3, isGM: true }, { role: 4, isGM: true }]) {
  test(`the group sheet skips legacy expedition data and controls for role ${user.role}`, async () => {
    const sheet = setup(user);
    const saved = structuredClone({ system: sheet.actor.system, flags: sheet.actor.flags });
    const data = await sheet.getData();
    assert.equal(data.expedition, undefined);
    assert.deepEqual(data.members, []);
    assert.deepEqual(data.inventoryItems, []);

    const selectors = [];
    sheet._activateMemberSearch = () => {};
    sheet._bindMemberContextMenu = () => {};
    sheet.activateListeners({ querySelectorAll: selector => { selectors.push(selector); return []; } });
    assert.doesNotMatch(selectors.join(" "), /expedition|orientation|guide|feed-member|roll-.*event/);
    assert.ok(selectors.includes('[data-action="open-member-sheet"]'));
    assert.ok(selectors.includes('[data-action="open-item-sheet"]'));
    assert.deepEqual({ system: sheet.actor.system, flags: sheet.actor.flags }, saved);
  });
}

test("the new expedition panel is conditional and the retired panel stays absent", () => {
  const template = fs.readFileSync(new URL("../templates/party-sheet.hbs", import.meta.url), "utf8");
  assert.deepEqual([...template.matchAll(/data-tab="([^"]+)"/g)].map(([, tab]) => tab), ["characters", "inventory", "davokar", "characters", "inventory", "davokar"]);
  assert.doesNotMatch(template, /data-tab="expedition"|canViewExpedition|isGuide|system\.location\.region|party-rations-box/);
});
