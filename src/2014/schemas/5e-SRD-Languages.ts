import { z } from 'zod';
import { translatable } from '../../schemas/common';

export const LanguageSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  type: translatable(z.string()),
  typical_speakers: translatable(z.array(z.string())),
  desc: translatable(z.string()).optional(),
  script: translatable(z.string()).optional(),
  url: z.string(),
});
