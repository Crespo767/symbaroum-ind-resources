import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
globalThis.Hooks = { once() {}, on() {} };
const { MODULE_ID, DEFAULTS } = await import("../scripts/constants.mjs");
const { expeditionTravel, partyTravelPreview, actorTravelProfile, effectiveExpeditionSearch, journeyContextKey, naturalRecoveryDuringJourney } = await import("../scripts/travel-context.mjs");
const { MovementService } = await import("../scripts/movement-ruler.mjs");
const { calculateDavokarEventModifiers, calculateOrientationTarget, encounterDetectionModifier } = await import("../scripts/party-actor.mjs");
const { expeditionDayKey } = await import("../scripts/expedition-state.mjs");
let settings, hero, mount, party;
function actor(id) { return { id, uuid: `Actor.${id}`, name: id, type: "player", items: [], effects: [], flags: {}, system: { attributes: { strong: { total: 10 }, vigilant: { total: 12 } } } }; }
function config(value = {}) { party.flags[MODULE_ID] = { expedition: { travel: { configured: true, activity: "travel", mode: "dayMarch", participantRefs: [hero.id], mounts: {}, ...value } } }; }
function burden(actor, slots) { actor.items.push({ type: "equipment", name: "Test load", system: { number: 1, state: "equipped" }, getFlag: (_s,k) => k === "encumbranceManual" ? true : k === "encumbranceSlots" ? slots : undefined }); }
beforeEach(() => {
  settings = { ...DEFAULTS, enableHunger: true, enableEncumbrance: true, enableContainers: false };
  hero = actor("hero"); mount = actor("mount");
  party = { id: "party", uuid: "Actor.party", type: `${MODULE_ID}.party`, flags: {}, system: { members: [hero.id], companions: [mount.id], location: { region: "bright" }, expedition: { active: true, day: 1, activeSearch: true } } };
  globalThis.game = { user: { id:"gm",isGM:true }, actors: new Map([hero,mount,party].map(a => [a.id,a])), settings: { get: (_s,k) => settings[k] }, i18n: { localize:k=>k } };
  config();
});

test("rivers improve the speed column without changing real region, Bushcraft or event risk", () => {
  party.system.location.region = "dark"; config({ alongRiver: true });
  const preview = partyTravelPreview(party);
  assert.equal(preview.rate, 20);
  assert.equal(preview.config.region, "dark");
  assert.equal(calculateOrientationTarget(12,1,"dark").penalty,-5);
  const mods = calculateDavokarEventModifiers({ regionKey:"dark", alongRiver:true });
  assert.equal(mods.enemies.totalMod,5);
  assert.equal(mods.terrain.totalMod,7);
  assert.equal(mods.terrain.riverMod,2);
});
test("wild Davokar keeps its own region while sharing the bright speed column", () => {
  party.system.location.region = "wild";
  assert.equal(expeditionTravel(party).region,"wild");
  assert.equal(partyTravelPreview(party).rate,20);
  assert.equal(calculateDavokarEventModifiers({regionKey:"wild",alongRiver:true}).terrain.totalMod,4);
});
test("active search is effective only at normal pace and respects the adopted optional rule", () => {
  for (const mode of ["dayMarch","dayRide"]) { config({mode}); assert.equal(effectiveExpeditionSearch(party),true); }
  for (const mode of ["forcedMarch","mortalMarch","forcedRide","mortalRide"]) { config({mode}); assert.equal(effectiveExpeditionSearch(party),false); }
  config({ mode:"forcedMarch",searchRule:false }); assert.equal(effectiveExpeditionSearch(party),true);
  config({ activity:"stay" }); assert.equal(effectiveExpeditionSearch(party),false);
});
test("hunger halves both standalone and shared journey estimates and honours its setting", () => {
  hero.effects.push({ statuses:new Set(["hunger"]) });
  assert.equal(partyTravelPreview(party).rate,10);
  assert.equal(MovementService.getTravelEstimate(20,{actor:hero}).days,2);
  settings.enableMovementHungerModifier=false;
  assert.equal(MovementService.getTravelEstimate(20,{actor:hero}).days,1);
  settings.enableMovementHungerModifier=true; hero.effects[0].disabled=true;
  assert.equal(partyTravelPreview(party).rate,20);
});
test("overload raises effort but never speed; excessive load and true mortal pace block travel", () => {
  burden(hero,13);
  let preview=partyTravelPreview(party);
  assert.equal(preview.rate,20); assert.equal(preview.profiles[0].effort,1);
  config({mode:"forcedMarch"}); preview=partyTravelPreview(party);
  assert.equal(preview.rate,30); assert.equal(preview.profiles[0].effort,2); assert.equal(preview.profiles[0].overload,3);
  config({mode:"mortalMarch"}); assert.equal(partyTravelPreview(party).blocked,true);
  settings.enableMovementEncumbranceModifier=false; assert.equal(partyTravelPreview(party).rate,40);
  settings.enableMovementEncumbranceModifier=true; hero.items=[]; burden(hero,21); config();
  assert.equal(partyTravelPreview(party).rate,0);
});
test("mounted speed uses the explicitly selected mount; an absent mount is not inferred from actor type", () => {
  config({mode:"dayRide"}); assert.equal(partyTravelPreview(party).blocked,true);
  hero.effects.push({statuses:new Set(["hunger"])});
  config({mode:"dayRide",mounts:{hero:"mount"}}); assert.equal(partyTravelPreview(party).rate,30);
  mount.effects.push({statuses:new Set(["hunger"])}); assert.equal(partyTravelPreview(party).rate,15);
  config({mode:"dayRide",participantRefs:[hero.id,mount.id],mounts:{hero:"mount"}});
  assert.equal(partyTravelPreview(party).blocked,false);
});
test("explicit participants determine the slowest pace, without monster-type exclusions", () => {
  mount.type="monster"; mount.effects.push({statuses:new Set(["hunger"])});
  config({participantRefs:[hero.id,mount.id]}); assert.equal(partyTravelPreview(party).rate,10);
  config({participantRefs:[hero.id]}); assert.equal(partyTravelPreview(party).rate,20);
});
test("forced recovery requires Enduring March or a reviewed daily permission", () => {
  config({mode:"forcedMarch"}); assert.equal(naturalRecoveryDuringJourney(hero),false);
  hero.flags[MODULE_ID]={journeyReceipt:{party:party.uuid,day:expeditionDayKey(party),context:journeyContextKey(party),allowNaturalRecovery:true}};
  assert.equal(naturalRecoveryDuringJourney(hero),true);
  party.system.expedition.day++; assert.equal(naturalRecoveryDuringJourney(hero),false);
  hero.items.push({type:"boon",name:"Marcha Duradoura"}); assert.equal(naturalRecoveryDuringJourney(hero),true);
  config({mode:"mortalMarch"}); assert.equal(naturalRecoveryDuringJourney(hero),false);
});
test("journey fingerprints react to relevant changes without publishing actor attributes", () => {
  const before=journeyContextKey(party); assert.match(before,/^[a-f0-9]{16}$/);
  hero.system.attributes.strong.total++; assert.notEqual(journeyContextKey(party),before);
  const second=journeyContextKey(party); settings.alwaysSucceedOnOne=true; assert.notEqual(journeyContextKey(party),second);
});
test("staying counts site days, while travelling does not invent a stay test", () => {
  config({activity:"stay",site:"Ruína",stayStartDay:1}); party.system.expedition.day=3;
  assert.equal(partyTravelPreview(party).stayDays,3); assert.equal(partyTravelPreview(party).rate,0);
});
test("custom encounter tables require explicit detection metadata instead of guessing their ranges", () => {
  assert.equal(encounterDetectionModifier({id:"custom"},{results:[{range:[1,1]}]}),null);
  assert.equal(encounterDetectionModifier({id:"custom"},{results:[{range:[1,1],flags:{[MODULE_ID]:{detectionModifier:-3}}}]}),-3);
  assert.equal(encounterDetectionModifier({id:"tblEncountDav001"},{results:[{range:[8,8]}]}),-5);
  assert.equal(encounterDetectionModifier({id:"tblEncountDav001"},{results:[{range:[9,35]}]}),null);
});


test("blocked and ambiguous routes never appear as zero travel days", () => {
  burden(hero,21);
  assert.equal(MovementService.getTravelEstimate(20,{actor:hero}).days,Infinity);
  assert.equal(MovementService.getTravelEstimate(0,{actor:hero}).days,0);
});


test("saving the same travel choices does not invalidate a completed check solely because of a transport revision", () => {
  config({revision:"old"}); const key=journeyContextKey(party);
  config({revision:"new"}); assert.equal(journeyContextKey(party),key);
});
