import { describe, expect, it } from 'vitest';
import MonsterData from '../en/5e-SRD-Monsters.json' with { type: 'json' };
import NormalizedMonsterData from '../5e-SRD-Monsters-Normalized.json' with { type: 'json' };
import EquipmentData from '../en/5e-SRD-Equipment.json' with { type: 'json' };
import { normalizeAction } from '../normalize-monsters';

type MonsterActionAnnotations = {
  name: string;
  weapon?: string;
  weapon_kind?: 'natural' | 'manufactured' | 'spell';
  supply?: { item: string; count: number };
};

type MonsterAnnotations = {
  index: string;
  actions?: MonsterActionAnnotations[];
};

type EquipmentAnnotations = {
  index: string;
  ammunition?: string;
};

const Monsters = MonsterData as unknown as MonsterAnnotations[];
const NormalizedMonsters = NormalizedMonsterData as unknown as MonsterAnnotations[];
const Equipment = EquipmentData as unknown as EquipmentAnnotations[];
const equipmentByIndex = new Map(Equipment.map((item) => [item.index, item]));
const nonEquipmentSupplies = new Set(['rock', 'harpoon', 'poisoned-dart']);

describe('monster weapon annotations', () => {
  it.each([
    ['English', Monsters],
    ['normalized', NormalizedMonsters],
  ])('references valid weapon and supply equipment and matching ammunition in the %s data', (_name, monsters) => {
    for (const monster of monsters) {
      for (const action of monster.actions ?? []) {
        if (action.weapon) {
          expect(equipmentByIndex.has(action.weapon), `${monster.index}: ${action.name} weapon`).toBe(true);
        }
        if (action.supply && !nonEquipmentSupplies.has(action.supply.item)) {
          expect(equipmentByIndex.has(action.supply.item), `${monster.index}: ${action.name} supply`).toBe(true);
        }
        if (action.weapon && equipmentByIndex.get(action.weapon)?.ammunition) {
          expect(action.supply?.item, `${monster.index}: ${action.name} ammunition`).toBe(equipmentByIndex.get(action.weapon)?.ammunition);
        }
      }
    }
  });

  it('uses only the three documented non-equipment supply tokens', () => {
    const used = new Set(
      NormalizedMonsters.flatMap((monster) => (monster.actions ?? []).map((action) => action.supply?.item)).filter(
        (item): item is string => !!item && !equipmentByIndex.has(item),
      ),
    );

    expect([...used].sort()).toEqual([...nonEquipmentSupplies].sort());
  });

  it('keeps weapon and supply annotations of the English data in the normalized monster data', () => {
    const sourceRows = new Map(Monsters.flatMap((monster) => (monster.actions ?? [])
      .filter((action) => action.weapon || action.weapon_kind || action.supply)
      .map((action) => [`${monster.index}:${action.name}`, action] as const)));
    const normalizedRows = new Map(NormalizedMonsters.flatMap((monster) => (monster.actions ?? [])
      .filter((action) => action.weapon || action.weapon_kind || action.supply)
      .map((action) => [`${monster.index}:${action.name}`, action] as const)));

    // The annotations file completes the English data, so the normalized data has at least its rows.
    expect(normalizedRows.size).toBeGreaterThanOrEqual(sourceRows.size);
    for (const [key, action] of sourceRows) {
      expect(normalizedRows.get(key)).toMatchObject({
        ...(action.weapon ? { weapon: action.weapon } : {}),
        ...(action.weapon_kind ? { weapon_kind: action.weapon_kind } : {}),
        ...(action.supply ? { supply: action.supply } : {}),
      });
    }
  });

  it('preserves Shortbow weapon and supply fields through normalizeAction', () => {
    const input = {
      name: 'Shortbow',
      weapon: 'shortbow',
      weapon_kind: 'manufactured',
      supply: { item: 'arrow', count: 20 },
      damage: [{ damage_dice: '1d6', damage_type: { index: 'piercing', name: 'Piercing', url: '/api/2014/damage-types/piercing' } }],
    };
    const normalized = normalizeAction(structuredClone(input));

    expect(normalized).toMatchObject({
      ...input,
      damage: [{ damage_dice: '1d6', damage_type: 'piercing' }],
    });
  });
});
