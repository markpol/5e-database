import { z } from 'zod';
import { APIReferenceSchema, translatable } from '../../schemas/common';

export const RuleSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  desc: translatable(z.string()),
  subsections: z.array(APIReferenceSchema),
  url: z.string(),
  // Where the rule comes in reading order, from 1. English-only.
  order: z.number().int().positive().optional(),
  // One or two sentences written for this data, not SRD text. docs/rule-reference.md.
  summary: translatable(z.string()).optional(),
  // Search terms read from the name and the names of the subsections. English-only.
  keywords: z.array(z.string()).min(1).optional(),
});
