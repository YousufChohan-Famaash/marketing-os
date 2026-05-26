import type { ScopeChip as ScopeChipModel } from '../types/domain';
import { CheckIcon } from '../utils/icons';

interface ScopeChipProps {
  chip: ScopeChipModel;
}

export function ScopeChip({ chip }: ScopeChipProps) {
  return (
    <div
      role="status"
      className="mx-auto my-1 inline-flex max-w-[90%] items-center gap-1.5 rounded-pill bg-famaash-soft px-3 py-1 text-[12px] font-medium text-famaash"
    >
      <CheckIcon size={12} aria-hidden="true" />
      <span>{chip.label}</span>
    </div>
  );
}
