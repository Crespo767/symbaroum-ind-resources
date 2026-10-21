import assert from "node:assert/strict";
import fs from "node:fs";
import { beforeEach, test } from "node:test";

globalThis.Hooks = { once() {}, on() {} };
const { MODULE_ID, DEFAULTS } = await import("../scripts/constants.mjs");
const { effectiveExpeditionSearch, journeyContextKey } = await import("../scripts/travel-context.mjs");
const { MovementService } = await import("../scripts/movement-ruler.mjs");
const { encounterDetectionModifier } = await import("../scripts/party-actor.mjs");
let settings, hero, party;
function config(value = {}) { party.flags[MODULE_ID] = { expedition: { travel: { configured:true, activity:"travel", mode:"dayMarch", ...value } } }; }
beforeEach(() => {
  settings={...DEFAULTS,enableHunger:true,enableEncumbrance:true,enableContainers:false};
  hero={id:"hero",uuid:"Actor.hero",type:"player",items:[],effects:[],flags:{},system:{attributes:{strong:{total:10},vigilant:{total:12}}}};
  party={id:"party",uuid:"Actor.party",type:`${MODULE_ID}.party`,flags:{},system:{members:[hero.id],location:{region:"bright"},expedition:{active:true,day:1,activeSearch:true}}};
  globalThis.game={user:{id:"gm",isGM:true},actors:new Map([hero,party].map(a=>[a.id,a])),settings:{get:(_s,k)=>settings[k]},i18n:{localize:k=>k}};
  config();
});

test("ruin search depends only on the step 3 toggle, ignoring retired activity and pace", () => {
  for (const mode of ["dayMarch","forcedMarch","mortalMarch","dayRide","forcedRide","mortalRide"]) {
    for (const activity of ["travel","stay"]) {
      config({mode,activity,searchRule:false});
      party.system.expedition.activeSearch=true; assert.equal(effectiveExpeditionSearch(party),true);
      party.system.expedition.activeSearch=false; assert.equal(effectiveExpeditionSearch(party),false);
    }
  }
});

test("standalone ruler estimates use token configuration even with legacy party travel flags", () => {
  config({mode:"mortalMarch",activity:"stay",alongRiver:true});
  const token={actor:hero,flags:{[MODULE_ID]:{travel:{terrain:"brightDavokar",mode:"dayMarch",alongRiver:false}}}};
  assert.equal(MovementService.getTravelEstimate(20,token).days,1);
  assert.equal(MovementService.getTravelConfiguration(token).linkedParty,undefined);
  const before=JSON.stringify(party);
  token.flags[MODULE_ID].travel.mode="forcedMarch";
  assert.equal(MovementService.getTravelEstimate(30,token).days,1);
  assert.equal(JSON.stringify(party),before);
});

test("retired journey UI and controls are absent while the other expedition steps remain", () => {
  const template=fs.readFileSync(new URL("../templates/party-sheet.hbs",import.meta.url),"utf8");
  assert.doesNotMatch(template,/tenebre-journey-panel|expedition.journey|configure-journey|journey-check|journey-apply/);
  for (const action of ["roll-orientation","feed-all-group","roll-all-events","toggle-active-search"]) assert.ok(template.includes(`data-action="${action}"`));
});

test("journey fingerprints react to relevant changes without publishing actor attributes", () => {
  const before=journeyContextKey(party); assert.match(before,/^[a-f0-9]{16}$/);
  hero.system.attributes.strong.total++; assert.notEqual(journeyContextKey(party),before);
  const second=journeyContextKey(party); settings.alwaysSucceedOnOne=true; assert.notEqual(journeyContextKey(party),second);
});
test("custom encounter tables require explicit detection metadata instead of guessing their ranges", () => {
  assert.equal(encounterDetectionModifier({id:"custom"},{results:[{range:[1,1]}]}),null);
  assert.equal(encounterDetectionModifier({id:"custom"},{results:[{range:[1,1],flags:{[MODULE_ID]:{detectionModifier:-3}}}]}),-3);
  assert.equal(encounterDetectionModifier({id:"tblEncountDav001"},{results:[{range:[8,8]}]}),-5);
  assert.equal(encounterDetectionModifier({id:"tblEncountDav001"},{results:[{range:[9,35]}]}),null);
});
