import { describe, expect, it } from 'vitest';
import MonsterData from '../en/5e-SRD-Monsters.json' with { type: 'json' };
import NormalizedMonsterData from '../5e-SRD-Monsters-Normalized.json' with { type: 'json' };
import MagicItemData from '../en/5e-SRD-Magic-Items.json' with { type: 'json' };

type Monster = { index: string; environments?: string };
type MagicItem = { index: string; cost?: { quantity: number; unit: string }; weight?: number };

const Monsters = MonsterData as unknown as Monster[];
const NormalizedMonsters = NormalizedMonsterData as unknown as Monster[];
const MagicItems = MagicItemData as unknown as MagicItem[];

const environmentTerms = new Set([
  'Arctic',
  'Coastal',
  'Desert',
  'Forest',
  'Grassland',
  'Hill',
  'Mountain',
  'Swamp',
  'Underdark',
  'Underwater',
  'Urban',
]);

// Monsters with no habitat in the vocabulary. Empty: planar creatures use Underdark or Urban.
const monstersWithoutEnvironments = new Set<string>();

// Magic items that cannot sensibly be priced.
const itemsWithoutCost = new Map([['orb-of-dragonkind', 'artifact']]);

describe('monster environments', () => {
  it('gives every monster a non-empty list of known terms', () => {
    for (const monster of Monsters) {
      if (monstersWithoutEnvironments.has(monster.index)) {
        expect(monster.environments, monster.index).toBeUndefined();
        continue;
      }
      expect(monster.environments, monster.index).toBeTruthy();
      const terms = monster.environments!.split(', ');
      expect(new Set(terms).size, monster.index).toBe(terms.length);
      for (const term of terms) expect(environmentTerms.has(term), `${monster.index}: ${term}`).toBe(true);
    }
  });

  it('is carried into the normalized monsters', () => {
    const byIndex = new Map(NormalizedMonsters.map((monster) => [monster.index, monster.environments]));
    for (const monster of Monsters) expect(byIndex.get(monster.index), monster.index).toBe(monster.environments);
  });
});

describe('magic item cost and weight', () => {
  it('gives every item a cost unless it is listed as an exception', () => {
    for (const item of MagicItems) {
      if (itemsWithoutCost.has(item.index)) {
        expect(item.cost, item.index).toBeUndefined();
        continue;
      }
      expect(item.cost?.unit, item.index).toBe('gp');
      expect(Number.isInteger(item.cost?.quantity) && item.cost!.quantity > 0, item.index).toBe(true);
    }
  });

  it('gives every item a weight in pounds', () => {
    for (const item of MagicItems) {
      expect(typeof item.weight, item.index).toBe('number');
      expect(item.weight!, item.index).toBeGreaterThanOrEqual(0);
    }
  });
});
