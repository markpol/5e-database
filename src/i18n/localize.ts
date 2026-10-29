/**
 * Localization of the 2014 data: merges a translation overlay over the English records.
 *
 * Which fields an overlay may replace is read from the emitted JSON Schema (`schema/*.schema.json`), where the Zod
 * schemas' `translatable()` mark appears as `"translatable": true`. Everything else (ids, urls, numbers, booleans,
 * reference objects) always comes from English. The `name` of a nested reference (`{ index, name, url }`) is resolved
 * from the referenced record's own translation, so it is never copied into an overlay.
 *
 * This module has no runtime dependencies: the caller supplies the English records, overlays and JSON Schemas (for
 * example as static JSON imports), so it runs in an app bundle as well as in Node. `src/i18n/files.ts` binds it to
 * the files in this repository.
 *
 * Translation overlays are not published in the package. With no overlay supplied for a locale (`overlay` returns
 * undefined), `localize()` returns the English records unchanged.
 */
import type { AbilityScore } from '../../types/5e-SRD-Ability-Scores';
import type { Alignment } from '../../types/5e-SRD-Alignments';
import type { Background } from '../../types/5e-SRD-Backgrounds';
import type { Class } from '../../types/5e-SRD-Classes';
import type { Condition } from '../../types/5e-SRD-Conditions';
import type { DamageType } from '../../types/5e-SRD-Damage-Types';
import type { EquipmentCategory } from '../../types/5e-SRD-Equipment-Categories';
import type { Equipment } from '../../types/5e-SRD-Equipment';
import type { Feat } from '../../types/5e-SRD-Feats';
import type { Feature } from '../../types/5e-SRD-Features';
import type { Language } from '../../types/5e-SRD-Languages';
import type { Level } from '../../types/5e-SRD-Levels';
import type { MagicItem } from '../../types/5e-SRD-Magic-Items';
import type { MagicSchool } from '../../types/5e-SRD-Magic-Schools';
import type { Monster } from '../../types/5e-SRD-Monsters';
import type { Proficiency } from '../../types/5e-SRD-Proficiencies';
import type { Race } from '../../types/5e-SRD-Races';
import type { RuleSection } from '../../types/5e-SRD-Rule-Sections';
import type { Rule } from '../../types/5e-SRD-Rules';
import type { Skill } from '../../types/5e-SRD-Skills';
import type { Spell } from '../../types/5e-SRD-Spells';
import type { Subclass } from '../../types/5e-SRD-Subclasses';
import type { Subrace } from '../../types/5e-SRD-Subraces';
import type { Trait } from '../../types/5e-SRD-Traits';
import type { WeaponProperty } from '../../types/5e-SRD-Weapon-Properties';

/** The record type of each localizable collection, keyed by the collection name used in urls and `ids/`. */
export interface CollectionRecords {
  'ability-scores': AbilityScore;
  alignments: Alignment;
  backgrounds: Background;
  classes: Class;
  conditions: Condition;
  'damage-types': DamageType;
  'equipment-categories': EquipmentCategory;
  equipment: Equipment;
  feats: Feat;
  features: Feature;
  languages: Language;
  levels: Level;
  'magic-items': MagicItem;
  'magic-schools': MagicSchool;
  monsters: Monster;
  proficiencies: Proficiency;
  races: Race;
  'rule-sections': RuleSection;
  rules: Rule;
  skills: Skill;
  spells: Spell;
  subclasses: Subclass;
  subraces: Subrace;
  traits: Trait;
  'weapon-properties': WeaponProperty;
}

export type Collection = keyof CollectionRecords;

/** The file base name of each collection: `src/2014/{lang}/{base}.json` and `schema/{base}.schema.json`. */
export const COLLECTION_FILES: Readonly<Record<Collection, string>> = {
  'ability-scores': '5e-SRD-Ability-Scores',
  alignments: '5e-SRD-Alignments',
  backgrounds: '5e-SRD-Backgrounds',
  classes: '5e-SRD-Classes',
  conditions: '5e-SRD-Conditions',
  'damage-types': '5e-SRD-Damage-Types',
  'equipment-categories': '5e-SRD-Equipment-Categories',
  equipment: '5e-SRD-Equipment',
  feats: '5e-SRD-Feats',
  features: '5e-SRD-Features',
  languages: '5e-SRD-Languages',
  levels: '5e-SRD-Levels',
  'magic-items': '5e-SRD-Magic-Items',
  'magic-schools': '5e-SRD-Magic-Schools',
  monsters: '5e-SRD-Monsters',
  proficiencies: '5e-SRD-Proficiencies',
  races: '5e-SRD-Races',
  'rule-sections': '5e-SRD-Rule-Sections',
  rules: '5e-SRD-Rules',
  skills: '5e-SRD-Skills',
  spells: '5e-SRD-Spells',
  subclasses: '5e-SRD-Subclasses',
  subraces: '5e-SRD-Subraces',
  traits: '5e-SRD-Traits',
  'weapon-properties': '5e-SRD-Weapon-Properties',
};

export const COLLECTIONS = Object.keys(COLLECTION_FILES) as Collection[];

export function isCollection(name: string): name is Collection {
  return Object.hasOwn(COLLECTION_FILES, name);
}

/** The JSON Schema keywords Zod emits for this repository's schemas; nothing else is read. */
export interface JsonSchema {
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  type?: string | string[];
  const?: unknown;
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  translatable?: boolean;
}

export type DataRecord = Record<string, unknown>;

/** Where a localizer reads its data. `overlay` returns undefined when a locale does not translate a collection. */
export interface LocalizationSource {
  english(collection: Collection): readonly DataRecord[];
  overlay(collection: Collection, lang: string): readonly DataRecord[] | undefined;
  schema(collection: Collection): JsonSchema;
}

export type Localize = <C extends Collection>(
  collection: C,
  lang: string
) => CollectionRecords[C][];

export function isPlainObject(value: unknown): value is DataRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Follows a local `$ref` (`#/$defs/name` or `#`) against the document root. */
export function deref(node: JsonSchema, root: JsonSchema): JsonSchema {
  let current = node;
  for (let depth = 0; current.$ref !== undefined; depth++) {
    if (depth > 32) throw new Error(`JSON Schema $ref cycle at ${current.$ref}`);
    const ref = current.$ref;
    if (ref === '#') current = root;
    else if (ref.startsWith('#/$defs/')) {
      const target = root.$defs?.[ref.slice('#/$defs/'.length)];
      if (!target) throw new Error(`Unresolved JSON Schema $ref ${ref}`);
      current = target;
    } else throw new Error(`Unsupported JSON Schema $ref ${ref}`);
  }
  return current;
}

/** The schema of an object property, or of a record value when the object is a `z.record`. */
export function propertySchema(node: JsonSchema, key: string): JsonSchema | undefined {
  if (node.properties && Object.hasOwn(node.properties, key)) return node.properties[key];
  return typeof node.additionalProperties === 'object' ? node.additionalProperties : undefined;
}

function typeMatches(type: string | string[], value: unknown): boolean {
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => {
    switch (t) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'integer':
        return Number.isInteger(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return isPlainObject(value);
      case 'null':
        return value === null;
      default:
        return false;
    }
  });
}

/** Whether a value conforms to a schema node. Used to pick the union branch that describes a value. */
export function matches(node: JsonSchema, value: unknown, root: JsonSchema): boolean {
  const n = deref(node, root);
  const branches = n.anyOf ?? n.oneOf;
  if (branches) return branches.some((b) => matches(b, value, root));
  if ('const' in n && n.const !== value) return false;
  if (n.enum && !n.enum.includes(value)) return false;
  if (n.type !== undefined && !typeMatches(n.type, value)) return false;
  if (Array.isArray(value)) return !n.items || value.every((v) => matches(n.items!, v, root));
  if (isPlainObject(value)) {
    if ((n.required ?? []).some((k) => !Object.hasOwn(value, k))) return false;
    return Object.entries(value).every(([k, v]) => {
      const child = propertySchema(n, k);
      if (!child) return n.additionalProperties !== false;
      return matches(child, v, root);
    });
  }
  return true;
}

/** Resolves `$ref` and, for a union, the branch that describes `value`; undefined when no branch does. */
export function select(
  node: JsonSchema | undefined,
  value: unknown,
  root: JsonSchema
): JsonSchema | undefined {
  if (!node) return undefined;
  const n = deref(node, root);
  const branches = n.anyOf ?? n.oneOf;
  if (!branches) return n;
  const branch = branches.find((b) => matches(b, value, root));
  return branch ? select(branch, value, root) : undefined;
}

const REFERENCE_URL = /^\/api\/\d{4}\/([^/]+)\/([^/]+)$/;

/**
 * The collection and index a nested reference (`{ index, name, url }`) points at, or undefined when the object is not
 * a reference to a record of a localizable collection. References to anything else, such as a class level
 * (`/api/2014/classes/cleric/levels/1`), keep their English name.
 */
export function referenceTarget(
  value: unknown
): { collection: Collection; index: string } | undefined {
  if (!isPlainObject(value)) return undefined;
  const { index, name, url } = value;
  if (typeof index !== 'string' || typeof name !== 'string' || typeof url !== 'string')
    return undefined;
  const match = REFERENCE_URL.exec(url);
  if (!match || match[2] !== index || !isCollection(match[1])) return undefined;
  return { collection: match[1], index };
}

/** Calls `visit` for each property of a record, skipping `index`, with its schema node. */
function recordProperties(
  schema: JsonSchema,
  record: DataRecord,
  visit: (key: string, node: JsonSchema | undefined) => void
): void {
  const root = deref(schema, schema);
  for (const key of Object.keys(record)) {
    if (key !== 'index') visit(key, propertySchema(root, key));
  }
}

type ResolveName = (collection: Collection, index: string) => string | undefined;

function mergeValue(
  node: JsonSchema | undefined,
  root: JsonSchema,
  english: unknown,
  overlay: unknown,
  resolveName: ResolveName
): unknown {
  const n = select(node, english, root);
  if (n?.translatable) return overlay === undefined || overlay === null ? english : overlay;
  if (Array.isArray(english)) {
    const items = n?.items;
    const over = Array.isArray(overlay) ? overlay : [];
    return english.map((e, i) => mergeValue(items, root, e, over[i], resolveName));
  }
  if (isPlainObject(english)) {
    const target = referenceTarget(english);
    if (target)
      return { ...english, name: resolveName(target.collection, target.index) ?? english.name };
    const over = isPlainObject(overlay) ? overlay : {};
    return Object.fromEntries(
      Object.entries(english).map(([k, v]) => [
        k,
        mergeValue(n && propertySchema(n, k), root, v, over[k], resolveName),
      ])
    );
  }
  return english;
}

/**
 * Merges one overlay record over its English record: translatable fields come from the overlay when present, every
 * other field from English, and the `name` of each nested reference from `resolveName` (English when it returns
 * undefined).
 */
export function mergeRecord(
  schema: JsonSchema,
  english: DataRecord,
  overlay: DataRecord | undefined,
  resolveName: ResolveName
): DataRecord {
  const merged: DataRecord = { ...english };
  recordProperties(schema, english, (key, node) => {
    merged[key] = mergeValue(node, schema, english[key], overlay?.[key], resolveName);
  });
  return merged;
}

/**
 * Returns `localize(collection, lang)`, which gives every English record of `collection` with the `lang` overlay
 * merged in. Records the overlay does not cover are returned in English, apart from reference names that resolve to
 * translated records. `lang` `en` returns the English records unchanged.
 */
export function createLocalizer(source: LocalizationSource): Localize {
  const overlays = new Map<string, Map<string, DataRecord>>();
  const overlayIndex = (collection: Collection, lang: string): Map<string, DataRecord> => {
    const key = `${lang}\u0000${collection}`;
    let byIndex = overlays.get(key);
    if (!byIndex) {
      byIndex = new Map(
        (source.overlay(collection, lang) ?? [])
          .filter((r) => typeof r.index === 'string')
          .map((r) => [r.index as string, r])
      );
      overlays.set(key, byIndex);
    }
    return byIndex;
  };

  return <C extends Collection>(collection: C, lang: string): CollectionRecords[C][] => {
    const english = source.english(collection);
    if (lang === 'en') return english as unknown as CollectionRecords[C][];
    const schema = source.schema(collection);
    const byIndex = overlayIndex(collection, lang);
    const resolveName: ResolveName = (target, index) => {
      const name = overlayIndex(target, lang).get(index)?.name;
      return typeof name === 'string' ? name : undefined;
    };
    return english.map((record) =>
      mergeRecord(schema, record, byIndex.get(record.index as string), resolveName)
    ) as unknown as CollectionRecords[C][];
  };
}

/** One piece of display text in a record: a translatable field or the name of a nested reference. */
export interface TextEntry {
  path: string;
  value: unknown;
  kind: 'field' | 'reference';
}

/**
 * Lists the display text of a record (for example an English record or a `localize()` result): the value of every
 * translatable field and the `name` of every nested reference, with its path (`desc`, `starting_equipment[0].desc`,
 * `skills[2].name`). The `index` and `url` of a reference are not text and are left out.
 */
export function textEntries(schema: JsonSchema, record: DataRecord): TextEntry[] {
  const out: TextEntry[] = [];
  const walk = (node: JsonSchema | undefined, value: unknown, path: string): void => {
    const n = select(node, value, schema);
    if (n?.translatable) {
      out.push({ path, value, kind: 'field' });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(n?.items, v, `${path}[${i}]`));
      return;
    }
    if (isPlainObject(value)) {
      if (referenceTarget(value) || isNamedReference(value)) {
        out.push({ path: `${path}.name`, value: value.name, kind: 'reference' });
        return;
      }
      for (const [k, v] of Object.entries(value))
        walk(n && propertySchema(n, k), v, `${path}.${k}`);
    }
  };
  recordProperties(schema, record, (key, node) => walk(node, record[key], key));
  return out;
}

/** A reference-shaped object whose url does not point at a localizable record (such as a class level). */
function isNamedReference(value: DataRecord): boolean {
  return (
    typeof value.index === 'string' &&
    typeof value.name === 'string' &&
    typeof value.url === 'string' &&
    value.url.startsWith('/api/')
  );
}
