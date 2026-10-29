export const SRD_PREFIX = '5e-SRD-';
export const YEAR_DIR_PATTERN = /^\d{4}$/;

// Full RFC 5646 BCP 47 language tag pattern (named groups converted to non-capturing
// because JS forbids duplicate group names even across alternations).
// NOTE: The language subtag allows 2–8 letters, so this regex is syntactically permissive —
// short words like 'docs', 'tests', 'schemas' also match. Use TRANSLATION_SKIP_DIRS
// alongside LOCALE_PATTERN to exclude known structural project directories.
// prettier-ignore
export const LOCALE_PATTERN =
  /^(?:(?:en-GB-oed|i-ami|i-bnn|i-default|i-enochian|i-hak|i-klingon|i-lux|i-mingo|i-navajo|i-pwn|i-tao|i-tay|i-tsu|sgn-BE-FR|sgn-BE-NL|sgn-CH-DE|art-lojban|cel-gaulish|no-bok|no-nyn|zh-guoyu|zh-hakka|zh-min|zh-min-nan|zh-xiang)|(?:(?:[A-Za-z]{2,3}(?:-[A-Za-z]{3}(?:-[A-Za-z]{3}){0,2})?)|[A-Za-z]{4}|[A-Za-z]{5,8})(?:-[A-Za-z]{4})?(?:-(?:[A-Za-z]{2}|[0-9]{3}))?(?:-(?:[A-Za-z0-9]{5,8}|[0-9][A-Za-z0-9]{3}))*(?:-(?:[0-9A-WY-Za-wy-z](?:-[A-Za-z0-9]{2,8})+))*(?:-x(?:-[A-Za-z0-9]{1,8})+)?|x(?:-[A-Za-z0-9]{1,8})+)$/;

// Structural directories that match the BCP 47 pattern syntactically but are not locales.
// 'en' is NOT in this set — it is a real locale and callers handle it separately.
export const TRANSLATION_SKIP_DIRS = new Set(['schemas', 'tests']);

/**
 * Extracts the base index name from a JSON filename.
 * Assumes a pattern like '5e-SRD-IndexName.json'.
 * @param filename The filename (e.g., '5e-SRD-Ability-Scores.json').
 * @returns The base index name (e.g., 'ability-scores') or null if the pattern doesn't match.
 */
export function getIndexName(filename: string): string | null {
  const jsonDbCollectionPrefix = SRD_PREFIX;
  const jsonDataPattern = `\\b${jsonDbCollectionPrefix}(.+)\\.json\\b`;
  const regex = new RegExp(jsonDataPattern);
  const match = regex.exec(filename);

  if (!match) return null;

  const dataName = match[1];
  // Convert to lowercase and replace spaces/underscores with hyphens
  return dataName.toLowerCase().replace(/[\s_]+/g, '-');
}
