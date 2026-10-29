import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { APIReferenceSchema, ChoiceSchema, translatable } from '../../schemas/common';
import { collectionCoverage } from '../coverage';
import { fileSource, localize, overlayLocales } from '../files';
import {
  COLLECTIONS,
  createLocalizer,
  textEntries,
  type Collection,
  type DataRecord,
  type JsonSchema,
  type LocalizationSource,
} from '../localize';
import { stripOverlayRecord, validateOverlay } from '../overlays';

// Two small collections standing in for spells and classes: a spell references a class and has a choice whose text
// sits in a nested array.
const SpellSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  desc: translatable(z.array(z.string())),
  level: z.number(),
  classes: z.array(APIReferenceSchema),
  options: ChoiceSchema.optional(),
  url: z.string(),
});
const ClassSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  url: z.string(),
});

const ref = (collection: string, index: string, name: string) => ({
  index,
  name,
  url: `/api/2014/${collection}/${index}`,
});

const englishSpell = {
  index: 'aid',
  name: 'Aid',
  desc: ['Your spell bolsters your allies.'],
  level: 2,
  classes: [ref('classes', 'cleric', 'Cleric'), ref('classes', 'wizard', 'Wizard')],
  options: {
    desc: 'Choose one',
    choose: 1,
    type: 'feature',
    from: {
      option_set_type: 'options_array',
      options: [
        { option_type: 'reference', item: ref('classes', 'cleric', 'Cleric') },
        { option_type: 'string', string: 'an ally' },
      ],
    },
  },
  url: '/api/2014/spells/aid',
};

const data: Record<string, Record<string, DataRecord[]>> = {
  en: {
    spells: [englishSpell],
    classes: [
      { index: 'cleric', name: 'Cleric', url: '/api/2014/classes/cleric' },
      { index: 'wizard', name: 'Wizard', url: '/api/2014/classes/wizard' },
    ],
  },
  fr: {
    spells: [
      {
        index: 'aid',
        name: 'Aide',
        options: { desc: 'Choisissez-en un', from: { options: [null, { string: 'un allié' }] } },
      },
    ],
    classes: [{ index: 'cleric', name: 'Clerc' }],
  },
};

const schemas: Record<string, JsonSchema> = {
  spells: z.toJSONSchema(SpellSchema) as JsonSchema,
  classes: z.toJSONSchema(ClassSchema) as JsonSchema,
};

const source: LocalizationSource = {
  english: (c) => data.en[c] ?? [],
  overlay: (c, lang) => data[lang]?.[c],
  schema: (c) => schemas[c],
};

describe('translatable()', () => {
  it('carries the mark into the emitted JSON Schema', () => {
    expect(schemas.spells.properties?.name).toMatchObject({ type: 'string', translatable: true });
    expect(schemas.spells.properties?.level).not.toHaveProperty('translatable');
    expect(schemas.spells.properties?.classes).not.toHaveProperty('translatable');
  });
});

describe('createLocalizer', () => {
  const localizeTest = createLocalizer(source);
  const [spell] = localizeTest('spells', 'fr') as unknown as DataRecord[];

  it('takes translatable fields from the overlay and falls back to English for the rest', () => {
    expect(spell.name).toBe('Aide');
    expect(spell.desc).toEqual(['Your spell bolsters your allies.']);
    expect(spell.level).toBe(2);
    expect(spell.url).toBe('/api/2014/spells/aid');
  });

  it('resolves reference names from the translated referenced record', () => {
    expect(spell.classes).toEqual([
      ref('classes', 'cleric', 'Clerc'),
      ref('classes', 'wizard', 'Wizard'),
    ]);
  });

  it('merges nested text by position, with null for an untranslated position', () => {
    expect(spell.options).toEqual({
      ...englishSpell.options,
      desc: 'Choisissez-en un',
      from: {
        option_set_type: 'options_array',
        options: [
          { option_type: 'reference', item: ref('classes', 'cleric', 'Clerc') },
          { option_type: 'string', string: 'un allié' },
        ],
      },
    });
  });

  it('returns English records for en and for a locale without an overlay', () => {
    expect(localizeTest('spells', 'en')).toBe(data.en.spells);
    expect(localizeTest('spells', 'de')).toEqual(data.en.spells);
  });

  it('lists display text with paths', () => {
    expect(textEntries(schemas.spells, spell)).toEqual([
      { path: 'name', value: 'Aide', kind: 'field' },
      { path: 'desc', value: ['Your spell bolsters your allies.'], kind: 'field' },
      { path: 'classes[0].name', value: 'Clerc', kind: 'reference' },
      { path: 'classes[1].name', value: 'Wizard', kind: 'reference' },
      { path: 'options.desc', value: 'Choisissez-en un', kind: 'field' },
      { path: 'options.from.options[0].item.name', value: 'Clerc', kind: 'reference' },
      { path: 'options.from.options[1].string', value: 'un allié', kind: 'field' },
    ]);
  });
});

describe('stripOverlayRecord', () => {
  it('keeps only translatable text, aligned with the English record', () => {
    const fullCopy = {
      ...englishSpell,
      name: 'Aide',
      level: 3,
      classes: [ref('classes', 'cleric', 'Clerc')],
      options: {
        ...englishSpell.options,
        from: {
          option_set_type: 'options_array',
          options: [
            { option_type: 'reference', item: ref('classes', 'cleric', 'Clerc') },
            { option_type: 'string', string: 'un allié' },
          ],
        },
      },
    };
    expect(stripOverlayRecord(schemas.spells, englishSpell, fullCopy)).toEqual({
      index: 'aid',
      name: 'Aide',
      desc: ['Your spell bolsters your allies.'],
      options: { desc: 'Choose one', from: { options: [null, { string: 'un allié' }] } },
    });
  });

  it('returns undefined when nothing translatable is left', () => {
    expect(
      stripOverlayRecord(schemas.spells, englishSpell, { index: 'aid', level: 9, url: 'x' })
    ).toBeUndefined();
  });
});

describe('validateOverlay', () => {
  const check = (overlay: unknown[]) => validateOverlay(schemas.spells, data.en.spells, overlay);

  it('accepts a text-only overlay', () => {
    expect(check(data.fr.spells)).toEqual([]);
  });

  it('rejects structural fields, references, unknown fields and wrong types', () => {
    expect(
      check([
        {
          index: 'aid',
          level: 3,
          url: '/api/2014/spells/aid',
          classes: [ref('classes', 'cleric', 'Clerc')],
          bogus: 'x',
          name: ['Aide'],
          options: { from: { options: [null, { string: 'un allié' }, { string: 'extra' }] } },
        },
      ])
    ).toEqual([
      "['aid'].level: not translatable; it always comes from English",
      "['aid'].url: not translatable; it always comes from English",
      "['aid'].classes: not translatable; it always comes from English",
      "['aid'].bogus: not in the English record",
      "['aid'].name: expected string",
      "['aid'].options.from.options: 3 entries, but English has 2",
    ]);
  });

  it('rejects missing, unknown, duplicate and empty entries', () => {
    expect(check([{ name: 'x' }, { index: 'nope' }, { index: 'aid' }, { index: 'aid' }])).toEqual([
      "[0]: entry needs a string 'index'",
      "['nope']: index is not in the English file",
      "['aid'].no translated fields; remove the entry",
      "['aid']: duplicate index",
      "['aid'].no translated fields; remove the entry",
    ]);
  });
});

describe('collectionCoverage', () => {
  it('counts translated records and translatable field values', () => {
    expect(collectionCoverage(source, 'spells' as Collection, 'fr')).toEqual({
      collection: 'spells',
      records: 1,
      translatedRecords: 1,
      fields: 4,
      translatedFields: 3,
    });
  });
});

describe('localize() over the repository', () => {
  it('returns every English record, in order, for every locale and collection', () => {
    const source = fileSource();
    for (const lang of overlayLocales()) {
      for (const collection of COLLECTIONS) {
        const english = source.english(collection).map((r) => r.index);
        expect(localize(collection, lang).map((r) => r.index)).toEqual(english);
      }
    }
  });
});
