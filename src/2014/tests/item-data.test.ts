import { describe, expect, it } from 'vitest';
import DamageTypeData from '../en/5e-SRD-Damage-Types.json' with { type: 'json' };
import EquipmentData from '../en/5e-SRD-Equipment.json' with { type: 'json' };
import MagicItemData from '../en/5e-SRD-Magic-Items.json' with { type: 'json' };
import ProficiencyData from '../en/5e-SRD-Proficiencies.json' with { type: 'json' };
import SkillData from '../en/5e-SRD-Skills.json' with { type: 'json' };
import TraitData from '../en/5e-SRD-Traits.json' with { type: 'json' };
import WeaponPropertyData from '../en/5e-SRD-Weapon-Properties.json' with { type: 'json' };
import { deriveEquipment, deriveMagicItems, ITEM_USES_EXCLUDED } from '../derive-item-data';

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
  aliases?: string[];
  proficiency_ids?: string[];
  armor_category?: string;
  armor_class?: { base: number; dex_bonus: boolean; max_bonus?: number };
  weapon_category?: string;
  tool_category?: string;
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
  variants: { index: string }[];
  proficiency_ids?: string[];
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
  uses?: { count: number; unit: string; recharge?: string; regain?: string };
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

describe('armor_class.max_bonus', () => {
  const armor = equipment.filter((i) => i.armor_class);

  it('is set on every armor that caps the Dexterity bonus, and not on light armor', () => {
    expect(armor).toHaveLength(13);
    for (const item of armor) {
      const { dex_bonus, max_bonus } = item.armor_class!;
      if (item.armor_category === 'Light') {
        expect(dex_bonus, item.index).toBe(true);
        expect(max_bonus, item.index).toBeUndefined();
      } else if (item.armor_category === 'Medium') {
        expect(max_bonus, item.index).toBe(2);
      } else {
        expect(dex_bonus, item.index).toBe(false);
        expect(max_bonus, item.index).toBe(0);
      }
    }
  });

  it('counts the armor of each kind', () => {
    const counts: Record<string, number> = {};
    for (const item of armor) {
      const key = `${item.armor_category}:${item.armor_class!.max_bonus}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    expect(counts).toEqual({ 'Light:undefined': 3, 'Medium:2': 5, 'Heavy:0': 4, 'Shield:0': 1 });
  });
});

// The proficiency of each piece of equipment, written out by name and not read from the derivation: the plural
// proficiency index of the weapon or armor, and the irregular ones.
const weaponProficiency: Record<string, string> = {
  'crossbow-light': 'crossbows-light',
  'crossbow-hand': 'hand-crossbows',
  'crossbow-heavy': 'crossbows-heavy',
};
const armorProficiency: Record<string, string> = { shield: 'shields' };
const categoryProficiency: Record<string, string> = {
  Simple: 'simple-weapons',
  Martial: 'martial-weapons',
  Light: 'light-armor',
  Medium: 'medium-armor',
  Heavy: 'heavy-armor',
};
const plural = (index: string) => `${index}s`;

describe('proficiency_ids', () => {
  const covered = equipment.filter((i) => i.weapon_category || i.armor_category || i.tool_category);

  it('is set on the 37 weapons, 13 armor and 31 tools, and on no other equipment', () => {
    expect(covered).toHaveLength(81);
    expect(equipment.filter((i) => i.proficiency_ids).map((i) => i.index)).toEqual(
      covered.map((i) => i.index)
    );
    expect(covered.filter((i) => i.weapon_category)).toHaveLength(37);
    expect(covered.filter((i) => i.armor_category)).toHaveLength(13);
    expect(covered.filter((i) => i.tool_category)).toHaveLength(31);
  });

  it('names only proficiencies that exist, without duplicates', () => {
    for (const item of [...equipment, ...magicItems]) {
      expect(new Set(item.proficiency_ids).size, item.index).toBe(
        item.proficiency_ids?.length ?? 0
      );
      for (const id of item.proficiency_ids ?? []) {
        expect(proficiencies.has(id), `${item.index}: ${id}`).toBe(true);
      }
    }
  });

  it('gives a weapon its own proficiency and its category', () => {
    for (const item of covered.filter((i) => i.weapon_category)) {
      const own = weaponProficiency[item.index] ?? plural(item.index);
      const expected = [own, categoryProficiency[item.weapon_category!]];
      // The net has no proficiency of its own.
      expect(item.proficiency_ids, item.index).toEqual(
        item.index === 'net' ? [expected[1]] : expected
      );
    }
  });

  it('gives an armor its own proficiency and its category', () => {
    for (const item of covered.filter((i) => i.armor_category)) {
      expect(item.proficiency_ids, item.index).toEqual(
        item.index === 'shield'
          ? ['shields']
          : [item.index, categoryProficiency[item.armor_category!]]
      );
    }
    for (const [index, id] of Object.entries(armorProficiency)) {
      expect(equipment.find((i) => i.index === index)!.proficiency_ids).toEqual([id]);
    }
  });

  it('gives a tool its own proficiency only', () => {
    for (const item of covered.filter((i) => i.tool_category)) {
      expect(item.proficiency_ids, item.index).toEqual([item.index]);
    }
  });

  it('is the proficiency whose reference is the equipment, for every weapon, armor and tool', () => {
    const references = new Map(
      (ProficiencyData as unknown as { index: string; reference?: { index: string } }[])
        .filter((p) => p.reference)
        .map((p) => [p.reference!.index, p.index])
    );
    for (const item of covered) {
      const own = references.get(item.index);
      expect(item.proficiency_ids![0] === own || own === undefined, item.index).toBe(true);
    }
  });

  it('follows the variants of the magic weapons and armor that name a kind', () => {
    const byIndex = new Map(equipment.map((i) => [i.index, i]));
    const withProficiencies = magicItems.filter((i) => i.proficiency_ids);
    expect(withProficiencies.map((i) => i.index)).toEqual([
      'dancing-sword',
      'defender',
      'dragon-scale-mail',
      ...[
        'black',
        'blue',
        'brass',
        'bronze',
        'copper',
        'gold',
        'green',
        'red',
        'silver',
        'white',
      ].map((colour) => `dragon-scale-mail-${colour}`),
      'dwarven-plate',
      'elven-chain',
      'flame-tongue',
      'frost-brand',
    ]);
    const swords = ['greatsword', 'longsword', 'rapier', 'scimitar', 'shortsword'];
    for (const index of ['dancing-sword', 'defender', 'flame-tongue', 'frost-brand']) {
      const item = magicItems.find((i) => i.index === index)!;
      expect(
        item.variants.map((v) => v.index),
        index
      ).toEqual(swords);
      expect(new Set(item.proficiency_ids), index).toEqual(
        new Set(['martial-weapons', ...swords.map((s) => byIndex.get(s)!.proficiency_ids![0])])
      );
    }
    for (const item of magicItems.filter((i) => i.index.startsWith('dragon-scale-mail'))) {
      expect(item.proficiency_ids, item.index).toEqual(['scale-mail', 'medium-armor']);
    }
    expect(magicItems.find((i) => i.index === 'elven-chain')!.proficiency_ids).toEqual([
      'chain-shirt',
      'medium-armor',
    ]);
    // The data gives the dwarven plate a half plate and a plate variant.
    expect(magicItems.find((i) => i.index === 'dwarven-plate')!.proficiency_ids).toEqual([
      'half-plate-armor',
      'medium-armor',
      'plate-armor',
      'heavy-armor',
    ]);
  });
});

describe('aliases', () => {
  it('is the natural-order name of every "Noun, adjective" equipment name', () => {
    const aliased = equipment.filter((i) => i.aliases);
    expect(aliased).toHaveLength(23);
    for (const item of equipment) {
      const outsideParentheses = item.name.replace(/ \(.*\)$/, '');
      expect(item.aliases !== undefined, item.index).toBe(outsideParentheses.includes(','));
    }
    expect(aliased.map((i) => [i.name, ...i.aliases!])).toEqual([
      ['Crossbow, light', 'Light crossbow'],
      ['Crossbow, hand', 'Hand crossbow'],
      ['Crossbow, heavy', 'Heavy crossbow'],
      ['Bottle, glass', 'Glass bottle'],
      ['Case, crossbow bolt', 'Crossbow bolt case'],
      ['Case, map or scroll', 'Map or scroll case'],
      ['Clothes, common', 'Common clothes'],
      ['Clothes, costume', 'Costume clothes'],
      ['Clothes, fine', 'Fine clothes'],
      ["Clothes, traveler's", "Traveler's clothes"],
      ['Hammer, sledge', 'Sledge hammer'],
      ['Lantern, bullseye', 'Bullseye lantern'],
      ['Lantern, hooded', 'Hooded lantern'],
      ['Mirror, steel', 'Steel mirror'],
      ["Pick, miner's", "Miner's pick"],
      ['Poison, basic (vial)', 'Basic poison (vial)'],
      ['Pot, iron', 'Iron pot'],
      ['Ram, portable', 'Portable ram'],
      ['Rope, hempen (50 feet)', 'Hempen rope (50 feet)'],
      ['Rope, silk (50 feet)', 'Silk rope (50 feet)'],
      ["Scale, merchant's", "Merchant's scale"],
      ['Spike, iron', 'Iron spike'],
      ['Tent, two-person', 'Two-person tent'],
    ]);
  });

  it('differs from the name and is not repeated', () => {
    for (const item of equipment.filter((i) => i.aliases)) {
      expect(new Set(item.aliases).size, item.index).toBe(item.aliases!.length);
      expect(item.aliases, item.index).not.toContain(item.name);
    }
  });
});

describe('uses', () => {
  const text = (item: MagicItem) => item.desc.join(' ');
  // The spelling of the dice in the text is "1d4 + 1"; the data has "1d4+1".
  const compact = (value: string) => value.replace(/\s*\+\s*/g, '+');
  const withUses = magicItems.filter((item) => item.uses);
  const wordsOf: Record<number, string> = { 1: 'one', 3: 'three' };

  // What makes an item's text limit its use: a count of charges, a recharge at dawn or after a rest, a number of
  // days or a period between two uses.
  const LIMIT =
    /\bcharges?\b|\bdawn\b|\bdaily\b|\bonce (?:per|each|a) (?:day|hour)\b|\b\d+ days have passed\b|\b(?:until|before) (?:you (?:finish|take) )?(?:taking )?a long rest\b/i;
  const mentionsLimit = (item: MagicItem) => LIMIT.test(text(item));

  it('is on every item whose text limits its use, unless the item is listed with a reason', () => {
    for (const item of magicItems) {
      if (!mentionsLimit(item)) continue;
      const excluded = item.index in ITEM_USES_EXCLUDED;
      expect(item.uses !== undefined || excluded, `${item.index} has no uses and no reason`).toBe(
        true
      );
    }
  });

  it('is on no item that is listed as excluded, and on no item whose text does not limit its use', () => {
    for (const [index, reason] of Object.entries(ITEM_USES_EXCLUDED)) {
      const item = magicItems.find((i) => i.index === index);
      expect(item, index).toBeDefined();
      expect(item!.uses, index).toBeUndefined();
      expect(mentionsLimit(item!), `${index} no longer mentions a limit`).toBe(true);
      expect(reason.length, index).toBeGreaterThan(20);
    }
    for (const item of withUses) expect(mentionsLimit(item), item.index).toBe(true);
  });

  it('states the count of the charges that the text states', () => {
    for (const item of withUses.filter((i) => i.uses!.unit === 'charge')) {
      const { count } = item.uses!;
      expect(text(item), item.index).toMatch(new RegExp(`\\b${count} charges\\b`));
      // Only one number of charges is stated in the text, so the count is the one the item holds.
      const counts = [
        ...text(item).matchAll(/\b(?:has|have|with|of its|starts with) (\d+) charges\b/g),
      ];
      for (const match of counts) expect(Number(match[1]), item.index).toBe(count);
    }
  });

  it('counts the uses of a property that cannot be used again until the next dawn', () => {
    for (const item of withUses.filter((i) => i.uses!.unit === 'use')) {
      const { count, recharge } = item.uses!;
      expect(recharge, item.index).toBe('dawn');
      expect(text(item), item.index).toMatch(
        /(?:can't|cannot) be used (?:this way |again )?(?:again )?until the next dawn/
      );
      if (count > 1)
        expect(text(item), item.index).toMatch(new RegExp(`once ${wordsOf[count]} `, 'i'));
    }
  });

  it('recharges at dawn exactly when the text says the charges come back at dawn', () => {
    for (const item of withUses.filter((i) => i.uses!.unit === 'charge')) {
      const { recharge, regain } = item.uses!;
      const back = compact(text(item)).match(
        /regains? (all|\d+d\d+(?:\+\d+)?) expended charges(?: daily at dawn)?/
      );
      expect(Boolean(recharge), item.index).toBe(Boolean(back));
      if (!back) {
        expect(text(item), item.index).not.toMatch(/\bdawn\b/);
        expect(regain, item.index).toBeUndefined();
        continue;
      }
      expect(recharge, item.index).toBe('dawn');
      expect(text(item), item.index).toMatch(/daily at dawn/);
      expect(regain ?? 'all', item.index).toBe(back[1]);
    }
  });

  it('has only known members and values', () => {
    for (const item of withUses) {
      const uses = item.uses!;
      expect(
        Object.keys(uses).every((k) => ['count', 'unit', 'recharge', 'regain'].includes(k)),
        item.index
      ).toBe(true);
      expect(Number.isInteger(uses.count) && uses.count > 0, item.index).toBe(true);
      expect(['charge', 'use'], item.index).toContain(uses.unit);
      if (uses.regain) expect(uses.regain, item.index).toMatch(/^\d+d\d+(\+\d+)?$/);
      if (uses.regain) expect(uses.recharge, item.index).toBe('dawn');
    }
  });

  it('counts the items structured and the items excluded', () => {
    expect(withUses.length).toBe(81);
    expect(withUses.filter((i) => i.uses!.unit === 'charge').length).toBe(48);
    expect(withUses.filter((i) => i.uses!.unit === 'use').length).toBe(33);
    expect(Object.keys(ITEM_USES_EXCLUDED).length).toBe(30);
  });

  it('is the same on a variant and on the item it varies', () => {
    const byIndex = new Map(magicItems.map((i) => [i.index, i]));
    for (const item of magicItems.filter((i) => i.variants.length)) {
      for (const variant of item.variants) {
        const other = byIndex.get(variant.index);
        if (!other || !item.uses || !other.uses) continue;
        expect(other.uses, variant.index).toEqual(item.uses);
      }
    }
  });
});
