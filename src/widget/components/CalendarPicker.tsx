import { useEffect, useRef, useState } from 'react';
import { cn } from '../utils/cn';

interface CalendarPickerProps {
  /** Tunes the initial year. 'birthday' starts ~30 years back; 'recent' starts on the current year. */
  mode?: 'birthday' | 'recent';
  /** Called with a human-readable date label (e.g. "Mar 15, 1985") when the user taps OK. */
  onSubmit: (label: string) => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ITEM_H = 40;        // px per row
const VISIBLE = 5;        // rows shown at once (must be odd)
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;
const WHEEL_H = VISIBLE * ITEM_H;

const daysIn = (year: number, monthIdx: number) =>
  new Date(year, monthIdx + 1, 0).getDate();

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * A single scroll-snapping wheel column (iOS picker style). The row centered in
 * the selection band is the active value; the rest fade via a mask gradient.
 */
function WheelColumn({
  items,
  index,
  onChange,
  ariaLabel,
}: {
  items: string[];
  index: number;
  onChange: (i: number) => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmatic = useRef(false);

  // Keep the scroll position aligned to the selected index (initial mount,
  // external clamps like Feb shortening the day list, or click-to-select).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = index * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 1) {
      programmatic.current = true;
      el.scrollTop = target;
      requestAnimationFrame(() => {
        programmatic.current = false;
      });
    }
  }, [index, items.length]);

  const handleScroll = () => {
    const el = ref.current;
    if (!el || programmatic.current) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)));
      if (i !== index) onChange(i);
    }, 80);
  };

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      role="listbox"
      aria-label={ariaLabel}
      className="wheel-col flex-1 overflow-y-auto snap-y snap-mandatory"
      style={{
        height: WHEEL_H,
        scrollSnapType: 'y mandatory',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent, #000 35%, #000 65%, transparent)',
        maskImage:
          'linear-gradient(to bottom, transparent, #000 35%, #000 65%, transparent)',
      }}
    >
      <div style={{ height: PAD }} aria-hidden="true" />
      {items.map((label, i) => (
        <div
          key={`${label}_${i}`}
          role="option"
          aria-selected={i === index}
          onClick={() => onChange(i)}
          className={cn(
            'flex cursor-pointer select-none items-center justify-center text-[15px] transition-colors',
            i === index ? 'font-semibold text-[#1A1A1A]' : 'text-muted',
          )}
          style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
        >
          {label}
        </div>
      ))}
      <div style={{ height: PAD }} aria-hidden="true" />
    </div>
  );
}

/**
 * Inline date picker shown in the transcript whenever the flow needs an exact
 * date (DOB, accident date, etc). iOS-alarm-style Month / Day / Year wheels so
 * the lead can spin to any year fast. Future dates can't be confirmed.
 */
export function CalendarPicker({ mode = 'recent', onSubmit }: CalendarPickerProps) {
  const today = new Date();
  const thisYear = today.getFullYear();

  // Years ascending, current year last; default selection depends on mode.
  const years: number[] = [];
  for (let y = thisYear - 120; y <= thisYear; y++) years.push(y);
  const defaultYear = mode === 'birthday' ? thisYear - 30 : thisYear;

  const [yearIdx, setYearIdx] = useState(years.indexOf(defaultYear));
  const [monthIdx, setMonthIdx] = useState(today.getMonth());
  const [dayIdx, setDayIdx] = useState(today.getDate() - 1);

  const year = years[yearIdx];
  const dayCount = daysIn(year, monthIdx);
  const days = Array.from({ length: dayCount }, (_, i) => String(i + 1));

  // If the month/year shortens the month, pull the day back into range.
  useEffect(() => {
    if (dayIdx > dayCount - 1) setDayIdx(dayCount - 1);
  }, [dayCount, dayIdx]);

  const selected = new Date(year, monthIdx, dayIdx + 1);
  const isFuture = startOfDay(selected) > startOfDay(today);

  const submit = () => {
    if (isFuture) return;
    onSubmit(
      selected.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    );
  };

  return (
    <div className="mt-2 w-full overflow-hidden rounded-2xl border border-[#EAEEF3] bg-white shadow-md">
      {/* Wheels */}
      <div className="relative px-3 py-2">
        {/* Selection band */}
        <div
          className="pointer-events-none absolute inset-x-3 top-1/2 h-10 -translate-y-1/2 rounded-[10px] border-y border-[#EAEEF3] bg-[#F5F8FB]"
          aria-hidden="true"
        />
        <div className="relative flex items-stretch">
          <WheelColumn
            items={MONTHS}
            index={monthIdx}
            onChange={setMonthIdx}
            ariaLabel="Month"
          />
          <WheelColumn
            items={days}
            index={Math.min(dayIdx, dayCount - 1)}
            onChange={setDayIdx}
            ariaLabel="Day"
          />
          <WheelColumn
            items={years.map(String)}
            index={yearIdx}
            onChange={setYearIdx}
            ariaLabel="Year"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 border-t border-hairline-soft px-4 py-4">
        <button
          type="button"
          onClick={() => {
            setYearIdx(years.indexOf(defaultYear));
            setMonthIdx(today.getMonth());
            setDayIdx(today.getDate() - 1);
          }}
          className="rounded-pill bg-[#F5F8FB] px-4 py-2 text-[12px] font-bold text-[#1A1A1A] transition-colors hover:bg-hairline-soft"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={isFuture}
          className="rounded-pill bg-famaash px-5 py-2 text-[12px] font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          OK
        </button>
      </div>
    </div>
  );
}
