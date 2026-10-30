import { describe, expect, it } from 'vitest';
import ClassData from '../en/5e-SRD-Classes.json' with { type: 'json' };
import FeatureData from '../en/5e-SRD-Features.json' with { type: 'json' };
import SpellData from '../en/5e-SRD-Spells.json' with { type: 'json' };
import Annotations from '../icon-annotations.json' with { type: 'json' };
import { defaultIcon, deriveIcons } from '../derive-icons';

type Record = { index: string; class?: { index: string }; icon?: string };

const collections = {
  spells: SpellData as unknown as Record[],
  features: FeatureData as unknown as Record[],
  classes: ClassData as unknown as Record[],
};
const annotations: { [kind: string]: { [index: string]: string } } = {
  spells: {},
  features: {},
  classes: {},
};
for (const { collection, index, icon } of Annotations as {
  collection: string;
  index: string;
  icon: string;
}[]) {
  expect(annotations[collection][index], `${collection}/${index} is listed twice`).toBeUndefined();
  annotations[collection][index] = icon;
}
const KEY = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

// Kinds whose records each have a key of their own. Features may share a key, as several features share one picture.
const uniqueKinds = ['spells', 'classes'] as const;

describe('icon keys', () => {
  for (const [kind, records] of Object.entries(collections)) {
    describe(kind, () => {
      it('gives every record a key', () => {
        for (const record of records) {
          expect(typeof record.icon, record.index).toBe('string');
          expect(record.icon, record.index).toMatch(KEY);
        }
      });

      it('lists only records that exist in the annotations', () => {
        const indices = new Set(records.map((record) => record.index));
        for (const index of Object.keys(annotations[kind]))
          expect(indices.has(index), index).toBe(true);
      });

      it('is what the derivation writes', () => {
        expect(deriveIcons(kind as keyof typeof collections, records)).toEqual(records);
      });

      it('uses the default key only for a record the annotations do not list', () => {
        for (const record of records) {
          const listed = annotations[kind][record.index];
          expect(record.icon, record.index).toBe(
            listed ?? defaultIcon(kind as keyof typeof collections, record)
          );
        }
      });
    });
  }

  for (const kind of uniqueKinds) {
    it(`gives each of the ${kind} a different key`, () => {
      const keys = collections[kind].map((record) => record.icon);
      expect(new Set(keys).size).toBe(keys.length);
    });
  }

  it('names the default keys by index, or by class for a feature', () => {
    expect(defaultIcon('spells', { index: 'fireball' })).toBe('spell-fireball');
    expect(defaultIcon('classes', { index: 'monk' })).toBe('class-monk');
    expect(defaultIcon('features', { index: 'rage', class: { index: 'barbarian' } })).toBe(
      'feature-barbarian'
    );
  });
});
