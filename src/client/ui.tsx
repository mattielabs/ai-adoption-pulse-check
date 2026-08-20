/**
 * Shared admin interface pieces.
 *
 * Accessibility decisions that are easy to lose in a refactor, so they live in
 * one place: every field owns its label and wires help and error text through
 * `aria-describedby`; errors are announced; status is never communicated by
 * colour alone; and destructive confirmation uses a native `<dialog>`, which
 * brings real modal semantics, focus containment and Escape handling with it
 * rather than an approximation built from divs.
 */

import { useEffect, useId, useRef, useState } from 'react';
import type { PulseOperationalState } from '../core/pulse/status.js';
import { BUTTON_STYLES, INPUT_CLASS, STATE_LABELS, STATE_STYLES } from './uiTokens.js';

/** Status carries its own words; the colour is decoration. */
export function StatusBadge({ state }: { readonly state: PulseOperationalState }) {
  return (
    <span
      data-testid={`pulse-state-${state}`}
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATE_STYLES[state]}`}
    >
      {STATE_LABELS[state]}
    </span>
  );
}

interface FieldShellProps {
  readonly label: string;
  readonly required?: boolean;
  readonly help?: string;
  readonly error?: string | undefined;
  readonly children: (props: {
    readonly id: string;
    readonly describedBy: string | undefined;
    readonly invalid: boolean;
  }) => React.ReactNode;
}

export function Field({ label, required = false, help, error, children }: FieldShellProps) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [help !== undefined ? helpId : null, error !== undefined ? errorId : null]
    .filter((value): value is string => value !== null)
    .join(' ');

  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-medium text-slate-900">
        {label}
        {required && <span className="text-slate-500"> *</span>}
      </label>
      {help !== undefined && (
        <p id={helpId} className="mt-0.5 text-xs text-slate-600">
          {help}
        </p>
      )}
      <div className="mt-1.5">
        {children({ id, describedBy: describedBy === '' ? undefined : describedBy, invalid: error !== undefined })}
      </div>
      {error !== undefined && (
        <p id={errorId} className="mt-1 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

interface TextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly required?: boolean;
  readonly help?: string;
  readonly error?: string | undefined;
  readonly type?: 'text' | 'url' | 'date' | 'password';
  readonly maxLength?: number;
  readonly testId?: string;
  readonly autoComplete?: string;
}

export function TextField({
  label,
  value,
  onChange,
  required = false,
  help,
  error,
  type = 'text',
  maxLength,
  testId,
  autoComplete,
}: TextFieldProps) {
  return (
    <Field label={label} required={required} {...(help === undefined ? {} : { help })} error={error}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={INPUT_CLASS}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          {...(maxLength === undefined ? {} : { maxLength })}
          {...(testId === undefined ? {} : { 'data-testid': testId })}
          {...(autoComplete === undefined ? {} : { autoComplete })}
        />
      )}
    </Field>
  );
}

interface TextAreaFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly help?: string;
  readonly error?: string | undefined;
  readonly maxLength: number;
  readonly rows?: number;
  readonly testId?: string;
}

export function TextAreaField({
  label,
  value,
  onChange,
  help,
  error,
  maxLength,
  rows = 3,
  testId,
}: TextAreaFieldProps) {
  return (
    <Field label={label} {...(help === undefined ? {} : { help })} error={error}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          value={value}
          rows={rows}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          className={`${INPUT_CLASS} min-h-24`}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          {...(testId === undefined ? {} : { 'data-testid': testId })}
        />
      )}
    </Field>
  );
}

interface CheckboxFieldProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly help?: string;
  readonly disabled?: boolean;
  readonly testId?: string;
}

export function CheckboxField({
  label,
  checked,
  onChange,
  help,
  disabled = false,
  testId,
}: CheckboxFieldProps) {
  const id = useId();
  const helpId = `${id}-help`;

  return (
    <div className="mb-4 flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={help === undefined ? undefined : helpId}
        className="mt-1 h-5 w-5 shrink-0 rounded border-slate-400"
        {...(testId === undefined ? {} : { 'data-testid': testId })}
      />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-900">
          {label}
        </label>
        {help !== undefined && (
          <p id={helpId} className="text-xs text-slate-600">
            {help}
          </p>
        )}
      </div>
    </div>
  );
}

/** An announced, non-colour-dependent error message. */
export function ErrorAlert({ children, testId }: { readonly children: React.ReactNode; readonly testId?: string }) {
  return (
    <p
      role="alert"
      className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
      {...(testId === undefined ? {} : { 'data-testid': testId })}
    >
      {children}
    </p>
  );
}

export function SuccessNotice({ children }: { readonly children: React.ReactNode }) {
  return (
    <p
      role="status"
      data-testid="success-notice"
      className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900"
    >
      {children}
    </p>
  );
}

/**
 * Copies the public survey link and confirms it in a live region, so the
 * confirmation reaches a screen reader rather than only appearing next to the
 * button.
 */
export function CopyLinkButton({ url }: { readonly url: string }) {
  const [outcome, setOutcome] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (outcome !== 'copied') return;
    const timer = setTimeout(() => setOutcome('idle'), 4000);
    return () => clearTimeout(timer);
  }, [outcome]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        data-testid="copy-link"
        className={BUTTON_STYLES.secondary}
        onClick={() => {
          const clipboard = navigator.clipboard;
          if (clipboard === undefined) {
            setOutcome('failed');
            return;
          }
          void clipboard.writeText(url).then(
            () => setOutcome('copied'),
            // A browser can refuse clipboard access. Say so, rather than
            // leaving the administrator to assume the link was copied.
            () => setOutcome('failed'),
          );
        }}
      >
        Copy link
      </button>
      <span role="status" data-testid="copy-status" className="text-sm text-slate-700">
        {outcome === 'copied' ? 'Link copied.' : ''}
        {outcome === 'failed' ? 'Could not copy. Select the link above and copy it manually.' : ''}
      </span>
    </div>
  );
}

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly confirmLabel: string;
  /** Distinguishes dialogs rendered by the same screen. */
  readonly testId: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly confirmDisabled?: boolean;
  readonly children: React.ReactNode;
}

/**
 * Native `<dialog>` in modal mode: the browser supplies the dialog role, the
 * inert background, focus containment and Escape-to-close.
 */
export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  testId,
  onCancel,
  onConfirm,
  confirmDisabled = false,
  children,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      data-testid={testId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="w-[min(30rem,92vw)] rounded-lg border border-slate-300 p-0 backdrop:bg-slate-900/40"
    >
      <div className="p-5">
        <h2 id={headingId} className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <div className="mt-2 text-sm text-slate-700">{children}</div>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button type="button" className={BUTTON_STYLES.secondary} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            data-testid={`${testId}-confirm`}
            className={BUTTON_STYLES.danger}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
