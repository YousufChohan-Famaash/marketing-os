import { useState } from 'react';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from '../utils/icons';
import { cn } from '../utils/cn';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

interface CalendarGridProps {
  /** Selected date `YYYY-MM-DD`. */
  selectedISO: string;
  /** Today `YYYY-MM-DD` (for the today ring). */
  todayISO: string;
  /** Selectable bounds (inclusive), `YYYY-MM-DD`. */
  minISO: string;
  maxISO: string;
  /** Selectable years (for the year-jump grid + month nav clamp). */
  years: number[];
  onPick: (iso: string) => void;
}

/**
 * A modern month-grid calendar: month nav, a tappable Month-Year header that
 * opens a year jump, weekday row, and rounded day cells. Out-of-range days are
 * disabled; today gets a ring; the selected day is filled brand-purple.
 */
export function CalendarGrid({
  selectedISO,
  todayISO,
  minISO,
  maxISO,
  years,
  onPick,
}: CalendarGridProps) {
  const [selY, selM] = selectedISO.split('-').map(Number);
  const [view, setView] = useState({ y: selY, m: selM - 1 });
  const [showYears, setShowYears] = useState(false);

  const firstYear = years[0];
  const lastYear = years[years.length - 1];

  const go = (delta: number) => {
    setView((v) => {
      let m = v.m + delta;
      let y = v.y;
      if (m < 0) {
        m = 11;
        y -= 1;
      } else if (m > 11) {
        m = 0;
        y += 1;
      }
      if (y < firstYear || y > lastYear) return v;
      return { y, m };
    });
  };

  const dayCount = daysIn(view.y, view.m);
  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const cells: Array<number | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= dayCount; d++) cells.push(d);

  return (
    <div className="px-3 py-2">
      {showYears ? (
        <div className="wheel-col max-h-[176px] overflow-y-auto">
          <div className="grid grid-cols-4 gap-1.5">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => {
                  setView((v) => ({ ...v, y }));
                  setShowYears(false);
                }}
                className={cn(
                  'flex h-9 items-center justify-center rounded-lg text-[13px] font-medium transition-colors',
                  y === view.y ? 'bg-famaash text-white' : 'text-[#1A1A1A] hover:bg-subtle',
                )}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-1 flex items-center justify-between">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous month"
              className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-subtle"
            >
              <ChevronLeftIcon size={16} />
            </button>
            <button
              type="button"
              onClick={() => setShowYears(true)}
              aria-label="Choose year"
              className="flex items-center gap-1 rounded-pill px-2 py-1 text-[13px] font-bold text-[#1A1A1A] transition-colors hover:bg-subtle"
            >
              {MONTHS[view.m]} {view.y}
              <ChevronDownIcon size={14} className="text-muted" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next month"
              className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-subtle"
            >
              <ChevronRightIcon size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-0.5 place-items-center">
            {WEEKDAYS.map((w, i) => (
              <div
                key={`wd_${i}`}
                className="flex h-6 w-8 items-center justify-center text-[11px] font-semibold text-muted/70"
                aria-hidden="true"
              >
                {w[0]}
              </div>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <div key={`pad_${i}`} className="h-8 w-8" />;
              const iso = `${view.y}-${pad(view.m + 1)}-${pad(d)}`;
              const disabled = iso < minISO || iso > maxISO;
              const selected = iso === selectedISO;
              const today = iso === todayISO;
              return (
                <button
                  key={`day_${d}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(iso)}
                  aria-pressed={selected}
                  aria-label={iso}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-medium transition-colors',
                    selected
                      ? 'bg-famaash text-white'
                      : disabled
                        ? 'cursor-not-allowed text-muted-soft/40'
                        : 'text-[#1A1A1A] hover:bg-subtle',
                    today && !selected && 'ring-1 ring-famaash/40',
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
