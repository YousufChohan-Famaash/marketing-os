import { useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '../utils/cn';
import { useT } from '../i18n';

interface QuickReplyChipsProps {
  options: string[];
  selected?: string;
  disabled?: boolean;
  /** When true, the lead picks several chips then confirms; answer is sent comma-joined. */
  multiSelect?: boolean;
  onSelect: (option: string) => void;
}

const chipBase =
  'rounded-pill border px-4 py-2 text-[13px] font-medium transition-colors';

/**
 * Keyboard-navigable chip group. Arrow keys move focus; Enter/Space activates.
 *
 * Single-select (default): tapping a chip answers immediately, then the chips
 * lock with the chosen one filled brand-purple and the rest dimmed.
 *
 * Multi-select: chips toggle; a Confirm button sends the picks comma-joined
 * (e.g. "neck, lower back"), then the group locks showing the chosen chips.
 */
export function QuickReplyChips({
  options,
  selected,
  disabled,
  multiSelect,
  onSelect,
}: QuickReplyChipsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const t = useT();
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

  const toggle = (option: string) =>
    setPicked((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option],
    );

  // Which chips read as "selected": the picked set (multi, unanswered) or the
  // committed answer (split back out for the locked multi view).
  const selectedSet = new Set(
    locked
      ? (selected ?? '').split(',').map((s) => s.trim()).filter(Boolean)
      : multiSelect
        ? picked
        : selected
          ? [selected]
          : [],
  );

  const onChipClick = (option: string) => {
    if (locked) return;
    if (multiSelect) toggle(option);
    else onSelect(option);
  };

  return (
    <div role="group" aria-label="Quick reply options" className="mt-2">
      <div className="flex flex-wrap gap-2">
        {options.map((option, i) => {
          const isSelected = selectedSet.has(option);
          return (
            <button
              key={option}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              disabled={locked}
              aria-pressed={isSelected}
              onClick={() => onChipClick(option)}
              onKeyDown={(e) => handleKey(e, i)}
              className={cn(
                chipBase,
                isSelected
                  ? 'border-transparent bg-famaash text-white'
                  : 'border-famaash-stroke bg-white text-[#1A1A1A] hover:bg-[#F5F8FB]',
                locked && 'cursor-default',
                locked && !isSelected && 'opacity-50',
              )}
            >
              {option}
            </button>
          );
        })}
      </div>

      {multiSelect && !locked && (
        <button
          type="button"
          disabled={picked.length === 0}
          onClick={() => onSelect(picked.join(', '))}
          className="mt-2 rounded-pill bg-famaash px-5 py-2 text-[13px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {picked.length > 0 ? `${t('Confirm')} (${picked.length})` : t('Confirm')}
        </button>
      )}
    </div>
  );
}
