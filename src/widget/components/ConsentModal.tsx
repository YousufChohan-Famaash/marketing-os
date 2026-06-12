import FocusTrap from 'focus-trap-react';
import { useEffect, useState } from 'react';
import { useSocket } from '../services/socketContext';
import { useWidgetStore } from '../store/widgetStore';
import { cn } from '../utils/cn';
import { CloseIcon, MessageSquareIcon } from '../utils/icons';

/**
 * Blocking TCPA consent prompt sent by the agent after the phone is captured
 * (`consent_modal` event). Rendered as a full-screen takeover over the chat
 * (not a small centered dialog) so the disclosure can't be missed. The user
 * picks agree/decline; we reply with `consent_response` and the agent asks the
 * next field automatically — we do NOT also send a lead_message.
 */
export function ConsentModal() {
  const consent = useWidgetStore((s) => s.consent);
  const setConsent = useWidgetStore((s) => s.setConsent);
  const socket = useSocket();
  const [choice, setChoice] = useState<boolean | null>(null);

  // Treat dismiss / Escape as a decline so the flow isn't left hanging.
  const dismiss = () => {
    socket?.send({ type: 'consent_response', agree: false });
    setConsent(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (!useWidgetStore.getState().consent) return;
      e.stopPropagation();
      dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, setConsent]);

  if (!consent) return null;

  const respond = () => {
    if (choice === null) return;
    socket?.send({ type: 'consent_response', agree: choice });
    setConsent(null);
    // Agent asks the next field right after consent — show the dots meanwhile.
    useWidgetStore.getState().beginTyping();
  };

  const options = [
    { value: true, label: consent.agreeLabel },
    { value: false, label: consent.declineLabel },
  ];

  return (
    <FocusTrap focusTrapOptions={{ escapeDeactivates: false, allowOutsideClick: true }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        aria-describedby="consent-body"
        className="absolute inset-0 z-50 flex flex-col bg-white"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2.5 border-b border-hairline px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-famaash-light text-famaash">
            <MessageSquareIcon size={18} aria-hidden="true" />
          </span>
          <h2 id="consent-title" className="flex-1 text-[16px] font-semibold text-ink">
            {consent.title}
          </h2>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="rounded-md p-1 text-muted hover:bg-hairline-soft hover:text-ink"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="text-[13px] font-semibold text-ink">
            Review the following before continuing:
          </p>
          {consent.phone && (
            <div className="mt-2 rounded-xl bg-subtle px-4 py-3 text-[15px] font-semibold tracking-wide text-ink">
              {consent.phone}
            </div>
          )}
          <p id="consent-body" className="mt-3 text-[13px] leading-relaxed text-ink-soft">
            {consent.body}
          </p>

          <div className="mt-4 space-y-2.5">
            {options.map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => setChoice(opt.value)}
                aria-pressed={choice === opt.value}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left text-[13px] transition-colors',
                  choice === opt.value
                    ? 'border-famaash bg-famaash-light/50 text-ink'
                    : 'border-hairline bg-white text-ink-soft hover:bg-subtle',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                    choice === opt.value ? 'border-famaash' : 'border-muted-soft',
                  )}
                  aria-hidden="true"
                >
                  {choice === opt.value && <span className="h-2.5 w-2.5 rounded-full bg-famaash" />}
                </span>
                <span className="leading-relaxed">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-hairline bg-white px-4 py-3">
          <button
            type="button"
            onClick={respond}
            disabled={choice === null}
            className={cn(
              'w-full rounded-pill bg-famaash px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-95',
              choice === null && 'cursor-not-allowed opacity-40',
            )}
          >
            Continue
          </button>
        </div>
      </div>
    </FocusTrap>
  );
}
