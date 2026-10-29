import { z } from 'zod';
import {
  APIReferenceSchema,
  AreaOfEffectSchema,
  ChoiceSchema,
  DifficultyClassSchema,
  translatable,
} from '../../schemas/common';

const BreathWeaponUsageSchema = z.strictObject({
  type: translatable(z.string()),
  times: z.number(),
});

const BreathWeaponDamageSchema = z.strictObject({
  damage_type: APIReferenceSchema,
  damage_at_character_level: z.record(z.string(), z.string()),
});

const BreathWeaponSchema = z.strictObject({
  name: translatable(z.string()),
  desc: translatable(z.string()),
  area_of_effect: AreaOfEffectSchema,
  usage: BreathWeaponUsageSchema,
  dc: DifficultyClassSchema,
  damage: z.array(BreathWeaponDamageSchema),
});

const TraitSpecificSchema = z.strictObject({
  damage_type: APIReferenceSchema.optional(),
  breath_weapon: BreathWeaponSchema.optional(),
  spell_options: ChoiceSchema.optional(),
  subtrait_options: ChoiceSchema.optional(),
});

export const TraitSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  desc: translatable(z.array(z.string())),
  races: z.array(APIReferenceSchema),
  subraces: z.array(APIReferenceSchema),
  proficiencies: z.array(APIReferenceSchema).optional(),
  proficiency_choices: ChoiceSchema.optional(),
  language_options: ChoiceSchema.optional(),
  parent: APIReferenceSchema.optional(),
  trait_specific: TraitSpecificSchema.optional(),
  url: z.string(),
});
