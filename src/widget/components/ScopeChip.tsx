import type { ScopeChip as ScopeChipModel } from '../types/domain';
import { CheckIcon } from '../utils/icons';

interface ScopeChipProps {
  chip: ScopeChipModel;
}

/**
 * User-facing confirmations (e.g. TCPA consent) render as a soft rounded pill
 * per the Figma design; background "passed silently" events (SOL, conflict
 * check, CMS sync, section complete) stay as a subtle inline line.
 */
const PILL_KINDS = new Set<ScopeChipModel['kind']>(['tcpa_captured']);

export function ScopeChip({ chip }: ScopeChipProps) {
  if (PILL_KINDS.has(chip.kind)) {
    return (
      <div
        role="status"
        className="inline-flex items-center gap-3 rounded-pill border border-[#EAEEF3] bg-[#F5F8FB] px-4 py-2.5 text-[13px] font-medium text-[#1A1A1A]"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#48CD8C]">
          <CheckIcon size={15} aria-hidden="true" />
        </span>
        <span>{chip.label}</span>
      </div>
    );
  }

  return (
    <div role="status" className="flex items-center gap-1.5 py-0.5 text-[12.5px] text-[#1A1A1A]">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[#48CD8C]">
        <CheckIcon size={13} aria-hidden="true" />
      </span>
      <span className="text-muted">{chip.label}</span>
    </div>
  );
}
