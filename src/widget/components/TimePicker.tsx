import { useEffect, useRef, useState } from 'react';
import { WheelColumn } from './WheelColumn';

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = ['00', '15', '30', '45'];
const PERIODS = ['AM', 'PM'];

export interface TimeSelection {
  /** Display label, e.g. "2:30 PM". */
  label: string;
  /** 24h value, e.g. "14:30". */
  value24: string;
}

/**
 * Hour / minute / AM-PM wheels (matches CalendarPicker's look). Reports the
 * current selection up via onChange, including once on mount (default 9:00 AM).
 */
export function TimePicker({ onChange }: { onChange: (t: TimeSelection) => void }) {
  const [hourIdx, setHourIdx] = useState(8); // "9"
  const [minIdx, setMinIdx] = useState(0); // "00"
  const [periodIdx, setPeriodIdx] = useState(0); // "AM"

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const hour12 = Number(HOURS[hourIdx]);
    const minute = MINUTES[minIdx];
    const period = PERIODS[periodIdx];
    const label = `${hour12}:${minute} ${period}`;
    let hour24 = hour12 % 12;
    if (period === 'PM') hour24 += 12;
    const value24 = `${String(hour24).padStart(2, '0')}:${minute}`;
    onChangeRef.current({ label, value24 });
  }, [hourIdx, minIdx, periodIdx]);

  return (
    <div className="relative mt-2 overflow-hidden rounded-2xl border border-[#EAEEF3] bg-white px-3 py-2 shadow-md">
      <div
        className="pointer-events-none absolute inset-x-3 top-1/2 h-10 -translate-y-1/2 rounded-[10px] border-y border-[#EAEEF3] bg-[#F5F8FB]"
        aria-hidden="true"
      />
      <div className="relative flex items-stretch">
        <WheelColumn items={HOURS} index={hourIdx} onChange={setHourIdx} ariaLabel="Hour" />
        <WheelColumn items={MINUTES} index={minIdx} onChange={setMinIdx} ariaLabel="Minute" />
        <WheelColumn items={PERIODS} index={periodIdx} onChange={setPeriodIdx} ariaLabel="AM or PM" />
      </div>
    </div>
  );
}
