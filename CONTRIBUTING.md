# Contributing to 5e-database

This repository holds the game data as JSON. Changes are made by editing those files and the schemas that describe
them. There is nothing to build or deploy.

## Workflow

1. Fork the repository and create a branch.
2. Make your change, then run `pnpm test` and `pnpm lint`.
3. Open a pull request against `main`. Incomplete work is fine; say what is left.

Use [Conventional Commits](https://www.conventionalcommits.org/) for commit and PR titles, for example
`fix(monsters): correct goblin hit points` or `feat(spells): add concentration field`. Mark breaking data or schema
changes with a `BREAKING CHANGE:` footer. They keep the history readable when a release is cut (see
[Cutting a release](#cutting-a-release)).

## Where things live

| Path                                        | Contents                                            |
| ------------------------------------------- | --------------------------------------------------- |
| `src/{year}/en/5e-SRD-{Collection}.json`    | English source data for a collection                |
| `src/{year}/schemas/5e-SRD-{Collection}.ts` | Zod schema for that collection                      |
| `src/{year}/tests/`                         | Tests that run the schemas and checks over the data |
| `src/{year}/{locale}/`                      | Translation overlays (not published)                |
| `src/2014/5e-SRD-Monsters-Normalized.json`  | Generated; do not edit by hand                      |
| `src/provenance/source-markers.json`        | Source of each data file and its non-SRD fields     |
| `schema/`, `types/`, `ids/`                 | Generated JSON Schema, `.d.ts` and id lists; do not edit |
| `scripts/package-exports.ts`                | The `exports` map of `package.json` (`pnpm run exports:write`) |

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
`import conditions from '@markpol/dd-srd/ids/conditions.json' with { type: 'json' }` and compare `conditions.indices`.

## Package entries

The package is `@markpol/dd-srd` (the GitHub repository keeps the name `5e-database`, so existing git install URLs
and lockfile entries still resolve). `package.json` has an `exports` map with a typed entry per 2014 collection,
named like its `ids/` file. Each entry is the English data, typed by the generated `types/` file:

```ts
import monsters from '@markpol/dd-srd/monsters'; // Monster[]
import damageTypes from '@markpol/dd-srd/damage-types'; // DamageType[]
import normalizedMonsters from '@markpol/dd-srd/monsters-normalized'; // NormalizedMonster[]
```

The entries resolve with bundler-style module resolution (`"moduleResolution": "Bundler"`). The deep paths used before
the map keep working for one major version: `src/2014/en/*.json`, `src/2014/5e-SRD-Monsters-Normalized.json`,
`src/provenance/source-markers.json`, `src/i18n/localize`, `schema/*.json`, `ids/*.json` and `types/*`. Translation
overlay folders have no entry and are not published: they stay in the repository, pending a provenance check of
the translated text.

After adding a collection, run `pnpm run generate` (which also emits the entry's typed default export) and
`pnpm run exports:write`; a test fails when the map is stale. `pnpm run test:package` (a CI job on Node 22 and 24)
packs the package, installs the tarball into a temporary project, imports every entry and several old deep paths, and
type-checks them with `tsc`.

## Id stability contract

A published id (a collection's `index`) is never renamed or removed by default: saves and backend documents store ids
directly, and a missing one can only be hidden. If a change is unavoidable, record it instead of letting the id vanish
(decision D7): keep the old id as an alias where one fits, let the app's save-upgrade step migrate it, and add a
tombstone to `ids/removed.json`.

- `ids/published.json` is `{ "collections": { "<collection>": ["<index>", ...] } }`: every id ever published, sorted.
  It started as upstream `5e-bits/5e-database` release **v5.12.0**, the last release this fork took, and only grows;
  `pnpm run generate` adds new ids and never drops one, and `generate:check` fails if it is behind the data.
- `ids/removed.json` is `{ "removed": [ ... ] }`, hand-written (the generator leaves it alone). Each tombstone is
  `{ "collection", "index", "removedIn", "reason", "replacement"? }`: `removedIn` is the release or commit that removed
  the id, `reason` says why, and the optional `replacement` is an id in the same collection that stands in for it.
- `src/2014/tests/id-stability.test.ts` fails if a published id is neither in the data nor tombstoned, if a tombstone
  names an id that was never published or exists again (delete it when you restore an id), or if its `replacement`
  does not exist.

To remove an id on purpose, delete it from the data, add its tombstone to `ids/removed.json`, run
`pnpm run generate` and `pnpm test`. The 52 ids removed before the contract existed (40 equipment, 6 equipment
categories, 3 monsters, 3 proficiencies, all in commit `0c4e837`) are tombstoned; the 80 magic items removed and later
restored are still in the data and need none.

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
3. If the field holds text that translators should be able to overlay (prose or a display label), wrap it in
   `translatable()` from `src/schemas/common.ts`, for example `desc: translatable(z.array(z.string()))`, and run
   `pnpm run generate`. Leave structural fields (ids, urls, numbers, booleans, dice, references) unmarked; they are
   never translated. See [Translations](#translations).
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

Translations are overlays on the English data. They need only a text editor and a fork. The rules below are for the
2014 data; `src/2024` is frozen.

The overlay folders stay in the repository, but they are not published in the package (`files` in `package.json` lists
only English data), pending a provenance check of the translated text.

### File location

```
src/2014/{lang}/5e-SRD-{Collection}.json
```

`{lang}` is a [BCP 47](https://www.rfc-editor.org/rfc/rfc5646) language tag, for example `de`, `fr-FR`, `pt-BR`,
`es-419` or `zh-Hans`. The file name must match an English file in `src/2014/en/`.

```
src/2014/de/5e-SRD-Spells.json
src/2014/pt-BR/5e-SRD-Conditions.json
```

### File format

A translation file is a JSON array. Each entry has an `index` that identifies the English record, plus only the
translatable text you are translating.

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

### Text-only fields

An overlay may contain only translatable fields. They are marked in the Zod schemas with `translatable()` and appear
as `"translatable": true` in `schema/5e-SRD-{Collection}.schema.json`, which is where to look them up. They are prose
and display labels such as `name`, `desc`, `higher_level`, `range`, `duration`, `subclass_flavor` and the `desc` of a
choice.

Everything else comes from English and cannot be overridden: `index` values, `url`, numbers, booleans, dice and other
structural fields. Leave them out; the tests reject them.

Never copy a reference object (`{ "index", "name", "url" }`) into an overlay. A reference's `name` is taken from the
translation of the record it points at, so a spell's `school.name` shows the translated `name` of that magic school.
To translate the name shown in references, translate the referenced record's `name`. Where the referenced record has
no translation, the English name is shown.

Text nested in objects and arrays keeps the English nesting, so it lands on the same element. Give only the text
leaves; put `null` at an array position you leave untranslated, and end the array after the last translated
position:

```json
{
  "index": "barbarian",
  "starting_equipment_options": [
    {
      "desc": "(a) une hache à deux mains ou (b) une arme de guerre de corps à corps au choix",
      "from": { "options": [null, { "choice": { "desc": "n'importe quelle arme de guerre de corps à corps" } }] }
    }
  ]
}
```

### Partial overlays

You do not have to translate every entry or every field. Anything missing from the overlay falls back to the English
value, field by field and array position by array position. A file with a handful of entries is a useful
contribution. An entry must translate at least one field.

### Reading translated data: `localize()`

`localize(collection, lang)` returns every English record of a collection with the `lang` overlay merged in, typed
with the collection's generated type. `src/i18n/localize.ts` ships in the package and has no runtime dependencies:
`createLocalizer` takes the English records, overlays and JSON Schemas from the caller, for example as static JSON
imports.

```ts
import { createLocalizer, type DataRecord, type JsonSchema } from '@markpol/dd-srd/src/i18n/localize';
import enSpells from '@markpol/dd-srd/spells';
import spellSchema from '@markpol/dd-srd/schema/5e-SRD-Spells.schema.json';
// Overlays are not published in the package: the caller brings its own overlay files.
import frSpells from './overlays/fr-FR/5e-SRD-Spells.json';
import frSchools from './overlays/fr-FR/5e-SRD-Magic-Schools.json';
import frClasses from './overlays/fr-FR/5e-SRD-Classes.json';

const english: Record<string, DataRecord[]> = { spells: enSpells };
const schemas: Record<string, JsonSchema> = { spells: spellSchema };
const overlays: Record<string, Record<string, DataRecord[]>> = {
  'fr-FR': { spells: frSpells, 'magic-schools': frSchools, classes: frClasses },
};

const localize = createLocalizer({
  english: (collection) => english[collection],
  overlay: (collection, lang) => overlays[lang]?.[collection],
  schema: (collection) => schemas[collection],
});

const spells = localize('spells', 'fr-FR'); // Spell[], with French text and French school and class names
```

`english` and `schema` are read for the collection being localized; `overlay` is also read for the collections its
references point at, to resolve their names. A missing overlay, including a locale whose folder is absent because overlays are not published, falls back to English:
`localize()` then returns the English records unchanged.

Inside this repository (Node), `src/i18n/files.ts` exports a `localize` already bound to the files here.

### What the tests check

`translations.test.ts` fails if a translation file:

- has no matching English file,
- contains an `index` that is not in the English file, or contains duplicate `index` values,
- contains a field that is not in the English entry, is not translatable, is a reference object, has more array
  entries than English, or has the wrong type (`src/i18n/overlays.ts`), or
- produces an invalid document when localized (checked with the collection's Zod schema).

`src/i18n/tests/overlay-migration.test.ts` pins the one-shot migration that reduced the overlays to text (#31): a
record whose English data and overlay inputs are unchanged since then must localize to the same text as before, apart
from the reference names listed in `src/i18n/tests/fixtures/overlay-migration.json`. Editing a translation does not
break it; it skips records whose inputs changed.

Run `pnpm test` before opening a PR.

### Coverage report

`pnpm run i18n:coverage` prints, per locale and collection, how many English records an overlay covers and how many
translatable fields it translates. CI prints the same report in the "Translation coverage" job log and summary. It is
informational and never fails a build.

## Cutting a release

Releases are cut by the `Release` workflow (`.github/workflows/release.yml`). Semantic Release and release-please are
gone and `CHANGELOG.md` is no longer generated; upstream's history is kept in
[docs/upstream-changelog.md](docs/upstream-changelog.md) and is not updated. The release notes are generated by GitHub
from the merged PRs since the previous tag.

1. Confirm `main` is green in CI.
2. Choose the version following semver: a patch for data fixes, a minor for new fields or collections that do not break
   consumers, and a major for removed or changed fields.
3. In Actions, open **Release**, choose **Run workflow** on `main`, enter the version as `X.Y.Z` (no `v`), and leave
   **dry_run** ticked. A dry run checks the version and runs lint, tests, `generate:check` and the pack smoke test, then
   prints what a real run would do. It commits, tags and releases nothing.
4. Run it again with **dry_run** unticked. The workflow repeats the checks, sets `version` in `package.json`, commits
   `chore(release): vX.Y.Z` straight to `main`, tags that commit `vX.Y.Z`, pushes both, and creates the GitHub release
   with generated notes.

The workflow refuses to run from any branch but `main`, and the version must be a plain `X.Y.Z` greater than both the
`package.json` version and the latest `v*` tag. The release commit is pushed with the built-in `GITHUB_TOKEN`, so CI
does not run on it; the checks already ran inside the workflow.

### Installing a release

A consumer installs a release from git, using a semver range over the `v*` tags:

```sh
pnpm add github:markpol/5e-database#semver:^6.0.0
```

The lockfile records the resolved 40-character commit of the tag, so installs are reproducible.
