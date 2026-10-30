import { z } from 'zod';
import { APIReferenceSchema, ChoiceSchema, RecordSourceSchema, translatable } from '../../schemas/common';

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

/**
 * `source` marks the backgrounds added after SRD 5.1. `ability_scores` (the abilities the background can raise) and
 * `feat` (the origin feat it gives; `note` names a choice made within it) follow the background shape of the SRD 5.2
 * set. `proficiency_choices` are the proficiencies the owner picks. Backgrounds from the SRD 5.2 set have no `feature`
 * or personality tables.
 */
export const BackgroundSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  source: RecordSourceSchema.optional(),
  ability_scores: z.array(APIReferenceSchema).optional(),
  feat: APIReferenceSchema.optional(),
  starting_proficiencies: z.array(APIReferenceSchema),
  proficiency_choices: z.array(ChoiceSchema).optional(),
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
