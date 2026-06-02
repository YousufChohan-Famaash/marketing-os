import { useRef, type KeyboardEvent } from 'react';
import { cn } from '../utils/cn';

interface QuickReplyChipsProps {
  options: string[];
  selected?: string;
  disabled?: boolean;
  onSelect: (option: string) => void;
}

/**
 * Keyboard-navigable chip row. Arrow keys cycle, Enter/Space activates.
 * After a pick the chips stay in place: the chosen one fills brand-purple and
 * the rest fade out, locked from further input (Figma).
 */
export function QuickReplyChips({
  options,
  selected,
  disabled,
  onSelect,
}: QuickReplyChipsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const locked = Boolean(selected) || Boolean(disabled);

  const focusAt = (idx: number) => {
    const len = options.length;
    const wrapped = ((idx % len) + len) % len;
    refs.current[wrapped]?.focus();
  };

  const handleKey = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      focusAt(idx + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusAt(idx - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusAt(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusAt(options.length - 1);
    }
  };

  return (
    <div
      role="group"
      aria-label="Quick reply options"
      className="mt-2 flex flex-wrap gap-2"
    >
      {options.map((option, i) => {
        const isSelected = option === selected;
        return (
          <button
            key={option}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            disabled={locked}
            aria-pressed={isSelected}
            onClick={() => onSelect(option)}
            onKeyDown={(e) => handleKey(e, i)}
            className={cn(
              'rounded-pill border px-4 py-2 text-[13px] font-medium transition-colors',
              isSelected
                ? 'border-transparent bg-famaash text-white'
                : 'border-[#EAEEF3] bg-white text-[#1A1A1A] hover:bg-[#F5F8FB]',
              locked && 'cursor-default',
              locked && !isSelected && 'opacity-50',
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
