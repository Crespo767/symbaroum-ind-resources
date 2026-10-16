import { MODULE_ID } from "./constants.mjs";
import { SocketService, getRequestUser, hasOwnerPermission } from "./sockets.mjs";
import { getActorExpeditionData, expeditionDayKey, runExpeditionOperation } from "./expedition-state.mjs";
import { actorReference } from "./actor-references.mjs";
import { expeditionTravel, partyTravelPreview, resolvePartyTravelActors, journeyContextKey, TRAVEL_MODES, findTravelParties } from "./travel-context.mjs";
import { rollExpeditionAttribute } from "./expedition-orientation.mjs";
import { HungerService } from "./hunger.mjs";
import { getRollMode, getRollVisibility, evaluateRoll, createChatMessageAfterDice } from "./dice.mjs";
import { ensureExpeditionPrivateStorage, canReadExpeditionResult, readPrivateExpeditionResult, storePrivateExpeditionResult } from "./expedition-private.mjs";
import { escapeHtml } from "./utils.mjs";

let eventTools;
const CHECKS = ["effort", "detection", "stay"];
const id = () => globalThis.foundry?.utils?.randomID?.() ?? crypto.randomUUID();
const localize = key => game.i18n.localize(`TENEBRE.Journey.${key}`);
export function journeyResultKey(party, kind) { return getActorExpeditionData(party).dayState.journey?.[kind]?.revision ?? ""; }

export class ExpeditionJourneyService {
  static register(tools) {
    eventTools = tools;
    SocketService.registerHandler("setExpeditionTravel", setTravelAsAuthority);
    SocketService.registerHandler("resolveExpeditionJourney", resolveAsAuthority);
    SocketService.registerHandler("applyExpeditionEffort", applyEffortAsAuthority);
  }
  static async setTravel(party, config) {
    return route("setExpeditionTravel", party.uuid, expeditionDayKey(party), config);
  }
  static async resolve(party, kind, rollMode = getRollMode()) {
    const actors = await resolvePartyTravelActors(party);
    return route("resolveExpeditionJourney", party.uuid, expeditionDayKey(party), journeyContextKey(party, actors), kind, rollMode, journeyResultKey(party, kind));
  }
  static async applyEffort(party, woundResolution = "manual") {
    return route("applyExpeditionEffort", party.uuid, expeditionDayKey(party), journeyResultKey(party, "effort"), woundResolution);
  }
}
function route(handler, ...args) {
  if (SocketService.hasActiveGM()) return SocketService.executeAsPrimaryGM(handler, ...args);
  if (!game.user?.isGM) throw new Error("Journey resolution requires an active GM.");
  const handlers = { setExpeditionTravel: setTravelAsAuthority, resolveExpeditionJourney: resolveAsAuthority, applyExpeditionEffort: applyEffortAsAuthority };
  return handlers[handler].call({ socketdata: { userId: game.user.id } }, ...args);
}
async function request(context, uuid, day) {
  if (!game.user?.isGM || (SocketService.hasActiveGM() && !SocketService.isPrimaryGM())) throw new Error("Journey must run on the designated GM.");
  const user = getRequestUser(context), party = await globalThis.fromUuid?.(uuid);
  if (party?.documentName !== "Actor" || party.type !== `${MODULE_ID}.party` || party.pack || party.compendium || typeof day !== "string" || day.length > 300) throw new Error("Invalid journey party.");
  return { user, party };
}
async function setTravelAsAuthority(uuid, day, config) {
  const { user, party } = await request(this, uuid, day);
  if (!user.isGM && !hasOwnerPermission(party, user)) throw new Error("Journey party is not owned.");
  if (!config || !TRAVEL_MODES.includes(config.mode) || !["travel", "stay"].includes(config.activity) || typeof config.alongRiver !== "boolean" || typeof config.site !== "string" || config.site.length > 200) throw new Error("Invalid journey configuration.");
  return runExpeditionOperation(party, async () => {
    if (expeditionDayKey(party) !== day) return { status: "stale" };
    const previous = expeditionTravel(party);
    const stored = { mode: config.mode, activity: config.activity, alongRiver: config.alongRiver,
      site: config.site.trim(),
      dailyEnemiesWhileStaying: config.dailyEnemiesWhileStaying !== false, configured: true,
      stayStartDay: config.activity === "stay" && previous.activity === "stay" && previous.site === config.site.trim() ? previous.stayStartDay ?? Number(getActorExpeditionData(party).day) : Math.max(1, Number(getActorExpeditionData(party).day) || 1), revision: id() };
    await party.update({ [`flags.${MODULE_ID}.expedition.==travel`]: stored });
    return { status: "configured" };
  });
}
function visibility(mode, user) { const { whisper = [], blind = false } = getRollVisibility(false, mode, user); return { mode, author: user.id, recipients: whisper, blind }; }
async function save(party, kind, result, audience, isCurrent = async () => true) {
  const stored = await storePrivateExpeditionResult(party, kind, result, audience, { authoritative: kind === "effort" });
  if (!await isCurrent()) return false;
  await party.update({ [`system.expedition.dayState.journey.==${kind}`]: stored, [`flags.${MODULE_ID}.expedition.dayState.journey.==${kind}`]: stored });
  return true;
}
async function resolveAsAuthority(uuid, day, expectedContext, kind, rollMode, expectedRevision) {
  const { user, party } = await request(this, uuid, day);
  if (!CHECKS.includes(kind) || !["publicroll", "gmroll", "blindroll", "selfroll"].includes(rollMode) || typeof expectedContext !== "string" || !/^[a-f0-9]{16}$/.test(expectedContext) || typeof expectedRevision !== "string" || expectedRevision.length > 100) throw new Error("Invalid journey check.");
  return runExpeditionOperation(party, async () => {
    const actors = await resolvePartyTravelActors(party), exp = getActorExpeditionData(party), preview = partyTravelPreview(party, actors);
    if (!exp.active || expeditionDayKey(party) !== day || journeyContextKey(party, actors) !== expectedContext || journeyResultKey(party, kind) !== expectedRevision) return { status: "stale" };
    if (!user.isGM && !hasOwnerPermission(party, user) && kind !== "detection") throw new Error("Journey party is not owned.");
    const existing = await readPrivateExpeditionResult(exp.dayState.journey?.[kind], party, kind);
    if (existing?.context === expectedContext && (kind !== "detection" || existing.parentRevision === exp.dayState.events?.encounters?.revision && existing.orientationRevision === exp.dayState.orientation?.revision)) return { status: "alreadyResolved" };
    if (existing?.applied?.length || kind === "effort" && existing && actors.some(a => { const r = a.flags?.[MODULE_ID]?.journeyReceipt; return r?.party === uuid && r.day === day && r.revision === existing.revision; })) throw new Error("Applied effort cannot be rerolled.");
    if (!preview.config.configured || !preview.profiles.length) throw new Error("Configure the group journey first.");
    if (kind === "effort" && (preview.config.activity !== "travel" || preview.blocked)) throw new Error("Journey is blocked or not travelling.");
    let audience = visibility(rollMode, user), result, rolls = [], detectionSources = null;
    if (kind === "effort") {
      if (!user.isGM) throw new Error("Only a GM can resolve group effort.");
      await ensureExpeditionPrivateStorage();
      const members = [];
      for (const profile of preview.profiles) {
        const actor = actors.find(a => actorReference(a) === profile.ref);
        if (findTravelParties(actor).length > 1) throw new Error("Traveller belongs to multiple active journeys.");
        if (actor.pack || actor.compendium || !actor.system?.health?.toughness) throw new Error("Import traveller into the world before applying journey effort.");
        let test = null, damage = 0, allowNaturalRecovery = profile.effort === 0 || (profile.effort === 1 && profile.enduring);
        const favour = HungerService.applyDisfavour(preview.hasEnduring && !profile.enduring ? 1 : 0, actor);
        if (profile.effort === 2) {
          damage = 1;
          if (!profile.enduring) {
            test = await rollExpeditionAttribute(actor, "strong", -profile.overload, favour); rolls.push(...test.rolls);
            if (!test.success) { const die = await evaluateRoll("1d6"); rolls.push(die); damage += Number(die.total); }
          }
        } else if (profile.effort === 1 && !profile.enduring && preview.hasEnduring) {
          test = await rollExpeditionAttribute(actor, "strong", 0, favour); rolls.push(...test.rolls); allowNaturalRecovery = test.success;
        }
        members.push({ overload: profile.overload, ref: profile.ref, name: actor.name, effort: profile.effort, damage, allowNaturalRecovery,
          mortalWound: test?.total === 20 && profile.effort === 2,
          initialToughness: Number(actor.system?.health?.toughness?.value ?? 0), test: test ? { total: test.total, target: test.target, success: test.success } : null });
      }
      result = { members, applied: [] };
    } else if (kind === "detection") {
      const orientation = await readPrivateExpeditionResult(exp.dayState.orientation, party, "orientation");
      const encounter = await readPrivateExpeditionResult(exp.dayState.events?.encounters, party, "encounters");
      if (!user.isGM && (!canReadExpeditionResult(orientation,user) || !canReadExpeditionResult(encounter,user))) throw new Error("Private detection must be handled by a GM.");
      if (!orientation?.neutralDetection || orientation.contextKey && orientation.contextKey !== expectedContext || !Number.isFinite(encounter?.detectionModifier) || encounter.contextKey && encounter.contextKey !== expectedContext) throw new Error("No eligible encounter detection is available.");
      if (encounter.orientationRevision && encounter.orientationRevision !== orientation.revision) throw new Error("Encounter orientation has changed.");
      const privateParents = [encounter, orientation].filter(p => p.visibility && p.visibility.mode !== "publicroll");
      audience = privateParents[0]?.visibility ?? audience;
      if (privateParents.some(p => JSON.stringify(p.visibility) !== JSON.stringify(audience))) audience = visibility("blindroll", game.user);
      detectionSources = [orientation.revision, encounter.revision];
      if (audience.mode !== "publicroll") await ensureExpeditionPrivateStorage();
      const eligible = new Set([...(party.system?.members ?? []), exp.guideUuid || exp.guideId]);
      const candidates = actors.filter(a => preview.profiles.some(p => p.ref === actorReference(a)) && (eligible.has(actorReference(a)) || eligible.has(a.uuid)));
      const actor = highest(candidates, "vigilant");
      if (!actor) throw new Error("No eligible vigilant traveller.");
      if (!user.isGM && !hasOwnerPermission(party, user) && !hasOwnerPermission(actor, user)) throw new Error("Selected detector is not owned.");
      const test = await rollExpeditionAttribute(actor, "vigilant", encounter.detectionModifier, HungerService.applyDisfavour(0, actor)); rolls.push(...test.rolls);
      result = { actorRef: actorReference(actor), name: actor.name, total: test.total, target: test.target, success: test.success, modifier: encounter.detectionModifier,
        parentRevision: encounter.revision, orientationRevision: orientation.revision };
    } else {
      if (preview.config.activity !== "stay" || preview.stayDays < 2) throw new Error("Staying checks start on the second day at a site.");
      if (audience.mode !== "publicroll") await ensureExpeditionPrivateStorage();
      const actor = highest(actors.filter(a => preview.profiles.some(p => p.ref === actorReference(a))), "discreet");
      const test = await rollExpeditionAttribute(actor, "discreet", 0, HungerService.applyDisfavour(0, actor)); rolls.push(...test.rolls);
      result = { actorRef: actorReference(actor), name: actor.name, total: test.total, target: test.target, success: test.success };
      if (!test.success) {
        const table = await eventTools.resolveTable("enemies", exp.tables?.enemies || "");
        if (!table) throw new Error("Enemy table unavailable for staying check.");
        const modifier = eventTools.eventModifiers({ regionKey: preview.config.region, orientationVerdict: "failure" }).enemies;
        const roll = await evaluateRoll(modifier.formula); rolls.push(roll);
        const drawn = await eventTools.drawTableResult(table, roll);
        result.enemy = { total: roll.total, formula: modifier.formula, text: drawn.text };
      }
    }
    if (expeditionDayKey(party) !== day || journeyContextKey(party, await resolvePartyTravelActors(party)) !== expectedContext || journeyResultKey(party, kind) !== expectedRevision) return { status: "stale" };
    result = { ...result, revision: id(), rolled: true, context: expectedContext, kind, day, timestamp: Date.now() };
    const rollUser = game.users?.get?.(audience.author);
    if (!rollUser) throw new Error("Journey author is unavailable.");
    // Pais com públicos privados diferentes restringem o resultado aos GMs.
    await createChatMessageAfterDice({ speaker: ChatMessage.getSpeaker?.({ actor: party }) ?? {}, rollUser, rollMode: audience.mode,
      content: journeyChat(kind, result), rolls, flags: { [MODULE_ID]: { journeyCheck: kind } } });
    const isCurrent = async () => {
      const current = getActorExpeditionData(party);
      return expeditionDayKey(party) === day && journeyContextKey(party, await resolvePartyTravelActors(party)) === expectedContext && journeyResultKey(party, kind) === expectedRevision && (!detectionSources || current.dayState.orientation?.revision === detectionSources[0] && current.dayState.events?.encounters?.revision === detectionSources[1]);
    };
    if (!await isCurrent() || !await save(party, kind, result, audience, isCurrent)) return { status: "stale" };
    return { status: "rolled" };
  });
}
function highest(actors, attribute) { return [...actors].sort((a,b) => value(b,attribute)-value(a,attribute))[0]; }
function value(actor, attribute) { const attr = actor?.system?.attributes?.[attribute]; return Number(typeof attr === "object" ? attr?.total ?? attr?.value : attr) || 0; }
function journeyChat(kind, result) {
  const lines = result.members ? result.members.map(m => `<li>${escapeHtml(m.name)}: ${localize("Damage")} ${m.damage}; ${localize("Recovery")} ${m.allowNaturalRecovery ? localize("Yes") : localize("No")}${m.test ? `; ${m.test.total}/${m.test.target}` : ""}${m.overload ? `; ${localize("Overload")}: ${m.overload}` : ""}${m.mortalWound ? ` — ${localize("MortalWound")}` : ""}</li>`).join("")
    : `<li>${escapeHtml(result.name)}: ${result.total}/${result.target} — ${result.success ? localize("Success") : localize("Failure")}</li>${result.enemy ? `<li>${escapeHtml(result.enemy.formula)}: ${result.enemy.total} — ${escapeHtml(result.enemy.text)}</li>` : ""}`;
  return `<div class="symbaroum-ind-resources tenebre-events-card"><h3>${localize(kind)}</h3><ul>${lines}</ul><p>${localize(kind === "effort" ? "EffortPreview" : kind === "detection" ? "DetectionChoices" : "StayPolicy")}</p></div>`;
}
async function applyEffortAsAuthority(uuid, day, revision, woundResolution) {
  const { user, party } = await request(this, uuid, day);
  if (!user.isGM || !["manual", "zeroToughness"].includes(woundResolution) || typeof revision !== "string") throw new Error("Only a GM may apply reviewed effort.");
  return runExpeditionOperation(party, async () => {
    if (expeditionDayKey(party) !== day || journeyResultKey(party, "effort") !== revision) return { status: "stale" };
    const exp = getActorExpeditionData(party), result = structuredClone(await readPrivateExpeditionResult(exp.dayState.journey?.effort, party, "effort"));
    const actors = await resolvePartyTravelActors(party);
    if (!exp.dayState.journey?.effort?.privateId) throw new Error("Untrusted effort result.");
    if (!result) return { status: "stale" };
    if (result.applied.length === result.members.length) return { status: "alreadyApplied" };
    if (result.context !== journeyContextKey(party, actors)) return { status: "stale" };
    // Confere o conjunto antes da primeira escrita; recibos cobrem falhas posteriores.
    for (const member of result.members) {
      const actor = actors.find(a => actorReference(a) === member.ref);
      if (!actor || findTravelParties(actor).length > 1) throw new Error("Traveller is unavailable or belongs to multiple active journeys.");
      if (result.applied.includes(member.ref) || member.mortalWound && woundResolution === "manual") continue;
      const receipt = actor.flags?.[MODULE_ID]?.journeyReceipt;
      if (!(receipt?.party === uuid && receipt.day === day && receipt.revision === revision) && Number(actor.system?.health?.toughness?.value ?? 0) !== member.initialToughness) throw new Error("Traveller health changed; review effort before applying.");
    }
    for (const member of result.members) {
      const actor = actors.find(a => actorReference(a) === member.ref);
      if (!actor) throw new Error("Journey participant unavailable.");
      if (result.applied.includes(member.ref)) continue;
      if (member.mortalWound && woundResolution === "manual") continue;
      const receipt = actor.flags?.[MODULE_ID]?.journeyReceipt;
      if (!(receipt?.party === uuid && receipt.day === day && receipt.revision === revision)) {
        const current = Number(actor.system?.health?.toughness?.value ?? 0);
        if (current !== member.initialToughness) throw new Error("Traveller health changed; review effort before applying.");
        await actor.update({ "system.health.toughness.value": member.mortalWound ? 0 : Math.max(0, current - member.damage),
          [`flags.${MODULE_ID}.==journeyReceipt`]: { party: uuid, day, revision, context: result.context, allowNaturalRecovery: member.allowNaturalRecovery } });
      }
      result.applied.push(member.ref);
    }
    // Guarda o mesmo identificador para que recibos sobrevivam a uma repetição.
    await save(party, "effort", result, result.visibility ?? visibility("publicroll", user));
    return { status: result.applied.length === result.members.length ? "applied" : "pendingWound" };
  });
}
