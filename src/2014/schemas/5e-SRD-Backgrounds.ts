import { z } from 'zod';
import { APIReferenceSchema, ChoiceSchema, translatable } from '../../schemas/common';

const CostSchema = z.strictObject({
  quantity: z.number(),
  unit: z.string(),
});

const BackgroundFeatureSchema = z.strictObject({
  name: translatable(z.string()),
  desc: translatable(z.array(z.string())),
});

const StartingEquipmentSchema = z.strictObject({
  equipment: APIReferenceSchema,
  quantity: z.number(),
});

export const BackgroundSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  starting_proficiencies: z.array(APIReferenceSchema),
  language_options: ChoiceSchema.optional(),
  starting_equipment: z.array(StartingEquipmentSchema).optional(),
  starting_equipment_options: z.array(ChoiceSchema).optional(),
  starting_gold: CostSchema.optional(),
  feature: BackgroundFeatureSchema.optional(),
  personality_traits: ChoiceSchema.optional(),
  ideals: ChoiceSchema.optional(),
  bonds: ChoiceSchema.optional(),
  flaws: ChoiceSchema.optional(),
  url: z.string(),
});
