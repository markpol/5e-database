import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import baselineData from './srd-baseline.json' with { type: 'json' };
import markersData from './source-markers.json' with { type: 'json' };
import { fieldPaths, recordIndices, type SrdBaseline } from './srd-baseline';

const SourceSchema = z.enum(['srd', 'srd-5.2', 'dd']);
const MarkerSchema = z.strictObject({ source: SourceSchema, note: z.string().min(1) });
const FileMarkersSchema = z.strictObject({
  source: SourceSchema,
  derived_from: z.string().optional(),
  fields: z.record(z.string(), MarkerSchema).optional(),
  records: z.record(z.string(), MarkerSchema).optional(),
});
const SourceMarkersSchema = z.strictObject({ files: z.record(z.string(), FileMarkersSchema) });

type SourceMarkers = z.infer<typeof SourceMarkersSchema>;

const repoRoot = path.resolve(import.meta.dirname, '../..');
const baseline = baselineData as SrdBaseline;
const markers = SourceMarkersSchema.parse(markersData);
const readData = (file: string) => JSON.parse(fs.readFileSync(path.join(repoRoot, file), 'utf8')) as unknown[];

// Every JSON data file a consumer can load: the English sets plus the 2014 monster files next to them.
// Translation overlays are left out because translations.test.ts limits them to fields of the English entry.
function dataFiles(): string[] {
  return ['2014', '2024'].flatMap((year) => {
    const english = fs.readdirSync(path.join(repoRoot, 'src', year, 'en')).map((name) => `src/${year}/en/${name}`);
    const yearRoot = fs
      .readdirSync(path.join(repoRoot, 'src', year), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => `src/${year}/${entry.name}`);
    return [...english, ...yearRoot].filter((file) => file.endsWith('.json'));
  });
}

const isMarked = (marked: Record<string, unknown>, fieldPath: string) =>
  Object.keys(marked).some((markedPath) => fieldPath === markedPath || fieldPath.startsWith(`${markedPath}.`));

// normalize-monsters.ts moves an action's `dc` and `condition` onto its last damage entry.
const sourcePathCandidates = (fieldPath: string) => [
  fieldPath,
  fieldPath.replace(/\.damage\[\]\.(dc|condition)(?=\.|$)/, '.$1'),
];

// Field paths and record indices in `records` that are neither in the upstream SRD baseline nor marked.
function findUnmarked(file: string, records: unknown[], sourceMarkers: SourceMarkers = markers) {
  const entry = sourceMarkers.files[file];
  if (!entry) return { fields: [...fieldPaths(records)], records: recordIndices(records) };
  if (entry.source === 'dd') return { fields: [], records: [] };

  const fields = entry.fields ?? {};
  const markedRecords = entry.records ?? {};
  let isSrdField: (fieldPath: string) => boolean;
  let isSrdRecord: (index: string) => boolean;
  if (entry.derived_from) {
    const source = entry.derived_from;
    const sourceRecords = readData(source);
    const sourceUnmarked = findUnmarked(source, sourceRecords, sourceMarkers);
    const sourceFields = fieldPaths(sourceRecords);
    const sourceIndices = new Set(recordIndices(sourceRecords));
    isSrdField = (fieldPath) =>
      sourcePathCandidates(fieldPath).some(
        (candidate) => sourceFields.has(candidate) && !sourceUnmarked.fields.includes(candidate),
      );
    isSrdRecord = (index) => sourceIndices.has(index) && !sourceUnmarked.records.includes(index);
  } else {
    const srd = baseline.files[file] ?? { fields: [], records: [] };
    const srdFields = new Set(srd.fields);
    const srdRecords = new Set(srd.records);
    isSrdField = (fieldPath) => srdFields.has(fieldPath);
    isSrdRecord = (index) => srdRecords.has(index);
  }

  return {
    fields: [...fieldPaths(records)].filter((fieldPath) => !isSrdField(fieldPath) && !isMarked(fields, fieldPath)),
    records: recordIndices(records).filter((index) => !isSrdRecord(index) && !(index in markedRecords)),
  };
}

describe('source markers', () => {
  it('lists every data file exactly once', () => {
    expect(Object.keys(markers.files).sort()).toEqual(dataFiles().sort());
  });

  it('marks each set with its SRD version', () => {
    for (const [file, entry] of Object.entries(markers.files)) {
      if (entry.source === 'dd') continue;
      expect(entry.source, file).toBe(file.startsWith('src/2014/') ? 'srd' : 'srd-5.2');
    }
  });

  it.each(dataFiles())('%s has no unmarked non-SRD field or record', (file) => {
    expect(findUnmarked(file, readData(file))).toEqual({ fields: [], records: [] });
  });

  it('has no stale markers', () => {
    for (const [file, entry] of Object.entries(markers.files)) {
      const records = readData(file);
      const presentFields = fieldPaths(records);
      const presentRecords = new Set(recordIndices(records));
      const srd = baseline.files[file];
      for (const fieldPath of Object.keys(entry.fields ?? {})) {
        expect(presentFields.has(fieldPath), `${file}: ${fieldPath} is not in the data`).toBe(true);
        expect(srd?.fields.includes(fieldPath) ?? false, `${file}: ${fieldPath} is an SRD field`).toBe(false);
      }
      for (const index of Object.keys(entry.records ?? {})) {
        expect(presentRecords.has(index), `${file}: ${index} is not in the data`).toBe(true);
        expect(srd?.records.includes(index) ?? false, `${file}: ${index} is an SRD record`).toBe(false);
      }
      if (entry.derived_from) {
        expect(markers.files[entry.derived_from], `${file}: derived_from`).toBeDefined();
      }
    }
  });

  it('fails when a data file gains an unmarked field or record', () => {
    const file = 'src/2014/en/5e-SRD-Monsters.json';
    const [goblin] = readData(file).filter((record) => (record as { index: string }).index === 'goblin');
    const records = [
      { ...(goblin as object), loot_table: ['gold'] },
      { index: 'goblin-king', name: 'Goblin King' },
    ];

    expect(findUnmarked(file, records)).toEqual({ fields: ['loot_table'], records: ['goblin-king'] });
    expect(findUnmarked('src/2014/en/5e-SRD-New.json', [{ index: 'x' }])).toEqual({
      fields: ['index'],
      records: ['x'],
    });
  });

  it('follows the source file for a derived file', () => {
    const file = 'src/2014/5e-SRD-Monsters-Normalized.json';
    const records = [{ index: 'goblin', environments: 'Forest', actions: [{ name: 'Bite', loot: 1 }] }];

    expect(findUnmarked(file, records)).toEqual({ fields: ['actions[].loot'], records: [] });
  });
});
