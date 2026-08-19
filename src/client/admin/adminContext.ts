/**
 * Context shared by every admin screen, supplied by the admin layout through
 * the router outlet.
 */

import { useEffect, useRef } from 'react';
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

/**
 * Moves focus to the page heading when a screen mounts, so a keyboard or
 * screen-reader user lands on the new content instead of staying wherever the
 * previous page left them.
 */
export function useHeadingFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return ref;
}
