import { z } from 'zod';
import { translatable } from '../../schemas/common';
import {
  AbilitySchema,
  CONDITION_ATTACK_KINDS,
  CONDITION_WHILE,
  DAMAGE_RELATIONS,
  ROLL_MODES,
  ROLLS,
} from '../../schemas/effects';

/**
 * The structured `effects` of a condition, and the links between conditions (`removes`, `adds`, `on_remove`,
 * `immune_if_feature`, `exhaustion_level`). None of it is SRD text: it restates, as data, what the `desc` of the
 * condition says, so the rule does not have to be read out of English prose. Every value is English-only and is
 * never translated; the translatable text of a condition stays in `name` and `desc`. docs/game-engine-changes.md
 * describes each field, its allowed values and its units.
 */

// A circumstance in which an effect applies. All the listed circumstances must hold.
const WhileSchema = z.array(z.enum(CONDITION_WHILE));

// The kind of attack a roll or bonus is limited to. `bound_weapon` is the one weapon the condition is tied to.
const AttackKindSchema = z.enum(CONDITION_ATTACK_KINDS);

// A change to a roll the creature itself makes. No `abilities` means every ability. For an attack roll,
// `abilities` is the ability the attack uses.
const RollModifierSchema = z.strictObject({
  roll: z.enum(ROLLS),
  mode: z.enum(ROLL_MODES),
  abilities: z.array(AbilitySchema).min(1).optional(),
  attack_kind: AttackKindSchema.optional(),
  // Only the checks that need this sense are affected.
  requires_sense: z.enum(['sight', 'hearing']).optional(),
  while: WhileSchema.optional(),
});

// A change to a roll that someone else makes against the creature, or about it. Exactly one of `mode` and
// `critical_hit`. `within_ft` means at most that many feet away, `beyond_ft` farther than that.
const RollAgainstSchema = z.strictObject({
  roll: z.enum(['attack', 'ability_check']),
  mode: z.enum(['advantage', 'disadvantage']).optional(),
  // A hit is a critical hit. Attack rolls only.
  critical_hit: z.literal(true).optional(),
  within_ft: z.number().optional(),
  beyond_ft: z.number().optional(),
  // Only rolls made by the creature that applied the condition.
  by: z.literal('source').optional(),
  purpose: z.literal('social_interaction').optional(),
  while: WhileSchema.optional(),
});

const SpeedSchema = z.discriminatedUnion('op', [
  // The speed becomes `value` feet.
  z.strictObject({
    op: z.literal('set'),
    value: z.number(),
    ignores_bonuses: z.literal(true).optional(),
  }),
  z.strictObject({ op: z.literal('halve') }),
  // The only movement is crawling.
  z.strictObject({ op: z.literal('crawl_only') }),
]);

const CannotSchema = z.enum([
  'take_actions',
  'take_reactions',
  'move',
  'speak',
  'see',
  'hear',
  'perceive_surroundings',
  'cast_spells',
  'concentrate',
  // Attack the source of the condition, or target it with harmful abilities or effects.
  'harm_source',
  // Willingly move closer to the source of the condition.
  'move_closer_to_source',
]);

const BonusBaseShape = {
  to: z.enum(['attack_roll', 'damage_roll', 'saving_throw', 'armor_class']),
  attack_kind: AttackKindSchema.optional(),
  // A bonus to damage rolls that deals this type of damage instead of the weapon's.
  damage_type: z.string().optional(),
  // The least the bonus can be, once it is worked out.
  minimum: z.number().optional(),
  // The bonus ends after this many uses.
  uses: z.number().optional(),
};

// A bonus is dice (`1d4`), a flat number, or the modifier of an ability.
const BonusSchema = z.union([
  z.strictObject({ ...BonusBaseShape, dice: z.string() }),
  z.strictObject({ ...BonusBaseShape, flat: z.number() }),
  z.strictObject({ ...BonusBaseShape, ability_modifier: AbilitySchema }),
]);

const DamageModifierSchema = z.strictObject({
  relation: z.enum(DAMAGE_RELATIONS),
  // Damage type indexes, or `all`.
  types: z.array(z.string()).min(1),
  while: WhileSchema.optional(),
});

const ConditionEffectsSchema = z.strictObject({
  // Conditions whose effects this one also has, because its text says the creature is in that condition.
  includes: z.array(z.string()).min(1).optional(),
  rolls: z.array(RollModifierSchema).min(1).optional(),
  rolls_against: z.array(RollAgainstSchema).min(1).optional(),
  bonuses: z.array(BonusSchema).min(1).optional(),
  armor_class: z
    .strictObject({
      base: z.strictObject({ value: z.number(), ability_modifier: AbilitySchema }),
      while: WhileSchema.optional(),
    })
    .optional(),
  speed: SpeedSchema.optional(),
  cannot: z.array(CannotSchema).min(1).optional(),
  limits: z
    .strictObject({
      attacks_per_turn: z.number().optional(),
      one_of_action_or_bonus_action: z.literal(true).optional(),
    })
    .optional(),
  damage: z.array(DamageModifierSchema).min(1).optional(),
  // Condition indexes, or `disease`.
  immune_to: z.array(z.string()).min(1).optional(),
  hit_point_maximum: z.strictObject({ op: z.enum(['halve', 'reduce']) }).optional(),
  ability_scores: z
    .array(z.strictObject({ ability: AbilitySchema, op: z.literal('reduce') }))
    .min(1)
    .optional(),
  healing: z.literal('maximum').optional(),
  drops_held_items: z.literal(true).optional(),
  provokes_opportunity_attacks: z.boolean().optional(),
  death: z.literal(true).optional(),
  // Present only when the condition has no other effect: why the text gives none that fits the fields above.
  // A note for maintainers, not display text.
  reason: z.string().optional(),
});

export const ConditionSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  desc: translatable(z.array(z.string())),
  url: z.string(),
  effects: ConditionEffectsSchema,
  // Conditions this one ends when it is applied.
  removes: z.array(z.string()).min(1).optional(),
  // Conditions that are applied along with this one.
  adds: z.array(z.string()).min(1).optional(),
  // What happens when this condition ends.
  on_remove: z
    .strictObject({
      removes: z.array(z.string()).min(1).optional(),
      exhaustion_levels: z.number().optional(),
    })
    .optional(),
  // A feature that makes its owner immune to this condition, optionally only while holding another condition.
  immune_if_feature: z
    .array(z.strictObject({ feature: z.string(), while_condition: z.string().optional() }))
    .min(1)
    .optional(),
  // On the six numbered exhaustion conditions: the level, and the conditions of the level above and below.
  exhaustion_level: z
    .strictObject({
      level: z.number(),
      next: z.string().optional(),
      prev: z.string().optional(),
    })
    .optional(),
});
