import { useRef, type KeyboardEvent } from 'react';
import { practiceIconFor } from './BrandAssets';
import { ArrowRightIcon } from '../utils/icons';

interface PracticeOptionsProps {
  options: string[];
  onSelect: (option: string) => void;
  disabled?: boolean;
}

/**
 * Vertical practice-area rows: blue icon + label + arrow. Matches the Figma
 * intro picker. Arrow-key navigable.
 */
export function PracticeOptions({ options, onSelect, disabled }: PracticeOptionsProps) {
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
    <div role="group" aria-label="What kind of matter brings you here?" className="grid grid-cols-2 gap-2">
      {options.map((option, i) => {
        const hasIcon = !option.toLowerCase().includes('something else');
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
            {hasIcon && <span className="shrink-0">{practiceIconFor(option, 17)}</span>}
            <span className="line-clamp-2 flex-1 text-[13px] font-medium text-[#1A1A1A]">{option}</span>
            <ArrowRightIcon
              size={16}
              className="shrink-0 text-[#888888] transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
