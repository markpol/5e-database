import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { fileSource, REPO_ROOT } from '../files';
import { createLocalizer, type Collection, type DataRecord } from '../localize';
import { hashTextMap, overlayInputsHash, sha256, textMap } from '../snapshot';

// Round trip of the one-shot overlay migration (#31, scripts/migrate-overlays.ts): localize() over the migrated
// overlays must give every record translated before the migration the same display text as the old merge
// ({ ...en, ...overlay }), except for the reference labels listed in the fixture's `changes`.

interface Change {
  lang: string;
  collection: Collection;
  index: string;
  path: string;
  kind: string;
  from?: unknown;
  to?: unknown;
}

interface Fixture {
  /** `lang -> collection -> index -> "<english hash> <overlay inputs hash> <text hash>"` */
  records: Record<string, Record<string, Record<string, string>>>;
  changes: Change[];
}

const fixture = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'src/i18n/tests/fixtures/overlay-migration.json'), 'utf8')
) as Fixture;

const REFERENCE_KINDS = [
  'normalized',
  'gained',
  'conflict',
  'former-english',
  'level-prerequisite',
  'structure',
];

describe('overlay migration round trip', () => {
  const source = fileSource();
  const localize = createLocalizer(source);
  const changesOf = new Map<string, Change[]>();
  for (const c of fixture.changes) {
    const key = `${c.lang}/${c.collection}/${c.index}`;
    if (!changesOf.has(key)) changesOf.set(key, []);
    changesOf.get(key)!.push(c);
  }

  it('changes no translated field except the names relocated from reference labels', () => {
    const unexpected = fixture.changes.filter(
      (c) => !REFERENCE_KINDS.includes(c.kind) && !(c.kind === 'relocated' && c.path === 'name')
    );
    expect(unexpected).toEqual([]);
  });

  it('reproduces the pre-migration text of every translated record, apart from the listed changes', () => {
    const mismatches: string[] = [];
    let checked = 0;
    let skipped = 0;
    for (const [lang, collections] of Object.entries(fixture.records)) {
      for (const [name, records] of Object.entries(collections)) {
        const collection = name as Collection;
        const schema = source.schema(collection);
        const english = new Map(source.english(collection).map((r) => [r.index as string, r]));
        const localized = new Map(
          (localize(collection, lang) as unknown as DataRecord[]).map((r) => [r.index as string, r])
        );
        for (const [index, hashes] of Object.entries(records)) {
          const [englishHash, overlaysHash, textHash] = hashes.split(' ');
          const en = english.get(index);
          // A record whose English data or overlay inputs were edited after the migration is no longer comparable.
          if (
            !en ||
            sha256(en) !== englishHash ||
            overlayInputsHash(source, collection, en, lang) !== overlaysHash
          ) {
            skipped++;
            continue;
          }
          checked++;
          const text = textMap(schema, localized.get(index)!);
          for (const c of changesOf.get(`${lang}/${collection}/${index}`) ?? []) {
            if (JSON.stringify(text.get(c.path)?.value) !== JSON.stringify(c.to)) {
              mismatches.push(
                `${lang}/${collection}/${index} ${c.path}: expected ${JSON.stringify(c.to)}`
              );
            }
            if (c.from === undefined) text.delete(c.path);
            else
              text.set(c.path, {
                value: c.from,
                kind: c.kind === 'relocated' ? 'field' : 'reference',
              });
          }
          if (hashTextMap(text) !== textHash) {
            mismatches.push(
              `${lang}/${collection}/${index}: text differs from the pre-migration merge`
            );
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
    expect(checked + skipped).toBeGreaterThan(0);
  });
});
