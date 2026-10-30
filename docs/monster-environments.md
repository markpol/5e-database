# Monster environment tags

`src/2014/en/5e-SRD-Monsters.json` gives every monster an `environments` text (for example `"Desert, Mountain"`) and, as
a second field, `environment_tags`: the same habitats as a list (`["Desert", "Mountain"]`). The text is unchanged; the
list is added beside it and is marked `dd` in `src/provenance/source-markers.json`.

## The vocabulary

Each tag is one of 11 terms: `Arctic`, `Coastal`, `Desert`, `Forest`, `Grassland`, `Hill`, `Mountain`, `Swamp`,
`Underdark`, `Underwater`, `Urban`. The schema types the list as an array of that enum (`ENVIRONMENT_TAGS` in
`src/schemas/common.ts`), so the generated JSON Schema and types name the terms. The list has at least one tag, no tag
twice, and keeps the order of the text.

## Derivation

`src/2014/derive-monster-environments.ts` (`pnpm run derive:environments`) splits `environments` at the commas and
writes the result to `environment_tags`. It throws on a term outside the vocabulary or a repeated term, so a new
habitat is added to the vocabulary on purpose. A monster without `environments` gets no tags. Edit the text, then run
the command; do not edit the list by hand. The normalizer copies the list into
`src/2014/5e-SRD-Monsters-Normalized.json` (`pnpm normalize:monsters`).

## Audit

`src/2014/tests/monster-environments.test.ts` checks that the terms of the list joined with `, ` equal the text for
every monster, that the tags are known and not repeated, that the committed file is what the derivation writes and that
the normalized monsters carry the same list.

All 331 monsters have `environment_tags`. The list is not translatable; the overlays do not hold it.
