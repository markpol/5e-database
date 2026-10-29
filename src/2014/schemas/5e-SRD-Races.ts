import { z } from 'zod';
import { APIReferenceSchema, ChoiceSchema, translatable } from '../../schemas/common';

const AbilityBonusSchema = z.strictObject({
  ability_score: APIReferenceSchema,
  bonus: z.number(),
});

export const RaceSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  speed: z.number(),
  ability_bonuses: z.array(AbilityBonusSchema),
  ability_bonus_options: ChoiceSchema.optional(),
  alignment: translatable(z.string()),
  age: translatable(z.string()),
  size: translatable(z.string()),
  size_description: translatable(z.string()),
  starting_proficiencies: z.array(APIReferenceSchema).optional(),
  starting_proficiency_options: ChoiceSchema.optional(),
  languages: z.array(APIReferenceSchema),
  language_desc: translatable(z.string()),
  language_options: ChoiceSchema.optional(),
  traits: z.array(APIReferenceSchema).optional(),
  subraces: z.array(APIReferenceSchema).optional(),
  url: z.string(),
});
