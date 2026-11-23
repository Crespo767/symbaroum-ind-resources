import { actorReference, resolveActorReference } from "./actor-references.mjs";
import { MODULE_ID } from "./constants.mjs";
import { createChatMessageAfterDice } from "./dice.mjs";
import { HungerService } from "./hunger.mjs";
import { getRequestUser, hasOwnerPermission, SocketService } from "./sockets.mjs";
import { escapeHtml } from "./utils.mjs";
import {
  actorAttribute, corruptedNatureCount, detectionModifier, EVENT_KEYS, eventPlan, guideProfile,
  orientationOutcome, orientationPlan, PREPARATIONS, REGIONS, ruinFindsFormula
} from "./davokar-rules.mjs";
import { createDavokarDay, newDavokarState, openDavokarData, readDavokarJournal, saveDavokarJournal, sealDavokarData } from "./davokar-storage.mjs";
import { resolveDavokarTable, rollDavokarTable } from "./davokar-tables.mjs";

const HANDLER = "dispatchDavokarExpedition";
const operations = new Map();
const playerGrants = new Map();
export const TABLE_KEYS = ["mishaps", ...EVENT_KEYS, "nature"];
export const ROLL_MODES = ["publicroll", "gmroll", "blindroll", "selfroll"];
export const SEARCH_MODES = ["off", "search", "noSearch", "fast"];

export function defaultDavokarConfig() {
  return {
    region: "bright", guide: "", preparation: "none", cartographer: 0, circumstance: 0,
    search: "off", river: false, staying: false, mode: "gmroll", allowPlayer: false, tables: {}
  };
}

export async function groupParticipants(group) {
  const refs = new Set([...(group.system?.members ?? []), ...(group.system?.companions ?? [])]);
  const actors = await Promise.all([...refs].map(resolveActorReference));
  return [...new Map(actors.filter(Boolean).map(actor => [actor.uuid ?? actor.id, actor])).values()];
}

export function expeditionGuideProfile(actor) {
  return { ...guideProfile(actor), hungry: HungerService.hasHunger(actor) };
}

export function usesNativeTargetLimit() {
  return ["alwaysSucceedOnOne", "optionalCrit", "optionalRareCrit"].some(key => game.settings.get("symbaroum", key));
}

export function validDavokarConfig(input) {
  return typeof input === "object" && Boolean(input)
    && Object.hasOwn(REGIONS, input.region) && Object.hasOwn(PREPARATIONS, input.preparation)
    && SEARCH_MODES.includes(input.search) && ROLL_MODES.includes(input.mode)
    && typeof input.guide === "string" && input.guide.length <= 240
    && Number.isSafeInteger(input.cartographer) && input.cartographer >= 0 && input.cartographer <= 3
    && Number.isSafeInteger(input.circumstance) && Math.abs(input.circumstance) <= 100
    && ["river", "staying", "allowPlayer"].every(key => typeof input[key] === "boolean");
}

function fail(code) {
  throw new Error(code);
}

function actionError(code) {
  return /^(Forbidden|UnknownGroup|Stale|AlreadyRolled|NotReady|InvalidConfig|GuideUnavailable|Ineligible|MissingTable|InvalidTable|NoDice|StorageError|KeyRequired|SecureContext|NoUniqueResult|NoActiveGM)$/.test(code)
    ? code : "OperationError";
}

export class DavokarExpedition {
  static register() {
    SocketService.registerHandler(HANDLER, dispatchAsAuthority);
    Hooks.on("renderChatMessageHTML", (message, html) => void renderPrivateChat(message, html));
  }

  static async request(group, action, payload = {}, revision = null) {
    if (!group?.uuid) return { ok: false, code: "UnknownGroup" };
    try {
      if (SocketService.isPrimaryGM()) {
        return await dispatchAsAuthority.call({ socketdata: { userId: game.user.id } }, group.uuid, action, payload, revision);
      }
      if (!SocketService.hasActiveGM() || !SocketService.active) return { ok: false, code: "NoActiveGM" };
      return await SocketService.executeAsPrimaryGM(HANDLER, group.uuid, action, payload, revision);
    } catch (error) {
      return { ok: false, code: actionError(error.message) };
    }
  }
}

async function dispatchAsAuthority(groupUuid, action, payload, expectedRevision) {
  if (!SocketService.isPrimaryGM()) return { ok: false, code: "NoActiveGM" };
  let actorUser;
  try {
    actorUser = getRequestUser(this);
  } catch {
    return { ok: false, code: "Forbidden" };
  }
  const player = !actorUser.isGM;
  if (player && !["grant", "orient"].includes(action)) return { ok: false, code: "Forbidden" };
  if (typeof groupUuid !== "string" || !/^Actor\.[A-Za-z0-9]+$/.test(groupUuid)) return { ok: false, code: "UnknownGroup" };
  const previous = operations.get(groupUuid) ?? Promise.resolve();
  const operation = previous.catch(() => {}).then(async () => {
    if (!SocketService.isPrimaryGM()) fail("NoActiveGM");
    const user = game.users.get(actorUser.id);
    if (!user?.active || Boolean(user.isGM) === player) fail("Forbidden");
    const group = await globalThis.fromUuid(groupUuid);
    if (group?.documentName !== "Actor" || group.type !== MODULE_ID + ".party" || group.pack || group.uuid !== groupUuid) fail("UnknownGroup");
    if (player && !group.testUserPermission(user, "OBSERVER")) fail("Forbidden");
    if (player && action === "grant") return grantForPlayer(group, user);
    const result = await operate(group, user, action, payload, expectedRevision);
    if (player && group.sheet?.rendered) group.sheet.render(false);
    return result;
  });
  operations.set(groupUuid, operation);
  try {
    const result = await operation;
    return player && action !== "grant" ? { ok: true } : result;
  } catch (error) {
    return { ok: false, code: player ? "Forbidden" : actionError(error.message) };
  } finally {
    if (operations.get(groupUuid) === operation) operations.delete(groupUuid);
  }
}

async function grantForPlayer(group, user) {
  const { state } = await readDavokarJournal(group.uuid);
  const day = state?.current;
  if (!day?.config.allowPlayer || day.config.mode === "selfroll" || day.results.orientation) fail("Forbidden");
  const guide = (await groupParticipants(group)).find(actor => actorReference(actor) === day.config.guide);
  if (!guide || guide.pack || !hasOwnerPermission(guide, user)) fail("Forbidden");
  const key = group.uuid + ":" + user.id;
  const now = Date.now();
  for (const [id, grant] of playerGrants) if (grant.expires <= now) playerGrants.delete(id);
  let grant = playerGrants.get(key);
  if (!grant || grant.revision !== state.revision || grant.guide !== guide.uuid) {
    grant = { id: globalThis.crypto?.randomUUID?.() ?? foundry.utils.randomID(32), revision: state.revision, guide: guide.uuid, expires: now + 1800000 };
    playerGrants.set(key, grant);
  }
  return { ok: true, grant: grant.id };
}

async function operate(group, user, action, payload, expectedRevision) {
  const { journal, state: saved } = await readDavokarJournal(group.uuid);
  if (user.isGM && (saved?.revision ?? null) !== expectedRevision) fail("Stale");
  if (!user.isGM) {
    const key = group.uuid + ":" + user.id;
    const grant = playerGrants.get(key);
    if (!grant || grant.id !== payload?.grant || grant.revision !== saved?.revision || grant.expires <= Date.now()) fail("Stale");
    playerGrants.delete(key);
  }
  const state = saved ?? newDavokarState(defaultDavokarConfig());
  const day = state.current;
  const config = day.config;
  if (!saved && action !== "start") fail("NotReady");

  let publications = [];
  switch (action) {
    case "start":
      if (saved) fail("AlreadyRolled");
      break;
    case "configure":
      if (Object.keys(day.results).length) fail("AlreadyRolled");
      if (!validDavokarConfig(payload)) fail("InvalidConfig");
      if (payload.guide && !(await groupParticipants(group)).some(actor => actorReference(actor) === payload.guide)) fail("GuideUnavailable");
      day.config = {
        region: payload.region, guide: payload.guide, preparation: payload.preparation, cartographer: payload.cartographer,
        circumstance: payload.circumstance, search: payload.search, river: payload.river, staying: payload.staying,
        mode: payload.mode, allowPlayer: payload.allowPlayer, tables: config.tables
      };
      break;
    case "table":
      if (!TABLE_KEYS.includes(payload?.key) || typeof payload.reference !== "string" || payload.reference.length > 240) fail("InvalidConfig");
      if (payload.reference && !await resolveDavokarTable(payload.key, payload.reference)) fail("MissingTable");
      if (payload.reference) config.tables[payload.key] = payload.reference;
      else delete config.tables[payload.key];
      break;
    case "next":
      state.history.push(day);
      state.current = createDavokarDay(day.number + 1, { ...config, tables: { ...config.tables }, staying: false });
      break;
    case "retry":
      if (!Object.keys(day.results).length) fail("NotReady");
      day.attempts.push({ config: structuredClone(config), results: day.results, resolutions: day.resolutions });
      day.results = {};
      day.resolutions = [];
      break;
    case "skip":
      ensureOpen(day, "orientation");
      day.results.orientation = { verdict: "skipped", benefits: false, needsMishap: false };
      break;
    case "orient":
      publications = [await orient(group, user, day)];
      break;
    case "mishap":
      if (!mishapAvailable(day)) fail("NotReady");
      publications = [await tableResult(day, "mishap", "mishaps", { modifier: REGIONS[config.region].mishaps, modifiers: { region: REGIONS[config.region].mishaps } })];
      break;
    case "event": {
      const key = payload?.key;
      if (!EVENT_KEYS.includes(key) || !eventsAvailable(day)) fail("NotReady");
      publications = [await tableResult(day, key, key, eventPlan(key, config, day.results.orientation))];
      break;
    }
    case "detect":
      publications = [await detect(group, day, payload)];
      break;
    case "finds":
      publications = [await rollFinds(day)];
      break;
    case "stay":
      if (!config.staying || !eventsAvailable(day)) fail("NotReady");
      publications = [await highestTest(group, day, "stay", "discreet", 0)];
      break;
    case "stayEnemies":
      if (day.results.stay?.verdict !== "failure") fail("NotReady");
      publications = [await tableResult(day, "stayEnemies", "enemies", eventPlan("enemies", config, null))];
      break;
    case "mishapExtra":
      if (!remainingFollowUps(day).mishaps) fail("NotReady");
      publications = [await tableResult(day, nextKey(day, "mishapExtra"), "mishaps", {
        modifier: REGIONS[config.region].mishaps, modifiers: { region: REGIONS[config.region].mishaps }
      })];
      break;
    case "mishapEnemies":
      if (!remainingFollowUps(day).enemies) fail("NotReady");
      publications = [await tableResult(day, nextKey(day, "mishapEnemies"), "enemies", eventPlan("enemies", config, null))];
      break;
    case "nature":
      if (!remainingFollowUps(day).nature) fail("NotReady");
      publications = [await tableResult(day, nextKey(day, "nature"), "nature", { modifier: 0, modifiers: {} },
        indexedResults(day, "nature").flatMap(result => result.rows.map(row => row.id)))];
      break;
    case "resolve":
      if (typeof payload?.key !== "string" || !Object.hasOwn(day.results, payload.key)
        || typeof payload.note !== "string" || !payload.note.trim() || payload.note.length > 2000) fail("InvalidConfig");
      day.resolutions.push({ key: payload.key, note: payload.note.trim() });
      break;
    default:
      fail("InvalidConfig");
  }

  if (!SocketService.isPrimaryGM()) fail("NoActiveGM");
  if ((await readDavokarJournal(group.uuid)).state?.revision !== saved?.revision) fail("Stale");
  state.revision++;
  await saveDavokarJournal(group, journal, state);

  let chatError = false;
  for (const entry of publications) {
    try {
      await publish(entry, group, user, config.mode);
    } catch (error) {
      console.warn("Ind Resources | Davokar result persisted; chat publication failed.", error);
      chatError = true;
    }
  }
  return { ok: true, revision: state.revision, chatError };
}

function ensureOpen(day, key) {
  if (Object.hasOwn(day.results, key)) fail("AlreadyRolled");
}

export function mishapAvailable(day) {
  const orientation = day.results.orientation;
  return !day.results.mishap && (orientation?.needsMishap || orientation?.verdict === "skipped");
}

export function eventsAvailable(day) {
  const orientation = day.results.orientation;
  return Boolean(orientation && (!orientation.needsMishap || day.results.mishap));
}

async function runNativeTest(actor, attribute, favour, modifier) {
  const api = game.symbaroum?.api;
  if (typeof api?.baseRoll !== "function") fail("NoDice");
  const roll = await api.baseRoll(actor, attribute, null, null, HungerService.applyDisfavour(favour, actor), modifier, false);
  if (!Number.isFinite(roll?.diceResult) || !Number.isFinite(roll?.diceTarget)
    || typeof roll?.hasSucceed !== "boolean" || !Array.isArray(roll?.rolls) || !roll.rolls.length) fail("NoDice");
  return roll;
}

async function orient(group, user, day) {
  const config = day.config;
  const findGuide = async () => (await groupParticipants(group)).find(actor => actorReference(actor) === config.guide);
  const actor = await findGuide();
  if (!actor) fail("GuideUnavailable");
  // Compendium actor templates are usable by the GM, never as a player's owned character.
  if (!user.isGM && (!config.allowPlayer || config.mode === "selfroll" || actor.pack || !hasOwnerPermission(actor, user))) fail("Forbidden");
  ensureOpen(day, "orientation");
  const profile = expeditionGuideProfile(actor);
  const plan = orientationPlan(profile, config, usesNativeTargetLimit());
  if (!plan.eligible) fail("Ineligible");
  const roll = await runNativeTest(actor, "vigilant", profile.pathfinder ? 1 : 0, plan.modifier);
  const currentGuide = await findGuide();
  if (currentGuide?.uuid !== actor.uuid || JSON.stringify(expeditionGuideProfile(currentGuide)) !== JSON.stringify(profile)) fail("Stale");
  const critical = game.settings.get("symbaroum", "critsApplyToAllTests") ? roll : { ...roll, critSuccess: false, critFail: false };
  const record = { ...orientationOutcome(plan, critical), modifiers: plan.modifiers, actor: actor.name, actorUuid: actor.uuid };
  day.results.orientation = record;
  return { key: "orientation", actor, rolls: roll.rolls, record };
}

export function detectionAvailable(day) {
  const encounter = day.results.encounters;
  return Boolean(day.results.orientation?.benefits && encounter && !day.results.detect
    && (!encounter.official || detectionModifier(encounter.total) !== null));
}

async function detect(group, day, payload) {
  if (!detectionAvailable(day)) fail("NotReady");
  const encounter = day.results.encounters;
  const modifier = encounter.official ? detectionModifier(encounter.total) : payload?.modifier;
  if (!Number.isSafeInteger(modifier) || Math.abs(modifier) > 100) fail("InvalidConfig");
  return highestTest(group, day, "detect", "vigilant", modifier);
}

async function highestTest(group, day, key, attribute, modifier) {
  ensureOpen(day, key);
  const chooseActor = async () => {
    const actors = (await groupParticipants(group)).filter(actor => key !== "detect" || actor.type === "player" || actorReference(actor) === day.config.guide);
    return actors.filter(actor => actorAttribute(actor, attribute) !== null)
      .sort((a, b) => actorAttribute(b, attribute) - actorAttribute(a, attribute))[0];
  };
  const actor = await chooseActor();
  if (!actor) fail("NotReady");
  const before = actorAttribute(actor, attribute);
  const roll = await runNativeTest(actor, attribute, 0, modifier);
  if ((await chooseActor())?.uuid !== actor.uuid || actorAttribute(actor, attribute) !== before) fail("Stale");
  const record = {
    verdict: roll.hasSucceed ? "success" : "failure", die: roll.diceResult, target: roll.diceTarget,
    modifiers: { test: modifier }, actor: actor.name, actorUuid: actor.uuid
  };
  day.results[key] = record;
  return { key, actor, rolls: roll.rolls, record };
}

async function rollFinds(day) {
  ensureOpen(day, "finds");
  const ruins = day.results.ruins;
  const formula = ruins?.official ? ruinFindsFormula(ruins.total) : null;
  if (!formula) fail("NotReady");
  const roll = await new Roll(formula).evaluate();
  const record = { total: roll.total, formula };
  day.results.finds = record;
  return { key: "finds", rolls: [roll], record };
}

function indexedResults(day, prefix) {
  return Object.entries(day.results).filter(([key]) => key.startsWith(prefix)).map(([, result]) => result);
}

function nextKey(day, prefix) {
  return prefix + (indexedResults(day, prefix).length + 1);
}

export function remainingFollowUps(day) {
  const extra = indexedResults(day, "mishapExtra");
  const mishaps = [day.results.mishap, ...extra].filter(result => result?.official);
  const terrain = day.results.terrain;
  return {
    mishaps: Math.max(0, 2 * mishaps.filter(result => result.total === 18).length - extra.length),
    enemies: Math.max(0, mishaps.filter(result => result.total === 25).length - indexedResults(day, "mishapEnemies").length),
    nature: Math.max(0, (terrain?.official ? corruptedNatureCount(terrain.total) : 0) - indexedResults(day, "nature").length)
  };
}

async function tableResult(day, key, tableKey, plan, exclude = []) {
  ensureOpen(day, key);
  const table = await resolveDavokarTable(tableKey, day.config.tables[tableKey]);
  if (!table) fail("MissingTable");
  const attempts = exclude.length ? 40 : 1;
  for (let index = 0; index < attempts; index++) {
    const output = await rollDavokarTable(tableKey, table, plan);
    if (!output) fail("InvalidTable");
    if (output.record.rows.some(row => exclude.includes(row.id))) continue;
    day.results[key] = output.record;
    return { key: tableKey === "mishaps" ? "mishap" : key === "stayEnemies" ? key : tableKey, rolls: [output.roll], record: output.record };
  }
  fail("NoUniqueResult");
}

const TRANSLATION_PREFIX = "TENEBRE.Davokar.";
const translate = key => game.i18n.localize(TRANSLATION_PREFIX + key);
const numeric = value => Number.isFinite(value) ? String(value) : "";
const PRIVATE_CHAT = "davokarPrivateChat";
async function publish({ key, actor, rolls, record }, group, user, mode) {
  const title = translate("Action." + key);
  const result = record.verdict ? translate("Verdict." + record.verdict) : numeric(record.total);
  const margin = Number.isFinite(record.margin) ? " · " + translate("Margin") + " " + record.margin : "";
  const formula = record.formula ?? [numeric(record.die), numeric(record.target)].filter(Boolean).join(" / ");
  const rows = record.rows?.map(row => "<li><strong>" + escapeHtml(row.name) + "</strong> " +
    escapeHtml(row.publicText) + "</li>").join("") ?? "";
  const modifiers = Object.entries(record.modifiers ?? {}).filter(([, amount]) => amount !== 0).map(([source, amount]) =>
    escapeHtml(translate("Modifier." + source) + " " + (amount > 0 ? "+" : "") + amount)).join(" · ");
  const speaker = ChatMessage.getSpeaker({ actor: actor ?? group });
  const source = actor?.name || record.table || group.name;
  const content = '<div class="tenebre-chat-card"><h3>' + escapeHtml(title) + "</h3><p>" + escapeHtml(source)
    + "</p><p>" + escapeHtml(formula) + " · " + escapeHtml(result + margin) + "</p>"
    + (modifiers ? "<p>" + modifiers + "</p>" : "") + (rows ? "<ul>" + rows + "</ul>" : "") + "</div>";
  if (mode === "publicroll") {
    await createChatMessageAfterDice({ speaker, rolls, rollUser: user, rollMode: mode, privateRoll: false, content });
    return;
  }
  // Foundry includes whisper data in the shared message collection. Keep the roll and description encrypted.
  const whisper = mode === "selfroll" ? [user.id] : game.users.filter(candidate => candidate.isGM).map(candidate => candidate.id);
  const sealed = await sealDavokarData(content, PRIVATE_CHAT);
  await ChatMessage.create({
    speaker: { alias: translate("Tab") }, user: user.id, whisper, blind: mode === "blindroll",
    content: "<p>" + escapeHtml(translate("PrivateChat")) + "</p>",
    flags: { [MODULE_ID]: { [PRIVATE_CHAT]: sealed } }
  });
}

async function renderPrivateChat(message, html) {
  if (!game.user.isGM || !message.whisper.includes(game.user.id)) return;
  const sealed = message.getFlag(MODULE_ID, PRIVATE_CHAT);
  if (!sealed) return;
  try {
    const content = await openDavokarData(sealed, PRIVATE_CHAT);
    const body = html.querySelector(".message-content");
    if (body && typeof content === "string") body.innerHTML = content;
  } catch { /* Browsers without the expedition key still show the fallback message. */ }
}
