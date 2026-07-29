import { useCallback, useEffect, useState } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { useKnownContact } from '../store/useKnownContact';
import { ApiError, connectText, errorDetail, fetchCallStatus, placeCallNow } from '../services/api';
import { resolveTcpa } from '../utils/compliance';
import { resolveViewVideo } from '../config/demoMedia';
import type { VideoView } from '../types/domain';
import type { ConnectCallStatus } from '../types/protocol';
import { CheckIcon, ChevronLeftIcon, PhoneIcon, PhoneOffIcon } from '../utils/icons';
import { cn } from '../utils/cn';
import { CallbackForm } from './CallbackForm';
import { ChannelHeaderVideo } from './ChannelHeaderVideo';
import { ChannelMorphVideo } from './ChannelMorphVideo';
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
  schedule: 'Book a call',
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
  const firmId = useWidgetStore((s) => s.firmId);
  const known = useKnownContact();
  const setConnectView = useWidgetStore((s) => s.setConnectView);

  // TCPA gate before we capture a phone number for any channel. Uses the copy
  // the firm authored in the Law App's Compliance tab for the active language,
  // falling back to legacy/default copy. `consentVersion` is recorded with the
  // consent so the exact wording is provable in the audit log.
  const language = useWidgetStore((s) => s.language);
  const firmName = branding?.name ?? 'the firm';
  // Consent copy for THIS channel. Proper, channel-appropriate defaults so a
  // call/booking screen never shows SMS-only wording or a bare placeholder. A
  // firm-authored value wins, but a too-short one (e.g. a "Please agree"
  // placeholder in the config) is treated as not-authored and replaced.
  const consentChannel =
    channel === 'text' ? 'sms' : channel === 'schedule' ? 'booking' : channel === 'email' ? 'form' : 'call';
  const CONSENT_DEFAULTS: Record<'call' | 'sms' | 'booking' | 'form', string> = {
    call: `By sharing your number, you agree that ${firmName} may call you about your inquiry. Consent isn't a condition of hiring the firm.`,
    sms: `I agree to receive texts from ${firmName} about my inquiry. Message and data rates may apply. Reply STOP to opt out. Consent isn't a condition of hiring the firm.`,
    booking: `By booking, you agree that ${firmName} may call you at the time you selected about your inquiry. Consent isn't a condition of hiring the firm.`,
    form: `By submitting, you agree that ${firmName} may contact you about your inquiry.`,
  };
  const resolvedTcpa = resolveTcpa(compliance, language, consentChannel);
  const authoredConsent = resolvedTcpa.text.trim().length >= 30 ? resolvedTcpa.text : null;
  const consentLabel = authoredConsent ?? CONSENT_DEFAULTS[consentChannel];
  const consentVersion = authoredConsent ? resolvedTcpa.version : undefined;

  // Only claim what we actually have on file (and prefill into the form below),
  // and name those fields, so the banner never says "we kept it" over blanks.
  const kept = [
    known.name?.trim() && 'name',
    known.phone?.trim() && 'phone',
    known.email?.trim() && 'email',
  ].filter(Boolean) as string[];
  const keptLabel =
    kept.length <= 1
      ? kept[0] ?? ''
      : `${kept.slice(0, -1).join(', ')} and ${kept[kept.length - 1]}`;

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

  // ── Video collapse choreography ─────────────────────────────────────────────
  // On landing a contact screen the intro clip greets full-width at the top, then
  // collapses into the small header-avatar slot after a beat (or the first scroll
  // / field focus). It's ONE element that only animates its geometry — never
  // remounts — so playback stays continuous through the collapse (no restart).
  const headerVideoView: VideoView | null = channel === 'email' ? null : channel;
  const inFormState = !callPhase && !done;
  const hasStageVideo = headerVideoView ? Boolean(resolveViewVideo(headerVideoView, settings, branding)) : false;
  const hasMorph = hasStageVideo && inFormState && headerVideoView !== null;
  const [stageOpen, setStageOpen] = useState(true);
  // The clip greets full-width and morphs into the thumbnail on ONE of two cues:
  // it finishes playing (onFinish below), or the visitor engages (scrolls the
  // form / focuses a field). No timer. Tapping the thumbnail re-expands + replays.
  const collapseStage = useCallback(() => setStageOpen(false), []);

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

  // Poll the persisted dial state every 2s while dialing. The data-channel event
  // above only fires when there's an open chat session; a launcher-direct call
  // has none, so without this the widget sat on "dialing" until the timeout even
  // after the visitor answered. Both paths write the same store value and the
  // effect above is guarded on `callPhase === 'calling'`, so whichever lands
  // first flips the screen and the other is a no-op (guide: call-status-polling).
  useEffect(() => {
    if (callPhase !== 'calling' || !conversationId) return undefined;
    let cancelled = false;
    const id = setInterval(async () => {
      const status = await fetchCallStatus(conversationId);
      if (cancelled) return;
      if (
        status === 'connected' ||
        status === 'completed' ||
        status === 'no_answer' ||
        status === 'busy' ||
        status === 'failed'
      ) {
        setConnectCallStatus(status as ConnectCallStatus);
      }
      // 'dialing' | 'unknown' → keep polling; the countdown above is the backstop.
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [callPhase, conversationId, setConnectCallStatus]);

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
      await placeCallNow({ conversationId, firmId: firmId ?? undefined, phone, name, consentText: consentLabel, copyVersion: consentVersion });
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
      setTextError('Your session expired. Please reopen the chat and try again.');
      return;
    }
    setTexting(true);
    let channel: 'sms' | 'whatsapp' = textMethod;
    try {
      let out;
      try {
        out = await connectText({ conversationId, firmId: firmId ?? undefined, phone, name, channel, consentText: consentLabel, copyVersion: consentVersion });
      } catch (err) {
        // WhatsApp unreachable for this firm → fall back to SMS automatically.
        if (err instanceof ApiError && err.status === 503 && channel === 'whatsapp') {
          channel = 'sms';
          setTextMethod('sms');
          out = await connectText({ conversationId, firmId: firmId ?? undefined, phone, name, channel, consentText: consentLabel, copyVersion: consentVersion });
        } else {
          throw err;
        }
      }
      if (out.channel === 'whatsapp') {
        if (out.waMeLink) {
          if (typeof window !== 'undefined') window.open(out.waMeLink, '_blank', 'noopener');
          setDone('Continue in WhatsApp. We opened it with your message ready to send.');
        } else {
          setDone("We've messaged you on WhatsApp. Check your phone to continue.");
        }
      } else {
        setDone('We just texted you. Reply to that message to continue.');
      }
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const detail = errorDetail(err);
      if (status === 403) {
        setTextError("Texting isn't available right now. Try another option.");
      } else if (status === 503) {
        setTextError("We couldn't send that just now. Try another option.");
      } else if (status === 404) {
        setTextError('Your session expired. Please reopen the chat and try again.');
      } else if (status === 400 && detail) {
        setTextError(detail);
      } else {
        setTextError("We couldn't start the text. Please try again.");
      }
    } finally {
      setTexting(false);
    }
  };

  // Edge-to-edge video (v12): while the stage is open the clip fills the top of
  // the panel and the header floats over it transparently; once it collapses the
  // header returns to its solid bar with the small avatar. HEADER_H must match the
  // header's rendered height so the scrolling form clears the floating header.
  const HEADER_H = 52;
  const STAGE_H = 300;
  const stageActive = hasMorph && stageOpen;

  return (
    <div className="fa-view-in relative flex h-full w-full flex-col overflow-hidden bg-white" role="dialog" aria-label={TITLES[channel]}>
      {/* One video element: full-width stage on landing (edge-to-edge, under the
          header), morphs into the header slot on collapse (never remounts, so
          playback keeps its timestamp). Rendered before the header so the header
          floats on top of it. */}
      {hasMorph && headerVideoView && (
        <ChannelMorphVideo
          view={headerVideoView}
          collapsed={!stageOpen}
          fullBleed
          headerH={HEADER_H}
          stageH={STAGE_H}
          onThumbClick={() => setStageOpen(true)}
          onFinish={collapseStage}
        />
      )}

      {/* Header floats over the video while the stage is open (transparent, light
          controls), then becomes a solid bar once the video tucks into the slot. */}
      <header
        className={cn(
          'absolute inset-x-0 top-0 z-30 flex items-center gap-2 px-2 py-2 transition-colors duration-300',
          stageActive ? 'border-b border-transparent bg-transparent' : 'border-b border-hairline-soft bg-white',
        )}
      >
        <button
          type="button"
          onClick={back}
          aria-label="Back to all options"
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
            stageActive ? 'text-white hover:bg-white/20' : 'text-muted hover:bg-subtle hover:text-ink',
          )}
        >
          <ChevronLeftIcon size={18} />
        </button>
        {/* Reserve the avatar slot only once the video has collapsed into it.
            While it's full-bleed there's nothing there, so the title sits right
            after the back button instead of being indented past an empty gap.
            With no morph at all, show the static firm/head avatar. */}
        {!hasMorph ? (
          <ChannelHeaderVideo view={headerVideoView} />
        ) : stageActive ? null : (
          <span className="h-[34px] w-[34px] shrink-0" aria-hidden="true" />
        )}
        <h2
          className={cn(
            'min-w-0 flex-1 truncate text-[16px] font-semibold transition-colors',
            stageActive ? 'text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.4)]' : 'text-ink',
          )}
        >
          {TITLES[channel]}
        </h2>
        <WidgetControls tone={stageActive ? 'overlay' : 'solid'} onClose={onClose} onMinimize={onMinimize} onExpand={onExpand} isExpanded={isExpanded} />
      </header>

      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingTop: HEADER_H }}
        onScroll={collapseStage}
        onFocusCapture={collapseStage}
      >
        {/* Spacer that reserves the video stage's height (below the header) and
            collapses with it, so the form sits below the video and slides up as it
            morphs away. */}
        {hasMorph && (
          <div
            className="shrink-0 transition-[height] duration-500 ease-out"
            style={{ height: stageOpen ? STAGE_H : 0 }}
            aria-hidden="true"
          />
        )}
        <div className="px-5 py-4">
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
            {kept.length > 0 && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-famaash-stroke bg-famaash-soft px-3 py-2.5 text-[13px] text-famaash">
                <CheckIcon size={15} aria-hidden="true" />
                <span>We kept your {keptLabel}. Edit anything below.</span>
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
                  body="We start the callback the moment you confirm, usually under a minute."
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
                          m === 'whatsapp'
                            ? textMethod === m
                              ? 'border-[#25D366] bg-[#25D366]/10 text-[#075E54]'
                              : 'border-[#25D366]/40 bg-white text-[#128C7E] hover:bg-[#25D366]/5'
                            : textMethod === m
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
                  variant={textMethod === 'whatsapp' ? 'whatsapp' : 'brand'}
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
                  consentLabel={consentLabel}
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
  const first = name?.trim().split(/\s+/)[0];

  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="relative h-[120px] w-[120px]">
        {/* Live "ringing" pulse behind the phone (off for reduced-motion users). */}
        <span
          className="absolute left-1/2 top-1/2 h-[68px] w-[68px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-famaash/20 motion-safe:animate-ping"
          aria-hidden="true"
        />
        <svg viewBox="0 0 110 110" className="relative h-full w-full -rotate-90">
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
        <div className="absolute inset-0 flex items-center justify-center">
          <PhoneIcon size={30} className="text-famaash" aria-hidden="true" />
        </div>
      </div>

      <h3 className="mt-5 text-[18px] font-bold text-ink">We&apos;re dialing you now</h3>
      <p className="mt-2 max-w-[32ch] text-[14px] leading-relaxed text-muted">
        Your phone should ring at {phone} in a few seconds{first ? `, ${first}` : ''}. Keep it nearby.
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
      <p className="mt-2 max-w-[34ch] text-[14px] leading-relaxed text-muted">
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
      <p className="mt-2 max-w-[34ch] text-[14px] leading-relaxed text-muted">
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
      <p className="mt-2 max-w-[34ch] text-[14px] leading-relaxed text-muted">{message}</p>
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
