# Changes relative to upstream

This document lists what this fork (`markpol/5e-database`) changes in the data relative to upstream
(`5e-bits/5e-database`). The changes are written in terms of the data: which fields and records were added, changed
or removed. They are scoped to the `src/2014` (2014 SRD) data set; nothing in `src/2024` is touched.

The data is used by the Draconian Dungeons game. Some fields restate a rule that the SRD gives only as prose, in
structured form, so the rule does not have to be parsed out of English text. Content with no use in the game was
removed.

## At a glance

| Area | File(s) | What changed |
| --- | --- | --- |
| Monster actions | `5e-SRD-Monsters.json` | Added `attack_type` ("Melee"/"Ranged") to actions; added `bonus_actions` (parsed list of bonus-action ids); added `environments` (habitat string); `speed.*` and `senses.{darkvision,blindsight,truesight}` changed from strings (`"40 ft."`) to plain integers (`40`); added `weapon`, `weapon_kind`, and `supply` (equipment-linked weapon/ammunition annotations) |
| Monster normalization | `5e-SRD-Monsters-Normalized.json` (new file), `normalize-monsters.ts` (new script), `monster-engine-annotations.json` (new file), `verify-normalize.sh` (new script) | Adds a pre-flattened copy of the monster data that collapses nested reference objects (`dc_type`, `damage_type`, `condition_type`, spellcasting `ability`, etc.) down to their plain string `index`, normalizes where `dc`/`condition` sit on an action, and merges in extra annotations (e.g. conditions applied on a failed save, riders, grapples, a pull distance) from `monster-engine-annotations.json`; `src/2014/tests/normalized-monsters.test.ts` regenerates from the English source and asserts it matches the committed normalized file byte-for-byte |
| Conditions | `5e-SRD-Conditions.json` | Added 17 new condition entries: 6 numbered exhaustion levels (`exhaustion-1`…`exhaustion-6`) plus `enraged`, `frenzied`, `reckless`, `dodging`, `infested`, `swallowed`, `drained-of-strength`, `weakened`, `slowed`, `drained-of-life`, `disengaged`, `surprised` |
| Equipment | `5e-SRD-Equipment.json` | Added `material`, `stackable`, `is_consumable`, `effect` (damage-on-use) to select items; removed 40 non-combat items (mounts, vehicles, barding, tack/harness, stabling/feed) |
| Equipment categories | `5e-SRD-Equipment-Categories.json` | Removed 6 non-combat categories (`gaming-sets`, `land-vehicles`, `mounts-and-other-animals`, `mounts-and-vehicles`, `tack-harness-and-drawn-vehicles`, `waterborne-vehicles`) and their members |
| Proficiencies | `5e-SRD-Proficiencies.json` | Removed proficiency entries tied to the removed equipment (e.g. `nets`, `land-vehicles`, `water-vehicles`) |
| Features | `5e-SRD-Features.json` | Bard/Rogue Expertise reworked from a two-level nested choice (`choose 1` of a `choose 2` sub-choice) to a flat `choose 2`; trimmed some prose (e.g. Martial Arts' "nunchaku/kama" flavor text, Frenzy wording) |
| Magic items | `5e-SRD-Magic-Items.json` | Added a structured `effect` object (ability-score modifiers, damage-type resistance, healing, trait grants, duration) and an `enchantment` object (armor/weapon bonus, extra damage, to-hit bonus) to many items, so item bonuses are available as data and not only as prose; removed a handful of unusable/non-combat items |
| Package/tooling | `package.json` | `engines.node` widened from `"22.x"` to `"22.x \|\| 24.x"` |

[NOTICE.md](../NOTICE.md) and `src/provenance/source-markers.json` list every field and record that is not SRD text.

## Monster actions: `attack_type`, `bonus_actions`, `environments`

- `attack_type` (`"Melee"` / `"Ranged"`) is added to individual monster actions. It is not present on every action (a
  small number of named attacks omit it), so coverage is best-effort and not guaranteed.
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

## Monster riders: `damage[]` entries, staged conditions, `pull_distance_ft`, `situation`

The normalized monster file (`5e-SRD-Monsters-Normalized.json`) carries the saving throws and conditions that some
attacks and abilities state only in prose, as structured data. They are written in `monster-engine-annotations.json`
and merged in by `normalize-monsters.ts`; the English file is unchanged by them. All of these fields are optional, and
the fields written to the annotations file are marked `dd` in `src/provenance/source-markers.json`. Every
reference is the plain `index` string (the file is normalized), and every duration length is a number.

**`damage[]` entries.** `damage` on an action is a list. An entry is one of:

| Shape | Fields | Meaning |
| --- | --- | --- |
| Damage | `damage_type`, `damage_dice`, optional `dc`, optional `condition`, optional `grapple` | Damage dealt on a hit (or on a failed save, with `dc`) |
| Rider | `dc` (optional), `condition` | A saving throw and the condition a failed save applies, with no damage of its own. Follows the damage entry of the same attack |
| Grapple | `grapple` | `escape_dc_value` (number, the DC of the escape check), optional `additional_condition` (a condition applied until the target escapes) |

- `dc` is `{ dc_type, dc_value, success_type }`: the ability (`str`, `dex`, `con`, `int`, `wis`, `cha`), the DC, and
  what a successful save does (`none`: no effect, `half`: half damage, `other`).
- `condition` is `{ condition_type, duration, on_failed_repeat_save? }`. `condition_type` is the `index` of an entry in
  the conditions. `duration` is `{ length, unit, interrupt? }`: `unit` is `round`, `hour`, `day`, `until escape`,
  `until saving throw success` (no fixed length; the target repeats the save at the end of each of its turns) or
  `until restored` (the condition lasts until it is ended by magic such as greater restoration), and `interrupt`, when
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
`{ length: 1, unit: "until restored" }` where the text says the creature stays petrified until freed by magic.

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
Dart (poisoned, DC 12 Constitution), the cockatrice's Bite (petrification, DC 11 Constitution). Conditions on saves the
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

  | Monster | Action | Entries added |
  | --- | --- | --- |
  | giant centipede | Bite | 3d6 poison, DC 11 Con |
  | guardian naga | Bite, Spit Poison | 10d8 poison, DC 15 Con, half |
  | spirit naga | Bite | 7d8 poison, DC 13 Con, half |
  | pit fiend | Bite | 6d6 poison, DC 21 Con, each turn |
  | pit fiend | Mace | 6d6 fire |
  | wyvern | Stinger | 7d6 poison, DC 15 Con, half |
  | purple worm | Tail Stinger | 12d6 poison, DC 19 Con, half |
  | purple worm, kraken | Bite | 6d6 and 12d6 acid, each turn while swallowed |
  | remorhaz, tarrasque | Swallow | 6d6 and 16d6 acid, each turn |
  | rug of smothering | Smother | 2d6+3 bludgeoning, each turn |
  | shambling mound | Engulf | 2d8+4 bludgeoning, DC 14 Con, each turn |
  | vrock | Spores | 1d10 poison, each turn |
  | chain devil | Chain | 2d6 piercing, each turn |
  | fire elemental | Touch | 1d10 fire, each turn |
  | magmin | Touch | 1d6 fire, each turn |
  | bulette | Deadly Leap | 3d6+4 bludgeoning and 3d6+4 slashing |
  | ice devil | Wall of Ice | 10d6 cold, DC 17 Dex, half; 5d6 cold, DC 17 Con, half |
  | wereboar (both forms) | Charge | 2d6 slashing |

  The save of the bulette's Deadly Leap is a choice of Strength or Dexterity and is not encoded.
- `src/2014/tests/monster-riders.test.ts` checks that every dice-and-type damage entry of an action, ability, attack or
  option appears in that entry's own text, and pins the damage of the crocodile's, duergar's, eagle's, ettercap's,
  flying snake's, gibbering mouther's, hunter shark's, noble's, plesiosaurus's and scorpion's attacks.

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

## Magic items: `effect` and `enchantment`

Many magic items gained a structured `effect` object (`ability_score_modifier` with ability, amount and optional max;
`damage_type_resistance`; `duration`; `trait_modifier`, which grants a named trait; and similar), plus a separate
`enchantment` object for `+N` weapon/armor items (`armor_class_bonus`, `extra_damage`, `to_hit_bonus`, a
`label_prefix`/`type` for display). `requires_attunement` is a plain boolean alongside the existing prose. A handful of
items with no combat use were removed.

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

| Group | Common | Uncommon | Rare | Very rare | Legendary |
| --- | --- | --- | --- | --- | --- |
| Permanent (wondrous, ring, rod, staff, wand) | n/a | 2500 | 6000 | 25000 | 75000 |
| Weapon | n/a | 1000 | 4000 | 16000 | 24000 |
| Armor and shield | n/a | 500 | 1500 | 6000 | 24000 |
| Ammunition (one piece) | n/a | 25 | 100 | 400 | n/a |
| Consumable | 50 | 250 | 750 | 2500 | 25000 |

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
- Extending `attack_type` coverage to the actions that currently omit it.
