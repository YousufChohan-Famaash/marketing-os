import { useWidgetStore } from '../store/widgetStore';
import { useT } from '../i18n';

/**
 * Branded connecting / boot state. Instead of a bare "Connecting…", we show a
 * soft skeleton of the chat panel — header, a couple of shimmering incoming
 * bubbles, an animated typing indicator, and a composer placeholder — so the
 * panel reads as a real app materializing and transitions seamlessly into the
 * live chat once boot completes.
 *
 * Shown while `bootStatus` is 'idle' | 'loading' (before /config resolves, so
 * branding may be null → generic copy).
 */
export function ConnectingState() {
  const branding = useWidgetStore((s) => s.branding);
  const name = branding?.name?.trim() || null;
  const t = useT();

  return (
    <div className="flex h-full w-full flex-col bg-white">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
        <div className="h-9 w-9 shrink-0 rounded-full bg-famaash-soft animate-pulse" />
        <div className="flex flex-col gap-1.5">
          <div className="h-2.5 w-28 rounded bg-black/[0.07] animate-pulse" />
          <div className="h-2 w-16 rounded bg-black/[0.05] animate-pulse" />
        </div>
      </div>

      {/* Body — shimmering incoming bubbles + live connecting indicator */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <BubbleSkeleton lines={['72%', '54%']} />
        <BubbleSkeleton lines={['60%']} delay={140} />

        <div className="mt-1 flex items-center gap-2.5">
          <TypingDots />
          <span className="text-[12.5px] font-medium text-muted">
            {name ? `${t('Connecting you to')} ${name}…` : t('Connecting…')}
          </span>
        </div>
      </div>

      {/* Composer skeleton */}
      <div className="p-3">
        <div className="h-11 w-full rounded-2xl bg-black/[0.04] animate-pulse" />
      </div>

      <style>{`
        @keyframes fa-connect-dot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
          40% { transform: translateY(-3px); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .fa-connect-dot { animation: none !important; opacity: 0.6 !important; }
        }
      `}</style>
    </div>
  );
}

function BubbleSkeleton({ lines, delay = 0 }: { lines: string[]; delay?: number }) {
  return (
    <div
      className="max-w-[80%] animate-pulse rounded-2xl rounded-tl-md bg-black/[0.04] px-3.5 py-3"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex flex-col gap-1.5">
        {lines.map((w, i) => (
          <div key={i} className="h-2.5 rounded bg-black/[0.07]" style={{ width: w }} />
        ))}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="fa-connect-dot h-1.5 w-1.5 rounded-full bg-famaash"
          style={{ animation: 'fa-connect-dot 1.1s ease-in-out infinite', animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </span>
  );
}
