import { z } from 'zod';
import { APIReferenceSchema, RecordSourceSchema, translatable } from '../../schemas/common';
import { FeatureEngineSchema, GrantedProficiencySchema } from '../../schemas/feature-engine';

const PrerequisiteSchema = z.strictObject({
  ability_score: APIReferenceSchema.optional(),
  minimum_score: z.number(),
});

/**
 * `type`, `repeatable`, `minimum_level` and `feature_named` follow the feat shape of the SRD 5.2 set. `source` marks the
 * feats added after SRD 5.1. `engine`, `grants_asi` and `granted_proficiencies` restate, as data, what the `desc` says,
 * with the words that class features use for the same (docs/feature-mechanics.md); they are English-only and are never
 * translated.
 */
export const FeatSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  prerequisites: z.array(PrerequisiteSchema).optional(),
  // The character level needed to take the feat.
  minimum_level: z.number().optional(),
  // The name of a class feature the character needs to take the feat.
  feature_named: z.string().optional(),
  desc: translatable(z.array(z.string())),
  // `origin`, `general`, `fighting-style` or `epic-boon`.
  type: z.enum(['origin', 'general', 'fighting-style', 'epic-boon']).optional(),
  // When the feat can be taken more than once, and under what limit.
  repeatable: translatable(z.string()).optional(),
  source: RecordSourceSchema.optional(),
  engine: FeatureEngineSchema.optional(),
  // The feat is an Ability Score Improvement.
  grants_asi: z.literal(true).optional(),
  granted_proficiencies: z.array(GrantedProficiencySchema).min(1).optional(),
  url: z.string(),
});
