import type { CombatSpell } from './derive-spell-combat';
import annotations from './spell-engine-annotations.json' with { type: 'json' };

// The `engine` classification of a combat spell: what kind of spell it is, whom it is aimed at, and whether it is
// meaningful outside combat and for non-player casters. The values are written by hand, one record for each spell, in
// spell-engine-annotations.json (they are a judgement about the spell, not text in it) and merged into the spells
// here. The vocabulary is documented in docs/spell-mechanics.md and enforced by the Zod schema in
// schemas/5e-SRD-Spells.ts.

export const ENGINE_KINDS = [
  'heal',
  'mass-heal',
  'stabilize',
  'spell-attack',
  'save-damage',
  'auto-hit',
  'area-damage',
  'buff',
  'aura',
  'save-condition',
  'cure-condition',
  'command',
  'summon-weapon',
  'summon',
] as const;

export const ENGINE_TARGETS = ['ally', 'enemy', 'area'] as const;

export type SpellEngine = {
  kind: (typeof ENGINE_KINDS)[number];
  target: (typeof ENGINE_TARGETS)[number];
  campaign: boolean;
  npc: boolean;
};

export const SPELL_ENGINE: Record<string, SpellEngine> = Object.fromEntries(
  (annotations as ({ spell: string } & SpellEngine)[]).map(({ spell, ...engine }) => [
    spell,
    engine,
  ])
);

// The spells the annotation file does not cover although they deal damage, make an attack roll or force a saving
// throw, because the effect is not what the spell is for.
export const ENGINE_EXCLUDED: Record<string, string> = {
  'control-water': 'reshapes water; the damage is to creatures swept by a flood',
  'dimension-door': 'teleportation; the damage is only a mishap',
  dream: 'messaging; the damage is only a nightmare the caster sends',
  forbiddance: 'a ward on a site; the damage is to a creature that enters it',
  'plane-shift': 'travel; the attack roll only decides whether an unwilling target is sent away',
};

export function deriveSpellEngine(spells: CombatSpell[]): CombatSpell[] {
  return spells.map((spell) => {
    const engine = SPELL_ENGINE[spell.index];
    if (!engine) {
      const { engine: _removed, ...rest } = spell;
      return rest as CombatSpell;
    }
    const out: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(spell)) {
      if (name === 'engine') continue;
      if (name === 'school') out.engine = engine;
      out[name] = value;
    }
    return out as CombatSpell;
  });
}
