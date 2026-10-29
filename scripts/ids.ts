/**
 * Loads the 2014 English collections and derives their ids, for the id lists in `ids/` and the
 * referential-integrity tests in `src/2014/tests/tables.test.ts`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publishedFile = path.join(root, 'ids/published.json');
const removedFile = path.join(root, 'ids/removed.json');
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
  return file
    .replace(/^5e-SRD-/, '')
    .replace(/\.json$/, '')
    .toLowerCase();
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
  return collection.entries
    .map((e) => e.index as string)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Files in `ids/` that are written by hand, so the generator neither writes nor flags them. */
export const HAND_WRITTEN_IDS_FILES = ['ids/removed.json'];

/** Every id ever published, per collection, as committed in `ids/published.json`. */
export type PublishedIds = Record<string, string[]>;

export interface Tombstone {
  collection: string;
  index: string;
  /** The release or commit that removed it. */
  removedIn: string;
  reason: string;
  /** The id that replaces it, if there is one. */
  replacement?: string;
}

export function loadPublished(): PublishedIds {
  return fs.existsSync(publishedFile)
    ? (JSON.parse(fs.readFileSync(publishedFile, 'utf8')) as { collections: PublishedIds })
        .collections
    : {};
}

export function loadTombstones(): Tombstone[] {
  return (JSON.parse(fs.readFileSync(removedFile, 'utf8')) as { removed: Tombstone[] }).removed;
}

/**
 * The committed published ids plus any new current id, so the set only grows: removing an id from
 * the data never removes it from here, which is what lets a test see the removal.
 */
export function publishedIds(current: Collection[]): { collections: PublishedIds } {
  const committed = loadPublished();
  const collections: PublishedIds = {};
  const names = new Set([...Object.keys(committed), ...current.map((c) => c.name)]);
  for (const name of [...names].sort()) {
    const ids = new Set(committed[name] ?? []);
    const collection = current.find((c) => c.name === name);
    if (collection) for (const id of sortedIndices(collection)) ids.add(id);
    collections[name] = [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  return { collections };
}

/**
 * Problems with the id stability contract: a published id that is gone without a tombstone, a
 * tombstone for an id that was never published, and a tombstone for an id that is back.
 */
export function stabilityProblems(
  published: PublishedIds,
  current: Collection[],
  tombstones: Tombstone[]
): string[] {
  const problems: string[] = [];
  const present = new Map(
    current.map((c) => [c.name, new Set(c.entries.map((e) => e.index as string))])
  );
  const tombstoned = new Set(tombstones.map((t) => `${t.collection}/${t.index}`));
  for (const [collection, ids] of Object.entries(published)) {
    for (const id of ids) {
      if (!present.get(collection)?.has(id) && !tombstoned.has(`${collection}/${id}`)) {
        problems.push(`removed without a tombstone: ${collection}/${id}`);
      }
    }
  }
  for (const t of tombstones) {
    const key = `${t.collection}/${t.index}`;
    if (!published[t.collection]?.includes(t.index))
      problems.push(`tombstone for an unpublished id: ${key}`);
    if (present.get(t.collection)?.has(t.index))
      problems.push(`tombstone for an id that exists again: ${key}`);
    if (t.replacement !== undefined && !present.get(t.collection)?.has(t.replacement)) {
      problems.push(`tombstone ${key} names a replacement that does not exist: ${t.replacement}`);
    }
  }
  return problems;
}
