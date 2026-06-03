import { useEffect, useRef } from 'react';
import { cn } from '../utils/cn';

export const WHEEL_ITEM_H = 40; // px per row
const VISIBLE = 5; // rows shown at once (must be odd)
const PAD = ((VISIBLE - 1) / 2) * WHEEL_ITEM_H;
export const WHEEL_H = VISIBLE * WHEEL_ITEM_H;

interface WheelColumnProps {
  items: string[];
  index: number;
  onChange: (i: number) => void;
  ariaLabel: string;
}

/**
 * A single scroll-snapping wheel column (iOS picker style). The row centered in
 * the selection band is the active value; the rest fade via a mask gradient.
 * Shared by CalendarPicker and TimePicker.
 */
export function WheelColumn({ items, index, onChange, ariaLabel }: WheelColumnProps) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmatic = useRef(false);

  // Keep the scroll position aligned to the selected index (initial mount,
  // external clamps, or click-to-select).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = index * WHEEL_ITEM_H;
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
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / WHEEL_ITEM_H)));
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
        maskImage: 'linear-gradient(to bottom, transparent, #000 35%, #000 65%, transparent)',
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
          style={{ height: WHEEL_ITEM_H, scrollSnapAlign: 'center' }}
        >
          {label}
        </div>
      ))}
      <div style={{ height: PAD }} aria-hidden="true" />
    </div>
  );
}
