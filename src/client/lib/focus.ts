/**
 * Focus management shared by every screen.
 */

import { useEffect, useRef } from 'react';

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
