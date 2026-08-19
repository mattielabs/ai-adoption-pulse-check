/**
 * Stable machine-readable option ids for every survey question.
 *
 * These values are written into `responses.answers_json` in D1 and are the
 * permanent semantic record of what a respondent selected. Display copy lives
 * in `questions.ts` and may be reworded freely; changing an id here would
 * silently reinterpret historical data and is therefore forbidden. Spec 56.
 */

import {
  SHARED_WORKFLOW_CATEGORY_IDS,
  USAGE_ONLY_CATEGORY_IDS,
  PAIN_ONLY_CATEGORY_IDS,
  NO_WORK_AI_USE,
  NO_PAIN_CATEGORIES,
} from './categories.js';

// --- Section 1: About Your Work (optional, never scored) ---

export const Q1_OPTIONS = [
  'administration_operations',
  'customer_service',
  'finance_accounting',
  'human_resources',
  'it_technology',
  'leadership_management',
  'marketing_communications',
  'product_design',
  'sales_business_development',
  'legal_compliance',
  'engineering_technical',
  'other',
  'prefer_not_to_say',
] as const;

export const Q2_OPTIONS = [
  'individual_contributor',
  'team_lead',
  'manager',
  'senior_manager',
  'executive_owner',
  'other',
  'prefer_not_to_say',
] as const;

export const Q3_OPTIONS = [
  'people_customers',
  'documents_information_data',
  'content_communications',
  'technical_systems',
  'planning_management_decision',
  'even_mix',
  'other',
  'prefer_not_to_say',
] as const;

// --- Section 2: Current AI Use ---

/** Q4 general AI frequency. Diagnostic only - deliberately NOT part of Adoption. */
export const Q4_OPTIONS = [
  'never',
  'tried_rarely',
  'few_times_month',
  'few_times_week',
  'most_workdays',
  'multiple_times_day',
] as const;

/** Q5 work AI frequency. 70% of Adoption. */
export const Q5_OPTIONS = [
  'never',
  'less_than_monthly',
  'few_times_month',
  'few_times_week',
  'most_workdays',
  'multiple_times_day',
] as const;

/** Q6 tools. Diagnostic only. Tool count is never treated as maturity. */
export const Q6_OPTIONS = [
  'chatgpt',
  'microsoft_copilot',
  'google_gemini',
  'claude',
  'perplexity',
  'built_in_ai_features',
  'ai_coding_tools',
  'ai_media_tools',
  'other',
  'no_work_ai_use',
  'unsure_which_count',
] as const;

/** Q7 AI use cases. 30% of Adoption (as breadth) and one half of the Opportunity Map. */
export const Q7_OPTIONS = [
  ...SHARED_WORKFLOW_CATEGORY_IDS,
  ...USAGE_ONLY_CATEGORY_IDS,
  NO_WORK_AI_USE,
] as const;

// --- Section 3: Confidence (self-reported) ---

export const CONFIDENCE_SCALE_OPTIONS = [
  'not_confident',
  'slightly_confident',
  'somewhat_confident',
  'very_confident',
  'extremely_confident',
  'not_done_this',
] as const;

// --- Section 4: Workflow ---

export const Q12_OPTIONS = [
  'no_work_ai_use',
  'occasional_experiments',
  'regular_individual_tasks',
  'reuse_prompts_approaches',
  'repeatable_processes',
  'built_workflows_tools',
] as const;

export const Q13_OPTIONS = [
  'never',
  'rarely',
  'sometimes',
  'often',
  'almost_always',
  'no_ai_use',
] as const;

export const Q14_OPTIONS = [
  'no',
  'see_opportunities',
  'one_small_process',
  'several_processes',
  'recurring_workflows',
  'unsure',
] as const;

/** Q15 artifacts. Not scored; corroborating evidence for classification only. */
export const Q15_OPTIONS = [
  'reusable_prompt_template',
  'shared_prompt_library',
  'custom_gpt_project',
  'automated_workflow',
  'ai_agent',
  'ai_tool_application',
  'documentation_training',
  'helped_coworkers',
  'none_of_these',
  'not_sure_meaning',
] as const;

// --- Section 5: Safe & Responsible Use ---

export const FREQUENCY_SCALE_OPTIONS = [
  'never',
  'rarely',
  'sometimes',
  'usually',
  'always',
  'not_applicable',
] as const;

/** Q18 uses confidence wording but "Unsure" instead of "I have not done this". */
export const Q18_OPTIONS = [
  'not_confident',
  'slightly_confident',
  'somewhat_confident',
  'very_confident',
  'extremely_confident',
  'unsure',
] as const;

export const Q19_OPTIONS = [
  'yes_clearly',
  'mostly',
  'general_idea',
  'no',
  'not_defined',
  'unsure',
] as const;

/** Q19b independently accessed / unmanaged AI tools. Diagnostic only. */
export const Q19B_OPTIONS = [
  'never',
  'rarely',
  'sometimes',
  'often',
  'no_org_provided_access',
  'prefer_not_to_say',
] as const;

// --- Section 6: Organizational Support ---

export const AGREEMENT_SCALE_OPTIONS = [
  'strongly_disagree',
  'disagree',
  'neither',
  'agree',
  'strongly_agree',
  'unsure',
] as const;

export const Q23_OPTIONS = [
  'dont_know_where_useful',
  'dont_know_how_to_use',
  'not_enough_time',
  'no_access_to_tools',
  'unsure_which_approved',
  'privacy_security_concern',
  'accuracy_concern',
  'doesnt_work_for_tasks',
  'policies_unclear',
  'workflows_incompatible',
  'prefer_current_way',
  'no_need',
  'other',
  'nothing_preventing',
] as const;

// --- Section 7: Learning & Development ---

export const Q24_OPTIONS = [
  'ai_basics',
  'better_prompts',
  'role_specific',
  'research_information',
  'writing_communication',
  'data_spreadsheets',
  'presentations_content',
  'reusable_workflows',
  'automation',
  'ai_agents',
  'org_tools',
  'privacy_security_responsible',
  'accuracy_quality',
  'building_applications',
  'no_training_needed',
  'other',
] as const;

export const Q25_OPTIONS = [
  'short_tutorials',
  'live_workshops',
  'self_paced_courses',
  'written_guides',
  'short_videos',
  'role_specific_examples',
  'one_on_one',
  'learning_by_building',
  'internal_champions',
  'no_training_wanted',
  'other',
] as const;

// --- Section 8: Workflow & Opportunity Discovery ---

export const Q26_OPTIONS = [
  ...SHARED_WORKFLOW_CATEGORY_IDS,
  ...PAIN_ONLY_CATEGORY_IDS,
  NO_PAIN_CATEGORIES,
] as const;

/** Q28 Interest. A diagnostic, never a sixth maturity dimension. */
export const Q28_OPTIONS = [
  'not_interested',
  'slightly_interested',
  'moderately_interested',
  'very_interested',
  'extremely_interested',
  'unsure',
] as const;

export type Q1Option = (typeof Q1_OPTIONS)[number];
export type Q2Option = (typeof Q2_OPTIONS)[number];
export type Q3Option = (typeof Q3_OPTIONS)[number];
export type Q4Option = (typeof Q4_OPTIONS)[number];
export type Q5Option = (typeof Q5_OPTIONS)[number];
export type Q6Option = (typeof Q6_OPTIONS)[number];
export type Q7Option = (typeof Q7_OPTIONS)[number];
export type ConfidenceScaleOption = (typeof CONFIDENCE_SCALE_OPTIONS)[number];
export type Q12Option = (typeof Q12_OPTIONS)[number];
export type Q13Option = (typeof Q13_OPTIONS)[number];
export type Q14Option = (typeof Q14_OPTIONS)[number];
export type Q15Option = (typeof Q15_OPTIONS)[number];
export type FrequencyScaleOption = (typeof FREQUENCY_SCALE_OPTIONS)[number];
export type Q18Option = (typeof Q18_OPTIONS)[number];
export type Q19Option = (typeof Q19_OPTIONS)[number];
export type Q19bOption = (typeof Q19B_OPTIONS)[number];
export type AgreementScaleOption = (typeof AGREEMENT_SCALE_OPTIONS)[number];
export type Q23Option = (typeof Q23_OPTIONS)[number];
export type Q24Option = (typeof Q24_OPTIONS)[number];
export type Q25Option = (typeof Q25_OPTIONS)[number];
export type Q26Option = (typeof Q26_OPTIONS)[number];
export type Q28Option = (typeof Q28_OPTIONS)[number];
