import { describe, it, expect, vi } from 'vitest';
import {
  buildTranslationDoc,
  getEnglishSourcePath,
  processTranslationEntries,
} from '../translationUtils';
import { LOCALE_PATTERN } from '../constants';

const enMap = new Map([
  ['acid-arrow', { index: 'acid-arrow', name: 'Acid Arrow', desc: ['A spell.'], level: 2 }],
  ['fireball', { index: 'fireball', name: 'Fireball', desc: ['A big spell.'], level: 3 }],
]);

describe('buildTranslationDoc', () => {
  it('returns null when index field is missing', () => {
    const result = buildTranslationDoc({ name: 'Säurepfeil' }, enMap, 'spells', 'de');
    expect(result).toBeNull();
  });

  it('returns null when index does not exist in English source (orphaned)', () => {
    const result = buildTranslationDoc(
      { index: 'nonexistent', name: 'Foo' },
      enMap,
      'spells',
      'de'
    );
    expect(result).toBeNull();
  });

  it('removes fields not present in the English entry', () => {
    const result = buildTranslationDoc(
      { index: 'acid-arrow', name: 'Säurepfeil', bogus_field: 'x' },
      enMap,
      'spells',
      'de'
    );
    expect(result).not.toBeNull();
    expect(result!.fields).not.toHaveProperty('bogus_field');
    expect(result!.fields).toHaveProperty('name', 'Säurepfeil');
  });

  it('returns a valid TranslatedEntry for a correct entry', () => {
    const result = buildTranslationDoc(
      { index: 'acid-arrow', name: 'Säurepfeil', desc: ['Ein Zauber.'] },
      enMap,
      'spells',
      'de'
    );
    expect(result).toEqual({
      source_index: 'acid-arrow',
      source_collection: 'spells',
      lang: 'de',
      fields: { name: 'Säurepfeil', desc: ['Ein Zauber.'] },
    });
  });

  it('does not include index in fields', () => {
    const result = buildTranslationDoc(
      { index: 'fireball', name: 'Feuerball' },
      enMap,
      'spells',
      'de'
    );
    expect(result!.fields).not.toHaveProperty('index');
  });

  it('accepts script-subtag locales like zh-Hans', () => {
    const result = buildTranslationDoc(
      { index: 'acid-arrow', name: '酸箭' },
      enMap,
      'spells',
      'zh-Hans'
    );
    expect(result).not.toBeNull();
    expect(result!.lang).toBe('zh-Hans');
  });
});

describe('LOCALE_PATTERN', () => {
  it('matches standard 2-letter language codes', () => {
    expect(LOCALE_PATTERN.test('de')).toBe(true);
  });

  it('matches language with uppercase region subtag', () => {
    expect(LOCALE_PATTERN.test('pt-BR')).toBe(true);
  });

  it('matches language with numeric region subtag', () => {
    expect(LOCALE_PATTERN.test('es-419')).toBe(true);
  });

  it('matches language with script subtag', () => {
    expect(LOCALE_PATTERN.test('zh-Hans')).toBe(true);
  });

  it('matches language with script and region subtags', () => {
    expect(LOCALE_PATTERN.test('zh-Hans-CN')).toBe(true);
  });

  it('rejects strings that cannot be BCP 47 language tags', () => {
    expect(LOCALE_PATTERN.test('2014')).toBe(false); // pure numeric (year dir)
    expect(LOCALE_PATTERN.test('a')).toBe(false); // single letter
    expect(LOCALE_PATTERN.test('translations')).toBe(false); // >8 letters
  });

  it('accepts short words that happen to fit BCP 47 language subtag syntax', () => {
    // The full RFC 5646 regex allows 2–8 letter primary language subtags, so common
    // directory names like 'docs', 'tests', 'schemas' pass the pattern.
    // Directory discovery code must exclude known non-locale dirs explicitly.
    expect(LOCALE_PATTERN.test('docs')).toBe(true);
    expect(LOCALE_PATTERN.test('tests')).toBe(true);
    expect(LOCALE_PATTERN.test('schemas')).toBe(true);
  });
});

describe('getEnglishSourcePath', () => {
  it('replaces locale dir with en', () => {
    expect(getEnglishSourcePath('src/2014/de/5e-SRD-Spells.json')).toBe(
      'src/2014/en/5e-SRD-Spells.json'
    );
  });

  it('works for region-subtag locales', () => {
    expect(getEnglishSourcePath('src/2024/pt-BR/5e-SRD-Classes.json')).toBe(
      'src/2024/en/5e-SRD-Classes.json'
    );
  });

  it('returns null when no year directory is found', () => {
    expect(getEnglishSourcePath('some/random/path/file.json')).toBeNull();
  });

  it('returns null when the year is immediately followed by a filename (no locale dir)', () => {
    expect(getEnglishSourcePath('src/2024/5e-SRD-Spells.json')).toBeNull();
  });

  it('leaves en paths pointing to en', () => {
    expect(getEnglishSourcePath('src/2014/en/5e-SRD-Spells.json')).toBe(
      'src/2014/en/5e-SRD-Spells.json'
    );
  });
});

describe('processTranslationEntries', () => {
  const enMap = new Map([
    ['acid-arrow', { index: 'acid-arrow', name: 'Acid Arrow', desc: ['A spell.'] }],
    ['fireball', { index: 'fireball', name: 'Fireball', desc: ['A big spell.'] }],
  ]);

  it('returns one doc per valid entry', () => {
    const result = processTranslationEntries(
      [
        { index: 'acid-arrow', name: 'Säurepfeil' },
        { index: 'fireball', name: 'Feuerball' },
      ],
      enMap,
      'spells',
      'de',
      '5e-SRD-Spells.json'
    );
    expect(result).toHaveLength(2);
    expect(result.map((d) => d.source_index)).toEqual(['acid-arrow', 'fireball']);
  });

  it('skips the second occurrence of a duplicate index and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = processTranslationEntries(
      [
        { index: 'acid-arrow', name: 'Säurepfeil' },
        { index: 'acid-arrow', name: 'Duplicate' },
      ],
      enMap,
      'spells',
      'de',
      '5e-SRD-Spells.json'
    );
    expect(result).toHaveLength(1);
    expect(result[0].fields).toHaveProperty('name', 'Säurepfeil');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Duplicate index 'acid-arrow'"));
    warn.mockRestore();
  });

  it('returns empty array for empty input', () => {
    expect(processTranslationEntries([], enMap, 'spells', 'de', '5e-SRD-Spells.json')).toEqual([]);
  });

  it('passes entries without a string index to buildTranslationDoc (which warns and returns null)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = processTranslationEntries(
      [{ name: 'No index here' }],
      enMap,
      'spells',
      'de',
      '5e-SRD-Spells.json'
    );
    expect(result).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
