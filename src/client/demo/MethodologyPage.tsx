/**
 * /methodology - the public, short version.
 *
 * The full source of truth is a three-thousand-line specification and the
 * engine is a few thousand lines of tested TypeScript. Neither is a reasonable
 * thing to hand somebody who is deciding whether to trust a number. This page
 * states the decisions that change how a result should be read, and points at
 * the repository for the rest.
 *
 * Every threshold and label on this page is imported from the engine rather
 * than retyped, so the page cannot drift away from what the code does.
 */

import { Link } from 'react-router-dom';
import { DIMENSIONS } from '../../core/survey/questions.js';
import {
  DIMENSION_LABELS,
  DIMENSION_LIMITS,
  DIMENSION_MEANINGS,
  NO_SINGLE_SCORE_NOTE,
  SAFETY_CAVEAT,
} from '../../core/results/methodology.js';
import { SCORE_BAND_LABELS, SCORE_BAND_RANGES } from '../../core/aggregation/bands.js';
import {
  EARLY_DIRECTIONAL_BELOW,
  MINIMUM_REPORTABLE_RESPONSES,
} from '../../core/results/contracts.js';
import { AI_USE_AMONG_PAIN_THRESHOLD, PAIN_RATE_THRESHOLD } from '../../core/opportunities/analyze.js';
import { ENGINE_VERSIONS } from '../../core/versions.js';
import { useHeadingFocus } from '../lib/focus.js';

function Section({
  title,
  children,
  testId,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly testId?: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6" data-testid={testId}>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-slate-700">{children}</div>
    </section>
  );
}

export function MethodologyPage() {
  const heading = useHeadingFocus<HTMLHeadingElement>();
  const percent = (rate: number) => `${Math.round(rate * 100)}%`;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h1
          tabIndex={-1}
          ref={heading}
          data-testid="methodology-heading"
          className="text-2xl font-semibold text-slate-900 focus:outline-none"
        >
          Methodology
        </h1>
        <p className="mt-2 text-sm text-slate-700">
          Every number this tool produces comes from fixed rules over survey answers. There is no
          model, no LLM and no black box: the same input always produces the same output, and the
          rules are readable in the repository. Survey {ENGINE_VERSIONS.surveyVersion} &middot;
          scoring {ENGINE_VERSIONS.scoringVersion} &middot; recommendations{' '}
          {ENGINE_VERSIONS.recommendationEngineVersion}.
        </p>
      </section>

      <Section title="No single maturity score" testId="methodology-no-single-score">
        <p>{NO_SINGLE_SCORE_NOTE}</p>
      </Section>

      <Section title="The five dimensions" testId="methodology-dimensions">
        <dl className="grid gap-4 sm:grid-cols-2">
          {DIMENSIONS.map((dimension) => (
            <div key={dimension} className="rounded-md border border-slate-200 p-4">
              <dt className="text-sm font-semibold text-slate-900">{DIMENSION_LABELS[dimension]}</dt>
              <dd className="mt-1">{DIMENSION_MEANINGS[dimension]}</dd>
              {DIMENSION_LIMITS[dimension] !== null && (
                <dd className="mt-1 text-slate-600">{DIMENSION_LIMITS[dimension]}</dd>
              )}
            </div>
          ))}
        </dl>
        <p className="text-slate-600">
          A dimension is only calculated when at least 60% of its intended weighting has a valid
          answer. Below that, the result is &ldquo;not enough information&rdquo; rather than zero -
          scoring a blank as a nought would invent a bad result out of a missing one.
        </p>
      </Section>

      <Section title="Confidence and Safety are self-report" testId="methodology-self-report">
        <p>
          <strong>Confidence</strong> asks people how confident they feel giving instructions, adding
          context, judging an answer, and deciding when AI is the wrong tool. Nothing is tested. It
          was called &ldquo;Capability&rdquo; in an earlier draft; the name was changed because the
          survey cannot measure capability.
        </p>
        <p>
          <strong>Safety</strong> is read asymmetrically, on purpose. {SAFETY_CAVEAT}
        </p>
      </Section>

      <Section title="Score bands" testId="methodology-bands">
        <p>
          Bands are a reading aid over the raw score, assigned from the exact value rather than a
          rounded one.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          {SCORE_BAND_RANGES.map((range) => (
            <li key={range.band}>
              <strong>{SCORE_BAND_LABELS[range.band]}</strong>{' '}
              {range.max === 100 ? `${range.min}-100` : `${range.min} to under ${range.max}`}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Recommendations" testId="methodology-recommendations">
        <p>
          Ten rules, each with an explicit trigger, an evidence list and a priority. At most three
          primary priorities and three additional signals are shown, and overlapping findings are
          merged into one card rather than repeated - an early draft produced ten near-identical
          recommendations, which is how a report becomes unreadable.
        </p>
        <p>
          Nothing in a recommendation is generated. The measured value and the threshold it was
          compared against are printed beside each other so the reasoning can be checked.
        </p>
      </Section>

      <Section title="The Opportunity Map" testId="methodology-opportunities">
        <p>
          Q7 (what people use AI for) and Q26 (what takes significant time or repeats) share a fixed
          list of workflow categories, so the comparison is exact by construction rather than a
          judgement call about which use case resembles which pain point.
        </p>
        <p>
          A category needs a pain rate of at least {percent(PAIN_RATE_THRESHOLD)} to be
          labelled at all. Below {percent(AI_USE_AMONG_PAIN_THRESHOLD)} AI use{' '}
          <em>among the people reporting that specific pain</em> it is <strong>Explore</strong>; at
          or above, <strong>Standardize</strong>. There are only two labels. Enable, Scale and
          per-workflow Guardrail were removed because a survey cannot support them.
        </p>
        <p className="text-slate-600">
          An opportunity is a discovery prompt. It establishes no automation feasibility, no time
          saving and no return on investment.
        </p>
      </Section>

      <Section title="Minimum reporting group" testId="methodology-privacy">
        <p>
          Nothing is calculated below {MINIMUM_REPORTABLE_RESPONSES} responses - not shown-then-hidden,
          not calculated. Between {MINIMUM_REPORTABLE_RESPONSES} and {EARLY_DIRECTIONAL_BELOW - 1},
          results carry an early-directional caution.
        </p>
        <p>
          Results can be grouped by department, role level or work type - one at a time, never two. A
          group is only reported when the group <em>and everyone outside it</em> both reach{' '}
          {MINIMUM_REPORTABLE_RESPONSES}, because &ldquo;managers, 18 of 20&rdquo; also describes the
          two people who are not managers.
        </p>
      </Section>

      <Section title="Privacy limitations" testId="methodology-limitations">
        <p>
          The survey does not ask for a name, email address, employee ID, job title, or account, and
          it does not fingerprint a device. That is not the same as anonymity, and the project does
          not claim anonymity.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Somebody can identify themselves in a written answer, and some people will.</li>
          <li>A manager who already knows a unique situation may recognise it in an aggregate.</li>
          <li>
            Self-hosted deployments run on the organization&rsquo;s own infrastructure, and the
            organization can query its own database directly.
          </li>
          <li>
            An infrastructure provider still processes ordinary network metadata that the application
            never stores.
          </li>
        </ul>
      </Section>

      <p className="text-sm text-slate-600">
        <Link className="underline underline-offset-2" to="/demo/results">
          See it applied to the sample organization
        </Link>
        .
      </p>
    </div>
  );
}
