import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import {
  collectionOfUrl,
  loadCollections,
  loadDerivedCollections,
  sortedIndices,
  type Entry,
} from '../../../scripts/ids';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const collections = loadCollections();
const indicesByCollection = new Map(
  collections.map((c) => [c.name, new Map(c.entries.map((e) => [e.index as string, e]))])
);
const has = (collection: string, index: unknown) =>
  indicesByCollection.get(collection)?.has(index as string) ?? false;

const normalizedMonsters = JSON.parse(
  fs.readFileSync(path.join(root, 'src/2014/5e-SRD-Monsters-Normalized.json'), 'utf8')
) as Entry[];
const englishMonsters = collections.find((c) => c.name === 'monsters')!.entries;

/** The index a url names: `/api/2014/spells/fireball` -> `fireball`, `.../classes/cleric/levels/1` -> `cleric-1`. */
function urlIndex(url: string): string {
  const parts = url.split('/');
  return parts[5] === 'levels' ? `${parts[4]}-${parts[6]}` : parts[4];
}

/** Calls back for every object nested anywhere inside `value`, with the path to it. */
function walk(value: unknown, at: string, callback: (object: Entry, at: string) => void): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${at}[${i}]`, callback));
  } else if (typeof value === 'object' && value !== null) {
    callback(value as Entry, at);
    for (const [key, v] of Object.entries(value)) walk(v, `${at}.${key}`, callback);
  }
}

describe('ids', () => {
  it('are strings, unique within a collection, and lowercase url-safe', () => {
    const errors: string[] = [];
    for (const c of collections) {
      const seen = new Set<unknown>();
      for (const entry of c.entries) {
        if (typeof entry.index !== 'string' || !/^[a-z0-9-]+$/.test(entry.index)) {
          errors.push(`${c.file}: invalid index ${JSON.stringify(entry.index)}`);
        } else if (seen.has(entry.index)) {
          errors.push(`${c.file}: index '${entry.index}' already exists`);
        }
        seen.add(entry.index);
      }
    }
    expect(errors).toEqual([]);
  });

  it('match the url of the entry', () => {
    const errors: string[] = [];
    for (const c of collections) {
      for (const entry of c.entries) {
        const url = entry.url as string;
        if (collectionOfUrl(url) !== c.name)
          errors.push(`${c.file}: '${entry.index}' has url '${url}'`);
        if (
          !url.startsWith('/api/2014/') ||
          (c.name !== 'levels' && url !== `/api/2014/${c.name}/${entry.index}`)
        ) {
          errors.push(`${c.file}: url '${url}' does not match index '${entry.index}'`);
        }
      }
    }
    expect(errors).toEqual([]);
  });
});

describe('references', () => {
  it('resolve by (collection, index) and agree with the entry they point at', () => {
    const errors: string[] = [];
    let count = 0;
    for (const c of collections) {
      for (const entry of c.entries) {
        walk(entry, `${c.file}:${entry.index}`, (object, at) => {
          if (typeof object.url !== 'string') return;
          if (object === entry) return;
          count++;
          const collection = collectionOfUrl(object.url);
          // Some references (spells in spellcasting, level prerequisites) carry no index; the url names it.
          const index = object.index ?? urlIndex(object.url);
          const target = indicesByCollection.get(collection)?.get(index as string);
          if (!target) {
            errors.push(`${at}: no ${collection} entry with index '${index}'`);
          } else if (target.url !== object.url) {
            errors.push(`${at}: url '${object.url}' should be '${target.url}'`);
          } else if (target.name !== undefined && object.name !== target.name) {
            errors.push(`${at}: name '${object.name}' should be '${target.name}'`);
          }
        });
      }
    }
    expect(count).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
});

describe('monster references', () => {
  // Allowance: these supplies are ammunition the monsters carry that the SRD has no equipment entry for.
  const supplyWithoutEquipment = new Set(['rock', 'harpoon', 'poisoned-dart']);

  const actionsOf = (monsters: Entry[]) =>
    monsters.flatMap((m) =>
      ((m.actions ?? []) as Entry[]).map((a) => ({ at: `${m.index}: ${a.name}`, action: a }))
    );

  for (const [label, monsters] of [
    ['english', englishMonsters],
    ['normalized', normalizedMonsters],
  ] as const) {
    it(`resolve every weapon and supply.item (${label})`, () => {
      const errors: string[] = [];
      for (const { at, action } of actionsOf(monsters)) {
        if (action.weapon !== undefined && !has('equipment', action.weapon)) {
          errors.push(`${at}: weapon '${action.weapon}' is not in equipment`);
        }
        const item = (action.supply as Entry | undefined)?.item;
        if (
          item !== undefined &&
          !has('equipment', item) &&
          !supplyWithoutEquipment.has(item as string)
        ) {
          errors.push(`${at}: supply item '${item}' is not in equipment`);
        }
      }
      expect(errors).toEqual([]);
    });

    it(`resolve every condition id in situation and bonus_action (${label})`, () => {
      const errors: string[] = [];
      let count = 0;
      const conditionId = (value: unknown) =>
        typeof value === 'string' ? value : (value as Entry | undefined)?.index;
      const check = (at: string, value: unknown) => {
        count++;
        if (!has('conditions', conditionId(value)))
          errors.push(`${at}: condition '${conditionId(value)}' does not exist`);
      };
      for (const monster of monsters) {
        walk(monster, String(monster.index), (object, at) => {
          const condition = (object.situation as { target?: { condition?: unknown } } | undefined)
            ?.target?.condition;
          if (condition !== undefined) check(`${at}.situation`, condition);
        });
      }
      expect(count).toBeGreaterThan(0);
      expect(errors).toEqual([]);
    });
  }
});

describe('ids/', () => {
  const lists = [...collections, ...loadDerivedCollections()];
  it('has one list per collection', () => {
    const files = fs
      .readdirSync(path.join(root, 'ids'))
      .filter((f) => f !== 'published.json' && f !== 'removed.json')
      .sort();
    expect(files).toEqual(lists.map((c) => `${c.name}.json`).sort());
    for (const c of lists) {
      const list = JSON.parse(fs.readFileSync(path.join(root, 'ids', `${c.name}.json`), 'utf8'));
      expect(list).toEqual({ collection: c.name, indices: sortedIndices(c) });
    }
  });
});
