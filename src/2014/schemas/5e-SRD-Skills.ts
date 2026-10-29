import { z } from 'zod';
import { APIReferenceSchema, translatable } from '../../schemas/common';

export const SkillSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  desc: translatable(z.array(z.string())),
  ability_score: APIReferenceSchema,
  url: z.string(),
});
