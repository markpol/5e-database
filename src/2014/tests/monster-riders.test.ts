import { describe, expect, it } from 'vitest';
import MonsterData from '../en/5e-SRD-Monsters.json' with { type: 'json' };
import NormalizedMonsterData from '../5e-SRD-Monsters-Normalized.json' with { type: 'json' };
import ConditionData from '../en/5e-SRD-Conditions.json' with { type: 'json' };
import Annotations from '../monster-engine-annotations.json' with { type: 'json' };
import { applyEngineAnnotations, type EngineAnnotation } from '../normalize-monsters';

type Entry = Record<string, any>;
type Part = { name: string; desc: string; damage?: Entry[]; condition?: Entry; dc?: Entry } & Entry;
type Monster = { index: string; actions?: Part[]; special_abilities?: Part[] } & Entry;

const english = MonsterData as unknown as Monster[];
const normalized = NormalizedMonsterData as unknown as Monster[];
const annotations = Annotations as unknown as EngineAnnotation[];
const conditionIndices = new Set((ConditionData as { index: string }[]).map((condition) => condition.index));

const find = (monsters: Monster[], index: string, section: 'actions' | 'special_abilities', name: string): Part => {
  const part = monsters.find((monster) => monster.index === index)?.[section]?.find((item) => item.name === name);
  if (!part) throw new Error(`${index} ${section} ${name} not found`);
  return part;
};
const dice = (part: Part) =>
  (part.damage ?? []).flatMap((entry) =>
    'damage_dice' in entry
      ? [[entry.damage_type?.index ?? entry.damage_type, entry.damage_dice] as [string, string]]
      : [],
  );

describe('monster damage entries', () => {
  // The damage the action text states, as `dice` + `type`, e.g. "7 (2d6 + 3) bludgeoning damage".
  // An untyped "extra 7 (2d6) damage" (elk Charge) matches any type.
  const stated = (desc: string) => {
    const pairs = [...desc.matchAll(/\((\d+d\d+(?: ?[+-] ?\d+)?)\)\s+(\w+)/g)].map(
      (match) => [match[1].replaceAll(' ', ''), match[2]] as [string, string],
    );
    for (const match of desc.matchAll(/(?<![\d(d])(\d+) (\w+) damage/g)) pairs.push([match[1], match[2]]);
    for (const match of desc.matchAll(/(\d+d\d+) (\w+) damage/g)) pairs.push([match[1], match[2]]);
    return pairs;
  };

  it('has dice and a type that the action text states', () => {
    const mismatches: string[] = [];
    for (const monster of english) {
      for (const section of ['actions', 'legendary_actions', 'special_abilities', 'reactions'] as const) {
        for (const part of (monster as Entry)[section] ?? []) {
          const text = stated(part.desc ?? '');
          const entries = [
            ...(part.damage ?? []),
            ...(part.attacks ?? []).flatMap((attack: Entry) => attack.damage ?? []),
            ...(part.options?.from?.options ?? []).flatMap((option: Entry) => option.damage ?? []),
          ];
          for (const entry of entries) {
            if (!('damage_dice' in entry)) continue;
            const key = `${entry.damage_dice.replaceAll(' ', '')} ${entry.damage_type.index}`;
            const found = text.some(([d, t]) => d === entry.damage_dice.replaceAll(' ', '') && (t === entry.damage_type.index || t === 'damage'));
            if (!found) mismatches.push(`${monster.index} / ${part.name}: ${key}`);
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it.each([
    ['crocodile', 'Bite', 0, 'piercing', '1d10+2'],
    ['duergar', 'Javelin', 0, 'piercing', '1d6+2'],
    ['eagle', 'Talons', 0, 'slashing', '1d4+2'],
    ['ettercap', 'Bite', 0, 'piercing', '1d8+2'],
    ['ettercap', 'Claws', 0, 'slashing', '2d4+2'],
    ['flying-snake', 'Bite', 0, 'piercing', '1'],
    ['gibbering-mouther', 'Bites', 0, 'piercing', '5d6'],
    ['hunter-shark', 'Bite', 0, 'piercing', '2d8+4'],
    ['noble', 'Rapier', 0, 'piercing', '1d8+1'],
    ['plesiosaurus', 'Bite', 0, 'piercing', '3d6+4'],
    ['scorpion', 'Sting', 0, 'piercing', '1'],
  ])('%s %s damage %i is %s %s in both monster files', (index, name, position, type, expectedDice) => {
    for (const monsters of [english, normalized]) {
      const entry = find(monsters, index, 'actions', name).damage?.[position] as Entry;
      expect(entry.damage_type?.index ?? entry.damage_type).toBe(type);
      expect(entry.damage_dice).toBe(expectedDice);
    }
  });

  // Damage the text states and the structure lacked: [monster, section, name, [type, dice, save?][]]. The save is
  // `<ability><DC><success>` where success is n (no effect on a success) or h (half damage).
  it.each([
    ['giant-centipede', 'actions', 'Bite', [['poison', '3d6', 'con11n']]],
    ['guardian-naga', 'actions', 'Bite', [['poison', '10d8', 'con15h']]],
    ['guardian-naga', 'actions', 'Spit Poison', [['poison', '10d8', 'con15h']]],
    ['spirit-naga', 'actions', 'Bite', [['poison', '7d8', 'con13h']]],
    ['pit-fiend', 'actions', 'Bite', [['poison', '6d6', 'con21n']]],
    ['pit-fiend', 'actions', 'Mace', [['fire', '6d6']]],
    ['wyvern', 'actions', 'Stinger', [['poison', '7d6', 'con15h']]],
    ['purple-worm', 'actions', 'Tail Stinger', [['poison', '12d6', 'con19h']]],
    ['purple-worm', 'actions', 'Bite', [['acid', '6d6']]],
    ['rug-of-smothering', 'actions', 'Smother', [['bludgeoning', '2d6+3']]],
    ['shambling-mound', 'actions', 'Engulf', [['bludgeoning', '2d8+4', 'con14n']]],
    ['vrock', 'actions', 'Spores', [['poison', '1d10', 'con14n']]],
    ['chain-devil', 'actions', 'Chain', [['piercing', '2d6']]],
    ['fire-elemental', 'actions', 'Touch', [['fire', '1d10']]],
    ['magmin', 'actions', 'Touch', [['fire', '1d6']]],
    ['bulette', 'actions', 'Deadly Leap', [['bludgeoning', '3d6+4'], ['slashing', '3d6+4']]],
    ['kraken', 'actions', 'Bite', [['acid', '12d6']]],
    ['remorhaz', 'actions', 'Swallow', [['acid', '6d6']]],
    ['tarrasque', 'actions', 'Swallow', [['acid', '16d6']]],
    ['ice-devil', 'actions', 'Wall of Ice', [['cold', '10d6', 'dex17h'], ['cold', '5d6', 'con17h']]],
    ['wereboar-boar', 'special_abilities', 'Charge (Boar or Hybrid Form Only)', [['slashing', '2d6']]],
    ['wereboar-hybrid', 'special_abilities', 'Charge (Boar or Hybrid Form Only)', [['slashing', '2d6']]],
  ] as [string, 'actions' | 'special_abilities', string, string[][]][])(
    '%s %s %s states its damage dice, type and save',
    (index, section, name, expected) => {
      for (const monsters of [english, normalized]) {
        const entries = (find(monsters, index, section, name).damage ?? []).filter((entry) => 'damage_dice' in entry);
        expect(entries.length, `${index} ${name}`).toBeGreaterThanOrEqual(expected.length);
        // Entries added after the ones an action already had, so compare the last ones.
        const added = entries.slice(-expected.length);
        added.forEach((entry, position) => {
          const [type, expectedDice, save] = expected[position];
          expect(entry.damage_type?.index ?? entry.damage_type).toBe(type);
          expect(entry.damage_dice).toBe(expectedDice);
          // The English file keeps a save that the action has as a whole on the action; the normalized file moves it onto the last damage entry.
          if (monsters === english && !entry.dc) return;
          const dc = entry.dc;
          const found = dc ? `${dc.dc_type?.index ?? dc.dc_type}${dc.dc_value}${dc.success_type === 'half' ? 'h' : 'n'}` : undefined;
          expect(found, `${index} ${name} ${expectedDice}`).toBe(save);
        });
      }
    },
  );

  it('states the damage of a swallowed creature in the text it comes from', () => {
    // The kraken and the purple worm swallow in their Bite, the remorhaz and the tarrasque in a Swallow action.
    for (const [index, name, text] of [
      ['kraken', 'Bite', '42 (12d6) acid damage'],
      ['purple-worm', 'Bite', '21 (6d6) acid damage'],
      ['remorhaz', 'Swallow', '21 (6d6) acid damage'],
      ['tarrasque', 'Swallow', '56 (16d6) acid damage'],
    ]) {
      expect(find(english, index, 'actions', name).desc).toContain(text);
    }
  });

  it("rolls the rhinoceros Charge's extra damage as 2d8", () => {
    expect(dice(find(english, 'rhinoceros', 'special_abilities', 'Charge'))).toEqual([['bludgeoning', '2d8']]);
    expect(dice(find(normalized, 'rhinoceros', 'special_abilities', 'Charge'))).toEqual([['bludgeoning', '2d8']]);
  });

  it("states the otyugh's Tentacle Slam damage with its save and stun", () => {
    const [entry] = find(normalized, 'otyugh', 'actions', 'Tentacle Slam').damage as Entry[];
    expect(entry).toEqual({
      damage_type: 'bludgeoning',
      damage_dice: '2d6+3',
      dc: { dc_type: 'con', dc_value: 14, success_type: 'half' },
      condition: { condition_type: 'stunned', duration: { length: 1, unit: 'round' } },
    });
  });
});

describe('restoring-effect condition endings', () => {
  it('structures the end condition stated by each affected monster', () => {
    const expected = {
      basilisk: 'greater restoration or other magic',
      'death-dog': 'disease cured',
      erinyes: 'lesser restoration or similar magic',
      gorgon: 'greater restoration or other magic',
      medusa: 'greater restoration or other magic',
      otyugh: 'disease cured',
      solar: 'lesser restoration or similar magic',
    };
    const found = normalized.flatMap((monster) =>
      (['actions', 'special_abilities', 'legendary_actions', 'reactions'] as const).flatMap((section) =>
        ((monster[section] ?? []) as Part[]).flatMap((part) => {
          const conditions: Entry[] = [
            ...(part.condition ? [part.condition] : []),
            ...(part.damage ?? []).flatMap((damage) => damage.condition ? [damage.condition] : []),
            ...(part.damage ?? []).flatMap((damage) => damage.condition?.on_failed_repeat_save ? [damage.condition.on_failed_repeat_save] : []),
          ];
          if (part.condition?.on_failed_repeat_save) conditions.push(part.condition.on_failed_repeat_save);
          return conditions.flatMap((condition) => condition.duration?.unit === 'until restored'
            ? [{ key: monster.index, ends_when: condition.duration.ends_when }]
            : []);
        }),
      ),
    );
    expect(Object.fromEntries(found.map(({ key, ends_when }) => [key, ends_when]))).toEqual(expected);
  });
});

describe('monster rider annotations', () => {
  const saveOf = (value: Entry) => `DC ${value.dc_value}`;

  it('names a monster, section and action that exist, and only known keys', () => {
    const keys = new Set(['monster', 'section', 'name', 'attack', 'damage', 'append_damage', 'set']);
    for (const annotation of annotations) {
      expect(Object.keys(annotation).filter((key) => !keys.has(key)), JSON.stringify(annotation)).toEqual([]);
      const monster = english.find((item) => item.index === annotation.monster);
      expect(monster, annotation.monster).toBeDefined();
      expect((monster as Entry)[annotation.section]?.some((part: Part) => part.name === annotation.name), JSON.stringify(annotation)).toBe(true);
    }
  });

  it('uses only condition ids that exist in the conditions', () => {
    const used = new Set<string>();
    const walk = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') {
        for (const [key, inner] of Object.entries(value)) {
          if (key === 'condition_type' || (key === 'condition' && typeof inner === 'string')) used.add(inner as string);
          else walk(inner);
        }
      }
    };
    annotations.forEach((annotation) => walk([annotation.append_damage, annotation.set]));
    for (const id of used) expect(conditionIndices.has(id), id).toBe(true);
  });

  it('gives each added save the DC its action text states', () => {
    for (const annotation of annotations) {
      const entries = [...(annotation.append_damage ?? []), ...Object.values(annotation.set ?? {})] as Entry[];
      const part = (english.find((item) => item.index === annotation.monster) as Entry)[annotation.section].find(
        (item: Part) => item.name === annotation.name,
      ) as Part;
      for (const entry of entries) {
        if (entry.dc) expect(part.desc, `${annotation.monster} ${annotation.name}`).toContain(saveOf(entry.dc));
        if (entry.grapple) {
          expect(part.desc, `${annotation.monster} ${annotation.name}`).toMatch(
            new RegExp(`(escape DC|DC) ${entry.grapple.escape_dc_value}`),
          );
        }
      }
    }
  });

  it('repeats the save at the end of the next turn for every two-stage condition', () => {
    const staged: Entry[] = [];
    for (const monster of normalized) {
      for (const section of ['actions', 'special_abilities'] as const) {
        for (const part of monster[section] ?? []) {
          for (const owner of [part, ...(part.damage ?? [])]) {
            if (owner.condition?.on_failed_repeat_save) staged.push({ monster: monster.index, name: part.name, owner });
          }
        }
      }
    }
    expect(staged.map(({ monster, name }) => `${monster} ${name}`).sort()).toEqual([
      'basilisk Petrifying Gaze',
      'basilisk Petrifying Gaze',
      'cockatrice Bite',
      'gorgon Petrifying Breath',
      'medusa Petrifying Gaze',
    ]);
    for (const { monster, name, owner } of staged) {
      expect(owner.dc, `${monster} ${name}`).toBeDefined();
      expect(owner.condition.condition_type).toBe('restrained');
      expect(owner.condition.duration.interrupt).toBe('saving throw success');
      expect(owner.condition.on_failed_repeat_save.condition_type).toBe('petrified');
    }
  });

  it('pulls only by a distance the action text states', () => {
    const pulling = normalized.flatMap((monster) =>
      (monster.actions ?? []).filter((action) => action.pull_distance_ft !== undefined).map((action) => ({ monster, action })),
    );
    expect(pulling.map(({ monster, action }) => `${monster.index} ${action.name}`)).toEqual(['roper Reel']);
    for (const { action } of pulling) {
      expect(action.desc).toContain(`${action.pull_distance_ft} ft.`);
      expect(action.situation).toEqual({ target: { condition: 'grappled' } });
    }
  });

  it('adds the riders to the monsters they belong to', () => {
    const rider = (index: string, name: string) => find(normalized, index, 'actions', name).damage as Entry[];
    expect(rider('gladiator', 'Shield Bash')[1]).toEqual({
      dc: { dc_type: 'str', dc_value: 15, success_type: 'none' },
      condition: { condition_type: 'prone', duration: { length: 1, unit: 'round' } },
    });
    expect(rider('deep-gnome-svirfneblin', 'Poisoned Dart')[1]).toEqual({
      dc: { dc_type: 'con', dc_value: 12, success_type: 'none' },
      condition: { condition_type: 'poisoned', duration: { length: 10, unit: 'round', interrupt: 'saving throw success' } },
    });
    expect(rider('gibbering-mouther', 'Blinding Spittle')[0].condition).toEqual({
      condition_type: 'blinded',
      duration: { length: 1, unit: 'round' },
    });
    const blinded = { condition_type: 'blinded', duration: { length: 10, unit: 'round', interrupt: 'saving throw success' } };
    expect(rider('dust-mephit', 'Blinding Breath')[0].condition).toEqual(blinded);
    const deathBurst = find(normalized, 'dust-mephit', 'special_abilities', 'Death Burst');
    expect(deathBurst.condition).toEqual(blinded);
    expect(deathBurst.damage).toEqual([
      {
        dc: { dc_type: 'con', dc_value: 10, success_type: 'none' },
        condition: blinded,
      },
    ]);
    expect(rider('cockatrice', 'Bite')[1].condition).toEqual({
      condition_type: 'restrained',
      duration: { length: 1, unit: 'round', interrupt: 'saving throw success' },
      on_failed_repeat_save: { condition_type: 'petrified', duration: { length: 24, unit: 'hour' } },
    });
    for (const [monster, name] of [['gorgon', 'Petrifying Breath']] as const) {
      expect(rider(monster, name)[0].condition.on_failed_repeat_save).toEqual({
        condition_type: 'petrified',
        duration: { length: 1, unit: 'until restored', ends_when: 'greater restoration or other magic' },
      });
    }
    expect(find(normalized, 'basilisk', 'special_abilities', 'Petrifying Gaze').condition?.on_failed_repeat_save?.duration).toEqual({
      length: 1,
      unit: 'until restored',
      ends_when: 'greater restoration or other magic',
    });
  });

  it('gives the restraining attacks a grapple with the escape DC of their text', () => {
    const expected: [string, string, number][] = [
      ['ettercap', 'Web', 11],
      ['giant-spider', 'Web', 12],
      ['otyugh', 'Tentacle', 13],
      ['roper', 'Tendril', 15],
    ];
    for (const [monster, name, escape] of expected) {
      const damage = find(normalized, monster, 'actions', name).damage as Entry[];
      expect(damage.at(-1)).toEqual({
        grapple: {
          escape_dc_value: escape,
          additional_condition: { condition_type: 'restrained', duration: { length: 1, unit: 'until escape' } },
        },
      });
    }
  });
});

describe('monster conditions applied only in prose', () => {
  const conditions = ['blinded', 'charmed', 'deafened', 'frightened', 'incapacitated', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'];
  const parts = (monster: Entry) =>
    (['actions', 'legendary_actions', 'special_abilities', 'reactions'] as const).flatMap((section) =>
      ((monster[section] ?? []) as Part[]).map((part) => ({ section, part })),
    );
  const structured = (value: unknown, found = new Set<string>()) => {
    if (Array.isArray(value)) value.forEach((item) => structured(item, found));
    else if (value && typeof value === 'object') {
      for (const [key, inner] of Object.entries(value)) {
        if ((key === 'condition_type' || key === 'condition') && typeof inner === 'string') found.add(inner);
        else if (key === 'grapple') {
          found.add('grapple');
          structured(inner, found);
        }
        else structured(inner, found);
      }
    }
    return found;
  };
  // A sentence that has a saving throw (or an escape DC) and applies the condition: "or be knocked prone",
  // "must ... become poisoned", "is grappled (escape DC 12)".
  const applied = (desc: string) => {
    const found = new Set<string>();
    for (const sentence of desc.split(/(?<=[.!])\s+/)) {
      if (!/saving throw|escape DC/.test(sentence)) continue;
      for (const condition of conditions) {
        const word = condition === 'unconscious' ? '(?:unconscious|asleep)' : condition;
        if (new RegExp(`\\b(?:be|become|becomes|is|are|falls?|knocked|also)\\s+(?:also\\s+)?(?:knocked\\s+)?${word}\\b`, 'i').test(sentence)) found.add(condition);
      }
      if (/grappled \(escape DC \d+\)/.test(sentence)) found.add('grapple');
    }
    return found;
  };
  // Conditions the text names that are deliberately not encoded, with the reason. Everything else the text
  // applies with a save must be in the structure.
  const notEncoded: Record<string, string> = {
    'androsphinx actions Roar deafened': 'second condition of the second roar; one condition per save',
    'animated-armor special_abilities Antimagic Susceptibility unconscious': "save against the caster's spell DC",
    'flying-sword special_abilities Antimagic Susceptibility unconscious': "save against the caster's spell DC",
    'rug-of-smothering special_abilities Antimagic Susceptibility unconscious': "save against the caster's spell DC",
    'behir actions Swallow prone': 'regurgitated creatures fall prone; not a rider on a target',
    'kraken actions Bite prone': 'regurgitated creatures fall prone; not a rider on a target',
    'purple-worm actions Bite prone': 'regurgitated creatures fall prone; not a rider on a target',
    'remorhaz actions Swallow prone': 'regurgitated creatures fall prone; not a rider on a target',
    'tarrasque actions Swallow prone': 'regurgitated creatures fall prone; not a rider on a target',
    'bulette actions Deadly Leap prone': "Strength or Dexterity save, the target's choice",
    'death-dog special_abilities Two-Headed unconscious': 'advantage on saves against the condition, no rider',
    'ettin special_abilities Two Heads unconscious': 'advantage on saves against the condition, no rider',
    'hydra special_abilities Multiple Heads unconscious': 'advantage on saves against the condition, no rider',
    'djinni actions Create Whirlwind restrained': 'no duration stated; ends by a Strength check or when the whirlwind ends',
    'drow actions Hand Crossbow unconscious': 'second condition, if the save fails by 5 or more',
    'sprite actions Shortbow unconscious': 'second condition, if the save result is 5 or lower',
    'pseudodragon actions Sting unconscious': 'second condition, if the save fails by 5 or more',
    'mummy actions Dreadful Glare paralyzed': 'second condition, if the save fails by 5 or more',
    'mummy-lord actions Dreadful Glare paralyzed': 'second condition, if the save fails by 5 or more',
    'ghost actions Possession incapacitated': 'possession has no duration of its own',
    'kraken actions Fling prone': 'secondary target of a thrown creature',
    'pit-fiend special_abilities Fear Aura incapacitated': 'the aura needs the pit fiend to be able to act, no rider',
    'shambling-mound actions Multiattack grapple': 'applied by two hits of the Slam, then Engulf; no attack of its own',
    'shambling-mound actions Engulf blinded': 'second condition of the engulfed target',
  };

  it('has a structured condition for every condition a saving throw applies in the text', () => {
    const missing: string[] = [];
    for (const monster of normalized) {
      for (const { section, part } of parts(monster)) {
        const have = structured(part);
        for (const condition of applied(part.desc ?? '')) {
          const key = `${monster.index} ${section} ${part.name} ${condition}`;
          if (!have.has(condition) && !(key in notEncoded)) missing.push(key);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('lists only exceptions that still apply', () => {
    const stale = Object.keys(notEncoded).filter((key) => {
      const [index, section, ...rest] = key.split(' ');
      const condition = rest.pop() as string;
      const name = rest.join(' ');
      const monster = normalized.find((item) => item.index === index);
      const part = monster && parts(monster).find((item) => item.section === section && item.part.name === name);
      return !part || !applied(part.part.desc ?? '').has(condition) || structured(part.part).has(condition);
    });
    expect(stale).toEqual([]);
  });

  it.each([
    ['dire-wolf', 'Bite', 'str', 13], ['dragon-turtle', 'Tail', 'str', 20], ['gibbering-mouther', 'Bites', 'str', 10],
    ['giant-crocodile', 'Tail', 'str', 16], ['mastiff', 'Bite', 'str', 11], ['stone-giant', 'Rock', 'str', 17],
    ['tarrasque', 'Tail', 'str', 20], ['winter-wolf', 'Bite', 'str', 14], ['wolf', 'Bite', 'str', 11], ['worg', 'Bite', 'str', 13],
  ])('%s %s knocks the target prone on a failed DC %s save', (index, name, ability, value) => {
    const rider = (find(normalized, index, 'actions', name).damage as Entry[]).at(-1);
    expect(rider).toEqual({
      dc: { dc_type: ability, dc_value: value, success_type: 'none' },
      condition: { condition_type: 'prone', duration: { length: 1, unit: 'round' } },
    });
  });

  it.each([
    ['bearded-devil', 'Beard', 12, 'poisoned', { length: 10, unit: 'round', interrupt: 'saving throw success' }],
    ['bone-devil', 'Sting', 14, 'poisoned', { length: 10, unit: 'round', interrupt: 'saving throw success' }],
    ['couatl', 'Bite', 13, 'poisoned', { length: 24, unit: 'hour' }],
    ['death-dog', 'Bite', 12, 'poisoned', { length: 1, unit: 'until restored', ends_when: 'disease cured' }],
    ['erinyes', 'Longbow', 14, 'poisoned', { length: 1, unit: 'until restored', ends_when: 'lesser restoration or similar magic' }],
    ['otyugh', 'Bite', 15, 'poisoned', { length: 1, unit: 'until restored', ends_when: 'disease cured' }],
    ['sprite', 'Shortbow', 10, 'poisoned', { length: 10, unit: 'round' }],
    ['ghast', 'Claws', 10, 'paralyzed', { length: 10, unit: 'round', interrupt: 'saving throw success' }],
    ['lich', 'Paralyzing Touch', 18, 'paralyzed', { length: 10, unit: 'round', interrupt: 'saving throw success' }],
  ])('%s %s applies %s after a failed DC %i Constitution save', (index, name, value, condition, duration) => {
    const rider = (find(normalized, index, 'actions', name).damage as Entry[]).at(-1);
    expect(rider).toEqual({
      dc: { dc_type: 'con', dc_value: value, success_type: 'none' },
      condition: { condition_type: condition, duration },
    });
  });

  it('ends the poison of the pit fiend and the vrock when the target succeeds on a repeated save', () => {
    const poisoned = { condition_type: 'poisoned', duration: { length: 1, unit: 'until saving throw success' } };
    expect((find(normalized, 'pit-fiend', 'actions', 'Bite').damage as Entry[])[1].condition).toEqual(poisoned);
    expect((find(normalized, 'vrock', 'actions', 'Spores').damage as Entry[])[0].condition).toEqual(poisoned);
    expect(find(english, 'pit-fiend', 'actions', 'Bite').desc).toContain('repeat the saving throw at the end of each of its turns');
    expect(find(english, 'vrock', 'actions', 'Spores').desc).toContain('repeat the saving throw at the end of each of its turns');
  });

  it('adds the conditions to saves the data already had', () => {
    const condition = (index: string, section: 'actions' | 'special_abilities', name: string, position?: number) => {
      const part = find(normalized, index, section, name);
      return position === undefined ? part.condition : (part.damage as Entry[])[position].condition;
    };
    expect(condition('chuul', 'actions', 'Tentacles', 0)).toEqual({
      condition_type: 'poisoned',
      duration: { length: 10, unit: 'round', interrupt: 'saving throw success' },
    });
    expect(condition('vrock', 'actions', 'Stunning Screech', 0)).toEqual({ condition_type: 'stunned', duration: { length: 1, unit: 'round' } });
    for (const monster of ['ghast', 'hezrou']) {
      expect(condition(monster, 'special_abilities', 'Stench')).toEqual({ condition_type: 'poisoned', duration: { length: 1, unit: 'round' } });
    }
    expect(find(normalized, 'sea-hag', 'special_abilities', 'Horrific Appearance')).toMatchObject({
      dc: { dc_type: 'wis', dc_value: 11, success_type: 'none' },
      condition: { condition_type: 'frightened', duration: { length: 10, unit: 'round', interrupt: 'saving throw success' } },
    });
    const legendary = (index: string, name: string) => normalized.find((m) => m.index === index)?.legendary_actions?.find((a: Part) => a.name === name) as Part;
    expect(legendary('solar', 'Blinding Gaze (Costs 3 Actions)').condition).toEqual({
      condition_type: 'blinded',
      duration: { length: 1, unit: 'until restored', ends_when: 'lesser restoration or similar magic' },
    });
    expect(legendary('mummy-lord', 'Blinding Dust').condition).toEqual({ condition_type: 'blinded', duration: { length: 1, unit: 'round' } });
    expect(legendary('mummy-lord', 'Blasphemous Word (Costs 2 Actions)').condition).toEqual({ condition_type: 'stunned', duration: { length: 1, unit: 'round' } });
    expect(find(normalized, 'androsphinx', 'actions', 'Roar').attacks?.[2]).toMatchObject({
      name: 'Third Roar',
      condition: { condition_type: 'prone', duration: { length: 1, unit: 'round' } },
    });
  });

  it('knocks prone the target of the wereboar Charge, like the boar Charge', () => {
    for (const index of ['wereboar-boar', 'wereboar-hybrid']) {
      const damage = find(normalized, index, 'special_abilities', 'Charge (Boar or Hybrid Form Only)').damage as Entry[];
      expect(damage.at(-1)).toEqual({
        dc: { dc_type: 'str', dc_value: 13, success_type: 'none' },
        condition: { condition_type: 'prone', duration: { length: 1, unit: 'round' } },
      });
    }
  });

  it('applies the wing attack prone condition to every adult and ancient dragon', () => {
    const dragons = normalized.filter((monster) => /^(adult|ancient)-.*-dragon$/.test(monster.index));
    expect(dragons).toHaveLength(20);
    for (const dragon of dragons) {
      const wing = dragon.legendary_actions?.find((action: Part) => action.name === 'Wing Attack (Costs 2 Actions)') as Part;
      expect(wing.condition, dragon.index).toEqual({ condition_type: 'prone', duration: { length: 1, unit: 'round' } });
      expect(wing.dc?.dc_type, dragon.index).toBe('dex');
    }
  });

  it('applies the sleep and paralyzing breath conditions to the young, adult and ancient dragons', () => {
    const option = (index: string, name: string) =>
      find(normalized, index, 'actions', 'Breath Weapons').options.from.options.find((item: Entry) => item.name === name);
    for (const [age, minutes] of [['young', 5], ['adult', 10], ['ancient', 10]] as const) {
      expect(option(`${age}-brass-dragon`, 'Sleep Breath').condition).toEqual({
        condition_type: 'unconscious',
        duration: { length: minutes * 10, unit: 'round', interrupt: 'damage taken' },
      });
      expect(find(english, `${age}-brass-dragon`, 'actions', 'Breath Weapons').desc).toContain(`unconscious for ${minutes} minutes`);
      expect(option(`${age}-silver-dragon`, 'Paralyzing Breath').condition).toEqual({
        condition_type: 'paralyzed',
        duration: { length: 10, unit: 'round', interrupt: 'saving throw success' },
      });
    }
  });

  it('stages the medusa petrification like the basilisk', () => {
    const gaze = (index: string) => find(normalized, index, 'special_abilities', 'Petrifying Gaze').condition;
    expect(gaze('medusa')).toEqual(gaze('basilisk'));
  });

  it('puts the basilisk gaze saving throw and condition in a damage rider entry', () => {
    expect(find(normalized, 'basilisk', 'special_abilities', 'Petrifying Gaze').damage).toEqual([
      {
        dc: { dc_type: 'con', dc_value: 12, success_type: 'none' },
        condition: {
          condition_type: 'restrained',
          duration: { length: 1, unit: 'round', interrupt: 'saving throw success' },
          on_failed_repeat_save: {
            condition_type: 'petrified',
            duration: { length: 1, unit: 'until restored' },
          },
        },
      },
    ]);
  });

  it.each([
    ['behir', 'Constrict', 16, true], ['chain-devil', 'Chain', 14, true], ['chuul', 'Pincer', 14, false],
    ['couatl', 'Constrict', 15, true], ['giant-crocodile', 'Bite', 16, true], ['glabrezu', 'Pincer', 15, false],
    ['kraken', 'Tentacle', 18, true], ['marilith', 'Tail', 19, true], ['octopus', 'Tentacles', 10, false],
    ['remorhaz', 'Bite', 17, true], ['roc', 'Talons', 19, true], ['rug-of-smothering', 'Smother', 13, true],
    ['salamander', 'Tail', 14, true], ['tarrasque', 'Bite', 20, true], ['tyrannosaurus-rex', 'Bite', 17, true],
  ])('%s %s grapples with escape DC %i', (index, name, escape, restrains) => {
    const grapple = (find(normalized, index, 'actions', name).damage as Entry[]).at(-1);
    expect(grapple).toEqual({
      grapple: {
        escape_dc_value: escape,
        ...(restrains ? { additional_condition: { condition_type: 'restrained', duration: { length: 1, unit: 'until escape' } } } : {}),
      },
    });
  });

  it('grapples with the mimic Adhesive', () => {
    expect(find(normalized, 'mimic', 'special_abilities', 'Adhesive (Object Form Only)').damage).toEqual([
      { grapple: { escape_dc_value: 13 } },
    ]);
  });
});

describe('applyEngineAnnotations', () => {
  const monster = () => ({
    index: 'test',
    actions: [{ name: 'Bite', damage: [{ damage_type: 'piercing', damage_dice: '1d4' }] }, { name: 'Web' }],
  });

  it('appends damage entries after the existing ones and creates the list when it is absent', () => {
    const target = monster();
    applyEngineAnnotations(target, [
      { monster: 'test', section: 'actions', name: 'Bite', append_damage: [{ grapple: { escape_dc_value: 10 } }] },
      { monster: 'test', section: 'actions', name: 'Web', append_damage: [{ grapple: { escape_dc_value: 11 } }] },
    ]);
    expect(target.actions[0].damage).toEqual([
      { damage_type: 'piercing', damage_dice: '1d4' },
      { grapple: { escape_dc_value: 10 } },
    ]);
    expect((target.actions[1] as { damage: unknown }).damage).toEqual([{ grapple: { escape_dc_value: 11 } }]);
  });

  it('sets fields on the action, or on a damage entry by position, without sharing the annotation object', () => {
    const target = monster();
    const set = { condition: { condition_type: 'blinded' } };
    applyEngineAnnotations(target, [
      { monster: 'test', section: 'actions', name: 'Bite', damage: 0, set },
      { monster: 'test', section: 'actions', name: 'Web', set: { pull_distance_ft: 5 } },
    ]);
    expect(target.actions[0].damage?.[0]).toEqual({ damage_type: 'piercing', damage_dice: '1d4', condition: { condition_type: 'blinded' } });
    expect((target.actions[0].damage?.[0] as Entry).condition).not.toBe(set.condition);
    expect(target.actions[1]).toEqual({ name: 'Web', pull_distance_ft: 5 });
  });

  it('sets fields on a breath option or an attack named by `attack`', () => {
    const target = {
      index: 'test',
      actions: [
        { name: 'Breath', options: { from: { options: [{ name: 'Sleep Breath' }, { name: 'Fire Breath' }] } } },
        { name: 'Roar', attacks: [{ name: 'First Roar' }] },
      ],
    };
    applyEngineAnnotations(target, [
      { monster: 'test', section: 'actions', name: 'Breath', attack: 'Sleep Breath', set: { condition: { condition_type: 'unconscious' } } },
      { monster: 'test', section: 'actions', name: 'Roar', attack: 'First Roar', set: { condition: { condition_type: 'frightened' } } },
    ]);
    expect(target.actions[0].options?.from.options[0]).toEqual({ name: 'Sleep Breath', condition: { condition_type: 'unconscious' } });
    expect(target.actions[0].options?.from.options[1]).toEqual({ name: 'Fire Breath' });
    expect(target.actions[1].attacks?.[0]).toEqual({ name: 'First Roar', condition: { condition_type: 'frightened' } });
  });

  it('throws when the annotation names nothing in the monster', () => {
    expect(() =>
      applyEngineAnnotations(monster(), [{ monster: 'test', section: 'actions', name: 'Claw', set: {} }]),
    ).toThrow('Annotation target not found');
    expect(() =>
      applyEngineAnnotations(monster(), [{ monster: 'test', section: 'actions', name: 'Web', damage: 0, set: {} }]),
    ).toThrow('Annotation target not found');
  });
});
