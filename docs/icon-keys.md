# Icon keys

The spells, the class features and the classes each have an `icon`: a string key that names an icon for the record. It
is optional in the schema, never translated and marked `dd` in `src/provenance/source-markers.json`. The key names an
icon; the data holds no image.

| Collection             | Key                                                               | Unique |
| ---------------------- | ----------------------------------------------------------------- | ------ |
| `5e-SRD-Spells.json`   | Artwork id such as `01-54`                                        | yes    |
| `5e-SRD-Features.json` | Artwork id such as `06-26`, `skl-blue-34`, `loot-mi_03`, `sgi-03` | no     |
| `5e-SRD-Classes.json`  | Glyph name such as `axe`, `music`, `book-open-variant`            | yes    |

A key is lower-case letters and digits with `-` or `_` between them. A spell and a class each get a key of their own, so
the keys of those two collections are unique within the collection. Several class features may share a key, because
some features use the same picture.

## Where the keys come from

`src/2014/icon-annotations.json` lists `{ collection, index, icon }` for every record: 319 spells, 407 class features
and 12 classes. The spell and feature keys are the artwork ids the pictures are already filed under; the class keys are
the names of the glyph that stands for each class. `src/2014/derive-icons.ts` (`pnpm run derive:icons`) writes the key
into each record.

## Default keys

A record the annotations do not list gets a deterministic default, so a new record has a key before one is chosen:

| Collection | Default                                  | Example             |
| ---------- | ---------------------------------------- | ------------------- |
| Spells     | `spell-<index>`                          | `spell-fireball`    |
| Features   | `feature-<index of the feature's class>` | `feature-barbarian` |
| Classes    | `class-<index>`                          | `class-monk`        |

At present every record is listed: 319 of 319 spells, 407 of 407 class features and 12 of 12 classes have a chosen key,
and none uses a default. To change a key, edit its row in `icon-annotations.json` and run `pnpm run derive:icons`.

## Audit

`src/2014/tests/icon-keys.test.ts` checks that every spell, class feature and class has a key of the form above, that
spell keys are unique and class keys are unique, that every annotation names an existing record and is listed once,
that a default key is used only for a record the annotations do not list, and that the committed files are what the
derivation writes.
