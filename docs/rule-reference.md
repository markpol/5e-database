# Rules and rule sections as reference content

`src/2014/en/5e-SRD-Rules.json` (6 rules) and `src/2014/en/5e-SRD-Rule-Sections.json` (33 sections, about 190,000
characters of markdown) hold the SRD 5.1 rules text. This page describes the markdown the text is written in, and the
optional fields added so the text can be read as a manual: a reading `order`, a `summary`, `keywords`, and `related`
links between rule sections and from conditions. Every addition is optional, and no `index`, `name` or `desc` changed.

## The markdown subset

`desc` of a rule or a rule section is a string of markdown that uses a small subset. Nothing else appears in the text,
and `src/2014/tests/rule-reference.test.ts` fails if something else is added.

| Construct     | How it is written                                                                                                                                                                                         | Where it is used                                                                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Heading       | `#` to `#####`, one space, then the title, on a line of its own                                                                                                                                           | A rule starts with its name as `#`. A rule section starts with its name as `##` (`the-planes-of-existence` has a second `##`), and its subsections use `###` to `#####`. |
| Paragraph     | A line of text. Blocks are separated by a blank line; a heading or a table may follow the previous line directly. A single line break inside a paragraph (two cases) is a soft wrap and reads as a space. | Everywhere                                                                                                                                                               |
| Bold          | `**term**`                                                                                                                                                                                                | Defined terms, the names of sample poisons, and the lead words of a numbered step                                                                                        |
| Bold italic   | `***Name.***` at the start of a paragraph                                                                                                                                                                 | A run-in heading, such as `***Escaping a Grapple.***`, and the names of sample traps                                                                                     |
| Italic        | `*text*`                                                                                                                                                                                                  | Spell names (`*fireball*`), and labels in a table cell                                                                                                                   |
| Bullet list   | One item to a line, `- item`. No nesting, and an item never continues on another line.                                                                                                                    | Lists of abilities, proficiencies and options                                                                                                                            |
| Numbered list | One item to a line, `1.  item` (the number, a full stop and two spaces)                                                                                                                                   | The steps of combat and of an attack                                                                                                                                     |
| Table         | Rows of cells between pipes: a header row, a separator row made of dashes (`---`) and the body rows, all with the same number of cells. A cell is plain text, with italic at most.                        | Exchange rates, creature sizes, difficulty classes, random tables                                                                                                        |

The text has no block quotes, code, links, images, HTML, horizontal rules, nested lists or indented lines. A reader that
supports CommonMark with GitHub-style tables renders it as intended. A reader without table support can split a table
row on `|`.

## Fields

All the fields below are optional in the schema and present on every rule and every rule section. They are marked `dd`
in [src/provenance/source-markers.json](../src/provenance/source-markers.json), so the text written for this data can be
told from SRD text: the SRD text is `name` and `desc`, and the fields below are not.

| Field      | On                        | Meaning                                                                                                    | Translated |
| ---------- | ------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------- |
| `order`    | rules, rule sections      | Position in reading order, from 1. The six rules are 1 to 6 and the 33 sections 1 to 33 across all rules.  | no         |
| `summary`  | rules, rule sections      | One or two sentences that say what the entry covers. Original wording written for this data, not SRD text. | yes        |
| `keywords` | rules, rule sections      | Search terms in lower case, read from the headings and the bold terms                                      | no         |
| `related`  | rule sections, conditions | Links to rule sections: `[{ "collection": "rule-sections", "index": "making-an-attack" }]`                 | no         |

`summary` is the only new text. It is translatable (`"translatable": true` in the JSON Schema), and the translation
overlays do not have it yet, so the coverage report (`pnpm run i18n:coverage`) counts it as untranslated. `order`,
`keywords` and `related` are structural and English-only: an overlay cannot carry them. `keywords` come from English
headings and are not translated for the same reason.

### order

The rules follow the chapter order of the SRD 5.1: equipment, using ability scores, adventuring, combat, spellcasting,
and the appendix. The sections follow the `subsections` list of their rule, in the rule order, so a sort on `order`
gives the whole reading order and no section needs to know its rule. The values are positions: adding a section
renumbers the sections after it. The `index` of an entry is what stays fixed.

The `subsections` lists are the order the existing data gives. Three sections that SRD 5.1 prints outside its
adventuring chapter (`traps`, `diseases`, `madness`) stay where the data lists them, between `the-environment` and
`resting`.

### keywords

A deterministic reading of the text, in order of first appearance, without duplicates:

- The title of every heading of the section, and every bold term, including bold italic run-in headings.
- Lower case, with the full stop, colon or comma that ends a run-in heading removed.
- Terms of more than five words are left out, which drops the bold sentences of a numbered list.
- A few bold fragments that are not terms are left out by hand (`exclude_keywords` in
  [src/2014/rule-reference-annotations.json](../src/2014/rule-reference-annotations.json)).

The keywords of a rule are its name and the names of its subsections.

### related

`related` is a list of `{ collection, index }`. `collection` is always `rule-sections` for now and `index` names a
section that exists; a section never links to itself, and the links are in reading order. 19 conditions (13, and the
six numbered exhaustion conditions) have 39 links in all, and 30 of the 33 sections have 53 links in all.

On a condition, a link is derived from the text of the sections, then added to by hand:

1. A section is linked when it names the condition (a whole word, any case) at least three times, or in a heading.
   `Grappled` links to `making-an-attack`, which has the grappling rules, and `Prone` to `movement-and-position`,
   which has Being Prone.
2. Links for the obvious cases that the text does not show are listed by hand, with a phrase of the target section that
   justifies each. `Blinded` and `Invisible` link to the rules for unseen attackers and for vision and light, and
   `Concentrating` to the concentration rules of `casting-a-spell`.
3. The numbered conditions `exhaustion-1` to `exhaustion-6` link to the same sections as `exhaustion`.

On a rule section, a link is derived when its text quotes the title of a heading in exactly one other section, as the
combat order does with the "Actions in Combat" section, or when it is listed by hand in the same file.

The conditions that SRD 5.1 does not have (the states written for the game) are matched by name in the same way and
have a link only when a section names them.

The rules and their derivation are in `src/2014/derive-rule-reference.ts`. `pnpm run derive:rules` rewrites the fields
in the three data files; it reads the hand-written parts from
[src/2014/rule-reference-annotations.json](../src/2014/rule-reference-annotations.json) (the order of the rules, the
summaries, the keywords to leave out and the curated links).
`src/2014/tests/rule-reference.test.ts` checks the result without sharing code with the derivation: the markdown
subset, the order, the keywords against the headings and bold terms, that every link resolves, points at no section
itself, and has a reason (a mention, a quote or a curated entry whose phrase is in the target), and that no summary
repeats six words of its text.

### Limits of the links

- A link says that a section names or gives the rules for a condition. It does not say that the section defines it.
  `Poisoned` links to `traps` because the trap text names the condition three times, and `Unconscious` to `poisons`
  because sample poisons cause it.
- Name matching is on the English text. A condition whose name is a common word is the likeliest to be missed or to
  match by accident (`Invisible` is a plain adjective in the text), which is why those links are checked by hand.
- A link points at a section, never at a heading inside it. The phrase a curated link gives shows where in the section
  to look.
- The links are one-way: a section does not list the conditions that point at it. Only conditions and rule sections have
  links so far; spells, equipment and magic items do not.
- Only the 33 sections are linked to. Pointers to the six rules, or from rules, are not present.

## Translation overlays

The overlays are unchanged. `src/2014/fr-FR` translates the `name` and `desc` of all 33 sections and 6 rules, and
`src/2014/pt-BR` the `name` and `desc` of the 6 rules and the `name` of the 33 sections. None of them carries a
`summary`, so a localized entry falls back to the English summary; a translator adds `summary` to an overlay entry like
any other translatable field.
