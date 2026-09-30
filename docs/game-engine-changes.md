# `game-engine-rebase-next` changes

This document explains what the `game-engine-rebase-next` branch of this fork
(`markpol/5e-database`) changes relative to upstream `main`
(`5e-bits/5e-database`), and why. It is meant to let a maintainer understand,
review, and — if the branch is ever reworked from scratch — re-apply these
changes without having to read the full commit history.

The branch is consumed directly as a git-pinned npm dependency by the
[Draconian Dungeons](https://github.com/markpol) game project (`5e-database`
pinned to this branch in `package.json`), which imports the JSON files under
`src/2014/en/` and `src/2014/5e-SRD-Monsters-Normalized.json` at build time.
Everything below is scoped to the `src/2014` (2014 SRD) data set; nothing in
`src/2024` is touched.

All of this is derived from the actual diff (`git diff main..game-engine-rebase-next`)
and the branch's commit messages, not from memory of the game's design. Anything
that could not be confirmed against the current Draconian Dungeons code is
marked **Unconfirmed** below.

## At a glance

| Area | File(s) | What changed |
| --- | --- | --- |
| Monster actions | `5e-SRD-Monsters.json` | Added `attack_type` ("Melee"/"Ranged") to actions; added `bonus_actions` (parsed list of bonus-action ids); added `environments` (habitat string); `speed.*` and `senses.{darkvision,blindsight,truesight}` changed from strings (`"40 ft."`) to plain integers (`40`) |
| Monster normalization | `5e-SRD-Monsters-Normalized.json` (new file), `normalize-monsters.ts` (new script), `verify-normalize.sh` (new script) | Adds a pre-flattened copy of the monster data that collapses nested reference objects (`dc_type`, `damage_type`, `condition_type`, spellcasting `ability`, etc.) down to their plain string `index`, and normalizes where `dc`/`condition` sit on an action |
| Conditions | `5e-SRD-Conditions.json` | Added 17 new condition entries: 6 numbered exhaustion levels (`exhaustion-1`…`exhaustion-6`) plus `enraged`, `frenzied`, `reckless`, `dodging`, `infested`, `swallowed`, `drained-of-strength`, `weakened`, `slowed`, `drained-of-life`, `disengaged`, `surprised` |
| Equipment | `5e-SRD-Equipment.json` | Added `material`, `stackable`, `is_consumable`, `effect` (damage-on-use) to select items; removed 40 non-combat items (mounts, vehicles, barding, tack/harness, stabling/feed) |
| Equipment categories | `5e-SRD-Equipment-Categories.json` | Removed 6 non-combat categories (`gaming-sets`, `land-vehicles`, `mounts-and-other-animals`, `mounts-and-vehicles`, `tack-harness-and-drawn-vehicles`, `waterborne-vehicles`) and their members |
| Proficiencies | `5e-SRD-Proficiencies.json` | Removed proficiency entries tied to the removed equipment (e.g. `nets`, `land-vehicles`, `water-vehicles`) |
| Features | `5e-SRD-Features.json` | Bard/Rogue Expertise reworked from a two-level nested choice (`choose 1` of a `choose 2` sub-choice) to a flat `choose 2`; trimmed some prose (e.g. Martial Arts' "nunchaku/kama" flavor text, Frenzy wording) |
| Magic items | `5e-SRD-Magic-Items.json` | Added a structured `effect` object (ability-score modifiers, damage-type resistance, healing, trait grants, duration) and an `enchantment` object (armor/weapon bonus, extra damage, to-hit bonus) to many items, so items can be applied mechanically instead of only read as prose; removed a handful of unusable/non-combat items |
| Package/tooling | `package.json` | `engines.node` widened from `"22.x"` to `"22.x \|\| 24.x"` |

Two commits carry all of this on top of the previous fork `main`:

- `- removed non combat related equipment, equipment categories, character starting equipment and race proficiencies\n- started removal of non combat related spells` (the bulk of the data changes, squashed from a long line-by-line history — see [History note](#history-note-about-the-squashed-commit))
- `Allowing node v24 engine` (the `package.json` engines change)

## Why: game-engine data needs

Draconian Dungeons runs 5e monster/player combat programmatically (a
behavior-tree-driven turn engine), not as a tabletop aid. The SRD JSON as
published upstream is written to be *read*, not *executed*: attack types,
bonus actions, and item mechanics are embedded in free-text `desc` strings.
This branch's job is to add just enough structured, machine-checkable data
next to that prose so the engine doesn't have to parse English text to know
what a monster or item does, while removing content that has no combat
meaning for a game that has no non-combat mode (shopping trips, mounts,
travel, roleplay skills).

### Monster actions: `attack_type`, `bonus_actions`, `environments`

- `attack_type` (`"Melee"` / `"Ranged"`) is added to individual monster
  actions. Draconian Dungeons' `MonsterActionModel` reads this field to
  classify attacks (`isRangedAttack()` / `isMeleeAttack()`), which drives
  targeting and reach rules in the turn engine.
  **Caveat, confirmed in the consumer's code:** the field is not present on
  every action (a small number of named attacks omit it), so the game's own
  `isRangedWeaponAttack()` treats `attack_type` as a fallback after first
  trying to infer the type from the action's `desc` text. A maintainer
  re-applying this change should not assume `attack_type` coverage is
  complete — it is a best-effort annotation, not a guaranteed field.
- `bonus_actions` is a new top-level array on each monster (e.g.
  `["disengage", "hide"]` for the Goblin's Nimble Escape), derived from
  reading the monster's special abilities and actions prose and extracting
  which bonus actions it can take. This lets the turn engine offer/AI-select
  bonus actions without parsing `special_abilities[].desc`.
- `environments` is a new string field (e.g. `"Forest, Grassland, Hill,
  Underdark"`) naming the monster's habitats. **Unconfirmed**: no reference
  to this field was found in the parts of Draconian Dungeons inspected for
  this documentation; it may be intended for future encounter/spawn-table
  work rather than something currently consumed.

### Speed and senses as integers

`speed.{walk,fly,swim,climb,burrow}` and
`senses.{darkvision,blindsight,truesight}` were changed from SRD's normal
`"40 ft."` string format to a plain integer (`40`). This removes the need for
unit-parsing in game code that does arithmetic on these values (e.g. movement
budgets, vision range checks).

### Monster normalization (`5e-SRD-Monsters-Normalized.json`, `normalize-monsters.ts`, `verify-normalize.sh`)

`normalize-monsters.ts` is a standalone script (not part of the package's
`build:ts`/`lint`/`test` scripts, and not invoked by Draconian Dungeons —
confirmed absent from that project's own scripts/CI) that reads
`5e-SRD-Monsters.json` and writes a flattened copy where nested reference
objects are collapsed to their `index` string, for example:

```jsonc
// before (5e-SRD-Monsters.json)
"dc": { "dc_type": { "index": "con", "name": "CON", "url": "..." }, "dc_value": 14 }
// after (5e-SRD-Monsters-Normalized.json)
"dc": { "dc_type": "con", "dc_value": 14 }
```

It also relocates a `dc`/`condition` that upstream sometimes attaches
directly to an `action` down onto that action's last `damage` entry, so
consumers always find `dc`/`condition` in the same place. Draconian
Dungeons' `models/srd/monster.ts` imports the *output* file
(`5e-SRD-Monsters-Normalized.json`) directly — the script itself is
effectively one-shot tooling that produced that file, not a build step the
game runs.

`verify-normalize.sh` is a small `jq`-based sanity check over the normalized
file (lists actions with a `condition`, a `dc`, no damage, or a damage `dc`)
used to eyeball the output after regenerating it; it makes no changes and
has no exit-code assertions.

**Note for whoever regenerates this file:** the script's own
`outputFilePath` constant is `./5e-SRD-Monsters-Normalized-6.json` (with a
`-6` suffix), but the file actually committed to the repo is
`5e-SRD-Monsters-Normalized.json` (no suffix). Either the script was edited
after the last real run, or the output was renamed by hand before
committing — re-running the script as-is today will **not** overwrite the
committed file. Fix the constant (or rename the output) before regenerating.

### New conditions

The branch adds 17 condition entries beyond the SRD's baseline 14 (plus the
single combined `Exhaustion` description):

- `exhaustion-1` … `exhaustion-6`: the exhaustion table split into one
  condition per level, each carrying only that level's cumulative effects.
  This lets the engine track exhaustion as a simple stacking condition
  instead of re-deriving effects from a level number against prose.
- `enraged`, `frenzied`, `reckless`: barbarian Rage / Frenzy / Reckless
  Attack, promoted from *class features* to *conditions* so the combat
  engine can apply/check them as buffs on a creature the same way it does
  any other condition. Confirmed consumed: `enraged` grants a Strength
  advantage in Draconian Dungeons' condition logic.
- `dodging`: the Dodge action's effect, likewise turned into a condition so
  "is this creature dodging" is a condition check rather than action-history
  bookkeeping. Confirmed consumed for attack-roll (dis)advantage.
- `infested`, `swallowed`: monster-specific damage-over-time conditions
  (parasite attachment / being swallowed by a larger creature) used to
  implement specific monster abilities (e.g. Stirge's Blood Drain, Giant
  Frog's Swallow) as generic conditions rather than bespoke code per
  monster. Confirmed: `infested` tracks cumulative damage in the
  behavior-tree code.
- `drained-of-strength`, `weakened`, `drained-of-life`, `slowed`: generic
  ability-damage / debuff conditions used to implement monster and magic
  item effects (e.g. strength drain, life drain, paralysis-adjacent slows)
  without hardcoding each source.
- `disengaged`, `surprised`: promoted from prose-only combat rules (the
  Disengage action's no-opportunity-attack effect; the surprise round rule)
  to first-class conditions the turn engine can check.

**Unconfirmed:** a `fire-resistance` *condition* was mentioned in the
branch's commit history, but no such condition exists in the current
`5e-SRD-Conditions.json`, and no reference to it was found in Draconian
Dungeons. The only related hit is a magic item, *Potion of Fire Resistance*
— that is unaffected by this note. Treat any future "fire-resistance
condition" work as not yet done.

### Equipment: `material`, `stackable`, `is_consumable`, `effect`, and removed items

- `material` (e.g. `"metal"`) is added to select equipment (mostly metal
  weapons/ammunition). Confirmed consumed in the game's combat logic for a
  metal-specific interaction rule (checked in the pre-/post-attack
  behavior-tree steps).
- `stackable: true` is added to ammunition and consumables (arrows, darts,
  javelins, sling bullets, rations, pitons, etc.) so the game's inventory
  can stack quantities instead of treating each unit as a unique item.
  Confirmed consumed for inventory stacking.
- `is_consumable` and `effect` (e.g. a damage-on-use effect for Acid Vial,
  Alchemist's Fire) are added to a couple of consumable items so the engine
  can expend them and apply their effect mechanically. Confirmed consumed
  (items are removed/expended on use).
- 40 non-combat equipment entries were removed: all mounts (camel, donkey,
  elephant, horses, mule, mastiff, pony), all barding, all
  saddle/bit-and-bridle/saddlebags/stabling/feed items, and all vehicles
  (carts, wagons, ships, sleds, chariots). None of this has combat mechanics
  in a game with no travel/mount/shopping systems.
- The corresponding equipment categories (`land-vehicles`,
  `waterborne-vehicles`, `mounts-and-vehicles`, `mounts-and-other-animals`,
  `tack-harness-and-drawn-vehicles`, `gaming-sets`) and the proficiencies
  that referenced them (`nets`, `land-vehicles`, `water-vehicles`, and
  similar) were removed for the same reason.

### Features: Expertise flattened, minor prose trims

Bard's and Rogue's Expertise `feature_specific.expertise_options` was
restructured from `choose 1` of a nested `choose 2` skill-choice block to a
single flat `choose 2`. This is a data-shape simplification for whatever
character-builder logic walks `feature_specific` option trees — a single
flat choice is simpler to resolve than a choice-of-a-choice that always
resolves to the same two skills either way. A few description strings had
minor trims (e.g. the "nunchaku/kama" flavor sentence dropped from Martial
Arts, a small wording tweak to Frenzy) with no mechanical effect.

### Magic items: `effect` and `enchantment`

Many magic items gained a structured `effect` object — `ability_score_modifier`
(ability, amount, optional max), `damage_type_resistance`, `duration`,
`trait_modifier` (grants a named trait), and similar — plus a separate
`enchantment` object for `+N` weapon/armor items (`armor_class_bonus`,
`extra_damage`, `to_hit_bonus`, a `label_prefix`/`type` for display). Both
are confirmed consumed: `MagicItemEnchantmentModel` and `EffectModel` /
`GearEffectModel` in Draconian Dungeons read these directly to apply bonuses
and effects rather than parsing the item's `desc` prose. `requires_attunement`
(a plain boolean, alongside the existing prose) is likewise read directly and
enforced against the game's attunement-slot cap. A handful of items with no
in-combat use were removed.

### `package.json`: Node 24 engine

`engines.node` was widened from `"22.x"` to `"22.x || 24.x"` so the package
can be installed under Node 24 toolchains, with no other change.

## Data-quality notes for a maintainer

- **`url` field format drift.** Across `5e-SRD-Monsters.json` (and likely
  other touched collections), `url` values were rewritten from the
  `"/api/2014/monsters/<index>"` shape used by current upstream `main` to a
  shorter `"/api/monsters/<index>"` shape (no `/2014/` segment). This is a
  leftover from whenever this branch was originally based on an
  upstream commit that predated the `2014`/`2024` version split in the API
  path, and it was carried forward through every subsequent rebase without
  being reconciled. It does not break anything mechanically (git treats it
  as an ordinary line change and it caused no rebase conflicts), but it is a
  real divergence from upstream's current URL scheme in every record this
  branch has touched. Worth fixing if the branch is ever squashed and
  reworked from scratch.
- **`normalize-monsters.ts` output path mismatch** — see the note above
  under [Monster normalization](#monster-normalization-5e-srd-monsters-normalizedjson-normalize-monstersts-verify-normalizesh).

## History note about the squashed commit

The branch's main data commit carries, in its commit message body, a long
chronological log of dozens of small intermediate steps (adding/removing
individual fields and conditions one at a time, several rounds of "removed
X" followed later by "restored X" or "reverted data deletions"). That log is
squash history, not a description of the current state — some of the
listed steps (for example, removing skill proficiencies from Classes, or
removing languages/traits from Races) were reverted later in that same
history and are **not** present in the final diff against upstream `main`
used to write this document. This document describes only the net effect of
`git diff main..game-engine-rebase-next`, which is what actually ships.

## Out of scope / follow-up ideas

- Reconciling the `/api/2014/...` vs `/api/...` URL drift noted above.
- Fixing the `normalize-monsters.ts` output filename so re-running it
  actually regenerates the committed file.
- Deciding whether `environments` is meant to be consumed yet, and by what.
- Confirming (or removing) any remaining reference to a `fire-resistance`
  condition.
- Extending `attack_type` coverage to the actions that currently omit it,
  so the game's `desc`-text fallback can eventually be retired.

These are intentionally not addressed by the rebase itself — only carried
forward as-is from before the rebase.

## Re-rebasing this branch onto a newer `main`

When upstream `main` moves forward again and this branch needs to catch up:

```sh
# from a clone/worktree with both remotes configured
git remote add 5e-bits https://github.com/5e-bits/5e-database.git   # once
git fetch 5e-bits main
git fetch origin main game-engine-rebase-next

# fast-forward the fork's main to upstream (never force-push this)
git push origin 5e-bits/main:refs/heads/main

# rebase the branch
git checkout -b game-engine-rebase-next origin/game-engine-rebase-next
git rebase origin/main
# resolve any conflicts, preferring upstream content and re-applying only
# this branch's own intended changes (see the "At a glance" table above for
# what those are)

# verify before pushing
pnpm install
pnpm run lint
pnpm run build:ts
pnpm run test
zsh src/2014/verify-normalize.sh   # sanity check on the normalized monsters file

# push with a lease bound to the branch's old tip, never a plain --force
git push --force-with-lease=game-engine-rebase-next:<old-sha> origin game-engine-rebase-next
```

As of this document, rebasing onto a `main` that has not touched
`src/2014/en/*.json`, `src/2014/5e-SRD-Monsters-Normalized.json`,
`src/2014/normalize-monsters.ts`, `src/2014/verify-normalize.sh`, or the
`engines.node` line of `package.json` produces no conflicts at all — the
only shared file historically touched by both sides is `package.json`,
where git auto-merges the unrelated line changes. A future rebase may not be
this clean if upstream starts editing the same collections; resolve those
conflicts by keeping upstream's version of unrelated fields and re-applying
only the specific field/value this branch intentionally changed (per the
"At a glance" table).
