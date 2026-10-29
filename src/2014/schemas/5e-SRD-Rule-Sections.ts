import { z } from 'zod';
import { translatable } from '../../schemas/common';

export const RuleSectionSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  desc: translatable(z.string()),
  url: z.string(),
});
