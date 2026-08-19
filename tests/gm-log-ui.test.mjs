import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GM_LOG_EVENT_TYPES } from "../scripts/gm-log-events.mjs";
import {
  filterGmLogEvents,
  formatGmLogEvent,
  hideGmLogOnlyMessage
} from "../scripts/gm-log-ui.mjs";

function event({ id, type, category, outcome = "info", occurredAt = 1_000 }) {
  return {
    eventId: id,
    type,
    category,
    outcome,
    occurredAt,
    actor: { name: "Crespo" },
    target: { name: "Elfo" },
    subject: { name: "Arco" },
    source: { messageId: id, variant: "single" },
    values: { roll: 7 }
  };
}

test("filters events without mutating the service snapshot", () => {
  const events = [
    event({ id: "attack", type: GM_LOG_EVENT_TYPES.ATTACK, category: "combat" }),
    event({ id: "roll", type: GM_LOG_EVENT_TYPES.ROLL, category: "rolls" })
  ];

  const all = filterGmLogEvents(events, "all");
  const combat = filterGmLogEvents(events, "combat");

  assert.notEqual(all, events);
  assert.deepEqual(all.map((entry) => entry.eventId), ["attack", "roll"]);
  assert.deepEqual(combat.map((entry) => entry.eventId), ["attack"]);
  assert.deepEqual(filterGmLogEvents(events, "unknown").map((entry) => entry.eventId), ["attack", "roll"]);
});

test("formats compact rows through localization without injecting HTML", () => {
  const input = event({
    id: "attack",
    type: GM_LOG_EVENT_TYPES.ATTACK,
    category: "combat",
    outcome: "success",
    occurredAt: 2_000
  });
  const calls = [];
  const result = formatGmLogEvent(input, {
    localize: (key, data) => {
      calls.push({ key, data });
      return `${data.actor} > ${data.target}`;
    },
    formatTime: () => "12:34"
  });

  assert.equal(result.text, "Crespo > Elfo");
  assert.equal(result.time, "12:34");
  assert.equal(result.category, "combat");
  assert.equal(calls[0].key, "TENEBRE.GmLog.Attack.Success");
});

test("hides GM-log transport messages from the native general chat", () => {
  const classes = [];
  const attributes = [];
  const styles = [];
  const element = {
    hidden: false,
    classList: { add: (value) => classes.push(value) },
    setAttribute: (...args) => attributes.push(args),
    style: { setProperty: (...args) => styles.push(args) }
  };

  assert.equal(hideGmLogOnlyMessage({ flags: {} }, element), false);
  assert.equal(hideGmLogOnlyMessage({
    flags: { "symbaroum-ind-resources": { gmLogOnly: true } }
  }, element), true);
  assert.equal(element.hidden, true);
  assert.deepEqual(classes, ["tenebre-gm-log-only-message"]);
  assert.deepEqual(attributes, [["aria-hidden", "true"]]);
  assert.deepEqual(styles, [["display", "none", "important"]]);
});

test("UI is a GM-only second chat page and does not create chat documents", async () => {
  const source = await readFile(new URL("../scripts/gm-log-ui.mjs", import.meta.url), "utf8");
  const template = await readFile(new URL("../templates/gm-log.hbs", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles/symbaroum-ind-resources.css", import.meta.url), "utf8");
  assert.match(source, /!game\.user\?\.isGM/);
  assert.match(source, /Hooks\.on\("renderChatLog"/);
  assert.match(source, /Hooks\.on\("renderChatMessageHTML"/);
  assert.match(source, /const CHAT_PAGE = "chat"/);
  assert.match(source, /const GM_LOG_PAGE = "gm-log"/);
  assert.match(source, /root\.prepend\(navigation\)/);
  assert.match(source, /root\.append\(logPage\)/);
  assert.match(source, /child\.classList\.add\(NATIVE_PAGE_CLASS\)/);
  assert.match(source, /data-tenebre-gm-log-page/);
  assert.match(source, /button\.closest\(`#\$\{CHAT_ROOT_ID\}`\)/);
  assert.match(source, /button\.addEventListener\("click"/);
  assert.match(source, /this\.#showPage\(page, root\)/);
  assert.match(source, /root\.classList\.toggle\(ACTIVE_PAGE_CLASS, logOpen\)/);
  assert.match(source, /foundry\?\.applications\?\.handlebars\?\.renderTemplate/);
  assert.match(source, /this\.#unmount\(\)/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /event\.stopPropagation\(\)/);
  assert.match(template, /tenebre-gm-log-list/);
  assert.match(template, /data-action="clear-log"/);
  assert.match(css, /\.tenebre-gm-log-chat\.tenebre-gm-log-page-active > \.tenebre-gm-log-native-page\s*\{[\s\S]*?display:\s*none !important;/);
  assert.match(css, /\.tenebre-gm-log-page\[hidden\]/);
  assert.match(css, /\.tenebre-gm-log-pages\s*\{[\s\S]*?pointer-events:\s*auto;/);
  assert.match(css, /\.tenebre-gm-log-page\s*\{[\s\S]*?pointer-events:\s*auto;/);
  assert.doesNotMatch(css, /\.tenebre-gm-log-page\s*\{[^}]*position:\s*(?:fixed|absolute)/);
  assert.doesNotMatch(source, /ApplicationV2|new Dialog/);
  assert.doesNotMatch(source, /ChatMessage\.create/);
  assert.doesNotMatch(source, /game\.socket/);
});
