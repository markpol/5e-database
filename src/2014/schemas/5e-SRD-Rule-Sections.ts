import { z } from 'zod';
import { RuleLinkSchema, translatable } from '../../schemas/common';

export const RuleSectionSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  desc: translatable(z.string()),
  url: z.string(),
  // Where the section comes in reading order across all sections, from 1. English-only.
  order: z.number().int().positive().optional(),
  // One or two sentences written for this data, not SRD text. docs/rule-reference.md.
  summary: translatable(z.string()).optional(),
  // Search terms read from the headings and the bold terms of `desc`. English-only.
  keywords: z.array(z.string()).min(1).optional(),
  // Other rule sections that bear on this one. English-only.
  related: z.array(RuleLinkSchema).min(1).optional(),
});
