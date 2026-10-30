import { describe, expect, it } from 'vitest';
import MonsterData from '../en/5e-SRD-Monsters.json' with { type: 'json' };
import NormalizedMonsterData from '../5e-SRD-Monsters-Normalized.json' with { type: 'json' };
import { deriveMonsterEnvironments, parseEnvironments } from '../derive-monster-environments';
import { ENVIRONMENT_TAGS } from '../../schemas/common';

type Monster = { index: string; environments?: string; environment_tags?: string[] };

const monsters = MonsterData as unknown as Monster[];
const normalized = NormalizedMonsterData as unknown as Monster[];

describe('monster environment tags', () => {
  it('uses the 11 documented terms', () => {
    expect([...ENVIRONMENT_TAGS]).toEqual([
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
  });

  it('agrees with the environments text of every monster', () => {
    for (const monster of monsters) {
      if (monster.environments === undefined) {
        expect(monster.environment_tags, monster.index).toBeUndefined();
        continue;
      }
      expect(monster.environment_tags, monster.index).toBeDefined();
      expect(monster.environment_tags!.join(', '), monster.index).toBe(monster.environments);
    }
  });

  it('lists known terms once each', () => {
    for (const monster of monsters) {
      const tags = monster.environment_tags ?? [];
      expect(new Set(tags).size, monster.index).toBe(tags.length);
      for (const tag of tags)
        expect(ENVIRONMENT_TAGS as readonly string[], monster.index).toContain(tag);
    }
  });

  it('is what the derivation writes', () => {
    expect(deriveMonsterEnvironments(monsters)).toEqual(monsters);
  });

  it('is carried into the normalized monsters', () => {
    const byIndex = new Map(normalized.map((monster) => [monster.index, monster.environment_tags]));
    for (const monster of monsters)
      expect(byIndex.get(monster.index), monster.index).toEqual(monster.environment_tags);
  });

  it('rejects a term outside the vocabulary or a repeated term', () => {
    expect(parseEnvironments('x', 'Desert, Mountain')).toEqual(['Desert', 'Mountain']);
    expect(() => parseEnvironments('x', 'Desert, Plane of Fire')).toThrow(/unknown environment/);
    expect(() => parseEnvironments('x', 'Desert, Desert')).toThrow(/repeated/);
  });
});
