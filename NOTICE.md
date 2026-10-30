# Notice

The code and data layout in this repository are under the MIT licence in [LICENSE.md](LICENSE.md). The game content
in the data files comes from the Dungeons & Dragons System Reference Documents, which Wizards of the Coast publishes
under the [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/legalcode)
(CC-BY-4.0). This file carries the attribution that licence requires and says which data is SRD material and which
was written for the Draconian Dungeons game.

This notice has not had a legal review.

## SRD attribution

### 2014 data: SRD 5.1

This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of
the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The
SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at
https://creativecommons.org/licenses/by/4.0/legalcode.

Source of the wording: the "Legal Information" section on page 1 of the SRD 5.1 PDF,
https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf.

### 2024 data: SRD 5.2

This work includes material from the System Reference Document 5.2 (“SRD 5.2”) by Wizards of the Coast
LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons
Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

Source of the wording: the "Legal Information" section on page 1 of the SRD 5.2 PDF,
https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.pdf. The SRD page at https://www.dndbeyond.com/srd
also lists SRD 5.2.1, whose PDF carries the same statement with "5.2.1" in place of "5.2". If the 2024 data is checked
against SRD 5.2.1, use that statement instead.

### French translation overlay (fr-FR): French SRD 5.1

The French overlay in `src/2014/fr-FR/` includes text from the French edition of the SRD 5.1. It is in the
repository but not published in the package.

Ce travail comprend la documentation tirée du Document de Référence du Système 5.1 (« SRD 5.1 ») par
Wizards of the Coast LLC et disponible à l'adresse https://dnd.wizards.com/fr/resources/systems-reference-document.
Le SRD 5.1 est distribué en vertu de la licence Creative Commons Attribution 4.0 International disponible à
l'adresse https://creativecommons.org/licenses/by/4.0/legalcode.fr.

Source of the wording: the "Informations juridiques" section on page 1 of the French SRD 5.1 PDF,
https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1_FR.pdf, listed under "Localized SRD Downloads"
on https://www.dndbeyond.com/srd.

## Changes to the SRD material

The SRD text has been converted to JSON and changed: values have been restructured and reformatted (for example,
monster speeds and senses are stored as numbers of feet), some entries have been removed, and fields and entries
written for the game have been added. [docs/game-engine-changes.md](docs/game-engine-changes.md) describes
these changes.

## Which data comes from the SRD

| Data | Source |
| --- | --- |
| `src/2014/en/*.json` | SRD 5.1, plus the game-specific fields and entries listed below |
| `src/2014/5e-SRD-Monsters-Normalized.json` | Generated from `src/2014/en/5e-SRD-Monsters.json` and `src/2014/monster-engine-annotations.json` |
| `src/2014/monster-engine-annotations.json` | Written for the game |
| `src/2024/en/*.json` | SRD 5.2 |
| `src/{year}/{locale}/*.json` | Translations of the English SRD text for that year; in the repository, not published in the package, pending a provenance check |

## Data written for the game

[src/provenance/source-markers.json](src/provenance/source-markers.json) is the full list. It gives every data file a
`source` of `srd` (SRD 5.1), `srd-5.2` (SRD 5.2) or `dd` (written for Draconian Dungeons), and marks each field and
entry in an SRD file that is `dd`. A marked field covers everything nested under it. At the time of writing these are
marked `dd`:

| File | Fields and entries written for the game |
| --- | --- |
| `src/2014/en/5e-SRD-Monsters.json` | `environments`, `bonus_actions`, `senses.blindsight_blind_beyond`, `senses.blindsight_deafened`; on actions `attack_type`, `weapon`, `weapon_kind`, `supply` (its `count` is a chosen default), `condition`, `damage[].condition`, `damage[].grapple`, `options.from.options[].condition`, `preference`, `situation`; on special abilities `bonus_action`, `damage[].condition`, `damage[].dc`, `relentless_max_damage` |
| `src/2014/en/5e-SRD-Magic-Items.json` | `cost`, `weight`, `effect`, `enchantment`, `is_consumable`, `requires_attunement` |
| `src/2014/en/5e-SRD-Equipment.json` | `ammunition`, `effect`, `is_consumable`, `material`, `stackable` |
| `src/2014/en/5e-SRD-Conditions.json` | Entries `exhaustion-1` to `exhaustion-6`, `enraged`, `frenzied`, `reckless`, `dodging`, `infested`, `swallowed`, `drained-of-strength`, `weakened`, `slowed`, `drained-of-life`, `disengaged`, `surprised` |
| `src/2014/5e-SRD-Monsters-Normalized.json` | The fields above, plus `condition` on `actions[].attacks[]`, `legendary_actions[]`, `reactions[]` and `special_abilities[]`, `actions[].damage[].condition.on_failed_repeat_save` and `actions[].pull_distance_ft`, merged in from the annotations file |
| `src/2014/monster-engine-annotations.json` | The whole file |

Many of these fields restate a rule from the SRD prose next to them in structured form. Monster `environments`
and magic-item `cost` and `weight` are not SRD 5.1 text, and their origin has not been verified.

An SRD field is one that the upstream [5e-bits/5e-database](https://github.com/5e-bits/5e-database) data had at
commit `bce51b3`, recorded in [src/provenance/srd-baseline.json](src/provenance/srd-baseline.json).
`src/provenance/source-markers.test.ts` fails if a data file has a field or entry that is in neither the baseline nor
the markers.
