/**
 * The public demo's analysis.
 *
 * Two properties matter more than anything else in this file, and both are
 * structural rather than a matter of remembering to check something:
 *
 *   1. **It cannot read live data.** Nothing here imports `D1DatabaseLike`,
 *      takes a database, takes a Pulse id, or accepts any caller input at all.
 *      The only data source is a committed fixture compiled into the bundle,
 *      so there is no argument a visitor could supply that would make a demo
 *      route return a real organization's responses. Phase 4 brief 30.
 *
 *   2. **It is the real engine.** The fixture goes through the same
 *      `runAnalysis` and the same `buildAnalysisPayload` as a self-hosted
 *      Pulse, and comes back in the same `ResultsResponse` shape, so the demo
 *      dashboard is the product rather than a mock-up of it. If the scoring,
 *      recommendation or opportunity logic changed, this page would change
 *      with it.
 *
 * The analysis is recomputed per request. At seventy-five responses that costs
 * a few milliseconds, and V1.1 is explicit that aggregate caching is not built
 * until measurement justifies it. Spec 43.
 */

import fixture from '../../../demo/sample-responses.json' with { type: 'json' };
import { runAnalysis } from '../../core/analysis/runAnalysis.js';
import { buildAnalysisPayload, buildSampleState } from '../../core/results/buildResults.js';
import type { FreeTextResponse, ResultsResponse } from '../../core/results/contracts.js';
import { DEMO_ORGANIZATION_NAME, DEMO_PULSE_NAME } from '../../core/demo/constants.js';
import type { SurveyResponse } from '../../core/survey/answers.js';
import { validateStoredAnswers } from '../../core/survey/validation.js';
import { shuffle } from '../../core/util/random.js';

interface FixtureFile {
  readonly surveyVersion: string;
  readonly responseCount: number;
  readonly responses: readonly SurveyResponse[];
}

const FIXTURE = fixture as unknown as FixtureFile;

export const DEMO_ORGANIZATION = DEMO_ORGANIZATION_NAME;

/**
 * The fixture, validated the same way stored rows are.
 *
 * Two of the seventy-five responses deliberately omit a required answer, which
 * is legitimate stored data the scoring engine's missing-data rule is built to
 * handle. Anything genuinely malformed would throw here at first use rather
 * than producing a quietly wrong demo.
 */
function demoResponses(): readonly SurveyResponse[] {
  return FIXTURE.responses.map((response) => {
    const validated = validateStoredAnswers(response.answers);
    if (!validated.ok) {
      throw new Error('The committed demo fixture does not match the current survey schema');
    }
    return response;
  });
}

function demoPulseSummary(responseCount: number) {
  return {
    id: 0,
    name: DEMO_PULSE_NAME,
    // A completed sample run: the demo shows what results look like afterwards.
    state: 'closed' as const,
    opensOn: null,
    closesOn: null,
    responseCount,
    surveyVersion: FIXTURE.surveyVersion,
  };
}

export function buildDemoResults(): ResultsResponse {
  const responses = demoResponses();
  const analysis = runAnalysis(responses, { filters: [] });

  if (analysis.suppressed) {
    // Unreachable with the committed fixture, and never silently rendered as
    // if it were data.
    throw new Error('The demo fixture produced a suppressed analysis');
  }

  return {
    status: 'ok',
    pulse: demoPulseSummary(responses.length),
    versions: analysis.versions,
    segmentation: {
      // The demo is read-only. Offering a segment control here would imply an
      // interactive privacy decision that no real organization is behind.
      available: [],
      active: null,
      maxActiveDimensions: 1,
    },
    ...buildAnalysisPayload(analysis),
  };
}

export function buildDemoFreeText(): FreeTextResponse {
  const responses = demoResponses();
  const texts = responses
    .map((response) => (typeof response.answers.q27 === 'string' ? response.answers.q27.trim() : ''))
    .filter((text) => text.length > 0);

  return {
    status: 'ok',
    sample: buildSampleState(responses.length, null),
    // Shuffled for the same reason the real endpoint randomises: fixture order
    // is generation order, and the demo should not teach a reading habit the
    // product does not support.
    responses: shuffle(texts, Math.random),
  };
}
