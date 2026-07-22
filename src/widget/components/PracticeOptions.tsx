import { useRef, type KeyboardEvent } from 'react';
import { practiceIconFor } from './BrandAssets';

interface PracticeOptionsProps {
  options: string[];
  onSelect: (option: string) => void;
  disabled?: boolean;
  /** One option per row instead of the 2-up grid (used on mobile full-screen,
   * where a single column fills the tall panel instead of leaving dead space). */
  stack?: boolean;
}

/**
 * Practice-area chips: a correct case-type icon (or none) + the label. No arrow;
 * the chip itself is the affordance. Arrow-key navigable.
 */
export function PracticeOptions({ options, onSelect, disabled, stack }: PracticeOptionsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKey = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const len = options.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      refs.current[(idx + 1) % len]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      refs.current[(idx - 1 + len) % len]?.focus();
    }
  };

  return (
    <div
      role="group"
      aria-label="What kind of matter brings you here?"
      className={`grid gap-2 ${stack ? 'grid-cols-1' : 'grid-cols-2'}`}
    >
      {options.map((option, i) => {
        const icon = practiceIconFor(option, 17);
        return (
          <button
            key={option}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(option)}
            onKeyDown={(e) => handleKey(e, i)}
            className="group flex items-center gap-2 rounded-pill border border-[#EAEEF3] bg-[#F8F8F8] px-3 py-3 text-left transition-colors hover:bg-[#F5F8FB] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {icon && (
              <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center text-ink transition-colors group-hover:text-[color:var(--practice-accent)]">
                {icon}
              </span>
            )}
            <span className="line-clamp-2 flex-1 text-[13px] font-medium text-[#1A1A1A] transition-colors group-hover:text-[color:var(--practice-accent)]">
              {option}
            </span>
          </button>
        );
      })}
    </div>
  );
}
