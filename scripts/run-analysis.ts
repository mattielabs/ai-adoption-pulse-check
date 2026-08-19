/**
 * Runs the committed fixture through the complete core pipeline and prints the
 * result as verification evidence.
 *
 *   npm run analysis:report
 *
 * This is a developer tool, not a product surface. It exists so the engine's
 * behaviour can be inspected without any UI.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SurveyResponse } from '../src/core/survey/answers.js';
import { runAnalysis } from '../src/core/analysis/runAnalysis.js';
import { roundScore, asPercent } from '../src/core/util/number.js';
import { CLASSIFICATION_LABELS, CLASSIFICATION_KEY_BY_LEVEL, CLASSIFICATION_LEVELS } from '../src/core/classification/classifyRespondent.js';
import { CONFIDENCE_LABEL_COPY } from '../src/core/recommendations/types.js';
import { listReportableSegments } from '../src/core/privacy/segmentation.js';
import { buildResponseExport, buildFreeTextExport } from '../src/core/privacy/exports.js';
import { seededRandom } from '../src/core/util/random.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, '../demo/sample-responses.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as { responses: SurveyResponse[] };
const responses = fixture.responses;

const out = (line = '') => process.stdout.write(`${line}\n`);
const fmt = (v: number | null) => (v === null ? 'Not Assessed' : String(roundScore(v)));
const pct = (v: number | null) => (v === null ? 'n/a' : `${asPercent(v)}%`);

const analysis = runAnalysis(responses);
if (analysis.suppressed) throw new Error(`Unexpected suppression: ${analysis.reason}`);

out('='.repeat(72));
out('AI ADOPTION PULSE CHECK - PHASE 0 FIXTURE ANALYSIS');
out('='.repeat(72));
out(`survey ${analysis.versions.surveyVersion} / scoring ${analysis.versions.scoringVersion} / recommendations ${analysis.versions.recommendationEngineVersion}`);
out(`Responses: ${analysis.responseCount}`);
out(`Sample caveat: ${analysis.sampleCaveat ?? 'none'}`);

out();
out('-- DIMENSIONS ' + '-'.repeat(58));
for (const [name, agg] of Object.entries(analysis.aggregate.dimensions)) {
  const unsure = agg.unsureRate === null ? 'n/a' : pct(agg.unsureRate);
  out(
    `${name.padEnd(12)} mean ${fmt(agg.mean).padStart(4)}  median ${fmt(agg.median).padStart(4)}  ` +
      `scored ${String(agg.scoredCount).padStart(2)}/${analysis.responseCount}  ` +
      `notAssessed ${agg.notAssessedCount}  unsure/unclear ${unsure}`,
  );
  out(`             bands ${JSON.stringify(agg.distribution)}`);
}

const interest = analysis.aggregate.interest;
out();
out(`Interest (not a dimension): mean ${fmt(interest.mean)}  median ${fmt(interest.median)}  ` +
  `assessed ${interest.assessedCount}  notAssessed ${interest.notAssessedCount}  unsure ${pct(interest.unsureRate)}`);
out(`  bands ${JSON.stringify(interest.distribution)}`);

out();
out('-- CLASSIFICATION ' + '-'.repeat(54));
for (const level of [...CLASSIFICATION_LEVELS].reverse()) {
  const key = CLASSIFICATION_KEY_BY_LEVEL[level];
  out(
    `Level ${level} ${CLASSIFICATION_LABELS[key].padEnd(20)} ` +
      `${String(analysis.aggregate.classification.counts[level]).padStart(2)}  ` +
      `${pct(analysis.aggregate.classification.rates[level])}`,
  );
}
out(`Unclassified: ${analysis.aggregate.classification.unclassifiedCount}`);
out(`Champion signal: ${analysis.aggregate.championSignal.displayCount ?? 'not present'} ` +
  `(qualifying=${analysis.aggregate.championSignal.qualifyingCount})`);

out();
out('-- Q19b UNMANAGED TOOL USE ' + '-'.repeat(46));
const unmanaged = analysis.aggregate.diagnostics.unmanagedTools;
out(`valid ${unmanaged.validCount}  preferNotToSay ${unmanaged.preferNotToSayCount}  ` +
  `sometimes/often ${unmanaged.sometimesOrOftenCount} (${pct(unmanaged.sometimesOrOftenRate)})  ` +
  `noOrgAccess ${unmanaged.noOrgProvidedAccessCount} (${pct(unmanaged.noOrgProvidedAccessRate)})`);

out();
out('-- RECOMMENDATIONS ' + '-'.repeat(53));
out(`status: ${analysis.recommendations.status}  engine ${analysis.recommendations.engineVersion}`);
out();
out('All rules:');
for (const rule of analysis.recommendations.evaluated) {
  const state = rule.triggered ? 'FIRED ' : rule.evaluable ? '  -   ' : ' n/a  ';
  const merged = rule.suppressedBy ? ` [suppressed by ${rule.suppressedBy}: ${rule.suppressionReason}]` : '';
  const mergedIn = rule.mergedFindings.length > 0
    ? ` [merged in: ${rule.mergedFindings.map((m) => m.sourceId).join(', ')}]`
    : '';
  out(`  ${rule.id} P${rule.priority} ${rule.family.padEnd(11)} ${state} ${rule.title}${merged}${mergedIn}`);
}

out();
out(`Top ${analysis.recommendations.primary.length} primary recommendations after ranking + deduplication:`);
analysis.recommendations.primary.forEach((rule, i) => {
  out(`  ${i + 1}. [P${rule.priority} ${rule.family}] ${rule.id} - ${rule.title}`);
  out(`     confidence: ${rule.confidenceLabel ? CONFIDENCE_LABEL_COPY[rule.confidenceLabel] : 'n/a'}  ` +
    `gap ${rule.gapFromThreshold === null ? 'n/a' : rule.gapFromThreshold.toFixed(2)}  ` +
    `affected ${pct(rule.affectedProportion)}`);
  for (const condition of rule.conditions) {
    // Conditions are compared on the raw score, not the display-rounded one, so
    // print enough precision to see near-threshold cases.
    const actual = condition.actual === null ? 'n/a' : condition.actual.toFixed(2);
    out(`     ${condition.met ? 'x' : ' '} ${condition.description} (actual ${actual})`);
  }
  for (const merged of rule.mergedFindings) {
    out(`     + merged ${merged.sourceId}: ${merged.summary}`);
  }
});

if (analysis.recommendations.additional.length > 0) {
  out();
  out('Additional opportunities / signals:');
  for (const rule of analysis.recommendations.additional) {
    out(`  - ${rule.id} ${rule.title} (${rule.suppressionReason})`);
  }
}

out();
out('-- OPPORTUNITY MAP ' + '-'.repeat(53));
out(`Guardrail: ${analysis.opportunities.guardrail.active ? 'ACTIVE' : 'inactive'}` +
  (analysis.opportunities.guardrail.message ? ` - ${analysis.opportunities.guardrail.message}` : ''));
out(`Pain denominator (respondents answering Q26): ${analysis.opportunities.denominator}`);
out();
out('Workflow                        Pain   AI use in pain group   Status');
for (const category of analysis.opportunities.categories) {
  out(
    `${category.label.padEnd(32)}${pct(category.painRate).padStart(5)}` +
      `${pct(category.aiUseAmongPainRate).padStart(23)}   ${category.opportunityLabel ?? '-'}`,
  );
}

out();
out('-- PRIVACY ' + '-'.repeat(61));
for (const dimension of ['department', 'role_level', 'work_type'] as const) {
  const segments = listReportableSegments(responses, dimension);
  out(`${dimension}: ${segments.filter((s) => s.reportable).length} reportable / ${segments.length} values`);
}

const allowedSegment = runAnalysis(responses, {
  filters: [{ dimension: 'department', value: 'it_technology' }],
});
if (allowedSegment.suppressed) {
  out('  it_technology: UNEXPECTEDLY SUPPRESSED');
} else {
  out(`  ALLOWED  department=it_technology  n=${allowedSegment.segment.segmentCount} ` +
    `complement=${allowedSegment.segment.complementCount}  ` +
    `adoption ${fmt(allowedSegment.aggregate.dimensions.adoption.mean)}  ` +
    `safety ${fmt(allowedSegment.aggregate.dimensions.safety.mean)}`);
}

const suppressedSegment = runAnalysis(responses, {
  filters: [{ dimension: 'department', value: 'legal_compliance' }],
});
out(`  ${suppressedSegment.suppressed ? 'SUPPRESSED' : 'ALLOWED'} department=legal_compliance` +
  (suppressedSegment.suppressed ? `  reason=${suppressedSegment.reason}` : ''));

const stacked = runAnalysis(responses, {
  filters: [
    { dimension: 'department', value: 'it_technology' },
    { dimension: 'role_level', value: 'manager' },
  ],
});
out(`  ${stacked.suppressed ? 'SUPPRESSED' : 'ALLOWED'} stacked department+role_level` +
  (stacked.suppressed ? `  reason=${stacked.reason}` : ''));

out();
out('-- EXPORT SHAPING ' + '-'.repeat(54));
const responseExport = buildResponseExport(responses, { random: seededRandom(1) });
const freeTextExport = buildFreeTextExport(responses, { random: seededRandom(1) });
out(`response CSV columns (${responseExport.headers.length}): ${responseExport.headers.join(', ')}`);
out(`response CSV rows: ${responseExport.rows.length}`);
out(`free-text CSV columns: ${freeTextExport.headers.join(', ')} | rows: ${freeTextExport.rows.length}`);
out();
out('='.repeat(72));
