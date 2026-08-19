/**
 * Presentation copy for recommendations.
 *
 * The engine decides WHAT fired and carries the measured evidence. This module
 * carries only the editorial half a dashboard needs: what a priority level
 * means, and why a given finding matters.
 *
 * Two rules this file holds to:
 *
 *   1. Nothing here is generated. There is no template that interpolates a
 *      score into a sentence, because that is how "your organization has
 *      governance issues" gets invented from a number. "What we found" is
 *      rendered from the engine's own met conditions and evidence items; only
 *      the standing rationale lives here.
 *
 *   2. Nothing here restates a threshold. Thresholds live in the rules, and
 *      duplicating "below 50" as prose would create a second place to forget
 *      to update.
 *
 * Wording follows V1.1 sections 25 and 26.
 */

import type { RecommendationId, RecommendationPriority } from './types.js';

export const PRIORITY_MEANINGS: Readonly<Record<RecommendationPriority, string>> = {
  1: 'Address before encouraging broader use.',
  2: 'Employees want to use AI, or are trying to, but support is insufficient.',
  3: 'Existing use can become more useful, consistent or intentional.',
  4: 'An existing strength that may support broader learning or discovery.',
};

/**
 * Why each finding matters. Standing rationale, not a description of this
 * organization's numbers - the numbers are supplied by the evidence list.
 */
export const RECOMMENDATION_RATIONALE: Readonly<Record<RecommendationId, string>> = {
  R01:
    'Employees are already using AI at scale while self-reported verification, review and ' +
    'data-handling awareness lag behind it. Encouraging broader use before that gap closes ' +
    'increases the volume of unchecked output rather than the value of it.',
  R02:
    'When employees cannot say which tools are approved or what must never be entered into ' +
    'one, each person decides for themselves. That produces inconsistent practice rather than ' +
    'deliberate refusal, and it is cheaper to fix with one short document than with training.',
  R03:
    'The overall Safety score is holding up, but the specific habits that make AI output ' +
    'trustworthy - checking important facts and reviewing before sharing - are weaker than the ' +
    'headline suggests. This is a narrower fix than a full guardrail programme.',
  R04:
    'Employees report wanting to use AI more while also reporting that tools, guidance or ' +
    'training are missing. That combination means the limiting factor is organizational ' +
    'support, not employee willingness, so adoption campaigns will not move it.',
  R05:
    'People are using AI regularly but report low confidence in instructing it, refining its ' +
    'answers and judging whether output is any good. Low confidence at this stage usually shows ' +
    'up later as either abandoned use or unchecked acceptance.',
  R06:
    'AI use is established but still task-by-task. Moving from one-off prompting to repeatable ' +
    'processes is where consistency and time savings actually come from, and it does not ' +
    'require new tools.',
  R07:
    'Interest is high, support is adequate, and adoption still is not happening. Something ' +
    'other than tooling or policy is in the way, and the survey cannot tell you what - that ' +
    'takes conversation with the people who are not using it.',
  R08:
    'Both adoption and interest are low. Buying tools or running broad training now would be ' +
    'answering a question nobody has asked. Finding the real operational pain first is the ' +
    'cheaper order of work.',
  R09:
    'Several respondents already combine repeatable AI use with confident, careful practice. ' +
    'That is an internal resource for sharing practice - and it is worth using before ' +
    'commissioning external training.',
  R10:
    'A meaningful share of employees report using AI tools or accounts the organization did not ' +
    'provide. That is usually a signal of unmet need rather than of policy violation, and it ' +
    'is worth understanding before it is either endorsed or restricted.',
};

/**
 * Neutral framing for the Q19b diagnostic wherever it is surfaced. Spec 10
 * (Q19b helper text) and Phase 3 brief 25: this is a discovery signal, not an
 * accusation.
 */
export const UNMANAGED_TOOL_FRAMING =
  'Employees may use AI tools or accounts that were not provided by the organization. ' +
  'This does not necessarily mean those tools are prohibited.';
