import LevelData from './en/5e-SRD-Levels.json' with { type: 'json' };

// An id for each count of a class feature whose count or size grows with the level and has a single feature record:
// Rage's uses and damage, the ki and sorcery points, the Sneak Attack dice, the Martial Arts die, Unarmored
// Movement, Arcane Recovery. The counts are read from the `class_specific` rows of 5e-SRD-Levels and written as
// `by_level` next to the `class_specific` key that holds them (in the `uses` or in a modifier of the feature's
// `engine`): one step for each level at which the count changes. Features whose counts have a feature record each
// (Action Surge, Indomitable, Extra Attack, ...) keep those records and their ids. Once published an id is never
// renamed or removed (see "Id stability contract" in CONTRIBUTING.md).

type LevelRow = { level: number; class: { index: string }; subclass?: unknown } & {
  class_specific?: Record<string, unknown>;
};
type Dice = { dice_count: number; dice_value: number };
export type CountStep = { id: string; level: number; count?: number; dice?: string };
type Feature = { index: string; class?: { index: string }; level: number } & Record<
  string,
  unknown
>;

// The Levels value 9999 means there is no limit (Rage at 20th level).
const UNLIMITED = 9999;

interface Progression {
  /** The `class_specific` key of the class rows that holds the count. */
  key: string;
  /** The start of each id: `<stem>-<count>-<unit>`, or `<stem>-<dice>` for dice. */
  stem: string;
  /** The unit of a count, singular and plural. */
  unit: [string, string];
}

// The features that get a `by_level`, one entry for each count they have.
export const COUNT_PROGRESSIONS: Record<string, Progression[]> = {
  rage: [
    { key: 'rage_count', stem: 'rage', unit: ['use', 'uses'] },
    { key: 'rage_damage_bonus', stem: 'rage', unit: ['damage', 'damage'] },
  ],
  ki: [{ key: 'ki_points', stem: 'ki', unit: ['point', 'points'] }],
  'font-of-magic': [{ key: 'sorcery_points', stem: 'sorcery', unit: ['point', 'points'] }],
  'sneak-attack': [{ key: 'sneak_attack', stem: 'sneak-attack', unit: ['', ''] }],
  'martial-arts': [{ key: 'martial_arts', stem: 'martial-arts', unit: ['', ''] }],
  'unarmored-movement-1': [
    { key: 'unarmored_movement', stem: 'unarmored-movement', unit: ['ft', 'ft'] },
  ],
  'arcane-recovery': [
    { key: 'arcane_recovery_levels', stem: 'arcane-recovery', unit: ['level', 'levels'] },
  ],
};

// The `class_specific` keys of an `engine` that grow with the level and are not counted here, and why. Each is a
// pair `<feature>:<key>`.
const OWN_RECORDS = 'each count has a feature record of its own';
export const COUNT_EXCLUDED: Record<string, string> = {
  'bardic-inspiration-d6:bardic_inspiration_die': OWN_RECORDS,
  'bardic-inspiration-d8:bardic_inspiration_die': OWN_RECORDS,
  'cutting-words:bardic_inspiration_die': OWN_RECORDS,
  'channel-divinity-1-rest:channel_divinity_charges': OWN_RECORDS,
  'action-surge-1-use:action_surges': OWN_RECORDS,
  'indomitable-1-use:indomitable_uses': OWN_RECORDS,
  'indomitable-2-uses:indomitable_uses': OWN_RECORDS,
  'brutal-critical-1-die:brutal_critical_dice': OWN_RECORDS,
  'brutal-critical-2-dice:brutal_critical_dice': OWN_RECORDS,
  'destroy-undead-cr-1-2-or-below:destroy_undead_cr': OWN_RECORDS,
  'wild-shape-cr-1-4-or-below-no-flying-or-swim-speed:wild_shape_max_cr': OWN_RECORDS,
  'wild-shape-cr-1-4-or-below-no-flying-or-swim-speed:wild_shape_fly': OWN_RECORDS,
  'wild-shape-cr-1-4-or-below-no-flying-or-swim-speed:wild_shape_swim': OWN_RECORDS,
  'wild-shape-cr-1-2-or-below-no-flying-speed:wild_shape_max_cr': OWN_RECORDS,
  'wild-shape-cr-1-2-or-below-no-flying-speed:wild_shape_fly': OWN_RECORDS,
  'wild-shape-cr-1-2-or-below-no-flying-speed:wild_shape_swim': OWN_RECORDS,
  'flexible-casting-creating-spell-slots:creating_spell_slots':
    'a table of costs for each spell slot level, not a count',
};

const classRows = (classIndex: string): LevelRow[] =>
  (LevelData as unknown as LevelRow[])
    .filter((row) => !row.subclass && row.class.index === classIndex)
    .sort((a, b) => a.level - b.level);

const isDice = (value: unknown): value is Dice =>
  typeof value === 'object' && value !== null && 'dice_value' in value;

function stepId(progression: Progression, value: number | Dice): string {
  const { stem, unit } = progression;
  if (isDice(value)) return `${stem}-${value.dice_count}d${value.dice_value}`;
  if (value === UNLIMITED) return `${stem}-unlimited-${unit[1]}`;
  return `${stem}-${value}-${value === 1 ? unit[0] : unit[1]}`;
}

/** The steps of a count: the levels at which the `class_specific` value of the class changes, without the levels at which it is 0. */
export function countSteps(classIndex: string, progression: Progression): CountStep[] {
  const steps: CountStep[] = [];
  let previous: string | undefined;
  for (const row of classRows(classIndex)) {
    const value = row.class_specific?.[progression.key] as number | Dice | undefined;
    if (value === undefined)
      throw new Error(`${classIndex} level ${row.level}: no ${progression.key}`);
    const signature = JSON.stringify(value);
    if (signature === previous) continue;
    previous = signature;
    if (value === 0) continue;
    const id = stepId(progression, value);
    steps.push(
      isDice(value)
        ? { id, level: row.level, dice: `${value.dice_count}d${value.dice_value}` }
        : { id, level: row.level, count: value }
    );
  }
  return steps;
}

const withByLevel = <T extends Record<string, unknown>>(owner: T, steps: CountStep[]): T => ({
  ...owner,
  by_level: steps,
});

/** The `engine` with a `by_level` next to each `class_specific` key of `progressions`. */
function applyProgressions(
  engine: Record<string, unknown>,
  classIndex: string,
  progressions: Progression[]
): Record<string, unknown> {
  const stepsOf = new Map(progressions.map((p) => [p.key, countSteps(classIndex, p)]));
  const used = new Set<string>();
  const apply = <T extends Record<string, unknown>>(owner: T): T => {
    const key = owner.class_specific;
    if (typeof key !== 'string' || !stepsOf.has(key)) return owner;
    used.add(key);
    return withByLevel(owner, stepsOf.get(key)!);
  };
  const out = { ...engine };
  if (out.uses) out.uses = apply(out.uses as Record<string, unknown>);
  if (out.modifiers) out.modifiers = (out.modifiers as Record<string, unknown>[]).map(apply);
  for (const key of stepsOf.keys()) {
    if (!used.has(key)) throw new Error(`${classIndex}: no engine place for the count ${key}`);
  }
  return out;
}

/** The `engine` of a feature with its counts, if it is one of the count-bearing features. */
export function deriveFeatureCounts(
  feature: Feature,
  engine: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  const progressions = COUNT_PROGRESSIONS[feature.index];
  if (!progressions) return engine;
  if (!engine || !feature.class) throw new Error(`${feature.index}: a count needs a class engine`);
  return applyProgressions(engine, feature.class.index, progressions);
}

type WithEngine = { feature_specific?: { engine?: Record<string, unknown> } };

/** Every `by_level` step of a feature's engine, with the `class_specific` key it counts. */
export function countsOf(feature: WithEngine): { key: string; steps: CountStep[] }[] {
  const engine = feature.feature_specific?.engine;
  const owners = [engine?.uses, ...((engine?.modifiers as unknown[]) ?? [])] as (
    { class_specific?: string; by_level?: CountStep[] } | undefined
  )[];
  return owners.flatMap((owner) =>
    owner?.by_level && owner.class_specific
      ? [{ key: owner.class_specific, steps: owner.by_level }]
      : []
  );
}

/** The ids of all the counts of the features. */
export function featureCountIds(features: WithEngine[]): string[] {
  return features.flatMap((feature) =>
    countsOf(feature).flatMap(({ steps }) => steps.map((s) => s.id))
  );
}
