import { useEffect, useMemo, useState } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import {
  ApiError,
  errorDetail,
  fetchAvailability,
  scheduleCallback,
  type AvailabilitySlot,
} from '../services/api';
import { CalendarIcon, CheckIcon, PhoneIcon } from '../utils/icons';
import { cn } from '../utils/cn';
import { CallbackForm } from './CallbackForm';

interface ScheduleCallbackProps {
  consentLabel: string;
  /** Server-minted TCPA template version to record with the consent (audit). */
  consentVersion?: string;
  /** Prefill from what the lead already shared in the chat session. */
  prefill: { name?: string; phone?: string; email?: string };
  /** Switch to the immediate Call-Me-Now channel (used as the fallback). */
  onFallback: () => void;
}

/** Today's date in the visitor's local zone, as a YYYY-MM-DD key. */
function dayKey(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

interface DayGroup {
  key: string;
  top: string; // "Today" | "Tomorrow" | weekday
  sub: string; // "Jun 22"
  slots: AvailabilitySlot[];
}

/**
 * Schedule-a-Callback: shows the firm's *real* calendar availability (fetched
 * from the public widget endpoint, slots already filtered to legal calling
 * hours in the visitor's timezone), lets the lead pick a day + time, collects
 * name/phone/email + TCPA consent, and books it. The booking lands on the firm's
 * calendar; the lead gets a confirmation/invite by email, and the AI calls them
 * at the chosen time. On a 502 (slot raced/taken) we silently re-fetch and ask
 * them to pick again; when no calendar is connected we fall back to Call-Me-Now.
 */
export function ScheduleCallback({ consentLabel, consentVersion, prefill, onFallback }: ScheduleCallbackProps) {
  const firmId = useWidgetStore((s) => s.firmId);
  const conversationId = useWidgetStore((s) => s.conversationId);

  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const [phase, setPhase] = useState<'loading' | 'pick' | 'unavailable' | 'booked'>('loading');
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [serverTz, setServerTz] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [confirmLabel, setConfirmLabel] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Fetch availability on mount (and on demand after a raced booking).
  const loadAvailability = useMemo(
    () => async (signal?: AbortSignal) => {
      if (!firmId) {
        setPhase('unavailable');
        return;
      }
      const from = dayKey(new Date(), tz);
      try {
        const res = await fetchAvailability(firmId, { from, days: 7, tz }, signal);
        if (signal?.aborted) return;
        setServerTz(res.tz);
        if (!res.available || res.slots.length === 0) {
          setPhase('unavailable');
          return;
        }
        setSlots(res.slots);
        setPhase('pick');
      } catch {
        if (!signal?.aborted) setPhase('unavailable');
      }
    },
    [firmId, tz],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void loadAvailability(ctrl.signal);
    return () => ctrl.abort();
  }, [loadAvailability]);

  // Group slots into days in the visitor's timezone.
  const days = useMemo<DayGroup[]>(() => {
    const todayKey = dayKey(new Date(), tz);
    const tomorrowKey = dayKey(new Date(Date.now() + 86_400_000), tz);
    const map = new Map<string, DayGroup>();
    for (const s of slots) {
      const d = new Date(s.start);
      const key = dayKey(d, tz);
      if (!map.has(key)) {
        const top =
          key === todayKey
            ? 'Today'
            : key === tomorrowKey
              ? 'Tomorrow'
              : new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(d);
        const sub = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric' }).format(d);
        map.set(key, { key, top, sub, slots: [] });
      }
      map.get(key)!.slots.push(s);
    }
    return [...map.values()];
  }, [slots, tz]);

  // Default the selected day to the first one with availability.
  useEffect(() => {
    if (phase === 'pick' && days.length > 0 && (!selectedDay || !days.some((d) => d.key === selectedDay))) {
      setSelectedDay(days[0].key);
      setSelectedStart(null);
    }
  }, [phase, days, selectedDay]);

  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

  const activeDay = days.find((d) => d.key === selectedDay) ?? null;
  const tzLabel = (serverTz ?? tz).replace(/_/g, ' ');

  const book = async (phone: string, name?: string, email?: string) => {
    setEmailError(null);
    setFormError(null);
    if (!selectedStart) {
      setFormError('Pick a time above first.');
      return;
    }
    if (!conversationId) {
      setFormError('Your session expired. Please restart the chat.');
      return;
    }
    setBusy(true);
    try {
      const res = await scheduleCallback({
        conversationId,
        name,
        phone,
        email: email ?? '',
        slotStart: selectedStart,
        timezone: tz,
        consentText: consentLabel,
        copyVersion: consentVersion,
      });
      setConfirmLabel(res.chip?.label ?? "Callback booked — we'll call you then");
      setPhase('booked');
    } catch (err) {
      const detail = errorDetail(err);
      const status = err instanceof ApiError ? err.status : 0;
      // 502 = slot raced/taken; 400 "too soon" = stale slot under the 60-min
      // notice. Both mean the grid is stale → silently refresh and re-pick.
      const tooSoon = status === 400 && /soon|60/i.test(detail ?? '');
      if (status === 502 || tooSoon) {
        setSelectedStart(null);
        setNotice('That time is no longer available. Please pick another.');
        setPhase('loading');
        void loadAvailability();
      } else if (status === 503) {
        setPhase('unavailable');
      } else if (status === 404) {
        setFormError('Your session expired — please reopen the chat and try again.');
      } else if (status === 400 && detail?.toLowerCase().includes('email')) {
        setEmailError(detail);
      } else if (status === 400 && detail) {
        setFormError(detail);
      } else {
        setFormError("We couldn't book that time. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-hairline border-t-famaash" />
        <p className="mt-3 text-[13px] text-muted">Checking available times…</p>
      </div>
    );
  }

  if (phase === 'unavailable') {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-famaash-soft text-famaash">
          <PhoneIcon size={26} aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-[18px] font-bold text-ink">No times to show right now</h3>
        <p className="mt-2 max-w-[34ch] text-[13.5px] leading-relaxed text-muted">
          Online scheduling isn't available at the moment. Leave your number and we'll call you instead.
        </p>
        <button
          type="button"
          onClick={onFallback}
          className="mt-6 flex items-center gap-2 rounded-pill bg-famaash px-5 py-2.5 text-[13px] font-semibold text-white hover:opacity-95"
        >
          <PhoneIcon size={15} aria-hidden="true" />
          Request a call instead
        </button>
      </div>
    );
  }

  if (phase === 'booked') {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckIcon size={26} aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-[18px] font-bold text-ink">{confirmLabel}</h3>
        <p className="mt-2 max-w-[34ch] text-[13.5px] leading-relaxed text-muted">
          Check your email for the confirmation and calendar invite. We'll call you at the time you picked.
        </p>
      </div>
    );
  }

  // phase === 'pick'
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-famaash-soft text-famaash">
          <CalendarIcon size={20} aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-[16px] font-bold text-ink">Pick a time</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            {tzLabel} time. We'll send a confirmation and a reminder.
          </p>
        </div>
      </div>

      {notice && (
        <p className="rounded-lg bg-famaash-soft px-3 py-2 text-[12px] text-famaash">{notice}</p>
      )}

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-soft">Choose a day</p>
        <div className="flex flex-wrap gap-2">
          {days.map((d) => {
            const active = selectedDay === d.key;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => {
                  setSelectedDay(d.key);
                  setSelectedStart(null);
                }}
                aria-pressed={active}
                className={cn(
                  'flex flex-col items-center rounded-2xl border px-4 py-2 transition-colors',
                  active ? 'border-famaash bg-famaash-soft' : 'border-famaash-stroke bg-white hover:bg-subtle',
                )}
              >
                <span className={cn('text-[13px] font-bold', active ? 'text-famaash' : 'text-ink')}>{d.top}</span>
                <span className="text-[11px] text-muted-soft">{d.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeDay && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-soft">Available times</p>
          <div className="flex flex-wrap gap-2">
            {activeDay.slots.map((s) => {
              const active = selectedStart === s.start;
              return (
                <button
                  key={s.start}
                  type="button"
                  onClick={() => setSelectedStart(s.start)}
                  aria-pressed={active}
                  className={cn(
                    'rounded-pill border px-4 py-2 text-[13px] font-medium transition-colors',
                    active
                      ? 'border-famaash bg-famaash-soft text-famaash'
                      : 'border-famaash-stroke bg-white text-ink hover:bg-subtle',
                  )}
                >
                  {fmtTime(s.start)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedStart && (
        <>
          {formError && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-[12px] text-danger">{formError}</p>
          )}
          <CallbackForm
            variant="alert"
            heading={`Confirm ${activeDay?.top ?? ''} at ${fmtTime(selectedStart)}`}
            body="Where should we call you, and where should the confirmation go?"
            cta={busy ? 'Booking your callback…' : 'Confirm callback'}
            collectName
            collectEmail
            initialName={prefill.name}
            initialPhone={prefill.phone}
            initialEmail={prefill.email}
            busy={busy}
            emailError={emailError}
            consentLabel={consentLabel}
            onSubmit={book}
          />
        </>
      )}
    </div>
  );
}
