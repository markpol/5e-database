import { describe, expect, it } from 'vitest';
import SpellData from '../en/5e-SRD-Spells.json' with { type: 'json' };
import { deriveSpellMechanics } from '../derive-spell-mechanics';

type DiceAmount = { dice: string; bonus?: number; add_spellcasting_mod?: boolean };
type Damage = {
  damage_type?: { index: string };
  damage_at_slot_level?: Record<string, string>;
  damage_at_slot_level_data?: Record<string, DiceAmount>;
  damage_at_character_level?: Record<string, string>;
};
type Spell = {
  index: string;
  level: number;
  desc: string[];
  higher_level?: string[];
  attack_type?: string;
  damage?: Damage[];
  dc?: { dc_type: { index: string }; dc_success: string };
  area_of_effect?: { type: string; size: number };
  heal_at_slot_level?: Record<string, string>;
  heal_at_slot_level_data?: Record<string, DiceAmount>;
  temp_hp_at_slot_level?: Record<string, DiceAmount>;
  targets_at_slot_level?: Record<string, number>;
};

const spells = SpellData as unknown as Spell[];
const spell = (index: string) => spells.find((s) => s.index === index)!;
const text = (s: Spell) => s.desc.join(' ');
const higher = (s: Spell) => (s.higher_level ?? []).join(' ');

const TYPES =
  '(?:acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)';
const ORDINAL: Record<string, number> = {
  '1st': 1,
  '2nd': 2,
  '3rd': 3,
  '4th': 4,
  '5th': 5,
  '6th': 6,
  '7th': 7,
  '8th': 8,
  '9th': 9,
  fifth: 5,
};
const ABILITY: Record<string, string> = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
};

// Each check below states a rule in the words of the SRD and compares it with the structure. They share no code with
// the derivation, so a text and a structure that disagree fail here whichever of the two was edited. The tables of
// deliberate gaps are written out again here, so a gap that appears or closes is noticed.

// --- damage --------------------------------------------------------------------------------------------------------

// A damage type in the text that the spell has no `damage` entry for, on purpose.
const DAMAGE_LEFT_OUT: Record<string, string[]> = {
  'alter-self': ['bludgeoning', 'piercing', 'slashing'],
  'arcane-hand': ['force', 'bludgeoning'],
  'bestow-curse': ['necrotic'],
  'contact-other-plane': ['psychic'],
  earthquake: ['bludgeoning'],
  geas: ['psychic'],
  'meld-into-stone': ['bludgeoning'],
  'prismatic-spray': ['fire', 'acid', 'lightning', 'poison', 'cold'],
  'prismatic-wall': ['fire', 'acid', 'lightning', 'poison', 'cold'],
  'storm-of-vengeance': ['acid', 'lightning', 'bludgeoning', 'cold'],
  teleport: ['force'],
  web: ['fire'],
  wish: ['necrotic'],
};

// A dice amount in the text that is not the entry's value at the spell's own level, on purpose.
const DAMAGE_DICE_LEFT_OUT: Record<string, string[]> = {
  'acid-arrow': ['2d4'],
  'magic-missile': ['1d4 + 1'],
  'wall-of-ice': ['5d6'],
};

function damageInText(s: Spell): { type?: string; dice: string }[] {
  const out: { type?: string; dice: string }[] = [];
  const typed = new RegExp(
    `(\\d+d\\d+(?: \\+ \\d+)?) (${TYPES}(?:(?:, | or |, or )${TYPES})*) damage`,
    'g'
  );
  for (const m of text(s).matchAll(typed)) {
    for (const type of m[2].split(/, or |, | or /)) out.push({ type, dice: m[1] });
  }
  const modifier = new RegExp(
    `(${TYPES}) damage equal to (\\d+d\\d+) \\+ your spellcasting ability modifier`,
    'g'
  );
  for (const m of text(s).matchAll(modifier)) out.push({ type: m[1], dice: `${m[2]} + MOD` });
  for (const m of text(s).matchAll(/extra (\d+d\d+) damage/g)) out.push({ dice: m[1] });
  return out;
}

function auditDamage(s: Spell): string | undefined {
  const entries = s.damage ?? [];
  for (const { type, dice } of damageInText(s)) {
    const entry = entries.find((e) => e.damage_type?.index === type);
    if (!entry) {
      if (type && DAMAGE_LEFT_OUT[s.index]?.includes(type)) continue;
      return `${type ?? 'untyped'} damage ${dice} has no damage entry`;
    }
    const values = Object.values(
      entry.damage_at_slot_level ?? entry.damage_at_character_level ?? {}
    );
    if (!values.includes(dice) && !DAMAGE_DICE_LEFT_OUT[s.index]?.includes(dice))
      return `${type} damage ${dice} is not a value of ${JSON.stringify(values)}`;
  }
  const named = new Set(damageInText(s).map((d) => d.type));
  for (const entry of entries) {
    const type = entry.damage_type?.index;
    if (type && !named.has(type) && !new RegExp(`${type} damage`).test(text(s)))
      return `damage entry ${type} is not in the text`;
  }
  return undefined;
}

// "the damage increases by 1d8 for each slot level above 3rd" (or "for every two slot levels"): each level of the
// map is the level above the first, plus that many steps.
function auditScaling(s: Spell, kind: 'damage' | 'healing'): string | undefined {
  const clause = new RegExp(
    `the (?:extra |base )?${kind}(?: [a-z ]*?)? increases? by (\\d+)d(\\d+) for (each|every two) slot levels? above (?:the )?(\\w+)`
  ).exec(higher(s));
  if (!clause || new RegExp(TYPES).test(higher(s))) return undefined;
  const [, count, sides, rate, above] = clause;
  if (ORDINAL[above] !== s.level)
    return `${kind} scales above ${above}, not above level ${s.level}`;
  const maps =
    kind === 'damage'
      ? (s.damage ?? []).map((d) => d.damage_at_slot_level)
      : [s.heal_at_slot_level];
  for (const map of maps) {
    if (!map) continue;
    const parse = (v: string) => /^(\d+)d(\d+)( \+ MOD)?$/.exec(v);
    const base = parse(map[String(s.level)] ?? '');
    if (!base) continue;
    const [, baseCount, , mod] = base;
    for (const [slot, value] of Object.entries(map)) {
      const steps = Math.floor((Number(slot) - s.level) / (rate === 'each' ? 1 : 2));
      const expected = `${Number(baseCount) + Number(count) * steps}d${sides}${mod ?? ''}`;
      if (value !== expected) return `${kind} at slot ${slot} is ${value}, expected ${expected}`;
    }
  }
  return undefined;
}

// --- dice as data --------------------------------------------------------------------------------------------------

function structureOf(value: string): DiceAmount | undefined {
  const m = /^(\d+d\d+)(?: \+ (MOD|\d+))?$/.exec(value);
  if (!m) return undefined;
  if (m[2] === 'MOD') return { dice: m[1], add_spellcasting_mod: true };
  return m[2] ? { dice: m[1], bonus: Number(m[2]) } : { dice: m[1] };
}

function auditDiceData(
  strings: Record<string, string> | undefined,
  data: Record<string, DiceAmount> | undefined
): string | undefined {
  const parsed = Object.entries(strings ?? {}).map(([slot, v]) => [slot, structureOf(v)] as const);
  if (parsed.some(([, amount]) => !amount))
    return data ? 'has dice data for a map that is not all dice' : undefined;
  if (!strings) return data ? 'has dice data without strings' : undefined;
  return JSON.stringify(data) === JSON.stringify(Object.fromEntries(parsed))
    ? undefined
    : `dice data ${JSON.stringify(data)} does not agree with ${JSON.stringify(strings)}`;
}

// --- saving throw --------------------------------------------------------------------------------------------------

const FORCED = new RegExp(
  `must (?:first )?(?:succeed on|make) an? (${Object.keys(ABILITY).join('|')}) saving throw`,
  'gi'
);
const forcedAbilities = (s: Spell) => [
  ...new Set([...text(s).matchAll(FORCED)].map((m) => ABILITY[m[1].toLowerCase()])),
];

const DC_LEFT_OUT = ['detect-thoughts', 'forcecage'];

// A dc whose success is `other` although the text gives half damage: the half applies to some of the rays only.
const DC_SUCCESS_LEFT_OUT = ['prismatic-spray'];

function auditDc(s: Spell): string | undefined {
  const abilities = forcedAbilities(s);
  if (abilities.length === 1 && !DC_LEFT_OUT.includes(s.index)) {
    if (s.dc?.dc_type.index !== abilities[0])
      return `forced ${abilities[0]} saving throw is dc ${s.dc?.dc_type.index}`;
    const half = /half (?:as much )?damage/.test(text(s));
    if (!DC_SUCCESS_LEFT_OUT.includes(s.index) && half !== (s.dc.dc_success === 'half'))
      return `dc_success ${s.dc.dc_success} with half damage ${half}`;
  }
  if (abilities.length === 1 && DC_LEFT_OUT.includes(s.index) && s.dc)
    return 'dc present, listed as left out';
  return undefined;
}

// --- area ----------------------------------------------------------------------------------------------------------

function areasInText(s: Spell): string[] {
  const shapes: [string, RegExp][] = [
    ['sphere', /(\d+)-foot[- ]radius sphere/g],
    ['cube', /(\d+)-foot[- ]cube/g],
    ['cube', /(\d+)-foot square/g],
    ['cone', /(\d+)-foot cone/g],
    ['cylinder', /(\d+)-foot[- ]radius,? \d+-foot[- ]high cylinder/g],
  ];
  const found = shapes.flatMap(([type, pattern]) =>
    [...text(s).matchAll(pattern)].map((m) => `${type}${m[1]}`)
  );
  return [...new Set(found)];
}

// A "N-foot <shape>" in the text that the area does not show, on purpose: the shape is not the spell's area.
const AREA_LEFT_OUT = ['fire-storm', 'symbol'];

// A spell with one "N-foot <shape>" that is not about fighting and has no area, which this change leaves alone.
const AREA_OUT_OF_SCOPE = ['druidcraft', 'major-image', 'minor-illusion', 'purify-food-and-drink'];

const fights = (s: Spell) => Boolean(s.damage || s.dc || s.attack_type || s.heal_at_slot_level);

function auditArea(s: Spell): string | undefined {
  const [only, ...more] = areasInText(s);
  if (!only || more.length || AREA_LEFT_OUT.includes(s.index)) return undefined;
  const have = s.area_of_effect ? `${s.area_of_effect.type}${s.area_of_effect.size}` : undefined;
  if (!have && !fights(s)) return undefined;
  return have === only ? undefined : `area ${only} in the text, area_of_effect ${have}`;
}

// --- targets and temporary hit points ------------------------------------------------------------------------------

// The number of targets, darts, rays or bolts each of these spells states at its own level, and that it grows by one
// for each slot level above it.
const TARGETS: Record<string, number> = {
  bane: 3,
  banishment: 1,
  bless: 3,
  'blindness-deafness': 1,
  'chain-lightning': 4,
  'charm-person': 1,
  command: 1,
  'enhance-ability': 1,
  fly: 1,
  'hold-monster': 1,
  'hold-person': 1,
  invisibility: 1,
  longstrider: 1,
  'magic-missile': 3,
  'scorching-ray': 3,
};

// The higher_level text scales a number of things, but not the targets of the spell in a way this change reads.
const TARGETS_LEFT_OUT = [
  'animate-dead',
  'animate-objects',
  'conjure-animals',
  'conjure-minor-elementals',
  'conjure-woodland-beings',
  'etherealness',
];

const scalesTargets = (s: Spell) =>
  /(?:target|affect) (?:one|an) additional (?:creature|humanoid) for each|creates? one (?:more|additional) (?:dart|ray) for each|one additional bolt leaps/.test(
    higher(s)
  );

function auditTargets(s: Spell): string | undefined {
  const base = TARGETS[s.index];
  if (scalesTargets(s) !== (base !== undefined))
    return `higher_level scales targets: ${scalesTargets(s)}`;
  if (base === undefined)
    return s.targets_at_slot_level ? 'has targets without a scaling text' : undefined;
  const expected = Object.fromEntries(
    Array.from({ length: 10 - s.level }, (_, i) => [String(s.level + i), base + i])
  );
  return JSON.stringify(s.targets_at_slot_level) === JSON.stringify(expected)
    ? undefined
    : `targets ${JSON.stringify(s.targets_at_slot_level)}, expected ${JSON.stringify(expected)}`;
}

function auditTempHp(s: Spell): string | undefined {
  const scales = /additional temporary hit points for each slot level/.test(higher(s));
  if (!scales)
    return s.temp_hp_at_slot_level ? 'has temporary hit points without a scaling text' : undefined;
  // False Life: 1d4 + 4 temporary hit points, 5 more for each slot level above 1st. The map in heal_at_slot_level
  // states the same amounts as strings.
  const expected = Object.fromEntries(
    Array.from({ length: 10 - s.level }, (_, i) => [
      String(s.level + i),
      { dice: '1d4', bonus: 4 + 5 * i },
    ])
  );
  const strings = Object.fromEntries(
    Object.entries(expected).map(([slot, amount]) => [slot, `${amount.dice} + ${amount.bonus}`])
  );
  if (JSON.stringify(s.temp_hp_at_slot_level) !== JSON.stringify(expected))
    return 'temp_hp_at_slot_level is wrong';
  return JSON.stringify(s.heal_at_slot_level) === JSON.stringify(strings)
    ? undefined
    : 'temp_hp_at_slot_level disagrees with heal_at_slot_level';
}

const failures = (audit: (s: Spell) => string | undefined, list: Spell[] = spells) =>
  list.flatMap((s) => {
    const problem = audit(s);
    return problem ? [`${s.index}: ${problem}`] : [];
  });

describe('spell damage', () => {
  it('has a damage entry for every damage type and dice amount in the text', () => {
    expect(failures(auditDamage)).toEqual([]);
  });

  it('leaves out only the damage listed as left out', () => {
    for (const [index, types] of Object.entries(DAMAGE_LEFT_OUT)) {
      const present = new Set((spell(index).damage ?? []).map((d) => d.damage_type?.index));
      expect(
        types.filter((t) => present.has(t)),
        index
      ).toEqual([]);
      expect(
        damageInText(spell(index)).some((d) => types.includes(d.type!)),
        index
      ).toBe(true);
    }
  });

  it('scales the damage as the higher_level text says', () => {
    expect(failures((s) => auditScaling(s, 'damage'))).toEqual([]);
  });

  it('has the damage of Spirit Guardians', () => {
    const damage = spell('spirit-guardians').damage!;
    expect(damage.map((d) => d.damage_type!.index)).toEqual(['radiant', 'necrotic']);
    for (const entry of damage) {
      expect(entry.damage_at_slot_level).toEqual({
        '3': '3d8',
        '4': '4d8',
        '5': '5d8',
        '6': '6d8',
        '7': '7d8',
        '8': '8d8',
        '9': '9d8',
      });
    }
    expect(spell('spirit-guardians').dc!.dc_type.index).toBe('wis');
    expect(spell('spirit-guardians').dc!.dc_success).toBe('half');
    expect(spell('spirit-guardians').area_of_effect).toEqual({ type: 'sphere', size: 15 });
  });

  it('has the second damage type of Wall of Thorns and the untyped damage of Hunter’s Mark', () => {
    const thorns = spell('wall-of-thorns').damage!;
    expect(thorns.map((d) => d.damage_type!.index)).toEqual(['piercing', 'slashing']);
    expect(thorns[1].damage_at_slot_level).toEqual(thorns[0].damage_at_slot_level);
    expect(spell('hunters-mark').damage).toEqual([
      { damage_at_slot_level: { '1': '1d6' }, damage_at_slot_level_data: { '1': { dice: '1d6' } } },
    ]);
  });
});

describe('spell saving throw and area', () => {
  it('has a dc for the saving throw the text forces, and it agrees with the text', () => {
    expect(failures(auditDc)).toEqual([]);
  });

  it('has the area of effect the text states', () => {
    expect(failures(auditArea)).toEqual([]);
  });

  it('leaves alone the spells with one shape that are not about fighting', () => {
    for (const index of AREA_OUT_OF_SCOPE) {
      expect(areasInText(spell(index)), index).toHaveLength(1);
      expect(spell(index).area_of_effect, index).toBeUndefined();
      expect(fights(spell(index)), index).toBe(false);
    }
  });

  it('fixes the two areas the text contradicted', () => {
    expect(spell('flame-strike').area_of_effect).toEqual({ type: 'cylinder', size: 10 });
    expect(spell('move-earth').area_of_effect).toEqual({ type: 'cube', size: 40 });
  });
});

describe('spell dice as data', () => {
  it('has dice data for every damage map that is all dice, and for no other', () => {
    for (const s of spells) {
      for (const entry of s.damage ?? []) {
        expect(
          auditDiceData(entry.damage_at_slot_level, entry.damage_at_slot_level_data),
          s.index
        ).toBeUndefined();
      }
    }
  });

  it('has dice data for every healing map that is all dice, and for no other', () => {
    for (const s of spells) {
      const healing = !auditTempHp(s) && s.temp_hp_at_slot_level ? undefined : s.heal_at_slot_level;
      expect(auditDiceData(healing, s.heal_at_slot_level_data), s.index).toBeUndefined();
    }
  });

  it('scales the healing as the higher_level text says', () => {
    expect(failures((s) => auditScaling(s, 'healing'))).toEqual([]);
  });

  it('writes the spellcasting modifier as a flag, not as text', () => {
    expect(spell('cure-wounds').heal_at_slot_level_data!['1']).toEqual({
      dice: '1d8',
      add_spellcasting_mod: true,
    });
    expect(spell('mass-healing-word').heal_at_slot_level_data!['3']).toEqual({
      dice: '1d4',
      add_spellcasting_mod: true,
    });
    expect(spell('spiritual-weapon').damage![0].damage_at_slot_level_data!['4']).toEqual({
      dice: '2d8',
      add_spellcasting_mod: true,
    });
    expect(spell('regenerate').heal_at_slot_level_data).toEqual({
      '7': { dice: '4d8', bonus: 15 },
    });
  });
});

describe('spell targets and temporary hit points per slot', () => {
  it('has targets_at_slot_level for exactly the spells that scale their targets', () => {
    expect(failures(auditTargets)).toEqual([]);
  });

  it('names the spells whose higher_level text scales something else than targets', () => {
    for (const index of TARGETS_LEFT_OUT) {
      expect(spell(index).targets_at_slot_level, index).toBeUndefined();
      expect(higher(spell(index)).length, index).toBeGreaterThan(0);
    }
  });

  it('has temp_hp_at_slot_level for exactly the spells that scale their temporary hit points', () => {
    expect(failures(auditTempHp)).toEqual([]);
  });
});

describe('spell combat fields', () => {
  it('counts the spells that have each field', () => {
    const count = (has: (s: Spell) => unknown) => spells.filter(has).length;
    expect({
      damage: count((s) => s.damage),
      dc: count((s) => s.dc),
      area_of_effect: count((s) => s.area_of_effect),
      heal_at_slot_level: count((s) => s.heal_at_slot_level),
      attack_type: count((s) => s.attack_type),
      heal_at_slot_level_data: count((s) => s.heal_at_slot_level_data),
      temp_hp_at_slot_level: count((s) => s.temp_hp_at_slot_level),
      targets_at_slot_level: count((s) => s.targets_at_slot_level),
      damage_at_slot_level_data: spells
        .flatMap((s) => s.damage ?? [])
        .filter((d) => d.damage_at_slot_level_data).length,
    }).toEqual({
      damage: 72,
      dc: 103,
      area_of_effect: 91,
      heal_at_slot_level: 10,
      attack_type: 16,
      heal_at_slot_level_data: 6,
      temp_hp_at_slot_level: 1,
      targets_at_slot_level: 15,
      damage_at_slot_level_data: 69,
    });
  });

  it('is what the derivation produces from the text', () => {
    const stripped = spells.map((s) => {
      const copy: Spell = structuredClone(s);
      delete copy.heal_at_slot_level_data;
      delete copy.temp_hp_at_slot_level;
      delete copy.targets_at_slot_level;
      for (const entry of copy.damage ?? []) delete entry.damage_at_slot_level_data;
      return copy;
    });
    expect(deriveSpellMechanics(stripped as never)).toEqual(spells);
  });

  it('adds the entries that were missing from the text', () => {
    const added: Record<string, (keyof Spell)[]> = {
      'spirit-guardians': ['damage', 'dc', 'area_of_effect'],
      'glyph-of-warding': ['damage', 'dc', 'area_of_effect'],
      'hunters-mark': ['damage'],
      'spike-growth': ['damage'],
      forbiddance: ['damage'],
      weird: ['damage'],
      'hypnotic-pattern': ['area_of_effect'],
      sanctuary: ['dc'],
      'call-lightning': ['dc'],
      'flaming-sphere': ['dc'],
      'power-word-stun': ['dc'],
      web: ['dc'],
      'zone-of-truth': ['dc'],
      'holy-aura': ['dc'],
      'antipathy-sympathy': ['dc'],
      'sleet-storm': ['dc'],
    };
    const stripped = spells.map((s) => {
      const copy: Spell = structuredClone(s);
      for (const key of added[s.index] ?? []) delete copy[key];
      return copy;
    });
    expect(deriveSpellMechanics(stripped as never)).toEqual(spells);
  });

  it('reports a text and a structure that disagree', () => {
    const bless = spell('bless');
    expect(auditTargets({ ...bless, targets_at_slot_level: { '1': 3, '2': 5 } })).toBeDefined();
    const fireball = spell('fireball');
    expect(auditDamage({ ...fireball, damage: [] })).toBe('fire damage 8d6 has no damage entry');
    expect(
      auditDamage({
        ...fireball,
        damage: [{ ...fireball.damage![0], damage_at_slot_level: { '3': '7d6' } }],
      })
    ).toBeDefined();
    expect(
      auditDc({ ...fireball, dc: { dc_type: { index: 'con' }, dc_success: 'half' } })
    ).toBeDefined();
    expect(
      auditDc({ ...fireball, dc: { dc_type: { index: 'dex' }, dc_success: 'none' } })
    ).toBeDefined();
    expect(auditArea({ ...fireball, area_of_effect: { type: 'sphere', size: 30 } })).toBe(
      'area sphere20 in the text, area_of_effect sphere30'
    );
    const cure = spell('cure-wounds');
    expect(auditDiceData(cure.heal_at_slot_level, { '1': { dice: '1d8' } })).toBeDefined();
    expect(
      auditScaling(
        { ...cure, heal_at_slot_level: { ...cure.heal_at_slot_level, '3': '9d8 + MOD' } },
        'healing'
      )
    ).toBeDefined();
    expect(auditTempHp({ ...spell('false-life'), temp_hp_at_slot_level: undefined })).toBeDefined();
  });
});
