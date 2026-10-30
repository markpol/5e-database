// Structured combat mechanics of a spell, read from the spell's own `desc` and `higher_level` text: the damage it
// deals, the saving throw it forces, the area it covers, the dice of its healing and damage, and how its number of
// targets and temporary hit points grow with the slot. The vocabulary is documented in docs/spell-mechanics.md and
// enforced by the Zod schema in schemas/5e-SRD-Spells.ts.
//
// The script only adds a field that is missing or fixes an area that the text contradicts. A text it cannot read
// with one clear meaning is left alone and named in the *_NOT_DERIVED tables below, each with its reason, so the
// audit test can tell a deliberate gap from a forgotten one.

export type DiceAmount = { dice: string; bonus?: number; add_spellcasting_mod?: boolean };
export type SpellDamage = {
  damage_type?: { index: string; name: string; url: string };
  damage_at_slot_level?: Record<string, string>;
  damage_at_slot_level_data?: Record<string, DiceAmount>;
  damage_at_character_level?: Record<string, string>;
};
export type AreaOfEffect = { type: 'sphere' | 'cube' | 'cylinder' | 'line' | 'cone'; size: number };
export type CombatSpell = {
  index: string;
  desc: string[];
  higher_level?: string[];
  level: number;
  damage?: SpellDamage[];
  dc?: { dc_type: { index: string; name: string; url: string }; dc_success: string };
  area_of_effect?: AreaOfEffect;
  heal_at_slot_level?: Record<string, string>;
  heal_at_slot_level_data?: Record<string, DiceAmount>;
  temp_hp_at_slot_level?: Record<string, DiceAmount>;
  targets_at_slot_level?: Record<string, number>;
} & Record<string, unknown>;

export const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
] as const;
const DAMAGE_TYPE_NAMES = Object.fromEntries(
  DAMAGE_TYPES.map((type) => [type, type[0].toUpperCase() + type.slice(1)])
);

const ABILITIES: Record<string, string> = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
};

const ORDINALS: Record<string, number> = {
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
const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

const text = (spell: CombatSpell) => spell.desc.join(' ');
const higherLevel = (spell: CombatSpell) => (spell.higher_level ?? []).join(' ');
const slotLevels = (from: number) => Array.from({ length: 10 - from }, (_, i) => from + i);

// ---------------------------------------------------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------------------------------------------------

// A spell whose damage is named in its text but whose `damage` is missing. Each is derived from the damage sentence:
// "NdM <type> damage", "NdM <type> or <type> damage", "NdM <type>, <type>, or <type> damage" or "extra NdM damage".
const DAMAGE_DERIVED = [
  'forbiddance',
  'glyph-of-warding',
  'hunters-mark',
  'spike-growth',
  'spirit-guardians',
  'wall-of-thorns',
  'weird',
];

// A damage sentence the text has, for which the spell has no `damage` entry on purpose. The reason is the
// ambiguity: the amount is not the spell's own effect, depends on a choice or a roll, or varies by round or by option.
export const DAMAGE_NOT_DERIVED: Record<string, { types: string[]; reason: string }> = {
  'alter-self': {
    types: ['bludgeoning', 'piercing', 'slashing'],
    reason: 'unarmed strikes of a chosen form, not damage the spell deals',
  },
  'arcane-hand': {
    types: ['force', 'bludgeoning'],
    reason: 'two options (clenched fist, grasping hand) that scale by different dice',
  },
  'bestow-curse': {
    types: ['necrotic'],
    reason: 'extra damage of one of four curses the caster chooses',
  },
  'contact-other-plane': {
    types: ['psychic'],
    reason: 'damage to the caster when the caster fails the spell’s own save',
  },
  earthquake: {
    types: ['bludgeoning'],
    reason: 'damage to structures, and to creatures only if a structure collapses',
  },
  geas: { types: ['psychic'], reason: 'damage only if the target disobeys, once a day' },
  'meld-into-stone': { types: ['bludgeoning'], reason: 'damage to the caster when expelled' },
  'prismatic-spray': {
    types: ['fire', 'acid', 'lightning', 'poison', 'cold'],
    reason: 'the type is chosen by a die roll for each ray',
  },
  'prismatic-wall': {
    types: ['fire', 'acid', 'lightning', 'poison', 'cold'],
    reason: 'five layers, each with its own save and effects',
  },
  'storm-of-vengeance': {
    types: ['acid', 'lightning', 'bludgeoning', 'cold'],
    reason: 'a different effect in each round of the storm',
  },
  teleport: { types: ['force'], reason: 'damage to the traveller on a mishap' },
  web: { types: ['fire'], reason: 'damage only if the webs are set alight' },
  wish: { types: ['necrotic'], reason: 'damage to the caster from the stress of casting' },
};

// A dice amount in the text that the spell's `damage` entry does not hold as its value at the spell's own level, on
// purpose.
export const DAMAGE_DICE_NOT_MATCHED: Record<string, { dice: string[]; reason: string }> = {
  'acid-arrow': { dice: ['2d4'], reason: 'the later damage at the end of the target’s next turn' },
  'magic-missile': {
    dice: ['1d4 + 1'],
    reason: 'the entry holds the total of the base number of darts, one dart deals this',
  },
  'wall-of-ice': {
    dice: ['5d6'],
    reason: 'the damage from passing through the sheet of frigid air',
  },
};

type TypedDamage = { types: string[]; dice: string };

// Every "NdM <types> damage" in a text, and the untyped "extra NdM damage".
export function readDamage(source: string): TypedDamage[] {
  const found: TypedDamage[] = [];
  const typed = new RegExp(
    `(\\d+d\\d+(?: \\+ \\d+)?) ((?:${DAMAGE_TYPES.join('|')})(?:(?:, | or |, or )(?:${DAMAGE_TYPES.join('|')}))*) damage`,
    'g'
  );
  for (const match of source.matchAll(typed)) {
    found.push({ dice: match[1], types: match[2].split(/, or |, | or /) });
  }
  const modifier = new RegExp(
    `(${DAMAGE_TYPES.join('|')}) damage equal to (\\d+d\\d+) \\+ your spellcasting ability modifier`,
    'g'
  );
  for (const match of source.matchAll(modifier)) {
    found.push({ dice: `${match[2]} + MOD`, types: [match[1]] });
  }
  for (const match of source.matchAll(/extra (\d+d\d+) damage/g)) {
    found.push({ dice: match[1], types: [] });
  }
  return found;
}

function addDice(base: string, step: string, times: number): string {
  const [, count, sides, rest] = /^(\d+)d(\d+)(.*)$/.exec(base) ?? [];
  const [, stepCount, stepSides] = /^(\d+)d(\d+)$/.exec(step) ?? [];
  if (!count || !stepCount || sides !== stepSides) throw new Error(`Cannot add ${step} to ${base}`);
  return `${Number(count) + Number(stepCount) * times}d${sides}${rest}`;
}

// "increases by 1d8 for each slot level above 3rd": the dice added for each level above the spell's own.
function readSlotStep(spell: CombatSpell): string | undefined {
  const match = /increases? by (\d+d\d+) for each slot level above (\w+)/.exec(higherLevel(spell));
  if (!match) return undefined;
  if (ORDINALS[match[2]] !== spell.level)
    throw new Error(
      `${spell.index}: scaling starts above ${match[2]}, not above level ${spell.level}`
    );
  return match[1];
}

function deriveDamage(spell: CombatSpell): SpellDamage[] | undefined {
  if (!DAMAGE_DERIVED.includes(spell.index)) return spell.damage;
  const step = readSlotStep(spell);
  const entries = [...(spell.damage ?? [])];
  const known = new Set(entries.map((entry) => entry.damage_type?.index));
  for (const { types, dice } of readDamage(text(spell))) {
    for (const type of types.length ? types : [undefined]) {
      if (known.has(type)) continue;
      known.add(type);
      const perSlot = Object.fromEntries(
        (step ? slotLevels(spell.level) : [spell.level]).map((slot) => [
          String(slot),
          step ? addDice(dice, step, slot - spell.level) : dice,
        ])
      );
      entries.push({
        ...(type && {
          damage_type: {
            index: type,
            name: DAMAGE_TYPE_NAMES[type],
            url: `/api/2014/damage-types/${type}`,
          },
        }),
        damage_at_slot_level: perSlot,
      });
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------------------------------------------------
// Saving throw
// ---------------------------------------------------------------------------------------------------------------------

const FORCED_SAVE = new RegExp(
  `must (?:first )?(?:succeed on|make) an? (${Object.keys(ABILITIES).join('|')}) saving throw`,
  'gi'
);

export function readForcedSaves(source: string): string[] {
  return [...new Set([...source.matchAll(FORCED_SAVE)].map((m) => ABILITIES[m[1].toLowerCase()]))];
}

// A forced saving throw in the text for which the spell has no `dc` on purpose.
export const DC_NOT_DERIVED: Record<string, string> = {
  'detect-thoughts':
    'the save is only made if the caster probes deeper, and then only to resist the probe',
  forcecage: 'the save is only made by a creature that tries to teleport out of the cage',
  earthquake: 'constitution (concentration) and dexterity (area, fissures, collapse) saves',
  'prismatic-wall': 'a constitution and a dexterity save, for different effects',
  symbol: 'a different save for each of the eight glyph effects',
};

function deriveDc(spell: CombatSpell): CombatSpell['dc'] {
  if (spell.dc || spell.index in DC_NOT_DERIVED) return spell.dc;
  const abilities = readForcedSaves(text(spell));
  if (abilities.length !== 1) return spell.dc;
  const [ability] = abilities;
  return {
    dc_type: {
      index: ability,
      name: ability.toUpperCase(),
      url: `/api/2014/ability-scores/${ability}`,
    },
    dc_success: /half (?:as much )?damage/.test(text(spell)) ? 'half' : 'none',
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Area of effect
// ---------------------------------------------------------------------------------------------------------------------

const AREA_SHAPES: [AreaOfEffect['type'], RegExp][] = [
  ['sphere', /(\d+)-foot[- ]radius sphere/g],
  ['cube', /(\d+)-foot[- ]cube/g],
  ['cube', /(\d+)-foot square/g],
  ['cone', /(\d+)-foot cone/g],
  ['cylinder', /(\d+)-foot[- ]radius,? \d+-foot[- ]high cylinder/g],
  ['sphere', /around you to a distance of (\d+) feet/g],
];

// Every "N-foot <shape>" in a text: a radius for a sphere and a cylinder, an edge for a cube, a length for a cone.
// A "N-foot square" is read as a cube, as the existing entries do. "Around you to a distance of N feet" (Spirit
// Guardians) is a sphere of that radius.
export function readAreas(source: string): AreaOfEffect[] {
  const found: AreaOfEffect[] = [];
  for (const [type, pattern] of AREA_SHAPES) {
    for (const match of source.matchAll(pattern)) found.push({ type, size: Number(match[1]) });
  }
  return found;
}

// A "N-foot <shape>" in the text that the spell's `area_of_effect` does not show on purpose.
export const AREA_NOT_MATCHED: Record<string, string> = {
  'fire-storm': 'ten 10-foot cubes in any arrangement; the entry is their reach, not a cube',
  symbol: 'the 60-foot-radius sphere is the glyph’s light after it triggers, not its effect',
};

// Whether the text is about a creature fighting: it deals damage, forces a saving throw, makes an attack roll or heals.
export function isCombat(spell: CombatSpell): boolean {
  const source = text(spell);
  return (
    /\d+d\d+[^.]*damage|damage equal to|extra \d+d\d+ damage/.test(source) ||
    readForcedSaves(source).length > 0 ||
    /(?:melee|ranged) spell attack/.test(source) ||
    /regains?[^.]*hit points|temporary hit points/.test(source)
  );
}

function deriveArea(spell: CombatSpell): AreaOfEffect | undefined {
  const areas = readAreas(text(spell));
  const distinct = new Set(areas.map((area) => `${area.type}${area.size}`));
  if (distinct.size !== 1 || spell.index in AREA_NOT_MATCHED) return spell.area_of_effect;
  if (spell.area_of_effect) return areas[0];
  return isCombat(spell) ? areas[0] : undefined;
}

// ---------------------------------------------------------------------------------------------------------------------
// Dice amounts
// ---------------------------------------------------------------------------------------------------------------------

// "1d8", "1d8 + MOD" (plus the caster's spellcasting ability modifier) or "3d4 + 3" as a structure. A string of
// another form, such as a flat amount or a choice of two, has none.
export function parseDiceAmount(value: string): DiceAmount | undefined {
  const match = /^(\d+d\d+)(?: \+ (MOD|\d+))?$/.exec(value);
  if (!match) return undefined;
  if (match[2] === 'MOD') return { dice: match[1], add_spellcasting_mod: true };
  if (match[2]) return { dice: match[1], bonus: Number(match[2]) };
  return { dice: match[1] };
}

// The structure of a whole map, or nothing when any value of the map has no structure.
function diceAmounts(map: Record<string, string> | undefined) {
  if (!map) return undefined;
  const entries = Object.entries(map).map(
    ([slot, value]) => [slot, parseDiceAmount(value)] as const
  );
  if (entries.some(([, amount]) => !amount)) return undefined;
  return Object.fromEntries(entries) as Record<string, DiceAmount>;
}

// False Life states its temporary hit points in `heal_at_slot_level`; the structure is `temp_hp_at_slot_level`.
function isTemporaryHitPoints(spell: CombatSpell) {
  return /you gain [^.]*temporary hit points/.test(text(spell));
}

function deriveHealData(spell: CombatSpell) {
  if (isTemporaryHitPoints(spell)) return undefined;
  return diceAmounts(spell.heal_at_slot_level);
}

// ---------------------------------------------------------------------------------------------------------------------
// Targets and temporary hit points per slot
// ---------------------------------------------------------------------------------------------------------------------

// The higher_level text scales the number of targets in these ways; the first level that adds one is the level above
// which the text counts. The base number is the one the spell states for its own level.
const TARGET_STEP =
  /(?:target|affect) (?:one|an) additional (?:creature|humanoid) for each (?:slot level above|spell slot above|level of location beyond the) (\w+)|creates? one (?:more|additional) (?:dart|ray) for each slot level above (\w+)|one additional bolt leaps from the first target to another target for each slot level above (\w+)/;

function readTargetBase(spell: CombatSpell): number | undefined {
  const source = text(spell);
  const patterns: [RegExp, (match: RegExpExecArray) => number][] = [
    [/[Uu]p to (\w+) creatures of your choice/, (m) => NUMBER_WORDS[m[1]]],
    [/You create (\w+) glowing darts/, (m) => NUMBER_WORDS[m[1]]],
    [/You create (\w+) rays of fire/, (m) => NUMBER_WORDS[m[1]]],
    [
      /(\w+) bolts then leap from that target to as many as \w+ other targets/,
      (m) => 1 + NUMBER_WORDS[m[1].toLowerCase()],
    ],
    [
      /(?:one creature|a creature|a humanoid|a single creature|Choose a creature|Choose a humanoid|A creature you touch|touch a creature|touch a willing creature)/,
      () => 1,
    ],
  ];
  for (const [pattern, count] of patterns) {
    const match = pattern.exec(source);
    if (match) return count(match);
  }
  return undefined;
}

// The higher_level text scales the number of targets, but the base number is not one count of one kind.
export const TARGETS_NOT_DERIVED: Record<string, string> = {
  'animate-dead': 'undead raised from corpses, two more for each slot level',
  'animate-objects':
    'objects animated, two more for each slot level, of sizes that change what each can do',
  'conjure-animals': 'creatures summoned, a multiple of the base number at certain slots only',
  'conjure-minor-elementals':
    'creatures summoned, a multiple of the base number at certain slots only',
  'conjure-woodland-beings':
    'creatures summoned, a multiple of the base number at certain slots only',
  etherealness:
    'up to three willing creatures for each slot level above 7th, the base being the caster alone',
  'mass-healing-word':
    'six creatures at every slot level, the higher_level text scales the healing',
  'prayer-of-healing':
    'six creatures at every slot level, the higher_level text scales the healing',
};

function deriveTargets(spell: CombatSpell) {
  const step = TARGET_STEP.exec(higherLevel(spell));
  if (!step || spell.index in TARGETS_NOT_DERIVED) return undefined;
  const above = ORDINALS[step[1] ?? step[2] ?? step[3]];
  const base = readTargetBase(spell);
  if (above !== spell.level || base === undefined)
    throw new Error(`${spell.index}: no number of targets for "${higherLevel(spell)}"`);
  return Object.fromEntries(
    slotLevels(spell.level).map((slot) => [String(slot), base + (slot - spell.level)])
  );
}

function deriveTemporaryHitPoints(spell: CombatSpell) {
  const step =
    /you gain (\d+) additional temporary hit points for each slot level above (\w+)/.exec(
      higherLevel(spell)
    );
  if (!step) return undefined;
  const base = /you gain (\d+d\d+) \+ (\d+) temporary hit points/.exec(text(spell));
  if (!base || ORDINALS[step[2]] !== spell.level)
    throw new Error(`${spell.index}: no temporary hit points for "${higherLevel(spell)}"`);
  return Object.fromEntries(
    slotLevels(spell.level).map((slot) => [
      String(slot),
      { dice: base[1], bonus: Number(base[2]) + Number(step[1]) * (slot - spell.level) },
    ])
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Putting it together
// ---------------------------------------------------------------------------------------------------------------------

// A field the spell has is replaced where it is. A new field goes before the first of these that the spell has, so a
// spell keeps the order it had.
function setField(spell: CombatSpell, key: string, value: unknown, before: string[]): CombatSpell {
  if (JSON.stringify(spell[key]) === JSON.stringify(value)) return spell;
  if (key in spell) return { ...spell, [key]: value };
  const out: Record<string, unknown> = {};
  let placed = false;
  for (const [name, current] of Object.entries(spell)) {
    if (!placed && before.includes(name)) {
      out[key] = value;
      placed = true;
    }
    out[name] = current;
  }
  if (!placed) out[key] = value;
  return out as CombatSpell;
}

function insertAfter(spell: CombatSpell, after: string, key: string, value: unknown): CombatSpell {
  const out: Record<string, unknown> = {};
  for (const [name, current] of Object.entries(spell)) {
    if (name === key) continue;
    out[name] = current;
    if (name === after) out[key] = value;
  }
  return out as CombatSpell;
}

function withSlotData(damage: SpellDamage[] | undefined): SpellDamage[] | undefined {
  return damage?.map((entry) => {
    const data = diceAmounts(entry.damage_at_slot_level);
    if (!data) return entry;
    const out: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(entry)) {
      if (name === 'damage_at_slot_level_data') continue;
      out[name] = value;
      if (name === 'damage_at_slot_level') out.damage_at_slot_level_data = data;
    }
    return out as SpellDamage;
  });
}

const AFTER_DAMAGE = ['dc', 'area_of_effect', 'heal_at_slot_level', 'school'];
const AFTER_DC = ['area_of_effect', 'heal_at_slot_level', 'school'];
const AFTER_AREA = ['heal_at_slot_level', 'school'];

export function deriveSpellCombat(spells: CombatSpell[]): CombatSpell[] {
  return spells.map((spell) => {
    let out = spell;
    const damage = withSlotData(deriveDamage(out));
    if (damage) out = setField(out, 'damage', damage, AFTER_DAMAGE);
    const dc = deriveDc(out);
    if (dc) out = setField(out, 'dc', dc, AFTER_DC);
    const area = deriveArea(out);
    if (area) out = setField(out, 'area_of_effect', area, AFTER_AREA);
    const heal = deriveHealData(out);
    if (heal) out = insertAfter(out, 'heal_at_slot_level', 'heal_at_slot_level_data', heal);
    const temp = deriveTemporaryHitPoints(out);
    if (temp) out = setField(out, 'temp_hp_at_slot_level', temp, ['school']);
    const targets = deriveTargets(out);
    if (targets) out = setField(out, 'targets_at_slot_level', targets, ['school']);
    return out;
  });
}
