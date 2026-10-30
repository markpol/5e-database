import fs from 'node:fs';
import path from 'node:path';
import { ENVIRONMENT_TAGS } from '../schemas/common';

// The `environment_tags` of src/2014/en/5e-SRD-Monsters.json: the terms of the `environments` text, in its order, as
// a list. docs/monster-environments.md describes the field and src/2014/tests/monster-environments.test.ts audits it.

type Monster = { index: string; environments?: string; environment_tags?: string[] };

const TERMS: readonly string[] = ENVIRONMENT_TAGS;

/** The terms of an `environments` text. Throws on a term outside the vocabulary or a repeated one. */
export function parseEnvironments(index: string, environments: string): string[] {
  const terms = environments.split(',').map((term) => term.trim());
  for (const term of terms) {
    if (!TERMS.includes(term)) throw new Error(`${index}: unknown environment "${term}"`);
  }
  if (new Set(terms).size !== terms.length) throw new Error(`${index}: repeated environment`);
  return terms;
}

export function deriveMonsterEnvironments<T extends Monster>(monsters: T[]): T[] {
  return monsters.map((monster) => {
    const { environment_tags: _previous, ...rest } = monster;
    return monster.environments
      ? ({ ...rest, environment_tags: parseEnvironments(monster.index, monster.environments) } as T)
      : (rest as T);
  });
}

// The English file escapes every non-ASCII character as \uXXXX, which JSON.stringify does not.
const escapeNonAscii = (json: string) =>
  json.replace(/[\u0080-￿]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);

const repoRoot = path.resolve(import.meta.dirname, '../..');
const monstersFile = path.join(repoRoot, 'src/2014/en/5e-SRD-Monsters.json');

function writeMonstersToFile() {
  const monsters = JSON.parse(fs.readFileSync(monstersFile, 'utf8')) as Monster[];
  const derived = deriveMonsterEnvironments(monsters);
  fs.writeFileSync(monstersFile, `${escapeNonAscii(JSON.stringify(derived, null, 2))}\n`);
  console.log(
    `Derived the environment tags of ${derived.filter((m) => m.environment_tags).length} monsters`
  );
}

if (process.argv[1]?.endsWith('/derive-monster-environments.ts')) {
  writeMonstersToFile();
}
