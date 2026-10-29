/**
 * Per-locale translation coverage: how many English records an overlay covers and how many of their translatable
 * fields it translates. Informational only; nothing gates on it.
 */
import {
  COLLECTIONS,
  deref,
  isPlainObject,
  propertySchema,
  select,
  type Collection,
  type DataRecord,
  type JsonSchema,
  type LocalizationSource,
} from './localize';

export interface CollectionCoverage {
  collection: Collection;
  /** English records, and those with an overlay entry. */
  records: number;
  translatedRecords: number;
  /** Translatable field values across all English records, and those the overlay provides. */
  fields: number;
  translatedFields: number;
}

/** Counts the translatable fields of an English value, and how many of them `overlay` provides. */
function countFields(
  node: JsonSchema | undefined,
  root: JsonSchema,
  english: unknown,
  overlay: unknown
): [total: number, translated: number] {
  const n = select(node, english, root);
  if (n?.translatable) return [1, overlay === undefined || overlay === null ? 0 : 1];
  let total = 0;
  let translated = 0;
  const add = ([t, d]: [number, number]) => {
    total += t;
    translated += d;
  };
  if (Array.isArray(english)) {
    const over = Array.isArray(overlay) ? overlay : [];
    english.forEach((e, i) => add(countFields(n?.items, root, e, over[i])));
  } else if (isPlainObject(english)) {
    const over = isPlainObject(overlay) ? overlay : {};
    for (const [k, v] of Object.entries(english)) {
      add(countFields(n && propertySchema(n, k), root, v, over[k]));
    }
  }
  return [total, translated];
}

export function collectionCoverage(
  source: LocalizationSource,
  collection: Collection,
  lang: string
): CollectionCoverage {
  const schema = source.schema(collection);
  const root = deref(schema, schema);
  const overlay = new Map((source.overlay(collection, lang) ?? []).map((r) => [r.index, r]));
  const result: CollectionCoverage = {
    collection,
    records: 0,
    translatedRecords: 0,
    fields: 0,
    translatedFields: 0,
  };
  for (const english of source.english(collection)) {
    const entry: DataRecord | undefined = overlay.get(english.index);
    result.records++;
    if (entry) result.translatedRecords++;
    for (const [k, v] of Object.entries(english)) {
      if (k === 'index') continue;
      const [t, d] = countFields(propertySchema(root, k), schema, v, entry?.[k]);
      result.fields += t;
      result.translatedFields += d;
    }
  }
  return result;
}

/** Coverage of every collection that has translatable fields. */
export function localeCoverage(source: LocalizationSource, lang: string): CollectionCoverage[] {
  return COLLECTIONS.map((c) => collectionCoverage(source, c, lang)).filter((r) => r.fields > 0);
}

function percent(part: number, whole: number): string {
  return whole === 0 ? '-' : `${((100 * part) / whole).toFixed(1)}%`;
}

/** A Markdown report with one table per locale. */
export function renderCoverage(source: LocalizationSource, locales: string[]): string {
  const lines = ['## Translation coverage (2014)', ''];
  lines.push(
    'Records: English records with an overlay entry. Fields: translatable field values the overlay translates.',
    'Reference names are not counted; they follow the referenced record.',
    ''
  );
  const summary = ['| locale | records | fields |', '| --- | ---: | ---: |'];
  const details: string[] = [];
  for (const lang of locales) {
    const rows = localeCoverage(source, lang);
    const sum = (key: keyof Omit<CollectionCoverage, 'collection'>) =>
      rows.reduce((n, r) => n + r[key], 0);
    summary.push(
      `| ${lang} | ${sum('translatedRecords')}/${sum('records')} (${percent(sum('translatedRecords'), sum('records'))}) | ${sum('translatedFields')}/${sum('fields')} (${percent(sum('translatedFields'), sum('fields'))}) |`
    );
    details.push(
      '',
      `### ${lang}`,
      '',
      '| collection | records | fields |',
      '| --- | ---: | ---: |'
    );
    for (const r of rows) {
      details.push(
        `| ${r.collection} | ${r.translatedRecords}/${r.records} | ${r.translatedFields}/${r.fields} (${percent(r.translatedFields, r.fields)}) |`
      );
    }
  }
  return `${[...lines, ...summary, ...details].join('\n')}\n`;
}
