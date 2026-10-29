/**
 * Loads the 2014 English collections and derives their ids, for the id lists in `ids/` and the
 * referential-integrity tests in `src/2014/tests/tables.test.ts`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'src/2014/en');

export type Entry = Record<string, unknown>;

export interface Collection {
  /** Kebab-case collection name, the one used in api urls: `damage-types`. */
  name: string;
  /** Repo-relative path of the data file. */
  file: string;
  entries: Entry[];
}

/** `5e-SRD-Damage-Types.json` -> `damage-types` */
export function collectionName(file: string): string {
  return file.replace(/^5e-SRD-/, '').replace(/\.json$/, '').toLowerCase();
}

export function loadCollections(): Collection[] {
  return fs
    .readdirSync(dataDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({
      name: collectionName(f),
      file: `src/2014/en/${f}`,
      entries: JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')) as Entry[],
    }));
}

/**
 * The collection an api url points into: `/api/2014/conditions/grappled` is `conditions`, and
 * `/api/2014/classes/barbarian/levels/1` is `levels` (class and subclass levels share one file).
 */
export function collectionOfUrl(url: string): string {
  const parts = url.split('/');
  return parts[5] === 'levels' ? 'levels' : parts[3];
}

/** Ids of a collection in code-point order, so the output does not depend on the data order. */
export function sortedIndices(collection: Collection): string[] {
  return collection.entries.map((e) => e.index as string).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
