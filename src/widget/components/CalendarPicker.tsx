import { useEffect, useState, type ChangeEvent } from 'react';
import { CalendarGrid } from './CalendarGrid';
import { WheelColumn } from './WheelColumn';
import { CalendarIcon, SlidersIcon } from '../utils/icons';
import { useMediaQuery } from '../utils/useMediaQuery';
import { useT } from '../i18n';
import { useWidgetStore } from '../store/widgetStore';
import { cn } from '../utils/cn';

export interface DateSelection {
  /** ISO `YYYY-MM-DD` — sent to the backend (unambiguous, stored verbatim). */
  iso: string;
  /** Human-readable label (e.g. "Mar 15, 1985") — shown in the transcript bubble. */
  label: string;
}

interface CalendarPickerProps {
  /**
   * Tunes the year range and which side is blocked:
   *   'birthday' — opens ~30y back, blocks future (DOB)
   *   'recent'   — opens this year, blocks future (accident date)
   *   'future'   — opens this year, blocks the past (scheduling a callback)
   */
  mode?: 'birthday' | 'recent' | 'future';
  /** Called with the chosen date (ISO for the backend, label for display) on OK. */
  onSubmit: (value: DateSelection) => void;
  /** Optional Cancel handler (e.g. go back). Defaults to resetting the picker. */
  onCancel?: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (year: number, monthIdx: number) => new Date(year, monthIdx + 1, 0).getDate();

/**
 * Date picker that defaults to just a typed `<input type="date">` line — the
 * user can type a date with the keyboard without ever opening a visual picker.
 * Tapping the calendar button reveals the visual picker: a month grid on big
 * screens, the iOS-style wheel slider on small ones (never both, and chosen by
 * screen size, not a manual toggle). 'future' mode allows upcoming dates and
 * blocks the past (scheduling); the other modes block the future.
 */
export function CalendarPicker({ mode = 'recent', onSubmit, onCancel }: CalendarPickerProps) {
  const t = useT();
  const uiLocale = useWidgetStore((s) => s.uiLocale);
  const bcp = uiLocale === 'es' ? 'es' : 'en-US';
  const MONTHS = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(bcp, { month: 'long' }).format(new Date(2000, i, 1)),
  );
  const today = new Date();
  const thisYear = today.getFullYear();
  const isFutureMode = mode === 'future';
  // Touch users get the wheel slider, mouse users the month grid. `pointer`
  // reflects the real input device, not the iframe/panel size, so it tracks the
  // user's actual viewport rather than how wide the chat happens to be.
  const isTouch = useMediaQuery('(pointer: coarse)');
  // When the chat is wide (expanded) the actions fit on the input line.
  const isWideChat = useMediaQuery('(min-width: 480px)');

  const years: number[] = [];
  if (isFutureMode) {
    for (let y = thisYear; y <= thisYear + 1; y++) years.push(y);
  } else {
    for (let y = thisYear - 120; y <= thisYear; y++) years.push(y);
  }
  const defaultYear = mode === 'birthday' ? thisYear - 30 : thisYear;

  const [yearIdx, setYearIdx] = useState(Math.max(0, years.indexOf(defaultYear)));
  const [monthIdx, setMonthIdx] = useState(today.getMonth());
  const [dayIdx, setDayIdx] = useState(today.getDate() - 1);
  // Collapsed by default — only the typed date line shows until the user opens it.
  const [showPicker, setShowPicker] = useState(false);

  const year = years[yearIdx];
  const dayCount = daysIn(year, monthIdx);
  const days = Array.from({ length: dayCount }, (_, i) => String(i + 1));

  useEffect(() => {
    if (dayIdx > dayCount - 1) setDayIdx(dayCount - 1);
  }, [dayCount, dayIdx]);

  // Everything below works off ISO strings — lexicographic compare == chronological.
  const isoValue = `${year}-${pad(monthIdx + 1)}-${pad(Math.min(dayIdx, dayCount - 1) + 1)}`;
  const todayISO = `${thisYear}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const minDate = isFutureMode ? todayISO : `${years[0]}-01-01`;
  const maxDate = isFutureMode ? `${years[years.length - 1]}-12-31` : todayISO;
  const blocked = isFutureMode ? isoValue < todayISO : isoValue > todayISO;

  const setFromIso = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return;
    const yi = years.indexOf(y);
    if (yi === -1) return; // outside the allowed range
    setYearIdx(yi);
    setMonthIdx(m - 1);
    setDayIdx(Math.min(d, daysIn(y, m - 1)) - 1);
  };

  const onTyped = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) setFromIso(e.target.value);
  };

  const reset = () => {
    setYearIdx(Math.max(0, years.indexOf(defaultYear)));
    setMonthIdx(today.getMonth());
    setDayIdx(today.getDate() - 1);
  };

  const submit = () => {
    if (blocked) return;
    const [y, m, d] = isoValue.split('-').map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString(bcp, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    onSubmit({ iso: isoValue, label });
  };

  // When the chat is wide and the visual picker is closed, the actions fit on
  // the input line; otherwise they sit in a footer below the picker.
  const buttonsInline = isWideChat && !showPicker;

  const actions = (
    <>
      <button
        type="button"
        onClick={onCancel ?? reset}
        className="rounded-pill bg-[#F5F8FB] px-4 py-2 text-[12px] font-bold text-[#1A1A1A] transition-colors hover:bg-hairline-soft"
      >
        {t('Cancel')}
      </button>
      <button
        type="button"
        onClick={submit}
        disabled={blocked}
        className="rounded-pill bg-famaash px-5 py-2 text-[12px] font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t('OK')}
      </button>
    </>
  );

  return (
    <div className="mt-2 w-full overflow-hidden rounded-2xl border border-[#EAEEF3] bg-white shadow-md">
      {/* Typed entry — keyboard accessible. The button reveals the visual picker. */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2',
          !buttonsInline && 'border-b border-hairline-soft',
        )}
      >
        <input
          id="cal-typed"
          type="date"
          value={isoValue}
          min={minDate}
          max={maxDate}
          onChange={onTyped}
          aria-label={t('Type a date')}
          className="cal-typed min-w-0 flex-1 rounded-lg border border-hairline bg-white px-3 py-2 text-[16px] text-ink focus:border-famaash focus:outline-none sm:text-[14px]"
        />
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          aria-label={showPicker ? t('Hide picker') : isTouch ? t('Open date picker') : t('Open calendar')}
          aria-pressed={showPicker}
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
            showPicker
              ? 'border-famaash/30 bg-famaash/10 text-famaash'
              : 'border-hairline bg-white text-muted hover:text-ink',
          )}
        >
          {isTouch ? <SlidersIcon size={18} /> : <CalendarIcon size={18} />}
        </button>
        {buttonsInline && actions}
      </div>

      {/* Visual picker — hidden until opened. Touch → wheel slider, mouse → grid. */}
      {showPicker &&
        (isTouch ? (
          <div className="relative px-3 py-2">
            <div
              className="pointer-events-none absolute inset-x-3 top-1/2 h-10 -translate-y-1/2 rounded-[10px] border-y border-[#EAEEF3] bg-[#F5F8FB]"
              aria-hidden="true"
            />
            <div className="relative flex items-stretch">
              <WheelColumn items={MONTHS} index={monthIdx} onChange={setMonthIdx} ariaLabel={t('Month')} />
              <WheelColumn
                items={days}
                index={Math.min(dayIdx, dayCount - 1)}
                onChange={setDayIdx}
                ariaLabel={t('Day')}
              />
              <WheelColumn items={years.map(String)} index={yearIdx} onChange={setYearIdx} ariaLabel={t('Year')} />
            </div>
          </div>
        ) : (
          <CalendarGrid
            selectedISO={isoValue}
            todayISO={todayISO}
            minISO={minDate}
            maxISO={maxDate}
            years={years}
            onPick={setFromIso}
          />
        ))}

      {/* Footer — only when the actions aren't already on the input line. */}
      {!buttonsInline && (
        <div className="flex items-center justify-end gap-2 border-t border-hairline-soft px-4 py-3">
          {actions}
        </div>
      )}
    </div>
  );
}
