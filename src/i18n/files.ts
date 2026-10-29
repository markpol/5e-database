/**
 * Binds `localize()` to the files in this repository (Node only): English records and overlays from `src/2014/`,
 * JSON Schemas from `schema/`. Used by the tests and the i18n scripts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALE_PATTERN, TRANSLATION_SKIP_DIRS } from './constants';
import {
  COLLECTION_FILES,
  createLocalizer,
  type Collection,
  type DataRecord,
  type JsonSchema,
  type LocalizationSource,
} from './localize';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

/** The data file of a collection in a locale folder (`en` for the English source). */
export function dataPath(root: string, collection: Collection, lang: string): string {
  return path.join(root, 'src/2014', lang, `${COLLECTION_FILES[collection]}.json`);
}

/** The locales with an overlay folder under `src/2014/`, sorted. */
export function overlayLocales(root = REPO_ROOT): string[] {
  return fs
    .readdirSync(path.join(root, 'src/2014'), { withFileTypes: true })
    .filter(
      (e) =>
        e.isDirectory() &&
        e.name !== 'en' &&
        LOCALE_PATTERN.test(e.name) &&
        !TRANSLATION_SKIP_DIRS.has(e.name)
    )
    .map((e) => e.name)
    .sort();
}

/** A cached LocalizationSource reading the repository files under `root`. */
export function fileSource(root = REPO_ROOT): LocalizationSource {
  const cache = new Map<string, unknown>();
  const cached = <T>(file: string, read: () => T): T => {
    if (!cache.has(file)) cache.set(file, read());
    return cache.get(file) as T;
  };
  return {
    english: (collection) => {
      const file = dataPath(root, collection, 'en');
      return cached(file, () => readJson<DataRecord[]>(file));
    },
    overlay: (collection, lang) => {
      const file = dataPath(root, collection, lang);
      return cached(file, () => (fs.existsSync(file) ? readJson<DataRecord[]>(file) : undefined));
    },
    schema: (collection) => {
      const file = path.join(root, 'schema', `${COLLECTION_FILES[collection]}.schema.json`);
      return cached(file, () => readJson<JsonSchema>(file));
    },
  };
}

/** `localize(collection, lang)` over this repository's files. */
export const localize = createLocalizer(fileSource());
