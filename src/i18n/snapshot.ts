/**
 * Text snapshots of localized records, for the overlay migration (#31) and its round-trip test
 * (`src/i18n/tests/overlay-migration.test.ts`).
 */
import { createHash } from 'node:crypto';
import {
  referenceTarget,
  isPlainObject,
  textEntries,
  type Collection,
  type DataRecord,
  type JsonSchema,
  type LocalizationSource,
  type TextEntry,
} from './localize';

export type TextMap = Map<string, Omit<TextEntry, 'path'>>;

/** The display text of a record keyed by path (see `textEntries`). */
export function textMap(schema: JsonSchema, record: DataRecord): TextMap {
  return new Map(textEntries(schema, record).map(({ path, ...rest }) => [path, rest]));
}

/** The first 64 bits of the SHA-256 of a value's JSON, in hex: enough to notice a change. */
export function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

/** A hash of a text map that does not depend on entry order. */
export function hashTextMap(map: TextMap): string {
  return sha256([...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** The records of localizable collections that the nested references of `record` point at. */
export function referencedRecords(record: DataRecord): { collection: Collection; index: string }[] {
  const out = new Map<string, { collection: Collection; index: string }>();
  const walk = (value: unknown, top: boolean): void => {
    if (Array.isArray(value)) value.forEach((v) => walk(v, false));
    else if (isPlainObject(value)) {
      const target = top ? undefined : referenceTarget(value);
      if (target) out.set(`${target.collection}/${target.index}`, target);
      else Object.values(value).forEach((v) => walk(v, false));
    }
  };
  walk(record, true);
  return [...out.values()];
}

/**
 * A hash of every overlay input that `localize()` reads for one English record in one locale: the record's own
 * overlay entry and the overlay entries of the records its references point at.
 */
export function overlayInputsHash(
  source: LocalizationSource,
  collection: Collection,
  english: DataRecord,
  lang: string
): string {
  const entry = (c: Collection, index: string) =>
    source.overlay(c, lang)?.find((r) => r.index === index) ?? null;
  const targets = referencedRecords(english)
    .map(({ collection: c, index }) => [`${c}/${index}`, entry(c, index)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return sha256([entry(collection, english.index as string), targets]);
}
