/**
 * The one implementation of the weighted-dimension + missing-data rule.
 *
 * Every dimension routes through this function so the 60% validity threshold
 * and the weight-normalization behaviour cannot drift between dimensions.
 * Spec 18.
 */

import type { Dimension } from '../survey/questions.js';
import { normalizeScore, roundTo, INTERNAL_PRECISION } from '../util/number.js';
import {
  MIN_VALID_WEIGHT_RATIO,
  MISSING,
  NOT_ASSESSED,
  type DimensionScore,
  type WeightedInput,
} from './types.js';

export function calculateWeightedDimension(
  dimension: Dimension,
  inputs: readonly WeightedInput[],
): DimensionScore {
  const totalWeight = roundTo(
    inputs.reduce((sum, i) => sum + i.weight, 0),
    INTERNAL_PRECISION,
  );
  if (totalWeight <= 0) {
    throw new Error(`Dimension ${dimension} declared no weighting`);
  }

  const scoredInputs: string[] = [];
  const notAssessedInputs: string[] = [];
  const missingInputs: string[] = [];

  let validWeight = 0;
  let weightedTotal = 0;

  for (const input of inputs) {
    if (input.value === NOT_ASSESSED) {
      notAssessedInputs.push(input.questionId);
      continue;
    }
    if (input.value === MISSING) {
      missingInputs.push(input.questionId);
      continue;
    }
    scoredInputs.push(input.questionId);
    validWeight += input.weight;
    weightedTotal += input.value * input.weight;
  }

  const validWeightRatio = roundTo(validWeight / totalWeight, INTERNAL_PRECISION);

  const diagnostics = {
    validWeight: validWeightRatio,
    notAssessedInputs: notAssessedInputs as readonly string[] as DimensionScore['notAssessedInputs'],
    missingInputs: missingInputs as readonly string[] as DimensionScore['missingInputs'],
    scoredInputs: scoredInputs as readonly string[] as DimensionScore['scoredInputs'],
  };

  if (validWeightRatio < MIN_VALID_WEIGHT_RATIO) {
    return { dimension, assessed: false, reason: 'insufficient_valid_weight', ...diagnostics };
  }

  // Normalize across the surviving weights so that excluding a legitimately
  // Not-Assessed input does not silently drag the score toward zero.
  const score = normalizeScore(weightedTotal / validWeight);
  return { dimension, assessed: true, score, ...diagnostics };
}
