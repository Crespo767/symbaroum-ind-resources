import { AmmoService } from "./ammo.mjs";
import { attachAmmoModifierPackages, getAmmoRollOptions } from "./ammo-roll.mjs";
import { beginWeaponRoll } from "./roll-context.mjs";
import { MODULE_ID } from "./constants.mjs";
import { getWeaponAmmoType } from "./item-flags.mjs";
import { ManeuverService } from "./maneuvers.mjs";
import { TenebreSettings } from "./settings.mjs";
import { CompatibilityService } from "./compatibility.mjs";
import { canAttackWithWeapon, resolveWeaponItem, WeaponReadinessService } from "./weapon-readiness.mjs";
import { ProneAdvantageService } from "./prone-advantage.mjs";
import { getStandUpRemainingMovementActions } from "./stand-up.mjs";
import { isDeathIncapacitated } from "./death-automation.mjs";

let patched = false;

export function patchWeaponRolls() {
  if (patched || game.system.id !== "symbaroum") return;
  const ActorClass = CONFIG.Actor.documentClass;
  if (!ActorClass?.prototype?.rollWeapon) return;

  const originalRollWeapon = ActorClass.prototype.rollWeapon;
  const wrappedRollWeapon = async function(wrapped, weapon, ...args) {
    if (this?.type === "player" && isDeathIncapacitated(this)) {
      ui.notifications.warn(game.i18n.format("TENEBRE.Death.ActionBlocked", { actor: this.name }));
      return undefined;
    }

    ProneAdvantageService.captureWeaponAttack(this, weapon);

    if (this?.type !== "player") {
      return wrapped.call(this, weapon, ...args);
    }

    if (getStandUpRemainingMovementActions(this) === 0) {
      ui.notifications.warn(game.i18n.format("TENEBRE.StandUp.NoActionsRemaining", {
        actor: this.name
      }));
      return undefined;
    }

    const weaponItem = resolveWeaponItem(this, weapon);
    if (WeaponReadinessService.isEnabled() && weaponItem && !canAttackWithWeapon(weaponItem)) {
      ui.notifications.warn(game.i18n.format("TENEBRE.WeaponReadiness.AttackBlocked", {
        weapon: weaponItem.name
      }));
      return undefined;
    }

    const ammoType = getWeaponAmmoType(weapon);
    const maneuversEnabled = TenebreSettings.get("enableManeuvers");
    if (maneuversEnabled && ManeuverService.blocksAttacks(this)) {
      ui.notifications.warn(game.i18n.localize("TENEBRE.Maneuvers.AttackBlocked"));
      return undefined;
    }

    const tracksAmmo = Boolean(ammoType) && TenebreSettings.get("enableAmmoConsumption");

    // Exige seleção de exatamente 1 alvo se a automação de combate estiver ativa
    if (tracksAmmo && game.settings.get("symbaroum", "combatAutomation")) {
      const targets = Array.from(game.user.targets);
      if (targets.length !== 1) {
        ui.notifications.warn(game.i18n.localize("ABILITY_ERROR.TARGET"));
        return undefined;
      }
    }

    // O diálogo do sistema localiza este contexto pelo id do ator (roll-context.mjs).
    const rollState = {
      actor: this,
      weapon,
      ammoType,
      isRanged: Boolean(ammoType),
      tracksAmmo,
      ammoOptions: tracksAmmo ? getAmmoRollOptions(this, ammoType) : []
    };
    const endWeaponRoll = beginWeaponRoll(rollState);
    // O sistema copia os modificadores da arma ao montar o diálogo; os pacotes de munição precisam estar lá antes.
    const detachAmmoPackages = tracksAmmo
      ? attachAmmoModifierPackages(this, weapon, rollState.ammoOptions)
      : () => {};

    try {
      const result = await wrapped.call(this, weapon, ...args);
      const chosenAmmo = rollState.chosenAmmo;

      if (tracksAmmo && chosenAmmo) {
        if (!rollState.consumed) {
          rollState.consumed = true;
          rollState.shot = await AmmoService.consumeAmmo(this, chosenAmmo, weapon, ammoType);
        }

        if (!rollState.hitRecorded && isSuccessfulWeaponResult(result)) {
          rollState.hitRecorded = true;
          await AmmoService.recordHit(this, rollState.shot ?? chosenAmmo);
        }
      }

      if (maneuversEnabled) await ManeuverService.afterWeaponRoll(this, result);
      return result;
    } catch (err) {
      if (err === "Cancelled") {
        return undefined;
      }
      throw err;
    } finally {
      detachAmmoPackages();
      endWeaponRoll();
    }
  };

  if (CompatibilityService.canUseLibWrapper()) {
    libWrapper.register(MODULE_ID, "CONFIG.Actor.documentClass.prototype.rollWeapon", wrappedRollWeapon, "MIXED");
  } else {
    ActorClass.prototype.rollWeapon = async function tenebreRollWeapon(weapon, ...args) {
      return wrappedRollWeapon.call(this, originalRollWeapon, weapon, ...args);
    };
  }

  patched = true;
}

function isSuccessfulWeaponResult(result) {
  if (!result) return false;
  if (result.hasSucceed === true || result.hasDamage === true) return true;
  if (Array.isArray(result.rollData)) {
    return result.rollData.some((roll) => roll?.trueActorSucceeded === true || roll?.hasDamage === true);
  }
  return false;
}
