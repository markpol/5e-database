# Monster effects

The normalized monsters (`src/2014/5e-SRD-Monsters-Normalized.json`) carry optional fields on traits and actions that
restate, as data, mechanics the SRD gives only as prose: regeneration, a reduced attack at half hit points, a
reduction of hit point maximum, a limit on how long a monster stays attached, and conditional damage resistances.
They are additive and English-only (the translation overlays do not carry them), and the English monster file
(`src/2014/en/5e-SRD-Monsters.json`) is unchanged. Every field is optional and is marked `dd` in
`src/provenance/source-markers.json`.

`src/2014/derive-monster-effects.ts` reads the values from the English text, and `src/2014/normalize-monsters.ts` writes
them (`pnpm run normalize:monsters`). A rule reads one SRD phrasing and throws when the text starts the phrasing and
does not finish it, so a new wording is reviewed instead of silently left unstructured. The Zod schemas in
`src/schemas/monster-effects.ts` and `src/2014/schemas/5e-SRD-Monsters-Normalized.ts` fix the vocabulary.
`src/2014/tests/monster-effects.test.ts` checks every value against the text with rules that share no code with the
derivation, and fails when a trait or action mentions one of these mechanics and has neither a field nor an entry in
its list of excluded abilities (below).

## Fields of a trait or an action

The fields are flat optional keys of an entry of `special_abilities[]`, `actions[]`, `legendary_actions[]` and
`reactions[]`. 33 entries have them: 7 traits and 25 actions are structured by the first five fields, and 1 trait by
`resistances`. Each also has a `trigger`.

| Field                    | Value                                                               | Meaning                                                                                                                                             | Entries                                                                    |
| ------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `trigger`                | one of the words below                                              | When the structured effect of the entry applies. On every entry that has one of the fields below                                                      | 33                                                                         |
| `regeneration`           | `{ hit_points, min_hit_points?, suppressed_by?, disabled_in?, dies_only_without_regenerating? }` | Hit points regained at the start of the monster's turn, with the conditions that stop or limit it                                  | 7 traits: oni, shield guardian, troll, the four vampires                   |
| `damage_dice_at_half_hp` | dice, such as `2d4`                                                 | The dice of the monster's first `damage` entry while it has half of its hit points or fewer                                                         | 10 actions: the swarms                                                     |
| `detach_after_damage`    | number of hit points                                                | The monster detaches after the target has lost this many hit points to it                                                                           | 1 action: the stirge's Blood Drain                                         |
| `reduce_max_hp`          | `{ by, damage_type?, until }`                                       | The target's hit point maximum is reduced by the damage it took                                                                                     | 8 actions: clay golem, specter, succubus/incubus, three vampires, wight, wraith |
| `reduction_dice`         | `{ dice, every_hours?, repeat_save?, until }`                       | The target's hit point maximum is reduced by dice, once or every so many hours                                                                      | 6 actions: death dog, giant diseased rat, mummy, mummy lord, night hag, otyugh |
| `resistances`            | list of damage rules (below)                                        | Resistance the ability gives. On the nightmare's Confer Fire Resistance it is the resistance of the creature riding it                              | 1 trait: nightmare                                                         |

### `trigger`

| Value                     | Meaning                                                                          | Used for                                                               |
| ------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `start_of_turn`           | At the start of the monster's own turn                                           | `regeneration`; the blood the stirge drains and when it detaches        |
| `on_hit`                  | When an attack hits                                                              | `reduce_max_hp` of the vampires' Bite, which has no saving throw       |
| `on_failed_save`          | When the target fails the saving throw the action calls for                       | `reduce_max_hp` of the clay golem, specter, wight and wraith           |
| `on_damage`               | When the action damages the target, whether or not the target saved              | `reduce_max_hp` of the succubus/incubus's Draining Kiss                |
| `every_24_hours`          | Every 24 hours after the target is afflicted                                      | `reduction_dice` of a disease or a curse                                |
| `after_1_hour_of_visions` | Once the target has had the monster's visions for at least an hour               | `reduction_dice` of the night hag's Nightmare Haunting                 |
| `half_hit_points_or_fewer`| While the monster has half of its hit points or fewer                            | `damage_dice_at_half_hp`                                               |
| `while_ridden`            | While a creature rides the monster; the effect is the rider's                    | `resistances` of the nightmare                                         |

### `regeneration`

| Member                           | Value                              | Meaning                                                                                                                |
| -------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `hit_points`                     | positive integer                   | Hit points regained at the start of the monster's turn                                                                  |
| `min_hit_points`                 | positive integer                   | The least hit points the monster must have to regenerate (1 for the oni, shield guardian and vampires)                  |
| `suppressed_by`                  | `{ damage_types, sources? }`       | Taking damage of these types (indexes of the damage types), or being hit by a `source`, stops regeneration at the start of the monster's next turn. `sources` is `holy_water` |
| `disabled_in`                    | `sunlight`, `running_water`        | Where the monster does not regenerate (the vampires: both)                                                              |
| `dies_only_without_regenerating` | `true`                             | 0 hit points kills the monster only when its turn starts at 0 hit points and it does not regenerate (the troll)         |

The troll regenerates 10 hit points and is stopped by acid or fire damage; the oni and the shield guardian regenerate
10 with at least 1 hit point; the vampire spawn regenerates 10 and the vampire in its three forms 20, with at least 1 hit
point, not in sunlight or running water, and stopped by radiant damage or holy water.

### `damage_dice_at_half_hp`

The dice replace `damage_dice` of the action's first `damage` entry while the monster has half of its hit points or
fewer; the damage type is the same. The ten swarms (bats, beetles, centipedes, insects, poisonous snakes, quippers,
rats, ravens, spiders, wasps) say it in their one attack: for example the swarm of bats' Bites are `2d4` and `1d4`.
The other damage entries of the action (the poison of the swarm of poisonous snakes) do not change. The trigger is
`half_hit_points_or_fewer`.

### `detach_after_damage`

The stirge's Blood Drain: "The stirge can detach itself by spending 5 feet of its movement. It does so after it drains
10 hit points of blood from the target or the target dies." The value is `10`, the total hit points the target has
lost to this attack. The target dying also ends it, which the text states and the field does not.

### `reduce_max_hp` and `reduction_dice`

Both lower the hit point maximum of the target, and the SRD says in every one that the target dies if the maximum
reaches 0, so no field repeats it. An action has one or the other.

| Member       | On                              | Value                                                                       | Meaning                                                                                                          |
| ------------ | ------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `by`         | `reduce_max_hp`                 | `damage_taken`                                                              | The maximum is reduced by the damage the target took                                                              |
| `damage_type`| `reduce_max_hp`                 | an index of the damage types                                                | Only the damage of this type counts (`necrotic` for the vampires' Bite)                                           |
| `dice`       | `reduction_dice`                | dice, such as `1d10`                                                        | The reduction. The text's average (`5 (1d10)`) is not kept                                                        |
| `every_hours`| `reduction_dice`                | positive integer                                                            | The reduction happens each so many hours (24); absent for a reduction that happens once                           |
| `repeat_save`| `reduction_dice`                | `true`                                                                      | The target repeats the saving throw each time, and the reduction happens only on a failure (death dog, otyugh)    |
| `until`      | both                            | `long_rest`, `greater_restoration`, `disease_cured`, `remove_curse`         | What ends the reduction                                                                                           |

`reduce_max_hp`: the wight's, wraith's and specter's Life Drain and the clay golem's Slam on a failed save, and the
succubus/incubus's Draining Kiss on damage, all by the damage taken (`long_rest`; the clay golem's lasts until
`greater_restoration`); the vampire's, vampire bat's and vampire spawn's Bite by the necrotic damage taken, with no
save.
`reduction_dice`: the death dog's and otyugh's Bite (`1d10` every 24 hours, repeating the save, until the disease is
cured), the giant diseased rat's Bite (`1d6` every 24 hours, until the disease is cured), the Rotting Fist of the mummy
and the mummy lord (`3d6` every 24 hours, until `remove_curse`) and the night hag's Nightmare Haunting (`1d10` once,
until `greater_restoration`).

## Damage resistances, immunities and vulnerabilities

The three lists of strings of a monster (`damage_vulnerabilities`, `damage_resistances`, `damage_immunities`) stay as
they are. Next to each, a monster has `vulnerabilities`, `resistances` and `immunities`: lists of rules, present on a
monster whose list gives at least one rule. A rule is `{ types, unless?, only_from? }`:

| Member      | Value                                          | Meaning                                                                                                                                            |
| ----------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types`     | indexes of the damage types, or `all`          | The damage types of the rule                                                                                                                       |
| `unless`    | `magical`, `silvered`, `adamantine`            | The rule does not cover damage from a weapon with any of these qualities. "Nonmagical weapons" is `["magical"]`, and "nonmagical weapons that aren't silvered" is `["magical", "silvered"]` |
| `only_from` | `spells`                                       | The rule covers only damage from spells (the archmage's resistance to "damage from spells" is `{ types: ["all"], only_from: "spells" }`)          |

The plain damage types of a list are together in the first rule, `{ types: ["cold", "fire"] }`, in the order of the list;
each entry with a condition follows as a rule of its own, in the order of the list. For example, the lich's
`damage_immunities` of `["poison", "bludgeoning, piercing, and slashing from nonmagical weapons"]` are

```json
[{ "types": ["poison"] }, { "types": ["bludgeoning", "piercing", "slashing"], "unless": ["magical"] }]
```

| List                    | Entries | Monsters | Rules | Rules with a condition                                                                       |
| ----------------------- | ------- | -------- | ----- | -------------------------------------------------------------------------------------------- |
| `damage_vulnerabilities`| 16      | 14       | 14    | 0                                                                                            |
| `damage_resistances`    | 169     | 70       | 102   | 44: 29 `magical`, 12 `magical` and `silvered`, 2 `magical` and `adamantine`, 1 `only_from`   |
| `damage_immunities`     | 188     | 136      | 146   | 26: 7 `magical`, 15 `magical` and `silvered`, 4 `magical` and `adamantine`                   |

Two entries have a condition outside this vocabulary and have no rule: they stay in the string list only. They are the
archmage's resistance to "bludgeoning, piercing, and slashing from nonmagical attacks (from stoneskin)" (a resistance
that a spell gives) and the rakshasa's vulnerability to "piercing from magic weapons wielded by good creatures" (it
depends on the wielder, so `rakshasa` has immunities but no `vulnerabilities`).

The nightmare's Confer Fire Resistance is the one ability that states a resistance in its own text: "The nightmare can
grant resistance to fire damage to anyone riding it." It has `resistances: [{ "types": ["fire"] }]` and the trigger
`while_ridden`; the nightmare's own damage lists are unchanged.

## Not structured

The audit in `src/2014/tests/monster-effects.test.ts` searches the text of every trait, action, legendary action and
reaction for the ways the text changes hit points or states a resistance, a hit point maximum or a detaching. An
ability that matches and has no field must be in the list there, with its reason; a stale entry fails the test. The 53
abilities left out are:

| Reason | Abilities |
| ------ | --------- |
| A healing action: it restores hit points when used, and is neither a recurring rule nor a reduction | Healing Touch (deva, planetar, solar, unicorn), the unicorn's Heal Self |
| The monster regains hit points equal to damage it deals or to a creature's hit points | the aboleth's Psychic Drain, the will-o'-wisp's Consume Life |
| Damage of one type heals the monster by the damage dealt (a conversion of damage, not regeneration) | Acid Absorption (clay golem), Lightning Absorption (flesh golem, shambling mound), Fire Absorption (iron golem) |
| The monster returns to life and regains all its hit points days after it dies | Rejuvenation (guardian naga, spirit naga) |
| A rule that stops hit points being regained ("can't regain hit points") | Swarm (the ten swarms), the bearded devil's Beard, the pit fiend's Bite, the aboleth's Tentacle, the mummy lord's Channel Negative Energy |
| A vampire at 0 hit points turns to mist and later regains 1 hit point: a sequence of states | Misty Escape (the vampire, vampire bat, vampire mist) |
| Heads die at 25 damage in a turn and regrow at the end of the next, with 10 hit points for each head: it needs the count of heads | the hydra's Multiple Heads |
| An infernal wound that costs hit points at the start of each turn and grows with each hit | the Glaive of the bearded devil and the Tail of the horned devil |
| A threshold of hit points that starts a behavior | Berserk (clay golem, flesh golem), Split (black pudding, ochre jelly), the solar's Slaying Longbow |
| The monster is reduced to 1 hit point instead of 0 (Relentless has `relentless_max_damage`; Undead Fortitude has a save) | Relentless (boar, giant boar, the three wereboars), Undead Fortitude (zombie, ogre zombie) |
| The monster detaches by choice or by a check, with no limit on the damage it deals | the cloaker's Bite, the darkmantle's Crush |
| Resistance, immunity or vulnerability of an object the ability makes or animates, not of the monster | the chain devil's Animate Chains, the Web of the ettercap and giant spider, the ice devil's Wall of Ice, the roper's Grasping Tendrils |
| Immunity to all damage for the length of a form, with immunities to conditions | the mummy lord's Whirlwind of Sand |

The test also lists the six structured abilities that state a mechanic with no field of its own: the vampire's, vampire
bat's and vampire spawn's Bite (the vampire regains hit points equal to the reduction) and the Rotting Fist of the mummy
and the mummy lord and the giant diseased rat's Bite ("can't regain hit points"). The two damage-list entries with no
rule are above.
