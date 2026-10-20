import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

globalThis.Hooks = { on() {}, once() {} };
globalThis.ActorSheet = class { constructor(actor) { this.actor = actor; } get isEditable() { return true; } };
globalThis.foundry = { utils: { deepClone: structuredClone } };
const { PartyActorSheet } = await import("../scripts/party-actor.mjs");

function setup(user) {
  globalThis.game = { user, actors: new Map(), tables: [], packs: [], settings: { get: () => false }, i18n: { localize: key => key } };
  return new PartyActorSheet({ id: "party", system: { members: [], companions: [] }, flags: {}, items: new Map() });
}

for (const user of [{ role: 1, isGM: false }, { role: 2, isGM: false }, { role: 3, isGM: true }, { role: 4, isGM: true }]) {
  test(`expedition navigation follows GM status for role ${user.role}, even on an editable sheet`, async () => {
    const sheet = setup(user);
    const data = await sheet.getData();
    assert.equal(data.canViewExpedition, user.isGM);
    const selectors = [], activations = [];
    sheet._activateMemberSearch = () => {};
    sheet._bindMemberContextMenu = () => {};
    sheet._bindGuideContextMenu = () => {};
    sheet._bindRationContextMenu = () => {};
    sheet._tabs = [{ active: "expedition", activate: name => activations.push(name) }];
    sheet.activateListeners({ querySelectorAll: selector => { selectors.push(selector); return []; } });
    assert.equal(selectors.includes('[data-action="roll-orientation"]'), user.isGM);
    assert.equal(selectors.includes('[data-action="roll-all-events"]'), user.isGM);
    assert.equal(selectors.includes('[data-action="feed-all-group"]'), user.isGM);
    assert.deepEqual(activations, user.isGM ? [] : ["characters"]);
    assert.ok(selectors.includes('[data-action="open-member-sheet"]'), "Member controls remain available");
  });
}

test("both expedition navigation and its entire content require the GM visibility flag", () => {
  const template = fs.readFileSync(new URL("../templates/party-sheet.hbs", import.meta.url), "utf8");
  assert.match(template, /{{#if canViewExpedition}}\s*<b class="item" data-tab="expedition">/);
  assert.match(template, /{{#if canViewExpedition}}\s*<div class="tab" data-group="primary" data-tab="expedition">/);
  assert.match(template, /{{\/if}}\s*<\/div>\s*<\/div>\s*<\/form>\s*$/);
});
