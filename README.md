# 5e-database

![CI](https://github.com/markpol/5e-database/actions/workflows/ci.yml/badge.svg?branch=main)

JSON game data for the D&D 5th Edition SRD, used by the Draconian Dungeons game. This is a fork of
[5e-bits/5e-database](https://github.com/5e-bits/5e-database). The data is edited as plain JSON files and checked
by Zod schemas and Vitest tests; there is no database or build step.

## Layout

```
src/
  2014/
    en/                              English source data, one 5e-SRD-{Collection}.json per collection
    {locale}/                        Translation overlays (fr-FR, pt-BR, ru); not published
    schemas/                         One Zod schema per collection
    tests/                           Schema, duplicate-index, table and translation tests
    5e-SRD-Monsters-Normalized.json  Generated from en/5e-SRD-Monsters.json
    normalize-monsters.ts            Generator for the file above (`pnpm normalize:monsters`)
    monster-engine-annotations.json  Monster annotations merged in by the generator
  2024/                              Same layout for the 2024 SRD (no normalized monsters)
  i18n/                              localize(), overlay validator and coverage report (see CONTRIBUTING.md)
  provenance/                        SRD baseline and source markers for data not taken from the SRD (see NOTICE.md)
  schemas/common.ts                  Schema pieces shared by both years
  tests/translationTestUtils.ts      Shared translation test suite
docs/
  game-engine-changes.md             What this fork changes relative to upstream, and why
  i18n-overlay-migration.md          What the move to text-only translation overlays (#31) changed
  upstream-changelog.md              Upstream's release history, kept for reference and no longer generated
schema/                              Generated JSON Schema, one per collection (see CONTRIBUTING.md)
ids/                                 Generated id lists, published ids and removed-id tombstones (see CONTRIBUTING.md)
types/                               Generated .d.ts types, one per collection (see CONTRIBUTING.md)
```

## Collections

Every collection is kept. Record counts come from the data files. Status means:

- **game data**: core data for the game.
- **extensible**: reference content that is kept and open to more entries and fields.
- **reference**: kept as SRD reference data.
- **dormant**: the 2024 data. The 2024 (SRD 5.2) set is frozen: it is kept as the in-repo source of more backgrounds
  and feats (three backgrounds and sixteen feats of it are now in the 2014 collections), is not reshaped, and is
  excluded from the published package. Its schema tests stay.

### 2014 SRD (`src/2014`)

| Collection            | File                                           | Records | Purpose                                                                                                           | Status          |
| --------------------- | ---------------------------------------------- | ------: | ----------------------------------------------------------------------------------------------------------------- | --------------- |
| Ability Scores | `src/2014/en/5e-SRD-Ability-Scores.json` | 6 | Core game data | game data |
| Alignments | `src/2014/en/5e-SRD-Alignments.json` | 9 | Core game data | game data |
| Backgrounds | `src/2014/en/5e-SRD-Backgrounds.json` | 6 | Extensible reference content: more entries and fields can be added | extensible |
| Classes | `src/2014/en/5e-SRD-Classes.json` | 12 | Core game data | game data |
| Conditions | `src/2014/en/5e-SRD-Conditions.json` | 47 | Core game data | game data |
| Damage Types | `src/2014/en/5e-SRD-Damage-Types.json` | 13 | Core game data | game data |
| Equipment Categories | `src/2014/en/5e-SRD-Equipment-Categories.json` | 33 | Core game data | game data |
| Equipment | `src/2014/en/5e-SRD-Equipment.json` | 197 | Core game data | game data |
| Feats | `src/2014/en/5e-SRD-Feats.json` | 17 | Extensible reference content: more entries and fields can be added | extensible |
| Features | `src/2014/en/5e-SRD-Features.json` | 407 | Core game data | game data |
| Languages | `src/2014/en/5e-SRD-Languages.json` | 16 | SRD reference data | reference |
| Levels | `src/2014/en/5e-SRD-Levels.json` | 290 | Core game data | game data |
| Magic Items | `src/2014/en/5e-SRD-Magic-Items.json` | 362 | Core game data | game data |
| Magic Schools | `src/2014/en/5e-SRD-Magic-Schools.json` | 8 | SRD reference data | reference |
| Monsters | `src/2014/en/5e-SRD-Monsters.json` | 331 | English monster data | game data |
| Monsters (normalized) | `src/2014/5e-SRD-Monsters-Normalized.json` | 331 | Generated from the English monsters and `monster-engine-annotations.json` by `pnpm normalize:monsters`, validated by `schemas/5e-SRD-Monsters-Normalized.ts` | game data |
| Proficiencies | `src/2014/en/5e-SRD-Proficiencies.json` | 114 | Core game data | game data |
| Races | `src/2014/en/5e-SRD-Races.json` | 9 | Core game data | game data |
| Rule Sections | `src/2014/en/5e-SRD-Rule-Sections.json` | 33 | Extensible reference content: more entries and fields can be added | extensible |
| Rules | `src/2014/en/5e-SRD-Rules.json` | 6 | Extensible reference content: more entries and fields can be added | extensible |
| Skills | `src/2014/en/5e-SRD-Skills.json` | 18 | Core game data | game data |
| Spells | `src/2014/en/5e-SRD-Spells.json` | 319 | Core game data | game data |
| Subclasses | `src/2014/en/5e-SRD-Subclasses.json` | 12 | SRD reference data | reference |
| Subraces | `src/2014/en/5e-SRD-Subraces.json` | 4 | SRD reference data | reference |
| Traits | `src/2014/en/5e-SRD-Traits.json` | 38 | Core game data | game data |
| Weapon Properties | `src/2014/en/5e-SRD-Weapon-Properties.json` | 11 | SRD reference data | reference |

### 2024 SRD (`src/2024/en`)

| Collection                | File                                                | Records | Purpose                                        | Status  |
| ------------------------- | --------------------------------------------------- | ------: | ---------------------------------------------- | ------- |
| Ability Scores            | `src/2024/en/5e-SRD-Ability-Scores.json`            |       6 | 2024 SRD 5.2 data | dormant |
| Alignments                | `src/2024/en/5e-SRD-Alignments.json`                |      10 | 2024 SRD 5.2 data | dormant |
| Backgrounds               | `src/2024/en/5e-SRD-Backgrounds.json`               |       4 | 2024 SRD 5.2 data | dormant |
| Classes                   | `src/2024/en/5e-SRD-Classes.json`                   |      12 | 2024 SRD 5.2 data | dormant |
| Conditions                | `src/2024/en/5e-SRD-Conditions.json`                |      15 | 2024 SRD 5.2 data | dormant |
| Damage Types              | `src/2024/en/5e-SRD-Damage-Types.json`              |      13 | 2024 SRD 5.2 data | dormant |
| Equipment Categories      | `src/2024/en/5e-SRD-Equipment-Categories.json`      |      30 | 2024 SRD 5.2 data | dormant |
| Equipment                 | `src/2024/en/5e-SRD-Equipment.json`                 |     182 | 2024 SRD 5.2 data | dormant |
| Feats                     | `src/2024/en/5e-SRD-Feats.json`                     |      17 | 2024 SRD 5.2 data | dormant |
| Features                  | `src/2024/en/5e-SRD-Features.json`                  |     232 | 2024 SRD 5.2 data | dormant |
| Languages                 | `src/2024/en/5e-SRD-Languages.json`                 |      19 | 2024 SRD 5.2 data | dormant |
| Levels                    | `src/2024/en/5e-SRD-Levels.json`                    |     287 | 2024 SRD 5.2 data | dormant |
| Magic Items               | `src/2024/en/5e-SRD-Magic-Items.json`               |     262 | 2024 SRD 5.2 data | dormant |
| Magic Schools             | `src/2024/en/5e-SRD-Magic-Schools.json`             |       8 | 2024 SRD 5.2 data | dormant |
| Monsters                  | `src/2024/en/5e-SRD-Monsters.json`                  |     341 | 2024 SRD 5.2 data | dormant |
| Poisons                   | `src/2024/en/5e-SRD-Poisons.json`                   |      14 | 2024 SRD 5.2 data | dormant |
| Proficiencies             | `src/2024/en/5e-SRD-Proficiencies.json`             |      74 | 2024 SRD 5.2 data | dormant |
| Skills                    | `src/2024/en/5e-SRD-Skills.json`                    |      18 | 2024 SRD 5.2 data | dormant |
| Species                   | `src/2024/en/5e-SRD-Species.json`                   |       9 | 2024 SRD 5.2 data | dormant |
| Spells                    | `src/2024/en/5e-SRD-Spells.json`                    |     339 | 2024 SRD 5.2 data | dormant |
| Subclasses                | `src/2024/en/5e-SRD-Subclasses.json`                |      12 | 2024 SRD 5.2 data | dormant |
| Subspecies                | `src/2024/en/5e-SRD-Subspecies.json`                |      24 | 2024 SRD 5.2 data | dormant |
| Traits                    | `src/2024/en/5e-SRD-Traits.json`                    |      67 | 2024 SRD 5.2 data | dormant |
| Weapon Mastery Properties | `src/2024/en/5e-SRD-Weapon-Mastery-Properties.json` |       8 | 2024 SRD 5.2 data | dormant |
| Weapon Properties         | `src/2024/en/5e-SRD-Weapon-Properties.json`         |      10 | 2024 SRD 5.2 data | dormant |

## Using the package

The npm package is named `@markpol/dd-srd`; the repository keeps the name `5e-database`. Every 2014 collection has a typed
entry:

```ts
import monsters from '@markpol/dd-srd/monsters'; // Monster[], types from types/5e-SRD-Monsters.d.ts
import spells from '@markpol/dd-srd/spells';
```

The older deep paths (`@markpol/dd-srd/src/2014/en/5e-SRD-Spells.json`, `.../schema/...`, `.../ids/...`) keep resolving
for one major version. The package contains the English data only; the translation overlays are in the repository but
not published, pending a provenance check. See [CONTRIBUTING.md](CONTRIBUTING.md#package-entries).

## Setup

You need Node 22 or 24 (see `.nvmrc`) and [pnpm](https://pnpm.io/).

```sh
pnpm install
pnpm test       # schema, uniqueness, table and translation checks
pnpm lint       # ESLint, including JSON and Prettier rules
```

CI (`.github/workflows/ci.yml`) runs `pnpm lint`, `pnpm test`, `tsc --noEmit`, a check that `schema/`, `types/` and `ids/`
are up to date with the Zod schemas and data, and a smoke test that packs the package and imports every entry from the
tarball, on Node 22 and 24 on every pull request and on pushes to `main`. It also
prints a per-locale translation coverage report (`pnpm run i18n:coverage`), which never fails the build.

## Id stability contract

A published id is never renamed or removed by default, because stored data may refer to ids directly. When a
removal is unavoidable it gets a tombstone in `ids/removed.json` (and an alias where one fits), and a test fails on any published id that is gone without one. Published ids are tracked from upstream release
v5.12.0 in `ids/published.json`; see [CONTRIBUTING.md](CONTRIBUTING.md#id-stability-contract).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to change data, add a field, add a translation and cut a release.
Game data problems can be reported with the "Game data issue" issue template.

## Licence

This project is licensed under the terms of the MIT licence. See [LICENSE.md](LICENSE.md). The game content comes
from the SRD 5.1 (2014 data) and SRD 5.2 (2024 data) under CC-BY-4.0; [NOTICE.md](NOTICE.md) has the attribution and
lists the data written for the game rather than taken from the SRD.
