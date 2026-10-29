import { z } from 'zod';
import { APIReferenceSchema, translatable } from '../../schemas/common';

export const AbilityScoreSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  full_name: translatable(z.string()),
  desc: translatable(z.array(z.string())),
  skills: z.array(APIReferenceSchema),
  url: z.string(),
});
