# Changes relative to upstream

This document lists what this fork (`markpol/5e-database`) changes in the data relative to upstream
(`5e-bits/5e-database`). The changes are written in terms of the data: which fields and records were added, changed
or removed. They are scoped to the `src/2014` (2014 SRD) data set; nothing in `src/2024` is touched.

The data is used by the Draconian Dungeons game. Some fields restate a rule that the SRD gives only as prose, in
structured form, so the rule does not have to be parsed out of English text. Content with no use in the game was
removed.

## At a glance

| Area                          | File(s)                                                                                                                                                                                                                                     | What changed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monster actions               | `5e-SRD-Monsters.json`                                                                                                                                                                                                                      | Added `attack_type` ("Melee"/"Ranged") to actions; added `bonus_actions` (parsed list of bonus-action ids); added `environments` (habitat string); `speed.*` and `senses.{darkvision,blindsight,truesight}` changed from strings (`"40 ft."`) to plain integers (`40`); added `weapon`, `weapon_kind`, and `supply` (equipment-linked weapon/ammunition annotations)                                                                                                                                                                                                                                                                                                                                                              |
| Monster normalization         | `5e-SRD-Monsters-Normalized.json` (new file), `normalize-monsters.ts` (new script), `monster-engine-annotations.json` (new file), `verify-normalize.sh` (new script)                                                                        | Adds a pre-flattened copy of the monster data that collapses nested reference objects (`dc_type`, `damage_type`, `condition_type`, spellcasting `ability`, etc.) down to their plain string `index`, normalizes where `dc`/`condition` sit on an action, merges in extra annotations (e.g. conditions applied on a failed save, riders, grapples, a pull distance, weapon annotations) from `monster-engine-annotations.json`, and derives the structure of attacks (`attack_type`, `attack_kind`, `reach_ft`, `range`) and of areas of effect (`area`) from the action text; `src/2014/tests/normalized-monsters.test.ts` regenerates from the English source and asserts it matches the committed normalized file byte-for-byte |
| Monster effects               | `5e-SRD-Monsters-Normalized.json`, `derive-monster-effects.ts` (new script)                                                                                                                                                                 | Added to traits and actions of the normalized monsters `trigger`, `regeneration` (7 traits), `damage_dice_at_half_hp` (10 swarm attacks), `detach_after_damage` (1), `reduce_max_hp` (8), `reduction_dice` (6) and `resistances` (1), and to each monster `vulnerabilities`, `resistances` and `immunities`, the damage lists as rules of the form `{ types, unless? }`, all read from the SRD text (see [monster-effects.md](monster-effects.md))                                                                                                                                                                                                                                                                                |
| Spells                        | `5e-SRD-Spells.json`, `derive-spell-mechanics.ts` (new script), `derive-spell-combat.ts` (new script), `derive-spell-engine.ts` (new script), `spell-engine-annotations.json` (new file)                                                    | Added `range_ft`, `casting_time_data` and `duration_data` to every spell, derived from the `range`, `casting_time` and `duration` text; added missing `damage`, `dc` and `area_of_effect` entries, fixed two areas, and added `heal_at_slot_level_data`, `damage[].damage_at_slot_level_data`, `temp_hp_at_slot_level` and `targets_at_slot_level`, derived from the description and `higher_level` text; added `engine` (`kind`, `target`, `campaign`, `npc`), a hand-written classification of 117 combat spells (see [spell-mechanics.md](spell-mechanics.md))                                                                                                                                                                 |
| Conditions                    | `5e-SRD-Conditions.json`                                                                                                                                                                                                                    | Added 17 new condition entries: 6 numbered exhaustion levels (`exhaustion-1`…`exhaustion-6`) plus `enraged`, `frenzied`, `reckless`, `dodging`, `infested`, `swallowed`, `drained-of-strength`, `weakened`, `slowed`, `drained-of-life`, `disengaged`, `surprised`; added 14 more for states that the SRD text implies (`no-reactions`, `concentrating` and 12 effects of spells and of the Sacred Weapon option); added a structured `effects` object to every condition, and `exhaustion_level`, `removes`, `adds`, `on_remove` and `immune_if_feature` where the text defines them (see "Conditions: structured effects")                                                                                                      |
| Equipment                     | `5e-SRD-Equipment.json`                                                                                                                                                                                                                     | Added `material`, `stackable`, `is_consumable`, `effect` (damage-on-use) to select items; removed 40 non-combat items (mounts, vehicles, barding, tack/harness, stabling/feed)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Equipment categories          | `5e-SRD-Equipment-Categories.json`                                                                                                                                                                                                          | Removed 6 non-combat categories (`gaming-sets`, `land-vehicles`, `mounts-and-other-animals`, `mounts-and-vehicles`, `tack-harness-and-drawn-vehicles`, `waterborne-vehicles`) and their members                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Proficiencies                 | `5e-SRD-Proficiencies.json`                                                                                                                                                                                                                 | Removed proficiency entries tied to the removed equipment (e.g. `nets`, `land-vehicles`, `water-vehicles`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Classes                       | `5e-SRD-Classes.json`, `derive-class-choices.ts` (new script)                                                                                                                                                                               | Added a stable `id` to the 14 proficiency choices, the 39 starting-equipment choices, the 4 multi-classing proficiency choices and the 21 choices nested in their options (see "Classes: choice ids")                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Features                      | `5e-SRD-Features.json`, `derive-feature-engine.ts` (new script), `feature-engine-annotations.json` (new file)                                                                                                                               | Bard/Rogue Expertise reworked from a two-level nested choice (`choose 1` of a `choose 2` sub-choice) to a flat `choose 2`; trimmed some prose (e.g. Martial Arts' "nunchaku/kama" flavor text, Frenzy wording); added `feature_specific.engine` (`action_cost`, `recharge`, `uses`, `modifiers`) to 187 features (99 of levels 1 to 5 and 88 of levels 6 to 20, of every class), `heal` to 9, `granted_proficiencies` to 5 and `grants_asi` to the 63 Ability Score Improvements (see [feature-mechanics.md](feature-mechanics.md)); added `by_level` (an id for each count) to the 7 features whose count grows with the level and has a single record                                                                           |
| Magic items                   | `5e-SRD-Magic-Items.json`                                                                                                                                                                                                                   | Added a structured `effect` object (ability-score modifiers, damage-type resistance, healing, trait grants, duration) and an `enchantment` object (armor/weapon bonus, extra damage, to-hit bonus) to many items, so item bonuses are available as data and not only as prose; removed a handful of unusable/non-combat items                                                                                                                                                                                                                                                                                                                                                                                                     |
| Item data                     | `5e-SRD-Equipment.json`, `5e-SRD-Magic-Items.json`, `derive-item-data.ts` (new script)                                                                                                                                                      | Added `cost_cp` (cost in copper pieces) to 197 equipment entries and 361 magic items; `bundle_size` (5 equipment entries), `reach_ft` (28 melee weapons); `rarity.rank` and `rarity.min_level` to the magic items; and `effects`, one shape that restates `effect` and `enchantment` (2 equipment entries, 68 magic items), with the old fields unchanged; and `uses` (charges or uses and their recharge) on 81 magic items, from `item-engine-annotations.json` (see [item-data.md](item-data.md))                                                                                                                                                                                                                              |
| Classes (spellcasting)        | `5e-SRD-Classes.json`, `derive-class-spellcasting.ts` (new script)                                                                                                                                                                          | Added `caster_kind` (8 classes), `prepared_formula` (4), `spellbook_size` (the wizard) and `subclass_spells` (8) to the existing `spellcasting` object (see [class-spellcasting.md](class-spellcasting.md))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Features (languages, dragons) | `5e-SRD-Features.json`, `feature-engine-annotations.json`                                                                                                                                                                                   | Added `feature_specific.granted_languages` to 15 features (Druidic, Thieves' Cant, the ten dragon ancestors, the three Favored Enemy records) and `feature_specific.damage_type` to the ten `dragon-ancestor-*` records (see [feature-mechanics.md](feature-mechanics.md))                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Backgrounds                   | `5e-SRD-Backgrounds.json`                                                                                                                                                                                                                   | Added 5 entries: `criminal`, `sage` and `soldier`, adapted from the SRD 5.2 backgrounds of the same name, and `cartographer` and `lighthouse-keeper`, written for this data; added `source` to each, and the optional `ability_scores`, `feat` and `proficiency_choices` (see [feat-data.md](feat-data.md))                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Feats                         | `5e-SRD-Feats.json`                                                                                                                                                                                                                         | Added 16 entries adapted from the SRD 5.2 feats; added `type`, `repeatable`, `minimum_level`, `feature_named`, `source`, `engine` (13 feats, plus Grappler), `grants_asi` and `granted_proficiencies`, with the words of the class feature `engine` and a few more (see [feat-data.md](feat-data.md))                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Rules and rule sections       | `5e-SRD-Rules.json`, `5e-SRD-Rule-Sections.json`, `5e-SRD-Conditions.json`, `5e-SRD-Spells.json`, `5e-SRD-Equipment.json`, `5e-SRD-Magic-Items.json`, `derive-rule-reference.ts` (new script), `rule-reference-annotations.json` (new file) | Added `order`, `summary` and `keywords` to the 6 rules and the 33 rule sections, `related` links to rule sections on 30 of the sections and 19 conditions, `related` links to rule sections on the 319 spells, 93 equipment items and 291 magic items, and documented the markdown subset of `desc`; `summary` is original wording and is translatable, the other fields are English-only (see [rule-reference.md](rule-reference.md))                                                                                                                                                                                                                                                                                            |
| Monster environment tags      | `5e-SRD-Monsters.json`, `5e-SRD-Monsters-Normalized.json`, `derive-monster-environments.ts` (new script)                                                                                                                                    | Added `environment_tags` to all 331 monsters, the `environments` text as a list of 11 habitat terms, kept in sync by an audit test (see "Monster `environment_tags` and `icon` keys")                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Icon keys                     | `5e-SRD-Spells.json`, `5e-SRD-Features.json`, `5e-SRD-Classes.json`, `derive-icons.ts` (new script), `icon-annotations.json` (new file)                                                                                                     | Added `icon`, a string key naming an icon, to the 319 spells, 407 class features and 12 classes (see "Monster `environment_tags` and `icon` keys")                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Package/tooling               | `package.json`                                                                                                                                                                                                                              | `engines.node` widened from `"22.x"` to `"22.x \|\| 24.x"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

[NOTICE.md](../NOTICE.md) and `src/provenance/source-markers.json` list every field and record that is not SRD text.

## Monster actions: `attack_type`, `bonus_actions`, `environments`

- `attack_type` (`"Melee"` / `"Ranged"`) is added to individual monster actions of `5e-SRD-Monsters.json`. It is not
  present on every action there (244 of the 533 attack actions have it); the normalized file has it on all 533 (see
  "Monster attack structure").
- `bonus_actions` is a new top-level array on each monster (e.g. `["disengage", "hide"]` for the Goblin's Nimble
  Escape), derived from the monster's special abilities and actions prose by extracting which bonus actions it can
  take.
- `environments` is a new string field (e.g. `"Forest, Grassland, Hill, Underdark"`) naming the monster's habitats.

## Monster actions: `weapon`, `weapon_kind`, `supply`

Monster actions gained three optional annotations, none of which are SRD text. `weapon` and `supply.item` link an
action to an equipment index (or, for `supply.item`, one of three non-equipment tokens: `rock`, `harpoon`,
`poisoned-dart`); `weapon_kind` is `natural`, `manufactured`, or `spell`. `supply.count` is a chosen default
ammunition/consumable count (e.g. 20 for arrows/bolts/bullets, 4 for thrown weapons, harpoons, and poisoned darts, 3
for rocks), not a book value. The schema (`MonsterActionSchema` in `schemas/5e-SRD-Monsters.ts`) carries a comment
noting that these fields and counts are not SRD text. `src/2014/tests/monster-weapons.test.ts` checks that every
`weapon`/`supply` index resolves against `5e-SRD-Equipment.json`, that ammunition weapons' `supply.item` matches that
weapon's `ammunition` field, and that the normalized copy carries the same annotations.

The normalized file completes these annotations from `monster-engine-annotations.json` (`set` on the action). Every
attack action now has a `weapon_kind` (518 had one; 15 were added): `spell` for the four "Melee Spell Attack" actions
that had none (the lamia's Intoxicating Touch, the lich's Paralyzing Touch, the specter's Life Drain, the will-o'-the-wisp's
Shock), `manufactured` for the solar's Slaying Longbow, and `natural` for the other ten (the darkmantle's Crush, the
ettercap's and giant spider's Web, the fire elemental's and magmin's Touch, the guardian naga's Spit Poison, the
roper's Tendril, the shadow's Strength Drain, the wight's and wraith's Life Drain). The Slaying Longbow also gets
`weapon: "longbow"` and `supply` of 20 arrows, as every other longbow. `weapon` is added to six `manufactured` actions
whose name contains the name of an SRD equipment item: the Chain of the chain devil (`chain-10-feet`), the Poisoned
Dart of the deep gnome (`dart`), the Shield Bash of the gladiator and the Spiked Shield of the lizardfolk (`shield`),
and the Spiked Bone Club of the grimlock and the Heavy Club of the lizardfolk (`club`). Three `manufactured` actions
have no `weapon` because no SRD equipment item is named for them: the horned devil's Fork, the iron golem's Sword
and the merrow's Harpoon. `supply.item` is an equipment index except for the three tokens named above: `rock` (the Rock of nine
monsters), `harpoon` (the merrow) and `poisoned-dart` (the deep gnome).

## Speed and senses as integers

`speed.{walk,fly,swim,climb,burrow}` and `senses.{darkvision,blindsight,truesight}` were changed from SRD's normal
`"40 ft."` string format to a plain integer (`40`), so the values need no unit parsing.

The Grimlock's conditional range is stored as `blindsight: 30` (base range), `blindsight_deafened: 10` (range while
deafened) and `blindsight_blind_beyond: true`. Multiattack `actions[].count` stays a number except for `hydra`
("Number of Heads") and `violet-fungus` ("1d4"), which are not fixed counts.

## Monster normalization

`normalize-monsters.ts` is a standalone script, run via `pnpm normalize:monsters`, that reads `5e-SRD-Monsters.json`
and writes a flattened copy where nested reference objects are collapsed to their `index` string, for example:

```jsonc
// before (5e-SRD-Monsters.json)
"dc": { "dc_type": { "index": "con", "name": "CON", "url": "..." }, "dc_value": 14 }
// after (5e-SRD-Monsters-Normalized.json)
"dc": { "dc_type": "con", "dc_value": 14 }
```

It also relocates a `dc`/`condition` that upstream sometimes attaches directly to an `action` down onto that action's
last `damage` entry, so `dc`/`condition` are always in the same place, and then merges in annotations from
`monster-engine-annotations.json`: facts that have no representation in the English source (e.g. the `condition` a
failed save against a monster's Frightful Presence applies), keyed by monster `index`, section, and
action/attack/damage-entry name.

The committed normalized file is required to be exactly what the generator produces from the current English source
plus the current annotations file: `src/2014/tests/normalized-monsters.test.ts` regenerates it and asserts a
byte-for-byte match, so `normalizeMonsters`/`serializeMonsters` (and `normalizeAction`, used by
`src/2014/tests/monster-weapons.test.ts`) are exported and imported directly rather than re-implemented in tests. The
script guards its own `writeMonstersToFile()` call behind a direct-invocation check so importing it for these tests
doesn't also regenerate the output file. Whenever either `5e-SRD-Monsters.json` or `monster-engine-annotations.json`
changes, `5e-SRD-Monsters-Normalized.json` must be regenerated with `pnpm normalize:monsters` and committed together
with that change, or the regeneration test fails. The output is also validated by its own strict schema,
`src/2014/schemas/5e-SRD-Monsters-Normalized.ts` (`schemas.test.ts`).

`verify-normalize.sh` is a small `jq`-based sanity check over the normalized file (lists actions with a `condition`, a
`dc`, no damage, or a damage `dc`) used to eyeball the output after regenerating it; it makes no changes and has no
exit-code assertions.

## Monster attack structure: `attack_type`, `attack_kind`, `reach_ft`, `range`, `area`

The normalized file states the roll, the reach, the range and the area of an attack as data, so none of it has to be
read from the action text. The fields are optional, English-only (no text to translate) and flat keys of an entry of
`actions[]`. They are derived by `normalize-monsters.ts` from the action's own `desc`, so the English file is unchanged
by them, and they are marked `dd` in `src/provenance/source-markers.json`.

| Field         | Values                               | Meaning                                                                                                                                                            |
| ------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `attack_type` | `Melee`, `Ranged`                    | The attack's type. On every attack action. An existing value is kept; where there is none it is the first word of the attack header ("Melee or Ranged" is `Melee`) |
| `attack_kind` | `melee`, `ranged`, `melee_or_ranged` | The wording of the attack header, so "Melee or Ranged" is not lost. On every attack action                                                                         |
| `reach_ft`    | number                               | Reach in feet. On every `melee` and `melee_or_ranged` attack                                                                                                       |
| `range`       | `{ normal_ft, long_ft? }`            | Range in feet. `long_ft` is absent where the text gives one range ("range 150 ft."). On every `ranged` and `melee_or_ranged` attack                                |
| `area`        | `{ shape, ... }`                     | The area an action affects. See below                                                                                                                              |

An attack action is an action whose text starts with "Melee Weapon Attack:", "Ranged Weapon Attack:",
"Melee or Ranged Weapon Attack:", "Melee Spell Attack:" or "Ranged Spell Attack:": 533 actions. Of them 472 are
`melee`, 43 are `ranged` and 18 are `melee_or_ranged`; 490 have a `reach_ft` and 61 a `range`, 58 of them with a
`long_ft`. `attack_type` was missing on 289 of them. A `melee_or_ranged` attack has both `reach_ft` and `range`,
for example a spear: `reach_ft: 5, range: { normal_ft: 20, long_ft: 60 }`.

The rule is the attack header, the text before "Hit:": `reach N ft.` gives `reach_ft` and `range N/M ft.` or
`range N ft.` gives `range`. The generator fails when a header does not state the reach or the range that its wording
(melee, ranged) requires. Spell attacks are told from weapon attacks by `weapon_kind: "spell"`.

**`area`.** One of the following, in feet. The values are those of the phrases the text uses: "a 60-foot cone", "a 90-foot
line that is 5 feet wide" (or "a line that is 30 ft. long and 5 ft. wide"), "a 15-foot-radius cloud" (or "a 10-foot radius
of gas"), "a 5-foot-radius, 30-foot-tall cylinder".

| `shape`    | Fields                   | Used by                                                                                                                                              |
| ---------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cone`     | `length_ft`              | the breath of dragons, wyrmlings, the chimera, dragon turtle, gorgon, hell hound, iron golem, mephits, winter wolf and half-red dragon veteran       |
| `line`     | `length_ft`, `width_ft`  | the breath of the blue, black, brass, bronze and copper dragons, wyrmlings included; the ankheg's Acid Spray; the behir's Lightning Breath           |
| `sphere`   | `radius_ft`              | the Ink Cloud of the octopus (5) and giant octopus (20), the vrock's Spores (15), the dretch's Fetid Cloud (10), the darkmantle's Darkness Aura (15) |
| `cylinder` | `radius_ft`, `height_ft` | the djinni's Create Whirlwind (5 by 30)                                                                                                              |

A cone or a line starts at the monster, and a sphere is centered on it. A cylinder is placed at the point the text
says. A dragon's "Breath Weapons" (the 20 brass, bronze, copper, gold and silver dragons) names two breaths in one
action, so each breath option in `options.from.options[]` has its own `area` and the action has none. 39 actions and
40 breath options have an area (79 areas). The areas of the Frightful Presence ("within 120 feet"), of the ice devil's
Wall of Ice (a wall and a dome) and of the rust monster's Antennae (an amount of metal destroyed) are not shapes in this
sense and have no `area`. Only `actions` carry these fields; the areas that special abilities and legendary actions
state ("10-foot radius" of a light, the kraken's Ink Cloud) are not structured.

`src/2014/tests/monster-attacks.test.ts` is the audit: every attack action has the structure, the `attack_kind` is the
header's wording, every reach and range in a header is in the structure and nothing else is, every area phrase of an
action is in its `area` (and every size in an `area` is in the text), and the English file has none of these fields. The
generator's rules are tested on their own, and the counts above are pinned.

## Monster riders: `damage[]` entries, staged conditions, `pull_distance_ft`, `situation`

The normalized monster file (`5e-SRD-Monsters-Normalized.json`) carries the saving throws and conditions that some
attacks and abilities state only in prose, as structured data. They are written in `monster-engine-annotations.json`
and merged in by `normalize-monsters.ts`; the English file is unchanged by them. All of these fields are optional, and
the fields written to the annotations file are marked `dd` in `src/provenance/source-markers.json`. Every
reference is the plain `index` string (the file is normalized), and every duration length is a number.

**`damage[]` entries.** `damage` on an action or special ability is a list. An entry is one of:

| Shape   | Fields                                                                                | Meaning                                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Damage  | `damage_type`, `damage_dice`, optional `dc`, optional `condition`, optional `grapple` | Damage dealt on a hit (or on a failed save, with `dc`)                                                                                  |
| Rider   | `dc` (optional), `condition`                                                          | A saving throw and the condition a failed save applies, with no damage of its own. May stand alone on an ability with no damage entries |
| Grapple | `grapple`                                                                             | `escape_dc_value` (number, the DC of the escape check), optional `additional_condition` (a condition applied until the target escapes)  |

- `dc` is `{ dc_type, dc_value, success_type }`: the ability (`str`, `dex`, `con`, `int`, `wis`, `cha`), the DC, and
  what a successful save does (`none`: no effect, `half`: half damage, `other`).
- `condition` is `{ condition_type, duration, on_failed_repeat_save? }`. `condition_type` is the `index` of an entry in
  the conditions. `duration` is `{ length, unit, ends_when?, interrupt? }`: `unit` is `round`, `hour`, `day`, `until escape`,
  `until saving throw success` (no fixed length; the target repeats the save at the end of each of its turns) or
  `until restored` (retained for compatibility), with optional `ends_when` naming the stated end condition: `disease cured`,
  `lesser restoration or similar magic`, or `greater restoration or other magic`. `interrupt`, when
  present, names what ends the condition early, for example `saving throw success` (the target repeats the save at the
  end of each of its turns). A condition that lasts for a minute is `length: 10, unit: "round"`.
- The condition of an entry applies only when the target fails the entry's `dc`. A rider carries its own `dc`; a
  damage entry with both `dc` and `condition` applies the damage per `success_type` and the condition on a failure.
- Size limits and other conditions on a rider (for example "if the target is Medium or smaller") are not encoded;
  they stay in the action's `desc`.

**Staged conditions: `condition.on_failed_repeat_save`.** An optional `{ condition_type, duration }` on a `condition`
for effects with two stages (petrification). The first stage (`condition_type`, here `restrained`) lasts until the end
of the target's next turn, when the target repeats the same save: a success ends the condition, a failure replaces it
with the condition named by `on_failed_repeat_save`. The first stage has `duration.interrupt` of
`saving throw success` and a `length` of 1 round. The second stage's duration is `{ length: 24, unit: "hour" }`, or
`{ length: 1, unit: "until restored", ends_when: "greater restoration or other magic" }` where the text says the
creature stays petrified until freed by magic. The poison conditions on the death dog and otyugh end when their
disease is cured; the erinyes poison and solar blindness end on lesser restoration or similar magic.

**`pull_distance_ft`.** An optional number on an action: the distance in feet the action pulls each target straight
toward the monster. It is the distance the action text states ("up to 25 ft."), as a maximum.

**`situation`.** An optional `{ target: { condition, max_size?, conditionExcludes? } }` on an action: the action can be
used only against targets that have the condition `target.condition` (or, with `conditionExcludes: true`, that do not
have it). `max_size` (`Small` or `Medium`) limits the size of the target. The roper's Reel and the otyugh's Tentacle
Slam apply only to grappled targets.

**Annotation entries.** `monster-engine-annotations.json` is a list of
`{ monster, section, name, attack?, damage?, append_damage?, set? }`. `monster` is a monster `index`; `section` is
`actions`, `legendary_actions`, `special_abilities` or `reactions`; `name` is the name of the action or ability, and
`attack` the name of one attack of a multiattack-style action or of one breath option of a dragon's
Breath Weapons. `append_damage` is a list of `damage[]` entries added after the existing ones. `set` is a set of fields written onto the action or ability, or onto its `damage[damage]`
entry when `damage` (a position) is given. An entry whose target does not exist makes the generator fail.

**What the annotations add.** Riders: the gladiator's Shield Bash (prone, DC 15 Strength), the deep gnome's Poisoned
Dart (poisoned, DC 12 Constitution), the cockatrice's Bite (petrification, DC 11 Constitution), the basilisk's
Petrifying Gaze (restrained and then petrified, DC 12 Constitution) and the dust mephit's Death Burst (blinded, DC 10
Constitution). Conditions on saves the
data already had: the dust mephit's Blinding Breath and Death Burst (blinded), the gibbering mouther's Blinding Spittle
(blinded), the gorgon's Petrifying Breath and the basilisk's Petrifying Gaze (petrification), the otyugh's Tentacle
Slam (stunned). Grapples: the ettercap's and giant spider's Web (escape DC 11 and 12), the otyugh's Tentacle (13) and
the roper's Tendril (15), each with a restrained condition until the target escapes. `pull_distance_ft` (25) on the
roper's Reel, and `situation` (grappled target) on the Reel and the Tentacle Slam.

**Conditions the text applies with a save.** Every other condition that an action, ability or legendary action applies
with a saving throw and names with its DC now has a `condition`, found by checking each sentence of the monsters'
text that has a saving throw and a condition:

- Knocked prone on a failed Strength save, as a rider after the damage: the dire wolf's, mastiff's, winter wolf's, wolf's
  and worg's Bite, the dragon turtle's, giant crocodile's and tarrasque's Tail, the stone giant's Rock and the gibbering
  mouther's Bites. The wereboar's Charge has the same rider, as the boar's Charge does, and the Wing Attack of the 20
  adult and ancient dragons carries `prone` (the DC was already there). The androsphinx's Third Roar is prone as well.
- Poisoned on a failed Constitution save, as a rider after the damage: the bearded devil's Beard and the bone devil's
  Sting (10 rounds, ended by a save), the couatl's Bite (24 hours), the erinyes's Longbow and the death dog's and
  otyugh's Bite (until restored), the sprite's Shortbow (10 rounds). The pit fiend's Bite and the vrock's Spores take
  `until saving throw success` on the poison damage entry they already carry. The chuul's Tentacles (10 rounds, ended
  by a save), the Stench of the ghast and the hezrou (1 round), and the sea hag's Horrific Appearance (frightened,
  10 rounds, ended by a save) complete a save the data already had or gave the ability its DC.
- Paralyzed: the ghast's Claws and the lich's Paralyzing Touch (10 rounds, ended by a save), and the Paralyzing Breath of
  the young, adult and ancient silver dragons. Unconscious: the Sleep Breath of the young, adult and ancient brass
  dragons (5 or 10 minutes, as 50 or 100 rounds, ended by taking damage). The breath conditions are on the breath option.
- Blinded, stunned: the solar's Blinding Gaze (until restored), the mummy lord's Blinding Dust and Blasphemous Word, the
  vrock's Stunning Screech (1 round).
- The medusa's Petrifying Gaze has the two-stage petrification of the basilisk's.
- Grapples, as `grapple` entries with the escape DC and, where the text says the target is restrained, the restrained
  condition: the behir's Constrict, the chain devil's Chain, the couatl's Constrict, the giant crocodile's Bite, the
  kraken's Tentacle, the marilith's Tail, the remorhaz's Bite, the roc's Talons, the rug of smothering's Smother, the
  salamander's Tail, the tarrasque's Bite and the tyrannosaurus's Bite; and the escape DC alone for the chuul's Pincer,
  the glabrezu's Pincer, the octopus's Tentacles and the mimic's Adhesive.

The text names more conditions than the data encodes: a second condition on the same save (for example the paralysis that
goes with the chuul's poison), conditions that apply only when a save fails by a margin or when the poison damage takes
the target to 0 hit points, and conditions with no duration or with a choice of ability stay in the action's `desc`.
`src/2014/tests/monster-riders.test.ts` lists each of them with its reason and fails when a new condition appears in
the text with a saving throw and has neither a structured `condition` nor an entry in that list.

## Monster damage corrections

- The rhinoceros's Charge rolled `2d9` extra bludgeoning damage; its text and its average (9) say `2d8`. It now reads
  `2d8` in both monster files.
- The otyugh's Tentacle Slam had a saving throw but no damage entry. It now has `2d6+3` bludgeoning damage (the text
  says 10 (2d6 + 3)), with the save and the stun on the same entry in the normalized file.
- Damage the text states and the structured data lacked now has a `damage` entry. The saving throw is on the entry
  where the text gives one (`half` where the text says half damage on a success). An entry that the text says is dealt
  at the start of each of the target's turns (the entries marked "each turn" below) is stated as written; the turn
  structure stays in the `desc`.

  | Monster               | Action            | Entries added                                         |
  | --------------------- | ----------------- | ----------------------------------------------------- |
  | giant centipede       | Bite              | 3d6 poison, DC 11 Con                                 |
  | guardian naga         | Bite, Spit Poison | 10d8 poison, DC 15 Con, half                          |
  | spirit naga           | Bite              | 7d8 poison, DC 13 Con, half                           |
  | pit fiend             | Bite              | 6d6 poison, DC 21 Con, each turn                      |
  | pit fiend             | Mace              | 6d6 fire                                              |
  | wyvern                | Stinger           | 7d6 poison, DC 15 Con, half                           |
  | purple worm           | Tail Stinger      | 12d6 poison, DC 19 Con, half                          |
  | purple worm, kraken   | Bite              | 6d6 and 12d6 acid, each turn while swallowed          |
  | remorhaz, tarrasque   | Swallow           | 6d6 and 16d6 acid, each turn                          |
  | rug of smothering     | Smother           | 2d6+3 bludgeoning, each turn                          |
  | shambling mound       | Engulf            | 2d8+4 bludgeoning, DC 14 Con, each turn               |
  | vrock                 | Spores            | 1d10 poison, each turn                                |
  | chain devil           | Chain             | 2d6 piercing, each turn                               |
  | fire elemental        | Touch             | 1d10 fire, each turn                                  |
  | magmin                | Touch             | 1d6 fire, each turn                                   |
  | bulette               | Deadly Leap       | 3d6+4 bludgeoning and 3d6+4 slashing                  |
  | ice devil             | Wall of Ice       | 10d6 cold, DC 17 Dex, half; 5d6 cold, DC 17 Con, half |
  | wereboar (both forms) | Charge            | 2d6 slashing                                          |

  The save of the bulette's Deadly Leap is a choice of Strength or Dexterity and is not encoded.

- `src/2014/tests/monster-riders.test.ts` checks that every dice-and-type damage entry of an action, ability, attack or
  option appears in that entry's own text, and pins the damage of the crocodile's, duergar's, eagle's, ettercap's,
  flying snake's, gibbering mouther's, hunter shark's, noble's, plesiosaurus's and scorpion's attacks.

## Monster effects: `trigger`, `regeneration`, `reduce_max_hp`, `damage_dice_at_half_hp`, damage rules

The normalized monsters state the mechanics below as optional fields, read by `derive-monster-effects.ts` from the
trait or action text; the English file is unchanged. [monster-effects.md](monster-effects.md) gives every field, its
values and units, the abilities left out and why.

- `regeneration` on the 7 traits that regain hit points at the start of a turn (oni, shield guardian, troll, the four
  vampires), with the minimum hit points, the damage that stops it, and where it does not work.
- `damage_dice_at_half_hp` on the Bites or Beaks of the 10 swarms, the dice used when the swarm has half of its hit points
  or fewer.
- `detach_after_damage` on the stirge's Blood Drain (10 hit points).
- `reduce_max_hp` on 8 actions that reduce the hit point maximum by the damage taken (clay golem, specter,
  succubus/incubus, three vampires, wight, wraith) and `reduction_dice` on 6 that reduce it by dice, every 24 hours or once
  (death dog, giant diseased rat, mummy, mummy lord, night hag, otyugh).
- `trigger` on each of those 33 entries says when the effect applies. The nightmare's Confer Fire Resistance has
  `resistances` of fire and the trigger `while_ridden`.
- `vulnerabilities`, `resistances` and `immunities` on a monster restate its `damage_vulnerabilities`,
  `damage_resistances` and `damage_immunities` as rules `{ types, unless?, only_from? }`: for example "bludgeoning,
  piercing, and slashing from nonmagical weapons that aren't silvered" is types `bludgeoning`, `piercing` and
  `slashing` with `unless` of `magical` and `silvered`. 14, 70 and 136 monsters have them (14, 102 and 146 rules). Two
  entries (the archmage's stoneskin resistance and the rakshasa's vulnerability to magic weapons of good wielders) are
  left in the string lists only.

`src/2014/tests/monster-effects.test.ts` checks every value against the English text and fails when a trait or action
mentions one of these mechanics, or a way hit points change, and has neither a field nor an entry in its list of 53
excluded abilities.

## New conditions

The fork adds 17 condition entries beyond the SRD's baseline 14 (plus the single combined `Exhaustion` description):

- `exhaustion-1` … `exhaustion-6`: the exhaustion table split into one condition per level, each carrying only that
  level's cumulative effects.
- `enraged`, `frenzied`, `reckless`: barbarian Rage / Frenzy / Reckless Attack, promoted from class features to
  conditions.
- `dodging`: the Dodge action's effect, as a condition.
- `infested`, `swallowed`: monster-specific damage-over-time conditions (parasite attachment / being swallowed by a
  larger creature), used by specific monster abilities (e.g. Stirge's Blood Drain, Giant Frog's Swallow).
- `drained-of-strength`, `weakened`, `drained-of-life`, `slowed`: generic ability-damage and debuff conditions used by
  monster and magic-item effects (e.g. strength drain, life drain).
- `disengaged`, `surprised`: promoted from prose-only combat rules (the Disengage action's no-opportunity-attack
  effect; the surprise round rule) to conditions.

## Equipment: `material`, `stackable`, `is_consumable`, `effect`, and removed items

- `material` (e.g. `"metal"`) is added to select equipment (mostly metal weapons and ammunition).
- `stackable: true` is added to ammunition and consumables (arrows, darts, javelins, sling bullets, rations, pitons,
  etc.).
- `is_consumable` and `effect` (e.g. a damage-on-use effect for Acid Vial, Alchemist's Fire) are added to a couple of
  consumable items.
- 40 non-combat equipment entries were removed: all mounts (camel, donkey, elephant, horses, mule, mastiff, pony), all
  barding, all saddle/bit-and-bridle/saddlebags/stabling/feed items, and all vehicles (carts, wagons, ships, sleds,
  chariots).
- The corresponding equipment categories (`land-vehicles`, `waterborne-vehicles`, `mounts-and-vehicles`,
  `mounts-and-other-animals`, `tack-harness-and-drawn-vehicles`, `gaming-sets`) and the proficiencies that referenced
  them (`nets`, `land-vehicles`, `water-vehicles`, and similar) were removed for the same reason.

## Features: Expertise flattened, minor prose trims

Bard's and Rogue's Expertise `feature_specific.expertise_options` was restructured from `choose 1` of a nested
`choose 2` skill-choice block to a single flat `choose 2`. A single flat choice is simpler than a choice-of-a-choice
that always resolves to the same two skills either way. A few description strings had minor trims (e.g. the
"nunchaku/kama" flavor sentence dropped from Martial Arts, a small wording tweak to Frenzy) with no mechanical effect.

## Features: structured mechanics

`feature_specific` gained four optional, English-only fields that restate the feature text as data: `engine` (what
using the feature costs, how it recharges, how many uses it has and what it changes) on 187 features (99 of class
levels 1 to 5 and 88 of levels 6 to 20 of every class), `heal` on 9 healing features, `granted_proficiencies` on 5 and `grants_asi` on every Ability Score
Improvement. Numbers that grow with the level are read from the `class_specific` keys of the class rows in
`5e-SRD-Levels.json`. The modifiers reuse the words of the condition `effects` (now defined once in
`src/schemas/effects.ts`) and link to conditions such as `enraged` and `sacred-weapon`.
[feature-mechanics.md](feature-mechanics.md) describes every field, its allowed values and units, and the features
left without a structure and why.

### Features: an id for each count

Seven features have one record while their count or size grows with the level: Rage (rages and damage bonus), Ki,
Font of Magic (sorcery points), Sneak Attack, Martial Arts, Unarmored Movement and Arcane Recovery. Their `engine` gained
`by_level`, a list of `{ id, level, count }` (or `{ id, level, dice }`) steps next to the `class_specific` key that holds
the number, read from the class rows of `5e-SRD-Levels.json` (76 ids, for example `rage-3-uses`, `ki-12-points`,
`sneak-attack-5d6`). The features that have a record for each count (Action Surge, Indomitable, Extra Attack, Channel
Divinity of the cleric, Favored Enemy and the like) keep those records and their ids. See "Counts" in
[feature-mechanics.md](feature-mechanics.md).

## Feats and backgrounds: more entries, `type`, `source`, `engine`

The one SRD 5.1 feat and the one SRD 5.1 background are joined by 16 feats and 3 backgrounds adapted from the SRD 5.2
set (which is unchanged in `src/2024`) and 2 backgrounds written for this data. Each added entry has a `source`
(`srd-5.2` or `dd`) and a record marker. Feats gained `type`, `repeatable`, `minimum_level` and `feature_named` in the
shape of the SRD 5.2 feats, and the `engine`, `grants_asi` and `granted_proficiencies` of class features; backgrounds
gained `ability_scores`, `feat` and `proficiency_choices`. The shared `engine` schema moved from
`src/2014/schemas/5e-SRD-Features.ts` to `src/schemas/feature-engine.ts` without a change to the class features, and the
modifier vocabulary gained `roll_damage_twice`, `minimum_damage_die`, `hit_instead_of_miss`, `teleport`,
`ignore_resistance` and `sense`, the `bonus` target `initiative`, the circumstance `target_grappled_by_owner`,
`choose` on `ability_score_increase`, and `skills_or_tools` in `granted_proficiencies`. All of it is optional and
English-only except the text. [feat-data.md](feat-data.md) lists what is and is not structured.

## Rules and rule sections: `order`, `summary`, `keywords`, `related`

The 6 rules and the 33 rule sections (about 190,000 characters of markdown) gained `order` (reading order), `summary`
(one or two sentences in original wording, not SRD text) and `keywords` (read from the headings and bold terms); the
sections and 19 conditions gained `related`, a list of `{ collection, index }` links to rule sections, so one can open
the rules that bear on a condition, a spell, an item or another section (the 319 spells, 93 of the 197 equipment items and 291 of the 362 magic items have links, derived from the spell and item properties and from the text). `summary` is translatable and the overlays do not have it
yet; `order`, `keywords` and `related` are English-only. Each field is marked `dd` in the source markers. The
markdown that `desc` is written in is documented and tested. Nothing existing changed: `index`, `name`, `desc` and
the overlays are as before. [rule-reference.md](rule-reference.md) describes the fields, how they are derived and the
limits of the links.

## Classes: choice ids

The proficiency choices, starting-equipment choices and `multi_classing.proficiency_choices` of the 12 classes, and the
choices nested in their `options`, gained an optional `id` (78 in all, for example `fighter-equipment-2`,
`bard-proficiency-skills`, `bard-multiclass-proficiency-instruments`, `fighter-equipment-2-option-1-item-1`). `ChoiceSchema`
in `src/schemas/common.ts` has the optional `id`; it is a structural field, so translation overlays do not carry it.
The ids are listed in `ids/class-choices.json` and, with the count ids in `ids/feature-counts.json`, are covered by the
id stability contract in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Magic items: `effect` and `enchantment`

Many magic items gained a structured `effect` object (`ability_score_modifier` with ability, amount and optional max;
`damage_type_resistance`; `duration`; `trait_modifier`, which grants a named trait; and similar), plus a separate
`enchantment` object for `+N` weapon/armor items (`armor_class_bonus`, `extra_damage`, `to_hit_bonus`, a
`label_prefix`/`type` for display). `requires_attunement` is a plain boolean alongside the existing prose. A handful of
items with no combat use were removed.

### Unified `effects`

Equipment and magic items also have `effects`, one array of effects that restates `effect` and `enchantment` in a
single shape (`activation`, `armor_class`, `ability`, `resistances`, `attack`, `damage` and the like), plus the derived
`cost_cp`, `bundle_size`, `reach_ft`, `rarity.rank` and `rarity.min_level`. The older fields are unchanged; see
[item-data.md](item-data.md) for the shape and the mapping.

## Filled values: monster `environments`, magic-item `cost` and `weight`

The `environments` of every monster and the `cost` and `weight` of every magic item are filled in. The values that were
already present are unchanged, with one exception (`animated-armor`, below). The values added are invented, not taken
from the SRD or any other source, and follow the fixed rules below so they can be regenerated or extended
consistently. All three fields are marked as game-authored in `src/provenance/source-markers.json`.

**Monster `environments`.** A comma-separated list (alphabetical for the values added) drawn from the 11 terms already in use: Arctic,
Coastal, Desert, Forest, Grassland, Hill, Mountain, Swamp, Underdark, Underwater, Urban. 118 monsters had no value
(88 without the field and 30 with an empty string); each now has one, chosen from its type and from the values of
similar monsters (for example the metallic and chromatic dragons by colour, fiends and aberrations in the Underdark,
constructs and humanoid casters in Urban, golems and animated objects where they are built). `animated-armor` repeated
`air-elemental`'s value (`Desert, Mountain`) and now reads `Underdark, Urban`. No monster is exempt.

**Magic-item `cost`.** `{ quantity, unit: "gp" }`. An existing `cost` is kept; a missing one comes from the table below
by rarity, with the existing priced items as anchors. Consumables are the potions, scrolls, oils, single-use dusts, the
restorative ointment, feather tokens, elemental gems, marvelous pigments and anything flagged `is_consumable`.

| Group                                        | Common | Uncommon | Rare | Very rare | Legendary |
| -------------------------------------------- | ------ | -------- | ---- | --------- | --------- |
| Permanent (wondrous, ring, rod, staff, wand) | n/a    | 2500     | 6000 | 25000     | 75000     |
| Weapon                                       | n/a    | 1000     | 4000 | 16000     | 24000     |
| Armor and shield                             | n/a    | 500      | 1500 | 6000      | 24000     |
| Ammunition (one piece)                       | n/a    | 25       | 100  | 400       | n/a       |
| Consumable                                   | 50     | 250      | 750  | 2500      | 25000     |

A base entry that has variants (for example `potion-of-healing`, `armor`, `ioun-stone`) takes the lowest `cost` among
its variants. `orb-of-dragonkind`, an artifact, has no `cost`; it is the only magic item without one.

**Magic-item `weight`.** Pounds, as a number. A weight that the item's own text states is used as written. Otherwise:
armor and shields use the weight of the SRD base armor in `5e-SRD-Equipment.json` (plate for plate armor, scale mail for
dragon scale mail, chain mail for "any armor" entries, shield for shields); weapons use the SRD base weapon (a longsword
for "any sword" and "any weapon" entries, the named weapon otherwise); ammunition is one twentieth of the SRD arrow
bundle; potions 0.5 and oils the SRD oil flask; scrolls and rings the SRD parchment and signet ring (0); wands, rods and
staffs the SRD arcane focus of the same name; books, tomes and manuals the SRD book; robes the SRD robes. Remaining
wondrous items weigh 0 (gems, stones, tokens, dust), 1 (amulets and most worn or carried items), 2 (boots, cloaks,
mantles), or 3 (helms), with a few larger objects set from the nearest SRD gear item.

`src/2014/tests/game-data-coverage.test.ts` checks that every monster has a non-empty `environments` value made of
those terms and every magic item has a `cost` and a `weight`, apart from the exception listed there.

## Monster `environment_tags` and `icon` keys

The monsters gained `environment_tags`, the `environments` text as a list of the 11 habitat terms (all 331 monsters; the
text is unchanged and the normalized monsters carry the list too). The spells, class features and classes gained `icon`,
a string key naming an icon for the record (319 spells, 407 features, 12 classes, none of them a default). Both fields
are optional, never translated and marked `dd` in the source markers; no id changed. [monster-environments.md](monster-environments.md)
and [icon-keys.md](icon-keys.md) describe the fields, how they are derived and how they are audited.

## `package.json`: Node 24

`engines.node` was widened from `"22.x"` to `"22.x || 24.x"` so the package can be installed under Node 24, with no
other change.

## Data-quality notes

- **`url` field format drift.** Across `5e-SRD-Monsters.json` (and likely other touched collections), `url` values were
  rewritten from the `"/api/2014/monsters/<index>"` shape used by current upstream `main` to a shorter
  `"/api/monsters/<index>"` shape (no `/2014/` segment). It is a divergence from upstream's current URL scheme in every
  record the fork has touched, and does not break anything mechanically.

## Follow-up ideas

- Reconciling the `/api/2014/...` vs `/api/...` URL drift noted above.
- Structuring the areas and ranges of special abilities and legendary actions (the lights' radii, the kraken's Ink
  Cloud, the solar's Searing Burst), and the placement range of the djinni's Create Whirlwind.

## Conditions: structured effects

Every condition has an `effects` object that states, as data, the mechanical effects its `desc` states. It is
additive: `index`, `name`, `desc` and `url` of the existing 33 conditions are unchanged. `effects` is English-only and
is never translated, so the translation overlays do not carry it; the translatable text stays in `name` and `desc`.
The fields are in the schema (`src/2014/schemas/5e-SRD-Conditions.ts`), which comments each of them, and are marked
`dd` in `src/provenance/source-markers.json`.

`effects` says what the condition does while it lasts. How long it lasts, and the saving throw that ends or applies
it, are not part of it; the text of a row (`desc`) keeps them. The effects of a row are those its own text states. Where
the text says the creature is in another condition ("is incapacitated (see the condition)"), `effects.includes` names it,
and the effects of the included condition, and its `removes`, apply as well.

### Fields of a condition

| Field               | Value                              | Meaning                                                                                                                                                                                                                                                                                                         |
| ------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `effects`           | object, always present             | See below                                                                                                                                                                                                                                                                                                       |
| `removes`           | condition indexes                  | Conditions that end when this one is applied: `incapacitated` ends `concentrating` (the concentration rules), `unconscious` ends `enraged` and `sacred-weapon` (their text says they end on falling unconscious)                                                                                                |
| `adds`              | condition indexes                  | Conditions applied along with this one: `unconscious` adds `prone` ("falls prone")                                                                                                                                                                                                                              |
| `on_remove`         | `{ removes?, exhaustion_levels? }` | What happens when the condition ends: `enraged` ends `frenzied` ("for the duration of your rage") and `frenzied` gives one level of exhaustion ("when your rage ends, you suffer one level of exhaustion"). `exhaustion_levels` is a number of levels                                                           |
| `immune_if_feature` | `[{ feature, while_condition? }]`  | A feature (an index of `5e-SRD-Features.json`) whose text makes its owner immune to the condition. With `while_condition`, only while the owner also has that condition: `charmed` and `frightened` have `mindless-rage` while `enraged`, `poisoned` has `purity-of-body` and `natures-ward`                    |
| `exhaustion_level`  | `{ level, next?, prev? }`          | On `exhaustion-1` to `exhaustion-6`: the level, and the indexes of the next and previous level. `exhaustion-1` has no `prev` (below level 1 every exhaustion effect ends) and `exhaustion-6` has no `next`. Each level row states the effects of its level and of all lower levels, as the text of the SRD does |

### The `effects` object

All fields are optional. A condition with none of them has `reason`, a note for maintainers on why the text gives no
effect that fits (7 of the 47 conditions: `exhaustion`, `frenzied`, `infested`, `concentrating`, `sanctuary`,
`spiritual-weapon`, `commanded`); `reason` is never present next to another field and is not display text.

| Field                          | Shape                                                                                     | Meaning                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `includes`                     | condition indexes                                                                         | Also has the effects of these conditions                                                   |
| `rolls`                        | `[{ roll, mode, abilities?, attack_kind?, requires_sense?, while? }]`                     | A change to the creature's own rolls                                                       |
| `rolls_against`                | `[{ roll, mode?, critical_hit?, within_ft?, beyond_ft?, by?, purpose?, while? }]`         | A change to the rolls that others make against the creature                                |
| `bonuses`                      | `[{ to, dice \| flat \| ability_modifier, attack_kind?, damage_type?, minimum?, uses? }]` | A bonus added to a roll or to armor class                                                  |
| `armor_class`                  | `{ base: { value, ability_modifier }, while? }`                                           | The armor class becomes `value` plus the ability modifier                                  |
| `speed`                        | `{ op: "set", value, ignores_bonuses? }`, `{ op: "halve" }` or `{ op: "crawl_only" }`     | A change to the creature's speed                                                           |
| `cannot`                       | list                                                                                      | What the creature cannot do                                                                |
| `limits`                       | `{ attacks_per_turn?, one_of_action_or_bonus_action? }`                                   | A cap on what the creature can do in a turn                                                |
| `damage`                       | `[{ relation, types, while? }]`                                                           | Resistance, immunity or vulnerability to damage                                            |
| `immune_to`                    | list                                                                                      | Conditions (indexes) and `disease` that the creature is immune to                          |
| `hit_point_maximum`            | `{ op }`                                                                                  | `halve` the hit point maximum, or `reduce` it by an amount that the applying effect states |
| `ability_scores`               | `[{ ability, op: "reduce" }]`                                                             | An ability score reduced by an amount that the applying effect states                      |
| `healing`                      | `"maximum"`                                                                               | Any healing restores the most hit points possible                                          |
| `drops_held_items`             | `true`                                                                                    | The creature drops what it holds                                                           |
| `provokes_opportunity_attacks` | boolean                                                                                   | `false`: its movement does not provoke opportunity attacks                                 |
| `death`                        | `true`                                                                                    | The creature dies                                                                          |

**`rolls`.** `roll` is `attack`, `ability_check`, `saving_throw` or `death_saving_throw`. `mode` is `advantage`,
`disadvantage` or `auto_fail`. `abilities` lists ability score indexes (`str`, `dex`, `con`, `int`, `wis`, `cha`);
without it every ability is covered, and for an attack roll it is the ability the attack uses. `attack_kind` limits
an attack roll to `melee_weapon` (a melee weapon attack), `weapon` (any weapon attack) or `bound_weapon` (the one
weapon that the condition is tied to). `requires_sense` (`sight` or `hearing`) limits an ability check to those that
need the sense.

**`rolls_against`.** `roll` is `attack` or `ability_check`. An entry has either `mode` (`advantage` or `disadvantage`)
or `critical_hit: true` (a hit is a critical hit). `within_ft` limits it to an attacker at most that many feet away
and `beyond_ft` to an attacker farther than that, in feet: a prone creature has `{ advantage, within_ft: 5 }` and
`{ disadvantage, beyond_ft: 5 }`. `by: "source"` limits it to the creature that applied the condition, and
`purpose: "social_interaction"` to ability checks to interact socially (charmed).

**`while`.** A list of circumstances, all of which must hold for the entry to apply: `source_in_line_of_sight` (the
source of the condition is in the creature's line of sight), `can_see_attacker`, `not_incapacitated`, `speed_above_0`,
`not_wearing_armor`, `not_wearing_heavy_armor`.

**`bonuses`.** `to` is `attack_roll`, `damage_roll`, `saving_throw` or `armor_class`. The bonus is `dice` (`"1d4"`),
`flat` (a number) or `ability_modifier` (an ability index, whose modifier is added). `minimum` is the least the bonus
can be. `damage_type` is a damage type index, for extra damage of that type. `uses` ends the bonus after that many
uses. Values are those of the lowest level; a condition that grows with the level of the source (magic weapon) keeps
its base value.

**`cannot`.** `take_actions`, `take_reactions`, `move`, `speak`, `see`, `hear`, `perceive_surroundings` (unaware of
its surroundings), `cast_spells`, `concentrate`, `harm_source` (attack the source of the condition or target it with
harmful abilities or effects), `move_closer_to_source` (willingly).

**`speed`.** `set` makes the speed `value` feet (`ignores_bonuses` when the text says it cannot benefit from a speed
bonus), `halve` halves it, `crawl_only` leaves crawling as the only movement. Where a row has the speed set to 0
(`exhaustion-5`, `exhaustion-6`), the earlier halving of the lower level is replaced by it.

**`damage`.** `relation` is `resistance`, `immunity` or `vulnerability`; `types` is a list of damage type indexes, or
`["all"]`.

### Counts

47 conditions: 33 before and 14 new. 40 have structured effects and 7 have a `reason`. Among the fields of `effects`:
`rolls` 22, `cannot` 13, `rolls_against` 11, `speed` 10, `bonuses` 6, `includes` 5, `hit_point_maximum` 4, `damage` 2,
and one each of `armor_class`, `immune_to`, `drops_held_items`, `death`, `ability_scores`, `limits`, `healing` and
`provokes_opportunity_attacks`. `removes` is on 2 conditions, `adds` on 1, `on_remove` on 2, `immune_if_feature` on 3
and `exhaustion_level` on 6. The `poisoned` condition names two features there, Purity of Body and Nature's Ward.

### New condition rows

The 14 rows below are not SRD condition entries. They state, in wording written for the game, states that the SRD
text implies. Each is marked `dd` in `src/provenance/source-markers.json`.

| Index                                                                                                                                                                            | Source of the state                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `no-reactions`                                                                                                                                                                   | Effects that stop a creature from taking reactions                |
| `concentrating`                                                                                                                                                                  | The SRD concentration rules                                       |
| `blessed`, `shield-of-faith`, `sanctuary`, `beacon-of-hope`, `spiritual-weapon`, `spirit-guardians`, `magic-weapon`, `divine-favor`, `branding-smite`, `mage-armor`, `commanded` | The spells of the same name                                       |
| `sacred-weapon`                                                                                                                                                                  | The Sacred Weapon Channel Divinity option of the Oath of Devotion |

The translation overlays do not cover these rows, so the coverage report shows them as untranslated.

### What is not structured

The audit in `src/2014/tests/condition-effects.test.ts` lists, per condition, the mechanical phrases that `effects`
leaves out, and fails if a text states a mechanical phrase that is neither structured nor listed. They are:

- Durations, repeat saving throws and the ways a condition ends: grappled ending when the grappler is incapacitated
  or the creature leaves its reach; rage ending early, its minute of duration and its uses; the duration and repeat
  save of weakened and slowed; what a rest restores for drained-of-strength and drained-of-life; the turns that
  surprised, reckless, dodging and disengaged cover.
- Visibility: invisible being impossible to see without magic or a special sense, being heavily obscured for hiding, and
  being found by noise or tracks; the total cover of swallowed.
- Changes of the creature itself: petrified weight and aging, and its poison and disease being suspended; stunned
  speaking only falteringly.
- Grants of actions and damage: the rage bonus to melee damage (+2, growing with level), the bonus-action attack of
  frenzied, the blood loss of infested, the acid damage of swallowed, the damage of spirit-guardians, and the
  effects of branding-smite on the target's visibility.
- Spell mechanics that are a saving throw of someone else or a choice made when the spell is cast: sanctuary,
  commanded, spiritual-weapon.
- The immunities that auras give to allies (the paladin's Aura of Courage and Aura of Devotion), which
  `immune_if_feature` does not model because they protect creatures within a range of the feature's owner. The
  features state them with `immune_to` and an `aura` (see [feature-mechanics.md](feature-mechanics.md)).
- The immunity of the druid's Nature's Ward to being charmed or frightened by elementals and fey, which
  `immune_if_feature` does not model because it names no source; the feature states it with `immune_to` and
  `creature_types`. Its immunity to poison is named by `poisoned`.
