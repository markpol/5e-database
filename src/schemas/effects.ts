import { z } from 'zod';

/**
 * The words that the structured effects of conditions (`effects` in 5e-SRD-Conditions) and of class features
 * (`feature_specific.engine.modifiers` in 5e-SRD-Features) share, so the two speak the same vocabulary. A feature
 * may use more circumstances and attack kinds than a condition does; the extra words are listed here as well, apart
 * from the condition ones, so that the condition schema stays as it is. Every value is English-only and is never
 * translated.
 */

// The `index` of an ability score.
export const AbilitySchema = z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']);

// Circumstances in which a condition effect applies.
export const CONDITION_WHILE = [
  'source_in_line_of_sight',
  'can_see_attacker',
  'not_incapacitated',
  'speed_above_0',
  'not_wearing_armor',
  'not_wearing_heavy_armor',
] as const;

// Further circumstances that a feature modifier can name.
export const FEATURE_WHILE = [
  ...CONDITION_WHILE,
  'wearing_armor',
  'not_wielding_shield',
  'wielding_shield',
  'not_blinded',
  'not_deafened',
  // The effect is one that the creature can see.
  'can_see_effect',
  // Wielding a melee weapon in one hand and no other weapon.
  'one_handed_melee_weapon_only',
  // Wielding the melee weapon with two hands; the weapon has the two-handed or versatile property.
  'wielding_with_two_hands',
  // The roll does not already include the proficiency bonus.
  'not_proficient',
  // The target is below its hit point maximum.
  'target_below_hit_point_maximum',
  'target_undead_or_fiend',
  // Advantage on the attack roll, or another enemy of the target within 5 feet of it that is not incapacitated,
  // and no disadvantage on the attack roll.
  'sneak_attack_eligible',
  'in_dim_light_or_darkness',
  // The roll includes the proficiency bonus.
  'proficient',
  // The creature moves no more than half its speed on the same turn.
  'moving_at_most_half_speed',
] as const;

// The kind of attack a roll or bonus is limited to. `bound_weapon` is the one weapon the condition is tied to.
export const CONDITION_ATTACK_KINDS = ['melee_weapon', 'weapon', 'bound_weapon'] as const;

// Further attack kinds that a feature modifier can name.
export const FEATURE_ATTACK_KINDS = [
  ...CONDITION_ATTACK_KINDS,
  'ranged_weapon',
  'unarmed_strike',
  // An unarmed strike, a shortsword, or a simple melee weapon without the two-handed or heavy property.
  'monk_weapon',
  // A finesse or ranged weapon.
  'finesse_or_ranged_weapon',
  // The attack of two-weapon fighting made with the weapon in the other hand.
  'off_hand',
  'spell',
] as const;

export const ROLLS = ['attack', 'ability_check', 'saving_throw', 'death_saving_throw'] as const;
// The rolls a feature modifier can change: those of conditions, and the initiative roll.
export const FEATURE_ROLLS = [...ROLLS, 'initiative'] as const;
export const ROLL_MODES = ['advantage', 'disadvantage', 'auto_fail'] as const;
export const DAMAGE_RELATIONS = ['resistance', 'immunity', 'vulnerability'] as const;
