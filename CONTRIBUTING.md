# Contributing to 5e-database

This repository holds the game data as JSON. Changes are made by editing those files and the schemas that describe
them. There is nothing to build or deploy.

## Workflow

1. Fork the repository and create a branch.
2. Make your change, then run `pnpm test` and `pnpm lint`.
3. Open a pull request against `main`. Incomplete work is fine; say what is left.

Use [Conventional Commits](https://www.conventionalcommits.org/) for commit and PR titles, for example
`fix(monsters): correct goblin hit points` or `feat(spells): add concentration field`. Mark breaking data or schema
changes with a `BREAKING CHANGE:` footer. These messages are what a release summary is written from (see
[Cutting a release](#cutting-a-release)).

## Where things live

| Path                                        | Contents                                            |
| ------------------------------------------- | --------------------------------------------------- |
| `src/{year}/en/5e-SRD-{Collection}.json`    | English source data for a collection                |
| `src/{year}/schemas/5e-SRD-{Collection}.ts` | Zod schema for that collection                      |
| `src/{year}/tests/`                         | Tests that run the schemas and checks over the data |
| `src/{year}/{locale}/`                      | Translation overlays                                |
| `src/2014/5e-SRD-Monsters-Normalized.json`  | Generated; do not edit by hand                      |
| `src/provenance/source-markers.json`        | Source of each data file and its non-SRD fields     |
| `schema/`, `types/`, `ids/`                 | Generated JSON Schema, `.d.ts` and id lists; do not edit |

`{year}` is `2014` or `2024`. `src/2024` is dormant and frozen: changes to it are not accepted except bug fixes to the
data itself.

## How the schema gates work

`pnpm test` (run by CI on every PR) is the gate. A change cannot merge if any of these fail:

- **Schema validation** (`src/{year}/tests/schemas.test.ts`). Every entry in every English file is parsed with its
  collection's Zod schema. The schemas are `z.strictObject`, so an unknown field fails the test just as a wrong type
  or a missing required field does.
- **Unique indices** (`tables.test.ts`). Every `index` must be unique within its file.
- **Reference checks** (`tables.test.ts`). Every `url` reference must resolve by (collection, index) to an existing
  entry, and the reference's `url`, `name` and `index` must match that entry. Every monster `weapon` and
  `supply.item` must be an equipment index (three ammunition supplies without equipment entries are allowed), and every
  condition id in a monster's `situation` and `bonus_action` must exist in conditions.
- **Translation checks** (`translations.test.ts`). See [Translations](#translations).
- **Source markers** (`src/provenance/source-markers.test.ts`). Every field and entry in a data file must either be
  in the upstream SRD data (`src/provenance/srd-baseline.json`) or be marked in `src/provenance/source-markers.json`.
  See [NOTICE.md](NOTICE.md).
- **Monster extras** (2014 only). `normalized-monsters.test.ts` regenerates the normalized file from the English
  monsters and requires it to match the committed file exactly; `monster-weapons.test.ts` checks the weapon
  annotations against the equipment data.

`pnpm lint` runs ESLint over the repo (JSON files included) and must also pass.

## Changing English data

Edit the entry in `src/{year}/en/5e-SRD-{Collection}.json` and run `pnpm test`. If you change a 2014 monster, also
regenerate the normalized file with `pnpm normalize:monsters` (below).

## Generated id lists

`ids/<collection>.json` lists the ids (`index` values) of each 2014 English collection, so the game's parity tests can
check their own registries against the data. Each file is `{ "collection": "conditions", "indices": ["blinded", ...] }`
with the indices sorted. They are produced by `pnpm run generate` together with `schema/` and `types/` and checked by
the same `generate:check` job; they ship in the npm package, so a consumer can
`import conditions from '5e-database/ids/conditions.json' with { type: 'json' }` and compare `conditions.indices`.

## Generated schema and types

`schema/*.schema.json` (JSON Schema) and `types/*.d.ts` (from `z.infer`) are generated from the Zod schemas, which stay
the source of truth. After changing a schema, run `pnpm run generate` and commit the result; CI runs
`pnpm run generate:check` and fails if any generated file is stale. The recursive `ChoiceSchema` is typed `any`, so
fields that use it are `any` in the emitted types (its JSON Schema is complete).

## Adding a field

Because the schemas are strict, a new field is added in the schema and the data together.

1. Add the field to the collection's schema in `src/{year}/schemas/5e-SRD-{Collection}.ts`. Make it `.optional()` if
   not every entry will have it. Reuse the pieces in `src/schemas/common.ts` where one fits.
2. Add the field to the entries in `src/{year}/en/5e-SRD-{Collection}.json`.
3. If the field holds text that translators should be able to overlay, nothing more is needed: translations may use
   any field that exists in the English entry. If it is structural (an id, a number, a reference), it is never
   translated.
4. If you changed `src/2014/en/5e-SRD-Monsters.json` or `src/2014/monster-engine-annotations.json`, regenerate the
   committed `src/2014/5e-SRD-Monsters-Normalized.json` with `pnpm normalize:monsters`. The normalized file is the
   generated monster source the game reads; never edit it by hand. `normalized-monsters.test.ts` fails if the
   committed file is stale and shows the expected differences, and `schemas.test.ts` validates it against
   `src/2014/schemas/5e-SRD-Monsters-Normalized.ts`, so a shape change goes in that schema too. Engine-only monster
   data goes in `src/2014/monster-engine-annotations.json`, not in the English file.
5. Mark the field in `src/provenance/source-markers.json` under its file's `fields`, with `"source": "dd"` and a
   `note` saying what it holds. A new entry (for example a condition the SRD does not have) goes under `records`,
   keyed by its `index`. A new data file needs its own entry. Update the table in [NOTICE.md](NOTICE.md) to match.
6. Run `pnpm test` and `pnpm lint`.
7. Describe the field in the PR. If it changes the shape that the game reads, use a `feat` type and add a
   `BREAKING CHANGE:` footer when existing consumers would break.

The changes this fork has already made relative to upstream are recorded in
[docs/game-engine-changes.md](docs/game-engine-changes.md).

## Translations

Translations are overlays on the English data. They need only a text editor and a fork.

### File location

```
src/{year}/{lang}/5e-SRD-{Collection}.json
```

`{lang}` is a [BCP 47](https://www.rfc-editor.org/rfc/rfc5646) language tag, for example `de`, `fr`, `pt-BR`,
`es-419` or `zh-Hans`. The file name must match an English file.

```
src/2014/de/5e-SRD-Spells.json
src/2024/fr/5e-SRD-Equipment.json
src/2024/pt-BR/5e-SRD-Conditions.json
```

### File format

A translation file is a JSON array. Each entry has an `index` that identifies the English record, plus only the fields
you are translating.

```json
[
  {
    "index": "acid-arrow",
    "name": "Säurepfeil",
    "desc": ["Ein glitzernder grüner Pfeil schießt auf ein Ziel..."],
    "higher_level": [
      "Wenn du diesen Zauber mit einem Zauberplatz der 3. Stufe oder höher wirkst..."
    ]
  }
]
```

### Partial overlays

You do not have to translate every entry or every field. Anything missing from the overlay falls back to the English
value, field by field. A file with a handful of entries is a useful contribution.

### Text-only fields

Translate text only. Leave out `url`, numbers and reference objects. `index` is required so the entry can be matched,
but its value must be identical to the English `index`. Which text fields exist depends on the collection (for example
`name`, `desc`, `higher_level`, and `summary` on subclasses); any text field present in the English entry for that
`index` may be translated.

### What the tests check

`translations.test.ts` fails if a translation file:

- has no matching English file,
- contains an `index` that is not in the English file,
- contains a field that is not in the English entry for that `index`,
- contains duplicate `index` values, or
- produces an invalid document when merged over the English entry (checked with the collection's Zod schema).

Run `pnpm test` before opening a PR.

## Cutting a release

There is no release automation in this repository yet. Semantic Release has been removed, and `CHANGELOG.md` is no
longer generated; upstream's history is kept in [docs/upstream-changelog.md](docs/upstream-changelog.md) and is not
updated. A release workflow and any generated release files are planned. Until then, a release is made by hand:

1. Confirm `main` is green in CI.
2. Update `version` in `package.json` following semver: a patch for data fixes, a minor for new fields or collections
   that do not break consumers, and a major for removed or changed fields.
3. Commit the version change on a branch, open a PR and merge it.
4. Tag the merge commit (`git tag vX.Y.Z`) and push the tag.
5. Create a GitHub release for the tag, with notes written from the Conventional Commit messages since the last tag.

The game consumes this repository as a git dependency, so it picks up a release by updating its pinned ref.
