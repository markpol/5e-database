import fs from 'node:fs';
import path from 'node:path';

// The structured scalar fields and the unified `effects` of the items in src/2014/en/5e-SRD-Equipment.json and
// src/2014/en/5e-SRD-Magic-Items.json: `cost_cp`, `bundle_size`, `reach_ft`, `rarity.rank`, `rarity.min_level` and
// `effects`. They are read from the existing `cost`, `quantity`, `name`, `properties`, `rarity`, `effect`,
// `enchantment` and `requires_attunement` fields and from the item text; docs/item-data.md describes the rules and
// src/2014/tests/item-data.test.ts audits the result against the text and the other fields with rules that do not
// share code with the derivation.

type Cost = { quantity: number; unit: string };
type Damage = { damage_type: string; damage_dice: string };
type Duration = { unit: string; length?: number };
type Effect = Record<string, unknown> & { activation: string };
type Item = Record<string, unknown> & { index: string };
type Equipment = Item & {
  name: string;
  cost: Cost;
  quantity?: number;
  weapon_range?: string;
  properties?: { index: string }[];
  effect?: { damage?: Damage[] };
};
type MagicItem = Item & {
  desc: string[];
  rarity: { name: string };
  cost?: Cost;
  requires_attunement?: boolean;
  is_consumable?: boolean;
  effect?: OldMagicEffect;
  enchantment?: OldEnchantment;
};
type OldMagicEffect = {
  ability_score_modifier?: {
    ability: string;
    amount: { total?: number; increase?: number; max?: number };
  };
  armor_class_modifier?: number;
  damage_type_resistance?: string;
  duration?: Duration;
  heal?: string;
  proficiency_modifier?: { grants: string[] };
  saving_throw_modifier?: { abilities: string[]; bonus: number; gives_advantage?: boolean };
  skill_check_modifier?: { skill: string; bonus?: number; gives_advantage?: boolean };
  trait_modifier?: { grants: string[] };
};
type OldEnchantment = {
  armor_class_bonus?: number;
  damage_bonus?: number;
  to_hit_bonus?: number;
  extra_damage?: { damage_type: { index: string }; damage_dice: string };
};

// Copper pieces in one coin of each unit of `cost`. The SRD has no electrum or platinum prices in this data; the
// table is the SRD coin table, and `ep` and `pp` are here so that every SRD unit converts.
export const COPPER_PER_UNIT: Record<string, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };

export const RARITY_RANK: Record<string, number> = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  'Very Rare': 4,
  Legendary: 5,
  Artifact: 6,
};

// The character level from which an item of the rarity is a fitting reward, following the tiers of play: levels
// 1 to 4, 5 to 10, 11 to 16 and 17 to 20. A common item belongs to the first tier, like an uncommon one.
export const RARITY_MIN_LEVEL: Record<string, number> = {
  Common: 1,
  Uncommon: 1,
  Rare: 5,
  'Very Rare': 11,
  Legendary: 17,
};

// A weapon with the reach property adds 5 feet to the 5 feet of every other melee weapon.
export const BASE_REACH_FT = 5;
export const REACH_PROPERTY_BONUS_FT = 5;

/** `cost_cp`: the price of `cost` in copper pieces. */
export function costInCopper(item: { index: string; cost?: Cost }): number | undefined {
  if (!item.cost) return undefined;
  const perUnit = COPPER_PER_UNIT[item.cost.unit];
  if (perUnit === undefined)
    throw new Error(`${item.index}: no copper value for ${item.cost.unit}`);
  return item.cost.quantity * perUnit;
}

/** `bundle_size`: the `quantity` of an item sold as a bundle, or the count in a name such as "(bag of 1,000)". */
export function bundleSize(item: Equipment): number | undefined {
  if (item.quantity !== undefined) return item.quantity;
  const match = item.name.match(/\(bag of ([\d,]+)\)/);
  return match ? Number(match[1].replace(/,/g, '')) : undefined;
}

/** `reach_ft` of a melee weapon. */
export function reachFeet(item: Equipment): number | undefined {
  if (item.weapon_range !== 'Melee') return undefined;
  const reach = item.properties?.some((property) => property.index === 'reach');
  return BASE_REACH_FT + (reach ? REACH_PROPERTY_BONUS_FT : 0);
}

/** The score a magic item sets, from the sentence "score is 19" or "score changes to a 21". */
function scoreFromText(item: MagicItem): number | undefined {
  const match = item.desc.join(' ').match(/score (?:is|changes to) (?:a )?(\d+)/);
  return match ? Number(match[1]) : undefined;
}

/**
 * When a magic item without a duration applies: the old `effect.duration.unit` says it for the passive items, a
 * consumable is used up, and any other item applies while it is attuned to, or while it is worn if it needs no
 * attunement.
 */
function activationOf(item: MagicItem, duration: Duration | undefined): string {
  const byUnit: Record<string, string> = {
    'while attuned': 'attuned',
    'while carried': 'carried',
    'while equipped': 'equipped',
    permanent: 'use',
    hour: 'use',
  };
  if (duration) {
    const activation = byUnit[duration.unit];
    if (!activation) throw new Error(`${item.index}: no activation for duration ${duration.unit}`);
    return activation;
  }
  if (item.is_consumable) return 'use';
  return item.requires_attunement ? 'attuned' : 'equipped';
}

function effectOfOldEffect(item: MagicItem, old: OldMagicEffect): Effect {
  const effect: Effect = { activation: activationOf(item, old.duration) };
  if (old.duration && ['permanent', 'hour'].includes(old.duration.unit)) {
    effect.duration =
      old.duration.unit === 'permanent'
        ? { unit: 'permanent' }
        : { unit: old.duration.unit, length: old.duration.length };
  }
  if (old.armor_class_modifier !== undefined) {
    effect.armor_class = { bonus: old.armor_class_modifier };
  }
  const ability = old.ability_score_modifier;
  if (ability) {
    const { total, increase, max } = ability.amount;
    effect.ability =
      total !== undefined
        ? { ability: ability.ability, op: 'set', value: scoreFromText(item) ?? total }
        : {
            ability: ability.ability,
            op: 'add',
            value: increase,
            ...(max !== undefined ? { cap: max } : {}),
          };
  }
  if (old.damage_type_resistance) effect.resistances = [old.damage_type_resistance];
  if (old.heal) effect.heal = old.heal;
  const save = old.saving_throw_modifier;
  if (save) {
    effect.saving_throws = {
      abilities: save.abilities,
      bonus: save.bonus,
      ...(save.gives_advantage ? { advantage: true } : {}),
    };
  }
  const skill = old.skill_check_modifier;
  if (skill) {
    effect.skill_check = {
      skill: skill.skill,
      ...(skill.bonus !== undefined ? { bonus: skill.bonus } : {}),
      ...(skill.gives_advantage ? { advantage: true } : {}),
    };
  }
  if (old.proficiency_modifier) effect.proficiencies = old.proficiency_modifier.grants;
  if (old.trait_modifier) effect.traits = old.trait_modifier.grants;
  return effect;
}

function effectOfEnchantment(item: MagicItem, old: OldEnchantment): Effect {
  const effect: Effect = { activation: item.requires_attunement ? 'attuned' : 'equipped' };
  if (old.armor_class_bonus !== undefined) effect.armor_class = { bonus: old.armor_class_bonus };
  if (
    old.to_hit_bonus !== undefined ||
    old.damage_bonus !== undefined ||
    old.extra_damage !== undefined
  ) {
    effect.attack = {
      ...(old.to_hit_bonus !== undefined ? { to_hit_bonus: old.to_hit_bonus } : {}),
      ...(old.damage_bonus !== undefined ? { damage_bonus: old.damage_bonus } : {}),
      ...(old.extra_damage
        ? {
            extra_damage: [
              {
                damage_type: old.extra_damage.damage_type.index,
                damage_dice: old.extra_damage.damage_dice,
              },
            ],
          }
        : {}),
    };
  }
  return effect;
}

/** Folds effects with the same activation and duration into one, in the order of first appearance. */
function mergeEffects(index: string, effects: Effect[]): Effect[] {
  const merged: Effect[] = [];
  for (const effect of effects) {
    const same = merged.find(
      (m) =>
        m.activation === effect.activation &&
        JSON.stringify(m.duration) === JSON.stringify(effect.duration)
    );
    if (!same) {
      merged.push(effect);
      continue;
    }
    for (const [key, value] of Object.entries(effect)) {
      if (key === 'activation' || key === 'duration') continue;
      if (key in same)
        throw new Error(`${index}: two ${effect.activation} effects both set ${key}`);
      same[key] = value;
    }
  }
  return merged;
}

/** The unified `effects` of a magic item, from its `effect` and `enchantment`. */
export function magicItemEffects(item: MagicItem): Effect[] | undefined {
  const effects = [
    ...(item.effect ? [effectOfOldEffect(item, item.effect)] : []),
    ...(item.enchantment ? [effectOfEnchantment(item, item.enchantment)] : []),
  ];
  return effects.length ? mergeEffects(item.index, effects) : undefined;
}

/** The unified `effects` of a piece of equipment: its damage when used. */
export function equipmentEffects(item: Equipment): Effect[] | undefined {
  if (!item.effect) return undefined;
  const { damage } = item.effect;
  return damage ? [{ activation: 'use', damage }] : undefined;
}

const defined = (entries: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== undefined));

export function deriveEquipment(items: Equipment[]): Equipment[] {
  return items.map((item) => ({
    ...item,
    ...defined({
      cost_cp: costInCopper(item),
      bundle_size: bundleSize(item),
      reach_ft: reachFeet(item),
      effects: equipmentEffects(item),
    }),
  }));
}

export function deriveMagicItems(items: MagicItem[]): MagicItem[] {
  return items.map((item) => ({
    ...item,
    rarity: {
      ...item.rarity,
      ...defined({
        rank: RARITY_RANK[item.rarity.name],
        min_level: RARITY_MIN_LEVEL[item.rarity.name],
      }),
    },
    ...defined({ cost_cp: costInCopper(item), effects: magicItemEffects(item) }),
  }));
}

const repoRoot = path.resolve(import.meta.dirname, '../..');
const equipmentFile = path.join(repoRoot, 'src/2014/en/5e-SRD-Equipment.json');
const magicItemsFile = path.join(repoRoot, 'src/2014/en/5e-SRD-Magic-Items.json');

function writeItemsToFiles() {
  const equipment = JSON.parse(fs.readFileSync(equipmentFile, 'utf8')) as Equipment[];
  const magicItems = JSON.parse(fs.readFileSync(magicItemsFile, 'utf8')) as MagicItem[];
  fs.writeFileSync(equipmentFile, `${JSON.stringify(deriveEquipment(equipment), null, 2)}\n`);
  fs.writeFileSync(magicItemsFile, `${JSON.stringify(deriveMagicItems(magicItems), null, 2)}\n`);
  console.log(
    `Derived the item data of ${equipment.length} equipment and ${magicItems.length} magic items`
  );
}

if (process.argv[1]?.endsWith('/derive-item-data.ts')) {
  writeItemsToFiles();
}
