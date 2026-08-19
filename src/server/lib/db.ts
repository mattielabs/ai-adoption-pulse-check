/**
 * D1 access helpers.
 *
 * Every query in this codebase is parameterized with `.bind(...)`. String
 * interpolation into SQL is not used anywhere and must not be introduced.
 * Spec 59.
 */

import type { Env } from '../env.js';

export interface DatabaseStatus {
  readonly reachable: boolean;
  /** Whether the initial migration has been applied. */
  readonly migrated: boolean;
}

/**
 * A cheap liveness probe for the health endpoint.
 *
 * Reads only from `sqlite_master`, so it neither touches nor reveals any
 * response data.
 */
export async function checkDatabase(env: Env): Promise<DatabaseStatus> {
  try {
    const row = await env.DB.prepare(
      "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN (?, ?, ?, ?)",
    )
      .bind('organizations', 'pulses', 'custom_questions', 'responses')
      .first<{ n: number }>();

    return { reachable: true, migrated: (row?.n ?? 0) === 4 };
  } catch {
    return { reachable: false, migrated: false };
  }
}
