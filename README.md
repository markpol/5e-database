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
    {locale}/                        Translation overlays (for example fr-FR, pt-BR, ru)
    schemas/                         One Zod schema per collection
    tests/                           Schema, duplicate-index, table and translation tests
    5e-SRD-Monsters-Normalized.json  Generated from en/5e-SRD-Monsters.json
    normalize-monsters.ts            Generator for the file above
    monster-engine-annotations.json  Engine-only monster annotations merged in by the generator
  2024/                              Same layout for the 2024 SRD (no normalized monsters)
  i18n/                              Locale pattern and translation helpers
  provenance/                        SRD baseline and source markers for engine-authored data (see NOTICE.md)
  schemas/common.ts                  Schema pieces shared by both years
  tests/translationTestUtils.ts      Shared translation test suite
docs/
  game-engine-changes.md             What this fork changes relative to upstream, and why
  upstream-changelog.md              Upstream's release history, kept for reference and no longer generated
```

## Setup

You need Node 22 or 24 (see `.nvmrc`) and [pnpm](https://pnpm.io/).

```sh
pnpm install
pnpm test       # schema, uniqueness, table and translation checks
pnpm lint       # ESLint, including JSON and Prettier rules
```

CI (`.github/workflows/ci.yml`) runs `pnpm lint` and `pnpm test` on every pull request and on pushes to `main`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to change data, add a field, add a translation and cut a release.
Game data problems can be reported with the "Game data issue" issue template.

## Licence

This project is licensed under the terms of the MIT licence. See [LICENSE.md](LICENSE.md). The game content comes
from the SRD 5.1 (2014 data) and SRD 5.2 (2024 data) under CC-BY-4.0; [NOTICE.md](NOTICE.md) has the attribution and
lists the data written for the game engine rather than taken from the SRD.
