/**
 * /demo - the public entry point.
 *
 * Written for somebody who has not read anything about the project: what it
 * measures, what it refuses to claim, and two ways to see it working. No
 * customer names, no adoption numbers, no outcomes - there is no evidence for
 * any of those, so none are stated. Phase 4 brief 28, 55.
 */

import { Link } from 'react-router-dom';
import { DEMO_DATA_NOTICE, DEMO_ORGANIZATION_NAME } from '../../core/demo/constants.js';
import { DIMENSIONS } from '../../core/survey/questions.js';
import { DIMENSION_LABELS, DIMENSION_MEANINGS } from '../../core/results/methodology.js';
import { useHeadingFocus } from '../lib/focus.js';

const PRIMARY =
  'inline-flex min-h-11 items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800';
const SECONDARY =
  'inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50';

export function DemoLanding() {
  const heading = useHeadingFocus<HTMLHeadingElement>();

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h1
          tabIndex={-1}
          ref={heading}
          data-testid="demo-heading"
          className="text-2xl font-semibold text-slate-900 focus:outline-none"
        >
          AI Adoption Pulse Check
        </h1>
        <p className="mt-2 text-base text-slate-700">
          An open-source, privacy-first way for an organization of roughly 10-500 people to find out
          how employees are actually using AI, where support is missing, what risk signals exist, and
          which everyday workflows deserve a closer look.
        </p>
        <p className="mt-3 text-sm text-slate-600" data-testid="demo-data-notice">
          {DEMO_DATA_NOTICE}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link className={PRIMARY} to="/demo/results" data-testid="explore-sample">
            Explore sample organization
          </Link>
          <Link className={SECONDARY} to="/demo/survey" data-testid="take-sample-survey">
            Take sample survey
          </Link>
          <Link className={SECONDARY} to="/methodology" data-testid="view-methodology">
            View methodology
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">What it measures</h2>
        <p className="mt-1 text-sm text-slate-600">
          Five dimensions, reported separately. There is deliberately no single maturity score - one
          average would hide exactly the differences worth acting on.
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {DIMENSIONS.map((dimension) => (
            <div key={dimension} className="rounded-md border border-slate-200 p-4">
              <dt className="text-sm font-semibold text-slate-900">{DIMENSION_LABELS[dimension]}</dt>
              <dd className="mt-1 text-sm text-slate-700">{DIMENSION_MEANINGS[dimension]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">What it does not claim</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>
            <strong>Not a skill test.</strong> Confidence is what people say about themselves.
            Nothing here is measured by observation.
          </li>
          <li>
            <strong>Not a compliance audit.</strong> A low Safety score is a real warning signal; a
            high one is not proof that behaviour is safe.
          </li>
          <li>
            <strong>Not guaranteed anonymity.</strong> The survey collects no direct identifiers and
            suppresses small groups, but somebody can still describe themselves in a written answer.
          </li>
          <li>
            <strong>Not a single maturity score.</strong> Five numbers, always separate.
          </li>
          <li>
            <strong>Not automation readiness.</strong> An opportunity means a workflow is worth
            investigating, not that it can be automated or that it would pay for itself.
          </li>
        </ul>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">How the demo works</h2>
        <p className="mt-2 text-sm text-slate-700">
          {DEMO_ORGANIZATION_NAME} is a fictional organization with a committed fixture of roughly 75
          synthetic responses. The demo runs those responses through the same deterministic scoring,
          classification, recommendation and Opportunity Map code a self-hosted deployment runs -
          there is no separate demo methodology and no pre-computed screenshot. The sample survey
          stays in your browser and submits nothing.
        </p>
      </section>
    </div>
  );
}
