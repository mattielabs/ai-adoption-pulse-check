/**
 * Display formatting for the results dashboard.
 *
 * Formatting only. Every number these functions receive was produced by the
 * engine and arrives unrounded; rounding happens here, at the last possible
 * moment, so that nothing downstream can compare a rounded value against a
 * threshold.
 */

import { QUESTIONS_BY_ID, type QuestionId } from '../../core/survey/questions.js';
import { SCORE_BAND_LABELS, type ScoreBand } from '../../core/aggregation/bands.js';
import type { Comparator } from '../../core/recommendations/types.js';
import type { DistributionResult, EvidenceLine, OptionCount } from '../../core/results/contracts.js';
import { roundTo } from '../../core/util/number.js';

/**
 * Scores show one decimal place. A whole number would let a Safety of 49.94
 * read as "50" while the engine treats it as below 50 - the display would
 * contradict the recommendation sitting next to it. Spec 44.
 */
export function formatScore(value: number | null): string {
  if (value === null) return 'Not enough information';
  const rounded = roundTo(value, 1);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** A proportion in [0,1] as a whole-number percentage. */
export function formatRate(rate: number | null): string {
  return rate === null ? '-' : `${Math.round(rate * 100)}%`;
}

/** Evidence values arrive already scaled: rates as percentages, scores as scores. */
export function formatEvidence(item: EvidenceLine): string {
  if (item.value === null) return 'Not assessed';
  if (item.unit === 'rate') return `${roundTo(item.value, 1)}%`;
  if (item.unit === 'count') return String(item.value);
  return formatScore(item.value);
}

export function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function bandLabel(band: ScoreBand | null): string {
  return band === null ? 'Not assessed' : SCORE_BAND_LABELS[band];
}

const COMPARATOR_COPY: Readonly<Record<Comparator, string>> = {
  gte: 'at or above',
  gt: 'above',
  lt: 'below',
  lte: 'at or below',
};

export function comparatorCopy(comparator: Comparator): string {
  return COMPARATOR_COPY[comparator];
}

/** The survey's own wording for a question, so the dashboard never restates it. */
export function questionPrompt(questionId: QuestionId): string {
  return QUESTIONS_BY_ID[questionId].prompt;
}

/**
 * Resolves an option id to its display label from the survey schema. The
 * client compiles the same schema the server scored against, so there is no
 * second copy of the wording to drift.
 */
export function optionLabel(questionId: QuestionId, optionId: string): string {
  const question = QUESTIONS_BY_ID[questionId];
  if (question.type === 'free_text') return optionId;
  return question.options.find((option) => option.id === optionId)?.label ?? optionId;
}

export interface LabelledOption extends OptionCount {
  readonly label: string;
}

/** Distribution rows in the survey's own option order. */
export function labelledOptions(distribution: DistributionResult): readonly LabelledOption[] {
  return distribution.options.map((option) => ({
    ...option,
    label: optionLabel(distribution.questionId, option.optionId),
  }));
}

/** Distribution rows ordered by frequency, for "top barriers"-style readouts. */
export function rankedOptions(
  distribution: DistributionResult,
  limit?: number,
): readonly LabelledOption[] {
  const ranked = labelledOptions(distribution)
    .filter((option) => option.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return limit === undefined ? ranked : ranked.slice(0, limit);
}
