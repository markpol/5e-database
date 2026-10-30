import fs from 'node:fs';
import path from 'node:path';
import * as prettier from 'prettier';
import spellData from './en/5e-SRD-Spells.json' with { type: 'json' };
import featureData from './en/5e-SRD-Features.json' with { type: 'json' };
import classData from './en/5e-SRD-Classes.json' with { type: 'json' };
import iconAnnotations from './icon-annotations.json' with { type: 'json' };

// The `icon` key of every spell, class feature and class. The key comes from src/2014/icon-annotations.json; a record
// the file does not list gets the default of its kind. docs/icon-keys.md describes the keys and
// src/2014/tests/icon-keys.test.ts audits the result.

type Record = { index: string; class?: { index: string }; icon?: string };
type Kind = 'spells' | 'features' | 'classes';

const annotations: { [kind in Kind]: { [index: string]: string } } = {
  spells: {},
  features: {},
  classes: {},
};
for (const { collection, index, icon } of iconAnnotations as {
  collection: Kind;
  index: string;
  icon: string;
}[]) {
  annotations[collection][index] = icon;
}

/** The key of a record the annotations do not list: the spell and the class by their own index, a feature by its class. */
export function defaultIcon(kind: Kind, record: Record): string {
  if (kind === 'spells') return `spell-${record.index}`;
  if (kind === 'classes') return `class-${record.index}`;
  return `feature-${record.class?.index ?? 'unknown'}`;
}

export const iconOf = (kind: Kind, record: Record) =>
  annotations[kind][record.index] ?? defaultIcon(kind, record);

export function deriveIcons<T extends Record>(kind: Kind, records: T[]): T[] {
  return records.map((record) => {
    const { icon: _previous, ...rest } = record;
    return { ...rest, icon: iconOf(kind, record) } as T;
  });
}

const repoRoot = path.resolve(import.meta.dirname, '../..');
const dataFile = (name: string) => path.join(repoRoot, 'src/2014/en', `5e-SRD-${name}.json`);

async function writeJson(file: string, data: unknown) {
  const options = await prettier.resolveConfig(file);
  fs.writeFileSync(
    file,
    await prettier.format(JSON.stringify(data, null, 2), { ...options, filepath: file })
  );
}

async function writeToFiles() {
  const spells = spellData as unknown as Record[];
  const features = featureData as unknown as Record[];
  const classes = classData as unknown as Record[];
  await writeJson(dataFile('Spells'), deriveIcons('spells', spells));
  await writeJson(dataFile('Features'), deriveIcons('features', features));
  fs.writeFileSync(
    dataFile('Classes'),
    `${JSON.stringify(deriveIcons('classes', classes), null, 2)}\n`
  );
  const fallbacks = (kind: Kind, records: Record[]) =>
    records.filter((record) => !(record.index in annotations[kind])).length;
  console.log(
    `Set the icon of ${spells.length} spells (${fallbacks('spells', spells)} default), ${features.length} features (${fallbacks('features', features)} default) and ${classes.length} classes (${fallbacks('classes', classes)} default)`
  );
}

if (process.argv[1]?.endsWith('/derive-icons.ts')) {
  await writeToFiles();
}
