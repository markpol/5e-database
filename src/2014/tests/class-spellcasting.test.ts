import { describe, expect, it } from 'vitest';
import ClassData from '../en/5e-SRD-Classes.json' with { type: 'json' };
import FeatureData from '../en/5e-SRD-Features.json' with { type: 'json' };
import LevelData from '../en/5e-SRD-Levels.json' with { type: 'json' };
import SubclassData from '../en/5e-SRD-Subclasses.json' with { type: 'json' };
import DamageTypeData from '../en/5e-SRD-Damage-Types.json' with { type: 'json' };
import LanguageData from '../en/5e-SRD-Languages.json' with { type: 'json' };
import { deriveClassSpellcasting, SPELLBOOK_PER_LEVEL } from '../derive-class-spellcasting';

type Spellcasting = {
  level: number;
  spellcasting_ability: { index: string };
  info: { name: string; desc: string[] }[];
  caster_kind?: 'full' | 'half' | 'pact';
  prepared_formula?: { class_levels: string; minimum: number };
  spellbook_size?: { initial: number; per_level: number };
  subclass_spells?: { mode: string; with_spells: string[]; without_spells: string[] };
};
type Class = { index: string; spellcasting?: Spellcasting };
type Subclass = {
  index: string;
  class: { index: string };
  spells?: { prerequisites: { index: string; type: string }[]; spell: { index: string } }[];
};
type Level = {
  level: number;
  class: { index: string };
  subclass?: unknown;
  spellcasting?: Record<string, number>;
};
type Feature = {
  index: string;
  name: string;
  level: number;
  class?: { index: string };
  desc: string[];
  feature_specific?: {
    granted_languages?: Record<string, unknown>[];
    damage_type?: string;
  };
};

const classes = ClassData as unknown as Class[];
const casters = classes.filter((c) => c.spellcasting);
const subclasses = SubclassData as unknown as Subclass[];
const features = FeatureData as unknown as Feature[];
const rows = (LevelData as unknown as Level[]).filter((l) => !l.subclass);
const classRows = (index: string) =>
  rows.filter((r) => r.class.index === index).sort((a, b) => a.level - b.level);
const slotLevels = (row: Level) =>
  Object.entries(row.spellcasting ?? {})
    .filter(([key, count]) => key.startsWith('spell_slots_level_') && count > 0)
    .map(([key]) => Number(key.replace('spell_slots_level_', '')));
const textOf = (cls: Class, name: string) =>
  cls.spellcasting!.info.find((e) => e.name === name)?.desc.join(' ');

describe('class spellcasting', () => {
  it('is derived from the class text without drift', () => {
    expect(deriveClassSpellcasting(ClassData as never)).toEqual(ClassData);
  });

  it('has a caster kind and subclass spells for the eight spellcasting classes and nothing else', () => {
    expect(casters.map((c) => c.index)).toEqual([
      'bard',
      'cleric',
      'druid',
      'paladin',
      'ranger',
      'sorcerer',
      'warlock',
      'wizard',
    ]);
    for (const cls of casters) {
      expect(cls.spellcasting!.caster_kind, cls.index).toBeDefined();
      expect(cls.spellcasting!.subclass_spells, cls.index).toBeDefined();
    }
  });

  it('gives the caster kind that the spell slots of the Levels rows show', () => {
    const kinds = Object.fromEntries(casters.map((c) => [c.index, c.spellcasting!.caster_kind]));
    expect(kinds).toEqual({
      bard: 'full',
      cleric: 'full',
      druid: 'full',
      paladin: 'half',
      ranger: 'half',
      sorcerer: 'full',
      warlock: 'pact',
      wizard: 'full',
    });
    for (const cls of casters) {
      const levels = classRows(cls.index);
      const highest = Math.max(...levels.flatMap(slotLevels));
      const first = levels.find((r) => slotLevels(r).length > 0)!.level;
      // The level at which spellcasting starts is the first level with a slot.
      expect(first, cls.index).toBe(cls.spellcasting!.level);
      switch (cls.spellcasting!.caster_kind) {
        case 'full':
          expect(highest, cls.index).toBe(9);
          expect(first, cls.index).toBe(1);
          break;
        case 'half':
          expect(highest, cls.index).toBe(5);
          expect(first, cls.index).toBe(2);
          break;
        case 'pact':
          // Pact Magic: one slot level at a time, the highest slot level 5, and slots that return on a short rest.
          expect(highest, cls.index).toBe(5);
          for (const row of levels) expect(slotLevels(row).length, `warlock ${row.level}`).toBe(1);
          expect(textOf(cls, 'Spell Slots'), cls.index).toMatch(/short or long rest/);
          break;
      }
    }
  });

  it('gives a prepared formula to the casters that prepare spells, and spells known to the rest', () => {
    const prepared = casters.filter((c) => c.spellcasting!.prepared_formula);
    expect(prepared.map((c) => c.index)).toEqual(['cleric', 'druid', 'paladin', 'wizard']);
    for (const cls of casters) {
      const text = textOf(cls, 'Preparing and Casting Spells');
      const known = classRows(cls.index).some((r) => (r.spellcasting?.spells_known ?? 0) > 0);
      // A class prepares spells exactly when its text says so, and then its Levels rows count no spells known.
      expect(Boolean(cls.spellcasting!.prepared_formula), cls.index).toBe(Boolean(text));
      expect(known, cls.index).toBe(!text);
    }
    expect(prepared.map((c) => c.spellcasting!.prepared_formula)).toEqual([
      { class_levels: 'full', minimum: 1 },
      { class_levels: 'full', minimum: 1 },
      { class_levels: 'half_rounded_down', minimum: 1 },
      { class_levels: 'full', minimum: 1 },
    ]);
  });

  it('agrees with the sentence that states the number of prepared spells', () => {
    for (const cls of casters.filter((c) => c.spellcasting!.prepared_formula)) {
      const ability = cls.spellcasting!.spellcasting_ability.index;
      const name = { int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }[ability];
      const formula = cls.spellcasting!.prepared_formula!;
      const text = textOf(cls, 'Preparing and Casting Spells')!;
      const levels =
        formula.class_levels === 'full'
          ? `your ${cls.index} level`
          : `half your ${cls.index} level, rounded down`;
      expect(text, cls.index).toContain(
        `equal to your ${name} modifier + ${levels} (minimum of one spell)`
      );
      expect(formula.minimum, cls.index).toBe(1);
    }
  });

  it('gives the wizard, and only the wizard, a spellbook', () => {
    expect(casters.filter((c) => c.spellcasting!.spellbook_size).map((c) => c.index)).toEqual([
      'wizard',
    ]);
    const wizard = classes.find((c) => c.index === 'wizard')!;
    expect(wizard.spellcasting!.spellbook_size).toEqual({
      initial: 6,
      per_level: SPELLBOOK_PER_LEVEL,
    });
    expect(textOf(wizard, 'Spellbook')).toMatch(
      /spellbook containing six 1st- ?level wizard spells/
    );
  });

  it('lists the subclasses with and without a spell list as the Subclasses file has them', () => {
    for (const cls of casters) {
      const own = subclasses.filter((s) => s.class.index === cls.index);
      const info = cls.spellcasting!.subclass_spells!;
      expect(info.with_spells, cls.index).toEqual(
        own.filter((s) => s.spells?.length).map((s) => s.index)
      );
      expect(info.without_spells, cls.index).toEqual(
        own.filter((s) => !s.spells?.length).map((s) => s.index)
      );
      expect(info.with_spells.length + info.without_spells.length, cls.index).toBe(own.length);
      expect(info.mode === 'none', cls.index).toBe(info.with_spells.length === 0);
    }
    // Every SRD subclass of a spellcasting class is accounted for.
    const accounted = casters.flatMap((c) => [
      ...c.spellcasting!.subclass_spells!.with_spells,
      ...c.spellcasting!.subclass_spells!.without_spells,
    ]);
    const ofCasters = subclasses.filter((s) => casters.some((c) => c.index === s.class.index));
    expect(accounted.sort()).toEqual(ofCasters.map((s) => s.index).sort());
  });

  it('names the subclass spells of a class at levels the class has spell slots for', () => {
    for (const cls of casters) {
      for (const index of cls.spellcasting!.subclass_spells!.with_spells) {
        const subclass = subclasses.find((s) => s.index === index)!;
        for (const entry of subclass.spells!) {
          const level = entry.prerequisites.find((p) => p.type === 'level')!;
          expect(level.index.startsWith(`${cls.index}-`), `${index} ${entry.spell.index}`).toBe(
            true
          );
          const classLevel = Number(level.index.split('-')[1]);
          expect(classLevel, `${index} ${entry.spell.index}`).toBeGreaterThanOrEqual(
            cls.spellcasting!.level
          );
        }
      }
    }
  });

  it('says how the subclass spells are gained, as the class features say', () => {
    const mode = (index: string) =>
      classes.find((c) => c.index === index)!.spellcasting!.subclass_spells!.mode;
    const always = (index: string) =>
      features
        .filter((f) => f.class?.index === index)
        .some((f) => f.desc.join(' ').includes('always have it prepared'));
    for (const index of ['cleric', 'druid', 'paladin']) {
      expect(mode(index), index).toBe('always_prepared');
      expect(always(index), index).toBe(true);
    }
    // The fiend spells are added to the warlock spell list: no feature makes them always prepared.
    expect(always('warlock')).toBe(false);
    expect(mode('warlock')).toBe('expanded_list');
    for (const index of ['bard', 'ranger', 'sorcerer', 'wizard'])
      expect(mode(index), index).toBe('none');
  });
});

describe('dragon ancestor damage types', () => {
  const dragons = features.filter((f) => f.index.startsWith('dragon-ancestor-'));
  const damageTypes = new Set((DamageTypeData as { index: string }[]).map((d) => d.index));

  it('gives each of the ten dragons the damage type its name states', () => {
    expect(dragons).toHaveLength(10);
    for (const dragon of dragons) {
      const named = /^Dragon Ancestor: \w+ - (\w+) Damage$/.exec(dragon.name)![1].toLowerCase();
      expect(dragon.feature_specific?.damage_type, dragon.index).toBe(named);
      expect(damageTypes.has(named), dragon.index).toBe(true);
    }
  });

  it('sets a damage type on the dragons only', () => {
    expect(
      features
        .filter((f) => f.feature_specific?.damage_type)
        .map((f) => f.index)
        .sort()
    ).toEqual(dragons.map((f) => f.index).sort());
    expect(new Set(dragons.map((d) => d.feature_specific!.damage_type))).toEqual(
      new Set(['acid', 'cold', 'fire', 'lightning', 'poison'])
    );
  });
});

describe('languages granted by features', () => {
  const granted = features.filter((f) => f.feature_specific?.granted_languages);
  const languages = new Set((LanguageData as { index: string }[]).map((l) => l.index));
  const text = (f: Feature) => f.desc.join(' ');

  it('covers the features whose text gives a language', () => {
    expect(granted.map((f) => f.index).sort()).toEqual(
      [
        'druidic',
        'thieves-cant',
        'favored-enemy-1-type',
        'favored-enemy-2-types',
        'favored-enemy-3-enemies',
        ...features.filter((f) => f.index.startsWith('dragon-ancestor-')).map((f) => f.index),
      ].sort()
    );
    // No other feature says that its owner learns, knows or can speak a language.
    const speaks = features.filter(
      (f) =>
        !granted.includes(f) &&
        /(you know|you can speak|you also learn|you learn) [^.]*\b(language|druidic|thieves' cant|draconic)\b/i.test(
          text(f)
        )
    );
    expect(speaks.map((f) => f.index)).toEqual([]);
  });

  it('agrees with the language the text names', () => {
    for (const f of granted) {
      const languagesOf = f.feature_specific!.granted_languages!;
      expect(languagesOf, f.index).toHaveLength(1);
      const [language] = languagesOf;
      if (language.secret_language === 'druidic') {
        expect(text(f), f.index).toContain('You know Druidic, the secret language of druids');
      } else if (language.secret_language === 'thieves-cant') {
        expect(text(f), f.index).toContain("you learned thieves' cant");
      } else if (language.choose) {
        expect(language.from, f.index).toBe('favored_enemy_languages');
        expect(text(f), f.index).toContain(
          'you also learn one language of your choice that is spoken by your favored enemies'
        );
        expect(language.choose, f.index).toBe(1);
      } else {
        expect(language.index, f.index).toBe('draconic');
        expect(languages.has(language.index as string), f.index).toBe(true);
        expect(language.name, f.index).toBe('Draconic');
        expect(language.url, f.index).toBe('/api/2014/languages/draconic');
        expect(text(f), f.index).toContain('You can speak, read, and write Draconic');
      }
    }
  });
});
