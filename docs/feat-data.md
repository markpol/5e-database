# Feats and backgrounds

`src/2014/en/5e-SRD-Feats.json` and `src/2014/en/5e-SRD-Backgrounds.json` began as the one feat (Grappler) and the one
background (Acolyte) of SRD 5.1. They now also hold entries adapted from the SRD 5.2 set in `src/2024/en/` (which is
frozen and unchanged) and a few entries written for this data. Every field is optional and additive: the ids and the
text of Grappler and Acolyte are unchanged.

## Where an entry comes from

Each added entry has a `source`: `srd-5.2` for an entry adapted from the SRD 5.2 set, `dd` for one written for this
data. The entries of SRD 5.1 have none. The same entries are listed under `records` of the file in
[src/provenance/source-markers.json](../src/provenance/source-markers.json), and `NOTICE.md` says which fields and
records come from which source. `source` is English-only and is never translated.

| Collection  | SRD 5.1 | Added from SRD 5.2 | Written for this data                   | Total |
| ----------- | ------: | -----------------: | --------------------------------------- | ----: |
| Backgrounds |       1 |                  3 | 2 (`cartographer`, `lighthouse-keeper`) |     6 |
| Feats       |       1 |                 16 | 0                                       |    17 |

The ids are those of the SRD 5.2 entries (`criminal`, `sage`, `soldier`, `alert`, `boon-of-fate` and so on). The SRD 5.2
backgrounds Acolyte and the feat Grappler are not added a second time: the SRD 5.1 entries stay as they are.

## Feats

Fields added to a feat, all optional:

| Field                   | Meaning                                                                                                                  | Translated |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `type`                  | `origin`, `general`, `fighting-style` or `epic-boon`, as in the feat shape of the SRD 5.2 set                            | no         |
| `repeatable`            | When the feat can be taken more than once, and under what limit, as in the SRD 5.2 shape                                 | yes        |
| `minimum_level`         | The character level needed to take the feat (4 for Ability Score Improvement, 19 for the epic boons)                     | no         |
| `feature_named`         | The class feature needed (`Fighting Style` for the fighting-style feats, `Spellcasting` for Boon of Spell Recall)        | no         |
| `source`                | `srd-5.2` or `dd`                                                                                                        | no         |
| `engine`                | `{ action_cost, recharge?, uses?, modifiers? }`, the same shape and words as `feature_specific.engine` of class features | no         |
| `grants_asi`            | `true` on the feat that is an Ability Score Improvement, as on the class features of that name                           | no         |
| `granted_proficiencies` | The proficiencies the feat gives: `{ choose: 3, from: "skills_or_tools" }` for Skilled                                   | no         |

`desc` of an added feat is the SRD 5.2 text split into one paragraph for each line. The prerequisites of the SRD 5.1 feat
(`prerequisites`, an ability score and a minimum) are unchanged; `minimum_level` and `feature_named` hold the
prerequisites of the SRD 5.2 feats that have no ability score.

`engine` is read as it is for class features ([feature-mechanics.md](feature-mechanics.md)). A feat has no class level,
so none of its `engine` uses `class_specific`, `by_level` or a pool. The modifiers use the same words as the class
features, and the feats need these that the class features did not: the `bonus` target `initiative`, the `while`
circumstance `target_grappled_by_owner`, the `ability_score_increase` field `choose`, and the modifiers
`roll_damage_twice`, `minimum_damage_die`, `hit_instead_of_miss`, `teleport`, `ignore_resistance` and `sense`.

`src/2014/tests/feat-effects.test.ts` checks every modifier against a phrase of the feat text, and the cost, the uses and
the recharge against the text, with rules that do not share code with the data.

### What is structured

13 feats have an `engine`, Ability Score Improvement has `grants_asi`, and Skilled has `granted_proficiencies`: 15 of the
16 added feats, and Grappler of SRD 5.1.

| Feat                         | Structure                                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Alert                        | Adds the proficiency bonus to the initiative roll                                                                             |
| Savage Attacker              | Once a turn, rolls the weapon's damage dice twice and uses either roll                                                        |
| Skilled                      | `granted_proficiencies`: three skills or tools of the owner's choice                                                          |
| Ability Score Improvement    | `grants_asi`                                                                                                                  |
| Archery                      | +2 to attack rolls with ranged weapons                                                                                        |
| Defense                      | +1 to Armor Class while wearing armor                                                                                         |
| Great Weapon Fighting        | A damage die of a melee weapon held in two hands counts as at least 3                                                         |
| Two Weapon Fighting          | The ability modifier is added to the damage of the off-hand attack                                                            |
| The seven epic boons         | Raise one ability score of the owner's choice by 1, to at most 30, and the benefits listed below                              |
| Boon of Combat Prowess       | Once until the start of the next turn, a missed attack roll hits instead                                                      |
| Boon of Dimensional Travel   | Teleports up to 30 feet right after the Attack action or the Magic action                                                     |
| Boon of Fate                 | One use that returns after a short rest                                                                                       |
| Boon of Irresistible Offense | Bludgeoning, piercing and slashing damage ignores resistance                                                                  |
| Boon of the Night Spirit     | A bonus action that makes the owner invisible, and resistance to all damage but psychic and radiant, in dim light or darkness |
| Boon of Truesight            | Truesight with a range of 60 feet                                                                                             |
| Grappler (SRD 5.1)           | `type: general`; advantage on attack rolls against a creature the owner is grappling                                          |

### What is not structured

| Feat or part                                          | Reason                                                                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Magic Initiate (whole feat)                           | The cantrips and the level 1 spell are chosen from a spell list; no modifier can name a spell that the owner chooses |
| Alert: Initiative Swap                                | Swaps the initiative of two creatures; no modifier changes another creature                                          |
| Grappler: pinning a grappled creature                 | A contested check that restrains both creatures; no modifier states a contested check                                |
| Boon of Fate: Improve Fate                            | A 2d4 bonus or penalty on the d20 roll of another creature, and a recharge on rolling Initiative; neither has a word |
| Boon of Irresistible Offense: Overwhelming Strike     | Extra damage equal to the ability score the owner chose to increase; no amount names that score                      |
| Boon of Spell Recall: Free Casting                    | A 1d4 roll that decides whether a spell slot is expended; no modifier states a chance                                |
| Boon of the Night Spirit: how Merge with Shadows ends | The condition ends right after the owner takes an action, a bonus action or a reaction; no duration states that      |

Boon of Spell Recall has only the ability score increase in its `engine`. Boon of Fate has the increase, one use and a
`short_rest` recharge, which restates the text only in part (it also recharges on rolling Initiative).

### Judgement calls

- An `engine` has one `action_cost`, the cost of using the feat. Boon of the Night Spirit costs a bonus action (Merge with
  Shadows) and also holds the resistance that applies without a use, as Rage holds modifiers that apply while raging.
  Boon of Combat Prowess, Boon of Dimensional Travel and Boon of Fate are `free`: the text says the owner can use them
  at a moment, with no action.
- Great Weapon Fighting of SRD 5.2 treats a 1 or a 2 as a 3, which is not the reroll of the class feature of the same
  name (`reroll_damage`), so it has its own modifier (`minimum_damage_die`).
- Two Weapon Fighting is `attack_kind: off_hand`, as the fighting styles of the class features are.
- A boon names all six abilities with `choose: 1`: the owner raises one of them.

## Backgrounds

The shape of Acolyte is kept: `starting_proficiencies`, `language_options`, `starting_equipment`, `starting_gold`,
`starting_equipment_options`, `feature` and the four personality tables. Fields added, all optional:

| Field                 | Meaning                                                                                                | Translated |
| --------------------- | ------------------------------------------------------------------------------------------------------ | ---------- |
| `source`              | `srd-5.2` or `dd`                                                                                      | no         |
| `ability_scores`      | The abilities the background can raise, as references into the ability scores (SRD 5.2 shape)          | no         |
| `feat`                | The origin feat the background gives, a reference into the feats; `note` names a choice made within it | no         |
| `proficiency_choices` | Proficiencies the owner picks (a choice, as in the classes)                                            | the `desc` |

The three backgrounds adapted from SRD 5.2 (`criminal`, `sage`, `soldier`) have their proficiencies as
`starting_proficiencies` (the skills and the tool), their ability scores and origin feat, and the choice between the
equipment package and 50 gp as an entry of `starting_equipment_options` (the options of a `multiple` item and a `money`
option, as in the SRD 5.2 data). The SRD 5.2 backgrounds have no `feature` or personality tables, so these three have
none. The items are references into the 2014 equipment; two are named differently there (the robe is `robes`, the
parchment `parchment-one-sheet`). The soldier's gaming set is a choice between the dice set and the playing card set, the
two gaming sets that the 2014 data has. The Sage's origin feat is Magic Initiate (Wizard), as in the SRD 5.2 text.

`cartographer` and `lighthouse-keeper` are written for this data, with a `feature` and the four personality tables in the
shape of Acolyte. Their wording is original; none of it is taken from a book that is not an SRD.

## Translations

Translation overlays hold text only. The new text fields are translatable (`desc` and `repeatable` of a feat; the
`feature`, the personality tables and the `desc` of a choice of a background), and `type`, `source`, `engine`,
`grants_asi`, `granted_proficiencies`, `minimum_level`, `feature_named`, `ability_scores` and `feat` are English-only. The
added entries are untranslated: the coverage report (`pnpm run i18n:coverage`) shows them as such.
