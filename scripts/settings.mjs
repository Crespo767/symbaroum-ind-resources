import { DEFAULTS, MODULE_ID } from "./constants.mjs";
import { EncumbranceService } from "./encumbrance.mjs";
import { StatusEffectPickerService } from "./status-effect-picker.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
let pendingSheetRerender = null;

export class TenebreSettingsForm extends HandlebarsApplicationMixin(ApplicationV2) {
  static settingCategory = "rations";

  static DEFAULT_OPTIONS = {
    id: "symbaroum-ind-resources-settings",
    tag: "form",
    form: {
      handler: TenebreSettingsForm.#onSubmit,
      closeOnSubmit: true
    },
    window: {
      title: "TENEBRE.Settings.MenuTitle",
      contentClasses: ["standard-form"]
    },
    position: {
      width: 520,
      height: "auto"
    }
  };

  static PARTS = {
    form: {
      template: "modules/symbaroum-ind-resources/templates/settings.hbs"
    }
  };

  async _prepareContext(_options) {
    const settings = TenebreSettings.export();
    const category = this.constructor.settingCategory ?? "rations";
    const extraRationFoods = Object.entries(normalizeExtraRationFoods(settings.extraRationFoods).foods).map(([key, food]) => ({ key, ...food }));
    return {
      settings,
      extraRationFoods,
      extraRationFoodGroups: groupRationFoods(extraRationFoods),
      activeExtraRationFoods: extraRationFoods.filter((food) => food.enabled),
      showRations: category === "rations",
      showRest: category === "rest",
      showAmmo: category === "ammo",
      showEncumbrance: category === "encumbrance",
      showMovement: category === "movement",
      showCombat: category === "combat",
      showChatMessages: category === "chatMessages",
      showUtilities: category === "utilities",
      movementUnitMetersSelected: settings.movementUnitSystem === "meters",
      movementUnitFeetSelected: settings.movementUnitSystem === "feet",
      isGM: game.user.isGM
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const form = this.element;
    syncRationSettingsVisibility(form);
    form?.querySelector?.('input[name="enableRations"]')?.addEventListener("change", () => syncRationSettingsVisibility(form));
    form?.querySelector?.('input[name="enableOtherRations"]')?.addEventListener("change", () => syncRationSettingsVisibility(form));
    syncRestSettingsVisibility(form);
    form?.querySelector?.('input[name="enableRestHealing"]')?.addEventListener("change", () => syncRestSettingsVisibility(form));
    syncAmmoSettingsVisibility(form);
    form?.querySelector?.('input[name="enableAmmoConsumption"]')?.addEventListener("change", () => syncAmmoSettingsVisibility(form));
    form?.querySelector?.('input[name="enableQuiverAmmoContainers"]')?.addEventListener("change", () => syncAmmoSettingsVisibility(form));
    form?.querySelector?.('input[name="enableAmmoRecovery"]')?.addEventListener("change", () => syncAmmoSettingsVisibility(form));
    form?.querySelector?.('input[name="enableAmmoRecoveryByQuality"]')?.addEventListener("change", () => syncAmmoSettingsVisibility(form));
    syncMovementSettingsVisibility(form);
    form?.querySelector?.('input[name="enableMovementRuler"]')?.addEventListener("change", () => syncMovementSettingsVisibility(form));
    syncCombatSettingsVisibility(form);
    form?.querySelector?.('input[name="enableManeuvers"]')?.addEventListener("change", () => syncCombatSettingsVisibility(form));
    form?.querySelector?.('input[name="enableWeaponReadiness"]')?.addEventListener("change", () => syncCombatSettingsVisibility(form));
    syncUtilitiesSettingsVisibility(form);
    form?.querySelector?.('input[name="enableBithirUtilities"]')?.addEventListener("change", () => syncUtilitiesSettingsVisibility(form));
    form?.querySelector?.('input[name="enableGenerateShadow"]')?.addEventListener("change", () => syncUtilitiesSettingsVisibility(form));
    form?.querySelector?.(".tenebre-install-status-effect-macro")?.addEventListener("click", async (event) => {
      event.preventDefault();
      await StatusEffectPickerService.installMacro();
    });
    form?.querySelector?.(".tenebre-ration-food-select")?.addEventListener("change", (event) => {
      addSelectedRationFood(form, event.currentTarget);
    });
    form?.querySelector?.(".tenebre-ration-create-toggle")?.addEventListener("click", (event) => {
      expandRationFoodCreator(form, event.currentTarget);
    });
    form?.querySelector?.(".tenebre-ration-create-button")?.addEventListener("click", async () => {
      await createRationFood(form);
    });
    form?.querySelector?.(".tenebre-ration-bulk-actions")?.addEventListener("click", async (event) => {
      const button = event.target.closest?.("[data-ration-food-action]");
      if (!button) return;
      if (button.dataset.rationFoodAction === "add-all") {
        if (await confirmRationFoodBulkAction("TENEBRE.Settings.OtherRationUseAllConfirmTitle", "TENEBRE.Settings.OtherRationUseAllConfirm")) {
          addAllRationFoods(form);
        }
      } else if (button.dataset.rationFoodAction === "remove-all") {
        if (await confirmRationFoodBulkAction("TENEBRE.Settings.OtherRationRemoveAllConfirmTitle", "TENEBRE.Settings.OtherRationRemoveAllConfirm")) {
          removeAllRationFoods(form);
        }
      }
    });
    form?.querySelector?.(".tenebre-ration-active-foods")?.addEventListener("click", (event) => {
      const button = event.target.closest?.("[data-remove-ration-food]");
      if (!button) return;
      const row = button.closest?.(".tenebre-ration-food");
      const key = row?.dataset?.rationFoodKey;
      row?.remove();
      const option = Array.from(form.querySelectorAll(".tenebre-ration-food-select option")).find((entry) => entry.value === key);
      if (option) option.disabled = false;
      toggleRationEmptyState(form);
    });
  }

  static async #onSubmit(_event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    const submittedFields = new Set(Array.from(form?.elements ?? [])
      .map((element) => element?.name)
      .filter(Boolean));
    const canInspectSubmittedFields = submittedFields.size > 0;

    const booleans = [
      "enableRations",
      "enableOtherRations",
      "enableAmmoConsumption",
      "enableQuiverAmmoContainers",
      "enableHitTracking",
      "enableAmmoRecovery",
      "enableAmmoRecoveryByQuality",
      "showAmmoRecoveryHud",
      "showQuiverHud",
      "enableHunger",
      "enableRestHealing",
      "enableEncumbrance",
      "enableContainers",
      "enableMovementRuler",
      "enableMovementColors",
      "enableMovementLimitLabels",
      "enableMovementBlocking",
      "enableMovementHungerModifier",
      "enableMovementEncumbranceModifier",
      "enableMovementEffectModifiers",
      "enableManeuvers",
      "enableRollPrivacy",
      "enableCompactNpcAttackChat",
      "hideNpcDetailsInChat",
      "enableWeaponReadiness",
      "showWeaponReadinessButton",
      "showWeaponReadinessTokenIndicator",
      "enableWeaponReadinessAnimation",
      "showWeaponReadinessChatMessages",
      "enableChatItemUse",
      "enableAutomatedAnimationsIntegration",
      "enableRestButton",
      "enableClearEffectsButton",
      "showAppliedStatusEffectChatMessages",
      "enableTokenActionHudIntegration",
      "enableBithirUtilities",
      "enableRitualCatalog",
      "enableRitualistGrouping",
      "enableGmLog",
      "enableInventoryCleanup",
      "enableGenerateShadow",
      "hideShadowGeneration",
      "hideShadowLabel"
    ];

    const numbers = [
      "rationUses",
      "restHealing",
      "quiverCapacity",
      "ammoRecoveryFlatTarget",
      "ammoRecoveryCommonTarget",
      "ammoRecoveryQualityTarget",
      "ammoRecoveryMysticalTarget",
      "movementBaseMeters",
      "movementBaseFeet"
    ];

    const strings = ["movementUnitSystem"];

    for (const key of booleans) {
      if (canInspectSubmittedFields ? submittedFields.has(key) : key in data) {
        data[key] = key === "enableCompactNpcAttackChat"
          ? data[key] === true || data[key] === "indResources"
          : Boolean(data[key]);
      }
    }

    for (const key of numbers) {
      if (key in data) {
        data[key] = normalizeSettingNumber(key, data[key]);
      }
    }

    for (const key of strings) {
      if (key in data) {
        data[key] = String(data[key] ?? "");
      }
    }

    if ("movementUnitSystem" in data && !["meters", "feet"].includes(data.movementUnitSystem)) {
      data.movementUnitSystem = "meters";
    }

    if (canInspectSubmittedFields && Array.from(submittedFields).some((key) => key.startsWith("extraRationFoods."))) {
      data.extraRationFoods = normalizeSubmittedExtraRationFoods(data.extraRationFoods, submittedFields);
    } else if ("extraRationFoods" in data) {
      data.extraRationFoods = normalizeExtraRationFoods(data.extraRationFoods);
    }

    for (const [key, value] of Object.entries(data)) {
      if (!game.settings.settings.has(`${MODULE_ID}.${key}`)) continue;
      if (settingsValuesEqual(game.settings.get(MODULE_ID, key), value)) continue;
      await game.settings.set(MODULE_ID, key, value);
    }
  }
}

class TenebreRationsSettingsForm extends TenebreSettingsForm {
  static settingCategory = "rations";
  static DEFAULT_OPTIONS = categoryOptions("symbaroum-ind-resources-settings-rations", "TENEBRE.Settings.TabRationsButton");
}

class TenebreRestSettingsForm extends TenebreSettingsForm {
  static settingCategory = "rest";
  static DEFAULT_OPTIONS = categoryOptions("symbaroum-ind-resources-settings-rest", "TENEBRE.Settings.TabRestButton");
}

class TenebreAmmoSettingsForm extends TenebreSettingsForm {
  static settingCategory = "ammo";
  static DEFAULT_OPTIONS = categoryOptions("symbaroum-ind-resources-settings-ammo", "TENEBRE.Settings.TabAmmoButton");
}

class TenebreEncumbranceSettingsForm extends TenebreSettingsForm {
  static settingCategory = "encumbrance";
  static DEFAULT_OPTIONS = categoryOptions("symbaroum-ind-resources-settings-encumbrance", "TENEBRE.Settings.TabEncumbranceButton");
}

class TenebreMovementSettingsForm extends TenebreSettingsForm {
  static settingCategory = "movement";
  static DEFAULT_OPTIONS = categoryOptions("symbaroum-ind-resources-settings-movement", "TENEBRE.Settings.TabMovementButton");
}

class TenebreCombatSettingsForm extends TenebreSettingsForm {
  static settingCategory = "combat";
  static DEFAULT_OPTIONS = categoryOptions("symbaroum-ind-resources-settings-combat", "TENEBRE.Settings.TabCombatButton");
}

class TenebreChatMessagesSettingsForm extends TenebreSettingsForm {
  static settingCategory = "chatMessages";
  static DEFAULT_OPTIONS = categoryOptions("symbaroum-ind-resources-settings-chat-messages", "TENEBRE.Settings.TabChatMessagesButton");
}

class TenebreUtilitiesSettingsForm extends TenebreSettingsForm {
  static settingCategory = "utilities";
  static DEFAULT_OPTIONS = categoryOptions("symbaroum-ind-resources-settings-utilities", "TENEBRE.Settings.TabUtilitiesButton");
}

function categoryOptions(id, title) {
  return {
    ...TenebreSettingsForm.DEFAULT_OPTIONS,
    id,
    window: {
      ...TenebreSettingsForm.DEFAULT_OPTIONS.window,
      title
    }
  };
}

export class TenebreSettings {
  static register() {
    registerMenu("settingsRationsMenu", "TENEBRE.Settings.TabRations", "TENEBRE.Settings.TabRationsButton", "TENEBRE.Settings.TabRationsHint", "fas fa-bread-slice", TenebreRationsSettingsForm);
    registerMenu("settingsRestMenu", "TENEBRE.Settings.TabRest", "TENEBRE.Settings.TabRestButton", "TENEBRE.Settings.TabRestHint", "fas fa-bed", TenebreRestSettingsForm);
    registerMenu("settingsAmmoMenu", "TENEBRE.Settings.TabAmmo", "TENEBRE.Settings.TabAmmoButton", "TENEBRE.Settings.TabAmmoHint", "fas fa-bullseye", TenebreAmmoSettingsForm);
    registerMenu("settingsEncumbranceMenu", "TENEBRE.Settings.TabEncumbrance", "TENEBRE.Settings.TabEncumbranceButton", "TENEBRE.Settings.TabEncumbranceHint", "fas fa-weight-hanging", TenebreEncumbranceSettingsForm);
    registerMenu("settingsMovementMenu", "TENEBRE.Settings.TabMovement", "TENEBRE.Settings.TabMovementButton", "TENEBRE.Settings.TabMovementHint", "fas fa-ruler", TenebreMovementSettingsForm);
    registerMenu("settingsCombatMenu", "TENEBRE.Settings.TabCombat", "TENEBRE.Settings.TabCombatButton", "TENEBRE.Settings.TabCombatHint", "fas fa-dice-d20", TenebreCombatSettingsForm);
    registerMenu("settingsChatMessagesMenu", "TENEBRE.Settings.TabChatMessages", "TENEBRE.Settings.TabChatMessagesButton", "TENEBRE.Settings.TabChatMessagesHint", "fas fa-comments", TenebreChatMessagesSettingsForm);
    registerMenu("settingsUtilitiesMenu", "TENEBRE.Settings.TabUtilities", "TENEBRE.Settings.TabUtilitiesButton", "TENEBRE.Settings.TabUtilitiesHint", "fas fa-magic", TenebreUtilitiesSettingsForm);

    register("enableRations", Boolean, true, "TENEBRE.Settings.EnableRations", "TENEBRE.Settings.EnableRationsHint");
    register("rationUses", Number, DEFAULTS.rationUses, "TENEBRE.Settings.RationUses", "TENEBRE.Settings.RationUsesHint");
    register("enableOtherRations", Boolean, false, "TENEBRE.Settings.EnableOtherRations", "TENEBRE.Settings.EnableOtherRationsHint");
    register("extraRationFoods", Object, DEFAULTS.extraRationFoods, "TENEBRE.Settings.ExtraRationFoods", "TENEBRE.Settings.ExtraRationFoodsHint");
    register("enableAmmoConsumption", Boolean, true, "TENEBRE.Settings.EnableAmmoConsumption", "TENEBRE.Settings.EnableAmmoConsumptionHint");
    register("enableQuiverAmmoContainers", Boolean, true, "TENEBRE.Settings.EnableQuiverAmmoContainers", "TENEBRE.Settings.EnableQuiverAmmoContainersHint");
    register("quiverCapacity", Number, 12, "TENEBRE.Settings.QuiverCapacity", "TENEBRE.Settings.QuiverCapacityHint");
    register("enableHitTracking", Boolean, true, "TENEBRE.Settings.EnableHitTracking", "TENEBRE.Settings.EnableHitTrackingHint");
    register("enableAmmoRecovery", Boolean, true, "TENEBRE.Settings.EnableAmmoRecovery", "TENEBRE.Settings.EnableAmmoRecoveryHint");
    register("enableAmmoRecoveryByQuality", Boolean, true, "TENEBRE.Settings.EnableAmmoRecoveryByQuality", "TENEBRE.Settings.EnableAmmoRecoveryByQualityHint");
    register("ammoRecoveryFlatTarget", Number, 10, "TENEBRE.Settings.AmmoRecoveryFlatTarget", "TENEBRE.Settings.AmmoRecoveryFlatTargetHint");
    register("ammoRecoveryCommonTarget", Number, 10, "TENEBRE.Settings.AmmoRecoveryCommonTarget", "TENEBRE.Settings.AmmoRecoveryCommonTargetHint");
    register("ammoRecoveryQualityTarget", Number, 15, "TENEBRE.Settings.AmmoRecoveryQualityTarget", "TENEBRE.Settings.AmmoRecoveryQualityTargetHint");
    register("ammoRecoveryMysticalTarget", Number, 17, "TENEBRE.Settings.AmmoRecoveryMysticalTarget", "TENEBRE.Settings.AmmoRecoveryMysticalTargetHint");
    register("showAmmoRecoveryHud", Boolean, true, "TENEBRE.Settings.ShowAmmoRecoveryHud", "TENEBRE.Settings.ShowAmmoRecoveryHudHint");
    register("showQuiverHud", Boolean, true, "TENEBRE.Settings.ShowQuiverHud", "TENEBRE.Settings.ShowQuiverHudHint");
    register("enableHunger", Boolean, true, "TENEBRE.Settings.EnableHunger", "TENEBRE.Settings.EnableHungerHint");
    register("enableRestHealing", Boolean, true, "TENEBRE.Settings.EnableRestHealing", "TENEBRE.Settings.EnableRestHealingHint");
    register("restHealing", Number, DEFAULTS.restHealing, "TENEBRE.Settings.RestHealing", "TENEBRE.Settings.RestHealingHint");
    register("enableRestButton", Boolean, true, "TENEBRE.Settings.EnableRestButton", "TENEBRE.Settings.EnableRestButtonHint");

    register("enableEncumbrance", Boolean, true, "TENEBRE.Settings.EnableEncumbrance", "TENEBRE.Settings.EnableEncumbranceHint");
    register("enableContainers", Boolean, true, "TENEBRE.Settings.EnableContainers", "TENEBRE.Settings.EnableContainersHint");
    register("containerExpansionState", Object, {}, "TENEBRE.Settings.ContainerExpansionState", "TENEBRE.Settings.ContainerExpansionStateHint", {
      scope: "client",
      skipNotify: true
    });
    register("enableMovementRuler", Boolean, true, "TENEBRE.Settings.EnableMovementRuler", "TENEBRE.Settings.EnableMovementRulerHint");
    register("enableMovementColors", Boolean, DEFAULTS.enableMovementColors, "TENEBRE.Settings.EnableMovementColors", "TENEBRE.Settings.EnableMovementColorsHint");
    register("enableMovementLimitLabels", Boolean, DEFAULTS.enableMovementLimitLabels, "TENEBRE.Settings.EnableMovementLimitLabels", "TENEBRE.Settings.EnableMovementLimitLabelsHint");
    register("enableMovementBlocking", Boolean, DEFAULTS.enableMovementBlocking, "TENEBRE.Settings.EnableMovementBlocking", "TENEBRE.Settings.EnableMovementBlockingHint");
    register("enableMovementHungerModifier", Boolean, DEFAULTS.enableMovementHungerModifier, "TENEBRE.Settings.EnableMovementHungerModifier", "TENEBRE.Settings.EnableMovementHungerModifierHint");
    register("enableMovementEncumbranceModifier", Boolean, DEFAULTS.enableMovementEncumbranceModifier, "TENEBRE.Settings.EnableMovementEncumbranceModifier", "TENEBRE.Settings.EnableMovementEncumbranceModifierHint");
    register("enableMovementEffectModifiers", Boolean, DEFAULTS.enableMovementEffectModifiers, "TENEBRE.Settings.EnableMovementEffectModifiers", "TENEBRE.Settings.EnableMovementEffectModifiersHint");
    register("movementUnitSystem", String, DEFAULTS.movementUnitSystem, "TENEBRE.Settings.MovementUnitSystem", "TENEBRE.Settings.MovementUnitSystemHint", {
      choices: {
        meters: "TENEBRE.Settings.MovementUnitMeters",
        feet: "TENEBRE.Settings.MovementUnitFeet"
      }
    });
    register("movementBaseMeters", Number, DEFAULTS.movementBaseMeters, "TENEBRE.Settings.MovementBaseMeters", "TENEBRE.Settings.MovementBaseMetersHint");
    register("movementBaseFeet", Number, DEFAULTS.movementBaseFeet, "TENEBRE.Settings.MovementBaseFeet", "TENEBRE.Settings.MovementBaseFeetHint");

    register("enableManeuvers", Boolean, true, "TENEBRE.Settings.EnableManeuvers", "TENEBRE.Settings.EnableManeuversHint");
    register("enableRollPrivacy", Boolean, true, "TENEBRE.Settings.EnableRollPrivacy", "TENEBRE.Settings.EnableRollPrivacyHint");
    register("enableCompactNpcAttackChat", Boolean, true, "TENEBRE.Settings.ChatMessageStyle", "TENEBRE.Settings.ChatMessageStyleHint");
    register("hideNpcDetailsInChat", Boolean, false, "TENEBRE.Settings.HideNpcDetailsInChat", "TENEBRE.Settings.HideNpcDetailsInChatHint");
    register("enableWeaponReadiness", Boolean, true, "TENEBRE.Settings.EnableWeaponReadiness", "TENEBRE.Settings.EnableWeaponReadinessHint");
    register("showWeaponReadinessButton", Boolean, true, "TENEBRE.Settings.ShowWeaponReadinessButton", "TENEBRE.Settings.ShowWeaponReadinessButtonHint");
    register("showWeaponReadinessTokenIndicator", Boolean, true, "TENEBRE.Settings.ShowWeaponReadinessTokenIndicator", "TENEBRE.Settings.ShowWeaponReadinessTokenIndicatorHint");
    register("enableWeaponReadinessAnimation", Boolean, true, "TENEBRE.Settings.EnableWeaponReadinessAnimation", "TENEBRE.Settings.EnableWeaponReadinessAnimationHint");
    register("showWeaponReadinessChatMessages", Boolean, false, "TENEBRE.Settings.ShowWeaponReadinessChatMessages", "TENEBRE.Settings.ShowWeaponReadinessChatMessagesHint");
    register("weaponReadinessButtonPosition", Object, {}, "TENEBRE.Settings.WeaponReadinessButtonPosition", "TENEBRE.Settings.WeaponReadinessButtonPositionHint", { scope: "client" });
    register("gmLogWindowPosition", Object, {}, "TENEBRE.Settings.GmLogWindowPosition", "TENEBRE.Settings.GmLogWindowPositionHint", { scope: "client" });
    register("enableChatItemUse", Boolean, true, "TENEBRE.Settings.EnableChatItemUse", "TENEBRE.Settings.EnableChatItemUseHint");
    register("enableAutomatedAnimationsIntegration", Boolean, true, "TENEBRE.Settings.EnableAutomatedAnimationsIntegration", "TENEBRE.Settings.EnableAutomatedAnimationsIntegrationHint");
    register("enableClearEffectsButton", Boolean, true, "TENEBRE.Settings.EnableClearEffectsButton", "TENEBRE.Settings.EnableClearEffectsButtonHint");
    register("showAppliedStatusEffectChatMessages", Boolean, true, "TENEBRE.Settings.ShowAppliedStatusEffectChatMessages", "TENEBRE.Settings.ShowAppliedStatusEffectChatMessagesHint");
    register("enableTokenActionHudIntegration", Boolean, true, "TENEBRE.Settings.EnableTokenActionHudIntegration", "TENEBRE.Settings.EnableTokenActionHudIntegrationHint");
    register("enableBithirUtilities", Boolean, true, "TENEBRE.Settings.EnableBithirUtilities", "TENEBRE.Settings.EnableBithirUtilitiesHint");
    register("enableRitualCatalog", Boolean, true, "TENEBRE.Settings.EnableRitualCatalog", "TENEBRE.Settings.EnableRitualCatalogHint");
    register("enableRitualistGrouping", Boolean, true, "TENEBRE.Settings.EnableRitualistGrouping", "TENEBRE.Settings.EnableRitualistGroupingHint");
    register("enableGmLog", Boolean, true, "TENEBRE.Settings.EnableGmLog", "TENEBRE.Settings.EnableGmLogHint");
    register("enableInventoryCleanup", Boolean, true, "TENEBRE.Settings.EnableInventoryCleanup", "TENEBRE.Settings.EnableInventoryCleanupHint");
    register("enableGenerateShadow", Boolean, true, "TENEBRE.Settings.EnableGenerateShadow", "TENEBRE.Settings.EnableGenerateShadowHint");
    register("hideShadowGeneration", Boolean, false, "BITHIRMOD.SHADOW_hideGeneration", "BITHIRMOD.SHADOW_hideGeneration_hint");
    register("hideShadowLabel", Boolean, false, "BITHIRMOD.SHADOW_hideLabel", "BITHIRMOD.SHADOW_hideLabel_hint");
    register("hideCompatibilityNotice", Boolean, false, "TENEBRE.Settings.HideCompatibilityNotice", "TENEBRE.Settings.HideCompatibilityNoticeHint", { scope: "client" });
    register("compatibilityNoticeAcknowledged", Object, { version: 1, signatures: [] }, "TENEBRE.Settings.CompatibilityNoticeAcknowledged", "TENEBRE.Settings.CompatibilityNoticeAcknowledgedHint", { scope: "client" });
    register("encumbranceDiscoveredWeights", Object, { version: 2, items: {}, bundles: {} }, "TENEBRE.Settings.EncumbranceDiscoveredWeights", "TENEBRE.Settings.EncumbranceDiscoveredWeightsHint");
  }

  static get(key) {
    return game.settings.get(MODULE_ID, key);
  }

  static export() {
    return Object.fromEntries([...game.settings.settings.keys()]
      .filter((key) => key.startsWith(`${MODULE_ID}.`))
      .map((key) => {
        const settingKey = key.slice(MODULE_ID.length + 1);
        return [settingKey, game.settings.get(MODULE_ID, settingKey)];
      }));
  }
}

function registerMenu(key, name, label, hint, icon, type) {
  game.settings.registerMenu(MODULE_ID, key, {
    name,
    label,
    hint,
    icon,
    type,
    restricted: true
  });
}

function register(key, type, defaultValue, name, hint, extra = {}) {
  if (game.settings.settings.has(`${MODULE_ID}.${key}`)) return;

  const { skipNotify = false, ...settingOptions } = extra;

  game.settings.register(MODULE_ID, key, {
    name,
    hint,
    scope: "world",
    config: false,
    default: defaultValue,
    type,
    ...settingOptions,
    ...(skipNotify ? {} : { onChange: (value) => onSettingChanged(key, value) })
  });
}

function onSettingChanged(key, value) {
  Hooks.callAll(MODULE_ID + ".settingsChanged", key, value);
  const requiresForcedSheetRender = [
    "enableRations",
    "rationUses",
    "enableOtherRations",
    "extraRationFoods",
    "enableHunger",
    "enableRestButton",
    "enableClearEffectsButton",
    "enableAmmoConsumption",
    "enableQuiverAmmoContainers",
    "quiverCapacity",
    "enableHitTracking",
    "enableAmmoRecovery",
    "showAmmoRecoveryHud",
    "showQuiverHud",
    "enableEncumbrance",
    "enableContainers",
    "encumbranceDiscoveredWeights",
    "enableManeuvers",
    "enableWeaponReadiness",
    "enableRitualistGrouping",
    "enableChatItemUse",
    "enableBithirUtilities",
    "enableGenerateShadow",
    "hideShadowGeneration",
    "hideShadowLabel"
  ].includes(key);

  if (key === "enableHunger") {
    if (value) game.tenebreResources?.hunger?.registerStatusEffect?.();
    else game.tenebreResources?.hunger?.unregisterStatusEffect?.();
  }

  if (key === "enableEncumbrance") {
    refreshEncumbranceActors({ autoAssign: Boolean(value), clearPenalty: !value });
    if (value) game.tenebreResources?.encumbrance?.startDynamicWeightFileWatcher?.();
    else game.tenebreResources?.encumbrance?.stopDynamicWeightFileWatcher?.();
  }

  if (key === "encumbranceDiscoveredWeights") {
    game.tenebreResources?.encumbrance?.applyDynamicWeightConfig?.(value);
    refreshEncumbranceActors({ autoAssign: false });
  }

  if (key === "enableContainers" && isPrimaryActiveGm()) {
    synchronizeContainerStates(Boolean(value));
  }

  if (key === "enableInventoryCleanup" && value && game.user?.isGM) {
    void game.tenebreResources?.inventoryCleanup?.cleanupExisting?.();
  }

  if (key === "enableMovementRuler" && value) {
    game.tenebreResources?.movement?.register?.();
  }

  if (key === "enableBithirUtilities" || key === "enableGenerateShadow" || key === "hideShadowGeneration" || key === "hideShadowLabel") {
    game.tenebreResources?.bithir?.refreshOpenActorSheets?.();
  }

  if (key === "enableTokenActionHudIntegration" || key === "enableManeuvers") {
    refreshTokenActionHud();
  }

  game.tenebreResources?.hotbar?.refresh?.();
  if (requiresForcedSheetRender) scheduleOpenSheetRerender({ force: true });
}

function refreshEncumbranceActors({ autoAssign = false, clearPenalty = false } = {}) {
  for (const actor of game.actors ?? []) {
    if (actor.type !== "player" || !(actor.isOwner || game.user?.isGM)) continue;
    if (autoAssign) {
      void Promise.resolve(game.tenebreResources?.encumbrance?.autoAssignAll?.(actor))
        .catch((error) => console.warn(`${MODULE_ID} | Could not refresh encumbrance for ${actor.name}.`, error));
    }
    actor.prepareData?.();
    if (clearPenalty) EncumbranceService.clearDefensePenalty(actor);
  }
}

function synchronizeContainerStates(enabled) {
  for (const actor of game.actors ?? []) {
    if (actor.type !== "player") continue;
    Promise.resolve(game.tenebreResources?.containers?.recoverOrphanedStoredItems?.(actor))
      .then(() => game.tenebreResources?.containers?.synchronizeActorStates?.(actor, enabled))
      .catch((error) => console.warn(`${MODULE_ID} | Could not synchronize container states for ${actor.name}.`, error));
  }
}

function isPrimaryActiveGm() {
  if (!game.user?.isGM) return false;
  const activeGms = [...(game.users ?? [])].filter((user) => user.active && user.isGM);
  return !activeGms.length || activeGms[0]?.id === game.user.id;
}

function syncAmmoSettingsVisibility(form) {
  if (!form?.querySelector?.('input[name="enableAmmoConsumption"]')) return;

  const ammoEnabled = Boolean(form.querySelector('input[name="enableAmmoConsumption"]')?.checked);
  const quiverEnabled = ammoEnabled && Boolean(form.querySelector('input[name="enableQuiverAmmoContainers"]')?.checked);
  const recoveryEnabled = Boolean(form.querySelector('input[name="enableAmmoRecovery"]')?.checked);
  const recoveryByQuality = recoveryEnabled && Boolean(form.querySelector('input[name="enableAmmoRecoveryByQuality"]')?.checked);

  setHidden(form.querySelectorAll("[data-ammo-quiver-field]"), !quiverEnabled);
  setHidden(form.querySelectorAll("[data-ammo-recovery-field]"), !recoveryEnabled);
  setHidden(form.querySelectorAll("[data-ammo-recovery-flat]"), !recoveryEnabled || recoveryByQuality);
  setHidden(form.querySelectorAll("[data-ammo-recovery-quality]"), !recoveryByQuality);
}

function syncRationSettingsVisibility(form) {
  if (!form?.querySelector?.('input[name="enableRations"]')) return;
  const enabled = Boolean(form.querySelector('input[name="enableRations"]')?.checked);
  const otherRationsEnabled = enabled && Boolean(form.querySelector('input[name="enableOtherRations"]')?.checked);

  setHidden(form.querySelectorAll("[data-rations-dependent]"), !enabled);
  setHidden(form.querySelectorAll("[data-rations-foods]"), !otherRationsEnabled);
}

function syncRestSettingsVisibility(form) {
  if (!form?.querySelector?.('input[name="enableRestHealing"]')) return;
  const enabled = Boolean(form.querySelector('input[name="enableRestHealing"]')?.checked);
  setHidden(form.querySelectorAll("[data-rest-healing-field]"), !enabled);
}

function syncMovementSettingsVisibility(form) {
  if (!form?.querySelector?.('input[name="enableMovementRuler"]')) return;
  const enabled = Boolean(form.querySelector('input[name="enableMovementRuler"]')?.checked);
  setHidden(form.querySelectorAll("[data-movement-dependent]"), !enabled);
}

function syncCombatSettingsVisibility(form) {
  if (!form?.querySelector?.('input[name="enableManeuvers"]')) return;
  const maneuversEnabled = Boolean(form.querySelector('input[name="enableManeuvers"]')?.checked);
  const weaponReadinessEnabled = Boolean(form.querySelector('input[name="enableWeaponReadiness"]')?.checked);

  setHidden(form.querySelectorAll("[data-combat-maneuvers-dependent]"), !maneuversEnabled);
  setHidden(form.querySelectorAll("[data-combat-weapon-readiness-dependent]"), !weaponReadinessEnabled);
}

function syncUtilitiesSettingsVisibility(form) {
  if (!form?.querySelector?.('input[name="enableBithirUtilities"]')) return;
  const utilitiesEnabled = Boolean(form.querySelector('input[name="enableBithirUtilities"]')?.checked);
  const shadowEnabled = utilitiesEnabled && Boolean(form.querySelector('input[name="enableGenerateShadow"]')?.checked);

  setHidden(form.querySelectorAll("[data-utilities-dependent]"), !utilitiesEnabled);
  setHidden(form.querySelectorAll("[data-utilities-shadow-dependent]"), !shadowEnabled);
}

function setHidden(elements, hidden) {
  for (const element of elements ?? []) {
    element.hidden = hidden;
  }
}

function normalizeSettingNumber(key, value) {
  const constraints = {
    rationUses: { min: 1 },
    restHealing: { min: 0 },
    quiverCapacity: { min: 1 },
    ammoRecoveryFlatTarget: { min: 1, max: 20 },
    ammoRecoveryCommonTarget: { min: 1, max: 20 },
    ammoRecoveryQualityTarget: { min: 1, max: 20 },
    ammoRecoveryMysticalTarget: { min: 1, max: 20 },
    movementBaseMeters: { min: 0 },
    movementBaseFeet: { min: 0 }
  };
  const constraint = constraints[key] ?? {};
  let number = Number(value);
  if (!Number.isFinite(number)) number = Number(DEFAULTS[key]) || constraint.min || 0;
  if (Number.isFinite(constraint.min)) number = Math.max(constraint.min, number);
  if (Number.isFinite(constraint.max)) number = Math.min(constraint.max, number);
  return number;
}

function settingsValuesEqual(current, next) {
  if (Object.is(current, next)) return true;
  if (!current || !next || typeof current !== "object" || typeof next !== "object") return false;
  return JSON.stringify(current) === JSON.stringify(next);
}

function normalizeSubmittedExtraRationFoods(value, submittedFields) {
  const normalized = normalizeExtraRationFoods(value);
  for (const key of Object.keys(normalized.foods)) {
    normalized.foods[key].enabled = submittedFields.has(`extraRationFoods.foods.${key}.enabled`);
  }
  return normalized;
}

function normalizeExtraRationFoods(value) {
  const source = value && typeof value === "object" ? value : {};
  const sourceFoods = source.foods && typeof source.foods === "object" ? source.foods : {};
  const foods = {};
  for (const [key, defaultFood] of Object.entries(DEFAULTS.extraRationFoods.foods)) {
    foods[key] = normalizeRationFood(defaultFood, sourceFoods[key]);
  }
  for (const [key, customFood] of Object.entries(sourceFoods)) {
    if (foods[key]) continue;
    if (!customFood?.custom) continue;
    if (!customRationFoodExists(customFood)) continue;
    const normalized = normalizeRationFood({
      name: customFood?.name,
      aliases: [],
      category: "Custom",
      uses: 1,
      enabled: false,
      custom: true
    }, customFood);
    if (normalized.name) foods[key] = normalized;
  }
  return {
    version: DEFAULTS.extraRationFoods.version,
    foods
  };
}

function normalizeRationFood(defaultFood, sourceFood) {
  const customFood = sourceFood && typeof sourceFood === "object" ? sourceFood : {};
  const name = String(customFood.name ?? defaultFood.name ?? "").trim();
  return {
    ...defaultFood,
    ...customFood,
    name,
    aliases: Array.isArray(customFood.aliases) ? customFood.aliases : (Array.isArray(defaultFood.aliases) ? defaultFood.aliases : []),
    category: String(customFood.category ?? defaultFood.category ?? "Custom").trim() || "Custom",
    itemId: String(customFood.itemId ?? defaultFood.itemId ?? "").trim(),
    uses: Math.max(1, Number(customFood.uses ?? defaultFood.uses) || 1),
    enabled: Boolean(customFood.enabled ?? defaultFood.enabled),
    custom: Boolean(customFood.custom ?? defaultFood.custom)
  };
}

function groupRationFoods(foods) {
  const grouped = new Map();
  for (const food of foods) {
    const category = localizeRationCategory(food.category);
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(food);
  }
  return Array.from(grouped.entries()).map(([category, items]) => ({ category, items }));
}

function localizeRationCategory(category) {
  const categories = {
    "Básico": "TENEBRE.Settings.RationCategoryBasic",
    Bebidas: "TENEBRE.Settings.RationCategoryDrinks",
    Carne: "TENEBRE.Settings.RationCategoryMeat",
    Chás: "TENEBRE.Settings.RationCategoryTeas",
    Ensopados: "TENEBRE.Settings.RationCategoryStews",
    Mingau: "TENEBRE.Settings.RationCategoryPorridge",
    Peixe: "TENEBRE.Settings.RationCategoryFish",
    Sobremesas: "TENEBRE.Settings.RationCategoryDesserts",
    Sopas: "TENEBRE.Settings.RationCategorySoups",
    Tortas: "TENEBRE.Settings.RationCategoryPies"
  };
  const key = categories[category] ?? "TENEBRE.Settings.OtherRationsUncategorized";
  return game.i18n.localize(key);
}

function addSelectedRationFood(form, select) {
  const option = select?.selectedOptions?.[0];
  const key = option?.value;
  if (!key) {
    if (select) select.value = "";
    return;
  }

  addRationFoodRow(form, {
    key,
    name: option.dataset.name || option.textContent?.trim() || key,
    uses: Math.max(1, Number(option.dataset.uses) || 1),
    category: option.dataset.category || "Custom"
  });
  option.disabled = true;
  select.value = "";
  toggleRationEmptyState(form);
}

function addAllRationFoods(form) {
  for (const option of form.querySelectorAll(".tenebre-ration-food-select option[value]")) {
    if (!option.value || option.disabled) continue;
    addRationFoodRow(form, {
      key: option.value,
      name: option.dataset.name || option.textContent?.trim() || option.value,
      uses: Math.max(1, Number(option.dataset.uses) || 1),
      category: option.dataset.category || "Custom"
    });
    option.disabled = true;
  }
  const select = form.querySelector(".tenebre-ration-food-select");
  if (select) select.value = "";
  toggleRationEmptyState(form);
}

function removeAllRationFoods(form) {
  for (const row of form.querySelectorAll(".tenebre-ration-food[data-ration-food-key]")) {
    row.remove();
  }
  for (const option of form.querySelectorAll(".tenebre-ration-food-select option")) {
    option.disabled = false;
  }
  const select = form.querySelector(".tenebre-ration-food-select");
  if (select) select.value = "";
  toggleRationEmptyState(form);
}

function addRationFoodRow(form, { key, name, uses, category = "Custom", custom = false, itemId = "" }) {
  const alreadyActive = Array.from(form.querySelectorAll(".tenebre-ration-food[data-ration-food-key]")).some((row) => row.dataset.rationFoodKey === key);
  if (!key || alreadyActive) return;

  const list = form.querySelector(".tenebre-ration-active-foods");
  if (!list) return;

  const row = document.createElement("div");
  row.className = "tenebre-ration-food";
  row.dataset.rationFoodKey = key;
  const safeUses = Math.max(1, Number(uses) || 1);
  row.innerHTML = `
    <input type="hidden" name="extraRationFoods.foods.${escapeAttribute(key)}.enabled" value="true">
    <input type="hidden" name="extraRationFoods.foods.${escapeAttribute(key)}.name" value="${escapeAttribute(name)}">
    <input type="hidden" name="extraRationFoods.foods.${escapeAttribute(key)}.category" value="${escapeAttribute(category)}">
    ${itemId ? `<input type="hidden" name="extraRationFoods.foods.${escapeAttribute(key)}.itemId" value="${escapeAttribute(itemId)}">` : ""}
    ${custom ? `<input type="hidden" name="extraRationFoods.foods.${escapeAttribute(key)}.custom" value="true">` : ""}
    <span class="tenebre-ration-food-name">${escapeHtml(name)}</span>
    <label class="tenebre-ration-food-uses">
      <span>${escapeHtml(game.i18n.localize("TENEBRE.Settings.OtherRationUses"))}</span>
      <input type="number" name="extraRationFoods.foods.${escapeAttribute(key)}.uses" value="${safeUses}" min="1">
    </label>
    <button type="button" class="tenebre-ration-food-remove" data-remove-ration-food="${escapeAttribute(key)}">
      <i class="fas fa-times"></i>
    </button>
  `;

  list.querySelector(".tenebre-ration-empty")?.before(row);
}

function expandRationFoodCreator(form, button) {
  const container = button?.closest?.(".tenebre-ration-create");
  const fields = container?.querySelector?.(".tenebre-ration-create-fields");
  if (!container || !fields) return;
  container.dataset.rationCreateCollapsed = "false";
  fields.hidden = false;
  button.hidden = true;
  form?.querySelector?.(".tenebre-ration-create-name")?.focus?.();
}

async function createRationFood(form) {
  const nameInput = form?.querySelector?.(".tenebre-ration-create-name");
  const usesInput = form?.querySelector?.(".tenebre-ration-create-uses");
  const name = String(nameInput?.value ?? "").trim();
  if (!name) {
    ui.notifications.warn(game.i18n.localize("TENEBRE.Settings.OtherRationCreateMissingName"));
    return;
  }

  const normalizedName = normalizeText(name);
  const existingConfigured = Array.from(form.querySelectorAll(".tenebre-ration-food-name, .tenebre-ration-food-select option"))
    .some((entry) => normalizeText(entry.dataset?.name || entry.textContent) === normalizedName);
  const existingWorldItem = game.items?.some?.((item) => normalizeText(item.name) === normalizedName);
  if (existingConfigured || existingWorldItem) {
    ui.notifications.warn(game.i18n.localize("TENEBRE.Settings.OtherRationCreateDuplicate"));
    return;
  }

  const uses = Math.max(1, Number(usesInput?.value) || 1);
  const folder = await getOrCreateRationFoodFolder();
  const item = await Item.create({
    name,
    type: "equipment",
    folder: folder?.id,
    system: {
      description: "",
      cost: "",
      number: 1,
      weight: 0,
      state: "other"
    }
  }, { renderSheet: false });

  addRationFoodRow(form, {
    key: makeCustomRationKey(item?.id || name),
    name,
    uses,
    category: "Custom",
    custom: true,
    itemId: item?.id || ""
  });

  if (nameInput) nameInput.value = "";
  if (usesInput) usesInput.value = "1";
  toggleRationEmptyState(form);
  ui.notifications.info(game.i18n.format("TENEBRE.Settings.OtherRationCreateSuccess", { name }));
}

async function getOrCreateRationFoodFolder() {
  const folderName = "Alimentos";
  const existing = game.folders?.find?.((folder) => folder.type === "Item" && folder.name === folderName);
  if (existing) return existing;
  return Folder.create({
    name: folderName,
    type: "Item",
    sorting: "a"
  });
}

function makeCustomRationKey(value) {
  const base = normalizeText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `custom_${base || foundry.utils.randomID(8)}`;
}

function customRationFoodExists(food) {
  const itemId = String(food?.itemId ?? "").trim();
  if (itemId && game.items?.get?.(itemId)) return true;
  const name = normalizeText(food?.name);
  if (!name) return false;
  return Boolean(game.items?.some?.((item) => normalizeText(item.name) === name));
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function confirmRationFoodBulkAction(titleKey, contentKey) {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2) return window.confirm(game.i18n.localize(contentKey));
  const result = await DialogV2.prompt({
    window: { title: game.i18n.localize(titleKey) },
    content: `<p>${escapeHtml(game.i18n.localize(contentKey))}</p>`,
    buttons: [{
      action: "cancel",
      icon: "fas fa-times",
      label: game.i18n.localize("TENEBRE.Common.Cancel"),
      callback: () => false
    }],
    ok: {
      icon: "fas fa-check",
      label: game.i18n.localize("TENEBRE.Common.Confirm"),
      callback: () => true
    },
    rejectClose: false
  });
  return Boolean(result);
}

function toggleRationEmptyState(form) {
  const empty = form.querySelector(".tenebre-ration-empty");
  if (!empty) return;
  empty.hidden = Boolean(form.querySelector(".tenebre-ration-food[data-ration-food-key]"));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function refreshTokenActionHud() {
  Hooks.callAll(`${MODULE_ID}.refreshTokenActionHud`);
  Hooks.callAll("forceUpdateTokenActionHud", { moduleId: MODULE_ID });

  const hud = globalThis.game?.tokenActionHud;
  if (typeof hud?.update === "function") {
    Promise.resolve(hud.update({ type: "hook", name: `${MODULE_ID}.settingsChanged` }))
      .catch((error) => console.warn(`${MODULE_ID} | Token Action HUD refresh failed.`, error));
  }
}

function rerenderOpenSheets({ force = false } = {}) {
  const openSheets = new Set(Object.values(ui.windows ?? {}));
  const instances = foundry.applications?.instances;
  if (instances && typeof instances[Symbol.iterator] === "function") {
    for (const app of instances) openSheets.add(app);
  }

  const ApplicationV2 = foundry.applications?.api?.ApplicationV2;
  for (const app of openSheets) {
    const isDocumentSheet = app?.actor || app?.item
      || app?.document?.documentName === "Actor"
      || app?.document?.documentName === "Item";
    if (!isDocumentSheet || typeof app?.render !== "function") continue;
    if (ApplicationV2 && app instanceof ApplicationV2) app.render({ force });
    else app.render(force);
  }
}

function scheduleOpenSheetRerender({ force = false } = {}) {
  if (pendingSheetRerender !== null) window.clearTimeout(pendingSheetRerender);
  pendingSheetRerender = window.setTimeout(() => {
    pendingSheetRerender = null;
    rerenderOpenSheets({ force });
  }, 50);
}
