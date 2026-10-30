import { describe, expect, it } from 'vitest';
import ClassData from '../en/5e-SRD-Classes.json' with { type: 'json' };
import { classChoiceIds, deriveClassChoices } from '../derive-class-choices';
import { loadPublished } from '../../../scripts/ids';
import { localize, overlayLocales } from '../../i18n/files';

type Choice = { id?: string; from: { options?: Option[] } } & Record<string, unknown>;
type Option = { option_type: string; choice?: Choice; items?: Option[] };
type Class = {
  index: string;
  proficiency_choices: Choice[];
  starting_equipment_options: Choice[];
  multi_classing?: { proficiency_choices?: Choice[]; prerequisite_options?: Choice };
};

const classes = ClassData as unknown as Class[];
const ids = classChoiceIds(classes as never);

// The choices nested in the options of a choice, at any depth.
function nested(choice: Choice): Choice[] {
  const inOption = (option: Option): Choice[] => [
    ...(option.choice ? [option.choice, ...nested(option.choice)] : []),
    ...(option.items ?? []).flatMap(inOption),
  ];
  return (choice.from.options ?? []).flatMap((o) => (typeof o === 'object' ? inOption(o) : []));
}
const listed = (cls: Class) => [
  ...cls.proficiency_choices,
  ...cls.starting_equipment_options,
  ...(cls.multi_classing?.proficiency_choices ?? []),
];

describe('class choice ids', () => {
  it('gives an id to every proficiency, equipment and multi-classing choice, and to the choices nested in them', () => {
    expect(classes.flatMap((c) => c.proficiency_choices)).toHaveLength(14);
    expect(classes.flatMap((c) => c.starting_equipment_options)).toHaveLength(39);
    expect(classes.flatMap((c) => c.multi_classing?.proficiency_choices ?? [])).toHaveLength(4);
    expect(classes.flatMap((c) => listed(c).flatMap(nested))).toHaveLength(21);
    for (const cls of classes) {
      for (const choice of [...listed(cls), ...listed(cls).flatMap(nested)]) {
        expect(choice.id, `${cls.index}: ${JSON.stringify(choice.desc)}`).toMatch(/^[a-z0-9-]+$/);
      }
    }
    expect(ids).toHaveLength(78);
  });

  it('has unique ids that start with the class and name the kind of choice', () => {
    expect(new Set(ids).size).toBe(ids.length);
    for (const cls of classes) {
      cls.starting_equipment_options.forEach((choice, i) =>
        expect(choice.id).toBe(`${cls.index}-equipment-${i + 1}`)
      );
      for (const choice of cls.proficiency_choices) {
        expect(choice.id).toMatch(new RegExp(`^${cls.index}-proficiency-[a-z-]+$`));
      }
      for (const choice of cls.multi_classing?.proficiency_choices ?? []) {
        expect(choice.id).toMatch(new RegExp(`^${cls.index}-multiclass-proficiency-[a-z-]+$`));
      }
    }
  });

  it('names a nested choice after the choice and the position it is in', () => {
    const fighter = classes.find((c) => c.index === 'fighter')!;
    const armsChoice = fighter.starting_equipment_options[1];
    expect(armsChoice.id).toBe('fighter-equipment-2');
    expect(nested(armsChoice).map((c) => c.id)).toEqual([
      'fighter-equipment-2-option-1-item-1',
      'fighter-equipment-2-option-2',
    ]);
    const bard = classes.find((c) => c.index === 'bard')!;
    expect(bard.proficiency_choices.map((c) => c.id)).toEqual([
      'bard-proficiency-skills',
      'bard-proficiency-instruments',
    ]);
  });

  it('is derived from the data without drift', () => {
    expect(deriveClassChoices(ClassData as never)).toEqual(ClassData);
  });

  it('only grows: every id in ids/published.json is still in the data', () => {
    expect(loadPublished()['class-choices']).toEqual([...ids].sort());
  });

  it('is the same in every translation', () => {
    for (const lang of overlayLocales()) {
      expect(classChoiceIds(localize('classes', lang) as never), lang).toEqual(ids);
    }
  });
});
