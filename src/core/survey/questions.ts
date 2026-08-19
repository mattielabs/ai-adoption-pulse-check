/**
 * The V1.1 survey definition: 28 core questions plus Q19b.
 *
 * This is the single source of truth consumed by validation, scoring,
 * fixtures, tests and (in a later phase) the survey UI. Nothing may redefine
 * a question elsewhere.
 *
 * Two things are kept strictly apart:
 *   - `id` / option ids  -> stable machine values, stored in D1, never changed
 *   - `prompt` / `label` -> display copy, freely rewordable
 *
 * Spec 8-10, 56.
 */

import * as O from './options.js';

export const SURVEY_SECTIONS = [
  'about_your_work',
  'current_ai_use',
  'confidence',
  'workflow',
  'safe_responsible_use',
  'organizational_support',
  'learning_development',
  'workflow_opportunity_discovery',
] as const;

export type SurveySectionId = (typeof SURVEY_SECTIONS)[number];

export const SURVEY_SECTION_LABELS: Readonly<Record<SurveySectionId, string>> = {
  about_your_work: 'About Your Work',
  current_ai_use: 'Current AI Use',
  confidence: 'Confidence',
  workflow: 'How AI Fits Into Your Workflow',
  safe_responsible_use: 'Safe & Responsible Use',
  organizational_support: 'Organizational Support',
  learning_development: 'Learning & Development',
  workflow_opportunity_discovery: 'Workflow & Opportunity Discovery',
};

/** The five separate maturity dimensions. There is deliberately no combined score. */
export const DIMENSIONS = ['adoption', 'confidence', 'workflow', 'safety', 'enablement'] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const QUESTION_IDS = [
  'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7',
  'q8', 'q9', 'q10', 'q11',
  'q12', 'q13', 'q14', 'q15',
  'q16', 'q17', 'q18', 'q19', 'q19b',
  'q20', 'q21', 'q22', 'q23',
  'q24', 'q25',
  'q26', 'q27', 'q28',
] as const;

export type QuestionId = (typeof QUESTION_IDS)[number];

export type QuestionType = 'single_select' | 'multi_select' | 'free_text';

export interface QuestionOption {
  /** Stable machine value. Stored in D1. Never change. */
  readonly id: string;
  /** Display copy. Safe to change without affecting historical meaning. */
  readonly label: string;
}

interface QuestionBase {
  readonly id: QuestionId;
  readonly section: SurveySectionId;
  readonly type: QuestionType;
  readonly required: boolean;
  /** Whether this question feeds a maturity dimension score. */
  readonly scored: boolean;
  /** The dimension it contributes to, or null for diagnostic-only questions. */
  readonly dimension: Dimension | null;
  readonly prompt: string;
  readonly helperText?: string;
}

export interface SelectQuestion extends QuestionBase {
  readonly type: 'single_select' | 'multi_select';
  readonly options: readonly QuestionOption[];
  /** Only meaningful for multi_select. `null` means unlimited. */
  readonly maxSelections: number | null;
}

export interface FreeTextQuestion extends QuestionBase {
  readonly type: 'free_text';
  readonly maxLength: number;
}

export type SurveyQuestion = SelectQuestion | FreeTextQuestion;

/** Q27 and any custom free-text answer are capped to limit accidental disclosure. Spec 59. */
export const FREE_TEXT_MAX_LENGTH = 1000;

function opts(ids: readonly string[], labels: readonly string[]): readonly QuestionOption[] {
  if (ids.length !== labels.length) {
    throw new Error('Option id/label length mismatch in survey definition');
  }
  return ids.map((id, i) => ({ id, label: labels[i] as string }));
}

const CONFIDENCE_LABELS = [
  'Not confident',
  'Slightly confident',
  'Somewhat confident',
  'Very confident',
  'Extremely confident',
  'I have not done this',
] as const;

const FREQUENCY_LABELS = [
  'Never',
  'Rarely',
  'Sometimes',
  'Usually',
  'Always',
  'Not applicable',
] as const;

const AGREEMENT_LABELS = [
  'Strongly disagree',
  'Disagree',
  'Neither agree nor disagree',
  'Agree',
  'Strongly agree',
  'Unsure',
] as const;

const SHARED_CATEGORY_LABELS = [
  'Email and communication',
  'Meetings and follow-up',
  'Research and finding information',
  'Writing documents and reports',
  'Reviewing or summarizing documents',
  'Data entry and cleanup',
  'Spreadsheets and analysis',
  'Presentations',
  'Scheduling and coordination',
  'Customer questions and support',
  'Creating content',
  'Planning and project management',
] as const;

export const SURVEY_QUESTIONS: readonly SurveyQuestion[] = [
  {
    id: 'q1',
    section: 'about_your_work',
    type: 'single_select',
    required: false,
    scored: false,
    dimension: null,
    prompt: 'Which area best describes your work?',
    maxSelections: null,
    options: opts(O.Q1_OPTIONS, [
      'Administration / Operations',
      'Customer Service / Customer Success',
      'Finance / Accounting',
      'Human Resources / People & Culture',
      'IT / Technology',
      'Leadership / Management',
      'Marketing / Communications',
      'Product / Design',
      'Sales / Business Development',
      'Legal / Compliance',
      'Engineering / Technical',
      'Other',
      'Prefer not to say',
    ]),
  },
  {
    id: 'q2',
    section: 'about_your_work',
    type: 'single_select',
    required: false,
    scored: false,
    dimension: null,
    prompt: 'Which best describes your role level?',
    maxSelections: null,
    options: opts(O.Q2_OPTIONS, [
      'Individual contributor',
      'Team lead / Supervisor',
      'Manager',
      'Senior manager / Department leader',
      'Executive / Owner',
      'Other',
      'Prefer not to say',
    ]),
  },
  {
    id: 'q3',
    section: 'about_your_work',
    type: 'single_select',
    required: false,
    scored: false,
    dimension: null,
    prompt: 'Which description best matches most of your work?',
    maxSelections: null,
    options: opts(O.Q3_OPTIONS, [
      'Mostly working with people/customers',
      'Mostly working with documents, information or data',
      'Mostly creating content or communications',
      'Mostly technical or systems work',
      'Mostly planning, management or decision-making',
      'A fairly even mix',
      'Other',
      'Prefer not to say',
    ]),
  },
  {
    id: 'q4',
    section: 'current_ai_use',
    type: 'single_select',
    required: true,
    scored: false,
    dimension: null,
    prompt: 'How often do you currently use generative AI tools?',
    helperText:
      'Examples may include ChatGPT, Claude, Gemini, Microsoft Copilot or similar tools.',
    maxSelections: null,
    options: opts(O.Q4_OPTIONS, [
      'Never',
      'I have tried them, but rarely use them',
      'A few times per month',
      'A few times per week',
      'Most workdays',
      'Multiple times per day',
    ]),
  },
  {
    id: 'q5',
    section: 'current_ai_use',
    type: 'single_select',
    required: true,
    scored: true,
    dimension: 'adoption',
    prompt: 'How often do you use AI specifically for work-related tasks?',
    maxSelections: null,
    options: opts(O.Q5_OPTIONS, [
      'Never',
      'Less than monthly',
      'A few times per month',
      'A few times per week',
      'Most workdays',
      'Multiple times per day',
    ]),
  },
  {
    id: 'q6',
    section: 'current_ai_use',
    type: 'multi_select',
    required: true,
    scored: false,
    dimension: null,
    prompt: 'Which AI tools do you currently use for work?',
    maxSelections: null,
    options: opts(O.Q6_OPTIONS, [
      'ChatGPT',
      'Microsoft Copilot',
      'Google Gemini',
      'Claude',
      'Perplexity',
      'AI features built into software I already use',
      'AI coding/development tools',
      'AI image/video/audio tools',
      'Other',
      'I do not currently use AI for work',
      'I am not sure which tools count as AI',
    ]),
  },
  {
    id: 'q7',
    section: 'current_ai_use',
    type: 'multi_select',
    required: true,
    scored: true,
    dimension: 'adoption',
    prompt: 'What do you currently use AI for at work?',
    maxSelections: null,
    options: opts(O.Q7_OPTIONS, [
      ...SHARED_CATEGORY_LABELS,
      'Coding or technical work',
      'Creating images, video or audio',
      'Building workflows, automations or tools',
      'Other',
      'I do not currently use AI for work',
    ]),
  },
  {
    id: 'q8',
    section: 'confidence',
    type: 'single_select',
    required: true,
    scored: true,
    dimension: 'confidence',
    prompt:
      'How confident are you giving an AI tool clear instructions for what you want it to do?',
    maxSelections: null,
    options: opts(O.CONFIDENCE_SCALE_OPTIONS, CONFIDENCE_LABELS),
  },
  {
    id: 'q9',
    section: 'confidence',
    type: 'single_select',
    required: true,
    scored: true,
    dimension: 'confidence',
    prompt:
      'How confident are you adding useful context, examples or constraints when the first AI answer is not good enough?',
    maxSelections: null,
    options: opts(O.CONFIDENCE_SCALE_OPTIONS, CONFIDENCE_LABELS),
  },
  {
    id: 'q10',
    section: 'confidence',
    type: 'single_select',
    required: true,
    scored: true,
    dimension: 'confidence',
    prompt:
      'How confident are you reviewing an AI response and deciding whether it is accurate and useful?',
    maxSelections: null,
    options: opts(O.CONFIDENCE_SCALE_OPTIONS, CONFIDENCE_LABELS),
  },
  {
    id: 'q11',
    section: 'confidence',
    type: 'single_select',
    required: true,
    scored: true,
    dimension: 'confidence',
    prompt: 'How confident are you deciding when AI is - and is not - appropriate for a work task?',
    maxSelections: null,
    options: opts(O.CONFIDENCE_SCALE_OPTIONS, CONFIDENCE_LABELS),
  },
  {
    id: 'q12',
    section: 'workflow',
    type: 'single_select',
    required: true,
    scored: true,
    dimension: 'workflow',
    prompt: 'Which statement best describes how you currently use AI at work?',
    maxSelections: null,
    options: opts(O.Q12_OPTIONS, [
      'I do not currently use AI for work',
      'I experiment occasionally when something comes to mind',
      'I use AI regularly for individual tasks',
      'I regularly reuse prompts or approaches that work well',
      'AI is part of one or more repeatable processes I follow',
      'I have built AI workflows, automations, or tools that I or others use',
    ]),
  },
  {
    id: 'q13',
    section: 'workflow',
    type: 'single_select',
    required: true,
    scored: true,
    dimension: 'workflow',
    prompt:
      'How often do you reuse a prompt, template or saved set of instructions rather than starting from scratch?',
    maxSelections: null,
    options: opts(O.Q13_OPTIONS, [
      'Never',
      'Rarely',
      'Sometimes',
      'Often',
      'Almost always',
      'I do not currently use AI',
    ]),
  },
  {
    id: 'q14',
    section: 'workflow',
    type: 'single_select',
    required: true,
    scored: true,
    dimension: 'workflow',
    prompt: 'Have you changed an existing work process because AI made a different approach possible?',
    maxSelections: null,
    options: opts(O.Q14_OPTIONS, [
      'No',
      'Not yet, but I can see opportunities',
      'Yes, one small process',
      'Yes, several processes',
      'Yes, AI is now built into recurring workflows',
      'Unsure',
    ]),
  },
  {
    id: 'q15',
    section: 'workflow',
    type: 'multi_select',
    required: true,
    scored: false,
    dimension: null,
    prompt: 'Have you ever created or helped create any of the following?',
    maxSelections: null,
    options: opts(O.Q15_OPTIONS, [
      'A reusable prompt or template',
      'A shared prompt library your team can use',
      'A custom GPT, Claude Project, or similar configured AI workspace',
      'An automated workflow that uses AI, for example in Zapier, Power Automate, or n8n',
      'An AI agent - an AI setup that completes multi-step tasks with limited supervision',
      'A tool or application that uses AI',
      'Documentation or training to help other employees use AI',
      'Helped coworkers use AI effectively, informally or formally',
      'None of these',
      'I am not sure what some of these mean',
    ]),
  },
  {
    id: 'q16',
    section: 'safe_responsible_use',
    type: 'single_select',
    required: true,
    scored: true,
    dimension: 'safety',
    prompt:
      'When an AI response contains important facts or information, how often do you verify it before relying on it?',
    maxSelections: null,
    options: opts(O.FREQUENCY_SCALE_OPTIONS, FREQUENCY_LABELS),
  },
  {
    id: 'q17',
    section: 'safe_responsible_use',
    type: 'single_select',
    required: true,
    scored: true,
    dimension: 'safety',
    prompt: 'Before sharing work created with AI, how often do you review and edit the output yourself?',
    maxSelections: null,
    options: opts(O.FREQUENCY_SCALE_OPTIONS, FREQUENCY_LABELS),
  },
  {
    id: 'q18',
    section: 'safe_responsible_use',
    type: 'single_select',
    required: true,
    scored: true,
    dimension: 'safety',
    prompt:
      'How confident are you that you know what company, customer or personal information should not be entered into an AI tool?',
    maxSelections: null,
    options: opts(O.Q18_OPTIONS, [
      'Not confident',
      'Slightly confident',
      'Somewhat confident',
      'Very confident',
      'Extremely confident',
      'Unsure',
    ]),
  },
  {
    id: 'q19',
    section: 'safe_responsible_use',
    type: 'single_select',
    required: true,
    scored: true,
    // Q19 belongs to Enablement only. V1.1 deliberately removed it from Safety.
    dimension: 'enablement',
    prompt: 'Do you know which AI tools your organization has approved for work use?',
    maxSelections: null,
    options: opts(O.Q19_OPTIONS, [
      'Yes, clearly',
      'Mostly',
      'I have a general idea',
      'No',
      'I do not think my organization has defined this',
      'Unsure',
    ]),
  },
  {
    id: 'q19b',
    section: 'safe_responsible_use',
    type: 'single_select',
    required: true,
    scored: false,
    dimension: null,
    prompt:
      'How often, if ever, do you use AI tools or accounts for work that were not provided by your organization?',
    helperText:
      'This does not necessarily mean the tool is prohibited. The question helps identify where employees may be relying on independently accessed AI tools.',
    maxSelections: null,
    options: opts(O.Q19B_OPTIONS, [
      'Never',
      'Rarely',
      'Sometimes',
      'Often',
      'I do not have access to organization-provided AI tools',
      'Prefer not to say',
    ]),
  },
  {
    id: 'q20',
    section: 'organizational_support',
    type: 'single_select',
    required: true,
    scored: true,
    dimension: 'enablement',
    prompt: 'My organization has clearly explained how employees should and should not use AI.',
    maxSelections: null,
    options: opts(O.AGREEMENT_SCALE_OPTIONS, AGREEMENT_LABELS),
  },
  {
    id: 'q21',
    section: 'organizational_support',
    type: 'single_select',
    required: true,
    scored: true,
    dimension: 'enablement',
    prompt: 'I have access to the AI tools I need to use AI effectively in my work.',
    maxSelections: null,
    options: opts(O.AGREEMENT_SCALE_OPTIONS, AGREEMENT_LABELS),
  },
  {
    id: 'q22',
    section: 'organizational_support',
    type: 'single_select',
    required: true,
    scored: true,
    dimension: 'enablement',
    prompt: 'I have received enough guidance or training to use AI effectively and responsibly.',
    maxSelections: null,
    options: opts(O.AGREEMENT_SCALE_OPTIONS, AGREEMENT_LABELS),
  },
  {
    id: 'q23',
    section: 'organizational_support',
    type: 'multi_select',
    required: true,
    scored: false,
    dimension: null,
    prompt: 'What currently makes it harder for you to use AI effectively at work?',
    helperText: 'Select up to three.',
    maxSelections: 3,
    options: opts(O.Q23_OPTIONS, [
      'I do not know where AI would be useful',
      'I do not know how to use AI tools well',
      'I do not have enough time to learn',
      'I do not have access to the right tools',
      'I am unsure which tools are approved',
      'I am concerned about privacy or security',
      'I am concerned about accuracy or unreliable outputs',
      'AI does not work well for my tasks',
      'Company policies or expectations are not clear',
      'My workflows or systems do not work well with AI',
      'I prefer my current way of working',
      'I do not currently see a need for AI',
      'Other',
      'Nothing is currently preventing me from using AI',
    ]),
  },
  {
    id: 'q24',
    section: 'learning_development',
    type: 'multi_select',
    required: true,
    scored: false,
    dimension: null,
    prompt: 'Which areas would you most like help learning?',
    helperText: 'Select up to three.',
    maxSelections: 3,
    options: opts(O.Q24_OPTIONS, [
      'AI basics and understanding what AI can do',
      'Writing better prompts/instructions',
      'Using AI for my specific role',
      'Research and information gathering',
      'Writing and communication',
      'Data, spreadsheets and analysis',
      'Creating presentations or content',
      'Building reusable AI workflows',
      'Automation',
      'AI agents',
      'AI tools available in our organization',
      'Privacy, security and responsible AI use',
      'Checking AI accuracy and quality',
      'Building AI applications or technical solutions',
      'I do not currently need AI training',
      'Other',
    ]),
  },
  {
    id: 'q25',
    section: 'learning_development',
    type: 'multi_select',
    required: true,
    scored: false,
    dimension: null,
    prompt: 'How would you prefer to learn new AI skills?',
    helperText: 'Select up to two.',
    maxSelections: 2,
    options: opts(O.Q25_OPTIONS, [
      'Short practical tutorials',
      'Live workshops',
      'Self-paced courses',
      'Written guides / examples',
      'Short videos',
      'Role-specific examples',
      'One-on-one support',
      'Learning by building a real workflow',
      'Internal AI champions / coworkers',
      'I do not currently want additional training',
      'Other',
    ]),
  },
  {
    id: 'q26',
    section: 'workflow_opportunity_discovery',
    type: 'multi_select',
    required: true,
    scored: false,
    dimension: null,
    prompt: 'Which parts of your work currently take significant time or involve repetitive effort?',
    maxSelections: null,
    options: opts(O.Q26_OPTIONS, [
      ...SHARED_CATEGORY_LABELS,
      'Training or onboarding',
      'Repetitive system updates',
      'Other',
      'None of these',
    ]),
  },
  {
    id: 'q27',
    section: 'workflow_opportunity_discovery',
    type: 'free_text',
    required: false,
    scored: false,
    dimension: null,
    prompt: 'If AI could make one part of your work easier, what would you most want help with?',
    helperText:
      'Describe the task or problem rather than including sensitive information. For example: "Turning meeting notes into follow-up actions" rather than pasting actual meeting notes.',
    maxLength: FREE_TEXT_MAX_LENGTH,
  },
  {
    id: 'q28',
    section: 'workflow_opportunity_discovery',
    type: 'single_select',
    required: true,
    scored: false,
    // Interest is reported separately. It is explicitly not a sixth dimension.
    dimension: null,
    prompt:
      'How interested are you in using AI more in your work if you had the right tools, guidance and support?',
    maxSelections: null,
    options: opts(O.Q28_OPTIONS, [
      'Not interested',
      'Slightly interested',
      'Moderately interested',
      'Very interested',
      'Extremely interested',
      'Unsure',
    ]),
  },
];

export const QUESTIONS_BY_ID: Readonly<Record<QuestionId, SurveyQuestion>> = Object.freeze(
  Object.fromEntries(SURVEY_QUESTIONS.map((q) => [q.id, q])),
) as Readonly<Record<QuestionId, SurveyQuestion>>;

export function getQuestion(id: QuestionId): SurveyQuestion {
  const q = QUESTIONS_BY_ID[id];
  if (!q) throw new Error(`Unknown question id: ${id}`);
  return q;
}

/** Question ids that are never included in the default row-level CSV export. Spec 35.1. */
export const WORK_CONTEXT_QUESTION_IDS = ['q1', 'q2', 'q3'] as const;
export const FREE_TEXT_QUESTION_IDS = ['q27'] as const;
