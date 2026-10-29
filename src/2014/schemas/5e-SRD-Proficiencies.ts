import { z } from 'zod';
import { APIReferenceSchema, translatable } from '../../schemas/common';

export const ProficiencySchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  type: translatable(z.string()),
  classes: z.array(APIReferenceSchema).optional(),
  races: z.array(APIReferenceSchema).optional(),
  reference: APIReferenceSchema,
  url: z.string(),
});
