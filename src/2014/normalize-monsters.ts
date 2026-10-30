import fs from "fs";
import srcMonsters from './en/5e-SRD-Monsters.json' with { type: 'json' };
import type { z } from 'zod';
import type { MonsterSchema } from './schemas/5e-SRD-Monsters';
import engineAnnotations from './monster-engine-annotations.json' with { type: 'json' };
console.log(`Loaded ${srcMonsters.length} monsters to normalize from 5e-SRD-Monsters.json`);

const outputFilePath = "./src/2014/5e-SRD-Monsters-Normalized.json";
type Monster = z.infer<typeof MonsterSchema>;

function normalizeDamage(damage: any) {
  console.log(`            Normalizing damage: ${damage.damage_dice}`);
  if (damage.dc?.dc_type?.index) {
    console.log(`                Replacing dc_type object ${damage.dc.dc_type.index} to simple index`);
    damage.dc.dc_type = damage.dc.dc_type.index;
  }
  if (damage.damage_type?.index) {
    console.log(`                Replacing damage_type object ${damage.damage_type.index} to simple index`);
    damage.damage_type = damage.damage_type.index;
  }
  if (damage.condition?.condition_type?.index) {
    console.log(`                Replacing condition_type object ${damage.condition.condition_type.index} to simple index`);
    damage.condition.condition_type = damage.condition.condition_type.index;
  }
  if (damage.grapple?.additional_condition?.condition_type?.index) {
    console.log(`                Replacing additional_condition object ${damage.grapple.additional_condition.condition_type.index} to simple index`);
    damage.grapple.additional_condition.condition_type = damage.grapple.additional_condition.condition_type.index;
  }
  if (damage.from?.options?.length) {
    damage.from.options = damage.from.options.map(normalizeDamage);
  }
  return {...damage};
}

// Structure of an attack, read from the action's own text. The attack header
// ("Melee Weapon Attack: +5 to hit, reach 5 ft., one target.", "Ranged Weapon Attack: +4 to hit,
// range 80/320 ft., one target.", "Melee or Ranged Weapon Attack: ... reach 5 ft. or range 20/60 ft.")
// is the only place the SRD states the attack roll, the reach and the range, so it is the only text read.
const ATTACK_HEADER = /^\s*(Melee or Ranged|Melee|Ranged) (?:Weapon|Spell) Attack:/;
const ATTACK_KINDS = { 'Melee': 'melee', 'Ranged': 'ranged', 'Melee or Ranged': 'melee_or_ranged' } as const;

export type AttackStructure = {
  attack_type: 'Melee' | 'Ranged';
  attack_kind: 'melee' | 'ranged' | 'melee_or_ranged';
  reach_ft?: number;
  range?: { normal_ft: number; long_ft?: number };
};

// Returns undefined for an action that is not an attack roll. Throws when the header does not state the
// reach or the range its wording promises, so a new wording is reviewed instead of silently left unstructured.
export function deriveAttackStructure(action: { name: string; desc?: string }): AttackStructure | undefined {
  const desc = action.desc ?? '';
  const header = ATTACK_HEADER.exec(desc);
  if (!header) return undefined;
  const wording = header[1] as keyof typeof ATTACK_KINDS;
  const attackKind = ATTACK_KINDS[wording];
  const head = desc.split('Hit:')[0];
  const reach = /\breach (\d+) ft\./.exec(head);
  const range = /\brange (\d+)(?:\/(\d+))? ft\./.exec(head);
  if (attackKind !== 'ranged' && !reach) throw new Error(`Attack without a reach: ${action.name}`);
  if (attackKind !== 'melee' && !range) throw new Error(`Attack without a range: ${action.name}`);
  return {
    // "Melee or Ranged" is typed by its first word; attack_kind keeps both.
    attack_type: wording === 'Ranged' ? 'Ranged' : 'Melee',
    attack_kind: attackKind,
    ...(attackKind !== 'ranged' && reach ? { reach_ft: Number(reach[1]) } : {}),
    ...(attackKind !== 'melee' && range
      ? { range: { normal_ft: Number(range[1]), ...(range[2] ? { long_ft: Number(range[2]) } : {}) } }
      : {}),
  };
}

export type AreaOfEffect =
  | { shape: 'cone'; length_ft: number }
  | { shape: 'line'; length_ft: number; width_ft: number }
  | { shape: 'sphere'; radius_ft: number }
  | { shape: 'cylinder'; radius_ft: number; height_ft: number };

// Areas of effect, read from the phrases the SRD uses for them: "60-foot cone", "a 90-foot line that is 5 feet
// wide" or "a line that is 30 ft. long and 5 ft. wide", "a 15-foot-radius cloud" or "a 10-foot radius of gas",
// "a 5-foot-radius, 30-foot-tall cylinder". Text without one of these phrases has no area.
const AREA_PATTERNS: { pattern: RegExp; area: (match: RegExpMatchArray) => AreaOfEffect }[] = [
  { pattern: /(\d+)-foot cone/g, area: (m) => ({ shape: 'cone', length_ft: Number(m[1]) }) },
  {
    pattern: /(\d+)-foot line that is (\d+) (?:feet|ft\.) wide/g,
    area: (m) => ({ shape: 'line', length_ft: Number(m[1]), width_ft: Number(m[2]) }),
  },
  {
    pattern: /line (?:of \w+ )?that is (\d+) ft\. long and (\d+) ft\. wide/g,
    area: (m) => ({ shape: 'line', length_ft: Number(m[1]), width_ft: Number(m[2]) }),
  },
  {
    pattern: /(\d+)-foot-radius, (\d+)-foot-tall cylinder/g,
    area: (m) => ({ shape: 'cylinder', radius_ft: Number(m[1]), height_ft: Number(m[2]) }),
  },
  { pattern: /(\d+)-foot[- ]radius(?!,)/g, area: (m) => ({ shape: 'sphere', radius_ft: Number(m[1]) }) },
];

export function deriveAreas(text: string): AreaOfEffect[] {
  return AREA_PATTERNS.flatMap(({ pattern, area }) => [...text.matchAll(pattern)].map(area));
}

// The one area an action's text describes. Several areas in one text (a dragon's two breath weapons) are
// assigned to the options they belong to, so more than one here is an error.
function deriveArea(action: { name: string; desc?: string }): AreaOfEffect | undefined {
  const areas = deriveAreas(action.desc ?? '');
  if (areas.length > 1) throw new Error(`More than one area in: ${action.name}`);
  return areas[0];
}

// A dragon's "Breath Weapons" lists its breaths in the text as "Fire Breath. The dragon exhales fire in ...".
function deriveBreathOptionAreas(action: { name: string; desc?: string; options?: any }) {
  const lines = (action.desc ?? '').split('\n');
  for (const option of action.options?.from?.options ?? []) {
    const line = lines.find((l) => l.startsWith(`${option.name}. `));
    const areas = line ? deriveAreas(line) : [];
    if (areas.length > 1) throw new Error(`More than one area in: ${action.name} / ${option.name}`);
    if (areas[0]) option.area = areas[0];
  }
}

export function normalizeAction(action: any) {
  console.log(`        Normalizing action: ${action.name}`);
  if (action.dc) {
    if (action.damage?.length) {
      if (!("dc" in action.damage[action.damage.length - 1])) {
        console.log(`            Moving DC: ${action.dc?.dc_type} to damage object number: ${action.damage.length - 1}`);
        action.damage[action.damage.length - 1]["dc"] = {
          ...action.dc,
        };
        delete action.dc;
      }
    } else {
      console.log(`            Creating damage object and moving DC: ${action.dc?.dc_type} to it`);
      action["damage"] = [{
        dc: { ...action.dc },
      }] as any;
      delete action.dc;
    }
  }
  if ("condition" in action) {
    if ("damage" in action && action.damage?.length) {
      if (!("condition" in action.damage[action.damage.length - 1])) {
        console.log(`            Moving Condition: ${action.condition?.condition_type} to damage object number: ${action.damage.length - 1}`);
        action.damage[action.damage.length - 1]["condition"] = {
          ...action.condition,
        };
        delete action.condition;
      }
    } else {
      console.log(`            Creating damage object and moving Condition: ${action.condition?.condition_type} to it`);
      action["damage"] = [{
        condition: { ...action.condition },
      }] as any;
      delete action.condition;
    }
  }
  if (action.options?.from?.options?.length) {
    action.options.from.options = action.options.from.options.map((option: any) => {
      if (option.damage?.length) {
        option.damage = option.damage.map(normalizeDamage);
      }
      return normalizeDamage(option);
    });
  }
  if (action.attacks?.length) {
    action.attacks = action.attacks.map((attack: any) => {
      if (attack.damage?.length) {
        attack.damage = attack.damage.map(normalizeDamage);
      }
      return normalizeDamage(attack);
    });
  }
  if (action.situation?.target?.condition?.index) {
    console.log(`            Replacing condition object ${action.situation.target.condition.index} to simple index`);
    action.situation.target.condition = action.situation.target.condition.index;
  }
  if (action.preference?.target_condition?.index) {
    console.log(`            Replacing condition object ${action.preference.target_condition.index} to simple index`);
    action.preference.target_condition = action.preference.target_condition.index;
  }

  const attack = deriveAttackStructure(action);
  if (action.options?.from?.options?.length) {
    deriveBreathOptionAreas(action);
  }
  const area = action.options?.from?.options?.length ? undefined : deriveArea(action);

  const normalizedAction = {
    ...action,
    damage: action.damage?.map(normalizeDamage),
    // An existing attack_type is kept: "Melee or Ranged" attacks are not all typed by their first word.
    ...(attack ? { ...attack, attack_type: action.attack_type ?? attack.attack_type } : {}),
    ...(area ? { area } : {}),
  };

  return normalizedAction;
}

function normalizeSpecialAbility(specialAbility: any) {
  console.log(`        Normalizing special ability: ${specialAbility.name}`);
  if (specialAbility.dc?.dc_type?.index) {
    console.log(`            Replacing dc_type object ${specialAbility.dc.dc_type.index} to simple index`);
    specialAbility.dc.dc_type = specialAbility.dc.dc_type.index;
  }
  if (specialAbility.spellcasting?.ability?.index) {
    console.log(`            Replacing spellcasting ability object ${specialAbility.spellcasting.ability.index} to simple index`);
    specialAbility.spellcasting.ability = specialAbility.spellcasting.ability.index;
  }
  if (specialAbility.damage?.length) {
    specialAbility.damage = specialAbility.damage.map(normalizeDamage);
  }
  if (specialAbility.bonus_action?.situation?.target?.condition?.index) {
    console.log(`            Replacing condition object ${specialAbility.bonus_action.situation.target.condition.index} to simple index`);
    specialAbility.bonus_action.situation.target.condition = specialAbility.bonus_action.situation.target.condition.index;
  }

  const normalizedSpecialAbility = {
    ...specialAbility,
  };

  return normalizedSpecialAbility;
} 

export type EngineAnnotation = {
  monster: string;
  section: 'actions' | 'legendary_actions' | 'special_abilities' | 'reactions';
  name: string;
  attack?: string;
  damage?: number;
  // Damage entries added after the target's existing ones (a rider, or a grapple): the entry itself
  // is not in the SRD structure. Appended to the action or ability named by `name` / `attack`.
  append_damage?: Record<string, unknown>[];
  set?: Record<string, unknown>;
};

// Annotations that are not part of the SRD text (conditions applied on a failed save, implied DCs, riders).
// They live in monster-engine-annotations.json and are merged onto the normalized output, so the
// committed file stays exactly what this generator produces.
export function applyEngineAnnotations(
  monster: { index: string } & Record<string, any>,
  annotations: EngineAnnotation[] = engineAnnotations as EngineAnnotation[],
) {
  for (const annotation of annotations.filter((a) => a.monster === monster.index)) {
    let target = monster[annotation.section]?.find((item: any) => item.name === annotation.name);
    if (target && annotation.attack) {
      target = [...(target.attacks ?? []), ...(target.options?.from?.options ?? [])].find(
        (attack: any) => attack.name === annotation.attack,
      );
    }
    if (target && annotation.append_damage) {
      target.damage = [...(target.damage ?? []), ...structuredClone(annotation.append_damage)];
    }
    if (target && annotation.damage !== undefined) {
      target = target.damage?.[annotation.damage];
    }
    if (!target) {
      throw new Error(`Annotation target not found: ${JSON.stringify(annotation)}`);
    }
    Object.assign(target, structuredClone(annotation.set ?? {}));
  }
}

export function normalizeMonster(monster: Monster) {
  console.log(`    Normalizing monster: ${monster.name}`);

  if (monster.proficiencies?.length) {
    monster.proficiencies = monster.proficiencies.map((p) => {
      const name = p.proficiency.name;
      const index = p.proficiency.index;
      console.log(`        Normalizing proficiency: ${name}`);
      return {
        ...p,
        proficiency: index,
      };
    }) as unknown as Monster['proficiencies'];
  }
  if (monster.condition_immunities?.length) {
    monster.condition_immunities = monster.condition_immunities.map((condition) => {
      console.log(`        Normalizing condition immunity: ${condition.name}`);
      return condition.index;
    }) as unknown as Monster['condition_immunities'];
  }
  if (monster.forms?.length) {
    monster.forms = monster.forms.map((form) => {
      console.log(`        Normalizing form: ${form.name}`);
      return form.index as any;
    }) as unknown as Monster['forms'];
  }
  if (monster.special_abilities) {
    monster.special_abilities = monster.special_abilities.map(normalizeSpecialAbility);
  }
  if (monster.legendary_actions) {
    monster.legendary_actions = monster.legendary_actions.map(normalizeSpecialAbility);
  }
  if (monster.armor_class?.length) {
    monster.armor_class = monster.armor_class.map((ac) => {
      if (ac.condition?.index) {
        console.log(`        Replacing condition object ${ac.condition.index} to simple index`);
        ac.condition = ac.condition.index as unknown as typeof ac.condition;
      }
      if (ac.armor?.length) {
        ac.armor = ac.armor.map((armor) => {
          if (armor?.index) {
            console.log(`            Replacing armor object ${armor.index} to simple index`);
            return armor.index;
          }
          return armor;
        }) as unknown as typeof ac.armor;
      }
      if (ac.spell?.index) {
        console.log(`        Replacing spell object ${ac.spell.index} to simple index`);
        ac.spell = ac.spell.index as unknown as typeof ac.spell;
      }
      return ac;
    }) as unknown as Monster['armor_class'];
  }
  if (monster.reactions?.length) {
    monster.reactions = monster.reactions.map(normalizeDamage);
  } 
  const normalizedMonster = {
    ...monster,
    actions: monster.actions?.map(normalizeAction),
  };
  applyEngineAnnotations(normalizedMonster);

  return normalizedMonster;
}

export function normalizeMonsters(monsters: unknown[]) {
  return (structuredClone(monsters) as Monster[]).map(normalizeMonster);
}

export function serializeMonsters(monsters: unknown[]) {
  return `${JSON.stringify(monsters, null, 2)}\n`;
}

async function writeMonstersToFile() {
  const normalizedMonsters = normalizeMonsters(srcMonsters);

  console.log(`Writing ${normalizedMonsters.length} normalized monsters to ${outputFilePath}`);
  await fs.promises.writeFile(outputFilePath, serializeMonsters(normalizedMonsters));
}

if (process.argv[1]?.endsWith('/normalize-monsters.ts')) {
  writeMonstersToFile();
}
