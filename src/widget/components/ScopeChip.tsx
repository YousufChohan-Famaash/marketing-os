import type { ScopeChip as ScopeChipModel } from '../types/domain';
import { CheckIcon } from '../utils/icons';

interface ScopeChipProps {
  chip: ScopeChipModel;
}

/**
 * Subtle "passed silently" line (Figma): small green check + muted label,
 * left-aligned in the transcript. No prominent pill.
 */
export function ScopeChip({ chip }: ScopeChipProps) {
  return (
    <div role="status" className="flex items-center gap-1.5 py-0.5 text-[12.5px] text-[#1A1A1A]">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[#48CD8C]">
        <CheckIcon size={13} aria-hidden="true" />
      </span>
      <span className="text-muted">{chip.label}</span>
    </div>
  );
}
