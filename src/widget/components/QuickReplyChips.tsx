import { useRef, type KeyboardEvent } from 'react';

interface QuickReplyChipsProps {
  options: string[];
  selected?: string;
  disabled?: boolean;
  onSelect: (option: string) => void;
}

/**
 * Keyboard-navigable chip row. Arrow keys cycle, Enter/Space activates.
 * Once selected, chips collapse and `selected` is highlighted.
 */
export function QuickReplyChips({
  options,
  selected,
  disabled,
  onSelect,
}: QuickReplyChipsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

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

  if (selected) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label="Quick reply options"
      className="mt-2 flex flex-wrap gap-1.5"
    >
      {options.map((option, i) => (
        <button
          key={option}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(option)}
          onKeyDown={(e) => handleKey(e, i)}
          className="rounded-pill border border-famaash-border bg-white px-3 py-1.5 text-[13px] font-medium text-famaash transition-colors hover:bg-famaash-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          {option}
        </button>
      ))}
    </div>
  );
}
