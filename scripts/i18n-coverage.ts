/**
 * Prints the per-locale translation coverage of the 2014 overlays as Markdown, and appends it to the GitHub Actions
 * job summary when `GITHUB_STEP_SUMMARY` is set. Informational: it never fails on low coverage.
 *
 *   pnpm run i18n:coverage
 */
import fs from 'node:fs';
import { renderCoverage } from '../src/i18n/coverage';
import { fileSource, overlayLocales } from '../src/i18n/files';

const report = renderCoverage(fileSource(), overlayLocales());
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
