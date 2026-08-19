/**
 * Non-survey states: not found, closed, not yet open, load failure, the
 * duplicate-browser notice, and the plain post-submission confirmation used
 * when personal results are disabled.
 *
 * The not-found copy is generic on purpose: it reveals nothing about whether
 * an id exists, existed, or is unpublished.
 */

interface ShellProps {
  readonly title: string;
  readonly children: React.ReactNode;
}

function Shell({ title, children }: ShellProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <div className="mt-2 text-sm text-slate-700">{children}</div>
    </div>
  );
}

export function NotFoundScreen() {
  return (
    <Shell title="This Pulse Check isn't available">
      <p data-testid="pulse-not-found">
        This link doesn&rsquo;t lead to an active Pulse Check. Please check the link with whoever
        shared it with you.
      </p>
    </Shell>
  );
}

export function ClosedScreen() {
  return (
    <Shell title="This Pulse Check is closed">
      <p data-testid="pulse-closed">This Pulse Check is no longer accepting responses.</p>
    </Shell>
  );
}

export function NotYetOpenScreen({ opensOn }: { readonly opensOn: string | null }) {
  return (
    <Shell title="Not open yet">
      <p data-testid="pulse-not-yet-open">
        This Pulse Check is not accepting responses yet.
        {opensOn !== null && <> It is scheduled to open on {opensOn}.</>}
      </p>
    </Shell>
  );
}

export function LoadErrorScreen({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <Shell title="Something went wrong">
      <p>The survey could not be loaded. Please check your connection and try again.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 min-h-11 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700"
      >
        Try again
      </button>
    </Shell>
  );
}

export function AlreadySubmittedScreen({
  hasSnapshot,
  onViewResult,
}: {
  readonly hasSnapshot: boolean;
  readonly onViewResult: () => void;
}) {
  return (
    <Shell title="Already completed on this browser">
      <p data-testid="duplicate-warning">You&rsquo;ve already completed this Pulse Check on this browser.</p>
      <p className="mt-2 text-slate-600">
        This only helps prevent accidental duplicate responses. It does not identify you or
        guarantee one response per employee.
      </p>
      {hasSnapshot && (
        <button
          type="button"
          data-testid="view-my-result"
          onClick={onViewResult}
          className="mt-4 min-h-11 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700"
        >
          View my result
        </button>
      )}
    </Shell>
  );
}

export function SubmittedConfirmationScreen() {
  return (
    <Shell title="Response submitted">
      <p role="status" data-testid="submission-confirmed">
        Your response was submitted. Thank you for taking part.
      </p>
      <p className="mt-2 text-slate-600">
        Results are only shown to your organization for groups that meet the minimum reporting
        threshold.
      </p>
    </Shell>
  );
}
