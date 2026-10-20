import assert from "node:assert/strict";
import test from "node:test";
import { buildPartySearchEntries, normalizePartySearch, partySearchSuggestions, searchPartyMembers } from "../scripts/party-search.mjs";

const labels = { "ATTRIBUTE.VIGILANT": "Vigilante", "ATTRIBUTE.STRONG": "Vigoroso", "ABILITY.NOVICE": "Novato", "ABILITY.ADEPT": "Adepto", "ABILITY.MASTER": "Mestre" };
const localize = key => labels[key] ?? key;
function member(id, name, vigilant, items = [], observable = true) {
  return { id, name, actor: { system: { attributes: { vigilant: { value: 10, total: vigilant }, strong: { value: 11 } } },
    items: new Map(items.map((item, i) => [i, item])), testUserPermission: (_user, level) => observable && level === "OBSERVER" } };
}
const ability = (name, tier) => ({ name, type: "ability", system: { [tier]: { isActive: true } } });
const members = [member("a", "Samaelh", 10, [ability("Acrobacias", "adept"), { name: "Poção de Cura", type: "equipment" }]),
  member("b", "Bahar", 15, [ability("Acrobacias", "master"), { name: "Mestre do Saber", type: "ability", system: { novice: { isActive: true }, adept: { isActive: true } } }]),
  member("c", "Oriel", 15, [{ name: "Corda", type: "equipment", system: { description: "Acrobacias" } }])];
const entries = buildPartySearchEntries(members, { user: {}, localize });

test("search ignores accents, case and surrounding whitespace", () => {
  assert.equal(normalizePartySearch("  POÇÃO "), "pocao");
  assert.deepEqual(searchPartyMembers(entries, " POCAO ").map(r => r.id), ["a"]);
});
test("ability search returns only owners and reports their learned tiers", () => {
  const results = searchPartyMembers(entries, "acro");
  assert.deepEqual(results.map(r => [r.id, r.matches[0].tier]), [["a", "Adepto"], ["b", "Mestre"]]);
  assert.equal(searchPartyMembers(entries, "Mestre do Saber")[0].matches[0].tier, "Adepto");
});
test("attribute search uses current totals and sorts descending with stable ties", () => {
  assert.deepEqual(searchPartyMembers(entries, "Vigilante").map(r => [r.id, r.matches[0].total]), [["b", 15], ["c", 15], ["a", 10]]);
  assert.deepEqual(searchPartyMembers(entries, "vig", { kind: "attribute", key: "vigilant" }).map(r => r.id), ["b", "c", "a"]);
});
test("search finds names and inventory names, without scanning descriptions", () => {
  assert.deepEqual(searchPartyMembers(entries, "sama").map(r => r.id), ["a"]);
  assert.deepEqual(searchPartyMembers(entries, "corda").map(r => r.id), ["c"]);
  assert.deepEqual(searchPartyMembers(entries, "unknown"), []);
});
test("clearing search restores member order even with a stale selection", () => {
  assert.deepEqual(searchPartyMembers(entries, "", { kind: "attribute", key: "vigilant" }).map(r => r.id), ["a", "b", "c"]);
});
test("suggestions deduplicate and distinguish items and abilities with the same name", () => {
  assert.equal(partySearchSuggestions(entries, "acro").length, 1);
  const extra = buildPartySearchEntries([member("d", "D", 8, [{ name: "Acrobacias", type: "equipment" }])], { user: {}, localize });
  const suggestions = partySearchSuggestions([...entries, ...extra], "acro");
  assert.deepEqual(new Set(suggestions.map(s => s.kind)), new Set(["ability", "item"]));
  assert.deepEqual(searchPartyMembers([...entries, ...extra], "Acrobacias", { kind: "item", key: "acrobacias" }).map(r => r.id), ["d"]);
});
test("unobservable and limited actors do not contribute names, attributes or suggestions", () => {
  const hidden = member("secret", "Secret", 20, [ability("Segredo", "master")], false);
  assert.deepEqual(buildPartySearchEntries([hidden], { user: {}, localize }), []);
  assert.equal(buildPartySearchEntries([hidden], { user: { isGM: true }, localize }).length, 1);
  delete hidden.actor.testUserPermission;
  assert.deepEqual(buildPartySearchEntries([hidden], { user: {}, localize }), []);
});
test("missing data and invalid attribute values do not produce false rankings", () => {
  const entry = member("x", "X", NaN);
  entry.actor.system.attributes.strong = null;
  assert.deepEqual(buildPartySearchEntries([entry], { user: {}, localize })[0].fields, []);
});
test("each search index reflects current items and attributes without persistent writes", () => {
  const entry = member("x", "X", 8);
  const before = JSON.stringify(entry.actor.system);
  buildPartySearchEntries([entry], { user: {}, localize });
  assert.equal(JSON.stringify(entry.actor.system), before);
  entry.actor.system.attributes.vigilant.total = 18;
  entry.actor.items.set("new", ability("Acrobacias", "novice"));
  const fresh = buildPartySearchEntries([entry], { user: {}, localize });
  assert.equal(searchPartyMembers(fresh, "Vigilante")[0].matches[0].total, 18);
  assert.equal(searchPartyMembers(fresh, "Acrobacias")[0].matches[0].tier, "Novato");
});
