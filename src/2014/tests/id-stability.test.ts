import { describe, it, expect } from 'vitest';

import {
  loadCollections,
  loadDerivedCollections,
  loadPublished,
  loadTombstones,
  stabilityProblems,
} from '../../../scripts/ids';

const collections = [...loadCollections(), ...loadDerivedCollections()];
const published = loadPublished();
const tombstones = loadTombstones();

describe('id stability contract', () => {
  it('has every published id in the data or in ids/removed.json', () => {
    expect(stabilityProblems(published, collections, tombstones)).toEqual([]);
  });

  it('records the removals made since upstream v5.12.0', () => {
    const counts: Record<string, number> = {};
    for (const t of tombstones) counts[t.collection] = (counts[t.collection] ?? 0) + 1;
    expect(counts).toEqual({
      equipment: 40,
      'equipment-categories': 6,
      monsters: 3,
      proficiencies: 3,
    });
  });

  it('tombstones every field the format documents', () => {
    for (const t of tombstones) {
      expect(t.removedIn, `${t.collection}/${t.index}`).toBeTruthy();
      expect(t.reason, `${t.collection}/${t.index}`).toBeTruthy();
    }
  });

  it('has no duplicate tombstones', () => {
    const keys = tombstones.map((t) => `${t.collection}/${t.index}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('fails when a published id disappears without a tombstone', () => {
    const conditions = collections.find((c) => c.name === 'conditions')!;
    const without = collections.map((c) =>
      c === conditions ? { ...c, entries: c.entries.filter((e) => e.index !== 'blinded') } : c
    );
    expect(stabilityProblems(published, without, tombstones)).toEqual([
      'removed without a tombstone: conditions/blinded',
    ]);
    const tombstone = {
      collection: 'conditions',
      index: 'blinded',
      removedIn: 'test',
      reason: 'test',
    };
    expect(stabilityProblems(published, without, [...tombstones, tombstone])).toEqual([]);
  });

  it('flags a tombstone for an id that is not removed or never existed', () => {
    const alive = { collection: 'conditions', index: 'blinded', removedIn: 'test', reason: 'test' };
    const never = { collection: 'conditions', index: 'nope', removedIn: 'test', reason: 'test' };
    expect(stabilityProblems(published, collections, [...tombstones, alive, never])).toEqual([
      'tombstone for an id that exists again: conditions/blinded',
      'tombstone for an unpublished id: conditions/nope',
    ]);
  });
});
