/**
 * Option-frequency helpers for diagnostic questions.
 *
 * These return typed structured data only. No charting, no formatting, no
 * colour, no ordering assumptions beyond the survey's own option order.
 */

import type { SurveyResponse } from '../survey/answers.js';
import type { QuestionId } from '../survey/questions.js';
import { QUESTIONS_BY_ID } from '../survey/questions.js';
import { rate } from '../util/number.js';

export interface OptionDistribution {
  readonly questionId: QuestionId;
  /** Respondents who gave any valid answer to this question. */
  readonly answeredCount: number;
  readonly counts: Readonly<Record<string, number>>;
  /** count / answeredCount. For multi-select these do not sum to 1. */
  readonly rates: Readonly<Record<string, number | null>>;
}

function emptyCounts(questionId: QuestionId): Record<string, number> {
  const question = QUESTIONS_BY_ID[questionId];
  if (question.type === 'free_text') {
    throw new Error(`Cannot build an option distribution for free-text question ${questionId}`);
  }
  return Object.fromEntries(question.options.map((o) => [o.id, 0]));
}

export function singleSelectDistribution(
  responses: readonly SurveyResponse[],
  questionId: QuestionId,
): OptionDistribution {
  const counts = emptyCounts(questionId);
  let answeredCount = 0;
  for (const response of responses) {
    const value = response.answers[questionId as keyof typeof response.answers];
    if (typeof value !== 'string') continue;
    if (!(value in counts)) continue;
    counts[value] = (counts[value] ?? 0) + 1;
    answeredCount += 1;
  }
  return { questionId, answeredCount, counts, rates: toRates(counts, answeredCount) };
}

export function multiSelectDistribution(
  responses: readonly SurveyResponse[],
  questionId: QuestionId,
): OptionDistribution {
  const counts = emptyCounts(questionId);
  let answeredCount = 0;
  for (const response of responses) {
    const value = response.answers[questionId as keyof typeof response.answers];
    if (!Array.isArray(value) || value.length === 0) continue;
    answeredCount += 1;
    // De-duplicate defensively so a malformed row cannot double-count.
    for (const selected of new Set(value as readonly string[])) {
      if (!(selected in counts)) continue;
      counts[selected] = (counts[selected] ?? 0) + 1;
    }
  }
  return { questionId, answeredCount, counts, rates: toRates(counts, answeredCount) };
}

function toRates(
  counts: Readonly<Record<string, number>>,
  total: number,
): Readonly<Record<string, number | null>> {
  return Object.fromEntries(Object.entries(counts).map(([key, count]) => [key, rate(count, total)]));
}

/** Options sorted by descending count, for "top barriers"-style readouts. */
export function topOptions(
  distribution: OptionDistribution,
  limit: number,
): readonly { readonly optionId: string; readonly count: number; readonly rate: number | null }[] {
  return Object.entries(distribution.counts)
    .map(([optionId, count]) => ({ optionId, count, rate: distribution.rates[optionId] ?? null }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.optionId.localeCompare(b.optionId))
    .slice(0, limit);
}
