/**
 * Regenerates `demo/sample-responses.json` from the fixed seed.
 *
 * The output is committed so tests do not depend on regenerating it. A test
 * asserts that the committed file still matches what this script produces, so
 * an accidental change to the generator cannot silently drift the fixture.
 *
 *   npm run fixture:generate
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateFixtureResponses, FIXTURE_SEED, FIXTURE_COHORT_SUMMARY } from './fixture/generateResponses.js';
import { SURVEY_VERSION } from '../src/core/versions.js';
import { validateAnswers } from '../src/core/survey/validation.js';

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(here, '../demo/sample-responses.json');

const responses = generateFixtureResponses(FIXTURE_SEED);

// A fixture that would be rejected by the real API is not a useful fixture.
// Partial responses are exempt: they exist precisely to exercise missing data.
const partialIds = new Set(responses.slice(-2).map((r) => r.id));
for (const response of responses) {
  if (partialIds.has(response.id)) continue;
  const result = validateAnswers(response.answers);
  if (!result.ok) {
    throw new Error(
      `Fixture ${response.id} fails survey validation:\n` +
        result.issues.map((i) => `  ${i.path}: ${i.message}`).join('\n'),
    );
  }
}

const payload = {
  $comment:
    'Synthetic demo data. No real people and no real employer. Regenerate with `npm run fixture:generate`.',
  seed: FIXTURE_SEED,
  surveyVersion: SURVEY_VERSION,
  cohorts: FIXTURE_COHORT_SUMMARY,
  responseCount: responses.length,
  responses,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

process.stdout.write(`Wrote ${responses.length} synthetic responses to ${outputPath}\n`);
