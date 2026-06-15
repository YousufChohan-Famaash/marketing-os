import { useState } from 'react';
import { useSocket } from '../services/socketContext';
import { useWidgetStore } from '../store/widgetStore';
import { generateId } from '../utils/id';
import { CheckIcon, ChevronLeftIcon } from '../utils/icons';
import { cn } from '../utils/cn';
import { CalendarPicker, type DateSelection } from './CalendarPicker';
import { CallbackForm } from './CallbackForm';
import { PoweredByFooter } from './PoweredByFooter';
import { WidgetControls } from './WidgetControls';

interface ChannelViewProps {
  channel: 'call' | 'text' | 'schedule';
  onClose: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  isExpanded: boolean;
}

const TITLES: Record<ChannelViewProps['channel'], string> = {
  call: 'Call me now',
  text: 'Text me',
  schedule: 'Schedule a callback',
};

const TIME_SLOTS = ['09:00', '12:00', '15:00', '18:00'];

/** Pull a previously captured phone, if any, so channels never re-ask. */
function capturedPhone(fields: Record<string, { type: string; value: string | null }>): string | undefined {
  for (const f of Object.values(fields)) {
    if (f.value && (f.type === 'phone' || /\+?\d[\d\s()-]{6,}/.test(f.value))) return f.value;
  }
  return undefined;
}

/**
 * A single contact channel routed from the home menu. Reversible: the back
 * button returns to the menu without losing context (captured fields persist in
 * the shared session and prefill here, with a "we kept what you shared" cue).
 */
export function ChannelView({ channel, onClose, onMinimize, onExpand, isExpanded }: ChannelViewProps) {
  const socket = useSocket();
  const settings = useWidgetStore((s) => s.connect);
  const compliance = useWidgetStore((s) => s.compliance);
  const capturedFields = useWidgetStore((s) => s.capturedFields);
  const setConnectView = useWidgetStore((s) => s.setConnectView);

  // TCPA gate before we capture a phone number for any channel.
  const consentLabel =
    compliance?.tcpaConsent ??
    'By providing your number you agree to receive calls and texts about your inquiry. Message and data rates may apply. Reply STOP to opt out.';

  const knownPhone = capturedPhone(capturedFields);
  const hasContext = Boolean(knownPhone) || useWidgetStore.getState().messages.length > 0;

  const [done, setDone] = useState<string | null>(null);
  const [textMethod, setTextMethod] = useState<'sms' | 'whatsapp'>(settings.textMethods[0] ?? 'sms');
  const [date, setDate] = useState<DateSelection | null>(null);
  const [slot, setSlot] = useState<string>(TIME_SLOTS[1]);

  const back = () => setConnectView('home');

  const finishCall = (phone: string) => {
    socket?.send({ type: 'request_human', method: 'immediate', phone });
    setDone(`We'll call you at ${phone} in under a minute.`);
  };

  const finishText = (phone: string) => {
    const label = textMethod === 'whatsapp' ? 'WhatsApp' : 'SMS';
    const content = `Please continue this conversation by ${label} at ${phone}.`;
    useWidgetStore.getState().addMessage({
      id: generateId('msg_lead'),
      role: 'lead',
      type: 'text',
      content,
      timestamp: Date.now(),
      status: 'sent',
    });
    socket?.send({ type: 'lead_message', content, clientMessageId: generateId('msg_lead') });
    setDone(`We'll ${label} you at ${phone} shortly.`);
  };

  const finishSchedule = (phone: string) => {
    if (!date) return;
    socket?.send({
      type: 'request_human',
      method: 'scheduled',
      phone,
      scheduledAt: `${date.iso} ${slot}`,
    });
    setDone(`You're booked for ${date.label} at ${slot}. We'll call ${phone}.`);
  };

  return (
    <div className="flex h-full w-full flex-col bg-white" role="dialog" aria-label={TITLES[channel]}>
      <header className="flex shrink-0 items-center gap-2 border-b border-hairline-soft px-2 py-2">
        <button
          type="button"
          onClick={back}
          aria-label="Back to all options"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-ink"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <h2 className="flex-1 text-[15px] font-semibold text-ink">{TITLES[channel]}</h2>
        <WidgetControls tone="solid" onClose={onClose} onMinimize={onMinimize} onExpand={onExpand} isExpanded={isExpanded} />
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {done ? (
          <Confirmation message={done} onBack={back} />
        ) : (
          <>
            {hasContext && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-famaash-stroke bg-famaash-soft px-3 py-2 text-[12px] text-famaash">
                <CheckIcon size={14} aria-hidden="true" />
                <span>We kept what you shared. Edit anything below.</span>
              </div>
            )}

            {channel === 'call' && (
              <CallbackForm
                variant="alert"
                heading="Where should we call you?"
                body="We start the callback the moment you confirm — usually under a minute."
                cta="Call me now"
                consentLabel={consentLabel}
                onSubmit={finishCall}
              />
            )}

            {channel === 'text' && (
              <div className="space-y-4">
                {settings.textMethods.length > 1 && (
                  <div className="flex gap-2">
                    {settings.textMethods.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setTextMethod(m)}
                        aria-pressed={textMethod === m}
                        className={cn(
                          'flex-1 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-colors',
                          textMethod === m
                            ? 'border-famaash bg-famaash-soft text-famaash'
                            : 'border-hairline bg-white text-ink-soft hover:border-famaash-stroke',
                        )}
                      >
                        {m === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                      </button>
                    ))}
                  </div>
                )}
                <CallbackForm
                  variant="brand"
                  heading="Pick up this chat by text"
                  body={`Enter your number and we'll ${textMethod === 'whatsapp' ? 'message you on WhatsApp' : 'text you'} so you can continue from your phone.`}
                  cta={textMethod === 'whatsapp' ? 'Message me on WhatsApp' : 'Text me'}
                  consentLabel={consentLabel}
                  onSubmit={finishText}
                />
              </div>
            )}

            {channel === 'schedule' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-[16px] font-bold text-ink">Pick a time that works</h3>
                  <p className="mt-1 text-[13px] text-muted">Choose a day, then a window. We'll confirm the call.</p>
                </div>
                <CalendarPicker mode="future" onSubmit={setDate} />
                {date && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {TIME_SLOTS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSlot(t)}
                          aria-pressed={slot === t}
                          className={cn(
                            'rounded-pill border px-4 py-2 text-[13px] font-medium transition-colors',
                            slot === t
                              ? 'border-famaash bg-famaash-soft text-famaash'
                              : 'border-famaash-stroke bg-white text-ink hover:bg-subtle',
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <CallbackForm
                      variant="alert"
                      heading={`Confirm ${date.label} at ${slot}`}
                      body="Where should we call you at that time?"
                      cta="Book my callback"
                      consentLabel={consentLabel}
                      onSubmit={finishSchedule}
                    />
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <PoweredByFooter />
    </div>
  );
}

function Confirmation({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
        <CheckIcon size={26} aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-[18px] font-bold text-ink">You're all set</h3>
      <p className="mt-2 max-w-[34ch] text-[13.5px] leading-relaxed text-muted">{message}</p>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 rounded-pill border border-hairline px-5 py-2 text-[13px] font-semibold text-ink hover:bg-subtle"
      >
        Back to options
      </button>
    </div>
  );
}
