import { z } from 'zod';
import { APIReferenceSchema, translatable } from '../../schemas/common';

const AbilityBonusSchema = z.strictObject({
  ability_score: APIReferenceSchema,
  bonus: z.number(),
});

export const SubraceSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  race: APIReferenceSchema,
  desc: translatable(z.string()),
  ability_bonuses: z.array(AbilityBonusSchema),
  racial_traits: z.array(APIReferenceSchema).optional(),
  url: z.string(),
});
