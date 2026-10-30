import { describe, expect, it } from 'vitest';
import FeatureData from '../en/5e-SRD-Features.json' with { type: 'json' };
import LevelData from '../en/5e-SRD-Levels.json' with { type: 'json' };
import ConditionData from '../en/5e-SRD-Conditions.json' with { type: 'json' };
import SpellData from '../en/5e-SRD-Spells.json' with { type: 'json' };
import MonsterData from '../en/5e-SRD-Monsters.json' with { type: 'json' };
import SchoolData from '../en/5e-SRD-Magic-Schools.json' with { type: 'json' };
import DamageTypeData from '../en/5e-SRD-Damage-Types.json' with { type: 'json' };
import annotations from '../feature-engine-annotations.json' with { type: 'json' };
import { deriveFeatureEngine, ENGINE_EXCLUDED, ENGINE_MAX_LEVEL } from '../derive-feature-engine';

type Modifier = { type: string } & Record<string, unknown>;
type Uses = Record<string, unknown>;
type Engine = { action_cost: string; recharge?: string; uses?: Uses; modifiers?: Modifier[] };
type Heal = Record<string, unknown>;
type Granted = { index?: string; name?: string; choose?: number; from?: string };
type FeatureSpecific = {
  engine?: Engine;
  grants_asi?: true;
  heal?: Heal;
  granted_proficiencies?: Granted[];
  granted_languages?: unknown[];
  damage_type?: string;
};
type Feature = {
  index: string;
  name: string;
  level: number;
  class: { index: string };
  desc: string[];
  feature_specific?: FeatureSpecific;
};
type Level = {
  level: number;
  class: { index: string };
  subclass?: unknown;
  class_specific?: Record<string, unknown>;
};

const features = FeatureData as unknown as Feature[];
const feature = (index: string) => features.find((f) => f.index === index);
const text = (f: Feature) => f.desc.join(' ');
const engineOf = (f: Feature) => f.feature_specific?.engine;
const withEngine = features.filter((f) => engineOf(f));
const modifiersOf = (f: Feature) => engineOf(f)?.modifiers ?? [];

const levels = (LevelData as unknown as Level[]).filter((l) => !l.subclass);
// The value of a `class_specific` key in the Levels row of the feature's class at the feature's level.
const classSpecific = (f: Feature, key: string) =>
  levels.find((l) => l.class.index === f.class.index && l.level === f.level)?.class_specific?.[key];
const classSpecificKeys = (classIndex: string) =>
  new Set(
    levels
      .filter((l) => l.class.index === classIndex)
      .flatMap((l) => Object.keys(l.class_specific ?? {}))
  );

const conditions = new Set(ConditionData.map((c) => c.index));
const spells = new Map(
  (SpellData as unknown as { index: string; casting_time_data: { unit: string } }[]).map((s) => [
    s.index,
    s,
  ])
);
const monsterTypes = new Set((MonsterData as unknown as { type: string }[]).map((m) => m.type));
const schools = new Set(SchoolData.map((s) => s.index));
const damageTypes = new Set(DamageTypeData.map((d) => d.index));

const ABILITY_NAMES: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};
const NUMBER_WORDS: Record<number, string> = { 1: 'one', 2: 'two', 3: 'three', 5: 'five' };
const mentions = (f: Feature, n: number) =>
  new RegExp(`\\b(?:${n}|${NUMBER_WORDS[n] ?? n})\\b`, 'i').test(text(f));

describe('feature engine', () => {
  it('covers every feature of levels 1 to 5 that is not listed as excluded, and nothing above', () => {
    const structured = (f: Feature) => {
      const fs = f.feature_specific;
      return Boolean(
        fs?.engine ||
        fs?.grants_asi ||
        fs?.heal ||
        fs?.granted_proficiencies ||
        fs?.granted_languages ||
        fs?.damage_type
      );
    };
    const inScope = features.filter((f) => f.level <= ENGINE_MAX_LEVEL);
    expect(
      inScope.filter((f) => !structured(f) && !(f.index in ENGINE_EXCLUDED)).map((f) => f.index)
    ).toEqual([]);
    expect(
      features.filter((f) => f.level > ENGINE_MAX_LEVEL && engineOf(f)).map((f) => f.index)
    ).toEqual([]);
    for (const index of Object.keys(ENGINE_EXCLUDED)) {
      const excluded = feature(index);
      expect(excluded, index).toBeDefined();
      expect(excluded!.level, index).toBeLessThanOrEqual(ENGINE_MAX_LEVEL);
      expect(engineOf(excluded!), index).toBeUndefined();
    }
  });

  it('is derived from the annotation file without drift', () => {
    expect(deriveFeatureEngine(FeatureData as never)).toEqual(FeatureData);
    const annotated = new Set(annotations.map((a) => a.feature));
    expect(annotated.size).toBe(annotations.length);
  });

  it('states something beyond a passive feature with no effect', () => {
    for (const f of withEngine) {
      const e = engineOf(f)!;
      expect(e.action_cost !== 'passive' || e.uses || e.modifiers, f.index).toBeTruthy();
    }
  });

  it('gives the same mechanics to features with the same text', () => {
    const byText = new Map<string, Feature>();
    for (const f of withEngine) {
      const twin = byText.get(text(f));
      if (twin) expect(engineOf(f), `${f.index} and ${twin.index}`).toEqual(engineOf(twin));
      else byText.set(text(f), f);
    }
  });

  it('agrees with the action the text names', () => {
    for (const f of withEngine) {
      const { action_cost: cost } = engineOf(f)!;
      const spell = modifiersOf(f).find((m) => m.type === 'spell');
      if (spell) {
        const unit = spells.get(spell.spell as string)!.casting_time_data.unit;
        expect(cost, f.index).toBe(
          ['action', 'bonus_action', 'reaction'].includes(unit) ? unit : 'passive'
        );
        continue;
      }
      if (cost === 'bonus_action') expect(text(f), f.index).toMatch(/bonus action/i);
      if (cost === 'reaction') expect(text(f), f.index).toMatch(/your reaction/i);
      if (cost === 'action') expect(text(f), f.index).toMatch(/\b(?:an|your) action\b/i);
      if (cost === 'rest') expect(text(f), f.index).toMatch(/short rest/i);
      if (cost === 'passive' || cost === 'free')
        expect(text(f), f.index).not.toMatch(/(?:as an|use your) action/i);
    }
  });

  it('agrees with the recharge the text names', () => {
    const RECHARGE: Record<string, RegExp> = {
      short_rest: /short or long rest/i,
      long_rest: /(?<!short or )long rest/i,
      day: /once per day/i,
      turn: /once per turn|once on each of your turns/i,
    };
    for (const f of withEngine) {
      const { recharge, uses } = engineOf(f)!;
      const ownUses = Boolean(uses && !('pool' in uses) && !('spell_slot' in uses));
      expect(Boolean(recharge), f.index).toBe(ownUses);
      if (recharge) expect(text(f), f.index).toMatch(RECHARGE[recharge]);
    }
  });

  it('agrees with the uses the text and the Levels rows give', () => {
    for (const f of withEngine) {
      const uses = engineOf(f)!.uses;
      if (!uses) continue;
      if ('class_specific' in uses) {
        const value = classSpecific(f, uses.class_specific as string);
        expect(typeof value === 'number' && value > 0, `${f.index}: ${uses.class_specific}`).toBe(
          true
        );
      }
      if ('count' in uses && !('ability_modifier' in uses)) {
        expect(text(f), f.index).toMatch(
          uses.count === 1
            ? /once|again until|before you can use it again|to use your [\w ]+ again/i
            : /twice/i
        );
      }
      if ('ability_modifier' in uses) {
        expect(text(f), f.index).toContain(
          `${ABILITY_NAMES[uses.ability_modifier as string]} modifier`
        );
      }
      if ('per_class_level' in uses) {
        expect(text(f), f.index).toMatch(new RegExp(`level x ${uses.per_class_level}`));
      }
      if ('spell_slot' in uses) expect(text(f), f.index).toMatch(/spell slot/i);
      if ('pool' in uses) {
        const pool = feature(uses.pool as string);
        expect(pool, f.index).toBeDefined();
        expect(pool!.class.index, f.index).toBe(f.class.index);
        expect(pool!.level, f.index).toBeLessThanOrEqual(f.level);
        const poolUses = engineOf(pool!)?.uses;
        expect(poolUses && !('pool' in poolUses), f.index).toBeTruthy();
        if (typeof uses.cost === 'number' && poolUses?.unit === 'point') {
          expect(text(f), f.index).toMatch(new RegExp(`${uses.cost} (?:ki|sorcery) points?`));
        }
        if (uses.cost === 'spell_level')
          expect(text(f), f.index).toMatch(/equal to the spell's level/);
        if (uses.cost_class_specific) {
          expect(classSpecific(f, uses.cost_class_specific as string), f.index).toBeDefined();
        }
      }
    }
  });

  it('agrees with the healing the text states', () => {
    for (const f of features.filter((x) => x.feature_specific?.heal)) {
      const heal = f.feature_specific!.heal!;
      if (heal.dice) expect(text(f), f.index).toContain(heal.dice as string);
      if (heal.add_class_level) expect(text(f), f.index).toMatch(/your \w+ level/);
      if (heal.class_level_multiplier) {
        expect(text(f), f.index).toMatch(
          new RegExp(`${NUMBER_WORDS[heal.class_level_multiplier as number]} times your \\w+ level`)
        );
      }
      if (heal.bonus) expect(text(f), f.index).toContain(`${heal.bonus} +`);
      if (heal.ability_modifier) {
        expect(text(f), f.index).toContain(
          `${ABILITY_NAMES[heal.ability_modifier as string]} modifier`
        );
      }
      if (heal.from_uses) expect(engineOf(f)?.uses?.unit, f.index).toBe('hit_point');
      // Song of Rest: the die of the record is the one the Levels row gives at its level.
      const songDie = classSpecific(f, 'song_of_rest_die');
      if (songDie) expect(heal.dice, f.index).toBe(`1d${songDie}`);
    }
  });

  it('marks every Ability Score Improvement and nothing else', () => {
    for (const f of features) {
      const asi = f.name === 'Ability Score Improvement';
      expect(f.feature_specific?.grants_asi === true, f.index).toBe(asi);
      if (asi) expect(text(f), f.index).toContain('increase one ability score of your choice by 2');
    }
  });

  it('grants the proficiencies the text names', () => {
    for (const f of features.filter((x) => x.feature_specific?.granted_proficiencies)) {
      const granted = f.feature_specific!.granted_proficiencies!;
      for (const g of granted) {
        if (g.choose) {
          expect(text(f), f.index).toMatch(
            new RegExp(`${NUMBER_WORDS[g.choose]} skills of your choice`)
          );
        } else if (g.index!.startsWith('saving-throw-')) {
          const ability = ABILITY_NAMES[g.index!.replace('saving-throw-', '')];
          expect(text(f), f.index).toMatch(
            granted.length === 6 ? /all saving throws/ : new RegExp(`${ability} saving throws`)
          );
        } else {
          expect(text(f).toLowerCase(), f.index).toContain(
            g.name!.replace(/^Skill: /, '').toLowerCase()
          );
        }
      }
    }
  });
});

describe('feature engine modifiers', () => {
  const all = withEngine.flatMap((f) => modifiersOf(f).map((m) => [f, m] as const));

  it('name conditions, spells, schools, damage types, creature types and features that exist', () => {
    for (const [f, m] of all) {
      if (m.condition) expect(conditions, f.index).toContain(m.condition);
      if (m.while_condition) expect(conditions, f.index).toContain(m.while_condition);
      if (m.type === 'immune_to') {
        for (const c of m.conditions as string[])
          expect([...conditions, 'disease'], f.index).toContain(c);
      }
      if (m.spell) expect(spells.has(m.spell as string), f.index).toBe(true);
      if (m.school) expect(schools, f.index).toContain(m.school);
      if (m.damage_type) expect(damageTypes, f.index).toContain(m.damage_type);
      for (const t of (m.creature_types as string[]) ?? [])
        expect(monsterTypes, f.index).toContain(t);
      for (const index of (m.features as string[]) ?? [])
        expect(feature(index), f.index).toBeDefined();
    }
  });

  it('read class_specific keys that the class has in its Levels rows', () => {
    for (const [f, m] of all) {
      const keys = [m.class_specific ?? []].flat() as string[];
      for (const key of keys)
        expect(classSpecificKeys(f.class.index), `${f.index}: ${key}`).toContain(key);
    }
  });

  it('give a bonus exactly one amount', () => {
    const AMOUNTS = [
      'flat',
      'dice',
      'dice_at_slot_level',
      'ability_modifier',
      'attack_ability_modifier',
      'class_specific',
      'proficiency_multiplier',
    ];
    for (const [f, m] of all.filter(([, m]) => m.type === 'bonus')) {
      expect(
        AMOUNTS.filter((a) => a in m),
        f.index
      ).toHaveLength(1);
      if (m.add_spell_level) expect('flat' in m, f.index).toBe(true);
      if (m.round) expect('proficiency_multiplier' in m, f.index).toBe(true);
    }
  });

  it('carry the numbers the text states', () => {
    for (const [f, m] of all) {
      if (m.type === 'bonus' && typeof m.flat === 'number') {
        expect(text(f), f.index).toMatch(
          new RegExp(`\\+${m.flat} bonus|${m.flat} \\+ the spell's level`)
        );
      }
      if (typeof m.dice === 'string') expect(text(f), f.index).toContain(m.dice);
      for (const field of ['range_ft', 'within_ft', 'distance_ft']) {
        if (typeof m[field] === 'number')
          expect(text(f), `${f.index}: ${field}`).toContain(`${m[field]} feet`);
      }
      if (m.type === 'speed' && typeof m.value === 'number')
        expect(text(f), f.index).toContain(`by ${m.value} feet`);
      if (m.type === 'armor_class') {
        expect(text(f), f.index).toContain(
          `${m.base} + your ${ABILITY_NAMES[(m.ability_modifiers as string[])[0]]} modifier`
        );
      }
      if (m.type === 'critical_range')
        expect(text(f), f.index).toContain(`roll of ${m.min_roll} or 20`);
      if (m.type === 'reroll_damage')
        expect(text(f), f.index).toContain(`roll a ${(m.faces as number[]).join(' or ')}`);
      if (m.type === 'extra_attack' && !m.action_cost && m.attack_kind === undefined) {
        expect(text(f), f.index).toMatch(/attack twice, instead of once/);
      }
      if (m.type === 'extra_attack' && m.count === 2)
        expect(text(f), f.index).toMatch(/two unarmed strikes/);
      if (m.type === 'reduce_damage' && m.class_level_multiplier) {
        expect(mentions(f, m.class_level_multiplier as number), f.index).toBe(true);
      }
      if (m.type === 'recover_spell_slots') {
        expect(text(f), f.index).toContain(
          `can be ${(m.max_slot_level as number) + 1}th level or higher`
        );
      }
      if (m.save) {
        const save = m.save as { ability: string };
        expect(text(f), f.index).toContain(`${ABILITY_NAMES[save.ability]} saving throw`);
      }
      if (m.type === 'die') expect(text(f), f.index).toContain('Bardic Inspiration die');
    }
  });

  it('give Divine Smite the dice its text states for each slot level', () => {
    const smite = modifiersOf(feature('divine-smite')!).find((m) => m.dice_at_slot_level)!;
    const text = feature('divine-smite')!.desc.join(' ');
    expect(text).toContain(
      '2d8 for a 1st-level spell slot, plus 1d8 for each spell level higher than 1st, to a maximum of 5d8'
    );
    const expected = Object.fromEntries(
      [1, 2, 3, 4, 5].map((l) => [String(l), `${Math.min(l + 1, 5)}d8`])
    );
    expect(smite.dice_at_slot_level).toEqual(expected);
  });

  it('apply conditions that the text names', () => {
    const WORDS: Record<string, RegExp> = {
      enraged: /rage/i,
      frenzied: /frenzy/i,
      reckless: /recklessly/i,
      'sacred-weapon': /imbue one weapon/i,
      'no-reactions': /can't take reactions/i,
    };
    for (const [f, m] of all.filter(([, m]) => m.type === 'condition')) {
      expect(text(f), f.index).toMatch(
        WORDS[m.condition as string] ?? new RegExp(m.condition as string, 'i')
      );
    }
  });
});
