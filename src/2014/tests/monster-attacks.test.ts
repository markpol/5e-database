import { describe, expect, it } from 'vitest';
import MonsterData from '../en/5e-SRD-Monsters.json' with { type: 'json' };
import NormalizedMonsterData from '../5e-SRD-Monsters-Normalized.json' with { type: 'json' };
import { deriveAreas, deriveAttackStructure } from '../normalize-monsters';

type Entry = Record<string, any>;
type Action = { name: string; desc: string } & Entry;
type Monster = { index: string; actions?: Action[] } & Entry;

const english = MonsterData as unknown as Monster[];
const normalized = NormalizedMonsterData as unknown as Monster[];

const ATTACK_HEADER = /^\s*(Melee or Ranged|Melee|Ranged) (Weapon|Spell) Attack:/;
const attackActions = (monsters: Monster[]) =>
  monsters.flatMap((monster) =>
    (monster.actions ?? []).filter((action) => ATTACK_HEADER.test(action.desc)).map((action) => ({ monster, action })),
  );
const headerOf = (action: Action) => action.desc.split('Hit:')[0];

describe('attack structure', () => {
  const attacks = attackActions(normalized);

  it('is on every attack-roll action and on no other action', () => {
    expect(attacks).toHaveLength(533);
    for (const monster of normalized) {
      for (const action of monster.actions ?? []) {
        const isAttack = ATTACK_HEADER.test(action.desc);
        expect('attack_kind' in action, `${monster.index} / ${action.name}: attack_kind`).toBe(isAttack);
        if (!isAttack) {
          for (const field of ['reach_ft', 'range']) {
            expect(field in action, `${monster.index} / ${action.name}: ${field}`).toBe(false);
          }
        }
      }
    }
    for (const { monster, action } of attacks) {
      expect(action.attack_type, `${monster.index} / ${action.name}`).toMatch(/^(Melee|Ranged)$/);
    }
  });

  it('states the kind the attack header states', () => {
    for (const { monster, action } of attacks) {
      const wording = ATTACK_HEADER.exec(action.desc)![1];
      const label = `${monster.index} / ${action.name}`;
      expect(action.attack_kind, label).toBe(wording.toLowerCase().replaceAll(' ', '_'));
      if (wording === 'Melee') expect(action.attack_type, label).toBe('Melee');
      if (wording === 'Ranged') expect(action.attack_type, label).toBe('Ranged');
    }
  });

  it('keeps the attack_type that the English data has', () => {
    const typed = attackActions(english).filter(({ action }) => action.attack_type);
    expect(typed).toHaveLength(244);
    for (const { monster, action } of typed) {
      const found = normalized.find((m) => m.index === monster.index)!.actions!.find((a) => a.name === action.name)!;
      expect(found.attack_type, `${monster.index} / ${action.name}`).toBe(action.attack_type);
    }
  });

  it('has every reach and range of the header, and nothing else', () => {
    for (const { monster, action } of attacks) {
      const head = headerOf(action);
      const label = `${monster.index} / ${action.name}`;
      const reaches = [...head.matchAll(/\breach (\d+) ft\./g)].map((m) => Number(m[1]));
      const ranges = [...head.matchAll(/\brange (\d+)(?:\/(\d+))? ft\./g)].map((m) => [Number(m[1]), m[2] ? Number(m[2]) : undefined]);
      expect(reaches.length, label).toBeLessThanOrEqual(1);
      expect(ranges.length, label).toBeLessThanOrEqual(1);
      expect(action.reach_ft, label).toBe(reaches[0]);
      expect(action.range?.normal_ft, label).toBe(ranges[0]?.[0]);
      expect(action.range?.long_ft, label).toBe(ranges[0]?.[1]);
      // A melee attack has a reach and no range, a ranged attack the reverse, and "Melee or Ranged" has both.
      expect(action.reach_ft !== undefined, label).toBe(action.attack_kind !== 'ranged');
      expect(action.range !== undefined, label).toBe(action.attack_kind !== 'melee');
    }
  });

  it('counts the structured values', () => {
    const kinds = Object.fromEntries(
      ['melee', 'ranged', 'melee_or_ranged'].map((kind) => [kind, attacks.filter(({ action }) => action.attack_kind === kind).length]),
    );

    expect(kinds).toEqual({ melee: 472, ranged: 43, melee_or_ranged: 18 });
    expect(attacks.filter(({ action }) => action.reach_ft !== undefined)).toHaveLength(490);
    expect(attacks.filter(({ action }) => action.range !== undefined)).toHaveLength(61);
    expect(attacks.filter(({ action }) => action.range?.long_ft !== undefined)).toHaveLength(58);
  });
});

describe('attack structure derivation', () => {
  it('reads reach, range and both', () => {
    expect(deriveAttackStructure({ name: 'Claw', desc: 'Melee Weapon Attack: +5 to hit, reach 10 ft., one target. Hit: 5 (1d6 + 2) slashing damage.' })).toEqual({
      attack_type: 'Melee',
      attack_kind: 'melee',
      reach_ft: 10,
    });
    expect(deriveAttackStructure({ name: 'Longbow', desc: 'Ranged Weapon Attack: +4 to hit, range 150/600 ft., one target. Hit: 5 (1d8 + 1) piercing damage.' })).toEqual({
      attack_type: 'Ranged',
      attack_kind: 'ranged',
      range: { normal_ft: 150, long_ft: 600 },
    });
    expect(deriveAttackStructure({ name: 'Hurl Flame', desc: 'Ranged Spell Attack: +7 to hit, range 150 ft., one target. Hit: 10 (3d6) fire damage.' })).toEqual({
      attack_type: 'Ranged',
      attack_kind: 'ranged',
      range: { normal_ft: 150 },
    });
    expect(deriveAttackStructure({ name: 'Spear', desc: 'Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 4 (1d6 + 1) piercing damage.' })).toEqual({
      attack_type: 'Melee',
      attack_kind: 'melee_or_ranged',
      reach_ft: 5,
      range: { normal_ft: 20, long_ft: 60 },
    });
  });

  it('ignores an action that is not an attack roll and rejects a header without its reach or range', () => {
    expect(deriveAttackStructure({ name: 'Ink Cloud', desc: 'A 5-foot-radius cloud of ink extends all around the octopus.' })).toBeUndefined();
    expect(() => deriveAttackStructure({ name: 'Bite', desc: 'Melee Weapon Attack: +5 to hit, one target.' })).toThrow('without a reach');
    expect(() => deriveAttackStructure({ name: 'Bow', desc: 'Ranged Weapon Attack: +5 to hit, one target.' })).toThrow('without a range');
  });
});

describe('area structure', () => {
  const areaTexts = normalized.flatMap((monster) =>
    (monster.actions ?? []).map((action) => ({ monster, action, source: english.find((m) => m.index === monster.index)!.actions!.find((a) => a.name === action.name)! })),
  );
  const areaOf = (action: Action) => [action.area, ...(action.options?.from?.options ?? []).map((option: Entry) => option.area)].filter(Boolean);

  it('reads the shapes of the area phrases', () => {
    expect(deriveAreas('The dragon exhales fire in a 60-foot cone.')).toEqual([{ shape: 'cone', length_ft: 60 }]);
    expect(deriveAreas('The dragon exhales lightning in a 90-foot line that is 5 feet wide.')).toEqual([{ shape: 'line', length_ft: 90, width_ft: 5 }]);
    expect(deriveAreas('The behir exhales a line of lightning that is 20 ft. long and 5 ft. wide.')).toEqual([{ shape: 'line', length_ft: 20, width_ft: 5 }]);
    expect(deriveAreas('A 15-foot-radius cloud of toxic spores extends out from the vrock.')).toEqual([{ shape: 'sphere', radius_ft: 15 }]);
    expect(deriveAreas('A 10-foot radius of disgusting green gas extends out from the dretch.')).toEqual([{ shape: 'sphere', radius_ft: 10 }]);
    expect(deriveAreas('A 5-foot-radius, 30-foot-tall cylinder of swirling air forms.')).toEqual([{ shape: 'cylinder', radius_ft: 5, height_ft: 30 }]);
    expect(deriveAreas('The target is within line of sight and the touch destroys a 1-foot cube of it.')).toEqual([]);
  });

  it('has every area phrase of the text, and every area value comes from the text', () => {
    let structured = 0;
    for (const { monster, action } of areaTexts) {
      const label = `${monster.index} / ${action.name}`;
      const phrases = [...action.desc.matchAll(/(\d+)-foot(?:-| )(cone|line|radius)/g)].map((m) => [m[2], Number(m[1])] as const);
      // A line is also written "a line that is 30 ft. long and 5 ft. wide"; the wall of ice is a wall, not a shape.
      const lineLengths = [...action.desc.matchAll(/line (?:of \w+ )?that is (\d+) ft\. long/g)].map((m) => Number(m[1]));
      const areas = areaOf(action);
      structured += areas.length;

      const lengths = areas.flatMap((area: Entry) => ('length_ft' in area ? [area.length_ft] : []));
      const radii = areas.flatMap((area: Entry) => ('radius_ft' in area ? [area.radius_ft] : []));
      for (const [shape, size] of phrases) {
        expect(shape === 'radius' ? radii : lengths, `${label}: ${size}-foot ${shape}`).toContain(size);
      }
      for (const length of lineLengths) expect(lengths, `${label}: ${length} ft. line`).toContain(length);
      for (const area of areas as Entry[]) {
        const size = area.length_ft ?? area.radius_ft;
        expect(action.desc, `${label}: ${JSON.stringify(area)}`).toMatch(new RegExp(`\\b${size}\\b`));
      }
    }
    // 39 actions with one area and 20 dragons with a breath weapon in each of two options.
    expect(structured).toBe(79);
  });

  it('leaves the area of the actions without an area phrase out', () => {
    const withArea = areaTexts.filter(({ action }) => areaOf(action).length > 0).map(({ monster, action }) => `${monster.index}:${action.name}`);

    expect(withArea).toHaveLength(59);
    expect(withArea).not.toContain('ice-devil:Wall of Ice');
    expect(withArea).not.toContain('rust-monster:Antennae');
    expect(withArea).toContain('djinni:Create Whirlwind');
  });

  it('leaves the English data without the derived fields', () => {
    for (const { source } of areaTexts) {
      for (const field of ['attack_kind', 'reach_ft', 'range', 'area']) expect(field in source).toBe(false);
    }
  });
});

describe('weapon annotations of attacks', () => {
  const attacks = attackActions(normalized);
  const unresolved = ['horned-devil:Fork', 'iron-golem:Sword', 'merrow:Harpoon'];

  it('has a weapon_kind on every attack, a spell for a spell attack', () => {
    for (const { monster, action } of attacks) {
      const label = `${monster.index} / ${action.name}`;
      expect(['natural', 'manufactured', 'spell'], label).toContain(action.weapon_kind);
      expect(action.weapon_kind === 'spell', label).toBe(/Spell Attack:/.test(action.desc));
      if (action.weapon) expect(action.weapon_kind, label).toBe('manufactured');
      if (action.weapon_kind === 'natural') expect(action.supply?.item, label).not.toBe('arrow');
    }
  });

  it('has a weapon on every manufactured attack except the three that name no SRD equipment', () => {
    const without = attacks
      .filter(({ action }) => action.weapon_kind === 'manufactured' && !action.weapon)
      .map(({ monster, action }) => `${monster.index}:${action.name}`);

    expect(without.sort()).toEqual(unresolved);
  });
});

describe('actions that are not attack rolls', () => {
  const find = (monsters: Monster[], index: string, name: string) =>
    Object.values(monsters.find((m) => m.index === index) ?? {})
      .flatMap((value) => (Array.isArray(value) ? value : []))
      .find((entry: Entry) => entry?.name === name);

  it('have no attack bonus', () => {
    const cases = [
      ['octopus', 'Ink Cloud'],
      ['kraken', 'Lightning Storm (Costs 2 Actions)'],
      ['vampire-vampire', 'Move'],
      ['vampire-bat', 'Move'],
      ['vampire-mist', 'Move'],
    ];
    for (const [index, name] of cases) {
      for (const monsters of [english, normalized]) {
        const entry = find(monsters, index, name);
        expect(entry, `${index} ${name}`).toBeDefined();
        expect(entry).not.toHaveProperty('attack_bonus');
      }
    }
  });
});
