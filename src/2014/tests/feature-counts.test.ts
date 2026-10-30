import { describe, expect, it } from 'vitest';
import FeatureData from '../en/5e-SRD-Features.json' with { type: 'json' };
import LevelData from '../en/5e-SRD-Levels.json' with { type: 'json' };
import {
  COUNT_EXCLUDED,
  COUNT_PROGRESSIONS,
  countsOf,
  featureCountIds,
  type CountStep,
} from '../derive-feature-counts';
import { loadPublished } from '../../../scripts/ids';

type Feature = {
  index: string;
  level: number;
  class: { index: string };
  feature_specific?: { engine?: Record<string, unknown> };
};
type Level = {
  level: number;
  class: { index: string };
  subclass?: unknown;
  class_specific: Record<string, unknown>;
};

const features = FeatureData as unknown as Feature[];
const rows = (LevelData as unknown as Level[]).filter((l) => !l.subclass);

// The value of a `class_specific` key at a level of a class, in the form a step has it.
function levelValue(
  classIndex: string,
  level: number,
  key: string
): { count?: number; dice?: string } {
  const value = rows.find((r) => r.class.index === classIndex && r.level === level)!.class_specific[
    key
  ];
  if (typeof value === 'number') return { count: value };
  const dice = value as { dice_count: number; dice_value: number };
  return { dice: `${dice.dice_count}d${dice.dice_value}` };
}

// The step in force at a level: the last one that starts at or below it.
const stepAt = (steps: CountStep[], level: number) => steps.filter((s) => s.level <= level).at(-1);

// Every `class_specific` key an engine reads, with where.
function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([name, v]) =>
    (name === 'class_specific' || name === 'cost_class_specific') && typeof v === 'string'
      ? [v]
      : name === 'class_specific' && Array.isArray(v)
        ? (v as string[])
        : keysOf(v)
  );
}

describe('feature counts', () => {
  const counted = features.filter((f) => countsOf(f).length > 0);

  it('covers the count-bearing features and the counts they have', () => {
    expect(counted.map((f) => f.index).sort()).toEqual(Object.keys(COUNT_PROGRESSIONS).sort());
    for (const f of counted) {
      expect(
        countsOf(f)
          .map((c) => c.key)
          .sort(),
        f.index
      ).toEqual(COUNT_PROGRESSIONS[f.index].map((p) => p.key).sort());
    }
    expect(featureCountIds(features)).toHaveLength(76);
  });

  it('agrees with the Levels rows of the class at every level', () => {
    for (const f of counted) {
      for (const { key, steps } of countsOf(f)) {
        for (let level = 1; level <= 20; level++) {
          const value = levelValue(f.class.index, level, key);
          const step = stepAt(steps, level);
          const label = `${f.index} ${key} at level ${level}`;
          if (value.count === 0) expect(step, label).toBeUndefined();
          else expect(step, label).toMatchObject(value);
        }
        // A step only where the value changes, in the order of the levels.
        steps.forEach((step, i) => {
          if (i > 0) {
            expect(step.level, `${f.index} ${key}`).toBeGreaterThan(steps[i - 1].level);
            expect(step.count ?? step.dice, `${f.index} ${key}`).not.toEqual(
              steps[i - 1].count ?? steps[i - 1].dice
            );
          }
        });
      }
    }
  });

  it('has a unique id for each count, named after the feature and the count', () => {
    const all = featureCountIds(features);
    expect(new Set(all).size).toBe(all.length);
    for (const f of counted) {
      for (const { steps } of countsOf(f)) {
        for (const step of steps) {
          expect(step.id, f.index).toMatch(/^[a-z]+(-[a-z]+)*-(\d+|unlimited)(-[a-z]+|d\d+)?$/);
        }
      }
    }
    expect(all).toContain('rage-3-uses');
    expect(all).toContain('rage-unlimited-uses');
    expect(all).toContain('sneak-attack-10d6');
    expect(all).toContain('martial-arts-1d10');
    expect(all).toContain('unarmored-movement-30-ft');
  });

  it('counts every other level-dependent number of an engine, or says why not', () => {
    for (const f of features) {
      const engine = f.feature_specific?.engine;
      if (!engine) continue;
      const counts = new Set(countsOf(f).map((c) => c.key));
      for (const key of new Set(keysOf(engine))) {
        const values = new Set(
          rows
            .filter((r) => r.class.index === f.class.index && r.level >= f.level)
            .map((r) => JSON.stringify(r.class_specific[key]))
        );
        if (values.size < 2) continue;
        const label = `${f.index}:${key}`;
        expect(counts.has(key) || label in COUNT_EXCLUDED, label).toBe(true);
        expect(counts.has(key) && label in COUNT_EXCLUDED, label).toBe(false);
      }
    }
  });

  it('only lists exclusions that exist', () => {
    for (const label of Object.keys(COUNT_EXCLUDED)) {
      const [index, key] = label.split(':');
      const f = features.find((x) => x.index === index);
      expect(f, label).toBeDefined();
      expect(keysOf(f!.feature_specific?.engine), label).toContain(key);
    }
  });

  it('only grows: every published count id is still in the data', () => {
    expect(loadPublished()['feature-counts']).toEqual(
      [...new Set(featureCountIds(features))].sort()
    );
  });

  it('leaves the ids of the features that have a record for each count as they are', () => {
    const indices = new Set(features.map((f) => f.index));
    for (const id of [
      'action-surge-1-use',
      'action-surge-2-uses',
      'extra-attack-2',
      'channel-divinity-2-rest',
      'indomitable-3-uses',
    ]) {
      expect(indices.has(id), id).toBe(true);
    }
  });
});
