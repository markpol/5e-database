import { z } from 'zod';

/**
 * Marks a field as translatable text: a translation overlay (`src/{year}/{locale}/`) may replace it, and nothing
 * else in a record may be overlaid. The mark is Zod metadata, emitted into the JSON Schema as `"translatable": true`,
 * which is what `localize()` and the overlay validator in `src/i18n` read. Mark prose and display labels; never mark
 * ids, urls, numbers, dice, booleans or reference objects.
 */
export function translatable<T extends z.ZodType>(schema: T): T {
  return schema.meta({ translatable: true });
}

/**
 * Where an entry added to a collection after the SRD 5.1 set comes from: `srd-5.2` for the entries taken from the SRD 5.2
 * set, `dd` for those written for this data. The entries of SRD 5.1 carry no `source`. Never translated.
 */
export const RecordSourceSchema = z.enum(['srd-5.2', 'dd']);

export const APIReferenceSchema = z.strictObject({
  index: z.string(),
  name: z.string(),
  url: z.string(),
  note: z.string().optional(),
});

export const DifficultyClassSchema = z.strictObject({
  dc_type: APIReferenceSchema,
  dc_value: z.number().optional(),
  success_type: z.enum(['none', 'half', 'other']),
});

export const DamageSchema = z.strictObject({
  damage_type: APIReferenceSchema,
  damage_dice: z.string(),
  dc: DifficultyClassSchema.optional(),
});

export const AreaOfEffectSchema = z.strictObject({
  size: z.number(),
  type: z.enum(['sphere', 'cube', 'cylinder', 'line', 'cone']),
});

const ConditionEffectSchema = z.strictObject({
  condition_type: APIReferenceSchema,
  duration: z.strictObject({
    length: z.number(),
    unit: z.string(),
    interrupt: z.string().optional(),
    interrupt_modifier: z.string().optional(),
  }),
});

/**
 * `choose` picks from `from`. An `action` option's `count` is the most times that action can be
 * picked in the choice. Monster attacks "in any combination" use `choose: N` with each option at
 * `count: N`, and an option at `count: 1` can be picked once. `id` is a stable id for the choice (the class
 * proficiency and starting-equipment choices have one), never translated.
 */
export const ChoiceSchema: z.ZodType<any> = z.lazy(() =>
  z.strictObject({
    id: z.string().optional(),
    desc: translatable(z.string()).optional(),
    choose: z.number(),
    type: z.string().optional(),
    from: OptionSetSchema,
  })
);

const OptionSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.strictObject({ option_type: z.literal('reference'), item: APIReferenceSchema }),
    z.strictObject({ option_type: z.literal('choice'), choice: ChoiceSchema }),
    z.strictObject({ option_type: z.literal('string'), string: translatable(z.string()) }),
    z.strictObject({
      option_type: z.literal('ability_bonus'),
      ability_score: APIReferenceSchema,
      bonus: z.number(),
    }),
    z.strictObject({
      option_type: z.literal('action'),
      action_name: z.string(),
      count: z.number(),
      type: z.string(),
      desc: translatable(z.string()).optional(),
    }),
    z.strictObject({
      option_type: z.literal('breath'),
      name: translatable(z.string()),
      dc: DifficultyClassSchema,
      damage: z.array(DamageSchema).optional(),
      condition: ConditionEffectSchema.optional(),
    }),
    z.strictObject({
      option_type: z.literal('counted_reference'),
      count: z.number(),
      of: APIReferenceSchema,
      prerequisites: z
        .array(z.strictObject({ type: z.string(), proficiency: APIReferenceSchema.optional() }))
        .optional(),
    }),
    z.strictObject({
      option_type: z.literal('damage'),
      damage_dice: z.string(),
      damage_type: APIReferenceSchema,
      notes: translatable(z.string()).optional(),
    }),
    z.strictObject({
      option_type: z.literal('ideal'),
      alignments: z.array(APIReferenceSchema),
      desc: translatable(z.string()),
    }),
    z.strictObject({ option_type: z.literal('money'), count: z.number(), unit: z.string() }),
    z.strictObject({
      option_type: z.literal('multiple'),
      items: z.array(OptionSchema),
      desc: translatable(z.string()).optional(),
    }),
    z.strictObject({
      option_type: z.literal('score_prerequisite'),
      ability_score: APIReferenceSchema,
      minimum_score: z.number(),
    }),
    z.strictObject({ option_type: z.literal('size'), size: z.string() }),
  ])
);

const OptionSetSchema = z.union([
  z.strictObject({
    option_set_type: z.literal('equipment_category'),
    equipment_category: APIReferenceSchema,
  }),
  z.strictObject({
    option_set_type: z.literal('resource_list'),
    resource_list_url: z.string(),
  }),
  z.strictObject({
    option_set_type: z.literal('options_array'),
    options: z.array(z.union([OptionSchema, translatable(z.string())])),
  }),
]);
