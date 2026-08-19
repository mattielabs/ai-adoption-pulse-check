/**
 * The public Pulse contract - what GET /api/pulses/:publicId returns.
 *
 * This lives in core (not in server code) because the client and the Worker
 * both consume it and the client must never import from src/server. It
 * contains ONLY what the employee experience needs to render:
 *
 *   - no internal database ids;
 *   - no response counts;
 *   - no admin configuration;
 *   - no organization analytics.
 *
 * Spec 8 (Phase 1 brief).
 */

import type { PulseAvailability } from './availability.js';
import type { PublicCustomQuestion } from '../survey/customQuestions.js';

export interface PublicPulseOrganization {
  readonly name: string;
  readonly logoUrl: string | null;
  /** #rrggbb, validated at the storage layer. Re-validate before injecting into CSS. */
  readonly accentColor: string | null;
  /** Optional replacement for the default survey intro copy. */
  readonly surveyIntro: string | null;
}

export interface PublicPulse {
  readonly publicId: string;
  readonly name: string;
  readonly description: string | null;
  /**
   * not_found never appears here - a Pulse that should not be visible is a
   * 404 at the API layer, indistinguishable from an id that never existed.
   */
  readonly availability: Exclude<PulseAvailability, 'not_found'>;
  readonly opensOn: string | null;
  readonly closesOn: string | null;
  readonly personalResultsEnabled: boolean;
  readonly surveyVersion: string;
  readonly organization: PublicPulseOrganization;
  readonly customQuestions: readonly PublicCustomQuestion[];
}
