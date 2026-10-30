import { z } from 'zod';
import { APIReferenceSchema, ChoiceSchema, translatable } from '../../schemas/common';

const SpellcastingInfoSchema = z.strictObject({
  name: translatable(z.string()),
  desc: translatable(z.array(z.string())),
});

// The structured counterpart of the spellcasting text. Written by derive-class-spellcasting.ts and never
// translated; docs/class-spellcasting.md describes each field.

// How the class gains spell slots: like a full caster, like a half caster, or with Pact Magic.
const CasterKindSchema = z.enum(['full', 'half', 'pact']);

// The number of spells a prepared caster prepares: the modifier of the spellcasting ability plus the class level
// (`full`) or half the class level rounded down (`half_rounded_down`), and at least `minimum`.
const PreparedFormulaSchema = z.strictObject({
  class_levels: z.enum(['full', 'half_rounded_down']),
  minimum: z.number(),
});

// The spells in a spellbook: `initial` at the first level of the class and `per_level` more for each level gained
// after it.
const SpellbookSizeSchema = z.strictObject({
  initial: z.number(),
  per_level: z.number(),
});

// What the subclasses of the class add to its spells. `always_prepared`: the subclass spells are always prepared
// and do not count against the number of prepared spells. `expanded_list`: they are added to the class spell
// list. `none`: no subclass of the class has a spell list. `with_spells` and `without_spells` are indices of
// 5e-SRD-Subclasses; the former have a `spells` list there.
const SubclassSpellsSchema = z.strictObject({
  mode: z.enum(['always_prepared', 'expanded_list', 'none']),
  with_spells: z.array(z.string()),
  without_spells: z.array(z.string()),
});

const SpellcastingSchema = z.strictObject({
  level: z.number(),
  spellcasting_ability: APIReferenceSchema,
  info: z.array(SpellcastingInfoSchema),
  caster_kind: CasterKindSchema.optional(),
  prepared_formula: PreparedFormulaSchema.optional(),
  spellbook_size: SpellbookSizeSchema.optional(),
  subclass_spells: SubclassSpellsSchema.optional(),
});

const StartingEquipmentSchema = z.strictObject({
  equipment: APIReferenceSchema,
  quantity: z.number(),
});

const MultiClassingPrereqSchema = z.strictObject({
  ability_score: APIReferenceSchema.optional(),
  minimum_score: z.number(),
});

const MultiClassingSchema = z.strictObject({
  prerequisites: z.array(MultiClassingPrereqSchema).optional(),
  prerequisite_options: ChoiceSchema.optional(),
  proficiencies: z.array(APIReferenceSchema).optional(),
  proficiency_choices: z.array(ChoiceSchema).optional(),
});

export const ClassSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  hit_die: z.number(),
  class_levels: z.string(),
  multi_classing: MultiClassingSchema.optional(),
  proficiencies: z.array(APIReferenceSchema).optional(),
  proficiency_choices: z.array(ChoiceSchema),
  saving_throws: z.array(APIReferenceSchema).optional(),
  starting_equipment: z.array(StartingEquipmentSchema).optional(),
  starting_equipment_options: z.array(ChoiceSchema),
  subclasses: z.array(APIReferenceSchema).optional(),
  spellcasting: SpellcastingSchema.optional(),
  spells: z.string().optional(),
  // The key of the icon for this class, from docs/icon-keys.md. Never translated.
  icon: z.string().min(1).optional(),
  url: z.string(),
});
