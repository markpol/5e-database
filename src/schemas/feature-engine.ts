import { z } from 'zod';
import { APIReferenceSchema } from './common';
import {
  AbilitySchema,
  DAMAGE_RELATIONS,
  FEATURE_ATTACK_KINDS,
  FEATURE_ROLLS,
  FEATURE_WHILE,
  ROLL_MODES,
} from './effects';

/**
 * The structured `engine` and `granted_proficiencies` that class features (`feature_specific` in 5e-SRD-Features) and
 * feats (5e-SRD-Feats) share, so the two speak the same vocabulary. docs/feature-mechanics.md describes each field, its
 * allowed values and its units. Every value is English-only and is never translated.
 */

// The key of a number (or of dice) in the `class_specific` of the feature's class rows in 5e-SRD-Levels, read at
// the owner's level in that class.
const ClassSpecificKeySchema = z.string();

// One count of a feature whose count or size grows with the level: the level at which it starts, as the Levels rows
// of the class say, and an id for it. `count` is a number, `dice` is dice. A step holds until the next step's level.
const CountStepSchema = z.union([
  z.strictObject({ id: z.string(), level: z.number(), count: z.number() }),
  z.strictObject({ id: z.string(), level: z.number(), dice: z.string() }),
]);
// Next to a `class_specific` key: the steps of the number or dice it holds in the Levels rows.
const ByLevelSchema = z.array(CountStepSchema).min(1);

const WhileSchema = z.array(z.enum(FEATURE_WHILE)).min(1);
const AttackKindSchema = z.enum(FEATURE_ATTACK_KINDS);

// A save DC: the owner's spell save DC, the ki save DC, 8 plus the proficiency bonus plus the modifier of an
// ability, or a fixed number that rises by `increase_per_use` each time the feature is used again and goes back to
// `fixed` when the owner finishes a short or a long rest (`reset`).
const DcSchema = z.union([
  z.enum(['spell', 'ki']),
  z.strictObject({ ability_modifier: AbilitySchema }),
  z.strictObject({
    fixed: z.number(),
    increase_per_use: z.number().optional(),
    reset: z.literal('short_rest').optional(),
  }),
]);

// A saving throw a modifier forces, or that the owner makes. `dc` is the save DC.
const SaveSchema = z.strictObject({
  ability: AbilitySchema,
  dc: DcSchema,
});

const DurationSchema = z.strictObject({
  unit: z.enum(['round', 'minute', 'end_of_next_turn', 'hour']),
  length: z.number().optional(),
});

// An aura: the modifier applies to the creatures within a range of the owner. The range is `range_ft`, or the
// number of feet in the `class_specific` key of the class rows. `allies_and_self` is the owner and the friendly
// creatures, `enemies` the creatures hostile to the owner. `must_hear_owner`: a creature gets the modifier only if it
// can hear the owner.
const AuraAffectsSchema = z.enum(['allies_and_self', 'enemies']);
const AuraSchema = z.union([
  z.strictObject({
    class_specific: ClassSpecificKeySchema,
    affects: AuraAffectsSchema,
    must_hear_owner: z.literal(true).optional(),
  }),
  z.strictObject({
    range_ft: z.number(),
    affects: AuraAffectsSchema,
    must_hear_owner: z.literal(true).optional(),
  }),
]);

// Each use spends `cost` from the uses of `pool` (the index of another feature). `cost` is a number, or the level
// of the spell for a Metamagic option. `cost_class_specific` names a table of costs in the Levels row instead. A
// `damage` modifier can have the same shape as the cost of its use alone.
const PoolUsesSchema = z.strictObject({
  pool: z.string(),
  cost: z.union([z.number(), z.literal('spell_level')]).optional(),
  cost_class_specific: ClassSpecificKeySchema.optional(),
});

// Fields every modifier can have. `while` lists circumstances that must all hold, `while_condition` a condition
// (an index of 5e-SRD-Conditions) the owner must have. Modifiers that share an `option` value apply together, and a
// use picks one option of a feature that has several.
const ModifierBase = {
  while: WhileSchema.optional(),
  while_condition: z.string().optional(),
  option: z.string().optional(),
};
// The modifiers that can be an aura apply to the creatures it names within a range of the owner instead of to the
// owner alone (a `condition` with an aura is applied to those creatures, not to the owner).
const AuraField = { aura: AuraSchema.optional() };

const ModifierSchema = z.discriminatedUnion('type', [
  // A condition is applied to the owner (`self`) or to the creature the feature is used on (`target`), or with an
  // `aura` to the creatures of the aura.
  z.strictObject({
    type: z.literal('condition'),
    ...ModifierBase,
    ...AuraField,
    condition: z.string(),
    target: z.enum(['self', 'target']),
    save: SaveSchema.optional(),
    duration: DurationSchema.optional(),
  }),
  // A change to the owner's own rolls, or with an `aura` to the rolls of the creatures of the aura.
  // `against_spells_cast_by` limits it to the saving throws against spells cast by creatures of these types,
  // `against_conditions` to the saving throws against being given one of these conditions (indexes of
  // 5e-SRD-Conditions), `duration` to a use of the feature.
  z.strictObject({
    type: z.literal('roll'),
    ...ModifierBase,
    ...AuraField,
    roll: z.enum(FEATURE_ROLLS),
    mode: z.enum(ROLL_MODES),
    abilities: z.array(AbilitySchema).min(1).optional(),
    // The checks of these skills only (indexes of 5e-SRD-Skills).
    skills: z.array(z.string()).min(1).optional(),
    attack_kind: AttackKindSchema.optional(),
    against_spells_cast_by: z.array(z.string()).min(1).optional(),
    against_conditions: z.array(z.string()).min(1).optional(),
    duration: DurationSchema.optional(),
  }),
  // A number added to a roll, to armor class, or to the hit points a healing spell restores. Exactly one amount:
  // `flat`, `dice`, `dice_at_slot_level` (dice for each spell slot level spent), `ability_modifier`,
  // `attack_ability_modifier` (the modifier of the ability the attack uses), `class_specific` (a number or dice
  // from the Levels row), or `proficiency_multiplier` (the proficiency bonus times this, rounded as `round` says).
  // `dice_at_class_level` is dice for the class level at which they start (the dice of the highest level the owner
  // has apply). `add_spell_level` adds the level of the spell to `flat`. With `target: "self"` the amount goes to
  // the owner instead of to the creature the roll is about.
  z.strictObject({
    type: z.literal('bonus'),
    ...ModifierBase,
    ...AuraField,
    to: z.enum([
      'attack_roll',
      'damage_roll',
      'saving_throw',
      'armor_class',
      'ability_check',
      'healing',
      // The initiative roll.
      'initiative',
    ]),
    flat: z.number().optional(),
    dice: z.string().optional(),
    dice_at_slot_level: z.record(z.string(), z.string()).optional(),
    dice_at_class_level: z.record(z.string(), z.string()).optional(),
    ability_modifier: AbilitySchema.optional(),
    attack_ability_modifier: z.literal(true).optional(),
    class_specific: ClassSpecificKeySchema.optional(),
    by_level: ByLevelSchema.optional(),
    proficiency_multiplier: z.number().optional(),
    round: z.enum(['down', 'up']).optional(),
    add_spell_level: z.literal(true).optional(),
    // The attack or check uses one of these abilities.
    abilities: z.array(AbilitySchema).min(1).optional(),
    attack_kind: AttackKindSchema.optional(),
    // Extra damage of this damage type.
    damage_type: z.string().optional(),
    // Only for this spell (an index of 5e-SRD-Spells).
    spell: z.string().optional(),
    // Only for spells that deal damage of the damage type of the dragon ancestor the owner chose.
    spell_damage_type_from: z.literal('dragon_ancestor').optional(),
    // Only for spells of this level or higher.
    min_spell_level: z.number().optional(),
    // Only for spells of this school (an index of 5e-SRD-Magic-Schools).
    school: z.string().optional(),
    target: z.literal('self').optional(),
    minimum: z.number().optional(),
  }),
  // The owner's speed rises by `value` feet, or by the number of feet in `class_specific`.
  z.strictObject({
    type: z.literal('speed'),
    ...ModifierBase,
    op: z.literal('add'),
    value: z.number().optional(),
    class_specific: ClassSpecificKeySchema.optional(),
    by_level: ByLevelSchema.optional(),
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
    by_level: ByLevelSchema.optional(),
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
  // the owner subtracts from (`effect: "subtract"`, an enemy) one of `rolls`, or that the owner adds to the owner's
  // own roll (`effect: "add_to_own"`, with no `range_ft`).
  z.strictObject({
    type: z.literal('die'),
    ...ModifierBase,
    class_specific: ClassSpecificKeySchema,
    effect: z.enum(['add', 'subtract', 'add_to_own']),
    rolls: z.array(z.enum(['attack', 'ability_check', 'saving_throw', 'damage'])).min(1),
    range_ft: z.number().optional(),
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
  // Immunity to conditions (indexes of 5e-SRD-Conditions), or to `disease`. With `creature_types`, only to the
  // conditions that creatures of these types cause.
  z.strictObject({
    type: z.literal('immune_to'),
    ...ModifierBase,
    ...AuraField,
    conditions: z.array(z.string()).min(1),
    creature_types: z.array(z.string()).min(1).optional(),
  }),
  // The owner can cast `spell` (an index of 5e-SRD-Spells). `slot`: `none` without expending a spell slot, or
  // `spell_slot` by expending one. `at_level` is the level it is cast at. `self_only` limits it to the owner as
  // the target, `ritual_only` to casting it as a ritual, and `no_material` drops its material components.
  // `save_dc` is the save DC of the spell when it is not the owner's spell save DC. `always_active`: the owner is
  // always under the effects of the spell, without casting it.
  z.strictObject({
    type: z.literal('spell'),
    ...ModifierBase,
    spell: z.string(),
    slot: z.enum(['none', 'spell_slot']),
    at_level: z.number().optional(),
    self_only: z.literal(true).optional(),
    ritual_only: z.literal(true).optional(),
    no_material: z.literal(true).optional(),
    save_dc: DcSchema.optional(),
    always_active: z.literal(true).optional(),
  }),
  // A change to one casting of a spell. `range_ft` is the new range of `range`. `maximize_healing_dice` gives every
  // die of the healing its highest number; `half_damage_on_successful_save` makes a creature that succeeds on its
  // save take half the damage and none of the other effects; `no_material_without_cost` drops the material
  // components that have no cost and that the spell does not consume. `max_spell_level` limits it to spells up to
  // that level (0 is a cantrip).
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
      'maximize_healing_dice',
      'half_damage_on_successful_save',
      'no_material_without_cost',
    ]),
    spell: z.string().optional(),
    range_ft: z.number().optional(),
    max_spell_level: z.number().optional(),
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
    by_level: ByLevelSchema.optional(),
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
  // The owner has resistance, immunity or vulnerability to damage of these types (indexes of 5e-SRD-Damage-Types,
  // or `all`), except the types in `except`: the words of condition `effects.damage`. `types_from` names the
  // damage type of the dragon ancestor the owner chose instead of `types`. `duration` limits it to a use of the
  // feature, and `cost` is what a use spends from the uses of another feature.
  z.strictObject({
    type: z.literal('damage'),
    ...ModifierBase,
    relation: z.enum(DAMAGE_RELATIONS),
    types: z.array(z.string()).min(1).optional(),
    types_from: z.literal('dragon_ancestor').optional(),
    except: z.array(z.string()).min(1).optional(),
    duration: DurationSchema.optional(),
    cost: PoolUsesSchema.optional(),
  }),
  // Evasion: when the owner is subjected to an effect that allows a saving throw of `ability` to take half damage,
  // the owner takes no damage on a success and half damage on a failure.
  z.strictObject({
    type: z.literal('evasion'),
    ...ModifierBase,
    ability: AbilitySchema,
  }),
  // The owner rolls additional damage dice on a critical hit with these attacks: as many as the number in
  // `class_specific`, which is the owner's total, not the number a single record of the feature adds.
  z.strictObject({
    type: z.literal('critical_damage_dice'),
    ...ModifierBase,
    class_specific: ClassSpecificKeySchema,
    attack_kind: AttackKindSchema,
  }),
  // When the owner drops to 0 hit points without dying outright, the owner can make `save` and, on a success, drop
  // to `hit_points` instead.
  z.strictObject({
    type: z.literal('avoid_dropping_to_zero'),
    ...ModifierBase,
    hit_points: z.number(),
    save: SaveSchema,
  }),
  // The owner can roll `roll` again after a failure, and must use the new roll.
  z.strictObject({
    type: z.literal('reroll'),
    ...ModifierBase,
    roll: z.literal('saving_throw'),
    when: z.literal('failed'),
  }),
  // A d20 roll lower than `minimum` counts as `minimum`.
  z.strictObject({
    type: z.literal('minimum_d20'),
    ...ModifierBase,
    roll: z.literal('ability_check'),
    minimum: z.number(),
  }),
  // A total lower than the owner's `ability_score` can be replaced by that score, on these checks.
  z.strictObject({
    type: z.literal('minimum_total'),
    ...ModifierBase,
    roll: z.literal('ability_check'),
    abilities: z.array(AbilitySchema).min(1),
    ability_score: AbilitySchema,
  }),
  // The scores of these abilities rise by `increase`, and their maximum becomes `maximum`. With `choose`, the owner
  // picks that many of the abilities and only those rise.
  z.strictObject({
    type: z.literal('ability_score_increase'),
    ...ModifierBase,
    abilities: z.array(AbilitySchema).min(1),
    increase: z.number(),
    maximum: z.number(),
    choose: z.number().optional(),
  }),
  // The damage dice of these attacks are rolled twice, and either result is used.
  z.strictObject({
    type: z.literal('roll_damage_twice'),
    ...ModifierBase,
    attack_kind: AttackKindSchema,
  }),
  // A damage die of these attacks that rolls less than `minimum` counts as `minimum`.
  z.strictObject({
    type: z.literal('minimum_damage_die'),
    ...ModifierBase,
    minimum: z.number(),
    attack_kind: AttackKindSchema,
  }),
  // An attack roll that misses can hit instead.
  z.strictObject({
    type: z.literal('hit_instead_of_miss'),
    ...ModifierBase,
  }),
  // The owner can teleport up to `distance_ft` feet to an unoccupied space the owner can see, right after one of the
  // actions in `after`.
  z.strictObject({
    type: z.literal('teleport'),
    ...ModifierBase,
    distance_ft: z.number(),
    after: z.array(z.enum(['attack_action', 'magic_action'])).min(1),
  }),
  // The damage of these types (indexes of 5e-SRD-Damage-Types) that the owner deals ignores resistance.
  z.strictObject({
    type: z.literal('ignore_resistance'),
    ...ModifierBase,
    damage_types: z.array(z.string()).min(1),
  }),
  // The owner has this sense, with this range.
  z.strictObject({
    type: z.literal('sense'),
    ...ModifierBase,
    sense: z.enum(['blindsight', 'darkvision', 'tremorsense', 'truesight']),
    range_ft: z.number(),
  }),
  // These attacks count as magical for overcoming resistance and immunity to nonmagical attacks and damage.
  z.strictObject({
    type: z.literal('magical_attacks'),
    ...ModifierBase,
    attack_kind: AttackKindSchema,
  }),
  // The owner can end an effect on the owner that is causing one of these conditions.
  z.strictObject({
    type: z.literal('end_condition'),
    ...ModifierBase,
    conditions: z.array(z.string()).min(1),
  }),
  // Attack rolls against the owner: none has advantage (`no_advantage`), or those of creatures of these types
  // (`creature_types`) or the opportunity attacks (`opportunity_attacks_only`) have disadvantage (`mode`). A modifier
  // has one of the two.
  z.strictObject({
    type: z.literal('rolls_against_owner'),
    ...ModifierBase,
    roll: z.literal('attack'),
    no_advantage: z.literal(true).optional(),
    mode: z.literal('disadvantage').optional(),
    creature_types: z.array(z.string()).min(1).optional(),
    opportunity_attacks_only: z.literal(true).optional(),
  }),
  // The owner can end `count` spells on the owner or on a willing creature the owner touches.
  z.strictObject({
    type: z.literal('end_spell'),
    ...ModifierBase,
    count: z.number(),
    targets: z.array(z.enum(['self', 'willing_creature'])).min(1),
  }),
  // Damage dealt, `flat` or `dice`, of `damage_type`, at the moment of `trigger`: a creature of the modifier's `aura`
  // starting its turn in the aura, or the target of the feature coming back at the end of the owner's next turn
  // (`target_returns`). `duration` limits it to a use of the feature.
  z.strictObject({
    type: z.literal('deal_damage'),
    ...ModifierBase,
    ...AuraField,
    flat: z.number().optional(),
    dice: z.string().optional(),
    damage_type: z.string(),
    trigger: z.enum(['starts_turn_in_aura', 'target_returns']),
    duration: DurationSchema.optional(),
  }),
  // The owner regains `count` uses of the feature `feature` (an index of 5e-SRD-Features) at the moment of
  // `trigger`: rolling initiative with none left, or finishing a short rest.
  z.strictObject({
    type: z.literal('recover_uses'),
    ...ModifierBase,
    feature: z.string(),
    count: z.number(),
    trigger: z.enum(['initiative_with_no_uses_left', 'short_rest']),
  }),
  // The owner takes the shape of a beast within the limits of these `class_specific` keys.
  z.strictObject({
    type: z.literal('wild_shape'),
    ...ModifierBase,
    class_specific: z.array(ClassSpecificKeySchema).min(1),
  }),
  // The owner has a flying speed equal to the owner's current speed.
  z.strictObject({
    type: z.literal('fly_speed'),
    ...ModifierBase,
    equal_to_speed: z.literal(true),
  }),
  // The owner can use these features (indexes of 5e-SRD-Features) any number of times.
  z.strictObject({
    type: z.literal('unlimited_uses'),
    ...ModifierBase,
    features: z.array(z.string()).min(1),
  }),
]);

// How many times the feature can be used before it recharges, or how many points or hit points it holds. The
// number is `count`, plus the number in `class_specific`, plus the ability modifier, plus `per_class_level` times
// the class level, and at least `minimum`. `unit` is `use` when absent.
const OwnUsesSchema = z.strictObject({
  count: z.number().optional(),
  class_specific: ClassSpecificKeySchema.optional(),
  by_level: ByLevelSchema.optional(),
  ability_modifier: AbilitySchema.optional(),
  per_class_level: z.number().optional(),
  minimum: z.number().optional(),
  unit: z.enum(['use', 'point', 'hit_point']).optional(),
});

// Each use expends one of the owner's spell slots.
const SpellSlotUsesSchema = z.strictObject({ spell_slot: z.literal(true) });

export const FeatureEngineSchema = z.strictObject({
  action_cost: z.enum(['action', 'bonus_action', 'reaction', 'free', 'passive', 'rest']),
  recharge: z.enum(['short_rest', 'long_rest', 'day', 'turn']).optional(),
  uses: z.union([OwnUsesSchema, PoolUsesSchema, SpellSlotUsesSchema]).optional(),
  modifiers: z.array(ModifierSchema).min(1).optional(),
});

// A proficiency (a reference into 5e-SRD-Proficiencies), or a number of proficiencies of the owner's choice, in skills
// or in skills and tools.
export const GrantedProficiencySchema = z.union([
  APIReferenceSchema,
  z.strictObject({ choose: z.number(), from: z.enum(['skills', 'skills_or_tools']) }),
]);

