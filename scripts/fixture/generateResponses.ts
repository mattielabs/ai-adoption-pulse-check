/**
 * Deterministic synthetic fixture generator.
 *
 * NO REAL PEOPLE AND NO REAL EMPLOYER. Every response here is generated from a
 * fixed seed so the committed `demo/sample-responses.json` is byte-reproducible
 * and the regression test can detect accidental methodology changes.
 *
 * The dataset is built from eight cohorts chosen to exercise specific paths
 * through the engine. See `docs/phase-0.md` for the full table of what each
 * cohort is designed to trigger.
 */

import type { SurveyAnswers, SurveyResponse } from '../../src/core/survey/answers.js';
import type * as O from '../../src/core/survey/options.js';
import { SURVEY_VERSION } from '../../src/core/versions.js';
import { pickWeighted, sample, seededRandom, type RandomSource } from '../../src/core/util/random.js';

export const FIXTURE_SEED = 20260818;

/** Submission window. Day granularity only - the schema stores nothing finer. */
const SUBMISSION_DAYS = [
  '2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05',
  '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12',
] as const;

type Weighted<T> = readonly (readonly [T, number])[];

/**
 * Per-category probability that a respondent reports this workflow as
 * time-consuming or repetitive (Q26).
 *
 * These are hand-set to produce a realistic spread: a few categories clearly
 * above the 20% pain threshold, several around it, and several clearly below
 * so the Opportunity Map has genuine non-results rather than labelling
 * everything.
 */
const PAIN_PROBABILITY: Readonly<Record<string, number>> = {
  email_communication: 0.44,
  meetings_followup: 0.35,
  research_information: 0.23,
  writing_documents: 0.4,
  reviewing_summarizing: 0.27,
  data_entry_cleanup: 0.33,
  spreadsheets_analysis: 0.28,
  presentations: 0.14,
  scheduling_coordination: 0.25,
  customer_support: 0.17,
  creating_content: 0.12,
  planning_project_management: 0.19,
  // Pain-only categories, present in Q26 but not in Q7.
  training_onboarding: 0.11,
  repetitive_system_updates: 0.16,
};

/**
 * Per-category probability that a fully-engaged AI user reports using AI there
 * (Q7). Cohorts scale this by their own `useIntensity`.
 *
 * The shape matters more than the exact numbers: text-heavy categories have
 * high AI use, while data cleanup and scheduling have very little. That is what
 * separates "Standardize" from "Explore" once pain is held constant.
 */
const AI_USE_PROBABILITY: Readonly<Record<string, number>> = {
  email_communication: 0.76,
  meetings_followup: 0.44,
  research_information: 0.8,
  writing_documents: 0.73,
  reviewing_summarizing: 0.5,
  data_entry_cleanup: 0.16,
  spreadsheets_analysis: 0.2,
  presentations: 0.25,
  scheduling_coordination: 0.08,
  customer_support: 0.3,
  creating_content: 0.36,
  planning_project_management: 0.22,
};

interface CohortProfile {
  /** Scales AI_USE_PROBABILITY. 0 means the respondent uses AI for nothing. */
  readonly useIntensity: number;
  /** Scales PAIN_PROBABILITY. */
  readonly painIntensity: number;
  /** Extra Q7-only categories this cohort may report. */
  readonly extraUseCategories?: readonly O.Q7Option[];
}

interface Cohort {
  readonly key: string;
  readonly description: string;
  readonly count: number;
  readonly profile: CohortProfile;
  readonly build: (random: RandomSource, profile: CohortProfile) => SurveyAnswers;
}

function multi<T extends string>(
  random: RandomSource,
  pool: readonly T[],
  min: number,
  max: number,
): T[] {
  const count = min + Math.floor(random() * (max - min + 1));
  return sample(pool, count, random).sort();
}

function q26For(random: RandomSource, profile: CohortProfile): O.Q26Option[] {
  const painful = Object.entries(PAIN_PROBABILITY)
    .filter(([, probability]) => random() < probability * profile.painIntensity)
    .map(([category]) => category);
  if (painful.length === 0) return ['none_of_these'];
  return painful.sort() as O.Q26Option[];
}

function q7For(random: RandomSource, profile: CohortProfile): O.Q7Option[] {
  if (profile.useIntensity <= 0) return ['no_work_ai_use'];

  const used = Object.entries(AI_USE_PROBABILITY)
    .filter(([, probability]) => random() < probability * profile.useIntensity)
    .map(([category]) => category);

  for (const extra of profile.extraUseCategories ?? []) {
    if (random() < 0.6) used.push(extra);
  }

  // A respondent who reports work AI use elsewhere must name at least one
  // category; the survey requires a selection either way.
  if (used.length === 0) used.push('research_information');
  return [...new Set(used)].sort() as O.Q7Option[];
}

function baseAnswers(random: RandomSource): Pick<SurveyAnswers, 'q23' | 'q24' | 'q25'> {
  return {
    q23: multi(
      random,
      [
        'dont_know_where_useful',
        'dont_know_how_to_use',
        'not_enough_time',
        'no_access_to_tools',
        'unsure_which_approved',
        'privacy_security_concern',
        'accuracy_concern',
        'policies_unclear',
      ] as const,
      1,
      3,
    ),
    q24: multi(
      random,
      [
        'ai_basics',
        'better_prompts',
        'role_specific',
        'reusable_workflows',
        'privacy_security_responsible',
        'accuracy_quality',
        'org_tools',
        'automation',
      ] as const,
      1,
      3,
    ),
    q25: multi(
      random,
      [
        'short_tutorials',
        'live_workshops',
        'role_specific_examples',
        'learning_by_building',
        'internal_champions',
        'written_guides',
      ] as const,
      1,
      2,
    ),
  };
}

// --- Cohorts ---------------------------------------------------------------

const builders: Cohort = {
  key: 'builders',
  description: 'Level 4 Builder/Champion. Drives the champion signal and R09.',
  count: 5,
  profile: { useIntensity: 1.15, painIntensity: 0.8, extraUseCategories: ['building_workflows_tools', 'coding_technical'] },
  build: (r, p) => ({
    q4: 'multiple_times_day',
    q5: pickWeighted([['multiple_times_day', 3], ['most_workdays', 1]] as Weighted<O.Q5Option>, r),
    q6: multi(r, ['chatgpt', 'claude', 'microsoft_copilot', 'ai_coding_tools', 'built_in_ai_features'] as const, 3, 5),
    q7: q7For(r, p),
    q8: 'extremely_confident',
    q9: pickWeighted([['extremely_confident', 2], ['very_confident', 1]] as Weighted<O.ConfidenceScaleOption>, r),
    q10: 'very_confident',
    q11: 'very_confident',
    q12: 'built_workflows_tools',
    q13: 'almost_always',
    q14: pickWeighted([['recurring_workflows', 2], ['several_processes', 1]] as Weighted<O.Q14Option>, r),
    q15: multi(r, ['reusable_prompt_template', 'shared_prompt_library', 'custom_gpt_project', 'automated_workflow', 'ai_agent', 'documentation_training', 'helped_coworkers'] as const, 3, 5),
    q16: 'usually',
    q17: 'always',
    q18: 'very_confident',
    q19: pickWeighted([['general_idea', 2], ['mostly', 1]] as Weighted<O.Q19Option>, r),
    q19b: pickWeighted([['often', 2], ['sometimes', 2], ['rarely', 1]] as Weighted<O.Q19bOption>, r),
    q20: pickWeighted([['disagree', 2], ['neither', 1]] as Weighted<O.AgreementScaleOption>, r),
    q21: 'agree',
    q22: 'disagree',
    ...baseAnswers(r),
    q26: q26For(r, p),
    q27: 'Turning long project threads into a short weekly status summary.',
    q28: 'extremely_interested',
  }),
};

const workflowUsers: Cohort = {
  key: 'workflow_users',
  description: 'Level 3 Workflow User. Repeatable-process behaviour with corroboration.',
  count: 10,
  profile: { useIntensity: 1.0, painIntensity: 0.85 },
  build: (r, p) => ({
    q4: pickWeighted([['multiple_times_day', 2], ['most_workdays', 2]] as Weighted<O.Q4Option>, r),
    q5: pickWeighted([['most_workdays', 3], ['multiple_times_day', 2]] as Weighted<O.Q5Option>, r),
    q6: multi(r, ['chatgpt', 'microsoft_copilot', 'claude', 'built_in_ai_features', 'perplexity'] as const, 2, 4),
    q7: q7For(r, p),
    q8: 'very_confident',
    q9: 'very_confident',
    q10: pickWeighted([['very_confident', 3], ['somewhat_confident', 1]] as Weighted<O.ConfidenceScaleOption>, r),
    q11: 'somewhat_confident',
    q12: pickWeighted([['repeatable_processes', 3], ['reuse_prompts_approaches', 2]] as Weighted<O.Q12Option>, r),
    q13: pickWeighted([['often', 3], ['almost_always', 2]] as Weighted<O.Q13Option>, r),
    q14: pickWeighted([['several_processes', 2], ['one_small_process', 2], ['unsure', 1]] as Weighted<O.Q14Option>, r),
    q15: multi(r, ['reusable_prompt_template', 'custom_gpt_project', 'helped_coworkers', 'shared_prompt_library'] as const, 1, 3),
    q16: pickWeighted([['usually', 3], ['sometimes', 2]] as Weighted<O.FrequencyScaleOption>, r),
    q17: pickWeighted([['usually', 3], ['always', 2]] as Weighted<O.FrequencyScaleOption>, r),
    q18: pickWeighted([['very_confident', 2], ['somewhat_confident', 2]] as Weighted<O.Q18Option>, r),
    q19: pickWeighted([['general_idea', 3], ['no', 1], ['unsure', 1]] as Weighted<O.Q19Option>, r),
    q19b: pickWeighted([['sometimes', 3], ['rarely', 2], ['often', 1]] as Weighted<O.Q19bOption>, r),
    q20: pickWeighted([['disagree', 3], ['neither', 2]] as Weighted<O.AgreementScaleOption>, r),
    q21: pickWeighted([['agree', 2], ['neither', 2]] as Weighted<O.AgreementScaleOption>, r),
    q22: pickWeighted([['disagree', 3], ['strongly_disagree', 1]] as Weighted<O.AgreementScaleOption>, r),
    ...baseAnswers(r),
    q26: q26For(r, p),
    q28: pickWeighted([['very_interested', 2], ['extremely_interested', 2]] as Weighted<O.Q28Option>, r),
  }),
};

const heavyUsersWeakSafety: Cohort = {
  key: 'heavy_users_weak_safety',
  description:
    'High adoption with weak verification, weak review and low data-handling confidence. Drives Safety down and feeds R01/R03/R10.',
  count: 18,
  profile: { useIntensity: 1.0, painIntensity: 1.15, extraUseCategories: ['creating_media'] },
  build: (r, p) => ({
    q4: 'multiple_times_day',
    q5: pickWeighted([['multiple_times_day', 3], ['most_workdays', 2]] as Weighted<O.Q5Option>, r),
    q6: multi(r, ['chatgpt', 'google_gemini', 'claude', 'built_in_ai_features', 'ai_media_tools', 'perplexity'] as const, 2, 4),
    q7: q7For(r, p),
    q8: pickWeighted([['very_confident', 3], ['somewhat_confident', 2]] as Weighted<O.ConfidenceScaleOption>, r),
    q9: pickWeighted([['somewhat_confident', 3], ['very_confident', 2]] as Weighted<O.ConfidenceScaleOption>, r),
    q10: pickWeighted([['somewhat_confident', 3], ['slightly_confident', 2]] as Weighted<O.ConfidenceScaleOption>, r),
    q11: pickWeighted([['slightly_confident', 3], ['somewhat_confident', 2]] as Weighted<O.ConfidenceScaleOption>, r),
    q12: pickWeighted([['regular_individual_tasks', 3], ['reuse_prompts_approaches', 1]] as Weighted<O.Q12Option>, r),
    q13: pickWeighted([['sometimes', 3], ['rarely', 2]] as Weighted<O.Q13Option>, r),
    q14: pickWeighted([['see_opportunities', 3], ['no', 2], ['unsure', 1]] as Weighted<O.Q14Option>, r),
    q15: pickWeighted([[['reusable_prompt_template'], 2], [['none_of_these'], 2], [['not_sure_meaning'], 1]] as Weighted<O.Q15Option[]>, r),
    q16: pickWeighted([['rarely', 4], ['sometimes', 2], ['never', 2]] as Weighted<O.FrequencyScaleOption>, r),
    q17: pickWeighted([['sometimes', 3], ['rarely', 3], ['usually', 1], ['never', 1]] as Weighted<O.FrequencyScaleOption>, r),
    q18: pickWeighted([['slightly_confident', 3], ['unsure', 3], ['not_confident', 1]] as Weighted<O.Q18Option>, r),
    q19: pickWeighted([['unsure', 2], ['not_defined', 2], ['no', 2], ['general_idea', 2]] as Weighted<O.Q19Option>, r),
    q19b: pickWeighted([['often', 3], ['sometimes', 3], ['rarely', 1], ['prefer_not_to_say', 1]] as Weighted<O.Q19bOption>, r),
    q20: pickWeighted([['strongly_disagree', 2], ['disagree', 3], ['unsure', 1]] as Weighted<O.AgreementScaleOption>, r),
    q21: pickWeighted([['neither', 2], ['disagree', 2], ['agree', 1]] as Weighted<O.AgreementScaleOption>, r),
    q22: pickWeighted([['strongly_disagree', 2], ['disagree', 3]] as Weighted<O.AgreementScaleOption>, r),
    ...baseAnswers(r),
    q26: q26For(r, p),
    q27: r() < 0.35 ? 'Drafting first-pass replies to routine customer questions.' : undefined,
    q28: pickWeighted([['very_interested', 3], ['extremely_interested', 2], ['moderately_interested', 1]] as Weighted<O.Q28Option>, r),
  }),
};

const regularUsers: Cohort = {
  key: 'regular_users',
  description: 'Level 2 Regular User. Task-by-task AI use, moderate everything.',
  count: 18,
  profile: { useIntensity: 0.6, painIntensity: 1.05 },
  build: (r, p) => ({
    q4: pickWeighted([['most_workdays', 2], ['few_times_week', 2]] as Weighted<O.Q4Option>, r),
    q5: pickWeighted([['few_times_week', 3], ['most_workdays', 2], ['few_times_month', 1]] as Weighted<O.Q5Option>, r),
    q6: multi(r, ['chatgpt', 'microsoft_copilot', 'built_in_ai_features'] as const, 1, 3),
    q7: q7For(r, p),
    q8: pickWeighted([['somewhat_confident', 3], ['very_confident', 2]] as Weighted<O.ConfidenceScaleOption>, r),
    q9: pickWeighted([['somewhat_confident', 3], ['slightly_confident', 2]] as Weighted<O.ConfidenceScaleOption>, r),
    q10: pickWeighted([['somewhat_confident', 3], ['very_confident', 1], ['slightly_confident', 1]] as Weighted<O.ConfidenceScaleOption>, r),
    q11: pickWeighted([['somewhat_confident', 2], ['slightly_confident', 2], ['not_done_this', 1]] as Weighted<O.ConfidenceScaleOption>, r),
    q12: 'regular_individual_tasks',
    q13: pickWeighted([['sometimes', 3], ['rarely', 2], ['often', 1]] as Weighted<O.Q13Option>, r),
    q14: pickWeighted([['see_opportunities', 3], ['no', 2], ['one_small_process', 1], ['unsure', 1]] as Weighted<O.Q14Option>, r),
    q15: pickWeighted([[['none_of_these'], 3], [['reusable_prompt_template'], 2], [['not_sure_meaning'], 1]] as Weighted<O.Q15Option[]>, r),
    q16: pickWeighted([['sometimes', 3], ['usually', 1], ['rarely', 2]] as Weighted<O.FrequencyScaleOption>, r),
    q17: pickWeighted([['usually', 2], ['sometimes', 3], ['always', 1]] as Weighted<O.FrequencyScaleOption>, r),
    q18: pickWeighted([['somewhat_confident', 3], ['slightly_confident', 2], ['unsure', 1]] as Weighted<O.Q18Option>, r),
    q19: pickWeighted([['general_idea', 4], ['mostly', 1], ['unsure', 2], ['not_defined', 1]] as Weighted<O.Q19Option>, r),
    q19b: pickWeighted([['rarely', 3], ['sometimes', 2], ['never', 2], ['prefer_not_to_say', 1]] as Weighted<O.Q19bOption>, r),
    q20: pickWeighted([['disagree', 3], ['unsure', 1], ['neither', 3]] as Weighted<O.AgreementScaleOption>, r),
    q21: pickWeighted([['neither', 3], ['agree', 3], ['disagree', 2]] as Weighted<O.AgreementScaleOption>, r),
    q22: pickWeighted([['disagree', 3], ['strongly_disagree', 1], ['neither', 2]] as Weighted<O.AgreementScaleOption>, r),
    ...baseAnswers(r),
    q26: q26For(r, p),
    q27: r() < 0.3 ? 'Pulling numbers out of several spreadsheets into one monthly view.' : undefined,
    q28: pickWeighted([['very_interested', 3], ['extremely_interested', 2], ['moderately_interested', 2]] as Weighted<O.Q28Option>, r),
  }),
};

const interestedNonAdopters: Cohort = {
  key: 'interested_non_adopters',
  description: 'High interest, very low adoption, weak enablement. Drives R04 and suppresses R07.',
  count: 10,
  profile: { useIntensity: 0.05, painIntensity: 1.2 },
  build: (r, p) => ({
    q4: pickWeighted([['tried_rarely', 3], ['few_times_month', 2], ['never', 1]] as Weighted<O.Q4Option>, r),
    q5: pickWeighted([['less_than_monthly', 3], ['never', 2], ['few_times_month', 1]] as Weighted<O.Q5Option>, r),
    q6: pickWeighted([[['no_work_ai_use'], 2], [['unsure_which_count'], 2], [['chatgpt'], 1]] as Weighted<O.Q6Option[]>, r),
    q7: q7For(r, p),
    q8: pickWeighted([['slightly_confident', 3], ['not_confident', 2]] as Weighted<O.ConfidenceScaleOption>, r),
    q9: pickWeighted([['not_confident', 2], ['not_done_this', 3]] as Weighted<O.ConfidenceScaleOption>, r),
    q10: pickWeighted([['slightly_confident', 2], ['not_done_this', 2]] as Weighted<O.ConfidenceScaleOption>, r),
    q11: pickWeighted([['slightly_confident', 2], ['not_confident', 2]] as Weighted<O.ConfidenceScaleOption>, r),
    q12: pickWeighted([['occasional_experiments', 3], ['no_work_ai_use', 2]] as Weighted<O.Q12Option>, r),
    q13: pickWeighted([['never', 3], ['no_ai_use', 2], ['rarely', 1]] as Weighted<O.Q13Option>, r),
    q14: pickWeighted([['see_opportunities', 4], ['no', 2]] as Weighted<O.Q14Option>, r),
    q15: ['none_of_these'],
    q16: pickWeighted([['not_applicable', 3], ['sometimes', 2]] as Weighted<O.FrequencyScaleOption>, r),
    q17: pickWeighted([['not_applicable', 2], ['usually', 2]] as Weighted<O.FrequencyScaleOption>, r),
    q18: pickWeighted([['unsure', 3], ['slightly_confident', 2]] as Weighted<O.Q18Option>, r),
    q19: pickWeighted([['unsure', 3], ['not_defined', 2], ['no', 2]] as Weighted<O.Q19Option>, r),
    q19b: pickWeighted([['no_org_provided_access', 3], ['never', 2], ['rarely', 1]] as Weighted<O.Q19bOption>, r),
    q20: pickWeighted([['strongly_disagree', 3], ['unsure', 2], ['disagree', 2]] as Weighted<O.AgreementScaleOption>, r),
    q21: pickWeighted([['strongly_disagree', 3], ['disagree', 2]] as Weighted<O.AgreementScaleOption>, r),
    q22: pickWeighted([['strongly_disagree', 3], ['disagree', 2]] as Weighted<O.AgreementScaleOption>, r),
    ...baseAnswers(r),
    q26: q26For(r, p),
    q27: r() < 0.5 ? 'Cleaning up data that arrives in a different format every month.' : undefined,
    q28: pickWeighted([['extremely_interested', 3], ['very_interested', 3]] as Weighted<O.Q28Option>, r),
  }),
};

const explorers: Cohort = {
  key: 'explorers',
  description: 'Level 1 Explorer. Occasional experimentation only.',
  count: 8,
  profile: { useIntensity: 0.25, painIntensity: 1.0 },
  build: (r, p) => ({
    q4: pickWeighted([['few_times_month', 3], ['tried_rarely', 2]] as Weighted<O.Q4Option>, r),
    q5: pickWeighted([['less_than_monthly', 3], ['few_times_month', 1]] as Weighted<O.Q5Option>, r),
    q6: multi(r, ['chatgpt', 'built_in_ai_features', 'unsure_which_count'] as const, 1, 2),
    q7: q7For(r, p),
    q8: pickWeighted([['slightly_confident', 3], ['somewhat_confident', 2]] as Weighted<O.ConfidenceScaleOption>, r),
    q9: pickWeighted([['slightly_confident', 3], ['not_done_this', 2]] as Weighted<O.ConfidenceScaleOption>, r),
    q10: pickWeighted([['slightly_confident', 3], ['somewhat_confident', 2]] as Weighted<O.ConfidenceScaleOption>, r),
    q11: pickWeighted([['not_confident', 2], ['slightly_confident', 3]] as Weighted<O.ConfidenceScaleOption>, r),
    q12: 'occasional_experiments',
    q13: pickWeighted([['rarely', 3], ['never', 2]] as Weighted<O.Q13Option>, r),
    q14: pickWeighted([['see_opportunities', 3], ['no', 2], ['unsure', 1]] as Weighted<O.Q14Option>, r),
    q15: pickWeighted([[['none_of_these'], 3], [['not_sure_meaning'], 2]] as Weighted<O.Q15Option[]>, r),
    q16: pickWeighted([['sometimes', 3], ['usually', 2], ['not_applicable', 1]] as Weighted<O.FrequencyScaleOption>, r),
    q17: pickWeighted([['usually', 3], ['always', 2], ['sometimes', 1]] as Weighted<O.FrequencyScaleOption>, r),
    q18: pickWeighted([['slightly_confident', 3], ['unsure', 2], ['somewhat_confident', 1]] as Weighted<O.Q18Option>, r),
    q19: pickWeighted([['unsure', 2], ['not_defined', 2], ['general_idea', 2]] as Weighted<O.Q19Option>, r),
    q19b: pickWeighted([['never', 3], ['rarely', 2], ['no_org_provided_access', 2]] as Weighted<O.Q19bOption>, r),
    q20: pickWeighted([['unsure', 2], ['disagree', 3], ['strongly_disagree', 1]] as Weighted<O.AgreementScaleOption>, r),
    q21: pickWeighted([['disagree', 3], ['neither', 2]] as Weighted<O.AgreementScaleOption>, r),
    q22: pickWeighted([['strongly_disagree', 2], ['disagree', 3]] as Weighted<O.AgreementScaleOption>, r),
    ...baseAnswers(r),
    q26: q26For(r, p),
    q28: pickWeighted([['moderately_interested', 3], ['very_interested', 2], ['slightly_interested', 1]] as Weighted<O.Q28Option>, r),
  }),
};

const nonUsers: Cohort = {
  key: 'non_users',
  description: 'Level 0 Non-user with low interest. Exercises the R08 direction and Not Assessed paths.',
  count: 4,
  profile: { useIntensity: 0, painIntensity: 1.1 },
  build: (r, p) => ({
    q4: pickWeighted([['never', 3], ['tried_rarely', 1]] as Weighted<O.Q4Option>, r),
    q5: 'never',
    q6: ['no_work_ai_use'],
    q7: q7For(r, p),
    q8: 'not_done_this',
    q9: 'not_done_this',
    q10: pickWeighted([['not_done_this', 2], ['not_confident', 1]] as Weighted<O.ConfidenceScaleOption>, r),
    q11: pickWeighted([['not_confident', 2], ['not_done_this', 1]] as Weighted<O.ConfidenceScaleOption>, r),
    q12: 'no_work_ai_use',
    q13: 'no_ai_use',
    q14: 'no',
    q15: ['none_of_these'],
    q16: 'not_applicable',
    q17: 'not_applicable',
    q18: pickWeighted([['unsure', 2], ['somewhat_confident', 1]] as Weighted<O.Q18Option>, r),
    q19: pickWeighted([['unsure', 2], ['not_defined', 2]] as Weighted<O.Q19Option>, r),
    q19b: pickWeighted([['never', 3], ['prefer_not_to_say', 1]] as Weighted<O.Q19bOption>, r),
    q20: pickWeighted([['unsure', 2], ['disagree', 2]] as Weighted<O.AgreementScaleOption>, r),
    q21: pickWeighted([['disagree', 2], ['neither', 1]] as Weighted<O.AgreementScaleOption>, r),
    q22: pickWeighted([['strongly_disagree', 2], ['disagree', 2]] as Weighted<O.AgreementScaleOption>, r),
    ...baseAnswers(r),
    q26: q26For(r, p),
    q28: pickWeighted([['not_interested', 2], ['slightly_interested', 2]] as Weighted<O.Q28Option>, r),
  }),
};

const partialResponses: Cohort = {
  key: 'partial_responses',
  description:
    'Deliberately incomplete responses. Exercises the 60% validity threshold and typed Not Assessed results.',
  count: 2,
  profile: { useIntensity: 0.5, painIntensity: 0.9 },
  build: (r, p) => ({
    q4: 'few_times_week',
    q5: 'few_times_week',
    q7: q7For(r, p),
    // Only two of four Confidence items answered: 50% valid weight, below the
    // 60% threshold, so Confidence must come back Not Assessed.
    q8: 'somewhat_confident',
    q9: 'not_done_this',
    q10: 'not_done_this',
    q12: 'regular_individual_tasks',
    q13: 'sometimes',
    q14: 'unsure',
    q15: ['none_of_these'],
    // Q16 and Q17 both Not Applicable leaves Safety at 30% valid weight.
    q16: 'not_applicable',
    q17: 'not_applicable',
    q18: pickWeighted([['somewhat_confident', 1], ['unsure', 1]] as Weighted<O.Q18Option>, r),
    q19: 'unsure',
    q19b: 'prefer_not_to_say',
    q20: 'unsure',
    q21: 'neither',
    q22: 'disagree',
    q23: ['not_enough_time'],
    q24: ['ai_basics'],
    q25: ['short_tutorials'],
    q26: q26For(r, p),
    q28: 'unsure',
  }),
};

export const FIXTURE_COHORTS: readonly Cohort[] = [
  builders,
  workflowUsers,
  heavyUsersWeakSafety,
  regularUsers,
  interestedNonAdopters,
  explorers,
  nonUsers,
  partialResponses,
];

/**
 * Work-context assignment.
 *
 * Deliberately uneven so the fixture contains BOTH reportable segments (large
 * enough segment and complement) and suppressed ones. `legal_compliance` and
 * `product_design` sit below the minimum reporting group on purpose.
 */
const DEPARTMENT_PLAN: readonly (readonly [O.Q1Option, number])[] = [
  ['it_technology', 12],
  ['marketing_communications', 11],
  ['customer_service', 10],
  ['finance_accounting', 9],
  ['administration_operations', 9],
  ['human_resources', 8],
  ['sales_business_development', 7],
  ['legal_compliance', 3],
  ['product_design', 3],
  ['prefer_not_to_say', 3],
];

const ROLE_PLAN: readonly (readonly [O.Q2Option, number])[] = [
  ['individual_contributor', 41],
  ['team_lead', 12],
  ['manager', 11],
  ['senior_manager', 6],
  ['executive_owner', 3],
  ['prefer_not_to_say', 2],
];

const WORK_TYPE_PLAN: readonly (readonly [O.Q3Option, number])[] = [
  ['documents_information_data', 20],
  ['people_customers', 16],
  ['content_communications', 13],
  ['planning_management_decision', 11],
  ['technical_systems', 9],
  ['even_mix', 4],
  ['prefer_not_to_say', 2],
];

function expandPlan<T>(plan: readonly (readonly [T, number])[]): T[] {
  return plan.flatMap(([value, count]) => Array.from({ length: count }, () => value));
}

export function generateFixtureResponses(seed: number = FIXTURE_SEED): SurveyResponse[] {
  const random = seededRandom(seed);

  const cohortAnswers: { readonly cohort: string; readonly answers: SurveyAnswers }[] = [];
  for (const cohort of FIXTURE_COHORTS) {
    for (let i = 0; i < cohort.count; i += 1) {
      cohortAnswers.push({ cohort: cohort.key, answers: cohort.build(random, cohort.profile) });
    }
  }

  const departments = expandPlan(DEPARTMENT_PLAN);
  const roles = expandPlan(ROLE_PLAN);
  const workTypes = expandPlan(WORK_TYPE_PLAN);

  if (
    departments.length !== cohortAnswers.length ||
    roles.length !== cohortAnswers.length ||
    workTypes.length !== cohortAnswers.length
  ) {
    throw new Error(
      `Work-context plans must cover exactly ${cohortAnswers.length} respondents ` +
        `(got ${departments.length}/${roles.length}/${workTypes.length})`,
    );
  }

  // Rotate rather than shuffle so department membership is spread across
  // cohorts deterministically and does not correlate perfectly with behaviour.
  return cohortAnswers.map((entry, index) => {
    const answers: SurveyAnswers = {
      q1: departments[(index * 7) % departments.length],
      q2: roles[(index * 11) % roles.length],
      q3: workTypes[(index * 13) % workTypes.length],
      ...entry.answers,
    };
    return {
      id: `fixture-${String(index + 1).padStart(3, '0')}`,
      submittedOn: SUBMISSION_DAYS[index % SUBMISSION_DAYS.length] as string,
      surveyVersion: SURVEY_VERSION,
      answers: stripUndefined(answers),
    };
  });
}

/** JSON has no `undefined`; drop absent answers so the fixture round-trips exactly. */
function stripUndefined(answers: SurveyAnswers): SurveyAnswers {
  return Object.fromEntries(
    Object.entries(answers).filter(([, value]) => value !== undefined),
  ) as SurveyAnswers;
}

export const FIXTURE_COHORT_SUMMARY = FIXTURE_COHORTS.map((c) => ({
  key: c.key,
  count: c.count,
  description: c.description,
}));
