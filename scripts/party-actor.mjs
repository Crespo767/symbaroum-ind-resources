import { MODULE_ID } from "./constants.mjs";
import { ActorPreparation } from "./actor-preparation.mjs";

/** Tipo de ator declarado em module.json (documentTypes.Actor.party); o core o registra sozinho. */
export const PARTY_ACTOR_TYPE = `${MODULE_ID}.party`;

export function isPartyActor(actor) {
  return actor?.type === PARTY_ACTOR_TYPE;
}

/**
 * DataModel do ator de Grupo.
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
    if (fields.SchemaField && fields.NumberField) {
      schema.experience = new fields.SchemaField({
        total: new fields.NumberField({ initial: 0, integer: true, min: 0 }),
        artifactrr: new fields.NumberField({ initial: 0, integer: true, min: 0 }),
        spent: new fields.NumberField({ initial: 0, integer: true, min: 0 }),
        available: new fields.NumberField({ initial: 0, integer: true })
      });
    }
    return schema;
  }

  /** Chamado pelo core depois do prepareDerivedData do ator. */
  prepareDerivedData() {
    this.isParty = true;
    this.experience ??= { total: 0, artifactrr: 0, spent: 0, available: 0 };
    const exp = this.experience;
    exp.available = (Number(exp.total) || 0) - (Number(exp.artifactrr) || 0) - (Number(exp.spent) || 0);
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
      width: 800,
      height: 580,
      resizable: true,
      dragDrop: [{ dragSelector: null, dropSelector: null }],
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "characters"
        }
      ]
    }) ?? {
      classes: ["symbaroum", "sheet", "actor", "player", "party", "tenebre-party-sheet"],
      template: `modules/${MODULE_ID}/templates/party-sheet.hbs`,
      width: 800,
      height: 580,
      resizable: true,
      dragDrop: [{ dragSelector: null, dropSelector: null }],
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "characters"
        }
      ]
    };
  }

  async getData(options) {
    const data = await super.getData?.(options) ?? {};
    data.id = this.actor?.id;
    data.actor = this.actor;
    data.system = this.actor?.system;
    data.cssClass = this.isEditable ? "editable" : "locked";
    data.editable = this.isEditable;

    const memberIds = Array.isArray(this.actor?.system?.members) ? this.actor.system.members : [];
    const members = [];
    for (const memberId of memberIds) {
      let memberActor = globalThis.game?.actors?.get(memberId);
      if (!memberActor && globalThis.fromUuidSync) {
        try {
          const doc = globalThis.fromUuidSync(memberId);
          memberActor = doc?.actor ?? doc;
        } catch {}
      }
      if (memberActor) {
        const sys = memberActor.system ?? {};
        const bio = sys.bio ?? {};
        const exp = sys.experience ?? {};
        const totalXp = Number(exp.total) || 0;
        const availableXp = exp.available !== undefined ? (Number(exp.available) || 0) : totalXp;
        const occupation = (bio.occupation && typeof bio.occupation === "string") ? bio.occupation.trim() : "";
        const race = (bio.race && typeof bio.race === "string") ? bio.race.trim() : "";
        const occupationDisplay = occupation || race || "";
        const topAttributes = this._getMemberTopAttributes(memberActor, 4);

        members.push({
          id: memberActor.id,
          uuid: memberActor.uuid,
          name: memberActor.name,
          img: memberActor.img,
          occupation: occupationDisplay,
          totalXp: totalXp,
          availableXp: availableXp,
          topAttributes: topAttributes,
          actor: memberActor,
          system: sys
        });
      }
    }
    data.members = members;
    return data;
  }

  _getMemberTopAttributes(memberActor, count = 4) {
    const sys = memberActor?.system ?? {};
    const attrs = sys.attributes ?? {};
    const list = [];

    const ATTR_ABBR_MAP = {
      accurate: "PRE",
      cunning: "AST",
      discreet: "DIS",
      persuasive: "PER",
      quick: "RAP",
      resolute: "RES",
      strong: "VGR",
      vigilant: "VGL"
    };

    for (const [key, attrData] of Object.entries(attrs)) {
      if (!attrData || typeof attrData !== "object") continue;
      const total = Number(attrData.total ?? attrData.value ?? 0);
      const labelKey = attrData.label || `ATTRIBUTE.${key.toUpperCase()}`;
      const abbrKey = `ATTRIBUTE.${key.toUpperCase()}ABBR`;
      const label = globalThis.game?.i18n?.localize ? globalThis.game.i18n.localize(labelKey) : labelKey;
      let abbr = globalThis.game?.i18n?.localize ? globalThis.game.i18n.localize(abbrKey) : "";
      if (!abbr || abbr === abbrKey) {
        abbr = ATTR_ABBR_MAP[key] || key.substring(0, 3).toUpperCase();
      }
      list.push({
        key,
        total,
        label,
        abbr,
        modifier: attrData.modifier
      });
    }

    list.sort((a, b) => b.total - a.total);
    return list.slice(0, count);
  }

  async _onRollMemberAttribute(actorId, attributeKey) {
    let memberActor = globalThis.game?.actors?.get(actorId);
    if (!memberActor && globalThis.fromUuidSync) {
      try {
        const doc = globalThis.fromUuidSync(actorId);
        memberActor = doc?.actor ?? doc;
      } catch {}
    }
    if (!memberActor) return;

    if (typeof memberActor.rollAttribute === "function") {
      return memberActor.rollAttribute(attributeKey);
    }
    if (typeof memberActor.sheet?._prepareRollAttribute === "function") {
      return memberActor.sheet._prepareRollAttribute({
        preventDefault: () => {},
        target: { dataset: { attribute: attributeKey } }
      });
    }
    if (typeof globalThis.game?.symbaroum?.api?.rollAttribute === "function") {
      return globalThis.game.symbaroum.api.rollAttribute(memberActor, attributeKey);
    }
  }

  activateListeners(html) {
    super.activateListeners?.(html);
    const root = html?.[0] ?? html;
    if (!root?.querySelectorAll) return;

    root.querySelectorAll('[data-action="open-member-sheet"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const actorId = el.dataset.actorId;
        if (!actorId) return;
        const targetActor = globalThis.game?.actors?.get(actorId)
          ?? (globalThis.fromUuid ? await globalThis.fromUuid(actorId) : null);
        targetActor?.sheet?.render(true);
      });
    });

    root.querySelectorAll('[data-action="roll-member-attribute"]').forEach(el => {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const actorId = el.dataset.actorId;
        const attrKey = el.dataset.attribute;
        if (!actorId || !attrKey) return;
        await this._onRollMemberAttribute(actorId, attrKey);
      });
    });

    root.querySelectorAll('[data-action="remove-member"]').forEach(el => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const actorId = el.dataset.actorId;
        this._onRemoveMember(actorId);
      });
    });
  }

  async _onDrop(event) {
    let data = null;
    try {
      data = globalThis.TextEditor?.getDragEventData?.(event)
        ?? JSON.parse(event.dataTransfer?.getData("text/plain") ?? "null");
    } catch {
      data = null;
    }
    if (!data) return false;

    if (data.type === "Actor" || data.type === "Token") {
      return this._onDropActor(event, data);
    }
    return super._onDrop ? super._onDrop(event) : false;
  }

  async _onDropActor(event, data) {
    if (!this.isEditable) return false;
    let droppedActor = null;
    if (data.uuid) {
      const doc = await globalThis.fromUuid?.(data.uuid);
      droppedActor = doc?.actor ?? doc;
    } else if (data.id) {
      droppedActor = globalThis.game?.actors?.get(data.id);
    }
    if (!droppedActor || !droppedActor.id) return false;

    if (droppedActor.id === this.actor?.id || droppedActor.uuid === this.actor?.uuid) return false;
    if (isPartyActor(droppedActor)) return false;

    const currentMembers = Array.isArray(this.actor?.system?.members) ? [...this.actor.system.members] : [];
    if (currentMembers.includes(droppedActor.id) || (droppedActor.uuid && currentMembers.includes(droppedActor.uuid))) return false;

    currentMembers.push(droppedActor.id);
    return this.actor.update({ "system.members": currentMembers });
  }

  async _onRemoveMember(actorId) {
    if (!this.isEditable || !actorId) return;
    const currentMembers = Array.isArray(this.actor?.system?.members) ? [...this.actor.system.members] : [];
    const filtered = currentMembers.filter(id => id !== actorId);
    if (filtered.length !== currentMembers.length) {
      return this.actor.update({ "system.members": filtered });
    }
  }
}

/**
 * Registra o DataModel, o rótulo e a ficha do tipo de Grupo, e impede que os cálculos de
 * combatente do sistema Symbaroum rodem para ele.
 */
export class PartyActorService {
  static register() {
    const actorConfig = globalThis.CONFIG?.Actor;
    if (!actorConfig) return;

    if (globalThis.foundry?.abstract?.TypeDataModel) {
      actorConfig.dataModels = actorConfig.dataModels ?? {};
      actorConfig.dataModels[PARTY_ACTOR_TYPE] = PartyDataModel;
    }
    actorConfig.typeLabels = actorConfig.typeLabels ?? {};
    actorConfig.typeLabels[PARTY_ACTOR_TYPE] = "TENEBRE.Party.TypeLabel";

    const actorsCollection = globalThis.foundry?.documents?.collections?.Actors;
    actorsCollection?.registerSheet?.(MODULE_ID, PartyActorSheet, {
      types: [PARTY_ACTOR_TYPE],
      makeDefault: true,
      label: "TENEBRE.Party.SheetLabel"
    });

    this._protectActorCalculations();
  }

  /** O ator do sistema calcula armaduras, armas e atributos; nada disso existe num Grupo. */
  static _protectActorCalculations() {
    ActorPreparation.skipSystemPreparation(isPartyActor);
  }
}
