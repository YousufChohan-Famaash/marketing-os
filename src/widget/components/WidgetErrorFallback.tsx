import type { FallbackProps } from 'react-error-boundary';
import { AlertIcon } from '../utils/icons';

/**
 * Top-level error fallback. Rendered when anything inside the widget throws.
 * Calm copy, retry affordance, and a flag for the host page so analytics can
 * pick up `widget_error` events later.
 */
export function WidgetErrorFallback({ resetErrorBoundary, error }: FallbackProps) {
  return (
    <div
      role="alert"
      className="flex h-full flex-col items-center justify-center gap-3 bg-bg p-6 text-center"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertIcon size={20} aria-hidden="true" />
      </span>
      <div>
        <p className="text-[15px] font-semibold text-ink">
          Chat is temporarily unavailable
        </p>
        <p className="mt-1 text-[13px] text-muted">
          Please refresh. Our team will follow up shortly if the issue persists.
        </p>
      </div>
      <button
        type="button"
        onClick={resetErrorBoundary}
        className="mt-1 rounded-md bg-famaash px-4 py-2 text-[13px] font-medium text-white hover:opacity-95"
      >
        Try again
      </button>
      {import.meta.env?.DEV && error?.message && (
        <pre className="mt-2 max-w-full overflow-auto rounded bg-subtle px-2 py-1 text-left text-[10px] text-muted">
          {error.message}
        </pre>
      )}
    </div>
  );
}
