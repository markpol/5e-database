import { z } from 'zod';
import { APIReferenceSchema, DamageSchema, translatable } from '../../schemas/common';
import { ItemEffectsSchema } from '../../schemas/item-effects';

const CostSchema = z.strictObject({
  quantity: z.number(),
  unit: z.string(),
});

const ArmorClassSchema = z.strictObject({
  base: z.number(),
  dex_bonus: z.boolean(),
  max_bonus: z.number().optional(),
});

const ContentSchema = z.strictObject({
  item: APIReferenceSchema,
  quantity: z.number(),
});

const RangeSchema = z.strictObject({
  normal: z.number(),
  long: z.number().optional(),
});

const ThrowRangeSchema = z.strictObject({
  normal: z.number(),
  long: z.number(),
});

const SpeedSchema = z.strictObject({
  quantity: z.number(),
  unit: z.string(),
});

const EquipmentEffectSchema = z.strictObject({
  damage: z
    .array(
      z.strictObject({
        damage_type: z.string(),
        damage_dice: z.string(),
      })
    )
    .optional(),
});

export const EquipmentSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  equipment_category: APIReferenceSchema,
  cost: CostSchema,
  // The price in copper pieces, from `cost`; for an item sold in a bundle it is the price of the bundle.
  cost_cp: z.number().optional(),
  url: z.string(),
  desc: translatable(z.array(z.string())).optional(),
  material: z.string().optional(),
  stackable: z.boolean().optional(),
  ammunition: z.string().optional(),
  is_consumable: z.boolean().optional(),
  effect: EquipmentEffectSchema.optional(),
  // The unified form of `effect`.
  effects: ItemEffectsSchema.optional(),
  weight: z.number().optional(),
  gear_category: APIReferenceSchema.optional(),
  armor_category: translatable(z.string()).optional(),
  armor_class: ArmorClassSchema.optional(),
  capacity: translatable(z.string()).optional(),
  category_range: translatable(z.string()).optional(),
  contents: z.array(ContentSchema).optional(),
  damage: DamageSchema.optional(),
  image: z.string().optional(),
  properties: z.array(APIReferenceSchema).optional(),
  // How many pieces `cost` buys, for the items sold as a bundle (a bundle of arrows, a bag of ball bearings).
  bundle_size: z.number().optional(),
  quantity: z.number().optional(),
  // The distance in feet a melee weapon reaches.
  reach_ft: z.number().optional(),
  range: RangeSchema.optional(),
  special: translatable(z.array(z.string())).optional(),
  speed: SpeedSchema.optional(),
  stealth_disadvantage: z.boolean().optional(),
  str_minimum: z.number().optional(),
  throw_range: ThrowRangeSchema.optional(),
  tool_category: translatable(z.string()).optional(),
  two_handed_damage: DamageSchema.optional(),
  vehicle_category: translatable(z.string()).optional(),
  weapon_category: translatable(z.string()).optional(),
  weapon_range: translatable(z.string()).optional(),
});
