/**
 * Overlay rules: an overlay record holds its `index` plus translatable text only, shaped like the English record.
 * Nested objects and arrays keep the English nesting so the text lands on the right element; an array position with
 * nothing to translate is `null`.
 */
import {
  deref,
  isPlainObject,
  propertySchema,
  matches,
  referenceTarget,
  select,
  type DataRecord,
  type JsonSchema,
} from './localize';

/** Whether any node reachable from `node` is translatable. */
export function containsTranslatable(
  node: JsonSchema,
  root: JsonSchema,
  seen = new Set<JsonSchema>()
): boolean {
  const n = deref(node, root);
  if (n.translatable) return true;
  if (seen.has(n)) return false;
  seen.add(n);
  const children = [
    ...(n.anyOf ?? []),
    ...(n.oneOf ?? []),
    ...Object.values(n.properties ?? {}),
    ...(n.items ? [n.items] : []),
    ...(typeof n.additionalProperties === 'object' ? [n.additionalProperties] : []),
  ];
  return children.some((c) => containsTranslatable(c, root, seen));
}

function stripValue(
  node: JsonSchema | undefined,
  root: JsonSchema,
  english: unknown,
  overlay: unknown
): unknown {
  if (overlay === undefined || overlay === null) return undefined;
  const n = select(node, english, root);
  if (!n) return undefined;
  if (n.translatable) return overlay;
  if (Array.isArray(english)) {
    if (!Array.isArray(overlay)) return undefined;
    const items = english.map((e, i) => stripValue(n.items, root, e, overlay[i]));
    while (items.length && items[items.length - 1] === undefined) items.pop();
    return items.length ? items.map((v) => (v === undefined ? null : v)) : undefined;
  }
  if (isPlainObject(english)) {
    if (referenceTarget(english) || !isPlainObject(overlay)) return undefined;
    const out: DataRecord = {};
    for (const [k, v] of Object.entries(english)) {
      const stripped = stripValue(propertySchema(n, k), root, v, overlay[k]);
      if (stripped !== undefined) out[k] = stripped;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

/**
 * Reduces an overlay record to what it may contain: its `index` and the translatable text that sits at a position
 * the English record has. Returns undefined when nothing translatable is left.
 */
export function stripOverlayRecord(
  schema: JsonSchema,
  english: DataRecord,
  overlay: DataRecord
): DataRecord | undefined {
  const root = deref(schema, schema);
  const out: DataRecord = { index: overlay.index };
  for (const [k, v] of Object.entries(english)) {
    if (k === 'index') continue;
    const stripped = stripValue(propertySchema(root, k), schema, v, overlay[k]);
    if (stripped !== undefined) out[k] = stripped;
  }
  return Object.keys(out).length > 1 ? out : undefined;
}

function describe(node: JsonSchema): string {
  if (node.type) return Array.isArray(node.type) ? node.type.join(' or ') : node.type;
  return 'a different value';
}

function checkValue(
  node: JsonSchema | undefined,
  root: JsonSchema,
  english: unknown,
  overlay: unknown,
  path: string,
  problems: string[]
): void {
  if (overlay === undefined) return;
  const n = select(node, english, root);
  if (!n) {
    problems.push(`${path}: no schema describes the English value`);
    return;
  }
  if (n.translatable) {
    if (!matches(n, overlay, root)) problems.push(`${path}: expected ${describe(n)}`);
    return;
  }
  if (referenceTarget(english)) {
    problems.push(`${path}: a reference; its name comes from the referenced record's translation`);
    return;
  }
  if (!containsTranslatable(n, root)) {
    problems.push(`${path}: not translatable; it always comes from English`);
    return;
  }
  if (Array.isArray(english)) {
    if (!Array.isArray(overlay)) {
      problems.push(`${path}: expected an array shaped like the English one`);
      return;
    }
    if (overlay.length > english.length) {
      problems.push(`${path}: ${overlay.length} entries, but English has ${english.length}`);
    }
    overlay.forEach((v, i) => {
      if (v !== null && i < english.length) {
        checkValue(n.items, root, english[i], v, `${path}[${i}]`, problems);
      }
    });
    return;
  }
  if (isPlainObject(english)) {
    if (!isPlainObject(overlay)) {
      problems.push(`${path}: expected an object shaped like the English one`);
      return;
    }
    for (const [k, v] of Object.entries(overlay)) {
      if (!Object.hasOwn(english, k)) problems.push(`${path}.${k}: not in the English record`);
      else checkValue(propertySchema(n, k), root, english[k], v, `${path}.${k}`, problems);
    }
  }
}

/**
 * Checks one overlay record against its English record and returns the problems, each prefixed with the field path.
 * An overlay may hold only translatable text at positions the English record has; `null` marks an array position
 * left untranslated.
 */
export function validateOverlayRecord(
  schema: JsonSchema,
  english: DataRecord,
  overlay: DataRecord
): string[] {
  const root = deref(schema, schema);
  const problems: string[] = [];
  for (const [k, v] of Object.entries(overlay)) {
    if (k === 'index') continue;
    if (!Object.hasOwn(english, k)) problems.push(`${k}: not in the English record`);
    else checkValue(propertySchema(root, k), schema, english[k], v, k, problems);
  }
  if (Object.keys(overlay).length === 1) problems.push('no translated fields; remove the entry');
  return problems;
}

/**
 * Checks a whole overlay file: every entry needs a unique `index` that exists in English, and every entry must pass
 * `validateOverlayRecord`.
 */
export function validateOverlay(
  schema: JsonSchema,
  english: readonly DataRecord[],
  overlay: readonly unknown[]
): string[] {
  const byIndex = new Map(english.map((r) => [r.index, r]));
  const seen = new Set<string>();
  const problems: string[] = [];
  overlay.forEach((entry, i) => {
    if (!isPlainObject(entry) || typeof entry.index !== 'string') {
      problems.push(`[${i}]: entry needs a string 'index'`);
      return;
    }
    const where = `['${entry.index}']`;
    if (seen.has(entry.index)) problems.push(`${where}: duplicate index`);
    seen.add(entry.index);
    const en = byIndex.get(entry.index);
    if (!en) {
      problems.push(`${where}: index is not in the English file`);
      return;
    }
    for (const p of validateOverlayRecord(schema, en, entry)) problems.push(`${where}.${p}`);
  });
  return problems;
}
