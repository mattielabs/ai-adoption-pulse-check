/**
 * Display formatting helpers. No scoring logic lives here - these format
 * values the core engine already produced.
 */

import { roundTo } from '../../core/util/number.js';

/**
 * Employee-facing score display uses ONE decimal place, not whole numbers.
 *
 * The engine compares raw scores against thresholds, so a raw Safety of 49.94
 * can trigger a "below 50" rule. Rounded to a whole number it would display as
 * "50" while being treated as below 50 - a visible contradiction. One decimal
 * (49.9) keeps the display consistent with the engine's behaviour. Trailing
 * ".0" is trimmed for round values. Phase 1 brief 21.
 */
export function formatScore(value: number): string {
  const rounded = roundTo(value, 1);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

const ACCENT_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * Organization accent colours are stored validated, but anything injected into
 * CSS is re-validated here - defence in depth against a corrupt value.
 */
export function safeAccent(color: string | null): string | null {
  return color !== null && ACCENT_PATTERN.test(color) ? color : null;
}

/**
 * Picks a readable text colour for use ON the accent colour, so an
 * organization choosing a pale accent cannot produce white-on-white buttons.
 * WCAG relative luminance; white text requires >= 4.5:1 contrast.
 */
export function accentContrastText(accentHex: string): '#ffffff' | '#0f172a' {
  const channel = (offset: number): number => {
    const raw = parseInt(accentHex.slice(offset, offset + 2), 16) / 255;
    return raw <= 0.04045 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  return contrastWithWhite >= 4.5 ? '#ffffff' : '#0f172a';
}

/** True when a logo URL is safe to render as an image source. */
export function safeLogoUrl(url: string | null): string | null {
  if (url === null) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}
