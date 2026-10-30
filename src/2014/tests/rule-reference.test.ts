import { describe, expect, it } from 'vitest';
import ConditionData from '../en/5e-SRD-Conditions.json' with { type: 'json' };
import RuleData from '../en/5e-SRD-Rules.json' with { type: 'json' };
import RuleSectionData from '../en/5e-SRD-Rule-Sections.json' with { type: 'json' };
import AnnotationData from '../rule-reference-annotations.json' with { type: 'json' };
import { deriveConditions, deriveRules, deriveRuleSections } from '../derive-rule-reference';

type Link = { collection: string; index: string };
type Rule = {
  index: string;
  name: string;
  desc: string;
  subsections: { index: string; name: string }[];
  order?: number;
  summary?: string;
  keywords?: string[];
};
type RuleSection = {
  index: string;
  name: string;
  desc: string;
  order?: number;
  summary?: string;
  keywords?: string[];
  related?: Link[];
};
type Condition = { index: string; name: string; exhaustion_level?: unknown; related?: Link[] };
type Annotation = {
  collection: string;
  index: string;
  related?: { to: string; anchor: string }[];
};

const rules = RuleData as unknown as Rule[];
const sections = RuleSectionData as unknown as RuleSection[];
const conditions = ConditionData as unknown as Condition[];
const annotations = AnnotationData as Annotation[];
const sectionByIndex = new Map(sections.map((section) => [section.index, section]));
const entries = [...rules, ...sections];

// The chapters of the SRD 5.1 in the order the document prints them.
const RULE_ORDER = [
  'equipment',
  'using-ability-scores',
  'adventuring',
  'combat',
  'spellcasting',
  'appendix',
];

const linkIndices = (links: Link[] | undefined) => (links ?? []).map((link) => link.index);
const words = (text: string) => text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
const countMatches = (text: string, name: string) =>
  ` ${text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .join(' ')} `.split(` ${name.toLowerCase()} `).length - 1;

describe('markdown subset of rules and rule sections', () => {
  const lines = entries.flatMap((entry) =>
    entry.desc
      .split('\n')
      .map((line, i, all) => ({ entry: entry.index, line, previous: all[i - 1] }))
  );

  it('uses only headings, lists, tables, paragraphs, bold and italic text', () => {
    const errors: string[] = [];
    for (const { entry, line } of lines) {
      if (/^\s/.test(line) && line.trim()) errors.push(`${entry}: indented line ${line}`);
      if (/^>|^```|^~~~|^([-*_]\s*){3,}$/.test(line)) errors.push(`${entry}: ${line}`);
      if (/^[*+] /.test(line)) errors.push(`${entry}: list marker in ${line}`);
      if (/<[a-z/!][^>]*>|!\[|\]\(|`|~~|<br/i.test(line)) errors.push(`${entry}: ${line}`);
      if (/^#+[^# ]/.test(line) || /^#{6,}/.test(line)) errors.push(`${entry}: ${line}`);
      if (/_[^_\s][^_]*_/.test(line.replace(/\w_\w/g, '')))
        errors.push(`${entry}: underscore ${line}`);
    }
    expect(errors).toEqual([]);
  });

  it('has the heading levels that docs/rule-reference.md lists', () => {
    for (const rule of rules) expect(rule.desc.startsWith(`# ${rule.name}\n`)).toBe(true);
    for (const section of sections) {
      expect(section.desc.startsWith(`## ${section.name}`)).toBe(true);
      const levels = section.desc
        .split('\n')
        .flatMap((line) => /^(#+) /.exec(line)?.[1].length ?? []);
      expect(Math.min(...levels)).toBe(2);
      expect(Math.max(...levels)).toBeLessThanOrEqual(5);
    }
  });

  it('writes lists as "- " items and "N.  " items, one item to a line', () => {
    for (const { entry, line, previous } of lines) {
      if (/^\d+\./.test(line)) expect(line, entry).toMatch(/^\d+\.  \S/);
      if (/^- /.test(line)) expect(line, entry).toMatch(/^- \S/);
      // A list does not run on from a paragraph line.
      if (/^(- |\d+\.  )/.test(line) && previous && !/^(- |\d+\.  )/.test(previous)) {
        expect(
          previous === '' || /:$/.test(previous) || /^#/.test(previous),
          `${entry}: ${line}`
        ).toBe(true);
      }
    }
  });

  it('writes tables as pipe rows with a header, a dashed separator and the same cells in every row', () => {
    let tables = 0;
    for (const entry of entries) {
      const rows = entry.desc.split('\n');
      for (let i = 0; i < rows.length; i++) {
        if (!rows[i].startsWith('|') || rows[i - 1]?.startsWith('|')) continue;
        let end = i;
        while (rows[end]?.startsWith('|')) end++;
        const table = rows.slice(i, end);
        tables++;
        expect(table.length, `${entry.index}: table of one row`).toBeGreaterThan(2);
        expect(table[1], `${entry.index}: separator`).toMatch(/^\|(\s*:?-+:?\s*\|)+$/);
        const cells = table.map((row) => row.replace(/^\||\|$/g, '').split('|').length);
        expect(new Set(cells).size, `${entry.index}: ${table[0]}`).toBe(1);
      }
    }
    expect(tables).toBe(21);
  });
});

describe('rule order', () => {
  it('numbers the rules 1 to 6 in the chapter order of the SRD', () => {
    const ordered = [...rules].sort((a, b) => a.order! - b.order!);
    expect(ordered.map((rule) => rule.index)).toEqual(RULE_ORDER);
    expect(ordered.map((rule) => rule.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('numbers the sections 1 to 33 in the order of the subsections of the rules', () => {
    const ordered = [...sections].sort((a, b) => a.order! - b.order!);
    const expected = RULE_ORDER.flatMap((index) =>
      rules.find((rule) => rule.index === index)!.subsections.map((s) => s.index)
    );
    expect(expected).toHaveLength(33);
    expect(ordered.map((section) => section.index)).toEqual(expected);
    expect(ordered.map((section) => section.order)).toEqual(expected.map((_, i) => i + 1));
  });
});

describe('keywords', () => {
  const keywordsInText = (desc: string) => {
    const found = new Set<string>();
    const add = (text: string) => {
      const keyword = text
        .replace(/\s+/g, ' ')
        .replace(/[.:,;]+$/, '')
        .trim()
        .toLowerCase();
      if (keyword.split(' ').length <= 5) found.add(keyword);
    };
    for (const match of desc.matchAll(/^#+ (.+)$/gm)) add(match[1]);
    for (const match of desc.matchAll(/\*\*+([^*\n]+)\*\*+/g)) add(match[1]);
    return found;
  };

  it('are lower case, unique, and without closing punctuation', () => {
    for (const entry of entries) {
      const keywords = entry.keywords!;
      expect(new Set(keywords).size, entry.index).toBe(keywords.length);
      for (const keyword of keywords) {
        expect(keyword, entry.index).toBe(keyword.toLowerCase().trim());
        expect(keyword, entry.index).not.toMatch(/[.:,;]$/);
      }
    }
  });

  it('of a rule section are its headings and bold terms, and all of them but the ones left out', () => {
    for (const section of sections) {
      const inText = keywordsInText(section.desc);
      const left =
        (annotations.find((a) => a.index === section.index) as { exclude_keywords?: string[] })
          .exclude_keywords ?? [];
      expect(new Set(section.keywords), section.index).toEqual(
        new Set([...inText].filter((keyword) => !left.includes(keyword)))
      );
      expect(section.keywords, section.index).toContain(section.name.toLowerCase());
    }
  });

  it('of a rule are its name and the names of its subsections', () => {
    for (const rule of rules) {
      expect(rule.keywords, rule.index).toEqual([
        ...new Set([rule.name, ...rule.subsections.map((s) => s.name)].map((n) => n.toLowerCase())),
      ]);
    }
  });
});

describe('summaries', () => {
  it('are one or two plain sentences', () => {
    for (const entry of entries) {
      expect(entry.summary, entry.index).toBeTruthy();
      expect(entry.summary, entry.index).toBe(entry.summary!.trim());
      expect(entry.summary!.length, entry.index).toBeLessThanOrEqual(220);
      expect(entry.summary, entry.index).not.toMatch(/[*#|\n]/);
      expect(entry.summary, entry.index).toMatch(/[.]$/);
    }
  });

  it('do not repeat a run of six words of the text they summarize', () => {
    for (const entry of entries) {
      const text = words(entry.desc);
      const own = words(entry.summary!);
      const runs = new Set<string>();
      for (let i = 0; i + 6 <= text.length; i++) runs.add(text.slice(i, i + 6).join(' '));
      for (let i = 0; i + 6 <= own.length; i++) {
        expect(
          runs.has(own.slice(i, i + 6).join(' ')),
          `${entry.index}: ${own.slice(i, i + 6).join(' ')}`
        ).toBe(false);
      }
    }
  });
});

describe('related links', () => {
  const allLinks = [
    ...sections.map((entry) => ({ entry, links: entry.related })),
    ...conditions.map((entry) => ({ entry, links: entry.related })),
  ];

  it('point at a rule section that exists, once each', () => {
    for (const { entry, links } of allLinks) {
      for (const link of links ?? []) {
        expect(Object.keys(link).sort(), entry.index).toEqual(['collection', 'index']);
        expect(link.collection, entry.index).toBe('rule-sections');
        expect(sectionByIndex.has(link.index), `${entry.index} -> ${link.index}`).toBe(true);
      }
      const indices = linkIndices(links);
      expect(new Set(indices).size, entry.index).toBe(indices.length);
    }
  });

  it('of a rule section never point at the section itself', () => {
    for (const section of sections)
      expect(linkIndices(section.related)).not.toContain(section.index);
  });

  it('are listed in reading order', () => {
    for (const { entry, links } of allLinks) {
      const orders = linkIndices(links).map((index) => sectionByIndex.get(index)!.order!);
      expect(orders, entry.index).toEqual([...orders].sort((a, b) => a - b));
    }
  });

  it('of a condition include every section that names it three times or in a heading', () => {
    for (const condition of conditions) {
      const name = condition.exhaustion_level ? 'Exhaustion' : condition.name;
      const expected = sections.filter(
        (section) =>
          countMatches(section.desc, name) >= 3 ||
          section.desc.split('\n').some((line) => /^#/.test(line) && countMatches(line, name) > 0)
      );
      for (const section of expected) {
        expect(linkIndices(condition.related), `${condition.index} -> ${section.index}`).toContain(
          section.index
        );
      }
    }
  });

  it('of a condition have a reason: a mention or a curated link, and the numbered exhaustion conditions share', () => {
    const exhaustion = conditions.find((condition) => condition.index === 'exhaustion')!;
    for (const condition of conditions) {
      const source = condition.exhaustion_level ? 'exhaustion' : condition.index;
      if (condition.exhaustion_level) {
        expect(linkIndices(condition.related)).toEqual(linkIndices(exhaustion.related));
      }
      const curated = annotations
        .filter((a) => a.collection === 'conditions' && a.index === source)
        .flatMap((a) => (a.related ?? []).map((r) => r.to));
      const name = conditions.find((c) => c.index === source)!.name;
      for (const link of linkIndices(condition.related)) {
        const section = sectionByIndex.get(link)!;
        const mentioned =
          countMatches(section.desc, name) >= 3 ||
          section.desc.split('\n').some((line) => /^#/.test(line) && countMatches(line, name) > 0);
        expect(mentioned || curated.includes(link), `${condition.index} -> ${link}`).toBe(true);
      }
    }
  });

  it('of a rule section quote a heading of that section or are curated', () => {
    for (const section of sections) {
      const curated = annotations
        .filter((a) => a.collection === 'rule-sections' && a.index === section.index)
        .flatMap((a) => (a.related ?? []).map((r) => r.to));
      const quoted = [...section.desc.matchAll(/["“]([^"”\n]+?)[.,]?["”]/g)].map((m) => m[1]);
      for (const link of linkIndices(section.related)) {
        const headings = sectionByIndex
          .get(link)!
          .desc.split('\n')
          .filter((l) => /^#/.test(l));
        const byQuote = quoted.some((text) => headings.some((h) => h.replace(/^#+ /, '') === text));
        expect(byQuote || curated.includes(link), `${section.index} -> ${link}`).toBe(true);
      }
    }
  });

  it('include every curated link, and each names a phrase of the section it points at', () => {
    for (const annotation of annotations.filter((a) => a.related)) {
      const holder =
        annotation.collection === 'conditions'
          ? conditions.filter(
              (c) =>
                c.index === annotation.index ||
                (annotation.index === 'exhaustion' && c.exhaustion_level)
            )
          : sections.filter((s) => s.index === annotation.index);
      expect(holder.length, annotation.index).toBeGreaterThan(0);
      for (const { to, anchor } of annotation.related!) {
        expect(sectionByIndex.get(to)?.desc, `${annotation.index} -> ${to}`).toContain(anchor);
        for (const entry of holder) {
          if (to !== entry.index) expect(linkIndices(entry.related)).toContain(to);
        }
      }
    }
  });

  it('link Grappled to the grappling rules and Prone to Being Prone', () => {
    const grappled = conditions.find((c) => c.index === 'grappled')!;
    expect(linkIndices(grappled.related)).toContain('making-an-attack');
    const prone = conditions.find((c) => c.index === 'prone')!;
    expect(linkIndices(prone.related)).toContain('movement-and-position');
  });
});

describe('derivation', () => {
  it('is what the data files hold (run "pnpm run derive:rules")', () => {
    expect(deriveRules(rules as never, sections as never)).toEqual(rules);
    expect(deriveRuleSections(sections as never, rules as never)).toEqual(sections);
    expect(deriveConditions(conditions as never, sections as never, rules as never)).toEqual(
      conditions
    );
  });
});
