import { actorReference } from "./actor-references.mjs";
import { MODULE_ID } from "./constants.mjs";
import { hasOwnerPermission, SocketService } from "./sockets.mjs";
import {
  DavokarExpedition, detectionAvailable, eventsAvailable, expeditionGuideProfile, groupParticipants, mishapAvailable,
  remainingFollowUps, ROLL_MODES, SEARCH_MODES, TABLE_KEYS, usesNativeTargetLimit
} from "./davokar-expedition.mjs";
import { EVENT_KEYS, eventPlan, orientationPlan, PREPARATIONS, REGIONS, ruinFindsFormula } from "./davokar-rules.mjs";
import { getDavokarKey, readDavokarJournal, restoreDavokarKey } from "./davokar-storage.mjs";
import { resolveDavokarTable, tableRollFormula } from "./davokar-tables.mjs";

const keyFor = key => "TENEBRE.Davokar." + key;
const text = key => game.i18n.localize(keyFor(key));
const listOptions = (keys, selected, prefix) => keys.map(value => ({ value, label: text(prefix + value), selected: value === selected }));
const signed = value => (value > 0 ? "+" : "") + value;
const modifiersView = (modifiers = {}) => Object.entries(modifiers).map(([key, amount]) => ({
  label: text("Modifier." + key), amount: signed(amount)
}));

export async function davokarView(group) {
  if (!game.journal || !game.user) return null;
  if (!game.user.isGM) {
    const canObserve = group.testUserPermission?.(game.user, "OBSERVER");
    if (!canObserve || !SocketService.hasActiveGM() || !SocketService.active) return null;
    const participants = await groupParticipants(group);
    if (!participants.some(actor => hasOwnerPermission(actor, game.user))) return null;
    const grant = await DavokarExpedition.request(group, "grant");
    return { player: true, grant: grant.ok ? grant.grant : "" };
  }

  let state;
  try {
    ({ state } = await readDavokarJournal(group.uuid));
  } catch (error) {
    const needsKey = error.message === "KeyRequired";
    const code = needsKey || error.message === "SecureContext" ? error.message : "StorageError";
    return { error: text("Error." + code), showKey: needsKey };
  }
  if (!state) return { start: true };

  const day = state.current;
  const config = day.config;
  const participants = await groupParticipants(group);
  const guide = participants.find(actor => actorReference(actor) === config.guide);
  const profile = expeditionGuideProfile(guide);
  const plan = orientationPlan(profile, config, usesNativeTargetLimit());
  const advances = remainingFollowUps(day);
  const started = Boolean(Object.keys(day.results).length);
  const tableChoices = [...game.tables.values()].sort((a, b) => a.name.localeCompare(b.name));
  const events = await Promise.all(TABLE_KEYS.map(async key => {
    let table;
    try { table = await resolveDavokarTable(key, config.tables[key]); } catch { /* report as unavailable in the panel */ }
    const calculation = key === "mishaps" ? { modifier: REGIONS[config.region].mishaps, modifiers: { region: REGIONS[config.region].mishaps } }
      : key === "nature" ? { modifier: 0, modifiers: {} } : eventPlan(key, config, day.results.orientation);
    const formula = table?.replacement ? tableRollFormula(key, table, calculation.modifier) : "";
    const slot = key === "mishaps" ? "mishap" : key;
    return {
      key, name: text("Action." + slot), formula, source: table?.name, missing: !table, nonreplacement: table && !table.replacement,
      reference: config.tables[key] ?? "", modifiers: modifiersView(calculation.modifiers),
      button: key === "mishaps" ? "mishap" : key === "nature" ? "nature" : "event",
      enabled: Boolean(formula && (key === "mishaps" ? mishapAvailable(day) : key === "nature" ? advances.nature
        : eventsAvailable(day) && !day.results[key])),
      choices: tableChoices.map(item => ({ uuid: item.uuid, name: item.name }))
    };
  }));

  return {
    day: day.number, revision: state.revision, started, showKey: true,
    config, guide: guide?.name, missingGuide: Boolean(config.guide && !guide), profile, plan,
    planModifiers: modifiersView(plan.modifiers), mayOrient: plan.eligible && !day.results.orientation,
    maySkip: !day.results.orientation, modeOptions: listOptions(ROLL_MODES, config.mode, "Mode."),
    regionOptions: listOptions(Object.keys(REGIONS), config.region, "Region."),
    searchOptions: listOptions(SEARCH_MODES, config.search, "Search."),
    preparationOptions: listOptions(Object.keys(PREPARATIONS), config.preparation, "Preparation."),
    guideOptions: participants.map(actor => ({ value: actorReference(actor), label: actor.name, selected: actor === guide })),
    mayDetect: detectionAvailable(day), customDetection: day.results.encounters && !day.results.encounters.official,
    findings: day.results.ruins?.official && !day.results.finds ? ruinFindsFormula(day.results.ruins.total) : null,
    mayStay: config.staying && eventsAvailable(day) && !day.results.stay,
    mayStayEnemies: day.results.stay?.verdict === "failure" && !day.results.stayEnemies,
    advances, events, results: recordsView(day), attempts: attemptsView(day),
    history: [...state.history].reverse().map(old => ({
      number: old.number, region: text("Region." + old.config.region),
      results: recordsView(old), attempts: attemptsView(old)
    }))
  };
}

function attemptsView(day) {
  return day.attempts.map((attempt, index) => ({ number: index + 1, results: recordsView(attempt) }));
}

function recordsView(day) {
  return Object.entries(day.results).map(([key, record]) => ({
    key, name: text("Action." + key.replace(/\d+$/, "")), record, modifiers: modifiersView(record.modifiers),
    summary: record.verdict ? text("Verdict." + record.verdict) : String(record.total),
    rollDetails: Number.isFinite(record.die) ? record.die + " / " + record.target : record.formula,
    critical: record.critical ? text("Critical." + record.critical) : "",
    notes: day.resolutions.filter(note => note.key === key)
  }));
}

export async function davokarPanel(group) {
  const render = globalThis.foundry?.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  if (!render || group?.pack || group?.isToken || group?.documentName !== "Actor") return null;
  const view = await davokarView(group);
  if (!view) return null;
  return render("modules/" + MODULE_ID + "/templates/davokar-expedition.hbs", view);
}

function configFrom(panel) {
  const config = {};
  for (const input of panel.querySelectorAll("[data-davokar-field]")) {
    config[input.dataset.davokarField] = input.type === "checkbox" ? input.checked
      : input.type === "number" ? input.valueAsNumber : input.value;
  }
  return config;
}

export function bindDavokarPanel(sheet, root) {
  const panel = root.querySelector?.("[data-davokar-panel]");
  if (!panel) return;
  // The Group sheet is read-only for observers, but a granted roll goes through the active GM.
  const delegated = panel.querySelector('[data-davokar-action="orient"][data-grant]');
  if (delegated) delegated.disabled = false;
  panel.addEventListener("change", event => {
    event.stopPropagation();
    if (event.target.matches("[data-table-picker]")) {
      event.target.closest("[data-davokar-table]").querySelector("[data-table-reference]").value = event.target.value;
    }
  });
  panel.addEventListener("keydown", event => {
    if (event.key === "Enter" && ["INPUT", "SELECT"].includes(event.target.tagName)) event.preventDefault();
  });
  let busy = false;
  panel.addEventListener("click", async event => {
    const button = event.target.closest("[data-davokar-action]");
    if (!button || button.disabled || busy) return;
    const action = button.dataset.davokarAction;
    if (action === "open") {
      const document = await globalThis.fromUuid(button.dataset.reference);
      document?.sheet?.render(true);
      return;
    }
    busy = true;
    panel.setAttribute("aria-busy", "true");
    const buttons = [...panel.querySelectorAll("button:not([disabled])")];
    for (const item of buttons) item.disabled = true;
    try {
      if (action === "key") {
        await editDavokarKey(sheet);
        return;
      }
      const key = button.dataset.key;
      const revision = panel.dataset.revision ? Number(panel.dataset.revision) : null;
      let payload = key ? { key } : {};
      if (action === "configure") payload = configFrom(panel);
      if (action === "table") payload.reference = button.closest("[data-davokar-table]").querySelector("[data-table-reference]").value.trim();
      if (action === "resolve") payload.note = button.closest("[data-davokar-result]").querySelector("textarea").value;
      if (action === "detect") payload.modifier = panel.querySelector("[data-detection-modifier]")?.valueAsNumber;
      if (button.dataset.grant) payload.grant = button.dataset.grant;
      if (action === "retry" && !await confirmRetry()) return;
      const result = await DavokarExpedition.request(sheet.actor, action, payload, revision);
      if (!result.ok) ui.notifications.warn(text("Error." + result.code));
      if (result.chatError) ui.notifications.warn(text("Error.ChatError"));
      if (result.ok || result.code === "Stale" || (delegated && result.code === "Forbidden")) sheet.render(false);
    } catch (error) {
      console.warn("Ind Resources | Davokar sheet action failed.", error);
      ui.notifications.error(text("Error.OperationError"));
    } finally {
      busy = false;
      panel.removeAttribute("aria-busy");
      for (const item of buttons) item.disabled = false;
    }
  });
}

function confirmRetry() {
  const dialog = globalThis.foundry?.applications?.api?.DialogV2;
  if (dialog?.confirm) return dialog.confirm({
    window: { title: text("Retry") }, content: "<p>" + text("RetryConfirm") + "</p>", modal: true, rejectClose: false
  });
  return globalThis.Dialog?.confirm?.({ title: text("Retry"), content: "<p>" + text("RetryConfirm") + "</p>" }) ?? false;
}

async function editDavokarKey(sheet) {
  const dialog = globalThis.foundry?.applications?.api?.DialogV2;
  const value = await dialog.prompt({
    window: { title: text("Key.Title") },
    content: '<p>' + text("Key.Help") + '</p><label>' + text("Key.Title")
      + '<input name="davokarKey" type="text" autocomplete="off" spellcheck="false" maxlength="64"></label>',
    modal: true,
    rejectClose: false,
    ok: { callback: (_event, button) => button.form.elements.davokarKey.value.trim().toLowerCase() },
    render: (_event, app) => { app.element.querySelector('[name="davokarKey"]').value = getDavokarKey(); }
  });
  if (!value) return;
  try {
    await restoreDavokarKey(value);
    sheet.render(false);
  } catch {
    ui.notifications.warn(text("Error.KeyRequired"));
  }
}
