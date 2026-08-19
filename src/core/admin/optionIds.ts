/**
 * Machine ids for custom-question choices.
 *
 * An administrator types display labels. The stored answer value must be a
 * STABLE MACHINE ID, separate from that display text, for the same reason the
 * core survey uses machine values (spec 56): editing a label later must not
 * change the meaning of answers already collected.
 *
 * Generation is deterministic and collision-free within a question:
 *   - lowercase, non-alphanumeric runs collapse to `_`, trimmed and truncated;
 *   - a label that slugifies to nothing (punctuation or emoji only) falls back
 *     to a positional id;
 *   - two different labels that slugify to the same value get numeric
 *     suffixes, so `A/B` and `A-B` cannot both become `a_b`.
 */

export const OPTION_ID_MAX_LENGTH = 40;

export function slugifyOptionLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, OPTION_ID_MAX_LENGTH)
    .replace(/_+$/g, '');
}

export interface GeneratedOption {
  readonly id: string;
  readonly label: string;
}

/**
 * Builds {id,label} pairs for one question's choices, preserving order.
 * Input labels are assumed already trimmed and validated as non-empty and
 * non-duplicate by the API schema; this function is still total for any input.
 */
export function generateOptionIds(labels: readonly string[]): GeneratedOption[] {
  const used = new Set<string>();

  return labels.map((label, index) => {
    const base = slugifyOptionLabel(label) || `option_${index + 1}`;
    let id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}_${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return { id, label };
  });
}
