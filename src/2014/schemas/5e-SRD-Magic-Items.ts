import { z } from 'zod';
import { APIReferenceSchema, translatable } from '../../schemas/common';
import { ItemEffectsSchema } from '../../schemas/item-effects';

const RaritySchema = z.strictObject({
  name: translatable(z.string()),
  // 1 Common, 2 Uncommon, 3 Rare, 4 Very Rare, 5 Legendary, 6 Artifact; absent when the rarity varies.
  rank: z.number().optional(),
  // The character level from which the item is a fitting reward, by rarity; absent for artifacts and varying rarity.
  min_level: z.number().optional(),
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
  saving_throw_modifier: z
    .strictObject({
      abilities: z.array(z.string()),
      bonus: z.number(),
      gives_advantage: z.boolean().optional(),
    })
    .optional(),
  skill_check_modifier: z
    .strictObject({
      skill: z.string(),
      bonus: z.number().optional(),
      gives_advantage: z.boolean().optional(),
    })
    .optional(),
  trait_modifier: z.strictObject({ grants: z.array(z.string()) }).optional(),
});

const EnchantmentSchema = z.strictObject({
  type: z.string(),
  label_prefix: z.string(),
  armor_class_bonus: z.number().optional(),
  damage_bonus: z.number().optional(),
  to_hit_bonus: z.number().optional(),
  extra_damage: z
    .strictObject({
      damage_type: z.strictObject({ index: z.string(), name: z.string(), url: z.string() }),
      damage_dice: z.string(),
    })
    .optional(),
});

export const MagicItemSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  equipment_category: APIReferenceSchema,
  rarity: RaritySchema,
  variants: z.array(APIReferenceSchema),
  variant: z.boolean(),
  cost: CostSchema.optional(),
  // The price in copper pieces, from `cost`.
  cost_cp: z.number().optional(),
  effect: MagicItemEffectSchema.optional(),
  enchantment: EnchantmentSchema.optional(),
  // The unified form of `effect` and `enchantment`.
  effects: ItemEffectsSchema.optional(),
  // The `index` values of the 5e-SRD-Proficiencies that cover the weapon or armor the item is a kind of, from the
  // equipment its `variants` name (see 5e-SRD-Equipment `proficiency_ids`).
  proficiency_ids: z.array(z.string()).optional(),
  requires_attunement: z.boolean().optional(),
  is_consumable: z.boolean().optional(),
  weight: z.number().optional(),
  desc: translatable(z.array(z.string())).optional(),
  image: z.string().optional(),
  url: z.string(),
});
