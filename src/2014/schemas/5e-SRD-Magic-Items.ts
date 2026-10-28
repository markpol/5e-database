import { z } from 'zod';
import { APIReferenceSchema } from '../../schemas/common';

const RaritySchema = z.strictObject({
  name: z.string(),
});

export const MagicItemSchema = z.strictObject({
  index: z.string(),
  name: z.string(),
  equipment_category: APIReferenceSchema,
  rarity: RaritySchema,
  variants: z.array(APIReferenceSchema),
  variant: z.boolean(),
  desc: z.array(z.string()).optional(),
  image: z.string().optional(),
  url: z.string(),
  cost: z.strictObject({ quantity: z.number(), unit: z.string() }).optional(),
  effect: z.record(z.string(), z.unknown()).optional(),
  enchantment: z.record(z.string(), z.unknown()).optional(),
  is_consumable: z.boolean().optional(),
  requires_attunement: z.boolean().optional(),
  weight: z.number().optional(),
});
