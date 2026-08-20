/**
 * Context shared by every admin screen, supplied by the admin layout through
 * the router outlet.
 */

import { useOutletContext } from 'react-router-dom';
import type { AdminSessionState } from '../../core/admin/contracts.js';

export interface AdminOutletContext {
  readonly session: AdminSessionState;
  /** Re-reads the session, e.g. after first-run setup completes. */
  readonly refreshSession: () => Promise<void>;
  /** Applies a session state the server just returned (login, logout). */
  readonly setSession: (state: AdminSessionState) => void;
}

export function useAdmin(): AdminOutletContext {
  return useOutletContext<AdminOutletContext>();
}
