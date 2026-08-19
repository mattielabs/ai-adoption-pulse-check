/**
 * Workflow categories shared by Q7 ("what do you use AI for") and Q26 ("what
 * takes significant time / is repetitive").
 *
 * V1.1 deliberately aligns these two questions around one shared list so that
 * "current AI use" and "workflow pain" are directly comparable *by
 * construction*, with no many-to-many mapping table. Only these categories
 * appear in the Opportunity Map. Spec §30, §71.
 *
 * These ids are stored in the database. Never rename one; add a new id instead.
 */

export const SHARED_WORKFLOW_CATEGORY_IDS = [
  'email_communication',
  'meetings_followup',
  'research_information',
  'writing_documents',
  'reviewing_summarizing',
  'data_entry_cleanup',
  'spreadsheets_analysis',
  'presentations',
  'scheduling_coordination',
  'customer_support',
  'creating_content',
  'planning_project_management',
] as const;

export type SharedWorkflowCategoryId = (typeof SHARED_WORKFLOW_CATEGORY_IDS)[number];

/** Display copy for the shared categories. Safe to change; ids are not. */
export const SHARED_WORKFLOW_CATEGORY_LABELS: Readonly<Record<SharedWorkflowCategoryId, string>> = {
  email_communication: 'Email and communication',
  meetings_followup: 'Meetings and follow-up',
  research_information: 'Research and finding information',
  writing_documents: 'Writing documents and reports',
  reviewing_summarizing: 'Reviewing or summarizing documents',
  data_entry_cleanup: 'Data entry and cleanup',
  spreadsheets_analysis: 'Spreadsheets and analysis',
  presentations: 'Presentations',
  scheduling_coordination: 'Scheduling and coordination',
  customer_support: 'Customer questions and support',
  creating_content: 'Creating content',
  planning_project_management: 'Planning and project management',
};

/** Q7-only options: real AI uses that have no matching workflow-pain category. */
export const USAGE_ONLY_CATEGORY_IDS = [
  'coding_technical',
  'creating_media',
  'building_workflows_tools',
  'other',
] as const;

/** Q26-only options: pain areas that have no matching AI-use category. */
export const PAIN_ONLY_CATEGORY_IDS = [
  'training_onboarding',
  'repetitive_system_updates',
  'other',
] as const;

/** Explicit "no AI use" sentinel on Q7. Never counted as a use category. */
export const NO_WORK_AI_USE = 'no_work_ai_use';

/** Explicit "no pain reported" sentinel on Q26. Never counted as a pain category. */
export const NO_PAIN_CATEGORIES = 'none_of_these';

export function isSharedWorkflowCategoryId(value: string): value is SharedWorkflowCategoryId {
  return (SHARED_WORKFLOW_CATEGORY_IDS as readonly string[]).includes(value);
}
