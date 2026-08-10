export const MODULE_ID = "symbaroum-ind-resources";
export const FLAG_SCOPE = "symbaroum-ind-resources";
export const PAIN_THRESHOLD_OUTCOME_FLAG = "painThresholdOutcome";

export const AMMO_TYPES = {
  ARROW: "ammo",
  BOLT: "ammo"
};

export const WEAPON_AMMO_TYPES = {
  NONE: "none",
  BOW: "bow",
  CROSSBOW: "crossbow"
};

export const MANEUVER_EFFECTS = Object.freeze({
  DELAYED_INITIATIVE: "tenebre-maneuver-delayed-initiative",
  GRAPPLED: "tenebre-maneuver-grappled",
  MAINTAINING_GRAPPLE: "tenebre-maneuver-maintaining-grapple",
  DISARMED: "tenebre-maneuver-disarmed",
  SHOVED: "tenebre-maneuver-shoved",
  KNOCKED_DOWN: "tenebre-maneuver-knocked-down",
  CHARGING: "tenebre-maneuver-charging",
  CAREFUL_AIM: "tenebre-maneuver-careful-aim",
  POISONED_WEAPON: "tenebre-maneuver-poisoned-weapon",
  POISONED: "tenebre-maneuver-poisoned",
  TAKING_INITIATIVE: "tenebre-maneuver-taking-initiative",
  INITIATIVE_BONUS: "tenebre-maneuver-initiative-bonus",
  KNOCKED_OUT: "tenebre-maneuver-knocked-out",
  TOTAL_DEFENSE: "tenebre-maneuver-total-defense",
  TOTAL_OFFENSE: "tenebre-maneuver-total-offense",
  FREE_ATTACK_OPENING: "tenebre-maneuver-free-attack-opening"
});

export const DEFAULTS = {
  rationUses: 7,
  extraRationFoods: {
    version: 1,
    foods: {
      copo_de_vesa: {
        name: "Copo de Vesa",
        aliases: ["Cup of Vesa", "Vesa"],
        category: "Bebidas",
        uses: 1,
        enabled: false
      },
      caneca_de_caldo_negro_zarekiano: {
        name: "Caneca de Caldo Negro zarekiano",
        aliases: ["Mug of Zarekian Black Brew", "Zarekian Black Brew"],
        category: "Bebidas",
        uses: 1,
        enabled: false
      },
      assado_lentamente_com_cenoura_cozida: {
        name: "Assado lentamente com cenoura cozida",
        aliases: ["Slow-roasted meat with boiled carrots"],
        category: "Carne",
        uses: 1,
        enabled: false
      },
      bife_do_rei_em_molho: {
        name: "Bife do rei em molho",
        aliases: ["King's steak in sauce"],
        category: "Carne",
        uses: 1,
        enabled: false
      },
      fricasse_de_frango_com_nabos: {
        name: "Fricassê de frango com nabos",
        aliases: ["Chicken fricassee with turnips"],
        category: "Carne",
        uses: 1,
        enabled: false
      },
      javali_assado_com_batatas: {
        name: "Javali assado com batatas",
        aliases: ["Roast boar with potatoes"],
        category: "Carne",
        uses: 1,
        enabled: false
      },
      pulmao_recheado_com_pure_preto: {
        name: "Pulmão recheado com purê preto",
        aliases: ["Stuffed lung with black mash"],
        category: "Carne",
        uses: 1,
        enabled: false
      },
      salsicha_roka_com_pure_de_beterraba: {
        name: "Salsicha roka com purê de beterraba",
        aliases: ["Roka sausage with beetroot mash"],
        category: "Carne",
        uses: 1,
        enabled: false
      },
      cha_de_carvalho_ferro: {
        name: "Chá de carvalho ferro",
        aliases: ["Iron oak tea"],
        category: "Chás",
        uses: 1,
        enabled: false
      },
      cha_de_ervas: {
        name: "Chá de ervas",
        aliases: ["Herbal tea"],
        category: "Chás",
        uses: 1,
        enabled: false
      },
      cha_de_especiarias: {
        name: "Chá de especiarias",
        aliases: ["Spiced tea"],
        category: "Chás",
        uses: 1,
        enabled: false
      },
      cha_de_frutas: {
        name: "Chá de frutas",
        aliases: ["Fruit tea"],
        category: "Chás",
        uses: 1,
        enabled: false
      },
      cha_defumado: {
        name: "Chá defumado",
        aliases: ["Smoked tea"],
        category: "Chás",
        uses: 1,
        enabled: false
      },
      carne_com_batata: {
        name: "Carne com batata",
        aliases: ["Meat with potatoes"],
        category: "Ensopados",
        uses: 1,
        enabled: false
      },
      ensopado_de_legumes: {
        name: "Ensopado de legumes",
        aliases: ["Vegetable stew"],
        category: "Ensopados",
        uses: 1,
        enabled: false
      },
      ensopado_de_repolho: {
        name: "Ensopado de repolho",
        aliases: ["Cabbage stew"],
        category: "Ensopados",
        uses: 1,
        enabled: false
      },
      ensopado_misto: {
        name: "Ensopado misto",
        aliases: ["Mixed stew"],
        category: "Ensopados",
        uses: 1,
        enabled: false
      },
      peixe_e_nabos: {
        name: "Peixe e nabos",
        aliases: ["Fish and turnips"],
        category: "Ensopados",
        uses: 1,
        enabled: false
      },
      mingau_de_aveia_com_manteiga: {
        name: "Mingau de aveia com manteiga",
        aliases: ["Oatmeal porridge with butter"],
        category: "Mingau",
        uses: 1,
        enabled: false
      },
      mingau_de_creme_picante: {
        name: "Mingau de creme picante",
        aliases: ["Spicy cream porridge"],
        category: "Mingau",
        uses: 1,
        enabled: false
      },
      mingau_regado: {
        name: "Mingau regado",
        aliases: ["Watered porridge"],
        category: "Mingau",
        uses: 1,
        enabled: false
      },
      arenque_salgado_com_nabos: {
        name: "Arenque salgado com nabos",
        aliases: ["Salted herring with turnips"],
        category: "Peixe",
        uses: 1,
        enabled: false
      },
      molho_de_peixe_e_torrada: {
        name: "Molho de peixe e torrada",
        aliases: ["Fish sauce and toast"],
        category: "Peixe",
        uses: 1,
        enabled: false
      },
      pudim_de_truta_com_nabos: {
        name: "Pudim de truta com nabos",
        aliases: ["Trout pudding with turnips"],
        category: "Peixe",
        uses: 1,
        enabled: false
      },
      zander_com_manteiga_e_pure: {
        name: "Zander com manteiga e purê",
        aliases: ["Zander with butter and mash"],
        category: "Peixe",
        uses: 1,
        enabled: false
      },
      agulhas_salgadas: {
        name: "Agulhas salgadas",
        aliases: ["Salted needles"],
        category: "Sobremesas",
        uses: 1,
        enabled: false
      },
      biscoito_com_manteiga_de_trufas: {
        name: "Biscoito com manteiga de trufas",
        aliases: ["Biscuit with truffle butter"],
        category: "Sobremesas",
        uses: 1,
        enabled: false
      },
      bonequinhos_de_macapao: {
        name: "Bonequinhos de maçapão",
        aliases: ["Marzipan dolls"],
        category: "Sobremesas",
        uses: 1,
        enabled: false
      },
      canela_assada_com_mel: {
        name: "Canela assada com mel",
        aliases: ["Roasted cinnamon with honey"],
        category: "Sobremesas",
        uses: 1,
        enabled: false
      },
      confeito_de_nogado: {
        name: "Confeito de nogado",
        aliases: ["Nougat confection"],
        category: "Sobremesas",
        uses: 1,
        enabled: false
      },
      gengibre_cristalizado: {
        name: "Gengibre cristalizado",
        aliases: ["Crystallized ginger"],
        category: "Sobremesas",
        uses: 1,
        enabled: false
      },
      marmelada: {
        name: "Marmelada",
        aliases: ["Marmalade"],
        category: "Sobremesas",
        uses: 1,
        enabled: false
      },
      nozes_em_chocolate: {
        name: "Nozes em chocolate",
        aliases: ["Chocolate-covered nuts"],
        category: "Sobremesas",
        uses: 1,
        enabled: false
      },
      pastel_frito: {
        name: "Pastel frito",
        aliases: ["Fried pastry"],
        category: "Sobremesas",
        uses: 1,
        enabled: false
      },
      petalas_de_rosa_revestidas_de_acucar: {
        name: "Pétalas de rosa revestidas de açúcar",
        aliases: ["Sugar-coated rose petals"],
        category: "Sobremesas",
        uses: 1,
        enabled: false
      },
      pudim_de_frutas: {
        name: "Pudim de frutas",
        aliases: ["Fruit pudding"],
        category: "Sobremesas",
        uses: 1,
        enabled: false
      },
      sorvete_de_frutas: {
        name: "Sorvete de frutas",
        aliases: ["Fruit sorbet"],
        category: "Sobremesas",
        uses: 1,
        enabled: false
      },
      sorvete_com_frutas: {
        name: "Sorvete com frutas",
        aliases: ["Sorbet with fruit"],
        category: "Sobremesas",
        uses: 1,
        enabled: false
      },
      torta_de_frutas: {
        name: "Torta de frutas",
        aliases: ["Fruit pie"],
        category: "Sobremesas",
        uses: 1,
        enabled: false
      },
      waffles_com_manteiga_e_mel: {
        name: "Waffles com manteiga e mel",
        aliases: ["Waffles with butter and honey"],
        category: "Sobremesas",
        uses: 1,
        enabled: false
      },
      sopa_de_cebola_com_torrada: {
        name: "Sopa de cebola com torrada",
        aliases: ["Onion soup with toast"],
        category: "Sopas",
        uses: 1,
        enabled: false
      },
      sopa_de_sangue_com_pao_escuro: {
        name: "Sopa de sangue com pão escuro",
        aliases: ["Blood soup with dark bread"],
        category: "Sopas",
        uses: 1,
        enabled: false
      },
      torta_de_carne: {
        name: "Torta de carne",
        aliases: ["Meat pie"],
        category: "Tortas",
        uses: 1,
        enabled: false
      },
      torta_de_cogumelos: {
        name: "Torta de cogumelos",
        aliases: ["Mushroom pie"],
        category: "Tortas",
        uses: 1,
        enabled: false
      },
      torta_de_miudos: {
        name: "Torta de miúdos",
        aliases: ["Offal pie"],
        category: "Tortas",
        uses: 1,
        enabled: false
      },
      torta_de_peixe: {
        name: "Torta de peixe",
        aliases: ["Fish pie"],
        category: "Tortas",
        uses: 1,
        enabled: false
      },
      torta_de_repolho: {
        name: "Torta de repolho",
        aliases: ["Cabbage pie"],
        category: "Tortas",
        uses: 1,
        enabled: false
      },
      torta_de_rim: {
        name: "Torta de rim",
        aliases: ["Kidney pie"],
        category: "Tortas",
        uses: 1,
        enabled: false
      },
      torta_de_truta: {
        name: "Torta de truta",
        aliases: ["Trout pie"],
        category: "Tortas",
        uses: 1,
        enabled: false
      }
    }
  },
  restHealing: 1,
  movementBaseMeters: 10,
  movementBaseFeet: 30,
  movementUnitSystem: "meters",
  enableMovementColors: true,
  enableMovementLimitLabels: true,
  enableMovementBlocking: true,
  enableMovementHungerModifier: true,
  enableMovementEncumbranceModifier: true,
  enableMovementEffectModifiers: true
};
