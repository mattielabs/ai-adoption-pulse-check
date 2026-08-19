/**
 * Admin API response contracts.
 *
 * These live in core rather than in server code because the React admin
 * screens consume them and the client must never import from `src/server`
 * (tsconfig.app only compiles src/client + src/core).
 *
 * Nothing here carries respondent data. The admin surface in Phase 2 is
 * operational: configuration and a response COUNT. Scores, recommendations,
 * opportunities, free text and per-response rows are Phase 3 and must not be
 * added to these shapes.
 */

import type { CustomQuestionType } from '../survey/customQuestions.js';
import type { PulseOperationalState } from '../pulse/status.js';

/** GET /api/admin/session */
export interface AdminSessionState {
  readonly authenticated: boolean;
  /** Whether first-run organization setup has been completed. */
  readonly organizationConfigured: boolean;
}

/** The single configured organization. */
export interface AdminOrganization {
  readonly name: string;
  readonly logoUrl: string | null;
  readonly accentColor: string | null;
  readonly surveyIntro: string | null;
}

/** A custom question as the admin API returns it. */
export interface AdminCustomQuestion {
  /** 1-3. The employee-facing answer key is derived from this (`c1`..`c3`). */
  readonly position: number;
  readonly type: CustomQuestionType;
  readonly questionText: string;
  /** Machine id + display label. Null for free text. */
  readonly options: readonly { readonly id: string; readonly label: string }[] | null;
}

/** One row in the admin Pulse list. */
export interface AdminPulseSummary {
  readonly id: number;
  readonly publicId: string;
  readonly name: string;
  readonly state: PulseOperationalState;
  readonly opensOn: string | null;
  readonly closesOn: string | null;
  readonly responseCount: number;
}

/** GET /api/admin/pulses/:id - operational detail, never analytical. */
export interface AdminPulseDetail extends AdminPulseSummary {
  readonly description: string | null;
  readonly personalResultsEnabled: boolean;
  readonly surveyVersion: string;
  readonly customQuestions: readonly AdminCustomQuestion[];
  /**
   * False once at least one response exists. Configuration that would change
   * what respondents saw is locked from then on, server-side.
   */
  readonly configurationEditable: boolean;
}

export interface AdminPulseListResponse {
  readonly pulses: readonly AdminPulseSummary[];
}

/**
 * Fields the server refuses to change after the first response arrives.
 * Exported so the admin UI can explain the lock using the same list the
 * server enforces, rather than a hand-maintained copy.
 */
export const LOCKED_AFTER_FIRST_RESPONSE = [
  'opensOn',
  'personalResultsEnabled',
  'customQuestions',
] as const;

export type LockedPulseField = (typeof LOCKED_AFTER_FIRST_RESPONSE)[number];
