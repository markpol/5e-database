# Class spellcasting

The `spellcasting` object of the eight spellcasting classes in `src/2014/en/5e-SRD-Classes.json` (bard, cleric, druid,
paladin, ranger, sorcerer, warlock, wizard) keeps its `level`, `spellcasting_ability` and `info` text. Four optional
fields next to them restate that text, and what the subclasses add, as data:

| Field              | What it says                                                        | Classes                        |
| ------------------ | ------------------------------------------------------------------- | ------------------------------ |
| `caster_kind`      | How the class gains spell slots: `full`, `half` or `pact`           | all 8                          |
| `prepared_formula` | How many spells a prepared caster prepares                          | cleric, druid, paladin, wizard |
| `spellbook_size`   | The spells in a spellbook                                           | wizard                         |
| `subclass_spells`  | What the subclasses add to the class spells, and which have no list | all 8                          |

They are additive, English-only (the translation overlays do not carry them) and marked `dd` in
`src/provenance/source-markers.json`. They are written by `src/2014/derive-class-spellcasting.ts`
(`pnpm run derive:spellcasting`), which reads the `info` text, the features and the subclasses, and throws on a text
it has no rule for. The Zod schema in `src/2014/schemas/5e-SRD-Classes.ts` fixes the vocabulary.
`src/2014/tests/class-spellcasting.test.ts` checks the values against the text, the Levels rows and the Subclasses
file with rules that do not share code with the derivation.

## `caster_kind`

| Value  | Classes                               | How it shows in the Levels rows                                                       |
| ------ | ------------------------------------- | ------------------------------------------------------------------------------------- |
| `full` | bard, cleric, druid, sorcerer, wizard | Slots from the 1st level, up to 9th-level slots at class level 17                     |
| `half` | paladin, ranger                       | Slots from the 2nd level (`spellcasting.level`), up to 5th-level slots                |
| `pact` | warlock                               | Pact Magic: slots of one level at a time, up to 5th-level slots, back on a short rest |

The derivation reads `pact` from the Pact Magic feature, and `full` or `half` from the class level at which
spellcasting starts.

## `prepared_formula`

The number of spells a class prepares each day, from the sentence "choose a number of ... spells equal to your
(ability) modifier + ...":

```json
{ "class_levels": "full", "minimum": 1 }
```

`class_levels` is `full` when the class level is added as it is (cleric, druid, wizard) and `half_rounded_down` when
half of it is added, rounded down (paladin). The ability is the `spellcasting_ability` of the class. `minimum` is the
least number of prepared spells ("minimum of one spell"). Bard, ranger, sorcerer and warlock have no
`prepared_formula`: they know a fixed number of spells, `spells_known` in the Levels `spellcasting` rows. A class has a
`prepared_formula` exactly when its text has a Preparing and Casting Spells paragraph, and its Levels rows then have no
`spells_known`.

## `spellbook_size`

```json
{ "initial": 6, "per_level": 2 }
```

A wizard's spellbook holds `initial` spells of 1st level at the 1st class level (the Spellbook text: "six 1st-level
wizard spells") and gains `per_level` spells for each level gained after the first, so a wizard of level `n` has
`initial + per_level × (n − 1)` spells in the book from levels alone. Spells copied from scrolls and other spellbooks
come on top. `initial` is read from the text. `per_level` is the SRD Spellbook rule; the wizard text in this data does
not state it, so it is a value of this data and marked `dd`.

## `subclass_spells`

```json
{ "mode": "always_prepared", "with_spells": ["life"], "without_spells": [] }
```

| `mode`            | Meaning                                                                                              | Classes                        |
| ----------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------ |
| `always_prepared` | The subclass spells are always prepared and do not count against the number of prepared spells       | cleric, druid, paladin         |
| `expanded_list`   | The subclass spells are added to the class spell list and are learned like other spells of the class | warlock                        |
| `none`            | No SRD subclass of the class has a spell list                                                        | bard, ranger, sorcerer, wizard |

`with_spells` and `without_spells` are the indices of the subclasses of the class in `5e-SRD-Subclasses.json` that do
and do not have a `spells` list there; the list, with the class level at which each spell is gained, stays on the
subclass. The SRD gives a spell list to four subclasses:

| Class   | Subclass   | Term   | `mode`            |
| ------- | ---------- | ------ | ----------------- |
| cleric  | `life`     | domain | `always_prepared` |
| druid   | `land`     | circle | `always_prepared` |
| paladin | `devotion` | oath   | `always_prepared` |
| warlock | `fiend`    | patron | `expanded_list`   |

The other eight SRD subclasses have none: `lore` (bard), `hunter` (ranger), `draconic` (sorcerer) and `evocation`
(wizard) belong to spellcasting classes (these four are `without_spells`), and `berserker`, `champion`, `open-hand` and
`thief` belong to classes without spellcasting. The `expanded_list` mode of the warlock is the SRD's Expanded Spell
List rule: no feature record of this data states it, so the derivation takes it from the lack of an "always have it
prepared" feature.
