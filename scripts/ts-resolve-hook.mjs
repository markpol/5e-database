// Node resolve hook: lets the generator import the extensionless `.ts` schema modules
// (e.g. `'../../schemas/common'`) under `--experimental-strip-types`.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && context.parentURL && !/\.\w+$/.test(specifier)) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(fileURLToPath(candidate))) {
      return nextResolve(candidate.href, context);
    }
  }
  return nextResolve(specifier, context);
}
