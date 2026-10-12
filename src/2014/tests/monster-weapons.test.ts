import { describe, expect, it } from 'vitest';
import Monsters from '../en/5e-SRD-Monsters.json' with { type: 'json' };
import NormalizedMonsters from '../5e-SRD-Monsters-Normalized.json' with { type: 'json' };
import Equipment from '../en/5e-SRD-Equipment.json' with { type: 'json' };
import { normalizeAction } from '../normalize-monsters';

const equipmentByIndex = new Map(Equipment.map((item) => [item.index, item]));
const nonEquipmentSupplies = new Set(['rock', 'harpoon', 'poisoned-dart']);

describe('monster weapon annotations', () => {
  it('references valid weapon and supply equipment and matching ammunition', () => {
    for (const monster of Monsters) {
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

  it('keeps weapon and supply annotations in the normalized monster data', () => {
    const sourceRows = new Map(Monsters.flatMap((monster) => (monster.actions ?? [])
      .filter((action) => action.weapon || action.weapon_kind || action.supply)
      .map((action) => [`${monster.index}:${action.name}`, action] as const)));
    const normalizedRows = new Map(NormalizedMonsters.flatMap((monster) => (monster.actions ?? [])
      .filter((action) => action.weapon || action.weapon_kind || action.supply)
      .map((action) => [`${monster.index}:${action.name}`, action] as const)));

    expect(normalizedRows.size).toBe(sourceRows.size);
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
