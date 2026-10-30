import { describe, expect, it } from 'vitest';
import MonsterData from '../en/5e-SRD-Monsters.json' with { type: 'json' };
import NormalizedMonsterData from '../5e-SRD-Monsters-Normalized.json' with { type: 'json' };
import DamageTypeData from '../en/5e-SRD-Damage-Types.json' with { type: 'json' };
import { deriveAbilityEffects, deriveDamageRule, deriveDamageRules } from '../derive-monster-effects';

type Entry = Record<string, any>;
type Ability = { name: string; desc: string } & Entry;
type Monster = { index: string } & Entry;

const english = MonsterData as unknown as Monster[];
const normalized = NormalizedMonsterData as unknown as Monster[];
const damageTypes = DamageTypeData.map((type) => type.index);

const SECTIONS = ['special_abilities', 'actions', 'legendary_actions', 'reactions'] as const;
const EFFECT_FIELDS = [
  'regeneration',
  'detach_after_damage',
  'reduction_dice',
  'reduce_max_hp',
  'damage_dice_at_half_hp',
  'resistances',
] as const;

const abilities = (monsters: Monster[]) =>
  monsters.flatMap((monster) =>
    SECTIONS.flatMap((section) =>
      ((monster[section] ?? []) as Ability[]).map((ability) => ({
        monster,
        section,
        ability,
        label: `${monster.index} / ${section} / ${ability.name}`,
        key: `${monster.index}:${section}:${ability.name}`,
      })),
    ),
  );

const withField = (field: string) => abilities(normalized).filter(({ ability }) => field in ability);
const keysOf = (items: { key: string }[]) => items.map(({ key }) => key);

describe('structured effects of traits and actions', () => {
  it('is on the abilities whose text states the mechanic, with the value the text states', () => {
    const regenerates = withField('regeneration');
    expect(keysOf(regenerates)).toEqual([
      'oni:special_abilities:Regeneration',
      'shield-guardian:special_abilities:Regeneration',
      'troll:special_abilities:Regeneration',
      'vampire-vampire:special_abilities:Regeneration',
      'vampire-bat:special_abilities:Regeneration',
      'vampire-mist:special_abilities:Regeneration',
      'vampire-spawn:special_abilities:Regeneration',
    ]);
    const hitPoints = Object.fromEntries(regenerates.map(({ monster, ability }) => [monster.index, ability.regeneration.hit_points]));
    expect(hitPoints).toEqual({
      oni: 10,
      'shield-guardian': 10,
      troll: 10,
      'vampire-vampire': 20,
      'vampire-bat': 20,
      'vampire-mist': 20,
      'vampire-spawn': 10,
    });

    expect(keysOf(withField('detach_after_damage'))).toEqual(['stirge:actions:Blood Drain']);
    expect(keysOf(withField('reduction_dice'))).toEqual([
      'death-dog:actions:Bite',
      'giant-rat-diseased:actions:Bite',
      'mummy:actions:Rotting Fist',
      'mummy-lord:actions:Rotting Fist',
      'night-hag:actions:Nightmare Haunting',
      'otyugh:actions:Bite',
    ]);
    expect(keysOf(withField('reduce_max_hp'))).toEqual([
      'clay-golem:actions:Slam',
      'specter:actions:Life Drain',
      'succubus-incubus:actions:Draining Kiss',
      'vampire-vampire:actions:Bite',
      'vampire-bat:actions:Bite',
      'vampire-spawn:actions:Bite',
      'wight:actions:Life Drain',
      'wraith:actions:Life Drain',
    ]);
    expect(keysOf(withField('resistances'))).toEqual(['nightmare:special_abilities:Confer Fire Resistance']);
    expect(withField('damage_dice_at_half_hp')).toHaveLength(10);
  });

  it('states Regeneration as the text does', () => {
    const regeneration = Object.fromEntries(withField('regeneration').map(({ monster, ability }) => [monster.index, ability.regeneration]));
    const vampire = {
      min_hit_points: 1,
      disabled_in: ['sunlight', 'running_water'],
      suppressed_by: { damage_types: ['radiant'], sources: ['holy_water'] },
    };

    expect(regeneration.troll).toEqual({
      hit_points: 10,
      suppressed_by: { damage_types: ['acid', 'fire'] },
      dies_only_without_regenerating: true,
    });
    expect(regeneration.oni).toEqual({ hit_points: 10, min_hit_points: 1 });
    expect(regeneration['shield-guardian']).toEqual({ hit_points: 10, min_hit_points: 1 });
    expect(regeneration['vampire-spawn']).toEqual({ hit_points: 10, ...vampire });
    for (const form of ['vampire-vampire', 'vampire-bat', 'vampire-mist']) {
      expect(regeneration[form], form).toEqual({ hit_points: 20, ...vampire });
    }
  });

  it('states the reductions of hit point maximum as the text does', () => {
    const by = (field: string) => Object.fromEntries(withField(field).map(({ key, ability }) => [key, ability[field]]));

    expect(by('reduction_dice')).toEqual({
      'death-dog:actions:Bite': { dice: '1d10', every_hours: 24, repeat_save: true, until: 'disease_cured' },
      'otyugh:actions:Bite': { dice: '1d10', every_hours: 24, repeat_save: true, until: 'disease_cured' },
      'giant-rat-diseased:actions:Bite': { dice: '1d6', every_hours: 24, until: 'disease_cured' },
      'mummy:actions:Rotting Fist': { dice: '3d6', every_hours: 24, until: 'remove_curse' },
      'mummy-lord:actions:Rotting Fist': { dice: '3d6', every_hours: 24, until: 'remove_curse' },
      'night-hag:actions:Nightmare Haunting': { dice: '1d10', until: 'greater_restoration' },
    });
    const necrotic = { by: 'damage_taken', damage_type: 'necrotic', until: 'long_rest' };
    expect(by('reduce_max_hp')).toEqual({
      'clay-golem:actions:Slam': { by: 'damage_taken', until: 'greater_restoration' },
      'specter:actions:Life Drain': { by: 'damage_taken', until: 'long_rest' },
      'succubus-incubus:actions:Draining Kiss': { by: 'damage_taken', until: 'long_rest' },
      'wight:actions:Life Drain': { by: 'damage_taken', until: 'long_rest' },
      'wraith:actions:Life Drain': { by: 'damage_taken', until: 'long_rest' },
      'vampire-vampire:actions:Bite': necrotic,
      'vampire-bat:actions:Bite': necrotic,
      'vampire-spawn:actions:Bite': necrotic,
    });
  });

  it('gives each effect the trigger that fits it', () => {
    const expectedTrigger = (ability: Entry) =>
      ability.regeneration || ability.detach_after_damage
        ? ['start_of_turn']
        : ability.damage_dice_at_half_hp
          ? ['half_hit_points_or_fewer']
          : ability.resistances
            ? ['while_ridden']
            : ability.reduction_dice
              ? [ability.reduction_dice.every_hours ? 'every_24_hours' : 'after_1_hour_of_visions']
              : ['on_hit', 'on_failed_save', 'on_damage'];

    let withTrigger = 0;
    for (const { ability, label } of abilities(normalized)) {
      const hasEffect = EFFECT_FIELDS.some((field) => field in ability);
      expect('trigger' in ability, label).toBe(hasEffect);
      if (!hasEffect) continue;
      withTrigger += 1;
      expect(expectedTrigger(ability), label).toContain(ability.trigger);
    }
    expect(withTrigger).toBe(7 + 10 + 1 + 6 + 8 + 1);

    const triggers = Object.fromEntries(withField('reduce_max_hp').map(({ key, ability }) => [key, ability.trigger]));
    expect(triggers).toEqual({
      'clay-golem:actions:Slam': 'on_failed_save',
      'specter:actions:Life Drain': 'on_failed_save',
      'wight:actions:Life Drain': 'on_failed_save',
      'wraith:actions:Life Drain': 'on_failed_save',
      'succubus-incubus:actions:Draining Kiss': 'on_damage',
      'vampire-vampire:actions:Bite': 'on_hit',
      'vampire-bat:actions:Bite': 'on_hit',
      'vampire-spawn:actions:Bite': 'on_hit',
    });
  });
});

// Each mechanic is found in the English text by a rule that shares no code with the derivation.
describe('audit: the text of an ability and its structure agree', () => {
  const all = abilities(normalized);

  it('has a regeneration exactly where the text says the monster regains hit points at the start of its turn', () => {
    for (const { ability, label } of all) {
      const text = /regains (\d+) hit points at the start of its turn/.exec(ability.desc);
      expect(ability.regeneration?.hit_points, label).toBe(text ? Number(text[1]) : undefined);
      if (!text) continue;

      const stops = /hit\.? points?\b[^.]*\bisn't in sunlight or running water/.test(ability.desc) || /isn't in sunlight or running water/.test(ability.desc);
      expect(ability.regeneration.disabled_in !== undefined, label).toBe(stops);
      expect(ability.regeneration.min_hit_points, label).toBe(/if it has at least 1 hit/.test(ability.desc) ? 1 : undefined);
      expect(ability.regeneration.dies_only_without_regenerating, label).toBe(/dies only if it starts its turn with 0 hit points and doesn't regenerate/.test(ability.desc) ? true : undefined);

      // The damage types of the sentence that stops the trait are the suppressing ones.
      const stopper = /If the [^.]*\bthis trait doesn't function[^.]*\./.exec(ability.desc)?.[0];
      const named = damageTypes.filter((type) => new RegExp(`\\b${type}\\b`).test(stopper ?? ''));
      expect(ability.regeneration.suppressed_by?.damage_types, label).toEqual(named.length ? named : undefined);
      expect(ability.regeneration.suppressed_by?.sources !== undefined, label).toBe(/holy water/.test(stopper ?? ''));
    }
  });

  it('has the reduced dice of a swarm exactly where the text gives them, and the full dice are the first damage entry', () => {
    for (const { ability, label } of all) {
      const text = /Hit: (\d+) \((\d+d\d+)\) (\w+) damage, or (\d+) \((\d+d\d+)\) \3 damage if the swarm has half of its hit points or fewer/.exec(ability.desc);
      expect(/half of its hit points or fewer/.test(ability.desc), label).toBe(ability.damage_dice_at_half_hp !== undefined);
      if (!text) continue;
      expect(ability.damage_dice_at_half_hp, label).toBe(text[5]);
      expect(ability.damage[0].damage_dice, label).toBe(text[2]);
      expect(ability.damage[0].damage_type, label).toBe(text[3]);
      // The average the text gives is the average of the dice.
      const average = (dice: string) => {
        const [count, sides] = dice.split('d').map(Number);
        return Math.floor((count * (sides + 1)) / 2);
      };
      expect(average(text[2]), label).toBe(Number(text[1]));
      expect(average(text[5]), label).toBe(Number(text[4]));
    }
  });

  it('has a reduction of hit point maximum exactly where the text states one', () => {
    const reductions = all.filter(({ ability }) => /hit point maximum/.test(ability.desc));
    const unstructured = reductions.filter(({ ability }) => !ability.reduce_max_hp && !ability.reduction_dice);
    // Every text that mentions the maximum and reduces it is structured, as one of the two forms and never both.
    expect(unstructured.map(({ key }) => key)).toEqual([]);
    expect(reductions).toHaveLength(14);
    for (const { ability, label } of reductions) {
      expect(Boolean(ability.reduce_max_hp) !== Boolean(ability.reduction_dice), label).toBe(true);

      const byDamage = /hit point maximum (?:is )?reduced by an amount equal to the (?:(\w+) )?damage taken/.exec(ability.desc);
      expect(ability.reduce_max_hp !== undefined, label).toBe(byDamage !== null);
      if (byDamage) expect(ability.reduce_max_hp.damage_type, label).toBe(byDamage[1]);

      const dice = /hit point maximum (?:by|is reduced by|decreases by) \d+ \((\d+d\d+)\)/.exec(ability.desc);
      expect(ability.reduction_dice?.dice, label).toBe(dice?.[1]);
      if (dice) {
        expect(ability.reduction_dice.every_hours, label).toBe(/24 hours/.test(ability.desc) ? 24 : undefined);
        expect(ability.reduction_dice.repeat_save, label).toBe(/must repeat the saving throw/.test(ability.desc) ? true : undefined);
      }

      const ends = [
        [/lasts until the (target|creature) finishes a long rest/, 'long_rest'],
        [/greater restoration/, 'greater_restoration'],
        [/disease is cured/, 'disease_cured'],
        [/remove curse/, 'remove_curse'],
      ] as const;
      const found = ends.filter(([pattern]) => pattern.test(ability.desc)).map(([, ending]) => ending);
      expect(found, label).toEqual([(ability.reduce_max_hp ?? ability.reduction_dice).until]);
    }
  });

  it('has a detach limit exactly where the text says the monster detaches after draining hit points', () => {
    for (const { ability, label } of all) {
      const text = /detach itself[^.]*\. It does so after it drains (\d+) hit points/.exec(ability.desc);
      expect(ability.detach_after_damage, label).toBe(text ? Number(text[1]) : undefined);
    }
  });

  it('has the resistance a trait grants exactly where the text grants one', () => {
    for (const { ability, label } of all) {
      const text = /grant resistance to (\w+) damage to anyone riding it/.exec(ability.desc);
      expect(ability.resistances, label).toEqual(text ? [{ types: [text[1]] }] : undefined);
    }
  });

  it('leaves the English data without the structured fields', () => {
    for (const { ability, label } of abilities(english)) {
      for (const field of ['trigger', ...EFFECT_FIELDS]) expect(field in ability, `${label}: ${field}`).toBe(false);
    }
    for (const monster of english) {
      for (const field of ['vulnerabilities', 'resistances', 'immunities']) expect(field in monster, `${monster.index}: ${field}`).toBe(false);
    }
  });
});

// Abilities whose text mentions a way hit points change, or damage that is resisted, and that are not structured.
// A new match that is in neither the structure nor this list fails the audit; a stale entry fails it too.
const EXCLUDED: { reason: string; abilities: string[] }[] = [
  {
    reason: 'A healing action: it restores a number of hit points when used, and is neither a recurring rule nor a reduction',
    abilities: [
      'deva:actions:Healing Touch',
      'planetar:actions:Healing Touch',
      'solar:actions:Healing Touch',
      'unicorn:actions:Healing Touch',
      'unicorn:legendary_actions:Heal Self (Costs 3 Actions)',
    ],
  },
  {
    reason: 'The monster regains hit points equal to damage it deals or to the hit points of a creature it kills',
    abilities: ['aboleth:legendary_actions:Psychic Drain (Costs 2 Actions)', 'will-o-wisp:special_abilities:Consume Life'],
  },
  {
    reason: 'Damage of one type heals the monster by the damage dealt, which is a conversion of damage and not a regeneration',
    abilities: [
      'clay-golem:special_abilities:Acid Absorption',
      'flesh-golem:special_abilities:Lightning Absorption',
      'iron-golem:special_abilities:Fire Absorption',
      'shambling-mound:special_abilities:Lightning Absorption',
    ],
  },
  {
    reason: 'The monster returns to life and regains all its hit points days after it dies',
    abilities: ['guardian-naga:special_abilities:Rejuvenation', 'spirit-naga:special_abilities:Rejuvenation'],
  },
  {
    reason: 'A rule that stops hit points being regained ("can\'t regain hit points"), which has no field',
    abilities: [
      'swarm-of-bats:special_abilities:Swarm',
      'swarm-of-beetles:special_abilities:Swarm',
      'swarm-of-centipedes:special_abilities:Swarm',
      'swarm-of-insects:special_abilities:Swarm',
      'swarm-of-poisonous-snakes:special_abilities:Swarm',
      'swarm-of-quippers:special_abilities:Swarm',
      'swarm-of-rats:special_abilities:Swarm',
      'swarm-of-ravens:special_abilities:Swarm',
      'swarm-of-spiders:special_abilities:Swarm',
      'swarm-of-wasps:special_abilities:Swarm',
      'bearded-devil:actions:Beard',
      'pit-fiend:actions:Bite',
      'aboleth:actions:Tentacle',
      'mummy-lord:legendary_actions:Channel Negative Energy (Costs 2 Actions)',
    ],
  },
  {
    reason: 'A vampire at 0 hit points turns to mist and later regains 1 hit point, a sequence of states and not a rule of a turn',
    abilities: [
      'vampire-vampire:special_abilities:Misty Escape',
      'vampire-bat:special_abilities:Misty Escape',
      'vampire-mist:special_abilities:Misty Escape',
    ],
  },
  {
    reason: 'Heads die at 25 damage in a turn and regrow at the end of the next, with 10 hit points for each head: it needs the count of heads',
    abilities: ['hydra:special_abilities:Multiple Heads'],
  },
  {
    reason: 'An infernal wound that costs hit points at the start of each turn and grows with each hit, with its own stanching check',
    abilities: ['bearded-devil:actions:Glaive', 'horned-devil:actions:Tail'],
  },
  {
    reason: 'A threshold of hit points that starts a behavior (going berserk, splitting, the Slaying Longbow\'s 100 hit points)',
    abilities: [
      'clay-golem:special_abilities:Berserk',
      'flesh-golem:special_abilities:Berserk',
      'black-pudding:reactions:Split',
      'ochre-jelly:reactions:Split',
      'solar:actions:Slaying Longbow',
    ],
  },
  {
    reason: 'The monster is reduced to 1 hit point instead of 0 (Relentless has relentless_max_damage; Undead Fortitude has a save)',
    abilities: [
      'boar:special_abilities:Relentless',
      'giant-boar:special_abilities:Relentless',
      'wereboar-boar:special_abilities:Relentless',
      'wereboar-human:special_abilities:Relentless',
      'wereboar-hybrid:special_abilities:Relentless',
      'zombie:special_abilities:Undead Fortitude',
      'ogre-zombie:special_abilities:Undead Fortitude',
    ],
  },
  {
    reason: 'The monster detaches by choice or by a check, with no limit on the damage it deals',
    abilities: ['cloaker:actions:Bite', 'darkmantle:actions:Crush'],
  },
  {
    reason: 'Resistance, immunity or vulnerability of an object the ability makes or animates, not of the monster',
    abilities: [
      'chain-devil:actions:Animate Chains',
      'ettercap:actions:Web',
      'giant-spider:actions:Web',
      'ice-devil:actions:Wall of Ice',
      'roper:special_abilities:Grasping Tendrils',
    ],
  },
  {
    reason: 'Immunity to all damage for the length of a form, with immunities to conditions: a state of the monster and not a damage rule',
    abilities: ['mummy-lord:legendary_actions:Whirlwind of Sand (Costs 2 Actions)'],
  },
];

// Structured records that also state a mechanic the vocabulary does not have.
const PARTLY_STRUCTURED = [
  { key: 'vampire-vampire:actions:Bite', mentions: /the vampire regains hit points equal to that amount/ },
  { key: 'vampire-bat:actions:Bite', mentions: /the vampire regains hit points equal to that amount/ },
  { key: 'vampire-spawn:actions:Bite', mentions: /the vampire regains hit points equal to that amount/ },
  { key: 'mummy:actions:Rotting Fist', mentions: /can't regain hit points/ },
  { key: 'mummy-lord:actions:Rotting Fist', mentions: /can't regain hit points/ },
  { key: 'giant-rat-diseased:actions:Bite', mentions: /can't regain hit points except by magical means/ },
];

const MECHANICS = [
  /\bregains?\b[^.]*?\bhit points?\b|can't regain hit points|gain temporary hit points/,
  /\bloses? \d+(?: \([^)]*\))? hit points/,
  /hit points or fewer|half (?:of )?(?:its|the original \w+'s) hit points|at least 10 hit points|hit points equal to half/,
  /(?:reduced|drops) to 1 hit point/,
  /hit point maximum/,
  /\bdetach/,
  /\b(?:resistance|immunity|vulnerability) to\b[^.]*?\bdamage|immune to all damage|vulnerable to \w+ damage|immunity to \w+(?:, | and )/,
];

describe('audit: abilities whose text mentions a mechanic the structure lacks', () => {
  const all = abilities(normalized);
  const excluded = new Map(EXCLUDED.flatMap(({ reason, abilities: keys }) => keys.map((key) => [key, reason] as const)));

  it('has no unstructured ability that mentions a mechanic, apart from the excluded ones', () => {
    const missing = all
      .filter(({ ability }) => MECHANICS.some((pattern) => pattern.test(ability.desc)))
      .filter(({ ability }) => !EFFECT_FIELDS.some((field) => field in ability))
      .filter(({ key }) => !excluded.has(key))
      .map(({ key }) => key);

    expect(missing).toEqual([]);
  });

  it('lists only abilities that exist, mention a mechanic, and are not structured', () => {
    expect(excluded.size).toBe(EXCLUDED.flatMap(({ abilities: keys }) => keys).length);
    for (const key of excluded.keys()) {
      const found = all.find((item) => item.key === key);
      expect(found, key).toBeDefined();
      expect(MECHANICS.some((pattern) => pattern.test(found!.ability.desc)), key).toBe(true);
      expect(EFFECT_FIELDS.some((field) => field in found!.ability), key).toBe(false);
    }
    expect(excluded.size).toBe(53);
  });

  it('lists the structured abilities that also state a mechanic with no field', () => {
    for (const { key, mentions } of PARTLY_STRUCTURED) {
      const found = all.find((item) => item.key === key);
      expect(found, key).toBeDefined();
      expect(mentions.test(found!.ability.desc), key).toBe(true);
      expect(EFFECT_FIELDS.some((field) => field in found!.ability), key).toBe(true);
    }
    // Every other structured ability that mentions hit points regained says so in the field that structures it.
    const regainsHitPoints = all
      .filter(({ ability }) => /can't regain hit points|regains hit points equal/.test(ability.desc))
      .filter(({ ability }) => EFFECT_FIELDS.some((field) => field in ability))
      .map(({ key }) => key);
    expect(regainsHitPoints.sort()).toEqual(PARTLY_STRUCTURED.map(({ key }) => key).sort());
  });
});

describe('derivation of ability effects', () => {
  it('reads each phrasing', () => {
    expect(
      deriveAbilityEffects({
        name: 'Regeneration',
        desc: 'The troll regains 10 hit points at the start of its turn. If the troll takes acid or fire damage, this trait doesn\'t function at the start of the troll\'s next turn. The troll dies only if it starts its turn with 0 hit points and doesn\'t regenerate.',
      }),
    ).toEqual({
      trigger: 'start_of_turn',
      regeneration: { hit_points: 10, suppressed_by: { damage_types: ['acid', 'fire'] }, dies_only_without_regenerating: true },
    });
    expect(deriveAbilityEffects({ name: 'Regeneration', desc: 'The shield guardian regains 10 hit points at the start of its turn if it has at least 1 hit. point.' })).toEqual({
      trigger: 'start_of_turn',
      regeneration: { hit_points: 10, min_hit_points: 1 },
    });
    expect(
      deriveAbilityEffects({
        name: 'Bites',
        desc: 'Melee Weapon Attack: +3 to hit, reach 0 ft., one target in the swarm\'s space. Hit: 10 (4d4) piercing damage, or 5 (2d4) piercing damage if the swarm has half of its hit points or fewer.',
      }),
    ).toEqual({ trigger: 'half_hit_points_or_fewer', damage_dice_at_half_hp: '2d4' });
    expect(deriveAbilityEffects({ name: 'Life Drain', desc: 'Hit: 5 (1d6 + 2) necrotic damage. The target must succeed on a DC 13 Constitution saving throw or its hit point maximum is reduced by an amount equal to the damage taken. This reduction lasts until the target finishes a long rest.' })).toEqual({
      trigger: 'on_failed_save',
      reduce_max_hp: { by: 'damage_taken', until: 'long_rest' },
    });
  });

  it('returns nothing for a text without a mechanic', () => {
    expect(deriveAbilityEffects({ name: 'Keen Smell', desc: 'The wolf has advantage on Wisdom (Perception) checks that rely on smell.' })).toBeUndefined();
    expect(deriveAbilityEffects({ name: 'Bite', desc: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4 + 2) piercing damage.' })).toBeUndefined();
  });

  it('throws on a text that starts a phrasing and does not finish it', () => {
    expect(() => deriveAbilityEffects({ name: 'Rot', desc: 'The target\'s hit point maximum decreases by 4 (1d6) every week.' })).toThrow('Unreadable reduction');
    expect(() => deriveAbilityEffects({ name: 'Bites', desc: 'Hit: 10 (4d4) piercing damage, or 5 (2d4) slashing damage if the swarm has half of its hit points or fewer.' })).toThrow('Unreadable damage at half hit points');
    expect(() => deriveAbilityEffects({ name: 'Regeneration', desc: 'The troll regains 10 hit points at the start of its turn. If the troll takes acid or fire damage, this trait doesn\'t function at the start of the troll\'s next turn, or ever.' })).toThrow('Unreadable suppression');
    expect(() => deriveAbilityEffects({ name: 'Regeneration', desc: 'The troll regains 10 hit points at the start of its turn. If the troll takes sonic damage, this trait doesn\'t function at the start of the troll\'s next turn.' })).toThrow('Unknown damage type');
  });
});

describe('structured damage resistances, immunities and vulnerabilities', () => {
  const relations = [
    ['damage_vulnerabilities', 'vulnerabilities'],
    ['damage_resistances', 'resistances'],
    ['damage_immunities', 'immunities'],
  ] as const;
  // The entries whose condition has no word in the vocabulary: left in the string list only.
  const UNSTRUCTURED = [
    'archmage: bludgeoning, piercing, and slashing from nonmagical attacks (from stoneskin)',
    'rakshasa: piercing from magic weapons wielded by good creatures',
  ];

  // The rule an entry should become, written out without the derivation: a plain type, or the types of a weapon
  // condition with the qualities that get past it.
  function expectedRule(entry: string): { types: string[]; unless?: string[]; only_from?: string } | 'plain' | undefined {
    if (damageTypes.includes(entry)) return 'plain';
    if (entry === 'damage from spells') return { types: ['all'], only_from: 'spells' };
    const weapons = /^(.+) from nonmagical weapons( that aren't (silvered|adamantine))?$/.exec(entry);
    if (!weapons) return undefined;
    return {
      types: weapons[1].replace(', and ', ', ').replace(' and ', ', ').split(', '),
      unless: weapons[3] ? ['magical', weapons[3]] : ['magical'],
    };
  }

  it('restates every entry of the three lists as a rule, in the order of the list', () => {
    let rules = 0;
    for (const monster of normalized) {
      for (const [list, field] of relations) {
        const strings: string[] = monster[list];
        const found: Entry[] = monster[field] ?? [];
        rules += found.length;

        const plain = strings.filter((entry) => expectedRule(entry) === 'plain');
        const conditional = strings.flatMap((entry) => {
          const rule = expectedRule(entry);
          return rule && rule !== 'plain' ? [rule] : [];
        });
        const expected = [...(plain.length ? [{ types: plain }] : []), ...conditional];
        expect(found, `${monster.index}: ${field}`).toEqual(expected.length ? expected : []);
        if (!found.length) expect(field in monster, `${monster.index}: ${field}`).toBe(false);

        const left = strings.filter((entry) => expectedRule(entry) === undefined).map((entry) => `${monster.index}: ${entry}`);
        for (const entry of left) expect(UNSTRUCTURED, entry).toContain(entry);
      }
    }
    // 14 monsters with a vulnerability, 70 with a resistance and 136 with an immunity.
    expect(['vulnerabilities', 'resistances', 'immunities'].map((field) => normalized.filter((m) => field in m).length)).toEqual([14, 70, 136]);
    // 14 vulnerability rules, 102 resistance rules (43 of them for nonmagical weapons) and 146 immunity rules.
    expect(rules).toBe(14 + 102 + 146);
  });

  it('keeps the entries it has no word for out of the rules', () => {
    const left = normalized.flatMap((monster) =>
      relations.flatMap(([list]) => (monster[list] as string[]).filter((entry) => expectedRule(entry) === undefined).map((entry) => `${monster.index}: ${entry}`)),
    );

    expect(left.sort()).toEqual([...UNSTRUCTURED].sort());
  });

  it('writes nonmagical weapon resistance as types and the qualities that get past it', () => {
    const rule = (index: string, field: string) => normalized.find((m) => m.index === index)![field];

    expect(rule('rakshasa', 'immunities')).toEqual([{ types: ['bludgeoning', 'piercing', 'slashing'], unless: ['magical'] }]);
    expect(rule('barbed-devil', 'resistances')).toContainEqual({ types: ['bludgeoning', 'piercing', 'slashing'], unless: ['magical', 'silvered'] });
    expect(rule('werebear-bear', 'immunities')).toEqual([{ types: ['bludgeoning', 'piercing', 'slashing'], unless: ['magical', 'silvered'] }]);
    expect(rule('iron-golem', 'immunities')).toContainEqual({ types: ['bludgeoning', 'piercing', 'slashing'], unless: ['magical', 'adamantine'] });
    expect(rule('xorn', 'resistances')).toEqual([{ types: ['piercing', 'slashing'], unless: ['magical', 'adamantine'] }]);
    expect(rule('gargoyle', 'resistances')).toEqual([{ types: ['bludgeoning', 'piercing', 'slashing'], unless: ['magical', 'adamantine'] }]);
    expect(rule('archmage', 'resistances')).toEqual([{ types: ['all'], only_from: 'spells' }]);
    expect(rule('skeleton', 'vulnerabilities')).toEqual([{ types: ['bludgeoning'] }]);
    expect(rule('lich', 'immunities')).toEqual([
      { types: ['poison'] },
      { types: ['bludgeoning', 'piercing', 'slashing'], unless: ['magical'] },
    ]);
  });

  it('reads the entries and rejects one it does not know', () => {
    expect(deriveDamageRule('fire')).toEqual({ types: ['fire'] });
    expect(deriveDamageRule('piercing and slashing from nonmagical weapons that aren\'t adamantine')).toEqual({
      types: ['piercing', 'slashing'],
      unless: ['magical', 'adamantine'],
    });
    expect(deriveDamageRule('piercing from magic weapons wielded by good creatures')).toBeUndefined();
    expect(deriveDamageRules(['cold', 'bludgeoning, piercing, and slashing from nonmagical weapons', 'fire'])).toEqual([
      { types: ['cold', 'fire'] },
      { types: ['bludgeoning', 'piercing', 'slashing'], unless: ['magical'] },
    ]);
    expect(deriveDamageRules([])).toBeUndefined();
    expect(() => deriveDamageRule('fire from cold iron')).toThrow('Unreadable damage rule');
    expect(() => deriveDamageRule('sonic')).toThrow('Unreadable damage rule');
  });
});
