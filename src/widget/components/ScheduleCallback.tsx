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
import { CallbackForm } from './CallbackForm';
import { translate, type UiLocale } from '../i18n';

// The backend returns availability in Eastern (TCPA calling-hours), and the
// confirmation email + stored booking are Eastern too. Render the whole grid in
// the server's timezone, never the browser's, so a non-ET visitor sees the real
// callable times. See schedule-callback-est-business-hours-frontend-guide.md.
const ET = 'America/New_York';

interface ScheduleCallbackProps {
  consentLabel: string;
  /** Server-minted TCPA template version to record with the consent (audit). */
  consentVersion?: string;
  /** Prefill from what the lead already shared in the chat session. */
  prefill: { name?: string; phone?: string; email?: string };
  /** Switch to the immediate Call-Me-Now channel (used as the fallback). */
  onFallback: () => void;
}

/** An "Add to calendar" .ics data URI for the booked slot (works with any calendar app). */
function calendarHref(start: string, end: string, title: string, details: string): string {
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (t: string) => t.replace(/([\\;,])/g, '\\$1').replace(/\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Famaash//Chat Widget//EN',
    'BEGIN:VEVENT',
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(details)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

// (555) 123-4567 from an E.164 number; leaves a non-US-10-digit value as-is.
function formatPhone(n?: string | null): string | null {
  if (!n) return null;
  const digits = n.replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : n;
}

// "Tomorrow, September 2 at 7:15 PM EDT" — rendered in the returned tz (Eastern)
// and the visitor's UI locale.
function formatWhen(iso: string, tz: string, loc: UiLocale): string {
  const d = new Date(iso);
  const bcp = loc === 'es' ? 'es' : 'en-US';
  const key = dayKey(d, tz);
  const today = dayKey(new Date(), tz);
  const tomorrow = dayKey(new Date(Date.now() + 86_400_000), tz);
  const monthDay = new Intl.DateTimeFormat(bcp, { timeZone: tz, month: 'long', day: 'numeric' }).format(d);
  const time = new Intl.DateTimeFormat(bcp, { timeZone: tz, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(d);
  const weekday = new Intl.DateTimeFormat(bcp, { timeZone: tz, weekday: 'long' }).format(d);
  const raw = key === today ? translate(loc, 'Today') : key === tomorrow ? translate(loc, 'Tomorrow') : weekday;
  const lead = raw.charAt(0).toUpperCase() + raw.slice(1);
  const at = loc === 'es' ? 'a las' : 'at';
  return `${lead}, ${monthDay} ${at} ${time}`;
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
  const firmName = useWidgetStore((s) => s.branding)?.name ?? 'the firm';
  const uiLocale = useWidgetStore((s) => s.uiLocale);
  const t = (s: string) => translate(uiLocale, s);
  const bcp = uiLocale === 'es' ? 'es' : 'en-US';

  const [phase, setPhase] = useState<'loading' | 'pick' | 'unavailable' | 'booked'>('loading');
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [serverTz, setServerTz] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bookedInfo, setBookedInfo] = useState<{
    slotStart: string; end: string; timezone: string;
    callerId?: string | null; callbackPhone?: string | null; name?: string;
  } | null>(null);

  // Render in the response's timezone (always Eastern), never the browser's.
  const displayTz = serverTz ?? ET;

  // Fetch availability on mount (and on demand after a raced booking).
  const loadAvailability = useMemo(
    () => async (signal?: AbortSignal) => {
      if (!firmId) {
        setPhase('unavailable');
        return;
      }
      const from = dayKey(new Date(), ET);
      try {
        const res = await fetchAvailability(firmId, { from, days: 7, tz: ET }, signal);
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
    [firmId],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void loadAvailability(ctrl.signal);
    return () => ctrl.abort();
  }, [loadAvailability]);

  // Group slots into days in the visitor's timezone.
  const days = useMemo<DayGroup[]>(() => {
    const todayKey = dayKey(new Date(), displayTz);
    const tomorrowKey = dayKey(new Date(Date.now() + 86_400_000), displayTz);
    const map = new Map<string, DayGroup>();
    // Sort chronologically first (ISO strings sort lexically), so days and the
    // times within each day are always in order, never a jumbled list.
    for (const s of [...slots].sort((a, b) => a.start.localeCompare(b.start))) {
      const d = new Date(s.start);
      const key = dayKey(d, displayTz);
      if (!map.has(key)) {
        const top =
          key === todayKey
            ? t('Today')
            : key === tomorrowKey
              ? t('Tomorrow')
              : new Intl.DateTimeFormat(bcp, { timeZone: displayTz, weekday: 'short' }).format(d);
        const sub = new Intl.DateTimeFormat(bcp, { timeZone: displayTz, month: 'short', day: 'numeric' }).format(d);
        map.set(key, { key, top, sub, slots: [] });
      }
      map.get(key)!.slots.push(s);
    }
    return [...map.values()];
  }, [slots, displayTz, uiLocale]);

  // Incremental disclosure: start with no day chosen (the day chips lead). Only
  // clear a stale selection if a re-fetch dropped the day the visitor had picked.
  useEffect(() => {
    if (phase === 'pick' && selectedDay && !days.some((d) => d.key === selectedDay)) {
      setSelectedDay(null);
      setSelectedStart(null);
    }
  }, [phase, days, selectedDay]);

  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat(bcp, { timeZone: displayTz, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

  // Bucket a slot into Morning / Afternoon / Evening (display tz) so a long day
  // of times reads as a few short groups instead of 20+ loose chips.
  const partOfDay = (iso: string): 'Morning' | 'Afternoon' | 'Evening' => {
    const h = Number(
      new Intl.DateTimeFormat('en-US', { timeZone: displayTz, hour: '2-digit', hour12: false }).format(new Date(iso)),
    );
    return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  };

  const activeDay = days.find((d) => d.key === selectedDay) ?? null;

  const book = async (phone: string, name?: string, email?: string) => {
    setEmailError(null);
    setFormError(null);
    if (!selectedStart) {
      setFormError(t('Pick a time above first.'));
      return;
    }
    if (!conversationId) {
      setFormError(t('Your session expired. Please restart the chat.'));
      return;
    }
    setBusy(true);
    try {
      const res = await scheduleCallback({
        conversationId,
        firmId: firmId ?? undefined,
        name,
        phone,
        email: email ?? '',
        slotStart: selectedStart,
        timezone: ET,
        consentText: consentLabel,
        copyVersion: consentVersion,
      });
      const slot = slots.find((s) => s.start === selectedStart);
      setBookedInfo({
        // Render from the RETURNED instant + tz, never the tz we posted — the
        // booking is forced to Eastern (callback-confirmation-caller-id.md).
        slotStart: res.slotStart ?? selectedStart,
        end: slot?.end ?? selectedStart,
        timezone: res.timezone ?? ET,
        // callerId is canonical; callFromNumber is the legacy name.
        callerId: res.callerId ?? res.callFromNumber ?? null,
        callbackPhone: res.callbackPhone ?? phone,
        name: name?.trim() || undefined,
      });
      setPhase('booked');
    } catch (err) {
      const detail = errorDetail(err);
      const status = err instanceof ApiError ? err.status : 0;
      // 502 = slot raced/taken; 400 "too soon" = stale slot under the 60-min
      // notice. Both mean the grid is stale → silently refresh and re-pick.
      const tooSoon = status === 400 && /soon|60/i.test(detail ?? '');
      if (status === 502 || tooSoon) {
        setSelectedStart(null);
        setNotice(t('That time is no longer available. Please pick another.'));
        setPhase('loading');
        void loadAvailability();
      } else if (status === 503) {
        setPhase('unavailable');
      } else if (status === 404) {
        setFormError(t('Your session expired. Please reopen the chat and try again.'));
      } else if (status === 400 && detail?.toLowerCase().includes('email')) {
        setEmailError(detail);
      } else if (status === 400 && detail) {
        setFormError(detail);
      } else {
        setFormError(t("We couldn't book that time. Please try again."));
      }
    } finally {
      setBusy(false);
    }
  };

  // "Need a different time?" — back to the picker with a fresh availability pull.
  const reschedule = () => {
    setBookedInfo(null);
    setSelectedStart(null);
    setSelectedDay(null);
    setNotice(null);
    setFormError(null);
    setPhase('loading');
    void loadAvailability();
  };

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-hairline border-t-famaash" />
        <p className="mt-3 text-[14px] text-muted">{t('Checking available times…')}</p>
      </div>
    );
  }

  if (phase === 'unavailable') {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-famaash-soft text-ink">
          <PhoneIcon size={26} aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-[18px] font-bold text-ink">{t('No times to show right now')}</h3>
        <p className="mt-2 max-w-[34ch] text-[14px] leading-relaxed text-muted">
          {t("Online scheduling isn't available at the moment. Leave your number and we'll call you instead.")}
        </p>
        <button
          type="button"
          onClick={onFallback}
          className="mt-6 flex items-center gap-2 rounded-pill bg-famaash px-5 py-2.5 text-[13px] font-semibold text-white hover:opacity-95"
        >
          <PhoneIcon size={15} aria-hidden="true" />
          {t('Request a call instead')}
        </button>
      </div>
    );
  }

  if (phase === 'booked') {
    const info = bookedInfo;
    const cal = info
      ? calendarHref(info.slotStart, info.end, `${t('Call with')} ${firmName}`, `${firmName} ${t('will call you about your inquiry.')}`)
      : null;
    const when = info ? formatWhen(info.slotStart, info.timezone, uiLocale) : null;
    const callTo = formatPhone(info?.callbackPhone);
    const callFrom = formatPhone(info?.callerId);
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckIcon size={26} aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-[18px] font-bold text-ink">
          {info?.name ? `${t("You're booked")}, ${info.name}.` : `${t("You're booked")}.`}
        </h3>
        {when && <p className="mt-1.5 text-[15px] font-semibold text-ink">{when}</p>}
        <div className="mt-2 max-w-[36ch] space-y-1 text-[13.5px] leading-relaxed text-muted">
          {callTo && (
            <p>{t("We'll call you at")} <span className="font-semibold text-ink">{callTo}</span></p>
          )}
          {/* Only when the backend gave a real caller ID — a wrong number gets the
              real call screened as spam. */}
          {callFrom && (
            <p>{t('The call comes from')} <span className="font-semibold text-ink">{callFrom}</span> — {t("save this number so you know it's us")}.</p>
          )}
          <p>{t('A confirmation and reminder are on their way to your phone and email.')}</p>
        </div>
        <div className="mt-5 flex flex-col items-center gap-3">
          {cal && (
            <a
              href={cal}
              download="callback.ics"
              className="inline-flex items-center gap-2 rounded-pill border border-famaash-stroke px-5 py-2.5 text-[13px] font-semibold text-famaash hover:bg-famaash-soft"
            >
              <CalendarIcon size={15} aria-hidden="true" />
              {t('Add to calendar')}
            </a>
          )}
          <button
            type="button"
            onClick={reschedule}
            className="text-[13px] font-medium text-muted underline underline-offset-2 hover:text-ink"
          >
            {t('Need a different time?')}
          </button>
        </div>
      </div>
    );
  }

  // phase === 'pick'
  const nextDay = days[0] ?? null;
  const nextSlot = nextDay?.slots[0] ?? null;
  const timeGroups = activeDay
    ? (['Morning', 'Afternoon', 'Evening'] as const)
        .map((label) => ({ label, slots: activeDay.slots.filter((s) => partOfDay(s.start) === label) }))
        .filter((g) => g.slots.length > 0)
    : [];

  // Reveal one decision at a time: day, then time, then the form. Each made
  // choice collapses into a summary row, so the visitor only sees the step in
  // front of them (no long scroll). "Change" steps back one level.
  const haveDay = Boolean(selectedDay);
  const haveTime = Boolean(selectedStart);
  const heading = !haveDay ? t('Pick a day') : !haveTime ? t('Pick a time') : t('Confirm your callback');
  const atSep = uiLocale === 'es' ? 'a las' : 'at';
  const changeSelection = () => {
    if (selectedStart) setSelectedStart(null);
    else setSelectedDay(null);
  };

  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <h3 className="text-[19px] font-bold leading-snug text-ink">{heading}</h3>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
          {t("All times in Eastern Time (ET). We'll send a confirmation and a reminder.")}
        </p>
      </div>

      {notice && (
        <p className="rounded-lg bg-famaash-soft px-3 py-2 text-[12px] text-famaash">{notice}</p>
      )}

      {/* Summary row: the chosen day (and time) collapse here once picked. */}
      {haveDay && activeDay && (
        <div className="flex items-center gap-3 rounded-2xl border border-famaash-stroke bg-famaash-soft px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-famaash">
            <CalendarIcon size={17} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold text-ink">
              {haveTime ? `${activeDay.top} ${atSep} ${fmtTime(selectedStart!)}` : `${activeDay.top}, ${activeDay.sub}`}
            </span>
            <span className="block text-[12px] text-muted">
              {haveTime ? t("We'll call you then, Eastern time") : t('Choose a time below')}
            </span>
          </span>
          <button
            type="button"
            onClick={changeSelection}
            className="shrink-0 rounded-pill px-2.5 py-1 text-[12px] font-semibold text-famaash hover:bg-white"
          >
            {haveTime ? t('Change') : t('Change day')}
          </button>
        </div>
      )}

      {/* Step 1: soonest-slot shortcut + day chips (until a day is chosen). */}
      {!haveDay && (
        <>
          {nextSlot && nextDay && (
            <button
              type="button"
              onClick={() => {
                setSelectedDay(nextDay.key);
                setSelectedStart(nextSlot.start);
              }}
              className="flex w-full items-center gap-3 rounded-2xl border border-famaash-stroke bg-white px-4 py-3 text-left transition-colors hover:bg-subtle"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-famaash-soft text-famaash">
                <CalendarIcon size={17} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold uppercase tracking-wide text-muted-soft">
                  {t('Next available')}
                </span>
                <span className="block text-[14px] font-bold text-ink">
                  {nextDay.top} {atSep} {fmtTime(nextSlot.start)}
                </span>
              </span>
            </button>
          )}

          <div>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-soft">{t('Or choose a day')}</p>
            <div className="flex flex-wrap gap-2">
              {days.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => {
                    setSelectedDay(d.key);
                    setSelectedStart(null);
                  }}
                  className="flex flex-col items-center rounded-2xl border border-famaash-stroke bg-white px-4 py-2 transition-colors hover:bg-subtle"
                >
                  <span className="text-[14px] font-bold text-ink">{d.top}</span>
                  <span className="text-[12px] text-muted-soft">{d.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Step 2: time slots for the chosen day (until a time is chosen). */}
      {haveDay && !haveTime &&
        timeGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-soft">{t(group.label)}</p>
            <div className="grid grid-cols-3 gap-2">
              {group.slots.map((s) => (
                <button
                  key={s.start}
                  type="button"
                  onClick={() => setSelectedStart(s.start)}
                  className="rounded-lg border border-famaash-stroke bg-white px-2 py-2.5 text-[14px] font-medium tabular-nums text-ink transition-colors hover:border-famaash hover:bg-famaash-soft hover:text-famaash"
                >
                  {fmtTime(s.start)}
                </button>
              ))}
            </div>
          </div>
        ))}

      {/* Step 3: details form (once a time is chosen). */}
      {haveTime && (
        <>
          {formError && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-[12px] text-danger">{formError}</p>
          )}
          <CallbackForm
            variant="alert"
            heading={t('Where should we call you?')}
            body={t("Add your details and we'll call at the time above.")}
            cta={busy ? t('Booking your callback…') : t('Confirm booking')}
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
