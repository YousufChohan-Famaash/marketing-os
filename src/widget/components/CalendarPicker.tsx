import { useEffect, useState } from 'react';
import { WheelColumn } from './WheelColumn';

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
  /** Optional Cancel handler (e.g. go back). Defaults to resetting the wheels. */
  onCancel?: () => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const daysIn = (year: number, monthIdx: number) =>
  new Date(year, monthIdx + 1, 0).getDate();

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * iOS-alarm-style Month / Day / Year wheels. Used inline in the transcript for
 * dates (DOB, accident) and in the scheduler ('future' mode allows upcoming
 * dates and blocks the past).
 */
export function CalendarPicker({ mode = 'recent', onSubmit, onCancel }: CalendarPickerProps) {
  const today = new Date();
  const thisYear = today.getFullYear();
  const isFutureMode = mode === 'future';

  // Year range + default depend on the mode.
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

  const year = years[yearIdx];
  const dayCount = daysIn(year, monthIdx);
  const days = Array.from({ length: dayCount }, (_, i) => String(i + 1));

  useEffect(() => {
    if (dayIdx > dayCount - 1) setDayIdx(dayCount - 1);
  }, [dayCount, dayIdx]);

  const selected = new Date(year, monthIdx, dayIdx + 1);
  const blocked = isFutureMode
    ? startOfDay(selected) < startOfDay(today) // can't schedule in the past
    : startOfDay(selected) > startOfDay(today); // can't be born / crash in the future

  const reset = () => {
    setYearIdx(Math.max(0, years.indexOf(defaultYear)));
    setMonthIdx(today.getMonth());
    setDayIdx(today.getDate() - 1);
  };

  const submit = () => {
    if (blocked) return;
    const dayNum = Math.min(dayIdx, dayCount - 1) + 1;
    const pad = (n: number) => String(n).padStart(2, '0');
    const iso = `${year}-${pad(monthIdx + 1)}-${pad(dayNum)}`;
    const label = selected.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    onSubmit({ iso, label });
  };

  return (
    <div className="mt-2 w-full overflow-hidden rounded-2xl border border-[#EAEEF3] bg-white shadow-md">
      {/* Wheels */}
      <div className="relative px-3 py-2">
        <div
          className="pointer-events-none absolute inset-x-3 top-1/2 h-10 -translate-y-1/2 rounded-[10px] border-y border-[#EAEEF3] bg-[#F5F8FB]"
          aria-hidden="true"
        />
        <div className="relative flex items-stretch">
          <WheelColumn items={MONTHS} index={monthIdx} onChange={setMonthIdx} ariaLabel="Month" />
          <WheelColumn
            items={days}
            index={Math.min(dayIdx, dayCount - 1)}
            onChange={setDayIdx}
            ariaLabel="Day"
          />
          <WheelColumn items={years.map(String)} index={yearIdx} onChange={setYearIdx} ariaLabel="Year" />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 border-t border-hairline-soft px-4 py-4">
        <button
          type="button"
          onClick={onCancel ?? reset}
          className="rounded-pill bg-[#F5F8FB] px-4 py-2 text-[12px] font-bold text-[#1A1A1A] transition-colors hover:bg-hairline-soft"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={blocked}
          className="rounded-pill bg-famaash px-5 py-2 text-[12px] font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          OK
        </button>
      </div>
    </div>
  );
}
