import { z } from 'zod';
import { APIReferenceSchema } from '../../schemas/common';

const RaritySchema = z.strictObject({
  name: z.string(),
});

const CostSchema = z.strictObject({
  quantity: z.number(),
  unit: z.string(),
});

const AbilityScoreModifierSchema = z.strictObject({
  ability: z.string(),
  amount: z.strictObject({
    total: z.number().optional(),
    increase: z.number().optional(),
    max: z.number().optional(),
  }),
});

const MagicItemEffectSchema = z.strictObject({
  ability_score_modifier: AbilityScoreModifierSchema.optional(),
  armor_class_modifier: z.number().optional(),
  damage_type_resistance: z.string().optional(),
  duration: z.strictObject({ unit: z.string(), length: z.number() }).optional(),
  heal: z.string().optional(),
  proficiency_modifier: z.strictObject({ grants: z.array(z.string()) }).optional(),
  saving_throw_modifier: z.strictObject({
    abilities: z.array(z.string()),
    bonus: z.number(),
    gives_advantage: z.boolean().optional(),
  }).optional(),
  skill_check_modifier: z.strictObject({
    skill: z.string(),
    bonus: z.number().optional(),
    gives_advantage: z.boolean().optional(),
  }).optional(),
  trait_modifier: z.strictObject({ grants: z.array(z.string()) }).optional(),
});

const EnchantmentSchema = z.strictObject({
  type: z.string(),
  label_prefix: z.string(),
  armor_class_bonus: z.number().optional(),
  damage_bonus: z.number().optional(),
  to_hit_bonus: z.number().optional(),
  extra_damage: z
    .strictObject({ damage_type: z.strictObject({ index: z.string(), name: z.string(), url: z.string() }), damage_dice: z.string() })
    .optional(),
});

export const MagicItemSchema = z.strictObject({
  index: z.string(),
  name: z.string(),
  equipment_category: APIReferenceSchema,
  rarity: RaritySchema,
  variants: z.array(APIReferenceSchema),
  variant: z.boolean(),
  cost: CostSchema.optional(),
  effect: MagicItemEffectSchema.optional(),
  enchantment: EnchantmentSchema.optional(),
  requires_attunement: z.boolean().optional(),
  is_consumable: z.boolean().optional(),
  weight: z.number().optional(),
  desc: z.array(z.string()).optional(),
  image: z.string().optional(),
  url: z.string(),
});
