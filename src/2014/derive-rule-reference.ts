import fs from 'node:fs';
import path from 'node:path';
import * as prettier from 'prettier';
import conditionData from './en/5e-SRD-Conditions.json' with { type: 'json' };
import ruleData from './en/5e-SRD-Rules.json' with { type: 'json' };
import ruleSectionData from './en/5e-SRD-Rule-Sections.json' with { type: 'json' };
import annotationData from './rule-reference-annotations.json' with { type: 'json' };

// The reference fields of src/2014/en/5e-SRD-Rules.json and src/2014/en/5e-SRD-Rule-Sections.json (`order`,
// `summary`, `keywords`, and `related` on the sections) and the `related` links of src/2014/en/5e-SRD-Conditions.json.
// They are read from the markdown of `desc` and from the names of the conditions, and merged with what
// rule-reference-annotations.json says by hand (the order of the rules, the summaries, the keywords to leave out and
// the links the text does not show). docs/rule-reference.md describes the rules and
// src/2014/tests/rule-reference.test.ts audits the result with rules that do not share code with the derivation.

type RuleLink = { collection: 'rule-sections'; index: string };
type Reference = { index: string; name: string; url: string };
type Rule = Reference & { desc: string; subsections: Reference[] };
type RuleSection = Reference & { desc: string };
type Condition = Reference & { exhaustion_level?: unknown };
type Curated = { to: string; anchor: string };
type Annotation = {
  collection: 'rules' | 'rule-sections' | 'conditions';
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

const repoRoot = path.resolve(import.meta.dirname, '../..');
const dataFile = (name: string) => path.join(repoRoot, 'src/2014/en', `5e-SRD-${name}.json`);

async function writeToFiles() {
  const rules = ruleData as unknown as Rule[];
  const sections = ruleSectionData as unknown as RuleSection[];
  const conditions = conditionData as unknown as Condition[];
  const conditionFile = dataFile('Conditions');
  const conditionJson = JSON.stringify(deriveConditions(conditions, sections, rules), null, 2);
  const options = await prettier.resolveConfig(conditionFile);
  fs.writeFileSync(dataFile('Rules'), `${JSON.stringify(deriveRules(rules, sections), null, 2)}\n`);
  fs.writeFileSync(
    dataFile('Rule-Sections'),
    `${JSON.stringify(deriveRuleSections(sections, rules), null, 2)}\n`
  );
  fs.writeFileSync(
    conditionFile,
    await prettier.format(conditionJson, { ...options, filepath: conditionFile })
  );
  console.log(
    `Derived the reference fields of ${rules.length} rules, ${sections.length} rule sections and ${conditions.length} conditions`
  );
}

if (process.argv[1]?.endsWith('/derive-rule-reference.ts')) {
  await writeToFiles();
}
