import { describe, expect, it } from 'vitest';
import EquipmentData from '../en/5e-SRD-Equipment.json' with { type: 'json' };
import MagicItemData from '../en/5e-SRD-Magic-Items.json' with { type: 'json' };
import RuleData from '../en/5e-SRD-Rules.json' with { type: 'json' };
import RuleSectionData from '../en/5e-SRD-Rule-Sections.json' with { type: 'json' };
import SpellData from '../en/5e-SRD-Spells.json' with { type: 'json' };
import AnnotationData from '../rule-reference-annotations.json' with { type: 'json' };
import { deriveEquipment, deriveMagicItems, deriveSpells } from '../derive-rule-reference';

type Link = { collection: string; index: string };
type Entry = {
  index: string;
  name: string;
  related?: Link[];
  desc?: string[];
  level?: number;
  ritual?: boolean;
  concentration?: boolean;
  dc?: unknown;
  attack_type?: unknown;
  area_of_effect?: unknown;
  equipment_category?: { index: string };
  gear_category?: { index: string };
  weapon_range?: string;
  properties?: { index: string }[];
  uses?: unknown;
};
type Section = { index: string; desc: string; order: number };
type Annotation = { collection: string; index: string; related?: { to: string; anchor: string }[] };

const spells = SpellData as unknown as Entry[];
const equipment = EquipmentData as unknown as Entry[];
const magicItems = MagicItemData as unknown as Entry[];
const sections = RuleSectionData as unknown as Section[];
const annotations = AnnotationData as unknown as Annotation[];
const sectionByIndex = new Map(sections.map((section) => [section.index, section]));

const collections = { spells, equipment, 'magic-items': magicItems };
const indices = (entry: Entry) => (entry.related ?? []).map((link) => link.index);
const curated = (collection: string, index: string) =>
  annotations
    .filter((a) => a.collection === collection && a.index === index)
    .flatMap((a) => (a.related ?? []).map((r) => r.to));
const hasAnchor = (to: string, anchor: string) => sectionByIndex.get(to)!.desc.includes(anchor);

describe('related links of spells, equipment and magic items', () => {
  it('have the counts the documentation gives', () => {
    expect([spells.length, equipment.length, magicItems.length]).toEqual([319, 197, 362]);
    const linked = (entries: Entry[]) => entries.filter((entry) => entry.related).length;
    expect(linked(spells)).toBe(319);
    expect(linked(equipment)).toBe(93);
    expect(linked(magicItems)).toBe(291);
  });

  for (const [collection, entries] of Object.entries(collections)) {
    it(`of ${collection} resolve to a rule section, once each, in reading order`, () => {
      for (const entry of entries) {
        for (const link of entry.related ?? []) {
          expect(Object.keys(link).sort(), entry.index).toEqual(['collection', 'index']);
          expect(link.collection, entry.index).toBe('rule-sections');
          expect(sectionByIndex.has(link.index), `${entry.index} -> ${link.index}`).toBe(true);
        }
        expect(new Set(indices(entry)).size, entry.index).toBe(indices(entry).length);
        const orders = indices(entry).map((index) => sectionByIndex.get(index)!.order);
        expect(orders, entry.index).toEqual([...orders].sort((a, b) => a - b));
      }
    });
  }

  it('of a spell are never empty, and the other collections leave out an empty list', () => {
    for (const spell of spells) expect(spell.related?.length, spell.index).toBeGreaterThan(0);
    for (const entry of [...equipment, ...magicItems]) {
      if (!('related' in entry)) continue;
      expect(entry.related!.length).toBeGreaterThan(0);
    }
  });

  it('include every curated link, and each names a phrase of the section it points at', () => {
    for (const annotation of annotations.filter((a) => a.related && a.collection in collections)) {
      const entry = collections[annotation.collection as keyof typeof collections].find(
        (e) => e.index === annotation.index
      );
      expect(entry, annotation.index).toBeDefined();
      for (const { to, anchor } of annotation.related!) {
        expect(hasAnchor(to, anchor), `${annotation.index} -> ${to}: ${anchor}`).toBe(true);
        expect(indices(entry!), `${annotation.index} -> ${to}`).toContain(to);
      }
    }
  });
});

describe('related links of spells', () => {
  const italics = (desc: string) =>
    [...desc.matchAll(/(?<![*\w])\*([^*\n]+?)\*(?![*\w])/g)].map((m) => m[1].trim().toLowerCase());
  const mentioning = (spell: Entry) =>
    sections
      .filter((section) => italics(section.desc).includes(spell.name.toLowerCase()))
      .map((section) => section.index);

  it('include the sections that write the spell name in italics', () => {
    const mentioned = spells.filter((spell) => mentioning(spell).length);
    expect(mentioned.length).toBe(39);
    for (const spell of mentioned) {
      for (const index of mentioning(spell)) expect(indices(spell), spell.index).toContain(index);
    }
    expect(indices(spells.find((s) => s.index === 'fly')!)).toContain('movement-and-position');
    expect(indices(spells.find((s) => s.index === 'web')!)).toContain('actions-in-combat');
    expect(indices(spells.find((s) => s.index === 'revivify')!)).toContain('damage-and-healing');
  });

  it('do not match the plain words that are also spell names', () => {
    for (const name of ['light', 'gate', 'command', 'bane', 'resistance', 'jump', 'slow']) {
      const spell = spells.find((s) => s.name.toLowerCase() === name)!;
      expect(mentioning(spell), name).toEqual(
        expect.not.arrayContaining(['the-environment', 'time'])
      );
    }
  });

  it('follow the casting rules of the spell: concentration, ritual, cantrip, save, attack and area', () => {
    for (const spell of spells) {
      const links = indices(spell);
      const expected: [boolean, string, string][] = [
        [spell.concentration === true, 'casting-a-spell', 'Concentration'],
        [spell.ritual === true, 'what-is-a-spell', 'Rituals'],
        [spell.level === 0, 'what-is-a-spell', 'Cantrips'],
        [spell.level! > 0, 'what-is-a-spell', 'Spell Slots'],
        [!!spell.dc, 'casting-a-spell', 'Spell Saving Throws'],
        [!!spell.attack_type, 'casting-a-spell', 'Spell Attack Rolls'],
        [!!spell.area_of_effect, 'casting-a-spell', 'Areas of Effect'],
      ];
      for (const [applies, to, anchor] of expected) {
        if (applies) {
          expect(links, `${spell.index} -> ${to}`).toContain(to);
          expect(hasAnchor(to, anchor)).toBe(true);
        }
      }
    }
  });

  it('give each link a reason: an italic mention, a property of the spell or a curated entry', () => {
    for (const spell of spells) {
      const reasons = new Set<string>([
        ...mentioning(spell),
        ...curated('spells', spell.index),
        'what-is-a-spell',
      ]);
      if (spell.concentration || spell.dc || spell.attack_type || spell.area_of_effect)
        reasons.add('casting-a-spell');
      for (const index of indices(spell)) {
        expect(reasons.has(index), `${spell.index} -> ${index}`).toBe(true);
      }
    }
  });
});

describe('related links of equipment', () => {
  const nameForms = (name: string) => {
    const plain = name.replace(/\s*\([^)]*\)/g, '').trim();
    const comma = /^([^,]+), (.+)$/.exec(plain);
    return (comma ? [`${comma[2]} ${comma[1].toLowerCase()}`] : [plain]).filter((f) =>
      f.includes(' ')
    );
  };
  const named = (item: Entry) =>
    sections
      .filter((section) =>
        nameForms(item.name).some((form) =>
          new RegExp(
            `(?<![A-Za-z0-9])${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9])`
          ).test(section.desc)
        )
      )
      .map((section) => section.index);

  it('link every weapon to the attack rules, ranged weapons and ammunition to Ranged Attacks, light weapons to Two-Weapon Fighting', () => {
    for (const item of equipment) {
      if (item.equipment_category?.index === 'weapon') {
        expect(indices(item), item.index).toContain('making-an-attack');
      }
    }
    expect(equipment.filter((e) => e.equipment_category?.index === 'weapon').length).toBe(37);
    expect(hasAnchor('making-an-attack', 'Ranged Attacks')).toBe(true);
    expect(hasAnchor('making-an-attack', 'Two-Weapon Fighting')).toBe(true);
  });

  it('link every armor and shield to Casting in Armor and Armor Class', () => {
    const armor = equipment.filter((e) => e.equipment_category?.index === 'armor');
    expect(armor.map((e) => e.index)).toContain('shield');
    for (const item of armor) {
      expect(indices(item), item.index).toEqual(
        expect.arrayContaining(['what-is-a-spell', 'using-each-ability'])
      );
    }
  });

  it('link the poisons to poisons, and the foci to the components', () => {
    for (const index of ['poison-basic-vial', 'antitoxin-vial', 'poisoners-kit']) {
      expect(indices(equipment.find((e) => e.index === index)!), index).toContain('poisons');
    }
    for (const item of equipment.filter((e) =>
      ['arcane-foci', 'druidic-foci', 'holy-symbols'].includes(e.gear_category?.index ?? '')
    )) {
      expect(indices(item), item.index).toContain('casting-a-spell');
    }
  });

  it('match the name of an item only with its whole words, its capitals and more than one word', () => {
    // These one-word names are ordinary words in the rules text.
    for (const index of ['net', 'chest', 'lock', 'rod', 'staff', 'arrow', 'crystal', 'book']) {
      const item = equipment.find((e) => e.index === index)!;
      expect(nameForms(item.name), index).toEqual([]);
    }
    for (const item of equipment) {
      for (const index of named(item))
        expect(indices(item), `${item.index} -> ${index}`).toContain(index);
    }
    expect(indices(equipment.find((e) => e.index === 'spike-iron')!)).toContain('traps');
  });

  it('give each link a reason: a category, a whole-word name or a curated entry', () => {
    for (const item of equipment) {
      const category = item.equipment_category?.index;
      const reasons = new Set<string>([...named(item), ...curated('equipment', item.index)]);
      if (category === 'weapon') reasons.add('making-an-attack');
      if (item.gear_category?.index === 'ammunition') reasons.add('making-an-attack');
      if (category === 'armor')
        ['what-is-a-spell', 'using-each-ability'].forEach((i) => reasons.add(i));
      if (['arcane-foci', 'druidic-foci', 'holy-symbols'].includes(item.gear_category?.index ?? ''))
        reasons.add('casting-a-spell');
      for (const index of indices(item)) {
        expect(reasons.has(index), `${item.index} -> ${index}`).toBe(true);
      }
    }
  });
});

describe('related links of magic items', () => {
  const firstLine = (item: Entry) => item.desc?.[0] ?? '';

  it('link every item that says it requires attunement to attunement', () => {
    const attuned = magicItems.filter((item) => /\(requires attunement/i.test(firstLine(item)));
    expect(attuned.length).toBe(175);
    for (const item of attuned) expect(indices(item), item.index).toContain('attunement');
  });

  it('link every item with charges or uses to Charges, and the potions and scrolls to Consumables', () => {
    for (const item of magicItems.filter((i) => i.uses)) {
      expect(indices(item), item.index).toContain('activating-an-item');
    }
    for (const item of magicItems.filter((i) =>
      ['potion', 'scroll'].includes(i.equipment_category?.index ?? '')
    )) {
      expect(indices(item), item.index).toContain('activating-an-item');
    }
    expect(hasAnchor('activating-an-item', 'Charges')).toBe(true);
    expect(hasAnchor('activating-an-item', 'Consumables')).toBe(true);
  });

  it('link the items that name a command word to Command Word', () => {
    for (const item of magicItems.filter((i) => /command word/i.test((i.desc ?? []).join(' ')))) {
      expect(indices(item), item.index).toContain('activating-an-item');
    }
  });

  it('give each link a reason', () => {
    for (const item of magicItems) {
      const category = item.equipment_category?.index;
      const reasons = new Set<string>(curated('magic-items', item.index));
      if (/\(requires attunement/i.test(firstLine(item))) reasons.add('attunement');
      if (item.uses || /command word/i.test((item.desc ?? []).join(' ')))
        reasons.add('activating-an-item');
      if (category === 'potion' || category === 'scroll') reasons.add('activating-an-item');
      if (category === 'weapon') reasons.add('making-an-attack');
      if (category === 'armor') reasons.add('using-each-ability');
      for (const index of indices(item)) {
        expect(reasons.has(index), `${item.index} -> ${index}`).toBe(true);
      }
    }
  });
});

describe('derivation of the links', () => {
  it('is what the data files hold (run "pnpm run derive:rules")', () => {
    expect(deriveSpells(spells as never, sections as never, RuleData as never)).toEqual(spells);
    expect(deriveEquipment(equipment as never, sections as never, RuleData as never)).toEqual(
      equipment
    );
    expect(deriveMagicItems(magicItems as never, sections as never, RuleData as never)).toEqual(
      magicItems
    );
  });
});
