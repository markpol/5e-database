/**
 * One-shot migration of the 2014 translation overlays to text-only overlays (#31).
 *
 *   node --experimental-strip-types --no-warnings --import ./scripts/register-ts.mjs scripts/migrate-overlays.ts \
 *     [--report <file.md>] [--force]
 *
 * 1. Snapshots the display text of every translated record under the old merge (`{ ...en, ...overlay }`).
 * 2. Strips each overlay to its translatable text (`stripOverlayRecord`); urls, numbers, booleans, stale structural
 *    copies and nested reference objects go, so those values now come from English.
 * 3. Relocates reference labels that would otherwise be lost: when a reference's target record has no translated
 *    name in that locale and every translated label embedded for it agrees, that label becomes the target's `name`.
 *    A label equal to the target's English name, current or former, is not a translation and is never relocated.
 * 4. Localizes every translated record from the migrated overlays and compares its text with the snapshot. Own
 *    translatable fields must be identical; every changed reference label is listed with its kind.
 * 5. Writes the overlays and `src/i18n/tests/fixtures/overlay-migration.json`, which pins the snapshot for the
 *    round-trip test.
 *
 * It refuses to run once the fixture exists: on migrated overlays it would only overwrite the pre-migration
 * snapshot that the fixture records.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  COLLECTIONS,
  createLocalizer,
  referenceTarget,
  isPlainObject,
  type Collection,
  type DataRecord,
  type LocalizationSource,
} from '../src/i18n/localize';
import { dataPath, fileSource, overlayLocales, REPO_ROOT } from '../src/i18n/files';
import { stripOverlayRecord } from '../src/i18n/overlays';
import {
  hashTextMap,
  overlayInputsHash,
  sha256,
  textMap,
  type TextMap,
} from '../src/i18n/snapshot';

export const FIXTURE = 'src/i18n/tests/fixtures/overlay-migration.json';

export type ChangeKind =
  | 'relocated'
  | 'normalized'
  | 'gained'
  | 'conflict'
  | 'former-english'
  | 'level-prerequisite'
  | 'structure';

/**
 * Embedded labels that are former English names of their target, not translations (`git log -S` finds each as a
 * `name` in `src/2014/en/5e-SRD-Magic-Items.json`). They are never relocated; the current English name replaces them.
 */
const FORMER_ENGLISH_NAMES = new Set([
  'magic-items/armor-1:Armor, +1',
  'magic-items/armor-2:Armor, +2',
  'magic-items/armor-3:Armor, +3',
]);

export interface Change {
  lang: string;
  collection: Collection;
  index: string;
  path: string;
  kind: ChangeKind;
  from?: unknown;
  to?: unknown;
}

interface Label {
  label: string;
  collection: Collection;
  index: string;
  path: string;
}

const disk = fileSource(REPO_ROOT);

function englishByIndex(collection: Collection): Map<string, DataRecord> {
  return new Map(disk.english(collection).map((r) => [r.index as string, r]));
}

/** Embedded reference labels of an overlay record, keyed by `collection/index` of the target. */
function embeddedLabels(collection: Collection, record: DataRecord, out: Map<string, Label[]>) {
  const walk = (value: unknown, p: string): void => {
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${p}[${i}]`));
    else if (isPlainObject(value)) {
      const target = referenceTarget(value);
      if (target) {
        const key = `${target.collection}/${target.index}`;
        if (!out.has(key)) out.set(key, []);
        out.get(key)!.push({
          label: value.name as string,
          collection,
          index: record.index as string,
          path: `${p}.name`,
        });
      } else for (const [k, v] of Object.entries(value)) walk(v, p ? `${p}.${k}` : k);
    }
  };
  for (const [k, v] of Object.entries(record)) if (k !== 'index') walk(v, k);
}

/** Puts an overlay record's keys in the English key order. */
function inEnglishOrder(english: DataRecord, record: DataRecord): DataRecord {
  return Object.fromEntries(
    Object.keys(english)
      .filter((k) => Object.hasOwn(record, k))
      .map((k) => [k, record[k]])
  );
}

function main(): void {
  if (fs.existsSync(path.join(REPO_ROOT, FIXTURE)) && !process.argv.includes('--force')) {
    throw new Error(
      `${FIXTURE} exists: the overlays are already migrated. Pass --force to run again.`
    );
  }
  const reportArg = process.argv.indexOf('--report');
  const reportFile = reportArg > 0 ? process.argv[reportArg + 1] : undefined;
  const english = Object.fromEntries(COLLECTIONS.map((c) => [c, englishByIndex(c)])) as Record<
    Collection,
    Map<string, DataRecord>
  >;
  const locales = overlayLocales(REPO_ROOT);

  // 1. Snapshot under the old merge.
  const before = new Map<string, TextMap>();
  const oldOverlays = new Map<string, DataRecord[]>();
  for (const lang of locales) {
    for (const c of COLLECTIONS) {
      const records = disk.overlay(c, lang);
      if (!records) continue;
      oldOverlays.set(`${lang}/${c}`, [...records]);
      for (const r of records) {
        const en = english[c].get(r.index as string)!;
        before.set(`${lang}/${c}/${r.index}`, textMap(disk.schema(c), { ...en, ...r }));
      }
    }
  }

  // 2. Strip.
  const migrated = new Map<string, DataRecord[]>();
  for (const [key, records] of oldOverlays) {
    const c = key.split('/')[1] as Collection;
    migrated.set(
      key,
      records
        .map((r) => stripOverlayRecord(disk.schema(c), english[c].get(r.index as string)!, r))
        .filter((r): r is DataRecord => r !== undefined)
    );
  }

  // 3. Relocate labels whose target has no translated name.
  const changes: Change[] = [];
  const relocatedTargets = new Set<string>();
  for (const lang of locales) {
    const labels = new Map<string, Label[]>();
    for (const [key, records] of oldOverlays) {
      if (!key.startsWith(`${lang}/`)) continue;
      const c = key.split('/')[1] as Collection;
      for (const r of records) embeddedLabels(c, r, labels);
    }
    for (const [targetKey, embedded] of labels) {
      const [tc, tIndex] = targetKey.split('/') as [Collection, string];
      const enTarget = english[tc].get(tIndex)!;
      const records = migrated.get(`${lang}/${tc}`) ?? [];
      const existing = records.find((r) => r.index === tIndex);
      const hasTranslatedName =
        typeof existing?.name === 'string' && existing.name !== enTarget.name;
      if (hasTranslatedName) continue;
      const translated = new Set(
        embedded
          .map((l) => l.label)
          .filter((l) => l !== enTarget.name && !FORMER_ENGLISH_NAMES.has(`${targetKey}:${l}`))
      );
      if (translated.size !== 1) continue;
      const [label] = translated;
      const updated = inEnglishOrder(enTarget, { ...(existing ?? { index: tIndex }), name: label });
      const next = existing
        ? records.map((r) => (r === existing ? updated : r))
        : [...records, updated];
      const order = [...english[tc].keys()];
      next.sort((a, b) => order.indexOf(a.index as string) - order.indexOf(b.index as string));
      migrated.set(`${lang}/${tc}`, next);
      relocatedTargets.add(`${lang}/${targetKey}`);
      changes.push({
        lang,
        collection: tc,
        index: tIndex,
        path: 'name',
        kind: 'relocated',
        from: existing?.name ?? enTarget.name,
        to: label,
      });
    }
  }

  // 4. Localize from the migrated overlays and compare.
  const source: LocalizationSource = {
    english: (c) => disk.english(c),
    overlay: (c, lang) => migrated.get(`${lang}/${c}`),
    schema: (c) => disk.schema(c),
  };
  const localize = createLocalizer(source);
  const fixtureRecords: Record<string, Record<string, Record<string, string>>> = {};
  const fieldChanges: string[] = [];
  const structural = new Map<string, number>();
  for (const [key, records] of oldOverlays) {
    const [lang, c] = key.split('/') as [string, Collection];
    const localized = new Map(localize(c, lang).map((r) => [r.index as string, r as DataRecord]));
    for (const old of records) {
      const index = old.index as string;
      const en = english[c].get(index)!;
      const after = textMap(disk.schema(c), localized.get(index)!);
      const prior = before.get(`${lang}/${c}/${index}`)!;
      const paths = new Set([...prior.keys(), ...after.keys()]);
      for (const p of paths) {
        const a = prior.get(p);
        const b = after.get(p);
        if (a && b && JSON.stringify(a.value) === JSON.stringify(b.value)) continue;
        const base = { lang, collection: c, index, path: p, from: a?.value, to: b?.value };
        if (!a || !b || a.kind !== b.kind) {
          changes.push({ ...base, kind: 'structure' });
          if (a?.kind === 'field' || b?.kind === 'field') fieldChanges.push(`${key}/${index} ${p}`);
          continue;
        }
        if (a.kind === 'field') {
          const relocated = p === 'name' && relocatedTargets.has(`${lang}/${c}/${index}`);
          if (!relocated) fieldChanges.push(`${key}/${index} ${p}`);
          continue; // relocated names are already listed
        }
        changes.push({ ...base, kind: labelKind({ ...en, ...old }, p, lang, a.value) });
      }
      // Structural values that a stale overlay copy no longer overrides, counted per field.
      for (const k of Object.keys(old)) {
        if (k === 'index') continue;
        const masked = (v: unknown) => maskText(disk.schema(c), { [k]: v });
        if (sha256(masked({ ...en, ...old }[k])) !== sha256(masked(localized.get(index)![k]))) {
          const field = `${lang} ${c}.${k}`;
          structural.set(field, (structural.get(field) ?? 0) + 1);
        }
      }
      (fixtureRecords[lang] ??= {})[c] ??= {};
      fixtureRecords[lang][c][index] = [
        sha256(en),
        overlayInputsHash(source, c, en, lang),
        hashTextMap(prior),
      ].join(' ');
    }
  }
  if (fieldChanges.length) {
    throw new Error(`Translated field text changed:\n  ${fieldChanges.join('\n  ')}`);
  }

  function labelKind(merged: DataRecord, p: string, lang: string, from: unknown): ChangeKind {
    const target = referenceTarget(valueAt(merged, p.replace(/\.name$/, '')));
    if (!target) return 'level-prerequisite';
    const enName = english[target.collection].get(target.index)!.name;
    if (from === enName) return 'gained';
    if (FORMER_ENGLISH_NAMES.has(`${target.collection}/${target.index}:${from}`)) {
      return 'former-english';
    }
    const name = migrated
      .get(`${lang}/${target.collection}`)
      ?.find((r) => r.index === target.index)?.name;
    return typeof name === 'string' && name !== enName ? 'normalized' : 'conflict';
  }

  // 5. Write.
  for (const [key, records] of migrated) {
    const [lang, c] = key.split('/') as [string, Collection];
    const file = dataPath(REPO_ROOT, c, lang);
    if (records.length === 0) fs.rmSync(file, { force: true });
    else fs.writeFileSync(file, `${JSON.stringify(records, null, 2)}\n`);
  }
  changes.sort((a, b) =>
    [a.lang, a.collection, a.index, a.path].join('\u0000') <
    [b.lang, b.collection, b.index, b.path].join('\u0000')
      ? -1
      : 1
  );
  const description =
    'Pins the one-shot overlay migration of #31 (scripts/migrate-overlays.ts). `records`: for each record ' +
    'translated before the migration, three hashes: its English record, the overlay entries localize() reads for ' +
    'it after the migration, and its display text under the old merge ({ ...en, ...overlay }). `changes`: every ' +
    'display text that differs between the old merge and localize(), all of them reference labels, plus the ' +
    'target names the labels were relocated to.';
  const ordered = changes.map(({ lang, collection, index, path: p, kind, from, to }) => ({
    lang,
    collection,
    index,
    path: p,
    kind,
    from,
    to,
  }));
  const fixtureFile = path.join(REPO_ROOT, FIXTURE);
  fs.mkdirSync(path.dirname(fixtureFile), { recursive: true });
  fs.writeFileSync(
    fixtureFile,
    [
      '{',
      `  "description": ${JSON.stringify(description)},`,
      `  "records": ${JSON.stringify(fixtureRecords, null, 2).replace(/\n/g, '\n  ')},`,
      '  "changes": [',
      ordered.map((c) => `    ${JSON.stringify(c)}`).join(',\n'),
      '  ]',
      '}',
      '',
    ].join('\n')
  );

  const report = renderReport(locales, changes, structural, oldOverlays, migrated);
  if (reportFile) fs.writeFileSync(reportFile, report);
  console.log(report);
}

function valueAt(record: DataRecord, p: string): DataRecord | undefined {
  let current: unknown = record;
  for (const part of p.split(/\.|\[(\d+)\]/).filter((s) => s !== undefined && s !== '')) {
    if (Array.isArray(current)) current = current[Number(part)];
    else if (isPlainObject(current)) current = current[part];
    else return undefined;
  }
  return isPlainObject(current) ? current : undefined;
}

/** The record with every display text replaced by a placeholder, leaving only its structure. */
function maskText(schema: Parameters<typeof textMap>[0], record: DataRecord): unknown {
  const masked = structuredClone(record);
  for (const p of textMap(schema, record).keys()) {
    const parts = p.split(/\.|\[(\d+)\]/).filter((s) => s !== undefined && s !== '');
    let current: unknown = masked;
    for (const part of parts.slice(0, -1)) {
      current = Array.isArray(current) ? current[Number(part)] : (current as DataRecord)[part];
    }
    const last = parts[parts.length - 1];
    if (Array.isArray(current)) current[Number(last)] = '<text>';
    else (current as DataRecord)[last] = '<text>';
  }
  return masked;
}

function renderReport(
  locales: string[],
  changes: Change[],
  structural: Map<string, number>,
  oldOverlays: Map<string, DataRecord[]>,
  migrated: Map<string, DataRecord[]>
): string {
  const lines: string[] = ['# Overlay migration report', ''];
  const kinds: ChangeKind[] = [
    'relocated',
    'normalized',
    'gained',
    'conflict',
    'former-english',
    'level-prerequisite',
    'structure',
  ];
  lines.push(`| locale | ${kinds.join(' | ')} |`, `| --- |${kinds.map(() => ' ---: |').join('')}`);
  for (const lang of locales) {
    const count = (k: ChangeKind) => changes.filter((c) => c.lang === lang && c.kind === k).length;
    lines.push(`| ${lang} | ${kinds.map(count).join(' | ')} |`);
  }
  lines.push(
    '',
    '## Files',
    '',
    '| file | entries before | entries after |',
    '| --- | ---: | ---: |'
  );
  for (const key of [...new Set([...oldOverlays.keys(), ...migrated.keys()])].sort()) {
    lines.push(
      `| ${key} | ${oldOverlays.get(key)?.length ?? 0} | ${migrated.get(key)?.length ?? 0} |`
    );
  }
  lines.push(
    '',
    '## Structural values now taken from English (records per field)',
    '',
    '| locale field | records |',
    '| --- | ---: |'
  );
  for (const [field, n] of [...structural].sort()) lines.push(`| ${field} | ${n} |`);
  for (const kind of kinds) {
    const list = changes.filter((c) => c.kind === kind);
    if (!list.length) continue;
    lines.push('', `## ${kind} (${list.length})`, '');
    for (const c of list) {
      lines.push(
        `- ${c.lang} ${c.collection}/${c.index} \`${c.path}\`: ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}`
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

main();
