import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import AbilityScores from '../en/5e-SRD-Ability-Scores.json' with { type: 'json' };
import Conditions from '../en/5e-SRD-Conditions.json' with { type: 'json' };
import DamageTypes from '../en/5e-SRD-Damage-Types.json' with { type: 'json' };
import Features from '../en/5e-SRD-Features.json' with { type: 'json' };
import markers from '../../provenance/source-markers.json' with { type: 'json' };
import { ConditionSchema } from '../schemas/5e-SRD-Conditions';

type Condition = z.infer<typeof ConditionSchema>;
type Effects = Condition['effects'];

const conditions = z.array(ConditionSchema).parse(Conditions);
const byIndex = new Map(conditions.map((c) => [c.index, c]));
const row = (index: string): Condition => {
  const found = byIndex.get(index);
  if (!found) throw new Error(`no condition ${index}`);
  return found;
};

/** The condition rows that the SRD condition text implies but upstream does not have. */
const NEW_ROWS = [
  'no-reactions',
  'concentrating',
  'blessed',
  'shield-of-faith',
  'sanctuary',
  'beacon-of-hope',
  'spiritual-weapon',
  'spirit-guardians',
  'sacred-weapon',
  'magic-weapon',
  'divine-favor',
  'branding-smite',
  'mage-armor',
  'commanded',
];

const EFFECT_FIELDS = (effects: Effects) => Object.keys(effects).filter((key) => key !== 'reason');
const hasNoEffects = (effects: Effects) => EFFECT_FIELDS(effects).length === 0;

describe('condition effects', () => {
  it('give every condition effects, or an empty effects with a reason', () => {
    const problems: string[] = [];
    for (const condition of conditions) {
      const { effects } = condition;
      if (hasNoEffects(effects) && !effects.reason?.trim()) {
        problems.push(`${condition.index}: no effects and no reason`);
      }
      if (!hasNoEffects(effects) && effects.reason !== undefined) {
        problems.push(`${condition.index}: has effects and a reason`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('counts the conditions with and without structured effects', () => {
    const empty = conditions.filter((c) => hasNoEffects(c.effects)).map((c) => c.index);
    expect(conditions).toHaveLength(33 + NEW_ROWS.length);
    expect(empty).toEqual([
      'exhaustion',
      'frenzied',
      'infested',
      'concentrating',
      'sanctuary',
      'spiritual-weapon',
      'commanded',
    ]);
  });

  it('adds the new rows after the existing ones, in the id style of the data', () => {
    const indices = conditions.map((c) => c.index);
    expect(indices.slice(-NEW_ROWS.length)).toEqual(NEW_ROWS);
    for (const index of NEW_ROWS) {
      const condition = row(index);
      expect(condition.url).toBe(`/api/2014/conditions/${index}`);
      expect(condition.name.length).toBeGreaterThan(0);
      expect(condition.desc.length).toBeGreaterThan(0);
      expect(index).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });

  it('marks every new row as written for the game', () => {
    const marked = markers.files['src/2014/en/5e-SRD-Conditions.json'].records as Record<
      string,
      { source: string; note: string }
    >;
    for (const index of NEW_ROWS) {
      expect(marked[index]?.source, index).toBe('dd');
      expect(marked[index]?.note, index).toContain('original wording');
    }
  });

  it('keeps the 14 conditions of the upstream data unchanged in name, text and url', () => {
    const upstream = [
      'blinded',
      'charmed',
      'deafened',
      'exhaustion',
      'frightened',
      'grappled',
      'incapacitated',
    ];
    expect(upstream.every((index) => byIndex.has(index))).toBe(true);
    expect(row('blinded').desc[0]).toBe(
      "- A blinded creature can't see and automatically fails any ability check that requires sight."
    );
    expect(row('blinded').url).toBe('/api/2014/conditions/blinded');
  });
});

describe('exhaustion levels', () => {
  const levels = conditions.filter((c) => c.exhaustion_level);

  it('are the six numbered exhaustion conditions, and only those', () => {
    expect(levels.map((c) => c.index)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `exhaustion-${n}`));
  });

  it('form a chain 1..6 with next and prev', () => {
    for (const [position, condition] of levels.entries()) {
      const level = position + 1;
      expect(condition.exhaustion_level!.level, condition.index).toBe(level);
      expect(condition.index).toBe(`exhaustion-${level}`);
      expect(condition.exhaustion_level!.next, condition.index).toBe(
        level < 6 ? `exhaustion-${level + 1}` : undefined
      );
      expect(condition.exhaustion_level!.prev, condition.index).toBe(
        level > 1 ? `exhaustion-${level - 1}` : undefined
      );
    }
  });

  it('link back to each other', () => {
    for (const condition of levels) {
      const { next, prev } = condition.exhaustion_level!;
      if (next) expect(row(next).exhaustion_level!.prev).toBe(condition.index);
      if (prev) expect(row(prev).exhaustion_level!.next).toBe(condition.index);
    }
  });

  it('add the effect of each level to those of the levels below', () => {
    const rolls = (index: string) =>
      row(index).effects.rolls?.map((r) => `${r.roll}:${r.mode}`) ?? [];
    expect(rolls('exhaustion-1')).toEqual(['ability_check:disadvantage']);
    expect(rolls('exhaustion-2')).toEqual(['ability_check:disadvantage']);
    expect(rolls('exhaustion-3')).toEqual([
      'ability_check:disadvantage',
      'attack:disadvantage',
      'saving_throw:disadvantage',
    ]);
    expect(row('exhaustion-1').effects.speed).toBeUndefined();
    expect(row('exhaustion-2').effects.speed).toEqual({ op: 'halve' });
    expect(row('exhaustion-4').effects.hit_point_maximum).toEqual({ op: 'halve' });
    expect(row('exhaustion-5').effects.speed).toEqual({ op: 'set', value: 0 });
    expect(row('exhaustion-5').effects.death).toBeUndefined();
    expect(row('exhaustion-6').effects.death).toBe(true);
    for (const level of [1, 2, 3, 4, 5]) {
      const lower = row(`exhaustion-${level}`).effects.rolls ?? [];
      const higher = row(`exhaustion-${level + 1}`).effects.rolls ?? [];
      expect(higher.slice(0, lower.length), `level ${level + 1}`).toEqual(lower);
    }
  });
});

describe('condition references', () => {
  const abilities = new Set(AbilityScores.map((a) => a.index));
  const damageTypes = new Set([...DamageTypes.map((d) => d.index), 'all']);
  const features = new Map(Features.map((f) => [f.index, f]));

  it('resolve every condition, ability, damage type and feature that an entry names', () => {
    const problems: string[] = [];
    const check = (at: string, kind: string, value: string, known: { has(v: string): boolean }) => {
      if (!known.has(value)) problems.push(`${at}: ${kind} '${value}' does not exist`);
    };
    const ids = new Set(byIndex.keys());
    for (const c of conditions) {
      const e = c.effects;
      for (const id of e.includes ?? []) check(`${c.index}.effects.includes`, 'condition', id, ids);
      for (const id of c.removes ?? []) check(`${c.index}.removes`, 'condition', id, ids);
      for (const id of c.adds ?? []) check(`${c.index}.adds`, 'condition', id, ids);
      for (const id of c.on_remove?.removes ?? [])
        check(`${c.index}.on_remove`, 'condition', id, ids);
      for (const id of e.immune_to ?? []) {
        check(`${c.index}.effects.immune_to`, 'condition', id, new Set([...ids, 'disease']));
      }
      for (const r of e.rolls ?? [])
        for (const a of r.abilities ?? []) check(`${c.index}.rolls`, 'ability', a, abilities);
      for (const d of e.damage ?? [])
        for (const t of d.types) check(`${c.index}.damage`, 'damage type', t, damageTypes);
      for (const b of e.bonuses ?? []) {
        if (b.damage_type) check(`${c.index}.bonuses`, 'damage type', b.damage_type, damageTypes);
      }
      for (const f of c.immune_if_feature ?? []) {
        check(`${c.index}.immune_if_feature`, 'feature', f.feature, features);
        if (f.while_condition)
          check(`${c.index}.immune_if_feature`, 'condition', f.while_condition, ids);
      }
    }
    expect(problems).toEqual([]);
  });

  it('do not name a condition as its own include, removal or addition', () => {
    for (const c of conditions) {
      expect(c.effects.includes ?? [], c.index).not.toContain(c.index);
      expect(c.removes ?? [], c.index).not.toContain(c.index);
      expect(c.adds ?? [], c.index).not.toContain(c.index);
    }
  });

  it('let a condition include only conditions that do not include it back', () => {
    const reach = (index: string, seen = new Set<string>()): Set<string> => {
      for (const next of row(index).effects.includes ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          reach(next, seen);
        }
      }
      return seen;
    };
    for (const c of conditions) expect(reach(c.index), c.index).not.toContain(c.index);
  });

  it('resolve includes to the effects that the text names', () => {
    const resolved = (index: string): Effects[] => [
      row(index).effects,
      ...(row(index).effects.includes ?? []).flatMap(resolved),
    ];
    const cannot = (index: string) => new Set(resolved(index).flatMap((e) => e.cannot ?? []));
    for (const index of ['paralyzed', 'petrified', 'stunned', 'unconscious']) {
      expect(cannot(index), index).toContain('take_actions');
      expect(cannot(index), index).toContain('take_reactions');
    }
    expect(cannot('swallowed')).toContain('see');
    expect(resolved('swallowed').some((e) => e.speed?.op === 'set')).toBe(true);
  });

  it('justify each removal by the text of the condition that ends', () => {
    const removals = conditions.flatMap((c) =>
      (c.removes ?? []).map((ended) => [c.index, ended] as const)
    );
    expect(removals).toEqual([
      ['incapacitated', 'concentrating'],
      ['unconscious', 'enraged'],
      ['unconscious', 'sacred-weapon'],
    ]);
    for (const [holder, ended] of removals) {
      expect(row(ended).desc.join(' ').toLowerCase(), `${ended} ends on ${holder}`).toContain(
        holder
      );
    }
    expect(row('enraged').on_remove).toEqual({ removes: ['frenzied'] });
    expect(row('frenzied').desc.join(' ')).toContain('For the duration of your rage');
    expect(row('frenzied').on_remove).toEqual({ exhaustion_levels: 1 });
    expect(row('frenzied').desc.join(' ')).toContain(
      'When your rage ends, you suffer one level of exhaustion'
    );
  });

  it('justify each immunity by the text of the feature', () => {
    const immunities = conditions.flatMap((c) =>
      (c.immune_if_feature ?? []).map((f) => [c.index, f] as const)
    );
    expect(immunities.map(([condition, f]) => `${condition}:${f.feature}`)).toEqual([
      'charmed:mindless-rage',
      'frightened:mindless-rage',
      'poisoned:purity-of-body',
      'poisoned:natures-ward',
    ]);
    for (const [condition, { feature }] of immunities) {
      const stem = condition.replace(/ed$/, '');
      expect(
        features.get(feature)!.desc.join(' ').toLowerCase(),
        `${feature} for ${condition}`
      ).toContain(stem);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Text against structure. Each rule is a phrase of a condition's text and the structure that phrase states. A row
// passes when the structure that its text states is exactly the structure it has, and no mechanical word is left in
// its text that a rule or the list of unstructured phrases does not account for.
// ---------------------------------------------------------------------------------------------------------------

type Fragment = { effects?: Effects; adds?: string[]; on_remove?: { exhaustion_levels: number } };
type Rule = { phrase: RegExp; states: Fragment };

type Rolls = NonNullable<Effects['rolls']>;
const STR: NonNullable<Rolls[number]['abilities']> = ['str'];
const NO_HEAVY_ARMOR: NonNullable<Rolls[number]['while']> = ['not_wearing_heavy_armor'];
const WHILE_ACTING: NonNullable<Rolls[number]['while']> = ['not_incapacitated', 'speed_above_0'];

const rule = (phrase: RegExp, states: Fragment): Rule => ({ phrase, states });
const effects = (e: Effects): Fragment => ({ effects: e });

const RULES: Rule[] = [
  rule(
    /can't see and automatically fails any ability check that requires sight/,
    effects({
      cannot: ['see'],
      rolls: [{ roll: 'ability_check', mode: 'auto_fail', requires_sense: 'sight' }],
    })
  ),
  rule(
    /can't hear and automatically fails any ability check that requires hearing/,
    effects({
      cannot: ['hear'],
      rolls: [{ roll: 'ability_check', mode: 'auto_fail', requires_sense: 'hearing' }],
    })
  ),
  rule(
    /attack rolls against (the creature|you) have advantage/,
    effects({ rolls_against: [{ roll: 'attack', mode: 'advantage' }] })
  ),
  rule(
    /attack rolls against the creature have disadvantage/,
    effects({ rolls_against: [{ roll: 'attack', mode: 'disadvantage' }] })
  ),
  rule(
    /the creature's attack rolls have disadvantage/,
    effects({ rolls: [{ roll: 'attack', mode: 'disadvantage' }] })
  ),
  rule(
    /the creature's attack rolls have advantage/,
    effects({ rolls: [{ roll: 'attack', mode: 'advantage' }] })
  ),
  rule(
    /has disadvantage on attack rolls and ability checks/,
    effects({
      rolls: [
        { roll: 'attack', mode: 'disadvantage' },
        { roll: 'ability_check', mode: 'disadvantage' },
      ],
    })
  ),
  rule(
    /the creature has disadvantage on attack rolls\./,
    effects({ rolls: [{ roll: 'attack', mode: 'disadvantage' }] })
  ),
  rule(
    /an attack roll against the creature has advantage if the attacker is within 5 feet of the creature\. otherwise, the attack roll has disadvantage/,
    effects({
      rolls_against: [
        { roll: 'attack', mode: 'advantage', within_ft: 5 },
        { roll: 'attack', mode: 'disadvantage', beyond_ft: 5 },
      ],
    })
  ),
  rule(
    /disadvantage on ability checks and attack rolls while the source of its fear is within line of sight/,
    effects({
      rolls: [
        { roll: 'ability_check', mode: 'disadvantage', while: ['source_in_line_of_sight'] },
        { roll: 'attack', mode: 'disadvantage', while: ['source_in_line_of_sight'] },
      ],
    })
  ),
  rule(
    /the creature has disadvantage on dexterity saving throws/,
    effects({ rolls: [{ roll: 'saving_throw', mode: 'disadvantage', abilities: ['dex'] }] })
  ),
  rule(
    /automatically fails strength and dexterity saving throws/,
    effects({ rolls: [{ roll: 'saving_throw', mode: 'auto_fail', abilities: ['str', 'dex'] }] })
  ),
  rule(
    /any attack that hits the creature is a critical hit if the attacker is within 5 feet of the creature/,
    effects({ rolls_against: [{ roll: 'attack', critical_hit: true, within_ft: 5 }] })
  ),
  rule(
    /speed becomes 0, and it can't benefit from any bonus to its speed/,
    effects({ speed: { op: 'set', value: 0, ignores_bonuses: true } })
  ),
  rule(/can't take actions or reactions/, effects({ cannot: ['take_actions', 'take_reactions'] })),
  rule(/is incapacitated \(see the condition\)/, effects({ includes: ['incapacitated'] })),
  rule(/can't move or speak/, effects({ cannot: ['move', 'speak'] })),
  rule(/can't move, and can speak only falteringly/, effects({ cannot: ['move'] })),
  rule(/is unaware of its surroundings/, effects({ cannot: ['perceive_surroundings'] })),
  rule(/drops whatever it's holding and falls prone/, {
    effects: { drops_held_items: true },
    adds: ['prone'],
  }),
  rule(
    /resistance to all damage/,
    effects({ damage: [{ relation: 'resistance', types: ['all'] }] })
  ),
  rule(
    /immune to poison and disease/,
    effects({
      damage: [{ relation: 'immunity', types: ['poison'] }],
      immune_to: ['poisoned', 'disease'],
    })
  ),
  rule(/only movement option is to crawl/, effects({ speed: { op: 'crawl_only' } })),
  rule(
    /can't willingly move closer to the source of its fear/,
    effects({ cannot: ['move_closer_to_source'] })
  ),
  rule(
    /can't attack the charmer or target the charmer with harmful abilities or magical effects/,
    effects({ cannot: ['harm_source'] })
  ),
  rule(
    /the charmer has advantage on any ability check to interact socially with the creature/,
    effects({
      rolls_against: [
        { roll: 'ability_check', mode: 'advantage', by: 'source', purpose: 'social_interaction' },
      ],
    })
  ),
  rule(/blinded and restrained/, effects({ includes: ['blinded', 'restrained'] })),
  rule(
    /your strength score has been reduced/,
    effects({ ability_scores: [{ ability: 'str', op: 'reduce' }] })
  ),
  rule(/your hit point maximum has been reduced/, effects({ hit_point_maximum: { op: 'reduce' } })),
  rule(
    /disadvantage on strength-based attack rolls, strength checks, and strength saving throws/,
    effects({
      rolls: [
        { roll: 'attack', mode: 'disadvantage', abilities: STR },
        { roll: 'ability_check', mode: 'disadvantage', abilities: STR },
        { roll: 'saving_throw', mode: 'disadvantage', abilities: STR },
      ],
    })
  ),
  rule(/can't use reactions/, effects({ cannot: ['take_reactions'] })),
  rule(/its speed is halved/, effects({ speed: { op: 'halve' } })),
  rule(/can't make more than one attack on its turn/, effects({ limits: { attacks_per_turn: 1 } })),
  rule(
    /either an action or a bonus action on its turn, but not both/,
    effects({ limits: { one_of_action_or_bonus_action: true } })
  ),
  rule(
    /can't move or take an action on their first turn of the combat, and can't take a reaction/,
    effects({ cannot: ['move', 'take_actions', 'take_reactions'] })
  ),
  rule(/doesn’?'?t provoke opportunity attacks/, effects({ provokes_opportunity_attacks: false })),
  rule(/when your rage ends, you suffer one level of exhaustion/, {
    on_remove: { exhaustion_levels: 1 },
  }),
  rule(
    /you have advantage on strength checks and strength saving throws/,
    effects({
      rolls: [
        { roll: 'ability_check', mode: 'advantage', abilities: STR, while: NO_HEAVY_ARMOR },
        { roll: 'saving_throw', mode: 'advantage', abilities: STR, while: NO_HEAVY_ARMOR },
      ],
    })
  ),
  rule(
    /resistance to bludgeoning, piercing, and slashing damage/,
    effects({
      damage: [
        {
          relation: 'resistance',
          types: ['bludgeoning', 'piercing', 'slashing'],
          while: NO_HEAVY_ARMOR,
        },
      ],
    })
  ),
  rule(
    /you can't cast them or concentrate on them while raging/,
    effects({ cannot: ['cast_spells', 'concentrate'] })
  ),
  rule(
    /advantage on melee weapon attack rolls using strength/,
    effects({
      rolls: [{ roll: 'attack', mode: 'advantage', abilities: STR, attack_kind: 'melee_weapon' }],
    })
  ),
  rule(
    /any attack roll made against you has disadvantage if you can see the attacker/,
    effects({
      rolls_against: [
        { roll: 'attack', mode: 'disadvantage', while: ['can_see_attacker', ...WHILE_ACTING] },
      ],
    })
  ),
  rule(
    /you make dexterity saving throws with advantage/,
    effects({
      rolls: [{ roll: 'saving_throw', mode: 'advantage', abilities: ['dex'], while: WHILE_ACTING }],
    })
  ),
  rule(/you lose this benefit if you are incapacitated or if your speed drops to 0/, {}),
  // The six levels of exhaustion, as the numbered lines of the text give them.
  rule(
    /\b1 - disadvantage on ability checks/,
    effects({ rolls: [{ roll: 'ability_check', mode: 'disadvantage' }] })
  ),
  rule(/\b2 - speed halved/, effects({ speed: { op: 'halve' } })),
  rule(
    /\b3 - disadvantage on attack rolls and saving throws/,
    effects({
      rolls: [
        { roll: 'attack', mode: 'disadvantage' },
        { roll: 'saving_throw', mode: 'disadvantage' },
      ],
    })
  ),
  rule(/\b4 - hit point maximum halved/, effects({ hit_point_maximum: { op: 'halve' } })),
  rule(/\b5 - speed reduced to 0/, effects({ speed: { op: 'set', value: 0 } })),
  rule(/\b6 - death/, effects({ death: true })),
  // The rows written for the game.
  rule(/can't take reactions until the condition ends/, effects({ cannot: ['take_reactions'] })),
  rule(
    /adds 1d4 to its attack rolls and to its saving throws/,
    effects({
      bonuses: [
        { to: 'attack_roll', dice: '1d4' },
        { to: 'saving_throw', dice: '1d4' },
      ],
    })
  ),
  rule(/has a \+2 bonus to armor class/, effects({ bonuses: [{ to: 'armor_class', flat: 2 }] })),
  rule(
    /advantage on wisdom saving throws and on death saving throws/,
    effects({
      rolls: [
        { roll: 'saving_throw', mode: 'advantage', abilities: ['wis'] },
        { roll: 'death_saving_throw', mode: 'advantage' },
      ],
    })
  ),
  rule(/restores the greatest amount possible/, effects({ healing: 'maximum' })),
  rule(/has its speed halved/, effects({ speed: { op: 'halve' } })),
  rule(
    /adds its wielder's charisma modifier, with a minimum of \+1, to attack rolls made with it/,
    effects({
      bonuses: [
        { to: 'attack_roll', ability_modifier: 'cha', minimum: 1, attack_kind: 'bound_weapon' },
      ],
    })
  ),
  rule(
    /\+1 bonus to attack rolls and damage rolls/,
    effects({
      bonuses: [
        { to: 'attack_roll', flat: 1, attack_kind: 'bound_weapon' },
        { to: 'damage_roll', flat: 1, attack_kind: 'bound_weapon' },
      ],
    })
  ),
  rule(
    /an extra 1d4 radiant damage when it hits with a weapon attack/,
    effects({
      bonuses: [{ to: 'damage_roll', dice: '1d4', damage_type: 'radiant', attack_kind: 'weapon' }],
    })
  ),
  rule(
    /the next weapon attack that hits from a creature under branding smite deals an extra 2d6 radiant damage/,
    effects({
      bonuses: [
        { to: 'damage_roll', dice: '2d6', damage_type: 'radiant', attack_kind: 'weapon', uses: 1 },
      ],
    })
  ),
  rule(
    /has a base armor class of 13 plus its dexterity modifier/,
    effects({
      armor_class: { base: { value: 13, ability_modifier: 'dex' }, while: ['not_wearing_armor'] },
    })
  ),
];

/**
 * Mechanical phrases that the structure deliberately leaves out, per condition. Each must be in the text, so the
 * list cannot go stale; anything mechanical in a text that is in neither a rule nor this list fails the audit.
 */
const UNSTRUCTURED: Record<string, string[]> = {
  grappled: [
    'the condition ends if the grappler is incapacitated',
    'the condition also ends if an effect removes the grappled creature from the reach of the grappler',
  ],
  invisible: [
    'impossible to see without the aid of magic or a special sense',
    'the creature is heavily obscured',
    "the creature's location can be detected by any noise it makes or any tracks it leaves",
  ],
  petrified: [
    'its weight increases by a factor of ten, and it ceases aging',
    'although a poison or disease already in its system is suspended, not neutralized',
  ],
  enraged: [
    'on your turn, you can enter a rage as a bonus action',
    'when you make a melee weapon attack using strength, you gain a +2 bonus to the damage roll. this bonus increases as you level',
    "it ends early if you are knocked unconscious or if your turn ends and you haven't attacked a hostile creature since your last turn or taken damage since then",
    'you can also end your rage on your turn as a bonus action',
    'once you have raged the maximum number of times for your barbarian level',
    'your rage lasts for 1 minute',
    'if you are able to cast spells,',
    "if you aren't wearing heavy armor",
  ],
  frenzied: ['you can make a single melee weapon attack as a bonus action on each of your turns'],
  reckless: ['when you make your first attack on your turn, you attack recklessly'],
  dodging: ['until the start of your next turn,'],
  infested: ['consumes blood every turn', 'an action can be used to detach the parasite'],
  swallowed: [
    'has total cover against attacks and other effects outside the host',
    'if the host dies, a swallowed creature is no longer restrained by it and can escape',
  ],
  'drained-of-strength': ['the reduction lasts until a short or long rest is taken'],
  weakened: [
    'for 1 minute',
    'the creature can repeat the saving throw at the end of each of its turns',
  ],
  slowed: [
    'these effects last for 1 minute',
    'the creature can repeat the saving throw at the end of each of its turns',
  ],
  'drained-of-life': ['this reduction lasts until a long rest has been taken'],
  disengaged: ['movement away from an adversary'],
  surprised: ["a member of a group can be surprised even if the other members aren't"],
  concentrating: [
    'casts another spell that requires concentration',
    'is incapacitated, or dies',
    'it must succeed on a constitution saving throw to keep concentrating',
  ],
  sanctuary: [
    'must first succeed on a wisdom saving throw, or choose a new target',
    'the ward does not protect against area effects',
    'attacks or casts a spell that affects an enemy',
  ],
  'spiritual-weapon': ['as a bonus action the caster can move it up to 20 feet and attack again'],
  'spirit-guardians': [
    'it also takes radiant or necrotic damage, or half as much with a successful wisdom saving throw',
  ],
  'sacred-weapon': [
    'it also gives off bright light and is magical',
    'falls unconscious or stops holding',
  ],
  'branding-smite': [
    'the target of that hit becomes visible if it is invisible, and it cannot become invisible again until the condition ends',
  ],
  'mage-armor': ["that isn't wearing armor", 'the effect ends if the creature puts on armor'],
  commanded: [
    'it follows the order, unless it is undead, does not understand the language, or the order would directly harm it',
  ],
};

/** Conditions whose text the audit does not cover, and why. */
const NOT_AUDITED: Record<string, string> = {
  exhaustion: 'the umbrella entry restates all six levels, whose rows carry the effects',
};

const MECHANICAL =
  /(disadvantage|advantage|automatically fail|critical hit|speed|resist|immun|can't|cannot|doesn't|bonus|extra|adds|halved|reduced)/;

const normalize = (condition: Condition) =>
  condition.desc
    .map((line) => line.replace(/^- /, ''))
    .join(' ')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ');

/** One string per fact a condition states, so that a text and its structure can be compared as sets. */
function claimsOf(fragment: Fragment): Set<string> {
  const claims = new Set<string>();
  const add = (kind: string, value: unknown) =>
    claims.add(`${kind} ${JSON.stringify(sortKeys(value))}`);
  const e = fragment.effects ?? {};
  for (const [key, value] of Object.entries(e)) {
    if (key === 'reason') continue;
    if (Array.isArray(value)) value.forEach((item) => add(key, item));
    else if (key === 'limits')
      Object.entries(value).forEach(([limit, v]) => add(key, { [limit]: v }));
    else add(key, value);
  }
  for (const id of fragment.adds ?? []) add('adds', id);
  if (fragment.on_remove) add('on_remove', fragment.on_remove);
  return claims;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortKeys(v)])
    );
  }
  return value;
}

/** The facts that the text of a condition states according to the rules, and the text the rules did not use. */
function statedBy(condition: Condition): { claims: Set<string>; rest: string } {
  let text = normalize(condition);
  for (const phrase of UNSTRUCTURED[condition.index] ?? []) text = text.replace(phrase, ' ');
  const claims = new Set<string>();
  let rest = text;
  for (const { phrase, states } of RULES) {
    if (!phrase.test(text)) continue;
    claimsOf(states).forEach((claim) => claims.add(claim));
    rest = rest.replace(new RegExp(phrase.source, 'g'), ' ');
  }
  // Where the speed is reduced to 0, the line that halves it is superseded.
  const set = [...claims].some((claim) => claim.startsWith('speed {"op":"set"'));
  if (set) claims.delete('speed {"op":"halve"}');
  return { claims, rest };
}

function actualClaims(condition: Condition): Set<string> {
  const { effects: e, adds, on_remove } = condition;
  return claimsOf({
    effects: e,
    adds,
    on_remove: on_remove?.exhaustion_levels
      ? { exhaustion_levels: on_remove.exhaustion_levels }
      : undefined,
  });
}

describe('condition effects against the text', () => {
  const audited = conditions.filter((c) => !(c.index in NOT_AUDITED));

  it.each(audited.map((c) => c.index))('%s: the structure is what the text states', (index) => {
    const condition = row(index);
    const { claims } = statedBy(condition);
    const actual = actualClaims(condition);
    expect([...actual].sort(), `${index}: structure that the text does not state`).toEqual(
      [...claims].sort()
    );
  });

  it.each(audited.map((c) => c.index))(
    '%s: no mechanical wording is left out unaccounted',
    (index) => {
      const { rest } = statedBy(row(index));
      const left = rest.match(new RegExp(`[^.;]*${MECHANICAL.source}[^.;]*`, 'g')) ?? [];
      expect(left.map((s) => s.trim())).toEqual([]);
    }
  );

  it.each(Object.entries(UNSTRUCTURED))(
    '%s: every unstructured phrase is in the text',
    (index, phrases) => {
      const text = normalize(row(index));
      for (const phrase of phrases) expect(text, phrase).toContain(phrase);
    }
  );

  it('gives a reason for every condition the audit skips', () => {
    for (const [index, reason] of Object.entries(NOT_AUDITED)) {
      expect(reason.length).toBeGreaterThan(0);
      expect(row(index).effects.reason).toBeDefined();
    }
  });

  it('fails when the text mentions disadvantage on attack rolls and the effects lack it', () => {
    const poisoned = row('poisoned');
    const without: Condition = {
      ...poisoned,
      effects: { rolls: poisoned.effects.rolls!.filter((r) => r.roll !== 'attack') },
    };
    const { claims } = statedBy(without);
    const actual = actualClaims(without);
    expect([...claims].filter((claim) => !actual.has(claim))).toEqual([
      'rolls {"mode":"disadvantage","roll":"attack"}',
    ]);
  });

  it('fails when the effects state something the text does not', () => {
    const blinded = row('blinded');
    const extra: Condition = {
      ...blinded,
      effects: { ...blinded.effects, speed: { op: 'halve' } },
    };
    const { claims } = statedBy(extra);
    const actual = actualClaims(extra);
    expect([...actual].filter((claim) => !claims.has(claim))).toEqual(['speed {"op":"halve"}']);
  });

  it('fails when a mechanical sentence is neither stated nor listed', () => {
    const unlisted: Condition = {
      ...row('deafened'),
      desc: [...row('deafened').desc, '- The creature has resistance to thunder damage.'],
    };
    const { rest } = statedBy(unlisted);
    expect(MECHANICAL.test(rest)).toBe(true);
  });
});
