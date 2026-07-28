import { AMMO_TYPES, FLAG_SCOPE } from "./constants.mjs";
import { TenebreSettings } from "./settings.mjs";
import { actorItems, changeItemQuantity, findAmmoItems, getAmmoType, itemQuantity, localizeAmmoType, isQuiver, isAmmo, getQuiverCapacity, getQuiverLoadedAmmo, getQuiverLoadedTotal } from "./item-flags.mjs";
import { getAmmoDescription, getSpecialAmmo, getAmmoRecoveryClass, getAmmoRecoveryThreshold } from "./special-ammo.mjs";
import { documentSourceUuid, escapeHtml, promptDialog, sanitizeHtml } from "./utils.mjs";
import { evaluateRoll, rollTotal, showDice3dRoll } from "./dice.mjs";

export class AmmoService {
  static #recoveringActors = new Set();

  static async selectAmmo(actor, ammoType) {
    if (!isPlayerActor(actor)) return null;

    const ammoItems = findAmmoItems(actor, ammoType);
    if (!ammoItems.length) {
      ui.notifications.warn(game.i18n.format("TENEBRE.Ammo.NoCompatibleAmmo", { type: localizeAmmoType(ammoType) }));
      return null;
    }

    const ammo = await this.promptAmmo(actor, ammoType, ammoItems);
    return ammo; // returns ammo item, or null if cancelled
  }

  static async consumeAmmo(actor, ammo, weapon, ammoType) {
    if (!isPlayerActor(actor)) return;

    const shot = getRecoverableShotData(actor, ammo, ammoType);
    const quiverCapacity = getQuiverCapacity();

    if (ammo.isVirtual) {
      const quiver = actor.items.get(ammo.quiverId);
      if (quiver) {
        const loadedAmmo = getQuiverLoadedAmmo(quiver);
        const entryIndex = loadedAmmo.findIndex(e => e.name === ammo.name || e.id === ammo.loadedEntryId);
        if (entryIndex !== -1) {
          const entry = loadedAmmo[entryIndex];
          if (entry.quantity > 1) {
            entry.quantity -= 1;
            ui.notifications.info(game.i18n.format("TENEBRE.Ammo.UsesAmmo", {
              actor: actor.name,
              ammo: entry.name
            }) + ` (${entry.quantity}/${quiverCapacity})`);
          } else {
            loadedAmmo.splice(entryIndex, 1);
            ui.notifications.info(game.i18n.format("TENEBRE.Ammo.UsesAmmo", {
              actor: actor.name,
              ammo: entry.name
            }) + ` (0/${quiverCapacity})`);
          }
          await quiver.setFlag(FLAG_SCOPE, "loadedAmmo", loadedAmmo);
        }
      }
    } else if (isQuiver(ammo)) {
      const looseAmmoItems = actorItems(actor).filter(
        (item) => isAmmo(item) &&
                  getAmmoType(item) === ammoType &&
                  !isQuiver(item) &&
                  !getSpecialAmmo(item) &&
                  itemQuantity(item) > 0
      );

      if (looseAmmoItems.length > 0) {
        const looseItem = looseAmmoItems[0];
        await changeItemQuantity(looseItem, -1);
        const looseNameKey = looseItem.name.toLowerCase().includes("virote") || looseItem.name.toLowerCase().includes("bolt")
          ? "TENEBRE.Ammo.LooseBolt"
          : "TENEBRE.Ammo.LooseArrow";
        ui.notifications.info(game.i18n.format("TENEBRE.Ammo.ConsumedLooseInventory", {
          ammo: game.i18n.localize(looseNameKey)
        }));
      } else {
        const qty = itemQuantity(ammo);
        let usesRemaining = ammo.getFlag(FLAG_SCOPE, "usesRemaining");
        if (usesRemaining === undefined || usesRemaining === null) {
          usesRemaining = quiverCapacity;
        }
        
        if (usesRemaining > 1) {
          await ammo.setFlag(FLAG_SCOPE, "usesRemaining", usesRemaining - 1);
          ui.notifications.info(game.i18n.format("TENEBRE.Ammo.QuiverUsesRemaining", {
            remaining: usesRemaining - 1
          }));
        } else {
          await changeItemQuantity(ammo, -1);
          const nextQty = Math.max(0, qty - 1);
          await ammo.setFlag(FLAG_SCOPE, "usesRemaining", nextQty > 0 ? quiverCapacity : 0);
          ui.notifications.info(game.i18n.format("TENEBRE.Ammo.QuiverEmptied", { remaining: nextQty }));
        }
      }
    } else {
      await changeItemQuantity(ammo, -1);
    }

    await actor.setFlag(FLAG_SCOPE, "lastShot", {
      ammoItemId: shot?.itemId ?? ammo.id,
      ammoName: shot?.name ?? ammo.name,
      ammoType: shot?.ammoType ?? ammoType,
      ammoImg: shot?.img ?? ammo.img,
      sourceUuid: shot?.sourceUuid ?? "",
      description: shot?.description ?? "",
      recoveryClass: shot?.recoveryClass ?? "common",
      recoveryThreshold: shot?.recoveryThreshold ?? 10,
      weaponId: weapon.id,
      timestamp: shot?.lastUsedAt ?? Date.now()
    });

    return shot;
  }

  static async reloadQuiverPrompt(actor, quiverItem) {
    if (!isPlayerActor(actor)) return;

    const currentTotal = getQuiverLoadedTotal(quiverItem);
    const quiverCapacity = getQuiverCapacity();
    const remainingCapacity = quiverCapacity - currentTotal;
    if (remainingCapacity <= 0) {
      ui.notifications.warn(game.i18n.localize("TENEBRE.Ammo.ReloadFull"));
      return;
    }

    const looseAmmoItems = actorItems(actor).filter(
      (item) => isAmmo(item) && !isQuiver(item) && itemQuantity(item) > 0
    );

    if (looseAmmoItems.length === 0) {
      ui.notifications.warn(game.i18n.localize("TENEBRE.Ammo.ReloadNoAmmo"));
      return;
    }

    const optionsHtml = looseAmmoItems.map((item) => {
      return `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} (${itemQuantity(item)})</option>`;
    }).join("");

    const firstItem = looseAmmoItems[0];
    const initialMax = Math.min(remainingCapacity, itemQuantity(firstItem));

    const content = buildQuiverTransferDialogContent({
      selectLabel: game.i18n.localize("TENEBRE.Ammo.ReloadChooseAmmo"),
      quantityLabel: game.i18n.localize("TENEBRE.Ammo.ReloadQuantity"),
      optionsHtml,
      quantityValue: initialMax,
      quantityMax: initialMax,
      hint: game.i18n.format("TENEBRE.Ammo.ReloadRemainingCapacity", { remaining: remainingCapacity })
    });

    const result = await promptDialog({
      title: game.i18n.localize("TENEBRE.Ammo.ReloadTitle"),
      content,
      okLabel: game.i18n.localize("TENEBRE.Common.Confirm"),
      cancelLabel: game.i18n.localize("TENEBRE.Common.Cancel"),
      width: 360,
      symbaroumStyle: false,
      callback: (element) => {
        const ammoId = element.querySelector('[name="ammoId"]')?.value;
        const selectedItem = looseAmmoItems.find(i => i.id === ammoId);
        const maxToLoad = selectedItem ? Math.min(remainingCapacity, itemQuantity(selectedItem)) : remainingCapacity;
        const quantity = Math.min(parseInt(element.querySelector('[name="quantity"]')?.value) || 0, maxToLoad);
        return { ammoId, quantity };
      }
    });

    if (!result) return;

    const { ammoId, quantity } = result;
    const looseItem = actor.items.get(ammoId);
    if (!looseItem) return;

    const finalQty = Math.min(quantity, remainingCapacity, itemQuantity(looseItem));
    if (finalQty <= 0) return;

    const ammoMetadata = snapshotAmmoMetadata(looseItem);

    // Consome munição avulsa
    await changeItemQuantity(looseItem, -finalQty);

    // Adiciona na aljava
    const loadedAmmo = getQuiverLoadedAmmo(quiverItem);
    let entry = loadedAmmo.find(e => e.name === looseItem.name);
    if (entry) {
      entry.quantity = (Number(entry.quantity) || 0) + finalQty;
      Object.assign(entry, ammoMetadata);
    } else {
      entry = {
        id: looseItem.id,
        name: looseItem.name,
        quantity: finalQty,
        img: looseItem.img,
        ...ammoMetadata
      };
      loadedAmmo.push(entry);
    }

    await quiverItem.setFlag(FLAG_SCOPE, "loadedAmmo", loadedAmmo);
    ui.notifications.info(game.i18n.format("TENEBRE.Ammo.ReloadSuccess", {
      loaded: finalQty,
      ammo: looseItem.name
    }));

    const actorImg = actor.img || actor.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg";
    const ammoImg = looseItem.img || "icons/weapons/ammunition/arrows-bodkin-yellow-red.webp";
    const quiverImg = quiverItem.img || "icons/weapons/ammunition/arrows-bodkin-yellow-red.webp";

    const chatContent = `
      <div class="tenebre-chat-card tenebre-reload-card" data-ammo-uuid="${escapeHtml(ammoMetadata.sourceUuid)}">
        <div class="tenebre-chat-header" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <img src="${escapeHtml(actorImg)}" style="width: 32px; height: 32px; border-radius: 4px; border: 1px solid #7a7973;" alt="${escapeHtml(actor.name)}">
          <h3 style="margin: 0; font-size: 1.1em; line-height: 1.2; font-weight: bold; border-bottom: none;">
            ${game.i18n.format("TENEBRE.Ammo.ReloadChatTitle", { actor: escapeHtml(actor.name) })}
          </h3>
        </div>
        <div class="tenebre-chat-item" style="display: flex; align-items: center; gap: 10px; padding: 6px; border: 1px dashed #7a7973; background: rgba(0,0,0,0.05); border-radius: 4px;">
          <img src="${escapeHtml(ammoImg)}" style="width: 28px; height: 28px; border: none; background: transparent;" alt="">
          <div style="flex: 1; font-size: 0.95em;">
            <strong>${finalQty}x</strong> ${escapeHtml(looseItem.name)} <br>
            <span style="font-size: 0.85em; color: #555;">
              ${game.i18n.localize("TENEBRE.Ammo.ReloadChatTarget")} <strong>${escapeHtml(quiverItem.name)}</strong> (${getQuiverLoadedTotal(quiverItem)}/${quiverCapacity})
            </span>
          </div>
          <img src="${escapeHtml(quiverImg)}" style="width: 28px; height: 28px; border: none; background: transparent;" alt="">
        </div>
      </div>
    `;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: chatContent,
      flags: {
        [FLAG_SCOPE]: {
          gmLogAction: {
            type: "ammo.reload",
            actorUuid: actor.uuid,
            targetUuid: quiverItem.uuid,
            subjectUuid: ammoMetadata.sourceUuid || looseItem.uuid,
            subjectName: looseItem.name,
            values: { amount: finalQty }
          }
        }
      }
    });
  }

  static async unloadQuiver(actor, quiverItem) {
    if (!isPlayerActor(actor) || !quiverItem || !isQuiver(quiverItem)) return;

    const loadedAmmo = getQuiverLoadedAmmo(quiverItem)
      .map((entry) => ({
        ...entry,
        quantity: Number(entry.quantity) || 0
      }))
      .filter((entry) => entry.quantity > 0);

    if (!loadedAmmo.length) {
      ui.notifications.warn(game.i18n.localize("TENEBRE.Ammo.UnloadEmpty"));
      return;
    }

    const optionsHtml = loadedAmmo.map((entry, index) => {
      return `<option value="${index}">${escapeHtml(entry.name)} (${entry.quantity})</option>`;
    }).join("");
    const firstEntry = loadedAmmo[0];

    const content = buildQuiverTransferDialogContent({
      selectLabel: game.i18n.localize("TENEBRE.Ammo.UnloadChooseAmmo"),
      quantityLabel: game.i18n.localize("TENEBRE.Ammo.UnloadQuantity"),
      optionsHtml,
      quantityValue: firstEntry.quantity,
      quantityMax: firstEntry.quantity,
      hint: game.i18n.format("TENEBRE.Ammo.UnloadLoadedCount", { loaded: getQuiverLoadedTotal(quiverItem) })
    });

    const result = await promptDialog({
      title: game.i18n.localize("TENEBRE.Ammo.UnloadTitle"),
      content,
      okLabel: game.i18n.localize("TENEBRE.Common.Confirm"),
      cancelLabel: game.i18n.localize("TENEBRE.Common.Cancel"),
      width: 360,
      symbaroumStyle: false,
      callback: (element) => {
        const entryIndex = Number(element.querySelector('[name="ammoId"]')?.value ?? 0);
        const selectedEntry = loadedAmmo[entryIndex];
        const maxToUnload = selectedEntry ? Number(selectedEntry.quantity) || 0 : 0;
        const quantity = Math.min(parseInt(element.querySelector('[name="quantity"]')?.value) || 0, maxToUnload);
        return { entryIndex, quantity };
      }
    });

    if (!result) return;

    const selectedEntry = loadedAmmo[result.entryIndex];
    const finalQty = Math.min(Number(result.quantity) || 0, Number(selectedEntry?.quantity) || 0);
    if (!selectedEntry || finalQty <= 0) return;

    const looseItem = actorItems(actor).find((item) => {
      if (!isAmmo(item) || isQuiver(item)) return false;
      return item.id === selectedEntry.id || item.name === selectedEntry.name;
    });

    if (looseItem) {
      await changeItemQuantity(looseItem, finalQty);
    } else {
      await createRecoveredAmmo(actor, {
        ...selectedEntry,
        itemId: selectedEntry.id,
        ammoType: selectedEntry.ammoType || "ammo"
      }, finalQty);
    }

    const nextLoadedAmmo = loadedAmmo
      .map((entry, index) => index === result.entryIndex
        ? { ...entry, quantity: Math.max(0, entry.quantity - finalQty) }
        : entry
      )
      .filter((entry) => entry.quantity > 0);

    await quiverItem.setFlag(FLAG_SCOPE, "loadedAmmo", nextLoadedAmmo);
    if (nextLoadedAmmo.length === 0) {
      await quiverItem.unsetFlag(FLAG_SCOPE, "usesRemaining");
    }

    ui.notifications.info(game.i18n.format("TENEBRE.Ammo.UnloadSuccess", {
      count: finalQty,
      quiver: quiverItem.name
    }));
  }

  static async promptAmmo(_actor, ammoType, ammoItems) {
    const options = ammoItems.map((item, index) => `
      <label class="tenebre-ammo-option">
        <input type="radio" name="ammoId" value="${item.id}" ${index === 0 ? "checked" : ""}>
        <span>${escapeHtml(item.name)}</span>
        <small>${itemQuantity(item)}</small>
      </label>
    `).join("");

    const content = `
      <p>${game.i18n.format("TENEBRE.Ammo.SelectHint", { type: localizeAmmoType(ammoType) })}</p>
      <div class="tenebre-ammo-list">${options}</div>
    `;

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("TENEBRE.Ammo.SelectTitle") },
      content,
      ok: {
        icon: "fas fa-check",
        label: game.i18n.localize("TENEBRE.Common.Confirm"),
        callback: (event, button, dialog) => {
          const ammoId = dialog.element.querySelector("input[name='ammoId']:checked")?.value;
          return ammoItems.find((item) => item.id === ammoId) ?? null;
        }
      },
      rejectClose: false
    });

    return result ?? null;
  }

  static async recordHit(actor, ammo) {
    if (!isPlayerActor(actor)) return;
    if (!TenebreSettings.get("enableHitTracking") || !ammo) return;

    const shot = getRecoverableShotData(actor, ammo);
    if (!shot) return;

    const current = actor.getFlag(FLAG_SCOPE, "combat") ?? {};
    const ammoHits = foundry.utils.deepClone(current.ammoHits ?? {});
    const entry = ammoHits[shot.key] ?? {
      itemId: shot.itemId,
      name: shot.name,
      ammoType: shot.ammoType,
      img: shot.img,
      sourceUuid: shot.sourceUuid,
      description: shot.description,
      recoveryClass: shot.recoveryClass,
      recoveryThreshold: shot.recoveryThreshold,
      lastUsedAt: shot.lastUsedAt,
      count: 0
    };
    entry.itemId = shot.itemId;
    entry.name = shot.name;
    entry.ammoType = shot.ammoType;
    entry.img = shot.img;
    entry.sourceUuid = shot.sourceUuid;
    entry.description = shot.description;
    entry.recoveryClass = shot.recoveryClass;
    entry.recoveryThreshold = shot.recoveryThreshold;
    entry.lastUsedAt = shot.lastUsedAt;
    entry.count += 1;
    ammoHits[shot.key] = entry;

    await actor.setFlag(FLAG_SCOPE, "combat", {
      ammoHit: (current.ammoHit ?? 0) + 1,
      ammoHits
    });
  }

  static getTrackedHits(actor) {
    if (!isPlayerActor(actor)) {
      return {
        ammoHit: 0,
        ammoHits: {}
      };
    }

    const combat = actor.getFlag(FLAG_SCOPE, "combat") ?? {};
    const ammoHit = combat.ammoHit !== undefined
      ? Number(combat.ammoHit ?? 0)
      : (Number(combat.arrowsHit ?? 0) + Number(combat.boltsHit ?? 0));
    return {
      ammoHit,
      ammoHits: combat.ammoHits ?? {}
    };
  }

  static async recover(actor) {
    if (!isPlayerActor(actor)) return;
    if (!TenebreSettings.get("enableAmmoRecovery")) return;

    const actorKey = actor?.uuid ?? actor?.id ?? actor?.name;
    if (actorKey && this.#recoveringActors.has(actorKey)) return;

    if (actorKey) this.#recoveringActors.add(actorKey);
    try {
      const initialHits = this.getTrackedHits(actor).ammoHit;
      if (initialHits <= 0) {
        ui.notifications.warn(game.i18n.localize("TENEBRE.Recovery.NoHits"));
        return;
      }

      const session = createRecoverySession(actor, initialHits);

      let result = await this.#recoverOne(actor);
      if (result?.status === "empty") {
        await finishRecoverySession(session, { deleteEmpty: true });
        ui.notifications.warn(game.i18n.localize("TENEBRE.Recovery.NoHits"));
        return;
      }

      await appendRecoveryAttempt(session, result, actor);
      while (result?.remaining > 0) {
        result = await this.#recoverOne(actor);
        if (!result || result.status === "empty") break;
        await appendRecoveryAttempt(session, result, actor);
      }

      await finishRecoverySession(session);
    } finally {
      if (actorKey) this.#recoveringActors.delete(actorKey);
    }
  }

  static async #recoverOne(actor) {
    const hits = this.getTrackedHits(actor);
    const totalHits = hits.ammoHit;
    if (totalHits <= 0) {
      return { status: "empty", remaining: 0 };
    }

    const entryPair = Object.entries(hits.ammoHits)
      .filter(([, entry]) => Number(entry.count) > 0)
      .sort(([, left], [, right]) => Number(right.lastUsedAt ?? 0) - Number(left.lastUsedAt ?? 0))[0];
    if (!entryPair) {
      await actor.setFlag(FLAG_SCOPE, "combat", {
        arrowsHit: 0,
        boltsHit: 0,
        ammoHit: 0,
        ammoHits: {}
      });
      return { status: "empty", remaining: 0 };
    }

    const [entryKey, entry] = entryPair;
    const recoveryEntry = getRecoverableEntryData(actor, entry);
    if (!recoveryEntry) {
      const ammoHits = foundry.utils.deepClone(hits.ammoHits);
      const remainingForEntry = Math.max(0, Number(ammoHits[entryKey]?.count ?? 0) - 1);
      if (remainingForEntry > 0) {
        ammoHits[entryKey].count = remainingForEntry;
      } else {
        delete ammoHits[entryKey];
      }

      await actor.setFlag(FLAG_SCOPE, "combat", {
        arrowsHit: 0,
        boltsHit: 0,
        ammoHit: Math.max(0, totalHits - 1),
        ammoHits
      });
      return {
        status: "skipped",
        remaining: Math.max(0, totalHits - 1),
        attempt: {
          ammoName: entry.name,
          ammoUuid: entry.sourceUuid ?? "",
          outcome: "skipped"
        }
      };
    }

    const recoveryTarget = getRecoveryTarget(recoveryEntry);
    const threshold = recoveryTarget.threshold;
    const roll = await evaluateRoll("1d20");
    const rollValue = rollTotal(roll);
    const success = rollValue <= threshold;

    if (success) {
      const item = actorItems(actor).find((candidate) => {
        if (!isAmmo(candidate) || isQuiver(candidate)) return false;
        return candidate.id === recoveryEntry.itemId || candidate.name === recoveryEntry.name;
      });
      if (item) {
        await changeItemQuantity(item, 1);
      } else {
        await createRecoveredAmmo(actor, recoveryEntry, 1);
      }
    }

    const ammoHits = foundry.utils.deepClone(hits.ammoHits);
    const remainingForEntry = Math.max(0, Number(ammoHits[entryKey]?.count ?? 0) - 1);
    if (remainingForEntry > 0) {
      ammoHits[entryKey].count = remainingForEntry;
    } else {
      delete ammoHits[entryKey];
    }

    const remainingTotal = Math.max(0, totalHits - 1);
    await actor.setFlag(FLAG_SCOPE, "combat", {
      arrowsHit: 0,
      boltsHit: 0,
      ammoHit: remainingTotal,
      ammoHits
    });

    return {
      status: "rolled",
      remaining: remainingTotal,
      roll,
      attempt: {
        ammoName: recoveryEntry.name,
        ammoUuid: recoveryEntry.sourceUuid ?? "",
        outcome: success ? "success" : "failure",
        roll: rollValue,
        threshold,
        typeLabel: recoveryTarget.typeLabel
      }
    };
  }
}

function createRecoverySession(actor, total) {
  return {
    actorUuid: actor.uuid,
    actorName: actor.name,
    total: Math.max(0, Number(total) || 0),
    status: "running",
    attempts: [],
    successes: 0,
    failures: 0,
    skipped: 0,
    message: null
  };
}

async function createRecoverySessionMessage(session, actor) {
  try {
    return await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: recoverySessionContent(session),
      flags: recoverySessionFlags(session)
    });
  } catch (error) {
    console.warn("symbaroum-ind-resources | Failed to create ammunition recovery session message.", error);
    return null;
  }
}

async function appendRecoveryAttempt(session, result, actor = null) {
  const attempt = result?.attempt;
  if (!attempt) return;

  if (result.roll) await showDice3dRoll(result.roll);

  session.attempts.push({ ...attempt, index: session.attempts.length + 1 });
  if (attempt.outcome === "success") session.successes += 1;
  else if (attempt.outcome === "failure") session.failures += 1;
  else session.skipped += 1;

  if (session.message) {
    await updateRecoverySessionMessage(session);
  } else if (actor) {
    session.message = await createRecoverySessionMessage(session, actor);
  }
}

async function finishRecoverySession(session, { deleteEmpty = false } = {}) {
  if (!session.message) return;
  if (deleteEmpty && !session.attempts.length) {
    try {
      await session.message.delete();
    } catch (error) {
      console.warn("symbaroum-ind-resources | Failed to remove empty ammunition recovery session message.", error);
    }
    return;
  }

  session.status = "complete";
  await updateRecoverySessionMessage(session);
}

async function updateRecoverySessionMessage(session) {
  if (!session.message) return;
  try {
    const flags = foundry.utils.deepClone(session.message.flags ?? {});
    flags[FLAG_SCOPE] = {
      ...(flags[FLAG_SCOPE] ?? {}),
      ...recoverySessionFlags(session)[FLAG_SCOPE]
    };
    await session.message.update({
      content: recoverySessionContent(session),
      flags
    });
  } catch (error) {
    console.warn("symbaroum-ind-resources | Failed to update ammunition recovery session message.", error);
  }
}

function recoverySessionFlags(session) {
  const lastAttempt = session.attempts.at(-1) ?? {};
  const outcome = session.status !== "complete"
    ? "pending"
    : session.successes > 0 && session.failures === 0
      ? "success"
      : session.failures > 0 && session.successes === 0
        ? "failure"
        : "info";

  return {
    [FLAG_SCOPE]: {
      ammoRecoverySession: {
        version: 1,
        status: session.status,
        actorUuid: session.actorUuid,
        actorName: session.actorName,
        total: session.total,
        processed: session.attempts.length,
        successes: session.successes,
        failures: session.failures,
        skipped: session.skipped,
        attempts: session.attempts
      },
      gmLogAction: {
        type: "ammo.recovery",
        outcome,
        actorUuid: session.actorUuid,
        subjectUuid: lastAttempt.ammoUuid ?? "",
        subjectName: lastAttempt.ammoName ?? "",
        values: {
          formula: "1d20",
          roll: lastAttempt.roll ?? "",
          maximum: lastAttempt.threshold ?? "",
          attempts: session.attempts.length,
          total: session.total,
          successes: session.successes,
          failures: session.failures,
          skipped: session.skipped
        }
      }
    }
  };
}

function recoverySessionContent(session) {
  const summaryKey = session.status === "complete"
    ? "TENEBRE.Recovery.SessionSummary"
    : "TENEBRE.Recovery.SessionInProgress";

  return `
    <div class="tenebre-chat-card tenebre-recovery-session-card">
      <h3>${escapeHtml(game.i18n.localize("TENEBRE.Recovery.ChatTitle"))}</h3>
      <p>${escapeHtml(game.i18n.format(summaryKey, {
        actor: session.actorName,
        total: session.total,
        processed: session.attempts.length,
        successes: session.successes,
        failures: session.failures
      }))}</p>
    </div>
  `;
}

function isPlayerActor(actor) {
  return actor?.type === "player";
}

function getRecoveryTarget(ammo) {
  const baseThreshold = getAmmoRecoveryThreshold(ammo);
  if (!TenebreSettings.get("enableAmmoRecoveryByQuality")) {
    return {
      threshold: clampRecoveryTarget(TenebreSettings.get("ammoRecoveryFlatTarget"), 10),
      typeLabel: game.i18n.localize("TENEBRE.Recovery.TypeCommon")
    };
  }

  if (baseThreshold >= 17) {
    return {
      threshold: clampRecoveryTarget(TenebreSettings.get("ammoRecoveryMysticalTarget"), 17),
      typeLabel: game.i18n.localize("TENEBRE.Recovery.TypeMystical")
    };
  }

  if (baseThreshold >= 15) {
    return {
      threshold: clampRecoveryTarget(TenebreSettings.get("ammoRecoveryQualityTarget"), 15),
      typeLabel: game.i18n.localize("TENEBRE.Recovery.TypeQuality")
    };
  }

  return {
    threshold: clampRecoveryTarget(TenebreSettings.get("ammoRecoveryCommonTarget"), 10),
    typeLabel: game.i18n.localize("TENEBRE.Recovery.TypeCommon")
  };
}

function clampRecoveryTarget(value, fallback) {
  return Math.min(20, Math.max(1, Number(value) || fallback));
}

function buildQuiverTransferDialogContent({
  selectLabel,
  quantityLabel,
  optionsHtml,
  quantityValue,
  quantityMax,
  hint
}) {
  return `
    <div class="tenebre-quiver-transfer-dialog">
      <div class="tenebre-quiver-transfer-row">
        <label>${escapeHtml(selectLabel)}</label>
        <select name="ammoId">
          ${optionsHtml}
        </select>
      </div>
      <div class="tenebre-quiver-transfer-row">
        <label>${escapeHtml(quantityLabel)}</label>
        <input type="number" name="quantity" value="${Number(quantityValue) || 1}" min="1" max="${Number(quantityMax) || 1}">
      </div>
      <p class="tenebre-quiver-transfer-hint">${escapeHtml(hint)}</p>
    </div>
  `;
}

function getRecoverableShotData(actor, ammo, fallbackAmmoType = "") {
  if (!ammo) return null;

  if (ammo.key && ammo.name && ammo.ammoType) {
    return {
      ...ammo,
      lastUsedAt: Number(ammo.lastUsedAt) || Date.now()
    };
  }

  if (ammo.isVirtual) {
    return {
      key: ammo.recoveryKey ?? ammo.recoveryItemId ?? ammo.id ?? ammo.name,
      itemId: ammo.recoveryItemId ?? ammo.id,
      name: ammo.recoveryName ?? ammo.name,
      ammoType: getAmmoType(ammo) || fallbackAmmoType || "ammo",
      img: ammo.img,
      ...snapshotAmmoMetadata(ammo),
      lastUsedAt: Date.now()
    };
  }

  if (isQuiver(ammo)) {
    const lastShot = actor?.getFlag?.(FLAG_SCOPE, "lastShot");
    if (!lastShot || isQuiverName(lastShot.ammoName)) return null;
    return {
      key: lastShot.ammoItemId ?? lastShot.ammoName,
      itemId: lastShot.ammoItemId,
      name: lastShot.ammoName,
      ammoType: lastShot.ammoType || fallbackAmmoType || "ammo",
      img: lastShot.ammoImg,
      sourceUuid: lastShot.sourceUuid ?? "",
      description: lastShot.description ?? "",
      recoveryClass: lastShot.recoveryClass ?? getAmmoRecoveryClass(lastShot.ammoName),
      recoveryThreshold: lastShot.recoveryThreshold ?? getAmmoRecoveryThreshold(lastShot.ammoName),
      lastUsedAt: Number(lastShot.timestamp) || Date.now()
    };
  }

  if (!isAmmo(ammo)) return null;
  return {
    key: ammo.id,
    itemId: ammo.id,
    name: ammo.name,
    ammoType: getAmmoType(ammo) || fallbackAmmoType || "ammo",
    img: ammo.img,
    ...snapshotAmmoMetadata(ammo),
    lastUsedAt: Date.now()
  };
}

function getRecoverableEntryData(actor, entry) {
  if (!entry) return null;

  const item = entry.itemId ? actorItems(actor).find((candidate) => candidate.id === entry.itemId) : null;
  if (!isQuiverName(entry.name) && (!item || !isQuiver(item))) {
    return entry;
  }

  const lastShot = actor?.getFlag?.(FLAG_SCOPE, "lastShot");
  if (!lastShot || isQuiverName(lastShot.ammoName)) return null;

  return {
    itemId: lastShot.ammoItemId,
    name: lastShot.ammoName,
    ammoType: lastShot.ammoType || entry.ammoType || "ammo",
    img: lastShot.ammoImg || entry.img,
    sourceUuid: lastShot.sourceUuid ?? entry.sourceUuid ?? "",
    description: lastShot.description ?? entry.description ?? "",
    recoveryClass: lastShot.recoveryClass ?? entry.recoveryClass ?? getAmmoRecoveryClass(lastShot.ammoName),
    recoveryThreshold: lastShot.recoveryThreshold ?? entry.recoveryThreshold ?? getAmmoRecoveryThreshold(lastShot.ammoName),
    lastUsedAt: Number(lastShot.timestamp) || Number(entry.lastUsedAt) || Date.now()
  };
}

function snapshotAmmoMetadata(ammo) {
  const sourceUuid = [
    ammo?.sourceUuid,
    ammo?.itemUuid,
    documentSourceUuid(ammo, ammo?.uuid)
  ].map((value) => String(value ?? "").trim()).find(Boolean) ?? "";
  return {
    sourceUuid,
    description: getAmmoDescription(ammo),
    recoveryClass: getAmmoRecoveryClass(ammo),
    recoveryThreshold: getAmmoRecoveryThreshold(ammo)
  };
}

function isQuiverName(name) {
  const value = String(name ?? "").toLowerCase();
  return value.includes("aljava") || value.includes("quiver");
}

async function postAmmoCard(actor, ammo) {
  const description = sanitizeHtml(getAmmoDescription(ammo));
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="tenebre-chat-card">
        <h3>${game.i18n.format("TENEBRE.Ammo.UsesAmmo", {
          actor: foundry.utils.escapeHTML(actor.name),
          ammo: escapeHtml(ammo.name)
        })}</h3>
        <div class="tenebre-chat-item">
          <img src="${escapeHtml(ammo.img)}" alt="">
          <div>${description}</div>
        </div>
      </div>
    `
  });
}

async function createRecoveredAmmo(actor, entry, recovered) {
  const system = foundry.utils.deepClone(game.model.Item.equipment ?? {});
  if (entry.description) system.description = entry.description;
  const itemData = {
    name: entry.name,
    type: "equipment",
    img: entry.img ?? "icons/weapons/ammunition/arrows-bodkin-yellow-red.webp",
    system,
    flags: {
      [FLAG_SCOPE]: {
        isAmmo: true,
        ammoType: entry.ammoType,
        ammoRecoveryClass: entry.recoveryClass,
        ammoRecoveryThreshold: entry.recoveryThreshold
      }
    }
  };
  if (String(entry.sourceUuid ?? "").startsWith("Compendium.")) {
    itemData._stats = { compendiumSource: entry.sourceUuid };
  }
  itemData.system.number = recovered;
  await actor.createEmbeddedDocuments("Item", [itemData], { render: false });
}
