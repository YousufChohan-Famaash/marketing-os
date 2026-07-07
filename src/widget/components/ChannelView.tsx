import { useEffect, useState } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { useKnownContact } from '../store/useKnownContact';
import { ApiError, connectText, errorDetail, placeCallNow } from '../services/api';
import { resolveTcpa } from '../utils/compliance';
import { CheckIcon, ChevronLeftIcon, PhoneIcon, PhoneOffIcon } from '../utils/icons';
import { cn } from '../utils/cn';
import { CallbackForm } from './CallbackForm';
import { ScheduleCallback } from './ScheduleCallback';
import { SendDetails } from './SendDetails';
import { PoweredByFooter } from './PoweredByFooter';
import { WidgetControls } from './WidgetControls';

interface ChannelViewProps {
  channel: 'call' | 'text' | 'schedule' | 'email';
  onClose: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  isExpanded: boolean;
}

const TITLES: Record<ChannelViewProps['channel'], string> = {
  call: 'Call me now',
  text: 'Text me',
  schedule: 'Schedule a callback',
  email: 'Send your details',
};

/**
 * A single contact channel routed from the home menu. Reversible: the back
 * button returns to the menu without losing context (captured fields persist in
 * the shared session and prefill here, with a "we kept what you shared" cue).
 */
export function ChannelView({ channel, onClose, onMinimize, onExpand, isExpanded }: ChannelViewProps) {
  const settings = useWidgetStore((s) => s.connect);
  const compliance = useWidgetStore((s) => s.compliance);
  const branding = useWidgetStore((s) => s.branding);
  const conversationId = useWidgetStore((s) => s.conversationId);
  const known = useKnownContact();
  const setConnectView = useWidgetStore((s) => s.setConnectView);

  // TCPA gate before we capture a phone number for any channel. Uses the copy
  // the firm authored in the Law App's Compliance tab for the active language,
  // falling back to legacy/default copy. `consentVersion` is recorded with the
  // consent so the exact wording is provable in the audit log.
  const language = useWidgetStore((s) => s.language);
  const tcpa = resolveTcpa(compliance, language);
  const consentLabel = tcpa.text;
  const consentVersion = tcpa.version;

  // SMS (TCPA) requires explicit STOP opt-out + rates wording. If the firm's
  // consent copy already carries it, use it; otherwise use compliant text copy.
  const firmName = branding?.name ?? 'the firm';
  const textConsentLabel = /stop/i.test(consentLabel)
    ? consentLabel
    : `I agree to receive texts from ${firmName} about my inquiry. Message and data rates may apply. Reply STOP to opt out. Consent isn't a condition of hiring the firm.`;

  const knownPhone = known.phone;
  const hasContext = Boolean(knownPhone) || useWidgetStore.getState().messages.length > 0;

  const [done, setDone] = useState<string | null>(null);
  const [textMethod, setTextMethod] = useState<'sms' | 'whatsapp'>(settings.textMethods[0] ?? 'sms');
  // Call-now lifecycle: calling → connected | failed. The backend pushes the
  // live status over the chat data channel (connectCallStatus in the store).
  const connectCallStatus = useWidgetStore((s) => s.connectCallStatus);
  const setConnectCallStatus = useWidgetStore((s) => s.setConnectCallStatus);
  const [callPhase, setCallPhase] = useState<'calling' | 'connected' | 'failed' | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [callTarget, setCallTarget] = useState<{ phone: string; name?: string } | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  // Text-me lifecycle: hand the intake off to the visitor's phone (WhatsApp/SMS).
  const [texting, setTexting] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);

  // Tick the connecting countdown.
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // React to the pushed call status while we're connecting.
  useEffect(() => {
    if (callPhase !== 'calling' || !connectCallStatus) return;
    if (connectCallStatus === 'connected' || connectCallStatus === 'completed') {
      setCallPhase('connected');
      setCountdown(null);
    } else if (
      connectCallStatus === 'no_answer' ||
      connectCallStatus === 'busy' ||
      connectCallStatus === 'failed'
    ) {
      setCallPhase('failed');
      setCountdown(null);
    }
  }, [connectCallStatus, callPhase]);

  // No status within the window → assume we couldn't reach them.
  useEffect(() => {
    if (callPhase === 'calling' && countdown === 0) setCallPhase('failed');
  }, [callPhase, countdown]);

  const resetCall = () => {
    setCallPhase(null);
    setCountdown(null);
    setCallError(null);
    setConnectCallStatus(null);
  };
  const back = () => {
    resetCall();
    setConnectView('home');
  };

  // Call now → backend places an immediate outbound AI voice call (REST, not the
  // old request_human event). On success we show the live countdown.
  const finishCall = async (phone: string, name?: string) => {
    setCallError(null);
    if (!conversationId) {
      setCallError("We couldn't start the call. Please try again.");
      return;
    }
    setPlacing(true);
    try {
      await placeCallNow({ conversationId, phone, name, consentText: consentLabel, copyVersion: consentVersion });
      setConnectCallStatus(null); // clear any prior status before this call
      setCallTarget({ phone, name });
      setCallPhase('calling');
      setCountdown(60);
    } catch (err) {
      const detail = errorDetail(err);
      setCallError(
        err instanceof ApiError && err.status === 400 && detail
          ? detail
          : "We couldn't start the call. Please try again.",
      );
    } finally {
      setPlacing(false);
    }
  };

  // Text me → backend continues the SAME intake on the visitor's phone over
  // WhatsApp/SMS. We only fire one call and render a confirmation; the whole
  // conversation then runs on the phone (nothing more to show in the widget).
  const finishText = async (phone: string, name?: string) => {
    setTextError(null);
    if (!conversationId) {
      setTextError('Your session expired — please reopen the chat and try again.');
      return;
    }
    setTexting(true);
    let channel: 'sms' | 'whatsapp' = textMethod;
    try {
      let out;
      try {
        out = await connectText({ conversationId, phone, name, channel, consentText: textConsentLabel, copyVersion: consentVersion });
      } catch (err) {
        // WhatsApp unreachable for this firm → fall back to SMS automatically.
        if (err instanceof ApiError && err.status === 503 && channel === 'whatsapp') {
          channel = 'sms';
          setTextMethod('sms');
          out = await connectText({ conversationId, phone, name, channel, consentText: textConsentLabel, copyVersion: consentVersion });
        } else {
          throw err;
        }
      }
      if (out.channel === 'whatsapp') {
        if (out.waMeLink) {
          if (typeof window !== 'undefined') window.open(out.waMeLink, '_blank', 'noopener');
          setDone('Continue in WhatsApp — we opened it with your message ready to send.');
        } else {
          setDone("We've messaged you on WhatsApp — check your phone to continue.");
        }
      } else {
        setDone('We just texted you — reply to that message to continue.');
      }
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const detail = errorDetail(err);
      if (status === 403) {
        setTextError("Texting isn't available right now. Try another option.");
      } else if (status === 503) {
        setTextError("We couldn't send that just now. Try another option.");
      } else if (status === 404) {
        setTextError('Your session expired — please reopen the chat and try again.');
      } else if (status === 400 && detail) {
        setTextError(detail);
      } else {
        setTextError("We couldn't start the text. Please try again.");
      }
    } finally {
      setTexting(false);
    }
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
        {callPhase === 'calling' ? (
          <CallCountdown
            seconds={countdown ?? 0}
            phone={callTarget?.phone ?? ''}
            name={callTarget?.name}
            onBack={back}
          />
        ) : callPhase === 'connected' ? (
          <CallConnected phone={callTarget?.phone ?? ''} name={callTarget?.name} onBack={back} />
        ) : callPhase === 'failed' ? (
          <CallFailed
            phone={callTarget?.phone ?? ''}
            onRetry={() => callTarget && void finishCall(callTarget.phone, callTarget.name)}
            onBack={back}
          />
        ) : done ? (
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
              <>
                {callError && (
                  <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-[12px] text-danger">
                    {callError}
                  </p>
                )}
                <CallbackForm
                  variant="alert"
                  heading="Where should we call you?"
                  body="We start the callback the moment you confirm — usually under a minute."
                  cta={placing ? 'Starting your call…' : 'Call me now'}
                  collectName
                  consentLabel={consentLabel}
                  onSubmit={finishCall}
                />
              </>
            )}

            {channel === 'text' && (
              <div className="space-y-4">
                {textError && (
                  <p className="rounded-lg bg-danger-soft px-3 py-2 text-[12px] text-danger">{textError}</p>
                )}
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
                  cta={
                    texting
                      ? 'Starting…'
                      : textMethod === 'whatsapp'
                        ? 'Message me on WhatsApp'
                        : 'Text me'
                  }
                  busy={texting}
                  consentLabel={textConsentLabel}
                  onSubmit={finishText}
                />
              </div>
            )}

            {channel === 'schedule' && (
              <ScheduleCallback
                consentLabel={consentLabel}
                consentVersion={consentVersion}
                prefill={{ name: known.name, phone: known.phone, email: known.email }}
                onFallback={() => setConnectView('call')}
              />
            )}

            {channel === 'email' && (
              <SendDetails
                consentLabel={consentLabel}
                prefill={{ name: known.name, phone: known.phone, email: known.email }}
              />
            )}
          </>
        )}
      </div>

      <PoweredByFooter />
    </div>
  );
}

function CallCountdown({
  seconds,
  phone,
  name,
  onBack,
}: {
  seconds: number;
  phone: string;
  name?: string;
  onBack: () => void;
}) {
  const R = 46;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - Math.max(0, Math.min(60, seconds)) / 60);
  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const connecting = seconds <= 0;

  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="relative h-[120px] w-[120px]">
        <svg viewBox="0 0 110 110" className="h-full w-full -rotate-90">
          <circle cx="55" cy="55" r={R} fill="none" stroke="var(--hairline)" strokeWidth="6" />
          <circle
            cx="55"
            cy="55"
            r={R}
            fill="none"
            stroke="var(--famaash-brand)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {connecting ? (
            <PhoneIcon size={26} className="text-famaash" aria-hidden="true" />
          ) : (
            <>
              <span className="text-[26px] font-bold tabular-nums text-ink">{mmss}</span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-soft">
                until we call
              </span>
            </>
          )}
        </div>
      </div>

      <h3 className="mt-5 text-[18px] font-bold text-ink">
        {connecting ? 'Connecting your call…' : `Calling you ${name ? name.split(' ')[0] : 'shortly'}`}
      </h3>
      <p className="mt-2 max-w-[32ch] text-[13.5px] leading-relaxed text-muted">
        {connecting
          ? `Your phone should ring at ${phone} any moment now.`
          : `Hang tight — we'll ring ${phone} in under a minute. Keep your phone nearby.`}
      </p>
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

function CallConnected({ phone, name, onBack }: { phone: string; name?: string; onBack: () => void }) {
  const first = name?.trim().split(/\s+/)[0];
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
        <PhoneIcon size={26} aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-[18px] font-bold text-ink">You&apos;re connected</h3>
      <p className="mt-2 max-w-[34ch] text-[13.5px] leading-relaxed text-muted">
        {first ? `${first}, you're` : "You're"} on the line with our team
        {phone ? ` at ${phone}` : ''}.
      </p>
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

function CallFailed({
  phone,
  onRetry,
  onBack,
}: {
  phone: string;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger">
        <PhoneOffIcon size={26} aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-[18px] font-bold text-ink">We couldn&apos;t reach you</h3>
      <p className="mt-2 max-w-[34ch] text-[13.5px] leading-relaxed text-muted">
        We tried calling {phone || 'your number'} but couldn&apos;t connect. Want us to try again?
      </p>
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-pill border border-hairline px-5 py-2 text-[13px] font-semibold text-ink hover:bg-subtle"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-pill bg-famaash px-5 py-2 text-[13px] font-semibold text-white hover:opacity-95"
        >
          Try again
        </button>
      </div>
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
