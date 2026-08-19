/**
 * Single-dimension segmentation control.
 *
 * V1 permits exactly one filter dimension at a time, and this control cannot
 * express a second one: there is one "group by" select and one segment select,
 * and changing the dimension clears the segment. Stacked filters are not a
 * disabled option here, they are an unrepresentable state. The server enforces
 * the same rule regardless of what the UI does. Spec 33.
 *
 * Unavailable segments are disabled and labelled, never explained with a
 * count. "Only 3 respondents" would defeat the suppression it is explaining.
 */

import { QUESTIONS_BY_ID } from '../../../core/survey/questions.js';
import {
  SEGMENTATION_QUESTION_BY_DIMENSION,
  isSegmentationDimension,
  type SegmentationDimension,
} from '../../../core/privacy/thresholds.js';
import {
  SEGMENTATION_DIMENSION_LABELS,
  SEGMENTATION_PRIVACY_NOTE,
} from '../../../core/results/methodology.js';
import type { SegmentationState } from '../../../core/results/contracts.js';
import { Field } from '../ui.js';

const SELECT_CLASS =
  'block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-500';

function segmentLabel(dimension: SegmentationDimension, value: string): string {
  const question = QUESTIONS_BY_ID[SEGMENTATION_QUESTION_BY_DIMENSION[dimension]];
  if (question.type === 'free_text') return value;
  return question.options.find((option) => option.id === value)?.label ?? value;
}

interface Props {
  readonly segmentation: SegmentationState;
  /** The dimension currently chosen, before any segment is picked. */
  readonly groupBy: SegmentationDimension | '';
  readonly onGroupByChange: (dimension: SegmentationDimension | '') => void;
  readonly onSegmentChange: (value: string) => void;
  readonly disabled: boolean;
}

export function SegmentControl({
  segmentation,
  groupBy,
  onGroupByChange,
  onSegmentChange,
  disabled,
}: Props) {
  const activeValue = segmentation.active?.value ?? '';
  const options = segmentation.available.find((entry) => entry.dimension === groupBy)?.options ?? [];

  return (
    <section
      aria-labelledby="segment-heading"
      data-testid="segment-control"
      className="mb-5 rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 id="segment-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        View
      </h2>

      <div className="mt-3 grid gap-x-4 sm:grid-cols-2">
        <Field label="Group by" help="One dimension at a time.">
          {({ id, describedBy }) => (
            <select
              id={id}
              aria-describedby={describedBy}
              data-testid="segment-dimension"
              disabled={disabled}
              value={groupBy}
              onChange={(event) => {
                const next = event.target.value;
                onGroupByChange(isSegmentationDimension(next) ? next : '');
              }}
              className={SELECT_CLASS}
            >
              <option value="">All respondents</option>
              {segmentation.available.map((entry) => (
                <option key={entry.dimension} value={entry.dimension}>
                  {SEGMENTATION_DIMENSION_LABELS[entry.dimension]}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field
          label="Segment"
          help={
            groupBy === ''
              ? 'Choose a dimension first.'
              : 'Groups too small to report are unavailable.'
          }
        >
          {({ id, describedBy }) => (
            <select
              id={id}
              aria-describedby={describedBy}
              data-testid="segment-value"
              disabled={disabled || groupBy === ''}
              value={activeValue}
              onChange={(event) => onSegmentChange(event.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">All respondents</option>
              {options.map((option) => (
                <option key={option.value} value={option.value} disabled={!option.reportable}>
                  {segmentLabel(groupBy as SegmentationDimension, option.value)}
                  {option.reportable ? '' : ' - not enough responses to report safely'}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <p className="text-xs text-slate-500">{SEGMENTATION_PRIVACY_NOTE}</p>
    </section>
  );
}
