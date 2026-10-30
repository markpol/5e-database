import { z } from 'zod';
import { APIReferenceSchema, ChoiceSchema, translatable } from '../../schemas/common';
import {
  AbilitySchema,
  FEATURE_ATTACK_KINDS,
  FEATURE_WHILE,
  ROLL_MODES,
  ROLLS,
} from '../../schemas/effects';

/**
 * `feature_specific.engine`, `grants_asi`, `heal` and `granted_proficiencies` restate, as data, what the `desc` of a
 * class feature says: what using it costs, how often it can be used, what it changes while it is owned or used, how
 * many hit points it restores, and which proficiencies it gives. None of it is SRD text and none of it is translated.
 * The values are written in src/2014/feature-engine-annotations.json and merged in by derive-feature-engine.ts.
 * docs/feature-mechanics.md describes each field, its allowed values and its units.
 */

// The key of a number (or of dice) in the `class_specific` of the feature's class rows in 5e-SRD-Levels, read at
// the owner's level in that class.
const ClassSpecificKeySchema = z.string();

const WhileSchema = z.array(z.enum(FEATURE_WHILE)).min(1);
const AttackKindSchema = z.enum(FEATURE_ATTACK_KINDS);

// A saving throw a modifier forces. `dc` names the save DC: the owner's spell save DC, or the ki save DC.
const SaveSchema = z.strictObject({
  ability: AbilitySchema,
  dc: z.enum(['spell', 'ki']),
});

const DurationSchema = z.strictObject({
  unit: z.enum(['round', 'minute', 'end_of_next_turn']),
  length: z.number().optional(),
});

// Fields every modifier can have. `while` lists circumstances that must all hold, `while_condition` a condition
// (an index of 5e-SRD-Conditions) the owner must have. Modifiers that share an `option` value apply together, and a
// use picks one option of a feature that has several.
const ModifierBase = {
  while: WhileSchema.optional(),
  while_condition: z.string().optional(),
  option: z.string().optional(),
};

const ModifierSchema = z.discriminatedUnion('type', [
  // A condition is applied to the owner (`self`) or to the creature the feature is used on (`target`).
  z.strictObject({
    type: z.literal('condition'),
    ...ModifierBase,
    condition: z.string(),
    target: z.enum(['self', 'target']),
    save: SaveSchema.optional(),
    duration: DurationSchema.optional(),
  }),
  // A change to the owner's own rolls.
  z.strictObject({
    type: z.literal('roll'),
    ...ModifierBase,
    roll: z.enum(ROLLS),
    mode: z.enum(ROLL_MODES),
    abilities: z.array(AbilitySchema).min(1).optional(),
    attack_kind: AttackKindSchema.optional(),
  }),
  // A number added to a roll, to armor class, or to the hit points a healing spell restores. Exactly one amount:
  // `flat`, `dice`, `dice_at_slot_level` (dice for each spell slot level spent), `ability_modifier`,
  // `attack_ability_modifier` (the modifier of the ability the attack uses), `class_specific` (a number or dice
  // from the Levels row), or `proficiency_multiplier` (the proficiency bonus times this, rounded as `round` says).
  // `add_spell_level` adds the level of the spell to `flat`.
  z.strictObject({
    type: z.literal('bonus'),
    ...ModifierBase,
    to: z.enum([
      'attack_roll',
      'damage_roll',
      'saving_throw',
      'armor_class',
      'ability_check',
      'healing',
    ]),
    flat: z.number().optional(),
    dice: z.string().optional(),
    dice_at_slot_level: z.record(z.string(), z.string()).optional(),
    ability_modifier: AbilitySchema.optional(),
    attack_ability_modifier: z.literal(true).optional(),
    class_specific: ClassSpecificKeySchema.optional(),
    proficiency_multiplier: z.number().optional(),
    round: z.enum(['down', 'up']).optional(),
    add_spell_level: z.literal(true).optional(),
    // The attack uses one of these abilities.
    abilities: z.array(AbilitySchema).min(1).optional(),
    attack_kind: AttackKindSchema.optional(),
    // Extra damage of this damage type.
    damage_type: z.string().optional(),
    // Only for this spell (an index of 5e-SRD-Spells).
    spell: z.string().optional(),
    // Only for spells of this level or higher.
    min_spell_level: z.number().optional(),
    minimum: z.number().optional(),
  }),
  // The owner's speed rises by `value` feet, or by the number of feet in `class_specific`.
  z.strictObject({
    type: z.literal('speed'),
    ...ModifierBase,
    op: z.literal('add'),
    value: z.number().optional(),
    class_specific: ClassSpecificKeySchema.optional(),
  }),
  // The armor class becomes `base` plus the modifiers of these abilities.
  z.strictObject({
    type: z.literal('armor_class'),
    ...ModifierBase,
    base: z.number(),
    ability_modifiers: z.array(AbilitySchema).min(1),
  }),
  // The hit point maximum rises by this much for each level in the class.
  z.strictObject({
    type: z.literal('hit_point_maximum'),
    ...ModifierBase,
    per_class_level: z.number(),
  }),
  // `count` attacks more. Without `action_cost` they are part of the Attack action; with it, they take a bonus
  // action or a reaction. `requires_attack_action`: only after taking the Attack action on the same turn.
  z.strictObject({
    type: z.literal('extra_attack'),
    ...ModifierBase,
    count: z.number(),
    attack_kind: AttackKindSchema.optional(),
    action_cost: z.enum(['bonus_action', 'reaction']).optional(),
    requires_attack_action: z.literal(true).optional(),
  }),
  // The attack and damage rolls can use `ability` instead of `instead_of`.
  z.strictObject({
    type: z.literal('attack_ability'),
    ...ModifierBase,
    ability: AbilitySchema,
    instead_of: AbilitySchema,
    attack_kind: AttackKindSchema,
  }),
  // The damage die of these attacks can be the die in `class_specific` instead of the normal damage.
  z.strictObject({
    type: z.literal('damage_die'),
    ...ModifierBase,
    class_specific: ClassSpecificKeySchema,
    attack_kind: AttackKindSchema,
  }),
  // A hit is a critical hit on an attack roll of `min_roll` or more.
  z.strictObject({
    type: z.literal('critical_range'),
    ...ModifierBase,
    min_roll: z.number(),
    attack_kind: AttackKindSchema,
  }),
  // Damage dice that roll one of `faces` can be rolled again, once.
  z.strictObject({
    type: z.literal('reroll_damage'),
    ...ModifierBase,
    faces: z.array(z.number()).min(1),
    attack_kind: AttackKindSchema,
  }),
  // The damage the owner takes is halved (`op: "halve"`) or reduced by an amount: dice, an ability modifier, the
  // class level, and the class level times `class_level_multiplier`, summed. `source` limits it to damage from a
  // fall, `attack_kind` to damage from that kind of attack.
  z.strictObject({
    type: z.literal('reduce_damage'),
    ...ModifierBase,
    op: z.literal('halve').optional(),
    dice: z.string().optional(),
    ability_modifier: AbilitySchema.optional(),
    add_class_level: z.literal(true).optional(),
    class_level_multiplier: z.number().optional(),
    attack_kind: AttackKindSchema.optional(),
    source: z.literal('falling').optional(),
  }),
  // Rolls that another creature makes against a creature within `within_ft` feet of the owner, other than the owner.
  z.strictObject({
    type: z.literal('rolls_against_others'),
    ...ModifierBase,
    roll: z.literal('attack'),
    mode: z.enum(['advantage', 'disadvantage']),
    within_ft: z.number(),
  }),
  // A die from `class_specific` that a creature within `range_ft` feet adds to (`effect: "add"`, an ally) or that
  // the owner subtracts from (`effect: "subtract"`, an enemy) one of `rolls`.
  z.strictObject({
    type: z.literal('die'),
    ...ModifierBase,
    class_specific: ClassSpecificKeySchema,
    effect: z.enum(['add', 'subtract']),
    rolls: z.array(z.enum(['attack', 'ability_check', 'saving_throw', 'damage'])).min(1),
    range_ft: z.number(),
  }),
  // Using the feature takes one of these actions.
  z.strictObject({
    type: z.literal('actions'),
    ...ModifierBase,
    actions: z
      .array(
        z.enum([
          'dash',
          'disengage',
          'dodge',
          'hide',
          'use_an_object',
          'sleight_of_hand_check',
          'thieves_tools',
        ])
      )
      .min(1),
  }),
  // Creatures of these types within `range_ft` feet must make `save` or be turned for `duration`.
  z.strictObject({
    type: z.literal('turn'),
    ...ModifierBase,
    creature_types: z.array(z.string()).min(1),
    range_ft: z.number(),
    save: SaveSchema,
    duration: DurationSchema,
  }),
  // A creature of these types that fails its save against the owner's turning is destroyed if its challenge rating
  // is at most the number in `class_specific`.
  z.strictObject({
    type: z.literal('destroy'),
    ...ModifierBase,
    creature_types: z.array(z.string()).min(1),
    class_specific: ClassSpecificKeySchema,
  }),
  // The target is pushed up to `distance_ft` feet away from the owner, after failing `save` if there is one.
  z.strictObject({
    type: z.literal('push'),
    ...ModifierBase,
    distance_ft: z.number(),
    save: SaveSchema.optional(),
    spell: z.string().optional(),
  }),
  // Temporary hit points: the ability modifier plus the class level, at least `minimum`.
  z.strictObject({
    type: z.literal('temp_hp'),
    ...ModifierBase,
    ability_modifier: AbilitySchema.optional(),
    add_class_level: z.literal(true).optional(),
    minimum: z.number().optional(),
  }),
  // Immunity to conditions (indexes of 5e-SRD-Conditions), or to `disease`.
  z.strictObject({
    type: z.literal('immune_to'),
    ...ModifierBase,
    conditions: z.array(z.string()).min(1),
  }),
  // The owner can cast `spell` (an index of 5e-SRD-Spells). `slot`: `none` without expending a spell slot, or
  // `spell_slot` by expending one. `at_level` is the level it is cast at. `self_only` limits it to the owner as
  // the target, `ritual_only` to casting it as a ritual, and `no_material` drops its material components.
  z.strictObject({
    type: z.literal('spell'),
    ...ModifierBase,
    spell: z.string(),
    slot: z.enum(['none', 'spell_slot']),
    at_level: z.number().optional(),
    self_only: z.literal(true).optional(),
    ritual_only: z.literal(true).optional(),
    no_material: z.literal(true).optional(),
  }),
  // A change to one casting of a spell. `range_ft` is the new range of `range`.
  z.strictObject({
    type: z.literal('spell_change'),
    ...ModifierBase,
    change: z.enum([
      'double_range',
      'touch_range_30_ft',
      'range',
      'double_duration',
      'bonus_action_casting_time',
      'no_verbal_or_somatic',
      'second_target',
      'reroll_damage_dice',
      'save_disadvantage',
    ]),
    spell: z.string().optional(),
    range_ft: z.number().optional(),
  }),
  // Creatures the owner chooses automatically succeed on their saving throws against the spell, and with
  // `no_half_damage` take no damage where a success would halve it. Their number is the ability modifier (at
  // least `minimum`), or `base` plus the spell's level (`add_spell_level`). `school` limits it to spells of that
  // school (an index of 5e-SRD-Magic-Schools).
  z.strictObject({
    type: z.literal('protect_from_spell'),
    ...ModifierBase,
    ability_modifier: AbilitySchema.optional(),
    minimum: z.number().optional(),
    base: z.number().optional(),
    add_spell_level: z.literal(true).optional(),
    no_half_damage: z.literal(true).optional(),
    school: z.string().optional(),
  }),
  // These features (indexes of 5e-SRD-Features) recharge as `recharge` says instead.
  z.strictObject({
    type: z.literal('recharge'),
    ...ModifierBase,
    features: z.array(z.string()).min(1),
    recharge: z.enum(['short_rest', 'long_rest']),
  }),
  // Expended spell slots are recovered, of a combined level up to the number in `class_specific`, or up to the
  // class level times `class_level_multiplier` rounded as `round` says, and none above `max_slot_level`.
  z.strictObject({
    type: z.literal('recover_spell_slots'),
    ...ModifierBase,
    class_specific: ClassSpecificKeySchema.optional(),
    class_level_multiplier: z.number().optional(),
    round: z.enum(['down', 'up']).optional(),
    max_slot_level: z.number(),
  }),
  // Sorcery points are turned into a spell slot at the cost listed in `class_specific` (`points_to_slot`), or a
  // spell slot into sorcery points equal to its level (`slot_to_points`).
  z.strictObject({
    type: z.literal('spell_slot_conversion'),
    ...ModifierBase,
    direction: z.enum(['points_to_slot', 'slot_to_points']),
    class_specific: ClassSpecificKeySchema.optional(),
  }),
  // The owner takes the shape of a beast within the limits of these `class_specific` keys.
  z.strictObject({
    type: z.literal('wild_shape'),
    ...ModifierBase,
    class_specific: z.array(ClassSpecificKeySchema).min(1),
  }),
]);

// How many times the feature can be used before it recharges, or how many points or hit points it holds. The
// number is `count`, plus the number in `class_specific`, plus the ability modifier, plus `per_class_level` times
// the class level, and at least `minimum`. `unit` is `use` when absent.
const OwnUsesSchema = z.strictObject({
  count: z.number().optional(),
  class_specific: ClassSpecificKeySchema.optional(),
  ability_modifier: AbilitySchema.optional(),
  per_class_level: z.number().optional(),
  minimum: z.number().optional(),
  unit: z.enum(['use', 'point', 'hit_point']).optional(),
});

// Each use spends `cost` from the uses of `pool` (the index of another feature). `cost` is a number, or the level
// of the spell for a Metamagic option. `cost_class_specific` names a table of costs in the Levels row instead.
const PoolUsesSchema = z.strictObject({
  pool: z.string(),
  cost: z.union([z.number(), z.literal('spell_level')]).optional(),
  cost_class_specific: ClassSpecificKeySchema.optional(),
});

// Each use expends one of the owner's spell slots.
const SpellSlotUsesSchema = z.strictObject({ spell_slot: z.literal(true) });

const FeatureEngineSchema = z.strictObject({
  action_cost: z.enum(['action', 'bonus_action', 'reaction', 'free', 'passive', 'rest']),
  recharge: z.enum(['short_rest', 'long_rest', 'day', 'turn']).optional(),
  uses: z.union([OwnUsesSchema, PoolUsesSchema, SpellSlotUsesSchema]).optional(),
  modifiers: z.array(ModifierSchema).min(1).optional(),
});

// Hit points the feature restores: `dice`, plus `bonus`, plus the ability modifier, plus the class level
// (`add_class_level`), plus the class level times `class_level_multiplier`. `from_uses`: as many as the owner
// spends from the feature's `uses`.
const HealSchema = z.strictObject({
  dice: z.string().optional(),
  bonus: z.number().optional(),
  ability_modifier: AbilitySchema.optional(),
  add_class_level: z.literal(true).optional(),
  class_level_multiplier: z.number().optional(),
  from_uses: z.literal(true).optional(),
});

// A proficiency (a reference into 5e-SRD-Proficiencies), or a number of skill proficiencies of the owner's choice.
const GrantedProficiencySchema = z.union([
  APIReferenceSchema,
  z.strictObject({ choose: z.number(), from: z.literal('skills') }),
]);

const FeatureSpecificSchema = z.strictObject({
  invocations: z.array(APIReferenceSchema).optional(),
  expertise_options: ChoiceSchema.optional(),
  subfeature_options: ChoiceSchema.optional(),
  terrain_type_options: ChoiceSchema.optional(),
  enemy_type_options: ChoiceSchema.optional(),
  engine: FeatureEngineSchema.optional(),
  // The feature is an Ability Score Improvement.
  grants_asi: z.literal(true).optional(),
  heal: HealSchema.optional(),
  granted_proficiencies: z.array(GrantedProficiencySchema).min(1).optional(),
});

const FeaturePrerequisiteSchema = z.strictObject({
  type: z.string(),
  level: z.number().optional(),
  feature: z.string().optional(),
  spell: z.string().optional(),
});

export const FeatureSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  level: z.number(),
  class: APIReferenceSchema.optional(),
  subclass: APIReferenceSchema.optional(),
  desc: translatable(z.array(z.string())),
  prerequisites: z.array(FeaturePrerequisiteSchema),
  parent: APIReferenceSchema.optional(),
  reference: z.string().optional(),
  feature_specific: FeatureSpecificSchema.optional(),
  url: z.string(),
});
