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

The combat mechanics (the damage a spell deals, the saving throw it forces, the area it covers, the dice of its damage
and healing, and how its targets and temporary hit points grow with the slot) are in the last part of this page. They
are derived by `src/2014/derive-spell-combat.ts`, which the same command runs, and checked by
`src/2014/tests/spell-combat.test.ts`.

## `range_ft`

A number of feet, or one of five words for a range that is not a distance.

| Value         | From the `range` text                                               | Spells |
| ------------- | ------------------------------------------------------------------- | ------ |
| a number      | `"N feet"` is `N`; `"1 mile"` is `5280`; `"500 miles"` is `2640000` | 186    |
| `"self"`      | `Self`                                                              | 62     |
| `"touch"`     | `Touch`                                                             | 67     |
| `"sight"`     | `Sight`                                                             | 2      |
| `"unlimited"` | `Unlimited` (Sending)                                               | 1      |
| `"special"`   | `Special` (Dream)                                                   | 1      |

`self` and `touch` carry no distance on purpose: the SRD does not give one, and what a consumer treats them as (a
caster's own space, an adjacent target) is its own rule.

## `casting_time_data`

`{ amount, unit }`, from `casting_time`.

| `unit`         | `casting_time` text                         | Spells |
| -------------- | ------------------------------------------- | ------ |
| `action`       | `1 action`                                  | 242    |
| `bonus_action` | `1 bonus action`                            | 14     |
| `reaction`     | `1 reaction`                                | 4      |
| `minute`       | `1 minute`, `10 minutes`                    | 46     |
| `hour`         | `1 hour`, `8 hours`, `12 hours`, `24 hours` | 13     |

`amount` is the number in the text. The condition on which a reaction is taken is in the spell's description.

## `duration_data`

`{ unit, length? }`, from `duration`. `length` is the number in the text and is present for the four units that are a
length of time.

| `unit`            | `duration` text                                                | Has `length` | Spells |
| ----------------- | -------------------------------------------------------------- | ------------ | ------ |
| `instantaneous`   | `Instantaneous`                                                | no           | 87     |
| `round`           | `1 round`, `Up to 1 round`                                     | yes          | 10     |
| `minute`          | `1 minute`, `10 minutes`, `Up to 1 minute`, `Up to 10 minutes` | yes          | 114    |
| `hour`            | `1 hour`, `8 hours`, `24 hours` and the same with `Up to`      | yes          | 87     |
| `day`             | `7 days`, `10 days`, `30 days`                                 | yes          | 7      |
| `until_dispelled` | `Until dispelled`                                              | no           | 12     |
| `special`         | `Special` (Astral Projection, Creation)                        | no           | 2      |

A duration is in the unit the text gives: `24 hours` is `{ unit: "hour", length: 24 }`. "Up to" is not repeated in
the structure. The SRD writes "up to" for exactly the spells that need concentration, and `concentration` already
states that (the test checks the two agree).

## Combat mechanics

The `damage`, `dc` and `area_of_effect` fields keep the shapes they had. This change adds the entries that were
missing, fixes two areas, and adds four optional fields. Every value is read from the spell's `desc` and `higher_level`
text. Where a text has no single clear reading the entry is left out and listed below. No field is renamed or removed,
the existing string maps are unchanged, and the spell ids are unchanged.

| Field                                          | Spells before | Spells after |
| ---------------------------------------------- | ------------- | ------------ |
| `damage`                                       | 66            | 72           |
| `dc`                                           | 92            | 103          |
| `area_of_effect`                               | 88            | 91           |
| `heal_at_slot_level`                           | 10            | 10           |
| `attack_type`                                  | 16            | 16           |
| `heal_at_slot_level_data`                      | 0             | 6            |
| `damage[].damage_at_slot_level_data` (entries) | 0             | 69           |
| `temp_hp_at_slot_level`                        | 0             | 1            |
| `targets_at_slot_level`                        | 0             | 15           |

### `damage`

One entry for each damage type the text names, with `damage_at_slot_level` from the spell's own level to 9th (or only
the spell's level when the spell does not scale). The text is read as `NdM <type> damage`, `NdM <type> or <type>
damage`, `NdM <type>, <type>, or <type> damage` or `extra NdM damage`, and the scaling as `increases by NdM for each
slot level above Nth`. Added:

- Spirit Guardians: radiant and necrotic, 3d8 at 3rd level and 1d8 more for each slot level above. With `dc` (WIS, half
  on a success) and `area_of_effect` (sphere of 15 feet, read from "to a distance of 15 feet").
- Glyph of Warding: acid, cold, fire, lightning and thunder (explosive runes), 5d8 at 3rd level and 1d8 more for each
  slot level above. With `dc` (DEX, half) and `area_of_effect` (sphere of 20 feet).
- Forbiddance: radiant and necrotic, 5d10.
- Hunter's Mark: an entry without a `damage_type`, 1d6 (the text says "extra 1d6 damage", of the weapon's type).
- Spike Growth: piercing, 2d4 (for every 5 feet the creature travels).
- Weird: psychic, 4d10 (at the start of each turn of a frightened creature).
- Wall of Thorns: the slashing entry that was missing next to the piercing one, with the same scaling (the text says
  both types increase by 1d8 for each slot level above 6th).

Left out, because the amount is not the effect of the spell for a chosen target, depends on a choice or a roll, or
differs by round or option:

| Spell               | Damage type                         | Why                                                                                              |
| ------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| Alter Self          | bludgeoning, piercing, slashing     | unarmed strikes of a chosen form, not damage the spell deals                                     |
| Arcane Hand         | force, bludgeoning                  | two options (clenched fist, grasping hand) that scale by different dice                          |
| Bestow Curse        | necrotic                            | extra damage of one of four curses the caster chooses                                            |
| Contact Other Plane | psychic                             | damage to the caster when the caster fails the spell's own save                                  |
| Earthquake          | bludgeoning                         | damage to structures, and to creatures only if a structure collapses                             |
| Geas                | psychic                             | damage only if the target disobeys, once a day                                                   |
| Meld into Stone     | bludgeoning                         | damage to the caster when expelled                                                               |
| Prismatic Spray     | fire, acid, lightning, poison, cold | the type is chosen by a die roll for each ray (its existing entry has no type)                   |
| Prismatic Wall      | fire, acid, lightning, poison, cold | five layers, each with its own save and effects                                                  |
| Storm of Vengeance  | acid, lightning, bludgeoning, cold  | a different effect in each round of the storm (its existing entry holds the thunder damage only) |
| Teleport            | force                               | damage to the traveller on a mishap                                                              |
| Web                 | fire                                | damage only if the webs are set alight                                                           |
| Wish                | necrotic                            | damage to the caster from the stress of casting                                                  |

A dice amount in the text that is not the value of the entry at the spell's own level, on purpose: Acid Arrow's 2d4 at
the end of the target's next turn, Magic Missile's 1d4 + 1 for one dart (the entry holds three darts, see
`targets_at_slot_level`), and the 5d6 of Wall of Ice for passing through the sheet of frigid air.

### `dc`

`dc_type` is the ability of the saving throw the text forces on a creature ("must succeed on a <ability> saving throw"
or "must make a <ability> saving throw"), and `dc_success` is `half` when the text gives half damage on a success and
`none` otherwise. Added for a spell whose text names exactly one such ability: Antipathy/Sympathy (WIS), Call Lightning
(DEX, half), Flaming Sphere (DEX, half), Glyph of Warding (DEX, half), Holy Aura (CON), Power Word Stun (CON), Sanctuary
(WIS), Sleet Storm (DEX), Spirit Guardians (WIS, half), Web (DEX) and Zone of Truth (CHA).

Left out: Detect Thoughts (the save is only made when the caster probes deeper), Forcecage (the save is only made by a
creature that tries to teleport out), Earthquake (CON and DEX), Prismatic Wall (CON and DEX) and Symbol (a different
save for each of its eight glyph effects).

### `area_of_effect`

`size` is the radius of a sphere or cylinder, the edge of a cube (a "N-foot square" is read as a cube) and the length
of a cone. Added from an explicit "N-foot <shape>" in the text for the spells that fight: Glyph of Warding (sphere
of 20 feet), Hypnotic Pattern (cube of 30 feet) and Spirit Guardians (sphere of 15 feet). Fixed where the text
contradicts the entry:

| Spell        | Was                 | Now                 | Text                                                                     |
| ------------ | ------------------- | ------------------- | ------------------------------------------------------------------------ |
| Flame Strike | cylinder of 40 feet | cylinder of 10 feet | a 10-foot-radius, 40-foot-high cylinder                                  |
| Move Earth   | cone of 40 feet     | cube of 40 feet     | an area of terrain no larger than 40 feet on a side (a "40-foot square") |

Not changed: Fire Storm (ten 10-foot cubes in any arrangement; the entry is their reach) and Symbol (the 60-foot-radius
sphere is the glyph's light after it triggers). A spell with one explicit shape that does not fight and has no entry
(Druidcraft, Major Image, Minor Illusion, Purify Food and Drink) is left as it is, since the shape bounds an image or
a sensory effect and is not an area of effect.

### Dice as data

`{ dice, bonus?, add_spellcasting_mod? }` restates a string of `NdM`, `NdM + MOD` or `NdM + N` as data: `dice` is `NdM`,
`bonus` a flat number added to it, and `add_spellcasting_mod` is `true` when the caster's spellcasting ability modifier
is added. A map has the structure only when every value of the map is such a string, so a flat amount (Heal's `70`) or
a choice (Flame Strike's `4d6 OR 5d6`) has none. The string maps are unchanged.

- `heal_at_slot_level_data` has the same slot keys as `heal_at_slot_level`: Cure Wounds, Healing Word, Mass Cure
  Wounds, Mass Healing Word, Prayer of Healing and Regenerate (`{ dice: "4d8", bonus: 15 }`). False Life states temporary
  hit points in `heal_at_slot_level` and has its structure in `temp_hp_at_slot_level` instead.
- `damage[].damage_at_slot_level_data` sits next to `damage_at_slot_level` in 69 entries of `damage`, such as Spiritual
  Weapon's `{ dice: "2d8", add_spellcasting_mod: true }` at 4th level and Magic Missile's `{ dice: "3d4", bonus: 3 }`.

### `targets_at_slot_level`

A number for each slot level from the spell's own to 9th: the number of creatures, darts, rays or bolts. The base number
is the one the description states, and it grows by one for each slot level above the spell's own, as the `higher_level`
text says. Bane (3), Banishment (1), Bless (3), Blindness/Deafness (1), Chain Lightning (4: the first target and three
others), Charm Person (1), Command (1), Enhance Ability (1), Fly (1), Hold Monster (1), Hold Person (1), Invisibility (1),
Longstrider (1), Magic Missile (3 darts) and Scorching Ray (3 rays).

Left out although the `higher_level` text scales a number: Animate Dead and Animate Objects (undead and objects, two more
for each slot level), Conjure Animals, Conjure Minor Elementals and Conjure Woodland Beings (a multiple of the base number
at certain slots only) and Etherealness (up to three willing creatures for each slot level above 7th, the base being the
caster alone). Mass Healing Word and Prayer of Healing have six targets at every slot level and the text scales the
healing, so they have no entry.

### `temp_hp_at_slot_level`

`{ dice, bonus }` for each slot level, for the one spell whose `higher_level` text scales its temporary hit points: False
Life, 1d4 + 4 at 1st level and 5 more for each slot level above (`bonus` 4 to 44). It agrees with the strings of
`heal_at_slot_level`.

## `engine`

`engine` is a classification of the 117 combat spells: the spells that deal damage, make an attack roll, restore
hit points, buff, or force a saving throw to impose a condition. It is optional, English-only, written by hand (a
judgement about each spell, not text in it) in `src/2014/spell-engine-annotations.json`, merged into the spells by
`src/2014/derive-spell-engine.ts` (the same `pnpm run derive:spells`), and marked `dd` in
`src/provenance/source-markers.json`. No other field is changed. A spell is in the set when it is one of the combat
spells named in the test, or has `damage`, `attack_type` or `heal_at_slot_level`; the spells that have one of those
only as a side effect have no `engine` and are listed below.

`{ kind, target, campaign, npc }`:

| `kind`           | Meaning                                                                                                   | Spells |
| ---------------- | --------------------------------------------------------------------------------------------------------- | ------ |
| `heal`           | Restores hit points to one creature.                                                                      | 4      |
| `mass-heal`      | Restores hit points to several creatures.                                                                 | 4      |
| `stabilize`      | Stops a dying creature from dying.                                                                        | 1      |
| `spell-attack`   | Makes a melee or ranged spell attack against a creature (`attack_type`, or the attack named in the text). | 13     |
| `save-damage`    | Forces one creature to make a saving throw (`dc`) or take `damage`.                                       | 14     |
| `auto-hit`       | Deals `damage` with no attack roll and no saving throw.                                                   | 1      |
| `area-damage`    | Deals `damage` to every creature in an `area_of_effect`, usually with a saving throw (`dc`).              | 32     |
| `buff`           | Improves a creature for a time: protection, a bonus, extra damage, or temporary hit points.               | 11     |
| `aura`           | An effect that stays with the caster and affects creatures near them.                                     | 3      |
| `save-condition` | Forces a saving throw (`dc`) to impose a condition, and deals no `damage`.                                | 26     |
| `cure-condition` | Ends a condition or a disease.                                                                            | 2      |
| `command`        | Makes a creature obey a one-word order if it fails a saving throw.                                        | 1      |
| `summon-weapon`  | Conjures a weapon that attacks for the caster and deals `damage`.                                         | 3      |
| `summon`         | Conjures a creature or a guardian that fights for the caster.                                             | 2      |

| `target` | Meaning                                                                                                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `ally`   | Aimed at the caster or a friendly creature, including a spell that can only be cast on the caster.                                      |
| `enemy`  | Aimed at one or more creatures the spell works against.                                                                                 |
| `area`   | Aimed at a point or a region and affects everything in it, including a cone or a line from the caster and a guardian placed at a point. |

`campaign` is `true` when the spell is meaningful outside combat: the spell heals, stabilizes or cures, or it is a
buff or an aura with a duration of an hour or more that does not need concentration. `npc` is `false` when a game
integrating this data cannot expect a non-player caster to use the spell: it takes a minute or an hour to cast,
needs a material component with a price in gold pieces, or only changes a character's armor or weapon, which a stat block does not use (Mage Armor,
Magic Weapon).

The spells of each kind:

- `heal` (4): Cure Wounds, Heal, Healing Word, Regenerate.
- `mass-heal` (4): Mass Cure Wounds, Mass Heal, Mass Healing Word, Prayer Of Healing.
- `stabilize` (1): Spare The Dying.
- `spell-attack` (13): Acid Arrow, Chill Touch, Contagion, Eldritch Blast, Fire Bolt, Guiding Bolt, Inflict Wounds, Produce Flame, Ray Of Enfeeblement, Ray Of Frost, Scorching Ray, Shocking Grasp, Vampiric Touch.
- `summon-weapon` (3): Arcane Sword, Flame Blade, Spiritual Weapon.
- `summon` (2): Faithful Hound, Guardian Of Faith.
- `save-damage` (14): Acid Splash, Blight, Chain Lightning, Disintegrate, Feeblemind, Finger Of Death, Flaming Sphere, Harm, Heat Metal, Hellish Rebuke, Phantasmal Killer, Poison Spray, Sacred Flame, Vicious Mockery.
- `auto-hit` (1): Magic Missile.
- `aura` (3): Fire Shield, Holy Aura, Spirit Guardians.
- `buff` (11): Aid, Beacon Of Hope, Bless, Branding Smite, Divine Favor, False Life, Hunter's Mark, Mage Armor, Magic Weapon, Sanctuary, Shield Of Faith.
- `cure-condition` (2): Greater Restoration, Lesser Restoration.
- `command` (1): Command.
- `save-condition` (26): Animal Friendship, Banishment, Blindness/Deafness, Calm Emotions, Charm Person, Compulsion, Divine Word, Dominate Beast, Dominate Monster, Dominate Person, Entangle, Enthrall, Eyebite, Faerie Fire, Fear, Flesh to Stone, Grease, Hideous Laughter, Hold Monster, Hold Person, Hypnotic Pattern, Mass Suggestion, Power Word Stun, Sleet Storm, Suggestion, Web. The target is `area` when the spell has an `area_of_effect` (Calm Emotions, Entangle, Faerie Fire, Fear, Grease, Hypnotic Pattern, Sleet Storm, Web) and `enemy` otherwise.
- `area-damage` (32): Black Tentacles, Blade Barrier, Burning Hands, Call Lightning, Circle Of Death, Cloudkill, Cone Of Cold, Delayed Blast Fireball, Fire Storm, Fireball, Flame Strike, Freezing Sphere, Glyph Of Warding, Ice Storm, Incendiary Cloud, Insect Plague, Lightning Bolt, Meteor Swarm, Moonbeam, Prismatic Spray, Shatter, Sleep, Spike Growth, Storm Of Vengeance, Sunbeam, Sunburst, Thunderwave, Wall Of Fire, Wall Of Ice, Wall Of Thorns, Weird, Wind Wall.

`engine.kind` agrees with the structured fields, and `src/2014/tests/spell-engine.test.ts` checks it: a spell with an
`attack_type` is a `spell-attack`, `summon-weapon` or `summon`; `save-damage` has `dc` and `damage`; `save-condition`
has `dc` and no `damage`; `area-damage` has `damage` and `area_of_effect`; `auto-hit` has `damage` and neither `dc` nor
`attack_type`; `heal` and `mass-heal` have `heal_at_slot_level`. The test also checks that `campaign` and `npc` follow
the rules above.

Judgement calls:

- Scorching Ray is a `spell-attack` although it has no `attack_type`, because its text makes a ranged spell attack
  for each ray. Ray of Enfeeblement and Contagion are `spell-attack` for the attack roll they make, although they
  deal no damage.
- Sleep is `area-damage`: it has no saving throw and no damage type, but it rolls dice against creatures in an area,
  and its `damage` entry is those dice.
- Flaming Sphere is `save-damage`, since the sphere is a single 5-foot ball and has no `area_of_effect`. Chain
  Lightning is `save-damage` for its first target and the others it jumps to, and has no `area_of_effect`.
- Faithful Hound and Guardian of Faith are `summon` with the target `area`, because a guardian is placed at a point.
  Spiritual Weapon, Arcane Sword and Flame Blade are `summon-weapon`.
- Fire Shield and Holy Aura are `aura` (they stay with the caster) with the target `ally`; Spirit Guardians is an
  `aura` as well, although its damage is dealt in an area around the caster.
- Hunter's Mark, Divine Favor and Branding Smite are `buff`: their `damage` is an extra amount added to the
  caster's own attacks. Hunter's Mark marks a creature, so its target is `enemy`; the other two are `ally`.
- Sanctuary has a `dc` (the attacker's saving throw) and is a `buff` on the protected creature.
- Aid and False Life are `buff` although they have `heal_at_slot_level`, since they raise hit points for a time and
  do not restore them.
- Prayer of Healing is `mass-heal` although it takes 10 minutes, so its `npc` is `false`.
- Banishment, Divine Word and Power Word Stun are `save-condition`, although Divine Word and Power Word Stun depend
  on the target's hit points and Banishment sends the target away.
- `campaign` and `npc` follow the rules above and not the strength of the spell, so Regenerate and Prayer of Healing
  (a minute or ten minutes to cast) are `campaign: true` and `npc: false`.

Without an `engine` although they deal damage, make an attack roll or force a saving throw, because the damage or the
roll is not what the spell is for:

| Spell          | Why                                                                           |
| -------------- | ----------------------------------------------------------------------------- |
| Control Water  | reshapes water; the damage is to creatures swept by a flood                   |
| Dimension Door | teleportation; the damage is only a mishap                                    |
| Dream          | messaging; the damage is only a nightmare the caster sends                    |
| Forbiddance    | a ward on a site; the damage is to a creature that enters it                  |
| Plane Shift    | travel; the attack roll only decides whether an unwilling target is sent away |

Spells that force a saving throw and impose a condition but are left out as a different kind of spell (Antipathy/
Sympathy, Dispel Evil and Good, Geas, Hallow, Imprisonment, Magic Circle, Modify Memory, Polymorph and Scrying) have no `engine` either.
