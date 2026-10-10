import { FLAG_SCOPE } from "./constants.mjs";
import { TenebreSettings } from "./settings.mjs";
import { changeItemQuantity, findRationItems, getRationRule, itemQuantity, sumItemQuantities } from "./item-flags.mjs";
import { SocketService } from "./sockets.mjs";
import { escapeHtml, normalize } from "./utils.mjs";

const pendingConsolidations = new Set();

export class RationService {
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
    if (!actor || pendingConsolidations.has(actor.uuid ?? actor.id)) return false;

    const stacks = rationStacks(actor).filter((items) => items.length > 1);
    if (!stacks.length) return false;

    const key = actor.uuid ?? actor.id;
    pendingConsolidations.add(key);
    try {
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
    } finally {
      pendingConsolidations.delete(key);
    }
  }

  static async consumeDay(actor, item = null) {
    if (!TenebreSettings.get("enableRations")) return;

    await this.consolidate(actor);

    const state = this.getState(actor, item);
    if (state.quantity <= 0) {
      ui.notifications.warn(game.i18n.localize("TENEBRE.Rations.NoRations"));
      return;
    }

    const nextTotalUses = Math.max(0, state.totalUsesRemaining - 1);
    const nextQuantity = nextTotalUses > 0 ? Math.ceil(nextTotalUses / state.usesPerUnit) : 0;
    const nextUsesRemaining = currentUnitUses(nextTotalUses, state.usesPerUnit);
    const rationItem = state.items.find((entry) => itemQuantity(entry) > 0);

    if (rationItem && itemQuantity(rationItem) !== nextQuantity) {
      await changeItemQuantity(rationItem, nextQuantity - itemQuantity(rationItem));
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
    });
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
