import { describe, expect, it } from 'vitest';
import DamageTypeData from '../en/5e-SRD-Damage-Types.json' with { type: 'json' };
import EquipmentData from '../en/5e-SRD-Equipment.json' with { type: 'json' };
import MagicItemData from '../en/5e-SRD-Magic-Items.json' with { type: 'json' };
import ProficiencyData from '../en/5e-SRD-Proficiencies.json' with { type: 'json' };
import SkillData from '../en/5e-SRD-Skills.json' with { type: 'json' };
import TraitData from '../en/5e-SRD-Traits.json' with { type: 'json' };
import WeaponPropertyData from '../en/5e-SRD-Weapon-Properties.json' with { type: 'json' };
import { deriveEquipment, deriveMagicItems } from '../derive-item-data';

type Cost = { quantity: number; unit: string };
type Damage = { damage_type: string; damage_dice: string };
type ItemEffect = {
  activation: string;
  duration?: { unit: string; length?: number };
  armor_class?: { bonus: number };
  ability?: { ability: string; op: string; value: number; cap?: number };
  resistances?: string[];
  attack?: { to_hit_bonus?: number; damage_bonus?: number; extra_damage?: Damage[] };
  damage?: Damage[];
  heal?: string;
  saving_throws?: { abilities: string[]; bonus?: number; advantage?: true };
  skill_check?: { skill: string; bonus?: number; advantage?: true };
  proficiencies?: string[];
  traits?: string[];
};
type Equipment = {
  index: string;
  name: string;
  equipment_category: { index: string };
  cost: Cost;
  cost_cp?: number;
  quantity?: number;
  bundle_size?: number;
  reach_ft?: number;
  weapon_range?: string;
  properties?: { index: string }[];
  effect?: { damage?: Damage[] };
  effects?: ItemEffect[];
};
type MagicItem = {
  index: string;
  desc: string[];
  rarity: { name: string; rank?: number; min_level?: number };
  cost?: Cost;
  cost_cp?: number;
  requires_attunement?: boolean;
  is_consumable?: boolean;
  effect?: {
    ability_score_modifier?: {
      ability: string;
      amount: { total?: number; increase?: number; max?: number };
    };
    armor_class_modifier?: number;
    damage_type_resistance?: string;
    duration?: { unit: string; length: number };
    heal?: string;
    proficiency_modifier?: { grants: string[] };
    saving_throw_modifier?: { abilities: string[]; bonus: number; gives_advantage?: boolean };
    skill_check_modifier?: { skill: string; bonus?: number; gives_advantage?: boolean };
    trait_modifier?: { grants: string[] };
  };
  enchantment?: {
    armor_class_bonus?: number;
    damage_bonus?: number;
    to_hit_bonus?: number;
    extra_damage?: { damage_type: { index: string }; damage_dice: string };
  };
  effects?: ItemEffect[];
};

const equipment = EquipmentData as unknown as Equipment[];
const magicItems = MagicItemData as unknown as MagicItem[];
const indexes = (data: unknown) => new Set((data as { index: string }[]).map((e) => e.index));
const damageTypes = indexes(DamageTypeData);
const proficiencies = indexes(ProficiencyData);
const skills = indexes(SkillData);
const traits = indexes(TraitData);

// The SRD coin table, written out here and not read from the derivation.
const copperPerCoin: Record<string, number> = { cp: 1, sp: 10, gp: 100 };
const rarityNames = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];

describe('item data', () => {
  it('is derived without drift', () => {
    expect(deriveEquipment(EquipmentData as never)).toEqual(EquipmentData);
    expect(deriveMagicItems(MagicItemData as never)).toEqual(MagicItemData);
  });
});

describe('cost_cp', () => {
  it('is the cost in copper pieces, for every item that has a cost', () => {
    for (const item of [...equipment, ...magicItems]) {
      if (!item.cost) {
        expect(item.cost_cp, item.index).toBeUndefined();
        continue;
      }
      expect(copperPerCoin[item.cost.unit], `${item.index} unit ${item.cost.unit}`).toBeDefined();
      expect(item.cost_cp, item.index).toBe(item.cost.quantity * copperPerCoin[item.cost.unit]);
      expect(Number.isInteger(item.cost_cp), item.index).toBe(true);
    }
  });

  it('is missing only for the artifact without a price', () => {
    expect(magicItems.filter((i) => i.cost_cp === undefined).map((i) => i.index)).toEqual([
      'orb-of-dragonkind',
    ]);
  });
});

describe('rarity rank and minimum level', () => {
  it('numbers the rarity names from 1 and leaves varying rarity unnumbered', () => {
    for (const item of magicItems) {
      const { name, rank } = item.rarity;
      if (name === 'Varies') expect(rank, item.index).toBeUndefined();
      else expect(rank, item.index).toBe(rarityNames.indexOf(name) + 1);
    }
  });

  it('sets the minimum level by tier of play, and none for artifacts and varying rarity', () => {
    const minLevel: Record<string, number | undefined> = {
      Common: 1,
      Uncommon: 1,
      Rare: 5,
      'Very Rare': 11,
      Legendary: 17,
    };
    for (const item of magicItems) {
      expect(item.rarity.min_level, item.index).toBe(minLevel[item.rarity.name]);
    }
  });

  it('counts the items of each rarity', () => {
    const counts: Record<string, number> = {};
    for (const item of magicItems) counts[item.rarity.name] = (counts[item.rarity.name] ?? 0) + 1;
    expect(counts).toEqual({
      Common: 4,
      Uncommon: 94,
      Rare: 119,
      'Very Rare': 90,
      Legendary: 43,
      Artifact: 1,
      Varies: 11,
    });
  });
});

describe('reach_ft', () => {
  const reachBonus = Number(
    (WeaponPropertyData as unknown as { index: string; desc: string[] }[])
      .find((p) => p.index === 'reach')!
      .desc.join(' ')
      .match(/adds (\d+) feet/)![1]
  );

  it('is 5 feet for a melee weapon and 5 feet more with the reach property', () => {
    for (const item of equipment) {
      if (item.equipment_category.index !== 'weapon' || item.weapon_range !== 'Melee') {
        expect(item.reach_ft, item.index).toBeUndefined();
        continue;
      }
      const hasReach = item.properties!.some((p) => p.index === 'reach');
      expect(item.reach_ft, item.index).toBe(5 + (hasReach ? reachBonus : 0));
    }
  });

  it('names the five weapons with reach', () => {
    expect(equipment.filter((i) => i.reach_ft === 10).map((i) => i.index)).toEqual([
      'glaive',
      'halberd',
      'lance',
      'pike',
      'whip',
    ]);
  });
});

describe('bundle_size', () => {
  it('is the quantity of a bundle of ammunition', () => {
    for (const item of equipment.filter((i) => i.quantity !== undefined)) {
      expect(item.bundle_size, item.index).toBe(item.quantity);
    }
    expect(
      Object.fromEntries(equipment.filter((i) => i.quantity).map((i) => [i.index, i.bundle_size]))
    ).toEqual({ arrow: 20, 'blowgun-needle': 50, 'crossbow-bolt': 20, 'sling-bullet': 20 });
  });

  it('is the count of the bag named in an item name, and set on no other item', () => {
    const sized = equipment.filter((i) => i.bundle_size !== undefined);
    expect(sized.map((i) => i.index)).toEqual([
      'arrow',
      'blowgun-needle',
      'crossbow-bolt',
      'sling-bullet',
      'ball-bearings-bag-of-1000',
    ]);
    expect(equipment.find((i) => i.index === 'ball-bearings-bag-of-1000')!.bundle_size).toBe(1000);
  });
});

describe('effects', () => {
  const withEffects = [...equipment, ...magicItems].filter((i) => i.effects);

  it('are on exactly the items that have an effect or an enchantment', () => {
    for (const item of [...equipment, ...magicItems]) {
      const old = item as Equipment & MagicItem;
      const expected = Boolean(old.effect ?? old.enchantment);
      expect(item.effects !== undefined, item.index).toBe(expected);
    }
    expect(equipment.filter((i) => i.effects).length).toBe(2);
    expect(magicItems.filter((i) => i.effects).length).toBe(68);
  });

  it('use only known damage types, proficiencies, traits and skills', () => {
    for (const item of withEffects) {
      for (const effect of item.effects!) {
        for (const type of effect.resistances ?? []) {
          expect(damageTypes.has(type), `${item.index} resistance ${type}`).toBe(true);
        }
        for (const damage of [...(effect.damage ?? []), ...(effect.attack?.extra_damage ?? [])]) {
          expect(damageTypes.has(damage.damage_type), `${item.index} ${damage.damage_type}`).toBe(
            true
          );
        }
        for (const id of effect.proficiencies ?? []) {
          expect(proficiencies.has(id), `${item.index} proficiency ${id}`).toBe(true);
        }
        for (const id of effect.traits ?? [])
          expect(traits.has(id), `${item.index} trait ${id}`).toBe(true);
        if (effect.skill_check) {
          expect(skills.has(effect.skill_check.skill), `${item.index} skill`).toBe(true);
        }
      }
    }
  });

  it('have one entry for each activation, and no entry without an effect', () => {
    for (const item of withEffects) {
      const activations = item.effects!.map((e) => e.activation);
      expect(new Set(activations).size, item.index).toBe(activations.length);
      for (const effect of item.effects!) {
        const { activation, duration, ...rest } = effect;
        expect(Object.keys(rest).length, `${item.index} ${activation}`).toBeGreaterThan(0);
        if (duration) expect(activation, item.index).toBe('use');
      }
    }
  });

  it('apply while attuned only to items that need attunement', () => {
    for (const item of magicItems.filter((i) =>
      i.effects?.some((e) => e.activation === 'attuned')
    )) {
      expect(item.requires_attunement, item.index).toBe(true);
    }
  });

  it('keep every value of the old effect and enchantment', () => {
    for (const item of magicItems.filter((i) => i.effects)) {
      const effects = item.effects!;
      const flat = <K extends keyof ItemEffect>(key: K) =>
        effects.find((e) => e[key] !== undefined)?.[key];
      const { effect: old, enchantment } = item;
      if (old?.armor_class_modifier !== undefined) {
        expect(flat('armor_class'), item.index).toEqual({ bonus: old.armor_class_modifier });
      }
      if (enchantment?.armor_class_bonus !== undefined) {
        expect(flat('armor_class'), item.index).toEqual({ bonus: enchantment.armor_class_bonus });
      }
      if (!old?.armor_class_modifier && !enchantment?.armor_class_bonus) {
        expect(flat('armor_class'), item.index).toBeUndefined();
      }
      if (old?.damage_type_resistance) {
        expect(flat('resistances'), item.index).toEqual([old.damage_type_resistance]);
      }
      if (old?.heal) expect(flat('heal'), item.index).toBe(old.heal);
      if (old?.proficiency_modifier) {
        expect(flat('proficiencies'), item.index).toEqual(old.proficiency_modifier.grants);
      }
      if (old?.trait_modifier)
        expect(flat('traits'), item.index).toEqual(old.trait_modifier.grants);
      if (old?.saving_throw_modifier) {
        const { abilities, bonus, gives_advantage } = old.saving_throw_modifier;
        expect(flat('saving_throws'), item.index).toEqual({
          abilities,
          bonus,
          ...(gives_advantage ? { advantage: true } : {}),
        });
      }
      if (old?.skill_check_modifier) {
        const { skill, bonus, gives_advantage } = old.skill_check_modifier;
        expect(flat('skill_check'), item.index).toEqual({
          skill,
          ...(bonus !== undefined ? { bonus } : {}),
          ...(gives_advantage ? { advantage: true } : {}),
        });
      }
      if (enchantment && enchantment.armor_class_bonus === undefined) {
        const { to_hit_bonus, damage_bonus, extra_damage } = enchantment;
        expect(flat('attack'), item.index).toEqual({
          ...(to_hit_bonus !== undefined ? { to_hit_bonus } : {}),
          ...(damage_bonus !== undefined ? { damage_bonus } : {}),
          ...(extra_damage
            ? {
                extra_damage: [
                  {
                    damage_type: extra_damage.damage_type.index,
                    damage_dice: extra_damage.damage_dice,
                  },
                ],
              }
            : {}),
        });
      }
      if (old?.duration && ['hour', 'permanent'].includes(old.duration.unit)) {
        const entry = effects.find((e) => e.duration)!;
        expect(entry.activation, item.index).toBe('use');
        expect(entry.duration!.unit, item.index).toBe(old.duration.unit);
      }
    }
  });

  it('name the activation the old duration names', () => {
    const byUnit: Record<string, string> = {
      'while attuned': 'attuned',
      'while carried': 'carried',
      'while equipped': 'equipped',
      permanent: 'use',
      hour: 'use',
    };
    for (const item of magicItems.filter((i) => i.effect?.duration)) {
      const activation = byUnit[item.effect!.duration!.unit];
      expect(
        item.effects!.some((e) => e.activation === activation),
        item.index
      ).toBe(true);
    }
  });

  it('read the ability scores of a magic item from its text', () => {
    const differs: string[] = [];
    for (const item of magicItems.filter((i) => i.effect?.ability_score_modifier)) {
      const { amount, ability } = item.effect!.ability_score_modifier!;
      const unified = item.effects!.find((e) => e.ability)!.ability!;
      expect(unified.ability, item.index).toBe(ability);
      const text = item.desc.join(' ');
      if (amount.total !== undefined) {
        expect(unified.op, item.index).toBe('set');
        expect(text, item.index).toMatch(
          new RegExp(`score (is|changes to) (a )?${unified.value}\\b`)
        );
        if (unified.value !== amount.total) differs.push(item.index);
      } else {
        expect(unified, item.index).toEqual({
          ability,
          op: 'add',
          value: amount.increase,
          ...(amount.max !== undefined ? { cap: amount.max } : {}),
        });
        expect(text, item.index).toMatch(new RegExp(`score increases by ${amount.increase}`));
        if (amount.max !== undefined) expect(text, item.index).toMatch(`maximum of ${amount.max}`);
      }
    }
    // The old `total` of the gauntlets of ogre power is 29 and its text says 19; `effects` follows the text.
    expect(differs).toEqual(['gauntlets-of-ogre-power']);
  });

  it('map the damage of a consumable of the equipment', () => {
    for (const item of equipment.filter((i) => i.effect)) {
      expect(item.effects, item.index).toEqual([
        { activation: 'use', damage: item.effect!.damage },
      ]);
    }
  });
});
