import { z } from 'zod';
import { APIReferenceSchema, ChoiceSchema, translatable } from '../../schemas/common';
import { AbilitySchema } from '../../schemas/effects';
import { FeatureEngineSchema, GrantedProficiencySchema } from '../../schemas/feature-engine';

/**
 * `feature_specific.engine`, `grants_asi`, `heal` and `granted_proficiencies` restate, as data, what the `desc` of a
 * class feature says: what using it costs, how often it can be used, what it changes while it is owned or used, how
 * many hit points it restores, and which proficiencies it gives. None of it is SRD text and none of it is translated.
 * The values are written in src/2014/feature-engine-annotations.json and merged in by derive-feature-engine.ts.
 * docs/feature-mechanics.md describes each field, its allowed values and its units.
 */

// Hit points the feature restores: `dice`, plus `bonus`, plus the ability modifier, plus the class level
// (`add_class_level`), plus the class level times `class_level_multiplier`. `from_uses`: as many as the owner
// spends from the feature's `uses`.
const HealSchema = z.strictObject({
  dice: z.string().optional(),
  bonus: z.number().optional(),
  ability_modifier: AbilitySchema.optional(),
  add_class_level: z.literal(true).optional(),
  class_level_multiplier: z.number().optional(),
  from_uses: z.literal(true).optional(),
});

// A language the feature gives. Languages are not proficiencies in this data. A reference into 5e-SRD-Languages; the
// secret language of a class, which has no record there; or a number of languages of the owner's choice, taken from
// the languages the favored enemies speak.
const GrantedLanguageSchema = z.union([
  APIReferenceSchema,
  z.strictObject({ secret_language: z.enum(['druidic', 'thieves-cant']) }),
  z.strictObject({ choose: z.number(), from: z.literal('favored_enemy_languages') }),
]);

const FeatureSpecificSchema = z.strictObject({
  invocations: z.array(APIReferenceSchema).optional(),
  expertise_options: ChoiceSchema.optional(),
  subfeature_options: ChoiceSchema.optional(),
  terrain_type_options: ChoiceSchema.optional(),
  enemy_type_options: ChoiceSchema.optional(),
  engine: FeatureEngineSchema.optional(),
  // The feature is an Ability Score Improvement.
  grants_asi: z.literal(true).optional(),
  heal: HealSchema.optional(),
  granted_proficiencies: z.array(GrantedProficiencySchema).min(1).optional(),
  granted_languages: z.array(GrantedLanguageSchema).min(1).optional(),
  // The `index` of the damage type of a dragon ancestor (5e-SRD-Damage-Types).
  damage_type: z.string().optional(),
});

const FeaturePrerequisiteSchema = z.strictObject({
  type: z.string(),
  level: z.number().optional(),
  feature: z.string().optional(),
  spell: z.string().optional(),
});

export const FeatureSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  level: z.number(),
  class: APIReferenceSchema.optional(),
  subclass: APIReferenceSchema.optional(),
  desc: translatable(z.array(z.string())),
  prerequisites: z.array(FeaturePrerequisiteSchema),
  parent: APIReferenceSchema.optional(),
  reference: z.string().optional(),
  feature_specific: FeatureSpecificSchema.optional(),
  url: z.string(),
});
