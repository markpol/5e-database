/**
 * The `exports` map of package.json. Every 2014 collection gets a typed entry named like its `ids/` file
 * (`<package>/monsters`, `<package>/damage-types`, ...): the English data, typed by `types/`. The old deep paths
 * stay valid for one major version through the compatibility entries below. Translation overlay folders have no entry.
 *
 * `src/2014/tests/package-exports.test.ts` fails when package.json drifts from this; `pnpm run exports:write`
 * rewrites the map.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectionName } from './ids';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type Target = string | { types?: string; default: string };

/** Each entry file stem, `5e-SRD-Monsters` or `5e-SRD-Monsters-Normalized`, in schema order. */
export function entryStems(): string[] {
  return fs
    .readdirSync(path.join(root, 'src/2014/schemas'))
    .filter((f) => f.endsWith('.ts'))
    .sort()
    .map((f) => f.replace(/\.ts$/, ''));
}

/** Where a collection's data lives; the normalized monsters sit one level up, outside `en/`. */
function dataFile(stem: string): string {
  return stem.endsWith('-Normalized') ? `./src/2014/${stem}.json` : `./src/2014/en/${stem}.json`;
}

export function buildExports(): Record<string, Target> {
  const exports: Record<string, Target> = {};
  for (const stem of entryStems()) {
    exports[`./${collectionName(`${stem}.json`)}`] = {
      types: `./types/${stem}.d.ts`,
      default: dataFile(stem),
    };
  }
  // Compatibility shim: the deep paths the package was consumed through before the exports map.
  exports['./src/2014/en/*.json'] = './src/2014/en/*.json';
  exports['./src/2014/5e-SRD-Monsters-Normalized.json'] =
    './src/2014/5e-SRD-Monsters-Normalized.json';
  exports['./src/provenance/source-markers.json'] = './src/provenance/source-markers.json';
  exports['./src/i18n/localize'] = './src/i18n/localize.ts';
  exports['./src/i18n/localize.ts'] = './src/i18n/localize.ts';
  exports['./schema/*.json'] = './schema/*.json';
  exports['./ids/*.json'] = './ids/*.json';
  exports['./types/*.d.ts'] = './types/*.d.ts';
  exports['./types/*'] = './types/*.d.ts';
  exports['./package.json'] = './package.json';
  return exports;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  pkg.exports = buildExports();
  fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log('Wrote the exports map to package.json.');
}
