import { z } from 'zod';
import { APIReferenceSchema, translatable } from '../../schemas/common';

export const RuleSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  desc: translatable(z.string()),
  subsections: z.array(APIReferenceSchema),
  url: z.string(),
});
