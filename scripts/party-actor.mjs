import { MODULE_ID } from "./constants.mjs";

/**
 * DataModel para o tipo de ator "party" (Ficha de Grupo).
 */
export class PartyDataModel extends (globalThis.foundry?.abstract?.TypeDataModel ?? class {}) {
  static defineSchema() {
    const fields = globalThis.foundry?.data?.fields;
    if (!fields) return {};
    const schema = {
      motto: fields.StringField ? new fields.StringField({ initial: "" }) : "",
      description: fields.HTMLField ? new fields.HTMLField({ initial: "" }) : "",
      members: fields.ArrayField && fields.StringField ? new fields.ArrayField(new fields.StringField(), { initial: [] }) : []
    };
    if (fields.BooleanField) {
      schema.isParty = new fields.BooleanField({ initial: true });
    }
    return schema;
  }
}

/**
 * Document class para o ator de Grupo.
 * Herda da classe de Ator do sistema (SymbaroumActor) se disponível, ou Actor nativo.
 */
const BaseActorClass = globalThis.CONFIG?.Actor?.documentClass ?? globalThis.Actor ?? class {};

export class PartyActor extends BaseActorClass {
  prepareBaseData() {
    // Ficha de grupo não inicializa armaduras ou cálculos individuais de combate
  }

  prepareDerivedData() {
    if (this.system) {
      this.system.isParty = true;
    }
  }
}

/**
 * Ficha do Ator de Grupo (Sheet).
 * Usa o layout visual e estilos padrão do Symbaroum.
 */
const BaseActorSheet = globalThis.foundry?.appv1?.sheets?.ActorSheet ?? globalThis.ActorSheet ?? class {};

export class PartyActorSheet extends BaseActorSheet {
  static get defaultOptions() {
    const superOptions = super.defaultOptions ?? {};
    return globalThis.foundry?.utils?.mergeObject(superOptions, {
      classes: ["symbaroum", "sheet", "actor", "player", "party", "tenebre-party-sheet"],
      template: `modules/${MODULE_ID}/templates/party-sheet.hbs`,
      width: 720,
      height: 580,
      resizable: true
    }) ?? {
      classes: ["symbaroum", "sheet", "actor", "player", "party", "tenebre-party-sheet"],
      template: `modules/${MODULE_ID}/templates/party-sheet.hbs`,
      width: 720,
      height: 580,
      resizable: true
    };
  }

  async getData(options) {
    const data = await super.getData?.(options) ?? {};
    data.actor = this.actor;
    data.system = this.actor.system;
    data.cssClass = this.isEditable ? "editable" : "locked";
    data.editable = this.isEditable;
    return data;
  }
}

/**
 * Serviço responsável por registrar o tipo de ator "party" e sua ficha no Foundry VTT.
 */
export class PartyActorService {
  /**
   * Patcheia o getter static TYPES nas classes de Ator para garantir que
   * Actor.createDialog liste "party".
   */
  static _patchActorTypes() {
    const actorClasses = [
      globalThis.CONFIG?.Actor?.documentClass,
      globalThis.Actor
    ].filter(Boolean);

    for (const cls of actorClasses) {
      try {
        if (cls._tenebrePartyTypesPatched) continue;
        const origDesc = Object.getOwnPropertyDescriptor(cls, "TYPES")
          || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(cls), "TYPES");

        Object.defineProperty(cls, "TYPES", {
          get() {
            const list = origDesc ? origDesc.get.call(this) : (Object.keys(globalThis.game?.model?.Actor ?? {}));
            const safeList = Array.isArray(list) ? [...list] : [];
            if (!safeList.includes("party")) safeList.push("party");
            return safeList;
          },
          configurable: true,
          enumerable: true
        });
        cls._tenebrePartyTypesPatched = true;
      } catch (err) {
        console.warn("Symbaroum Ind Resources | Erro ao definir TYPES em Actor:", err);
      }
    }
  }

  /**
   * Configura DataModels e TypeLabels no CONFIG.Actor.
   */
  static _setupConfig() {
    if (!globalThis.CONFIG?.Actor) return;

    // 1. DataModels
    globalThis.CONFIG.Actor.dataModels = globalThis.CONFIG.Actor.dataModels ?? {};
    if (globalThis.foundry?.abstract?.TypeDataModel) {
      globalThis.CONFIG.Actor.dataModels.party = PartyDataModel;
      globalThis.CONFIG.Actor.dataModels[`${MODULE_ID}.party`] = PartyDataModel;
    }

    // 2. DocumentClass específico caso o core utilize documentClasses
    globalThis.CONFIG.Actor.documentClasses = globalThis.CONFIG.Actor.documentClasses ?? {};
    globalThis.CONFIG.Actor.documentClasses.party = PartyActor;
    globalThis.CONFIG.Actor.documentClasses[`${MODULE_ID}.party`] = PartyActor;

    // 3. TypeLabels para exibição correta no dropdown
    globalThis.CONFIG.Actor.typeLabels = globalThis.CONFIG.Actor.typeLabels ?? {};
    globalThis.CONFIG.Actor.typeLabels.party = "TENEBRE.Party.TypeLabel";
    globalThis.CONFIG.Actor.typeLabels[`${MODULE_ID}.party`] = "TENEBRE.Party.TypeLabel";
  }

  /**
   * Patcheia game.documentTypes e game.system.documentTypes de forma não destrutiva.
   */
  static _patchGameDocumentTypes() {
    try {
      if (globalThis.game?.documentTypes?.Actor && !globalThis.game.documentTypes.Actor.includes("party")) {
        const nextTypes = Object.freeze([...globalThis.game.documentTypes.Actor, "party"]);
        const nextObj = Object.freeze({ ...globalThis.game.documentTypes, Actor: nextTypes });
        Object.defineProperty(globalThis.game, "documentTypes", {
          get() { return nextObj; },
          configurable: true
        });
      }
    } catch {
      // Ignorar se o getter não puder ser redefinido
    }

    try {
      if (globalThis.game?.system?.documentTypes?.Actor && !globalThis.game.system.documentTypes.Actor.includes("party")) {
        const nextTypes = Object.freeze([...globalThis.game.system.documentTypes.Actor, "party"]);
        const nextObj = Object.freeze({ ...globalThis.game.system.documentTypes, Actor: nextTypes });
        Object.defineProperty(globalThis.game.system, "documentTypes", {
          get() { return nextObj; },
          configurable: true
        });
      }
    } catch {
      // Ignorar se o getter não puder ser redefinido
    }

    try {
      if (globalThis.game?.model?.Actor && !globalThis.game.model.Actor.party) {
        const nextActor = Object.freeze({ ...globalThis.game.model.Actor, party: {} });
        const nextModel = Object.freeze({ ...globalThis.game.model, Actor: nextActor });
        Object.defineProperty(globalThis.game, "model", {
          get() { return nextModel; },
          configurable: true
        });
      }
    } catch {
      // Ignorar se o getter não puder ser redefinido
    }
  }

  /**
   * Registra a ficha de grupo no Foundry VTT.
   */
  static _registerSheet() {
    const actorsCollection = globalThis.foundry?.documents?.collections?.Actors ?? globalThis.Actors;
    if (actorsCollection?.registerSheet) {
      actorsCollection.registerSheet(MODULE_ID, PartyActorSheet, {
        types: ["party", `${MODULE_ID}.party`],
        makeDefault: true,
        label: "TENEBRE.Party.SheetLabel"
      });
    }
  }

  /**
   * Protege o SymbaroumActor contra execução acidental de cálculos de combatente individual em party.
   */
  static _protectActorCalculations() {
    const symbaroumActorClass = globalThis.CONFIG?.Actor?.documentClass;
    if (symbaroumActorClass?.prototype && !symbaroumActorClass.prototype._tenebrePartyProtected) {
      const origBaseData = symbaroumActorClass.prototype.prepareBaseData;
      symbaroumActorClass.prototype.prepareBaseData = function() {
        if (this.type === "party" || this.type === `${MODULE_ID}.party`) return;
        return origBaseData?.apply(this, arguments);
      };

      const origDerivedData = symbaroumActorClass.prototype.prepareDerivedData;
      symbaroumActorClass.prototype.prepareDerivedData = function() {
        if (this.type === "party" || this.type === `${MODULE_ID}.party`) {
          if (this.system) this.system.isParty = true;
          return;
        }
        return origDerivedData?.apply(this, arguments);
      };
      symbaroumActorClass.prototype._tenebrePartyProtected = true;
    }
  }

  /**
   * Injeta com segurança a opção de "Ficha de Grupo" no diálogo de criação de ator,
   * servindo como camada extra de segurança caso o sistema ou outro módulo interfira.
   */
  static _injectCreateOption(html) {
    try {
      const isElement = typeof globalThis.HTMLElement !== "undefined" && html instanceof globalThis.HTMLElement;
      const root = isElement ? html : (html?.[0] ?? html);
      if (!root?.querySelector) return;
      const typeSelect = root.querySelector('select[name="type"]');
      if (!typeSelect) return;

      const hasActorOption = typeSelect.querySelector('option[value="player"], option[value="monster"]');
      if (!hasActorOption) return;

      if (!typeSelect.querySelector('option[value="party"]')) {
        const doc = globalThis.document;
        if (!doc?.createElement) return;
        const option = doc.createElement("option");
        option.value = "party";
        option.textContent = globalThis.game?.i18n?.localize("TENEBRE.Party.TypeLabel") || "Ficha de Grupo";
        typeSelect.appendChild(option);
      }
    } catch {
      // Ignora erro de renderização
    }
  }

  static register() {
    try {
      this._patchActorTypes();
      this._setupConfig();
      this._patchGameDocumentTypes();
      this._registerSheet();
      this._protectActorCalculations();

      // Hook de proteção para o diálogo de criação de ator
      globalThis.Hooks?.on("renderDialog", (dialog, html) => {
        this._injectCreateOption(html);
      });
      globalThis.Hooks?.on("renderApplicationV2", (app, html) => {
        this._injectCreateOption(html);
      });
    } catch (err) {
      console.error("Symbaroum Ind Resources | Erro ao registrar PartyActorService:", err);
    }
  }

  static registerSetup() {
    try {
      this._patchActorTypes();
      this._patchGameDocumentTypes();
    } catch (err) {
      console.error("Symbaroum Ind Resources | Erro em PartyActorService.registerSetup:", err);
    }
  }
}
