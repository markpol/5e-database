import { describe, expect, it } from 'vitest';
import FeatureData from '../en/5e-SRD-Features.json' with { type: 'json' };
import LevelData from '../en/5e-SRD-Levels.json' with { type: 'json' };
import ConditionData from '../en/5e-SRD-Conditions.json' with { type: 'json' };
import SpellData from '../en/5e-SRD-Spells.json' with { type: 'json' };
import MonsterData from '../en/5e-SRD-Monsters.json' with { type: 'json' };
import SchoolData from '../en/5e-SRD-Magic-Schools.json' with { type: 'json' };
import SkillData from '../en/5e-SRD-Skills.json' with { type: 'json' };
import DamageTypeData from '../en/5e-SRD-Damage-Types.json' with { type: 'json' };
import annotations from '../feature-engine-annotations.json' with { type: 'json' };
import {
  deriveFeatureEngine,
  ENGINE_EXCLUDED,
  ENGINE_MAX_LEVEL_BY_CLASS,
  engineMaxLevel,
} from '../derive-feature-engine';

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
  (
    SpellData as unknown as { index: string; desc: string[]; casting_time_data: { unit: string } }[]
  ).map((s) => [s.index, s])
);
const monsterTypes = new Set((MonsterData as unknown as { type: string }[]).map((m) => m.type));
const schools = new Set(SchoolData.map((s) => s.index));
const damageTypes = new Set(DamageTypeData.map((d) => d.index));
const skills = new Set(SkillData.map((sk) => sk.index));

const ABILITY_NAMES: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};
const NUMBER_WORDS: Record<number, string> = {
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
};
const mentions = (f: Feature, n: number) =>
  new RegExp(`\\b(?:${n}|${NUMBER_WORDS[n] ?? n})\\b`, 'i').test(text(f));

describe('feature engine', () => {
  it('covers every feature in scope that is not listed as excluded, and nothing above', () => {
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
    const inScope = features.filter((f) => f.level <= engineMaxLevel(f.class.index));
    expect(
      inScope.filter((f) => !structured(f) && !(f.index in ENGINE_EXCLUDED)).map((f) => f.index)
    ).toEqual([]);
    expect(
      features
        .filter((f) => f.level > engineMaxLevel(f.class.index) && engineOf(f))
        .map((f) => f.index)
    ).toEqual([]);
    for (const index of Object.keys(ENGINE_EXCLUDED)) {
      const excluded = feature(index);
      expect(excluded, index).toBeDefined();
      expect(excluded!.level, index).toBeLessThanOrEqual(engineMaxLevel(excluded!.class.index));
      expect(engineOf(excluded!), index).toBeUndefined();
    }
  });

  it('names classes that exist in the per-class scope', () => {
    const classes = new Set(features.map((f) => f.class.index));
    for (const index of Object.keys(ENGINE_MAX_LEVEL_BY_CLASS))
      expect(classes, index).toContain(index);
    expect(Math.max(...features.map((f) => f.level))).toBe(20);
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
      // A feature that only casts a spell takes its casting time, unless it is used at the end of a rest.
      const spell = modifiersOf(f).every((m) => m.type === 'spell')
        ? modifiersOf(f).find((m) => m.type === 'spell')
        : undefined;
      if (spell && cost !== 'rest') {
        const unit = spells.get(spell.spell as string)!.casting_time_data.unit;
        expect(cost, f.index).toBe(
          ['action', 'bonus_action', 'reaction'].includes(unit) ? unit : 'passive'
        );
        continue;
      }
      if (cost === 'bonus_action') expect(text(f), f.index).toMatch(/bonus action/i);
      if (cost === 'reaction') expect(text(f), f.index).toMatch(/your reaction/i);
      if (cost === 'action') expect(text(f), f.index).toMatch(/\b(?:an|your) action\b/i);
      if (cost === 'rest') expect(text(f), f.index).toMatch(/(?:short|long) rest/i);
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
            ? /once|again until|before you can use (?:it|this feature) again|can't use this feature again|to use your [\w ]+ again/i
            : /twice|can cast each of them once/i
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
      if (m.type === 'damage') {
        for (const t of [...((m.types as string[]) ?? []), ...((m.except as string[]) ?? [])])
          expect(['all', ...damageTypes], f.index).toContain(t);
        // A damage modifier names its types, or takes them from the dragon ancestor.
        expect(
          ['types', 'types_from'].filter((k) => k in m),
          f.index
        ).toHaveLength(1);
        const cost = m.cost as { pool: string } | undefined;
        if (cost) {
          expect(feature(cost.pool)!.class.index, f.index).toBe(f.class.index);
          expect(engineOf(feature(cost.pool)!)?.uses, f.index).toBeDefined();
        }
      }
      for (const c of (m.against_conditions as string[]) ?? [])
        expect(conditions, f.index).toContain(c);
      if (m.type === 'end_condition') {
        for (const c of m.conditions as string[]) expect(conditions, f.index).toContain(c);
      }
      for (const skill of (m.skills as string[]) ?? []) expect(skills, f.index).toContain(skill);
      if (m.type === 'recover_uses') {
        const target = feature(m.feature as string);
        expect(target, f.index).toBeDefined();
        expect(target!.class.index, f.index).toBe(f.class.index);
      }
      for (const t of (m.creature_types as string[]) ?? [])
        expect(monsterTypes, f.index).toContain(t);
      for (const index of (m.features as string[]) ?? [])
        expect(feature(index), f.index).toBeDefined();
    }
  });

  it('read class_specific keys that the class has in its Levels rows', () => {
    for (const [f, m] of all) {
      const keys = [
        m.class_specific ?? [],
        (m.aura as { class_specific?: string })?.class_specific ?? [],
      ].flat() as string[];
      for (const key of keys)
        expect(classSpecificKeys(f.class.index), `${f.index}: ${key}`).toContain(key);
    }
  });

  it('give a bonus exactly one amount', () => {
    const AMOUNTS = [
      'flat',
      'dice',
      'dice_at_slot_level',
      'dice_at_class_level',
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
      // "add a d10" is the dice 1d10.
      if (typeof m.dice === 'string')
        expect(text(f), f.index).toMatch(
          new RegExp(`(?:\\b1)?${(m.dice as string).replace(/^1/, '')}\\b`)
        );
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
        expect(text(f), f.index).toMatch(new RegExp(`roll of ${m.min_roll}(?: or |-)20`));
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
      // A die an owner adds to the owner's own roll has no range; the others have one.
      if (m.type === 'die') expect('range_ft' in m, f.index).toBe(m.effect !== 'add_to_own');
    }
  });

  it('mirror the conditions that name a feature as making its owner immune', () => {
    // The condition side: `immune_if_feature` on charmed, frightened and poisoned.
    const named = ConditionData.flatMap((c) =>
      (
        (c as { immune_if_feature?: { feature: string; while_condition?: string }[] })
          .immune_if_feature ?? []
      ).map((i) => ({ condition: c.index, ...i }))
    );
    expect(named.length).toBeGreaterThan(0);
    for (const { condition, feature: index, while_condition } of named) {
      const immunity = modifiersOf(feature(index)!).find(
        (m) => m.type === 'immune_to' && (m.conditions as string[]).includes(condition)
      );
      expect(immunity, `${index}: ${condition}`).toBeDefined();
      expect(immunity!.while_condition, `${index}: ${condition}`).toBe(while_condition);
    }
    // The feature side: an immunity to a condition that is not `disease` is named by that condition, unless it is an
    // aura, which protects the creatures within a range of the owner, or is limited to the conditions that creatures
    // of some types cause; `immune_if_feature` models neither.
    for (const [f, m] of all.filter(
      ([, m]) => m.type === 'immune_to' && !m.aura && !m.creature_types
    )) {
      for (const c of (m.conditions as string[]).filter((x) => x !== 'disease')) {
        expect(
          named.some((n) => n.condition === c && n.feature === f.index),
          `${f.index}: ${c}`
        ).toBe(true);
      }
    }
  });

  it('state resistance and immunity to damage as the text does', () => {
    for (const [f, m] of all.filter(([, m]) => m.type === 'damage')) {
      expect(text(f), f.index).toMatch(m.relation === 'immunity' ? /immune to/i : /resistance to/i);
      for (const t of (m.types as string[]) ?? []) {
        if (t !== 'all') expect(text(f), f.index).toContain(t);
      }
      for (const t of (m.except as string[]) ?? []) expect(text(f), f.index).toContain(t);
      const duration = m.duration as { unit: string; length: number } | undefined;
      if (duration) expect(text(f), f.index).toContain(`${duration.length} ${duration.unit}`);
      const cost = m.cost as { pool: string; cost: number } | undefined;
      if (cost) expect(text(f), f.index).toContain(`${cost.cost} sorcery point`);
      if (m.types_from) {
        // The type is that of the dragon ancestor the owner chose, of which every dragon has a damage type.
        expect(text(f), f.index).toMatch(
          /damage of the type associated with your draconic ancestry/
        );
        expect(text(f), f.index).toContain('resistance to that damage type');
        const dragons = features.filter((x) => x.index.startsWith('dragon-ancestor-'));
        expect(dragons.length).toBeGreaterThan(0);
        for (const d of dragons)
          expect(damageTypes, d.index).toContain(d.feature_specific?.damage_type);
      }
    }
  });

  it('give the evasion, rerolls, minimums and scores the text states', () => {
    for (const [f, m] of all) {
      if (m.type === 'evasion') {
        expect(text(f), f.index).toContain(`${ABILITY_NAMES[m.ability as string]} saving throw`);
        expect(text(f), f.index).toMatch(
          /take no damage if you succeed .* only half damage if you fail/
        );
      }
      if (m.type === 'reroll') expect(text(f), f.index).toMatch(/\breroll\b/);
      if (m.type === 'minimum_d20') {
        expect(text(f), f.index).toContain(
          `d20 roll of ${(m.minimum as number) - 1} or lower as a ${m.minimum}`
        );
      }
      if (m.type === 'minimum_total') {
        expect(text(f), f.index).toContain(`${ABILITY_NAMES[m.ability_score as string]} score`);
        expect(text(f), f.index).toMatch(/less than your/);
      }
      if (m.type === 'ability_score_increase') {
        for (const a of m.abilities as string[])
          expect(text(f), f.index).toContain(ABILITY_NAMES[a]);
        expect(text(f), f.index).toContain(`increase by ${m.increase}`);
        expect(text(f), f.index).toContain(`now ${m.maximum}`);
      }
      if (m.type === 'magical_attacks') expect(text(f), f.index).toMatch(/count as magical/);
      if (m.type === 'rolls_against_owner' && m.no_advantage)
        expect(text(f), f.index).toMatch(/No attack roll has advantage against you/);
      if (m.type === 'critical_damage_dice')
        expect(text(f), f.index).toMatch(
          /additional weapon damage die when determining the extra damage/
        );
      if (m.type === 'recover_uses') {
        const pool = feature(m.feature as string)!;
        // The recovered uses are those of the pool: ki points, uses of Bardic Inspiration, sorcery points.
        const unit = engineOf(pool)!.uses?.unit === 'point' ? 'points?' : 'uses?';
        const what = `(?:${NUMBER_WORDS[m.count as number]}|${m.count}) (?:expended )?(?:(?:ki|sorcery) )?${unit}`;
        expect(text(f), f.index).toMatch(new RegExp(`regain ${what}`));
        if (m.trigger === 'initiative_with_no_uses_left')
          expect(text(f), f.index).toMatch(
            /roll(?: for)? initiative and have no (?:ki points|uses of Bardic Inspiration) (?:remaining|left)/
          );
        if (m.trigger === 'short_rest')
          expect(text(f), f.index).toMatch(/whenever you finish a short rest/);
      }
      if (m.type === 'avoid_dropping_to_zero') {
        const dc = (m.save as { dc: { fixed: number; increase_per_use: number } }).dc;
        expect(text(f), f.index).toContain(`DC ${dc.fixed}`);
        expect(text(f), f.index).toContain(`the DC increases by ${dc.increase_per_use}`);
        expect(text(f), f.index).toContain(`${m.hit_points} hit point`);
      }
      if (m.type === 'roll' && m.roll === 'initiative')
        expect(text(f), f.index).toMatch(/initiative/);
      for (const sk of (m.skills as string[]) ?? []) {
        expect(text(f).toLowerCase(), f.index).toContain(`(${sk})`);
      }
    }
  });

  it('give each save DC the formula the text states', () => {
    for (const [f, m] of all) {
      const dc = ((m.save as { dc?: unknown } | undefined)?.dc ?? m.save_dc) as unknown;
      if (typeof dc !== 'object' || dc === null || !('ability_modifier' in dc)) continue;
      const ability = ABILITY_NAMES[dc.ability_modifier as string];
      expect(text(f), f.index).toMatch(
        new RegExp(
          `8 \\+ your (?:proficiency bonus \\+ your ${ability} modifier|${ability} modifier \\+ your proficiency bonus)`
        )
      );
    }
  });

  it('give each aura the range and the creatures the text states', () => {
    const auras = all.filter(([, m]) => m.aura);
    expect(auras.length).toBeGreaterThan(0);
    for (const [f, m] of auras) {
      const aura = m.aura as { class_specific?: string; range_ft?: number; affects: string };
      if (aura.class_specific) {
        // The Levels row of the owner's level gives the range, and the text states it for that level.
        const range = classSpecific(f, aura.class_specific);
        expect(typeof range === 'number' && range > 0, f.index).toBe(true);
        expect(text(f), f.index).toContain(`within ${range} feet of you`);
      } else {
        expect(text(f), f.index).toMatch(
          new RegExp(
            `${aura.range_ft}-foot radius|distance of ${aura.range_ft} feet|within ${aura.range_ft} feet of you`
          )
        );
      }
      expect(text(f), f.index).toMatch(
        aura.affects === 'enemies'
          ? /enemy creature|hostile creature/
          : /you (?:or a|and) (?:any )?friendly creatures? within \d+ feet of you/
      );
      if (aura.must_hear_owner) expect(text(f), f.index).toMatch(/must be able to hear you/);
    }
  });

  it('require consciousness only where the text does', () => {
    for (const [f, m] of all) {
      if ((m.while as string[] | undefined)?.includes('conscious'))
        expect(text(f), f.index).toMatch(/while you are conscious|You must be conscious/);
    }
  });

  it('give the damage dealt, the spells ended and the rolls against spells the text states', () => {
    for (const [f, m] of all) {
      if (m.type === 'deal_damage') {
        expect(text(f), f.index).toContain(`${m.flat ?? m.dice} ${m.damage_type} damage`);
        expect(text(f), f.index).toMatch(
          m.trigger === 'starts_turn_in_aura'
            ? /starts its turn/
            : /At the end of your next turn, the target returns to the space it previously occupied/
        );
      }
      if (m.type === 'end_spell') {
        expect(text(f), f.index).toContain(`end ${NUMBER_WORDS[m.count as number]} spell`);
        const targets = m.targets as string[];
        expect(text(f), f.index).toMatch(/on yourself or on one willing creature that you touch/);
        expect(targets, f.index).toEqual(['self', 'willing_creature']);
      }
      if (m.against_spells_cast_by) {
        expect(text(f), f.index).toMatch(/saving throws against spells cast by/);
        for (const t of m.against_spells_cast_by as string[]) expect(text(f), f.index).toContain(t);
      }
      const duration = m.duration as { unit: string; length?: number } | undefined;
      if ((m.type === 'roll' || m.type === 'deal_damage') && duration?.unit === 'end_of_next_turn')
        expect(text(f), f.index).toContain('until the end of your next turn');
      else if ((m.type === 'roll' || m.type === 'deal_damage') && duration)
        expect(text(f), f.index).toContain(`${duration.length} ${duration.unit}`);
    }
  });

  it('give the attacks against the owner the creatures of the spell the owner is under', () => {
    for (const [f, m] of all.filter(([, m]) => m.type === 'rolls_against_owner')) {
      expect(
        ['no_advantage', 'mode'].filter((k) => k in m),
        f.index
      ).toHaveLength(1);
      if (!m.mode) continue;
      // The attack rolls that have disadvantage are those of some creature types, or the opportunity attacks.
      expect(
        ['creature_types', 'opportunity_attacks_only'].filter((k) => k in m),
        f.index
      ).toHaveLength(1);
      if (m.opportunity_attacks_only) {
        expect(text(f), f.index).toMatch(
          /Opportunity attacks against you are made with disadvantage/
        );
        continue;
      }
      const named = modifiersOf(f).find((x) => x.type === 'spell' && x.always_active)!;
      expect(named, f.index).toBeDefined();
      const spellText = spells.get(named.spell as string)!.desc.join(' ');
      expect(spellText, f.index).toMatch(/disadvantage/);
      for (const t of m.creature_types as string[]) expect(spellText, f.index).toContain(t);
    }
  });

  it('are always under the effects of a spell only where the text says so', () => {
    for (const [f, m] of all.filter(([, m]) => m.type === 'spell' && m.always_active)) {
      expect(engineOf(f)!.action_cost, f.index).toBe('passive');
      expect(text(f), f.index).toMatch(/always under the effects of/);
      expect(text(f).toLowerCase(), f.index).toContain((m.spell as string).replaceAll('-', ' '));
    }
  });

  it('give the amounts and recipients of a bonus the text states', () => {
    const ORDINALS: Record<number, string> = { 1: '1st', 5: '5th', 8: '8th', 14: '14th' };
    for (const [f, m] of all.filter(([, m]) => m.type === 'bonus')) {
      if (m.target === 'self') expect(text(f), f.index).toMatch(/creature other than you/);
      if (m.school) expect(text(f), f.index).toContain(m.school);
      if (m.ability_modifier && m.minimum) {
        expect(text(f), f.index).toMatch(
          new RegExp(`minimum bonus of \\+${m.minimum}|\\(minimum ${m.minimum}\\)`)
        );
      }
      if (m.spell_damage_type_from) {
        expect(text(f), f.index).toMatch(/spell that deals damage of the type associated with/);
        expect(text(f), f.index).toContain(
          `add your ${ABILITY_NAMES[m.ability_modifier as string]} modifier to one damage roll`
        );
      }
      if (m.damage_type) expect(text(f), f.index).toContain(`${m.damage_type} damage`);
      if (m.attack_kind === 'bound_weapon') expect(text(f), f.index).toMatch(/pact weapon/);
      if ((m.while as string[] | undefined)?.includes('attacker_hit_owner_this_turn'))
        expect(text(f), f.index).toMatch(
          /When a creature hits you with an attack.* all subsequent attacks made by that creature/
        );
      if (m.dice_at_class_level) {
        const steps = Object.entries(m.dice_at_class_level as Record<string, string>);
        expect(Number(steps[0][0]), f.index).toBe(f.level);
        for (const [level, dice] of steps) {
          expect(text(f), f.index).toContain(dice);
          expect(text(f), f.index).toContain(ORDINALS[Number(level)]);
        }
      }
    }
  });

  it('change a casting of a spell as the text states', () => {
    for (const [f, m] of all.filter(([, m]) => m.type === 'spell_change')) {
      if (m.change === 'maximize_healing_dice')
        expect(text(f), f.index).toMatch(/highest number possible for each die/);
      if (m.change === 'half_damage_on_successful_save')
        expect(text(f), f.index).toMatch(
          /takes half the cantrip's damage \(if any\) but suffers no additional/
        );
      if (m.max_spell_level === 0) expect(text(f), f.index).toMatch(/cantrip/);
      if (m.change === 'no_material_without_cost')
        expect(text(f), f.index).toMatch(
          /material components that lack a cost and aren't consumed by a spell/
        );
      if (m.change === 'no_verbal_or_somatic' && !f.index.startsWith('metamagic-'))
        expect(text(f), f.index).toMatch(/ignore the verbal and somatic components/);
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

  it('give the rolls against conditions, the flying speed and the unlimited uses the text states', () => {
    for (const [f, m] of all) {
      for (const c of (m.against_conditions as string[]) ?? []) {
        expect(m.roll, f.index).toBe('saving_throw');
        expect(text(f), f.index).toMatch(
          new RegExp(`advantage on saving throws against being .*${c}`)
        );
      }
      if (m.type === 'immune_to' && m.creature_types) {
        expect(text(f), f.index).toMatch(/can't be charmed or frightened by elementals or fey/);
        expect(m.conditions, f.index).toEqual(['charmed', 'frightened']);
      }
      if (m.type === 'fly_speed')
        expect(text(f), f.index).toContain('flying speed equal to your current speed');
      if (m.type === 'unlimited_uses') {
        expect(text(f), f.index).toContain('Wild Shape an unlimited number of times');
        for (const index of m.features as string[]) {
          const target = feature(index)!;
          expect(target.class.index, f.index).toBe(f.class.index);
          expect(engineOf(target)?.uses, index).toBeDefined();
        }
      }
    }
  });

  it('give an aura that applies a condition the save and the choice the text states', () => {
    const presence = engineOf(feature('draconic-presence')!)!;
    const options = presence.modifiers!.filter((m) => m.aura);
    expect(options.map((m) => [m.option, m.condition])).toEqual([
      ['awe', 'charmed'],
      ['fear', 'frightened'],
    ]);
    // Concentration is the cost of keeping the aura, and applies whichever option is chosen.
    const concentration = presence.modifiers!.find((m) => m.condition === 'concentrating')!;
    expect(concentration.option).toBeUndefined();
    expect(concentration.target).toBe('self');
    expect(text(feature('draconic-presence')!)).toMatch(/until you lose your concentration/);
  });

  it('apply conditions that the text names', () => {
    const WORDS: Record<string, RegExp> = {
      enraged: /rage/i,
      frenzied: /frenzy/i,
      reckless: /recklessly/i,
      'sacred-weapon': /imbue one weapon/i,
      'no-reactions': /can't take reactions/i,
      concentrating: /concentration/i,
    };
    for (const [f, m] of all.filter(([, m]) => m.type === 'condition')) {
      expect(text(f), f.index).toMatch(
        WORDS[m.condition as string] ?? new RegExp(m.condition as string, 'i')
      );
    }
  });
});
