import { z } from 'zod';
import { translatable } from '../../schemas/common';

export const AlignmentSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  abbreviation: translatable(z.string()),
  desc: translatable(z.string()),
  url: z.string(),
});
