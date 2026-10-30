# Spell mechanics

Spells in `src/2014/en/5e-SRD-Spells.json` state their range, casting time and duration as text (`range`,
`casting_time`, `duration`). Three optional fields restate the same facts as data, so a consumer does not have to read
the text. They are English-only (nothing in them is translated), added next to the text they restate, and marked `dd`
in `src/provenance/source-markers.json`. The text fields are unchanged, and translation overlays still replace only
the text.

Every one of the 319 spells has all three fields. They are derived from the text by
`src/2014/derive-spell-mechanics.ts` (`pnpm run derive:spells`), which throws on a text it has no word for, so a new
spell or a changed text cannot silently go without a structure. `src/2014/tests/spell-mechanics.test.ts` checks the
committed values against the text with rules that do not share code with the derivation, and fails when a text and
its structure disagree.

## `range_ft`

A number of feet, or one of five words for a range that is not a distance.

| Value | From the `range` text | Spells |
| --- | --- | --- |
| a number | `"N feet"` is `N`; `"1 mile"` is `5280`; `"500 miles"` is `2640000` | 186 |
| `"self"` | `Self` | 62 |
| `"touch"` | `Touch` | 67 |
| `"sight"` | `Sight` | 2 |
| `"unlimited"` | `Unlimited` (Sending) | 1 |
| `"special"` | `Special` (Dream) | 1 |

`self` and `touch` carry no distance on purpose: the SRD does not give one, and what a consumer treats them as (a
caster's own space, an adjacent target) is its own rule.

## `casting_time_data`

`{ amount, unit }`, from `casting_time`.

| `unit` | `casting_time` text | Spells |
| --- | --- | --- |
| `action` | `1 action` | 242 |
| `bonus_action` | `1 bonus action` | 14 |
| `reaction` | `1 reaction` | 4 |
| `minute` | `1 minute`, `10 minutes` | 46 |
| `hour` | `1 hour`, `8 hours`, `12 hours`, `24 hours` | 13 |

`amount` is the number in the text. The condition on which a reaction is taken is in the spell's description.

## `duration_data`

`{ unit, length? }`, from `duration`. `length` is the number in the text and is present for the four units that are a
length of time.

| `unit` | `duration` text | Has `length` | Spells |
| --- | --- | --- | --- |
| `instantaneous` | `Instantaneous` | no | 87 |
| `round` | `1 round`, `Up to 1 round` | yes | 10 |
| `minute` | `1 minute`, `10 minutes`, `Up to 1 minute`, `Up to 10 minutes` | yes | 114 |
| `hour` | `1 hour`, `8 hours`, `24 hours` and the same with `Up to` | yes | 87 |
| `day` | `7 days`, `10 days`, `30 days` | yes | 7 |
| `until_dispelled` | `Until dispelled` | no | 12 |
| `special` | `Special` (Astral Projection, Creation) | no | 2 |

A duration is in the unit the text gives: `24 hours` is `{ unit: "hour", length: 24 }`. "Up to" is not repeated in
the structure. The SRD writes "up to" for exactly the spells that need concentration, and `concentration` already
states that (the test checks the two agree).
