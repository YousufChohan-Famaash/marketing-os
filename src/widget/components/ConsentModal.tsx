import { useState } from 'react';
import { useSocket } from '../services/socketContext';
import { useWidgetStore } from '../store/widgetStore';
import { cn } from '../utils/cn';
import { Modal } from './Modal';

/**
 * Blocking TCPA consent prompt sent by the agent after the phone is captured
 * (`consent_modal` event). The user picks agree/decline; we reply with
 * `consent_response`. The agent then asks the next field automatically — we do
 * NOT also send a lead_message.
 */
export function ConsentModal() {
  const consent = useWidgetStore((s) => s.consent);
  const setConsent = useWidgetStore((s) => s.setConsent);
  const socket = useSocket();
  const [choice, setChoice] = useState<boolean | null>(null);

  if (!consent) return null;

  const respond = () => {
    if (choice === null) return;
    socket?.send({ type: 'consent_response', agree: choice });
    setConsent(null);
    // Agent asks the next field right after consent — show the dots meanwhile.
    useWidgetStore.getState().beginTyping();
  };

  return (
    <Modal
      title={consent.title}
      description={consent.phone}
      onClose={() => {
        // Treat dismiss as a decline so the flow isn't left hanging.
        socket?.send({ type: 'consent_response', agree: false });
        setConsent(null);
      }}
      footer={
        <button
          type="button"
          onClick={respond}
          disabled={choice === null}
          className={cn(
            'w-full rounded-md bg-famaash px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-95',
            choice === null && 'cursor-not-allowed opacity-40',
          )}
        >
          Continue
        </button>
      }
    >
      <div className="space-y-3">
        <p className="text-[13px] leading-relaxed text-ink-soft">{consent.body}</p>
        <div className="space-y-2">
          {[
            { value: true, label: consent.agreeLabel },
            { value: false, label: consent.declineLabel },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => setChoice(opt.value)}
              aria-pressed={choice === opt.value}
              className={cn(
                'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[13px] transition-colors',
                choice === opt.value
                  ? 'border-famaash bg-famaash-light/50 text-ink'
                  : 'border-hairline bg-white text-ink-soft hover:bg-subtle',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                  choice === opt.value ? 'border-famaash' : 'border-muted-soft',
                )}
                aria-hidden="true"
              >
                {choice === opt.value && <span className="h-2 w-2 rounded-full bg-famaash" />}
              </span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
