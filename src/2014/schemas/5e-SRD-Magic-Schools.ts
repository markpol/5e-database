import { z } from 'zod';
import { translatable } from '../../schemas/common';

export const MagicSchoolSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  desc: translatable(z.string()).optional(),
  url: z.string(),
});
