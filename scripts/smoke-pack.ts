/**
 * Package smoke test (`pnpm run test:package`): packs the package the way a git or tarball install sees it, installs the
 * tarball into a temporary project, then
 *   - imports every typed entry and several old deep paths at runtime (Node resolves them through `exports`),
 *   - type-checks a consumer file that uses every entry (tsc, `moduleResolution: Bundler`),
 *   - checks that translation overlay folders are not exported.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  name: string;
  exports: Record<string, string | { types?: string; default: string }>;
};
const name = pkg.name;
const tsc = path.join(root, 'node_modules/typescript/bin/tsc');

/** `./damage-types` -> `damage-types`, for each typed entry (an exports object with a `types` condition). */
const typedEntries = Object.entries(pkg.exports)
  .filter(([key, target]) => typeof target === 'object' && target.types && !key.includes('*'))
  .map(([key]) => key.slice(2));

/** Old deep paths that must keep resolving for one major version. */
const oldDeepPaths = [
  'src/2014/en/5e-SRD-Spells.json',
  'src/2014/en/5e-SRD-Monsters.json',
  'src/2014/5e-SRD-Monsters-Normalized.json',
  'src/provenance/source-markers.json',
  'schema/5e-SRD-Spells.schema.json',
  'ids/conditions.json',
];

const run = (cmd: string, args: string[], cwd: string) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-srd-smoke-'));
try {
  const packed = JSON.parse(
    run('npm', ['pack', '--json', '--pack-destination', work, '--ignore-scripts'], root)
  ) as {
    filename: string;
    files: { path: string }[];
  }[];
  const tarball = path.join(work, packed[0].filename);
  const shipped = new Set(packed[0].files.map((f) => f.path));
  for (const required of ['LICENSE.md', 'NOTICE.md', 'package.json', 'src/i18n/localize.ts']) {
    if (!shipped.has(required)) throw new Error(`${required} is missing from the tarball`);
  }

  const project = path.join(work, 'consumer');
  fs.mkdirSync(project);
  fs.writeFileSync(
    path.join(project, 'package.json'),
    JSON.stringify({ name: 'consumer', private: true, type: 'module' })
  );
  run('npm', ['install', '--no-audit', '--no-fund', '--ignore-scripts', tarball], project);
  const installed = path.join(project, 'node_modules', ...name.split('/'));
  if (!fs.existsSync(installed)) throw new Error(`${name} was not installed`);

  // Runtime: every typed entry and the old deep paths load as JSON through the exports map.
  const imports = [...typedEntries, ...oldDeepPaths].map(
    (p, i) => `import d${i} from '${name}/${p}' with { type: 'json' };`
  );
  const count = typedEntries.length + oldDeepPaths.length;
  fs.writeFileSync(
    path.join(project, 'runtime.mjs'),
    `${imports.join('\n')}
const all = [${Array.from({ length: count }, (_, i) => `d${i}`).join(', ')}];
const empty = all.map((d, i) => [d, i]).filter(([d]) => d == null || (Array.isArray(d) && d.length === 0));
if (empty.length) throw new Error('empty entries: ' + empty.map(([, i]) => i));
for (const p of ['src/2014/fr-FR/5e-SRD-Spells.json', 'src/2014/pt-BR/5e-SRD-Spells.json', 'src/2014/ru/5e-SRD-Spells.json']) {
  const ok = await import('${name}/' + p, { with: { type: 'json' } }).then(() => false, (e) => e.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED');
  if (!ok) throw new Error(p + ' must not be exported');
}
console.log('runtime ok:', all.length, 'entries');
`
  );
  console.log(run('node', ['runtime.mjs'], project).trim());

  // Types: a consumer that uses every entry with its generated type, in bundler resolution.
  const lines = [
    ...typedEntries.map((e, i) => `import t${i} from '${name}/${e}';`),
    ...oldDeepPaths
      .filter((p) => p.endsWith('.json'))
      .map((p, i) => `import o${i} from '${name}/${p}';`),
    `import type { Monster } from '${name}/types/5e-SRD-Monsters';`,
    `import { createLocalizer } from '${name}/src/i18n/localize';`,
    ...typedEntries.map((_, i) => `const first${i}: (typeof t${i})[number] = t${i}[0];`),
    `export const monster: Monster = t${typedEntries.indexOf('monsters')}[0];`,
    `export const index: string = t${typedEntries.indexOf('monsters')}[0].index;`,
    `// @ts-expect-error not any: a field that is not on the type must not type-check`,
    `export const bogus: string = t${typedEntries.indexOf('monsters')}[0].no_such_field;`,
    `void [${oldDeepPaths
      .filter((p) => p.endsWith('.json'))
      .map((_, i) => `o${i}`)
      .join(', ')}, createLocalizer, ${typedEntries.map((_, i) => `first${i}`).join(', ')}];`,
  ];
  fs.writeFileSync(path.join(project, 'consumer.ts'), `${lines.join('\n')}\n`);
  fs.writeFileSync(
    path.join(project, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        resolveJsonModule: true,
        strict: true,
        noEmit: true,
        types: [],
      },
      files: ['consumer.ts'],
    })
  );
  run('node', [tsc, '-p', 'tsconfig.json'], project);
  console.log(`types ok: ${typedEntries.length} typed entries`);
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
