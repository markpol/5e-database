import { describe, expect, it } from 'vitest';
import MonsterData from '../en/5e-SRD-Monsters.json' with { type: 'json' };
import NormalizedMonsterData from '../5e-SRD-Monsters-Normalized.json' with { type: 'json' };
import ConditionData from '../en/5e-SRD-Conditions.json' with { type: 'json' };
import Annotations from '../monster-engine-annotations.json' with { type: 'json' };
import { applyEngineAnnotations, type EngineAnnotation } from '../normalize-monsters';

type Entry = Record<string, any>;
type Part = { name: string; desc: string; damage?: Entry[]; condition?: Entry; dc?: Entry } & Entry;
type Monster = { index: string; actions?: Part[]; special_abilities?: Part[] } & Entry;

const english = MonsterData as unknown as Monster[];
const normalized = NormalizedMonsterData as unknown as Monster[];
const annotations = Annotations as unknown as EngineAnnotation[];
const conditionIndices = new Set((ConditionData as { index: string }[]).map((condition) => condition.index));

const find = (monsters: Monster[], index: string, section: 'actions' | 'special_abilities', name: string): Part => {
  const part = monsters.find((monster) => monster.index === index)?.[section]?.find((item) => item.name === name);
  if (!part) throw new Error(`${index} ${section} ${name} not found`);
  return part;
};
const dice = (part: Part) =>
  (part.damage ?? []).flatMap((entry) =>
    'damage_dice' in entry
      ? [[entry.damage_type?.index ?? entry.damage_type, entry.damage_dice] as [string, string]]
      : [],
  );

describe('monster damage entries', () => {
  // The damage the action text states, as `dice` + `type`, e.g. "7 (2d6 + 3) bludgeoning damage".
  // An untyped "extra 7 (2d6) damage" (elk Charge) matches any type.
  const stated = (desc: string) => {
    const pairs = [...desc.matchAll(/\((\d+d\d+(?: ?[+-] ?\d+)?)\)\s+(\w+)/g)].map(
      (match) => [match[1].replaceAll(' ', ''), match[2]] as [string, string],
    );
    for (const match of desc.matchAll(/(?<![\d(d])(\d+) (\w+) damage/g)) pairs.push([match[1], match[2]]);
    for (const match of desc.matchAll(/(\d+d\d+) (\w+) damage/g)) pairs.push([match[1], match[2]]);
    return pairs;
  };

  it('has dice and a type that the action text states', () => {
    const mismatches: string[] = [];
    for (const monster of english) {
      for (const section of ['actions', 'legendary_actions', 'special_abilities', 'reactions'] as const) {
        for (const part of (monster as Entry)[section] ?? []) {
          const text = stated(part.desc ?? '');
          const entries = [
            ...(part.damage ?? []),
            ...(part.attacks ?? []).flatMap((attack: Entry) => attack.damage ?? []),
            ...(part.options?.from?.options ?? []).flatMap((option: Entry) => option.damage ?? []),
          ];
          for (const entry of entries) {
            if (!('damage_dice' in entry)) continue;
            const key = `${entry.damage_dice.replaceAll(' ', '')} ${entry.damage_type.index}`;
            const found = text.some(([d, t]) => d === entry.damage_dice.replaceAll(' ', '') && (t === entry.damage_type.index || t === 'damage'));
            if (!found) mismatches.push(`${monster.index} / ${part.name}: ${key}`);
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it.each([
    ['crocodile', 'Bite', 0, 'piercing', '1d10+2'],
    ['duergar', 'Javelin', 0, 'piercing', '1d6+2'],
    ['eagle', 'Talons', 0, 'slashing', '1d4+2'],
    ['ettercap', 'Bite', 0, 'piercing', '1d8+2'],
    ['ettercap', 'Claws', 0, 'slashing', '2d4+2'],
    ['flying-snake', 'Bite', 0, 'piercing', '1'],
    ['gibbering-mouther', 'Bites', 0, 'piercing', '5d6'],
    ['hunter-shark', 'Bite', 0, 'piercing', '2d8+4'],
    ['noble', 'Rapier', 0, 'piercing', '1d8+1'],
    ['plesiosaurus', 'Bite', 0, 'piercing', '3d6+4'],
    ['scorpion', 'Sting', 0, 'piercing', '1'],
  ])('%s %s damage %i is %s %s in both monster files', (index, name, position, type, expectedDice) => {
    for (const monsters of [english, normalized]) {
      const entry = find(monsters, index, 'actions', name).damage?.[position] as Entry;
      expect(entry.damage_type?.index ?? entry.damage_type).toBe(type);
      expect(entry.damage_dice).toBe(expectedDice);
    }
  });

  it("rolls the rhinoceros Charge's extra damage as 2d8", () => {
    expect(dice(find(english, 'rhinoceros', 'special_abilities', 'Charge'))).toEqual([['bludgeoning', '2d8']]);
    expect(dice(find(normalized, 'rhinoceros', 'special_abilities', 'Charge'))).toEqual([['bludgeoning', '2d8']]);
  });

  it("states the otyugh's Tentacle Slam damage with its save and stun", () => {
    const [entry] = find(normalized, 'otyugh', 'actions', 'Tentacle Slam').damage as Entry[];
    expect(entry).toEqual({
      damage_type: 'bludgeoning',
      damage_dice: '2d6+3',
      dc: { dc_type: 'con', dc_value: 14, success_type: 'half' },
      condition: { condition_type: 'stunned', duration: { length: 1, unit: 'round' } },
    });
  });
});

describe('monster rider annotations', () => {
  const saveOf = (value: Entry) => `DC ${value.dc_value}`;

  it('names a monster, section and action that exist, and only known keys', () => {
    const keys = new Set(['monster', 'section', 'name', 'attack', 'damage', 'append_damage', 'set']);
    for (const annotation of annotations) {
      expect(Object.keys(annotation).filter((key) => !keys.has(key)), JSON.stringify(annotation)).toEqual([]);
      const monster = english.find((item) => item.index === annotation.monster);
      expect(monster, annotation.monster).toBeDefined();
      expect((monster as Entry)[annotation.section]?.some((part: Part) => part.name === annotation.name), JSON.stringify(annotation)).toBe(true);
    }
  });

  it('uses only condition ids that exist in the conditions', () => {
    const used = new Set<string>();
    const walk = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') {
        for (const [key, inner] of Object.entries(value)) {
          if (key === 'condition_type' || (key === 'condition' && typeof inner === 'string')) used.add(inner as string);
          else walk(inner);
        }
      }
    };
    annotations.forEach((annotation) => walk([annotation.append_damage, annotation.set]));
    for (const id of used) expect(conditionIndices.has(id), id).toBe(true);
  });

  it('gives each added save the DC its action text states', () => {
    for (const annotation of annotations) {
      const entries = [...(annotation.append_damage ?? []), ...Object.values(annotation.set ?? {})] as Entry[];
      const part = (english.find((item) => item.index === annotation.monster) as Entry)[annotation.section].find(
        (item: Part) => item.name === annotation.name,
      ) as Part;
      for (const entry of entries) {
        if (entry.dc) expect(part.desc, `${annotation.monster} ${annotation.name}`).toContain(saveOf(entry.dc));
        if (entry.grapple) {
          expect(part.desc, `${annotation.monster} ${annotation.name}`).toMatch(
            new RegExp(`(escape DC|DC) ${entry.grapple.escape_dc_value}`),
          );
        }
      }
    }
  });

  it('repeats the save at the end of the next turn for every two-stage condition', () => {
    const staged: Entry[] = [];
    for (const monster of normalized) {
      for (const section of ['actions', 'special_abilities'] as const) {
        for (const part of monster[section] ?? []) {
          for (const owner of [part, ...(part.damage ?? [])]) {
            if (owner.condition?.on_failed_repeat_save) staged.push({ monster: monster.index, name: part.name, owner });
          }
        }
      }
    }
    expect(staged.map(({ monster, name }) => `${monster} ${name}`).sort()).toEqual([
      'basilisk Petrifying Gaze',
      'cockatrice Bite',
      'gorgon Petrifying Breath',
    ]);
    for (const { monster, name, owner } of staged) {
      expect(owner.dc, `${monster} ${name}`).toBeDefined();
      expect(owner.condition.condition_type).toBe('restrained');
      expect(owner.condition.duration.interrupt).toBe('saving throw success');
      expect(owner.condition.on_failed_repeat_save.condition_type).toBe('petrified');
    }
  });

  it('pulls only by a distance the action text states', () => {
    const pulling = normalized.flatMap((monster) =>
      (monster.actions ?? []).filter((action) => action.pull_distance_ft !== undefined).map((action) => ({ monster, action })),
    );
    expect(pulling.map(({ monster, action }) => `${monster.index} ${action.name}`)).toEqual(['roper Reel']);
    for (const { action } of pulling) {
      expect(action.desc).toContain(`${action.pull_distance_ft} ft.`);
      expect(action.situation).toEqual({ target: { condition: 'grappled' } });
    }
  });

  it('adds the riders to the monsters they belong to', () => {
    const rider = (index: string, name: string) => find(normalized, index, 'actions', name).damage as Entry[];
    expect(rider('gladiator', 'Shield Bash')[1]).toEqual({
      dc: { dc_type: 'str', dc_value: 15, success_type: 'none' },
      condition: { condition_type: 'prone', duration: { length: 1, unit: 'round' } },
    });
    expect(rider('deep-gnome-svirfneblin', 'Poisoned Dart')[1]).toEqual({
      dc: { dc_type: 'con', dc_value: 12, success_type: 'none' },
      condition: { condition_type: 'poisoned', duration: { length: 10, unit: 'round', interrupt: 'saving throw success' } },
    });
    expect(rider('gibbering-mouther', 'Blinding Spittle')[0].condition).toEqual({
      condition_type: 'blinded',
      duration: { length: 1, unit: 'round' },
    });
    const blinded = { condition_type: 'blinded', duration: { length: 10, unit: 'round', interrupt: 'saving throw success' } };
    expect(rider('dust-mephit', 'Blinding Breath')[0].condition).toEqual(blinded);
    expect(find(normalized, 'dust-mephit', 'special_abilities', 'Death Burst').condition).toEqual(blinded);
    expect(rider('cockatrice', 'Bite')[1].condition).toEqual({
      condition_type: 'restrained',
      duration: { length: 1, unit: 'round', interrupt: 'saving throw success' },
      on_failed_repeat_save: { condition_type: 'petrified', duration: { length: 24, unit: 'hour' } },
    });
    for (const [monster, name] of [['gorgon', 'Petrifying Breath']] as const) {
      expect(rider(monster, name)[0].condition.on_failed_repeat_save).toEqual({
        condition_type: 'petrified',
        duration: { length: 1, unit: 'until restored' },
      });
    }
    expect(find(normalized, 'basilisk', 'special_abilities', 'Petrifying Gaze').condition?.on_failed_repeat_save?.duration).toEqual({
      length: 1,
      unit: 'until restored',
    });
  });

  it('gives the restraining attacks a grapple with the escape DC of their text', () => {
    const expected: [string, string, number][] = [
      ['ettercap', 'Web', 11],
      ['giant-spider', 'Web', 12],
      ['otyugh', 'Tentacle', 13],
      ['roper', 'Tendril', 15],
    ];
    for (const [monster, name, escape] of expected) {
      const damage = find(normalized, monster, 'actions', name).damage as Entry[];
      expect(damage.at(-1)).toEqual({
        grapple: {
          escape_dc_value: escape,
          additional_condition: { condition_type: 'restrained', duration: { length: 1, unit: 'until escape' } },
        },
      });
    }
  });
});

describe('applyEngineAnnotations', () => {
  const monster = () => ({
    index: 'test',
    actions: [{ name: 'Bite', damage: [{ damage_type: 'piercing', damage_dice: '1d4' }] }, { name: 'Web' }],
  });

  it('appends damage entries after the existing ones and creates the list when it is absent', () => {
    const target = monster();
    applyEngineAnnotations(target, [
      { monster: 'test', section: 'actions', name: 'Bite', append_damage: [{ grapple: { escape_dc_value: 10 } }] },
      { monster: 'test', section: 'actions', name: 'Web', append_damage: [{ grapple: { escape_dc_value: 11 } }] },
    ]);
    expect(target.actions[0].damage).toEqual([
      { damage_type: 'piercing', damage_dice: '1d4' },
      { grapple: { escape_dc_value: 10 } },
    ]);
    expect((target.actions[1] as { damage: unknown }).damage).toEqual([{ grapple: { escape_dc_value: 11 } }]);
  });

  it('sets fields on the action, or on a damage entry by position, without sharing the annotation object', () => {
    const target = monster();
    const set = { condition: { condition_type: 'blinded' } };
    applyEngineAnnotations(target, [
      { monster: 'test', section: 'actions', name: 'Bite', damage: 0, set },
      { monster: 'test', section: 'actions', name: 'Web', set: { pull_distance_ft: 5 } },
    ]);
    expect(target.actions[0].damage?.[0]).toEqual({ damage_type: 'piercing', damage_dice: '1d4', condition: { condition_type: 'blinded' } });
    expect((target.actions[0].damage?.[0] as Entry).condition).not.toBe(set.condition);
    expect(target.actions[1]).toEqual({ name: 'Web', pull_distance_ft: 5 });
  });

  it('throws when the annotation names nothing in the monster', () => {
    expect(() =>
      applyEngineAnnotations(monster(), [{ monster: 'test', section: 'actions', name: 'Claw', set: {} }]),
    ).toThrow('Annotation target not found');
    expect(() =>
      applyEngineAnnotations(monster(), [{ monster: 'test', section: 'actions', name: 'Web', damage: 0, set: {} }]),
    ).toThrow('Annotation target not found');
  });
});
