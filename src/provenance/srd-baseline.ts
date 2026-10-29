// Records which fields and records the upstream SRD data had, so the source-marker test can tell SRD fields from
// fields this fork added. Run from the repository root with an upstream commit to rebuild srd-baseline.json:
//   node src/provenance/srd-baseline.ts bce51b3
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export type SrdBaseline = {
  repository: string;
  commit: string;
  files: Record<string, { fields: string[]; records: string[] }>;
};

const UPSTREAM_REPOSITORY = 'https://github.com/5e-bits/5e-database';
const DATA_FILE_PATTERN = /^src\/(2014|2024)\/en\/5e-SRD-[A-Za-z-]+\.json$/;

// Field paths of a data file: keys joined with '.', with '[]' after a key whose value is an array. The top-level
// array of records is implicit, so a monster's action names are `actions[].name`.
export function fieldPaths(records: unknown[]): Set<string> {
  const paths = new Set<string>();
  const walk = (value: unknown, prefix: string) => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item, prefix);
      return;
    }
    if (value === null || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      paths.add(path);
      walk(child, Array.isArray(child) ? `${path}[]` : path);
    }
  };
  walk(records, '');
  return paths;
}

export function recordIndices(records: unknown[]): string[] {
  return records.flatMap((record) => {
    const index = (record as { index?: unknown }).index;
    return typeof index === 'string' ? [index] : [];
  });
}

function buildBaseline(commit: string): SrdBaseline {
  const fullCommit = execFileSync('git', ['rev-parse', '--verify', `${commit}^{commit}`]).toString().trim();
  const listing = execFileSync('git', ['ls-tree', '-r', '--name-only', fullCommit, '--', 'src']).toString();
  const files: SrdBaseline['files'] = {};
  for (const file of listing.split('\n').filter((name) => DATA_FILE_PATTERN.test(name)).sort()) {
    const records = JSON.parse(
      execFileSync('git', ['show', `${fullCommit}:${file}`], { maxBuffer: 1024 * 1024 * 1024 }).toString(),
    ) as unknown[];
    files[file] = { fields: [...fieldPaths(records)].sort(), records: recordIndices(records).sort() };
  }
  return { repository: UPSTREAM_REPOSITORY, commit: fullCommit, files };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const commit = process.argv[2];
  if (!commit) throw new Error('usage: node src/provenance/srd-baseline.ts <upstream commit>');
  const outputPath = new URL('./srd-baseline.json', import.meta.url);
  fs.writeFileSync(outputPath, `${JSON.stringify(buildBaseline(commit), null, 2)}\n`);
}
