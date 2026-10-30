import fs from 'node:fs';
import path from 'node:path';
import * as prettier from 'prettier';
import conditionData from './en/5e-SRD-Conditions.json' with { type: 'json' };
import spellData from './en/5e-SRD-Spells.json' with { type: 'json' };
import equipmentData from './en/5e-SRD-Equipment.json' with { type: 'json' };
import magicItemData from './en/5e-SRD-Magic-Items.json' with { type: 'json' };
import ruleData from './en/5e-SRD-Rules.json' with { type: 'json' };
import ruleSectionData from './en/5e-SRD-Rule-Sections.json' with { type: 'json' };
import annotationData from './rule-reference-annotations.json' with { type: 'json' };

// The reference fields of src/2014/en/5e-SRD-Rules.json and src/2014/en/5e-SRD-Rule-Sections.json (`order`,
// `summary`, `keywords`, and `related` on the sections), the `related` links of src/2014/en/5e-SRD-Conditions.json, and
// the `related` links of the spells, the equipment and the magic items. They are read from the markdown of `desc`, from
// the names of the conditions, spells and equipment and from properties of the spells and items, and merged with what
// rule-reference-annotations.json says by hand (the order of the rules, the summaries, the keywords to leave out and
// the links the text does not show). docs/rule-reference.md describes the rules and
// src/2014/tests/rule-reference.test.ts audits the result with rules that do not share code with the derivation.

type RuleLink = { collection: 'rule-sections'; index: string };
type Reference = { index: string; name: string; url: string };
type Rule = Reference & { desc: string; subsections: Reference[] };
type RuleSection = Reference & { desc: string };
type Condition = Reference & { exhaustion_level?: unknown };
type Spell = Reference & {
  level: number;
  ritual?: boolean;
  concentration?: boolean;
  dc?: unknown;
  attack_type?: unknown;
  area_of_effect?: unknown;
};
type Equipment = Reference & {
  equipment_category: { index: string };
  gear_category?: { index: string };
  weapon_range?: string;
  properties?: { index: string }[];
};
type MagicItem = Reference & {
  equipment_category: { index: string };
  desc?: string[];
  uses?: unknown;
};
type Curated = { to: string; anchor: string };
type Annotation = {
  collection: 'rules' | 'rule-sections' | 'conditions' | 'spells' | 'equipment' | 'magic-items';
  index: string;
  order?: number;
  summary?: string;
  exclude_keywords?: string[];
  related?: Curated[];
};

const annotations = annotationData as Annotation[];
const annotationOf = (collection: Annotation['collection'], index: string) =>
  annotations.find((entry) => entry.collection === collection && entry.index === index);

// A condition is linked to a section that names it at least this many times, or in a heading.
export const CONDITION_MENTIONS = 3;
// A keyword is at most this many words, which leaves out the bold sentences of a numbered list.
export const KEYWORD_MAX_WORDS = 5;

const ITALIC = /(?<![*\w])\*([^*\n]+?)\*(?![*\w])/g;
const HEADING = /^#{1,6}\s+(.+?)\s*$/;
const BOLD = /\*{2,3}([^*\n]+?)\*{2,3}/g;
const QUOTED = /["“]([^"”\n]{2,80}?)["”]/g;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordPattern = (name: string, flags: string) =>
  new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(name)}(?![A-Za-z0-9])`, flags);
const link = (index: string): RuleLink => ({ collection: 'rule-sections', index });
const withoutRelated = <T extends object>(entry: T) =>
  Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'related')) as T;

const headingsOf = (desc: string) =>
  desc.split('\n').flatMap((line) => HEADING.exec(line)?.[1] ?? []);

/** A keyword from a heading or a bold term: lower case, without the full stop that ends a run-in heading. */
function keywordOf(text: string): string {
  return text
    .replace(/[\s]+/g, ' ')
    .replace(/[.:,;]+$/, '')
    .trim()
    .toLowerCase();
}

function keywordsOfMarkdown(desc: string, excluded: string[] = []): string[] {
  const seen = new Set<string>();
  for (const line of desc.split('\n')) {
    const heading = HEADING.exec(line)?.[1];
    const terms = heading ? [heading] : [...line.matchAll(BOLD)].map((match) => match[1]);
    for (const term of terms) {
      const keyword = keywordOf(term);
      const words = keyword.split(' ').length;
      if (!keyword || words > KEYWORD_MAX_WORDS || excluded.includes(keyword)) continue;
      seen.add(keyword);
    }
  }
  return [...seen];
}

/** Reading order of the rules, and of the sections: the rules by their `order` annotation, the sections in their rule's list. */
export function readingOrder(rules: Rule[], sections: RuleSection[]) {
  const orderOf = (rule: Rule) => annotationOf('rules', rule.index)?.order;
  const orderedRules = [...rules].sort((a, b) => orderOf(a)! - orderOf(b)!);
  if (!orderedRules.every((rule, i) => orderOf(rule) === i + 1)) {
    throw new Error('The rules must have the orders 1 to the number of rules, once each');
  }
  const sectionOrder = orderedRules.flatMap((rule) =>
    rule.subsections.map((subsection) => subsection.index)
  );
  if (
    [...sectionOrder].sort().join() !==
    sections
      .map((section) => section.index)
      .sort()
      .join()
  ) {
    throw new Error('The subsections of the rules must list every rule section once');
  }
  return { rules: orderedRules.map((rule) => rule.index), sections: sectionOrder };
}

/** The sections that quote a heading of exactly one other section, as in the "Actions in Combat" section. */
function quotedLinks(section: RuleSection, sections: RuleSection[]): string[] {
  const headingsByIndex = new Map(sections.map((s) => [s.index, new Set(headingsOf(s.desc))]));
  const own = headingsByIndex.get(section.index)!;
  const found = new Set<string>();
  for (const match of section.desc.matchAll(QUOTED)) {
    const quoted = match[1].replace(/[.,]+$/, '');
    if (own.has(quoted)) continue;
    const targets = sections.filter((s) => headingsByIndex.get(s.index)!.has(quoted));
    if (targets.length === 1) found.add(targets[0].index);
  }
  return [...found];
}

/** The sections that name the condition at least `CONDITION_MENTIONS` times, or in a heading. */
function mentionLinks(name: string, sections: RuleSection[]): string[] {
  const pattern = wordPattern(name, 'gi');
  return sections
    .filter((section) => {
      const mentions = section.desc.match(pattern)?.length ?? 0;
      return (
        mentions >= CONDITION_MENTIONS || headingsOf(section.desc).some((h) => pattern.test(h))
      );
    })
    .map((section) => section.index);
}

function sortedLinks(indices: Iterable<string>, order: string[]): RuleLink[] {
  return [...new Set(indices)]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((index) => link(index));
}

function checkCurated(
  collection: Annotation['collection'],
  known: Set<string>,
  targets: Set<string>
) {
  for (const entry of annotations.filter((annotation) => annotation.collection === collection)) {
    if (!known.has(entry.index)) throw new Error(`${collection}: no such entry ${entry.index}`);
    for (const { to } of entry.related ?? []) {
      if (!targets.has(to)) throw new Error(`${entry.index}: no such rule section ${to}`);
    }
  }
}

export function deriveRules(rules: Rule[], sections: RuleSection[]) {
  const order = readingOrder(rules, sections);
  checkCurated('rules', new Set(order.rules), new Set(order.sections));
  return rules.map((rule) => {
    const keywords = new Set(
      [rule.name, ...rule.subsections.map((subsection) => subsection.name)].map(keywordOf)
    );
    return {
      ...rule,
      order: order.rules.indexOf(rule.index) + 1,
      summary: annotationOf('rules', rule.index)!.summary,
      keywords: [...keywords],
    };
  });
}

export function deriveRuleSections(sections: RuleSection[], rules: Rule[]) {
  const order = readingOrder(rules, sections);
  checkCurated('rule-sections', new Set(order.sections), new Set(order.sections));
  return sections.map((entry) => {
    const section = withoutRelated(entry);
    const annotation = annotationOf('rule-sections', section.index);
    const targets = [
      ...quotedLinks(section, sections),
      ...(annotation?.related ?? []).map(({ to }) => to),
    ].filter((index) => index !== section.index);
    const related = sortedLinks(targets, order.sections);
    return {
      ...section,
      order: order.sections.indexOf(section.index) + 1,
      summary: annotation!.summary,
      keywords: keywordsOfMarkdown(section.desc, annotation?.exclude_keywords),
      ...(related.length ? { related } : {}),
    };
  });
}

export function deriveConditions<T extends Condition>(
  conditions: T[],
  sections: RuleSection[],
  rules: Rule[]
): T[] {
  const order = readingOrder(rules, sections);
  const nameOf = new Map(conditions.map((condition) => [condition.index, condition.name]));
  checkCurated('conditions', new Set(nameOf.keys()), new Set(order.sections));
  return conditions.map((entry) => {
    const condition = withoutRelated(entry);
    // The numbered exhaustion conditions are the levels of `exhaustion` and link to the same sections.
    const source = condition.exhaustion_level ? 'exhaustion' : condition.index;
    const targets = [
      ...mentionLinks(nameOf.get(source)!, sections),
      ...(annotationOf('conditions', source)?.related ?? []).map(({ to }) => to),
    ];
    const related = sortedLinks(targets, order.sections);
    return related.length ? { ...condition, related } : condition;
  });
}

/** A link every entry gets that meets `when`, with the phrase of the target section that justifies it. */
type CategoryLink<T> = { when: (entry: T) => boolean; to: string; anchor: string };

export const SPELL_LINKS: CategoryLink<Spell>[] = [
  { when: (s) => s.level === 0, to: 'what-is-a-spell', anchor: 'Cantrips' },
  { when: (s) => s.level > 0, to: 'what-is-a-spell', anchor: 'Spell Slots' },
  { when: (s) => !!s.ritual, to: 'what-is-a-spell', anchor: 'Rituals' },
  { when: (s) => !!s.concentration, to: 'casting-a-spell', anchor: 'Concentration' },
  { when: (s) => !!s.dc, to: 'casting-a-spell', anchor: 'Spell Saving Throws' },
  { when: (s) => !!s.attack_type, to: 'casting-a-spell', anchor: 'Spell Attack Rolls' },
  { when: (s) => !!s.area_of_effect, to: 'casting-a-spell', anchor: 'Areas of Effect' },
];

const isWeapon = (e: Equipment) => e.equipment_category.index === 'weapon';
const isArmor = (e: Equipment) => e.equipment_category.index === 'armor';
const isFocus = (e: Equipment) =>
  ['arcane-foci', 'druidic-foci', 'holy-symbols'].includes(e.gear_category?.index ?? '');

export const EQUIPMENT_LINKS: CategoryLink<Equipment>[] = [
  { when: isWeapon, to: 'making-an-attack', anchor: 'Attack Rolls' },
  {
    when: (e) => e.weapon_range === 'Ranged' || e.gear_category?.index === 'ammunition',
    to: 'making-an-attack',
    anchor: 'Ranged Attacks',
  },
  {
    when: (e) => !!e.properties?.some((property) => property.index === 'light'),
    to: 'making-an-attack',
    anchor: 'Two-Weapon Fighting',
  },
  { when: isArmor, to: 'what-is-a-spell', anchor: 'Casting in Armor' },
  { when: isArmor, to: 'using-each-ability', anchor: 'Armor Class' },
  { when: isFocus, to: 'casting-a-spell', anchor: 'Material (M)' },
];

const ATTUNEMENT = /\(requires attunement/i;
const COMMAND_WORD = /command word/i;
const firstLine = (item: MagicItem) => item.desc?.[0] ?? '';

export const MAGIC_ITEM_LINKS: CategoryLink<MagicItem>[] = [
  { when: (i) => ATTUNEMENT.test(firstLine(i)), to: 'attunement', anchor: 'Attunement' },
  { when: (i) => !!i.uses, to: 'activating-an-item', anchor: 'Charges' },
  {
    when: (i) => COMMAND_WORD.test((i.desc ?? []).join(' ')),
    to: 'activating-an-item',
    anchor: 'Command Word',
  },
  {
    when: (i) => ['potion', 'scroll'].includes(i.equipment_category.index),
    to: 'activating-an-item',
    anchor: 'Consumables',
  },
  {
    when: (i) => i.equipment_category.index === 'scroll',
    to: 'activating-an-item',
    anchor: 'Spells',
  },
  {
    when: (i) => i.equipment_category.index === 'weapon',
    to: 'making-an-attack',
    anchor: 'Attack Rolls',
  },
  {
    when: (i) => i.equipment_category.index === 'armor',
    to: 'using-each-ability',
    anchor: 'Armor Class',
  },
];

/** The sections whose text writes the spell in italics, as the SRD does for a spell it refers to. */
function italicSpellLinks(name: string, sections: RuleSection[]): string[] {
  const wanted = name.toLowerCase();
  return sections
    .filter((section) =>
      [...section.desc.matchAll(ITALIC)].some((match) => match[1].trim().toLowerCase() === wanted)
    )
    .map((section) => section.index);
}

/**
 * The form(s) an equipment name takes in running text: without the parenthesis that gives the size or quantity, and
 * with "Spike, iron" turned around into "iron spike". Names of one word are left out; they are too often a common
 * word (Net, Chest, Lock, Rod, Staff, Arrow, Crystal, Book).
 */
function nameForms(name: string): string[] {
  const plain = name.replace(/\s*\([^)]*\)/g, '').trim();
  const comma = /^([^,]+), (.+)$/.exec(plain);
  const forms = comma ? [`${comma[2]} ${comma[1].toLowerCase()}`] : [plain];
  return forms.filter((form) => form.includes(' '));
}

/** The sections that write the name of the equipment, whole word and with the capitals of the name. */
function equipmentNameLinks(name: string, sections: RuleSection[]): string[] {
  const patterns = nameForms(name).map((form) => wordPattern(form, ''));
  return sections
    .filter((section) => patterns.some((pattern) => pattern.test(section.desc)))
    .map((section) => section.index);
}

function deriveRelated<T extends Reference>(
  collection: 'spells' | 'equipment' | 'magic-items',
  entries: T[],
  sections: RuleSection[],
  rules: Rule[],
  categories: CategoryLink<T>[],
  fromText: (entry: T) => string[]
): (T & { related?: RuleLink[] })[] {
  const order = readingOrder(rules, sections);
  checkCurated(collection, new Set(entries.map((entry) => entry.index)), new Set(order.sections));
  for (const { to } of categories) {
    if (!order.sections.includes(to)) throw new Error(`${collection}: no such rule section ${to}`);
  }
  return entries.map((entry) => {
    const item = withoutRelated(entry);
    const targets = [
      ...fromText(item),
      ...categories.filter(({ when }) => when(item)).map(({ to }) => to),
      ...(annotationOf(collection, item.index)?.related ?? []).map(({ to }) => to),
    ];
    const related = sortedLinks(targets, order.sections);
    return related.length ? { ...item, related } : item;
  });
}

export function deriveSpells<T extends Spell>(spells: T[], sections: RuleSection[], rules: Rule[]) {
  return deriveRelated(
    'spells',
    spells,
    sections,
    rules,
    SPELL_LINKS as CategoryLink<T>[],
    (spell) => italicSpellLinks(spell.name, sections)
  );
}

export function deriveEquipment<T extends Equipment>(
  equipment: T[],
  sections: RuleSection[],
  rules: Rule[]
) {
  return deriveRelated(
    'equipment',
    equipment,
    sections,
    rules,
    EQUIPMENT_LINKS as CategoryLink<T>[],
    (item) => equipmentNameLinks(item.name, sections)
  );
}

export function deriveMagicItems<T extends MagicItem>(
  items: T[],
  sections: RuleSection[],
  rules: Rule[]
) {
  return deriveRelated(
    'magic-items',
    items,
    sections,
    rules,
    MAGIC_ITEM_LINKS as CategoryLink<T>[],
    () => []
  );
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

/** The equipment and magic item files are kept as `JSON.stringify` writes them, as the other derivations do. */
const writePlain = (file: string, data: unknown) =>
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);

async function writeToFiles() {
  const rules = ruleData as unknown as Rule[];
  const sections = ruleSectionData as unknown as RuleSection[];
  const conditions = conditionData as unknown as Condition[];
  const spells = spellData as unknown as Spell[];
  const equipment = equipmentData as unknown as Equipment[];
  const magicItems = magicItemData as unknown as MagicItem[];
  await writeJson(dataFile('Rules'), deriveRules(rules, sections));
  await writeJson(dataFile('Rule-Sections'), deriveRuleSections(sections, rules));
  await writeJson(dataFile('Conditions'), deriveConditions(conditions, sections, rules));
  await writeJson(dataFile('Spells'), deriveSpells(spells, sections, rules));
  writePlain(dataFile('Equipment'), deriveEquipment(equipment, sections, rules));
  writePlain(dataFile('Magic-Items'), deriveMagicItems(magicItems, sections, rules));
  console.log(
    `Derived the reference fields of ${rules.length} rules, ${sections.length} rule sections, ${conditions.length} conditions, ${spells.length} spells, ${equipment.length} equipment items and ${magicItems.length} magic items`
  );
}

if (process.argv[1]?.endsWith('/derive-rule-reference.ts')) {
  await writeToFiles();
}
