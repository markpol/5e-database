import { z } from 'zod';

/**
 * The structured effects of monster traits and actions in `5e-SRD-Monsters-Normalized`, and the structured damage
 * resistances, immunities and vulnerabilities of a monster. They restate, as data, rules that the SRD gives only as
 * prose; docs/monster-effects.md gives every field, its values and units. Every value is English-only and is never
 * translated.
 */

// When the structured effect of a trait or action applies.
//   start_of_turn            at the start of the monster's own turn (Regeneration; the blood a stirge drains)
//   on_hit                   when an attack hits
//   on_failed_save           when the target fails the saving throw the action calls for
//   on_damage                when the action deals damage to the target, whether or not the target made a save
//   every_24_hours           every 24 hours after the target is afflicted (a disease or a curse)
//   after_1_hour_of_visions  once the target has had the monster's visions for at least an hour
//   half_hit_points_or_fewer while the monster has half of its hit points or fewer
//   while_ridden             while a creature rides the monster; the creature gets the effect
export const MONSTER_EFFECT_TRIGGERS = [
  'start_of_turn',
  'on_hit',
  'on_failed_save',
  'on_damage',
  'every_24_hours',
  'after_1_hour_of_visions',
  'half_hit_points_or_fewer',
  'while_ridden',
] as const;

// What ends a reduction of hit point maximum.
export const HIT_POINT_MAXIMUM_ENDINGS = ['long_rest', 'greater_restoration', 'disease_cured', 'remove_curse'] as const;

// Where regeneration does not work.
export const REGENERATION_DISABLED_IN = ['sunlight', 'running_water'] as const;

// Damage that is not a damage type but also stops regeneration.
export const REGENERATION_SUPPRESSING_SOURCES = ['holy_water'] as const;

// A weapon quality that gets past a resistance, immunity or vulnerability to nonmagical weapons: the damage of a
// weapon with any of these is not covered. `magical` is always there where the text says "nonmagical".
export const DAMAGE_BYPASS_QUALITIES = ['magical', 'silvered', 'adamantine'] as const;

// A limit on where the damage comes from.
export const DAMAGE_RULE_SOURCES = ['spells'] as const;

const DiceSchema = z.string().regex(/^\d+d\d+$/);

/**
 * One resistance, immunity or vulnerability. `types` are indexes of 5e-SRD-Damage-Types, or `all`. Without `unless`
 * the rule covers the damage of those types; with it, the rule covers only damage that comes from none of the listed
 * qualities (nonmagical bludgeoning, piercing and slashing damage unless silvered is `unless: ["magical",
 * "silvered"]`). `only_from` limits the rule to damage from that source.
 */
export const DamageRuleSchema = z.strictObject({
  types: z.array(z.string()).min(1),
  unless: z.array(z.enum(DAMAGE_BYPASS_QUALITIES)).min(1).optional(),
  only_from: z.enum(DAMAGE_RULE_SOURCES).optional(),
});

/** Hit points regained at `trigger`, with the conditions that stop or limit the regaining. */
export const RegenerationSchema = z.strictObject({
  hit_points: z.number().int().positive(),
  // The least hit points the monster must have to regenerate.
  min_hit_points: z.number().int().positive().optional(),
  // Taking this damage (or being hit by this source) stops regeneration at the start of the monster's next turn.
  suppressed_by: z
    .strictObject({
      damage_types: z.array(z.string()).min(1),
      sources: z.array(z.enum(REGENERATION_SUPPRESSING_SOURCES)).min(1).optional(),
    })
    .optional(),
  disabled_in: z.array(z.enum(REGENERATION_DISABLED_IN)).min(1).optional(),
  // 0 hit points kills the monster only when its turn starts at 0 hit points and it does not regenerate.
  dies_only_without_regenerating: z.literal(true).optional(),
});

/** The target's hit point maximum is reduced by the damage it took (`damage_type`: by that type's damage only). */
export const ReduceMaxHpSchema = z.strictObject({
  by: z.literal('damage_taken'),
  damage_type: z.string().optional(),
  until: z.enum(HIT_POINT_MAXIMUM_ENDINGS),
});

/** The target's hit point maximum is reduced by `dice`, once (`every_hours` absent) or each `every_hours` hours. */
export const ReductionDiceSchema = z.strictObject({
  dice: DiceSchema,
  every_hours: z.number().int().positive().optional(),
  // The target repeats the saving throw each time, and the reduction happens only on a failure.
  repeat_save: z.literal(true).optional(),
  until: z.enum(HIT_POINT_MAXIMUM_ENDINGS),
});

/** The optional fields of a trait or an action. */
export const MonsterAbilityEffectFields = {
  trigger: z.enum(MONSTER_EFFECT_TRIGGERS).optional(),
  regeneration: RegenerationSchema.optional(),
  // The monster detaches after the target has lost this many hit points to it.
  detach_after_damage: z.number().int().positive().optional(),
  reduction_dice: ReductionDiceSchema.optional(),
  reduce_max_hp: ReduceMaxHpSchema.optional(),
  // The dice of the monster's first damage entry while it has half of its hit points or fewer.
  damage_dice_at_half_hp: DiceSchema.optional(),
  // Resistance the ability gives (to the creature riding the monster for `while_ridden`).
  resistances: z.array(DamageRuleSchema).min(1).optional(),
};
