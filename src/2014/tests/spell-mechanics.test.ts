import { describe, expect, it } from 'vitest';
import SpellData from '../en/5e-SRD-Spells.json' with { type: 'json' };
import {
  deriveCastingTime,
  deriveDuration,
  deriveRangeFt,
  deriveSpellMechanics,
} from '../derive-spell-mechanics';

type Structured = {
  range_ft?: number | string;
  casting_time_data?: { amount: number; unit: string };
  duration_data?: { unit: string; length?: number };
};
type Spell = {
  index: string;
  range: string;
  duration: string;
  casting_time: string;
  concentration: boolean;
} & Structured;

const spells = SpellData as unknown as Spell[];

// Each check below states the rule in the words of the SRD and compares it with the structure. They share no code
// with the derivation, so a text and a structure that disagree fail here whichever of the two was edited.
function auditRange(spell: Spell): string | undefined {
  const { range, range_ft: feet } = spell;
  const words = {
    Self: 'self',
    Touch: 'touch',
    Sight: 'sight',
    Special: 'special',
    Unlimited: 'unlimited',
  };
  if (range in words)
    return feet === words[range as keyof typeof words]
      ? undefined
      : `range "${range}" is range_ft ${feet}`;
  const [, count, unit] = /^(\d+) (feet|miles?)$/.exec(range) ?? [];
  if (!count) return `range "${range}" has no known form`;
  const expected = Number(count) * (unit === 'feet' ? 1 : 5280);
  return feet === expected
    ? undefined
    : `range "${range}" is range_ft ${feet}, expected ${expected}`;
}

function auditCastingTime(spell: Spell): string | undefined {
  const { casting_time: text, casting_time_data: data } = spell;
  const [, count, unit] = /^(\d+) (action|bonus action|reaction|minute|hour)s?$/.exec(text) ?? [];
  if (!count) return `casting_time "${text}" has no known form`;
  const expected = { amount: Number(count), unit: unit.replace(' ', '_') };
  return JSON.stringify(data) === JSON.stringify(expected)
    ? undefined
    : `casting_time "${text}" is ${JSON.stringify(data)}`;
}

function auditDuration(spell: Spell): string | undefined {
  const { duration: text, duration_data: data, concentration } = spell;
  const fixed: Record<string, string> = {
    Instantaneous: 'instantaneous',
    'Until dispelled': 'until_dispelled',
    Special: 'special',
  };
  if (text in fixed) {
    if (concentration) return `duration "${text}" with concentration`;
    return JSON.stringify(data) === JSON.stringify({ unit: fixed[text] })
      ? undefined
      : `duration "${text}" is ${JSON.stringify(data)}`;
  }
  const [, upTo, count, unit] = /^(Up to )?(\d+) (round|minute|hour|day)s?$/.exec(text) ?? [];
  if (!count) return `duration "${text}" has no known form`;
  if (Boolean(upTo) !== concentration)
    return `duration "${text}" and concentration ${concentration} disagree`;
  return JSON.stringify(data) === JSON.stringify({ unit, length: Number(count) })
    ? undefined
    : `duration "${text}" is ${JSON.stringify(data)}`;
}

const failures = (audit: (spell: Spell) => string | undefined, list: Spell[] = spells) =>
  list.flatMap((spell) => {
    const problem = audit(spell);
    return problem ? [`${spell.index}: ${problem}`] : [];
  });

describe('spell range, casting time and duration', () => {
  it('has range_ft on every spell and it agrees with the range text', () => {
    expect(spells).toHaveLength(319);
    expect(failures(auditRange)).toEqual([]);
  });

  it('has casting_time_data on every spell and it agrees with the casting time text', () => {
    expect(failures(auditCastingTime)).toEqual([]);
  });

  it('has duration_data on every spell and it agrees with the duration text and concentration', () => {
    expect(failures(auditDuration)).toEqual([]);
  });

  it('gives a length to the units that are a length of time and to no other', () => {
    const timed = new Set(['round', 'minute', 'hour', 'day']);
    for (const { index, duration_data: data } of spells) {
      expect(data?.length !== undefined, index).toBe(timed.has(data!.unit));
    }
  });

  it('counts each kind of value', () => {
    const tally = (values: (string | number | undefined)[]) =>
      Object.fromEntries(
        [...new Set(values)]
          .sort()
          .map((value) => [value, values.filter((v) => v === value).length])
      );
    expect(
      tally(spells.map((s) => (typeof s.range_ft === 'number' ? 'feet' : s.range_ft)))
    ).toEqual({
      feet: 186,
      self: 62,
      sight: 2,
      special: 1,
      touch: 67,
      unlimited: 1,
    });
    expect(tally(spells.map((s) => s.casting_time_data!.unit))).toEqual({
      action: 242,
      bonus_action: 14,
      hour: 13,
      minute: 46,
      reaction: 4,
    });
    expect(tally(spells.map((s) => s.duration_data!.unit))).toEqual({
      day: 7,
      hour: 87,
      instantaneous: 87,
      minute: 114,
      round: 10,
      special: 2,
      until_dispelled: 12,
    });
  });

  it('is what the derivation produces from the text', () => {
    const stripped = spells.map((spell) => {
      const { range_ft: _r, casting_time_data: _c, duration_data: _d, ...text } = spell;
      return text as Spell;
    });
    expect(deriveSpellMechanics(stripped)).toEqual(spells);
  });

  it('reports a text and a structure that disagree', () => {
    const acidArrow = spells.find((spell) => spell.index === 'acid-arrow')!;
    expect(auditRange({ ...acidArrow, range_ft: 60 })).toBe(
      'range "90 feet" is range_ft 60, expected 90'
    );
    expect(
      auditCastingTime({ ...acidArrow, casting_time_data: { amount: 1, unit: 'reaction' } })
    ).toBeDefined();
    expect(
      auditDuration({ ...acidArrow, duration_data: { unit: 'round', length: 1 } })
    ).toBeDefined();
    expect(auditDuration({ ...acidArrow, concentration: true })).toBeDefined();
  });

  it('refuses a text the vocabulary has no word for', () => {
    expect(() => deriveRangeFt('Line of sight')).toThrow('range_ft');
    expect(() => deriveCastingTime('1 action, which you take when hit')).toThrow(
      'casting_time_data'
    );
    expect(() => deriveDuration('Until the next dawn')).toThrow('duration_data');
  });

  it('reads a mile as 5280 feet', () => {
    expect(deriveRangeFt('1 mile')).toBe(5280);
    expect(deriveRangeFt('500 miles')).toBe(2640000);
  });
});
