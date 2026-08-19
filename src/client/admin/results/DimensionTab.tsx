/**
 * Detailed view for one dimension.
 *
 * Each dimension shows the same spine - score, band, median, coverage, Unsure
 * rate, band distribution - followed by the question-level breakdown that
 * explains it. The per-dimension notes below are methodology, not decoration:
 * Confidence is labelled self-reported, Safety carries its asymmetric caveat,
 * Q19b is framed neutrally, and Enablement is described as the support
 * employees experienced rather than as a judgement of employees.
 */

import { useOutletContext } from 'react-router-dom';
import type { Dimension, QuestionId } from '../../../core/survey/questions.js';
import type { DistributionResult, ResultsOk } from '../../../core/results/contracts.js';
import {
  DIMENSION_LABELS,
  DIMENSION_LIMITS,
  DIMENSION_MEANINGS,
  SAFETY_CAVEAT,
} from '../../../core/results/methodology.js';
import { UNMANAGED_TOOL_FRAMING } from '../../../core/recommendations/presentation.js';
import type { ResultsOutletContext } from './ResultsLayout.js';
import { BandDistribution, Card, EmptyState, FrequencyTable, LabelledValue } from './components.js';
import { DimensionSummary } from './components.js';
import { formatRate, formatScore, questionPrompt } from './display.js';

function distributionFor(results: ResultsOk, questionId: QuestionId): DistributionResult | null {
  return results.diagnostics.scoredQuestions.find((d) => d.questionId === questionId) ?? null;
}

function QuestionBreakdown({
  results,
  questionIds,
  title,
  subtitle,
}: {
  readonly results: ResultsOk;
  readonly questionIds: readonly QuestionId[];
  readonly title: string;
  readonly subtitle?: string;
}) {
  return (
    <Card title={title} {...(subtitle === undefined ? {} : { subtitle })} testId="question-breakdown">
      {questionIds.map((questionId) => {
        const distribution = distributionFor(results, questionId);
        const score = results.questionScores.find((q) => q.questionId === questionId);

        return (
          <div key={questionId} className="mb-6 last:mb-0">
            <h3 className="text-sm font-semibold text-slate-900" data-testid={`question-${questionId}`}>
              {questionPrompt(questionId)}
            </h3>
            {score !== undefined && (
              <p className="mt-0.5 text-xs text-slate-600">
                Organization mean {formatScore(score.mean)}
                {score.notAssessedCount > 0 && ` · ${score.notAssessedCount} not assessed`}
              </p>
            )}
            <div className="mt-2">
              {distribution === null ? (
                <EmptyState>No breakdown available for this question.</EmptyState>
              ) : (
                <FrequencyTable
                  caption={questionPrompt(questionId)}
                  distribution={distribution}
                  emptyMessage="Nobody answered this question."
                  testId={`distribution-${questionId}`}
                />
              )}
            </div>
          </div>
        );
      })}
    </Card>
  );
}

const QUESTIONS_BY_DIMENSION: Readonly<Record<Dimension, readonly QuestionId[]>> = {
  adoption: ['q5'],
  confidence: ['q8', 'q9', 'q10', 'q11'],
  workflow: ['q12', 'q13', 'q14'],
  safety: ['q16', 'q17', 'q18'],
  enablement: ['q19', 'q20', 'q21', 'q22'],
};

export function DimensionTab({ dimension }: { readonly dimension: Dimension }) {
  const { results } = useOutletContext<ResultsOutletContext>();
  const result = results.dimensions.find((d) => d.dimension === dimension);
  if (result === undefined) return null;

  return (
    <div data-testid={`dimension-detail-${dimension}`}>
      <Card title={DIMENSION_LABELS[dimension]} testId={`dimension-headline-${dimension}`}>
        <DimensionSummary
          result={result}
          meaning={DIMENSION_MEANINGS[dimension]}
          limit={DIMENSION_LIMITS[dimension]}
        />

        {dimension === 'safety' && (
          <p
            data-testid="safety-caveat"
            className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            {SAFETY_CAVEAT}
          </p>
        )}

        <h3 className="mt-5 text-sm font-semibold text-slate-800">Distribution</h3>
        <p className="mb-2 text-xs text-slate-600">
          Where individual respondents sit. The mean alone would hide a split organization.
        </p>
        <BandDistribution
          distribution={result.distribution}
          scoredCount={result.scoredCount}
          testId={`band-distribution-${dimension}`}
        />
      </Card>

      {dimension === 'adoption' && <AdoptionExtras results={results} />}
      {dimension === 'workflow' && <WorkflowExtras results={results} />}

      <QuestionBreakdown
        results={results}
        questionIds={QUESTIONS_BY_DIMENSION[dimension]}
        title="Question breakdown"
        {...(dimension === 'confidence'
          ? { subtitle: 'Self-reported confidence. Nothing here was tested or observed.' }
          : {})}
      />

      {dimension === 'safety' && <SafetyExtras results={results} />}
      {dimension === 'enablement' && <EnablementExtras results={results} />}
    </div>
  );
}

function AdoptionExtras({ results }: { readonly results: ResultsOk }) {
  const general = results.diagnostics.generalAiFrequency;
  const work = results.diagnostics.workAiFrequency;

  return (
    <>
      <Card
        title="General vs work AI use"
        subtitle="Q4 is diagnostic only and never contributes to the Adoption score. Shown so familiarity and workplace use can be compared."
        testId="general-vs-work"
      >
        <h3 className="text-sm font-semibold text-slate-800">{questionPrompt('q4')}</h3>
        <div className="mt-2">
          <FrequencyTable
            caption={questionPrompt('q4')}
            distribution={general}
            emptyMessage="Nobody answered this question."
            testId="distribution-q4"
          />
        </div>
        <h3 className="mt-5 text-sm font-semibold text-slate-800">{questionPrompt('q5')}</h3>
        <div className="mt-2">
          <FrequencyTable
            caption={questionPrompt('q5')}
            distribution={work}
            emptyMessage="Nobody answered this question."
            testId="distribution-q5-compare"
          />
        </div>
      </Card>

      <Card
        title="Tools and use cases"
        subtitle="Descriptive only. A longer tool list is not a higher score - breadth of tools is never treated as maturity."
        testId="tools-and-use-cases"
      >
        <h3 className="text-sm font-semibold text-slate-800">Tools in use</h3>
        <FrequencyTable
          caption="AI tools currently used for work"
          distribution={results.diagnostics.tools}
          ranked
          emptyMessage="No tools were reported."
          testId="tools-table"
        />
        <h3 className="mt-5 text-sm font-semibold text-slate-800">What AI is used for</h3>
        <FrequencyTable
          caption="Current work use cases for AI"
          distribution={results.diagnostics.useCases}
          ranked
          emptyMessage="No use cases were reported."
          testId="use-cases-table"
        />
      </Card>
    </>
  );
}

function WorkflowExtras({ results }: { readonly results: ResultsOk }) {
  return (
    <Card
      title="What people have built"
      subtitle="Q15 is diagnostic and classification evidence only. It is never scored."
      testId="workflow-artifacts"
    >
      <FrequencyTable
        caption="Reusable artifacts and enablement behaviours"
        distribution={results.diagnostics.workflowArtifacts}
        ranked
        emptyMessage="Nobody reported creating a reusable artifact yet."
        testId="workflow-artifacts-table"
      />
    </Card>
  );
}

function SafetyExtras({ results }: { readonly results: ResultsOk }) {
  const unmanaged = results.diagnostics.unmanagedTools;

  return (
    <Card
      title="Independently accessed AI tools"
      subtitle={UNMANAGED_TOOL_FRAMING}
      testId="unmanaged-tools"
    >
      <LabelledValue
        label="Report using them sometimes or often"
        value={`${unmanaged.sometimesOrOftenCount} of ${unmanaged.validCount} (${formatRate(unmanaged.sometimesOrOftenRate)})`}
        testId="unmanaged-rate"
      />
      <LabelledValue
        label="Report no access to organization-provided AI tools"
        value={`${unmanaged.noOrgProvidedAccessCount} (${formatRate(unmanaged.noOrgProvidedAccessRate)})`}
      />
      <LabelledValue
        label="Preferred not to say"
        value={String(unmanaged.preferNotToSayCount)}
      />
      <p className="mt-2 text-xs text-slate-500">
        &ldquo;Prefer not to say&rdquo; is excluded from the rate and reported separately, so it
        cannot be read as either a yes or a no.
      </p>

      <div className="mt-4">
        <FrequencyTable
          caption={questionPrompt('q19b')}
          distribution={unmanaged.distribution}
          emptyMessage="Nobody answered this question."
          testId="distribution-q19b"
        />
      </div>
    </Card>
  );
}

function EnablementExtras({ results }: { readonly results: ResultsOk }) {
  return (
    <Card
      title="Reported barriers"
      subtitle="What employees say gets in the way. This describes the support they experienced, not their performance."
      testId="enablement-barriers"
    >
      <FrequencyTable
        caption="Reported barriers to using AI at work"
        distribution={results.diagnostics.barriers}
        ranked
        emptyMessage="No major barriers were selected frequently enough to stand out."
        testId="enablement-barriers-table"
      />
    </Card>
  );
}
