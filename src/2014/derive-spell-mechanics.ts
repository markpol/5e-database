import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Structured range, casting time and duration of a spell, read from the spell's own text fields (`range`,
// `casting_time` and `duration`). Those fields are the only text read, and a value the vocabulary has no word for
// throws, so a new spell or a changed text fails here and not silently. The vocabulary is documented in
// docs/spell-mechanics.md and enforced by the Zod schema in schemas/5e-SRD-Spells.ts.

export type RangeToken = 'self' | 'touch' | 'sight' | 'special' | 'unlimited';
export type RangeFt = number | RangeToken;
export type CastingTimeData = {
  amount: number;
  unit: 'action' | 'bonus_action' | 'reaction' | 'minute' | 'hour';
};
export type DurationData = {
  unit: 'instantaneous' | 'round' | 'minute' | 'hour' | 'day' | 'until_dispelled' | 'special';
  length?: number;
};

const FEET_PER_MILE = 5280;

const RANGE_TOKENS: Record<string, RangeToken> = {
  Self: 'self',
  Touch: 'touch',
  Sight: 'sight',
  Special: 'special',
  Unlimited: 'unlimited',
};

export function deriveRangeFt(range: string): RangeFt {
  const token = RANGE_TOKENS[range];
  if (token) return token;
  const distance = /^(\d+) (feet|miles?)$/.exec(range);
  if (!distance) throw new Error(`No range_ft for range "${range}"`);
  return Number(distance[1]) * (distance[2] === 'feet' ? 1 : FEET_PER_MILE);
}

const CASTING_UNITS: Record<string, CastingTimeData['unit']> = {
  action: 'action',
  'bonus action': 'bonus_action',
  reaction: 'reaction',
  minute: 'minute',
  hour: 'hour',
};

export function deriveCastingTime(castingTime: string): CastingTimeData {
  const parsed = /^(\d+) (action|bonus action|reaction|minute|hour)s?$/.exec(castingTime);
  if (!parsed) throw new Error(`No casting_time_data for casting_time "${castingTime}"`);
  return { amount: Number(parsed[1]), unit: CASTING_UNITS[parsed[2]] };
}

const DURATION_WORDS: Record<string, DurationData> = {
  Instantaneous: { unit: 'instantaneous' },
  'Until dispelled': { unit: 'until_dispelled' },
  Special: { unit: 'special' },
};

const DURATION_UNITS = { round: 'round', minute: 'minute', hour: 'hour', day: 'day' } as const;

// "Up to 1 minute" has the same length as "1 minute": the SRD gives "up to" exactly to the spells that need
// concentration, which the `concentration` field already states.
export function deriveDuration(duration: string): DurationData {
  const word = DURATION_WORDS[duration];
  if (word) return { ...word };
  const parsed = /^(?:Up to )?(\d+) (round|minute|hour|day)s?$/.exec(duration);
  if (!parsed) throw new Error(`No duration_data for duration "${duration}"`);
  return {
    unit: DURATION_UNITS[parsed[2] as keyof typeof DURATION_UNITS],
    length: Number(parsed[1]),
  };
}

type Spell = { index: string; range: string; casting_time: string; duration: string } & Record<
  string,
  unknown
>;

// The structured field goes right after the text it restates, so a spell reads the same way as before.
function insertAfter(spell: Spell, after: string, key: string, value: unknown): Spell {
  const out: Record<string, unknown> = {};
  for (const [name, current] of Object.entries(spell)) {
    if (name === key) continue;
    out[name] = current;
    if (name === after) out[key] = value;
  }
  return out as Spell;
}

export function deriveSpellMechanics(spells: Spell[]): Spell[] {
  return spells.map((spell) => {
    let derived = insertAfter(spell, 'range', 'range_ft', deriveRangeFt(spell.range));
    derived = insertAfter(derived, 'duration', 'duration_data', deriveDuration(spell.duration));
    return insertAfter(
      derived,
      'casting_time',
      'casting_time_data',
      deriveCastingTime(spell.casting_time)
    );
  });
}

const repoRoot = path.resolve(import.meta.dirname, '../..');
const spellsFile = path.join(repoRoot, 'src/2014/en/5e-SRD-Spells.json');

function writeSpellsToFile() {
  const spells = JSON.parse(fs.readFileSync(spellsFile, 'utf8')) as Spell[];
  fs.writeFileSync(spellsFile, JSON.stringify(deriveSpellMechanics(spells), null, 2));
  // The repository formats its JSON with Prettier (.prettierrc), which keeps short arrays on one line.
  execFileSync(path.join(repoRoot, 'node_modules/.bin/prettier'), [
    '--config',
    path.join(repoRoot, '.prettierrc'),
    '--write',
    spellsFile,
  ]);
  console.log(`Derived range_ft, casting_time_data and duration_data for ${spells.length} spells`);
}

if (process.argv[1]?.endsWith('/derive-spell-mechanics.ts')) {
  writeSpellsToFile();
}
