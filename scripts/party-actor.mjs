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
      dragDrop: [{ dragSelector: ".item[data-item-id]", dropSelector: null }],
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
      dragDrop: [{ dragSelector: ".item[data-item-id]", dropSelector: null }],
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
        const canRoll = Boolean(memberActor.isOwner || globalThis.game?.user?.isGM);

        members.push({
          id: memberActor.id,
          uuid: memberActor.uuid,
          name: memberActor.name,
          img: memberActor.img,
          occupation: occupationDisplay,
          totalXp: totalXp,
          availableXp: availableXp,
          topAttributes: topAttributes,
          canRoll: canRoll,
          isOwner: canRoll,
          actor: memberActor,
          system: sys
        });
      }
    }
    data.members = members;

    const rawItems = Array.from(this.actor?.items?.values?.() ?? []);
    const items = rawItems.map(item => {
      const sys = item.system ?? {};
      const type = item.type;
      const quantity = Number(sys.number ?? sys.quantity ?? 1) || 1;
      const detail = this._getItemDetail(item);
      const typeLabel = this._getItemTypeLabel(type);

      return {
        id: item.id,
        uuid: item.uuid,
        name: item.name,
        img: item.img || "icons/svg/item-bag.svg",
        type: type,
        typeLabel: typeLabel,
        quantity: quantity,
        detail: detail,
        system: sys,
        item: item
      };
    }).sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));

    const weapons = items.filter(i => i.type === "weapon");
    const armors = items.filter(i => i.type === "armor");
    const artifacts = items.filter(i => i.type === "artifact" || i.system?.isArtifact);
    const equipments = items.filter(i => i.type !== "weapon" && i.type !== "armor" && i.type !== "artifact" && !i.system?.isArtifact);

    const categories = [
      { key: "weapons", label: "TITLE.WEAPONS", icon: "fas fa-shield-alt", items: weapons },
      { key: "armors", label: "TITLE.ARMORS", icon: "fas fa-shield", items: armors },
      { key: "artifacts", label: "TITLE.ARTIFACTS", icon: "fas fa-ring", items: artifacts },
      { key: "equipments", label: "TITLE.EQUIPMENTS", icon: "fas fa-boxes", items: equipments }
    ].filter(cat => cat.items.length > 0);

    data.inventoryItems = items;
    data.inventoryCategories = categories;

    return data;
  }

  _getItemTypeLabel(type) {
    const loc = globalThis.game?.i18n?.localize;
    if (loc) {
      const typeKeyMap = {
        weapon: "ITEM.TypeWeapon",
        armor: "ITEM.TypeArmor",
        equipment: "ITEM.TypeEquipment",
        artifact: "ITEM.TypeArtifact",
        ability: "ITEM.TypeAbility",
        mysticalPower: "ITEM.TypeMysticalpower",
        ritual: "ITEM.TypeRitual",
        trait: "ITEM.TypeTrait",
        boon: "ITEM.TypeBoon",
        burden: "ITEM.TypeBurden"
      };
      const key = typeKeyMap[type] || `ITEM.Type${type}`;
      const translated = loc(key);
      if (translated && translated !== key) return translated;
    }
    const fallbackMap = {
      weapon: "Arma",
      armor: "Armadura",
      equipment: "Equipamento",
      artifact: "Artefato",
      ability: "Habilidade",
      mysticalPower: "Poder Místico",
      ritual: "Ritual",
      trait: "Traço",
      boon: "Dádiva",
      burden: "Fardo"
    };
    return fallbackMap[type] || type;
  }

  _getItemDetail(item) {
    const sys = item.system ?? {};
    if (item.type === "weapon") {
      const dmg = sys.damage?.displayTextShort || sys.baseDamage;
      return dmg ? `${dmg}` : "";
    }
    if (item.type === "armor") {
      const prot = sys.displayTextShort || sys.baseProtection;
      return prot ? `${prot}` : "";
    }
    if (item.type === "artifact" || sys.isArtifact) {
      if (sys.power1?.name) {
        return sys.power1.name;
      }
    }
    return "";
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

    const canRoll = Boolean(memberActor.isOwner || globalThis.game?.user?.isGM);
    if (!canRoll) {
      globalThis.ui?.notifications?.warn?.(
        globalThis.game?.i18n?.localize?.("TENEBRE.Party.RollNotAllowed") ||
        "Você só pode rolar testes do seu próprio personagem."
      );
      return;
    }

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

    root.querySelectorAll('[data-action="open-item-sheet"]').forEach(el => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        const itemId = el.dataset.itemId || el.closest(".item")?.dataset.itemId;
        if (!itemId) return;
        this.actor?.items?.get?.(itemId)?.sheet?.render(true);
      });
    });

    root.querySelectorAll('[data-action="delete-item"]').forEach(el => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const itemId = el.dataset.itemId || el.closest(".item")?.dataset.itemId;
        if (!itemId) return;
        this._onDeleteItem(itemId);
      });
    });

    root.querySelectorAll('[data-action="increase-quantity"]').forEach(el => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const itemId = el.dataset.itemId || el.closest(".item")?.dataset.itemId;
        if (!itemId) return;
        this._onIncreaseItemQuantity(itemId);
      });
    });

    root.querySelectorAll('[data-action="decrease-quantity"]').forEach(el => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const itemId = el.dataset.itemId || el.closest(".item")?.dataset.itemId;
        if (!itemId) return;
        this._onDecreaseItemQuantity(itemId);
      });
    });
  }

  _onDragStart(event) {
    const li = event.currentTarget;
    if (event.target?.classList?.contains("content-link")) return;

    if (li?.dataset?.itemId) {
      const item = this.actor?.items?.get?.(li.dataset.itemId);
      if (item) {
        const dragData = typeof item.toDragData === "function"
          ? item.toDragData()
          : { type: "Item", uuid: item.uuid, id: item.id };
        event.dataTransfer?.setData?.("text/plain", JSON.stringify(dragData));
        return;
      }
    }
    return super._onDragStart ? super._onDragStart(event) : undefined;
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
    if (data.type === "Item") {
      return this._onDropItem(event, data);
    }
    return super._onDrop ? super._onDrop(event) : false;
  }

  async _onDropItem(event, data) {
    if (!this.isEditable) return false;

    let item = null;
    if (globalThis.Item?.implementation?.fromDropData) {
      try {
        item = await globalThis.Item.implementation.fromDropData(data);
      } catch {}
    }
    if (!item && data?.uuid && globalThis.fromUuid) {
      try {
        item = await globalThis.fromUuid(data.uuid);
      } catch {}
    }
    if (!item && data?.data) {
      item = data.data;
    }
    if (!item) return false;

    const itemData = typeof item.toObject === "function"
      ? item.toObject()
      : (globalThis.foundry?.utils?.deepClone?.(item) ?? item);

    // Se o item já pertence a este ator, faz reordenação interna
    if (this.actor.uuid === item.parent?.uuid) {
      return this._onSortItem ? this._onSortItem(event, itemData) : false;
    }

    return this._onDropItemCreate(itemData);
  }

  async _onDropItemCreate(itemData) {
    const items = Array.isArray(itemData) ? itemData : [itemData];
    return this.actor.createEmbeddedDocuments("Item", items);
  }

  async _onDeleteItem(itemId) {
    if (!this.isEditable || !itemId) return;
    const item = this.actor?.items?.get?.(itemId);
    if (!item) return;

    if (globalThis.Dialog && globalThis.game?.i18n?.localize) {
      const title = globalThis.game.i18n.localize("TOOLTIP.DELETE_ITEM") || "Excluir Item";
      const confirmLabel = globalThis.game.i18n.localize("DIALOG.OK") || "OK";
      const cancelLabel = globalThis.game.i18n.localize("DIALOG.CANCEL") || "Cancelar";
      new globalThis.Dialog({
        title: title,
        content: `<p>${title}: <strong>${item.name}</strong>?</p>`,
        buttons: {
          yes: {
            label: confirmLabel,
            callback: () => this.actor.deleteEmbeddedDocuments("Item", [itemId])
          },
          no: {
            label: cancelLabel
          }
        },
        default: "no"
      }).render(true);
    } else {
      await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
    }
  }

  async _onIncreaseItemQuantity(itemId) {
    if (!this.isEditable || !itemId) return;
    const item = this.actor?.items?.get?.(itemId);
    if (!item) return;
    const current = Number(item.system?.number ?? item.system?.quantity ?? 1) || 1;
    await item.update({ "system.number": current + 1 });
  }

  async _onDecreaseItemQuantity(itemId) {
    if (!this.isEditable || !itemId) return;
    const item = this.actor?.items?.get?.(itemId);
    if (!item) return;
    const current = Number(item.system?.number ?? item.system?.quantity ?? 1) || 1;
    if (current > 1) {
      await item.update({ "system.number": current - 1 });
    }
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
