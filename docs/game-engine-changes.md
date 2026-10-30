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
| Monster normalization | `5e-SRD-Monsters-Normalized.json` (new file), `normalize-monsters.ts` (new script), `monster-engine-annotations.json` (new file), `verify-normalize.sh` (new script) | Adds a pre-flattened copy of the monster data that collapses nested reference objects (`dc_type`, `damage_type`, `condition_type`, spellcasting `ability`, etc.) down to their plain string `index`, normalizes where `dc`/`condition` sit on an action, and merges in extra annotations (e.g. conditions applied on a failed save) from `monster-engine-annotations.json`; `src/2014/tests/normalized-monsters.test.ts` regenerates from the English source and asserts it matches the committed normalized file byte-for-byte |
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
