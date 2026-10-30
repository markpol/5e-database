import { describe, expect, it } from 'vitest';
import FeatData from '../en/5e-SRD-Feats.json' with { type: 'json' };
import BackgroundData from '../en/5e-SRD-Backgrounds.json' with { type: 'json' };
import Feats2024 from '../../2024/en/5e-SRD-Feats.json' with { type: 'json' };
import Backgrounds2024 from '../../2024/en/5e-SRD-Backgrounds.json' with { type: 'json' };
import ConditionData from '../en/5e-SRD-Conditions.json' with { type: 'json' };
import DamageTypeData from '../en/5e-SRD-Damage-Types.json' with { type: 'json' };
import ProficiencyData from '../en/5e-SRD-Proficiencies.json' with { type: 'json' };
import markers from '../../provenance/source-markers.json' with { type: 'json' };

type Modifier = { type: string } & Record<string, unknown>;
type Engine = { action_cost: string; recharge?: string; uses?: Record<string, unknown>; modifiers?: Modifier[] };
type Feat = {
  index: string;
  name: string;
  minimum_level?: number;
  feature_named?: string;
  desc: string[];
  type?: string;
  repeatable?: string;
  source?: string;
  engine?: Engine;
  grants_asi?: true;
  granted_proficiencies?: Record<string, unknown>[];
  url: string;
};
type Ref = { index: string; name: string; url: string; note?: string };
type Background = {
  index: string;
  name: string;
  source?: string;
  ability_scores?: Ref[];
  feat?: Ref;
  starting_proficiencies: Ref[];
  proficiency_choices?: unknown[];
  starting_equipment_options?: unknown[];
  feature?: { name: string; desc: string[] };
  personality_traits?: unknown;
  ideals?: unknown;
  bonds?: unknown;
  flaws?: unknown;
  url: string;
};
type Feat2024 = {
  index: string;
  name: string;
  description: string;
  type: string;
  repeatable?: string;
  prerequisites?: { minimum_level?: number; feature_named?: string };
};
type Background2024 = {
  index: string;
  name: string;
  ability_scores: Ref[];
  feat: Ref;
  proficiencies: Ref[];
  proficiency_choices?: unknown[];
};

const feats = FeatData as unknown as Feat[];
const backgrounds = BackgroundData as unknown as Background[];
const feats2024 = Feats2024 as unknown as Feat2024[];
const backgrounds2024 = Backgrounds2024 as unknown as Background2024[];
const conditions = new Set(ConditionData.map((c) => c.index));
const damageTypes = new Set(DamageTypeData.map((d) => d.index));
const proficiencies = new Set(ProficiencyData.map((p) => p.index));

const recordMarkers = (file: string) =>
  (markers.files as Record<string, { records?: Record<string, { source: string }> }>)[file].records ?? {};
const featRecords = recordMarkers('src/2014/en/5e-SRD-Feats.json');

const SRD_51_FEATS = ['grappler'];
const SRD_51_BACKGROUNDS = ['acolyte'];
const added = feats.filter((f) => !SRD_51_FEATS.includes(f.index));
const addedBackgrounds = backgrounds.filter((b) => !SRD_51_BACKGROUNDS.includes(b.index));

const text = (f: Feat) => f.desc.join(' ');
const feat = (index: string) => feats.find((f) => f.index === index)!;
const modifiers = (f: Feat) => f.engine?.modifiers ?? [];
const ofType = (f: Feat, type: string) => modifiers(f).filter((m) => m.type === type);

/**
 * Feats whose text has no structured counterpart at all, with the reason. Of the 16 feats added from the SRD 5.2 set
 * this is the only one; the others have an `engine`, `grants_asi` or `granted_proficiencies`.
 */
const FEAT_EXCLUDED: Record<string, string> = {
  'magic-initiate':
    'The cantrips and the level 1 spell are chosen from a spell list, and no modifier can name a spell that the owner chooses',
};

/**
 * Parts of a structured feat that stay in the text, as the heading of the benefit in the `desc` (or, for the SRD 5.1
 * feat, the words of the paragraph), with the reason.
 */
const FEAT_EXCLUDED_PARTS: Record<string, { part: string; reason: string }[]> = {
  alert: [{ part: 'Initiative Swap', reason: 'Swaps the initiative of two creatures; no modifier changes another creature' }],
  grappler: [
    {
      part: 'try to pin a creature Grappled by you',
      reason: 'An action that makes a contested check and restrains both creatures; no modifier states a contested check',
    },
  ],
  'boon-of-fate': [
    {
      part: 'Improve Fate',
      reason:
        'A 2d4 bonus or penalty on the d20 roll of another creature within 60 feet, and a recharge on rolling Initiative; neither has a word',
    },
  ],
  'boon-of-irresistible-offense': [
    {
      part: 'Overwhelming Strike',
      reason: 'Extra damage equal to the ability score that the owner chose to increase; no amount names that score',
    },
  ],
  'boon-of-spell-recall': [
    {
      part: 'Free Casting',
      reason: 'A 1d4 roll that decides whether a spell slot is expended; no modifier states a chance',
    },
  ],
  'boon-of-the-night-spirit': [
    {
      part: 'Merge with Shadows',
      reason: 'The Invisible condition ends right after the owner takes an action, a bonus action or a reaction; no duration states that',
    },
  ],
};

/** Phrases of the text that give each kind of modifier (or each other structured field) its meaning. */
const EVIDENCE: Record<string, (t: string, m: Modifier) => boolean> = {
  bonus: (t, m) => {
    if (m.to === 'initiative') return /add your Proficiency Bonus to the roll/.test(t) && m.proficiency_multiplier === 1;
    if (m.to === 'attack_roll')
      return t.includes(`+${m.flat} bonus to attack rolls you make with Ranged weapons`) && m.attack_kind === 'ranged_weapon';
    if (m.to === 'armor_class')
      return (
        t.includes(`+${m.flat} bonus to Armor Class`) &&
        t.includes('wearing Light, Medium, or Heavy armor') &&
        (m.while as string[])?.includes('wearing_armor')
      );
    if (m.to === 'damage_roll')
      return (
        m.attack_ability_modifier === true &&
        m.attack_kind === 'off_hand' &&
        t.includes('add your ability modifier to the damage of that attack') &&
        t.includes('Light property')
      );
    return false;
  },
  roll_damage_twice: (t, m) =>
    m.attack_kind === 'weapon' && t.includes('hit a target with a weapon') && t.includes("roll the weapon's damage dice twice"),
  minimum_damage_die: (t, m) =>
    m.minimum === 3 &&
    m.attack_kind === 'melee_weapon' &&
    (m.while as string[])?.includes('wielding_with_two_hands') &&
    /treat any 1 or 2 on a damage die as a 3/.test(t) &&
    t.includes('holding with two hands'),
  hit_instead_of_miss: (t) => t.includes('When you miss with an attack roll, you can hit instead'),
  teleport: (t, m) => {
    const after = (m.after as string[]).map((a) => ({ attack_action: 'Attack action', magic_action: 'Magic action' })[a]);
    return (
      t.includes(`teleport up to ${m.distance_ft} feet`) &&
      t.includes(`Immediately after you take the ${after[0]} or the ${after[1]}`) &&
      after.length === 2
    );
  },
  ignore_resistance: (t, m) =>
    (m.damage_types as string[]).length === 3 &&
    (m.damage_types as string[]).every((d) => t.includes(d[0].toUpperCase() + d.slice(1))) &&
    t.includes('always ignores Resistance'),
  sense: (t, m) => t.includes(`${(m.sense as string)[0].toUpperCase()}${(m.sense as string).slice(1)} with a range of ${m.range_ft} feet`),
  condition: (t, m) =>
    m.condition === 'invisible' &&
    m.target === 'self' &&
    conditions.has(m.condition) &&
    (m.while as string[])?.includes('in_dim_light_or_darkness') &&
    t.includes('While within Dim Light or Darkness') &&
    t.includes('give yourself the Invisible condition'),
  damage: (t, m) =>
    m.relation === 'resistance' &&
    (m.types as string[]).join() === 'all' &&
    (m.except as string[]).join() === 'psychic,radiant' &&
    [...(m.except as string[]), 'all'].every((d) => d === 'all' || damageTypes.has(d)) &&
    (m.while as string[])?.includes('in_dim_light_or_darkness') &&
    t.includes('Resistance to all damage except Psychic and Radiant'),
  ability_score_increase: (t, m) =>
    m.choose === 1 &&
    (m.abilities as string[]).join() === 'str,dex,con,int,wis,cha' &&
    t.includes(`Increase one ability score of your choice by ${m.increase}, to a maximum of ${m.maximum}`),
  roll: (t, m) =>
    m.roll === 'attack' &&
    m.mode === 'advantage' &&
    (m.while as string[])?.includes('target_grappled_by_owner') &&
    /advantage on Attack Rolls against a creature you are Grappling/.test(t),
};

describe('feats', () => {
  it('keeps the SRD 5.1 feat and adds the SRD 5.2 feats that it does not have', () => {
    expect(feats.map((f) => f.index).slice(0, 1)).toEqual(['grappler']);
    expect(added.map((f) => f.index)).toEqual(feats2024.map((f) => f.index).filter((i) => !SRD_51_FEATS.includes(i)));
    expect(added).toHaveLength(16);
  });

  it('marks the source of every added feat', () => {
    for (const f of added) {
      expect(f.source, f.index).toBe('srd-5.2');
      expect(featRecords[f.index]).toMatchObject({ source: 'srd-5.2' });
    }
    for (const index of SRD_51_FEATS) expect(feat(index).source).toBeUndefined();
  });

  it.each(added.map((f) => [f.index, f] as const))('%s keeps the type, text and prerequisites of the SRD 5.2 feat', (_, f) => {
    const source = feats2024.find((s) => s.index === f.index)!;
    expect(f.name).toBe(source.name);
    expect(f.desc).toEqual(source.description.split('\n'));
    expect(f.type).toBe(source.type);
    expect(f.repeatable).toBe(source.repeatable);
    expect(f.minimum_level).toBe(source.prerequisites?.minimum_level);
    expect(f.feature_named).toBe(source.prerequisites?.feature_named);
    expect(f.url).toBe(`/api/2014/feats/${f.index}`);
  });

  it('gives a prerequisite to the feats of the kinds that have one', () => {
    for (const f of feats.filter((x) => x.type === 'epic-boon')) expect(f.minimum_level, f.index).toBe(19);
    for (const f of feats.filter((x) => x.type === 'fighting-style')) expect(f.feature_named, f.index).toBe('Fighting Style');
    expect(feat('ability-score-improvement').minimum_level).toBe(4);
    expect(feat('boon-of-spell-recall').feature_named).toBe('Spellcasting');
    expect(feats.filter((f) => f.type === 'origin').every((f) => f.minimum_level === undefined)).toBe(true);
  });

  it('structures each added feat, or lists it with a reason', () => {
    const structured = (f: Feat) => Boolean(f.engine || f.grants_asi || f.granted_proficiencies);
    for (const f of added) {
      if (structured(f)) expect(FEAT_EXCLUDED, f.index).not.toHaveProperty(f.index);
      else expect(FEAT_EXCLUDED, `${f.index} has no structured field`).toHaveProperty(f.index);
    }
    for (const index of Object.keys(FEAT_EXCLUDED)) expect(added.map((f) => f.index)).toContain(index);
    expect(added.filter(structured)).toHaveLength(15);
    expect(added.filter((f) => f.engine)).toHaveLength(13);
  });

  it('lists a part of a feat that stays in the text only when the text has it', () => {
    for (const [index, parts] of Object.entries(FEAT_EXCLUDED_PARTS)) {
      expect(feat(index).engine, `${index} has an engine`).toBeDefined();
      for (const { part, reason } of parts) {
        expect(text(feat(index)), `${index}: ${part}`).toContain(part);
        expect(reason.length).toBeGreaterThan(0);
      }
    }
  });

  it('gives every modifier a phrase in the text of its feat', () => {
    for (const f of feats.filter((x) => x.engine)) {
      for (const m of modifiers(f)) {
        const evidence = EVIDENCE[m.type];
        expect(evidence, `${f.index}: no rule for ${m.type}`).toBeDefined();
        expect(evidence(text(f), m), `${f.index}: ${JSON.stringify(m)}`).toBe(true);
      }
    }
  });

  it('states the cost and the uses that the text gives', () => {
    for (const f of feats.filter((x) => x.engine)) {
      const t = text(f);
      const engine = f.engine!;
      const bonusAction = /as a Bonus Action/.test(t);
      expect(engine.action_cost === 'bonus_action', f.index).toBe(bonusAction);
      const oncePerTurn = /Once per turn/.test(t) || /until the start of your next turn/.test(t);
      expect(engine.recharge === 'turn', f.index).toBe(oncePerTurn);
      if (/until you roll Initiative or finish a Short or Long Rest/.test(t)) expect(engine.recharge).toBe('short_rest');
      expect(engine.uses !== undefined, f.index).toBe(oncePerTurn || engine.recharge === 'short_rest');
      if (engine.uses) expect(engine.uses).toEqual({ count: 1 });
      const modified = new Set(modifiers(f).map((m) => m.type));
      // An engine that states no modifier is the cost and the uses of the feat alone.
      if (modified.size === 0) expect(engine.uses, f.index).toBeDefined();
    }
  });

  it('restates the Ability Score Improvement and the Skilled proficiencies', () => {
    const asi = feat('ability-score-improvement');
    expect(asi.grants_asi).toBe(true);
    expect(text(asi)).toContain('Increase one ability score of your choice by 2, or increase two ability scores of your choice by 1');
    expect(asi.engine).toBeUndefined();
    const skilled = feat('skilled');
    expect(text(skilled)).toContain('any combination of three skills or tools');
    expect(skilled.granted_proficiencies).toEqual([{ choose: 3, from: 'skills_or_tools' }]);
    expect(feats.filter((f) => f.grants_asi).map((f) => f.index)).toEqual(['ability-score-improvement']);
  });

  it('gives each boon the Ability Score Improvement of its text', () => {
    const boons = feats.filter((f) => f.type === 'epic-boon');
    expect(boons).toHaveLength(7);
    for (const f of boons) {
      expect(ofType(f, 'ability_score_increase'), f.index).toHaveLength(1);
      expect(text(f), f.index).toContain('to a maximum of 30');
    }
    for (const f of feats.filter((x) => x.type !== 'epic-boon')) expect(ofType(f, 'ability_score_increase'), f.index).toHaveLength(0);
  });

  it('structures the SRD 5.1 feat without changing its text', () => {
    const grappler = feat('grappler');
    expect(grappler.type).toBe('general');
    expect(grappler.engine).toEqual({
      action_cost: 'passive',
      modifiers: [{ type: 'roll', roll: 'attack', mode: 'advantage', while: ['target_grappled_by_owner'] }],
    });
    expect(text(grappler)).toContain('You have advantage on Attack Rolls against a creature you are Grappling');
  });

  it('uses a repeatable limit only where the text of the SRD 5.2 feat has one', () => {
    expect(feats.filter((f) => f.repeatable).map((f) => f.index)).toEqual(['magic-initiate', 'skilled', 'ability-score-improvement']);
  });
});

describe('backgrounds', () => {
  it('keeps the SRD 5.1 background and adds the SRD 5.2 backgrounds that it does not have', () => {
    expect(backgrounds[0].index).toBe('acolyte');
    expect(backgrounds[0].source).toBeUndefined();
    const fromSrd = addedBackgrounds.filter((b) => b.source === 'srd-5.2');
    expect(fromSrd.map((b) => b.index)).toEqual(backgrounds2024.map((b) => b.index).filter((i) => !SRD_51_BACKGROUNDS.includes(i)));
    expect(addedBackgrounds.filter((b) => b.source === 'dd').map((b) => b.index)).toEqual(['cartographer', 'lighthouse-keeper']);
  });

  it('marks the source of every added background', () => {
    const records = recordMarkers('src/2014/en/5e-SRD-Backgrounds.json');
    for (const b of addedBackgrounds) {
      expect(['srd-5.2', 'dd'], b.index).toContain(b.source);
      expect(records[b.index].source, b.index).toBe(b.source);
    }
    expect(Object.keys(records).sort()).toEqual(addedBackgrounds.map((b) => b.index).sort());
    expect(Object.keys(featRecords).sort()).toEqual(added.map((f) => f.index).sort());
  });

  it.each(addedBackgrounds.filter((b) => b.source === 'srd-5.2').map((b) => [b.index, b] as const))(
    '%s keeps the abilities, the origin feat and the proficiencies of the SRD 5.2 background',
    (_, b) => {
      const source = backgrounds2024.find((s) => s.index === b.index)!;
      expect(b.name).toBe(source.name);
      expect(b.ability_scores!.map((a) => a.index)).toEqual(source.ability_scores.map((a) => a.index));
      expect(b.feat!.index).toBe(source.feat.index);
      expect(feat(b.feat!.index).type).toBe('origin');
      // The tool proficiencies are named without the prefix that the SRD 5.2 data gives them.
      const kept = b.starting_proficiencies.map((p) => p.index);
      expect(kept).toEqual(source.proficiencies.map((p) => p.index.replace('tool-', '')));
      for (const p of kept) expect(proficiencies.has(p), p).toBe(true);
      expect(b.feature).toBeUndefined();
      expect(b.url).toBe(`/api/2014/backgrounds/${b.index}`);
    }
  );

  it('keeps the choice of a gaming set for the soldier and nothing else', () => {
    expect(addedBackgrounds.filter((b) => b.proficiency_choices).map((b) => b.index)).toEqual(['soldier']);
  });

  it('gives the original backgrounds the structure of the SRD 5.1 background', () => {
    const acolyte = backgrounds[0];
    for (const b of addedBackgrounds.filter((x) => x.source === 'dd')) {
      expect(Object.keys(b).sort(), b.index).toEqual(
        [...Object.keys(acolyte).filter((k) => k !== 'starting_equipment_options'), 'source'].sort()
      );
      expect(b.feature!.desc.length, b.index).toBeGreaterThan(0);
      expect(b.ability_scores, b.index).toBeUndefined();
    }
  });
});
