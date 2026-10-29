import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import { buildExports } from '../../../scripts/package-exports';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  exports: Record<string, string | { types?: string; default: string }>;
  files: string[];
};

describe('package exports map', () => {
  it('matches scripts/package-exports.ts (run `pnpm run exports:write` after adding a collection)', () => {
    expect(pkg.exports).toEqual(buildExports());
  });

  it('points every non-pattern target at a file that exists', () => {
    for (const [key, target] of Object.entries(pkg.exports)) {
      const targets = typeof target === 'string' ? [target] : Object.values(target);
      for (const t of targets.filter((t) => !t.includes('*'))) {
        expect(fs.existsSync(path.join(root, t)), `${key} -> ${t}`).toBe(true);
      }
    }
  });

  it('gives each typed entry the collection type from types/ and the data file', () => {
    expect(pkg.exports['./monsters']).toEqual({
      types: './types/5e-SRD-Monsters.d.ts',
      default: './src/2014/en/5e-SRD-Monsters.json',
    });
    expect(pkg.exports['./monsters-normalized']).toEqual({
      types: './types/5e-SRD-Monsters-Normalized.d.ts',
      default: './src/2014/5e-SRD-Monsters-Normalized.json',
    });
  });

  it('does not export translation overlay folders', () => {
    const targets = Object.values(pkg.exports).flatMap((t) =>
      typeof t === 'string' ? [t] : Object.values(t)
    );
    for (const locale of ['fr-FR', 'pt-BR', 'ru']) {
      expect(
        [...Object.keys(pkg.exports), ...targets].filter((s) => s.split('/').includes(locale))
      ).toEqual([]);
    }
  });

  it('does not publish translation overlay folders', () => {
    for (const locale of ['fr-FR', 'pt-BR', 'ru']) {
      expect(pkg.files.filter((f) => f.split('/').includes(locale))).toEqual([]);
    }
    // Only the English folder of a year is published.
    expect(
      pkg.files.filter(
        (f) =>
          /^src\/\d{4}\//.test(f) &&
          !f.startsWith('src/2014/en/') &&
          f !== 'src/2014/5e-SRD-Monsters-Normalized.json'
      )
    ).toEqual([]);
  });

  it('only exports files the package ships', () => {
    // Every exported directory must be covered by a `files` pattern, or the entry would not resolve after install.
    for (const target of Object.values(pkg.exports)) {
      const paths = (typeof target === 'string' ? [target] : Object.values(target)).map((t) =>
        t.replace(/^\.\//, '')
      );
      for (const p of paths.filter((p) => p !== 'package.json')) {
        const shipped = pkg.files.some((pattern) => {
          const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '[^/]*');
          const re = new RegExp(`^${escaped}$`);
          return re.test(p.replace(/\*/g, 'x'));
        });
        expect(shipped, `${p} is not covered by "files"`).toBe(true);
      }
    }
  });
});
