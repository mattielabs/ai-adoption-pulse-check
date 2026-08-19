/**
 * /p/:publicId - the employee Pulse experience.
 *
 * State machine:
 *
 *   loading -> not_found | load_error | closed | not_yet_open
 *           -> already_submitted (browser marker) -> [view snapshot result]
 *           -> landing -> survey (8-9 sections) -> review -> submitting
 *           -> result | confirmation
 *
 * Answers live in one map, persisted to a versioned localStorage draft on
 * every change. The draft is only cleared after the server confirms
 * persistence; a failed submission keeps everything. Phase 1 brief 15, 25.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { PublicPulse } from '../../core/pulse/publicPulse.js';
import { fetchPulse, submitResponse, type SubmitFailureKind } from '../lib/api.js';
import {
  buildSections,
  buildSubmissionPayload,
  sectionErrors,
  type AnswerMap,
} from '../lib/sections.js';
import {
  clearDraft,
  discardIncompatibleDrafts,
  hasSubmitted,
  loadDraft,
  loadResultSnapshot,
  markSubmitted,
  saveDraft,
  saveResultSnapshot,
} from '../lib/draft.js';
import { computePersonalResult, type PersonalResultData } from '../lib/personalResult.js';
import { accentContrastText, safeAccent } from '../lib/format.js';
import { Landing } from './Landing.js';
import { SurveySection } from './SurveySection.js';
import { Review } from './Review.js';
import { Result } from './Result.js';
import {
  AlreadySubmittedScreen,
  ClosedScreen,
  LoadErrorScreen,
  NotFoundScreen,
  NotYetOpenScreen,
  SubmittedConfirmationScreen,
} from './StatusScreens.js';

type Phase =
  | 'loading'
  | 'load_error'
  | 'not_found'
  | 'closed'
  | 'not_yet_open'
  | 'already_submitted'
  | 'landing'
  | 'survey'
  | 'review'
  | 'result'
  | 'confirmation';

const DEFAULT_ACCENT = '#0f172a';

export function PulsePage() {
  const params = useParams<{ publicId: string }>();
  const publicId = params.publicId ?? '';

  const [phase, setPhase] = useState<Phase>('loading');
  const [pulse, setPulse] = useState<PublicPulse | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [sectionIndex, setSectionIndex] = useState(0);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [restored, setRestored] = useState(false);
  const [returnToReview, setReturnToReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<SubmitFailureKind | null>(null);
  const [result, setResult] = useState<PersonalResultData | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [loadNonce, setLoadNonce] = useState(0);

  const sections = useMemo(
    () => buildSections(pulse?.customQuestions ?? []),
    [pulse],
  );

  // --- initial load ---------------------------------------------------------
  // Phase starts at 'loading'; a retry resets it in the click handler before
  // bumping loadNonce, so the effect never sets state synchronously.
  useEffect(() => {
    let cancelled = false;

    void fetchPulse(publicId).then((outcome) => {
      if (cancelled) return;

      if (!outcome.ok) {
        setPhase(outcome.kind === 'not_found' ? 'not_found' : 'load_error');
        return;
      }

      const loaded = outcome.pulse;
      setPulse(loaded);

      if (hasSubmitted(publicId)) {
        setResult(loadResultSnapshot(publicId));
        setPhase('already_submitted');
        return;
      }

      if (loaded.availability === 'closed') {
        setPhase('closed');
        return;
      }
      if (loaded.availability === 'not_yet_open') {
        setPhase('not_yet_open');
        return;
      }

      // Drafts from other survey versions are never applied.
      discardIncompatibleDrafts(publicId, loaded.surveyVersion);
      const sectionCount = buildSections(loaded.customQuestions).length;
      const draft = loadDraft(publicId, loaded.surveyVersion, sectionCount);
      if (draft !== null && Object.keys(draft.answers).length > 0) {
        setAnswers(draft.answers);
        setSectionIndex(draft.sectionIndex);
        setRestored(true);
        setPhase('survey');
      } else {
        setPhase('landing');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [publicId, loadNonce]);

  // --- draft persistence ----------------------------------------------------
  useEffect(() => {
    if (pulse === null) return;
    if (phase !== 'survey' && phase !== 'review') return;
    saveDraft(publicId, pulse.surveyVersion, answers, sectionIndex);
  }, [publicId, pulse, answers, sectionIndex, phase]);

  // --- handlers -------------------------------------------------------------
  const handleAnswer = useCallback((key: string, value: string | readonly string[]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const handleContinue = useCallback(() => {
    const section = sections[sectionIndex];
    if (section === undefined) return;

    const found = sectionErrors(section, answers);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      const firstKey = section.questions.find((q) => found[q.key] !== undefined)?.key;
      if (firstKey !== undefined) {
        document.getElementById(`question-${firstKey}`)?.focus();
      }
      return;
    }

    setErrors({});
    setRestored(false);
    if (returnToReview || sectionIndex === sections.length - 1) {
      setReturnToReview(false);
      setPhase('review');
    } else {
      setSectionIndex(sectionIndex + 1);
    }
  }, [sections, sectionIndex, answers, returnToReview]);

  const handlePrevious = useCallback(() => {
    setErrors({});
    setRestored(false);
    setSectionIndex((current) => Math.max(current - 1, 0));
  }, []);

  const handleEditSection = useCallback((index: number) => {
    setErrors({});
    setSectionIndex(index);
    setReturnToReview(true);
    setPhase('survey');
  }, []);

  const handleSubmit = useCallback(() => {
    if (pulse === null || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const payload = buildSubmissionPayload(answers, pulse.surveyVersion);

    void submitResponse(publicId, payload).then((outcome) => {
      setSubmitting(false);

      if (!outcome.ok) {
        // The draft is deliberately NOT cleared on any failure.
        setSubmitError(outcome.kind);
        return;
      }

      clearDraft(publicId, pulse.surveyVersion);
      markSubmitted(publicId);

      if (pulse.personalResultsEnabled) {
        const computed = computePersonalResult(payload.answers);
        saveResultSnapshot(publicId, computed);
        setResult(computed);
        setJustSubmitted(true);
        setPhase('result');
      } else {
        setPhase('confirmation');
      }
    });
  }, [pulse, publicId, answers, submitting]);

  // --- accent ---------------------------------------------------------------
  const accent = safeAccent(pulse?.organization.accentColor ?? null) ?? DEFAULT_ACCENT;
  const accentVars = {
    '--pc-accent': accent,
    '--pc-accent-text': accentContrastText(accent),
  } as React.CSSProperties;

  // --- render ---------------------------------------------------------------
  const section = sections[sectionIndex];

  return (
    <main className="min-h-screen bg-slate-100 font-sans text-slate-800" style={accentVars}>
      <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
        {phase === 'loading' && (
          <p role="status" className="text-sm text-slate-600">
            Loading&hellip;
          </p>
        )}

        {phase === 'not_found' && <NotFoundScreen />}
        {phase === 'closed' && <ClosedScreen />}
        {phase === 'not_yet_open' && <NotYetOpenScreen opensOn={pulse?.opensOn ?? null} />}
        {phase === 'load_error' && (
          <LoadErrorScreen
            onRetry={() => {
              setPhase('loading');
              setLoadNonce((n) => n + 1);
            }}
          />
        )}

        {phase === 'already_submitted' && (
          <AlreadySubmittedScreen hasSnapshot={result !== null} onViewResult={() => setPhase('result')} />
        )}

        {phase === 'landing' && pulse !== null && (
          <Landing pulse={pulse} sectionCount={sections.length} onStart={() => setPhase('survey')} />
        )}

        {phase === 'survey' && pulse !== null && section !== undefined && (
          <div>
            <p className="mb-4 text-sm font-medium text-slate-600">
              {pulse.organization.name} &middot; {pulse.name}
            </p>
            <SurveySection
              section={section}
              sectionIndex={sectionIndex}
              sectionCount={sections.length}
              answers={answers}
              errors={errors}
              restoredNotice={restored}
              returnToReview={returnToReview}
              onAnswer={handleAnswer}
              onPrevious={handlePrevious}
              onContinue={handleContinue}
            />
          </div>
        )}

        {phase === 'review' && pulse !== null && (
          <Review
            sections={sections}
            answers={answers}
            submitting={submitting}
            submitError={submitError}
            onEditSection={handleEditSection}
            onSubmit={handleSubmit}
          />
        )}

        {phase === 'result' && result !== null && (
          <Result result={result} justSubmitted={justSubmitted} />
        )}

        {phase === 'confirmation' && <SubmittedConfirmationScreen />}
      </div>
    </main>
  );
}
