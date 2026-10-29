import fs from 'fs';
import { describe, expect, it, vi } from 'vitest';
import MonsterData from '../en/5e-SRD-Monsters.json' with { type: 'json' };
import { normalizeMonsters, serializeMonsters } from '../normalize-monsters';

const normalizedPath = new URL('../5e-SRD-Monsters-Normalized.json', import.meta.url);

describe('normalized monsters', () => {
  it('matches what normalize-monsters.ts generates from the English source', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const generated = normalizeMonsters(MonsterData);
    const committed = JSON.parse(fs.readFileSync(normalizedPath, 'utf8'));

    expect(committed).toEqual(JSON.parse(serializeMonsters(generated)));
    expect(fs.readFileSync(normalizedPath, 'utf8')).toBe(serializeMonsters(generated));
  });

  it('does not mutate the English source while normalizing', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const before = JSON.stringify(MonsterData);
    normalizeMonsters(MonsterData);

    expect(JSON.stringify(MonsterData)).toBe(before);
  });
});
