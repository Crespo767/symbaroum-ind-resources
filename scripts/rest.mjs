import { MODULE_ID } from "./constants.mjs";
import { TenebreSettings } from "./settings.mjs";
import { HungerService } from "./hunger.mjs";
import { escapeHtml } from "./utils.mjs";
import { createChatMessageAfterDice } from "./dice.mjs";
import { SocketService } from "./sockets.mjs";
// Gerenciamento de descanso de personagens
export class RestService {
  // Abre diálogo de descanso para o ator
  static async openRestDialog(actor) {
    const restHealingEnabled = TenebreSettings.get("enableRestHealing");
    const configuredHealing = Number(TenebreSettings.get("restHealing"));
    const defaultHealing = restHealingEnabled && Number.isFinite(configuredHealing) ? configuredHealing : 0;

    const content = `
      <div class="symbaroum dialog tenebre-rest-dialog">
        <div class="damagemodifier tenebre-rest-actor-row">
          <label>${game.i18n.localize("TENEBRE.Maneuvers.Actor")}</label>
          <input type="text" value="${escapeHtml(actor.name)}" disabled>
        </div>
        <div class="damagemodifier">
          <label for="tenebre-days">${game.i18n.localize("TENEBRE.Rest.Days")}</label>
          <input type="number" id="tenebre-days" name="days" value="1" min="1" max="30">
        </div>
        <div class="damagemodifier">
          <label for="tenebre-healing">${game.i18n.localize("TENEBRE.Rest.HealingPerDay")}</label>
          <input type="number" id="tenebre-healing" name="healing" value="${defaultHealing}" min="0" max="100">
        </div>
      </div>
    `;

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("TENEBRE.Rest.DialogTitle") },
      content,
      ok: {
        icon: "fas fa-bed",
        label: game.i18n.localize("TENEBRE.Rest.Confirm"),
        callback: (_event, _button, dialog) => {
          return {
            days: Number(dialog.element.querySelector("#tenebre-days")?.value) || 1,
            healing: restHealingEnabled ? (Number(dialog.element.querySelector("#tenebre-healing")?.value) ?? 1) : 0
          };
        }
      },
      rejectClose: false
    });

    if (result == null) return;
    await RestService.applyRest(actor, result.days, result.healing);
  }

  // Aplica efeitos de descanso (recuperação de vitalidade, remoção de corrupção temporária e resets de morte)
  static async applyRest(actor, days = 1, healingPerDay = null) {
    const updates = {};
    const results = { days, actorName: actor.name, healed: 0, corruptionCleared: 0, hungerResults: [], hungerStrongRecovered: 0 };

    // Zera os testes de morte falhos
    updates["system.nbrOfFailedDeathRoll"] = 0;

    // Verifica status de fome
    const hasHunger = HungerService.hasHunger(actor);

    // Recuperação de vitalidade
    let finalHealing = TenebreSettings.get("enableRestHealing")
      ? (healingPerDay !== null ? healingPerDay : (Number(TenebreSettings.get("restHealing")) || 0))
      : 0;

    if (!HungerService.naturalHealingAllowed(actor)) {
      finalHealing = 0;
    }

    if (finalHealing > 0) {
      const totalHealing = finalHealing * days;
      const current = Number(actor.system?.health?.toughness?.value ?? 0);
      const max = Number(actor.system?.health?.toughness?.max ?? current);
      const next = Math.min(max, current + totalHealing);
      const healed = next - current;
      if (healed > 0) {
        updates["system.health.toughness.value"] = next;
        results.healed = healed;
      }
    }

    // Testes diários de Vigoroso por inanição
    if (hasHunger) {
      let currentStrong = HungerService.getStrongTotal(actor);
      let currentPenalty = HungerService.getStrongPenalty(actor);
      const pendingPenaltyUpdates = {};

      for (let d = 1; d <= days; d++) {
        const starvation = await HungerService.rollStarvationDay(currentStrong);

        let effectMsg = "";
        if (!starvation.success) {
          currentPenalty -= 1;
          currentStrong = starvation.nextStrong;
          updates["system.attributes.strong.temporaryMod"] = Number(actor.system?.attributes?.strong?.temporaryMod ?? 0) + currentPenalty - HungerService.getStrongPenalty(actor);
          pendingPenaltyUpdates[`flags.${MODULE_ID}.hungerStrongPenalty`] = currentPenalty;

          if (starvation.dead) {
            updates["system.health.toughness.value"] = 0;
            updates["system.nbrOfFailedDeathRoll"] = 3;
            effectMsg = game.i18n.localize("TENEBRE.Hunger.StarvationDeath");
          } else {
            effectMsg = game.i18n.format("TENEBRE.Hunger.StarvationFailure", {
              strong: currentStrong,
              modifier: currentPenalty
            });
          }
        } else {
          effectMsg = "Passou no teste!";
        }

        results.hungerResults.push({
          day: d,
          rolls: starvation.rolls,
          rollObjects: starvation.rollObjects,
          selectedRoll: starvation.selectedRoll,
          target: starvation.target,
          success: starvation.success,
          effectMsg,
          dead: starvation.dead
        });

        if (starvation.dead) {
          break;
        }
      }

      Object.assign(updates, pendingPenaltyUpdates);
    } else {
      const hungerPenalty = HungerService.getStrongPenalty(actor);
      if (hungerPenalty < 0) {
        const recovered = Math.min(days, Math.abs(hungerPenalty));
        const nextPenalty = hungerPenalty + recovered;
        const currentTemporaryMod = Number(actor.system?.attributes?.strong?.temporaryMod ?? 0) || 0;

        updates["system.attributes.strong.temporaryMod"] = currentTemporaryMod + recovered;
        if (nextPenalty < 0) {
          updates[`flags.${MODULE_ID}.hungerStrongPenalty`] = nextPenalty;
        } else {
          updates[`flags.${MODULE_ID}.-=hungerStrongPenalty`] = null;
        }
        results.hungerStrongRecovered = recovered;
      }
    }

    // Limpa corrupção temporária se sobreviveu
    const survived = !results.hungerResults.some(hr => hr.dead);
    if (days >= 1 && survived) {
      const corruption = Number(actor.system?.health?.corruption?.temporary ?? 0);
      if (corruption > 0) {
        updates["system.health.corruption.temporary"] = 0;
        results.corruptionCleared = corruption;
      }
    }

    await SocketService.updateDocument(actor, updates);
    if (results.hungerResults.some(hr => hr.dead)) {
      await HungerService.markDead(actor);
    }
    await RestService.#postRestMessage(actor, results);
  }

  // Envia mensagem de chat resumindo descanso
  static async #postRestMessage(actor, results) {
    const lines = [];
    if (results.healed > 0) {
      lines.push(game.i18n.format("TENEBRE.Rest.ChatHealed", { amount: results.healed }));
    }
    if (results.corruptionCleared > 0) {
      lines.push(game.i18n.format("TENEBRE.Rest.ChatCorruptionCleared", { amount: results.corruptionCleared }));
    }
    if (results.hungerStrongRecovered > 0) {
      lines.push(game.i18n.format("TENEBRE.Hunger.NaturalRecovery", { amount: results.hungerStrongRecovered }));
    }

    if (results.hungerResults && results.hungerResults.length > 0) {
      lines.push(`<li style="list-style: none; margin-left: -15px; font-weight: bold; color: #c62828; margin-top: 8px;">
        <i class="fas fa-drumstick-bite"></i> ${game.i18n.localize("TENEBRE.Hunger.StarvationTests")}:
      </li>`);
      lines.push(`<li style="font-size: 0.9em; list-style: none; margin-left: -10px;">
        ${game.i18n.localize("TENEBRE.Hunger.MovementReminder")}
      </li>`);
      for (const hr of results.hungerResults) {
        const statusColor = hr.success ? "#2e7d32" : "#c62828";
        const rollsStr = `[${hr.rolls[0]}, ${hr.rolls[1]}] &rarr; <strong>${hr.selectedRoll}</strong>`;
        lines.push(`<li style="font-size: 0.9em; margin-bottom: 4px; list-style: none; margin-left: -10px;">
          Dia ${hr.day}: Rolou ${rollsStr} contra Vigoroso ${hr.target}. <span style="color: ${statusColor}; font-weight: bold;">${hr.effectMsg}</span>
          ${hr.dead ? `<br><strong style="color: #c62828; text-transform: uppercase;"><i class="fas fa-skull"></i> O personagem morreu por inanição!</strong>` : ""}
        </li>`);
      }
    } else {
      if (lines.length === 0) {
        lines.push(game.i18n.localize("TENEBRE.Rest.ChatNoEffect"));
      }
    }

    const content = `
        <div class="tenebre-chat-card">
          <h3>${game.i18n.format("TENEBRE.Rest.ChatTitle", {
            actor: escapeHtml(results.actorName),
            days: results.days
          })}</h3>
          <ul>${lines.map(l => `<li>${l}</li>`).join("")}</ul>
        </div>
      `;
    const rolls = (results.hungerResults ?? []).flatMap((hr) => hr.rollObjects ?? []);

    await createChatMessageAfterDice({
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
      rolls,
      flags: {
        [MODULE_ID]: {
          gmLogAction: {
            type: "status.rest",
            actorUuid: actor.uuid,
            values: { days: results.days, amount: results.healed }
          }
        }
      }
    });
  }
}
