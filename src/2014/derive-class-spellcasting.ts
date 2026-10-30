import fs from 'node:fs';
import path from 'node:path';
import FeatureData from './en/5e-SRD-Features.json' with { type: 'json' };
import SubclassData from './en/5e-SRD-Subclasses.json' with { type: 'json' };

// The structured counterpart of the `spellcasting` text of a class, added to the existing object in
// src/2014/en/5e-SRD-Classes.json: `caster_kind`, `prepared_formula` (prepared casters), `spellbook_size` (the
// wizard) and `subclass_spells`. The values are read from the text of `spellcasting.info`, the features and the
// subclasses; docs/class-spellcasting.md describes the rules and src/2014/tests/class-spellcasting.test.ts audits
// the result against the text and the Levels rows.

type Info = { name: string; desc: string[] };
type Spellcasting = {
  level: number;
  spellcasting_ability: { index: string };
  info: Info[];
} & Record<string, unknown>;
type Class = { index: string; spellcasting?: Spellcasting } & Record<string, unknown>;
type Feature = { index: string; class?: { index: string }; desc: string[] };
type Subclass = { index: string; class: { index: string }; spells?: unknown[] };

export const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};

// Each level gained after the first adds this many spells to a wizard's spellbook. The SRD states it in the
// Spellbook rules, which this data's wizard text leaves out, so it is a rule value, marked `dd` in the source markers.
export const SPELLBOOK_PER_LEVEL = 2;

const preparing = (spellcasting: Spellcasting) =>
  spellcasting.info.find((entry) => entry.name === 'Preparing and Casting Spells');

/** `prepared_formula` from the sentence "equal to your <Ability> modifier + <levels> (minimum of one spell)". */
export function preparedFormula(
  classIndex: string,
  spellcasting: Spellcasting
): Record<string, unknown> | undefined {
  const entry = preparing(spellcasting);
  if (!entry) return undefined;
  const match = entry.desc
    .join(' ')
    .match(
      new RegExp(
        `equal to your \\w+ modifier \\+ (your ${classIndex} level|half your ${classIndex} level, rounded down)` +
          ` \\(minimum of (\\w+) spell\\)`
      )
    );
  if (!match) throw new Error(`${classIndex}: no prepared spells formula in the spellcasting text`);
  return {
    class_levels: match[1].startsWith('half') ? 'half_rounded_down' : 'full',
    minimum: NUMBER_WORDS[match[2]],
  };
}

/** `spellbook_size` from the Spellbook text: "a spellbook containing six 1st-level wizard spells". */
export function spellbookSize(
  classIndex: string,
  spellcasting: Spellcasting
): Record<string, unknown> | undefined {
  const entry = spellcasting.info.find((e) => e.name === 'Spellbook');
  if (!entry) return undefined;
  const match = entry.desc.join(' ').match(/spellbook containing (\w+) 1st- ?level/);
  if (!match) throw new Error(`${classIndex}: no spellbook size in the spellcasting text`);
  return { initial: NUMBER_WORDS[match[1]], per_level: SPELLBOOK_PER_LEVEL };
}

/** Pact Magic, or slots from the 2nd level on (half casters), or slots from the 1st level on (full casters). */
export function casterKind(classIndex: string, spellcasting: Spellcasting): string {
  const features = FeatureData as unknown as Feature[];
  if (features.some((f) => f.class?.index === classIndex && f.index === 'pact-magic'))
    return 'pact';
  return spellcasting.level === 1 ? 'full' : 'half';
}

/** How the subclasses of the class add spells, and which of the subclasses have none. */
export function subclassSpells(classIndex: string): Record<string, unknown> {
  const subclasses = (SubclassData as unknown as Subclass[]).filter(
    (s) => s.class.index === classIndex
  );
  const withSpells = subclasses.filter((s) => s.spells?.length).map((s) => s.index);
  const withoutSpells = subclasses.filter((s) => !s.spells?.length).map((s) => s.index);
  if (withSpells.length === 0)
    return { mode: 'none', with_spells: [], without_spells: withoutSpells };
  const alwaysPrepared = (FeatureData as unknown as Feature[]).some(
    (f) => f.class?.index === classIndex && f.desc.join(' ').includes('always have it prepared')
  );
  return {
    mode: alwaysPrepared ? 'always_prepared' : 'expanded_list',
    with_spells: withSpells,
    without_spells: withoutSpells,
  };
}

function deriveSpellcasting(classIndex: string, spellcasting: Spellcasting): Spellcasting {
  const { level, spellcasting_ability, info } = spellcasting;
  return Object.fromEntries(
    Object.entries({
      level,
      spellcasting_ability,
      info,
      caster_kind: casterKind(classIndex, spellcasting),
      prepared_formula: preparedFormula(classIndex, spellcasting),
      spellbook_size: spellbookSize(classIndex, spellcasting),
      subclass_spells: subclassSpells(classIndex),
    }).filter(([, value]) => value !== undefined)
  ) as Spellcasting;
}

export function deriveClassSpellcasting(classes: Class[]): Class[] {
  return classes.map((cls) =>
    cls.spellcasting
      ? { ...cls, spellcasting: deriveSpellcasting(cls.index, cls.spellcasting) }
      : cls
  );
}

const repoRoot = path.resolve(import.meta.dirname, '../..');
const classesFile = path.join(repoRoot, 'src/2014/en/5e-SRD-Classes.json');

function writeClassesToFile() {
  const classes = JSON.parse(fs.readFileSync(classesFile, 'utf8')) as Class[];
  fs.writeFileSync(classesFile, `${JSON.stringify(deriveClassSpellcasting(classes), null, 2)}\n`);
  console.log(
    `Derived the spellcasting data of ${classes.filter((c) => c.spellcasting).length} classes`
  );
}

if (process.argv[1]?.endsWith('/derive-class-spellcasting.ts')) {
  writeClassesToFile();
}
