import { z } from 'zod';
import { APIReferenceSchema, translatable } from '../../schemas/common';

export const EquipmentCategorySchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  equipment: z.array(APIReferenceSchema),
  url: z.string(),
});
