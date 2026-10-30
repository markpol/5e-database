import damageTypes from './en/5e-SRD-Damage-Types.json' with { type: 'json' };

/**
 * Structured effects of monster traits and actions, and structured damage resistances, immunities and
 * vulnerabilities, read from the English SRD text. normalize-monsters.ts adds them to the normalized monsters; the
 * English file is unchanged by them. Each rule reads one SRD phrasing and throws when the text starts the phrasing
 * but does not finish it, so a new wording is reviewed instead of silently left unstructured.
 * docs/monster-effects.md describes the fields.
 */

const DAMAGE_TYPES: string[] = damageTypes.map((type) => type.index);

type DamageRule = { types: string[]; unless?: string[]; only_from?: string };

export type Regeneration = {
  hit_points: number;
  min_hit_points?: number;
  suppressed_by?: { damage_types: string[]; sources?: string[] };
  disabled_in?: string[];
  dies_only_without_regenerating?: true;
};

export type AbilityEffects = {
  trigger?: string;
  regeneration?: Regeneration;
  detach_after_damage?: number;
  reduction_dice?: { dice: string; every_hours?: number; repeat_save?: true; until: string };
  reduce_max_hp?: { by: 'damage_taken'; damage_type?: string; until: string };
  damage_dice_at_half_hp?: string;
  resistances?: DamageRule[];
};

const ENDINGS: [RegExp, string][] = [
  [/lasts until the (?:target|creature) finishes a long rest/, 'long_rest'],
  [/lasts until removed by the greater restoration spell/, 'greater_restoration'],
  [/lasts until the disease is cured|Until the disease is cured/, 'disease_cured'],
  [/lasts until removed by the remove curse spell/, 'remove_curse'],
];

function ending(desc: string, name: string): string {
  const found = ENDINGS.filter(([pattern]) => pattern.test(desc));
  if (found.length !== 1) throw new Error(`No single end of the reduction of hit point maximum in: ${name}`);
  return found[0][1];
}

function damageTypeIndex(word: string, name: string): string {
  if (!DAMAGE_TYPES.includes(word)) throw new Error(`Unknown damage type "${word}" in: ${name}`);
  return word;
}

// "The troll regains 10 hit points at the start of its turn. If the troll takes acid or fire damage, this trait
// doesn't function at the start of the troll's next turn. The troll dies only if it starts its turn with 0 hit
// points and doesn't regenerate." and the vampire's, oni's and shield guardian's variants of it.
function deriveRegeneration(desc: string, name: string): Regeneration | undefined {
  const regains = /regains (\d+) hit points at the start of its turn(?: if it has at least (\d+) hit\.? points?)?(?: and isn't in sunlight or running water)?\./.exec(
    desc,
  );
  if (!regains) return undefined;
  const regeneration: Regeneration = { hit_points: Number(regains[1]) };
  if (regains[2]) regeneration.min_hit_points = Number(regains[2]);
  if (/isn't in sunlight or running water/.test(desc)) regeneration.disabled_in = ['sunlight', 'running_water'];
  if (/this trait doesn't function/.test(desc)) {
    const suppression = /takes ([a-z]+(?: or [a-z]+)*) damage(?: or damage from (holy water))?, this trait doesn't function at the start of the [\w' -]+? next turn\./.exec(
      desc,
    );
    if (!suppression) throw new Error(`Unreadable suppression of regeneration in: ${name}`);
    regeneration.suppressed_by = {
      damage_types: suppression[1].split(' or ').map((word) => damageTypeIndex(word, name)),
      ...(suppression[2] ? { sources: [suppression[2].replace(' ', '_')] } : {}),
    };
  }
  if (/dies only if it starts its turn with 0 hit points and doesn't regenerate/.test(desc)) {
    regeneration.dies_only_without_regenerating = true;
  }
  return regeneration;
}

// The swarms: "Hit: 10 (4d4) piercing damage, or 5 (2d4) piercing damage if the swarm has half of its hit points or fewer."
function deriveHalfHitPointDice(desc: string, name: string): string | undefined {
  if (!/half of its hit points or fewer/.test(desc)) return undefined;
  const half = /Hit: \d+ \(\d+d\d+\) (\w+) damage, or \d+ \((\d+d\d+)\) (\w+) damage if the swarm has half of its hit points or fewer\./.exec(
    desc,
  );
  if (!half || half[1] !== half[3]) throw new Error(`Unreadable damage at half hit points in: ${name}`);
  return half[2];
}

// The stirge: "The stirge can detach itself by spending 5 feet of its movement. It does so after it drains 10 hit
// points of blood from the target or the target dies." The cloaker and darkmantle detach with no damage limit.
function deriveDetachAfterDamage(desc: string): number | undefined {
  const detach = /detach itself by spending 5 feet of its movement\. It does so after it drains (\d+) hit points of blood/.exec(desc);
  return detach ? Number(detach[1]) : undefined;
}

// "its hit point maximum is reduced by an amount equal to the damage taken" (the necrotic damage taken, for the
// vampires), with the end of the reduction in the text.
function deriveReduceMaxHp(desc: string, name: string): AbilityEffects['reduce_max_hp'] {
  const reduced = /hit point maximum (?:is )?reduced by an amount equal to the (?:([a-z]+) )?damage taken/.exec(desc);
  if (!reduced) return undefined;
  return {
    by: 'damage_taken',
    ...(reduced[1] ? { damage_type: damageTypeIndex(reduced[1], name) } : {}),
    until: ending(desc, name),
  };
}

// A reduction by dice: the diseases ("Every 24 hours that elapse, the creature must repeat the saving throw,
// reducing its hit point maximum by 5 (1d10) on a failure." and "decreases by 3 (1d6) every 24 hours"), the mummy rot
// ("decreases by 10 (3d6) for every 24 hours that elapse") and the night hag's visions ("is reduced by 5 (1d10)").
function deriveReductionDice(desc: string, name: string): AbilityEffects['reduction_dice'] {
  const repeated = /Every 24 hours that elapse, the (?:creature|target) must repeat the saving throw, reducing its hit point maximum by \d+ \((\d+d\d+)\) on a failure\./.exec(
    desc,
  );
  if (repeated) return { dice: repeated[1], every_hours: 24, repeat_save: true, until: ending(desc, name) };
  const periodic = /hit point maximum decreases by \d+ \((\d+d\d+)\) (?:for )?every 24 hours/.exec(desc);
  if (periodic) return { dice: periodic[1], every_hours: 24, until: ending(desc, name) };
  const once = /its hit point maximum is reduced by \d+ \((\d+d\d+)\)\./.exec(desc);
  if (once) return { dice: once[1], until: ending(desc, name) };
  if (/hit point maximum (?:decreases|is reduced) by \d+ \(/.test(desc)) {
    throw new Error(`Unreadable reduction of hit point maximum by dice in: ${name}`);
  }
  return undefined;
}

// The nightmare: "The nightmare can grant resistance to fire damage to anyone riding it."
function deriveGrantedResistances(desc: string, name: string): DamageRule[] | undefined {
  const granted = /can grant resistance to ([a-z]+) damage to anyone riding it\./.exec(desc);
  return granted ? [{ types: [damageTypeIndex(granted[1], name)] }] : undefined;
}

const NO_SAVE_TRIGGER = (desc: string) => (/^\s*(?:Melee|Ranged)(?: or Ranged)? (?:Weapon|Spell) Attack:/.test(desc) ? 'on_hit' : 'on_damage');

/**
 * The effects the text of a trait, action, legendary action or reaction states. Returns undefined when it states
 * none. The `trigger` is the one that fits the effect, and two effects with different triggers in one text throw.
 */
export function deriveAbilityEffects(ability: { name: string; desc?: string }): AbilityEffects | undefined {
  const { name } = ability;
  const desc = ability.desc ?? '';
  const triggers: string[] = [];
  const effects: AbilityEffects = {};

  const regeneration = deriveRegeneration(desc, name);
  if (regeneration) {
    effects.regeneration = regeneration;
    triggers.push('start_of_turn');
  }
  const halfDice = deriveHalfHitPointDice(desc, name);
  if (halfDice) {
    effects.damage_dice_at_half_hp = halfDice;
    triggers.push('half_hit_points_or_fewer');
  }
  const detach = deriveDetachAfterDamage(desc);
  if (detach) {
    effects.detach_after_damage = detach;
    triggers.push('start_of_turn');
  }
  const reduceMaxHp = deriveReduceMaxHp(desc, name);
  if (reduceMaxHp) {
    effects.reduce_max_hp = reduceMaxHp;
    triggers.push(/saving throw or/.test(desc) ? 'on_failed_save' : NO_SAVE_TRIGGER(desc));
  }
  const reductionDice = deriveReductionDice(desc, name);
  if (reductionDice) {
    effects.reduction_dice = reductionDice;
    triggers.push(reductionDice.every_hours ? 'every_24_hours' : 'after_1_hour_of_visions');
  }
  const resistances = deriveGrantedResistances(desc, name);
  if (resistances) {
    effects.resistances = resistances;
    triggers.push('while_ridden');
  }

  if (!triggers.length) return undefined;
  if (new Set(triggers).size > 1) throw new Error(`More than one trigger in: ${name}`);
  return { trigger: triggers[0], ...effects };
}

// The bypass of "from nonmagical weapons that aren't silvered": a magical weapon, and a silvered one.
const WEAPON_QUALITY = { silvered: 'silvered', adamantine: 'adamantine' } as const;

function damageTypeList(phrase: string, source: string): string[] {
  return phrase.split(/, and |, | and /).map((word) => damageTypeIndex(word.trim(), source));
}

/**
 * One entry of `damage_vulnerabilities`, `damage_resistances` or `damage_immunities`, as a rule. Returns undefined
 * for the three entries that state a condition this vocabulary has no word for (see docs/monster-effects.md).
 */
export function deriveDamageRule(entry: string): DamageRule | undefined {
  if (DAMAGE_TYPES.includes(entry)) return { types: [entry] };
  if (entry === 'damage from spells') return { types: ['all'], only_from: 'spells' };
  const nonmagical = /^([a-z, ]+) from nonmagical weapons(?: that aren't (silvered|adamantine))?$/.exec(entry);
  if (nonmagical) {
    return {
      types: damageTypeList(nonmagical[1], entry),
      unless: ['magical', ...(nonmagical[2] ? [WEAPON_QUALITY[nonmagical[2] as keyof typeof WEAPON_QUALITY]] : [])],
    };
  }
  // "from nonmagical attacks (from stoneskin)" is a resistance that a spell gives; "from magic weapons wielded by
  // good creatures" depends on the wielder.
  if (/\(from stoneskin\)$|wielded by good creatures$/.test(entry)) return undefined;
  throw new Error(`Unreadable damage rule: ${entry}`);
}

/**
 * The rules of a list of damage strings: the plain damage types together in the first rule, then one rule for each
 * condition, in the order of the list. Undefined for a list that gives no rule.
 */
export function deriveDamageRules(entries: string[]): DamageRule[] | undefined {
  const rules = entries.map(deriveDamageRule).filter((rule): rule is DamageRule => rule !== undefined);
  const plain = rules.filter((rule) => !rule.unless && !rule.only_from);
  const conditional = rules.filter((rule) => rule.unless || rule.only_from);
  const merged = plain.length ? [{ types: plain.flatMap((rule) => rule.types) }, ...conditional] : conditional;
  return merged.length ? merged : undefined;
}
