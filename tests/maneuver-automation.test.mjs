import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const maneuvers = fs.readFileSync(path.join(root, "scripts", "maneuvers.mjs"), "utf8");
const sockets = fs.readFileSync(path.join(root, "scripts", "sockets.mjs"), "utf8");
const policy = fs.readFileSync(path.join(root, "scripts", "socket-policy.mjs"), "utf8");
const pt = JSON.parse(fs.readFileSync(path.join(root, "languages", "pt-BR.json"), "utf8"));

test("all twelve optional maneuvers are registered with official descriptions", () => {
  const ids = ["delayInitiative", "grapple", "disarm", "knockdown", "charge", "carefulAim", "knockout", "totalDefense", "totalOffense", "shove", "poisonWeapon", "takeInitiative"];
  for (const id of ids) assert.match(maneuvers, new RegExp(`id: "${id}"`));
  assert.equal(ids.length, 12);
  assert.match(pt["TENEBRE.Maneuvers.GrappleNote"], /Um Teste é feito a cada turno/);
  assert.match(pt["TENEBRE.Maneuvers.ShoveNote"], /cinco metros/);
  assert.match(pt["TENEBRE.Maneuvers.KnockoutNote"], /1D12/);
});

test("initiative maneuvers alter and later restore the combatant initiative", () => {
  assert.match(maneuvers, /async function delayInitiative\([\s\S]*SocketService\.updateCombatant\(combatant, \{ initiative: next \}\)/);
  assert.match(maneuvers, /DELAYED_INITIATIVE[\s\S]*expiration: "rounds"/);
  assert.match(maneuvers, /revertTemporaryInitiativeBonus/);
  assert.match(maneuvers, /applyCombatInitiativeBonus\(actor, 5\)/);
  assert.match(policy, /DELAYED_INITIATIVE[\s\S]*flags\.expiration === "rounds"/);
});

test("grapple is maintained each turn and blocks movement and other actions", () => {
  assert.match(maneuvers, /await maintainCurrentGrapple\(\)/);
  assert.match(maneuvers, /maintenance: true/);
  assert.match(maneuvers, /releaseGrapple\(actor, targetActor\)/);
  assert.match(maneuvers, /MAINTAINING_GRAPPLE[\s\S]*GrappleActionBlocked/);
  assert.match(maneuvers, /MAINTAINING_GRAPPLE,[\s\S]*movementBlocked: true/);
});

test("disarm and shove use authenticated GM operations for target documents", () => {
  assert.match(maneuvers, /SocketService\.disarmItem\(targetActor, item\)/);
  assert.match(sockets, /async function disarmItemAsGM\([\s\S]*isTargetedActor\(actor, user\)/);
  assert.match(maneuvers, /SocketService\.shoveToken\(actor, targetToken\)/);
  assert.match(sockets, /async function shoveTokenAsGM\([\s\S]*Math\.hypot\(dx, dy\)[\s\S]*distance: 5/);
});

test("attack-related maneuvers integrate with native weapon rolls", () => {
  assert.match(maneuvers, /KNOCKOUT_READY[\s\S]*nextFavour = Math\.max\(nextFavour, 1\)/);
  assert.match(maneuvers, /KNOCKOUT_READY[\s\S]*rollDamageCheck\(actor, ManeuverService\.get\("knockout"\), 0\)/);
  assert.match(maneuvers, /CHARGING[\s\S]*isCurrentMeleeWeaponRoll\(actor\)[\s\S]*grantFreeAttack/);
  assert.match(maneuvers, /CAREFUL_AIM[\s\S]*isCurrentRangedWeaponRoll/);
  assert.match(maneuvers, /TOTAL_OFFENSE[\s\S]*isCurrentMeleeWeaponRoll/);
});

test("poison weapon selects and consumes one inventory dose", () => {
  assert.match(maneuvers, /choosePoisonDose\(actor\)/);
  assert.match(maneuvers, /identity\.includes\("veneno"\).*identity\.includes\("poison"\)/s);
  assert.match(maneuvers, /consumePoisonDose\(context\.poisonItem\)/);
  assert.match(maneuvers, /"system\.quantity": Math\.max\(0, quantity - 1\)/);
});
