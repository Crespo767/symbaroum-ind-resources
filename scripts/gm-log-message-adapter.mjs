import { MODULE_ID } from "./constants.mjs";
import {
  GM_LOG_EVENT_TYPES,
  normalizeGmLogEvent
} from "./gm-log-events.mjs";

/** Convert an existing ChatMessage into the stable GM log contract. */
export function gmLogEventFromMessage(message) {
  if (!message) return null;
  const moduleFlags = message.flags?.[MODULE_ID] ?? {};
  const base = combatEvent(message, moduleFlags)
    ?? weaponReadinessEvent(message, moduleFlags)
    ?? itemUseEvent(message, moduleFlags)
    ?? structuredModuleEvent(message, moduleFlags)
    ?? contentEvent(message);
  if (!base) return null;

  const messageId = cleanId(message.id ?? message._id ?? message._source?._id);
  const eventId = cleanId(base.eventId) || messageId;
  return normalizeGmLogEvent({
    ...base,
    eventId,
    occurredAt: Number(base.occurredAt ?? message.timestamp ?? message._source?.timestamp ?? Date.now()),
    source: {
      ...(base.source ?? {}),
      messageId: messageId || base.source?.messageId || ""
    }
  });
}

const STRUCTURED_EVENT_TYPES = new Set([
  GM_LOG_EVENT_TYPES.MANEUVER,
  GM_LOG_EVENT_TYPES.AMMO_RELOAD,
  GM_LOG_EVENT_TYPES.AMMO_RECOVERY,
  GM_LOG_EVENT_TYPES.RATION_CONSUMED,
  GM_LOG_EVENT_TYPES.REST_COMPLETED,
  GM_LOG_EVENT_TYPES.ITEM_QUANTITY_CHANGED
]);

const STRUCTURED_VALUE_KEYS = new Set([
  "formula",
  "roll",
  "amount",
  "maximum",
  "days",
  "damage",
  "attempts",
  "total",
  "successes",
  "failures",
  "skipped",
  "previous",
  "quantity",
  "delta"
]);

function structuredModuleEvent(message, flags) {
  const data = flags.gmLogAction;
  if (!isPlainObject(data) || !STRUCTURED_EVENT_TYPES.has(data.type)) return null;

  const speakerActor = actorFromMessage(message);
  const flaggedActor = documentFromUuid(data.actorUuid);
  if (speakerActor && flaggedActor && speakerActor.uuid !== flaggedActor.uuid) return null;

  const actor = flaggedActor ?? speakerActor;
  const subject = documentFromUuid(data.subjectUuid);
  if (
    data.type === GM_LOG_EVENT_TYPES.ITEM_QUANTITY_CHANGED
    && (!actor || !subject || subject.parent?.uuid !== actor.uuid)
  ) {
    return null;
  }
  return {
    type: data.type,
    outcome: data.outcome,
    actor: documentReference(actor) ?? speakerReference(message),
    target: referenceFromUuidOrName(data.targetUuid, data.targetName),
    subject: documentReference(subject) ?? referenceFromUuidOrName(data.subjectUuid, data.subjectName),
    source: { variant: "single" },
    values: structuredValues(data.values)
  };
}

function structuredValues(input) {
  if (!isPlainObject(input)) return {};
  return Object.fromEntries(
    Object.entries(input).filter(([key, value]) => {
      return STRUCTURED_VALUE_KEYS.has(key)
        && (typeof value === "string" || typeof value === "number" || typeof value === "boolean");
    })
  );
}

function combatEvent(message, flags) {
  const publicData = flags.publicCombat;
  const fullData = flags.publicCombatPayload;
  const data = publicData ?? fullData;
  if (!data) return null;

  const correlationId = cleanId(flags.combatSplitSourceId ?? flags.combatSplitId);
  const variant = publicData ? "public" : flags.fullCombatForGm ? "full" : "single";
  const outcome = outcomeFromText(data.outcomeText);
  return {
    type: GM_LOG_EVENT_TYPES.ATTACK,
    outcome,
    actor: referenceByName(data.attackerName),
    target: referenceByName(data.targetName),
    subject: referenceByName(data.weaponName),
    source: { correlationId, variant },
    values: {
      formula: data.testFormula,
      roll: numericValue(data.rollValue),
      damage: data.damageTotal ?? data.damageFormula ?? ""
    }
  };
}

function weaponReadinessEvent(message, flags) {
  if (flags.type !== "weaponReadiness") return null;
  const actor = actorFromMessage(message, flags.actorUuid);
  const drawn = itemNames(actor, flags.drawnWeaponIds);
  const sheathed = itemNames(actor, flags.sheathedWeaponIds);
  const action = drawn.length && sheathed.length ? "swap" : drawn.length ? "draw" : sheathed.length ? "sheathe" : "info";
  return {
    type: GM_LOG_EVENT_TYPES.WEAPON_READINESS,
    actor: documentReference(actor) ?? speakerReference(message),
    source: { variant: "single" },
    values: { action, drawn, sheathed }
  };
}

function itemUseEvent(message, flags) {
  if (!flags.chatItemUse) return null;
  const actor = actorFromMessage(message, flags.actorUuid);
  const item = itemFromUuid(actor, flags.itemUuid);
  return {
    type: GM_LOG_EVENT_TYPES.ITEM_USED,
    actor: documentReference(actor) ?? speakerReference(message),
    subject: documentReference(item) ?? referenceByName(item?.name),
    source: { variant: "single" },
    values: {}
  };
}

function contentEvent(message) {
  const root = contentRoot(message.content);
  if (!root) return null;
  return nativeCombatEvent(message, root)
    ?? maneuverEvent(message, root)
    ?? ammoRecoveryEvent(message, root)
    ?? ammoReloadEvent(message, root)
    ?? rationEvent(message, root)
    ?? restEvent(message, root)
    ?? nativeRollEvent(message, root)
    ?? nativeAbilityEvent(message, root);
}

function nativeCombatEvent(message, root) {
  const card = root.querySelector(".symbaroum.chat.combat");
  if (!card) return null;
  const intro = cleanText(card.querySelector(".introTxt")?.textContent);
  const attack = intro.match(/^(.+?)\s+(?:ataca com|attacks? with)\s+(.+)$/i);
  if (!attack) return null;

  const targetName = cleanText(card.querySelector(".targetText")?.textContent)
    .replace(/^(?:V[ií]tima|Victim)\s*:\s*/i, "");
  const rollText = [...card.querySelectorAll(".tooltip > p")]
    .map((element) => cleanText(element.textContent))
    .find((text) => /(?:Rolagem|Roll|Result)\s*:?\s*-?\d+/i.test(text)) ?? "";
  const outcomeText = cleanText(card.querySelector("h4")?.textContent);
  const formula = opposedFormula(cleanText(card.querySelector("[data-item-id]")?.textContent));
  const actor = actorFromMessage(message);
  const weaponName = cleanText(card.querySelector(".subText")?.textContent || attack[2]);
  return {
    type: GM_LOG_EVENT_TYPES.ATTACK,
    outcome: outcomeFromText(outcomeText),
    actor: documentReference(actor) ?? referenceByName(attack[1]),
    target: referenceByName(targetName),
    subject: documentReference(findItemByName(actor, weaponName)) ?? referenceByName(weaponName),
    source: { variant: "single" },
    values: {
      formula,
      roll: numericValue(rollText),
      damage: combatDamage(card)
    }
  };
}

function nativeRollEvent(message, root) {
  const card = root.querySelector(".symbaroum.chat.roll");
  if (!card) return null;
  const formula = cleanText(card.querySelector("h3")?.textContent);
  const rollNode = card.querySelector(".symba-rolls.roll.d20");
  if (!formula || !rollNode) return null;
  const actor = actorFromMessage(message);
  return {
    type: GM_LOG_EVENT_TYPES.ROLL,
    outcome: rollNode.classList.contains("success") ? "success" : rollNode.classList.contains("failure") ? "failure" : "info",
    actor: documentReference(actor) ?? speakerReference(message),
    source: { variant: "single" },
    values: { formula, roll: numericValue(rollNode.textContent) }
  };
}

function nativeAbilityEvent(message, root) {
  const card = root.querySelector(".symbaroum.chat.ability");
  if (!card) return null;
  const resultText = cleanText(card.querySelector(".tooltip > p")?.textContent);
  const roll = numericValue(resultText);
  if (roll === "") return null;
  const formula = cleanText(card.querySelector("[data-item-id]")?.textContent || card.querySelector(".subText")?.textContent);
  const outcomeText = cleanText(card.querySelector(".finalTxt:last-child")?.textContent);
  return {
    type: GM_LOG_EVENT_TYPES.ROLL,
    outcome: outcomeFromText(outcomeText),
    actor: documentReference(actorFromMessage(message)) ?? speakerReference(message),
    subject: referenceByName(cleanText(card.querySelector(".subText")?.textContent)),
    source: { variant: "single" },
    values: { formula, roll }
  };
}

function maneuverEvent(message, root) {
  const card = root.querySelector(".tenebre-maneuver-card");
  if (!card) return null;
  const rows = labeledRows(card);
  const actor = actorFromMessage(message);
  const targetName = rowByLabels(rows, ["Alvo", "Target"]);
  const rollText = rowByLabels(rows, ["Rolar", "Rolagem", "Roll"]);
  return {
    type: GM_LOG_EVENT_TYPES.MANEUVER,
    outcome: card.classList.contains("tenebre-maneuver-success") ? "success" : card.classList.contains("tenebre-maneuver-failure") ? "failure" : "info",
    actor: documentReference(actor) ?? speakerReference(message),
    target: referenceByName(targetName),
    subject: referenceByName(cleanText(card.querySelector("h3")?.textContent)),
    source: { variant: "single" },
    values: {
      formula: rowByLabels(rows, ["Teste", "Test"]),
      roll: numericValue(rollText)
    }
  };
}

function ammoReloadEvent(message, root) {
  const card = root.querySelector(".tenebre-reload-card");
  if (!card) return null;
  const text = cleanText(card.textContent);
  const match = text.match(/(\d+)x\s+(.+?)(?:\s+carregados|\s+loaded|\s+no\(a\)|\s+into)/i);
  const quiver = text.match(/(?:no\(a\)|into)\s+(.+?)(?:\s*\(|$)/i)?.[1] ?? "";
  const actor = actorFromMessage(message);
  return {
    type: GM_LOG_EVENT_TYPES.AMMO_RELOAD,
    actor: documentReference(actor) ?? speakerReference(message),
    target: referenceByName(quiver),
    subject: referenceFromUuid(card.dataset.ammoUuid) ?? referenceByName(match?.[2]),
    source: { variant: "single" },
    values: { amount: numericValue(match?.[1]) }
  };
}

function ammoRecoveryEvent(message, root) {
  const card = root.querySelector(".tenebre-recovery-card");
  if (!card) return null;
  const text = cleanText(card.textContent);
  const threshold = text.match(/(?:contra|against|recupera com|recovers on)\s+(\d+)/i)?.[1] ?? "";
  const roll = cleanText(card.querySelector("span")?.textContent);
  const success = /Recuperado|Recovered/i.test(text);
  const failure = /Quebrado|Broken/i.test(text);
  const actor = actorFromMessage(message);
  const subject = referenceFromUuid(card.dataset.ammoUuid) ?? referenceByName(ammoNameFromRecovery(text));
  return {
    type: GM_LOG_EVENT_TYPES.AMMO_RECOVERY,
    outcome: success ? "success" : failure ? "failure" : "info",
    actor: documentReference(actor) ?? speakerReference(message),
    subject,
    source: { variant: "single" },
    values: { formula: "1d20", roll: numericValue(roll), maximum: numericValue(threshold) }
  };
}

function rationEvent(message, root) {
  const card = root.querySelector(".tenebre-chat-card:not(.tenebre-recovery-card):not(.tenebre-reload-card)");
  if (!card) return null;
  const text = cleanText(card.textContent);
  const use = text.match(/^(.+?)\s+(?:consumiu|consumed)\s+(.+?)(?:Dias restantes|Days remaining)/i);
  const remaining = text.match(/(?:Dias restantes|Days remaining)\s*:?\s*(\d+)\s*\/\s*(\d+)/i);
  if (!use || !remaining) return null;
  const actor = actorFromMessage(message);
  return {
    type: GM_LOG_EVENT_TYPES.RATION_CONSUMED,
    actor: documentReference(actor) ?? referenceByName(use[1]),
    subject: documentReference(findItemByName(actor, use[2])) ?? referenceByName(use[2]),
    source: { variant: "single" },
    values: { amount: numericValue(remaining[1]), maximum: numericValue(remaining[2]) }
  };
}

function restEvent(message, root) {
  const card = root.querySelector(".tenebre-chat-card");
  if (!card) return null;
  const text = cleanText(card.textContent);
  const rest = text.match(/^(.+?)\s+(?:descansa por|rests for)\s+(\d+)/i);
  if (!rest) return null;
  const healing = text.match(/(?:Vitalidade|Toughness)\s*:?\s*(\d+)/i)?.[1]
    ?? text.match(/(?:recuperou|recovered)\s+(\d+)/i)?.[1]
    ?? "0";
  return {
    type: GM_LOG_EVENT_TYPES.REST_COMPLETED,
    actor: documentReference(actorFromMessage(message)) ?? referenceByName(rest[1]),
    source: { variant: "single" },
    values: { days: numericValue(rest[2]), amount: numericValue(healing) }
  };
}

function contentRoot(content) {
  if (!content || typeof document === "undefined") return null;
  const template = document.createElement("template");
  template.innerHTML = String(content);
  return template.content;
}

function actorFromMessage(message, actorUuid = "") {
  const uuidActor = documentFromUuid(actorUuid);
  if (uuidActor) return uuidActor;
  const actorId = message.speaker?.actor;
  return actorId ? game.actors?.get?.(actorId) ?? null : null;
}

function itemFromUuid(actor, uuid) {
  return documentFromUuid(uuid) ?? actor?.items?.get?.(String(uuid ?? "").split(".").at(-1)) ?? null;
}

function documentFromUuid(uuid) {
  if (!uuid || typeof globalThis.fromUuidSync !== "function") return null;
  try {
    return globalThis.fromUuidSync(uuid) ?? null;
  } catch (_error) {
    return null;
  }
}

function referenceFromUuid(uuid) {
  return documentReference(documentFromUuid(uuid)) ?? (uuid ? { uuid, name: "" } : null);
}

function referenceFromUuidOrName(uuid, name) {
  const reference = referenceFromUuid(uuid);
  const fallbackName = cleanText(name);
  if (!reference) return referenceByName(fallbackName);
  return reference.name || !fallbackName ? reference : { ...reference, name: fallbackName };
}

function documentReference(documentValue) {
  if (!documentValue) return null;
  return {
    uuid: documentValue.uuid ?? "",
    name: documentValue.name ?? "",
    img: documentValue.img ?? documentValue.texture?.src ?? ""
  };
}

function speakerReference(message) {
  return referenceByName(message.speaker?.alias);
}

function referenceByName(name) {
  const cleaned = cleanText(name);
  return cleaned ? { name: cleaned } : null;
}

function findItemByName(actor, name) {
  const wanted = comparable(name);
  return [...(actor?.items ?? [])].find((item) => comparable(item.name) === wanted) ?? null;
}

function itemNames(actor, ids) {
  return [...(ids ?? [])].map((id) => actor?.items?.get?.(id)?.name).filter(Boolean);
}

function labeledRows(card) {
  return [...card.querySelectorAll("li, p")].map((row) => {
    const label = cleanText(row.querySelector("strong")?.textContent).replace(/:\s*$/, "");
    const value = cleanText(row.textContent).replace(new RegExp(`^${escapeRegExp(label)}\\s*:?\\s*`, "i"), "");
    return { label, value };
  });
}

function rowByLabels(rows, labels) {
  const wanted = labels.map(comparable);
  return rows.find((row) => wanted.includes(comparable(row.label)))?.value ?? "";
}

function opposedFormula(text) {
  const labels = [...String(text ?? "").matchAll(/([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s-]*?)\s*:?\s*\(\s*-?\d+\s*\)/g)]
    .map((match) => cleanText(match[1]))
    .filter(Boolean)
    .slice(0, 2);
  return labels.length ? labels.join(" ← ") : cleanText(text);
}

function combatDamage(card) {
  const text = cleanText(card.textContent);
  return text.match(/(?:Dano|Damage)\s*:?\s*([^\n]+?)(?:\s+(?:Prote|Damage final|$))/i)?.[1] ?? "";
}

function ammoNameFromRecovery(text) {
  return cleanText(text.match(/(?:testa|tests)\s+(.+?)\s*\((?:[^)]*?(?:recupera com|recovers on))/i)?.[1] ?? "");
}

function outcomeFromText(text) {
  const value = comparable(text);
  if (/\b(acerta|acertou|sucesso|succeed|success|hit|hits)\b/i.test(value)) return "success";
  if (/\b(erra|errou|falha|falhou|fail|failure|miss|misses)\b/i.test(value)) return "failure";
  if (/aguard|await|pending/i.test(value)) return "pending";
  return "info";
}

function numericValue(value) {
  const match = String(value ?? "").match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return "";
  const number = Number(match[0].replace(",", "."));
  return Number.isFinite(number) ? number : "";
}

function cleanId(value) {
  return cleanText(value).replace(/[^A-Za-z0-9._:/-]/g, "").slice(0, 200);
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function comparable(value) {
  return cleanText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function escapeRegExp(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
