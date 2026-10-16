import { FLAG_SCOPE } from "./constants.mjs";
import { TenebreSettings } from "./settings.mjs";
import { changeItemQuantity, findRationItems, getRationRule, itemQuantity, sumItemQuantities } from "./item-flags.mjs";
import { SocketService, getRequestUser, hasOwnerPermission } from "./sockets.mjs";
import { assertSafeBatch } from "./socket-policy.mjs";
import { getActorExpeditionData, expeditionDayKey, runExpeditionOperation } from "./expedition-state.mjs";
import { escapeHtml, normalize } from "./utils.mjs";
import { actorReference, actorStateKey, actorMatchesReference, resolveActorReference } from "./actor-references.mjs";

const pendingActorOperations = new Map();

export class RationService {
  static #registered = false;

  static register() {
    if (this.#registered) return;
    SocketService.registerHandler("consumeRations", consumeRationsAsAuthority);
    SocketService.registerHandler("consolidateRations", consolidateRationsAsAuthority);
    SocketService.registerHandler("feedExpeditionRations", feedExpeditionRationsAsAuthority);
    this.#registered = true;
  }

  static getState(actor, item = null) {
    const states = this.getStates(actor);
    if (item) {
      const rule = getRationRule(item);
      const key = rule?.key;
      return states.find((state) => state.key === key) ?? emptyState(rule);
    }
    return states.find((state) => state.quantity > 0) ?? emptyState();
  }

  static getStates(actor) {
    const groups = rationGroups(actor);
    const current = actor.getFlag(FLAG_SCOPE, "rations") ?? {};
    return Array.from(groups.values()).map(({ rule, items }) => buildState(actor, rule, items, current));
  }

  static getTotalUses(actor) {
    return this.getStates(actor).reduce((total, state) => total + state.totalUsesRemaining, 0);
  }

  static getItemState(actor, item) {
    return this.getState(actor, item);
  }

  static async sync(actor) {
    const states = this.getStates(actor);
    const byRule = {};
    for (const state of states) {
      byRule[state.key] = {
        quantity: state.quantity,
        usesRemaining: state.usesRemaining
      };
    }

    const travelBread = states.find((state) => state.key === "travelBread");
    await actor.setFlag(FLAG_SCOPE, "rations", {
      quantity: travelBread?.quantity ?? 0,
      usesRemaining: travelBread?.usesRemaining ?? 0,
      byRule
    });
    return this.getState(actor);
  }

  static needsConsolidation(actor) {
    return rationStacks(actor).some((items) => items.length > 1);
  }

  static async consolidate(actor) {
    if (!actor) return false;
    if (SocketService.hasActiveGM() && !SocketService.isPrimaryGM()) {
      return SocketService.executeAsPrimaryGM("consolidateRations", actor.uuid);
    }
    return this.#enqueue(actor, () => this.#consolidate(actor));
  }

  static async #consolidate(actor) {
    const stacks = rationStacks(actor).filter((items) => items.length > 1);
    if (!stacks.length) return false;
    const updates = [];
    const deleteIds = [];

    for (const items of stacks) {
      const [primary, ...duplicates] = items;
      const quantity = items.reduce((total, item) => total + itemQuantity(item), 0);
      if (quantity <= 0) continue;

      updates.push({ _id: primary.id, "system.number": quantity });
      deleteIds.push(...duplicates.map((item) => item.id));
    }

    if (updates.length) {
      await SocketService.updateEmbeddedDocuments(actor, "Item", updates, { render: false });
    }
    if (deleteIds.length) {
      await SocketService.deleteEmbeddedDocuments(actor, "Item", deleteIds, { render: true });
    }

    await this.sync(actor);
    return Boolean(updates.length || deleteIds.length);
  }

  static async consumeDay(actor, item = null, { days = 1, requireFull = false, syncExpedition = true } = {}) {
    if (!TenebreSettings.get("enableRations")) return false;
    if (!actor) return false;
    days = normalizeRationDays(days);
    if (SocketService.hasActiveGM() && !SocketService.isPrimaryGM()) {
      const consumed = await SocketService.executeAsPrimaryGM("consumeRations", actor.uuid, item?.id ?? null, days, requireFull);
      const key = consumed ? "TENEBRE.Rations.Consumed" : "TENEBRE.Rations.NoRations";
      globalThis.ui?.notifications?.[consumed ? "info" : "warn"]?.(game.i18n.localize(key));
      return consumed;
    }

    const result = await this.#enqueue(actor, async () => {
      const expeditions = syncExpedition ? activeExpeditionMemberships(actor) : [];
      const consumed = await this.#consumeDay(actor, item, days, requireFull);
      return { consumed, expeditions };
    });
    // A sincronização não segura a fila do estoque: alimentação já segura a fila do Grupo.
    if (result.consumed && syncExpedition) await this.#syncExpeditionRation(actor, result.expeditions);
    return result.consumed;
  }

  static async #enqueue(actor, operation) {
    // A leitura do saldo precisa acontecer depois do consumo anterior, não antes do await.
    const key = actor.uuid ?? actor.id ?? actor;
    const previous = pendingActorOperations.get(key) ?? Promise.resolve();
    const pending = previous.catch(() => {}).then(operation);
    pendingActorOperations.set(key, pending);
    try {
      return await pending;
    } finally {
      if (pendingActorOperations.get(key) === pending) pendingActorOperations.delete(key);
    }
  }

  static async #consumeDay(actor, item, days, requireFull) {
    await this.#consolidate(actor);

    const available = item ? this.getState(actor, item).totalUsesRemaining : this.getTotalUses(actor);
    if (available <= 0 || (requireFull && available < days)) {
      ui.notifications.warn(game.i18n.localize("TENEBRE.Rations.NoRations"));
      return false;
    }
    // Sem item escolhido, usa os alimentos na ordem já adotada pelo inventário.
    let remaining = days;
    const states = item ? [this.getState(actor, item)] : this.getStates(actor);
    for (const state of states) {
      if (remaining <= 0) break;
      const consumed = Math.min(remaining, state.totalUsesRemaining);
      if (consumed <= 0) continue;
      await this.#consumeState(actor, state, item, consumed);
      remaining -= consumed;
    }
    if (remaining > 0) {
      ui.notifications.warn(game.i18n.format("TENEBRE.Rations.IncompleteConsumption", { requested: days, consumed: days - remaining }));
    }
    return remaining === 0;
  }

  static async #consumeState(actor, state, item, toConsume) {
    const nextTotalUses = Math.max(0, state.totalUsesRemaining - toConsume);
    const nextQuantity = nextTotalUses > 0 ? Math.ceil(nextTotalUses / state.usesPerUnit) : 0;
    const nextUsesRemaining = currentUnitUses(nextTotalUses, state.usesPerUnit);
    const items = state.items.filter((entry) => itemQuantity(entry) > 0);
    const selectedIndex = item ? items.findIndex((entry) => entry.id === item.id) : -1;
    if (selectedIndex > 0) items.unshift(...items.splice(selectedIndex, 1));
    const rationItem = items[0];

    // O saldo é agregado por regra; a quantidade agregada nunca deve ser atribuída a uma pilha.
    let unitsToRemove = state.quantity - nextQuantity;
    for (const entry of items) {
      if (unitsToRemove <= 0) break;
      const removed = Math.min(unitsToRemove, itemQuantity(entry));
      await changeItemQuantity(entry, -removed);
      unitsToRemove -= removed;
    }

    await updateRuleState(actor, state.key, {
      quantity: nextQuantity,
      usesRemaining: nextUsesRemaining
    });

    if (nextQuantity < state.quantity) {
      ui.notifications.info(game.i18n.format("TENEBRE.Rations.ConsumedUnit", { item: state.name, quantity: nextQuantity }));
    } else {
      ui.notifications.info(game.i18n.format("TENEBRE.Rations.ConsumedUse", { item: state.name, uses: nextTotalUses }));
    }

    await this.#postRationChat(actor, {
      itemName: state.name,
      itemUuid: rationItem?.uuid ?? "",
      quantity: nextQuantity,
      usesRemaining: nextUsesRemaining,
      usesPerUnit: state.usesPerUnit,
      totalUsesRemaining: nextTotalUses,
      totalUsesCapacity: nextQuantity * state.usesPerUnit
    }).catch(error => console.warn("Tenebre Resources | Rations consumed but chat publication failed.", error));

  }

  static async #syncExpeditionRation(actor, expeditions) {
    for (const { party, dayKey } of expeditions) {
      try {
        await runExpeditionOperation(party, async () => {
          if (!SocketService.canModify(party) || expeditionDayKey(party) !== dayKey || !partyIncludesActor(party, actor)) return;
          if (getActorExpeditionData(party).dayState.rations[actorStateKey(actor)]?.fed) return;
          await party.update(fedMemberUpdates([actorStateKey(actor)], "personal"));
        });
      } catch (err) {
        console.warn("[Tenebre] Falha ao sincronizar ração com expedição:", err);
      }
    }
  }

  static async feedExpedition(party, memberIds, source = "group", dayKey = expeditionDayKey(party)) {
    if (SocketService.hasActiveGM()) {
      return SocketService.executeAsPrimaryGM("feedExpeditionRations", party.uuid, memberIds, source, dayKey);
    }
    return feedExpeditionRationsAsAuthority.call({ socketdata: { userId: game.user?.id } }, party.uuid, memberIds, source, dayKey);
  }

  static async #postRationChat(actor, newState) {
    const actorName = escapeHtml(actor.name);
    const itemName = escapeHtml(newState.itemName);
    const title = game.i18n.format("TENEBRE.Rations.ChatTitle", { actor: actorName, item: itemName });
    const content = game.i18n.format("TENEBRE.Rations.ChatContent", {
      item: itemName,
      uses: newState.usesRemaining,
      max: newState.usesPerUnit,
      quantity: newState.quantity,
      totalUses: newState.totalUsesRemaining,
      totalMax: newState.totalUsesCapacity
    });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="tenebre-chat-card">
          <div class="tenebre-chat-item">
            <img src="${escapeHtml(actor.img)}" alt="${actorName}">
            <div>
              <h3>${title}</h3>
              ${content}
            </div>
          </div>
        </div>
      `,
      flags: {
        [FLAG_SCOPE]: {
          gmLogAction: {
            type: "resource.ration",
            actorUuid: actor.uuid,
            subjectUuid: newState.itemUuid,
            subjectName: newState.itemName,
            values: {
              amount: newState.totalUsesRemaining,
              maximum: newState.totalUsesCapacity
            }
          }
        }
      }
    });
  }
}

function normalizeRationDays(days) {
  const value = Number(days);
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}

function assertRationExecutor() {
  if (SocketService.hasActiveGM() && !SocketService.isPrimaryGM()) {
    throw new Error("Ration operations must run on the designated GM.");
  }
}

async function getOwnedRationActor(context, actorUuid) {
  assertRationExecutor();
  const user = getRequestUser(context);
  const actor = await globalThis.fromUuid?.(actorUuid);
  if (actor?.documentName !== "Actor" || actor.pack || actor.compendium) throw new Error("Invalid ration actor.");
  if (!user.isGM && !hasOwnerPermission(actor, user)) throw new Error("Ration actor is not owned by the requester.");
  return actor;
}

async function consumeRationsAsAuthority(actorUuid, itemId, days, requireFull = false) {
  const actor = await getOwnedRationActor(this, actorUuid);
  if (!Number.isSafeInteger(days) || days < 1 || typeof requireFull !== "boolean") throw new Error("Invalid ration amount.");
  const item = itemId === null ? null : actor.items?.get?.(itemId);
  if (itemId !== null && (!item || !getRationRule(item))) throw new Error("Invalid ration item.");
  return RationService.consumeDay(actor, item, { days, requireFull });
}

async function consolidateRationsAsAuthority(actorUuid) {
  const actor = await getOwnedRationActor(this, actorUuid);
  return RationService.consolidate(actor);
}

function partyIncludesActor(party, actor) {
  const refs = [...(party.system?.members ?? []), ...(party.system?.companions ?? [])];
  return refs.some(ref => actorMatchesReference(actor, ref));
}

function activeExpeditionMemberships(actor) {
  return Array.from(globalThis.game?.actors?.values?.() ?? globalThis.game?.actors ?? [])
    .filter(party => party.type === `${FLAG_SCOPE}.party` && partyIncludesActor(party, actor)
      && getActorExpeditionData(party).active)
    .map(party => ({ party, dayKey: expeditionDayKey(party) }));
}

function fedMemberUpdates(memberIds, source) {
  const updates = {};
  const timestamp = Date.now();
  for (const id of memberIds) {
    const value = { fed: true, source, timestamp };
    updates[`system.expedition.dayState.rations.${id}`] = value;
    updates[`flags.${FLAG_SCOPE}.expedition.dayState.rations.${id}`] = value;
  }
  return updates;
}

async function feedExpeditionRationsAsAuthority(partyUuid, memberIds, source, dayKey) {
  assertRationExecutor();
  const user = getRequestUser(this);
  assertSafeBatch(memberIds, "Expedition members");
  if (!memberIds.every(id => typeof id === "string" && /^[A-Za-z0-9_.-]{1,300}$/.test(id))
    || !["group", "personal"].includes(source) || (source === "personal" && memberIds.length !== 1)
    || typeof dayKey !== "string" || dayKey.length > 300) throw new Error("Invalid expedition feeding request.");
  const party = await globalThis.fromUuid?.(partyUuid);
  if (party?.documentName !== "Actor" || party.type !== `${FLAG_SCOPE}.party` || party.pack || party.compendium) {
    throw new Error("Invalid expedition party.");
  }
  if (!SocketService.canModify(party)) throw new Error("No authorized executor can update the expedition party.");
  if (source === "group" && !user.isGM && !hasOwnerPermission(party, user)) throw new Error("Expedition party is not owned.");

  return runExpeditionOperation(party, async () => {
    const exp = getActorExpeditionData(party);
    if (!exp.active || expeditionDayKey(party) !== dayKey) return { status: "stale", count: 0 };
    const members = new Map();
    for (const ref of [...(party.system.members ?? []), ...(party.system.companions ?? [])]) {
      const member = await resolveActorReference(ref);
      if (member?.documentName === "Actor") {
        members.set(actorReference(member), member);
        members.set(member.uuid, member);
      }
    }
    const selected = [...new Set(memberIds)].map(id => members.get(id));
    if (selected.some(member => !member)) throw new Error("Requested actor is not an expedition member.");
    if (source === "personal" && !user.isGM && !hasOwnerPermission(selected[0], user)) {
      throw new Error("Personal provisions are not owned by the requester.");
    }
    if (source === "personal" && (selected[0].pack || selected[0].compendium)) throw new Error("Compendium provisions cannot be consumed.");
    const unfed = [...new Set(selected)].filter(member => !exp.dayState.rations[actorStateKey(member)]?.fed);
    if (!unfed.length) return { status: "alreadyFed", count: 0 };
    const stock = source === "group" ? party : unfed[0];
    const consumed = await RationService.consumeDay(stock, null, { days: unfed.length, requireFull: true, syncExpedition: false });
    if (!consumed) return { status: "insufficient", count: 0 };
    if (expeditionDayKey(party) !== dayKey) return { status: "stale", count: 0 };
    await party.update(fedMemberUpdates(unfed.map(actorStateKey), source));
    return { status: "fed", count: unfed.length };
  });
}

function buildState(_actor, rule, items, current) {
  const usesPerUnit = Math.max(1, Number(rule?.usesPerUnit) || 1);
  const quantity = sumItemQuantities(items);
  const ruleState = current.byRule?.[rule.key] ?? {};
  const legacyUsesRemaining = rule.key === "travelBread" ? current.usesRemaining : undefined;
  let usesRemaining = Number(ruleState.usesRemaining ?? legacyUsesRemaining ?? usesPerUnit);
  if (quantity <= 0) usesRemaining = 0;
  if (usesRemaining <= 0 && quantity > 0) usesRemaining = usesPerUnit;
  usesRemaining = Math.min(usesRemaining, usesPerUnit);
  const totalUsesRemaining = quantity > 0 ? ((quantity - 1) * usesPerUnit) + usesRemaining : 0;
  const totalUsesCapacity = quantity * usesPerUnit;
  return {
    key: rule.key,
    name: rule.name,
    quantity,
    usesRemaining,
    usesPerUnit,
    totalUsesRemaining,
    totalUsesCapacity,
    items
  };
}

function currentUnitUses(totalUses, usesPerUnit) {
  if (totalUses <= 0) return 0;
  return ((totalUses - 1) % usesPerUnit) + 1;
}

async function updateRuleState(actor, key, ruleState) {
  const current = actor.getFlag(FLAG_SCOPE, "rations") ?? {};
  const byRule = foundry.utils.deepClone(current.byRule ?? {});
  byRule[key] = ruleState;

  const update = {
    ...current,
    byRule
  };

  if (key === "travelBread") {
    update.quantity = ruleState.quantity;
    update.usesRemaining = ruleState.usesRemaining;
  }

  await actor.setFlag(FLAG_SCOPE, "rations", update);
}

function rationGroups(actor) {
  const groups = new Map();
  for (const item of findRationItems(actor)) {
    const rule = getRationRule(item);
    if (!rule) continue;

    const key = rule.key;
    const group = groups.get(key) ?? { rule, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return groups;
}

function rationStacks(actor) {
  const stacks = new Map();
  for (const item of findRationItems(actor)) {
    if (itemQuantity(item) <= 0) continue;
    const rule = getRationRule(item);
    if (!rule) continue;

    // Só junta pilhas realmente iguais: descrição ou imagem diferentes ficam separadas.
    const key = [
      rule.key,
      normalize(item.name),
      item.img ?? "",
      String(item.system?.description ?? "").trim(),
      item.getFlag(FLAG_SCOPE, "storedIn") || "inventory"
    ].join("|");

    const stack = stacks.get(key) ?? [];
    stack.push(item);
    stacks.set(key, stack);
  }
  return Array.from(stacks.values());
}

function emptyState(rule = null) {
  const usesPerUnit = Math.max(1, Number(rule?.usesPerUnit) || 1);
  return {
    key: rule?.key ?? "",
    name: rule?.name ?? game?.i18n?.localize?.("TENEBRE.Rations.TravelBread") ?? "Pão de Viagem",
    quantity: 0,
    usesRemaining: 0,
    usesPerUnit,
    totalUsesRemaining: 0,
    totalUsesCapacity: 0,
    items: []
  };
}
