/**
 * Survey landing screen: what this is, what it does and does not collect, and
 * how long it takes. The privacy copy uses the approved V1.1 framing - no
 * direct identifiers plus group-size protection - and never claims guaranteed
 * anonymity. Spec 9, Phase 1 brief 10.
 */

import type { PublicPulse } from '../../core/pulse/publicPulse.js';
import { safeLogoUrl } from '../lib/format.js';
import { totalQuestionCount } from '../lib/sections.js';

interface Props {
  readonly pulse: PublicPulse;
  readonly sectionCount: number;
  readonly onStart: () => void;
}

export function Landing({ pulse, sectionCount, onStart }: Props) {
  const logo = safeLogoUrl(pulse.organization.logoUrl);
  const questionCount = totalQuestionCount(pulse.customQuestions);

  return (
    <div>
      <header className="mb-6">
        {logo !== null && (
          <img src={logo} alt="" className="mb-3 h-10 w-auto" />
        )}
        <p className="text-sm font-medium text-slate-600">{pulse.organization.name}</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{pulse.name}</h1>
        {pulse.description !== null && <p className="mt-2 text-slate-700">{pulse.description}</p>}
      </header>

      <section aria-labelledby="about-heading" className="mb-5 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <h2 id="about-heading" className="text-base font-semibold text-slate-900">
          About this survey
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          {pulse.organization.surveyIntro ??
            'It helps your organization understand how employees are currently using AI, where people need support, and where AI may be useful in everyday work.'}
        </p>
        <p className="mt-2 text-sm text-slate-700">
          There are no right or wrong answers. You do not need to be an AI user to participate.
        </p>
        <dl className="mt-3 grid grid-cols-1 gap-1 text-sm text-slate-600 sm:grid-cols-3">
          <div>
            <dt className="sr-only">Estimated time</dt>
            <dd>Estimated time: 7&ndash;10 minutes</dd>
          </div>
          <div>
            <dt className="sr-only">Sections</dt>
            <dd>{sectionCount} sections</dd>
          </div>
          <div>
            <dt className="sr-only">Questions</dt>
            <dd>{questionCount} questions</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="privacy-heading" className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <h2 id="privacy-heading" className="text-base font-semibold text-slate-900">
          Your privacy
        </h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
          <li>This survey does not ask for your name, email, employee ID, or account information.</li>
          <li>Results are only shown to your organization for groups that meet the minimum reporting threshold.</li>
          <li>
            Written answers are shared with your organization as you write them, so they can contain
            identifying details if you include them.
          </li>
          <li>Please do not include confidential, personal, customer, or sensitive company information in written responses.</li>
        </ul>
      </section>

      <button
        type="button"
        data-testid="start-survey"
        onClick={onStart}
        className="min-h-12 w-full rounded-lg px-6 text-base font-semibold sm:w-auto"
        style={{ backgroundColor: 'var(--pc-accent)', color: 'var(--pc-accent-text)' }}
      >
        Start survey
      </button>

      <p className="mt-8 text-xs text-slate-400">
        AI Adoption Pulse Check &mdash; open-source project by Mattie Labs
      </p>
    </div>
  );
}
