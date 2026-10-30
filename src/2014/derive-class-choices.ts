import fs from 'node:fs';
import path from 'node:path';

// A stable `id` for every proficiency choice and starting-equipment choice of a class, including the choices in
// `multi_classing.proficiency_choices` and the choices nested in the `options` of another choice. The ids are
// written into src/2014/en/5e-SRD-Classes.json by this script; once published they are never renamed or removed
// (see "Id stability contract" in CONTRIBUTING.md).
//
//   <class>-equipment-<n>                     the nth starting-equipment choice, counted from 1
//   <class>-proficiency-<what>                a proficiency choice: skills, instruments, tool-or-instrument
//   <class>-multiclass-proficiency-<what>     a choice in multi_classing.proficiency_choices
//   <choice id>-option-<n>                    a choice that is the nth option of another choice
//   <choice id>-option-<n>-item-<m>           a choice that is the mth item of a `multiple` option

type Choice = { id?: string; from?: { options?: unknown[] } } & Record<string, unknown>;
type Option = { option_type: string; choice?: Choice; items?: Option[]; item?: { index: string } };
type Class = {
  index: string;
  proficiency_choices: Choice[];
  starting_equipment_options: Choice[];
  multi_classing?: { proficiency_choices?: Choice[] } & Record<string, unknown>;
} & Record<string, unknown>;

// What a proficiency choice picks from, when it is not skills (a choice of skills is named from its options).
// Keyed by the class and the position of the choice in its list, counted from 1.
const PROFICIENCY_KINDS: Record<string, string> = {
  'bard:proficiency:2': 'instruments',
  'bard:multiclass:2': 'instruments',
  'monk:proficiency:2': 'tool-or-instrument',
};

function proficiencyKind(
  classIndex: string,
  list: string,
  position: number,
  choice: Choice
): string {
  const named = PROFICIENCY_KINDS[`${classIndex}:${list}:${position}`];
  if (named) return named;
  const options = (choice.from?.options ?? []) as Option[];
  const skills = options.every(
    (o) => o.option_type === 'reference' && o.item?.index.startsWith('skill-')
  );
  if (!skills) throw new Error(`${classIndex} ${list} choice ${position}: say what it picks from`);
  return 'skills';
}

// The choice with `id` first and the choices nested in its options given theirs.
function withId(choice: Choice, id: string): Choice {
  const { id: _previous, ...rest } = choice;
  const options = rest.from?.options;
  if (!options) return { id, ...rest };
  const nested = (option: Option, suffix: string): Option => {
    if (option.option_type === 'choice' && option.choice) {
      return { ...option, choice: withId(option.choice, `${id}-${suffix}`) };
    }
    if (option.option_type === 'multiple' && option.items) {
      return {
        ...option,
        items: option.items.map((item, i) => nested(item, `${suffix}-item-${i + 1}`)),
      };
    }
    return option;
  };
  const from = {
    ...rest.from,
    options: (options as Option[]).map((o, i) => nested(o, `option-${i + 1}`)),
  };
  return { id, ...rest, from };
}

function deriveClass(cls: Class): Class {
  const proficiency = cls.proficiency_choices.map((choice, i) =>
    withId(
      choice,
      `${cls.index}-proficiency-${proficiencyKind(cls.index, 'proficiency', i + 1, choice)}`
    )
  );
  const equipment = cls.starting_equipment_options.map((choice, i) =>
    withId(choice, `${cls.index}-equipment-${i + 1}`)
  );
  const multiClassing = cls.multi_classing?.proficiency_choices
    ? {
        ...cls.multi_classing,
        proficiency_choices: cls.multi_classing.proficiency_choices.map((choice, i) =>
          withId(
            choice,
            `${cls.index}-multiclass-proficiency-${proficiencyKind(cls.index, 'multiclass', i + 1, choice)}`
          )
        ),
      }
    : cls.multi_classing;
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(cls)) {
    if (name === 'proficiency_choices') out[name] = proficiency;
    else if (name === 'starting_equipment_options') out[name] = equipment;
    else if (name === 'multi_classing') out[name] = multiClassing;
    else out[name] = value;
  }
  return out as Class;
}

export function deriveClassChoices(classes: Class[]): Class[] {
  return classes.map(deriveClass);
}

/** Every choice id in a class, in document order: the proficiency, equipment and multi-classing choices and the choices nested in their options. */
export function classChoiceIds(classes: Class[]): string[] {
  const ids: string[] = [];
  const visit = (value: unknown, inChoiceList: boolean): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item, inChoiceList);
    } else if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (inChoiceList && typeof record.id === 'string') ids.push(record.id);
      const nested = record.from as { options?: unknown[] } | undefined;
      for (const option of nested?.options ?? []) visitOption(option as Option);
    }
  };
  const visitOption = (option: Option): void => {
    if (option.choice) visit(option.choice, true);
    for (const item of option.items ?? []) visitOption(item);
  };
  for (const cls of classes) {
    visit(cls.proficiency_choices, true);
    visit(cls.starting_equipment_options, true);
    visit(cls.multi_classing?.proficiency_choices, true);
  }
  return ids;
}

const repoRoot = path.resolve(import.meta.dirname, '../..');
const classesFile = path.join(repoRoot, 'src/2014/en/5e-SRD-Classes.json');

function writeClassesToFile() {
  const classes = JSON.parse(fs.readFileSync(classesFile, 'utf8')) as Class[];
  fs.writeFileSync(classesFile, `${JSON.stringify(deriveClassChoices(classes), null, 2)}\n`);
  console.log(`Derived the choice ids of ${classes.length} classes`);
}

if (process.argv[1]?.endsWith('/derive-class-choices.ts')) {
  writeClassesToFile();
}
