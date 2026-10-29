import { z } from 'zod';
import { translatable } from '../../schemas/common';

export const ConditionSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  desc: translatable(z.array(z.string())),
  url: z.string(),
});
