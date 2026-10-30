import { z } from 'zod';
import { APIReferenceSchema, AreaOfEffectSchema, translatable } from '../../schemas/common';

/**
 * A dice amount as data: `dice` is `NdM`, `bonus` a flat number added to it, and `add_spellcasting_mod` is true when
 * the caster's spellcasting ability modifier is added. See docs/spell-mechanics.md.
 */
const SpellDiceAmountSchema = z.strictObject({
  dice: z.string(),
  bonus: z.number().optional(),
  add_spellcasting_mod: z.boolean().optional(),
});

const SpellDamageSchema = z.strictObject({
  damage_type: APIReferenceSchema.optional(),
  damage_at_slot_level: z.record(z.string(), z.string()).optional(),
  damage_at_slot_level_data: z.record(z.string(), SpellDiceAmountSchema).optional(),
  damage_at_character_level: z.record(z.string(), z.string()).optional(),
});

const SpellDCSchema = z.strictObject({
  dc_type: APIReferenceSchema,
  dc_success: z.string(),
  desc: translatable(z.string()).optional(),
});

/** A distance in feet, or the word for a range that is not a distance. See docs/spell-mechanics.md. */
const SpellRangeFtSchema = z.union([
  z.number(),
  z.enum(['self', 'touch', 'sight', 'special', 'unlimited']),
]);

/** `casting_time` as an amount of a unit. */
const SpellCastingTimeDataSchema = z.strictObject({
  amount: z.number(),
  unit: z.enum(['action', 'bonus_action', 'reaction', 'minute', 'hour']),
});

/** `duration` as a length of a unit; `length` is absent for the units that are not a length of time. */
/**
 * Classification of a combat spell, written by hand (see docs/spell-mechanics.md for what each value means).
 */
const SpellEngineSchema = z.strictObject({
  kind: z.enum([
    'heal',
    'mass-heal',
    'stabilize',
    'spell-attack',
    'save-damage',
    'auto-hit',
    'area-damage',
    'buff',
    'aura',
    'save-condition',
    'cure-condition',
    'command',
    'summon-weapon',
    'summon',
  ]),
  target: z.enum(['ally', 'enemy', 'area']),
  campaign: z.boolean(),
  npc: z.boolean(),
});

const SpellDurationDataSchema = z.strictObject({
  unit: z.enum(['instantaneous', 'round', 'minute', 'hour', 'day', 'until_dispelled', 'special']),
  length: z.number().optional(),
});

export const SpellSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  desc: translatable(z.array(z.string())),
  higher_level: translatable(z.array(z.string())).optional(),
  range: translatable(z.string()),
  range_ft: SpellRangeFtSchema.optional(),
  components: z.array(z.string()),
  material: translatable(z.string()).optional(),
  ritual: z.boolean(),
  duration: translatable(z.string()),
  duration_data: SpellDurationDataSchema.optional(),
  concentration: z.boolean(),
  casting_time: translatable(z.string()),
  casting_time_data: SpellCastingTimeDataSchema.optional(),
  level: z.number(),
  attack_type: translatable(z.string()).optional(),
  damage: z.array(SpellDamageSchema).optional(),
  dc: SpellDCSchema.optional(),
  area_of_effect: AreaOfEffectSchema.optional(),
  heal_at_slot_level: z.record(z.string(), z.string()).optional(),
  heal_at_slot_level_data: z.record(z.string(), SpellDiceAmountSchema).optional(),
  temp_hp_at_slot_level: z.record(z.string(), SpellDiceAmountSchema).optional(),
  targets_at_slot_level: z.record(z.string(), z.number()).optional(),
  engine: SpellEngineSchema.optional(),
  school: APIReferenceSchema,
  classes: z.array(APIReferenceSchema),
  subclasses: z.array(APIReferenceSchema).optional(),
  url: z.string(),
});
