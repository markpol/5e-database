# Overlay migration to text-only (#31)

The 2014 translation overlays used to be near-complete copies of each English record, merged as
`{ ...en, ...overlay }`, so stale structural copies and embedded reference objects overrode English. A one-shot
migration (`scripts/migrate-overlays.ts`) reduced every overlay to its translatable text. This file records what that
changed. The full machine-readable list of changed display text is `changes` in
[`src/i18n/tests/fixtures/overlay-migration.json`](../src/i18n/tests/fixtures/overlay-migration.json), which the
round-trip test `src/i18n/tests/overlay-migration.test.ts` checks.

## What was kept and what moved

- Every translatable field (`name`, `desc`, `range`, choice `desc`, ...) of every translated record is unchanged:
  `localize()` returns the same text as the old merge, field by field.
- Structural fields (`url`, numbers, booleans, dice, `level`, `components`, `ritual`, `concentration`, `prof_bonus`,
  `class_specific`, `ability_score_bonuses`, ...) were removed from the overlays and now always come from English.
- Embedded reference objects were removed. `localize()` resolves a reference's `name` from the translation of the
  record it points at.
- A translated reference label whose target had no translated `name` in that locale was moved onto the target as its
  `name` ("relocated"), when every translated label for that target agreed. No wording was written or edited.

## Reference labels, per locale

Counted per embedded label, except `relocated`, which is counted per target record.

| Locale | relocated | normalized | gained | conflict | former-english | level-prerequisite | structure |
| ------ | --------: | ---------: | -----: | -------: | -------------: | -----------------: | --------: |
| fr-FR  |        23 |        379 |    235 |        6 |              3 |                 75 |       215 |
| pt-BR  |        63 |          0 |      0 |        0 |              0 |                  0 |         0 |
| ru     |        11 |          0 |      0 |        0 |              0 |                  0 |         0 |

- **relocated**: a target record's `name` set from the labels embedded for it. 18 of the fr-FR ones replace an English
  copy that the overlay held as the target's name (for example `classes/fighter` "Fighter" -> "Guerrier", 12
  equipment categories, 4 features, `weapon-properties/special`).
- **normalized**: the label now shows the target record's own translation, which differed from the embedded label
  (spelling variants such as "Athlétisme"/"Athétisme" and context labels such as "Sorts" for "Sorts : Barde").
- **gained**: the old merge showed English here; the target is translated, so the label is now translated.
- **conflict**: the embedded labels for the target disagreed and it has no translated name, so the label falls back
  to English. All six are `equipment-categories/holy-symbols` ("Symbole sacré" and "Symboles sacrés").
- **former-english**: the embedded label was a former English name of the target ("Armor, +1/+2/+3" for
  `magic-items/armor-1..3`), not a translation; it now shows the current English name.
- **level-prerequisite**: a subclass spell prerequisite that points at a class level (`/api/2014/classes/x/levels/n`),
  which has no name of its own to translate, so it shows its English label.
- **structure**: a label that exists in only one of the two merges because the overlay's copy of a list was stale:
  the `equipment` lists of `adventuring-gear` (116 entries in the overlay, 14 in English), `standard-gear` (94/43) and
  `wondrous-items` (177/172), the `diplomats-pack` contents, and `rogue-expertise-1`'s expertise choice.

All 85 level-prerequisite references are in fr-FR `subclasses.spells[].prerequisites[]`:

| Old label    | Now          | References |
| ------------ | ------------ | ---------: |
| Clerc 1..9   | Cleric 1..9  |          9 |
| Druide 3..9  | Druid 3..9   |         56 |
| Occultiste n | Warlock n    |         10 |
| Paladin n    | Paladin n    | 10 (unchanged) |

## Files

| File | Entries before | Entries after |
| ---- | -------------: | ------------: |
| `fr-FR/5e-SRD-Levels.json` | 290 | removed: it held only references and structural copies |
| `fr-FR/5e-SRD-Magic-Items.json` | new | 5 |
| `pt-BR/5e-SRD-Equipment.json` | new | 2 |
| `pt-BR/5e-SRD-Equipment-Categories.json` | new | 1 |
| `pt-BR/5e-SRD-Proficiencies.json` | new | 2 |
| `pt-BR/5e-SRD-Rule-Sections.json` | new | 33 |
| `pt-BR/5e-SRD-Subraces.json` | new | 4 |
| `pt-BR/5e-SRD-Traits.json` | new | 21 |
| `ru/5e-SRD-Races.json` | new | 4 |
| `ru/5e-SRD-Traits.json` | new | 7 |

The new files hold only `index` and the relocated `name`.

## Structural values now taken from English

Records whose localized structure differs from the old merge because a stale overlay copy no longer overrides
English:

| Locale and field | Records | Detail |
| ---------------- | ------: | ------ |
| fr-FR `equipment-categories.equipment` | 3 | the stale lists above |
| fr-FR `equipment.cost` | 2 | `small-knife` and `string-10-feet` were 0 cp; English has 5 cp and 4 cp |
| fr-FR `equipment.gear_category` | 1 | `mess-kit` pointed at `standard-gear`; English has `kits` |
| fr-FR `equipment.contents` | 1 | `diplomats-pack` |
| fr-FR `features.feature_specific` | 1 | `rogue-expertise-1` expertise choice shape |
| fr-FR `spells.damage` | 1 | `magic-missile` slot damage |
| pt-BR `races.speed` | 9 | metric speeds (7.5 m, 9 m); English has 25 ft and 30 ft |

`url`, `level`, `components`, `ritual`, `concentration`, `prof_bonus`, `class_specific` and `ability_score_bonuses`
copies already matched English, so removing them changed no value. The pt-BR speeds were a unit conversion, not a
stale copy; displaying converted units is left to the consumer.
