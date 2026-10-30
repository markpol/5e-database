# Item data

The equipment (`src/2014/en/5e-SRD-Equipment.json`) and magic items (`src/2014/en/5e-SRD-Magic-Items.json`) keep every
field they had. This page describes the optional fields next to them that restate prices, rarity, reach, bundle sizes
and effects as data, and the one `effects` shape that equipment and magic items now share.

They are additive, English-only (the translation overlays do not carry them) and marked `dd` in
`src/provenance/source-markers.json`. They are written by `src/2014/derive-item-data.ts` (`pnpm run derive:items`),
which reads the existing fields and the item text and throws on a unit or duration it has no rule for. The Zod schemas
in `src/2014/schemas/5e-SRD-Equipment.ts`, `src/2014/schemas/5e-SRD-Magic-Items.ts` and
`src/schemas/item-effects.ts` fix the vocabulary. `src/2014/tests/item-data.test.ts` checks the values against the text
and the older fields with rules that do not share code with the derivation.

| Field | On | What it says | Items |
| --- | --- | --- | --- |
| `cost_cp` | equipment, magic items | `cost` in copper pieces | 197 equipment, 361 magic items |
| `bundle_size` | equipment | How many pieces `cost` buys | 5 |
| `reach_ft` | equipment | Reach of a melee weapon in feet | 28 weapons |
| `rarity.rank` | magic items | The ordinal of the rarity name | 351 |
| `rarity.min_level` | magic items | The character level from which the item is a fitting reward | 350 |
| `effects` | equipment, magic items | The unified effects (below) | 2 equipment, 68 magic items |

## `cost_cp`

`cost.quantity` times the copper pieces in one coin of `cost.unit`: 1 for `cp`, 10 for `sp`, 50 for `ep`, 100 for `gp`
and 1000 for `pp`. Every `cost` in the data is in `cp`, `sp` or `gp`, and every result is a whole number. A bundle of
ammunition is priced as a bundle: `arrow` costs 1 gp for 20 arrows, so its `cost_cp` is 100 and its `bundle_size` is 20.
Five equipment entries (`alms-box`, `block-of-incense`, `censer`, `little-bag-of-sand`, `vestments`) cost nothing and
have `cost_cp` 0. `orb-of-dragonkind`, an artifact, has no `cost` and no `cost_cp`.

## `bundle_size`

The `quantity` of the four kinds of ammunition (`arrow` 20, `crossbow-bolt` 20, `sling-bullet` 20, `blowgun-needle` 50),
and the count in the name of `ball-bearings-bag-of-1000` (1000). It is absent from every other item: the other
entries with a number in their name (`chain-10-feet`, `rope-hempen-50-feet`) are one object, not a count of pieces.

## `reach_ft`

Set on every melee weapon: 5 feet, and 10 feet for a weapon with the `reach` property, which "adds 5 feet to your
reach" (`glaive`, `halberd`, `lance`, `pike`, `whip`). Ranged weapons have none. The `range.normal` of these five is 5,
as in the upstream data, so `reach_ft` is the field to read.

## `rarity.rank` and `rarity.min_level`

`rarity` keeps its `name` and gains two numbers.

| `name` | `rank` | `min_level` |
| --- | --- | --- |
| Common | 1 | 1 |
| Uncommon | 2 | 1 |
| Rare | 3 | 5 |
| Very Rare | 4 | 11 |
| Legendary | 5 | 17 |
| Artifact | 6 | none |
| Varies | none | none |

`rank` is the order of the names. `min_level` is game-authored: the character level at which an item of that rarity
becomes a fitting reward, following the tiers of play (levels 1 to 4, 5 to 10, 11 to 16, 17 to 20); a common item
belongs to the first tier like an uncommon one. The SRD does not give it. An artifact has no `min_level`, and an item
whose rarity `Varies` has neither number: the rarity of its variants (11 items, such as `spell-scroll` and `ioun-stone`)
is in their own records.

## `effects`

An array of effects, each one an object that says when it applies and what it does. It restates `effect` (equipment and
magic items) and `enchantment` (magic items), which stay as they were. An item has `effects` exactly when it has one of
those two, and one entry for each activation.

```json
[
  { "activation": "carried", "proficiencies": ["medium-armor"] },
  { "activation": "equipped", "armor_class": { "bonus": 1 } }
]
```

### `activation`

| Value | The effect applies |
| --- | --- |
| `equipped` | while the item is worn or wielded |
| `attuned` | while the owner is attuned to the item |
| `carried` | while the owner carries the item |
| `use` | when the item is used up: a potion drunk, a manual read, a vial thrown |

`duration` is set only on `use` effects that last: `{ "unit": "hour", "length": 1 }` for a potion of resistance, and
`{ "unit": "permanent" }` for a manual or tome.

### The members

| Member | Shape | Meaning |
| --- | --- | --- |
| `armor_class` | `{ bonus }` | The one form of an armor class bonus |
| `ability` | `{ ability, op, value, cap? }` | `ability` is `str`, `dex`, `con`, `int`, `wis` or `cha`. `op: "set"`: the score becomes `value` unless it is already that high. `op: "add"`: the score rises by `value`, to at most `cap` when there is one |
| `resistances` | `string[]` | Damage types the owner has resistance to |
| `attack` | `{ to_hit_bonus?, damage_bonus?, extra_damage? }` | Bonuses to attacks with the item; `extra_damage` is a list of damage |
| `damage` | `{ damage_type, damage_dice }[]` | Damage dealt when the item is used |
| `heal` | dice string | Hit points restored when the item is used |
| `saving_throws` | `{ abilities, bonus?, advantage? }` | A bonus, or advantage, on saving throws |
| `skill_check` | `{ skill, bonus?, advantage? }` | A bonus, or advantage, on checks with a skill |
| `proficiencies` | `string[]` | Indexes of proficiencies the owner gains |
| `traits` | `string[]` | Indexes of traits the owner gains |

A damage type is always the plain `index` of 5e-SRD-Damage-Types (`"fire"`), in `resistances`, `damage` and
`attack.extra_damage`. `ability`, the abilities of `saving_throws` and the `skill` use the words of the other
structured data (the same ability `index` as in conditions and features).

### Mapping from `effect` and `enchantment`

| Old field | `effects` |
| --- | --- |
| Equipment `effect.damage[]` | `damage[]`, with `activation: "use"` |
| `effect.armor_class_modifier` | `armor_class.bonus` |
| `enchantment.armor_class_bonus` | `armor_class.bonus` |
| `effect.ability_score_modifier.amount.total` | `ability: { op: "set", value }` |
| `effect.ability_score_modifier.amount.increase` and `.max` | `ability: { op: "add", value, cap }` |
| `effect.damage_type_resistance` | `resistances: [<type>]` |
| `effect.heal` | `heal` |
| `effect.saving_throw_modifier` | `saving_throws`; `gives_advantage: true` becomes `advantage: true`, `false` is dropped |
| `effect.skill_check_modifier` | `skill_check`; `gives_advantage: true` becomes `advantage: true` |
| `effect.proficiency_modifier.grants` | `proficiencies` |
| `effect.trait_modifier.grants` | `traits` |
| `enchantment.to_hit_bonus`, `.damage_bonus` | `attack.to_hit_bonus`, `attack.damage_bonus` |
| `enchantment.extra_damage` | `attack.extra_damage[]`, with the damage type as its `index` and not as a reference |
| `effect.duration.unit` | `activation`, and `duration` for `hour` and `permanent` |
| `enchantment.type`, `enchantment.label_prefix` | not carried: the display prefix stays in `enchantment`, and whether a bonus is for armor or a weapon follows from `armor_class` or `attack` |

`effect.duration.unit` gives the activation: `while attuned` is `attuned`, `while carried` is `carried`, `while
equipped` is `equipped`, `permanent` and `hour` are `use`. An `effect` without a duration is `use` for a consumable, and
otherwise `attuned` when the item has `requires_attunement` and `equipped` when it does not. An `enchantment` is
`attuned` or `equipped` the same way. Effects with the same activation (and duration) are one entry, so a dragon scale
mail has one `attuned` entry with both its resistance and its armor class bonus.

### Corrections and what is not structured

- The old `total` of `gauntlets-of-ogre-power` is 29; its text says "Your Strength score is 19". `ability.value` follows
  the text (19). The old field is unchanged.
- The manuals and tomes (`manual-of-bodily-health` and the like) raise the ability score by 2 "as does your maximum for
  that score". `ability` records the increase and no `cap`; the raised maximum is not structured.
- The activations of the old data are kept as they are: `frost-brand` and `flame-tongue` have no `requires_attunement`
  in the data, so their effects are `equipped`.
- Magic items with neither an `effect` nor an `enchantment` (for example `ammunition`) have no `effects`; their prose
  is not structured here.
