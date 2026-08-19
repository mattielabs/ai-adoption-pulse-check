/**
 * Local draft persistence and the soft duplicate-submission marker.
 *
 * Everything here is browser-local convenience. None of it identifies the
 * respondent, none of it is sent to the server, and none of it guarantees
 * one-response-per-employee - the duplicate marker exists only to prevent
 * ACCIDENTAL double submission on the same browser. Spec 34.5, Phase 1 brief
 * 15-16.
 *
 * Keys are versioned by survey version: a draft written under one survey
 * version is never applied to another, because the answer semantics may
 * differ. Incompatible drafts are discarded, not migrated.
 *
 * All storage access is wrapped: a browser with storage disabled degrades to
 * "no draft, no marker" rather than crashing the survey.
 */

import type { AnswerMap } from './sections.js';
import type { PersonalResultData } from './personalResult.js';

const PREFIX = 'pulse-check';

const draftKey = (publicId: string, surveyVersion: string): string =>
  `${PREFIX}:draft:${publicId}:${surveyVersion}`;
const draftKeyPrefix = (publicId: string): string => `${PREFIX}:draft:${publicId}:`;
const submittedKey = (publicId: string): string => `${PREFIX}:submitted:${publicId}`;
const resultKey = (publicId: string): string => `${PREFIX}:result:${publicId}`;

export interface SurveyDraft {
  readonly answers: AnswerMap;
  readonly sectionIndex: number;
  /** Day granularity only - even locally, exact times are not recorded. */
  readonly updatedOn: string;
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the survey still works, it just cannot save drafts.
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

function sanitizeAnswers(raw: unknown): AnswerMap | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const clean: Record<string, string | readonly string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key !== 'string' || key.length > 8) continue;
    if (typeof value === 'string') {
      clean[key] = value;
    } else if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      clean[key] = value;
    }
    // Any other shape is dropped: a corrupt draft entry must not poison state.
  }
  return clean;
}

export function loadDraft(
  publicId: string,
  surveyVersion: string,
  sectionCount: number,
): SurveyDraft | null {
  const raw = read(draftKey(publicId, surveyVersion));
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SurveyDraft>;
    const answers = sanitizeAnswers(parsed.answers);
    if (answers === null) return null;
    const index =
      typeof parsed.sectionIndex === 'number' && Number.isInteger(parsed.sectionIndex)
        ? Math.min(Math.max(parsed.sectionIndex, 0), sectionCount - 1)
        : 0;
    return {
      answers,
      sectionIndex: index,
      updatedOn: typeof parsed.updatedOn === 'string' ? parsed.updatedOn : '',
    };
  } catch {
    return null;
  }
}

export function saveDraft(
  publicId: string,
  surveyVersion: string,
  answers: AnswerMap,
  sectionIndex: number,
): void {
  const draft: SurveyDraft = {
    answers,
    sectionIndex,
    updatedOn: new Date().toISOString().slice(0, 10),
  };
  write(draftKey(publicId, surveyVersion), JSON.stringify(draft));
}

export function clearDraft(publicId: string, surveyVersion: string): void {
  remove(draftKey(publicId, surveyVersion));
}

/**
 * Removes drafts for this Pulse written under any OTHER survey version. An
 * incompatible draft is never applied and never migrated - the survey starts
 * fresh under the current version.
 */
export function discardIncompatibleDrafts(publicId: string, currentVersion: string): void {
  try {
    const stale: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (
        key !== null &&
        key.startsWith(draftKeyPrefix(publicId)) &&
        key !== draftKey(publicId, currentVersion)
      ) {
        stale.push(key);
      }
    }
    stale.forEach(remove);
  } catch {
    // Ignore.
  }
}

export function markSubmitted(publicId: string): void {
  write(submittedKey(publicId), 'true');
}

export function hasSubmitted(publicId: string): boolean {
  return read(submittedKey(publicId)) === 'true';
}

/**
 * The employee's own result snapshot, so "View my result" works on a return
 * visit. Local-only; saved only when the Pulse has personal results enabled.
 */
export function saveResultSnapshot(publicId: string, result: PersonalResultData): void {
  write(resultKey(publicId), JSON.stringify(result));
}

export function loadResultSnapshot(publicId: string): PersonalResultData | null {
  const raw = read(resultKey(publicId));
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as PersonalResultData;
    return typeof parsed === 'object' && parsed !== null && 'scores' in parsed ? parsed : null;
  } catch {
    return null;
  }
}
