/**
 * The organization form, shared by first-run setup and the settings screen.
 *
 * Deliberately not a branding designer (brief 38): four fields, a small
 * preview of how the accent will read, and nothing else. Client-side checks
 * mirror the server schema for immediate feedback; the server re-validates
 * everything and its issues are mapped back onto the fields here.
 */

import { useState } from 'react';
import {
  ACCENT_COLOR_PATTERN,
  isHttpUrl,
  ORGANIZATION_NAME_MAX_LENGTH,
  SURVEY_INTRO_MAX_LENGTH,
} from '../../core/admin/schemas.js';
import type { AdminOrganization } from '../../core/admin/contracts.js';
import type { ApiError, OrganizationPayload } from '../lib/adminApi.js';
import { accentContrastText, safeAccent } from '../lib/format.js';
import { ErrorAlert, Field, TextAreaField, TextField } from './ui.js';
import { BUTTON_STYLES } from './uiTokens.js';

type Errors = Partial<Record<'name' | 'logoUrl' | 'accentColor' | 'surveyIntro', string>>;

interface Props {
  readonly initial: AdminOrganization | null;
  readonly submitLabel: string;
  readonly pending: boolean;
  readonly serverError: ApiError | null;
  readonly onSubmit: (payload: OrganizationPayload) => void;
}

function messageFor(error: ApiError | null, field: string): string | undefined {
  return error?.issues.find((issue) => issue.path === field)?.message;
}

export function OrganizationForm({ initial, submitLabel, pending, serverError, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl ?? '');
  const [accentColor, setAccentColor] = useState(initial?.accentColor ?? '');
  const [surveyIntro, setSurveyIntro] = useState(initial?.surveyIntro ?? '');
  const [errors, setErrors] = useState<Errors>({});

  function validate(): Errors {
    const found: Errors = {};
    if (name.trim() === '') found.name = 'Enter your organization name.';
    else if (name.trim().length > ORGANIZATION_NAME_MAX_LENGTH) {
      found.name = `Use at most ${ORGANIZATION_NAME_MAX_LENGTH} characters.`;
    }
    if (logoUrl.trim() !== '' && !isHttpUrl(logoUrl.trim())) {
      found.logoUrl = 'Enter an http:// or https:// URL, or leave this empty.';
    }
    if (accentColor.trim() !== '' && !ACCENT_COLOR_PATTERN.test(accentColor.trim())) {
      found.accentColor = 'Use a six-digit hex colour such as #0f766e.';
    }
    if (surveyIntro.length > SURVEY_INTRO_MAX_LENGTH) {
      found.surveyIntro = `Use at most ${SURVEY_INTRO_MAX_LENGTH} characters.`;
    }
    return found;
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const trimmed = (value: string): string | null => (value.trim() === '' ? null : value.trim());
    onSubmit({
      name: name.trim(),
      logoUrl: trimmed(logoUrl),
      accentColor: trimmed(accentColor),
      surveyIntro: trimmed(surveyIntro),
    });
  }

  const preview = safeAccent(accentColor.trim());

  return (
    <form onSubmit={submit} noValidate>
      {serverError !== null && serverError.issues.length === 0 && (
        <ErrorAlert testId="organization-error">
          {serverError.kind === 'conflict'
            ? 'This deployment already has an organization configured.'
            : 'That could not be saved. Check the fields and try again.'}
        </ErrorAlert>
      )}

      <TextField
        label="Organization name"
        value={name}
        onChange={setName}
        required
        maxLength={ORGANIZATION_NAME_MAX_LENGTH}
        error={errors.name ?? messageFor(serverError, 'name')}
        help="Shown to employees at the top of the survey."
        testId="organization-name"
      />

      <TextField
        label="Logo URL"
        type="url"
        value={logoUrl}
        onChange={setLogoUrl}
        error={errors.logoUrl ?? messageFor(serverError, 'logoUrl')}
        help="Optional. Must be an http:// or https:// image address."
        testId="organization-logo"
      />

      <Field
        label="Accent colour"
        help="Optional. Six-digit hex, for example #0f766e."
        error={errors.accentColor ?? messageFor(serverError, 'accentColor')}
      >
        {({ id, describedBy, invalid }) => (
          <div className="flex flex-wrap items-center gap-3">
            <input
              id={id}
              type="text"
              value={accentColor}
              onChange={(event) => setAccentColor(event.target.value)}
              placeholder="#0f766e"
              maxLength={7}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              data-testid="organization-accent"
              className="min-h-11 w-32 rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm"
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <span>Pick</span>
              <input
                type="color"
                value={preview ?? '#0f172a'}
                onChange={(event) => setAccentColor(event.target.value)}
                className="h-11 w-14 rounded border border-slate-300 bg-white p-1"
              />
            </label>
            {preview !== null && (
              <span
                data-testid="accent-preview"
                className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold"
                style={{ backgroundColor: preview, color: accentContrastText(preview) }}
              >
                Start survey
              </span>
            )}
          </div>
        )}
      </Field>

      <TextAreaField
        label="Survey introduction"
        value={surveyIntro}
        onChange={setSurveyIntro}
        maxLength={SURVEY_INTRO_MAX_LENGTH}
        rows={4}
        error={errors.surveyIntro ?? messageFor(serverError, 'surveyIntro')}
        help="Optional. Plain text only - it replaces the default introduction. The privacy explanation is always shown."
        testId="organization-intro"
      />

      <button type="submit" data-testid="save-organization" disabled={pending} className={BUTTON_STYLES.primary}>
        {pending ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
