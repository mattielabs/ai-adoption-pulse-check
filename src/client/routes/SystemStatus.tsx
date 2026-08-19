/**
 * Development smoke screen.
 *
 * Confirms that the SPA is served by the Worker and that /api/* reaches the
 * Worker rather than falling through to the SPA shell. It also renders the
 * survey definition straight out of `src/core`, which demonstrates that the
 * same versioned schema the server validates against is available in the
 * browser for the local personal result. This is not a product screen.
 */

import { useEffect, useState } from 'react';
import { ENGINE_VERSIONS } from '../../core/versions.js';
import { SURVEY_QUESTIONS } from '../../core/survey/questions.js';

interface VersionResponse {
  readonly surveyVersion: string;
  readonly scoringVersion: string;
  readonly recommendationEngineVersion: string;
  readonly questionCount: number;
}

interface HealthResponse {
  readonly status: string;
  readonly environment: string;
  readonly database: { readonly reachable: boolean; readonly migrated: boolean };
}

type Loadable<T> =
  | { readonly state: 'loading' }
  | { readonly state: 'error'; readonly message: string }
  | { readonly state: 'ready'; readonly data: T };

function useApi<T>(path: string): Loadable<T> {
  const [result, setResult] = useState<Loadable<T>>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch(path)
      .then(async (response) => {
        const body = (await response.json()) as T;
        if (!cancelled) setResult({ state: 'ready', data: body });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({ state: 'error', message: error instanceof Error ? error.message : 'Request failed' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return result;
}

export function SystemStatus() {
  const health = useApi<HealthResponse>('/api/health');
  const version = useApi<VersionResponse>('/api/version');

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 font-sans text-slate-800">
      <h1 className="text-2xl font-semibold">AI Adoption Pulse Check</h1>
      <p className="mt-2 text-sm text-slate-600">
        Phase 0 - deterministic core engine. The survey, personal result and admin
        dashboard are not built yet.
      </p>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Client build</h2>
        <dl className="mt-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-56 text-slate-500">Survey definition loaded</dt>
            <dd data-testid="client-question-count">{SURVEY_QUESTIONS.length} questions</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-56 text-slate-500">Core versions</dt>
            <dd>
              survey {ENGINE_VERSIONS.surveyVersion} / scoring {ENGINE_VERSIONS.scoringVersion} /
              recommendations {ENGINE_VERSIONS.recommendationEngineVersion}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Worker API</h2>
        <dl className="mt-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-56 text-slate-500">/api/health</dt>
            <dd data-testid="health-status">
              {health.state === 'loading' && 'checking...'}
              {health.state === 'error' && `unreachable (${health.message})`}
              {health.state === 'ready' &&
                `${health.data.status} - db reachable ${String(health.data.database.reachable)}, migrated ${String(health.data.database.migrated)}`}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-56 text-slate-500">/api/version</dt>
            <dd data-testid="version-status">
              {version.state === 'loading' && 'checking...'}
              {version.state === 'error' && `unreachable (${version.message})`}
              {version.state === 'ready' &&
                `survey ${version.data.surveyVersion}, ${version.data.questionCount} questions`}
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
