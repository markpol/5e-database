import { z } from 'zod';
import { APIReferenceSchema, translatable } from '../../schemas/common';

const SubclassSpellPrerequisiteSchema = z.strictObject({
  index: z.string(),
  type: z.string(),
  name: z.string(),
  url: z.string(),
});

const SubclassSpellSchema = z.strictObject({
  prerequisites: z.array(SubclassSpellPrerequisiteSchema),
  spell: APIReferenceSchema,
});

export const SubclassSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  class: APIReferenceSchema,
  subclass_flavor: translatable(z.string()),
  desc: translatable(z.array(z.string())),
  subclass_levels: z.string(),
  spells: z.array(SubclassSpellSchema).optional(),
  url: z.string(),
});
