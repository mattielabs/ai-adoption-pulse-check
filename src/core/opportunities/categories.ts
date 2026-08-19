/**
 * Opportunity Map categories.
 *
 * The canonical id list lives in `survey/categories.ts` because these are
 * survey option identities first. This module adds the opportunity-specific
 * view of them and asserts, at module load, that Q7 and Q26 really do share
 * the same set. If someone later adds a category to one question and forgets
 * the other, the application fails loudly instead of silently producing a
 * comparison against a different denominator. Spec 30.
 */

import {
  SHARED_WORKFLOW_CATEGORY_IDS,
  SHARED_WORKFLOW_CATEGORY_LABELS,
  type SharedWorkflowCategoryId,
} from '../survey/categories.js';
import { QUESTIONS_BY_ID } from '../survey/questions.js';

export {
  SHARED_WORKFLOW_CATEGORY_IDS,
  SHARED_WORKFLOW_CATEGORY_LABELS,
  type SharedWorkflowCategoryId,
};

function optionIdsFor(questionId: 'q7' | 'q26'): readonly string[] {
  const question = QUESTIONS_BY_ID[questionId];
  if (question.type === 'free_text') throw new Error(`${questionId} is not a select question`);
  return question.options.map((o) => o.id);
}

function assertSharedCategoriesAligned(): void {
  const q7 = new Set(optionIdsFor('q7'));
  const q26 = new Set(optionIdsFor('q26'));
  const missing: string[] = [];
  for (const id of SHARED_WORKFLOW_CATEGORY_IDS) {
    if (!q7.has(id)) missing.push(`q7 is missing shared category "${id}"`);
    if (!q26.has(id)) missing.push(`q26 is missing shared category "${id}"`);
  }
  if (missing.length > 0) {
    throw new Error(`Opportunity Map categories are misaligned:\n${missing.join('\n')}`);
  }
}

assertSharedCategoriesAligned();

export function labelForCategory(id: SharedWorkflowCategoryId): string {
  return SHARED_WORKFLOW_CATEGORY_LABELS[id];
}
