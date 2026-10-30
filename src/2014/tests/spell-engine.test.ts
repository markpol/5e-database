import { describe, expect, it } from 'vitest';
import SpellData from '../en/5e-SRD-Spells.json' with { type: 'json' };
import annotations from '../spell-engine-annotations.json' with { type: 'json' };
import { deriveSpellMechanics } from '../derive-spell-mechanics';
import {
  ENGINE_EXCLUDED,
  ENGINE_KINDS,
  ENGINE_TARGETS,
  type SpellEngine,
} from '../derive-spell-engine';

type Spell = {
  index: string;
  desc: string[];
  material?: string;
  concentration: boolean;
  attack_type?: string;
  damage?: unknown[];
  dc?: unknown;
  area_of_effect?: unknown;
  heal_at_slot_level?: Record<string, string>;
  casting_time_data: { unit: string };
  duration_data: { unit: string };
  engine?: SpellEngine;
};

const spells = SpellData as unknown as Spell[];
const spell = (index: string) => spells.find((s) => s.index === index)!;
const kindOf = (s: Spell) => s.engine!.kind;
const annotated = spells.filter((s) => s.engine);

// The spells that fight, heal, buff or impose a condition: the ones named in docs/spell-mechanics.md, and every spell
// that deals damage, makes an attack roll or restores hit points. The condition spells are listed by name.
const NAMED = [
  'sacred-flame', 'spare-the-dying', 'cure-wounds', 'healing-word', 'guiding-bolt', 'inflict-wounds', 'fire-bolt',
  'ray-of-frost', 'shocking-grasp', 'acid-splash', 'poison-spray', 'magic-missile', 'bless', 'shield-of-faith',
  'sanctuary', 'beacon-of-hope', 'spiritual-weapon', 'lesser-restoration', 'blindness-deafness',
  'mass-healing-word', 'spirit-guardians', 'command', 'magic-weapon', 'divine-favor', 'branding-smite',
  'mage-armor', 'false-life', 'burning-hands', 'thunderwave', 'shatter', 'fireball', 'greater-restoration',
  'animal-friendship', 'calm-emotions', 'charm-person', 'compulsion', 'divine-word', 'dominate-beast',
  'dominate-monster', 'dominate-person', 'enthrall', 'entangle', 'eyebite', 'faerie-fire', 'fear',
  'flesh-to-stone', 'grease', 'hideous-laughter', 'hold-monster', 'hold-person', 'hypnotic-pattern',
  'mass-suggestion', 'power-word-stun', 'sleet-storm', 'suggestion', 'web', 'banishment', 'holy-aura',
]; // prettier-ignore
const isCombat = (s: Spell) =>
  NAMED.includes(s.index) || s.attack_type || s.damage || s.heal_at_slot_level;

describe('spell engine classification', () => {
  it('is on every combat spell and on nothing else', () => {
    const combat = spells.filter((s) => isCombat(s) && !(s.index in ENGINE_EXCLUDED));
    expect(combat.filter((s) => !s.engine).map((s) => s.index)).toEqual([]);
    expect(annotated.filter((s) => !isCombat(s)).map((s) => s.index)).toEqual([]);
    expect(annotated.filter((s) => s.index in ENGINE_EXCLUDED).map((s) => s.index)).toEqual([]);
    expect(annotations.map((a) => a.spell).sort()).toEqual(annotated.map((s) => s.index).sort());
    for (const index of Object.keys(ENGINE_EXCLUDED)) expect(spell(index)).toBeDefined();
  });

  it('is derived from the annotation file without drift', () => {
    expect(deriveSpellMechanics(SpellData as never)).toEqual(SpellData);
  });

  it('uses only the vocabulary', () => {
    for (const s of annotated) {
      expect(Object.keys(s.engine!).sort(), s.index).toEqual(['campaign', 'kind', 'npc', 'target']);
      expect(ENGINE_KINDS, s.index).toContain(s.engine!.kind);
      expect(ENGINE_TARGETS, s.index).toContain(s.engine!.target);
      expect(typeof s.engine!.campaign, s.index).toBe('boolean');
      expect(typeof s.engine!.npc, s.index).toBe('boolean');
    }
  });

  it('agrees with attack_type', () => {
    for (const s of annotated) {
      const attackKinds = ['spell-attack', 'summon-weapon', 'summon'];
      if (s.attack_type) expect(attackKinds, s.index).toContain(kindOf(s));
      // Scorching Ray has no attack_type but its text makes a ranged spell attack for each ray.
      if (kindOf(s) === 'spell-attack') {
        expect(
          s.attack_type || /(?:melee|ranged) spell attack/.test(s.desc.join(' ')),
          s.index
        ).toBeTruthy();
      }
    }
  });

  it('agrees with dc and damage', () => {
    for (const s of annotated) {
      const kind = kindOf(s);
      if (kind === 'save-damage') expect(s.dc && s.damage, s.index).toBeTruthy();
      if (kind === 'save-condition') expect(s.dc && !s.damage, s.index).toBeTruthy();
      if (kind === 'area-damage') expect(s.damage && s.area_of_effect, s.index).toBeTruthy();
      if (kind === 'auto-hit') expect(s.damage && !s.dc && !s.attack_type, s.index).toBeTruthy();
      if (kind === 'summon-weapon') expect(s.damage, s.index).toBeTruthy();
      if (kind === 'command') expect(s.dc, s.index).toBeTruthy();
      if (s.dc && s.damage && !s.attack_type) {
        expect(['save-damage', 'area-damage', 'aura', 'summon'], s.index).toContain(kind);
      }
      if (s.damage && !s.dc && !s.attack_type) {
        expect(
          ['auto-hit', 'area-damage', 'aura', 'buff', 'summon-weapon', 'spell-attack'],
          s.index
        ).toContain(kind);
      }
    }
  });

  it('agrees with the healing fields', () => {
    for (const s of annotated) {
      const kind = kindOf(s);
      if (kind === 'heal' || kind === 'mass-heal')
        expect(s.heal_at_slot_level, s.index).toBeDefined();
      if (s.heal_at_slot_level) expect(['heal', 'mass-heal', 'buff'], s.index).toContain(kind);
      if (kind === 'mass-heal')
        expect(s.desc.join(' '), s.index).toMatch(
          /up to (?:six|\d+)|each creature|creatures of your choice/
        );
    }
  });

  it('aims each kind at the target it works on', () => {
    for (const s of annotated) {
      const { kind, target } = s.engine!;
      if (['heal', 'mass-heal', 'stabilize', 'aura', 'cure-condition'].includes(kind))
        expect(target, s.index).toBe('ally');
      if (['spell-attack', 'save-damage', 'auto-hit', 'command', 'summon-weapon'].includes(kind))
        expect(target, s.index).toBe('enemy');
      if (['area-damage', 'summon'].includes(kind)) expect(target, s.index).toBe('area');
      if (kind === 'save-condition')
        expect(target, s.index).toBe(s.area_of_effect ? 'area' : 'enemy');
    }
  });

  it('marks as campaign the healing, curing and long self-sufficient buffs', () => {
    for (const s of annotated) {
      const { kind, campaign } = s.engine!;
      const heals = ['heal', 'mass-heal', 'stabilize', 'cure-condition'].includes(kind);
      const longBuff =
        ['buff', 'aura'].includes(kind) &&
        !s.concentration &&
        ['hour', 'day'].includes(s.duration_data.unit);
      expect(campaign, s.index).toBe(heals || longBuff);
    }
  });

  it('marks as not for non-player casters the slow, costly and equipment spells', () => {
    for (const s of annotated) {
      const slow =
        ['minute', 'hour'].includes(s.casting_time_data.unit) ||
        /\d,?\d* ?gp/.test(s.material ?? '');
      const equipment = ['mage-armor', 'magic-weapon'].includes(s.index);
      expect(s.engine!.npc, s.index).toBe(!(slow || equipment));
    }
  });
});
