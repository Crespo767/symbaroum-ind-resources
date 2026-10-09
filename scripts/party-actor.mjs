import { MODULE_ID } from "./constants.mjs";

/**
 * DataModel para o tipo de ator "party" (Ficha de Grupo).
 */
export class PartyDataModel extends (globalThis.foundry?.abstract?.TypeDataModel ?? class {}) {
  static defineSchema() {
    const fields = globalThis.foundry?.data?.fields;
    if (!fields) return {};
    return {
      motto: new fields.StringField({ initial: "" }),
      description: new fields.HTMLField({ initial: "" }),
      members: new fields.ArrayField(new fields.StringField(), { initial: [] })
    };
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
  static register() {
    // 1. Registrar no game.system.documentTypes.Actor para o dialog "Criar Ator"
    if (globalThis.game?.system?.documentTypes?.Actor) {
      if (!globalThis.game.system.documentTypes.Actor.includes("party")) {
        globalThis.game.system.documentTypes.Actor.push("party");
      }
    }

    // 2. Registrar DataModel
    if (globalThis.CONFIG?.Actor) {
      globalThis.CONFIG.Actor.dataModels = globalThis.CONFIG.Actor.dataModels ?? {};
      if (!globalThis.CONFIG.Actor.dataModels.party && globalThis.foundry?.abstract?.TypeDataModel) {
        globalThis.CONFIG.Actor.dataModels.party = PartyDataModel;
      }

      // 3. Registrar DocumentClass específica para o tipo "party"
      globalThis.CONFIG.Actor.documentClasses = globalThis.CONFIG.Actor.documentClasses ?? {};
      globalThis.CONFIG.Actor.documentClasses.party = PartyActor;

      // 4. Registrar label de exibição do tipo no dropdown
      globalThis.CONFIG.Actor.typeLabels = globalThis.CONFIG.Actor.typeLabels ?? {};
      globalThis.CONFIG.Actor.typeLabels.party = "TENEBRE.Party.TypeLabel";
    }

    // 5. Registrar a Sheet para o tipo "party"
    const actorsCollection = globalThis.foundry?.documents?.collections?.Actors ?? globalThis.Actors;
    if (actorsCollection?.registerSheet) {
      actorsCollection.registerSheet(MODULE_ID, PartyActorSheet, {
        types: ["party"],
        makeDefault: true,
        label: "TENEBRE.Party.SheetLabel"
      });
    }

    // 6. Proteger o SymbaroumActor contra execução acidental de cálculos de combatente individual em party
    const symbaroumActorClass = globalThis.CONFIG?.Actor?.documentClass;
    if (symbaroumActorClass?.prototype && !symbaroumActorClass.prototype._tenebrePartyProtected) {
      const origBaseData = symbaroumActorClass.prototype.prepareBaseData;
      symbaroumActorClass.prototype.prepareBaseData = function() {
        if (this.type === "party") return;
        return origBaseData?.apply(this, arguments);
      };

      const origDerivedData = symbaroumActorClass.prototype.prepareDerivedData;
      symbaroumActorClass.prototype.prepareDerivedData = function() {
        if (this.type === "party") {
          if (this.system) this.system.isParty = true;
          return;
        }
        return origDerivedData?.apply(this, arguments);
      };
      symbaroumActorClass.prototype._tenebrePartyProtected = true;
    }
  }

  static registerSetup() {
    // Garantir que documentTypes contenha "party" caso o core do Foundry reconstrua após o init
    if (globalThis.game?.documentTypes?.Actor && !globalThis.game.documentTypes.Actor.includes("party")) {
      globalThis.game.documentTypes.Actor.push("party");
    }
    if (globalThis.game?.system?.documentTypes?.Actor && !globalThis.game.system.documentTypes.Actor.includes("party")) {
      globalThis.game.system.documentTypes.Actor.push("party");
    }
  }
}
