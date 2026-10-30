import { z } from 'zod';
import { AbilitySchema } from './effects';

/**
 * The unified `effects` of an item, shared by equipment (`5e-SRD-Equipment`) and magic items
 * (`5e-SRD-Magic-Items`). It restates, in one shape, what the older `effect` objects of both files and the
 * `enchantment` object of magic items say; those fields stay as they are and docs/item-data.md gives the mapping.
 * Every value is English-only and is never translated.
 */

// When the effect applies. `equipped`: while the item is worn or wielded; `attuned`: while the owner is attuned to
// it; `carried`: while the owner carries it; `use`: when the item is used up (drunk, read, splashed or thrown).
export const ITEM_ACTIVATIONS = ['equipped', 'attuned', 'carried', 'use'] as const;

// How long the effect of a `use` item lasts. Absent for an instant effect (a healing potion, a thrown vial) and for
// the effects that last as long as the activation does.
export const ITEM_EFFECT_DURATION_UNITS = ['hour', 'permanent'] as const;

// The one shape of a damage type in an item effect: the `index` of 5e-SRD-Damage-Types as a plain string.
export const ItemDamageSchema = z.strictObject({
  damage_type: z.string(),
  damage_dice: z.string(),
});

// `set` makes the ability score `value` unless it is already that high; `add` raises it by `value`, to at most
// `cap` when there is one.
export const ITEM_ABILITY_OPS = ['set', 'add'] as const;

export const ItemEffectSchema = z.strictObject({
  activation: z.enum(ITEM_ACTIVATIONS),
  duration: z
    .strictObject({
      unit: z.enum(ITEM_EFFECT_DURATION_UNITS),
      length: z.number().optional(),
    })
    .optional(),
  // The one form of an armor class bonus, from the AC modifier of a ring or cloak and the `+N` of armor.
  armor_class: z.strictObject({ bonus: z.number() }).optional(),
  ability: z
    .strictObject({
      ability: AbilitySchema,
      op: z.enum(ITEM_ABILITY_OPS),
      value: z.number(),
      cap: z.number().optional(),
    })
    .optional(),
  // Damage types (indexes of 5e-SRD-Damage-Types) the owner has resistance to.
  resistances: z.array(z.string()).min(1).optional(),
  // Bonuses to the attacks made with the item, and damage added to its hits.
  attack: z
    .strictObject({
      to_hit_bonus: z.number().optional(),
      damage_bonus: z.number().optional(),
      extra_damage: z.array(ItemDamageSchema).min(1).optional(),
    })
    .optional(),
  // Damage dealt when the item is used.
  damage: z.array(ItemDamageSchema).min(1).optional(),
  // Dice of the hit points the item restores when used.
  heal: z.string().optional(),
  saving_throws: z
    .strictObject({
      abilities: z.array(AbilitySchema).min(1),
      bonus: z.number().optional(),
      advantage: z.literal(true).optional(),
    })
    .optional(),
  skill_check: z
    .strictObject({
      skill: z.string(),
      bonus: z.number().optional(),
      advantage: z.literal(true).optional(),
    })
    .optional(),
  // Indexes of 5e-SRD-Proficiencies the owner gains.
  proficiencies: z.array(z.string()).min(1).optional(),
  // Indexes of 5e-SRD-Traits the owner gains.
  traits: z.array(z.string()).min(1).optional(),
});

export const ItemEffectsSchema = z.array(ItemEffectSchema).min(1);

// What an item's `uses` counts: `charge` for the charges an item holds and spends, `use` for how many times its
// limited property can be used. The words follow `feature_specific.engine.uses` of the class features.
export const ITEM_USES_UNITS = ['charge', 'use'] as const;

// When spent uses come back: `dawn` is "daily at dawn" and "until the next dawn". The feature `recharge` values for
// rests and turns do not occur in item text.
export const ITEM_USES_RECHARGES = ['dawn'] as const;

/**
 * How many times the limited property of a magic item can be used before it recharges, or how many charges it holds.
 * It restates item text that has no fixed wording, so it is written by hand in item-engine-annotations.json.
 */
export const ItemUsesSchema = z.strictObject({
  count: z.number().int().positive(),
  unit: z.enum(ITEM_USES_UNITS),
  // Absent when spent uses never come back.
  recharge: z.enum(ITEM_USES_RECHARGES).optional(),
  // The dice of the charges regained at each recharge (`1d6+1`); absent when all the spent uses come back.
  regain: z
    .string()
    .regex(/^\d+d\d+(\+\d+)?$/)
    .optional(),
});
