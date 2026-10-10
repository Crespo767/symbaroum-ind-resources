import { TenebreSettings } from "./settings.mjs";
import { getAmmoModifiers } from "./special-ammo.mjs";
import {
  actorItems,
  findLoadedQuiverItems,
  getAmmoType,
  getQuiverCapacity,
  getQuiverLoadedAmmo,
  isAmmo,
  isQuiver,
  itemQuantity
} from "./item-flags.mjs";

export const AMMO_PACKAGE_PREFIX = "tenebre-ammo-";

/**
 * Opções do seletor de munição do diálogo de ataque.
 * `ammo` é o objeto usado para calcular os modificadores da munição especial.
 */
export function getAmmoRollOptions(actor, ammoType) {
  const useQuivers = TenebreSettings.get("enableQuiverAmmoContainers");
  if (useQuivers) {
    const options = [];
    for (const quiver of findLoadedQuiverItems(actor, ammoType)) {
      for (const entry of getQuiverLoadedAmmo(quiver)) {
        if (entry.quantity <= 0) continue;
        options.push({
          value: `quiver|${quiver.id}|${entry.name}`,
          label: `${quiver.name}: ${entry.name} (${entry.quantity}/${getQuiverCapacity()})`,
          ammo: { id: entry.id || entry.name, name: entry.name, system: {} }
        });
      }
    }
    return options;
  }

  return actorItems(actor)
    .filter((item) => isAmmo(item)
      && !isQuiver(item)
      && getAmmoType(item) === ammoType
      && itemQuantity(item) > 0)
    .map((item) => ({
      value: item.id,
      label: `${item.name} (${itemQuantity(item)})`,
      ammo: item
    }));
}

/**
 * Cria um pacote opcional ("checkbox") do sistema Symbaroum para cada munição com modificadores.
 * O sistema aplica bônus de ataque, dano e dano contínuo dos pacotes marcados quando a rolagem é feita.
 */
export function buildAmmoModifierPackages(options, getModifiers = getAmmoModifiers) {
  const packages = [];
  options.forEach((option, index) => {
    const members = getModifiers(option.ammo);
    if (!members.length) return;
    option.packageId = `${AMMO_PACKAGE_PREFIX}${index}`;
    packages.push({
      id: option.packageId,
      label: option.ammo.name,
      type: "checkbox",
      member: members
    });
  });
  return packages;
}

/**
 * Inclui os pacotes nos modificadores da arma antes de o sistema montar o diálogo,
 * que copia esses modificadores. Devolve a função que desfaz a inclusão.
 */
export function attachAmmoModifierPackages(actor, weapon, options) {
  const weaponModifiers = actor?.system?.combat?.combatMods?.weapons?.[weapon?.id];
  if (!Array.isArray(weaponModifiers?.package)) return () => {};

  const packages = buildAmmoModifierPackages(options);
  if (!packages.length) return () => {};
  weaponModifiers.package.push(...packages);

  return () => {
    weaponModifiers.package = weaponModifiers.package.filter((pack) => !String(pack.id).startsWith(AMMO_PACKAGE_PREFIX));
  };
}

/** Marca só a caixa da munição escolhida e esconde as caixas: o seletor de munição é o único controle. */
export function syncAmmoPackageSelection(root, options, selectedValue) {
  for (const option of options ?? []) {
    if (!option.packageId) continue;
    const checkbox = root?.querySelector?.(`input[id^="pgkid-"][id$="-${option.packageId}"]`);
    if (!checkbox) continue;
    checkbox.checked = option.value === selectedValue;
    const row = checkbox.closest?.(".advantage");
    if (row) {
      row.hidden = true;
      row.classList.add("tenebre-ammo-package");
    }
  }
}
