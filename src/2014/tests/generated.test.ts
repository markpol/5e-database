import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import { diff, generate } from '../../../scripts/generate-schemas';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('generated schema/ and types/', () => {
  it('emits JSON Schema and types for all 26 schemas', async () => {
    const files = await generate();
    expect([...files.keys()].filter((f) => f.startsWith('schema/'))).toHaveLength(26);
    expect([...files.keys()].filter((f) => f.startsWith('types/'))).toHaveLength(26);
    expect(files.has('schema/5e-SRD-Monsters-Normalized.schema.json')).toBe(true);
    expect(files.has('types/5e-SRD-Monsters-Normalized.d.ts')).toBe(true);
  });

  it('are up to date with the Zod schemas (run "pnpm run generate")', async () => {
    expect(diff(await generate())).toEqual([]);
  });

  it('flags a stale, missing or orphaned file', async () => {
    const files = await generate();
    const [name, content] = [...files][0];
    expect(diff(new Map(files).set(name, `${content}// stale\n`))).toEqual([`stale: ${name}`]);
    expect(diff(new Map(files).set('schema/new.schema.json', '{}\n'))).toEqual([
      'missing: schema/new.schema.json',
    ]);
    const withoutFirst = new Map(files);
    withoutFirst.delete(name);
    expect(diff(withoutFirst)).toEqual([`orphaned: ${name}`]);
  });

  it(
    'ships schema/, types/ and ids/ in the npm package',
    () => {
      const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
        cwd: root,
        encoding: 'utf8',
      });
      const paths = (JSON.parse(out)[0].files as { path: string }[]).map((f) => f.path);
      expect(paths).toContain('schema/5e-SRD-Alignments.schema.json');
      expect(paths).toContain('schema/5e-SRD-Monsters-Normalized.schema.json');
      expect(paths).toContain('types/5e-SRD-Alignments.d.ts');
      expect(paths).toContain('types/5e-SRD-Monsters-Normalized.d.ts');
      expect(paths).toContain('ids/conditions.json');
      expect(paths).toContain('ids/monsters.json');
      expect(paths).toContain('ids/published.json');
      expect(paths).toContain('ids/removed.json');
      expect(fs.existsSync(path.join(root, 'schema'))).toBe(true);
    },
    20_000,
  );
});
