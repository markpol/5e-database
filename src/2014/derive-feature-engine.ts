import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import annotations from './feature-engine-annotations.json' with { type: 'json' };
import { deriveFeatureCounts } from './derive-feature-counts';

// The structured mechanics of class features, in `feature_specific`: `engine` (what using the feature costs, how it
// recharges, how many uses it has, what it changes), `heal`, `granted_proficiencies` and `grants_asi`. The first
// three are written by hand, one record for each feature, in feature-engine-annotations.json (they restate the
// feature's text, which has no fixed wording to parse) and merged into the features here; `grants_asi` is set on
// every Ability Score Improvement. The vocabulary is documented in docs/feature-mechanics.md and enforced by the
// Zod schema in schemas/5e-SRD-Features.ts.

type Feature = { index: string; name: string; level: number } & Record<string, unknown>;
type Annotation = {
  feature: string;
  engine?: unknown;
  heal?: unknown;
  granted_proficiencies?: unknown;
};

// `engine` covers the features of class levels 1 to 5, which are the ones a low-level character has.
export const ENGINE_MAX_LEVEL = 5;

export const FEATURE_ANNOTATIONS: Record<string, Omit<Annotation, 'feature'>> = Object.fromEntries(
  (annotations as Annotation[]).map(({ feature, ...rest }) => [feature, rest])
);

const SUBCLASS_CHOICE = 'the choice of a subclass, whose own features carry the mechanics';
const SPELLCASTING =
  'spellcasting, which the class spellcasting and the Levels spell slots describe';
const PREPARED_SPELLS = 'spells that are always prepared, which the subclass spell list names';
const OPTION_PARENT = 'the choice of an option, whose own feature record carries the mechanics';
const DRAGON_ANCESTOR =
  'the choice of a dragon, whose damage type is used by features of 6th level and above, and a language';
const EXPERTISE =
  'a doubled proficiency bonus for chosen proficiencies, the choice of which is in expertise_options';
const LANGUAGE = 'a language, which is not a proficiency';
const EXPLORATION =
  'a benefit outside combat (travel, tracking, climbing, copying spells) with no structured counterpart';

// The features of levels 1 to 5 that have no `engine`, and why. A feature of these levels with neither an `engine`
// nor another structured field (`grants_asi`, `heal`, `granted_proficiencies`) must be listed here.
export const ENGINE_EXCLUDED: Record<string, string> = {
  'primal-path': SUBCLASS_CHOICE,
  'bard-college': SUBCLASS_CHOICE,
  'divine-domain': SUBCLASS_CHOICE,
  'divine-domain-improvement-1': SUBCLASS_CHOICE,
  'druid-circle': SUBCLASS_CHOICE,
  'martial-archetype': SUBCLASS_CHOICE,
  'monastic-tradition': SUBCLASS_CHOICE,
  'sacred-oath': SUBCLASS_CHOICE,
  'ranger-archetype': SUBCLASS_CHOICE,
  'roguish-archetype': SUBCLASS_CHOICE,
  'sorcerous-origin': SUBCLASS_CHOICE,
  'otherworldly-patron': SUBCLASS_CHOICE,
  'arcane-tradition': SUBCLASS_CHOICE,
  'spellcasting-bard': SPELLCASTING,
  'spellcasting-cleric': SPELLCASTING,
  'spellcasting-druid': SPELLCASTING,
  'spellcasting-paladin': SPELLCASTING,
  'spellcasting-ranger': SPELLCASTING,
  'spellcasting-sorcerer': SPELLCASTING,
  'spellcasting-wizard': SPELLCASTING,
  'pact-magic': SPELLCASTING,
  'bonus-cantrip': 'one more cantrip known, which the class spellcasting describes',
  'domain-spells-1': PREPARED_SPELLS,
  'domain-spells-2': PREPARED_SPELLS,
  'domain-spells-3': PREPARED_SPELLS,
  'circle-spells-1': PREPARED_SPELLS,
  'circle-spells-2': PREPARED_SPELLS,
  'oath-spells': PREPARED_SPELLS,
  'circle-of-the-land': 'the choice of a land, which picks the circle spells',
  'circle-of-the-land-arctic': PREPARED_SPELLS,
  'circle-of-the-land-coast': PREPARED_SPELLS,
  'circle-of-the-land-desert': PREPARED_SPELLS,
  'circle-of-the-land-forest': PREPARED_SPELLS,
  'circle-of-the-land-grassland': PREPARED_SPELLS,
  'circle-of-the-land-mountain': PREPARED_SPELLS,
  'circle-of-the-land-swamp': PREPARED_SPELLS,
  'fighter-fighting-style': OPTION_PARENT,
  'paladin-fighting-style': OPTION_PARENT,
  'ranger-fighting-style': OPTION_PARENT,
  'hunters-prey': OPTION_PARENT,
  'metamagic-1': OPTION_PARENT,
  'eldritch-invocations': OPTION_PARENT,
  'pact-boon': OPTION_PARENT,
  'dragon-ancestor': DRAGON_ANCESTOR,
  'dragon-ancestor-black---acid-damage': DRAGON_ANCESTOR,
  'dragon-ancestor-blue---lightning-damage': DRAGON_ANCESTOR,
  'dragon-ancestor-brass---fire-damage': DRAGON_ANCESTOR,
  'dragon-ancestor-bronze---lightning-damage': DRAGON_ANCESTOR,
  'dragon-ancestor-copper---acid-damage': DRAGON_ANCESTOR,
  'dragon-ancestor-gold---fire-damage': DRAGON_ANCESTOR,
  'dragon-ancestor-green---poison-damage': DRAGON_ANCESTOR,
  'dragon-ancestor-red---fire-damage': DRAGON_ANCESTOR,
  'dragon-ancestor-silver---cold-damage': DRAGON_ANCESTOR,
  'dragon-ancestor-white---cold-damage': DRAGON_ANCESTOR,
  'bard-expertise-1': EXPERTISE,
  'rogue-expertise-1': EXPERTISE,
  druidic: LANGUAGE,
  'thieves-cant': LANGUAGE,
  'favored-enemy-1-type': EXPLORATION,
  'natural-explorer-1-terrain-type': EXPLORATION,
  'second-story-work': EXPLORATION,
  'evocation-savant': EXPLORATION,
  'eldritch-invocation-book-of-ancient-secrets':
    "ritual spells of the owner's choice written in a book",
  'eldritch-invocation-devils-sight': 'sight in darkness, a sense with no structured counterpart',
  'eldritch-invocation-eyes-of-the-rune-keeper':
    'reading all writing, with no structured counterpart',
  'eldritch-invocation-voice-of-the-chain-master': 'senses and speech shared with a familiar',
  'pact-of-the-chain': 'a familiar and the attack it makes, and find familiar learned as a spell',
  'pact-of-the-tome': "three cantrips of the owner's choice, cast from a book",
};

const ASI_NAME = 'Ability Score Improvement';
const DERIVED_KEYS = ['engine', 'grants_asi', 'heal', 'granted_proficiencies'] as const;

function deriveFeature(feature: Feature): Feature {
  const annotation = FEATURE_ANNOTATIONS[feature.index] ?? {};
  const existing = { ...((feature.feature_specific as Record<string, unknown>) ?? {}) };
  for (const key of DERIVED_KEYS) delete existing[key];
  const derived: Record<string, unknown> = {
    engine: deriveFeatureCounts(feature, annotation.engine as Record<string, unknown> | undefined),
    grants_asi: feature.name === ASI_NAME ? true : undefined,
    heal: annotation.heal,
    granted_proficiencies: annotation.granted_proficiencies,
  };
  const featureSpecific = Object.fromEntries(
    Object.entries({ ...existing, ...derived }).filter(([, value]) => value !== undefined)
  );

  // feature_specific goes right before `url`, where the features that already had one keep it.
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(feature)) {
    if (name === 'feature_specific') continue;
    if (name === 'url' && Object.keys(featureSpecific).length > 0) {
      out.feature_specific = featureSpecific;
    }
    out[name] = value;
  }
  return out as Feature;
}

export function deriveFeatureEngine(features: Feature[]): Feature[] {
  const indices = new Set(features.map((feature) => feature.index));
  for (const index of Object.keys(FEATURE_ANNOTATIONS)) {
    if (!indices.has(index)) throw new Error(`Annotation for unknown feature "${index}"`);
  }
  return features.map(deriveFeature);
}

const repoRoot = path.resolve(import.meta.dirname, '../..');
const featuresFile = path.join(repoRoot, 'src/2014/en/5e-SRD-Features.json');

function writeFeaturesToFile() {
  const features = JSON.parse(fs.readFileSync(featuresFile, 'utf8')) as Feature[];
  fs.writeFileSync(featuresFile, JSON.stringify(deriveFeatureEngine(features), null, 2));
  // The repository formats its JSON with Prettier (.prettierrc), which keeps short arrays on one line.
  execFileSync(path.join(repoRoot, 'node_modules/.bin/prettier'), [
    '--config',
    path.join(repoRoot, '.prettierrc'),
    '--write',
    featuresFile,
  ]);
  console.log(`Derived the structured mechanics of ${features.length} features`);
}

if (process.argv[1]?.endsWith('/derive-feature-engine.ts')) {
  writeFeaturesToFile();
}
